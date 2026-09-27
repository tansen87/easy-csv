# 插件仓库与「应用内下载安装插件」— 设计文档

> 状态: 设计稿(未实现)
> 日期: 2026-09-27
> 关联: `docs/design/011_duckdb-plugin.md`(手工放插件的零代码先例)、`docs/design/012_cross-platform-linux-macos.md`(D1「用户自理」模型与 `<平台>/` 目录约定)、`docs/design/022_github-auto-update-and-admin-free-install.md`(**同一套 GitHub Releases + minisign 校验链路,密钥与教训都可复用**)、`docs/AI/INDEX.md`
> 前置: 022 已实现(签名密钥、release 流程、`reveal_paths` 都已就位)

---

## 0. 实施记录(2026-09-27:插件仓库已搭好并跑通签名链)

仓库位置:**`D:\init\Deaktop\workspace\rs\easy-csv-plugins`**(与 app 仓库同级,尚未 `git commit`、尚未 push)。

**已完成**

- 仓库已上线:**https://github.com/tansen87/easy-csv-plugins**(公开,默认分支 `main`)。
- 骨架:`.gitignore` / `README.md` / `schema/catalog.schema.json` /
  `plugins/{xan,pinyin,duckdb}/{plugin.json,README.md}` /
  `scripts/{build-catalog,sign-catalog,stage}.mjs` / `scripts/verify-signature.rs` /
  `.github/workflows/release.yml` /
  `plugin-signing.pub`(公钥,**已提交进仓库**;app 侧 P0 把它复制成 `src-tauri/plugin-signing.pub`)。
- **首个 release 已发布并验证**(2026-09-27):
  `xan-v0.61.0` / `duckdb-v1.5.5` / `pinyin-v0.1.0` 三个插件 release + `catalog-2026.09.27`
  (带 `--latest`,`/releases/latest/download/catalog.json` 可解析 ✓)。线上数据实测:
  - 从**app 真正会用的端点**拉下 `catalog.json` + `.sig`,用 `minisign-verify`(即
    `scripts/verify-signature.rs`)**验签通过**,篡改一个字节被拒 ✓;
  - 清单含 **3 插件 × 5 平台 = 15 个资产条目**,`--require-all` 生效;
  - **15/15 资产 URL 全部 HTTP 200 且 `Content-Length` 与清单声明的 `size` 一致** ✓
    (这是最容易翻车的地方:资产名与清单 URL 不一致就会 404);
  - 抽样完整下载 `pinyin` 的 windows/macos-aarch64 资产,`sha256` 与清单一致 ✓。
- **签名密钥已生成**:`~/.tauri/easycsv-plugins.key`(+`.pub`),**独立于** app 更新器的
  `easycsv-updater.key` —— 理由见 §3.3 的局限说明。私钥在仓库外,**必须备份**,丢了就再也发不了清单。
- **签名格式已实测闭合**(不是照抄文档,是用真实字节验过):
  `tauri signer sign catalog.json --private-key-path …` → `catalog.json.sig`(**base64 包裹的
  minisign 签名**,与 app updater 的 `.sig` 资产同格式)→ 用 `minisign-verify` 按
  `tauri-plugin-updater::verify_signature` 的调用形状验证:
  `PublicKey::decode(base64_decode(pubkey)).verify(bytes, &Signature::decode(base64_decode(sig)), true)`
  → **通过**;把清单改一个字节 → **被拒**。
  复现方式(零依赖,直接借 app 仓库的 rlib):
  ```bash
  rustc --edition 2021 -L dependency=<app>/src-tauri/target/debug/deps \
        --extern minisign_verify=<app>/src-tauri/target/debug/deps/libminisign_verify-*.rlib \
        verify_sig.rs -o verify_sig.exe && ./verify_sig.exe catalog.json catalog.json.sig plugin-signing.pub
  ```
- **本地清单已生成并签名**:`catalog.local.json` + `.sig`(`dist/windows-x86_64/` 里的三个二进制,
  `urls` 指向 `http://127.0.0.1:8099`,供 P0 联调)。真实 sha256 已算出,例:
  `xan.exe` 18447872 字节 / `a4004b…`(注:换新版二进制后哈希会变)。
- **上游配方已实测**:`stage.mjs --platform windows-x86_64` 输出正确;按它 `gh release download`
  + `unzip` 得到 xan **0.61.0**(与 `plugin.json` 声明一致)。

**核对出来的新事实(补进 §2 的事实表)**

- xan 上游资产名(0.61.0):`xan-x86_64-pc-windows-msvc.zip`、`xan-{aarch64,x86_64}-apple-darwin.tar.gz`、
  `xan-{x86_64,aarch64}-unknown-linux-gnu.tar.gz`,并各自带 `.sha256`。
- duckdb 上游命名**不是** `x86_64`:Windows 是 `duckdb_cli-windows-amd64.zip`,macOS 只有一个
  `duckdb_cli-osx-universal.zip`(**同一份文件服务两个架构**,CI 下载一次复制两次),
  Linux 是 `duckdb_cli-linux-{amd64,arm64}.zip`。
- ⚠️ **一个插件只能有一个 `version`,且必须在所有平台一致** —— app 的 UI 是「一插件一版本」,
  混版本会让某些平台显示错误版本。所以 bump 必须五平台同步,`--require-all` 由此而来。
- ⚠️ **清单 release 必须是"最新"那个**:`/releases/latest/download/catalog.json` 只指向最新
  发布的非 draft release,所以流程固定为「先发各插件 release → 最后用 `--latest` 发 `catalog-<日期>`」。

**未做**:前端一行代码都还没动(插件服务层 / `usePluginCatalog` / 设置页插件页签 / 缺 xan 引导)。
线上清单已可用,所以前端可以直接对接真实端点。

**P0 后端已实现(2026-09-27)**:`plugin_catalog.rs` + `plugin_install.rs` + `plugins.rs` 的表结构扩展
+ 三个命令 + `plugin-signing.pub` + 测试夹具。**99 例 `cargo test --lib` 全过**,其中 15 例为本次新增:

- `plugin_catalog::tests`(12 例):**用真实线上清单 + 内置公钥验签通过**、改一个字节被拒、**用更新器那把
  真实密钥验签被拒**、多公钥(轮换)可通过、空密钥表 fail-closed、清单形状校验(插件名 / 文件名白名单、
  sha256 格式、schema 版本)、semver 判定(含 `1.5.5-variegata` < `1.5.5` 这条)、URL 主机白名单
  (含 `github.com.evil.example` 这类前缀欺骗与 loopback 仅 debug);
- `plugin_install::tests`(1 例):同插件并发安装被拦、释放后可再装;
- `plugins::tests`(2 例):版本参数表(duckdb 用 `-version`)、安装记录写入与清除。

**实施中发现的偏差与决定**

- **命令定义在新模块里**(`plugin_catalog::get_plugin_catalog`、`plugin_install::{install_plugin,
  uninstall_plugin}`),不改 `plugins.rs` 的职责边界 —— 与 §4 影响面的描述略有出入,更好读。
- **磁盘空间预检没做**:标准库拿不到剩余空间,为此引入 `sysinfo` 之类的依赖不划算。写失败会返回可读的
  IO 错误,已足够(§3.5 步骤 4 相应降级)。
- **`list_plugins`/`check_plugins` 的返回形状未动**(`PluginStatus` 仍是四字段),「已装版本 / 可更新」
  等信息只走 `get_plugin_catalog` 的 `CatalogEntry`。理由:`check_plugins` 要 spawn 进程探测版本,
  不该再背上网请求;两者的职责因此更清晰。
- ⚠️ **测试必须隔离数据目录**:数据目录现在是「exe 所在目录」,而 `cargo test` 的 exe 在
  `target/debug/deps` → 解析真实路径会**从用户真实数据目录跑一次迁移并写下标记**,那会反过来让应用
  自己之后无法迁移。已在 `resolve_resources_dir()` 里加 `if cfg!(test) { 用 %TEMP%/easycsv-test-data }`。
  任何改动数据目录解析的提交都要保住这条。
- 清单缓存落在 `<数据目录>/data/plugin-catalog.json`(含 `fetched_at` 与 `generatedAt`),防回滚即比
  两者的 `generatedAt` 字符串。

**CI 踩坑记录(值得留给后来人)**

- ⚠️ **aarch64-linux 不要交叉编译**:在 x86_64 runner 上编 `aarch64-unknown-linux-gnu` 会在
  链接阶段死:`rust-lld: error: --fix-cortex-a53-843419 is only supported on AArch64`
  —— aarch64 的 target spec 会加这个 AArch64 专用参数,而新版 Rust 默认走 lld,runner 上的
  lld 是**宿主架构**的那份,不认它。改用 GitHub 的原生 arm64 runner(`ubuntu-24.04-arm`,
  公开仓库免费)后彻底没有交叉工具链。
- ⚠️ **`$GITHUB_ENV` 只对后续 step 生效**:我第一版把
  `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER` 写进 `$GITHUB_ENV`,而同一步的 `cargo build`
  读不到 → 参数形同没设。要影响当前 step 就得写成 step 级 `env:`。
- ⚠️ **JSON Schema 里用 `format` 会让 ajv 判整份 schema 无效**(`unknown format "date-time" ignored`),
  除非加载 ajv-formats;改 `pattern` 即可。

**前端 P0 已实现(2026-09-27,承接上段)**

| 文件 | 内容 |
|------|------|
| `src/services/plugins/index.ts` | 唯一 invoke 插件命令、唯一 `listen("plugin://progress")` 的地方;导出 `CatalogEntry`/`CatalogView`/`PluginProgress`/`PluginStatus`、`describePluginError`(归一化 `Err(String)`/`Error`)、`progressPercent` |
| `src/hooks/usePluginCatalog.ts` | 清单加载(默认走缓存,`refresh()` 才强制联网)、按插件名路由的进度、失败回读权威清单;另导出 `useRequiredPluginCheck`(延迟 1.2s 探测 xan,只在"确定缺失"时返回 true) |
| `src/modules/plugins/PluginManager.tsx` | 设置页页签:加载/刷新、离线(`stale`)提示、卸载确认框、打开插件目录;**清单级失败只出横幅,不清空列表** |
| `src/modules/plugins/PluginRow.tsx` | 单条:徽标(已装/缺失/必需/可更新)、来源标签、大小、路径、下载/更新/卸载/主页/定位、进度条 |
| `src/modules/plugins/PluginSetupDialog.tsx` | 启动引导:一键装 xan + 打开目录兜底;自己订阅进度,不碰全局清单状态 |
| `src/i18n/translations/{zh,en}/plugins.ts` | 新 i18n 域(36 key);`plugins`/`pluginDesc`/`pluginNone`/`pluginInstalled`/`pluginMissing` 5 个 key 从 `common.ts` **迁出**(不是复制,避免重复展开) |
| `src/__tests__/PluginManager.test.tsx` | 16 例:下载/更新/卸载按钮的**出现条件**、`stale` 提示、失败不清列表、进度按名路由、卸载二次确认、refresh 才联网 |

**前端 P0 的三条实测结论(容易再踩)**

- ⚠️ **`CatalogEntry` / `CatalogView` 的字段名是 snake_case**。Rust 侧 `#[derive(Serialize)]` 没有
  `rename`,所以 IPC 上传的就是 `latest_version` / `installed_path` / `update_available` /
  `fetched_at` / `plugin_dir`。前端类型写成 camelCase **会编译通过、`tsc` 全绿,运行时静默读到
  `undefined`** —— 按钮该出现时不出现,且没有任何报错。
- ⚠️ **`src/test/setup.ts` 已经全局 mock 了 `@tauri-apps/api/core`**。测试里再 `vi.mock` 一次会
  造出**第二个模块实例**,而 service 层 import 的是 setup 那份 → mock 不被调用、断言对象是空气。
  正确做法是 `import { invoke } from "@tauri-apps/api/core"` 后 `vi.mocked(invoke)` 拿同一份。
- ⚠️ **mock `listen` 时要传"事件对象"**(`{ payload }`),不是 payload 本身。service 层自己
  `event.payload` 拆包;直接传 payload 会让 `payload.name` 变成 `undefined`,进度根本路由不到行上。
  另外进度必须用 `act()` 包裹后再断言(事件来自 React 之外)。
- ⚠️ `usePluginCatalog` 的 `auto` **默认 false**,`PluginManager` 必须显式传 `auto: true`,
  否则页签打开后一直显示"暂无可用插件"。

**P1 已实现(2026-09-27)**

P1 清单里有一半其实在 P0 就落地了(更新检测 + 「更新」按钮、卸载、`generatedAt` 防回滚、
独立签名密钥),所以这一轮只补真正缺的四项:

| 项 | 实现 |
|----|------|
| 清单镜像 + 逐源回退 | `CATALOG_URLS` 从 1 条扩到 2 条(GitHub release → jsDelivr `@main`);`fetch_catalog` 从"只留最后一个错误"改为**逐源尝试 + 按源归因**(`GitHub: timed out; the mirror: HTTP 404`) |
| 下载加速前缀 | 新配置项 `plugin_download_prefix`(命令 `get_/set_plugin_download_prefix` + `normalize_download_prefix` 校验);`download_candidates()` 把每个资产 URL 展开成「前缀 URL → 直连 URL」,代理挂了只多花一次尝试 |
| 取消下载 | 后端 `cancel_plugin_install` + 每 chunk 检查的 `CANCELLED` 表;前端进度条旁「取消」按钮,取消走 `info` 提示而不是错误横幅 |
| 失败原因归因 | `source_label()` 让用户知道是 GitHub 还是镜像失败;`describe()` 早已区分 timeout / connect |

- ⚠️ **设计稿 §3.10 的镜像 URL 原本是错的**:`@main/catalog.json` 指向**仓库文件**,而 `catalog.json`
  在当时只是 release 资产 —— 仓库 main 上**根本没有这个文件**(`git ls-files` 确认)。照抄会做一个
  永远 404 的镜像,反而拉长失败等待(正是 022 `endpoints` 的老坑)。修法:**让 CI 把清单提交回 main**,
  `release.yml` 里加了一步 `Publish catalog to main for the mirror`(带 `git diff --cached --quiet`
  判空,避免同一天重跑产生空提交;`git push origin HEAD:main` 以支持 tag 触发的 detached HEAD)。
- ⚠️ **前缀拼接的 off-by-one 是实测抓到的**:第一版写 `format!("{}{}", prefix.trim_end_matches('/'), url)`,
  因为 URL 自身以 `https://` 开头,结果拼成 `https://ghproxy.examplehttps://…`(缺分隔斜杠)。
  正确写法是 `format!("{}/{}", prefix.trim_end_matches('/'), url)` —— 分隔符由拼接处提供,而不是
  指望前缀或 URL 自带。**这个 bug 是被单测挡住的,不是靠 review**。
- ⚠️ **前缀 URL 不走主机白名单**:`ALLOWED_HOSTS` 的职责是限制**清单**能指向哪里;代理主机是用户
  自己的选择,按定义必然不在名单里。`apply_prefix` 只校验 scheme 为 https 且 host 非空。
- ⚠️ **取消是"协作式"的**:`take_cancellation` 同时读取并清除标志,`InFlight::drop` 也会兜底清除 ——
  否则"下载刚好完成时按下取消"会把标志留给**下一次**安装,变成一装就取消。
- 取消哨兵 `CANCELLED_ERROR = "cancelled"` 是前后端共享的契约(`INSTALL_CANCELLED`);前端
  `isInstallCancelled()` 判断它并走 `info` 路径,真实失败仍走 `error`,避免把用户的主动操作渲染成故障。

**真机回归修复(2026-09-27):「打开插件目录」不生效,而是吐出一个路径**

用户实机点设置页的「打开插件目录」,目录没打开,界面弹出一个路径字符串。定位结论:

- **根因:`capabilities/default.json` 缺 `opener:default`**。`tauri_plugin_opener::reveal_items_in_dir()`
  是 Rust 命令 `reveal_paths` 内部调的插件 API,即使命令注册在 `invoke_handler` 里,调用插件 API
  **仍需该插件的 ACL 权限**。缺权限 → opener 拒绝 → 命令返回 `Err` → 前端 `catch` 把错误当 toast
  文案显示 —— 用户看到的"路径"就是 `reveal_paths` 抛出的那条错误(设计稿 §F7 说"`reveal_paths`
  已存在、零成本",漏掉了 capability 这一环)。修法:在 `permissions` 里加 `"opener:default"`
  (经 `gen/schemas/acl-manifests.json` 确认它含 `allow-reveal-item-in-dir` + `allow-open-url` +
  `allow-default-urls`)。**这条改动必须重编译 app 二进制才生效**。
- **顺带改进错误可读性**:`reveal_paths` 原本在路径全不存在时只回 `"Path does not exist"`(不带是哪个
  路径)。改为把请求的路径名一并带上(`Path does not exist: <a>, <b>`),将来若真是文件没了,用户能直接
  看懂。新增 2 例 Rust 测试(`names_every_missing_path` / `ignores_blank_entries`)。
- ⚠️ **教训**:`reveal_paths` 从 017 就在用,而它的 capability 一直只是"能编过、能注册"—— 这类
  "命令可用但插件 API 被 ACL 拒"的坑,只有真机点一次才会暴露。凡是 Rust 命令内部调 `tauri_plugin_*`
  API 的,都要同时核对 `capabilities/default.json`。

**真机回归修复 2(2026-09-27):「打开插件目录」首次启动有可感延迟,期间按钮仍可点**

用户反馈:首次启动提示缺 xan → 点「打开插件目录」→ 能看到程序正在建文件夹(有一段时间),
这期间按钮还能再点。修法:两个入口都加 in-flight 状态,点击后立即置灰,直到 reveal 返回。

- `PluginSetupDialog`(首次启动那个「缺 xan」引导框):新增 `openingFolder` state;
  `disabled={installing || openingFolder || !pluginDir}` + 进行中换成 `Loader2` 转圈。
- `PluginManager`:新增 `revealing` state,**两个** reveal 入口共用一个标志(「打开插件目录」按钮 +
  每行的「定位二进制」按钮),`PluginRow` 新增 `revealing` prop 把行内按钮也置灰 + 卸下重复点击。
- 新增 1 例测试 `disables the folder button while the reveal is in flight`(点击后断言 disabled、
  期间第二次点击**不产生第二次** `reveal_paths` 调用、resolve 后恢复 enabled)。

**真机回归修复 3(2026-09-27):图标按钮的提示从原生 `title` 改为 `Tooltip` 组件**

用户要求插件设置里的提示统一走 tooltip,而不是浏览器原生 `title`。共 6 处图标按钮改为
`<Tooltip content={...}>`:`PluginSetupDialog`(打开插件目录)、`PluginManager`(打开插件目录、
刷新)、`PluginRow`(主页、定位二进制、卸载)、`DownloadPrefixSetting`(清除前缀)。

- ⚠️ **只去掉 `title` 会让测试挂**:这些图标按钮的**可访问名**原本来自 `title`,而测试用
  `getByRole("button", { name: /Open plugin folder/ })` 查找。去掉 `title` 后 `name` 为空,相关
  用例(Open plugin folder / Refresh catalog / Uninstall / Clear)全部找不到按钮。修法:给每个
  图标按钮补 **`aria-label`** —— 这本来也是正确做法(tooltip 是视觉提示,不构成可访问名)。
- ⚠️ **两处 `title` 有意保留**:`PluginSetupDialog` 的 `pluginDir` 与 `PluginRow` 的
  `installed_path` 是**被截断路径**的悬停展开,属于文本溢出提示,不是按钮 hint;换成 tooltip 反而
  会被 `whitespace-nowrap` 撑出视口。保持原生 `title`。
- ⚠️ 期间发现 `PluginSetupDialog.tsx` 在本次会话中被**外部编辑器/格式化器改写**(图标 import 与
  按钮图标被剥离,`openingFolder` 逻辑保留)。已恢复 `Loader2`/`Download`/`FolderOpen` 图标。

---

## 0. 结论速览

| 项 | 结论 |
|----|------|
| 做什么 | 建一个**独立插件仓库**(`easy-csv-plugins`),用 **签名的 `catalog.json`** 描述每个插件在各平台的资产;应用内一键下载 → 校验 → 落到 `<数据目录>/plugins/<平台>/` |
| 为什么必须做 | 现在 xan / pinyin / duckdb **一个都没有分发渠道**(实测:F1),用户得自己去上游仓库找、自己判断平台、自己放对位置 |
| 最大收益 | ①「缺少 xan 引擎」从"执行到一半才报错"变成启动即引导下载;② 用户再也不用碰文件系统 |
| 最大风险 | 大陆下载 GitHub 资产不可靠(F9)—— 必须给出诚实的失败 UX + 手动兜底路径,不能只做"优雅的失败" |
| 关键设计 | 清单**签名** + 资产**哈希钉死**;名字白名单;校验通过前不落盘、不执行、不解压 |
| 不做什么 | 不开放任意第三方清单;不在应用内做插件市场/评分;不打包内嵌二进制 |

---

## 1. 背景与目标

### 1.1 现状(代码事实)

插件的生命周期目前全靠用户手工:

1. 用户自己拿到二进制(上游 release / 自己编译);
2. 手工放到 `<数据目录>/plugins/<平台>/`(Windows 平台数据目录 = 安装目录,见 022 修订);
3. 应用在运行时按「插件目录 → `PATH`」的顺序找它(`plugins.rs:154-208`、`xan.rs:13-24`);
4. 设置页只能**看**结果:`check_plugins` 返回 `found` / `version`,页面显示一个绿勾或红叉,没有任何按钮(`SettingsTabContent.tsx:700-753`)。

`plugins.db` 只存 `name` + `executable` 两列,启动时幂等 seed `xan` / `pinyin` / `duckdb` 三行(`plugins.rs:93-136`)。

### 1.2 问题

- **P-1 没有分发渠道**。这是最要命的一条:xan 是**所有非插件命令的执行引擎**,没有它应用基本不可用。而它既不在安装包里,也不在仓库里(见 F1)。
- **P-2 缺 xan 时没有任何提示**。`App.tsx:590` 调了 `check_xan_installed()`,**返回值被直接丢掉**(F6)。用户要等到某次执行管道失败,才看到一句 `plugins executable 'xan' ... not found`。
- **P-3 位置对用户不友好**。路径要同时理解「数据目录」「平台子目录」「Windows 上等于安装目录」三件事,还得知道文件名(Windows 必须带 `.exe`,Linux/macOS 必须**没有**扩展名且带可执行位)。
- **P-4 升级全靠手动**。xan 出了新版,用户不会知道,也不会去换。
- **P-5 现有文档误导**。`src-tauri/resources/plugins/readme.md` 写「checked into this folder are provided for convenience」,但 `*.exe` 被 `.gitignore` 排除(F1),clone 下来**根本没有这些文件**。

### 1.3 目标

1. 用户能在应用内看到「哪些插件可用 / 我装了什么版本 / 有没有新版」,并**一键下载安装**;
2. 插件二进制永远落在一个确定的位置,由应用自己写,不由用户手写路径;
3. 校验必须可追溯到**发行方签名**的清单,而不是「从网上下载的文件」;
4. 缺 xan 时**启动即给出明确、可操作的引导**(下载 / 手动放置 / 打开目录三条路);
5. 大陆网络下失败时,用户能拿到「到底失败在哪、还能怎么办」,而不是一个转圈。

### 非目标

- 不做插件市场(评分、评论、搜索第三方插件);
- 不开放「任意 URL 的自定义清单」(P2 再议,见 §8);
- 不做插件沙箱 —— 下载的东西以当前用户权限运行,所以**只信任官方清单**;
- 不改 012 的目录约定(`<数据目录>/plugins/<平台>/` 保持不变),也不改「插件目录优先于 `PATH`」的解析顺序;
- 不把 xan / pinyin 内嵌回 exe(会重新引入 30MB+ 的体积,且与「可独立升级」冲突);
- 不自动安装:任何下载都必须由用户点击触发。

---

## 2. 事实核对(F1–F10)

| # | 事实 | 依据 | 对本设计的影响 |
|---|------|------|----------------|
| F1 | **插件二进制不在仓库里**。`git ls-files src-tauri/resources/plugins` 只有 `readme.md`;`src-tauri/.gitignore:10` 是 `*.exe`(Windows 的三个 exe 被排除;macOS/Linux 目录本来就是空的) | 实测 | 「用户自理」不是权宜之计而是**唯一途径**;插件仓库是本设计的硬前提 |
| F2 | 解析顺序 = 路径本身 → `<数据目录>/plugins/<平台>/`(Windows 补 `.exe`)→ `PATH`;**插件目录优先于 PATH** | `plugins.rs:154-208` | 手放的文件与 `PATH` 安装都继续有效;我们的下载只是**新增**一条来源,不是替换 |
| F3 | `PLATFORM_DIR` 五个取值:`windows-x86_64` / `macos-aarch64` / `macos-x86_64` / `linux-x86_64-gnu` / `linux-aarch64-gnu`,其余为 `unsupported` | `plugins.rs:16-32` | 清单的资产键直接用这五个字符串,禁止另立一套命名 |
| F4 | `plugins.db` 只有 `(name, executable)` 两列,启动时 seed `xan` / `pinyin` / `duckdb` | `plugins.rs:85-136` | 要「版本 / 哈希 / 来源」就得加列 → 需要一次轻量 schema 迁移(项目已有 `ensure_column` 的既有做法) |
| F5 | 设置页插件页签**只读** | `SettingsTabContent.tsx:700-753` | 下载按钮、进度、卸载、打开目录都是新增 UI |
| F6 | `check_xan_installed()` 的返回值在 `App.tsx:590` **被丢弃** | `App.tsx:589-590` | 缺引擎无提示的根因;本设计顺带修掉 |
| F7 | `reveal_paths`(多路径)已存在 | `storage.rs` | 「打开插件目录」零成本,不用新命令 |
| F8 | **依赖现成**:`reqwest 0.13`(`json`,`stream`)、`futures-util`、`sha2 0.11`、`hex`、`semver`、`minisign-verify`、`flate2`、`tar`、`zip` 都已在 `Cargo.lock` 里 | `Cargo.toml` + `Cargo.lock` | 提升为直接依赖**不新增供应链面**(除 `semver` / `minisign-verify` 外多为 updater 传递引入) |
| F9 | 大陆访问 GitHub release 资产(`objects.githubusercontent.com`)不可靠,典型失败是**超时** | 022 的设计与实测记录 | ⚠️ 与 022 的关键差异:那里 `endpoints` 只在非 2XX 回退,而**本设计的下载循环是我们自己写的**,可以按超时逐源重试(§3.10)。**哈希来自签名清单 ⇒ 走代理/镜像不影响完整性**,这是敢做多源的前提 |
| F10 | 代码里**没有** `make_executable`,Linux/macOS 上没有置可执行位的逻辑(INDEX.md 里那句已过时) | 全仓 grep | Unix 上装完必须自己 `chmod 0o755`,否则「装好了但跑不起来」 |

---

## 3. 方案

### 3.1 插件仓库的形态(独立 repo)

`tansen87/easy-csv-plugins`(命名待定,见 §8):

```
easy-csv-plugins/
├─ catalog.json                 # 清单(签名对象;由 scripts/build-catalog.mjs 生成,release 资产)
├─ catalog.json.sig             # base64 包裹的 minisign 签名(release 资产)
├─ plugin-signing.pub           # 公钥(app 侧会内嵌同名文件)
├─ README.md                    # 面向用户:这是什么、怎么手动下载
├─ schema/catalog.schema.json   # JSON Schema,CI 用 ajv 校验
├─ plugins/<name>/
│  ├─ plugin.json               # 元数据 + 各平台上游配方(手工维护,唯一真值源)
│  └─ README.md                 # 上游地址、许可、构建方式
├─ scripts/
│  ├─ build-catalog.mjs         # dist/<平台>/* → catalog.json(size + sha256)
│  ├─ sign-catalog.mjs          # catalog.json → catalog.json.sig
│  └─ stage.mjs                 # 读 plugin.json,列出某平台要下载哪些上游资产
└─ .github/workflows/release.yml
```

**资产命名**(一插件一版本一次 release,tag = `<name>-v<version>`):

```
xan-v0.49.0  →  xan-0.49.0-windows-x86_64.exe
                xan-0.49.0-macos-aarch64
                xan-0.49.0-linux-x86_64-gnu
                catalog.json / catalog.json.sig         ← 同一次 release 的资产
```

**刻意不做的事**:

- **不用压缩包**。原始二进制直接作为资产 → 不需要解压代码,也就没有「压缩包内路径穿越」这一整类漏洞。GitHub 允许任意资产类型。
- **不用 Git LFS 把二进制放进 git**。仓库体积与克隆成本会失控,而 release 资产天然有版本、有 URL、有下载统计。

### 3.2 `catalog.json`

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-27T04:00:00Z",
  "plugins": [
    {
      "name": "xan",
      "title": "xan",
      "description": "CSV processing engine used for every non-plugin command",
      "homepage": "https://github.com/medialab/xan",
      "license": "MIT",
      "required": true,
      "version": "0.49.0",
      "versionArgs": ["--version"],
      "assets": {
        "windows-x86_64": {
          "file": "xan.exe",
          "size": 18448384,
          "sha256": "3f0a…",
          "urls": [
            "https://github.com/tansen87/easy-csv-plugins/releases/download/xan-v0.49.0/xan-0.49.0-windows-x86_64.exe"
          ]
        },
        "macos-aarch64": { "file": "xan", "size": 0, "sha256": "…", "urls": ["…"] },
        "linux-x86_64-gnu": { "file": "xan", "size": 0, "sha256": "…", "urls": ["…"] }
      }
    },
    {
      "name": "pinyin",
      "required": false,
      "versionArgs": ["--version"],
      "assets": { "…": {} }
    },
    {
      "name": "duckdb",
      "required": false,
      "versionArgs": ["-version"],
      "assets": { "…": {} }
    }
  ]
}
```

字段约定:

| 字段 | 说明 |
|------|------|
| `name` | **必须匹配 `^[a-z0-9][a-z0-9-]{0,31}$`**。这是安全边界:它会成为目标文件名,不校验就能用 `../../EasyCsv.exe` 覆盖应用本体(§3.5) |
| `required` | 缺了应用基本不可用(目前只有 xan)→ 缺失时弹阻塞式引导 |
| `versionArgs` | 取版本号的参数。上游不统一(duckdb CLI 是 `-version`),现在 `check_plugins` 把这条规则硬编码在 Rust 里,改为清单驱动后新增插件零改代码 |
| `assets.<平台>` | 键必须是 F3 的五个取值之一;`file` 是落盘文件名(Windows 带 `.exe`);`urls` 是**候选顺序**,第一个失败(含超时)才试下一个 |
| `sha256` / `size` | 强校验。`size` 先于哈希检查 —— 能在下载中途尽早失败,也避免超大响应打满磁盘 |

### 3.3 信任链(为什么这样做是安全的)

```
签名私钥(离线/CI secret)
   │ minisign -S
   ▼
catalog.json ──── sha256 钉住 ────► 各平台二进制资产
   │ 应用用内嵌公钥验签                    │ 应用算哈希比对
   └──────────────► 两者都过才落盘 ◄───────┘
```

1. **清单验签**:应用内嵌公钥(`include_str!("../plugin-signing.pub")`,不进 `tauri.conf.json` 以免动 schema),用 `minisign-verify` 校验 `catalog.json` 与 `catalog.json.sig`。**签名用 `tauri signer sign` 生成**(与 app updater 的 `.sig` 同一工具、同一形状),验签调用形状照抄 `tauri-plugin-updater::verify_signature`:
   `base64_decode(pubkey) → PublicKey::decode` + `base64_decode(sig) → Signature::decode` + `verify(bytes, &sig, true)`。**该链已于 2026-09-27 用真实字节实测闭合**(通过 + 篡改被拒,见 §0)。验签失败 = **拒绝整张清单**,不做「部分信任」。
   ⚠️ **`plugin-signing.pub` 要支持多把公钥**(一行一把 base64,逐行尝试、任一通过即接受)。理由见下面的「局限」:这是让**密钥轮换不至于把老用户锁死**的唯一廉价手段,必须一开始就这么写,后补无效。
2. **资产哈希**:每个资产的 `sha256` 来自已验证的清单 → 二进制不可替换。**因此镜像、代理、CDN 都不影响安全性**(F9),它们只影响成功率。
3. **顺序铁律**:先全部校验,再落盘。校验通过前不解压、不执行、不写入目标路径。
4. **失败不改现状**:任何一步失败都只删临时文件;已装好的插件一个字节都不动。
5. **Windows 不提权**:只写用户可写的数据目录,全程不需要 admin(与 022 一致)。

**明确写出的局限**(不要假装它比实际更强):

- 没有 TUF 那样的**防回滚 / 防冻结**:攻击者若能替换成一张更旧但签名有效的清单,应用会接受。缓解见 §3.6 的轻量 `generatedAt` 单调检查。
- **私钥即一切**。清单私钥泄露 = 可以下发任意插件二进制。所以为插件清单**单独生成一把密钥**,别和更新器共用(共用会让插件仓库的 CI 同时具备伪造应用更新的能力)。已按此执行。
- **密钥丢失的真实影响面(别夸大也别低估)**:
  - 只丢本机文件、仓库与 secret 还在 → **用户零影响**(CI 照常签;只是取不回密钥本身)。
  - 本机与 secret 都没了 → 必须换新密钥重签,那时**已更新的用户无感,未更新的老版本应用会验签失败**,
    「应用内一键安装」暂时不可用。但它们不是砖:插件目录 / `PATH` 的**手动放置路径完全不经过清单**,
    已装插件照常工作,用户也能手动下载放置;而且**应用本体的更新是另一把钥匙签的**,更新一版之后
    一键安装即恢复。所以最坏情况是「暂时降级」,不是「永久失效」。
  - 前提是 §3.3 的多公钥设计成立 —— 否则轮换会把所有老用户永久锁在旧清单上。
  - 运维清单(备份位置、换设备步骤、轮换流程、事后自查命令)写在插件仓库的
    `KEY-MANAGEMENT.md`,不重复在这里展开。
- 签名只证明「这份清单出自我们」,不证明「这个上游二进制没有后门」。所以清单里的 `homepage` / `license` 必须如实记录,便于审计。

### 3.4 应用侧:取清单

```
get_plugin_catalog(refresh: bool) -> CatalogView
  1. 内存命中(进程内 OnceLock) → 直接返回
  2. 磁盘缓存 <数据目录>/data/plugin-catalog.json(含 fetchedAt)未过期(TTL 12h)且 !refresh → 返回
  3. 依次请求 catalogUrls(见 §3.10),每个 URL 单独 20s 超时:
       GET <url>            → bytes
       GET <url>.sig        → sig(资产与签名同目录同名 + `.sig`)
       验签 + 解析 JSON
  4. 全部失败 → 返回可读错误;
       若磁盘缓存存在(即使过期) → 降级用它,并在返回里带 stale: true 让 UI 标注「清单是缓存的」
```

`CatalogView` 是后端加工后的视图(前端不用自己算):

```ts
interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  homepage: string;
  license: string;
  required: boolean;
  latestVersion: string | null;      // 本平台没有资产时为 null
  available: boolean;                // 本平台是否有该资产
  size: number | null;
  installedVersion: string | null;   // 从 plugins.db 读
  installedPath: string | null;      // 解析到的实际路径(可能在 PATH 上)
  updateAvailable: boolean;          // semver 比较
}
interface CatalogView {
  fetchedAt: string;
  stale: boolean;
  pluginDir: string;                 // UI 用来展示 / 交给 reveal_paths
  platform: string;                  // 例如 windows-x86_64
  entries: CatalogEntry[];
}
```

### 3.5 应用侧:下载与安装

```
install_plugin(name)
  1. 从内存目录取条目;不存在 → 报错
  2. 校验 name 白名单(^[a-z0-9][a-z0-9-]{0,31}$)—— 不通过直接拒绝,绝不用它拼路径
  3. 取本平台资产;若无 → 报错「该插件暂不支持 <platform>」
  4. 磁盘空间检查(size 的 1.2 倍)
  5. 逐 URL 下载(单 URL 超时 + 总重试 ≤ 2 次):
       写 <plugins>/.staging/<name>.part,边下边算 sha256,
       每 chunk 发事件 plugin://progress {name, downloaded, total}
  6. size 校验 → sha256 校验(任一不符 → 删 .part + 报错,现有文件不动)
  7. Unix:fs::set_permissions(0o755)  ← F10
  8. 原子替换:rename(<plugins>/.staging/<name>.part, <plugins>/<platform>/<file>)
       —— 同盘 rename 是原子的,不会出现「半个 exe」
  9. 写 plugins.db:version / sha256 / source='registry' / installed_at
 10. 发 plugin://progress {phase: 'done'} → 前端重新拉 check_plugins
```

要点:

- **暂存目录 `.staging/` 与目标同盘**(都在 `<数据目录>/plugins/` 下)→ `rename` 才是原子的。
- **不做「先备份旧文件再覆盖」**:校验通过前根本没碰过旧文件,所以旧版本天然完好;真失败也不需要回滚逻辑。
- **同一插件并发安装**:进程内按 name 加 `Mutex`,第二次调用直接返回「正在下载」。
- **进度事件**复用 022 更新器的形状(`UpdateProgress` 那套 phase/downloaded/total),前端进度组件可以走同一套 `formatBytes`。

### 3.6 数据库与状态

`plugins` 表加列(沿用项目既有的 `ensure_column` 迁移做法,F4):

```
version      TEXT     -- 已安装版本(来自清单,不是跑 --version 得到的)
sha256       TEXT     -- 已安装文件哈希
source       TEXT     -- 'registry' | 'manual' | 'path'
installed_at TEXT
```

- `source` 只在 UI 上区分「一键装的」与「自己放的」,不影响解析顺序。
- **不存 URL** —— 换源/换镜像后本地记录不该失效。
- 轻量防回滚:`<数据目录>/data/plugin-catalog.json` 里记 `generatedAt`,新清单比它更旧时**默认拒绝**并向 UI 报「清单回滚」,允许用户显式覆盖(§3.3 的局限缓解)。
- `check_plugins` 扩展返回:`installedVersion`(db)、`latestVersion`(清单)、`updateAvailable`、`actualPath`、`source`。

### 3.7 后端命令

| 命令 | 职责 |
|------|------|
| `get_plugin_catalog(refresh)` | 见 §3.4。**唯一的网络只读入口** |
| `install_plugin(name)` | 见 §3.5。进度走事件,不靠轮询 |
| `uninstall_plugin(name)` | 删除落在插件目录里的文件 + 清空 db 的版本列。若解析到的路径**不在插件目录**(说明来自 `PATH`)→ 拒绝并说明「这是系统里装的,请用你自己的包管理器卸载」 |
| `check_plugins`(扩展现有) | 状态视图,补充版本/新版/实际路径 |
| `check_xan_installed`(扩展现有) | 增加返回引擎路径;前端用它决定是否弹引导 |

不新增「打开目录」命令:`reveal_paths` 已能用(F7)。

模块划分(按 019 的结构约定):`plugins.rs` 保留解析 + db + 现有命令;新增 **`plugin_catalog.rs`**(取清单、验签、解析、semver 比较)与 **`plugin_install.rs`**(下载、暂存、校验、落盘)。理由:下载与信任链是独立关注点,塞进 `plugins.rs` 会让它从「解析器」变成「网络 + 文件 + 解析」三合一。

### 3.8 前端

**① 设置页 → 插件页签**(替换现在只读的列表)

每行:名称 / 来源(`一键安装` / `手动放置` / `PATH`)/ 版本(已装 → 最新)/ 状态徽标 / 操作按钮。

| 状态 | 展示 | 按钮 |
|------|------|------|
| 未安装 | 灰点 + 「未安装(42.0 MB)」 | 下载 |
| 已安装且最新 | 绿勾 + 版本 | 打开目录 / 卸载 |
| 有新版本 | 琥珀点 + `0.48.0 → 0.49.0` | 更新 / 打开目录 |
| 下载中 | 行内进度条 + 百分比 + 字节 + 取消(P1) | — |
| 失败 | 红字原因 + 「重试」 | 重试 / 手动下载 / 打开目录 |
| 本平台无资产 | 灰字「该平台暂不提供」 | 手动下载 |

页头:插件目录路径(可复制)+「打开目录」+「检查更新」(强制 `refresh=true`)。

**② 缺引擎的启动引导**(F6 的修复,本设计里对用户价值最大的一块)

```
App.tsx initializeApp()
  const engine = await invoke("check_xan_installed");
  if (!engine) setShowPluginSetup(true);
```

`PluginSetupDialog`(阻塞式,但允许关闭 —— 不能把用户困住):

- 标题:缺少 CSV 处理引擎
- 说明:应用的所有操作都依赖 `xan`,需要下载一次(约 18 MB)。
- 主按钮:**下载 xan**(就地进度条,复用 §3.5 的事件)
- 次按钮:**手动放置**(打开插件目录 + 显示期望文件名 `<平台>/xan.exe`)
- 次按钮:**打开下载页**(插件仓库 releases,给大陆网络兜底)
- 语言:不提「插件」「PATH」这类内部词,直接说「需要下载一个 18MB 的组件」。

**③ 服务层与 hook**

- `src/services/plugins/index.ts`:所有 `invoke` + 事件订阅 + 类型(前端唯一直接与插件后端对话的地方,与 `services/update` 对称)。
- `src/hooks/usePluginCatalog.ts`:加载/刷新/安装(按 name 记录进行中的任务与进度)/错误态。

### 3.9 i18n

按 019 §4.6 的域文件约定**新建** `src/i18n/translations/{zh,en}/plugins.ts`,并把 `common.ts` 里现有的 5 个 plugin key(`plugins` / `pluginDesc` / `pluginNone` / `pluginInstalled` / `pluginMissing`)一并迁过去,同域归拢;同步 `types.ts` 与 `index.ts`。新增文案约 25 个 key(状态、按钮、进度、失败原因、引导对话框)。

**不得**把「下载中 / 校验失败 / 该平台不提供」这类文案塞进 `common.ts` —— 它已经很挤了(022 §i18n 的既有教训)。

### 3.10 镜像与大陆网络(F9)

与 022 的决定不同,这里可以做多源,原因有两个:

1. **回退逻辑归我们管**:022 的 `endpoints` 由 tauri 更新器实现,只在非 2XX 时回退,而超时不会回退;本设计自己写循环,**按超时逐源回退**是可行的。
2. **完整性不依赖来源**:哈希来自签名清单,所以走第三方镜像/CDN 不会降低安全性。

清单 URL 候选(应用内固定,按顺序):

```
https://github.com/tansen87/easy-csv-plugins/releases/latest/download/catalog.json   ← 主源
https://cdn.jsdelivr.net/gh/tansen87/easy-csv-plugins@main/catalog.json              ← CDN 镜像(小文件,适合)
```

⚠️ **二进制不要指望 jsDelivr**:它有单文件体积上限,`duckdb`(37MB)过不去,`xan`(18MB)也贴着边。P0 的二进制来源只有 GitHub Releases。

因此 P0 对大陆用户的正解是**诚实的三件套**:失败原因写清楚(超时/404/校验失败)+「手动下载」直达 release 页 +「打开插件目录」告诉他放哪。P1 再加:

- 设置项「下载加速前缀」:用户填 `https://<自己的代理>/`,应用把它拼在 URL 前重试一遍。因为哈希校验兜底,**这类第三方代理不会带来完整性风险**,只是让用户自己决定信不信它;
- 官方镜像(自有域名 / 对象存储)作为清单里 `urls` 的第二项 —— 换镜像**不需要发新版应用**。

### 3.11 边界与失败行为汇总

| 情况 | 行为 |
|------|------|
| 离线 / 清单取不到 | 用磁盘缓存(标注「可能是旧的」);无缓存则插件页显示错误 + 手动兜底入口。**不影响已装插件的使用** |
| 验签失败 | 拒绝整张清单,报「清单签名无效」,不显示任何可下载项;绝不用缓存里未验签的内容 |
| 哈希不符 | 删暂存文件,报「文件校验失败(可能被中间人替换)」,现有插件不动 |
| `size` 不符 | 同上(在算哈希前就能发现截断) |
| 本平台无资产 | 该行按钮置灰 + 「该平台暂不提供」 |
| 磁盘不足 | 下载前用 `size` 预检,不足则直接失败,不写任何文件 |
| 目标文件被占用(Windows 上插件正在跑) | `rename` 失败 → 报「文件被占用,请关闭正在运行的插件后重试」;暂存文件保留供重试 |
| 名字非法(清单被篡改) | 拒绝,记日志。**这是防覆盖应用本体的最后一道闸** |
| 用户手动放了文件 | 照旧可用(F2);UI 标为「手动放置」,不提供「更新」(避免覆盖用户自己选的版本) |
| 用户手动放的文件版本更新 | `updateAvailable=false`(semver 比较以 db 版本为准;手动放的没有 db 版本 → 视为「未知版本,不建议覆盖」) |

---

## 4. 影响面

| 文件 | 变更 |
|------|------|
| `src-tauri/src/plugin_catalog.rs` | **新增**:清单 URL 候选、验签、解析、semver 比较、`CatalogView` |
| `src-tauri/src/plugin_install.rs` | **新增**:下载、暂存、哈希校验、置可执行位、原子替换、进度事件 |
| `src-tauri/src/plugins.rs` | `plugins` 表加列(`ensure_column`)、`check_plugins` 扩展、`get_plugin_dir` 复用、`install_plugin` / `uninstall_plugin` / `get_plugin_catalog` 注册 |
| `src-tauri/src/xan.rs` | `check_xan_installed` 返回路径而非 bool(或新增 `get_engine_status`) |
| `src-tauri/src/lib.rs` | 注册 3 个新命令 |
| `src-tauri/plugin-signing.pub` | **新增**:清单验签公钥(`include_str!` 进来,不塞 `tauri.conf.json`)。**允许一行一把、多把并存**,验签时逐行尝试 —— 密钥轮换的安全垫 |
| `src-tauri/Cargo.toml` | `minisign-verify`、`semver` 提升为直接依赖(F8:已在 lock 里) |
| `src-tauri/resources/plugins/readme.md` | **改**:现在说「仓库里有现成的 xan.exe」是错的(F1/P-5),改为指向插件仓库 + 说明应用内下载 |
| `src/services/plugins/index.ts` | **新增**:invoke 封装 + 事件订阅 + 类型 |
| `src/hooks/usePluginCatalog.ts` | **新增**:加载/刷新/安装/进度/错误 |
| `src/components/setting/SettingsTabContent.tsx` | 插件页签重写(状态、按钮、行内进度、刷新) |
| `src/modules/dialogs/app/PluginSetupDialog.tsx` | **新增**:缺引擎引导 |
| `src/app/App.tsx` | `check_xan_installed` 结果接上引导(F6) |
| `src/types/xan.ts` | `PluginInfo` / `CatalogEntry` 类型 |
| `src/i18n/translations/{zh,en}/plugins.ts` | **新增**域文件;`common.ts` 的 5 个 plugin key 迁入 |
| `docs/AI/INDEX.md` | 设计表登记 023;`plugins.rs` 节补新命令;快速索引加「插件下载」行 |
| `docs/design/011_duckdb-plugin.md` | 加一句「手工 SQL 那套已被应用内下载取代,保留作为零网络的兜底」 |

---

## 5. 测试计划

**后端(`cargo test --lib`)**

- 清单解析:合法清单 → 条目齐全;缺 `assets` / 非法平台键 / 非法 `name`(`../evil`、`a/b`、大写、超长)→ 拒绝;
- 验签:fixture 直接用**插件仓库里那份真实签名过的清单**(`catalog.local.json` + `.sig` + `plugin-signing.pub` —— 公钥、密文、签名都是公开数据,可以放心入库)→ 通过;改动一个字节 → 失败;换成 app updater 的公钥 → 失败;
- 资产选择:五个平台各自映射到正确资产;`unsupported` → 无资产;
- 安装:`install_from_bytes` 拆出来可注入 => 哈希不符不落盘、size 不符不落盘、成功时目标文件内容与权限正确(Unix 断言 0o755 位);
- 原子性:目标已存在且可写 → 替换;暂存目录残留不影响下次;
- 回滚保护:新清单 `generatedAt` 更旧 → 默认拒绝,`force` 才接受;
- 名字白名单:一组恶意名字全部被拒(这条是安全测试,必写)。

**前端(`vitest`)**

- 插件页各状态的渲染与按钮可用性(未安装/已装最新/可更新/本平台无资产/失败);
- 进度事件 → 行内进度条百分比与字节;
- `PluginSetupDialog`:缺 xan 时出现、下载成功后消失、手动放置与打开下载页两个按钮都触发对应回调;xan 已存在时不出现;
- hook:刷新失败保留旧清单并标 `stale`。

**刻意不在 CI 做的**:真实网络下载(会 flaky)、真实 minisign 私钥操作。把「网络」与「校验+落盘」拆开后,后者可以完全本地测试。

**本地联调用例**:插件仓库的 `README` 里给了三步环回测试(`--base-url http://127.0.0.1:8099` +
`python -m http.server 8099`)。⚠️ 因此 HTTP 白名单规则要留一个例外:**仅 debug 构建**允许
`http://127.0.0.1` / `http://localhost`,release 构建只允许 `https` 与固定主机白名单
——否则这个例外本身就成了「清单被篡改后指向本机服务」的攻击面。

**尚未覆盖**:真机上「首次缺 xan → 引导下载 → 管道跑通」的全链路,需要 P0 落地后才能验。

---

## 6. 分阶段实施

| 阶段 | 内容 | 验收 |
|------|------|------|
| **P0** | 插件仓库 + `catalog.json` + 签名 + CI;后端「取清单 / 下载 / 校验 / 落盘 / 注册」;设置页插件页签重写;缺引擎引导;readme 更正 | 在干净机器上:装好应用 → 启动 → 提示缺引擎 → 一键下载 → 管道可正常执行;把 `catalog.json` 改一个字节后重试 → 拒绝并提示签名无效 |
| **P1** | 更新检测与「更新」按钮;卸载;`generatedAt` 防回滚;清单镜像(jsDelivr)+ 用户自填加速前缀;取消下载;独立签名密钥 | 手动把已装 xan 换成旧版 → UI 提示可更新 → 一键更新后版本正确 |
| **P2** | duckdb 与其它上游 CLI;第三方清单 URL(可选、需显式风险提示);把「手动放置」降级为纯兜底文档 | — |

---

## 7. 已知限制与风险

- **大陆成功率不可保证**(F9)。这是本设计最脆弱的一环,只能靠「多源 + 清晰失败 + 手动兜底」缓解,不能承诺「一定能下载」。⚠️ 与 022 同一个坑:**不要**为了"冗余"往清单 URL 里塞一个语义不对的镜像期望它自动兜底 —— 回退逻辑必须自己实现(§3.10)。
- **私钥是单点,但不是死局**:泄露 → 可下发任意插件(按插件仓库 `KEY-MANAGEMENT.md` §5 轮换);丢失 → 换新密钥,老版本应用的一键安装暂时失效但可经一次应用更新恢复(详见 §3.3 的「密钥丢失的真实影响面」)。必须离线备份 + 明确持有者(022 对更新器密钥的同样要求)。**因此 `plugin-signing.pub` 必须支持多把公钥**。
- **没有防回滚**(P0);P1 的 `generatedAt` 检查只是轻量缓解,不是 TUF。
- **插件无沙箱**:以当前用户权限运行。清单里的条目等同于「我们替用户背书」,所以新增插件要按安全审查对待,不能随手加。
- **体积**:首次下载 `xan` 约 18MB、`duckdb` 约 37MB,弱网下体感很长;必须有进度与取消(P1)。
- **杀软/Defender**:应用自己下载的文件**不带** Mark-of-the-Web(HTTP 客户端不会写 `Zone.Identifier`),所以不会触发 SmartScreen;但**用户手动下载**的会 —— 引导文案里要提醒「若提示已阻止,右键 → 属性 → 解除锁定」。
- **`PATH` 里的同名程序**:解析顺序是插件目录优先(F2),所以一键安装的版本会覆盖用户 `PATH` 上的版本 —— 需要在 UI 上写明「已装的会优先使用」,否则用户会困惑「为什么我 PATH 里的新版没生效」。

---

## 8. 待定问题(需要拍板)

1. **仓库归属与命名**:`tansen87/easy-csv-plugins`?公开还是先私有(私有会让 release 资产需要 token,等于给所有用户发密钥 → 必须公开)。
2. **签名密钥**:独立新密钥(推荐)还是复用 022 的更新器密钥(少管一个秘密,但插件仓库 CI 会同时具备伪造应用更新的能力)。
3. **清单发布方式**:每次插件变更发一个 release(`/releases/latest/download/`)—— 需要「必须正式发布,draft 不可达」这条 022 的老坑;还是只走仓库文件 + raw/jsDelivr。
4. **大陆镜像**:接受「用户自填加速前缀」吗?要不要做官方镜像(自有域名/对象存储)?
5. **P0 范围**:是否必须一次把「缺引擎引导」也做掉(推荐做,它是本设计对用户价值最大的一块);还是先只做设置页里的下载按钮。
6. **第三方插件**是否开放(P2),以及开放到什么程度(任意清单 URL = 把信任责任交给用户,需要明确的风险提示语)。

---

## 附录 A:插件仓库 CI(已落地)

真实的 workflow 在插件仓库里:`easy-csv-plugins/.github/workflows/release.yml`。
结构是两个 job:

1. **`stage`**(矩阵 5 行:ubuntu×2 / macos-14×2 / windows):读 `plugin.json`
   → `gh release download` 取上游资产并按 `upstream.member` 解出裸二进制
   → pinyin 用 `cargo --target` 现场编译 → 上传 artifact;
2. **`publish`**:汇总 `dist/` → `build-catalog.mjs --require-all`(缺任一平台直接失败,
   避免发出只服务部分平台的清单)→ `ajv-cli` 按 schema 校验 → 写临时密钥并签名
   → **先**发各 `<name>-v<version>` release → **最后**用 `--latest` 发 `catalog-<日期>`,
   让 `/releases/latest/download/catalog.json` 指向它。

需要配置的仓库 secret:`PLUGIN_SIGNING_KEY`(私钥文件内容)、
`PLUGIN_SIGNING_KEY_PASSWORD`(密钥无密码也给**空串**,理由同 022)。

## 附录 B:与本项目既有约定的关系

| 既有约定 | 本设计如何遵守 |
|----------|----------------|
| 012 §D1「xan/pinyin 用户自理」 | 不推翻:手动放置**继续有效且优先于 `PATH`**;一键下载只是新增一条来源。这条约定从「唯一途径」降级为「零网络兜底」 |
| 012 的插件目录 `<resources>/plugins/<PLATFORM_DIR>/` | 完全沿用,不新增路径概念 |
| 022 的签名/发布经验 | 复用 minisign 体系与「draft release 不可达」「私钥单点」「不要用数组做容灾」四条教训 |
| 019 §4.6 i18n 域文件 | 新建 `plugins.ts` 域,不动已拥挤的 `common.ts` |
| 016–022 的「上次结果」模式 | 不适用(插件状态来自 db 与清单,不需要单独的历史记录) |
| `docs/AI/INDEX.md` 的 `check:index` | 新增文件路径都要能被解析到,登记后跑 `pnpm check:index` |
