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

export function isMarkdownPath(path: string) {
  return /\.(md|markdown|txt)$/i.test(fileNameFromPath(path));
}

export function pathNameFromPath(path: string | null) {
  if (!path) return "No folder";

  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Files";
}
