import type { AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "../inline";
import type { AgentWorkspaceFile } from "../read-only-tools";
import type { MarkdownImageReference } from "./images";
import type { LocatedMarkdownRegion, LocatedSection } from "./locate";

export function formatHeadingOutlineText(headingAnchors: AiHeadingAnchor[]) {
  if (!headingAnchors.length) return "No Markdown headings are available in the current document.";

  return headingAnchors
    .map((heading) => `${"#".repeat(Math.max(1, heading.level))} ${heading.title} (${heading.from}-${heading.to})`)
    .join("\n");
}

export function formatSectionAnchorsText(sectionAnchors: AiDocumentAnchor[]) {
  if (!sectionAnchors.length) return "No Markdown sections are available in the current document.";

  return sectionAnchors
    .map((section) => `- ${section.id}: ${section.title ?? "(untitled)"} (${section.from}-${section.to})`)
    .join("\n");
}

export function formatDocumentAnchorsText(anchors: AiDocumentAnchor[]) {
  return anchors
    .map((anchor) => `- ${anchor.id}: ${anchor.description} (${anchor.from}-${anchor.to})`)
    .join("\n");
}

export function formatSelectionText(selection: AiSelectionContext | null) {
  if (!selection?.text.trim()) {
    return "No active selection or current block is available right now.";
  }

  return [
    `Range: ${selection.from}-${selection.to}`,
    `Cursor: ${selection.cursor ?? selection.to}`,
    `Source: ${selection.source ?? "selection"}`,
    "",
    selection.text
  ].join("\n");
}

export function formatWorkspaceFilesText(workspaceFiles: AgentWorkspaceFile[], limit: number | undefined) {
  if (!workspaceFiles.length) return "No nearby Markdown files are available.";

  return workspaceFiles
    .slice(0, limit ?? 40)
    .map((file) => `- ${file.relativePath}`)
    .join("\n");
}

export function formatWorkspaceFileContentText(file: AgentWorkspaceFile, content: string) {
  return [
    `Workspace file: ${file.relativePath}`,
    "",
    content.trim().length > 0 ? content : "(empty file)"
  ].join("\n");
}

export function formatDocumentImageReferencesText(references: MarkdownImageReference[]) {
  if (!references.length) return "No local Markdown image references are available in the current document.";

  return [
    "Markdown image references:",
    ...references.map((reference, index) => [
      `${index + 1}. src: ${reference.src}`,
      `   file: ${reference.fileName || "(unknown)"}`,
      `   alt: ${reference.alt || "(empty)"}`
    ].join("\n"))
  ].join("\n");
}

export function formatLocatedSectionText(located: LocatedSection) {
  return [
    `Recommended section: ${located.anchorId ?? "none"}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}

export function formatLocatedRegionText(located: LocatedMarkdownRegion) {
  return [
    `Recommended anchor: ${located.anchorId}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}
