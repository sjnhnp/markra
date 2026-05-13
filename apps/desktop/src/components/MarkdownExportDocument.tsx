import { Children, isValidElement, useEffect, useRef, type ReactNode } from "react";
import { renderToString } from "katex";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { ExportDocumentFormat } from "../lib/document-export";

export type MarkdownExportSnapshot = {
  id: number;
  kind: ExportDocumentFormat;
  markdown: string;
  title: string;
};

export type RenderedMarkdownExport = {
  bodyHtml: string;
  id: number;
  kind: ExportDocumentFormat;
  title: string;
};

type MarkdownExportDocumentProps = {
  onRendered: (exported: RenderedMarkdownExport) => unknown;
  resolveImageSrc?: (src: string) => string;
  snapshot: MarkdownExportSnapshot | null;
};

function childrenToText(children: ReactNode) {
  return Children.toArray(children)
    .map((child) => typeof child === "string" || typeof child === "number" ? String(child) : "")
    .join("");
}

function hasMathClass(className: unknown, kind: "display" | "inline") {
  return typeof className === "string" && className.split(/\s+/u).includes(`math-${kind}`);
}

function renderMathSource(source: string, kind: "display" | "inline") {
  const html = renderToString(source, {
    displayMode: kind === "display",
    output: "htmlAndMathml",
    strict: "ignore",
    throwOnError: false
  });

  return (
    <span
      aria-label={kind === "display" ? "Math formula" : "Inline math formula"}
      className={`markra-math-render markra-math-render-${kind}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MarkdownExportDocument({
  onRendered,
  resolveImageSrc,
  snapshot
}: MarkdownExportDocumentProps) {
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!snapshot || !articleRef.current) return;

    onRendered({
      bodyHtml: articleRef.current.innerHTML,
      id: snapshot.id,
      kind: snapshot.kind,
      title: snapshot.title
    });
  }, [onRendered, snapshot]);

  if (!snapshot) return null;

  return (
    <section
      aria-hidden="true"
      className="markdown-export-document"
      data-markra-export-document={snapshot.kind}
    >
      <article className="markdown-paper markdown-export-paper" ref={articleRef}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          components={{
            a: ({ node: _node, ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
            code: ({ node: _node, className, children, ...props }) => {
              if (hasMathClass(className, "inline")) {
                return renderMathSource(childrenToText(children), "inline");
              }

              if (hasMathClass(className, "display")) {
                return renderMathSource(childrenToText(children), "display");
              }

              return <code {...props} className={className}>{children}</code>;
            },
            img: ({ node: _node, src, alt, ...props }) => (
              <img
                {...props}
                alt={alt ?? ""}
                src={resolveImageSrc && typeof src === "string" ? resolveImageSrc(src) : src}
              />
            ),
            pre: ({ node: _node, children, ...props }) => {
              const onlyChild = Children.toArray(children)[0];
              if (
                isValidElement<{ className?: string }>(onlyChild) &&
                hasMathClass(onlyChild.props.className, "display")
              ) {
                return onlyChild;
              }

              return <pre {...props}>{children}</pre>;
            }
          }}
        >
          {snapshot.markdown}
        </ReactMarkdown>
      </article>
    </section>
  );
}
