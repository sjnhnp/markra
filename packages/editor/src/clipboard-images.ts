import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type SavedClipboardImage = {
  alt: string;
  src: string;
};

export type SaveClipboardImage = (image: File) => Promise<SavedClipboardImage | null>;

function clipboardImageFiles(event: ClipboardEvent) {
  const files = event.clipboardData?.files as (ArrayLike<File> & { item?: (index: number) => File | null }) | undefined;
  if (!files?.length) return [];

  const images: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = typeof files.item === "function" ? files.item(index) : files[index];
    if (file?.type.startsWith("image/")) images.push(file);
  }

  return images;
}

function escapeImageAlt(alt: string) {
  return alt.replace(/\\/gu, "\\\\").replace(/\]/gu, "\\]");
}

function imageMarkdown(image: SavedClipboardImage) {
  return `![${escapeImageAlt(image.alt || "image")}](${image.src})`;
}

async function saveAndInsertClipboardImages(
  view: EditorView,
  files: File[],
  saveClipboardImage: SaveClipboardImage
) {
  const bookmark = view.state.selection.getBookmark();
  const savedImages: SavedClipboardImage[] = [];

  for (const file of files) {
    const savedImage = await saveClipboardImage(file);
    if (savedImage) savedImages.push(savedImage);
  }

  if (!savedImages.length) return;

  const selection = bookmark.resolve(view.state.doc);
  const markdown = savedImages.map(imageMarkdown).join("\n");
  const transaction = view.state.tr.insertText(markdown, selection.from, selection.to).scrollIntoView();

  view.dispatch(transaction);
  view.focus();
}

export function markraClipboardImagePlugin(saveClipboardImage: SaveClipboardImage) {
  return $prose(() => {
    return new Plugin({
      props: {
        handlePaste: (view, event) => {
          const files = clipboardImageFiles(event);
          if (!files.length) return false;

          event.preventDefault();
          saveAndInsertClipboardImages(view, files, saveClipboardImage).catch((error: unknown) => {
            console.error("[markra-clipboard-images] failed to insert pasted image", error);
          });
          return true;
        }
      }
    });
  });
}
