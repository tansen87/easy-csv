# 022 — GitHub 自动更新 + 免管理员权限安装设计

> 状态: **P0 + P1 已实现(2026-09-26)**;端到端更新链路(§8 V5–V7)需一次真实发布才能验证
> 日期: 2026-09-26
> 关联: `docs/design/012_cross-platform-linux-macos.md`(三平台目录策略与打包,本设计在其之上加「更新」与「免提权」)、`src/app/App.tsx`(`checkForUpdates`)、`src/modules/dialogs/app/UpdateDialog.tsx`、`docs/AI/INDEX.md`(§ 设计文档表、§ Tauri 命令清单)
> 前置: 无。全部为 GitHub 单渠道配置,P1 的端到端验证依赖一次预发布 tag。

---

## 实施记录(相对设计稿的偏差)

- **签名密钥已生成**:`tauri signer generate` 产出一对无密码密钥,私钥在**仓库外**
  `~/.tauri/easycsv-updater.key`(公钥同目录 `.pub`)。公钥已写入
  `tauri.conf.json` 的 `plugins.updater.pubkey`。**待办(用户侧)**:把私钥内容加进
  GitHub Secrets 的 `TAURI_PRIVATE_KEY`(`TAURI_KEY_PASSWORD` 留空)。新增的
  `.gitignore` 规则(`*.key` / `*.key.pub`)只是防止误提交,真正的密钥不在仓库内。
- **`process:allow-relaunch` 不存在(设计稿写错,已改)**:`tauri-plugin-process` 只暴露
  `allow-exit` 与 `allow-restart` 两个权限,JS 的 `relaunch()` 走的就是 `restart` 命令。
  capabilities 里放行的是 **`process:default`**(= allow-exit + allow-restart),
  写成 `process:allow-relaunch` 会直接构建失败。
- **会话 flush 改在前端做,不用 Rust 的 `on_before_exit`**:设计稿 §3.3 要求用
  `on_before_exit` 落盘会话,但该钩子拿不到前端序列化好的快照(`session::save_session`
  的入参由前端拼装),Rust 侧无法等价实现。改为在**调用安装前**显式
  `session.flushSession()`(`useSession` 新增的导出,跳过 800ms 防抖),这比退出钩子
  **更确定**:安装前一定已经落盘,不依赖退出时机。
- **`webviewInstallMode` 用 `downloadBootstrapper` + `silent`**:与设计稿一致,但它是
  Windows 上唯一未被本机实测覆盖的提权点(本机已有 WebView2),见 §9。
- **数据目录迁移已实现**,含 `plugins/`;另加一条设计稿没写的护栏:若新目录里**已存在**
  `data/config.db`(即该机器已在用新布局),则**不**用旧目录覆盖它,只补标记文件 ——
  避免「重装后旧数据盖掉新数据」。
- **`formatBytes` 上提**:`ExecutionHistoryDialog` 里的私有 `formatBytes` 移到
  `utils/format.ts` 供更新对话框复用(同 020 把 `formatElapsed` 上提的做法)。
- **验证状态**:`cargo check` 通过;`pnpm typecheck` / `vitest run`(26 文件 383 例)/
  `eslint` 全通过(存量 13 个 error 均与本设计无关)。真实 `tauri build` 见文末「构建验证」。
- **未做**:§8 的 V1–V11 需要在真实环境执行(V1/V3/V4 需标准用户账户与旧目录样本);
  `docs/changelog/CHANGELOG-0.6.0.md` 待发版时写(含 Windows 数据目录迁移这一破坏性变更)。

---

## 1. 背景与目标

### 1.1 现状(代码事实)

「检查更新」这条链路的三个环节里,**只有第一个环节是实现的**:

| 环节 | 现状 | 位置 |
|------|------|------|
| ① 检查 | 前端用 WebView 的 `fetch` 直接打 `https://api.github.com/repos/tansen87/easy-csv/releases/latest`,取 `tag_name` 与 `package.json` 的 `version` 做点分比较,`body` 当作 changelog | `src/app/App.tsx:266-294` |
| ② 下载 | **无**。没有任何下载逻辑 | — |
| ③ 安装 | **无**。只有一个按钮,用系统浏览器打开 GitHub release 页,让用户**手动**下载安装包、手动双击、手动下一步 | `UpdateDialog.tsx` `handleOpenRelease()` |

即:**版本比对是自动的,交付是纯手动的**。用户看到「有新版本」之后的一切动作都在应用之外。

其余相关事实:

- **没有引入更新器**:`Cargo.toml` 无 `tauri-plugin-updater` / `tauri-plugin-process`;`package.json` 无 `@tauri-apps/plugin-updater`;`tauri.conf.json` 无 `plugins.updater`、无 `bundle.createUpdaterArtifacts`;`capabilities/default.json` 无 `updater:*` 权限。也就是说本设计基本是**从零搭**这条链路。
- **签名素材疑似已就绪但从未生效**:`.github/workflows/release.yml` 已经把 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 传给了 `tauri-action`,但因为 `createUpdaterArtifacts` 没开,历史上**从未产出过 `.sig` 和 `latest.json`**。P1 第一件事就是确认这两个 secret 里到底有没有有效私钥,以及公钥能否导出(拿不到公钥 = 现有密钥不可用,必须重新生成;而重新生成意味着**没有任何存量用户能走自动更新**,越早定越省事)。
- **版本号有三个来源**:`package.json` / `tauri.conf.json` / `Cargo.toml` 都是 `0.5.0`,前端读的是 `package.json`。更新器比较的是**安装包内记录的版本**(bundle 版本),与 `package.json` 无关 —— 手工同步三个文件迟早会错位。见 §5.1。
- **`bundle.targets: "all"`**:在 Windows 上同时产出 **MSI(WiX)和 NSIS**。MSI 默认机器级安装(`Program Files` + HKLM),**必然弹 UAC**。这是「免管理员权限」的当前第一障碍。
- **`get_resources_dir()` 把用户数据和安装位置绑死了**(`src-tauri/src/config.rs:45-65`):

  ```
  Windows   : <exe 所在目录>\EasyCsv_resources     ← 与安装目录耦合
  其它平台  : dirs::data_dir()/EasyCsv              ← 与安装目录无关
  ```

  这正是「免管理员权限」的**核心隐患**:若安装到 `Program Files`,该目录对普通用户**不可写**,于是 `get_db()` 里 `Connection::open()` 失败 → 被 `.ok()?` 静默吞掉 → `get_db()` 返回 `None` → **设置、AI 记忆、会话快照、版本历史全部改成「存不进去」且界面不报错**。用户表现为「设置重启就丢」。所以「能不能免 admin 装」和「数据目录放哪」是同一个问题的两面,必须一起解决。

### 1.2 目标

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | 应用内**下载并安装**更新,不再依赖用户手动跑安装包 | §4 |
| 2 | 更新源固定为 **GitHub Releases**(不做渠道切换) | §4.1 |
| 3 | **Windows 上安装与更新全程不需要管理员权限**(不弹 UAC) | §3.1 |
| 4 | 把「安装位置」与「用户数据」解耦,消除 §1.1 的静默失败 | §3.2 |
| 5 | 手动下载保留为兜底路径(网络/权限/签名失败时仍能更新) | §5.2 |
| 6 | macOS / Linux 同样给出免提权的运行与更新形态 | §3.5、§3.6 |

### 1.3 非目标

- **不做多渠道 / 镜像源 / 渠道切换**(Gitee、对象存储 CDN 等)。更新源只有 GitHub Releases 一个。→ 代价见 §9 第一条,先读再决定将来是否要加。
- **不做增量更新**(差分补丁)。Tauri 更新器是全量包替换,增量需要自建补丁服务,收益与复杂度不成比例。
- **不做静默强制更新**。更新必须由用户点确认;不做「后台偷偷升级」。
- **不做多版本并存/灰度发布**(A/B 投放、按用户分组)。
- **不做 macOS 的 Sparkle 集成**,沿用 Tauri 更新器。
- **不引入第三方更新框架**(electron-updater 一类)。
- **不解决代码签名成本问题**。签名证书的采购不在本次范围内,但 §3.7 会明确「没有签名会怎样」,避免误以为「免 admin = 无门槛」。

---

## 2. 关键机制与事实核对

这一节是本设计的地基。**带 ⚠️ 的四条是常见误解,直接决定方案形态**,实施时不要凭直觉改。

| # | 事实 | 依据 / 影响 |
|---|------|-------------|
| F1 | **NSIS 默认就是「仅当前用户」安装,不需要管理员权限**;`perMachine` 才需要,`both` 也需要 | 官方 `Windows Installer` 文档。当前 `targets: "all"` 会把**需要提权的 MSI** 一起发出去,必须显式收敛 |
| F2 | ⚠️ **`endpoints` 是数组,但只在「非 2XX 响应」时才回退下一个** | 官方 updater 文档原文:"Tauri will only continue to the next url if a non-2XX status code is returned!"。本设计**只用单个 GitHub endpoint**,不依赖该语义。**注意:将来若有人想「顺手加个 Gitee 地址做兜底」,这是无效的** —— 大陆网络访问 GitHub 的典型失败是**连接超时 / TLS 重置**,不是 4xx/5xx,**不会触发回退**,只会让首次检查的等待时间翻倍。真要做容灾必须自己做两步探测,不是加一个数组元素 |
| F3 | ⚠️ **更新器在 Windows 上会先退出应用再安装**(`on_before_exit` 钩子可插入收尾逻辑) | 官方 updater 文档。本项目有会话快照(`session.rs`),更新前应 flush,否则可能丢未保存的工作区 |
| F4 | **签名校验不可关闭**;`pubkey` 必须是**密钥内容**而不是文件路径;私钥丢失 = 存量用户永久无法自动更新 | 官方文档。见 §4.3 |
| F5 | `windows.installMode` 可选 `passive`(默认,有进度窗、可提权)/ `quiet`(**无法请求提权**,因此只适用于用户级安装)/ `basicUi` | 官方文档。我们走用户级安装,`quiet` 与 `passive` 都不会弹 UAC;`passive` 保留进度窗更好排障 |
| F6 | ⚠️ **`createUpdaterArtifacts` 不开就完全没有更新产物**,连 `.sig` 和 `latest.json` 都不会生成 | 官方文档。这是「密钥素材已在 secret 里却从未生效」的原因,也是 CI 必须改的第一项 |
| F7 | Windows 的更新器产物是 NSIS 安装包的 zip:`<app>-setup.nsis.zip` + `.sig`;macOS 是 `.app.tar.gz` + `.sig`;Linux 是 `.AppImage.tar.gz` + `.sig` | 官方文档。→ 这也决定了 Linux 上只有 AppImage 形态能自动更新(§3.6) |
| F8 | `dirs::data_local_dir()` 在 **macOS = `~/Library/Application Support`、Linux = `~/.local/share`**,与 `data_dir()` **完全相同**;仅 Windows 不同(`%LOCALAPPDATA%` vs `%APPDATA%`) | dirs crate 语义。这是 §3.2 能用「改一个词」同时修好 Windows、不动 macOS/Linux 路径的原因 |
| F9 | 更新器需要 `tauri-plugin-process` 的 `relaunch()` 才能重启;权限需在 capabilities 里放行 | 官方文档 |
| F10 | JS 侧 `check()` 会自动使用 `tauri.conf.json` 里配好的 `endpoints`,支持 `timeout` / `proxy` / `headers` 覆盖 | 官方文档。**单渠道下不需要任何后端胶水**,见 §4.1 |

---

## 3. 免管理员权限安装(本设计的重点)

### 3.1 Windows:收敛到用户级 NSIS

**结论:把 Windows 的产物从「MSI + NSIS」收敛为「只有 NSIS,且 `installMode` 显式钉死 `currentUser`」。**

```jsonc
// src-tauri/tauri.conf.json
{
  "bundle": {
    "targets": ["nsis"],                 // ← 不再产出需要提权的 MSI
    "createUpdaterArtifacts": true,      // ← 更新器产物 + .sig
    "windows": {
      "nsis": {
        "installMode": "currentUser",    // ← 显式写死(虽是默认值,但别依赖默认)
        "languages": ["SimpChinese", "English"]
      },
      "webviewInstallMode": { "type": "downloadBootstrapper", "silent": true }
    }
  }
}
```

要点:

- **`targets` 是全局字段,但被平台配置覆盖**:`tauri.linux.conf.json` 指定 `["appimage","deb"]`、`tauri.macos.conf.json` 指定 `["dmg","app"]`,所以把主配置改成 `["nsis"]` **不会**影响 macOS/Linux 的产物,无需动那两个文件。
- 安装位置随之变为 `%LOCALAPPDATA%\EasyCsv`(而非 `C:\Program Files`),注册表元数据写在 **HKCU** 而非 HKLM,卸载入口出现在「设置 → 应用 → 已安装的应用」的当前用户范围。**全程无 UAC**。
- **不要**在 `installerHooks` 里做需要提权的动作:注册系统级文件关联、写 HKLM、装服务、改机器级 `PATH`、加防火墙规则 —— 这些每一条都会把「免 admin」毁掉。涉及「用 EasyCsv 打开 .csv」的诉求,只写 **HKCU 下的用户级文件关联**。
- 托盘功能(`tray-icon`)与 HKCU 无冲突;`tauri-plugin-prevent-default` 的 `platform-windows` feature 不涉及提权。这两处不需要改动。

### 3.2 Windows:把用户数据搬出安装目录(必须与 3.1 同时做)

只改安装模式仍不够 —— 只要数据目录还可能落在安装目录下,「免 admin」就是脆的(绿色版、企业推送的 perMachine 包、用户手动挪目录,任一情况都会触发 §1.1 的静默失败)。

**做法:Windows 分支改用 `dirs::data_local_dir()`,把两种形态收敛成同一份逻辑。**

```rust
// src-tauri/src/config.rs — 建议的目标形态(示意)
pub fn get_resources_dir() -> PathBuf {
  // F8:macOS/Linux 上 data_local_dir() == data_dir(),路径不变;
  //      Windows 上变为 %LOCALAPPDATA%\EasyCsv(原为 <exe>\EasyCsv_resources)
  dirs::data_local_dir()
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    .join("EasyCsv")
}
```

**为什么用 `data_local_dir()` 而不是 `data_dir()`**:Windows 上二者的区别是 `%LOCALAPPDATA%`(Local)与 `%APPDATA%`(Roaming)。目录里装的是 SQLite(`config.db` / `ai_memory.db` / `session.db`),**Roaming 会被域环境的漫游配置文件同步**,大文件 + 文件锁 + 多机并发写同一份 SQLite 是明确的坏组合。选 Local 同时保留 macOS/Linux 的现有路径,`data_local_dir()` 恰好满足。

**一次性迁移(必做,不能只改路径)**:

```
首次调用 get_resources_dir() 时:
  新目录存在 或 已有标记文件 .migrated-from-exe-dir
    → 直接用新目录,不做任何事
  否则(Windows && 旧目录 <exe_dir>\EasyCsv_resources 存在)
    → 递归复制 旧 → 新(含 data/ 三个 db、plugins/、AI 配置文件)
    → 复制成功后在新目录写标记文件
    → 旧目录**保留不删**(用户可自行清理;删了就无法回滚)
    → 复制失败(磁盘满/占用) → 记日志并**继续使用旧路径**,下次启动重试
```

- 迁移必须**先复制到位再切读**,不能「移动」。半途失败时新旧两边都应有完整数据。
- **`plugins/` 必须一起迁移**。按 design 012,`xan.exe` / `pinyin.exe` 是**用户自理**、手工放进 `<resources>/plugins/<平台>/` 的。只搬 `data/` 会让所有用户以为「插件丢了」,这是迁移最容易踩的坑。
- 迁移完成前不要创建新目录里的空库(否则「新目录已存在」的判断成立,迁移会被跳过)。判断顺序要写对:**先判旧目录与标记,再建新目录**。
- macOS / Linux 的路径不变,因此**不需要迁移逻辑**;迁移分支整体用 `#[cfg(target_os = "windows")]` 门控,非 Windows 直接返回新目录。

### 3.3 更新器在用户级安装下的行为

`plugins.updater.windows.installMode` 选 **`passive`**(默认,显示进度窗):

- F5:`quiet` 无法请求提权,在用户级安装下也能用,但**一旦安装目录不可写会静默失败**且没有任何界面反馈;`passive` 至少会弹进度窗,失败可见。
- 两种模式下,用户级安装都**不需要 UAC**:安装程序写的是 `%LOCALAPPDATA%` 与 HKCU。
- ⚠️ **F3**:Windows 上更新器会**先退出应用**。会话/工作区必须在**调用安装之前**就落盘 —— 实际实现是前端在安装前显式 `session.flushSession()`(跳过 800ms 防抖),而不是用 Rust 的 `.on_before_exit()`:那个钩子拿不到前端序列化好的快照,做不到等价的事。见「实施记录」。
- 重启用 `@tauri-apps/plugin-process` 的 `relaunch()`,并在 capabilities 放行。

### 3.4 macOS:装在 `~/Applications` 才免提权

- 更新器在 macOS 上产出的 `.app.tar.gz` 是**就地替换 bundle**。若 app 位于 `/Applications`(默认 `root:wheel 755`),替换需要提权 → 弹系统授权框。
- **免提权形态:把 app 放到 `~/Applications`**(用户主目录下,天然可写)。分发时在 dmg 里给出「拖到 `~/Applications`」的指引,或提供一段 `ditto` 到 `~/Applications` 的说明。装在 `/Applications` 的实例应**禁用一键更新**,只提供「打开下载页」。
- ⚠️ **必须区分两件事**:「免 admin」与「免签名」在 macOS 上是**独立的**。未签名 / 未公证的 app 在 macOS 上根本打不开(报「已损坏」),无论如何都需要 Apple Developer Program 的签名 + 公证。**macOS 不存在「免签名的免 admin 安装」**。这条是硬前提,不是可选项。
- 更新前同样要保证 app 不在运行替换冲突状态(关闭 webview 资源句柄)。Tauri 的 macOS 更新流程会处理退出,沿用默认即可。

### 3.5 Linux:免提权形态是 AppImage,deb 不是

- **AppImage**:单文件,`chmod +x` 即可运行;更新器产物是 `.AppImage.tar.gz`(F7),解压后替换同名文件,**完全在用户目录内完成,天然免 admin**。→ **这是 Linux 上唯一支持一键更新的形态。**
- **deb**:安装到 `/usr/bin`、`/usr/share` 等系统目录,`dpkg -i` 需要 sudo,且应用自身对系统目录无写权限。→ **从 deb 安装的实例应禁用一键更新**,只提供「打开下载页」。
- 因此 `tauri.linux.conf.json` 保留 `["appimage","deb"]` 不变,但**更新能力的支持面明确限定为 AppImage**,前端按运行形态判定(§5.3)。
- 运行形态判定:AppImage 运行时环境变量 `APPIMAGE` 会被设置(`process.env.APPIMAGE` 指向自身路径),可作为可靠判据;`process.env.APPIMAGE` 缺失即视为 deb / 手工解包形态。

### 3.6 免 admin 管不到的另一道门槛:SmartScreen / 杀软

必须写清楚,否则实施完会以为「已经零摩擦」:

- **未签名的 NSIS 安装包会被 Windows SmartScreen 拦截**(蓝色「Windows 已保护你的电脑」),用户必须点「更多信息 → 仍要运行」。这与管理员权限**无关**,是独立的信誉机制。
- OV 证书需要累积下载信誉才会逐步消除提示;EV 证书即时生效但更贵。
- Tauri 应用的 NSIS 安装包被 Defender / 第三方杀软**误报**是常见现象(安装包内含自解压 + 写入 `%LOCALAPPDATA%` 的行为特征)。
- **结论**:「免管理员权限」解决的是 UAC 摩擦,**不等于**「双击即可安装」。签名是并行的、独立的一件事,应作为发布前检查项(§7 P0 的 V-extra)。

---

## 4. GitHub 自动更新方案

### 4.1 配置驱动,不写后端胶水

更新源固定为 GitHub Releases,所以**不需要任何自定义 Tauri 命令**:`endpoints` 直接写进配置,前端调官方 JS API 即可。

```jsonc
// src-tauri/tauri.conf.json
"plugins": {
  "updater": {
    "pubkey": "<TAURI_SIGNING 公钥内容,不是文件路径>",
    "endpoints": [
      "https://github.com/tansen87/easy-csv/releases/latest/download/latest.json"
    ],
    "windows": { "installMode": "passive" }
  }
}
```

- **`/releases/latest/download/latest.json`**:`tauri-action` 在每次发布时把 `latest.json` 作为 release asset 上传,该「latest」路径会自动指向最新**已发布**的 release —— 这正是当初选 GitHub API 的原因(不需要自己维护「最新」指针),现在换成 manifest 版本,同样免费。这是单渠道方案最大的简化收益:**没有渠道就没有「渠道 → URL」的映射、没有渠道持久化、没有运行时重建 updater**。
- 前端调官方 API(F10):

  ```ts
  import { check } from "@tauri-apps/plugin-updater";
  import { relaunch } from "@tauri-apps/plugin-process";

  const update = await check({ timeout: 30_000 });
  if (update) {
    await update.downloadAndInstall((event) => { /* Started / Progress / Finished */ });
    await relaunch();
  }
  ```

- **超时建议显式设**:默认无超时,大陆网络下 GitHub 会挂很久;30s 上限 + UI 可取消。
- `reqwest` 已在 `Cargo.toml`,更新器内部也用它,不需要引入新的 HTTP 栈。
- 新增依赖:`tauri-plugin-updater`、`tauri-plugin-process`(均 `^2`)。capabilities 放行 `updater:default` 与 **`process:default`** —— 注意 `tauri-plugin-process` 只暴露 `allow-exit` / `allow-restart`(`relaunch()` 走的就是 `restart`),**没有** `process:allow-relaunch` 这个权限。
- **不再需要**的旧代码:前端直连 `api.github.com` 的 `fetch`、`App.tsx` 里的 `compareVersions()`(版本比较交给更新器,它按 semver 语义比较,比手写的点分比较更正确)。

### 4.2 前端:从「直接 fetch GitHub API」改为「调更新器」

```ts
// 现在(要移除)
const res = await fetch("https://api.github.com/repos/tansen87/easy-csv/releases/latest");

// 目标
const update = await check({ timeout: 30_000 });
```

改动的收益不只是「能下载」:

- 请求由插件的 Rust 侧发出,**不再依赖 WebView 的 fetch 环境**(CSP、代理、UA、跨域策略都不再是变量),网络行为与其余后端请求一致。
- 不再受 GitHub API 的**未认证限流**(60 次/小时/IP)影响前端体验。
- 拿到的 `update.version` / `update.body` / `update.date` 是结构化字段,不必再解析 GitHub 的 `tag_name` / `body`,也不用手写版本比较。

### 4.3 签名:一条硬约束

- `pubkey` 是编译期常量,**签名校验不可关闭**(F4)。私钥进 `tauri.conf.json` 只管**校验**,签名发生在构建时;两端必须是同一对密钥,否则装上的包一律验签失败。
- **私钥是单点**:F4,私钥丢失 = 存量用户**永久**无法自动更新(只能引导手动下载新包,而新包若换密钥,老版本切不过去)。必须离线备份 + 记录「谁持有」。
- `latest.json` 的 `signature` 字段是 `.sig` 文件的**内容**,不是路径或 URL;`version` 可带前导 `v`。这些由 `tauri-action` 自动生成,不需要手工拼 —— 但**发布时必须确认该 asset 真的在 release 里**(见 §4.4 的 draft 陷阱)。

#### 把私钥交给 CI(一次性,仓库管理员)

`createUpdaterArtifacts` 打开后,CI 没有密钥就**构建失败**,所以这是发版的前置条件。
密钥是**每仓库**的 Secret,只有仓库管理员能设。

| 步骤 | 操作 |
|------|------|
| 1 | 打开 `https://github.com/tansen87/easy-csv/settings/secrets/actions`(Settings → Secrets and variables → Actions) |
| 2 | **New repository secret** |
| 3 | Name 填 **`TAURI_PRIVATE_KEY`**(必须与 `release.yml` 里的 `secrets.TAURI_PRIVATE_KEY` 完全一致) |
| 4 | Secret 填**私钥文件的全部内容** —— 单行 base64,无换行、无引号。本机路径 `~/.tauri/easycsv-updater.key`(Windows:`C://Users//<你>//.tauri//easycsv-updater.key`) |
| 5 | **Add secret**。工作流下次运行即生效,不需要改代码 |
| 6 | `TAURI_KEY_PASSWORD` **不用建**:GitHub 不允许创建空值 Secret,而 `${{ secrets.TAURI_KEY_PASSWORD }}` 引用未定义的 Secret 时求值为**空字符串** —— 正好是无密码密钥要的结果 |

复制到剪贴板(避免手抄出错):

```bash
# Windows(cmd):直接进剪贴板
clip < "%USERPROFILE%\.tauri\easycsv-updater.key"
# Git Bash:
cat ~/.tauri/easycsv-updater.key | clip
```

装过 `gh`(GitHub 官方 CLI)之后可以一条命令搞定:

```bash
gh secret set TAURI_PRIVATE_KEY --repo tansen87/easy-csv < ~/.tauri/easycsv-updater.key
```

三个前置条件,少一个都会失败:

1. **`gh` 已安装**。Windows 上:`winget install --id GitHub.cli`(在系统终端里跑,不是本仓库的 Git Bash
   —— 那个环境的 PATH 是隔离的,看不到 `winget`)。该 winget 包是**机器级 MSI,会弹 UAC**。
   装完**必须开一个新的终端窗口**,PATH 才生效(官方明确说:开新标签页不够)。
   不想弹 UAC 就用 releases 页的 **portable ZIP** 解压到用户目录后自己加用户级 PATH
   (当前版本 2.98.0);或走 Webi(`curl -sS https://webi.sh/gh | sh`,明确面向无管理员场景)。
2. **已 `gh auth login`**(一次性,交互式:浏览器授权或设备码)。
3. 登录的账号对 `tansen87/easy-csv` 有**管理员**权限 —— Secret 是仓库级资源,协作者写不了。

> 一次性操作建议直接用上面的网页 UI:2 次点击、零安装。真正值得装 `gh` 的理由是**后续发版**能脚本化,
> 顺带把 §4.4 的 draft 陷阱也命令行化 —— 发布这一步不必手点:
> `gh release edit v0.6.0 --repo tansen87/easy-csv --draft=false`。

三个容易踩的点:

- **别拿错文件**:是 `.key`(348 字符、以 `dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWdu...` 开头),
  不是 `.key.pub`(那是公钥,已经在 `tauri.conf.json` 里了)。
- **Secret 存进去就再也读不出来** —— GitHub 只允许覆盖或删除。所以**本地那份必须留着备份**,
  这是唯一的来源;丢了就只能换密钥,而换密钥等于让所有存量安装永远更新不了(F4)。
- 名字写错不会立即报错,会在 CI 里表现为「没产出 `.sig`」—— 已被
  `Verify updater artifacts` 步骤拦成显式失败(§4.4),不用靠猜。

验证是否生效:推一个 tag 跑一次 Release;该步骤会打印找到的 `.sig` 路径。
若打印 `::error::No .sig produced`,就是 Secret 名不对或值被截断了。

### 4.4 CI 变更(`.github/workflows/release.yml`)

#### 发版操作顺序(容易搞错,按序执行)

顺序错了会撞上「release not found」之类看起来像 bug、其实只是前置未满足的报错。

| # | 动作 | 说明 |
|---|------|------|
| 1 | 改三处版本号并提交 | `tauri.conf.json`(决定 tag 名)、`package.json`、`Cargo.toml`;`Cargo.lock` 里 `easy-csv` 的 version 也跟着改 |
| 2 | 推分支 | 普通 `git push`,不触发任何发布 |
| 3 | **在含新版本号的 commit 上打 tag 并推送** | `git tag v0.6.0 && git push origin v0.6.0`。`release.yml` 由 `on: push: tags: ["*"]` 触发;`actions/checkout` 会检出**该 tag 指向的 commit**,所以 tag 必须打在第 1 步之后的 commit 上 |
| 4 | 等 CI | 4 个矩阵任务(macOS aarch64 交叉编译 + macOS x64 + ubuntu + windows),十几到几十分钟。新增的 `Verify updater artifacts` 步骤会先替你把「密钥没生效」拦下来 |
| 5 | **把 draft 发布出去** | CI 建的是 draft(`releaseDraft: true`)。点 Publish,或 `gh release edit v0.6.0 --draft=false` |
| 6 | 验证 | 按 §4.5 的三条命令查端点;再做 §8 V5 的端到端 |

> ⚠️ 第 5 步之前,**`gh release edit` 会报 `release not found`** —— draft 还没被创建、或根本没跑过 CI。
> 这个报错不代表命令写错了。
>
> ⚠️ **同一个版本号不要重复发**:tag 已推、CI 已跑出 draft 之后若发现有 bug,要先删掉 release 与 tag
> (`gh release delete` + `git push --delete origin v0.6.0`)再重打,或直接升到 `0.6.1`。
> 因为更新器只认 `version` 更高,重发同版本号对已更新的用户是无效动作。

| 步骤 | 变更 |
|------|------|
| 构建 | 配置 `createUpdaterArtifacts: true`(F6:不开就完全没有产物);确认 `TAURI_SIGNING_PRIVATE_KEY` 有效 → 产出 `*.sig` 与 `latest.json` |
| Windows 产物 | 应只有 `*-setup.exe` + `*-setup.exe.sig`;**不再有 `.msi`**(实测 Tauri 2 现在的 `tauri bundle` 直接给 `-setup.exe` 签名,不再产出早期文档里的 `-setup.nsis.zip`) |
| 发布 | 确认 `latest.json` 作为 release asset 上传;确认 release 已**正式发布**(非 draft) |
| 清单(可选) | 生成 `checksums.txt` 随 release 发布,供人工核对/离线校验 |

#### `build.yml` 也必须改(否则它一定红)

`build.yml` 是「每次推 main / PR 都跑」的构建门禁,它**同样会执行 `pnpm tauri build`**。
开了 `createUpdaterArtifacts` 之后有**两处**会让它失败,两处都必须处理:

| 问题 | 症状 | 处理 |
|------|------|------|
| **pnpm 版本用 `latest`** | 三个平台**全都**挂在 `Install frontend dependencies`。`pnpm-lock.yaml` 是 `lockfileVersion: 9.0`,而 `latest` 已经是 **pnpm 12**,`--frozen-lockfile` 直接拒绝该格式(2026-09-26 实测) | 把 pnpm **钉死**在写 lockfile 的那个版本(`build.yml` 的 `corepack prepare` + `pnpm/action-setup.version`、`release.yml` 的 `version`、以及 `package.json` 的 `packageManager` 四处一致) |
| **没有签名密钥** | `pnpm tauri build` 在打包阶段报 `A public key has been found, but no private key`(注意:是**报错**,不是挂起) | 用 `--config` 就地关掉更新器产物:`pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'`。构建门禁不需要签名,PR(尤其 fork)也拿不到 secret |

> ⚠️ **两种「签名相关失败」行为不同,别混**:
> - 缺 `TAURI_SIGNING_PRIVATE_KEY` → **立即报错**(8 秒),信息明确。
> - 只缺 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(密钥无密码也必须给空串)→ **永久挂起**(见文末「构建验证」)。

#### 实测结果:修完这两处之后,`build.yml` 往前走了一步,又露出一道**既有的**红灯

2026-09-26 推送 `71e423e` 后的运行(3686…/36211904423)结果:

| 步骤 | 修前(`ddc15e2`) | 修后(`71e423e`) |
|------|------------------|-----------------|
| `Install frontend dependencies` | ✗ 三平台全红 | **✓ 三平台全绿** |
| `Lint frontend`(`pnpm lint`) | · 未执行(被上一步挡住) | **✗ 三平台全红** |

`pnpm lint` = `eslint src --ext .ts,.tsx`,而**本地也一直是失败的**(13 个 error,退出码非 0)。
`git blame` 确认这些 error 全部来自 `2026-05-15` / `2026-07-16` / `2026-08-29` 的提交,
**与 022 无关**:pnpm 12 的问题一直遮着它们,把安装修好之后才轮到它们暴露。

| 位置 | 规则 | 数量 | 性质 |
|------|------|------|------|
| `src/services/ai/context.ts:733,736` | `no-useless-escape` | 7 | 一行里的多余转义(该规则只报**无效果**的转义,删掉即等价) |
| `src/app/App.tsx:1014` · `src/i18n/index.tsx:29,43` | `no-empty` | 3 | `catch {}` 之类空块;**块内加一行注释即可**,不必改逻辑 |
| `src/__tests__/BatchFilterHooks.test.ts:17` · `src/hooks/useBatchFilter.ts:34` | `no-control-regex` | 2 | 匹配 `\x00-\x1f` 是**有意为之**,应加带理由的 `eslint-disable-next-line` |
| `src/components/menu/ContextMenu.tsx:24` | `no-shadow-restricted-names` | 1 | 遮蔽了全局 `Infinity`,需改名 |

→ **要让 `build.yml` 真正转绿,必须另外清掉这 13 个既有 error**,它不在本设计的范围内。

> 注意:**`build.yml` 红不影响发版**。`release.yml` 是独立工作流、只由 tag 触发,
> 所以 `build.yml` 挂着也照样能发 0.6.0 —— 但带着红灯发版会掩盖后续问题,建议先清干净。

> ⚠️ **draft 陷阱**:当前 `releaseDraft: true`。**draft release 的 assets 在正式发布前不是公开可访问的**,`/releases/latest/download/...` 也只指向**已发布**的 release。所以「发布」这一步必须真的执行,否则更新器 404。这也意味着 draft 期间无法端到端测更新链路 —— 测试要用一个**临时的预发布 tag**,测完再删。

### 4.5 更新清单 `latest.json`:不用手写,但要懂它

**结论:不要手写,也不要放进仓库。** 由 `tauri-action` 生成并作为 **release 资产**上传
(`uploadUpdaterJson` 默认 `true`;`.sig` 由 `uploadUpdaterSignatures` 默认一并上传)。

#### 放在哪

| 位置 | 说明 |
|------|------|
| ✅ **GitHub Release 的资产**,文件名必须**正好**是 `latest.json` | 端点是 `https://github.com/tansen87/easy-csv/releases/latest/download/latest.json`。其中的「latest」由 **GitHub** 解析 = 最新**已发布**(非 draft、非 prerelease)release 里那个叫 `latest.json` 的资产 |
| ❌ 仓库里的某个文件 | `/releases/latest/download/` 只服务 release 资产;仓库文件要走 `raw` 链接,是另一套地址(且没有「最新」语义) |

所以 `releaseDraft: true` 时必须**真的点发布**:draft 不参与「latest」的计算 → 端点 404 →
应用里报 `Could not fetch a valid release JSON from the remote`(2026-09-26 实测就是该报错,
原因是当时最新的 v0.5.0 里没有 `latest.json`)。

#### 长什么样

`tauri-action` 按此生成,平台 key 与 CI 矩阵一一对应:

```json
{
  "version": "0.6.0",
  "notes": "…release body…",
  "pub_date": "2026-09-26T02:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<EasyCsv_0.6.0_x64-setup.exe.sig 的全部内容>",
      "url": "https://github.com/tansen87/easy-csv/releases/download/v0.6.0/EasyCsv_0.6.0_x64-setup.exe"
    },
    "darwin-aarch64": { "signature": "…", "url": "…app.tar.gz" },
    "darwin-x86_64":  { "signature": "…", "url": "…app.tar.gz" },
    "linux-x86_64":   { "signature": "…", "url": "…AppImage" }
  }
}
```

必须踩准的几点:

- **`signature` 是 `.sig` 文件的「内容」**,不是路径、不是 URL —— 整段 base64(含两行注释)照抄。
- **`version` 必须大于已安装的 bundle 版本**,否则更新器认为无事可做。→ **不能不升版本号重发同一个 tag**;
  已装 `0.5.0` 的用户必须靠 `0.6.0` 才能动起来。版本号改 `tauri.conf.json`(`tagName: v__VERSION__` 取的就是它),
  另两处 `package.json` / `Cargo.toml` 同步是为了不让前端显示错位。
- `pub_date` 必须是 **RFC 3339**;`version` 允许带前导 `v`;每个平台条目的 `url` 与 `signature` 都必填。
- ⚠️ **Tauri 先校验整个文件、再比版本**:任何一个平台条目写坏或缺字段,会让**所有平台**的更新一起失效。
  这正是「不要手写」的理由 —— 四个平台四条签名,手工维护迟早错一处。
- 用 `tagName` 时,条目里的 `url` 是**钉在 tag 上**的(`releases/download/v0.6.0/…`,不可变);
  只有**端点**那一层走 `/releases/latest/`。这是想要的行为:老客户端不会因为新版本发布而指向错资产。
  (反例:若只给 `releaseId` 而不给 `tagName`,`url` 会写成 `releases/latest/download/<bundle>`,
  一旦仓库里有不含更新产物的 release 就会踩坑 —— 所以我们坚持给 `tagName`。)
- Windows 的更新载荷就是 **`-setup.exe` 本身**。

#### 发布后怎么验

```bash
# 1) 端点是否可用:应是 JSON,不是 404 的纯文本 "Not Found"
curl -sS -o /tmp/latest.json -w 'HTTP %{http_code}\n' \
  https://github.com/tansen87/easy-csv/releases/latest/download/latest.json
# 2) 结构是否完整:平台 key 是否都在
node -e 'const m=require("/tmp/latest.json");console.log(m.version, Object.keys(m.platforms))'
# 3) 真正的验收:装 0.5.0 → 应用内「检查更新」→ 下载安装 → 重启后版本变 0.6.0(§8 V5)
```

---

## 5. 前端与 UI 变更

### 5.1 版本号来源收敛(顺带修一个隐患)

`App.tsx` 现在用 `import pkg from "../../package.json"` 的 `version` 做比较。正确做法是读**安装包记录的真实版本**:

```ts
import { getVersion } from "@tauri-apps/api/app";
const currentVersion = await getVersion();
```

理由:更新器比较的是 bundle 版本,`package.json` 只在前端打包时被读入,**两者没有任何机制保证一致**(现在一致纯属人工维护)。一旦错位(发版时忘了改 `package.json`),前端会拿着错误版本号去比较 `latest.json`,表现为「明明更新了还提示有新版本」或「漏报更新」。`getVersion()` 与更新器同源,不会错位。

`package.json` / `tauri.conf.json` / `Cargo.toml` 三处版本仍需同步,建议在 CI 里加一步断言三者相等(成本一行脚本,收益是永不发出版本错位的包)。

### 5.2 `UpdateDialog` 改造

保留现有结构与 Markdown changelog 渲染,新增:

| 区块 | 内容 |
|------|------|
| 主操作 | 「下载并安装」→ `update.downloadAndInstall()`,按钮进入进度态(百分比 + 已下载/总字节)。完成后 `relaunch()` |
| 进度 | Started / Progress / Finished 三态;不显示假进度(与全项目一致:执行中不做假动画) |
| 来源 | 显示「更新源:GitHub Releases」+ manifest 地址(可复制)。失败时这就是排障入口 |
| 兜底 | 失败时**始终**显示「打开下载页」(沿用现有 `openUrl`)。这是本设计里「手动下载」的保留位 |
| 形态提示 | 若运行形态不支持一键更新(deb、`/Applications` 下的 app),主操作置灰 + 一行说明原因,兜底按钮高亮 |

### 5.3 运行形态判定

| 平台 | 判定 | 一键更新 |
|------|------|---------|
| Windows | NSIS 用户级安装(`%LOCALAPPDATA%`) | ✅ |
| Windows | 检测到 `Program Files` 下(历史 perMachine 安装) | ⚠️ 允许但提示「可能要求管理员权限」 |
| macOS | app 路径包含用户目录(`~/Applications`) | ✅ |
| macOS | app 在 `/Applications` 或其它系统目录 | ❌ 置灰 + 说明 |
| Linux | `process.env.APPIMAGE` 存在 | ✅ |
| Linux | 其它(deb / 解包) | ❌ 置灰 + 说明 |

判定需要读 `current_exe()` 与环境变量,前端拿不到 → 由**一个**后端命令返回:

```rust
// src-tauri/src/update.rs(仅此一个命令,不含任何渠道逻辑)
#[tauri::command]
pub fn get_install_form() -> InstallForm   // UserScoped | MachineScoped | AppBundleUser | AppBundleSystem | AppImage | DebOrUnpacked | Unknown
```

### 5.4 设置页与 i18n

- 设置页新增「更新」分区:启动后自动检查(默认开,延迟 5s 静默检查,不阻塞首屏)、上次检查时间、手动「检查更新」。**没有渠道选项**(单渠道)。
- i18n:按 019 的域文件约定**新建** `src/i18n/translations/{zh,en}/update.ts`(不要把进度、来源、形态不支持说明这些新文案塞进已很拥挤的 `common.ts`),同步 `types.ts` 与 `index.ts`。
- 现有 key 复用边界:`checkForUpdates` / `newVersionAvailable` / `currentVersion` / `latestVersion` / `usingLatestVersion` / `loadingUpdateInfo` / `update` 可继续用;**不要**复用语义不符的旧 key 承载新文案(进度、来源地址、形态不支持的说明都要新 key)。

---

## 6. 涉及文件清单

### 后端

| 文件 | 变更 |
|------|------|
| `src-tauri/Cargo.toml` | 新增 `tauri-plugin-updater`、`tauri-plugin-process`(均 `^2`) |
| `src-tauri/src/update.rs` | **新增**:仅 `get_install_form()` + `InstallForm` 枚举(无渠道逻辑) |
| `src-tauri/src/main.rs` | 注册 `tauri_plugin_updater::Builder` 与 `tauri_plugin_process::init()` |
| `src-tauri/src/lib.rs` | 注册 `get_install_form` / `get_auto_check_update` / `set_auto_check_update` 命令 |
| `src-tauri/src/config.rs` | `get_resources_dir()` 改用 `data_local_dir()`;新增 `#[cfg(windows)]` 旧路径迁移;新增 `auto_check_update` 配置项与读写命令 |
| `src-tauri/tauri.conf.json` | `bundle.targets: ["nsis"]`、`createUpdaterArtifacts: true`、`bundle.windows.nsis.installMode: "currentUser"`、`bundle.windows.webviewInstallMode`、`plugins.updater`(pubkey + 单个 GitHub endpoint + `windows.installMode: "passive"`) |
| `src-tauri/capabilities/default.json` | 放行 `updater:default`、`process:default`(注意:不存在 `process:allow-relaunch`) |

### 前端

| 文件 | 变更 |
|------|------|
| `src/app/App.tsx` | `checkForUpdates` 改用 `check()`;`currentVersion` 改用 `getVersion()`;删除 GitHub `fetch` 与本地 `compareVersions` |
| `src/modules/dialogs/app/UpdateDialog.tsx` | 进度、安装、兜底下载页、形态提示 |
| `src/services/update/index.ts` | **新增**:`checkForUpdate()` / `installUpdate()` / `getInstallForm()` / `relaunchApp()`、`UpdateSession` / `UpdateProgress` / `InstallForm` 类型、`RELEASES_PAGE_URL`。唯一直接 import 更新器与 process 插件的地方 |
| `src/hooks/useUpdater.ts` | **新增**:检查 / 进度 / 安装状态机;Dialog 可见性留在调用方(静默检查不得自己弹窗) |
| `src/hooks/useSession.ts` | 导出 `flushSession`(跳过防抖,安装前落盘) |
| `src/hooks/useUIState.ts` | 移除 `updateInfo` / `isCheckingUpdate`(移交 `useUpdater`),只留 `showUpdateDialog` |
| `src/utils/format.ts` | `formatBytes` 由 `ExecutionHistoryDialog` 上提到此处复用 |
| `src/hooks/useAppSettings.ts` | 「启动后自动检查」开关的读写(与后端 `app_config` 同步) |
| `src/components/setting/SettingsTabContent.tsx` · `SettingsDialog.tsx` | 通用页新增「更新」区块与开关 |
| `src/i18n/translations/{zh,en}/update.ts` | **新增**域文件(20 个 key) |
| `src/i18n/translations/{zh,en}/index.ts` · `types.ts` | 接入新域文件 |
| `.gitignore` | 新增 `*.key` / `*.key.pub` / `src-tauri/*.sig` 防误提交密钥 |
| `src/__tests__/SettingsDelimiterControl.test.tsx` | 补两个新 props(既有用例的机械改动) |

> 本轮**未新增**针对更新链路的自动化用例:检查/安装的网络与文件替换路径在单测里只能全部 mock,验不到真东西。真正的验证手段是 §8 的 V5–V9(真实发布 + 真实安装),见「构建验证」。

### CI / 文档

| 文件 | 变更 |
|------|------|
| `.github/workflows/release.yml` | 注释说明「`createUpdaterArtifacts` 开着,没有密钥会构建失败」;release body 写明**必须正式发布**(draft 的 assets 不服务 `/releases/latest/download/`);新增 **verify-updater-artifacts** 步骤:找不到 `.sig` 就让 release 失败(否则问题会晚到签名校验失败才暴露) |
| `docs/AI/INDEX.md` | § 设计文档表登记 022;§ Tauri 命令清单加 `get_install_form`;`config.rs` 节补数据目录变更与迁移 |
| `docs/changelog/CHANGELOG-0.6.0.md` | 发版时记录(含**破坏性变更**:Windows 数据目录迁移) |

---

## 7. 实施计划

分两段,可按优先级独立交付。**P0 与自动更新无关,自身就有价值**,建议先做。

### P0 — 免管理员权限(独立可交付)

1. `bundle.targets` 收敛为 `["nsis"]` + `installMode: "currentUser"`。
2. `get_resources_dir()` 改用 `data_local_dir()` + 旧路径迁移(含 `plugins/`)。
3. 在**标准用户账户**(非管理员)下装一次包,确认:无 UAC、安装到 `%LOCALAPPDATA%`、改设置后重启仍在、`xan`/`pinyin` 插件仍可用。

> 这三步做完,「免管理员权限」就成立了 —— 「手动下载安装包」的流程不需要任何改动即受益。

### P1 — GitHub 自动更新

4. 确认签名密钥:导出 pubkey 写进配置;若 secret 里没有有效私钥,先生成(注意 F4 的不可逆性,趁存量用户少尽早定)。
5. 引入 updater / process 插件,开 `createUpdaterArtifacts`,CI 产出 `latest.json` 与 `.sig`。
6. `get_install_form` + 前端改造 + i18n。
7. 端到端:装 0.5.0 → 用预发布 tag 发 0.6.0 → 应用内一键更新 → 自动重启 → 版本正确,且**全程无 UAC**。

---

## 8. 验证清单

### 免管理员权限(V1–V4)

| # | 验证 | 期望 |
|---|------|------|
| V1 | **Windows 标准用户**(非管理员)双击 NSIS 安装包 | 不弹 UAC;装到 `%LOCALAPPDATA%\EasyCsv`;「设置 → 应用」出现卸载项 |
| V2 | 装完立刻改一个设置并重启应用 | 设置保留;`%LOCALAPPDATA%\EasyCsv\data\config.db` 存在且可写 |
| V3 | 预置旧的 `<exe目录>\EasyCsv_resources`(含 `data/` 三个 db + `plugins/xan.exe`)后首次启动 | 数据被复制到新目录且内容可用(版本历史/AI 记忆/会话仍在);`plugins/` 一并可用;旧目录**保留未删**;标记文件生成;再启动不重复迁移 |
| V4 | 迁移中途制造失败(目标目录只读) | 应用仍能启动并使用旧路径,不崩溃、不产生空库 |

### 自动更新(V5–V7)

| # | 验证 | 期望 |
|---|------|------|
| V5 | 0.5.0 装包 → 发 0.6.0 → 应用内检查 → 下载 → 安装 → 重启 | 版本变为 0.6.0;**全程无 UAC**;更新前未保存的管道状态不丢(安装前的 `flushSession()`) |
| V6 | 篡改安装包 1 个字节后再触发安装 | 签名校验失败,**拒绝安装**,并给出可读错误 |
| V7 | `latest.json` 未上传 / release 仍是 draft 时检查更新 | 给出可读错误(404 / 无产物),不是「一直转圈」或崩溃 |

### 形态限制(V8–V9)

| # | 验证 | 期望 |
|---|------|------|
| V8 | Linux:AppImage 运行下自动更新 | 替换同名文件成功,无需 sudo;deb 安装的实例**按钮置灰**并给出原因 |
| V9 | macOS:app 在 `~/Applications` vs `/Applications` | 前者更新成功无提权;后者置灰(或按 §3.4 记录实际行为) |

### 发布前补充(V-extra)

- **代码签名**:无签名时确认 SmartScreen 提示与杀软误报的具体表现,并记录到发布说明(§3.6)。这是独立于 admin 的门槛。
- **draft 陷阱**:用临时预发布 tag 验证 `/releases/latest/download/latest.json` 可达性(draft 下不可达,见 §4.4)。

---

## 9. 已知限制与风险

- ⚠️ **单渠道的直接代价:大陆网络下 GitHub 的 release 资产下载可能失败。** 元数据(manifest)走 `github.com`,二进制走 `objects.githubusercontent.com`,后者在国内的可用性比前者更差。本方案保留的兜底是「打开下载页」手动下载(用户可配合第三方加速),但**自动更新的成功率在国内不可保证**。若这一点将来成为主要投诉,再回到「镜像渠道」的设计 —— 那时的关键约束是:**`endpoints` 数组不能用来做容灾**(F2,超时不回退),必须自己做两步探测;且镜像产物必须与 GitHub 产物**同一次构建、同一把密钥**,发布顺序固定为「先传附件 → 校验可达 → 再更新 manifest」。
- **签名私钥是单点**。F4:私钥丢失 = 存量用户**永久**无法自动更新。必须离线备份 + 明确「谁持有」。
- **F2 的语义残留**:即使只有单渠道,也不要为了「冗余」往 `endpoints` 里加第二个 URL —— 它不会按预期回退,只会拉长失败等待。
- **macOS 的签名/公证成本**:Apple Developer Program 年费 + 公证流程,是 macOS 上「能用」的硬前提(§3.4)。免 admin ≠ 免签名。
- **WebView2 是唯一需要单独验证的提权点**:`downloadBootstrapper` 在非提权状态下按用户安装,但企业策略可能禁用其下载。若实测发现需要 admin,退化为「提示用户手动安装 WebView2」。Win11 与较新的 Win10 已内置,大多数用户不会走到这里。
- **卸载不删用户数据**(`%LOCALAPPDATA%\EasyCsv` 保留),避免误删。用户需自行清理,文档里给出路径。
- **GitHub API 限流**:不走 API 后此问题消失(`latest.json` 走 release 下载通道,不受 60 次/小时限制),这是走 manifest 而非 API 的附带收益。
- **版本号三处同步**仍靠 CI 断言兜底(§5.1),没有单一真值源;彻底解决需要构建期注入,超出本期范围。

---

## 构建验证(2026-09-26,本机 Windows)

| 项目 | 结果 |
|------|------|
| `cargo check` | ✅ 通过(`tauri-plugin-updater 2.12.0` / `tauri-plugin-process 2.3.1` 已锁进 `Cargo.lock`) |
| `npx tsc --noEmit` | ✅ 通过 |
| `npx vitest run` | ✅ 26 文件 / 383 例全绿 |
| `npx eslint src` | ✅ 新增与修改的文件零告警;存量 13 个 error 与本设计无关(已用 `git show HEAD:` 逐一确认) |
| `bundle.targets: ["nsis"]` | ✅ 生效:`bundle/msi/` 无本轮产物,只产出 `bundle/nsis/EasyCsv_0.5.0_x64-setup.exe` |
| `createUpdaterArtifacts: true` | ✅ 生效:产出 `EasyCsv_0.5.0_x64-setup.exe.sig`(minisign,416 字节) |
| 更新清单 `latest.json` | ⬜ 由 `tauri-action` 在发布时生成,本机不复现 |
| 端到端更新(§8 V5–V9) | ⬜ 未验证 —— 需要真实发布一个带 `latest.json` 的版本 |

### ⚠️ 本机打包必读:两处「看起来像坏了,其实不是」

**1. 本机 `tauri build` 现在必须提供签名密钥,而且有两个不同的失败模式。**

`createUpdaterArtifacts` 打开后,每一次构建都要给安装包签名。手写环境变量有两个坑:

| 缺什么 | 行为 | 现象 |
|--------|------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | **立即报错**(几秒) | `A public key has been found, but no private key` |
| 只缺 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(密钥无密码也必须给**空串**) | **永久挂起** | 安装包已产出但**永远不生成 `.sig`**,进程也不退出 |

还有一个容易误用的点:⚠️ **`TAURI_SIGNING_PRIVATE_KEY_PATH` 不被打包器支持** —— 它只被
`tauri signer` 子命令识别。`tauri build` / `tauri bundle` 只认 `TAURI_SIGNING_PRIVATE_KEY`
(且必须是**密钥内容**,不是路径),导出路径照样报上面那个错(2026-09-26 实测)。

**推荐用仓库里的封装脚本**,它一次处理上面全部三点(缺密钥时给出可执行的替代命令,而不是报错完事):

```bash
pnpm tauri:build                      # 参数与 `tauri build` 相同
pnpm tauri:build --target aarch64-apple-darwin
```

脚本是 `scripts/tauri-build.mjs`:密钥默认取 `~/.tauri/easycsv-updater.key`
(可用 `TAURI_SIGNING_PRIVATE_KEY_PATH` 指定别的路径**给脚本看**),读出内容注入
`TAURI_SIGNING_PRIVATE_KEY`,并把 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 补成空串。

不想要签名包时(纯本地编译验证),直接用官方的 `--config` 逃生口:

```bash
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'
# 只想重跑打包(跳过漫长的 Rust 编译,几秒完成):
pnpm tauri bundle -b nsis --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

**2. 首次发布之前,「检查更新」必然报错,这是正常的。**

远端没有 `latest.json` 时,端点返回 **HTTP 404 + 纯文本 `Not Found`**,更新器据此抛出
`Could not fetch a valid release JSON from the remote`。这不是坏了,而是远端还没有清单 ——
发布第一个带更新产物的版本后即消失。
