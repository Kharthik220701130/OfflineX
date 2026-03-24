import { openDB } from 'idb';

const DB_NAME = 'notesDB';
const STORE_NAME = 'notes';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

export const addNote = async (note) => {
  const db = await initDB();
  await db.put(STORE_NAME, note);
};

export const getAllNotes = async () => {
  const db = await initDB();
  return await db.getAll(STORE_NAME);
};

export const updateNote = async (note) => {
  const db = await initDB();
  await db.put(STORE_NAME, note);
};

export const deleteNote = async (id) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};