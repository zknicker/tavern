---
summary: Release workflow for version bumps, changelog context, Runtime artifacts, desktop signing/notarization, updater metadata, S3 upload, tags, and GitHub Release.
read_when:
  - cutting, signing, notarizing, or publishing a Tavern release
  - changing Runtime release artifacts or Homebrew deployment
  - changing release scripts, updater metadata, or release environment variables
---

# Releases

## Flow

1. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run release:collect-changelog-context`.
4. Update the top `CHANGELOG.md` entry from the commit context.
5. Run `bun run release:check`.
6. Run `bun run release:build-runtime-artifact`.
7. Run `bun run release:publish` from macOS with signing, notarization, updater,
   S3, and GitHub auth configured.

`release:publish` builds the Runtime artifact, builds the signed desktop app,
notarizes it, creates updater metadata, uploads desktop updater artifacts and
Runtime tarballs to `TAVERN_RELEASE_S3_URI`, commits release metadata, pushes
`main`, pushes the version tag, creates the GitHub Release, and updates the
Homebrew tap formula.

Desktop builds compile `assets/mac-icon.icon` with Xcode `actool` before Tauri
packaging. The compiled `Assets.car` provides the layered Liquid Glass app icon
on macOS 26, and `AppIcon.icns` remains the fallback icon for older macOS
versions and Tauri's DMG/app bundle path.

Tavern ships two production artifacts:

* `Tavern.app` is the desktop client plus its local app backend.
* `tavern-runtime-<version>-<target>.tar.gz` is the always-on Runtime server for
  a Mac mini or other host.

The desktop app connects to the configured Runtime URL. Runtime deployment and
Homebrew service management live in [Runtime Deployment](runtime-deploy.md).

Keep every published changelog version anchored by a matching `vX.Y.Z` git tag
or a `release: vX.Y.Z` commit. The changelog context command uses that anchor to
collect changes for the next release.

## Environment

Required release environment:

* `TAVERN_RELEASE_BASE_URL`
* `TAVERN_RELEASE_S3_URI`
* `TAVERN_HOMEBREW_TAP_REPO` defaults to `zknicker/homebrew-tavern`
* `TAVERN_HOMEBREW_TAP_DIR` optionally points to a local tap checkout
* `TAURI_UPDATER_PUBLIC_KEY`
* `TAURI_SIGNING_PRIVATE_KEY`
* `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
* `APPLE_SIGNING_IDENTITY` or CI certificate variables
* `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
* `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

The GitHub Release step uses `gh`; run `gh auth status` before publishing.
