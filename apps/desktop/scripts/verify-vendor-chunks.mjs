import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const assetsDir = fileURLToPath(new URL("../dist/assets/", import.meta.url));

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost/"
});

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
}

const windowGlobals = [
  "window",
  "document",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "CustomEvent",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "MutationObserver",
  "DOMParser",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle"
];

for (const name of windowGlobals) {
  const value = dom.window[name];

  if (value !== undefined) defineGlobal(name, value);
}

defineGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));

const vendorChunks = (await readdir(assetsDir))
  .filter((fileName) => fileName.endsWith(".js") && (fileName.startsWith("vendor-") || fileName.includes("-vendor-")))
  .sort();

for (const chunk of vendorChunks) {
  try {
    await import(pathToFileURL(join(assetsDir, chunk)).href);
  } catch (error) {
    console.error(`[verify-vendor-chunks] failed to import ${chunk}`);
    console.error(error?.stack ?? error);
    process.exit(1);
  }
}

console.log(`[verify-vendor-chunks] imported ${vendorChunks.length} vendor chunk(s) successfully`);
