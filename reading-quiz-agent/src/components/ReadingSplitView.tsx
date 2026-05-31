import { useState, useEffect } from 'react';
import { HelpCircle, Brain, Volume2, Sparkles, Check, X, ArrowLeft, ArrowRight, BookmarkCheck, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Share2 } from 'lucide-react';
import { ReadingLesson, ReadingQuizItem, ReadingVocabulary, SentenceAnalysis } from '../types';
import { generateCustomVocabItem, analyzeParagraphSentences } from '../geminiService';

interface ReadingSplitViewProps {
  lesson: ReadingLesson;
  onAddWrongAnswer: (quizItem: ReadingQuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number, wrongQuestionsList: any[], userAnswers?: Record<string, number>) => void;
  onOpenShare: () => void;
  onBackToCreator?: () => void;
  injectedQuizzes: ReadingQuizItem[]; // Contains standard + review wrong answers injected
  onGraduateReview: (wrongId: string) => void; // Call when review question is answered correctly
  apiKey: string;
  onAddCustomVocabulary: (newVocab: ReadingVocabulary) => void;
}

export const ReadingSplitView: React.FC<ReadingSplitViewProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onOpenShare,
  onBackToCreator,
  injectedQuizzes,
  onGraduateReview,
  apiKey,
  onAddCustomVocabulary
}) => {
  // UI preferences
  const [fontSize, setFontSize] = useState<number>(16);
  const [activeParagraphId, setActiveParagraphId] = useState<number | null>(null);
  const [rightActiveTab, setRightActiveTab] = useState<'quiz' | 'vocab'>('quiz');

  // Custom Vocab Addition States
  const [customInput, setCustomInput] = useState<string>('');
  const [isCustomVocabLoading, setIsCustomVocabLoading] = useState<boolean>(false);
  const [customVocabError, setCustomVocabError] = useState<string | null>(null);

  // Sentence click states
  const [activeSentenceText, setActiveSentenceText] = useState<string | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<number, SentenceAnalysis[]>>({});
  const [analyzingParagraphId, setAnalyzingParagraphId] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Quiz States
  const [activeQuizzes, setActiveQuizzes] = useState<ReadingQuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<ReadingQuizItem[]>([]);
  const [attemptWrongs, setAttemptWrongs] = useState<any[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number>>(() => lesson.userAnswers || {});

  useEffect(() => {
    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    
    // Clear sentence states on lesson change
    setActiveSentenceText(null);
    setAnalysisCache({});
    setAnalyzingParagraphId(null);
    setAnalysisError(null);
    setActiveParagraphId(null);
    
    if (lesson.userAnswers) {
      const initialScore = lesson.quizzes.filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length;
      setScore(initialScore);
      setShowResult(true);
      setSubmittedAnswers(lesson.userAnswers);
    } else {
      setScore(0);
      setShowResult(false);
      setSubmittedAnswers({});
    }
    
    setSavedWrongId(null);
  }, [lesson.id, lesson.userAnswers]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);

  const handleSentenceClick = async (paragraph: any, sentence: string) => {
    if (analyzingParagraphId !== null) return;
    setAnalysisError(null);

    // If clicking already active sentence, close it
    if (activeSentenceText === sentence && activeParagraphId === paragraph.id) {
      setActiveSentenceText(null);
      setActiveParagraphId(null);
      return;
    }

    setActiveParagraphId(paragraph.id);
    setActiveSentenceText(sentence);

    if (analysisCache[paragraph.id]) {
      return;
    }

    if (!apiKey) {
      setAnalysisError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 등록하시면 실시간 AI 문장 상세 과외 분석이 활성화됩니다.");
      return;
    }

    setAnalyzingParagraphId(paragraph.id);
    try {
      const result = await analyzeParagraphSentences(paragraph.englishText, lesson.passageText, apiKey);
      setAnalysisCache(prev => ({
        ...prev,
        [paragraph.id]: result
      }));
    } catch (err: any) {
      console.error("Failed to analyze paragraph sentences:", err);
      setAnalysisError(err.message || "AI 문장 분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzingParagraphId(null);
    }
  };

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

    setSubmittedAnswers(prev => ({
      ...prev,
      [activeQuestion.id]: selectedAns
    }));

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

      // Only complete quiz in parent state if we are playing the full lesson (not a local incorrect retry)
      if (activeQuizzes.length === injectedQuizzes.length) {
        onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers);
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
    
    // Reset completed state in parent
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

  const handleAddNewVocab = async () => {
    const word = customInput.trim();
    if (!word) return;
    if (!apiKey) {
      setCustomVocabError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 먼저 등록해 주세요.");
      return;
    }

    setIsCustomVocabLoading(true);
    setCustomVocabError(null);
    try {
      const newItem = await generateCustomVocabItem(lesson.passageText, word, apiKey);
      onAddCustomVocabulary(newItem);
      setCustomInput('');
    } catch (err: any) {
      setCustomVocabError(err.message || "표현 분석 및 추가에 실패했습니다.");
    } finally {
      setIsCustomVocabLoading(false);
    }
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
            💡 공부하고 싶은 문장을 마우스로 클릭하면 해당 문장의 한글 번역, 구문 분석(문법), 핵심 어휘 및 문맥 설명을 실시간 AI 과외 서비스로 볼 수 있습니다.
          </p>

          {lesson.paragraphs.map((p) => {
            const isActive = activeParagraphId === p.id;
            // Split paragraph englishText into complete sentences
            const sentences = p.englishText.match(/[^.!?]+[.!?]+(\s+|$)/g)?.map(s => s.trim()) || [p.englishText];
            
            // Fuzzy match the cached sentence analysis
            const paragraphAnalyses = analysisCache[p.id];
            const activeAnalysis = paragraphAnalyses?.find(
              a => a.sentence.trim().toLowerCase() === activeSentenceText?.trim().toLowerCase() ||
                   a.sentence.includes(activeSentenceText || '') ||
                   (activeSentenceText || '').includes(a.sentence)
            ) || paragraphAnalyses?.[0]; // Fallback to first

            return (
              <div 
                key={p.id} 
                className={`paragraph-block ${isActive ? 'active' : ''}`}
                style={{ padding: '1rem', margin: '0.5rem 0', borderRadius: '12px' }}
              >
                <div style={{ color: 'white', lineHeight: '1.8' }}>
                  {sentences.map((sentence, sIdx) => {
                    const isSentenceActive = activeSentenceText === sentence && activeParagraphId === p.id;
                    return (
                      <span 
                        key={sIdx}
                        className={`interactive-sentence ${isSentenceActive ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSentenceClick(p, sentence);
                        }}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'inline',
                          backgroundColor: isSentenceActive ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                          color: isSentenceActive ? 'var(--primary)' : 'inherit',
                          borderBottom: isSentenceActive ? '2px solid var(--primary)' : 'none',
                          fontWeight: isSentenceActive ? '600' : 'normal'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSentenceActive) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = '#fff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSentenceActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'inherit';
                          }
                        }}
                      >
                        {sentence}{' '}
                      </span>
                    );
                  })}
                </div>

                {/* 1. Loading state */}
                {analyzingParagraphId === p.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(6, 182, 212, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                    <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
                    <span>AI가 이 문단의 모든 문장 정밀 분석 중... (첫 1회만 수행)</span>
                  </div>
                )}

                {/* 2. Error state */}
                {isActive && analysisError && activeSentenceText && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <span>⚠️ {analysisError}</span>
                    <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }} onClick={() => handleSentenceClick(p, activeSentenceText)}>
                      다시 시도
                    </button>
                  </div>
                )}

                {/* 3. Detailed Sentence Analysis Display */}
                {isActive && activeAnalysis && activeSentenceText && (
                  <div className="sentence-analysis-box animate-slide-down" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                      {/* Vocabulary & Expressions */}
                      {((activeAnalysis.vocabulary && activeAnalysis.vocabulary.length > 0) || (activeAnalysis.expressions && activeAnalysis.expressions.length > 0)) && (
                        <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>
                            🔤 주요 어휘 &amp; 표현
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {activeAnalysis.vocabulary?.map((v: any, vIdx: number) => (
                              <div key={vIdx} style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                                <strong style={{ color: 'var(--secondary)' }}>{v.word}</strong>: {v.meaning}
                              </div>
                            ))}
                            {activeAnalysis.expressions?.map((e: any, eIdx: number) => (
                              <div key={eIdx} style={{ fontSize: '0.8rem', color: '#e2e8f0', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.25rem' }}>
                                <strong style={{ color: 'var(--success)' }}>{e.expression}</strong>: {e.meaning}
                                {e.contextNote && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>({e.contextNote})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grammar structure */}
                      {activeAnalysis.grammar && (
                        <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.25rem' }}>
                            ⚖️ 구문 &amp; 문법 구조
                          </span>
                          <p style={{ margin: 0, fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                            {activeAnalysis.grammar}
                          </p>
                        </div>
                      )}

                      {/* Context Analysis */}
                      {activeAnalysis.context && (
                        <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.25rem' }}>
                            🌐 문맥 &amp; 흐름 분석
                          </span>
                          <p style={{ margin: 0, fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                            {activeAnalysis.context}
                          </p>
                        </div>
                      )}
                    </div>
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
                    {activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length > 0 && (
                      <button 
                        className="btn btn-accent" 
                        onClick={handleRetryIncorrect}
                        style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
                      >
                        ✍️ 틀린 문제만 다시 풀기 ({activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length})
                      </button>
                    )}
                    
                    <button className="btn btn-primary" onClick={handleRestart} style={{ width: '100%' }}>
                      <RefreshCw size={16} />
                      이 지문으로 다시 풀기
                    </button>
                  </div>

                  {/* 문항별 상세 풀이 결과 분석 피드백 */}
                  <div style={{ marginTop: '2.5rem', textAlign: 'left' }}>
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

          {/* TAB 2: KEY STUDY LIST FLASHCARDS (VOCAB, GRAMMAR, EXPRESSIONS, CONTEXT) */}
          {rightActiveTab === 'vocab' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Context-aware Word/Expression Addition Form */}
              <div className="vocab-card" style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px dashed var(--primary)', padding: '1.25rem', marginBottom: '0.25rem', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)' }}>
                  <Sparkles size={14} /> AI 문맥 분석 단어/구문/문법 추가
                </h4>
                <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: '1.4' }}>
                  공부하고 싶은 단어, 표현, 숙어나 특정 문법 구문을 입력하세요. AI가 본문 문맥(Context)을 분석하여 뜻과 원문 활용예문, 상세 학습 가이드를 자동으로 채워 넣습니다!
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="예: deter, upon receiving, tannin 등 본문 단어나 표현"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="input-glow"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', flex: 1 }}
                    disabled={isCustomVocabLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customInput.trim() && !isCustomVocabLoading) {
                        handleAddNewVocab();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddNewVocab}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flexShrink: 0 }}
                    disabled={isCustomVocabLoading || !customInput.trim()}
                  >
                    {isCustomVocabLoading ? "분석 중..." : "추가"}
                  </button>
                </div>
                {customVocabError && (
                  <div style={{ color: 'var(--error)', fontSize: '0.725rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>⚠️ {customVocabError}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                💡 본문에서 엄선한 핵심 어휘, 문법 요소, 중요 표현 및 맥락 정보의 상세 분석 목록입니다.
              </div>

              {lesson.vocabulary.map((v, idx) => {
                const itemType = v.type || 'vocabulary';
                let typeBadge: any = null;
                if (itemType === 'vocabulary') typeBadge = <span className="badge badge-vocabulary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>🔤 주요어휘</span>;
                else if (itemType === 'grammar') typeBadge = <span className="badge badge-grammar" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⚖️ 문법구조</span>;
                else if (itemType === 'expression') typeBadge = <span className="badge badge-expression" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>💬 핵심표현</span>;
                else if (itemType === 'context') typeBadge = <span className="badge badge-context" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>🌐 맥락정보</span>;

                return (
                  <div key={idx} className="vocab-card" style={{ borderLeft: `4px solid ${
                    itemType === 'vocabulary' ? 'var(--secondary)' : 
                    itemType === 'grammar' ? 'var(--primary)' : 
                    itemType === 'expression' ? 'var(--success)' : 
                    'var(--accent)'
                  }` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {typeBadge}
                        <h4 style={{ fontSize: '1.2rem', color: 'white', fontFamily: 'var(--font-display)', fontWeight: '700' }}>
                          {v.word}
                        </h4>
                      </div>
                      {v.pronunciation && (
                        <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', background: 'rgba(6,182,212,0.08)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          /{v.pronunciation}/
                        </span>
                      )}
                    </div>

                    <p style={{ color: 'white', fontSize: '0.925rem', fontWeight: '600', marginTop: '0.25rem' }}>
                      {v.meaning}
                    </p>

                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                      <strong>Context Ex:</strong> "{v.sentence}"
                    </div>

                    {v.contextNote && (
                      <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.15rem', letterSpacing: '0.5px' }}>
                          💡 상세 분석 및 학습 가이드
                        </span>
                        {v.contextNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
