<p align="center">
  <img src="apps/desktop/app-icon.svg" width="96" alt="Markra logo" />
</p>

<p align="center">
  <strong>A WYSIWYG Markdown editor with native AI.</strong>
  <br />
  <strong>Fully open source. Free to use. Your data stays local.</strong>
</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a> | <a href="#key-features">Key Features</a> | <a href="#roadmap">Roadmap</a> | <a href="#contributing">Contributing</a> | <a href="#license">License</a>
</p>

<p align="center">
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri-24C8DB" />
  <img alt="WYSIWYG Markdown" src="https://img.shields.io/badge/Markdown-WYSIWYG-000000" />
  <img alt="Native AI" src="https://img.shields.io/badge/AI-Native-7C3AED" />
  <img alt="Free" src="https://img.shields.io/badge/Free-Open_Source-16A34A" />
  <img alt="Downloads" src="https://img.shields.io/github/downloads/murongg/markra/total?label=Downloads&color=0EA5E9" />
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-important" />
</p>

Markra is a fully open-source, free Markdown editor built around a WYSIWYG writing experience. It brings AI directly into the editor, so you can write Markdown like a finished document while keeping the plain-text format open, lightweight, portable, and local.

Your files and workspace data stay on your device by default. Markra does not upload or sync your documents to a Markra server; AI and web search only send the context you choose through the providers you configure.

AI in Markra is not a detached chat window. It is part of the editing workflow. It can understand the current selection, the full document, the heading structure, and nearby Markdown files, then help you polish, rewrite, continue, summarize, or translate content. Write operations are shown as previews first, so you stay in control before anything changes.

## Screenshots

<p align="center">
  <img src="assets/screenshots/editor-workspace.png" alt="Markra WYSIWYG Markdown workspace" />
</p>

<p align="center">
  <strong>WYSIWYG Markdown editing with local files and the document in one workspace.</strong>
</p>

| Native AI commands | Review AI edits |
| --- | --- |
| ![Markra inline AI command bar](assets/screenshots/inline-ai-command.png) | ![Markra AI edit preview](assets/screenshots/ai-edit-preview.png) |

| Markra AI side panel | Multi-provider AI settings |
| --- | --- |
| ![Markra AI side panel with document context](assets/screenshots/ai-agent-panel.png) | ![Markra AI provider settings](assets/screenshots/ai-provider-settings.png) |

## Key Features

### 1. WYSIWYG Markdown Editing

- Edit Markdown like a finished document instead of switching between source and preview.
- Work with common Markdown, GFM tables, links, images, lists, and code blocks.
- Adjust tables, links, and images in the same editing surface.
- Keep the portability and plain-text nature of Markdown.
- Tune the content width for long-form writing, notes, and planning documents.

### 2. Native AI Support

- Select text and invoke inline AI commands without leaving the editor.
- Use built-in quick actions for polish, rewrite, continue writing, summarize, and translate.
- Open the Markra AI side panel for full-document and workspace-level tasks.
- Manage AI sessions with search, archive, rename, restore, and delete actions.
- Review AI write operations as editor previews before applying, rejecting, or copying them.

### 3. Fully Open Source and Free

- Markra is open source, with transparent product direction and implementation details.
- Free to use, without putting core writing features behind a paywall.
- Licensed under AGPL-3.0 and open to community contributions.
- Suitable for personal writing and for teams that value auditable, open tools.

### 4. Local Markdown Workspace

- Open a single Markdown file or an entire Markdown folder.
- Keep documents and workspace data local by default, without a Markra cloud account or hosted document sync.
- Browse, create, rename, and delete documents from the file tree.
- Jump through the current document with the outline view.
- Preview images and resolve Markdown image paths locally.
- Keep save state, unsaved-change hints, and word count visible while writing.

### 5. Multi-Model and Multi-Provider AI

Markra supports cloud models, local models, and OpenAI-compatible providers. You can choose separate models for inline editing and the AI side panel.

- OpenAI, Anthropic, Google Gemini, DeepSeek, and Mistral
- Groq, OpenRouter, Together.ai, Qwen, and Xiaomi MiMo
- Volcengine Ark, xAI, and Azure OpenAI
- Ollama local models
- Custom OpenAI-compatible providers and custom request headers

### 6. Controlled Web Search

- Use native web search capabilities from supported providers.
- Configure local Bing search or SearXNG search.
- Enable web search only when a task needs it.
- Limit search result counts and extracted page content length.

## Use Cases

- Product docs, requirements, and release notes
- Blog posts, long-form essays, newsletters, and interview notes
- Reading notes, research briefs, and personal knowledge bases
- Markdown content that needs repeated polishing, restructuring, or expansion
- Local-file writing workflows that still benefit from AI context awareness

## Philosophy

### Local First

Your Markdown files and workspace data stay on your disk. Markra opens, edits, saves, and organizes them locally without locking your writing into a proprietary format or hosted storage service.

### Open Source and Free

Markra keeps its core capabilities open source and free to use. You can inspect the code, understand how it works, contribute improvements, and fit it into your own Markdown workflow.

### Writing First

File management, AI, settings, and web search should serve the writing itself. The interface stays quiet so the document can stay in front.

### Confirm Before Apply

AI can propose changes, but it does not silently overwrite your document. Important edits appear as previews and wait for your confirmation.

## Roadmap

Markra is still evolving. The next areas of focus are:

- More stable Markdown workspace behavior
- More precise AI edit previews and conflict handling
- Faster full-text search, file navigation, and knowledge organization
- More export, sharing, and writing workflow support
- Richer AI provider capability adapters

## Getting Started

1. Open Markra.
2. Choose a Markdown file, or open a folder that contains Markdown files.
3. Start writing, or select text to invoke inline AI actions.
4. Enable your preferred AI providers and models in settings.
5. Open the Markra AI side panel when you want help with the full document or workspace.

## Contributing

Markra welcomes improvements around product experience, Markdown editing, AI workflows, cross-platform desktop behavior, and documentation quality.

You can help by:

1. Improving the writing experience and interface details.
2. Fixing issues in Markdown editing, file management, or AI previews.
3. Improving AI provider adapters and model capability detection.
4. Adding product screenshots, documentation, and example workflows.
5. Proposing features that make local-first writing feel better.

## License

Markra is licensed under AGPL-3.0.

## Related

Markra's goal is simple: a WYSIWYG Markdown editor with native AI. It is fully open source and free to use. Your files stay local, Markdown stays portable, and AI helps directly inside the editor.
