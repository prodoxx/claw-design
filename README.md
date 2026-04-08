# Claw Design

Point at your running website. Describe what to change. Watch Claude edit the code live.

[![npm version](https://img.shields.io/npm/v/claw-design)](https://www.npmjs.com/package/claw-design)
[![license](https://img.shields.io/npm/l/claw-design)](./LICENSE)
[![node](https://img.shields.io/node/v/claw-design)](https://nodejs.org)

<!-- TODO: Add demo GIF -->
<!-- ![Claw Design demo](./docs/demo.gif) -->

## Why Claw Design?

Web developers constantly context-switch between browser and editor. Claw Design eliminates this -- select any part of your running site, describe the change in plain English, and Claude Code edits the source files directly. Changes appear instantly via hot module reload.

## Quick Start

```bash
npm install -g claw-design
cd your-project
clawdesign start
```

## Requirements

- **Node.js >= 20** (LTS recommended)
- **[Claude Code CLI](https://claude.ai/download)** installed and authenticated
- A web project with a dev server

## How It Works

1. **Detects your dev server** from `package.json` scripts and starts it automatically
2. **Opens a browser window** showing your running site with a selection overlay
3. **You draw a selection** over any area and describe what you want to change
4. **Claude Code edits your source files** based on the visual context and instruction -- HMR shows the result instantly

## CLI Options

| Flag | Description |
|------|-------------|
| `--cmd <command>` | Override dev server command (e.g. `--cmd "python -m http.server 8000"`) |
| `--port <number>` | Specify dev server port instead of auto-detecting |
| `--verbose` | Show dev server output in the terminal |
| `--version` | Show version number |

## Viewport Switching

Switch between viewport presets using the toolbar buttons:

- **Desktop** (1280x800)
- **Tablet** (768x1024)
- **Mobile** (375x812)

## Framework Support

Works with anything that serves on localhost:

- React
- Vue
- Svelte
- Next.js
- Nuxt
- Angular
- Astro
- Plain HTML

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT -- see [LICENSE](./LICENSE) for details.
