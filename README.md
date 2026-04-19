# Watch List

A modern, privacy-first watch list tracker for movies and series. Built with Angular and Tailwind CSS.

![Angular](https://img.shields.io/badge/Angular-21DD32?style=flat&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css)

## Features

- **Track Movies & Series** - Keep track of what you want to watch, what you're watching, and what you've completed
- **Progress Tracking** - Track your current episode and season for series
- **Smart Recommendations** - Suggests the series you've watched least recently first (only suggests a new series if you've watched all other non-completed series at least once)
- **Group Organization** - Organize your watch list into custom groups
- **Dark Mode** - Full dark mode support
- **Local Storage** - All data stored locally in your browser. No account required, no cloud.
- **Import/Export** - Export your watch list as JSON for backup

## Tech Stack

- **Angular** - Modern Angular with signals for reactive state management
- **TypeScript** - Full type safety throughout
- **Tailwind** - Utility-first CSS framework with CSS variables
- **Tauri** - Optional desktop app wrapper for native experience

## Getting Started

``` shell

# Install dependencies
bun install

# Start development server
bun run start

# Build for production
bun run build

```

## Usage

1. Add movies or series to your watch list
2. Mark items as "In Progress" when you start watching
3. Use the home page to get recommendations on what to watch next
4. Create groups to organize your watch list by genre, priority, or any category you prefer

## Privacy

All your data is stored locally in your browser using localStorage. Nothing is ever sent to a server. Your watch history stays on your device.
