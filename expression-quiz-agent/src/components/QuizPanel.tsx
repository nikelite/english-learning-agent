import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles, AlertCircle, RefreshCw, ArrowRight, BookmarkCheck, Brain, Zap } from 'lucide-react';
import { Lesson, QuizItem, WritingEvaluationResult } from '../types';
import { WrongAnswerCoachModal } from './WrongAnswerCoachModal';
import { WritingPracticeSection } from './WritingPracticeSection';

interface QuizPanelProps {
  lesson: Lesson;
  onAddWrongAnswer: (quizItem: QuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number, wrongQuestionsList: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => void;
  onProgressUpdate: (userAnswers: Record<string, number>) => void;
  onBackToStudy: () => void;
  injectedQuizzes: QuizItem[];
  onGraduateReview: (wrongId: string) => void;
  onLoadNextUnsolvedLesson?: () => void;
  apiKey: string;
  mochiApiKey: string;
  mochiQuizDeckId: string;
  onAddQuizToMochi: (quiz: QuizItem) => Promise<void>;
  onGenerateAdditionalQuizzes?: (count: number) => Promise<QuizItem[]>;
  unsolvedLessonsCount?: number;
  onSaveWriting?: (sentence: string, feedback: WritingEvaluationResult) => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onProgressUpdate,
  onBackToStudy,
  injectedQuizzes,
  onGraduateReview,
  onLoadNextUnsolvedLesson,
  apiKey,
  mochiApiKey,
  mochiQuizDeckId,
  onAddQuizToMochi,
  onGenerateAdditionalQuizzes,
  unsolvedLessonsCount,
  onSaveWriting
}) => {
  const [activeQuizzes, setActiveQuizzes] = useState<QuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<QuizItem[]>([]);
  const [attemptWrongs, setAttemptWrongs] = useState<any[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number>>(() => lesson.userAnswers || {});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [coachingQuizItem, setCoachingQuizItem] = useState<{ quiz: QuizItem; userAns: number } | null>(null);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);
  const [addingToMochiIds, setAddingToMochiIds] = useState<Set<string>>(new Set());
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [additionalCount, setAdditionalCount] = useState<number>(3);

  const lastLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only run initialization if switching to a different lesson
    if (lastLessonIdRef.current === lesson.id) {
      return;
    }
    lastLessonIdRef.current = lesson.id;

    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    setSelectedAns(null);
    setIsSubmitted(false);
    
    if (lesson.userAnswers) {
      const initialScore = lesson.quizzes.filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length;
      setScore(initialScore);
      
      const allMultipleChoiceSolved = injectedQuizzes.length > 0 && injectedQuizzes.every(q => lesson.userAnswers?.[q.id] !== undefined);
      const isWritingCompleted = Boolean(lesson.userWritingSentence || lesson.userWritingFeedback);
      
      const allSolved = allMultipleChoiceSolved && isWritingCompleted;
      setShowResult(allSolved);
      setSubmittedAnswers(lesson.userAnswers);
      
      if (!allMultipleChoiceSolved) {
        const startIdx = injectedQuizzes.findIndex(q => lesson.userAnswers?.[q.id] === undefined);
        setCurrentIdx(startIdx !== -1 ? startIdx : 0);
      } else if (!isWritingCompleted) {
        // Multiple choice solved, advance directly to the last situational writing question
        setCurrentIdx(injectedQuizzes.length);
      } else {
        setCurrentIdx(0);
      }
    } else {
      setScore(0);
      setShowResult(false);
      setSubmittedAnswers({});
      setCurrentIdx(0);
    }
    
    setSavedWrongId(null);
  }, [lesson.id, lesson.userAnswers, injectedQuizzes, lesson.userWritingSentence, lesson.userWritingFeedback]);

  const totalQuizSteps = activeQuizzes.length + 1;
  const isLastWritingStep = currentIdx === activeQuizzes.length;
  const activeQuestion = activeQuizzes[currentIdx];

  // Global Keyboard Shortcuts Engine for Quiz Solving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      if (showResult) {
        if (e.key === 'r' || e.key === 'R') {
          if (attemptWrongs.length > 0) {
            handleRetryIncorrect();
          } else {
            handleRestart();
          }
        } else if (e.key === 'Enter' || e.key === 'n' || e.key === 'N') {
          if (onLoadNextUnsolvedLesson) onLoadNextUnsolvedLesson();
        }
        return;
      }

      if (!activeQuestion) return;

      if (!isSubmitted) {
        if (e.key === '1' || e.key === 'a' || e.key === 'A') {
          if (activeQuestion.choices.length > 0) handleSelect(0);
        } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
          if (activeQuestion.choices.length > 1) handleSelect(1);
        } else if (e.key === '3' || e.key === 'c' || e.key === 'C') {
          if (activeQuestion.choices.length > 2) handleSelect(2);
        } else if (e.key === '4' || e.key === 'd' || e.key === 'D') {
          if (activeQuestion.choices.length > 3) handleSelect(3);
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (selectedAns !== null) {
            e.preventDefault();
            handleSubmit();
          }
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitted, selectedAns, currentIdx, activeQuizzes, showResult, attemptWrongs.length, activeQuestion]);

  const handlePushToMochi = async (quiz: QuizItem) => {
    if (!mochiApiKey) {
      alert("Mochi API Key가 설정되지 않았습니다. 설정(⚙️) 창에서 키를 등록해 주세요.");
      return;
    }
    setAddingToMochiIds(prev => new Set(prev).add(quiz.id));
    try {
      await onAddQuizToMochi(quiz);
    } catch (err: any) {
      alert("Mochi 카드 추가 실패: " + err.message);
    } finally {
      setAddingToMochiIds(prev => {
        const next = new Set(prev);
        next.delete(quiz.id);
        return next;
      });
    }
  };

  const handleSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedAns(idx);
  };

  const handleSubmit = () => {
    if (selectedAns === null || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = selectedAns === activeQuestion.correctIndex;
    
    const newAnswers = {
      ...submittedAnswers,
      [activeQuestion.id]: selectedAns
    };
    setSubmittedAnswers(newAnswers);

    // Call progress update callback (merge with previous lesson answers if retry)
    if (activeQuizzes.length === injectedQuizzes.length) {
      onProgressUpdate(newAnswers);
    } else {
      const mergedAnswers = {
        ...(lesson.userAnswers || {}),
        ...newAnswers
      };
      onProgressUpdate(mergedAnswers);
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
      if (activeQuestion.isReview) {
        onGraduateReview(activeQuestion.id);
      }
    } else {
      // Add to session wrongs for targeted review
      setSessionWrongs(prev => {
        if (prev.some(q => q.id === activeQuestion.id)) return prev;
        return [...prev, activeQuestion];
      });
      // Track wrong answer and choice for attempt logging
      setAttemptWrongs(prev => {
        if (prev.some(w => w.question === activeQuestion.question)) return prev;
        return [...prev, {
          question: activeQuestion.question,
          choices: activeQuestion.choices,
          userAnswerIndex: selectedAns,
          correctIndex: activeQuestion.correctIndex,
          rationale: activeQuestion.rationale
        }];
      });
      // Automatically save to Wrong Answers Review Room
      onAddWrongAnswer(activeQuestion, selectedAns);
      setSavedWrongId(activeQuestion.id);
    }
  };

  const handleNext = () => {
    const savedAns = selectedAns;
    const currentQ = activeQuestion;

    setSavedWrongId(null);
    setSelectedAns(null);
    setIsSubmitted(false);

    if (currentIdx < activeQuizzes.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else if (currentIdx === activeQuizzes.length - 1) {
      // Save last multiple choice answer before moving to the writing step
      const finalAnswers: Record<string, number> = { ...submittedAnswers };
      if (savedAns !== null && currentQ) {
        finalAnswers[currentQ.id] = savedAns;
      }
      onProgressUpdate(finalAnswers);
      // Advance to the final Situational Writing Question
      setCurrentIdx(activeQuizzes.length);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = () => {
    setShowResult(true);
    const finalScore = score;
    const finalWrongs = [...attemptWrongs];
    const finalAnswers: Record<string, number> = { ...submittedAnswers };

    // Complete quiz in parent state
    if (activeQuizzes.length === injectedQuizzes.length) {
      onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers);
    } else {
      onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers, true);
    }
  };

  const handleRestart = () => {
    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);

    // Reset completed/progress state in parent
    onProgressUpdate({});
    onQuizCompleted(0, 0, [], undefined);
  };

  const handleRetryIncorrect = () => {
    const candidateList = activeQuizzes.length > 0 ? activeQuizzes : (lesson.quizzes || []);
    const wrongs = candidateList.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
    if (wrongs.length === 0) return;
    
    // Automatically launch AI 3-Step Socratic Coaching on the first wrong question
    const firstWrong = wrongs[0];
    const userAns = (submittedAnswers[firstWrong.id] !== undefined && submittedAnswers[firstWrong.id] !== firstWrong.correctIndex)
      ? submittedAnswers[firstWrong.id]
      : (firstWrong.correctIndex === 0 ? 1 : 0);
    setCoachingQuizItem({ quiz: firstWrong, userAns });
  };

  const handleRetryOriginalQuestionFromCoach = (quizItem: QuizItem) => {
    setCoachingQuizItem(null);
    setActiveQuizzes([quizItem]);
    setSubmittedAnswers(prev => {
      const next = { ...prev };
      delete next[quizItem.id];
      return next;
    });
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setShowResult(false);
    setSavedWrongId(null);
  };

  const handleNextWrongCoaching = () => {
    const candidateList = activeQuizzes.length > 0 ? activeQuizzes : (lesson.quizzes || []);
    const wrongs = candidateList.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
    const currentQuizId = coachingQuizItem?.quiz.id;
    const nextIndex = wrongs.findIndex(q => q.id === currentQuizId) + 1;
    if (nextIndex < wrongs.length) {
      const nextWrong = wrongs[nextIndex];
      const userAns = (submittedAnswers[nextWrong.id] !== undefined && submittedAnswers[nextWrong.id] !== nextWrong.correctIndex)
        ? submittedAnswers[nextWrong.id]
        : (nextWrong.correctIndex === 0 ? 1 : 0);
      setCoachingQuizItem({ quiz: nextWrong, userAns });
    } else {
      setCoachingQuizItem(null);
    }
  };

  // Render Result Screen
  if (showResult) {
    const successRate = Math.round((score / activeQuizzes.length) * 100);
    let encourageMsg = "좋은 시도였습니다! 오답 노트를 복습해서 완벽하게 마스터해 보세요. 👍";
    if (successRate === 100) encourageMsg = "와우! 완벽합니다! 모든 문법 개념을 정복하셨습니다. 🎉";
    else if (successRate >= 80) encourageMsg = "아주 훌륭해요! 사소한 실수만 잡으면 완벽하겠어요! 🚀";

    return (
      <div className="animate-fade-in text-center" style={{ padding: '2rem 1rem' }}>
        <div className="eli5-analogy-box" style={{ border: 'none', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', borderRadius: '16px', padding: '2.5rem 1.5rem', marginBottom: '2rem' }}>
          <Sparkles className="pulse-glow" style={{ color: 'var(--primary)', width: '48px', height: '48px', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            퀴즈 세트 완료!
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            "{lesson.title}"
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>객관식 정답</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>
                {score} / {activeQuizzes.length}
              </span>
            </div>
            <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>객관식 정답률</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--secondary)' }}>
                {successRate}%
              </span>
            </div>
            {lesson.userWritingFeedback?.score !== undefined && (
              <>
                <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#f472b6', display: 'block', fontWeight: '700' }}>실전 상황 작문</span>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: '#ec4899' }}>
                    {lesson.userWritingFeedback.score}점
                  </span>
                </div>
              </>
            )}
          </div>

          <p style={{ fontSize: '1rem', color: 'white', fontWeight: '500' }}>
            {encourageMsg}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onBackToStudy} style={{ fontWeight: '800' }}>
            📖 전체 학습자료(1~3단계) 보기
          </button>
          
          {activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length > 0 && (
            <button 
              className="btn btn-accent" 
              onClick={handleRetryIncorrect}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                boxShadow: '0 4px 15px rgba(244,63,94,0.3)',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Zap size={16} />
              <span>⚡ 틀린 문제 1초 마이크로 코칭 후 다시 풀기 ({activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length}개)</span>
            </button>
          )}

          <button className="btn btn-secondary" onClick={handleRestart}>
            <RefreshCw size={15} />
            처음부터 다시 풀기
          </button>

          {onLoadNextUnsolvedLesson && (
            <button 
              className="btn btn-accent" 
              onClick={onLoadNextUnsolvedLesson}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16,185,129,0.2)', fontWeight: '700' }}
            >
              ➡️ 다음 미풀이 학습 {unsolvedLessonsCount !== undefined && unsolvedLessonsCount > 0 ? `(${unsolvedLessonsCount}개 남음)` : ''}
            </button>
          )}
        </div>

        {/* AI 추가 퀴즈 생성 Section */}
        {onGenerateAdditionalQuizzes && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--primary)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white' }}>
                AI 오답 분석 맞춤형 추가 퀴즈 생성
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: '500px' }}>
              틀린 문제들의 유형과 오답 데이터를 분석하여, 해당 단어/표현의 실수를 잡아내기 위한 변형 문제를 새로 생성합니다.
            </p>
            
            {isGeneratingMore ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                <RefreshCw className="animate-spin" size={16} />
                <span>AI가 오답 데이터를 분석하여 추가 문제를 생성하고 있습니다...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <select
                  value={additionalCount}
                  onChange={(e) => setAdditionalCount(Number(e.target.value))}
                  className="input-glow"
                  style={{
                    padding: '0.45rem 2rem 0.45rem 0.75rem',
                    fontSize: '0.85rem',
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value={3}>3 문항</option>
                  <option value={5}>5 문항</option>
                  <option value={8}>8 문항</option>
                  <option value={10}>10 문항</option>
                </select>
                
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    fontWeight: '700'
                  }}
                  onClick={async () => {
                    setIsGeneratingMore(true);
                    try {
                      const newQuizzes = await onGenerateAdditionalQuizzes(additionalCount);
                      if (newQuizzes && newQuizzes.length > 0) {
                        alert(`🎉 ${newQuizzes.length}개의 새로운 실전 문제가 추가 퀴즈 세트로 구성되었습니다! 즉시 문제 풀이가 시작됩니다.`);
                        setActiveQuizzes(newQuizzes);
                        setSessionWrongs([]);
                        setAttemptWrongs([]);
                        setSubmittedAnswers({});
                        setCurrentIdx(0);
                        setSelectedAns(null);
                        setIsSubmitted(false);
                        setScore(0);
                        setShowResult(false);
                        setSavedWrongId(null);
                      }
                    } catch (err: any) {
                      alert(err.message || "추가 퀴즈 생성에 실패했습니다.");
                    } finally {
                      setIsGeneratingMore(false);
                    }
                  }}
                >
                  ⚡ AI 추가 퀴즈 생성
                </button>
              </div>
            )}
          </div>
        )}

        {/* 문항별 상세 풀이 결과 분석 피드백 */}
        <div style={{ marginTop: '2.5rem', textAlign: 'left', maxWidth: '640px', margin: '2.5rem auto 0 auto' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            📖 실전 퀴즈 풀이 결과 분석
          </h4>
          
          {activeQuizzes.map((quiz, qIdx) => {
            const userAnswer = submittedAnswers[quiz.id];
            const isCorrect = userAnswer === quiz.correctIndex;
            
            return (
              <div key={quiz.id} style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.015)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '1.25rem', 
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.5', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ 
                      color: isCorrect ? 'var(--success)' : 'var(--accent)',
                      fontWeight: '900'
                    }}>
                      {isCorrect ? '✓' : '✗'}
                    </span>
                    <span>Q{qIdx + 1}. {quiz.question.replace(/^🔄\s*\[.*?\]\s*/, '')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {!isCorrect && userAnswer !== undefined && userAnswer !== null && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.65rem',
                          flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                        onClick={() => setCoachingQuizItem({ quiz, userAns: userAnswer })}
                      >
                        <Zap size={12} />
                        1초 마이크로 코칭
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', flexShrink: 0 }}
                      onClick={() => handlePushToMochi(quiz)}
                      disabled={addingToMochiIds.has(quiz.id)}
                    >
                      {addingToMochiIds.has(quiz.id) ? "추가됨" : "⚡ Mochi 추가"}
                    </button>
                  </div>
                </h5>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {quiz.choices.map((choice, cIdx) => {
                    const isThisCorrect = cIdx === quiz.correctIndex;
                    const isThisUserSelection = cIdx === userAnswer;
                    
                    let style: React.CSSProperties = {
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s'
                    };
                    
                    if (isThisCorrect) {
                      style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                      style.borderColor = 'var(--success)';
                      style.color = 'var(--success)';
                      style.fontWeight = '700';
                    } else if (isThisUserSelection) {
                      style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                      style.borderColor = 'var(--accent)';
                      style.color = 'var(--accent)';
                      style.fontWeight = '700';
                    }
                    
                    return (
                      <div key={cIdx} style={style}>
                        <span>{choice}</span>
                        {isThisCorrect && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            정답
                          </span>
                        )}
                        {isThisUserSelection && !isThisCorrect && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            내가 선택한 오답
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="eli5-analogy-box" style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', lineHeight: '1.5', color: 'var(--text-muted)', margin: 0, borderRadius: '8px', borderStyle: 'dashed' }}>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>💡 AI 상세 해설:</strong>
                  {quiz.rationale}
                </div>
              </div>
            );
          })}

          {/* Final Question: Situational Writing Result Analysis Card */}
          {(lesson.userWritingSentence || lesson.userWritingFeedback) && (
            <div style={{
              backgroundColor: 'rgba(236, 72, 153, 0.03)',
              border: '1.5px solid rgba(236, 72, 153, 0.35)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1rem',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: (lesson.userWritingFeedback?.score ?? 0) >= 90 ? 'var(--success)' : '#f472b6', fontWeight: '900' }}>
                    {(lesson.userWritingFeedback?.score ?? 0) >= 90 ? '✓' : '✍️'}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                    Q{activeQuizzes.length + 1}. 마지막 문제: 1초 실전 상황 작문
                  </span>
                </div>
                {lesson.userWritingFeedback?.score !== undefined && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    backgroundColor: (lesson.userWritingFeedback.score >= 90) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                    color: (lesson.userWritingFeedback.score >= 90) ? '#6ee7b7' : '#f472b6',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    border: `1px solid ${(lesson.userWritingFeedback.score >= 90) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(236, 72, 153, 0.4)'}`
                  }}>
                    상황 완성도 {lesson.userWritingFeedback.score}점
                  </span>
                )}
              </div>

              {/* Scenario Context */}
              {(lesson.writingTemplate?.scenarios?.[0]?.situation || lesson.writingTemplate?.situation) && (
                <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#f472b6', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                    🏢 실전 상황
                  </span>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {lesson.writingTemplate?.scenarios?.[0]?.situation || lesson.writingTemplate?.situation}
                  </p>
                </div>
              )}

              {/* User Written Sentence */}
              {lesson.userWritingSentence && (
                <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginBottom: '0.2rem' }}>
                    내가 작성한 영문:
                  </span>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8' }}>
                    "{lesson.userWritingSentence}"
                  </p>
                </div>
              )}

              {/* AI Corrected Sentence */}
              {lesson.userWritingFeedback?.correctedSentence && (
                <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '700', display: 'block', marginBottom: '0.2rem' }}>
                    ✨ AI 상황 맞춤 교정 완성 문장:
                  </span>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#10b981' }}>
                    "{lesson.userWritingFeedback.correctedSentence}"
                  </p>
                </div>
              )}

              {/* Native Alternative Expression */}
              {lesson.userWritingFeedback?.nativeAlternative && lesson.userWritingFeedback.nativeAlternative !== lesson.userWritingFeedback.correctedSentence && (
                <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'rgba(6, 182, 212, 0.06)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#22d3ee', fontWeight: '700', display: 'block', marginBottom: '0.2rem' }}>
                    🌟 원어민 실사용 추천 대체 표현:
                  </span>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'white' }}>
                    "{lesson.userWritingFeedback.nativeAlternative}"
                  </p>
                </div>
              )}

              {/* AI Feedback explanation */}
              {lesson.userWritingFeedback?.feedback && (
                <div className="eli5-analogy-box" style={{ padding: '0.75rem 0.9rem', fontSize: '0.8rem', lineHeight: '1.5', color: '#cbd5e1', margin: 0, borderRadius: '8px', borderStyle: 'dashed' }}>
                  <strong style={{ color: '#f472b6', display: 'block', marginBottom: '0.25rem' }}>💬 AI 첨삭 피드백:</strong>
                  {lesson.userWritingFeedback.feedback}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round(((currentIdx + 1) / totalQuizSteps) * 100));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress & Stat */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>실전 테스트 진행 상태</span>
          <span style={{ fontWeight: '700', color: isLastWritingStep ? '#f472b6' : 'var(--primary)' }}>
            {currentIdx + 1} / {totalQuizSteps} 문제 {isLastWritingStep ? '(마지막 문제: 1초 실전 상황 작문)' : '(객관식 점검)'}
          </span>
        </div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progressPercent}%`, background: isLastWritingStep ? 'linear-gradient(90deg, var(--primary) 0%, #ec4899 100%)' : undefined }}></div>
        </div>
      </div>

      {isLastWritingStep ? (
        /* Final Question: Situational Writing Practice */
        <div style={{ flex: 1 }}>
          <WritingPracticeSection
            lesson={lesson}
            apiKey={apiKey}
            onSaveWriting={onSaveWriting}
            isQuizMode={true}
            onCompleteQuiz={handleFinishQuiz}
          />
        </div>
      ) : (
        /* Multiple Choice Question Card */
        <div style={{ flex: 1 }}>
          {activeQuestion && (
            <>
              <div className="quiz-question-box" style={{ whiteSpace: 'pre-line' }}>
                {activeQuestion.question}
              </div>

              <div className="quiz-choices">
                {activeQuestion.choices.map((choice, idx) => {
                  let choiceClass = "choice-btn";
                  let iconElement: any = null;

                  if (selectedAns === idx) {
                    choiceClass += " selected";
                  }

                  if (isSubmitted) {
                    if (idx === activeQuestion.correctIndex) {
                      choiceClass += " correct";
                      iconElement = <Check size={18} style={{ color: 'var(--success)' }} />;
                    } else if (selectedAns === idx) {
                      choiceClass += " incorrect";
                      iconElement = <X size={18} style={{ color: 'var(--error)' }} />;
                    }
                  }

                  return (
                    <button
                      key={idx}
                      className={choiceClass}
                      onClick={() => handleSelect(idx)}
                      disabled={isSubmitted}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          background: 'rgba(139, 92, 246, 0.2)', 
                          color: '#c084fc', 
                          padding: '0.1rem 0.35rem', 
                          borderRadius: '4px',
                          fontWeight: '700',
                          border: '1px solid rgba(139, 92, 246, 0.3)'
                        }}>
                          [{idx + 1}]
                        </span>
                        <strong style={{ marginRight: '0.2rem', opacity: 0.6 }}>{String.fromCharCode(65 + idx)}.</strong>
                        {choice}
                      </span>
                      {iconElement}
                    </button>
                  );
                })}
              </div>

              {/* Action Button */}
              {!isSubmitted ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  disabled={selectedAns === null}
                  onClick={handleSubmit}
                >
                  <span>정답 제출 및 해설 확인</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.85, background: 'rgba(0,0,0,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>[Enter ↵]</span>
                </button>
              ) : (
                <button
                  className="btn btn-accent"
                  style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)' }}
                  onClick={handleNext}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    {currentIdx < activeQuizzes.length - 1 ? (
                      <>
                        다음 문제 풀기 <span style={{ fontSize: '0.75rem', opacity: 0.85, background: 'rgba(0,0,0,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>[Enter ↵]</span>
                        <ArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        마지막 문제: 실전 상황 작문 풀기 <span style={{ fontSize: '0.75rem', opacity: 0.85, background: 'rgba(0,0,0,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>[Enter ↵]</span>
                        <Sparkles size={16} />
                      </>
                    )}
                  </span>
                </button>
              )}

              {/* Keyboard Shortcuts Indicator Bar */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'rgba(0,0,0,0.25)',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '0.75rem',
                flexWrap: 'wrap',
                gap: '0.4rem'
              }}>
                <span style={{ fontWeight: '600' }}>⌨️ 키보드 단축키</span>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: '#c084fc' }}>1~4 / A~D</strong>: 보기 선택</span>
                  <span><strong style={{ color: '#10b981' }}>Enter / Space</strong>: 제출 &amp; 다음</span>
                </div>
              </div>

              {/* Answer Rationale Display */}
              {isSubmitted && (
                <div className="quiz-explanation-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: selectedAns === activeQuestion.correctIndex ? 'var(--success)' : 'var(--accent)', fontWeight: '700' }}>
                      {selectedAns === activeQuestion.correctIndex ? (
                        <>
                          <Check size={18} />
                          <span>정답입니다! 훌륭해요!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={18} />
                          <span>오답입니다. 아래 해설과 1초 마이크로 코칭을 확인해 보세요.</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {selectedAns !== activeQuestion.correctIndex && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                          onClick={() => setCoachingQuizItem({ quiz: activeQuestion, userAns: selectedAns! })}
                        >
                          <Zap size={14} />
                          <span>⚡ 1초 마이크로 코칭</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        onClick={() => handlePushToMochi(activeQuestion)}
                        disabled={addingToMochiIds.has(activeQuestion.id)}
                      >
                        {addingToMochiIds.has(activeQuestion.id) ? "추가 완료" : "⚡ Mochi 오답노트 추가"}
                      </button>
                    </div>
                  </div>

                  <div style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    {activeQuestion.rationale}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3-Stage AI Wrong Answer Coaching Modal */}
      {coachingQuizItem && (
        <WrongAnswerCoachModal
          isOpen={!!coachingQuizItem}
          onClose={() => setCoachingQuizItem(null)}
          quizItem={coachingQuizItem.quiz}
          userAnswerIndex={coachingQuizItem.userAns}
          lessonTitle={lesson.title}
          apiKey={apiKey}
          onAddQuizToMochi={onAddQuizToMochi}
          onGraduate={() => {
            onGraduateReview(coachingQuizItem.quiz.id);
            setCoachingQuizItem(null);
          }}
          onRetryOriginalQuestion={handleRetryOriginalQuestionFromCoach}
          remainingWrongsCount={(() => {
            const wrongList = activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
            const currentWrongIdx = wrongList.findIndex(q => q.id === coachingQuizItem.quiz.id);
            return currentWrongIdx !== -1 ? Math.max(0, wrongList.length - 1 - currentWrongIdx) : 0;
          })()}
          onNextWrongQuestion={handleNextWrongCoaching}
        />
      )}
    </div>
  );
};
