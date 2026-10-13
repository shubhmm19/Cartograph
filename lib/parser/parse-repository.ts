import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Project, ts } from "ts-morph";
import {
  fallbackAdapter,
  isDeclarationFile,
  isSupportedSourceFile,
  type FrameworkAdapter,
} from "./adapter";
import type {
  DependencyEdge,
  EdgeKind,
  ImportCoverageItem,
  ModuleKind,
  ParseResult,
  SkippedFile,
} from "./types";

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "vendor",
]);
const NON_SOURCE_RESOURCE_EXTENSIONS = [
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".woff",
  ".woff2",
  ".ttf",
];

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
  symbolicLink: boolean;
}

interface ImportReference {
  specifier: string;
  kind: EdgeKind;
}

function normalizedRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

function isInside(root: string, filePath: string): boolean {
  const pathFromRoot = relative(root, filePath);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function ignoredDirectoryForPath(root: string, filePath: string): string | undefined {
  const pathFromRoot = relative(root, filePath);
  const directories = pathFromRoot.split(sep).slice(0, -1);
  return directories.find((directory) => IGNORED_DIRECTORY_NAMES.has(directory));
}

async function walkRepository(root: string): Promise<CandidateFile[]> {
  const candidates: CandidateFile[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORY_NAMES.has(entry.name)) await visit(absolutePath);
        continue;
      }
      if (!isSupportedSourceFile(entry.name)) continue;
      candidates.push({
        absolutePath,
        relativePath: normalizedRelativePath(root, absolutePath),
        symbolicLink: entry.isSymbolicLink(),
      });
    }
  };

  await visit(root);
  return candidates;
}

function getImports(sourceFile: ReturnType<Project["addSourceFileAtPath"]>): ImportReference[] {
  const references: ImportReference[] = [];
  for (const declaration of sourceFile.getImportDeclarations()) {
    references.push({
      specifier: declaration.getModuleSpecifierValue(),
      kind: "import",
    });
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier !== undefined) references.push({ specifier, kind: "re-export" });
  }
  for (const callExpression of sourceFile.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
    if (callExpression.getExpression().getKind() !== ts.SyntaxKind.ImportKeyword) continue;
    const argument = callExpression.getArguments()[0];
    if (argument === undefined || !ts.isStringLiteralLike(argument.compilerNode)) continue;
    references.push({ specifier: argument.compilerNode.text, kind: "dynamic-import" });
  }
  return references;
}

function getCompilerOptions(
  root: string,
  sourceDirectory: string,
  cache: Map<string, ts.CompilerOptions>,
): ts.CompilerOptions {
  const candidateConfig = ts.findConfigFile(sourceDirectory, ts.sys.fileExists, "tsconfig.json");
  const configPath = candidateConfig !== undefined && isInside(root, candidateConfig)
    ? candidateConfig
    : undefined;
  const cacheKey = configPath ?? "<default>";
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (configPath === undefined) {
    const defaults = {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };
    cache.set(cacheKey, defaults);
    return defaults;
  }

  const configErrors: ts.Diagnostic[] = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => configErrors.push(diagnostic),
  });
  if (parsed === undefined || configErrors.length > 0) {
    const firstError = configErrors[0];
    const reason = firstError === undefined
      ? "unknown TypeScript configuration error"
      : ts.flattenDiagnosticMessageText(firstError.messageText, "\n");
    throw new Error(`Could not parse ${normalizedRelativePath(root, configPath)}: ${reason}`);
  }
  const options = { ...parsed.options, allowJs: true };
  cache.set(cacheKey, options);
  return options;
}

function getPackageNames(root: string, sourcePath: string): Set<string> {
  const names = new Set<string>();
  let currentDirectory = dirname(sourcePath);
  while (isInside(root, currentDirectory)) {
    const manifestPath = join(currentDirectory, "package.json");
    if (ts.sys.fileExists(manifestPath)) {
      const raw = ts.sys.readFile(manifestPath);
      if (raw !== undefined) {
        try {
          const manifest: unknown = JSON.parse(raw);
          if (typeof manifest === "object" && manifest !== null) {
            const packageManifest = manifest as Record<string, unknown>;
            for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
              const packages = packageManifest[section];
              if (typeof packages === "object" && packages !== null) {
                for (const name of Object.keys(packages)) names.add(name);
              }
            }
          }
        } catch {
          // A bad package manifest does not prevent the source file being parsed.
        }
      }
    }
    if (currentDirectory === root) break;
    const parent = dirname(currentDirectory);
    if (parent === currentDirectory) break;
    currentDirectory = parent;
  }
  return names;
}

function packageNameFromSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope !== undefined && name !== undefined ? `${scope}/${name}` : undefined;
  }
  return specifier.split("/")[0];
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../") || isAbsolute(specifier);
}

function findExistingNonSourceResource(
  specifier: string,
  containingFile: string,
  root: string,
  compilerOptions: ts.CompilerOptions,
): string | undefined {
  const candidates: string[] = [];
  if (isRelativeSpecifier(specifier)) {
    candidates.push(resolve(dirname(containingFile), specifier));
  } else {
    const paths = compilerOptions.paths;
    const pathsBase = typeof compilerOptions.pathsBasePath === "string"
      ? compilerOptions.pathsBasePath
      : typeof compilerOptions.baseUrl === "string"
        ? compilerOptions.baseUrl
        : root;
    for (const [pattern, targets] of Object.entries(paths ?? {})) {
      const wildcard = pattern.indexOf("*");
      let wildcardValue: string | undefined;
      if (wildcard < 0) {
        if (specifier !== pattern) continue;
      } else {
        const prefix = pattern.slice(0, wildcard);
        const suffix = pattern.slice(wildcard + 1);
        if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
        wildcardValue = specifier.slice(prefix.length, specifier.length - suffix.length);
      }
      for (const target of targets) {
        const substituted = wildcardValue === undefined
          ? target
          : target.replace("*", wildcardValue);
        candidates.push(resolve(pathsBase, substituted));
      }
    }
  }

  for (const candidate of candidates) {
    if (ts.sys.fileExists(candidate) && !isSupportedSourceFile(candidate)) return candidate;
    if (extname(candidate) !== "") continue;
    for (const extension of NON_SOURCE_RESOURCE_EXTENSIONS) {
      const withExtension = `${candidate}${extension}`;
      if (ts.sys.fileExists(withExtension)) return withExtension;
    }
  }
  return undefined;
}

function countLines(contents: string): number {
  if (contents.length === 0) return 0;
  const lines = contents.split(/\r\n|\r|\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function syntaxErrorReason(
  program: ts.Program,
  sourceFile: ReturnType<Project["addSourceFileAtPath"]>,
): string | undefined {
  const diagnostics = program.getSyntacticDiagnostics(sourceFile.compilerNode);
  if (diagnostics.length === 0) return undefined;
  const first = ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ");
  return `syntax error: ${first}`;
}

export async function parseRepository(
  directoryPath: string,
  adapter: FrameworkAdapter = fallbackAdapter,
): Promise<ParseResult> {
  const root = await realpath(resolve(directoryPath));
  const candidates = await walkRepository(root);
  const skippedFiles: SkippedFile[] = [];
  const files: ParseResult["files"] = [];
  const coverageImports: ImportCoverageItem[] = [];
  const edgeMap = new Map<string, DependencyEdge>();
  const compilerOptionsCache = new Map<string, ts.CompilerOptions>();
  const compilerOptions = getCompilerOptions(root, root, compilerOptionsCache);
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions,
  });
  const candidatePaths = new Set(candidates.map((candidate) => resolve(candidate.absolutePath)));
  const sourceByAbsolutePath = new Map<string, ReturnType<Project["addSourceFileAtPath"]>>();
  const addFileFailures = new Map<string, string>();

  for (const candidate of candidates) {
    if (candidate.symbolicLink) {
      skippedFiles.push({ path: candidate.relativePath, reason: "symbolic link not followed" });
      continue;
    }
    if (isDeclarationFile(candidate.absolutePath)) {
      skippedFiles.push({ path: candidate.relativePath, reason: "type declaration file, not an implementation file" });
      continue;
    }
    try {
      const sourceFile = project.addSourceFileAtPath(candidate.absolutePath);
      sourceByAbsolutePath.set(resolve(candidate.absolutePath), sourceFile);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown parser error";
      addFileFailures.set(resolve(candidate.absolutePath), `could not parse file: ${reason}`);
    }
  }

  const program = project.getProgram().compilerObject;
  for (const candidate of candidates) {
    if (candidate.symbolicLink || isDeclarationFile(candidate.absolutePath)) continue;
    const absolutePath = resolve(candidate.absolutePath);
    const addFileFailure = addFileFailures.get(absolutePath);
    if (addFileFailure !== undefined) {
      skippedFiles.push({ path: candidate.relativePath, reason: addFileFailure });
      continue;
    }
    const sourceFile = sourceByAbsolutePath.get(absolutePath);
    if (sourceFile === undefined) {
      skippedFiles.push({ path: candidate.relativePath, reason: "could not parse file: parser returned no source file" });
      continue;
    }
    const parseError = syntaxErrorReason(program, sourceFile);
    if (parseError !== undefined) {
      skippedFiles.push({ path: candidate.relativePath, reason: parseError });
      continue;
    }
    try {
      const contents = await readFile(candidate.absolutePath, "utf8");
      const moduleKind: ModuleKind = ts.isExternalModule(sourceFile.compilerNode) ? "module" : "script";
      files.push({
        path: candidate.relativePath,
        folder: adapter.folderFor(candidate.absolutePath, root),
        moduleKind,
        lines: countLines(contents),
        sha256: createHash("sha256").update(contents).digest("hex"),
        fanIn: 0,
        fanOut: 0,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown parser error";
      skippedFiles.push({ path: candidate.relativePath, reason: `could not parse file: ${reason}` });
    }
  }

  const parsedPaths = new Set(files.map((file) => file.path));
  for (const file of files) {
    const sourceFile = sourceByAbsolutePath.get(resolve(root, file.path));
    if (sourceFile === undefined) continue;
    const sourceAbsolutePath = resolve(root, file.path);
    const sourceCompilerOptions = getCompilerOptions(
      root,
      dirname(sourceAbsolutePath),
      compilerOptionsCache,
    );
    const packageNames = getPackageNames(root, sourceAbsolutePath);
    const requireFromSource = createRequire(sourceAbsolutePath);

    for (const reference of getImports(sourceFile)) {
      const resolvedModule = ts.resolveModuleName(
        reference.specifier,
        sourceAbsolutePath,
        sourceCompilerOptions,
        ts.sys,
      ).resolvedModule;
      let coverageItem: ImportCoverageItem;

      if (resolvedModule !== undefined) {
        const resolvedPath = resolve(resolvedModule.resolvedFileName);
        if (!isInside(root, resolvedPath)) {
          coverageItem = {
            from: file.path,
            specifier: reference.specifier,
            kind: reference.kind,
            disposition: "external",
            target: resolvedModule.resolvedFileName,
            reason: "resolved outside the repository",
          };
        } else {
          const excludedDirectory = ignoredDirectoryForPath(root, resolvedPath);
          const relativeTarget = normalizedRelativePath(root, resolvedPath);
          const knownSkipped = skippedFiles.find((skipped) => skipped.path === relativeTarget);
          if (excludedDirectory !== undefined) {
            coverageItem = {
              from: file.path,
              specifier: reference.specifier,
              kind: reference.kind,
              disposition: "excluded",
              target: relativeTarget,
              reason: `target is inside excluded ${excludedDirectory}/ directory`,
            };
          } else if (isDeclarationFile(resolvedPath)) {
            coverageItem = {
              from: file.path,
              specifier: reference.specifier,
              kind: reference.kind,
              disposition: "excluded",
              target: relativeTarget,
              reason: "target is a type declaration file",
            };
          } else if (knownSkipped !== undefined) {
            coverageItem = {
              from: file.path,
              specifier: reference.specifier,
              kind: reference.kind,
              disposition: "excluded",
              target: relativeTarget,
              reason: `target file was skipped: ${knownSkipped.reason}`,
            };
          } else if (!candidatePaths.has(resolvedPath) || !parsedPaths.has(relativeTarget)) {
            coverageItem = {
              from: file.path,
              specifier: reference.specifier,
              kind: reference.kind,
              disposition: "excluded",
              target: relativeTarget,
              reason: "target is not a selected TypeScript or JavaScript implementation file",
            };
          } else {
            coverageItem = {
              from: file.path,
              specifier: reference.specifier,
              kind: reference.kind,
              disposition: "resolved",
              target: relativeTarget,
            };
            const edgeKey = `${file.path}\0${relativeTarget}\0${reference.kind}`;
            const existing = edgeMap.get(edgeKey);
            if (existing === undefined) {
              edgeMap.set(edgeKey, {
                from: file.path,
                to: relativeTarget,
                kind: reference.kind,
                specifiers: [reference.specifier],
              });
            } else if (!existing.specifiers.includes(reference.specifier)) {
              existing.specifiers.push(reference.specifier);
            }
          }
        }
      } else {
        const isDeclaredPackage = packageNames.has(packageNameFromSpecifier(reference.specifier) ?? "");
        const isNodeBuiltin =
          reference.specifier.startsWith("node:") || builtinModules.includes(reference.specifier);
        let runtimeResolvedPath: string | undefined;
        if (!isRelativeSpecifier(reference.specifier) && !isNodeBuiltin) {
          try {
            runtimeResolvedPath = requireFromSource.resolve(reference.specifier);
          } catch {
            runtimeResolvedPath = undefined;
          }
        }
        const resourcePath = findExistingNonSourceResource(
          reference.specifier,
          sourceAbsolutePath,
          root,
          sourceCompilerOptions,
        );

        if (resourcePath !== undefined) {
          const resourceIsInsideRepository = isInside(root, resourcePath);
          coverageItem = {
            from: file.path,
            specifier: reference.specifier,
            kind: reference.kind,
            disposition: resourceIsInsideRepository ? "excluded" : "external",
            target: resourceIsInsideRepository
              ? normalizedRelativePath(root, resourcePath)
              : resourcePath,
            reason: resourceIsInsideRepository
              ? "target exists but is not a TypeScript or JavaScript implementation file"
              : "resource target is outside the repository",
          };
        } else if (runtimeResolvedPath !== undefined && isInside(root, runtimeResolvedPath)) {
          const relativeTarget = normalizedRelativePath(root, runtimeResolvedPath);
          coverageItem = {
            from: file.path,
            specifier: reference.specifier,
            kind: reference.kind,
            disposition: "excluded",
            target: relativeTarget,
            reason: "external package implementation is excluded from the repository graph",
          };
        } else if (!isRelativeSpecifier(reference.specifier) && (isDeclaredPackage || isNodeBuiltin || runtimeResolvedPath !== undefined)) {
          coverageItem = {
            from: file.path,
            specifier: reference.specifier,
            kind: reference.kind,
            disposition: "external",
            reason: "external package or Node.js built-in; no repository file target",
          };
        } else {
          coverageItem = {
            from: file.path,
            specifier: reference.specifier,
            kind: reference.kind,
            disposition: "unresolved",
            reason: isRelativeSpecifier(reference.specifier)
              ? "relative module could not be resolved to a file"
              : "module could not be resolved and is not declared as a package",
          };
        }
      }
      coverageImports.push(coverageItem);
    }
  }

  const edges = [...edgeMap.values()].sort((left, right) =>
    `${left.from}\0${left.to}\0${left.kind}`.localeCompare(`${right.from}\0${right.to}\0${right.kind}`),
  );
  const fanIn = new Map<string, Set<string>>();
  const fanOut = new Map<string, Set<string>>();
  for (const edge of edges) {
    const outgoing = fanOut.get(edge.from) ?? new Set<string>();
    outgoing.add(edge.to);
    fanOut.set(edge.from, outgoing);
    const incoming = fanIn.get(edge.to) ?? new Set<string>();
    incoming.add(edge.from);
    fanIn.set(edge.to, incoming);
  }
  for (const file of files) {
    file.fanIn = fanIn.get(file.path)?.size ?? 0;
    file.fanOut = fanOut.get(file.path)?.size ?? 0;
  }

  const counts = {
    resolved: coverageImports.filter((item) => item.disposition === "resolved").length,
    external: coverageImports.filter((item) => item.disposition === "external").length,
    excluded: coverageImports.filter((item) => item.disposition === "excluded").length,
    unresolved: coverageImports.filter((item) => item.disposition === "unresolved").length,
  };
  const reExports = coverageImports.filter((item) => item.kind === "re-export");
  const failureExamples = coverageImports.filter(
    (item) =>
      item.disposition === "unresolved" ||
      item.disposition === "excluded" ||
      (item.kind === "re-export" && item.disposition === "external"),
  );

  return {
    contractVersion: 1,
    root,
    filesFound: candidates.length,
    filesParsed: files.length,
    filesSkipped: skippedFiles.length,
    files,
    skippedFiles,
    edges,
    coverage: {
      importsSeen: coverageImports.length,
      ...counts,
      reExportsFound: reExports.length,
      reExportsResolved: reExports.filter((item) => item.disposition === "resolved").length,
      imports: coverageImports,
      failureExamples,
    },
  };
}
