# Watch List

This is my tool to suggest me what to watch next.

## Getting Started

```shell

# Install dependencies
bun install

# Start web development server
bun run start

# Build for web (PWA)
bun run build

# Start desktop app in development (requires Electron)
bun run electron:dev

# Build desktop app installers
bun run electron:build

```

## Usage

- Add movies or series to your watch list
- Watch suggested series or movie on home page
- Mark watched item as watched
- Rinse and repeat

## Containers

Requires rootless Podman and `podman-compose`. Run from the repository root:

```shell
bun run container:dev      # Development with hot reload
bun run container:preview  # Local production preview (detached)
bun run container:logs     # Follow logs
bun run container:down     # Stop and remove containers
```

Open <http://localhost:4200>. Stop the current mode before switching between dev and preview.

## Development

This project uses [prek](https://github.com/j178/prek) for Git hooks.
After installing dependencies, install the hooks:

```shell
bunx prek install
bunx prek install -t commit-msg
```

## Privacy

Watch-list data is stored locally in your browser using IndexedDB. Nothing is ever sent to a server. Your watch history stays on your device. Export your data before upgrading from versions that used localStorage if you want to keep it.

## Releases

`package.json` is the source of the application version. Production web and Electron builds embed it,
along with the commit hash and build date, in **Settings → About**.

To publish a stable release:

1. Update `package.json` to the release version and merge the change into `dev`.
2. Wait for CI, the GitHub Pages deployment, and the development Electron builds to pass on the
   intended release commit. Verify the version in Settings on the deployed web app and a desktop build.
3. Create an annotated tag matching the package version on that exact commit, then push the tag to
   `CodeWithMa/watch-list`. For v1.0.0, using `upstream` as the remote for that repository:

   ```shell
   git tag -a v1.0.0 <release-commit-sha> -m "Release v1.0.0"
   git push upstream refs/tags/v1.0.0
   ```

4. Watch the **Build Electron App** workflow. It validates that the tag matches `package.json`, builds
   Linux, macOS, and Windows installers, then publishes a stable GitHub release with generated release
   notes and the installers attached. Publication waits for all three builds to succeed. Stable tags
   must use `v<major>.<minor>.<patch>`; prerelease tags are not supported.
5. Check the release is marked **Latest**, review its notes and assets, and smoke-test a downloaded
   installer, including **Settings → About**. For v1.0.0, close issue #182 with the release link.

Pushes to `dev` continue to replace the `dev-release` prerelease. Stable releases are separate from
that rolling development release. GitHub Pages continues to deploy from `dev`; pushing a tag does not
redeploy the web app.
