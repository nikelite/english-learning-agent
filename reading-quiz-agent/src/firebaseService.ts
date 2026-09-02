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
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { ReadingLesson, AppStats, WrongReadingAnswer, SentenceAnalysis, WritingEvaluationResult } from './types';

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
 * Deeply strips undefined values from an object to prevent Firestore "Unsupported field value: undefined" errors
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Saves a ReadingLesson object directly to Firebase Firestore with optional Owner ID
 */
export async function saveLessonToCloud(lesson: ReadingLesson, userId?: string | null): Promise<string> {
  try {
    const docId = lesson.id && !lesson.id.startsWith('preset-') && !lesson.id.startsWith('wrong-') && lesson.id.length > 5
      ? lesson.id 
      : `reading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const lessonRef = doc(collection(db, 'lessons'), docId);
    
    const docData: any = {
      ...lesson,
      id: docId,
      createdAt: lesson.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    if (userId) {
      const normalizedUid = userId.trim().toLowerCase();
      if (!docData.ownerId || docData.ownerId === 'guest') {
        docData.ownerId = normalizedUid;
      }
    }
    if (!docData.sharedWith) {
      docData.sharedWith = [];
    }
    
    const sanitized = sanitizeForFirestore(docData);
    await setDoc(lessonRef, sanitized);
    return docId;
  } catch (error: any) {
    console.error("Firebase save failed:", error);
    throw new Error(`클라우드 저장 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Loads a ReadingLesson from Firestore by its Document ID
 */
export async function loadLessonFromCloud(docId: string): Promise<ReadingLesson | null> {
  try {
    const lessonRef = doc(db, 'lessons', docId);
    const docSnap = await getDoc(lessonRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as ReadingLesson;
    }
    
    return null;
  } catch (error: any) {
    console.error("Firebase load failed:", error);
    throw new Error(`클라우드 퀴즈 불러오기 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Shares a lesson with another user ID directly (supporting casing variations)
 */
export async function shareLessonWithUser(docId: string, recipientUserId: string): Promise<void> {
  try {
    const lessonRef = doc(db, 'lessons', docId);
    const variations = getCasingVariations(recipientUserId);
    await updateDoc(lessonRef, {
      sharedWith: arrayUnion(...variations)
    });
  } catch (error: any) {
    console.error("Firebase direct share failed:", error);
    throw new Error(`특정 사용자 공유 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Removes association between user and lesson in the cloud
 */
export async function removeLessonAssociation(docId: string, userId: string): Promise<void> {
  try {
    const normalizedUid = userId.trim().toLowerCase();
    const variations = getCasingVariations(userId);
    const lessonRef = doc(db, 'lessons', docId);
    const docSnap = await getDoc(lessonRef);
    
    // 1. Record deletion tombstone in reading_deleted_lessons to prevent stale devices from resurrecting it
    try {
      const delDocRef = doc(db, 'reading_deleted_lessons', `${docId}_${normalizedUid}`);
      await setDoc(delDocRef, {
        lessonId: docId,
        userId: normalizedUid,
        deletedAt: Date.now()
      });
    } catch (delErr) {
      console.warn("Failed to record deleted lesson tombstone:", delErr);
    }

    if (docSnap.exists()) {
      const data = docSnap.data();
      const ownerId = (data.ownerId || '').trim().toLowerCase();
      
      if (!ownerId || ownerId === normalizedUid || ownerId === 'guest') {
        // Owner deleted -> Delete document completely from Firestore!
        await deleteDoc(lessonRef);
        // Also delete associated passage analysis if exists
        try {
          await deleteDoc(doc(db, 'passage_analyses', docId));
        } catch (e) {}
      } else {
        // Shared recipient deleted -> remove user from sharedWith
        await updateDoc(lessonRef, {
          sharedWith: arrayRemove(...variations)
        });
      }
    }
  } catch (error: any) {
    console.error("Firebase association removal failed:", error);
    throw new Error(`클라우드 삭제 반영 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Saves student progress and personal preferences (such as isArchived) on a lesson separately per user
 */
export async function saveSharedLessonProgress(
  lessonId: string, 
  userId: string, 
  progress: {
    userAnswers?: Record<string, number>;
    solvedAt?: number;
    firstAttemptScore?: { score: number; total: number };
    retryHistory?: any[];
    isArchived?: boolean;
  }
): Promise<void> {
  try {
    const normalizedUid = userId.trim().toLowerCase();
    const statsRef = doc(db, 'user_stats', normalizedUid);
    const sanitizedProgress = sanitizeForFirestore({
      ...progress,
      updatedAt: Date.now()
    });
    await setDoc(statsRef, {
      readingProgress: {
        [lessonId]: sanitizedProgress
      }
    }, { merge: true });
  } catch (error: any) {
    console.error("Failed to save user lesson progress:", error);
  }
}

/**
 * Generates unique casing variations for case-insensitive Firestore lookups
 */
export function getCasingVariations(userId: string): string[] {
  const trimmed = userId.trim();
  const variations = [
    trimmed,
    trimmed.toLowerCase(),
    trimmed.toUpperCase(),
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  ];
  return Array.from(new Set(variations)).filter(Boolean);
}

/**
 * Loads all lesson progress and personal preferences for a given user from user_stats
 */
export async function loadSharedLessonsProgress(
  userId: string
): Promise<Record<string, {
  userAnswers?: Record<string, number>;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: any[];
  isArchived?: boolean;
}>> {
  try {
    const normalizedUid = userId.trim().toLowerCase();
    const statsRef = doc(db, 'user_stats', normalizedUid);
    const docSnap = await getDoc(statsRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return (data.readingProgress || {}) as Record<string, any>;
    }
    return {};
  } catch (error: any) {
    console.error("Failed to load shared lessons progress:", error);
    return {};
  }
}

function isLessonSolved(lesson: ReadingLesson): boolean {
  if (lesson.firstAttemptScore !== undefined) return true;
  if (lesson.userAnswers && typeof lesson.userAnswers === 'object' && Object.keys(lesson.userAnswers).length > 0) return true;
  return false;
}

function mergeLessons(local: ReadingLesson, cloud: ReadingLesson): { merged: ReadingLesson, needsUpload: boolean } {
  const localSolved = isLessonSolved(local);
  const cloudSolved = isLessonSolved(cloud);
  const localSolvedTime = local.solvedAt || 0;
  const cloudSolvedTime = cloud.solvedAt || 0;
  const localUpdated = local.updatedAt || localSolvedTime || local.createdAt || 0;
  const cloudUpdated = cloud.updatedAt || cloudSolvedTime || cloud.createdAt || 0;

  // 1. Determine Archive state (Local takes precedence if defined)
  const isArchived = (local.isArchived !== undefined) ? local.isArchived : (cloud.isArchived || false);

  // 2. Determine Pending vs Analyzed state (CRITICAL RULE: Analyzed versions ALWAYS take absolute precedence over pending drafts)
  const localIsAnalyzed = !local.isPending && ((local.quizzes && local.quizzes.length > 0) || (local.paragraphs && local.paragraphs.length > 0));
  const cloudIsAnalyzed = !cloud.isPending && ((cloud.quizzes && cloud.quizzes.length > 0) || (cloud.paragraphs && cloud.paragraphs.length > 0));

  let isPending = false;
  let paragraphs = cloud.paragraphs;
  let vocabulary = cloud.vocabulary;
  let quizzes = cloud.quizzes;
  let needsUpload = false;

  if (cloudIsAnalyzed && !localIsAnalyzed) {
    // Cloud is fully analyzed, Local was just a pending draft -> Adopt analyzed Cloud data!
    isPending = false;
    paragraphs = cloud.paragraphs;
    vocabulary = cloud.vocabulary;
    quizzes = cloud.quizzes;
  } else if (localIsAnalyzed && !cloudIsAnalyzed) {
    // Local is analyzed, Cloud was pending -> Adopt Local analysis and upload to Cloud!
    isPending = false;
    paragraphs = local.paragraphs;
    vocabulary = local.vocabulary;
    quizzes = local.quizzes;
    needsUpload = true;
  } else if (!localIsAnalyzed && !cloudIsAnalyzed) {
    // Both are pending drafts
    isPending = true;
    paragraphs = (cloudUpdated > localUpdated) ? (cloud.paragraphs || local.paragraphs) : (local.paragraphs || cloud.paragraphs);
    vocabulary = (cloudUpdated > localUpdated) ? (cloud.vocabulary || local.vocabulary) : (local.vocabulary || cloud.vocabulary);
    quizzes = (cloudUpdated > localUpdated) ? (cloud.quizzes || local.quizzes) : (local.quizzes || cloud.quizzes);
  } else {
    // Both are analyzed -> Pick newer content
    isPending = false;
    if (cloudUpdated > localUpdated) {
      paragraphs = cloud.paragraphs || local.paragraphs;
      vocabulary = cloud.vocabulary || local.vocabulary;
      quizzes = (cloud.quizzes && cloud.quizzes.length > 0) ? cloud.quizzes : local.quizzes;
    } else {
      paragraphs = local.paragraphs || cloud.paragraphs;
      vocabulary = local.vocabulary || cloud.vocabulary;
      quizzes = (local.quizzes && local.quizzes.length > 0) ? local.quizzes : cloud.quizzes;
    }
  }

  // 3. Determine Solved Progress state (userAnswers, solvedAt, firstAttemptScore, retryHistory)
  let userAnswers = cloud.userAnswers;
  let solvedAt = cloud.solvedAt;
  let firstAttemptScore = cloud.firstAttemptScore;
  let retryHistory = cloud.retryHistory;

  if (localSolved && !cloudSolved) {
    // Local is solved, Cloud is not -> Use local progress & backfill Cloud!
    userAnswers = local.userAnswers;
    solvedAt = local.solvedAt;
    firstAttemptScore = local.firstAttemptScore;
    retryHistory = local.retryHistory;
    needsUpload = true;
  } else if (localSolved && cloudSolved) {
    // Both are solved -> Pick whichever solved most recently, keeping best score records
    if (localSolvedTime >= cloudSolvedTime) {
      userAnswers = local.userAnswers;
      solvedAt = local.solvedAt;
      firstAttemptScore = local.firstAttemptScore || cloud.firstAttemptScore;
      retryHistory = local.retryHistory || cloud.retryHistory;
      if (localSolvedTime > cloudSolvedTime) needsUpload = true;
    } else {
      userAnswers = cloud.userAnswers;
      solvedAt = cloud.solvedAt;
      firstAttemptScore = cloud.firstAttemptScore || local.firstAttemptScore;
      retryHistory = cloud.retryHistory || local.retryHistory;
    }
  } else if (!localSolved && !cloudSolved) {
    userAnswers = undefined;
    solvedAt = undefined;
    firstAttemptScore = undefined;
    retryHistory = undefined;
  }

  // Combine base fields (preferring newer content/edits)
  const base = (cloudUpdated > localUpdated) ? { ...local, ...cloud } : { ...cloud, ...local };

  const merged: ReadingLesson = {
    ...base,
    isPending,
    paragraphs,
    vocabulary,
    quizzes,
    isArchived,
    userAnswers,
    solvedAt,
    firstAttemptScore,
    retryHistory,
    updatedAt: Math.max(localUpdated, cloudUpdated, localSolvedTime, cloudSolvedTime, Date.now())
  };

  if ((local.isArchived !== cloud.isArchived) || localUpdated > cloudUpdated) {
    needsUpload = true;
  }

  return { merged, needsUpload };
}

/**
 * Bidirectionally synchronizes local storage history with cloud Firestore lessons
 */
export async function syncUserLessons(userId: string, localLessons: ReadingLesson[]): Promise<ReadingLesson[]> {
  try {
    const variations = getCasingVariations(userId);
    const qOwner = query(collection(db, 'lessons'), where('ownerId', 'in', variations));
    const querySnapOwner = await getDocs(qOwner);
    const ownerLessons: ReadingLesson[] = [];
    querySnapOwner.forEach((docSnap) => {
      ownerLessons.push(docSnap.data() as ReadingLesson);
    });
    
    const qShared = query(collection(db, 'lessons'), where('sharedWith', 'array-contains-any', variations));
    const querySnapShared = await getDocs(qShared);
    const sharedLessons: ReadingLesson[] = [];
    querySnapShared.forEach((docSnap) => {
      sharedLessons.push(docSnap.data() as ReadingLesson);
    });
    
    // 3. Query shared lessons progress and user preferences for this student
    const progressMap = await loadSharedLessonsProgress(userId);

    // 4. Query deleted lesson tombstones to prevent resurrecting deleted lessons from stale local storage
    const deletedLessonIds = new Set<string>();
    try {
      const delQ = query(collection(db, 'reading_deleted_lessons'), where('userId', 'in', variations));
      const delSnap = await getDocs(delQ);
      delSnap.forEach(d => {
        const dData = d.data();
        if (dData.lessonId) deletedLessonIds.add(dData.lessonId);
      });
    } catch (e) {
      console.warn("Failed to load deleted tombstones during sync:", e);
    }
    
    // Merge cloud lists and inject student progress for owner & shared lessons
    const cloudLessonsMap = new Map<string, ReadingLesson>();
    ownerLessons.forEach((lesson) => {
      if (deletedLessonIds.has(lesson.id)) return;
      let mergedOwner = { ...lesson };
      const userProgress = progressMap[lesson.id];
      if (userProgress) {
        mergedOwner = {
          ...mergedOwner,
          userAnswers: userProgress.userAnswers,
          solvedAt: userProgress.solvedAt,
          firstAttemptScore: userProgress.firstAttemptScore,
          retryHistory: userProgress.retryHistory,
          isArchived: userProgress.isArchived !== undefined ? userProgress.isArchived : (lesson.isArchived || false)
        };
      }
      cloudLessonsMap.set(lesson.id, mergedOwner);
    });
    sharedLessons.forEach((lesson) => {
      if (deletedLessonIds.has(lesson.id)) return;
      let mergedShared = { ...lesson };
      const studentProgress = progressMap[lesson.id];
      if (studentProgress) {
        mergedShared = {
          ...mergedShared,
          userAnswers: studentProgress.userAnswers,
          solvedAt: studentProgress.solvedAt,
          firstAttemptScore: studentProgress.firstAttemptScore,
          retryHistory: studentProgress.retryHistory,
          isArchived: studentProgress.isArchived !== undefined ? studentProgress.isArchived : false
        };
      } else {
        // Shared recipient has not solved/archived -> Start fresh unsolved & unarchived for recipient!
        mergedShared = {
          ...mergedShared,
          userAnswers: undefined,
          solvedAt: undefined,
          firstAttemptScore: undefined,
          retryHistory: undefined,
          isArchived: false
        };
      }
      cloudLessonsMap.set(lesson.id, mergedShared);
    });
    
    const syncedLessons: ReadingLesson[] = [];
    
    for (const localLesson of localLessons) {
      if (localLesson.id.startsWith('preset-')) continue;
      
      // If deleted by user, skip completely and purge from local state!
      if (deletedLessonIds.has(localLesson.id)) continue;
      
      const inCloud = cloudLessonsMap.get(localLesson.id);
      if (inCloud) {
        const { merged, needsUpload } = mergeLessons(localLesson, inCloud);
        if (needsUpload) {
          try {
            await saveSharedLessonProgress(merged.id, userId, {
              userAnswers: merged.userAnswers,
              solvedAt: merged.solvedAt,
              firstAttemptScore: merged.firstAttemptScore,
              retryHistory: merged.retryHistory,
              isArchived: merged.isArchived
            });
            if (!merged.ownerId || merged.ownerId === userId) {
              await saveLessonToCloud(merged, userId);
            }
          } catch (err) {
            console.warn("Failed to upload merged lesson/progress during sync:", err);
          }
        }
        syncedLessons.push(merged);
        cloudLessonsMap.delete(localLesson.id);
      } else {
        try {
          await saveSharedLessonProgress(localLesson.id, userId, {
            userAnswers: localLesson.userAnswers,
            solvedAt: localLesson.solvedAt,
            firstAttemptScore: localLesson.firstAttemptScore,
            retryHistory: localLesson.retryHistory,
            isArchived: localLesson.isArchived
          });

          if (localLesson.ownerId && localLesson.ownerId !== userId) {
            await shareLessonWithUser(localLesson.id, userId);
            syncedLessons.push(localLesson);
          } else {
            const uploadedId = await saveLessonToCloud(localLesson, userId);
            const uploadedLesson = {
              ...localLesson,
              id: uploadedId,
              ownerId: userId,
              sharedWith: localLesson.sharedWith || []
            };
            syncedLessons.push(uploadedLesson);
          }
        } catch (err) {
          console.warn("Failed to upload local offline/shared association during sync:", err);
          syncedLessons.push(localLesson);
        }
      }
    }
    
    // 5. Add remaining cloud lessons (which exist in cloud but were not in local storage)
    cloudLessonsMap.forEach((cloudLesson) => {
      if (!deletedLessonIds.has(cloudLesson.id)) {
        syncedLessons.push(cloudLesson);
      }
    });
    
    // 6. Strict Deduplication Engine: Deduplicate by ID and Title to prevent count inflation
    const deduplicatedMap = new Map<string, ReadingLesson>();
    syncedLessons.forEach(lesson => {
      const existing = deduplicatedMap.get(lesson.id);
      if (!existing) {
        deduplicatedMap.set(lesson.id, lesson);
      } else {
        const { merged } = mergeLessons(existing, lesson);
        deduplicatedMap.set(lesson.id, merged);
      }
    });

    const finalSynced = Array.from(deduplicatedMap.values());
    return finalSynced.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error: any) {
    console.error("Firebase sync failed:", error);
    throw new Error(`클라우드 동기화 실패: ${error.message || "알 수 없는 오류가 발생했습니다."}`);
  }
}

/**
 * Saves overall lifetime application stats of a user to Cloud
 */
export async function saveStatsToCloud(userId: string, stats: AppStats): Promise<void> {
  try {
    const statsRef = doc(db, 'user_stats', userId);
    await setDoc(statsRef, stats);
  } catch (error: any) {
    console.error("Firebase save stats failed:", error);
  }
}

/**
 * Loads overall lifetime application stats of a user from Cloud
 */
export async function loadStatsFromCloud(userId: string): Promise<AppStats | null> {
  try {
    const statsRef = doc(db, 'user_stats', userId);
    const docSnap = await getDoc(statsRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppStats;
    }
    return null;
  } catch (error: any) {
    console.error("Firebase load stats failed:", error);
    return null;
  }
}

/**
 * Saves the entire wrong answers array of a user to a single Cloud document (efficient!) along with updatedAt timestamp
 */
export async function saveWrongAnswersToCloud(userId: string, wrongAnswers: WrongReadingAnswer[], updatedAt?: number): Promise<void> {
  try {
    const wrongAnswersRef = doc(db, 'wrong_answers', userId);
    await setDoc(wrongAnswersRef, { 
      list: wrongAnswers,
      updatedAt: updatedAt || Date.now()
    });
  } catch (error: any) {
    console.error("Firebase save wrong answers failed:", error);
  }
}

/**
 * Loads the wrong answers array of a user from Cloud along with its updatedAt timestamp
 */
export async function loadWrongAnswersFromCloud(userId: string): Promise<{ list: WrongReadingAnswer[], updatedAt: number } | null> {
  try {
    const wrongAnswersRef = doc(db, 'wrong_answers', userId);
    const docSnap = await getDoc(wrongAnswersRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        list: (data.list || []) as WrongReadingAnswer[],
        updatedAt: data.updatedAt || 0
      };
    }
    return null;
  } catch (error: any) {
    console.error("Firebase load wrong answers failed:", error);
    return null;
  }
}

/**
 * Saves preset lessons progress array to Firestore
 */
export async function savePresetsProgressToCloud(userId: string, progress: any): Promise<void> {
  try {
    const ref = doc(db, 'reading_presets_progress', userId);
    await setDoc(ref, { progress });
  } catch (error: any) {
    console.error("Firebase save presets progress failed:", error);
  }
}

/**
 * Loads preset lessons progress array from Firestore
 */
export async function loadPresetsProgressFromCloud(userId: string): Promise<any | null> {
  try {
    const ref = doc(db, 'reading_presets_progress', userId);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.progress || null;
    }
    return null;
  } catch (error: any) {
    console.error("Firebase load presets progress failed:", error);
    return null;
  }
}

/**
 * Logs a detailed quiz attempt score sheet to the cloud database
 */
export async function logQuizAttempt(
  userId: string,
  lessonId: string,
  lessonTitle: string,
  correctCount: number,
  totalCount: number,
  wrongQuestionsList: any[]
): Promise<void> {
  try {
    const attemptsCollection = collection(db, 'quiz_attempts');
    await addDoc(attemptsCollection, {
      userId,
      lessonId,
      lessonTitle,
      correctCount,
      totalCount,
      scorePercentage: Math.round((correctCount / totalCount) * 100),
      timestamp: Date.now(),
      wrongQuestions: wrongQuestionsList
    });
  } catch (error: any) {
    console.error("Firebase log attempt failed:", error);
  }
}

/**
 * Compiles a beautiful HTML summary report and queues it to the 'mail' collection for trigger sending
 */
export async function sendEmailReport(
  userId: string,
  lessonTitle: string,
  correctCount: number,
  totalCount: number,
  questionsList: any[],
  stats: AppStats,
  customEmail?: string | null,
  writingData?: {
    sentence?: string;
    feedback?: WritingEvaluationResult;
    scenario?: string;
    koreanIntent?: string;
  } | null
): Promise<void> {
  try {
    const percentage = Math.round((correctCount / totalCount) * 100);
    const isPerfect = correctCount === totalCount;
    const primaryColor = '#06b6d4'; // Sleek Cyan theme
    const secondaryColor = '#8b5cf6'; // Premium Purple theme
    const successColor = '#10b981'; // Green
    
    let questionsHtml = '';
    
    if (questionsList.length > 0) {
      questionsList.forEach((wa, index) => {
        const questionText = wa.question;
        const choices = wa.choices || [];
        const userAnswerIndex = wa.userAnswerIndex;
        const correctIndex = wa.correctIndex;
        const rationale = wa.rationale || '해설이 제공되지 않았습니다.';
        
        const isCorrect = userAnswerIndex === correctIndex;
        const borderColor = isCorrect ? '#10b981' : '#ef4444';
        const statusBadge = isCorrect 
          ? '<span style="font-size: 0.7rem; background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">맞음</span>'
          : '<span style="font-size: 0.7rem; background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">틀림</span>';
        
        let choicesListHtml = '';
        choices.forEach((choice: string, cIdx: number) => {
          let style = 'padding: 8px 12px; margin: 4px 0; border-radius: 6px; font-size: 0.85rem; border: 1px solid #334155; color: #cbd5e1;';
          let badge = '';
          if (cIdx === correctIndex) {
            style = 'padding: 8px 12px; margin: 4px 0; border-radius: 6px; font-size: 0.85rem; background-color: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: bold;';
            badge = ' <span style="font-size: 0.7rem; background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">정답</span>';
          } else if (cIdx === userAnswerIndex) {
            style = 'padding: 8px 12px; margin: 4px 0; border-radius: 6px; font-size: 0.85rem; background-color: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #ef4444; font-weight: bold;';
            badge = ' <span style="font-size: 0.7rem; background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">선택한 답</span>';
          }
          choicesListHtml += `<div style="${style}">${choice}${badge}</div>`;
        });
        
        questionsHtml += `
          <div style="background-color: #1e293b; border-left: 4px solid ${borderColor}; padding: 16px; margin: 16px 0; border-radius: 0 12px 12px 0;">
            <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
              <span>Q${index + 1}. ${questionText}</span>
              ${statusBadge}
            </h4>
            <div style="margin-bottom: 12px;">${choicesListHtml}</div>
            <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px dashed #475569; padding: 12px; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; color: #94a3b8;">
              <strong style="color: #cbd5e1; display: block; margin-bottom: 4px;">💡 AI 상세 해설:</strong>
              ${rationale}
            </div>
          </div>
        `;
      });
    } else {
      questionsHtml = `
        <div style="text-align: center; padding: 32px; background-color: #1e293b; border-radius: 12px; border: 1px dashed #334155; color: #cbd5e1; margin: 16px 0;">
          <p style="margin: 0; font-size: 0.85rem;">풀이 이력이 없습니다.</p>
        </div>
      `;
    }

    // Situational Writing Result Section for Email
    let writingHtml = '';
    if (writingData && (writingData.sentence || writingData.feedback)) {
      const wScore = writingData.feedback?.score !== undefined ? `${writingData.feedback.score}점` : '완료';
      const isHigh = (writingData.feedback?.score || 0) >= 80;
      
      writingHtml = `
        <div style="margin-top: 24px; background: linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%); border: 1.5px solid #ec4899; border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(236, 72, 153, 0.2); padding-bottom: 10px;">
            <h3 style="margin: 0; font-size: 1.05rem; color: #ffffff; display: flex; align-items: center; gap: 8px;">
              <span>✍️ 실전 상황 작문 (Situational Writing) 결과</span>
            </h3>
            <span style="font-size: 0.8rem; font-weight: bold; background-color: ${isHigh ? '#10b981' : '#ec4899'}; color: white; padding: 4px 10px; border-radius: 9999px;">
              완성도 ${wScore}
            </span>
          </div>

          ${writingData.scenario ? `
            <div style="background-color: rgba(0,0,0,0.3); padding: 10px 14px; border-radius: 8px; margin-bottom: 10px; font-size: 0.85rem; color: #cbd5e1;">
              <strong style="color: #f472b6; display: block; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 2px;">🏢 실전 상황:</strong>
              ${writingData.scenario}
            </div>
          ` : ''}

          ${writingData.koreanIntent ? `
            <div style="background-color: rgba(236, 72, 153, 0.1); border-left: 3px solid #ec4899; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 0.9rem; color: #ffffff; font-weight: bold;">
              🎯 의도: "${writingData.koreanIntent}"
            </div>
          ` : ''}

          ${writingData.sentence ? `
            <div style="margin-bottom: 10px; background-color: rgba(0,0,0,0.4); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.75rem; color: #94a3b8; font-weight: bold; display: block; margin-bottom: 2px;">내가 작성한 영문:</span>
              <p style="margin: 0; font-size: 0.95rem; color: #38bdf8; font-weight: bold;">"${writingData.sentence}"</p>
            </div>
          ` : ''}

          ${writingData.feedback?.correctedSentence ? `
            <div style="margin-bottom: 10px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.75rem; color: #34d399; font-weight: bold; display: block; margin-bottom: 2px;">✨ AI 교정 완성 문장:</span>
              <p style="margin: 0; font-size: 0.95rem; color: #10b981; font-weight: bold;">"${writingData.feedback.correctedSentence}"</p>
            </div>
          ` : ''}

          ${writingData.feedback?.nativeAlternative ? `
            <div style="margin-bottom: 10px; background-color: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.75rem; color: #22d3ee; font-weight: bold; display: block; margin-bottom: 2px;">🌟 원어민 실사용 추천 대체 표현:</span>
              <p style="margin: 0; font-size: 0.9rem; color: #ffffff; font-weight: 600;">"${writingData.feedback.nativeAlternative}"</p>
            </div>
          ` : ''}

          ${writingData.feedback?.feedback ? `
            <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px dashed #475569; padding: 12px; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; color: #cbd5e1;">
              <strong style="color: #f472b6; display: block; margin-bottom: 4px;">💬 AI 첨삭 피드백:</strong>
              ${writingData.feedback.feedback}
            </div>
          ` : ''}
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>영어 독해 퀴즈 결과 리포트</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px; color: ${primaryColor}; text-shadow: 0 0 10px rgba(6, 182, 212, 0.2);">
              📖 READ.AGENT REPORT
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #94a3b8;">사용자 ID: <strong>${userId}</strong> | 일시: ${new Date().toLocaleString()}</p>
          </div>

          <!-- Score Card -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); text-align: center; margin-bottom: 24px;">
            <span style="font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px;">이번 지문 테스트 점수</span>
            <h2 style="font-size: 2.5rem; font-weight: 900; margin: 8px 0; color: ${isPerfect ? successColor : '#f8fafc'};">
              객관식: ${correctCount} / ${totalCount} (${percentage}%)
              ${writingData?.feedback?.score !== undefined ? `<span style="font-size: 1.3rem; color: #f472b6; display: block; margin-top: 4px;">상황 작문: ${writingData.feedback.score}점</span>` : ''}
            </h2>
            <div style="background-color: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); padding: 8px 16px; border-radius: 8px; display: inline-block; font-size: 0.85rem; color: #22d3ee; font-weight: bold; margin-bottom: 8px;">
              🔥 ${stats.streak}일 연속 스트릭 달성 중!
            </div>
            <p style="margin: 8px 0 0 0; font-size: 0.9rem; color: #cbd5e1; font-weight: bold;">
              주제: "${lessonTitle}"
            </p>
          </div>

          <!-- Lifetime Stats -->
          <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 16px 20px; margin-bottom: 32px;">
            <h3 style="margin: 0 0 12px 0; font-size: 0.9rem; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">📊 나의 누적 클라우드 통계</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">누적 풀이 문항 수</td>
                <td style="padding: 6px 0; text-align: right; color: #f8fafc; font-weight: bold;">${stats.totalQuizzesTaken} 문제</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">누적 정답 수</td>
                <td style="padding: 6px 0; text-align: right; color: #10b981; font-weight: bold;">${stats.totalCorrectAnswers} 문제</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">누적 정답률</td>
                <td style="padding: 6px 0; text-align: right; color: #22d3ee; font-weight: bold;">
                  ${stats.totalQuizzesTaken > 0 ? Math.round((stats.totalCorrectAnswers / stats.totalQuizzesTaken) * 100) : 0}%
                </td>
              </tr>
              <tr style="border-top: 1px solid #334155;">
                <td style="padding: 8px 0 0 0; color: #94a3b8;">오답 졸업(정복) 수</td>
                <td style="padding: 8px 0 0 0; text-align: right; color: ${secondaryColor}; font-weight: bold;">${stats.masteredCount} 문제</td>
              </tr>
            </table>
          </div>

          <!-- Questions Breakdown -->
          <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: #f8fafc; border-bottom: 2px solid ${isPerfect ? successColor : '#ef4444'}; padding-bottom: 6px;">
            📝 전체 문항 상세 해설 및 분석
          </h3>
          ${questionsHtml}

          <!-- Situational Writing Breakdown -->
          ${writingHtml}

          <!-- Footer -->
          <div style="text-align: center; margin-top: 48px; border-top: 1px solid #334155; padding-top: 16px; font-size: 0.75rem; color: #64748b;">
            <p style="margin: 0;">본 메일은 <strong>READ.AGENT</strong> 인공지능 영어 학습 도우미가 발송한 결과 보고서입니다.</p>
            <p style="margin: 4px 0 0 0;">클라우드 데이터베이스와 구글 Firebase SMTP 메일 트리거 기능에 의해 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const trimmedId = userId.trim().toLowerCase();
    let toEmail = 'nikelite@gmail.com';
    if (customEmail && customEmail.trim()) {
      toEmail = customEmail.trim();
    } else if (trimmedId === 'nikelite') {
      toEmail = 'nikelite+quiz@gmail.com';
    } else if (trimmedId === 'junhu') {
      toEmail = 'nikelite+quiz@gmail.com, yjkwon98@hanmail.net, junhupark21@gmail.com';
    }

    const writingScoreText = writingData?.feedback?.score !== undefined ? `, 작문: ${writingData.feedback.score}점` : '';

    const mailCollection = collection(db, 'mail');
    await addDoc(mailCollection, {
      to: toEmail,
      message: {
        subject: `[READ.AGENT] ${lessonTitle} - 학습 결과 리포트 (객관식: ${correctCount}/${totalCount}${writingScoreText})`,
        html: emailHtml
      }
    });
  } catch (error: any) {
    console.error("Firebase sendEmailReport failed:", error);
  }
}

/**
 * Saves dynamically generated passage-level sentence analyses to Cloud Firestore under a single document for maximum efficiency
 */
export async function savePassageAnalysisToCloud(
  lessonId: string,
  analysis: Record<number, SentenceAnalysis[]>
): Promise<void> {
  try {
    if (!lessonId || !analysis) return;
    const analysisRef = doc(db, 'passage_analyses', lessonId);
    const sanitized = sanitizeForFirestore({ analysis, updatedAt: Date.now() });
    await setDoc(analysisRef, sanitized, { merge: true });
  } catch (error) {
    console.error("Firebase save passage analysis failed:", error);
  }
}

/**
 * Loads cached passage-level sentence analyses from Cloud Firestore
 */
export async function loadPassageAnalysisFromCloud(
  lessonId: string
): Promise<Record<number, SentenceAnalysis[]> | null> {
  try {
    const analysisRef = doc(db, 'passage_analyses', lessonId);
    const docSnap = await getDoc(analysisRef);
    if (docSnap.exists()) {
      return docSnap.data().analysis as Record<number, SentenceAnalysis[]>;
    }
    return null;
  } catch (error) {
    console.error("Firebase load passage analysis failed:", error);
    return null;
  }
}

/**
 * Queries and loads all quiz attempts of another target User ID from the cloud
 */
export async function loadUserQuizAttemptsFromCloud(targetUserId: string): Promise<any[]> {
  try {
    const variations = getCasingVariations(targetUserId);
    const q = query(
      collection(db, 'quiz_attempts'), 
      where('userId', 'in', variations)
    );
    const querySnap = await getDocs(q);
    const attempts: any[] = [];
    querySnap.forEach((docSnap) => {
      attempts.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by timestamp descending (newest first)
    return attempts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error: any) {
    console.error("Firebase load user attempts failed:", error);
    throw new Error(`사용자 퀴즈 기록 조회 실패: ${error.message || "알 수 없는 오류"}`);
  }
}

