export type EdgeKind = "import" | "re-export" | "dynamic-import";

export type ModuleKind = "module" | "script";

export interface ParsedFile {
  path: string;
  folder: string;
  moduleKind: ModuleKind;
  lines: number;
  sha256: string;
  fanIn: number;
  fanOut: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  specifiers: string[];
}

export type ImportDisposition = "resolved" | "external" | "excluded" | "unresolved";

export interface ImportCoverageItem {
  from: string;
  specifier: string;
  kind: EdgeKind;
  disposition: ImportDisposition;
  target?: string;
  reason?: string;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ParseResult {
  contractVersion: 1;
  root: string;
  filesFound: number;
  filesParsed: number;
  filesSkipped: number;
  files: ParsedFile[];
  skippedFiles: SkippedFile[];
  edges: DependencyEdge[];
  coverage: {
    importsSeen: number;
    resolved: number;
    external: number;
    excluded: number;
    unresolved: number;
    reExportsFound: number;
    reExportsResolved: number;
    imports: ImportCoverageItem[];
    failureExamples: ImportCoverageItem[];
  };
}
