# claw-design

Visual web development tool powered by Claude Code. Point at any part of your running website, describe changes in plain English, and watch Claude edit the code live.

## Requirements

- **Node.js >= 20** (LTS recommended)
- **Claude Code CLI** installed and authenticated (`claude login`)
- A web project with a dev server (React, Vue, Svelte, Next.js, plain HTML, etc.)

## Installation

```bash
npm install -g claw-design
```

## Usage

```bash
cd your-project
clawdesign start
```

### Options

| Flag | Description |
|------|-------------|
| `--cmd <command>` | Override dev server command (e.g. `--cmd "python -m http.server 8000"`) |
| `--port <number>` | Specify dev server port instead of auto-detecting |
| `--verbose` | Show dev server output in the terminal |
| `--version` | Show version number |

## How It Works

1. **Detects your dev server** from `package.json` scripts and starts it automatically
2. **Opens an Electron window** showing your running site with a selection overlay
3. **You draw a selection** over any area and describe what you want to change
4. **Claude Code edits your source files** based on the visual context and instruction -- HMR shows the result instantly

## Viewport Switching

Switch between viewport presets using the toolbar buttons:

- **Desktop** (1280x800)
- **Tablet** (768x1024)
- **Mobile** (375x812)

## Framework Support

Works with any framework that serves on localhost:

- React
- Vue
- Svelte
- Next.js
- Nuxt
- Angular
- Astro
- Plain HTML

## License

MIT -- see [LICENSE](LICENSE) for details.
