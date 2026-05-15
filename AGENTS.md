# Markra Engineering Guidelines

This document only defines engineering conventions for this repository.

## Package Management

- Use `pnpm` for all JavaScript and frontend dependency workflows.
- This repository is a pnpm workspace. The desktop app lives in `apps/desktop`; reusable TypeScript packages live in `packages/`.
- Common commands:
  - `pnpm install`
  - `pnpm dev`
  - `pnpm test`
  - `pnpm build`
  - `pnpm tauri ...`
- Keep `pnpm-lock.yaml`.
- Do not add `package-lock.json`, `yarn.lock`, `bun.lockb`, or lockfiles from other package managers.

## Tech Stack

- Desktop shell: Tauri v2.
- Frontend: React, TypeScript, Milkdown, and Tailwind CSS.
- Icons: prefer `lucide-react`.
- Styling should use Tailwind CSS as much as practical. Global CSS should be reserved for design tokens, base styles, Milkdown/Markdown generated content, and platform-level polish.

## Code Organization

- Keep changes small and focused.
- Avoid unrelated refactors.
- Apps belong in `apps/`; reusable packages belong in `packages/`.
- Current package boundaries:
  - `packages/shared`: cross-cutting types, i18n, small pure utilities, and runtime debug logging.
  - `packages/ai`: AI provider settings, provider requests, agent runtime, AI tools, and web search tools.
  - `packages/editor`: Milkdown editor adapters, shortcuts, input rules, AI preview, and selection handling.
  - `packages/markdown`: Markdown parsing and Markdown asset/path helpers.
- Keep Tauri frontend bridge code in `apps/desktop/src/lib/tauri`; it is app shell integration, not a shared package.
- Keep desktop-only build tooling such as the debug-strip Vite plugin in `apps/desktop/scripts/`.
- Keep shared cross-cutting TypeScript in `packages/shared` and import it through `@markra/shared` public exports.
- Split reusable UI into components instead of concentrating layout and behavior in `App.tsx`.
- Keep business logic, platform integration, and editor adapter logic in clear modules.
- Prefer established libraries for mature domains such as editor behavior, Markdown parsing, and platform APIs.
- Do not use the TypeScript `void` keyword or operator. Use `unknown`, omit explicit callback return annotations when practical, or call promises directly with their own error handling.
- Do not revert user changes unless explicitly requested.

## Testing Boundaries

- Add or update focused tests when changing business logic, user-facing behavior, editor behavior, file reliability, AI flows, or other product functionality.
- Configuration files and other code that does not implement business logic or product functionality do not require unit tests.
- Text-only changes do not require unit tests, including copy edits, label wording, placeholder text, static help text, and translation wording updates.
- Removed features do not need dedicated unit tests that only prove the feature no longer exists. Prefer deleting obsolete tests and keeping coverage focused on the remaining supported behavior.
- The following do not require unit tests by default: `package.json`, lockfiles, `tsconfig` files, Vite config, Tauri config, generated files, build scripts, static metadata, documentation, pure formatting changes, and pure styling changes.
- If a configuration change affects runtime behavior, verify it with the relevant command or integration build instead of forcing a unit test for the configuration file itself.
- Before reporting completion for code changes, run the smallest meaningful verification. Common checks are `pnpm test` and `pnpm build`; desktop packaging changes can use `pnpm tauri build --debug` when practical.

## Repository Hygiene

- Do not commit generated directories such as `node_modules/`, `dist/`, or `apps/*/src-tauri/target/`.
- Do not commit temporary caches, debug artifacts, or local environment files.
- Confirm that a new dependency is actually needed before adding it.
- Prefer reusing the current stack over introducing additional frameworks or tools.
- Update this document when repository-wide conventions change.

## Upstream Synchronization

- **Upstream Source**: `https://github.com/murongg/markra`
- **Smart Merge Policy**: When merging from upstream, do not simply pick "theirs" or "ours". Perform a logic-aware "smart merge" that preserves local enhancements while adopting upstream improvements.
- **Protected Customizations**:
  - **Manual Workflows**: Keep `.github/workflows/` (release.yml, ci.yml) as manual-only (`workflow_dispatch`). Do not restore automatic `push` triggers.
  - **Window Focus Fix**: Preserve the multi-window fallback logic in `isCurrentNativeWindowFocused` within `apps/desktop/src/lib/tauri/menu.ts`.
  - **Early Menu Registration**: Preserve the early registration of native menu listeners in `App.tsx` (passing `"en"` as fallback language).
- **Bug Fix Comparison**: If upstream fixes a bug that was already fixed locally (e.g., window focus), perform a code review to select the most robust implementation. If the local fix covers more edge cases (like the Windows 11 menu focus bug), prioritize the local implementation.
