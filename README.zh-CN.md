<p align="center">
  <img src="apps/desktop/app-icon.svg" width="96" alt="Markra logo" />
</p>

<p align="center">
  <strong>原生支持 AI 的所见即所得 Markdown 编辑器。</strong>
  <br />
  <strong>完全开源，免费使用。数据默认留在本地。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文 | <a href="#下载">下载</a> | <a href="#核心特性">核心特性</a> | <a href="#路线图">路线图</a> | <a href="#参与贡献">参与贡献</a> | <a href="#许可证">许可证</a>
</p>

<p align="center">
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri-24C8DB" />
  <img alt="WYSIWYG Markdown" src="https://img.shields.io/badge/Markdown-WYSIWYG-000000" />
  <img alt="Native AI" src="https://img.shields.io/badge/AI-Native-7C3AED" />
  <img alt="Free" src="https://img.shields.io/badge/Free-Open_Source-16A34A" />
  <img alt="下载量" src="https://img.shields.io/github/downloads/murongg/markra/total?label=%E4%B8%8B%E8%BD%BD%E9%87%8F&color=0EA5E9" />
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-important" />
</p>

Markra 是一个完全开源的本地 Markdown 编辑器，围绕所见即所得写作和原生 AI 构建。它保留纯文本 Markdown 文件，同时加入块级编辑、文档标签页、自定义主题、导出和多服务商 AI。

你的文件和工作区数据默认都留在本机。Markra 不会把文档上传或同步到 Markra 服务器；只有在你主动启用 AI 或联网搜索时，相关上下文才会按你的配置发送给对应服务商。

Markra 里的 AI 是编辑器的一部分。它可以使用当前选区、整篇文档、大纲和附近的 Markdown 文件，帮助你润色、改写、续写、总结或翻译内容。写入类操作会先预览，确认后才会改动文档。

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

## 下载

从 [GitHub Releases](https://github.com/murongg/markra/releases/latest) 下载最新桌面版：macOS Apple Silicon/Intel、Windows 安装包/便携包和 Linux AppImage。

## 核心特性

### 1. 所见即所得 Markdown

- 可视化编辑常用 Markdown、GFM 表格、链接、图片、原始 HTML、代码块和 KaTeX 公式。
- 渲染后的链接、图片、HTML 和公式仍可展开回源码，也可以切换到完整源码模式。
- 调整正文宽度、字号、行高、字数和保存状态显示。

### 2. 块、表格与代码

- 使用斜杠菜单和侧边手柄新增、移动和重排块。
- 支持 GitHub 风格提示块，例如 note、tip、important、warning 和 caution。
- 使用可视化控件调整表格行列、尺寸和对齐方式。
- 选择代码块语言、使用语法高亮，并直接复制代码块。

### 3. 原生 AI 支持

- 选中文本使用内联 AI，或打开侧边栏处理整篇文档和工作区任务。
- 内置润色、改写、续写、总结、翻译等快捷操作。
- AI 写入会先生成编辑器预览，由你选择应用、拒绝或复制。
- 支持 AI 会话搜索、归档、重命名、恢复和删除。
- 复杂的内联提示可以交给 AI 侧边栏处理，以便使用更多上下文。

### 4. 本地 Markdown 工作区

- 打开单个 Markdown 文件，或打开整个 Markdown 文件夹。
- 在文件树中浏览、新建、重命名和删除文档。
- 通过文档标签页同时打开多个 Markdown 文件，并用大纲跳转当前文档。
- 本地预览图片，并通过双链文档补全插入标准相对 Markdown 链接。
- 可把粘贴图片存到本地文件、S3 或 WebDAV。
- 写作时保持保存状态、未保存提醒和字数信息可见。

### 5. 主题、导出与更新

- 选择内置主题，或用限定作用域的 CSS 创建自定义主题，并支持导入、导出和重置。
- 将当前文档导出为独立 HTML 或 PDF，并配置 PDF 页面、边距、页眉、页脚和元数据。
- 自定义标题栏按钮，并从设置窗口或系统菜单检查应用更新。

### 6. 服务商与联网搜索

Markra 支持云端模型、本地模型和 OpenAI 兼容服务。你可以为内联编辑和 AI 侧边栏分别选择模型。

- OpenAI、Anthropic、Google Gemini、DeepSeek、Mistral、Groq、OpenRouter、Together.ai、Qwen、Xiaomi MiMo、Volcengine Ark、xAI、Azure OpenAI 和 Ollama
- 自定义 OpenAI 兼容服务商、自定义请求 Header、服务商原生联网搜索、Bing 和 SearXNG
- 可限制搜索结果数量和网页正文读取长度，让联网访问保持明确可控

### 7. 开源免费

- 使用 AGPL-3.0 许可证。
- 免费使用，不把核心写作能力放进付费墙。
- 实现和路线图透明，欢迎社区贡献。

## 适用场景

- 产品文档、需求说明和发布说明
- 博客、长文、Newsletter、访谈整理
- 研究笔记、个人知识库，以及包含表格、代码、提示块、公式和本地链接的技术笔记
- 需要 AI 理解上下文并反复润色、重组或扩写的 Markdown 草稿

## 设计理念

- 本地优先：Markdown 文件和工作区数据留在你的磁盘上。
- 开源免费：核心写作能力保持可审计、可使用。
- 写作优先：文件管理、AI、设置和联网搜索都服务于文档。
- 确认后再应用：AI 修改先预览，再由你决定是否写入。

## 路线图

Markra 仍在持续演进，接下来会重点完善这些方向：

- 更稳定的 Markdown 工作区行为
- 更精准的 AI 编辑预览和冲突处理
- 更快的全文搜索、导航和知识整理能力
- 更丰富的导出模板、分享流程和 AI 服务商适配

## 开始使用

1. 从 [GitHub Releases](https://github.com/murongg/markra/releases/latest) 下载 Markra。
2. 打开一个 Markdown 文件，或打开一个包含 Markdown 文件的文件夹。
3. 使用所见即所得编辑器、斜杠菜单、块手柄或源码模式开始写作。
4. 在设置里启用你想使用的 AI 服务商和模型。
5. 需要处理整篇文档或工作区内容时，打开 Markra AI 侧边栏。

## 参与贡献

Markra 欢迎围绕产品体验、Markdown 编辑、AI 工作流、跨平台桌面行为和文档质量的改进。

## 许可证

Markra 使用 AGPL-3.0 许可证。
