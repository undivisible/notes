# Notes — Ultraminimal Markdown Editor

A distraction-free, Notion-style markdown editor with auto-save, multiple themes, and export options.

## Features

- **Full-page editor** — The entire page is your text area
- **Auto-save** — Saves to localStorage every 500ms
- **Notion-style editing** — Clean, readable markdown with live preview
- **6 Themes** — Nord, Dark, Light, OLED, Sepia, Taiga
- **Markdown export** — Export as .md, .html, or .pdf
- **Word & character counts** — Real-time stats in bottom-right
- **No title, no clutter** — Just your content

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Commands

- **Cmd/Ctrl + K** — Open command menu
- **Tab** — Insert 2-space indent
- **Export button** — Download as Markdown, HTML, or PDF
- **Preview button** — Toggle live markdown preview

## Keyboard Shortcuts

- Press **Cmd/Ctrl + K** to open the floating command menu
- Press **Tab** to insert 2-space indentation in the editor
- Click the icons on the left sidebar for menu, preview, copy, and export

## Tech Stack

- Svelte 5
- Tailwind CSS
- Vite

## File Structure

```
src/
├── lib/
│   ├── Editor.svelte        # Main editor component
│   ├── FloatingPanel.svelte # Command menu panel
│   └── markdownUtils.js     # Markdown parser & utilities
├── App.svelte
├── app.css                  # Global styles
└── main.js                  # App entry point
```

## Build

```bash
npm run build
```

Output is in the `dist/` directory.

## License

MIT
