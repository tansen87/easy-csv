/** Plugin catalog & in-app install */
export const zhPlugins = {
  plugins: "插件",
  pluginDesc: "外部 CLI 插件,可按需下载安装",
  pluginNone: "暂无可用插件",
  pluginInstalled: "已安装",
  pluginMissing: "未安装",

  // Row actions
  pluginDownload: "下载",
  pluginUpdate: "更新",
  pluginUninstall: "卸载",
  pluginOpenFolder: "打开插件目录",
  pluginHomepage: "项目主页",
  pluginRefresh: "获取最新版本",
  pluginRefreshHint: "刷新插件清单",
  pluginRetry: "重试",

  // Progress / state
  pluginDownloading: "下载中",
  pluginVerifying: "校验中",
  pluginInstalling: "安装中",
  pluginChecking: "检查中",
  pluginCancel: "取消",
  pluginCancelling: "正在取消…",
  pluginLoadingCatalog: "正在获取插件清单…",
  pluginStaleHint: "网络不可用,当前显示的是缓存清单",

  // Sources
  pluginSourceRegistry: "由应用安装",
  pluginSourceManual: "手动放入",
  pluginSourcePath: "系统 PATH",
  pluginRequiredBadge: "必需",
  pluginUpdateAvailable: "有新版本",

  // Errors
  pluginCatalogFailed: "获取插件清单失败",
  pluginInstallFailed: "插件安装失败",
  pluginUninstallFailed: "插件卸载失败",
  pluginUninstallConfirmTitle: "卸载插件?",
  pluginUninstallConfirmDesc:
    "将从插件目录删除该可执行文件,之后相关命令无法使用。",
  pluginUninstallManualHint:
    "该插件不是由本应用安装的,请通过原来的方式移除。",

  // Startup guidance
  pluginSetupTitle: "缺少必需的插件",
  pluginSetupDesc:
    "Easy Csv的绝大多数命令依赖xan. 可以现在自动下载并安装, 或手动放入插件目录",
  pluginSetupInstall: "自动下载安装",
  pluginSetupOpenFolder: "打开插件目录",
  pluginSetupLater: "稍后再说",
  pluginSetupInstalled: "xan已安装完成,现在可以正常使用所有命令",

  // Download acceleration
  pluginPrefixTitle: "下载加速前缀",
  pluginPrefixDesc:
    "国内直连GitHub较慢时,可填写一个代理前缀(如 https://ghproxy.example/),下载会先经它转发,失败时自动直连.文件完整性由签名清单中的哈希校验兜底,代理无法替换内容",
  pluginPrefixPlaceholder: "https://ghproxy.example/",
  pluginPrefixSave: "保存",
  pluginPrefixClear: "清除",
  pluginPrefixSaved: "下载前缀已保存",
  pluginPrefixCleared: "下载前缀已清除",
} satisfies Record<string, string>;
