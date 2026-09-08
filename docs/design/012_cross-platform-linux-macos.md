# 012 — Linux / macOS 跨平台支持设计

> 状态：**P1 代码适配已实施（Windows 回归通过）**；P2 CI 矩阵与二进制获取脚本已就位；P3 平台验证待真实 Linux/macOS 环境；P4 文档已同步本节。
> 目标：在保留 Windows 一等支持的前提下，将 Easy CSV 扩展到 Linux 与 macOS。

---

## 实施记录（相对设计稿的偏差）

- **D1 变更（用户自理模型）**：最终未采用"编译期嵌入多平台二进制"。`resources/plugins/` 保留 `<平台>/` 目录结构作为文档化放置目录，但 `xan`/`pinyin` 一律**不打包进应用**（三平台均不嵌入），用户在 `<resources>/plugins/<平台>/` 放入 `xan(.exe)`/`pinyin(.exe)`（或加入 `PATH`）后由应用运行时定位。三平台均可自行构建 pinyin（`plugins/pinyin-cli`）、自行获取 xan。
- D2 已实施，且收敛在 `config::get_resources_dir()` + `plugins::get_plugin_dir()`，调用方零改动。插件目录统一为 `<resources>/plugins/<PLATFORM_DIR>/`（Windows `<exe>/easy-csv_resources/plugins/windows-x86_64/`，macOS `~/Library/Application Support/EasyCsv/plugins/<平台>/`，Linux `~/.local/share/easy-csv/plugins/<平台>/`）；各类 SQLite 数据仍置于 `<resources>/data/`。
- W3 已移除：不再解压二进制，故无需 `chmod +x`（用户自行放置并设置可执行位）。
- D3 部分实施：托盘改为可降级（失败仅失去“最小化到托盘”，应用照常运行，`minimize_to_tray` 自动视为 false）。**W4 未进行**：`tauri-plugin-prevent-default` v5.0.2 只暴露 `platform-windows` feature，不存在 `platform-linux/macos` feature，设计假设不成立。
- D4 已实施：`src/utils/platform.ts` 提供 `isWindows`/`modKeySymbol`；脚本导出默认扩展名按平台（Windows `.ps1` 置顶、其余 `.sh`）；快捷键绑定本就使用 `e.ctrlKey || e.metaKey`；CommandPalette 快捷键按平台渲染 ⌘/Ctrl。
- D5 已实施：新增 `tauri.linux.conf.json`（AppImage+deb）、`tauri.macos.conf.json`（dmg+app，`minimumSystemVersion` 10.15）。
- P2 已简化：`build.yml`（PR/主分支矩阵）与 `release.yml`（tag 发布）均不再构建/下载 xan 与 pinyin，各平台直接 `tauri build`。
- P3 验证清单（§5 V1-V8）需在真实 Linux/macOS 环境执行，本机（Windows）无法验证。

## 1. 背景与可行性总评

Easy CSV 的技术栈本身具备良好的跨平台基础：

| 层 | 技术 | 跨平台现状 |
|----|------|-----------|
| 桌面框架 | Tauri v2 | 原生支持 Windows / macOS / Linux |
| 前端 | React + ReactFlow + recharts | 平台无关 |
| 后端 | Rust（csv/rusqlite bundled/encoding_rs 等依赖） | 均为跨平台 crate |
| 核心 CLI | xan（medialab） | **官方为每个 GitHub Release 提供预编译二进制**：`x86_64-apple-darwin`、`aarch64-apple-darwin`、`x86_64-unknown-linux-gnu`、`x86_64-unknown-linux-musl`、`aarch64-unknown-linux-gnu`、`x86_64-pc-windows-msvc` |
| 自带插件 | pinyin（自有 Rust CLI） | 需按目标平台自行编译（CI 矩阵解决） |
| 管道机制 | stdin/stdout 子进程链 | POSIX 管道在三个平台行为一致，且 macOS/Linux 无 CREATE_NO_WINDOW 诉求 |

**结论：可行，且改造面可控。** 后端所有 Windows 专属调用（`creation_flags`）均已用 `#[cfg(target_os = "windows")]` 门控，唯一无条件编译依赖是 `xan.rs` 中 `include_bytes!("../resources/plugins/xan.exe")`（在非 Windows 目标上会因文件缺失直接编译失败）。真正需要设计的是：**资源/数据目录策略、按平台嵌入二进制、构建与分发流水线、托盘与签名等平台细节**。

## 2. 现状盘点：Windows 专属点清单

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| W1 | `src-tauri/src/xan.rs` | `include_bytes!` 无条件嵌入 `xan.exe`，非 Windows 目标编译失败；解压逻辑硬编码 `xan.exe` 文件名 | **阻塞** |
| W2 | `src-tauri/src/config.rs` `get_resources_dir()` | 资源目录固定为 `exe目录/EasyCsv_resources`（可写位置紧邻可执行文件）。macOS .app bundle 内与 Linux AppImage（只读挂载）内不可写；写入 .app 会破坏代码签名 | **阻塞** |
| W3 | `src-tauri/src/plugins.rs` | pinyin 嵌入已 cfg 门控，但解压后未设置可执行位（Unix 需要 chmod +x）；`.exe` 补全已门控 ✓ | 高 |
| W4 | `Cargo.toml` | `tauri-plugin-prevent-default` 仅启用 `platform-windows` feature | 中 |
| W5 | `tauri.conf.json` | 无平台差异化配置（dmg/deb/AppImage 的 bundle 细节、macOS 最低系统版本）；`targets: "all"` 在 Linux 上会同时构建 deb/rpm/AppImage | 中 |
| W6 | `src/hooks/MainMenuHooks.ts:589` | 导出管道脚本默认扩展名 `.ps1`（.sh 已支持，仅默认值与提示文案偏 Windows） | 低 |
| W7 | `src-tauri/src/main.rs` | `windows_subsystem = "windows"` 属性（对其他平台无害）；系统托盘在 Linux 依赖 libappindicator，缺失时托盘初始化失败 | 中 |
| W8 | 快捷键体系 | 全部基于 Ctrl（macOS 惯例为 Cmd/Ctrl 双绑） | 低 |
| W9 | CI / 分发 | 当前仅 Windows 构建；无 macOS 签名/公证、无 Linux 打包流水线 | **阻塞**（分发层面） |

无风险项（确认即可）：`csv.rs`/`pipeline.rs`/`plugins.rs` 的 `creation_flags(0x08000000)` 均已 cfg 门控；`resolve_executable_with_dirs` 的 PATH 搜索与 `.exe` 补全已分平台；编码转换（encoding_rs）、SQLite（bundled）、AES-GCM、通知/对话框/窗口状态插件均为跨平台实现；图标已包含 `icon.icns` 与 PNG；`.sh` 脚本导出逻辑已存在。

## 3. 总体架构策略

**"一份代码 + 编译期分平台资源 + 运行期分平台目录"**，不做平台分支仓库，不在前端做功能裁剪（三平台功能集一致）。

```
                       ┌─ 编译期 ──────────────────────────────┐
                       │ cfg 门控嵌入对应平台的 xan / pinyin 二进制 │
                       │ Windows: xan.exe + pinyin.exe           │
                       │ macOS:   xan(darwin) + pinyin(darwin)   │
                       │ Linux:   xan(linux-gnu) + pinyin        │
                       └──────────────┬─────────────────────────┘
                                      │ 首次启动解压
                       ┌─ 运行期 ──────▼─────────────────────────┐
                       │ Windows: <exe目录>/EasyCsv_resources/    │ ← 现状不变
                       │ macOS:   ~/Library/Application Support/   │
                       │          EasyCsv/resources/plugins/      │
                       │ Linux:   ~/.local/share/EasyCsv/         │
                       │          resources/plugins/                │
                       └───────────────────────────────────────────┘
```

## 4. 关键设计决策

### D1. 分平台嵌入二进制（解决 W1）

将 `src-tauri/resources/plugins/` 重组为按目标命名：

```
resources/plugins/
  windows-x86_64/xan.exe      ← 现 xan.exe 迁移
  windows-x86_64/pinyin.exe   ← 现 pinyin.exe 迁移
  macos-x86_64/xan           ← 从 xan 官方 Release 下载
  macos-x86_64/pinyin
  macos-aarch64/…
  linux-x86_64-gnu/…
  linux-aarch64-gnu/…
```

`xan.rs` / `plugins.rs` 中改为 cfg 常量（`include_bytes!` 要求字面路径，需按 `target_os` + `target_arch` 组合写多个 `#[cfg]` 块）：

```rust
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const XAN_BYTES: &[u8] = include_bytes!("../resources/plugins/windows-x86_64/xan.exe");
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const XAN_BYTES: &[u8] = include_bytes!("../resources/plugins/macos-aarch64/xan");
// … 以此类推
```

- 二进制文件名按平台携带（`xan.exe` / `xan`），解压逻辑与 `resolve_executable` 的现有 `.exe` 补全规则自然兼容。
- xan 预编译二进制**固定版本**入库（在文档与脚本中记录版本号与来源 Release、SHA-256 校验值；升级走独立提交）。xan 为 Unlicense/MIT 许可，随应用分发合规。
- 备选方案（不采用）：Tauri `bundle.resources` 声明式携带 + build.rs 按目标选择。被否原因：会改变现有"单二进制 + 首启解压"的行为，且 AppImage 内资源路径各平台不一致，改动面更大。
- Linux 目标选 `gnu`（AppImage/deb 主流）；`musl` 作为可选目标（未来静态分发），不进首期。

### D2. 资源与数据目录策略（解决 W2，最核心的改动）

现状 `get_resources_dir()` 返回可执行文件旁的 `EasyCsv_resources`，**该目录同时承担两个职责**：插件解压目标（可写）+ 各类 SQLite 数据（config.db / plugins.db / session.db / ai_memory.db，可写）。跨平台上这两个职责必须迁到平台标准位置：

| 平台 | 插件目录（解压目标） | 数据目录（db 文件） |
|------|---------------------|---------------------|
| Windows | `<exe目录>\EasyCsv_resources\plugins\`（**现状保持不变**） | 同左（现状不变） |
| macOS | `~/Library/Application Support/EasyCsv/resources/plugins/` | `~/Library/Application Support/EasyCsv/data/` |
| Linux | `~/.local/share/EasyCsv/resources/plugins/`（XDG） | `~/.local/share/EasyCsv/data/` |

实现要点：

1. **`dirs` crate 已在依赖中**（`Cargo.toml:37`），直接用 `dirs::data_dir()` 获取平台标准目录，无需新依赖。
2. Windows 分支**保持原路径**（`#[cfg(target_os = "windows")]` 返回现有逻辑），避免破坏存量用户的配置/历史数据/插件注册。
3. Unix 分支新增：首启创建目录、解压插件、并设置**可执行位**（`std::os::unix::fs::PermissionsExt`，`0o755`）——这是 W3 的修复点，缺失会导致 "Permission denied"。
4. `config.rs` 的 `get_resources_dir()` 是唯一路径出口（csv/storage/session/ai_memory/plugins 均经它取 db 路径），改动收敛在单个函数 + `plugins.rs::get_plugin_dir()`，调用方零改动。
5. 解压校验：沿用现有"文件存在且大小一致则跳过"的逻辑，大小比较改为"嵌入字节长度"，天然支持版本更新时重解压。

> 不迁移 Windows 存量数据、不为旧 Windows 路径做回退迁移逻辑——Windows 行为零变化，本设计的迁移面只涉及新增平台。

### D3. 托盘与平台插件（解决 W4 / W7）

- `tauri-plugin-prevent-default`：features 改为 `["platform-windows", "platform-linux", "platform-macos"]`（该插件的 feature 即按平台启用拦截行为，如 macOS 的 Cmd+Q、Linux 的窗口关闭语义）。
- 系统托盘：Tauri v2 的 `tray-icon` 在 Linux 依赖 libappindicator/gtk。设计：
  - 托盘初始化包在错误处理中，**失败时降级为无托盘运行**（仅失去"最小化到托盘"能力，主功能不受影响），并在日志中记录原因；
  - `minimize_to_tray` 配置项在托盘不可用时自动视为 false；
  - AppImage/deb 的 CI 构建机需安装 `libappindicator3-1`/`libgtk-3-dev`（见 D6）。

### D4. 前端适配（解决 W6 / W8）

改动小而分散，全部走 i18n 与主题规范：

1. **脚本导出默认扩展名**：`MainMenuHooks.ts` 中通过 Tauri `@tauri-apps/plugin-os`（或 `navigator.userAgent`）检测平台，Windows 默认 `.ps1`，macOS/Linux 默认 `.sh`；保存对话框的 filter 顺序同步调整。导出逻辑本身双格式已支持，零功能改动。
2. **快捷键双绑**：`KeyboardShortcuts.ts` 的判定改为 `e.ctrlKey || e.metaKey`（macOS Cmd）；单键行为不变；i18n 文案中 "Ctrl+K" 之类的展示文案改为按平台渲染（macOS 显示 ⌘K）。
3. 其余 UI（ReactFlow 画布、对话框、暗色主题）经 webview 渲染，无平台差异；CJK 字体三平台 webview 均自带。

### D5. 打包与分发（解决 W9）

`tauri.conf.json` 保持单文件，平台差异用 Tauri v2 的平台 overlay 配置（`tauri.macos.conf.json` / `tauri.linux.conf.json`）承载：

| 平台 | 格式 | 要点 |
|------|------|------|
| Windows | nsis + msi（现状） | 无变化 |
| macOS | `.app` + `.dmg` | `minimumSystemVersion: 10.15`；universal2（x86_64+aarch64 合一）或分架构 dmg 二选一（推荐先分架构，universal2 需要双份嵌入二进制翻倍体积） |
| Linux | `.AppImage`（主） + `.deb` | AppImage 便于免安装分发；rpm 暂缓 |

macOS 签名与公证（分两档）：

- **有 Apple Developer 账号**：CI 注入 `APPLE_CERTIFICATE` 系列密钥，`signingIdentity` + `notarize` 配置启用公证。注意 D2 已把解压目标移出 .app bundle，**避免运行时写入破坏签名**。
- **无账号**：分发未签名 dmg，README 注明首次运行需 `xattr -cr` 或右键打开（右键打开绕过 Gatekeeper）。设计上明确这是可接受的 v1 状态。
- 运行时解压出的 xan/pinyin 为未签名可执行文件：由本进程直接 spawn，不经过 Gatekeeper/公证检查（公证只约束经 Launch Services 启动的下载文件），hardened runtime 不限制子进程启动——作为 PoC 验证项确认（V3）。

Linux AppImage 内的 `current_exe()` 位于只读挂载点，D2 已将写入移到 XDG 目录，天然规避。

### D6. CI 构建矩阵

GitHub Actions workflow（`build.yml`）新增矩阵：

```yaml
strategy:
  matrix:
    include:
      - { os: windows-latest }                       # 现有流程平移
      - { os: macos-14 }                             # arm64
      - { os: macos-13 }                             # x86_64（或用 target 交叉编译合并）
      - { os: ubuntu-22.04 }                         # 选用 22.04 保证 glibc 兼容面
```

- Linux job 需装 `libappindicator3-1 libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev`（Tauri v2 官方前置依赖集）。
- pinyin 插件在同一 job 内 `cargo build --release` 出对应目标二进制，放入 D1 的目录结构后参与 Tauri 构建；xan 预编译二进制建议以脚本从固定版本 Release 下载并校验 SHA-256（避免仓库塞入多平台大文件；也可全部入库，二选一在设计评审时定）。
- 每个平台产出至少：安装包 + `pnpm test`（前端测试平台无关）+ `cargo test`（本机无 cargo 环境时以 CI 为准）。

### D7. 分支执行顺序（实施阶段）

| 阶段 | 内容 | 验收 |
|------|------|------|
| P1 代码适配 | D1 目录重组 + cfg 嵌入；D2 `get_resources_dir` 分平台；W3 chmod +x；D4 前端三项 | Windows 回归不变；`cargo check` 三目标通过（CI） |
| P2 CI 矩阵 | D6 workflow；xan/pinyin 二进制获取脚本 | 三平台 CI 绿色，产出安装包 |
| P3 平台验证 | §5 验证清单逐项执行（尤其托盘降级、Gatekeeper、AppImage 只读） | 验证记录归档 |
| P4 文档同步 | `docs/AI/INDEX.md` 架构图标注三平台路径；README 增加安装说明；changelog | 文档评审 |

P1 与 P2 可并行启动；P3 依赖真实三平台环境（本机为 Windows，Linux/macOS 需 CI 产物或虚拟机验证）。

## 5. 验证清单（PoC / 验收）

| # | 验证项 | 通过标准 |
|---|--------|----------|
| V1 | Linux（Ubuntu 22.04 桌面）冷启动 | 插件解压到 `~/.local/share/EasyCsv/`，xan 具可执行位，管道执行成功 |
| V2 | macOS 首次运行（未签名 dmg） | 右键打开可启动；插件解压到 Application Support；管道执行成功 |
| V3 | macOS 签名+公证版 spawn 未签名 xan | 子进程正常启动，无 hardened runtime 拦截 |
| V4 | Linux 无 libappindicator 环境 | 应用正常启动，托盘降级关闭，其余功能完好 |
| V5 | Windows 回归 | 资源路径、plugins.db、历史数据与升级前完全一致 |
| V6 | AppImage 下全功能 | 数据目录在 XDG，AppImage 只读挂载不影响运行 |
| V7 | 三平台 `.sh` 导出脚本 | 在 macOS/Linux 终端可执行并产出正确结果 |
| V8 | macOS Cmd+K / Cmd+D 快捷键 | 与 Windows Ctrl 行为一致 |

## 6. 风险与开放问题

| 风险 | 影响 | 缓解 |
|------|------|------|
| 本机无 cargo/Rust 工具链（当前环境 PATH 无 cargo），Linux/macOS 无实机 | P1 无法本地全量验证 | 以 CI 矩阵为编译验证主通道；P3 用 CI 产物 + 虚拟机/借调设备 |
| xan 版本升级节奏 | 官方 0.5x 版本迭代快，命令集可能变动 | 固定版本嵌入 + 升级走独立 PR 并回归 59 命令测试（`commands.test.ts` ~76 用例是安全网） |
| macOS 公证需要付费开发者账号 | 无账号则首次运行体验差 | 已设计"未签名分发 + README 指引"降级路径 |
| Linux 发行版碎片化（gtk/webkit 版本、Wayland） | AppImage 在部分环境缺依赖 | AppImage 自带 webkit2gtk 打包由 Tauri 处理；验证清单覆盖主流 Ubuntu/Fedora；问题随 issue 收敛 |
| 仓库体积 | 多平台 xan+pinyin 二进制入库约 +40~60MB | 备选：CI 下载脚本 + SHA-256 校验（D6 已留二选一决策点） |
| 托盘在部分 Linux WM 下不可用 | 最小化到托盘失效 | D3 降级策略 |

## 7. 非目标

- ❌ 不做移动端（iOS/Android）
- ❌ 不做 musl 静态 Linux、rpm、flatpak、snap（后续按需）
- ❌ 不做自动更新（现有 UpdateDialog 为手动检查，三平台行为一致即可）
- ❌ 不改变 Windows 现有数据目录与升级路径

## 8. 参考

- xan 预编译二进制目标列表（x86_64/aarch64 darwin、x86_64/aarch64 linux-gnu/musl、windows-msvc）：https://crates.io/crates/xan 与 GitHub Releases
- Tauri v2 跨平台打包与 Linux 前置依赖：https://tauri.app/distribute/
- 本项目相关源码：`src-tauri/src/xan.rs`（嵌入/解压）、`src-tauri/src/config.rs`（`get_resources_dir`）、`src-tauri/src/plugins.rs`（解析/探活）、`src/hooks/MainMenuHooks.ts`（脚本导出）、`src/hooks/KeyboardShortcuts.ts`（快捷键）
