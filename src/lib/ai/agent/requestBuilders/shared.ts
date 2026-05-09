import { isRecord } from "../../../utils";

export function mergeRequestBody(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const current = result[key];
    result[key] = isPlainRecord(current) && isPlainRecord(value) ? mergeRequestBody(current, value) : value;
  }

  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}
