import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { stripDebugPlugin } from "./scripts/vite/strip-debug";

const chunkSizeLimit = 450 * 1024;
const imageAssetPattern = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i;

function outputAssetFileName(asset: { names?: string[]; originalFileNames?: string[] }) {
  const sourceName = asset.names?.[0] ?? asset.originalFileNames?.[0] ?? "";

  if (imageAssetPattern.test(sourceName)) return "assets/images/[name]-[hash][extname]";

  return "assets/[name]-[hash][extname]";
}

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
const piAgentDependencies = dependencyPattern(["@mariozechner/pi-agent-core", "@mariozechner/pi-ai", "typebox"]);
const aiSdkDependencies = dependencyPattern([
  "@anthropic-ai",
  "@aws-sdk",
  "@google",
  "@mistralai",
  "openai",
  "partial-json",
  "proxy-agent",
  "undici",
  "zod-to-json-schema"
]);

function vendorChunkName(id: string) {
  if (reactDependencies.test(id)) return "react-vendor";
  if (milkdownDependencies.test(id)) return "milkdown-vendor";
  if (tauriDependencies.test(id)) return "tauri-vendor";
  if (iconDependencies.test(id)) return "icons-vendor";
  if (piAgentDependencies.test(id)) return "pi-agent-vendor";
  if (aiSdkDependencies.test(id)) return "ai-sdk-vendor";
  if (id.includes("node_modules")) return "vendor";

  return null;
}

export default defineConfig(({ mode }) => ({
  define: {
    __MARKRA_DEBUG__: JSON.stringify(mode !== "production")
  },
  plugins: [react(), tailwindcss(), ...(mode === "production" ? [stripDebugPlugin()] : [])],
  build: {
    assetsInlineLimit: (filePath) => {
      // Keep provider SVG logos as standalone assets instead of embedding them into JS chunks.
      if (filePath.toLowerCase().endsWith(".svg")) return false;

      return undefined;
    },
    rolldownOptions: {
      output: {
        assetFileNames: outputAssetFileName,
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
}));
