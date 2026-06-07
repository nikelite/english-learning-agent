import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CorrectionRoom } from './components/CorrectionRoom';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { ShareModal } from './components/ShareModal';
import type { LabLesson, WrongLabAnswer, AppStats, LabQuizItem } from './types';
import { PRESET_LESSONS, generateCorrection, deserializeLesson } from './geminiService';
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
  sendEmailReport,
  saveCustomPersonasToCloud,
  loadCustomPersonasFromCloud
} from './firebaseService';
import { 
  Sparkles, Info, BookOpen, Trash2, Calendar, Edit2, Search, PlusCircle, Check
} from 'lucide-react';

export default function App() {
  // 1. Core API & ID Config States
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('lab_gemini_api_key') || '';
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('lab_user_id') || '';
  });

  // 2. Tab Navigation & Loading States
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [activeLesson, setActiveLesson] = useState<LabLesson | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // 3. User Input States
  const [inputText, setInputText] = useState('');
  const [contextText, setContextText] = useState('');
  const [customPersonas, setCustomPersonas] = useState<string[]>(() => {
    const saved = localStorage.getItem('lab_custom_personas');
    return saved ? JSON.parse(saved) : [];
  });
  const [personaType, setPersonaType] = useState<string>(() => {
    return localStorage.getItem('last_lab_persona') || '40대 엔지니어 직장인';
  });
  const [customPersona, setCustomPersona] = useState('');
  const [writingStyle, setWritingStyle] = useState<'spoken' | 'written'>(() => {
    return (localStorage.getItem('last_lab_style') as 'spoken' | 'written') || 'written';
  });
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const saved = localStorage.getItem('last_lab_question_count');
    return saved ? Number(saved) : 5;
  });
  const [formError, setFormError] = useState<string | null>(null);

  // 4. History Log Library
  const [lessonsHistory, setLessonsHistory] = useState<LabLesson[]>(() => {
    const saved = localStorage.getItem('lab_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 5. Spaced Repetition Notebook Databases
  const [wrongAnswers, setWrongAnswers] = useState<WrongLabAnswer[]>(() => {
    const saved = localStorage.getItem('lab_agent_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  // 6. Streak & Accuracy Analytics State
  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('lab_agent_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // 7. Persist Local Data and Back up to Firestore if Cloud User ID is configured
  useEffect(() => {
    localStorage.setItem('lab_agent_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      saveWrongAnswersToCloud(userId, wrongAnswers);
    }
  }, [wrongAnswers, userId]);

  useEffect(() => {
    localStorage.setItem('lab_agent_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Synchronize Cloud & Local History Data
  useEffect(() => {
    if (!userId) {
      setSyncStatus('idle');
      return;
    }
    
    let isMounted = true;
    setSyncStatus('syncing');
    
    const localSaved = localStorage.getItem('lab_lessons_history');
    const localList: LabLesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson Logs list
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('lab_lessons_history', JSON.stringify(syncedList));
        setSyncStatus('synced');
      }
    }).catch((err: any) => {
      if (isMounted) {
        console.error("Auto sync lessons failed:", err);
        setSyncStatus('error');
      }
    });

    // Sync Stats
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

    // Sync Wrong answers mistakes review list
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

  // Persist last selected options
  useEffect(() => {
    localStorage.setItem('last_lab_persona', personaType);
  }, [personaType]);

  useEffect(() => {
    localStorage.setItem('last_lab_style', writingStyle);
  }, [writingStyle]);

  useEffect(() => {
    localStorage.setItem('last_lab_question_count', String(questionCount));
  }, [questionCount]);

  // Synchronize Custom Personas with Cloud
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    loadCustomPersonasFromCloud(userId).then((cloudPersonas) => {
      if (cloudPersonas && isMounted) {
        setCustomPersonas(prev => {
          const merged = Array.from(new Set([...prev, ...cloudPersonas]));
          localStorage.setItem('lab_custom_personas', JSON.stringify(merged));
          if (merged.length > cloudPersonas.length) {
            saveCustomPersonasToCloud(userId, merged);
          }
          return merged;
        });
      }
    }).catch(err => console.error("Cloud custom personas load failed:", err));
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Daily Streak Incrementor Logic
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
            newStreak += 1;
          } else if (diffDays > 1) {
            newStreak = 1;
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
  }, [stats.lastActiveDate]);

  // 8. Process URL Share Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    const cloudDocId = params.get('cloudShare');
    
    if (sharePayload) {
      deserializeLesson(sharePayload).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setActiveTab('learn');
          saveLessonToHistory(decodedLesson);
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setActiveTab('learn');
          
          const currentUserId = localStorage.getItem('lab_user_id') || null;
          let sharedLessonWithUser = { ...decodedLesson };
          if (currentUserId) {
            sharedLessonWithUser.sharedWith = [...(decodedLesson.sharedWith || [])];
            if (!sharedLessonWithUser.sharedWith.includes(currentUserId) && decodedLesson.ownerId !== currentUserId) {
              sharedLessonWithUser.sharedWith.push(currentUserId);
            }
          }
          saveLessonToHistory(sharedLessonWithUser);
        }
      }).catch((err: any) => {
        console.error("Firestore shared lesson loading failed:", err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  const saveLessonToHistory = async (lesson: LabLesson) => {
    if (!lesson || lesson.id.startsWith('preset-')) return;
    
    let updatedLesson = { ...lesson };
    
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
        console.error("Failed to upload lesson to cloud on save:", err);
        setSyncStatus('error');
      }
    }
    
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => item.id !== updatedLesson.id && item.title !== updatedLesson.title);
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('lab_gemini_api_key', key);
  };

  const handleSaveUserId = (newId: string) => {
    setUserId(newId);
    localStorage.setItem('lab_user_id', newId);
  };

  // AI Correction trigger
  const handleGenerateCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const text = inputText.trim();
    if (!text) {
      setFormError("교정할 영문 텍스트를 입력해 주세요.");
      return;
    }

    if (!apiKey) {
      setFormError("우측 상단 설정(⚙️) 아이콘을 눌러 Gemini API Key를 먼저 입력하시거나, 우측의 프리셋 자료를 선택해 체험해 보세요!");
      return;
    }

    setIsLoading(true);
    const chosenPersona = personaType === 'custom' ? customPersona.trim() : personaType;
    
    if (personaType === 'custom' && customPersona.trim()) {
      const newCustom = customPersona.trim();
      if (!customPersonas.includes(newCustom)) {
        const updated = [...customPersonas, newCustom];
        setCustomPersonas(updated);
        localStorage.setItem('lab_custom_personas', JSON.stringify(updated));
        if (userId) {
          saveCustomPersonasToCloud(userId, updated);
        }
      }
      setPersonaType(newCustom);
    }
    
    try {
      const result = await generateCorrection(
        text,
        chosenPersona || "일반 원어민 튜터",
        writingStyle,
        contextText.trim(),
        questionCount,
        apiKey
      );
      
      setActiveLesson(result);
      setInputText('');
      setContextText('');
      setCustomPersona('');
      saveLessonToHistory(result);
    } catch (err: any) {
      setFormError(err.message || "첨삭 세트를 생성하는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadPreset = (preset: LabLesson) => {
    // Check local storage progress for this preset
    const savedProgress = localStorage.getItem('lab_presets_progress');
    const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
    const progress = presetsProgress[preset.id];
    
    let presetWithProgress = { ...preset };
    if (progress) {
      const userAnswers = progress.userAnswers !== undefined ? progress.userAnswers : undefined;
      presetWithProgress = { 
        ...preset, 
        userAnswers,
        solvedAt: progress.solvedAt,
        firstAttemptScore: progress.firstAttemptScore,
        retryHistory: progress.retryHistory,
        chatHistory: progress.chatHistory,
        correctedText: progress.correctedText || preset.correctedText,
        overallFeedback: progress.overallFeedback || preset.overallFeedback,
        corrections: progress.corrections || preset.corrections
      };
    }
    
    setActiveLesson(presetWithProgress);
  };

  const handleDeleteHistory = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (window.confirm("이 학습 세트를 보관함에서 완전히 삭제하시겠습니까?")) {
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
        return updated;
      });
      
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

  const handleStartRename = (e: React.MouseEvent, lesson: LabLesson) => {
    e.stopPropagation();
    setEditingTitleId(lesson.id);
    setEditingTitleText(lesson.title);
  };

  const handleSaveRename = async (e: React.FormEvent, lessonId: string) => {
    e.preventDefault();
    if (!editingTitleText.trim()) return;

    if (activeLesson && activeLesson.id === lessonId) {
      setActiveLesson(prev => prev ? { ...prev, title: editingTitleText.trim() } : null);
    }

    let updatedLesson: LabLesson | null = null;
    setLessonsHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === lessonId) {
          updatedLesson = { ...item, title: editingTitleText.trim() };
          return updatedLesson;
        }
        return item;
      });
      localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
      return updated;
    });

    setEditingTitleId(null);

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

  // 9. Interactive Quiz callbacks
  const handleAddWrongAnswer = (quizItem: LabQuizItem, selectedAnswerIndex: number) => {
    if (!activeLesson) return;

    setWrongAnswers(prev => {
      if (prev.some(wa => wa.quizItem.id === quizItem.id)) {
        return prev;
      }
      const newWrong: WrongLabAnswer = {
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

  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  const handleClearAllWrong = () => {
    if (window.confirm("오답 노트의 모든 문항을 완전히 비우시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

  const handleQuizCompleted = (correctCount: number, totalCount: number, wrongQuestionsList?: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => {
    const list = wrongQuestionsList || [];

    if (totalCount > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
        };

        if (userId && activeLesson) {
          const loggedTitle = isRetry ? `🔄 [재시험] ${activeLesson.title}` : activeLesson.title;
          
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
          sendEmailReport(userId, loggedTitle, correctCount, totalCount, allQuestionsList, newStats);

          setTimeout(() => {
            alert(`🧪 [LAB.AGENT 리포트 알림]\n\n실전 퀴즈 결과가 클라우드에 연동되었습니다.\n📧 nikelite@gmail.com 메일로 분석 리포트(정답/오답 해설 및 종합 점수)가 발송 대기열에 들어갔습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      let updatedLesson: LabLesson;
      if (totalCount === 0) {
        updatedLesson = {
          ...activeLesson,
          userAnswers: undefined,
          firstAttemptScore: undefined,
          retryHistory: undefined,
          solvedAt: undefined
        };
      } else if (isRetry) {
        const history = activeLesson.retryHistory || [];
        updatedLesson = {
          ...activeLesson,
          userAnswers,
          solvedAt: Date.now(),
          retryHistory: [...history, { score: correctCount, total: totalCount, solvedAt: Date.now() }]
        };
      } else {
        updatedLesson = {
          ...activeLesson,
          userAnswers,
          solvedAt: Date.now(),
          firstAttemptScore: { score: correctCount, total: totalCount }
        };
      }

      // If it's a preset lesson, save preset progress to local storage
      if (activeLesson.id.startsWith('preset-')) {
        const savedProgress = localStorage.getItem('lab_presets_progress');
        const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
        presetsProgress[activeLesson.id] = {
          userAnswers: updatedLesson.userAnswers,
          solvedAt: updatedLesson.solvedAt,
          firstAttemptScore: updatedLesson.firstAttemptScore,
          retryHistory: updatedLesson.retryHistory
        };
        localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
      } else {
        saveLessonToHistory(updatedLesson);
      }

      setActiveLesson(updatedLesson);
    }
  };

  const handleProgressUpdate = (userAnswers: Record<string, number>) => {
    if (!activeLesson) return;

    const updatedLesson = {
      ...activeLesson,
      userAnswers
    };

    if (activeLesson.id.startsWith('preset-')) {
      const savedProgress = localStorage.getItem('lab_presets_progress');
      const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
      presetsProgress[activeLesson.id] = {
        ...(presetsProgress[activeLesson.id] || {}),
        userAnswers
      };
      localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
    } else {
      saveLessonToHistory(updatedLesson);
    }

    setActiveLesson(updatedLesson);
  };

  const handleLessonUpdate = (updatedLesson: LabLesson) => {
    if (updatedLesson.id.startsWith('preset-')) {
      const savedProgress = localStorage.getItem('lab_presets_progress');
      const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
      presetsProgress[updatedLesson.id] = {
        ...(presetsProgress[updatedLesson.id] || {}),
        userAnswers: updatedLesson.userAnswers,
        solvedAt: updatedLesson.solvedAt,
        firstAttemptScore: updatedLesson.firstAttemptScore,
        retryHistory: updatedLesson.retryHistory,
        chatHistory: updatedLesson.chatHistory,
        correctedText: updatedLesson.correctedText,
        overallFeedback: updatedLesson.overallFeedback,
        corrections: updatedLesson.corrections
      };
      localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
    } else {
      saveLessonToHistory(updatedLesson);
    }
    setActiveLesson(updatedLesson);
  };


  // Inject current/past wrong answers into study session for spaced repetition
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...(activeLesson.quizzes || [])];

    if (wrongAnswers.length > 0) {
      const oldestMistakes = [...wrongAnswers]
        .filter(wa => {
          if (wa.lessonId.startsWith('preset-')) {
            return wa.lessonId === activeLesson.id;
          }
          return !activeLesson.id.startsWith('preset-');
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 2)
        .map((wa) => {
          const isSameLesson = wa.lessonId === activeLesson.id || wa.lessonTitle === activeLesson.title;
          const label = isSameLesson 
            ? `🔄 [오답 복습] ` 
            : `🔄 [이전 학습 오답] (출처: ${wa.lessonTitle}) `;
          return {
            ...wa.quizItem,
            id: wa.id,
            isReview: true,
            question: `${label}\n\n${wa.quizItem.question}`
          };
        });
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  const filteredHistory = lessonsHistory.filter(lesson => 
    lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lesson.sourceText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'learn') {
            setActiveLesson(null);
          }
        }}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
      />

      <main style={{ padding: '1.5rem 0' }}>
        {isLoading && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-panel text-center" style={{ padding: '2.5rem 2rem', background: 'var(--bg-secondary)', borderRadius: '16px' }}>
              <div className="pulse-glow" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                <Sparkles className="streak-fire" style={{ color: 'var(--primary)' }} />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>영작 심층 교정 중</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Gemini AI가 문장 구조, 어조, 시제 및 문맥을 정밀 분석하고 있습니다...
              </p>
            </div>
          </div>
        )}

        {/* Tab 1: Learn & Correction Room */}
        {activeTab === 'learn' && (
          activeLesson ? (
            /* Active correction analysis & practice room */
            <div className="animate-fade-in">
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveLesson(null)}
                >
                  ◀ 새로운 영작 첨삭하기
                </button>
                
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}
                  onClick={() => setIsShareOpen(true)}
                >
                  🔗 학습 세트 공유
                </button>
              </div>

              <CorrectionRoom
                lesson={{
                  ...activeLesson,
                  quizzes: injectedQuizzes
                }}
                apiKey={apiKey}
                onAddWrongAnswer={handleAddWrongAnswer}
                onQuizCompleted={handleQuizCompleted}
                onProgressUpdate={handleProgressUpdate}
                onGraduateReview={handleGraduateReview}
                onLessonUpdate={handleLessonUpdate}
                onClose={() => setActiveLesson(null)}
              />

              <ShareModal
                lesson={activeLesson}
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
              />
            </div>
          ) : (
            /* Dashboard home screen */
            <div className="dashboard-grid animate-fade-in">
              {/* Left Column: Form Input Panel */}
              <div className="sidebar-panel glass-panel">
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white' }}>
                    <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                    AI 영어 연구실 (LAB.AGENT)
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    작성하신 영어 에세이나 어색한 회화 표현을 분석해 원어민 뉘앙스와 완벽한 문법으로 첨삭해 드립니다.
                  </p>
                </div>

                <form onSubmit={handleGenerateCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>교정할 영어 문장 / 에세이</label>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="여기에 직접 쓴 영작 문장이나 에세이를 입력하세요.&#10;예시: I goes to office yesterday. My manager check code..."
                      className="textarea-glow"
                      disabled={isLoading}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>상황 맥락 (Context - 선택)</label>
                    <input
                      type="text"
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      placeholder="예: 회사 매니저에게 현황을 보고하는 업무용 이메일"
                      className="input-glow"
                      disabled={isLoading}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>작성자 페르소나 (Persona)</label>
                    <select
                      value={personaType}
                      onChange={(e) => setPersonaType(e.target.value)}
                      className="input-glow select-glow"
                      disabled={isLoading}
                      style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                    >
                      <option value="40대 엔지니어 직장인">40대 엔지니어 직장인</option>
                      <option value="미국 중학생 청소년">미국 중학생 청소년</option>
                      <option value="40대 일상 / 학부모 / 관공서/가게 등..">40대 일상 / 학부모 / 관공서/가게 등..</option>
                      {customPersonas.map((cp) => (
                        <option key={cp} value={cp}>{cp}</option>
                      ))}
                      <option value="custom">직접 입력...</option>
                    </select>
                  </div>

                  {personaType === 'custom' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>커스텀 페르소나 직접 적기</label>
                      <input
                        type="text"
                        value={customPersona}
                        onChange={(e) => setCustomPersona(e.target.value)}
                        placeholder="예: 대학원 진학을 앞둔 20대 유학생"
                        className="input-glow"
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>스타일 필터</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn ${writingStyle === 'spoken' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.55rem 0.25rem', fontSize: '0.85rem' }}
                        onClick={() => setWritingStyle('spoken')}
                        disabled={isLoading}
                      >
                        🗣️ 구어체 (Spoken)
                      </button>
                      <button
                        type="button"
                        className={`btn ${writingStyle === 'written' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.55rem 0.25rem', fontSize: '0.85rem' }}
                        onClick={() => setWritingStyle('written')}
                        disabled={isLoading}
                      >
                        📝 문어체 (Written)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>퀴즈 문항 개수</label>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="input-glow select-glow"
                      disabled={isLoading}
                      style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                    >
                      <option value={3}>3 문항</option>
                      <option value={5}>5 문항 (기본)</option>
                      <option value={8}>8 문항</option>
                      <option value={10}>10 문항</option>
                    </select>
                  </div>

                  {formError && (
                    <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'center' }}>
                      <Info size={16} style={{ flexShrink: 0 }} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '0.85rem' }}
                    disabled={isLoading}
                  >
                    🚀 첨삭 분석 &amp; 퀴즈 생성
                  </button>
                </form>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                {/* Preset Recommendation List */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'white', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BookOpen size={16} style={{ color: 'var(--secondary)' }} />
                    추천 템플릿 학습 세트
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {PRESET_LESSONS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          fontSize: '0.825rem',
                          padding: '0.6rem 0.75rem',
                          display: 'block',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden'
                        }}
                        onClick={() => handleLoadPreset(preset)}
                      >
                        ⚡ {preset.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: History List */}
              <div className="main-panel glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontFamily: 'var(--font-display)' }}>
                      📝 영작 첨삭 보관함
                      <span className="badge badge-outline" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {lessonsHistory.length}
                      </span>
                    </h3>
                    {userId && (
                      <span style={{ 
                        fontSize: '0.725rem', 
                        color: syncStatus === 'error' ? 'var(--error)' : 'var(--primary)', 
                        fontWeight: '700' 
                      }}>
                        {syncStatus === 'syncing' && '🔄 클라우드 연동 동기화 중...'}
                        {syncStatus === 'synced' && '✓ 클라우드 동기화 완료'}
                        {syncStatus === 'error' && '❌ 클라우드 동기화 실패 (Firebase 권한 오류)'}
                      </span>
                    )}
                  </div>

                  {/* Search Bar */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="학습 목록 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-glow"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem 0.4rem 1.8rem', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '4rem 1rem' }}>
                    <PlusCircle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>첨삭 내역이 없습니다. 새로운 문장을 적어 분석해 보세요!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '580px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {filteredHistory.map((lesson) => {
                      const score = lesson.userAnswers 
                        ? (lesson.quizzes || []).filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length
                        : null;
                      const hasQuiz = (lesson.quizzes || []).length > 0;

                      return (
                        <div
                          key={lesson.id}
                          className="history-item-container"
                          onClick={() => handleLoadPreset(lesson)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ flex: 1, overflow: 'hidden', marginRight: '1rem', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap', minWidth: 0 }}>
                              <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: lesson.style === 'spoken' ? 'var(--primary)' : 'var(--secondary)' }}>
                                {lesson.style === 'spoken' ? '구어' : '문어'}
                              </span>
                              {lesson.writingLevel && (
                                <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: '#3b82f6', color: 'white', fontWeight: 'bold' }}>
                                  Level {lesson.writingLevel}
                                </span>
                              )}
                              
                              {editingTitleId === lesson.id ? (
                                <form 
                                  onSubmit={(e) => handleSaveRename(e, lesson.id)} 
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
                                >
                                  <input
                                    type="text"
                                    value={editingTitleText}
                                    onChange={(e) => setEditingTitleText(e.target.value)}
                                    className="input-glow"
                                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: '180px' }}
                                    autoFocus
                                  />
                                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.2rem' }}>
                                    <Check size={12} />
                                  </button>
                                </form>
                              ) : (
                                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'white', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
                                  {lesson.title}
                                </span>
                              )}
                              
                              {editingTitleId !== lesson.id && (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
                                  onClick={(e) => handleStartRename(e, lesson)}
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>

                            {/* Solved Status and Cloud Chips Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem', marginBottom: '0.35rem' }}>
                              {score !== null ? (() => {
                                const firstScore = lesson.firstAttemptScore 
                                  ? `${lesson.firstAttemptScore.score}/${lesson.firstAttemptScore.total}`
                                  : `${score}/${(lesson.quizzes || []).length}`;
                                
                                const retryStr = lesson.retryHistory && lesson.retryHistory.length > 0
                                  ? `, 재시도: ` + lesson.retryHistory.map(r => `${r.score}/${r.total}`).join(', ')
                                  : '';

                                return (
                                  <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                    ✅ 풀이 완료 ({firstScore}{retryStr})
                                  </span>
                                );
                              })() : hasQuiz ? (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                                  📖 미풀이
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                                  ✏️ 교정 전용
                                </span>
                              )}

                              {lesson.ownerId && lesson.ownerId !== userId && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                  📥 다른 사용자 공유
                                </span>
                              )}
                              {lesson.ownerId && lesson.ownerId === userId && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                  ☁️ My 클라우드
                                </span>
                              )}
                            </div>
                            
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', margin: 0 }}>
                              {lesson.sourceText}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={12} /> {new Date(lesson.createdAt).toLocaleDateString('ko-KR')}
                            </span>

                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.3rem', borderRadius: '6px' }}
                              onClick={(e) => handleDeleteHistory(e, lesson.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Tab 2: Mistakes review room */}
        {activeTab === 'review' && (
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onClearAll={handleClearAllWrong}
          />
        )}

        {/* Tab 3: Analytics dashboard */}
        {activeTab === 'analytics' && (
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        )}
      </main>
    </div>
  );
}
