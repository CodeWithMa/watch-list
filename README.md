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

## Development

This project uses [prek](https://github.com/j178/prek) for Git hooks.
After installing dependencies, install the hooks:

```shell
bunx prek install
bunx prek install -t commit-msg
```

## Privacy

Watch-list data is stored locally in your browser using IndexedDB. Nothing is ever sent to a server. Your watch history stays on your device. Export your data before upgrading from versions that used localStorage if you want to keep it.
