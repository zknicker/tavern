# Desktop Releases

Tavern follows the same release metadata flow as PunchPress:

1. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
2. Run `bun install`.
3. Run `bun run release:collect-changelog-context`.
4. Update the top `CHANGELOG.md` entry from the commit context.
5. Run `bun run release:check`.
6. Run `bun run release:publish` from macOS with signing, notarization, updater, S3, and GitHub
   env/auth set.

`release:publish` builds the signed desktop app, notarizes it, creates updater metadata, uploads
the desktop artifacts to S3, verifies the local artifacts, commits release metadata as
`release: vX.Y.Z`, pushes `main`, creates and pushes tag `vX.Y.Z`, and creates the GitHub Release
with the DMG, updater archive, updater signature, and `latest.json`.

`CHANGELOG.md` has no `Unreleased` section. The latest release heading must match the app version in
`apps/website/package.json`, `apps/website/src-tauri/tauri.conf.json`, and
`apps/website/src-tauri/Cargo.toml`.

## Required Release Environment

The publish step uses Tauri signed updater artifacts and uploads them to S3:

- `TAVERN_RELEASE_BASE_URL`: public HTTPS URL for the macOS release folder.
- `TAVERN_RELEASE_S3_URI`: S3 destination URI for that same folder.
- `TAURI_UPDATER_PUBLIC_KEY`: public key embedded in the app for updater signature checks.
- `TAURI_SIGNING_PRIVATE_KEY`: private key used by Tauri to sign updater artifacts.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password for the updater private key, if one was set.
- `APPLE_SIGNING_IDENTITY`: Developer ID Application identity available in the keychain. CI can
  use `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` instead.
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`: Apple notarization credentials. App Store Connect
  API credentials can use `APPLE_API_KEY`, `APPLE_API_ISSUER`, and `APPLE_API_KEY_PATH` instead.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: S3 publisher credentials for
  `TAVERN_RELEASE_S3_URI`.

The GitHub Release step uses the `gh` CLI. Run `gh auth status` before publishing if the local
machine has not published a release recently.

`bun run publish:desktop` is the lower-level desktop artifact step used by `release:publish`. It
loads `.env`, builds the sidecar, builds the signed Mac app and DMG, creates `latest.json`, and
uploads `latest.json`, the DMG, the updater archive, and its signature to S3.

`bun run build:desktop:unsigned` is the CI integrity build. It ad-hoc signs local artifacts and does
not publish or create updater metadata.
