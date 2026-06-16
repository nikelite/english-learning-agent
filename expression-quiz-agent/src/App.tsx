import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LessonCreator } from './components/LessonCreator';
import { StudyTabs } from './components/StudyTabs';
import { QuizPanel } from './components/QuizPanel';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { Lesson, WrongAnswer, AppStats, QuizItem } from './types';
import { PRESET_LESSONS, generateLessonFromText, deserializeLesson } from './geminiService';
import { GraduationCap, Info, BookOpen, Share2, Sparkles, Edit2 } from 'lucide-react';
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
    </div>
  );
}
