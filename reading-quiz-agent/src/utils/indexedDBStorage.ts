import { openDB } from 'idb';

const DB_NAME = 'EngReadingAgentDB';
const DB_VERSION = 1;
export const STORE_ANALYSIS = 'passage_analysis';
export const STORE_LESSONS = 'lessons_history';

let dbPromise: ReturnType<typeof openDB> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_ANALYSIS)) {
          db.createObjectStore(STORE_ANALYSIS);
        }
        if (!db.objectStoreNames.contains(STORE_LESSONS)) {
          db.createObjectStore(STORE_LESSONS);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Save large data objects to IndexedDB (virtually unlimited GB storage capacity)
 */
export async function saveToIndexedDB(storeName: string, key: string, value: any): Promise<boolean> {
  try {
    const db = await getDB();
    await db.put(storeName, value, key);
    return true;
  } catch (err) {
    console.error(`[IndexedDB] Failed to save key "${key}":`, err);
    return false;
  }
}

/**
 * Load data objects from IndexedDB
 */
export async function loadFromIndexedDB<T = any>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const result = await db.get(storeName, key);
    return result || null;
  } catch (err) {
    console.error(`[IndexedDB] Failed to load key "${key}":`, err);
    return null;
  }
}

/**
 * Remove an item from IndexedDB
 */
export async function removeFromIndexedDB(storeName: string, key: string): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete(storeName, key);
    return true;
  } catch (err) {
    console.error(`[IndexedDB] Failed to delete key "${key}":`, err);
    return false;
  }
}
