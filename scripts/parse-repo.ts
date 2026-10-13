import { resolve } from "node:path";
import { parseRepository } from "../lib/parser/parse-repository";
import { readParseResult, writeParseResult } from "../lib/parser/result-file";

function getArguments(args: string[]): { directory: string; output?: string } {
  let directory = process.cwd();
  let output: string | undefined;
  let positionalSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--output" || argument === "-o") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${argument} needs a file path`);
      }
      output = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log("Usage: pnpm parse:repo [directory] [--output <result.json>]");
      process.exit(0);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!positionalSeen) {
      directory = argument;
      positionalSeen = true;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  return { directory, output };
}

async function main(): Promise<void> {
  const { directory, output } = getArguments(process.argv.slice(2));
  const result = await parseRepository(resolve(directory));
  const folders = new Set(result.files.map((file) => file.folder));

  console.log(`Repository: ${result.root}`);
  console.log(
    `Files: found ${result.filesFound}, parsed ${result.filesParsed}, skipped ${result.filesSkipped}`,
  );
  console.log(`Distinct folders: ${folders.size}`);
  console.log(
    `Imports: ${result.coverage.importsSeen} seen; ${result.coverage.resolved} resolved; ${result.coverage.external} external; ${result.coverage.excluded} excluded; ${result.coverage.unresolved} unresolved`,
  );
  console.log(
    `Re-exports: ${result.coverage.reExportsResolved} resolved / ${result.coverage.reExportsFound} found`,
  );

  if (result.filesSkipped > 0) {
    console.log("Skipped files:");
    for (const skipped of result.skippedFiles) {
      console.log(`  ${skipped.path}: ${skipped.reason}`);
    }
  }
  if (result.coverage.failureExamples.length > 0) {
    console.log("Import coverage gaps and exclusions:");
    const shownExamples = result.coverage.failureExamples.slice(0, 25);
    for (const item of shownExamples) {
      console.log(
        `  ${item.from} -> ${item.specifier} (${item.disposition}): ${item.reason}`,
      );
    }
    const omittedExamples = result.coverage.failureExamples.length - shownExamples.length;
    if (omittedExamples > 0) console.log(`  ... ${omittedExamples} more are recorded in the result file`);
  }

  if (output !== undefined) {
    await writeParseResult(output, result);
    const roundTripped = await readParseResult(output);
    if (
      roundTripped.filesParsed !== result.filesParsed ||
      roundTripped.edges.length !== result.edges.length ||
      roundTripped.coverage.importsSeen !== result.coverage.importsSeen
    ) {
      throw new Error("The written result did not pass the typed read-back check");
    }
    console.log(`Typed result written and read back: ${resolve(output)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
