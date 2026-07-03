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
import { Lesson, AppStats, WrongAnswer } from './types';

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
    
    if (userId && !docData.ownerId) {
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
 * Saves student progress on a shared lesson separately
 */
export async function saveSharedLessonProgress(
  lessonId: string, 
  userId: string, 
  progress: {
    userAnswers?: Record<string, number>;
    solvedAt?: number;
    firstAttemptScore?: { score: number; total: number };
    retryHistory?: any[];
  }
): Promise<void> {
  try {
    const docId = `${lessonId}_${userId}`;
    const ref = doc(db, 'expression_shared_progress', docId);
    await setDoc(ref, {
      lessonId,
      userId,
      progress,
      updatedAt: Date.now()
    });
  } catch (error: any) {
    console.error("Failed to save shared lesson progress:", error);
  }
}

/**
 * Loads all shared lesson progress documents for a given user
 */
export async function loadSharedLessonsProgress(
  userId: string
): Promise<Record<string, {
  userAnswers?: Record<string, number>;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: any[];
}>> {
  try {
    const q = query(collection(db, 'expression_shared_progress'), where('userId', '==', userId));
    const querySnap = await getDocs(q);
    const progressMap: Record<string, any> = {};
    querySnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.lessonId && data.progress) {
        progressMap[data.lessonId] = data.progress;
      }
    });
    return progressMap;
  } catch (error: any) {
    console.error("Failed to load shared lessons progress:", error);
    return {};
  }
}

function mergeLessons(local: Lesson, cloud: Lesson): { merged: Lesson, needsUpload: boolean } {
  const localSolved = !!local.userAnswers;
  const cloudSolved = !!cloud.userAnswers;
  
  if (localSolved && !cloudSolved) {
    return { merged: local, needsUpload: true };
  }
  
  if (!localSolved && cloudSolved) {
    return { merged: cloud, needsUpload: false };
  }
  
  if (localSolved && cloudSolved) {
    const localTime = local.solvedAt || 0;
    const cloudTime = cloud.solvedAt || 0;
    if (localTime >= cloudTime) {
      return { merged: local, needsUpload: localTime > cloudTime };
    } else {
      return { merged: cloud, needsUpload: false };
    }
  }
  
  const localCreated = local.createdAt || 0;
  const cloudCreated = cloud.createdAt || 0;
  if (localCreated >= cloudCreated) {
    return { merged: local, needsUpload: localCreated > cloudCreated };
  } else {
    return { merged: cloud, needsUpload: false };
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
    
    // 3. Query shared lessons progress for this student
    const progressMap = await loadSharedLessonsProgress(userId);
    
    // Merge cloud lists and inject student progress for shared lessons
    const cloudLessonsMap = new Map<string, Lesson>();
    ownerLessons.forEach((lesson) => {
      cloudLessonsMap.set(lesson.id, lesson);
    });
    sharedLessons.forEach((lesson) => {
      let mergedShared = { ...lesson };
      const studentProgress = progressMap[lesson.id];
      if (studentProgress) {
        mergedShared = {
          ...mergedShared,
          userAnswers: studentProgress.userAnswers,
          solvedAt: studentProgress.solvedAt,
          firstAttemptScore: studentProgress.firstAttemptScore,
          retryHistory: studentProgress.retryHistory
        };
      }
      cloudLessonsMap.set(lesson.id, mergedShared);
    });
    
    const syncedLessons: Lesson[] = [];
    
    // 4. Merge local lessons. If offline local lesson is not in cloud, upload it.
    for (const localLesson of localLessons) {
      if (localLesson.id.startsWith('preset-')) continue;
      
      const inCloud = cloudLessonsMap.get(localLesson.id);
      if (inCloud) {
        const { merged, needsUpload } = mergeLessons(localLesson, inCloud);
        if (needsUpload) {
          try {
            if (merged.ownerId && merged.ownerId !== userId) {
              await saveSharedLessonProgress(merged.id, userId, {
                userAnswers: merged.userAnswers,
                solvedAt: merged.solvedAt,
                firstAttemptScore: merged.firstAttemptScore,
                retryHistory: merged.retryHistory
              });
            } else {
              await saveLessonToCloud(merged, userId);
            }
          } catch (err) {
            console.warn("Failed to upload merged lesson/progress during sync:", err);
          }
        }
        syncedLessons.push(merged);
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
    
    // 5. Add remaining cloud lessons (which exist in cloud but were not in local storage)
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

/**
 * Saves overall lifetime application stats of a user to Cloud
 */
export async function saveStatsToCloud(userId: string, stats: AppStats): Promise<void> {
  try {
    const statsRef = doc(db, 'expression_user_stats', userId);
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
    const statsRef = doc(db, 'expression_user_stats', userId);
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
export async function saveWrongAnswersToCloud(userId: string, wrongAnswers: WrongAnswer[], updatedAt?: number): Promise<void> {
  try {
    const wrongAnswersRef = doc(db, 'expression_wrong_answers', userId);
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
export async function loadWrongAnswersFromCloud(userId: string): Promise<{ list: WrongAnswer[], updatedAt: number } | null> {
  try {
    const wrongAnswersRef = doc(db, 'expression_wrong_answers', userId);
    const docSnap = await getDoc(wrongAnswersRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        list: (data.list || []) as WrongAnswer[],
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
    const ref = doc(db, 'expression_presets_progress', userId);
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
    const ref = doc(db, 'expression_presets_progress', userId);
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
    const attemptsCollection = collection(db, 'expression_quiz_attempts');
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
  customEmail?: string | null
): Promise<void> {
  try {
    const percentage = Math.round((correctCount / totalCount) * 100);
    const isPerfect = correctCount === totalCount;
    const primaryColor = '#8b5cf6'; // Premium Purple theme
    const secondaryColor = '#ec4899'; // Pink highlighting
    const successColor = '#10b981'; // Green
    
    let questionsHtml = '';
    
    if (questionsList.length > 0) {
      questionsList.forEach((wa, index) => {
        const quizItem = wa.quizItem || wa;
        const questionText = quizItem.question;
        const choices = quizItem.choices || [];
        const userAnswerIndex = wa.userAnswerIndex;
        const correctIndex = quizItem.correctIndex;
        const rationale = quizItem.rationale || '해설이 제공되지 않았습니다.';
        
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

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>영어 표현 및 영작 퀴즈 결과 리포트</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px; color: ${primaryColor}; text-shadow: 0 0 10px rgba(139, 92, 246, 0.2);">
              ✍️ EXPRESS.AGENT REPORT
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #94a3b8;">사용자 ID: <strong>${userId}</strong> | 일시: ${new Date().toLocaleString()}</p>
          </div>

          <!-- Score Card -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); text-align: center; margin-bottom: 24px;">
            <span style="font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px;">이번 표현 테스트 점수</span>
            <h2 style="font-size: 3rem; font-weight: 900; margin: 8px 0; color: ${isPerfect ? successColor : '#f8fafc'};">
              ${correctCount} / ${totalCount}
              <span style="font-size: 1.5rem; font-weight: 500; color: #94a3b8;">(${percentage}%)</span>
            </h2>
            <div style="background-color: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); padding: 8px 16px; border-radius: 8px; display: inline-block; font-size: 0.85rem; color: #a78bfa; font-weight: bold; margin-bottom: 8px;">
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
                <td style="padding: 6px 0; text-align: right; color: #a78bfa; font-weight: bold;">
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

          <!-- Footer -->
          <div style="text-align: center; margin-top: 48px; border-top: 1px solid #334155; padding-top: 16px; font-size: 0.75rem; color: #64748b;">
            <p style="margin: 0;">본 메일은 <strong>EXPRESS.AGENT</strong> 인공지능 영어 학습 도우미가 발송한 결과 보고서입니다.</p>
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

    const mailCollection = collection(db, 'mail');
    await addDoc(mailCollection, {
      to: toEmail,
      message: {
        subject: `[EXPRESS.AGENT] ${lessonTitle} - 학습 결과 리포트 (점수: ${correctCount}/${totalCount})`,
        html: emailHtml
      }
    });
  } catch (error: any) {
    console.error("Firebase sendEmailReport failed:", error);
  }
}

/**
 * Queries and loads all quiz attempts of another target User ID from the cloud
 */
export async function loadUserQuizAttemptsFromCloud(targetUserId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'expression_quiz_attempts'), 
      where('userId', '==', targetUserId.trim())
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
