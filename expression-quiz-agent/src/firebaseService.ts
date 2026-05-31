import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  deleteDoc 
} from 'firebase/firestore';
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
 * Saves an expression Lesson object directly to Firebase Firestore with optional Owner ID
 * @param lesson The Lesson to save
 * @param userId The User ID of the creator (optional)
 * @returns The unique document ID created for this lesson
 */
export async function saveLessonToCloud(lesson: Lesson, userId?: string | null): Promise<string> {
  try {
    const docId = lesson.id && !lesson.id.startsWith('preset-') && !lesson.id.startsWith('wrong-') && lesson.id.length > 5
      ? lesson.id 
      : `expression-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const lessonRef = doc(collection(db, 'expression_lessons'), docId);
    
    const docData: any = {
      ...lesson,
      id: docId,
      createdAt: lesson.createdAt || Date.now()
    };
    
    if (userId) {
      docData.ownerId = userId;
    }
    if (!docData.sharedWith) {
      docData.sharedWith = [];
    }
    
    await setDoc(lessonRef, docData);
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

/**
 * Shares an expression lesson with another user ID directly
 * @param docId The document ID
 * @param recipientUserId The target user's ID
 */
export async function shareLessonWithUser(docId: string, recipientUserId: string): Promise<void> {
  try {
    const lessonRef = doc(db, 'expression_lessons', docId);
    await updateDoc(lessonRef, {
      sharedWith: arrayUnion(recipientUserId)
    });
  } catch (error: any) {
    console.error("Firebase direct share failed:", error);
    throw new Error(`특정 사용자 공유 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Removes association between user and expression lesson in the cloud
 * @param docId The document ID
 * @param userId The User ID requesting removal
 */
export async function removeLessonAssociation(docId: string, userId: string): Promise<void> {
  try {
    const lessonRef = doc(db, 'expression_lessons', docId);
    const docSnap = await getDoc(lessonRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const ownerId = data.ownerId;
      const sharedWith = data.sharedWith || [];
      
      if (ownerId === userId) {
        if (sharedWith.length === 0) {
          await deleteDoc(lessonRef);
        } else {
          await updateDoc(lessonRef, {
            ownerId: null
          });
        }
      } else if (sharedWith.includes(userId)) {
        await updateDoc(lessonRef, {
          sharedWith: arrayRemove(userId)
        });
      }
    }
  } catch (error: any) {
    console.error("Firebase association removal failed:", error);
    throw new Error(`클라우드 삭제 반영 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Bidirectionally synchronizes local storage history with cloud Firestore expression lessons
 * @param userId The User ID to sync
 * @param localLessons The array of local lessons currently in history
 */
export async function syncUserLessons(userId: string, localLessons: Lesson[]): Promise<Lesson[]> {
  try {
    // 1. Query lessons owned by user
    const qOwner = query(collection(db, 'expression_lessons'), where('ownerId', '==', userId));
    const querySnapOwner = await getDocs(qOwner);
    const ownerLessons: Lesson[] = [];
    querySnapOwner.forEach((docSnap) => {
      ownerLessons.push(docSnap.data() as Lesson);
    });
    
    // 2. Query lessons shared with user
    const qShared = query(collection(db, 'expression_lessons'), where('sharedWith', 'array-contains', userId));
    const querySnapShared = await getDocs(qShared);
    const sharedLessons: Lesson[] = [];
    querySnapShared.forEach((docSnap) => {
      sharedLessons.push(docSnap.data() as Lesson);
    });
    
    // Merge cloud lists
    const cloudLessonsMap = new Map<string, Lesson>();
    [...ownerLessons, ...sharedLessons].forEach((lesson) => {
      cloudLessonsMap.set(lesson.id, lesson);
    });
    
    const syncedLessons: Lesson[] = [];
    
    // 3. Merge local lessons. If offline local lesson is not in cloud, upload it.
    for (const localLesson of localLessons) {
      if (localLesson.id.startsWith('preset-')) continue;
      
      const inCloud = cloudLessonsMap.get(localLesson.id);
      if (inCloud) {
        syncedLessons.push(inCloud);
        cloudLessonsMap.delete(localLesson.id);
      } else {
        // Offline custom lesson: upload to cloud under this user
        try {
          const uploadedId = await saveLessonToCloud(localLesson, userId);
          const uploadedLesson = {
            ...localLesson,
            id: uploadedId,
            ownerId: userId,
            sharedWith: localLesson.sharedWith || []
          };
          syncedLessons.push(uploadedLesson);
        } catch (err) {
          console.warn("Failed to upload local offline lesson during sync:", err);
          syncedLessons.push(localLesson); // Preserve locally
        }
      }
    }
    
    // 4. Append cloud-only lessons that weren't in local storage
    cloudLessonsMap.forEach((cloudLesson) => {
      syncedLessons.push(cloudLesson);
    });
    
    // Sort by creation date descending
    return syncedLessons.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error: any) {
    console.error("Firebase sync failed:", error);
    throw new Error(`클라우드 동기화 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}
