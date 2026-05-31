import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { Lesson } from './types';

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

// Initialize Firebase dynamically
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

/**
 * Saves an expression Lesson object directly to Firebase Firestore
 * @param lesson The Lesson to save
 * @returns The unique document ID created for this lesson
 */
export async function saveLessonToCloud(lesson: Lesson): Promise<string> {
  try {
    const docId = `expression-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const lessonRef = doc(collection(db, 'expression_lessons'), docId);
    
    // Save the entire lesson metadata to Firestore
    await setDoc(lessonRef, {
      ...lesson,
      id: docId,
      createdAt: Date.now()
    });
    
    return docId;
  } catch (error: any) {
    console.error("Firebase save failed:", error);
    throw new Error(`클라우드 저장 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Loads an expression Lesson from Firestore by its Document ID
 * @param docId The Firestore document ID to retrieve
 * @returns The Lesson object or null if not found
 */
export async function loadLessonFromCloud(docId: string): Promise<Lesson | null> {
  try {
    const lessonRef = doc(db, 'expression_lessons', docId);
    const docSnap = await getDoc(lessonRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as Lesson;
    }
    
    return null;
  } catch (error: any) {
    console.error("Firebase load failed:", error);
    throw new Error(`클라우드 퀴즈 불러오기 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}
