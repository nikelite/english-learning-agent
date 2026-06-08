import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc
} from 'firebase/firestore';
import type { MochiDeck } from './types';

// Embedded Firebase Configuration for User's english-agent project
const firebaseConfig = {
  apiKey: "AIzaSyDsh7-s_dqkBRT6lOgOz6hh6C5zOjKgquc",
  authDomain: "english-agent-4e447.firebaseapp.com",
  projectId: "english-agent-4e447",
  storageBucket: "english-agent-4e447.firebasestorage.app",
  messagingSenderId: "282724492980",
  appId: "1:282724492980:web:2a80ce9c880ba26e8899e1",
  measurementId: "G-JRZ6YNNSPD"
};

// Initialize Firebase dynamically to prevent duplicate initialization during HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

/**
 * Saves a MochiDeck directly to Firebase Firestore with optional Owner ID
 */
export async function saveDeckToCloud(deck: MochiDeck, userId?: string | null): Promise<string> {
  try {
    const docId = deck.id.length > 5
      ? deck.id 
      : `deck-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const deckRef = doc(collection(db, 'mochi_decks'), docId);
    
    const docData: any = {
      ...deck,
      id: docId,
      createdAt: deck.createdAt || Date.now()
    };
    
    if (userId) {
      docData.ownerId = userId;
    }
    
    await setDoc(deckRef, docData);
    return docId;
  } catch (error: any) {
    console.error("Firebase save deck failed:", error);
    throw new Error(`클라우드 저장 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Loads decks from Cloud Firestore for a specific user
 */
export async function loadDecksFromCloud(userId: string): Promise<MochiDeck[]> {
  try {
    const q = query(collection(db, 'mochi_decks'), where('ownerId', '==', userId.trim()));
    const querySnap = await getDocs(q);
    const decks: MochiDeck[] = [];
    querySnap.forEach((docSnap) => {
      decks.push(docSnap.data() as MochiDeck);
    });
    return decks.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error: any) {
    console.error("Firebase load decks failed:", error);
    throw new Error(`클라우드 덱 불러오기 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Deletes a deck from Cloud Firestore
 */
export async function deleteDeckFromCloud(deckId: string): Promise<void> {
  try {
    const deckRef = doc(db, 'mochi_decks', deckId);
    await deleteDoc(deckRef);
  } catch (error: any) {
    console.error("Firebase delete deck failed:", error);
    throw new Error(`클라우드 덱 삭제 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Bidirectionally synchronizes local storage decks with Cloud Firestore decks
 */
export async function syncUserDecks(userId: string, localDecks: MochiDeck[]): Promise<MochiDeck[]> {
  try {
    const cloudDecks = await loadDecksFromCloud(userId);
    const cloudDecksMap = new Map<string, MochiDeck>();
    cloudDecks.forEach((deck) => {
      cloudDecksMap.set(deck.id, deck);
    });
    
    const syncedDecks: MochiDeck[] = [];
    
    for (const localDeck of localDecks) {
      const inCloud = cloudDecksMap.get(localDeck.id);
      if (inCloud) {
        // If in cloud, prefer cloud copy or the one with export status
        if (!inCloud.isExported && localDeck.isExported) {
          // Local is more up to date (exported), save local to cloud
          await saveDeckToCloud(localDeck, userId);
          syncedDecks.push(localDeck);
        } else {
          syncedDecks.push(inCloud);
        }
        cloudDecksMap.delete(localDeck.id);
      } else {
        // Upload local offline deck to cloud
        try {
          const uploadedId = await saveDeckToCloud(localDeck, userId);
          const uploadedDeck = {
            ...localDeck,
            id: uploadedId,
            ownerId: userId
          };
          syncedDecks.push(uploadedDeck);
        } catch (err) {
          console.warn("Failed to upload local offline deck during sync:", err);
          syncedDecks.push(localDeck);
        }
      }
    }
    
    // Decks in cloud but not local
    cloudDecksMap.forEach((cloudDeck) => {
      syncedDecks.push(cloudDeck);
    });
    
    return syncedDecks.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error: any) {
    console.error("Firebase sync decks failed:", error);
    throw new Error(`클라우드 덱 동기화 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}
