use std::path::Path;
#[cfg(target_os = "windows")]
use std::path::PathBuf;

use serde::Serialize;

/// How the running build is installed.
///
/// Decides whether the in-app updater can replace this installation in place —
/// i.e. whether "Download and install" may be offered, or whether the user has
/// to fall back to the manual download link. See
/// `docs/design/022_github-auto-update-and-admin-free-install.md` §3.4–§3.6, §5.3.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallForm {
  /// Windows, NSIS install for the current user (`%LOCALAPPDATA%`). The
  /// installer runs in the user's own context, so updates never prompt for
  /// elevation.
  UserScoped,
  /// Windows, install under a machine-wide path (`Program Files`). Updating
  /// still works, but Windows may ask for administrator rights.
  MachineScoped,
  /// macOS `.app` under the user's home (e.g. `~/Applications`): writable in
  /// place, so the updater replaces it without elevation.
  AppBundleUser,
  /// macOS `.app` in `/Applications` or elsewhere outside the home directory:
  /// replacing it requires administrator rights.
  AppBundleSystem,
  /// Linux AppImage: a single writable file that the updater replaces.
  AppImage,
  /// Linux package install (deb) or a manually unpacked build: the application
  /// directory is not writable by the user.
  DebOrUnpacked,
  /// Unrecognised layout; treated as not self-updatable.
  Unknown,
}

impl InstallForm {
  /// Whether the updater can install in place without the user having to do
  /// anything outside the app.
  ///
  /// `MachineScoped` counts as updatable on purpose: the passive installer
  /// still runs in the user's session, it only *may* raise an elevation prompt.
  pub fn can_self_update(self) -> bool {
    match self {
      InstallForm::UserScoped
      | InstallForm::MachineScoped
      | InstallForm::AppBundleUser
      | InstallForm::AppImage => true,
      InstallForm::AppBundleSystem | InstallForm::DebOrUnpacked | InstallForm::Unknown => false,
    }
  }
}

/// Reported to the frontend together with the executable path, so a support
/// request can be answered without asking the user to hunt for it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallFormInfo {
  pub form: InstallForm,
  pub can_self_update: bool,
  pub exe_path: Option<String>,
}

/// Detect how this build is installed.
///
/// The frontend cannot work this out on its own (no access to `current_exe()`
/// or the process environment), so the rule lives here — one source of truth
/// for "may we offer the one-click update".
#[tauri::command]
pub fn get_install_form() -> InstallFormInfo {
  let exe = std::env::current_exe().ok();
  let form = detect_install_form(exe.as_deref());
  InstallFormInfo {
    form,
    can_self_update: form.can_self_update(),
    exe_path: exe.map(|p| p.to_string_lossy().into_owned()),
  }
}

fn detect_install_form(exe: Option<&Path>) -> InstallForm {
  #[cfg(target_os = "linux")]
  {
    let _ = exe;
    // AppImages export APPIMAGE pointing at themselves. Anything else is a
    // distro package (deb) or a manually unpacked build, neither of which the
    // updater can write to.
    if std::env::var_os("APPIMAGE").is_some_and(|v| !v.is_empty()) {
      return InstallForm::AppImage;
    }
    InstallForm::DebOrUnpacked
  }

  #[cfg(target_os = "macos")]
  {
    let Some(exe) = exe else {
      return InstallForm::Unknown;
    };
    // `.../EasyCsv.app/Contents/MacOS/EasyCsv`
    let Some(bundle) = exe
      .ancestors()
      .find(|a| a.extension().is_some_and(|e| e.eq_ignore_ascii_case("app")))
    else {
      return InstallForm::Unknown;
    };
    match dirs::home_dir() {
      Some(home) if bundle.starts_with(&home) => InstallForm::AppBundleUser,
      _ => InstallForm::AppBundleSystem,
    }
  }

  #[cfg(target_os = "windows")]
  {
    let Some(exe) = exe else {
      return InstallForm::Unknown;
    };
    if is_under_program_files(exe) {
      InstallForm::MachineScoped
    } else {
      InstallForm::UserScoped
    }
  }

  #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
  {
    let _ = exe;
    InstallForm::Unknown
  }
}

#[cfg(target_os = "windows")]
fn is_under_program_files(exe: &Path) -> bool {
  // Prefer the environment (it reflects relocated / non-C: installs), and fall
  // back to the two conventional roots. `Path::starts_with` compares components
  // case-sensitively, which is fine here because both the environment and
  // `current_exe()` report the on-disk casing.
  ["ProgramFiles", "ProgramFiles(x86)"]
    .iter()
    .filter_map(|key| std::env::var_os(key).map(PathBuf::from))
    .chain([
      PathBuf::from(r"C:\Program Files"),
      PathBuf::from(r"C:\Program Files (x86)"),
    ])
    .any(|root| exe.starts_with(root))
}
