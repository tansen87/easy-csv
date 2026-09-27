; EasyCsv NSIS installer hooks, referenced from tauri.conf.json
; (bundle > windows > nsis > installerHooks). `$R9` is used as scratch; the
; stock template never touches it.
;
; Hook names available from Tauri: NSIS_HOOK_PREINSTALL, NSIS_HOOK_POSTINSTALL,
; NSIS_HOOK_PREUNINSTALL, NSIS_HOOK_POSTUNINSTALL.

; ---------------------------------------------------------------------------
; 1) Keep everything EasyCsv owns inside a folder of its own.
;
; The uninstaller removes $INSTDIR, so $INSTDIR must never be a directory the
; user picked for other reasons. Choosing "D:\Tools" must result in
; "D:\Tools\EasyCsv", not in an install that scatters its files across D:\Tools
; and then lets the uninstaller delete whatever else lives there.
;
; Idempotent on purpose: an update (and a reinstall) starts from the previous
; $INSTDIR recorded in the registry, which already ends with the product name.
!macro NSIS_HOOK_PREINSTALL
  ${GetFileName} "$INSTDIR" $R9
  ${If} $R9 != "${PRODUCTNAME}"
    ; A trailing backslash typed by hand would yield "D:\Tools\\EasyCsv".
    StrCpy $R9 "$INSTDIR" "" -1
    ${If} $R9 == "\"
      StrCpy $INSTDIR "$INSTDIR" -1
    ${EndIf}
    StrCpy $INSTDIR "$INSTDIR\${PRODUCTNAME}"
    ; `File` extracts into $OUTDIR, which Section Install set before this hook.
    SetOutPath "$INSTDIR"
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; 2) Make the uninstaller's "delete app data" checkbox do what it promises.
;
; The data directory *is* the install directory ("$INSTDIR\data",
; "$INSTDIR\plugins", "$INSTDIR\templates", "$INSTDIR\versions"), so a ticked box
; can remove the whole folder - and that folder is by construction the app's own
; (hook 1). The stock template only deletes "$LOCALAPPDATA\$BUNDLEID", a path
; EasyCsv has never used, which made the checkbox a no-op.
;
; Safe by construction: in a passive/silent uninstall the checkbox page callback
; never runs, so $DeleteAppDataCheckboxState stays empty and nothing below
; executes; updates never get here either, because the updater runs the installer
; with /UPDATE, which skips the uninstaller entirely. The product-name check is a
; second safety net: a mis-set $INSTDIR must never be wiped recursively.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
    SetShellVarContext current

    ${GetFileName} "$INSTDIR" $R9
    ${If} $R9 == "${PRODUCTNAME}"
      RmDir /r "$INSTDIR"
    ${EndIf}

    ; Where the data goes when the install directory is not writable (installed
    ; under Program Files, or from read-only media).
    RmDir /r "$LOCALAPPDATA\EasyCsv"
  ${EndIf}
!macroend
