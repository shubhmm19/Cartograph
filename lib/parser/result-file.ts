import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ParseResult } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function assertParseResult(value: unknown): asserts value is ParseResult {
  if (!isRecord(value) || value.contractVersion !== 1 || !isString(value.root)) {
    throw new Error("Unsupported or malformed parser result: expected contractVersion 1 and a root path");
  }
  if (
    !isCount(value.filesFound) ||
    !isCount(value.filesParsed) ||
    !isCount(value.filesSkipped) ||
    value.filesFound !== value.filesParsed + value.filesSkipped ||
    !Array.isArray(value.files) ||
    !Array.isArray(value.skippedFiles) ||
    !Array.isArray(value.edges) ||
    !isRecord(value.coverage)
  ) {
    throw new Error("Malformed parser result: file totals or collections are invalid");
  }
  if (value.files.length !== value.filesParsed || value.skippedFiles.length !== value.filesSkipped) {
    throw new Error("Malformed parser result: file totals do not match their collections");
  }
  for (const file of value.files) {
    if (
      !isRecord(file) ||
      !isString(file.path) ||
      !isString(file.folder) ||
      (file.moduleKind !== "module" && file.moduleKind !== "script") ||
      !isCount(file.lines) ||
      !isString(file.sha256) ||
      !isCount(file.fanIn) ||
      !isCount(file.fanOut)
    ) {
      throw new Error("Malformed parser result: a parsed file does not match the contract");
    }
  }
  for (const skipped of value.skippedFiles) {
    if (!isRecord(skipped) || !isString(skipped.path) || !isString(skipped.reason)) {
      throw new Error("Malformed parser result: a skipped file is missing its reason");
    }
  }
  for (const edge of value.edges) {
    if (
      !isRecord(edge) ||
      !isString(edge.from) ||
      !isString(edge.to) ||
      !["import", "re-export", "dynamic-import"].includes(String(edge.kind)) ||
      !Array.isArray(edge.specifiers) ||
      !edge.specifiers.every(isString)
    ) {
      throw new Error("Malformed parser result: a dependency edge does not match the contract");
    }
  }

  const coverage = value.coverage;
  const importsSeen = coverage.importsSeen;
  const resolved = coverage.resolved;
  const external = coverage.external;
  const excluded = coverage.excluded;
  const unresolved = coverage.unresolved;
  const reExportsFound = coverage.reExportsFound;
  const reExportsResolved = coverage.reExportsResolved;
  if (
    !isCount(importsSeen) ||
    !isCount(resolved) ||
    !isCount(external) ||
    !isCount(excluded) ||
    !isCount(unresolved) ||
    !isCount(reExportsFound) ||
    !isCount(reExportsResolved) ||
    importsSeen !== resolved + external + excluded + unresolved ||
    !Array.isArray(coverage.imports) ||
    !Array.isArray(coverage.failureExamples)
  ) {
    throw new Error("Malformed parser result: coverage counts or collections are invalid");
  }
  const validKinds = ["import", "re-export", "dynamic-import"];
  const validDispositions = ["resolved", "external", "excluded", "unresolved"];
  for (const item of coverage.imports) {
    if (
      !isRecord(item) ||
      !isString(item.from) ||
      !isString(item.specifier) ||
      !validKinds.includes(String(item.kind)) ||
      !validDispositions.includes(String(item.disposition)) ||
      (item.target !== undefined && !isString(item.target)) ||
      (item.reason !== undefined && !isString(item.reason))
    ) {
      throw new Error("Malformed parser result: an import coverage item does not match the contract");
    }
  }
  if (coverage.imports.length !== coverage.importsSeen) {
    throw new Error("Malformed parser result: importsSeen does not match coverage.imports");
  }
  for (const example of coverage.failureExamples) {
    if (
      !isRecord(example) ||
      !isString(example.from) ||
      !isString(example.specifier) ||
      !validKinds.includes(String(example.kind)) ||
      !validDispositions.includes(String(example.disposition)) ||
      !isString(example.reason)
    ) {
      throw new Error("Malformed parser result: a coverage example is invalid");
    }
  }
}

export async function writeParseResult(outputPath: string, result: ParseResult): Promise<void> {
  const destination = resolve(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export async function readParseResult(inputPath: string): Promise<ParseResult> {
  const raw: unknown = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  assertParseResult(raw);
  return raw;
}
