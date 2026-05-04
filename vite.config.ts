import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const chunkSizeLimit = 450 * 1024;

function dependencyPattern(dependencies: string[]) {
  const dependencySource = dependencies.map((dependency) => dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  return new RegExp(`node_modules[\\\\/](?:\\.pnpm[\\\\/][^\\\\/]+[\\\\/]node_modules[\\\\/])?(?:${dependencySource})(?:[\\\\/]|-)`);
}

const reactDependencies = dependencyPattern(["react", "react-dom"]);
const milkdownDependencies = dependencyPattern([
  "@milkdown",
  "prosemirror",
  "remark",
  "micromark",
  "unified",
  "mdast-util",
  "unist-util",
  "hast-util",
  "markdown-table",
  "orderedmap",
  "crelt",
  "rope-sequence",
  "w3c-keyname"
]);
const tauriDependencies = dependencyPattern(["@tauri-apps"]);
const iconDependencies = dependencyPattern(["lucide-react", "lucide-static"]);

function vendorChunkName(id: string) {
  if (reactDependencies.test(id)) return "react-vendor";
  if (milkdownDependencies.test(id)) return "milkdown-vendor";
  if (tauriDependencies.test(id)) return "tauri-vendor";
  if (iconDependencies.test(id)) return "icons-vendor";
  if (id.includes("node_modules")) return "vendor";

  return null;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: vendorChunkName,
              maxSize: chunkSizeLimit
            }
          ]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
