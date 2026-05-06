# aiom

Chrome extension (Manifest V3) that puts an AI chat in the browser side panel and adds context-menu actions for selected text.

## Workflow

- **Commit per feature.** After each new feature/fix lands and works, make a git commit with a short imperative message (e.g. `add reply context to chat input`). Don't batch unrelated features into one commit. **This is a standing instruction — you do not need to ask first.**
- **Build & verify after a pack of features.** Once a logical group of features is done, run `yarn build` and then ask me to test in the browser before moving on. Do not claim a feature is done before the build passes.
- Don't run the dev server yourself — `yarn dev` is for me.
- Don't push, force-push, amend, or do anything destructive without an explicit ask. Local commits only.

## Stack

- React 19 + TypeScript, Vite 8 build, Tailwind v4 (via `@tailwindcss/vite`)
- Two entry points: `src/popup/` (side panel chat) and `src/settings/` (options page)
- Background service worker: `public/background.js` — context-menu handlers, side-panel open
- Chrome `storage.local` for all persistence (settings, chats, pending messages)

## Project layout

```
src/
  popup/Popup.tsx        — main chat UI (side panel)
  settings/Settings.tsx  — options page
  components/            — shared (Markdown, PasswordInput)
  lib/storage.ts         — chrome.storage wrappers + defaults
  lib/providers.ts       — OpenAI/Anthropic streaming clients
  types.ts               — Provider, Settings, Chat, ChatMessage
public/
  manifest.json          — MV3 manifest
  background.js          — service worker
```

## Conventions

- Keep popup and settings styled consistently — neutral zinc palette, rounded-full pill buttons (`bg-zinc-900 dark:bg-zinc-100`), no bright accent colors.
- Provider/model selectors live in the **popup header**, not in settings.
- When changing settings from the popup, write through `saveSettings` immediately — no separate save step.
- `chrome.storage.local` is the source of truth. UI state mirrors it; always persist before relying on it across reloads.
- New chat messages should auto-scroll to bottom; **streamed chunks should not** — only scroll when the user sends or message count grows.
- Streaming lives in `src/lib/providers.ts:readSSEStream`. Both providers share the same SSE shape.

## Build

- `yarn build` — production build to `dist/` (this is what loads as the unpacked extension)
- `yarn dev` — watch mode rebuild (don't run this yourself)

## Testing the extension

After `yarn build`, I reload the unpacked extension from `dist/` in `chrome://extensions`. Ask me to do this once a pack of features is ready — there's no automated test suite.
