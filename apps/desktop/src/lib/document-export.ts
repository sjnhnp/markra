import katexStyles from "katex/dist/katex.css?raw";

export type ExportDocumentFormat = "html" | "pdf";

const defaultPdfMarginMm = 18;
const defaultPdfPageHeightMm = 297;
const defaultPdfPageWidthMm = 210;

export type MarkdownExportStyleOptions = {
  pdfFooter?: string;
  pdfHeader?: string;
  pdfHeightMm?: number;
  pdfMarginMm?: number;
  pdfMarginTopMm?: number;
  pdfMarginBottomMm?: number;
  pdfMarginLeftMm?: number;
  pdfMarginRightMm?: number;
  pdfPageBreakOnH1?: boolean;
  pdfWidthMm?: number;
};

function normalizePdfMarginMm(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultPdfMarginMm;

  return Math.min(Math.max(Math.round(value), 0), 60);
}

function normalizePdfPageDimensionMm(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.min(Math.max(Math.round(value), 50), 2000);
}

export function createMarkdownExportStyles({
  pdfFooter,
  pdfHeader,
  pdfHeightMm,
  pdfMarginMm,
  pdfMarginTopMm,
  pdfMarginBottomMm,
  pdfMarginLeftMm,
  pdfMarginRightMm,
  pdfPageBreakOnH1,
  pdfWidthMm
}: MarkdownExportStyleOptions = {}) {
  const hasHeader = Boolean(pdfHeader?.trim());
  const hasFooter = Boolean(pdfFooter?.trim());
  const pageMarginMm = normalizePdfMarginMm(pdfMarginMm);
  const marginTopMm = normalizePdfMarginMm(pdfMarginTopMm ?? pdfMarginMm);
  const marginBottomMm = normalizePdfMarginMm(pdfMarginBottomMm ?? pdfMarginMm);
  const marginLeftMm = normalizePdfMarginMm(pdfMarginLeftMm ?? pdfMarginMm);
  const marginRightMm = normalizePdfMarginMm(pdfMarginRightMm ?? pdfMarginMm);
  const pageHeightMm = normalizePdfPageDimensionMm(pdfHeightMm, defaultPdfPageHeightMm);
  const pageWidthMm = normalizePdfPageDimensionMm(pdfWidthMm, defaultPdfPageWidthMm);
  const pageBreakStyles = pdfPageBreakOnH1
    ? `

  .markdown-export h1 {
    break-before: page;
  }

  .markdown-export h1:first-child {
    break-before: auto;
  }`
    : "";

  return `
${katexStyles}

:root {
  color: #222;
  background: #fff;
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}

body {
  margin: 0;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.markdown-export {
  box-sizing: border-box;
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 56px;
  font-size: 16px;
  line-height: 1.65;
}

.markdown-export h1,
.markdown-export h2,
.markdown-export h3,
.markdown-export h4,
.markdown-export h5,
.markdown-export h6 {
  color: #111;
  line-height: 1.25;
}

.markdown-export img {
  max-width: 100%;
  height: auto;
}

.markdown-export pre {
  overflow-x: auto;
  padding: 16px;
  background: #f6f6f6;
  border-radius: 6px;
}

.markdown-export code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

.markdown-export table {
  width: 100%;
  border-collapse: collapse;
}

.markdown-export th,
.markdown-export td {
  padding: 8px 10px;
  border: 1px solid #ddd;
  text-align: left;
}

.markdown-export blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 4px solid #d8d8d8;
  color: #555;
}

.markdown-export .markra-math-render {
  color: #222;
  letter-spacing: 0;
}

.markdown-export .markra-math-render .katex {
  font-size: 1em;
}

.markdown-export .markra-math-render-inline {
  display: inline-flex;
  margin: 0 0.08em;
  vertical-align: -0.08em;
}

.markdown-export .markra-math-render-display {
  display: block;
  max-width: 100%;
  margin: 0.85em 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.markdown-export .markra-math-render-display .katex-display {
  margin: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.markdown-export-page-header,
.markdown-export-page-footer {
  display: none;
}

@media print {
  .markdown-export {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .markdown-export-page-header,
  .markdown-export-page-footer {
    position: fixed;
    right: 0;
    left: 0;
    display: block;
    color: #666;
    font-size: 10px;
    line-height: 1.4;
  }

  .markdown-export-page-header {
    top: 0;
    padding-bottom: 4mm;
    border-bottom: ${hasHeader ? "1px solid #ddd" : "0"};
  }

  .markdown-export-page-footer {
    bottom: 0;
    padding-top: 4mm;
    border-top: ${hasFooter ? "1px solid #ddd" : "0"};
  }${pageBreakStyles}

  .markra-pdf-counter-page::after {
    content: counter(page);
  }

  .markra-pdf-counter-pages::after {
    content: counter(pages);
  }
}

@page {
  size: ${pageWidthMm}mm ${pageHeightMm}mm;
  margin-top: ${marginTopMm}mm;
  margin-bottom: ${marginBottomMm}mm;
  margin-left: ${marginLeftMm}mm;
  margin-right: ${marginRightMm}mm;
}
`.trim();
}

export const markdownExportStyles = createMarkdownExportStyles();

type BuildMarkdownHtmlDocumentInput = {
  bodyHtml: string;
  language?: string;
  pdfAuthor?: string;
  pdfFooter?: string;
  pdfHeader?: string;
  pdfHeightMm?: number;
  pdfMarginMm?: number;
  pdfMarginTopMm?: number;
  pdfMarginBottomMm?: number;
  pdfMarginLeftMm?: number;
  pdfMarginRightMm?: number;
  pdfPageBreakOnH1?: boolean;
  pdfWidthMm?: number;
  styles?: string;
  title: string;
};

function escapeHtmlText(text: string) {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function encodeFileUrlPath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/%3A/giu, ":"))
    .join("/");
}

export function exportDocumentFileName(documentName: string, format: ExportDocumentFormat) {
  const trimmedName = documentName.trim();
  const baseName = (trimmedName || "Untitled")
    .replace(/\.(?:md|markdown|txt)$/iu, "")
    .trim() || "Untitled";

  return `${baseName}.${format}`;
}

export function localFileUrlFromPath(path: string) {
  const normalizedPath = path.replace(/\\/gu, "/");
  const absolutePath = /^[a-zA-Z]:\//u.test(normalizedPath)
    ? `/${normalizedPath}`
    : normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

  return `file://${encodeFileUrlPath(absolutePath)}`;
}

export function buildMarkdownHtmlDocument({
  bodyHtml,
  language = "en",
  pdfAuthor,
  pdfFooter,
  pdfHeader,
  pdfHeightMm,
  pdfMarginMm,
  pdfMarginTopMm,
  pdfMarginBottomMm,
  pdfMarginLeftMm,
  pdfMarginRightMm,
  pdfPageBreakOnH1,
  pdfWidthMm,
  styles,
  title
}: BuildMarkdownHtmlDocumentInput) {
  const escapedTitle = escapeHtmlText(title.trim() || "Untitled");
  const escapedLanguage = escapeHtmlText(language.trim() || "en");
  const escapedAuthor = escapeHtmlText(pdfAuthor?.trim() ?? "");
  const escapedFooter = escapeHtmlText(pdfFooter?.trim() ?? "");
  const escapedHeader = escapeHtmlText(pdfHeader?.trim() ?? "");
  const documentStyles = styles ?? createMarkdownExportStyles({
    pdfFooter,
    pdfHeader,
    pdfHeightMm,
    pdfMarginMm,
    pdfMarginTopMm,
    pdfMarginBottomMm,
    pdfMarginLeftMm,
    pdfMarginRightMm,
    pdfPageBreakOnH1,
    pdfWidthMm
  });

  const processText = (text: string | undefined) => {
    if (!text) return "";
    return escapeHtmlText(text.trim())
      .replace(/{{page}}/gu, '<span class="markra-pdf-counter-page"></span>')
      .replace(/{{pages}}/gu, '<span class="markra-pdf-counter-pages"></span>');
  };

  const processedHeader = processText(pdfHeader);
  const processedFooter = processText(pdfFooter);

  return [
    "<!doctype html>",
    `<html lang="${escapedLanguage}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ...(escapedAuthor ? [`<meta name="author" content="${escapedAuthor}">`] : []),
    `<title>${escapedTitle}</title>`,
    "<style>",
    documentStyles,
    "</style>",
    "</head>",
    "<body>",
    ...(processedHeader ? [`<header class="markdown-export-page-header">${processedHeader}</header>`] : []),
    ...(processedFooter ? [`<footer class="markdown-export-page-footer">${processedFooter}</footer>`] : []),
    '<main class="markdown-export">',
    bodyHtml,
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}
