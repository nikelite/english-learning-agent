import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LessonCreator } from './components/LessonCreator';
import { StudyTabs } from './components/StudyTabs';
import { QuizPanel } from './components/QuizPanel';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { Lesson, WrongAnswer, AppStats, QuizItem } from './types';
import { PRESET_LESSONS, generateLessonFromText } from './geminiService';
import { GraduationCap, Info } from 'lucide-react';

export default function App() {
  // 1. API Key State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('eng_agent_api_key') || '';
  });

  // 2. Navigation & UI View Modes
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [activeStudyTab, setActiveStudyTab] = useState<'eli5' | 'memory' | 'pronounce'>('eli5');
  const [viewMode, setViewMode] = useState<'study' | 'quiz'>('study');
  
  // 3. Active Lesson State (default to first preset lesson)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(() => {
    return PRESET_LESSONS[0] || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  // Persist Wrong Answers
  useEffect(() => {
    localStorage.setItem('eng_agent_wrong_answers', JSON.stringify(wrongAnswers));
  }, [wrongAnswers]);

  // Persist Stats
  useEffect(() => {
    localStorage.setItem('eng_agent_stats', JSON.stringify(stats));
  }, [stats]);

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

  // Save API Key
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('eng_agent_api_key', key);
  };

  // AI custom generation trigger
  const handleGenerateLesson = async (text: string) => {
    setIsLoading(true);
    try {
      const generated = await generateLessonFromText(text, apiKey);
      setActiveLesson(generated);
      setViewMode('study');
      setActiveStudyTab('eli5');
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Preset lesson load trigger
  const handleLoadPreset = (preset: Lesson) => {
    setActiveLesson(preset);
    setViewMode('study');
    setActiveStudyTab('eli5');
  };

  // Quiz wrong answer tracking
  const handleAddWrongAnswer = (quizItem: QuizItem, selectedAnswerIndex: number) => {
    if (!activeLesson) return;

    // Avoid duplicating exact same question
    setWrongAnswers(prev => {
      if (prev.some(wa => wa.quizItem.id === quizItem.id)) {
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
  const handleQuizCompleted = (correctCount: number) => {
    setStats(prev => ({
      ...prev,
      totalQuizzesTaken: prev.totalQuizzesTaken + 5,
      totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
    }));
  };

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

                <div>
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
                  onBackToStudy={() => setViewMode('study')}
                />
              )}
            </main>
          ) : (
            /* Fallback state when no lesson is actively loaded */
            <main className="glass-panel main-panel text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
              <Info size={36} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>학습 세트가 선택되지 않았습니다</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>좌측 추천 리스트에서 공부할 주제를 고르거나 새로운 문제 텍스트를 분석해 보세요.</p>
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
    </div>
  );
}
