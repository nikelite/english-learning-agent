import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles, AlertCircle, RefreshCw, ArrowRight, BookmarkCheck } from 'lucide-react';
import { Lesson, QuizItem } from '../types';

interface QuizPanelProps {
  lesson: Lesson;
  onAddWrongAnswer: (quizItem: QuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number, wrongQuestionsList: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => void;
  onProgressUpdate: (userAnswers: Record<string, number>) => void;
  onBackToStudy: () => void;
  injectedQuizzes: QuizItem[];
  onGraduateReview: (wrongId: string) => void;
  onLoadNextUnsolvedLesson?: () => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onProgressUpdate,
  onBackToStudy,
  injectedQuizzes,
  onGraduateReview,
  onLoadNextUnsolvedLesson
}) => {
  const [activeQuizzes, setActiveQuizzes] = useState<QuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<QuizItem[]>([]);
  const [attemptWrongs, setAttemptWrongs] = useState<any[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number>>(() => lesson.userAnswers || {});

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
      
      const allSolved = injectedQuizzes.length > 0 && injectedQuizzes.every(q => lesson.userAnswers?.[q.id] !== undefined);
      setShowResult(allSolved);
      setSubmittedAnswers(lesson.userAnswers);
      
      if (!allSolved) {
        const startIdx = injectedQuizzes.findIndex(q => lesson.userAnswers?.[q.id] === undefined);
        setCurrentIdx(startIdx !== -1 ? startIdx : 0);
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
  }, [lesson.id, lesson.userAnswers, injectedQuizzes]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);

  const activeQuestion = activeQuizzes[currentIdx];
  const progressPercent = activeQuizzes.length > 0 ? (currentIdx / activeQuizzes.length) * 100 : 0;

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
    setSavedWrongId(null);
    setSelectedAns(null);
    setIsSubmitted(false);

    if (currentIdx < activeQuizzes.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setShowResult(true);
      const finalScore = score;
      let finalWrongs = [...attemptWrongs];
      if (selectedAns !== null && selectedAns !== activeQuestion.correctIndex) {
        if (!finalWrongs.some(w => w.question === activeQuestion.question)) {
          finalWrongs.push({
            question: activeQuestion.question,
            choices: activeQuestion.choices,
            userAnswerIndex: selectedAns,
            correctIndex: activeQuestion.correctIndex,
            rationale: activeQuestion.rationale
          });
        }
      }

      const finalAnswers: Record<string, number> = {};
      Object.entries(submittedAnswers).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          finalAnswers[key] = val;
        }
      });
      if (selectedAns !== null) {
        finalAnswers[activeQuestion.id] = selectedAns;
      }

      // Complete quiz in parent state
      if (activeQuizzes.length === injectedQuizzes.length) {
        onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers);
      } else {
        onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers, true);
      }
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
    const wrongs = activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
    setActiveQuizzes(wrongs);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    // Reset answers for retry
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
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

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>정답 개수</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>
                {score} / {activeQuizzes.length}
              </span>
            </div>
            <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>최종 정답률</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--secondary)' }}>
                {successRate}%
              </span>
            </div>
          </div>

          <p style={{ fontSize: '1rem', color: 'white', fontWeight: '500' }}>
            {encourageMsg}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {onLoadNextUnsolvedLesson && (
            <button 
              className="btn btn-accent" 
              onClick={onLoadNextUnsolvedLesson}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16,185,129,0.2)', fontWeight: '700' }}
            >
              ➡️ 다음 미풀이 학습 풀기
            </button>
          )}

          <button className="btn btn-secondary" onClick={onBackToStudy}>
            학습자료 다시보기
          </button>
          
          {activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length > 0 && (
            <button 
              className="btn btn-accent" 
              onClick={handleRetryIncorrect}
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
            >
              ✍️ 틀린 문제만 다시 풀기 ({activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length})
            </button>
          )}

          <button className="btn btn-primary" onClick={handleRestart}>
            <RefreshCw size={16} />
            처음부터 다시 풀기
          </button>
        </div>

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
                <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.5', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ 
                    color: isCorrect ? 'var(--success)' : 'var(--accent)',
                    fontWeight: '900'
                  }}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                  Q{qIdx + 1}. {quiz.question.replace(/^🔄\s*\[.*?\]\s*/, '')}
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
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress & Stat */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>실전 테스트 진행 상태</span>
          <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
            {currentIdx + 1} / {activeQuizzes.length} 문제
          </span>
        </div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Quiz Card */}
      <div style={{ flex: 1 }}>
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
                <span>
                  <strong style={{ marginRight: '0.5rem', opacity: 0.5 }}>{String.fromCharCode(65 + idx)}.</strong>
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
            style={{ width: '100%', padding: '1rem' }}
            disabled={selectedAns === null}
            onClick={handleSubmit}
          >
            정답 제출 및 해설 확인
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
                  다음 문제 풀기
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  최종 결과 보러가기
                  <Sparkles size={16} />
                </>
              )}
            </span>
          </button>
        )}

        {/* Answer Rationale Display */}
        {isSubmitted && (
          <div className="quiz-explanation-box">
            {selectedAns === activeQuestion.correctIndex ? (
              <div className="explanation-heading success">
                <BookmarkCheck size={20} />
                <span>정답입니다! 🎉</span>
              </div>
            ) : (
              <div className="explanation-heading error" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} />
                  <span>아쉽게 틀렸습니다!</span>
                </div>
                {savedWrongId === activeQuestion.id && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent)', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                    오답 노트 자동 보관됨 ✍️
                  </span>
                )}
              </div>
            )}

            <div style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {activeQuestion.rationale}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
