# Zelo app (canvas)

The product map: every version of a product as one connected tree.

- **Versions** in the sidebar: click one to see its tree (release → features → tickets, plus a bugs lane).
- **People**: click someone to see their tree inside the selected version.
- **All versions**: modules as lanes, releases on a timeline, features linked to the versions they build on.
- **Details panel**: status, assignee, spec, comments with @mentions and file uploads, and an automatic dated activity log.
- **Ask Zelo**: a copilot docked on the right (⌘K). Demo answers come from the board data in the browser.
- **Notifications**: assigned to you, mentioned, or comments on your tasks.

Demo data lives in the browser (localStorage, files in IndexedDB) behind `src/lib/store.tsx`, ready to swap for a real API.

```bash
npm install
npm run dev -- -p 3200
```
