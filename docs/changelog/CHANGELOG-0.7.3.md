# Changelog

## [0.7.3] - 2026-10-21

2 commits since v0.7.2.

### Changed

- **Update notes now come from each version's changelog**: the release workflow no longer stamps the same placeholder text into every release. Before building, it reads `docs/changelog/CHANGELOG-<version>.md`, drops the `# Changelog` title and version heading, and passes the remainder to `tauri-action` as the release body — the same text ends up in `latest.json`'s `notes`, which is what the in-app updater displays. A missing changelog now fails the release instead of silently shipping generic notes.

### Fixed

- **Published date shows only the day**: the update dialog renders `YYYY-MM-DD` instead of the full ISO timestamp.

### Docs

- Design `022_github-auto-update-and-admin-free-install` updated to record the build-time changelog injection and the remaining caveat that `notes` is frozen at build time.
