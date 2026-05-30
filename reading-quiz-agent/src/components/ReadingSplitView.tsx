import { useState, useEffect } from 'react';
import { HelpCircle, Brain, Volume2, Sparkles, Check, X, ArrowLeft, ArrowRight, BookmarkCheck, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Share2 } from 'lucide-react';
import { ReadingLesson, ReadingQuizItem, ReadingVocabulary } from '../types';

interface ReadingSplitViewProps {
  lesson: ReadingLesson;
  onAddWrongAnswer: (quizItem: ReadingQuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number) => void;
  onOpenShare: () => void;
  onBackToCreator?: () => void;
  injectedQuizzes: ReadingQuizItem[]; // Contains standard + review wrong answers injected
  onGraduateReview: (wrongId: string) => void; // Call when review question is answered correctly
}

export const ReadingSplitView: React.FC<ReadingSplitViewProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onOpenShare,
  onBackToCreator,
  injectedQuizzes,
  onGraduateReview
}) => {
  // UI preferences
  const [fontSize, setFontSize] = useState<number>(16);
  const [activeParagraphId, setActiveParagraphId] = useState<number | null>(null);
  const [rightActiveTab, setRightActiveTab] = useState<'quiz' | 'vocab'>('quiz');

  // Quiz States
  const [activeQuizzes, setActiveQuizzes] = useState<ReadingQuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<ReadingQuizItem[]>([]);

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
      
      // If this was an injected review question, graduate it!
      if (activeQuestion.isReview) {
        onGraduateReview(activeQuestion.id);
      }
    } else {
      // Add to session wrongs for targeted review
      setSessionWrongs(prev => {
        if (prev.some(q => q.id === activeQuestion.id)) return prev;
        return [...prev, activeQuestion];
      });
      // Save to Wrong Answers local storage
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

  return (
    <div className="split-view-container animate-fade-in">
      
      {/* LEFT PANEL: The English Reading Passage Reader */}
      <div className="glass-panel passage-panel">
        {/* Panel controls header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: '700', letterSpacing: '1px' }}>
            ENGLISH PASSAGE
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.5rem' }} 
              onClick={() => setFontSize(prev => Math.max(13, prev - 1.5))}
              title="글씨 축소"
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fontSize}px</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.5rem' }} 
              onClick={() => setFontSize(prev => Math.min(23, prev + 1.5))}
              title="글씨 확대"
            >
              <ZoomIn size={15} />
            </button>
          </div>
        </div>

        {/* The Passage text content */}
        <div className="scroll-content" style={{ fontSize: `${fontSize}px` }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>
            💡 문단을 마우스로 클릭하면 한글 해석과 구문 분석이 바로 아래 표시됩니다.
          </p>

          {lesson.paragraphs.map((p) => {
            const isActive = activeParagraphId === p.id;
            return (
              <div 
                key={p.id} 
                className={`paragraph-block ${isActive ? 'active' : ''}`}
                onClick={() => setActiveParagraphId(isActive ? null : p.id)}
              >
                <div style={{ color: 'white', lineHeight: '1.75' }}>
                  {p.englishText}
                </div>
                {isActive && (
                  <div className="translation-text">
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.2rem' }}>
                      문단 번역 및 핵심 해석
                    </span>
                    {p.koreanTranslation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Interactive Dashboard (Quiz / Vocab / Share) */}
      <div className="glass-panel passage-panel">
        {/* Navigation for right panel tabs */}
        <div style={{ padding: '0.85rem 1.25rem 0 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '-1px' }}>
            <button
              className={`btn`}
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                color: rightActiveTab === 'quiz' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: rightActiveTab === 'quiz' ? '2px solid var(--primary)' : '2px solid transparent',
                borderRadius: '0',
                padding: '0.5rem 0.75rem',
                fontWeight: rightActiveTab === 'quiz' ? '700' : '400'
              }}
              onClick={() => setRightActiveTab('quiz')}
            >
              인터랙티브 퀴즈
            </button>
            <button
              className={`btn`}
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                color: rightActiveTab === 'vocab' ? 'var(--secondary)' : 'var(--text-secondary)',
                borderBottom: rightActiveTab === 'vocab' ? '2px solid var(--secondary)' : '2px solid transparent',
                borderRadius: '0',
                padding: '0.5rem 0.75rem',
                fontWeight: rightActiveTab === 'vocab' ? '700' : '400'
              }}
              onClick={() => setRightActiveTab('vocab')}
            >
              핵심 어휘장
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', transform: 'translateY(-4px)' }}>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={onOpenShare}>
              <Share2 size={13} />
              공유
            </button>
            {onBackToCreator && (
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={onBackToCreator}>
                목록
              </button>
            )}
          </div>
        </div>

        {/* Tab contents */}
        <div className="scroll-content">
          
          {/* TAB 1: INTERACTIVE QUIZZES PLAYER */}
          {rightActiveTab === 'quiz' && (
            <div className="animate-fade-in" style={{ height: '100%' }}>
              {showResult ? (
                /* QUIZ COMPLETED CARD */
                <div className="text-center" style={{ padding: '1rem 0' }}>
                  <div className="eli5-analogy-box" style={{ border: 'none', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)', borderRadius: '16px', padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
                    <Sparkles className="pulse-glow" style={{ color: 'var(--secondary)', width: '40px', height: '40px', margin: '0 auto 0.75rem auto' }} />
                    <h3 style={{ fontSize: '1.45rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                      퀴즈 세트 완료!
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      실전 훈련 결과를 확인하세요.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>정답률</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--secondary)' }}>
                          {Math.round((score / activeQuizzes.length) * 100)}%
                        </span>
                      </div>
                      <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>점수</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)' }}>
                          {score} / {activeQuizzes.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                    {sessionWrongs.length > 0 && (
                      <button 
                        className="btn btn-accent" 
                        onClick={handleRetryIncorrect}
                        style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
                      >
                        ✍️ 틀린 문제만 다시 풀기 ({sessionWrongs.length})
                      </button>
                    )}
                    
                    <button className="btn btn-primary" onClick={handleRestart} style={{ width: '100%' }}>
                      <RefreshCw size={16} />
                      이 지문으로 다시 풀기
                    </button>
                  </div>
                </div>
              ) : (
                /* PLAY ACTIVE QUESTION */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Progress info */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>실전 테스트</span>
                      <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>
                        {currentIdx + 1} / {activeQuizzes.length} 문항
                      </span>
                    </div>
                    <div className="quiz-progress-bar" style={{ height: '4px' }}>
                      <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>

                  {/* Question details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      {/* Active Quiz Categories badges */}
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {activeQuestion.type === 'comprehension' ? '📚 독해 이해' : '🔤 문맥 어휘'}
                      </span>
                      
                      {/* Spaced repetition review warning badge */}
                      {activeQuestion.isReview && (
                        <span className="badge badge-review" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                          🔄 과거 오답 복습 문제
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: '500', color: 'white', whiteSpace: 'pre-line', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                      {activeQuestion.question}
                    </div>

                    {/* Choices buttons */}
                    <div className="quiz-choices">
                      {activeQuestion.choices.map((choice, idx) => {
                        let btnClass = "choice-btn";
                        let icon: any = null;

                        if (selectedAns === idx) btnClass += " selected";
                        
                        if (isSubmitted) {
                          if (idx === activeQuestion.correctIndex) {
                            btnClass += " correct";
                            icon = <Check size={16} style={{ color: 'var(--success)' }} />;
                          } else if (selectedAns === idx) {
                            btnClass += " incorrect";
                            icon = <X size={16} style={{ color: 'var(--error)' }} />;
                          }
                        }

                        return (
                          <button
                            key={idx}
                            className={btnClass}
                            disabled={isSubmitted}
                            onClick={() => handleSelect(idx)}
                          >
                            <span>
                              <strong style={{ marginRight: '0.4rem', opacity: 0.5 }}>{String.fromCharCode(65 + idx)}.</strong>
                              {choice}
                            </span>
                            {icon}
                          </button>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    {!isSubmitted ? (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.85rem' }}
                        disabled={selectedAns === null}
                        onClick={handleSubmit}
                      >
                        답안 검증 및 Rationale 보기
                      </button>
                    ) : (
                      <button
                        className="btn btn-accent"
                        style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)' }}
                        onClick={handleNext}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          {currentIdx < activeQuizzes.length - 1 ? (
                            <>
                              다음 문제 넘어가기
                              <ArrowRight size={15} />
                            </>
                          ) : (
                            <>
                              시험 완료! 결과 보기
                              <Sparkles size={15} />
                            </>
                          )}
                        </span>
                      </button>
                    )}

                    {/* Explanations rationale box */}
                    {isSubmitted && (
                      <div className="quiz-explanation-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                          {selectedAns === activeQuestion.correctIndex ? (
                            <span className="explanation-heading success" style={{ fontSize: '0.9rem' }}>
                              <BookmarkCheck size={18} /> 정답입니다! {activeQuestion.isReview && "오답 노트 정복 완료! 🎉"}
                            </span>
                          ) : (
                            <span className="explanation-heading error" style={{ fontSize: '0.9rem' }}>
                              <AlertCircle size={18} /> 오답입니다. 오답 자동 보관됨 ✍️
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                          {activeQuestion.rationale}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KEY VOCABULARY LIST FLASHCARDS */}
          {rightActiveTab === 'vocab' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                💡 본문에서 엄선한 핵심 학술 어휘 목록입니다. 마우스를 올리면 입체적인 쉐도우 효과가 연출됩니다.
              </div>

              {lesson.vocabulary.map((v, idx) => (
                <div key={idx} className="vocab-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1.25rem', color: 'white', fontFamily: 'var(--font-display)', fontWeight: '700' }}>
                      {v.word}
                    </h4>
                    {v.pronunciation && (
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', background: 'rgba(6,182,212,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        /{v.pronunciation}/
                      </span>
                    )}
                  </div>

                  <p style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '700' }}>
                    {v.meaning}
                  </p>

                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                    <strong>Ex:</strong> "{v.sentence}"
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
