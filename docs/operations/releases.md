---
summary: Desktop release workflow for version bumps, changelog context, signing/notarization, updater metadata, S3 upload, tags, and GitHub Release.
read_when:
  - cutting, signing, notarizing, or publishing a Tavern desktop release
  - changing release scripts, updater metadata, or release environment variables
---

# Desktop Releases

## Flow

1. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run release:collect-changelog-context`.
4. Update the top `CHANGELOG.md` entry from the commit context.
5. Run `bun run release:check`.
6. Run `bun run release:publish` from macOS with signing, notarization, updater,
   S3, and GitHub auth configured.

`release:publish` builds the signed desktop app, notarizes it, creates updater
metadata, uploads artifacts, commits release metadata, pushes `main`, pushes the
version tag, and creates the GitHub Release.

## Environment

Required release environment:

* `TAVERN_RELEASE_BASE_URL`
* `TAVERN_RELEASE_S3_URI`
* `TAURI_UPDATER_PUBLIC_KEY`
* `TAURI_SIGNING_PRIVATE_KEY`
* `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
* `APPLE_SIGNING_IDENTITY` or CI certificate variables
* `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
* `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

The GitHub Release step uses `gh`; run `gh auth status` before publishing.
