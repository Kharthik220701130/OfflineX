# OfflineX — Frontend (Next.js)

Offline-first messaging UI built with Next.js and IndexedDB.

## Structure

```
app/
  layout.tsx      — root layout, metadata
  page.tsx        — renders <Chat />
components/
  Notes.js        — WhatsApp-style chat UI, sync controls
lib/
  db.js           — IndexedDB helpers (addNote, getAllNotes, updateNote)
  sync.js         — Sync engine (push → pull → timestamp)
```

## Run

```bash
npm install
npm run dev
# → http://localhost:3000
```

Requires the Spring Boot backend running on `http://localhost:8080`.

See the [root README](../README.md) for full documentation.
