import { imageSchema } from "@milkdown/kit/preset/commonmark";
import { Fragment, type NodeType } from "@milkdown/kit/prose/model";
import { Plugin, Selection, type SelectionBookmark } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type SavedClipboardImage = {
  alt: string;
  src: string;
};

export type SaveClipboardImage = (image: File) => Promise<SavedClipboardImage | null>;

function dataTransferImageFiles(dataTransfer: DataTransfer | null | undefined) {
  const files = dataTransfer?.files as (ArrayLike<File> & { item?: (index: number) => File | null }) | undefined;
  if (!files?.length) return [];

  const images: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = typeof files.item === "function" ? files.item(index) : files[index];
    if (file?.type.startsWith("image/")) images.push(file);
  }

  return images;
}

function clipboardImageFiles(event: ClipboardEvent) {
  return dataTransferImageFiles(event.clipboardData);
}

function droppedImageFiles(event: DragEvent) {
  return dataTransferImageFiles(event.dataTransfer);
}

function dropSelectionBookmark(view: EditorView, event: DragEvent) {
  const root = view.root as { elementFromPoint?: unknown };
  if (typeof root.elementFromPoint !== "function") return view.state.selection.getBookmark();

  const position = view.posAtCoords({
    left: event.clientX,
    top: event.clientY
  });
  if (!position) return view.state.selection.getBookmark();

  return Selection.near(view.state.doc.resolve(position.pos)).getBookmark();
}

function createImageFragment(images: SavedClipboardImage[], image: NodeType) {
  return Fragment.fromArray(
    images.map((savedImage) =>
      image.create({
        alt: savedImage.alt || "image",
        src: savedImage.src,
        title: ""
      })
    )
  );
}

async function saveAndInsertClipboardImages(
  view: EditorView,
  files: File[],
  saveClipboardImage: SaveClipboardImage,
  image: NodeType,
  bookmark: SelectionBookmark = view.state.selection.getBookmark()
) {
  const savedImages: SavedClipboardImage[] = [];

  for (const file of files) {
    const savedImage = await saveClipboardImage(file);
    if (savedImage) savedImages.push(savedImage);
  }

  if (!savedImages.length) return;

  const selection = bookmark.resolve(view.state.doc);
  const fragment = createImageFragment(savedImages, image);
  const transaction = view.state.tr.replaceWith(selection.from, selection.to, fragment).scrollIntoView();
  const cursor = Math.min(transaction.doc.content.size, selection.from + fragment.size);

  transaction.setSelection(Selection.near(transaction.doc.resolve(cursor)));
  view.dispatch(transaction);
  view.focus();
}

export function markraClipboardImagePlugin(saveClipboardImage: SaveClipboardImage) {
  return $prose((ctx) => {
    const image = imageSchema.type(ctx);

    return new Plugin({
      props: {
        handlePaste: (view, event) => {
          const files = clipboardImageFiles(event);
          if (!files.length) return false;

          event.preventDefault();
          saveAndInsertClipboardImages(view, files, saveClipboardImage, image).catch((error: unknown) => {
            console.error("[markra-clipboard-images] failed to insert pasted image", error);
          });
          return true;
        },
        handleDrop: (view, event) => {
          const files = droppedImageFiles(event);
          if (!files.length) return false;

          event.preventDefault();
          saveAndInsertClipboardImages(
            view,
            files,
            saveClipboardImage,
            image,
            dropSelectionBookmark(view, event)
          ).catch((error: unknown) => {
            console.error("[markra-clipboard-images] failed to insert dropped image", error);
          });
          return true;
        }
      }
    });
  });
}
