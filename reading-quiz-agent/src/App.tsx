import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ReadingSplitView } from './components/ReadingSplitView';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { ShareModal } from './components/ShareModal';
import { ReadingLesson, WrongReadingAnswer, AppStats, ReadingQuizItem, ReadingVocabulary } from './types';
import { PRESET_READING_LESSONS, generateReadingLesson, deserializeLesson } from './geminiService';
import { Sparkles, Info, BookOpen, AlertCircle, RefreshCw, Layers } from 'lucide-react';
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

export default function App() {
  // 1. Core API & Key Settings
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('eng_reading_api_key') || '';
  });

  // 2. Navigation Tab & Views
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [viewMode, setViewMode] = useState<'creator' | 'split'>('creator');
  
  // 3. Spaced repetition storage state trees
  const [wrongAnswers, setWrongAnswers] = useState<WrongReadingAnswer[]>(() => {
    const saved = localStorage.getItem('eng_reading_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('eng_reading_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  // 4. Main Generation configuration states
  const [inputText, setInputText] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [comprehensionCount, setComprehensionCount] = useState<number>(3);
  const [vocabCount, setVocabCount] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 5. Active Lesson State (default to wood wide web preset)
  const [activeLesson, setActiveLesson] = useState<ReadingLesson | null>(() => {
    return PRESET_READING_LESSONS[0] || null;
  });

  // 6. Sharing mechanisms
  const [isSharedQuiz, setIsSharedQuiz] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);

  // 7. Recent Lessons History Library
  const [lessonsHistory, setLessonsHistory] = useState<ReadingLesson[]>(() => {
    const saved = localStorage.getItem('eng_reading_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Injected quizzes (includes standard ones + oldest past mistakes) calculated synchronously
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...activeLesson.quizzes];

    if (!isSharedQuiz && wrongAnswers.length > 0) {
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
            ? `🔄 [현재 지문 오답 복습]` 
            : `🔄 [과거 다른 지문 오답] (지문: ${wa.lessonTitle})`;
          return {
            ...wa.quizItem,
            id: wa.id, // Keep the wrong answer ID to identify it during graduation
            isReview: true,
            question: `${label} ${wa.quizItem.question.replace(/^Q\d+\.\s*/i, '')}`
          };
        });
      
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  // Local storage and cloud background backup persistence
  useEffect(() => {
    localStorage.setItem('eng_reading_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      saveWrongAnswersToCloud(userId, wrongAnswers);
    }
  }, [wrongAnswers, userId]);

  useEffect(() => {
    localStorage.setItem('eng_reading_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Daily Streak calculations
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

          if (diffDays === 1) newStreak += 1;
          else if (diffDays > 1) newStreak = 1;
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
    const localSaved = localStorage.getItem('eng_reading_lessons_history');
    const localList: ReadingLesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson History
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('eng_reading_lessons_history', JSON.stringify(syncedList));
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
  const saveLessonToHistory = async (lesson: ReadingLesson) => {
    if (!lesson || lesson.id.startsWith('preset-')) return;
    
    let updatedLesson = { ...lesson };
    
    // If user is configured with an ID, save to Cloud
    if (userId) {
      try {
        setSyncStatus('syncing');
        const docId = await saveLessonToCloud(lesson, userId);
        updatedLesson = {
          ...lesson,
          id: docId,
          ownerId: userId,
          sharedWith: lesson.sharedWith || []
        };
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to upload lesson on save:", err);
        setSyncStatus('error');
      }
    }
    
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => item.id !== updatedLesson.id && item.title !== updatedLesson.title);
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteHistory = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation(); // Prevent loading the lesson
    if (window.confirm("이 학습 세트를 보관함에서 삭제하시겠습니까?")) {
      // Remove locally immediately
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
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
          setActiveLesson(decodedLesson);
          setIsSharedQuiz(true);
          setViewMode('split');
          saveLessonToHistory(decodedLesson);
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      setError(null);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setIsSharedQuiz(true);
          setViewMode('split');
          saveLessonToHistory(decodedLesson);
        } else {
          setError("공유된 클라우드 학습 데이터를 찾을 수 없습니다.");
        }
      }).catch((err: any) => {
        setError(err.message || "클라우드 데이터를 가져오는 중 에러가 발생했습니다.");
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('eng_reading_api_key', key);
  };

  // AI custom generation trigger
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const text = inputText.trim();

    if (!text) {
      setError("분석할 독해 지문을 입력해 주세요.");
      return;
    }
    if (!apiKey) {
      setError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 등록하시거나, 아래 추천 프리셋 지문을 체험해 보세요!");
      return;
    }

    setIsLoading(true);
    try {
      const generated = await generateReadingLesson(text, apiKey, comprehensionCount, vocabCount);
      if (titleInput.trim()) {
        generated.title = titleInput.trim();
      }
      setActiveLesson(generated);
      setViewMode('split');
      setInputText('');
      setTitleInput('');
      saveLessonToHistory(generated);
    } catch (err: any) {
      setError(err.message || "지문 분석에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Preset load trigger
  const handleLoadPreset = (preset: ReadingLesson) => {
    setActiveLesson(preset);
    setViewMode('split');
  };

  // Wrong Answers notebook callbacks
  const handleAddWrongAnswer = (quizItem: ReadingQuizItem, selectedIndex: number) => {
    if (!activeLesson) return;

    setWrongAnswers(prev => {
      // Avoid duplicates based on original question string
      if (prev.some(wa => wa.quizItem.question === quizItem.question)) {
        return prev;
      }
      const newWrong: WrongReadingAnswer = {
        id: `wrong-reading-${Date.now()}-${quizItem.id}`,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        quizItem,
        userAnswerIndex: selectedIndex,
        timestamp: Date.now()
      };
      return [newWrong, ...prev];
    });
  };

  // Graduation from mistakes notebook (triggered when review question is answered correctly)
  const handleGraduateReview = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Manual dismiss wrong answer from notebook
  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
  };

  const handleClearAllWrong = () => {
    if (window.confirm("독해 오답 노트의 모든 기록을 영구 삭제하시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

  // Stats updates
  const handleQuizCompleted = (correctCount: number, totalCount: number, wrongQuestionsList?: any[], userAnswers?: Record<string, number>) => {
    const list = wrongQuestionsList || [];
    
    if (totalCount > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
        };

        if (userId && activeLesson) {
          logQuizAttempt(userId, activeLesson.id, activeLesson.title, correctCount, totalCount, list);
          sendEmailReport(userId, activeLesson.title, correctCount, totalCount, list, newStats);
          
          setTimeout(() => {
            alert(`📝 [클라우드 연동 성공]\n\n이번 학습 내역이 안전하게 클라우드에 백업되었습니다.\n📧 nikelite@gmail.com 으로 오답 분석 리포트 메일이 발송 대기열에 등록되었습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      const updatedLesson = {
        ...activeLesson,
        userAnswers: userAnswers
      };
      setActiveLesson(updatedLesson);
      saveLessonToHistory(updatedLesson);
    }
  };

  const handleAddCustomVocabulary = (newVocab: ReadingVocabulary) => {
    if (!activeLesson) return;
    setActiveLesson(prev => {
      if (!prev) return null;
      return {
        ...prev,
        vocabulary: [newVocab, ...prev.vocabulary]
      };
    });
  };

  return (
    <div className="app-container">
      {/* Universal header */}
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
        isSharedQuiz={isSharedQuiz}
      />

      {/* Shared quiz exit warning overlay banner */}
      {isSharedQuiz && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', marginTop: '1rem' }}>
          <span>💡 공유 링크를 통해 학습 테스트 세트에 접속해 계십니다. 나만의 지문을 업로드해 풀고 싶다면 복제하여 사용하세요.</span>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => {
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsSharedQuiz(false);
            setViewMode('creator');
          }}>
            나의 독해방으로 가기
          </button>
        </div>
      )}

      {/* Dashboard navigation tabs */}
      {activeTab === 'learn' && (
        viewMode === 'creator' ? (
          /* SECTION A: THE CREATOR & INPUT FORM */
          <div className="dashboard-layout animate-fade-in">
            {/* Input Form Column */}
            <div className="glass-panel sidebar-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} style={{ color: 'var(--secondary)' }} />
                  독해 분석 대시보드
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  영어 지문/텍스트를 붙여넣으세요. AI가 문단별 번역, 단어장 및 맞춤형 퀴즈를 출제합니다.
                </p>
              </div>

              <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="영어 독해 본문이나 모의고사 텍스트를 이곳에 붙여넣어 주세요..."
                    className="textarea-glow"
                    style={{ minHeight: '180px', fontSize: '0.85rem' }}
                    disabled={isLoading}
                  />
                </div>

                {/* Title Input Field */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>학습 세트 제목 (선택)</label>
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="미입력 시 지문 내용으로 자동 설정"
                    className="input-glow"
                    style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                    disabled={isLoading}
                  />
                </div>

                {/* Configurations */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>독해 문항 수</label>
                    <select
                      value={comprehensionCount}
                      onChange={(e) => setComprehensionCount(Number(e.target.value))}
                      className="select-glow"
                      disabled={isLoading}
                    >
                      <option value={0}>0 문제</option>
                      <option value={1}>1 문제</option>
                      <option value={2}>2 문제</option>
                      <option value={3}>3 문제</option>
                      <option value={4}>4 문제</option>
                      <option value={5}>5 문제</option>
                      <option value={8}>8 문제</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>어휘 문항 수</label>
                    <select
                      value={vocabCount}
                      onChange={(e) => setVocabCount(Number(e.target.value))}
                      className="select-glow"
                      disabled={isLoading}
                    >
                      <option value={0}>0 문제</option>
                      <option value={1}>1 문제</option>
                      <option value={2}>2 문제</option>
                      <option value={3}>3 문제</option>
                      <option value={4}>4 문제</option>
                      <option value={5}>5 문제</option>
                      <option value={8}>8 문제</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'flex-start' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', boxShadow: '0 4px 15px rgba(6,182,212,0.2)' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></span>
                      지문 정독 및 출제하는 중...
                    </span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      영어 지문 분석 &amp; 출제
                    </>
                  )}
                </button>
              </form>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

              {/* Preset selector list */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Layers size={14} style={{ color: 'var(--primary)' }} />
                  추천 프리셋 지문 훈련
                </h4>
                {PRESET_READING_LESSONS.map((preset) => (
                  <button
                    key={preset.id}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '0.6rem 0.75rem' }}
                    onClick={() => handleLoadPreset(preset)}
                  >
                    📖 {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction manual / Recent Library column */}
            {/* Recent Library column */}
            <main className="glass-panel main-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <BookOpen size={20} style={{ color: 'var(--secondary)' }} />
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
                      : "생성하거나 공유받은 독해 지문들이 안전하게 보관됩니다. 우측 상단 ⚙️ 설정을 눌러 User ID를 등록하시면 클라우드와 자동 동기화됩니다."}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <input
                    type="text"
                    placeholder="학습 제목 및 지문 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-glow"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.775rem', borderRadius: '8px', width: '100%' }}
                  />
                </div>
              </div>

              <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', paddingRight: '0.25rem' }}>
                {lessonsHistory.length === 0 ? (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
                    <div className="pulse-glow" style={{ width: '48px', height: '48px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} style={{ color: 'var(--secondary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>보관함에 아직 학습 세트가 없습니다</h4>
                      <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto' }}>
                        좌측 지문 생성기에 본문을 붙여넣고 분석하시거나, 아래 추천 프리셋 지문을 선택해 즉시 훈련을 진행해 보세요! 생성된 학습 세트는 여기에 자동으로 저장됩니다.
                      </p>
                    </div>
                  </div>
                ) : lessonsHistory.filter(item => {
                  const q = searchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return item.title.toLowerCase().includes(q) || item.passageText.toLowerCase().includes(q);
                }).length > 0 ? (
                  lessonsHistory.filter(item => {
                    const q = searchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return item.title.toLowerCase().includes(q) || item.passageText.toLowerCase().includes(q);
                  }).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveLesson(item);
                        setIsSharedQuiz(false); // Reset shared banner when playing own history
                        setViewMode('split');
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
                        borderRadius: '0 8px 8px 0'
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
                           <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(6,182,212,0.15)', color: 'var(--secondary)', border: 'none', padding: '0.1rem 0.4rem' }}>
                            📝 {item.quizzes.length} 문항
                          </span>
                          {item.userAnswers ? (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: 'none', padding: '0.1rem 0.4rem', fontWeight: 'bold' }}>
                              ✅ 풀이 완료 ({item.quizzes.filter(q => item.userAnswers?.[q.id] === q.correctIndex).length} / {item.quizzes.length})
                            </span>
                          ) : (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'none', padding: '0.1rem 0.4rem' }}>
                              📖 미풀이
                            </span>
                          )}
                          {item.ownerId && item.ownerId !== userId && (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(236,72,153,0.12)', color: 'var(--accent)', border: 'none', padding: '0.1rem 0.4rem', fontWeight: '700' }}>
                              📥 {item.ownerId}님 공유
                            </span>
                          )}
                          {item.ownerId && item.ownerId === userId && (
                            <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: 'none', padding: '0.1rem 0.4rem', fontWeight: '700' }}>
                              ☁️ My 클라우드
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                          {item.passageText}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          {item.userAnswers ? "📊 결과 분석" : "학습 개시"}
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
                    검색어와 일치하는 보관함 지문이 없습니다.
                  </div>
                )}
              </div>
            </main>
          </div>
        ) : (
          /* SECTION B: SPLIT PASSAGE & INTERACTIVE PANEL VIEW */
          <div style={{ padding: '1.5rem 0 3rem 0' }}>
            {activeLesson && (
              <ReadingSplitView
                lesson={activeLesson}
                onAddWrongAnswer={handleAddWrongAnswer}
                onQuizCompleted={handleQuizCompleted}
                onOpenShare={() => setIsShareOpen(true)}
                onBackToCreator={!isSharedQuiz ? () => setViewMode('creator') : undefined}
                injectedQuizzes={injectedQuizzes}
                onGraduateReview={handleGraduateReview}
                apiKey={apiKey}
                onAddCustomVocabulary={handleAddCustomVocabulary}
              />
            )}
          </div>
        )
      )}

      {/* Review room Notebook */}
      {activeTab === 'review' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onClearAll={handleClearAllWrong}
          />
        </div>
      )}

      {/* Analytics progress chart */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        </div>
      )}

      {/* Base64 dynamic Share link popup modal */}
      {activeLesson && (
        <ShareModal
          lesson={activeLesson}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
}
