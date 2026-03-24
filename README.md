# OfflineX — Offline-First Messaging System

> **Send messages without internet. Sync when you're back online.**
> Built with Next.js · Spring Boot · IndexedDB · Custom Sync Engine

---

## The Problem

Most messaging and productivity apps **break without internet**. They either:
- Block you from sending anything, or
- Silently lose your data when the connection drops

This is a solved problem — but most tutorials never show you how.

---

## The Solution

**OfflineX** is an offline-first messaging system that:

1. **Stores everything locally** in IndexedDB — instantly, even with no internet
2. **Queues outgoing messages** with a `pending` status
3. **Syncs automatically** the moment you come back online
4. **Resolves conflicts** using a `updatedAt` timestamp strategy (latest wins)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Next.js)                    │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  Chat UI     │───▶│  IndexedDB   │  (always works)  │
│  │ (Notes.js)   │    │  (lib/db.js) │                  │
│  └──────────────┘    └──────────────┘                  │
│         │                    │                          │
│         │            ┌───────────────┐                  │
│         └───────────▶│  Sync Engine  │                  │
│                       │ (lib/sync.js) │                  │
│                       └───────┬───────┘                  │
└───────────────────────────────┼─────────────────────────┘
                                │  HTTP (when online)
                                ▼
┌─────────────────────────────────────────────────────────┐
│                  Spring Boot Backend                    │
│                                                         │
│   POST /notes  ──▶  Upsert (latest updatedAt wins)     │
│   GET  /notes?lastSync=ts  ──▶  Delta since timestamp  │
└─────────────────────────────────────────────────────────┘
```

---

## Message Status Flow

```
User types & sends
        │
        ▼
  ┌───────────┐       No internet?
  │  pending  │ ──────────────────▶ stays pending ⏳
  └───────────┘                     (retries on next sync)
        │
        │  Sync runs (online)
        ▼
  ┌───────────┐
  │   synced  │ ──────────────────▶ double tick ✔✔
  └───────────┘
```

| Status | Indicator | Meaning |
|--------|-----------|---------|
| `pending` | ⏳ | Saved locally, not sent to server |
| `sent` | ✔ | Received by server |
| `synced` | ✔✔ (blue) | Confirmed synced both ways |

---

## Features

| Feature | Detail |
|---------|--------|
| 📦 **Offline Storage** | IndexedDB via `idb` — persists across refreshes |
| 🔄 **Push Sync** | Sends all `pending` messages to server on sync |
| 📥 **Pull Sync** | Fetches new/updated messages from server |
| ⚖️ **Conflict Resolution** | Latest `updatedAt` timestamp always wins |
| 🕐 **Delta Sync** | `GET /notes?lastSync=<ts>` — only fetches what changed |
| 🌐 **Online Detection** | `navigator.onLine` + `online`/`offline` events |
| 🔒 **Sync Guard** | Sync button disabled + 🔴 banner when offline |
| 🔁 **Auto Retry** | Re-syncs automatically when internet returns |
| 💬 **Chat UI** | WhatsApp-style bubbles, right-aligned, full-height |

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **IndexedDB** via [`idb`](https://github.com/jakearchibald/idb)
- **`uuid`** for unique message IDs
- Pure inline styles (no CSS framework dependency for core logic)

### Backend
- **Spring Boot 3.5** (Java 21)
- **Spring Web** — REST APIs
- **Lombok** — boilerplate reduction
- **In-memory storage** (`ArrayList`) — intentionally simple, swap for DB easily

---

## Project Structure

```
OfflineX/
├── offline-sync-client/          # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx              # Entry — renders <Chat />
│   ├── components/
│   │   └── Notes.js              # Chat UI component
│   └── lib/
│       ├── db.js                 # IndexedDB CRUD (addNote, getAllNotes, updateNote)
│       └── sync.js               # Sync engine (push, pull, runSync)
│
└── notes-backend/                # Spring Boot backend
    └── src/main/java/com/offlinex/notesbackend/
        ├── NotesBackendApplication.java
        ├── controller/
        │   └── NotesController.java   # POST /notes, GET /notes
        └── model/
            └── Note.java              # id, content, updatedAt, status
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Java 21+

### 1. Start the Backend

```bash
cd notes-backend
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

### 2. Start the Frontend

```bash
cd offline-sync-client
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## API Reference

### `POST /notes`
Add or update a message. Conflict resolution: incoming wins only if `updatedAt` is newer.

```json
{
  "id": "uuid",
  "content": "Hello world",
  "updatedAt": 1711234567890,
  "status": "pending"
}
```

### `GET /notes?lastSync=<timestamp>`
Returns all messages with `updatedAt > lastSync`. Pass `0` to get everything.

```json
[
  { "id": "uuid", "content": "Hello world", "updatedAt": 1711234567890, "status": "synced" }
]
```

---

## Test Scenarios

### ✅ Test 1 — Offline messaging
1. Turn off your internet (or use DevTools → Network → Offline)
2. Type and send messages → they appear instantly with ⏳
3. Turn internet back on
4. Click **⚡ Sync** or wait for auto-sync
5. Messages show ✔✔ (blue)

### ✅ Test 2 — Pull from server
1. `POST` a message directly via Postman/curl to `http://localhost:8080/notes`
2. Click **⚡ Sync** in the UI
3. Message appears in the chat

### ✅ Test 3 — Conflict resolution
1. Edit the same message ID on both the server and locally with different `updatedAt` values
2. Sync → the version with the higher `updatedAt` wins

---

## Core Sync Logic (simplified)

```js
// lib/sync.js

export async function runSync() {
  if (!navigator.onLine) throw new Error('OFFLINE');  // guard

  // PUSH — local → server
  const unsyncedMsgs = (await getAllNotes()).filter(n => !n.synced);
  for (const msg of unsyncedMsgs) {
    await fetch('POST /notes', msg);
    await updateNote({ ...msg, synced: true, status: 'synced' });
  }

  // PULL — server → local (delta)
  const lastSync = localStorage.getItem('lastSync') || 0;
  const serverMsgs = await fetch(`GET /notes?lastSync=${lastSync}`);
  for (const msg of serverMsgs) {
    const local = localMap[msg.id];
    if (!local || msg.updatedAt > local.updatedAt) {
      await updateNote({ ...msg, synced: true, status: 'synced' });
    }
  }

  localStorage.setItem('lastSync', Date.now());
}
```

---

## Why This Matters

This project demonstrates:

- **Offline-first architecture** — the hardest part of building resilient apps
- **Sync engine design** — push/pull with delta timestamps
- **Conflict resolution** — a fundamental distributed systems concept
- **Real-world UI patterns** — WhatsApp-style status indicators people actually understand

---

*Built as a full-stack demonstration of offline-first principles.*
