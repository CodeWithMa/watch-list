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

Install Podman and `podman-compose`, and run Podman as your normal user (rootless).
On Linux, configure subordinate UID/GID ranges, the `newuidmap`/`newgidmap` helpers,
and rootless networking using the [rootless setup guide](https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md).
Verify that `podman info --format '{{.Host.Security.Rootless}}'` prints `true`.
On macOS or Windows, create and start a Podman machine first. No Docker daemon is needed.

Run these commands from the repository root:

```shell
# Start development with source mounts and hot reload (foreground)
bun run container:dev

# Stop the current container environment
bun run container:down

# Build and start a local production preview (detached)
COMMIT_HASH=$(git rev-parse HEAD) bun run container:preview

# Follow logs; Ctrl-C stops following
bun run container:logs

# Stop and remove the preview
bun run container:down
```

Both modes use the Compose project `watch-list` and port 4200. Stop the current
environment before switching modes. Open <http://localhost:4200> in your browser.
Starting either mode rebuilds its image and recreates its container to pick up changes.
Development binds only to localhost; the production preview preserves the existing
`4200:80` mapping, which also allows access from other devices on your network.
Keep the same scheme, hostname, and port to retain access to your browser's watch-list data.

Container configuration lives in `containers/`, with the repository root as the
build context. `.containerignore` excludes local dependencies, build output, and
environment files. No `.env` file is required. After changing dependencies, restart
development with `bun run container:down` followed by `bun run container:dev` to
rebuild the image's installed dependencies.

To run the production HTTP smoke check against a running preview:

```shell
COMMIT_HASH=$(git rev-parse HEAD) bun containers/smoke-test.mjs
```

CI builds and smoke-tests the production preview with rootless Podman.

## Development

This project uses [prek](https://github.com/j178/prek) for Git hooks.
After installing dependencies, install the hooks:

```shell
bunx prek install
bunx prek install -t commit-msg
```

## Privacy

Watch-list data is stored locally in your browser using IndexedDB. Nothing is ever sent to a server. Your watch history stays on your device. Export your data before upgrading from versions that used localStorage if you want to keep it.
