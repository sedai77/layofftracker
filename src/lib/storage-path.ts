import fs from "node:fs";
import path from "node:path";

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV,
  );
}

export function resolveWritableFilePath(input: {
  envPath?: string;
  defaultFileName: string;
  namespace?: string;
}): string {
  const namespace = input.namespace ?? "layofftracker";

  const candidates: string[] = [];

  if (input.envPath) {
    candidates.push(input.envPath);
  }

  if (isServerlessRuntime()) {
    candidates.push(path.join("/tmp", namespace, input.defaultFileName));
  }

  candidates.push(path.join(process.cwd(), "data", input.defaultFileName));

  for (const candidate of candidates) {
    if (ensureWritableDirectory(path.dirname(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `No writable storage path available for ${input.defaultFileName}. Tried: ${candidates.join(", ")}`,
  );
}

function ensureWritableDirectory(directoryPath: string): boolean {
  try {
    fs.mkdirSync(directoryPath, { recursive: true });
    fs.accessSync(directoryPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
