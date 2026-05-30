import { useState, useEffect } from 'react';
import { Check, X, Sparkles, AlertCircle, RefreshCw, ArrowRight, BookmarkCheck } from 'lucide-react';
import { Lesson, QuizItem } from '../types';

interface QuizPanelProps {
  lesson: Lesson;
  onAddWrongAnswer: (quizItem: QuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number) => void;
  onBackToStudy: () => void;
  injectedQuizzes: QuizItem[];
  onGraduateReview: (wrongId: string) => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onBackToStudy,
  injectedQuizzes,
  onGraduateReview
}) => {
  const [activeQuizzes, setActiveQuizzes] = useState<QuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<QuizItem[]>([]);

  useEffect(() => {
    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
  }, [lesson.id]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);

  const activeQuestion = activeQuizzes[currentIdx];
  const progressPercent = activeQuizzes.length > 0 ? ((currentIdx) / activeQuizzes.length) * 100 : 0;

  const handleSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedAns(idx);
  };

  const handleSubmit = () => {
    if (selectedAns === null || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = selectedAns === activeQuestion.correctIndex;
    
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
      onQuizCompleted(score + (selectedAns === activeQuestion.correctIndex ? 1 : 0), activeQuizzes.length);
    }
  };

  const handleRestart = () => {
    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
  };

  const handleRetryIncorrect = () => {
    setActiveQuizzes([...sessionWrongs]);
    setSessionWrongs([]);
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
          <button className="btn btn-secondary" onClick={onBackToStudy}>
            학습자료 다시보기
          </button>
          
          {sessionWrongs.length > 0 && (
            <button 
              className="btn btn-accent" 
              onClick={handleRetryIncorrect}
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
            >
              ✍️ 틀린 문제만 다시 풀기 ({sessionWrongs.length})
            </button>
          )}

          <button className="btn btn-primary" onClick={handleRestart}>
            <RefreshCw size={16} />
            처음부터 다시 풀기
          </button>
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
