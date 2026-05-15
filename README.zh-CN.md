<p align="center">
  <img src="apps/desktop/app-icon.svg" width="96" alt="Markra logo" />
</p>

<p align="center">
  <strong>原生支持 AI 的所见即所得 Markdown 编辑器。</strong>
  <br />
  <strong>完全开源，免费使用。数据默认留在本地。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文 | <a href="#核心特性">核心特性</a> | <a href="#路线图">路线图</a> | <a href="#参与贡献">参与贡献</a> | <a href="#许可证">许可证</a>
</p>

<p align="center">
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri-24C8DB" />
  <img alt="WYSIWYG Markdown" src="https://img.shields.io/badge/Markdown-WYSIWYG-000000" />
  <img alt="Native AI" src="https://img.shields.io/badge/AI-Native-7C3AED" />
  <img alt="Free" src="https://img.shields.io/badge/Free-Open_Source-16A34A" />
  <img alt="下载量" src="https://img.shields.io/github/downloads/murongg/markra/total?label=%E4%B8%8B%E8%BD%BD%E9%87%8F&color=0EA5E9" />
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-important" />
</p>

Markra 是一个完全开源、免费使用的 Markdown 编辑器，围绕所见即所得写作体验构建。它把 AI 直接带进编辑器，让你像写成稿一样写 Markdown，同时保留 Markdown 文件开放、轻量、可迁移和本地化的纯文本特性。

你的文件和工作区数据默认都留在本机。Markra 不会把文档上传或同步到 Markra 服务器；只有在你主动启用 AI 或联网搜索时，相关上下文才会按你的配置发送给对应服务商。

Markra 里的 AI 不是一个外置聊天窗口，而是编辑流程的一部分。它可以理解当前选区、整篇文档、标题结构和附近的 Markdown 文件，帮助你润色、改写、续写、总结或翻译内容。写入类操作会先以预览形式呈现，确认之后才会真正改动文档。

## 截图

<p align="center">
  <img src="assets/screenshots/editor-workspace.png" alt="Markra 所见即所得 Markdown 工作区" />
</p>

<p align="center">
  <strong>所见即所得 Markdown 编辑，本地文件和文档内容在同一个工作区里。</strong>
</p>

| 原生 AI 命令 | 审阅 AI 修改 |
| --- | --- |
| ![Markra inline AI command bar](assets/screenshots/inline-ai-command.png) | ![Markra AI edit preview](assets/screenshots/ai-edit-preview.png) |

| Markra AI 侧边栏 | 多服务商 AI 设置 |
| --- | --- |
| ![Markra AI side panel with document context](assets/screenshots/ai-agent-panel.png) | ![Markra AI provider settings](assets/screenshots/ai-provider-settings.png) |

## 核心特性

### 1. 所见即所得 Markdown 编辑

- 像写成稿一样编辑 Markdown，而不是在源码和预览之间来回切换。
- 支持常用 Markdown、GFM 表格、链接、图片、列表和代码块。
- 表格、链接和图片可以在同一个编辑界面里继续调整。
- 保留 Markdown 的纯文本格式和可迁移性。
- 可调整正文宽度，让长文、笔记和方案都更好读。

### 2. 原生 AI 支持

- 选中文本即可调用内联 AI 命令，不需要离开编辑器。
- 内置润色、改写、续写、总结、翻译等快捷操作。
- 打开 Markra AI 侧边栏处理整篇文档和工作区级任务。
- 支持 AI 会话搜索、归档、重命名、恢复和删除。
- AI 写入会先生成编辑器预览，由你选择应用、拒绝或复制。

### 3. 完全开源，免费使用

- Markra 源码开放，产品方向和实现细节透明。
- 免费使用，不把核心写作能力放进付费墙。
- 使用 AGPL-3.0 许可证，并欢迎社区贡献。
- 适合个人写作，也适合重视透明、可审计工具的团队。

### 4. 本地 Markdown 工作区

- 打开单个 Markdown 文件，或打开整个 Markdown 文件夹。
- 文档和工作区数据默认保存在本机，不需要 Markra 云账号，也没有托管式文档同步。
- 在文件树中浏览、新建、重命名和删除文档。
- 通过大纲视图快速跳转当前文档。
- 本地预览图片，并解析 Markdown 图片路径。
- 写作时保持保存状态、未保存提醒和字数信息可见。

### 5. 多模型与多服务商 AI

Markra 支持云端模型、本地模型和 OpenAI 兼容服务。你可以为内联编辑和 AI 侧边栏分别选择模型。

- OpenAI、Anthropic、Google Gemini、DeepSeek、Mistral
- Groq、OpenRouter、Together.ai、Qwen、Xiaomi MiMo
- Volcengine Ark、xAI、Azure OpenAI
- Ollama 本地模型
- 自定义 OpenAI 兼容服务商和自定义请求 Header

### 6. 可控的联网搜索

- 使用受支持服务商的原生联网搜索能力。
- 配置本地 Bing 搜索或 SearXNG 搜索。
- 只在任务需要时启用联网搜索。
- 限制搜索结果数量和网页正文读取长度。

## 适用场景

- 产品文档、需求说明和发布说明
- 博客、长文、Newsletter 和访谈整理
- 读书笔记、研究资料和个人知识库
- 需要反复润色、重组或扩写的 Markdown 内容
- 希望文件留在本地，同时让 AI 理解上下文的写作流程

## 设计理念

### 本地优先

你的 Markdown 文件和工作区数据仍然保存在本机磁盘上。Markra 负责在本地打开、编辑、保存和组织它们，不把你的写作锁进私有格式或托管存储服务。

### 开源免费

Markra 的核心能力保持开源并免费使用。你可以查看源码、理解实现、参与改进，也可以把它放心放进自己的 Markdown 工作流。

### 写作优先

文件管理、AI、设置和联网搜索都应该服务于写作本身。界面保持安静，让文档始终站在前面。

### 确认后再应用

AI 可以提出修改，但不会静默覆盖你的文档。重要编辑会以预览呈现，并等待你确认。

## 路线图

Markra 仍在持续演进，接下来会重点完善这些方向：

- 更稳定的 Markdown 工作区行为
- 更精准的 AI 编辑预览和冲突处理
- 更快的全文搜索、文件导航和知识整理能力
- 更多导出、分享和写作工作流支持
- 更丰富的 AI 服务商能力适配

## 开始使用

1. 打开 Markra。
2. 选择一个 Markdown 文件，或打开一个包含 Markdown 文件的文件夹。
3. 直接写作，或选中文本唤起内联 AI 操作。
4. 在设置里启用你想使用的 AI 服务商和模型。
5. 需要处理整篇文档或工作区内容时，打开 Markra AI 侧边栏。

## 参与贡献

Markra 欢迎围绕产品体验、Markdown 编辑、AI 工作流、跨平台桌面行为和文档质量的改进。

你可以从这些方向参与：

1. 优化写作体验和界面细节。
2. 修复 Markdown 编辑、文件管理或 AI 预览相关问题。
3. 改进 AI 服务商适配和模型能力识别。
4. 补充产品截图、使用文档和示例工作流。
5. 提出让本地优先写作体验更好的功能建议。

## 许可证

Markra 使用 AGPL-3.0 许可证。

## 相关

Markra 的目标很简单：做一个原生支持 AI 的所见即所得 Markdown 编辑器。它完全开源、免费使用，文件保留在本地，Markdown 保持可迁移，AI 在编辑器里自然帮忙。
