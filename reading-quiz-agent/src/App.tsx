import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ReadingSplitView } from './components/ReadingSplitView';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { ShareModal } from './components/ShareModal';
import { ReadingLesson, WrongReadingAnswer, AppStats, ReadingQuizItem } from './types';
import { PRESET_READING_LESSONS, generateReadingLesson, deserializeLesson } from './geminiService';
import { Sparkles, Info, BookOpen, AlertCircle, RefreshCw, Layers } from 'lucide-react';

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

  // Injected quizzes (includes standard ones + oldest past mistakes)
  const [injectedQuizzes, setInjectedQuizzes] = useState<ReadingQuizItem[]>([]);

  // Local storage persistence
  useEffect(() => {
    localStorage.setItem('eng_reading_wrong_answers', JSON.stringify(wrongAnswers));
  }, [wrongAnswers]);

  useEffect(() => {
    localStorage.setItem('eng_reading_stats', JSON.stringify(stats));
  }, [stats]);

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

  // CHECK AND DECODE URL SHARE LINK (`?share=...`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    
    if (sharePayload) {
      const decodedLesson = deserializeLesson(sharePayload);
      if (decodedLesson) {
        setActiveLesson(decodedLesson);
        setIsSharedQuiz(true);
        setViewMode('split');
        
        // No wrong answers injection during external link shares to preserve clean environment
        setInjectedQuizzes(decodedLesson.quizzes);
      }
    }
  }, []);

  // Update Injected Quizzes list when Lesson changes
  // Update Injected Quizzes list when Lesson changes
  useEffect(() => {
    if (!activeLesson) return;

    // Default to core quizzes
    let list = [...activeLesson.quizzes];

    // If this is a personal (non-shared) session and we have wrong answers:
    // Take up to 2 of the OLDEST wrong answers, tag them as 'isReview', and append!
    if (!isSharedQuiz && wrongAnswers.length > 0) {
      const oldestMistakes = [...wrongAnswers]
        .filter(wa => !wa.lessonId.startsWith('preset-')) // Retroactively filter out presets
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

    setInjectedQuizzes(list);
  }, [activeLesson, wrongAnswers, isSharedQuiz]);

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
      setActiveLesson(generated);
      setViewMode('split');
      setInputText('');
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

    // Exclude preset lessons from being saved into the Mistakes Notebook
    if (activeLesson.id.startsWith('preset-')) return;

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
  const handleQuizCompleted = (correctCount: number, totalCount: number) => {
    setStats(prev => ({
      ...prev,
      totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
      totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
    }));
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

            {/* Instruction manual column */}
            <main className="glass-panel main-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '450px', padding: '3rem 2rem', textAlign: 'center' }}>
              <div className="pulse-glow" style={{ width: '64px', height: '64px', background: 'var(--primary-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <BookOpen size={30} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                독해 훈련을 시작하세요!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', maxWidth: '450px', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                좌측에 원하는 영어 본문(뉴스, 모의고사, 학술자료 등)을 붙여넣으세요. 실시간으로 완벽한 문단 번역 가이드와 핵심 단어장, 그리고 실전 독해 평가 퀴즈가 펼쳐집니다.
              </p>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {PRESET_READING_LESSONS[0] && (
                  <button className="btn btn-primary" onClick={() => handleLoadPreset(PRESET_READING_LESSONS[0])}>
                    프리셋 지문 바로 훈련하기
                  </button>
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
