import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LessonCreator } from './components/LessonCreator';
import { StudyTabs } from './components/StudyTabs';
import { QuizPanel } from './components/QuizPanel';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { Lesson, WrongAnswer, AppStats, QuizItem } from './types';
import { PRESET_LESSONS, generateLessonFromText, deserializeLesson } from './geminiService';
import { GraduationCap, Info, BookOpen, Share2, Sparkles, Edit2, X } from 'lucide-react';
import { 
  loadLessonFromCloud, 
  saveLessonToCloud, 
  syncUserLessons, 
  removeLessonAssociation,
  saveStatsToCloud,
  loadStatsFromCloud,
  saveWrongAnswersToCloud,
  loadWrongAnswersFromCloud,
  logQuizAttempt,
  sendEmailReport
} from './firebaseService';
import { ShareModal } from './components/ShareModal';
import { fetchMochiDecks, fetchMochiCards } from './mochiService';

export default function App() {
  // 1. API Key State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('eng_agent_api_key') || '';
  });

  // 2. Navigation & UI View Modes
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [activeStudyTab, setActiveStudyTab] = useState<'eli5' | 'memory' | 'pronounce'>('eli5');
  const [viewMode, setViewMode] = useState<'study' | 'quiz'>('study');
  
  // 3. Active Lesson State (default to null to show Recent Lessons Library dashboard on load)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSharedQuiz, setIsSharedQuiz] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);

  // 7. Recent Lessons History Library
  const [lessonsHistory, setLessonsHistory] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem('eng_expr_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('eng_user_email') || '';
  });

  const handleSaveUserEmail = (email: string) => {
    setUserEmail(email);
    localStorage.setItem('eng_user_email', email);
  };

  // Mochi Integration States
  const [mochiApiKey, setMochiApiKey] = useState<string>(() => {
    return localStorage.getItem('mochi_api_key') || '';
  });

  const handleSaveMochiApiKey = (key: string) => {
    setMochiApiKey(key);
    localStorage.setItem('mochi_api_key', key);
  };

  const [isMochiModalOpen, setIsMochiModalOpen] = useState(false);
  const [mochiDecks, setMochiDecks] = useState<any[]>([]);
  const [selectedMochiDeck, setSelectedMochiDeck] = useState<string>('all');
  const [selectedMochiStartDate, setSelectedMochiStartDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedMochiEndDate, setSelectedMochiEndDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [mochiCards, setMochiCards] = useState<any[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isMochiLoading, setIsMochiLoading] = useState(false);
  const [mochiError, setMochiError] = useState<string | null>(null);
  const [filterIncorrectOnly, setFilterIncorrectOnly] = useState(true);
  const [mochiTotalReviewed, setMochiTotalReviewed] = useState<number>(0);
  const [mochiTotalForgotten, setMochiTotalForgotten] = useState<number>(0);
  const [mochiImportingProgress, setMochiImportingProgress] = useState<{current: number, total: number} | null>(null);

  const handleOpenMochiModal = async () => {
    setIsMochiModalOpen(true);
    setMochiError(null);
    setMochiCards([]);
    setSelectedCardIds(new Set());
    setMochiTotalReviewed(0);
    setMochiTotalForgotten(0);
    
    if (!mochiApiKey.trim()) {
      return;
    }

    setIsMochiLoading(true);
    try {
      const decks = await fetchMochiDecks(mochiApiKey);
      setMochiDecks(decks);
    } catch (err: any) {
      setMochiError(err.message || 'Mochi 덱 목록을 불러오지 못했습니다.');
    } finally {
      setIsMochiLoading(false);
    }
  };

  const handleSearchMochiCards = async () => {
    if (!mochiApiKey.trim()) return;
    if (selectedMochiStartDate > selectedMochiEndDate) {
      setMochiError("시작 날짜는 종료 날짜보다 이전이어야 합니다.");
      return;
    }
    setIsMochiLoading(true);
    setMochiError(null);
    setMochiCards([]);
    setSelectedCardIds(new Set());
    setMochiTotalReviewed(0);
    setMochiTotalForgotten(0);

    try {
      const allCards = await fetchMochiCards(mochiApiKey, selectedMochiDeck);
      
      const isWithinDateRangeLocal = (reviewDateObj: any, start: string, end: string) => {
        if (!reviewDateObj) return false;
        let dateStr = '';
        if (typeof reviewDateObj === 'string') {
          dateStr = reviewDateObj;
        } else if (reviewDateObj && typeof reviewDateObj === 'object') {
          if (reviewDateObj.$date) {
            dateStr = reviewDateObj.$date;
          } else if (reviewDateObj.date) {
            dateStr = reviewDateObj.date;
          }
        }
        
        if (!dateStr) return false;
        try {
          const reviewDate = new Date(dateStr);
          if (isNaN(reviewDate.getTime())) return false;
          
          const year = reviewDate.getFullYear();
          const month = String(reviewDate.getMonth() + 1).padStart(2, '0');
          const day = String(reviewDate.getDate()).padStart(2, '0');
          const localDateStr = `${year}-${month}-${day}`;
          return localDateStr >= start && localDateStr <= end;
        } catch (e) {
          return false;
        }
      };

      const isForgotten = (review: any) => {
        const remembered = review.remembered !== undefined ? review.remembered : review['remembered?'];
        return remembered === false;
      };

      // Calculate reviewed and forgotten stats from allCards list
      let reviewed = 0;
      let forgotten = 0;
      
      allCards.forEach(card => {
        if (!card.reviews || !Array.isArray(card.reviews)) return;
        const reviewsInPeriod = card.reviews.filter((r: any) => isWithinDateRangeLocal(r.date, selectedMochiStartDate, selectedMochiEndDate));
        if (reviewsInPeriod.length > 0) {
          reviewed++;
          if (reviewsInPeriod.some((r: any) => isForgotten(r))) {
            forgotten++;
          }
        }
      });

      setMochiTotalReviewed(reviewed);
      setMochiTotalForgotten(forgotten);

      // We should only display cards that WERE reviewed within the selected period.
      let filtered = allCards.filter(card => {
        if (!card.reviews || !Array.isArray(card.reviews)) return false;
        return card.reviews.some((review: any) => isWithinDateRangeLocal(review.date, selectedMochiStartDate, selectedMochiEndDate));
      });

      // Filter further by incorrect reviews if filterIncorrectOnly is true
      if (filterIncorrectOnly) {
        filtered = filtered.filter(card => {
          return card.reviews.some((review: any) => {
            return isWithinDateRangeLocal(review.date, selectedMochiStartDate, selectedMochiEndDate) && isForgotten(review);
          });
        });
      }

      setMochiCards(filtered);
      if (filtered.length === 0) {
        const periodStr = selectedMochiStartDate === selectedMochiEndDate 
          ? selectedMochiStartDate 
          : `${selectedMochiStartDate} ~ ${selectedMochiEndDate}`;
        setMochiError(`${periodStr} 기간에 ${filterIncorrectOnly ? '복습 시 틀린(Forgot) ' : '복습을 진행한 '}카드가 존재하지 않습니다.`);
      }
    } catch (err: any) {
      setMochiError(err.message || 'Mochi 카드를 불러오는 중 에러가 발생했습니다.');
    } finally {
      setIsMochiLoading(false);
    }
  };

  const handleImportSelectedCards = async () => {
    if (selectedCardIds.size === 0) return;
    if (!apiKey) {
      setMochiError("오답 학습 세트를 생성하려면 설정(⚙️)에서 Gemini API Key를 먼저 입력해야 합니다.");
      return;
    }

    const selectedCardsList = mochiCards.filter(card => selectedCardIds.has(card.id));
    if (selectedCardsList.length === 0) return;

    setIsMochiLoading(true);
    setMochiError(null);
    setMochiImportingProgress({ current: 0, total: selectedCardsList.length });

    try {
      let lastGeneratedLesson: Lesson | null = null;
      
      const savedCount = localStorage.getItem('last_expr_question_count');
      const qCount = savedCount ? Number(savedCount) : 5;

      for (let i = 0; i < selectedCardsList.length; i++) {
        const card = selectedCardsList[i];
        setMochiImportingProgress({ current: i + 1, total: selectedCardsList.length });

        const text = card.content 
          ? card.content 
          : (card.fields ? Object.values(card.fields).map((f: any) => f.value).filter(Boolean).join('\n') : '');

        if (!text.trim()) continue;

        // Generate lesson via Gemini API
        const generated = await generateLessonFromText(text, apiKey, qCount);
        
        // Extract title from card content preview
        const firstLine = text.split('\n')[0].replace(/[#*`]/g, '').trim().substring(0, 25);
        generated.title = `[Mochi] ${firstLine || '가져온 오답 카드'}...`;

        // Save directly to lessons history library
        const saved = await saveLessonToHistory(generated);
        lastGeneratedLesson = saved;
      }

      if (selectedCardsList.length === 1 && lastGeneratedLesson) {
        setActiveLesson(lastGeneratedLesson);
        setViewMode('study');
        setActiveStudyTab('eli5');
      } else {
        // If multiple cards are imported, show the library list so they can see all of them
        setActiveLesson(null);
      }
      
      setIsMochiModalOpen(false);
    } catch (err: any) {
      setMochiError(err.message || 'AI 학습 세트를 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsMochiLoading(false);
      setMochiImportingProgress(null);
    }
  };

  // 7.1 Cloud Sync State
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('eng_user_id') || '';
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSaveUserId = (newId: string) => {
    setUserId(newId);
    localStorage.setItem('eng_user_id', newId);
  };

  // 4. Wrong Answers State (Mistakes review database)
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>(() => {
    const saved = localStorage.getItem('eng_agent_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  // 5. Statistics State
  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('eng_agent_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  // Persist Wrong Answers & Cloud background backup
  useEffect(() => {
    localStorage.setItem('eng_agent_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      saveWrongAnswersToCloud(userId, wrongAnswers);
    }
  }, [wrongAnswers, userId]);

  // Persist Stats & Cloud background backup
  useEffect(() => {
    localStorage.setItem('eng_agent_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Trigger cloud sync when userId changes or on mount
  useEffect(() => {
    if (!userId) {
      setSyncStatus('idle');
      return;
    }
    
    let isMounted = true;
    setSyncStatus('syncing');
    setSyncError(null);
    
    // Fetch local history to merge
    const localSaved = localStorage.getItem('eng_expr_lessons_history');
    const localList: Lesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson History
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('eng_expr_lessons_history', JSON.stringify(syncedList));
        setSyncStatus('synced');
      }
    }).catch((err: any) => {
      if (isMounted) {
        console.error("Auto sync failed:", err);
        setSyncStatus('error');
        setSyncError(err.message || "동기화 오류");
      }
    });

    // Sync lifetime stats in parallel
    loadStatsFromCloud(userId).then((cloudStats) => {
      if (cloudStats && isMounted) {
        setStats(prev => ({
          streak: Math.max(prev.streak, cloudStats.streak),
          lastActiveDate: prev.lastActiveDate || cloudStats.lastActiveDate,
          totalQuizzesTaken: Math.max(prev.totalQuizzesTaken, cloudStats.totalQuizzesTaken),
          totalCorrectAnswers: Math.max(prev.totalCorrectAnswers, cloudStats.totalCorrectAnswers),
          masteredCount: Math.max(prev.masteredCount, cloudStats.masteredCount)
        }));
      }
    }).catch(err => console.error("Cloud stats load failed:", err));

    // Sync mistakes notebook in parallel
    loadWrongAnswersFromCloud(userId).then((cloudWrong) => {
      if (cloudWrong && isMounted) {
        setWrongAnswers(prev => {
          const merged = [...prev];
          cloudWrong.forEach(cw => {
            if (!merged.some(w => w.quizItem.question === cw.quizItem.question)) {
              merged.push(cw);
            }
          });
          return merged;
        });
      }
    }).catch(err => console.error("Cloud wrong answers load failed:", err));
    
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Save lesson to history library (caches locally and uploads/syncs to cloud if userId is active)
  const saveLessonToHistory = async (lesson: Lesson): Promise<Lesson> => {
    if (!lesson || lesson.id.startsWith('preset-')) return lesson;
    
    let updatedLesson = { ...lesson };
    
    // Optimistic local save
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => item.id !== lesson.id && item.id !== updatedLesson.id && item.title !== updatedLesson.title);
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
      return updated;
    });

    // If user is configured with an ID, save to Cloud
    if (userId) {
      try {
        setSyncStatus('syncing');
        const docId = await saveLessonToCloud(lesson, userId);
        const cloudLesson = {
          ...lesson,
          id: docId,
          ownerId: userId,
          sharedWith: lesson.sharedWith || []
        };

        if (docId !== lesson.id) {
          setLessonsHistory(prev => {
            const filtered = prev.filter(item => item.id !== lesson.id && item.id !== docId && item.title !== cloudLesson.title);
            const updated = [cloudLesson, ...filtered];
            localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
            return updated;
          });
        }
        updatedLesson = cloudLesson;
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to upload lesson on save:", err);
        setSyncStatus('error');
      }
    }
    
    return updatedLesson;
  };

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');

  const handleUpdateLessonTitle = async (lessonId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    // Update active lesson title if matches
    if (activeLesson && activeLesson.id === lessonId) {
      setActiveLesson(prev => prev ? { ...prev, title: newTitle } : null);
    }

    let updatedLesson: Lesson | null = null;
    setLessonsHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === lessonId) {
          updatedLesson = { ...item, title: newTitle };
          return updatedLesson;
        }
        return item;
      });
      localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
      return updated;
    });

    if (userId && updatedLesson) {
      try {
        setSyncStatus('syncing');
        await saveLessonToCloud(updatedLesson, userId);
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to update lesson title in cloud:", err);
        setSyncStatus('error');
      }
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (window.confirm("이 학습 세트를 보관함에서 삭제하시겠습니까?")) {
      // Remove locally immediately
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
        return updated;
      });
      
      // If user ID is configured, delete/disassociate in cloud in the background
      if (userId) {
        try {
          setSyncStatus('syncing');
          await removeLessonAssociation(lessonId, userId);
          setSyncStatus('synced');
        } catch (err: any) {
          console.error("Failed to remove cloud association on delete:", err);
          setSyncStatus('error');
        }
      }
    }
  };

  // CHECK AND DECODE URL SHARE LINK (`?share=...` or `?cloudShare=...`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    const cloudDocId = params.get('cloudShare');
    
    if (sharePayload) {
      deserializeLesson(sharePayload).then((decodedLesson) => {
        if (decodedLesson) {
          setIsSharedQuiz(true);
          setViewMode('study');
          setActiveStudyTab('eli5');
          saveLessonToHistory(decodedLesson).then(saved => setActiveLesson(saved));
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setIsSharedQuiz(true);
          setViewMode('study');
          setActiveStudyTab('eli5');
          // If we are logged in, associate this shared lesson with this user!
          const currentUserId = localStorage.getItem('eng_user_id') || null;
          let sharedLessonWithUser = { ...decodedLesson };
          if (currentUserId) {
            sharedLessonWithUser.sharedWith = [...(decodedLesson.sharedWith || [])];
            if (!sharedLessonWithUser.sharedWith.includes(currentUserId) && decodedLesson.ownerId !== currentUserId) {
              sharedLessonWithUser.sharedWith.push(currentUserId);
            }
          }
          saveLessonToHistory(sharedLessonWithUser).then(saved => setActiveLesson(saved));
        }
      }).catch((err: any) => {
        console.error("Firestore loading error:", err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  // Daily Streak Counter Logic
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (stats.lastActiveDate !== today) {
      setStats(prev => {
        let newStreak = prev.streak;
        if (prev.lastActiveDate) {
          const lastDate = new Date(prev.lastActiveDate);
          const currentDate = new Date(today);
          const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            newStreak += 1; // consecutive day
          } else if (diffDays > 1) {
            newStreak = 1; // streak broken, reset
          }
        } else {
          newStreak = 1;
        }

        return {
          ...prev,
          streak: newStreak,
          lastActiveDate: today
        };
      });
    }
  }, []);

  // Injected quizzes calculated synchronously in the render phase
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...activeLesson.quizzes];

    if (wrongAnswers.length > 0) {
      const oldestMistakes = [...wrongAnswers]
        .filter(wa => {
          // If the wrong answer is from a preset, only inject it when studying that exact same preset
          if (wa.lessonId.startsWith('preset-')) {
            return wa.lessonId === activeLesson.id;
          }
          // Custom lesson mistakes are only injected when studying custom lessons
          return !activeLesson.id.startsWith('preset-');
        })
        .sort((a, b) => a.timestamp - b.timestamp) // Oldest first
        .slice(0, 2)
        .map((wa, idx) => {
          const isSameLesson = wa.lessonId === activeLesson.id || wa.lessonTitle === activeLesson.title;
          const label = isSameLesson 
            ? `🔄 [현재 세트 오답 복습]` 
            : `🔄 [과거 다른 세트 오답] (출처: ${wa.lessonTitle})`;
          return {
            ...wa.quizItem,
            id: wa.id, // Keep the wrong answer ID for graduation
            isReview: true,
            question: `${label}\n\n${wa.quizItem.question}`
          };
        });
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  // Save API Key
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('eng_agent_api_key', key);
  };

  // AI custom generation trigger
  const handleGenerateLesson = async (text: string, questionCount: number, customTitle?: string) => {
    setIsLoading(true);
    try {
      const generated = await generateLessonFromText(text, apiKey, questionCount);
      if (customTitle && customTitle.trim()) {
        generated.title = customTitle.trim();
      }
      setViewMode('study');
      setActiveStudyTab('eli5');
      const savedLesson = await saveLessonToHistory(generated);
      setActiveLesson(savedLesson);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Preset lesson load trigger
  const handleLoadPreset = (preset: Lesson) => {
    const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
    const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
    const progress = presetsProgress[preset.id];
    let presetWithProgress = preset;
    if (progress) {
      const userAnswers = progress.userAnswers !== undefined ? progress.userAnswers : progress;
      const solvedAt = progress.solvedAt;
      const firstAttemptScore = progress.firstAttemptScore;
      const retryHistory = progress.retryHistory;
      presetWithProgress = { ...preset, userAnswers, solvedAt, firstAttemptScore, retryHistory };
    }
    
    setActiveLesson(presetWithProgress);
    setViewMode('study');
    setActiveStudyTab('eli5');
  };

  // Quiz wrong answer tracking
  const handleAddWrongAnswer = (quizItem: QuizItem, selectedAnswerIndex: number) => {
    if (!activeLesson) return;

    // Avoid duplicating exact same question
    setWrongAnswers(prev => {
      if (prev.some(wa => wa.quizItem.id === quizItem.id || wa.quizItem.question === quizItem.question)) {
        return prev;
      }
      const newWrong: WrongAnswer = {
        id: `wrong-${Date.now()}-${quizItem.id}`,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        quizItem,
        userAnswerIndex: selectedAnswerIndex,
        timestamp: Date.now()
      };
      return [newWrong, ...prev];
    });
  };

  const handleGraduateReview = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Remove single wrong answer from mistakes notebook
  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Clear all mistakes
  const handleClearAllWrong = () => {
    if (window.confirm("오답 노트의 모든 데이터를 삭제하시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

  // Update stats on quiz completion
  const handleQuizCompleted = async (correctCount: number, totalCount: number, wrongQuestionsList?: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => {
    const list = wrongQuestionsList || [];

    if (totalCount > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
        };

        if (userId && activeLesson) {
          const loggedTitle = isRetry ? `🔄 [재시도] ${activeLesson.title}` : activeLesson.title;
          
          let allQuestionsList: any[] = [];
          if (userAnswers) {
            allQuestionsList = activeLesson.quizzes.map(q => {
              const userAnswerIndex = userAnswers[q.id];
              return {
                question: q.question,
                choices: q.choices,
                userAnswerIndex: userAnswerIndex !== undefined ? userAnswerIndex : -1,
                correctIndex: q.correctIndex,
                rationale: q.rationale
              };
            }).filter(q => q.userAnswerIndex !== -1);
          } else {
            allQuestionsList = list;
          }

          logQuizAttempt(userId, activeLesson.id, loggedTitle, correctCount, totalCount, list);
          sendEmailReport(userId, loggedTitle, correctCount, totalCount, allQuestionsList, newStats, userEmail);

          const getEmailText = (id: string, custom?: string) => {
            if (custom && custom.trim()) return custom.trim();
            const trimmed = id.trim().toLowerCase();
            if (trimmed === 'nikelite') return 'nikelite+quiz@gmail.com';
            if (trimmed === 'junhu') return 'nikelite+quiz@gmail.com, yjkwon98@hanmail.net, junhupark21@gmail.com';
            return 'nikelite@gmail.com';
          };
          const resolvedEmail = getEmailText(userId, userEmail);

          setTimeout(() => {
            alert(`📝 [클라우드 연동 성공]\n\n표현 학습 시험 결과가 클라우드에 백업되었습니다.\n📧 ${resolvedEmail} 으로 학습 결과 리포트 메일이 발송 대기열에 추가되었습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      let updatedLesson: Lesson;
      if (totalCount === 0) {
        // Reset/Restart
        updatedLesson = {
          ...activeLesson,
          userAnswers: undefined,
          firstAttemptScore: undefined,
          retryHistory: undefined,
          solvedAt: undefined
        };
      } else if (isRetry) {
        const mergedAnswers = {
          ...(activeLesson.userAnswers || {}),
          ...userAnswers
        };
        const newRetry = {
          score: correctCount,
          total: totalCount,
          solvedAt: Date.now()
        };
        const retryHistory = activeLesson.retryHistory ? [...activeLesson.retryHistory, newRetry] : [newRetry];
        
        updatedLesson = {
          ...activeLesson,
          userAnswers: mergedAnswers,
          retryHistory,
          solvedAt: Date.now()
        };
      } else {
        updatedLesson = {
          ...activeLesson,
          userAnswers: userAnswers,
          firstAttemptScore: { score: correctCount, total: totalCount },
          solvedAt: Date.now()
        };
      }
      setActiveLesson(updatedLesson);
      
      if (activeLesson.id.startsWith('preset-')) {
        const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
        const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
        presetsProgress[activeLesson.id] = {
          userAnswers: updatedLesson.userAnswers,
          solvedAt: updatedLesson.solvedAt,
          firstAttemptScore: updatedLesson.firstAttemptScore,
          retryHistory: updatedLesson.retryHistory
        };
        localStorage.setItem('eng_expression_presets_progress', JSON.stringify(presetsProgress));
      } else {
        const savedLesson = await saveLessonToHistory(updatedLesson);
        setActiveLesson(savedLesson);
      }
    }
  };

  const handleProgressUpdate = async (userAnswers: Record<string, number>) => {
    if (!activeLesson) return;
    
    const updatedLesson = {
      ...activeLesson,
      userAnswers: userAnswers,
      solvedAt: Date.now()
    };
    setActiveLesson(updatedLesson);
    
    if (activeLesson.id.startsWith('preset-')) {
      const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
      const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
      presetsProgress[activeLesson.id] = {
        userAnswers,
        solvedAt: Date.now(),
        firstAttemptScore: activeLesson.firstAttemptScore,
        retryHistory: activeLesson.retryHistory
      };
      localStorage.setItem('eng_expression_presets_progress', JSON.stringify(presetsProgress));
    } else {
      const savedLesson = await saveLessonToHistory(updatedLesson);
      setActiveLesson(savedLesson);
    }
  };

  const filteredHistory = lessonsHistory.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.sourceText.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterMode === 'solved') {
      return !!item.userAnswers;
    }
    if (filterMode === 'unsolved') {
      return !item.userAnswers;
    }
    return true;
  });

  const solvedCount = lessonsHistory.filter(item => item.userAnswers).length;
  const unsolvedCount = lessonsHistory.filter(item => !item.userAnswers).length;

  return (
    <div className="app-container">
      {/* Header coordinates stats, api modal, and active navigations */}
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
        userEmail={userEmail}
        onSaveUserEmail={handleSaveUserEmail}
        mochiApiKey={mochiApiKey}
        onSaveMochiApiKey={handleSaveMochiApiKey}
      />

      {/* Main Workspace Dashboard */}
      {activeTab === 'learn' && (
        <div className="dashboard-grid">
          {/* Left Column: Lesson creator & presets switcher */}
          <LessonCreator
            apiKey={apiKey}
            onGenerate={handleGenerateLesson}
            onLoadPreset={handleLoadPreset}
            isLoading={isLoading}
            activeLesson={activeLesson}
            onOpenMochiImport={handleOpenMochiModal}
          />

          {/* Right Column: Active Study tabs or Interactive Quiz Player */}
          {activeLesson ? (
            <main className="glass-panel main-panel">
              {/* Header inside right canvas showing Title & play buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', fontWeight: '700' }}>
                    {viewMode === 'study' ? '학습 단계' : '실전 테스트 단계'}
                  </span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                    {activeLesson.title}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setActiveLesson(null);
                    }}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}
                  >
                    목록으로 가기
                  </button>

                  {!activeLesson.id.startsWith('preset-') && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setIsShareOpen(true)}
                      style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                    >
                      <Share2 size={15} style={{ color: 'var(--secondary)' }} />
                      공유하기
                    </button>
                  )}

                  {viewMode === 'study' ? (
                    <button
                      className="btn btn-accent"
                      onClick={() => setViewMode('quiz')}
                      style={{ padding: '0.6rem 1.25rem' }}
                    >
                      <GraduationCap size={16} />
                      인터랙티브 퀴즈 풀기
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setViewMode('study')}
                      style={{ padding: '0.6rem 1.25rem' }}
                    >
                      학습자료 다시보기
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle views between Learn tabs and Quiz panel */}
              {viewMode === 'study' ? (
                <StudyTabs
                  lesson={activeLesson}
                  activeStudyTab={activeStudyTab}
                  setActiveStudyTab={setActiveStudyTab}
                />
              ) : (
                <QuizPanel
                  lesson={activeLesson}
                  onAddWrongAnswer={handleAddWrongAnswer}
                  onQuizCompleted={handleQuizCompleted}
                  onProgressUpdate={handleProgressUpdate}
                  onBackToStudy={() => setViewMode('study')}
                  injectedQuizzes={injectedQuizzes}
                  onGraduateReview={handleGraduateReview}
                />
              )}
            </main>
          ) : (
            /* Recent Library column */
            <main className="glass-panel main-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', padding: '1.75rem', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                    📚 나의 최근 학습 보관함
                    {userId ? (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: syncStatus === 'syncing' ? 'rgba(234, 179, 8, 0.15)' : syncStatus === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: syncStatus === 'syncing' ? '#eab308' : syncStatus === 'error' ? 'var(--error)' : 'var(--success)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid currentColor',
                        fontWeight: '600',
                        marginLeft: '0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {syncStatus === 'syncing' ? '🔄 동기화 중...' : syncStatus === 'error' ? '⚠️ 동기화 실패' : '☁️ 클라우드 동기화 완료'}
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontWeight: '500',
                        marginLeft: '0.5rem'
                      }}>
                        🔒 로컬 보관함 사용 중
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {userId 
                      ? `클라우드 계정 '${userId}'에 실시간 동기화되는 안전한 보관함입니다.`
                      : "생성하거나 공유받은 문법/표현 세트가 안전하게 보관됩니다. 우측 상단 ⚙️ 설정을 눌러 User ID를 등록하시면 클라우드와 자동 동기화됩니다."}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <input
                    type="text"
                    placeholder="학습 제목 및 내용 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-glow"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.775rem', borderRadius: '8px', width: '100%' }}
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterMode('all')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'all' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'all' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'all' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  전체 ({lessonsHistory.length})
                </button>
                <button
                  onClick={() => setFilterMode('unsolved')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'unsolved' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'unsolved' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'unsolved' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'unsolved' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  미풀이 ({unsolvedCount})
                </button>
                <button
                  onClick={() => setFilterMode('solved')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'solved' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'solved' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'solved' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'solved' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  풀이 완료 ({solvedCount})
                </button>
              </div>

              <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(100vh - 280px)', minHeight: '480px', paddingRight: '0.25rem', overflowY: 'auto', overflowX: 'hidden' }}>
                {lessonsHistory.length === 0 ? (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
                    <div className="pulse-glow" style={{ width: '48px', height: '48px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>보관함에 아직 학습 세트가 없습니다</h4>
                      <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto' }}>
                        좌측 분석기 창에 질문이나 문장을 입력해 제출하시거나, 프리셋 지문을 선택해 즉시 훈련을 진행해 보세요! 생성된 학습 세트는 여기에 자동으로 저장됩니다.
                      </p>
                    </div>
                  </div>
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveLesson(item);
                        setIsSharedQuiz(false); // Reset shared banner when playing own history
                        setViewMode('study');
                        setActiveStudyTab('eli5');
                      }}
                      className="eli5-analogy-box"
                      style={{
                        margin: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        borderLeftWidth: '4px',
                        borderLeftColor: 'var(--secondary)',
                        transition: 'transform 0.15s ease, background 0.15s ease',
                        borderRadius: '0 8px 8px 0',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, minWidth: 0, marginRight: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            📅 {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                           <span style={{ fontSize: '0.65rem', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '600' }}>
                            📝 {item.quizzes.length} 문항
                          </span>
                          {item.userAnswers ? (() => {
                            const firstScore = item.firstAttemptScore 
                              ? `${item.firstAttemptScore.score} / ${item.firstAttemptScore.total}`
                              : `${item.quizzes.filter(q => item.userAnswers?.[q.id] === q.correctIndex).length} / ${item.quizzes.length}`;
                            
                            const retryStr = item.retryHistory && item.retryHistory.length > 0
                              ? `, 재시도: ` + item.retryHistory.map(r => `${r.score}/${r.total}`).join(', ')
                              : '';

                            return (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                ✅ 풀이 완료 ({firstScore}{retryStr})
                                {item.solvedAt && ` | 📅 ${new Date(item.solvedAt).toLocaleDateString()} ${new Date(item.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                              </span>
                            );
                          })() : (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                              📖 미풀이
                            </span>
                          )}
                          {item.ownerId && item.ownerId !== userId && (
                             <span style={{ fontSize: '0.65rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                              📥 {item.ownerId}님 공유
                            </span>
                          )}
                          {item.ownerId && item.ownerId === userId && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                              ☁️ My 클라우드
                            </span>
                          )}
                        </div>
                        {editingLessonId === item.id ? (
                          <div 
                            style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.25rem', marginBottom: '0.25rem' }} 
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editTitleInput}
                              onChange={(e) => setEditTitleInput(e.target.value)}
                              className="input-glow"
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                borderRadius: '6px',
                                border: '1px solid var(--primary)',
                                background: 'rgba(0,0,0,0.4)',
                                color: 'white',
                                width: '100%',
                                maxWidth: '240px'
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateLessonTitle(item.id, editTitleInput);
                                  setEditingLessonId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingLessonId(null);
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateLessonTitle(item.id, editTitleInput);
                                setEditingLessonId(null);
                              }}
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              저장
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLessonId(null);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </h4>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                          {item.sourceText}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          {item.userAnswers ? "📊 결과 분석" : "학습 개시"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLessonId(item.id);
                            setEditTitleInput(item.title);
                          }}
                          className="btn"
                          style={{
                            padding: '0.45rem',
                            borderRadius: '6px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(139, 92, 246, 0.15)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="제목 수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          className="btn"
                          style={{
                            padding: '0.45rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--error)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    검색어와 일치하는 보관함 세트가 없습니다.
                  </div>
                )}
              </div>
            </main>
          )}
        </div>
      )}

      {/* Mistakes notebook review suite */}
      {activeTab === 'review' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onClearAll={handleClearAllWrong}
          />
        </div>
      )}

      {/* Gamified tracking statistical chart room */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        </div>
      )}
      {/* Share Modal Popup */}
      {activeLesson && (
        <ShareModal
          lesson={activeLesson}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
      <footer style={{ 
        textAlign: 'center', 
        padding: '2rem 0 1.5rem 0', 
        fontSize: '0.7rem', 
        color: '#6b7280', 
        opacity: 0.75, 
        fontFamily: 'monospace',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: '2rem'
      }}>
        Version: {(import.meta.env as any).VITE_BUILD_TIME || 'dev'}
      </footer>

      {/* Mochi Import Modal */}
      {isMochiModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMochiModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', borderRadius: '50%' }}
              onClick={() => setIsMochiModalOpen(false)}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: 'var(--primary)' }} />
              Mochi 오답 카드 가져오기
            </h3>

            {!mochiApiKey.trim() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>🔒</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Mochi API Key가 등록되어 있지 않습니다.<br />
                  우측 상단의 설정(⚙️) 아이콘을 눌러 API Key를 먼저 입력해 주세요.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsMochiModalOpen(false)}
                  style={{ marginTop: '0.5rem' }}
                >
                  확인
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Search Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>선택 덱 (Deck)</label>
                      <select
                        value={selectedMochiDeck}
                        onChange={(e) => setSelectedMochiDeck(e.target.value)}
                        className="input-glow select-glow"
                        style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)', height: '40px', padding: '0.5rem' }}
                        disabled={isMochiLoading}
                      >
                        <option value="all">모든 덱 (All Decks)</option>
                        {mochiDecks.map((deck) => (
                          <option key={deck.id} value={deck.id}>
                            {deck.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>시작 날짜 (Start)</label>
                      <input
                        type="date"
                        value={selectedMochiStartDate}
                        onChange={(e) => setSelectedMochiStartDate(e.target.value)}
                        className="input-glow"
                        style={{ height: '40px' }}
                        disabled={isMochiLoading}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>종료 날짜 (End)</label>
                      <input
                        type="date"
                        value={selectedMochiEndDate}
                        onChange={(e) => setSelectedMochiEndDate(e.target.value)}
                        className="input-glow"
                        style={{ height: '40px' }}
                        disabled={isMochiLoading}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSearchMochiCards}
                      disabled={isMochiLoading}
                      style={{ height: '40px', padding: '0 1.25rem' }}
                    >
                      {isMochiLoading ? '조회 중...' : '카드 조회'}
                    </button>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={filterIncorrectOnly}
                      onChange={(e) => setFilterIncorrectOnly(e.target.checked)}
                      disabled={isMochiLoading}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>선택한 기간에 복습 시 틀린 카드(Forgot)만 필터링하여 표시</span>
                  </label>
                </div>

                {mochiTotalReviewed > 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📊 선택 기간 복습 진행 <strong>{mochiTotalReviewed}개</strong> 중 <strong>{mochiTotalForgotten}개</strong> 틀렸습니다.</span>
                    {mochiTotalForgotten > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '700' }}>오답률 {Math.round((mochiTotalForgotten / mochiTotalReviewed) * 100)}%</span>
                    )}
                  </div>
                )}

                {mochiImportingProgress && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                      <span>📥 개별 학습 세트 생성 및 보관함 등록 중...</span>
                      <span>{mochiImportingProgress.current} / {mochiImportingProgress.total}</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(mochiImportingProgress.current / mochiImportingProgress.total) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                )}

                {mochiError && (
                  <div style={{ color: 'var(--accent)', background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                    {mochiError}
                  </div>
                )}

                {/* Card List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      조회된 오답 카드 ({mochiCards.length}개)
                    </span>
                    {mochiCards.length > 0 && !mochiImportingProgress && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedCardIds(new Set(mochiCards.map(c => c.id)))}
                        >
                          전체 선택
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedCardIds(new Set())}
                        >
                          전체 해제
                        </button>
                      </div>
                    )}
                  </div>

                  <div 
                    style={{ 
                      maxHeight: '260px', 
                      overflowY: 'auto', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '10px', 
                      background: 'var(--bg-input)',
                      padding: '0.5rem'
                    }}
                  >
                    {mochiCards.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {!mochiError && '복습 날짜를 선택한 후 조회해 주세요.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {mochiCards.map((card) => {
                          const isSelected = selectedCardIds.has(card.id);
                          const cardPreview = card.content 
                            ? card.content.split('---')[0].trim() 
                            : (card.fields ? Object.values(card.fields).map((f: any) => f.value).filter(Boolean)[0] || '내용 없음' : '내용 없음');

                          return (
                            <label
                              key={card.id}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '0.5rem', 
                                padding: '0.6rem 0.75rem', 
                                borderRadius: '8px', 
                                background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid',
                                borderColor: isSelected ? 'var(--primary)' : 'transparent',
                                cursor: isSelected ? 'pointer' : (mochiImportingProgress ? 'not-allowed' : 'pointer'),
                                transition: 'all 0.2s ease',
                                opacity: mochiImportingProgress ? 0.7 : 1
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={mochiImportingProgress !== null}
                                style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                                onChange={() => {
                                  setSelectedCardIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(card.id)) {
                                      next.delete(card.id);
                                    } else {
                                      next.add(card.id);
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.85rem', color: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {cardPreview}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setIsMochiModalOpen(false)}
                    disabled={isMochiLoading || mochiImportingProgress !== null}
                  >
                    취소
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={selectedCardIds.size === 0 || isMochiLoading || mochiImportingProgress !== null}
                    onClick={handleImportSelectedCards}
                  >
                    선택한 카드 가져오기 ({selectedCardIds.size}개)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
