import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderTree,
  List,
  Search,
  TableOfContents
} from "lucide-react";
import type { MarkdownOutlineItem } from "../lib/markdown";
import type { NativeMarkdownFolderFile } from "../lib/nativeFile";

type MarkdownFileTreeDrawerProps = {
  currentPath: string | null;
  files: NativeMarkdownFolderFile[];
  open: boolean;
  outlineItems: MarkdownOutlineItem[];
  rootName: string;
  onOpenFile: (file: NativeMarkdownFolderFile) => void | Promise<void>;
  onSelectOutlineItem: (item: MarkdownOutlineItem, index: number) => void;
  onToggle: () => void;
};

type FolderNode = {
  type: "folder";
  name: string;
  relativePath: string;
  children: TreeNode[];
};

type FileNode = {
  type: "file";
  file: NativeMarkdownFolderFile;
  name: string;
  relativePath: string;
};

type TreeNode = FolderNode | FileNode;

function sortTreeNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  nodes.forEach((node) => {
    if (node.type === "folder") sortTreeNodes(node.children);
  });
}

function buildMarkdownFileTree(files: NativeMarkdownFolderFile[]) {
  const rootNodes: TreeNode[] = [];
  const folders = new Map<string, FolderNode>();

  files.forEach((file) => {
    const parts = file.relativePath.split(/[\\/]/).filter(Boolean);
    if (parts.length === 0) return;

    let siblings = rootNodes;
    let parentPath = "";

    parts.slice(0, -1).forEach((folderName) => {
      const relativePath = parentPath ? `${parentPath}/${folderName}` : folderName;
      let folder = folders.get(relativePath);

      if (!folder) {
        folder = {
          type: "folder",
          name: folderName,
          relativePath,
          children: []
        };
        folders.set(relativePath, folder);
        siblings.push(folder);
      }

      siblings = folder.children;
      parentPath = relativePath;
    });

    siblings.push({
      type: "file",
      file,
      name: parts.at(-1) ?? file.name,
      relativePath: file.relativePath
    });
  });

  sortTreeNodes(rootNodes);
  return rootNodes;
}

function filterMarkdownFileTree(nodes: TreeNode[], query: string): TreeNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nodes;

  return nodes.flatMap((node): TreeNode[] => {
    if (node.type === "file") {
      return node.relativePath.toLowerCase().includes(normalizedQuery) ? [node] : [];
    }

    const children = filterMarkdownFileTree(node.children, normalizedQuery);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function MarkdownFileTreeDrawer({
  currentPath,
  files,
  open,
  outlineItems,
  rootName,
  onOpenFile,
  onSelectOutlineItem,
  onToggle
}: MarkdownFileTreeDrawerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [viewMode, setViewMode] = useState<"files" | "outline">("files");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const tree = useMemo(() => filterMarkdownFileTree(buildMarkdownFileTree(files), searchQuery), [files, searchQuery]);
  const showingOutline = viewMode === "outline";

  const toggleFolder = (relativePath: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }
      return next;
    });
  };

  const renderNodes = (nodes: TreeNode[], depth = 0, label = "Markdown files") => (
    <ol
      className={depth === 0 ? "m-0 list-none p-0" : "ml-5 list-none border-l border-(--border-default) p-0"}
      role={depth === 0 ? "tree" : "group"}
      aria-label={label}
    >
      {nodes.map((node) => {
        const rowBranchClass =
          depth === 0
            ? ""
            : "before:absolute before:left-[-1px] before:top-1/2 before:h-px before:w-3 before:bg-(--border-default)";

        if (node.type === "folder") {
          const expanded = searchQuery.trim().length > 0 || expandedFolders.has(node.relativePath);

          return (
            <li key={node.relativePath}>
              <button
                className={`relative flex h-8 w-full cursor-pointer items-center gap-1 border-0 bg-transparent py-0 pr-2 pl-3 text-left text-[13px] leading-none text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none ${rowBranchClass}`}
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleFolder(node.relativePath)}
              >
                {expanded ? (
                  <ChevronDown aria-hidden="true" className="shrink-0" size={13} />
                ) : (
                  <ChevronRight aria-hidden="true" className="shrink-0" size={13} />
                )}
                <Folder aria-hidden="true" className="shrink-0" size={16} />
                <span className="min-w-0 truncate">{node.name}</span>
              </button>
              {expanded ? renderNodes(node.children, depth + 1, `${node.name} children`) : null}
            </li>
          );
        }

        const active = node.file.path === currentPath;

        return (
          <li key={node.file.path}>
            <button
              className={`relative grid h-8 w-full cursor-pointer grid-cols-[17px_minmax(0,1fr)] items-center gap-1.5 border-0 bg-transparent py-0 pr-2 pl-3 text-left text-[13px] leading-none text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none aria-[current=page]:border-l-[3px] aria-[current=page]:border-(--text-secondary) aria-[current=page]:bg-(--bg-active) aria-[current=page]:text-(--text-heading) ${rowBranchClass}`}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={node.relativePath}
              title={node.file.path}
              onClick={() => {
                void onOpenFile(node.file);
              }}
            >
              <FileText aria-hidden="true" className="shrink-0" size={15} />
              <span className="min-w-0 truncate">{node.name}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <button
        className="fixed bottom-3 left-3 z-30 inline-flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-(--text-secondary) opacity-40 transition-[background-color,color,opacity] duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) hover:opacity-100 focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:opacity-100 focus-visible:outline-none"
        type="button"
        aria-label="Toggle Markdown files"
        aria-pressed={open}
        onClick={onToggle}
      >
        <List aria-hidden="true" size={15} />
      </button>

      {open ? (
        <aside
          className="markdown-file-tree flex h-full min-h-0 w-72 flex-col border-r border-(--border-default) bg-(--bg-secondary) pt-9.5"
          aria-label="Markdown file tree"
        >
          <div className="grid h-10 grid-cols-[40px_minmax(0,1fr)_40px] items-center border-b border-(--border-default)">
            <button
              className="inline-flex size-10 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
              type="button"
              aria-label={showingOutline ? "Show files" : "Show outline"}
              onClick={() => setViewMode((mode) => (mode === "files" ? "outline" : "files"))}
            >
              {showingOutline ? (
                <FolderTree aria-hidden="true" size={16} />
              ) : (
                <TableOfContents aria-hidden="true" size={16} />
              )}
            </button>
            <h2 className="m-0 truncate text-center text-[14px] font-[560] tracking-normal text-(--text-heading)">
              {showingOutline ? "大纲" : "文件"}
            </h2>
            <button
              className="inline-flex size-10 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
              type="button"
              aria-label="Search Markdown files"
              aria-pressed={searchOpen}
              disabled={showingOutline}
              onClick={() => {
                if (searchOpen) setSearchQuery("");
                setSearchOpen((open) => !open);
              }}
            >
              <Search aria-hidden="true" size={16} />
            </button>
          </div>

          {!showingOutline && searchOpen ? (
            <>
              <label className="sr-only" htmlFor="markra-file-search">
                Search Markdown files
              </label>
              <input
                id="markra-file-search"
                className="h-8 border-0 border-b border-(--border-default) bg-transparent px-3 text-[12px] text-(--text-primary) outline-none placeholder:text-(--text-secondary) focus:border-(--border-strong)"
                type="search"
                value={searchQuery}
                placeholder="Search"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </>
          ) : null}

          {showingOutline ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {outlineItems.length > 0 ? (
                <ol className="m-0 list-none p-0" aria-label="Document outline">
                  {outlineItems.map((item, index) => (
                    <li key={`${item.level}-${item.title}-${index}`}>
                      <button
                        className="h-8 w-full cursor-pointer truncate border-0 bg-transparent py-0 pr-3 text-left text-[13px] leading-none text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
                        style={{ paddingLeft: `${12 + (item.level - 1) * 14}px` }}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onSelectOutlineItem(item, index)}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="m-0 px-4 py-3 text-[12px] text-(--text-secondary)">No headings</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex h-9 items-center gap-1 px-4 text-[13px] text-(--text-secondary)">
                <Folder aria-hidden="true" size={16} />
                <span className="min-w-0 truncate">{rootName}</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                {tree.length > 0 ? renderNodes(tree) : <p className="m-0 px-4 py-3 text-[12px] text-(--text-secondary)">No Markdown files</p>}
              </div>
            </>
          )}
        </aside>
      ) : null}
    </>
  );
}
