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

1. Update `package.json`, merge into `dev`, and wait for CI to pass.
2. Tag that commit with the matching `v<major>.<minor>.<patch>` and push the tag.

GitHub Actions publishes the stable release with desktop installers. The version appears in
**Settings → About**. GitHub Pages deploys from `dev`.
