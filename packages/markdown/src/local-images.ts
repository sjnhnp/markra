import { convertFileSrc } from "@tauri-apps/api/core";
import { hasTauriRuntime } from "@markra/shared";

type MarkdownImageSrcResolverOptions = {
  convertFileSrc?: (path: string) => string;
};

function isRemoteOrEmbeddedImageSrc(src: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(src) && !/^[a-zA-Z]:[\\/]/u.test(src);
}

function documentDirectory(path: string) {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (slash < 0) return "";

  return path.slice(0, slash);
}

function documentSeparator(path: string) {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

function decodeMarkdownImagePath(src: string) {
  try {
    return decodeURI(src.split(/[?#]/u)[0] ?? src);
  } catch {
    return src;
  }
}

function resolveLocalPath(src: string, documentPath: string) {
  const decodedSrc = decodeMarkdownImagePath(src);
  const separator = documentSeparator(documentPath);

  if (decodedSrc.startsWith("/") || /^[a-zA-Z]:[\\/]/u.test(decodedSrc)) {
    return decodedSrc;
  }

  const parts = [...documentDirectory(documentPath).split(/[\\/]/u), ...decodedSrc.split(/[\\/]/u)];
  const resolvedParts: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      resolvedParts.pop();
      continue;
    }
    resolvedParts.push(part);
  }

  if (documentPath.startsWith("/")) return `/${resolvedParts.join("/")}`;

  return resolvedParts.join(separator);
}

export function createMarkdownImageSrcResolver(
  documentPath: string | null | undefined,
  options: MarkdownImageSrcResolverOptions = {}
) {
  const toFileSrc = options.convertFileSrc ?? convertFileSrc;

  return (src: string) => {
    if (!documentPath || isRemoteOrEmbeddedImageSrc(src)) return src;
    if (!options.convertFileSrc && !hasTauriRuntime()) return src;

    return toFileSrc(resolveLocalPath(src, documentPath));
  };
}
