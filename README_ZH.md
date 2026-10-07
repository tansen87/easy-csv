# Easy Csv

[English](README.md) | **简体中文**

以模块化的方式处理 CSV 数据 - 像搭积木一样把 [xan](https://github.com/medialab/xan) 命令串成可视化管道, 全程不用离开桌面.

基于 [Tauri](https://tauri.app/) v2 + React 19 + React Flow 构建, 底层 CSV 工具链是 [xan](https://github.com/medialab/xan).

## 目录

- [界面截图](#界面截图)
- [下载与安装](#下载与安装)
- [功能特性](#功能特性)
- [环境要求](#环境要求)
- [从源码构建](#从源码构建)
- [开发](#开发)
- [打包](#打包)
- [测试](#测试)
- [使用说明](#使用说明)
  - [快捷键](#快捷键)
- [AI 助手](#ai-助手)
- [文档](#文档)
- [许可证](#许可证)

## 界面截图

![浅色主题](/docs/img/light.jpg)

![深色主题](/docs/img/dark.jpg)

## 下载与安装

到 [最新 Release](https://github.com/tansen87/easy-csv/releases/latest) 下载对应平台的文件 - 每个产物的文件名里都带着版本号, 按下面这张表挑一行即可.

| 平台 | 下载文件 | 安装方式 |
|------|----------|----------|
| **Windows 10/11 (x64)** | `EasyCsv_<version>_x64-setup.exe` | 双击按向导安装. 以当前用户身份装到 `%LOCALAPPDATA%\EasyCsv` - **不需要管理员权限, 也不会弹 UAC**. 首次运行可能被 SmartScreen 拦下, 点「更多信息 → 仍要运行」即可. |
| **macOS(Apple 芯片)** | `EasyCsv_<version>_aarch64.dmg` | 打开 dmg, 把 **EasyCsv** 拖进 **`~/Applications`**(当前用户目录下, 不是系统级的 `/Applications`). 放在这里, 应用内一键更新才能免密码完成. |
| **macOS(Intel)** | `EasyCsv_<version>_x64.dmg` | 同上, 下载 Intel 版本. |
| **Linux(x64,免安装)** | `EasyCsv_<version>_amd64.AppImage` | `chmod +x EasyCsv_*_amd64.AppImage && ./EasyCsv_*_amd64.AppImage`. AppImage 是 Linux 上唯一支持就地一键更新的形态. |
| **Linux(x64,Debian/Ubuntu)** | `EasyCsv_<version>_amd64.deb` | `sudo apt install ./EasyCsv_*_amd64.deb`(或 `sudo dpkg -i`). 用这种方式安装时应用内更新不可用, 新版本请回到发布页下载. |

说明:

- **首次启动需要安装 `xan` 插件.** EasyCsv 不再内置 CSV 引擎, 首次使用会引导你到**设置 → 插件**一键安装 `xan`; 安装前应用会校验清单签名与产物的 `sha256`.
- **应用内更新**从 GitHub Releases 拉取, 通过签名校验后就地覆盖安装,**不会动你的数据**. Windows 安装包、放在 `~/Applications` 的 macOS 应用、以及 Linux AppImage 都支持; `.deb` 与放在 `/Applications` 的 macOS 应用不支持(见上表).
- **不知道该下哪个文件?**  `*.sig` 与 `latest.json` 是更新器的元数据, `.app.tar.gz` 是 macOS 的更新载荷, 都不需要手动下载.

## 功能特性

- **可视化管道编辑器** - 在节点画布上拖拽、连线、配置 xan 命令(dagre 自动布局、剪切/坠落动画、撤销/重做、复制/粘贴)
- **61 个内置 xan 命令** - 从基础的 `sort` / `filter` / `select` 到 `pivot`、`window`、`join`、`stats`、`split`、`partition`、`to` / `from` 格式转换等, 每条命令都有专属配置对话框
- **AI 助手** - 用自然语言(中文/英文)描述需求, 助手通过 DeepSeek / Qwen 生成可直接插入的管道步骤, 并对每条命令的文档做 RAG 检索
- **表达式编辑器** - 为 200+ 个 [Moonblade](https://github.com/medialab/xan) 函数提供语法高亮与自动补全
- **批处理** - 批量筛选(按列值把一个 CSV 拆成多个文件)与批量格式转换(CSV ↔ XLSX ↔ JSON)
- **数据概况** - 一键查看列统计(计数、空值、最小/最大/均值等), 底层是 `xan stats`
- **内置模板** - 模板库自带起点(可直接运行的示例管道、快速清洗、数据概况、分组统计、排序取前 N)
- **管道版本管理** - 带标签地保存 / 恢复 / 删除管道版本
- **数据血缘** - 追踪列在管道中如何被一步步变换
- **执行日志** - 逐步查看输出并复制
- **双语界面** - English / 中文 /跟随系统语言, 外加深色 / 浅色 / 跟随系统主题

## 环境要求

- [Node.js](https://nodejs.org/)(v18 或更高)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) 工具链(1.94 或更高)

## 从源码构建

1. 把 Windows 的 `xan.exe` 放进 `src-tauri/resources/` - 编译时它会被嵌入二进制, 首次运行时解出(见 `src-tauri/src/xan.rs`). 可以用 [xan](https://github.com/medialab/xan) 源码 `cargo build --release` 自行构建, 或从 [xan releases](https://github.com/medialab/xan/releases) 下载预编译产物.
2. 安装项目依赖:

```bash
pnpm install
```

## 开发

```bash
pnpm tauri dev
```

## 打包

```bash
pnpm tauri build
```

## 测试

```bash
pnpm test        # 运行 vitest 测试套件
pnpm test:watch  # 监听模式
```

## 使用说明

1. **打开 CSV** - 把文件拖到窗口上, 或按 `Ctrl+O`. 手头还没有数据? 点欢迎页的 **看看示例**, 会载入一份示例数据以及一条已经能跑通的管道.
2. **添加步骤** - 按 `Alt+C` 打开命令面板(默认隐藏), 点任意一条 xan 命令; 或按 `Alt+A` 描述需求, 让助手帮你生成步骤.
3. **管道与分支** - 新步骤会**自成一条分支**并直接作用于输入, 不连线也能跑. 要把两步串起来, 请**在操作节点上按住右键**拖到目标节点(连线必须从操作节点起手, 画布上的手势提示卡列出了其余规则).
4. **配置参数** - 点步骤卡片上的齿轮图标, 或双击节点.
5. **执行** - 按 `Ctrl+R`. 一次运行开始时日志面板会自动打开, 里面保留每一步的输出; 顶部会提示运行结束.
6. **导出** - 加一个 `to` 或 `output` 步骤即可把结果写到磁盘. `Ctrl+S` / `Ctrl+E` 用于保存与导出管道本身, 模板库(`Ctrl+T`)自带若干起点.

### 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+O` / `Ctrl+N` | 打开文件 / 在新标签页中打开文件 |
| `Ctrl+S` / `Ctrl+E` | 保存 / 导出管道 |
| `Ctrl+I` | 导入管道 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+R` | 执行管道 |
| `Shift+H` / `Shift+C` / `Shift+S` | 帮助 / 检查更新 / 设置 |
| `Alt+C` / `Alt+Q` / `Alt+A` | 命令面板 / 日志 / AI 面板 |

## AI 助手

在 **设置 → AI**(`Shift+S`)里配置服务商与 API Key.

支持的服务商:

| 服务商 | 模型示例 |
|--------|----------|
| DeepSeek | `deepseek-v4-flash`,  `deepseek-v4-pro` |
| Qwen | `qwen-turbo`,  `qwen-max`,  `qwen3.7-plus` |
| GLM | `glm-4.7-flash`,  `glm-4-flash-250414`,  `glm-4-flash` |

助手只使用你当前这一条消息(不读对话历史), 生成的命令会自动接到管道里最后一个步骤之后.

## 文档

- [docs/AI/INDEX.md](docs/AI/INDEX.md) - 完整的架构与代码库索引(Rust 后端、前端、hooks、组件, 以及每块该怎么改)
- [docs/AI/USAGE.md](docs/AI/USAGE.md) - 58 条 xan 命令的合并使用文档
- [src/docs/AI_usage/](src/docs/AI_usage) - 生成的逐命令文档(来源:`pnpm run generate-ai-usage`)
- [src/docs/cmd/](src/docs/cmd) - 逐命令帮助文档(英文)
- [docs/cmd_zh/](docs/cmd_zh) - 逐命令帮助文档(中文)

## 许可证

MIT
