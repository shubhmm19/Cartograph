import { basename, dirname, extname, relative, sep } from "node:path";

export interface FrameworkAdapter {
  readonly name: string;
  folderFor(filePath: string, repositoryRoot: string): string;
}

/** Phase 03 deliberately supplies no framework-specific file conventions. */
export const fallbackAdapter: FrameworkAdapter = {
  name: "fallback",
  folderFor(filePath, repositoryRoot) {
    const parent = relative(repositoryRoot, dirname(filePath));
    return parent.split(sep).join("/") || ".";
  },
};

export function isSupportedSourceFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].includes(
    extension,
  );
}

export function isDeclarationFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".d.cts");
}
