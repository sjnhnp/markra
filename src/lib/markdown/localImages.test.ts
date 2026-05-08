import { createMarkdownImageSrcResolver } from "./localImages";

describe("local markdown image paths", () => {
  it("converts relative markdown image paths to local asset URLs beside the current document", () => {
    const resolveImageSrc = createMarkdownImageSrcResolver("/Users/me/notes/today.md", {
      convertFileSrc: (path) => `asset://${path}`
    });

    expect(resolveImageSrc("assets/pasted%20image.png")).toBe("asset:///Users/me/notes/assets/pasted image.png");
  });

  it("leaves remote and data image URLs unchanged", () => {
    const resolveImageSrc = createMarkdownImageSrcResolver("/Users/me/notes/today.md", {
      convertFileSrc: (path) => `asset://${path}`
    });

    expect(resolveImageSrc("https://example.com/logo.png")).toBe("https://example.com/logo.png");
    expect(resolveImageSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });
});
