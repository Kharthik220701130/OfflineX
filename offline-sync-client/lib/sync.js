import { getAllNotes, updateNote } from './db';

const BACKEND_URL = 'http://localhost:8080';
const LAST_SYNC_KEY = 'lastSync';

/**
 * PUSH  — Send every pending/unsynced message to the server.
 *         Status flow: pending → sent → synced
 */
async function push() {
  const allNotes = await getAllNotes();
  const unsynced = allNotes.filter((n) => !n.synced);
  let anyFailed = false;

  for (const note of unsynced) {
    try {
      const res = await fetch(`${BACKEND_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      // Mark as synced in local DB
      await updateNote({ ...note, synced: true, status: 'synced' });
    } catch (err) {
      // Keep synced=false and status=pending so we retry next time
      console.error(`Failed to push message ${note.id}:`, err);
      anyFailed = true;
    }
  }

  if (anyFailed) throw new Error('One or more messages failed to sync');
}

/**
 * PULL  — Fetch messages updated after lastSync from the server.
 *         Apply conflict resolution: latest updatedAt wins.
 */
async function pull() {
  const lastSync = localStorage.getItem(LAST_SYNC_KEY) || 0;

  const res = await fetch(`${BACKEND_URL}/notes?lastSync=${lastSync}`);
  if (!res.ok) throw new Error(`Server responded ${res.status}`);

  const serverNotes = await res.json();
  const localNotes = await getAllNotes();
  const localMap = Object.fromEntries(localNotes.map((n) => [n.id, n]));

  for (const serverNote of serverNotes) {
    const local = localMap[serverNote.id];

    if (!local) {
      // New message from server — save locally, mark synced
      await updateNote({ ...serverNote, synced: true, status: 'synced' });
    } else if (serverNote.updatedAt > local.updatedAt) {
      // Server version is newer — overwrite local, mark synced
      await updateNote({ ...serverNote, synced: true, status: 'synced' });
    }
    // If local is newer, push() already handled it above
  }
}

/**
 * runSync — Guard with navigator.onLine, then push → pull → update timestamp.
 * Throws if offline so the UI can show the correct status.
 */
export async function runSync() {
  if (!navigator.onLine) {
    throw new Error('OFFLINE');
  }
  await push();
  await pull();
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
}
