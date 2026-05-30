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

The desktop app carries the runtime as a Tauri sidecar. The release build
compiles `apps/server/src/index.ts` into `src-tauri/binaries/tavern-server-*`,
then Tauri bundles that binary inside `Tavern.app`, the DMG, and the updater
archive. There is no separate runtime artifact to deploy for desktop releases.

Keep every published changelog version anchored by a matching `vX.Y.Z` git tag
or a `release: vX.Y.Z` commit. The changelog context command uses that anchor to
collect changes for the next release.

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
