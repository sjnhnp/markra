export function clampNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return Math.max(min, Math.min(max, value));
}

export function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Untitled.md";
}

export function firstMarkdownPath(paths: string[]) {
  return paths.find(isMarkdownPath) ?? null;
}

export function folderNameFromDocumentPath(path: string | null) {
  if (!path) return "No folder";

  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-2) ?? "Files";
}

export function hasTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export function isMarkdownPath(path: string) {
  return /\.(md|markdown|txt)$/i.test(fileNameFromPath(path));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function joinApiUrl(baseUrl: string, path: string) {
  if (/^https?:\/\/[^/]+\/?$/.test(baseUrl) && path.startsWith("?")) return `${baseUrl.replace(/\/$/, "")}${path}`;
  if (baseUrl.includes("?")) return baseUrl;

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function pathNameFromPath(path: string | null) {
  if (!path) return "No folder";

  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Files";
}

export function stableTextKey(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return `${text.length}-${hash.toString(36)}`;
}
