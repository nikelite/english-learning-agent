import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, X, Sparkles, AlertCircle, RefreshCw, ArrowRight, 
  Printer, HelpCircle, FileText, ClipboardList
} from 'lucide-react';
import type { LabLesson, LabQuizItem } from '../types';

interface CorrectionRoomProps {
  lesson: LabLesson;
  onAddWrongAnswer: (quizItem: LabQuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number, wrongQuestionsList: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => void;
  onProgressUpdate: (userAnswers: Record<string, number>) => void;
  onGraduateReview: (wrongId: string) => void;
}

export const CorrectionRoom: React.FC<CorrectionRoomProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onProgressUpdate,
  onGraduateReview
}) => {
  const [activeQuizzes, setActiveQuizzes] = useState<LabQuizItem[]>(() => lesson.quizzes || []);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number>>(() => lesson.userAnswers || {});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);
  const [attemptWrongs, setAttemptWrongs] = useState<any[]>([]);

  const lastLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastLessonIdRef.current === lesson.id) {
      return;
    }
    lastLessonIdRef.current = lesson.id;

    setActiveQuizzes(lesson.quizzes || []);
    setSubmittedAnswers(lesson.userAnswers || {});
    setAttemptWrongs([]);
    setSelectedAns(null);
    setIsSubmitted(false);
    
    if (lesson.userAnswers) {
      const initialScore = (lesson.quizzes || []).filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length;
      setScore(initialScore);
      
      const allSolved = (lesson.quizzes || []).length > 0 && (lesson.quizzes || []).every(q => lesson.userAnswers?.[q.id] !== undefined);
      setShowResult(allSolved);
      
      if (!allSolved) {
        const startIdx = (lesson.quizzes || []).findIndex(q => lesson.userAnswers?.[q.id] === undefined);
        setCurrentIdx(startIdx !== -1 ? startIdx : 0);
      } else {
        setCurrentIdx(0);
      }
    } else {
      setScore(0);
      setShowResult(false);
      setCurrentIdx(0);
    }
    setSavedWrongId(null);
  }, [lesson.id, lesson.userAnswers, lesson.quizzes]);

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
    onProgressUpdate(newAnswers);

    if (isCorrect) {
      setScore(prev => prev + 1);
      if ((activeQuestion as any).isReview) {
        onGraduateReview(activeQuestion.id);
      }
    } else {
      setAttemptWrongs(prev => {
        if (prev.some(w => w.id === activeQuestion.id)) return prev;
        return [...prev, {
          quizItem: activeQuestion,
          userAnswerIndex: selectedAns,
          timestamp: Date.now()
        }];
      });
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
        if (!finalWrongs.some(w => w.quizItem.id === activeQuestion.id)) {
          finalWrongs.push({
            quizItem: activeQuestion,
            userAnswerIndex: selectedAns,
            timestamp: Date.now()
          });
        }
      }

      const finalAnswers = { ...submittedAnswers };
      if (selectedAns !== null) {
        finalAnswers[activeQuestion.id] = selectedAns;
      }

      onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers);
    }
  };

  const handleRestart = () => {
    setActiveQuizzes(lesson.quizzes || []);
    setAttemptWrongs([]);
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);

    onProgressUpdate({});
    onQuizCompleted(0, 0, [], {});
  };

  const handleRetryIncorrect = () => {
    const wrongs = (lesson.quizzes || []).filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
    setActiveQuizzes(wrongs);
    setAttemptWrongs([]);
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
  };

  // Helper function for custom high-contrast substring highlighting
  const renderHighlightedText = (text: string, isOriginal: boolean) => {
    if (!text) return '';
    if (!lesson.corrections || lesson.corrections.length === 0) return text;

    // Build the highlighting rules list
    const items = lesson.corrections.map(corr => ({
      target: isOriginal ? corr.original : corr.corrected,
      type: corr.type,
      explanation: corr.explanation,
      colorClass: isOriginal ? `diff-original diff-type-${corr.type}` : `diff-corrected diff-type-${corr.type}`
    })).filter(item => item.target && item.target.trim() !== '');

    let parts: { text: string; isHighlighted: boolean; item?: any }[] = [{ text, isHighlighted: false }];
    
    for (const item of items) {
      const target = item.target;
      const newParts: typeof parts = [];
      for (const part of parts) {
        if (part.isHighlighted) {
          newParts.push(part);
          continue;
        }
        
        let startIdx = 0;
        let textToSearch = part.text;
        
        while (true) {
          const foundIdx = textToSearch.indexOf(target, startIdx);
          if (foundIdx === -1) {
            break;
          }
          
          if (foundIdx > 0) {
            newParts.push({ text: textToSearch.substring(0, foundIdx), isHighlighted: false });
          }
          
          newParts.push({ 
            text: target, 
            isHighlighted: true, 
            item 
          });
          
          textToSearch = textToSearch.substring(foundIdx + target.length);
          startIdx = 0;
        }
        
        if (textToSearch.length > 0) {
          newParts.push({ text: textToSearch, isHighlighted: false });
        }
      }
      parts = newParts;
    }

    return (
      <>
        {parts.map((p, idx) => {
          if (p.isHighlighted) {
            return (
              <span 
                key={idx} 
                className={p.item.colorClass} 
                title={`${p.item.type.toUpperCase()}: ${p.item.explanation}`}
                style={{ cursor: 'help' }}
              >
                {p.text}
              </span>
            );
          }
          return p.text;
        })}
      </>
    );
  };

  const getCorrectionTypeLabel = (type: string) => {
    switch (type) {
      case 'grammar': return '문법';
      case 'expression': return '표현';
      case 'vocab': return '어휘';
      case 'flow': return '흐름';
      default: return '교정';
    }
  };

  const getCorrectionTypeEmoji = (type: string) => {
    switch (type) {
      case 'grammar': return '📝';
      case 'expression': return '🗣️';
      case 'vocab': return '📖';
      case 'flow': return '🌊';
      default: return '✏️';
    }
  };

  return (
    <div className="correction-container animate-fade-in">
      {/* Printable Report View (Visible only in @media print) */}
      <div className="print-report-only">
        <h1 style={{ color: '#10b981', textAlign: 'center', marginBottom: '4px', fontSize: '24px' }}>🧪 LAB.AGENT STUDY REPORT</h1>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>일시: {new Date(lesson.createdAt).toLocaleString()}</p>
        
        <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '14px', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>지문 상세</h2>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '80px', padding: '4px 0' }}>제목:</td>
                <td>{lesson.title}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px 0' }}>페르소나:</td>
                <td>{lesson.persona}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px 0' }}>스타일:</td>
                <td>{lesson.style === 'spoken' ? '구어체 (Spoken)' : '문어체 (Written)'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0', color: '#dc2626' }}>[Original Text]</h3>
          <div style={{ fontSize: '12px', padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {lesson.sourceText}
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0', color: '#16a34a' }}>[Corrected Text]</h3>
          <div style={{ fontSize: '12px', padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {lesson.correctedText}
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0' }}>종합 피드백</h3>
          <div style={{ fontSize: '12px', padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', lineHeight: '1.5' }}>
            {lesson.overallFeedback}
          </div>
        </div>

        <div style={{ pageBreakBefore: 'always' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 10px 0', borderBottom: '2px solid #10b981', paddingBottom: '4px' }}>세부 첨삭 리스트</h3>
          {lesson.corrections.map((corr, idx) => (
            <div key={idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
              <span style={{ fontWeight: 'bold', color: '#10b981', marginRight: '6px' }}>[{getCorrectionTypeLabel(corr.type)}]</span>
              <del style={{ color: '#ef4444', marginRight: '6px' }}>{corr.original}</del>
              <ins style={{ color: '#10b981', textDecoration: 'none', fontWeight: 'bold', marginRight: '8px' }}>➔ {corr.corrected}</ins>
              <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '11px', lineHeight: '1.4' }}>{corr.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Screen Panel */}
      <div className="correction-main-layout">
        {/* Left Side: Analysis Room */}
        <div className="analysis-room glass-panel">
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <span className="badge" style={{ background: 'var(--primary)', color: 'white', marginRight: '0.5rem' }}>
                {lesson.style === 'spoken' ? '🗣️ 구어체' : '📝 문어체'}
              </span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                👤 {lesson.persona}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.4rem', color: 'white', fontFamily: 'var(--font-display)' }}>
                {lesson.title}
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => window.print()}
                title="인쇄 및 PDF 저장"
              >
                <Printer size={16} />
                <span>PDF 출력</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="diff-box">
            <div className="diff-pane">
              <div className="pane-header red">
                <span>Original Text</span>
                <span className="pane-badge">수정 전</span>
              </div>
              <div className="pane-body">
                {renderHighlightedText(lesson.sourceText, true)}
              </div>
            </div>

            <div className="diff-pane">
              <div className="pane-header green">
                <span>Corrected Text</span>
                <span className="pane-badge success">수정 후</span>
              </div>
              <div className="pane-body">
                {renderHighlightedText(lesson.correctedText, false)}
              </div>
            </div>
          </div>

          {/* Overall Advice Box */}
          <div className="eli5-analogy-box" style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '700' }}>
              <Sparkles size={16} />
              AI 종합 첨삭 피드백
            </h4>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {lesson.overallFeedback}
            </p>
          </div>

          {/* Detailed Correction Card List */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={18} style={{ color: 'var(--primary)' }} />
              상세 교정 리스트 ({lesson.corrections.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lesson.corrections.map((corr) => (
                <div key={corr.id} className={`correction-card border-type-${corr.type}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`type-tag tag-${corr.type}`}>
                        {getCorrectionTypeEmoji(corr.type)} {getCorrectionTypeLabel(corr.type)}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#ef4444', textDecoration: 'line-through', background: 'rgba(239, 68, 68, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {corr.original}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>➔</span>
                    <span style={{ color: 'var(--success)', fontWeight: '700', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {corr.corrected}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.825rem', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                    {corr.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Quiz Practice Room */}
        <div className="practice-room glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white' }}>
              <FileText size={18} style={{ color: 'var(--accent)' }} />
              실전 연습 퀴즈
            </h3>
            {activeQuizzes.length > 0 && !showResult && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                정답률: {score} / {currentIdx}
              </span>
            )}
          </div>

          {activeQuizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <HelpCircle size={36} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', margin: 0 }}>이 학습 자료에는 생성된 퀴즈가 없습니다.</p>
            </div>
          ) : showResult ? (
            /* Quiz Result Screen */
            <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
              <div className="eli5-analogy-box" style={{ border: 'none', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', borderRadius: '16px', padding: '2rem 1rem', marginBottom: '1.5rem' }}>
                <Sparkles className="pulse-glow" style={{ color: 'var(--primary)', width: '40px', height: '40px', margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                  퀴즈 테스트 완료!
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', margin: '1.25rem 0' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>정답 개수</span>
                    <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--primary)' }}>
                      {score} / {activeQuizzes.length}
                    </span>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>정답률</span>
                    <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--secondary)' }}>
                      {Math.round((score / activeQuizzes.length) * 100)}%
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '500', margin: 0 }}>
                  {score === activeQuizzes.length 
                    ? "완벽합니다! 모든 실전 영작 교정을 마스터하셨습니다. 🎉" 
                    : "오답 노트에 저장된 문항을 복습하여 실수를 완전히 줄여 보세요! 👍"}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length > 0 && (
                  <button 
                    className="btn btn-accent" 
                    onClick={handleRetryIncorrect}
                    style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 12px rgba(244,63,94,0.15)' }}
                  >
                    ✍️ 오답만 풀기 ({activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length})
                  </button>
                )}

                <button className="btn btn-primary" onClick={handleRestart}>
                  <RefreshCw size={14} />
                  처음부터 다시
                </button>
              </div>

              {/* Individual Question Detail Analysis */}
              <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'white' }}>
                  📝 상세 풀이 결과
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeQuizzes.map((quiz, qIdx) => {
                    const userAnswer = submittedAnswers[quiz.id];
                    const isCorrect = userAnswer === quiz.correctIndex;
                    
                    return (
                      <div key={quiz.id} style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.015)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '10px', 
                        padding: '1rem',
                      }}>
                        <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.4', display: 'flex', gap: '0.4rem' }}>
                          <span style={{ color: isCorrect ? 'var(--success)' : 'var(--accent)', fontWeight: '900' }}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                          Q{qIdx + 1}. {quiz.question}
                        </h5>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                          {quiz.choices.map((choice, cIdx) => {
                            const isThisCorrect = cIdx === quiz.correctIndex;
                            const isThisUserSelection = cIdx === userAnswer;
                            
                            let boxStyle: React.CSSProperties = {
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            };
                            
                            if (isThisCorrect) {
                              boxStyle.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                              boxStyle.borderColor = 'var(--success)';
                              boxStyle.color = 'var(--success)';
                            } else if (isThisUserSelection) {
                              boxStyle.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                              boxStyle.borderColor = 'var(--accent)';
                              boxStyle.color = 'var(--accent)';
                            }
                            
                            return (
                              <div key={cIdx} style={boxStyle}>
                                <span>{choice}</span>
                                {isThisCorrect && <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontWeight: '700' }}>정답</span>}
                                {isThisUserSelection && !isThisCorrect && <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: '700' }}>선택</span>}
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="eli5-analogy-box" style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, borderRadius: '6px', borderStyle: 'dashed' }}>
                          <strong>💡 AI 해설:</strong> {quiz.rationale}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Quiz Active Room */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Progress Bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>진행 단계</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
                    {currentIdx + 1} / {activeQuizzes.length} 문항
                  </span>
                </div>
                <div className="quiz-progress-bar">
                  <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              {/* Question Text */}
              <div className="quiz-question-box" style={{ whiteSpace: 'pre-line', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                {activeQuestion.question}
              </div>

              {/* Choice Buttons */}
              <div className="quiz-choices" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {activeQuestion.choices.map((choice, idx) => {
                  let choiceClass = "choice-btn";
                  let iconElement = null;

                  if (selectedAns === idx) {
                    choiceClass += " selected";
                  }

                  if (isSubmitted) {
                    if (idx === activeQuestion.correctIndex) {
                      choiceClass += " correct";
                      iconElement = <Check size={16} style={{ color: 'var(--success)' }} />;
                    } else if (selectedAns === idx) {
                      choiceClass += " incorrect";
                      iconElement = <X size={16} style={{ color: 'var(--error)' }} />;
                    }
                  }

                  return (
                    <button
                      key={idx}
                      className={choiceClass}
                      onClick={() => handleSelect(idx)}
                      disabled={isSubmitted}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}
                    >
                      <span>
                        <strong style={{ marginRight: '0.4rem', opacity: 0.4 }}>{String.fromCharCode(65 + idx)}.</strong>
                        {choice}
                      </span>
                      {iconElement}
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto' }}>
                {!isSubmitted ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.8rem' }}
                    disabled={selectedAns === null}
                    onClick={handleSubmit}
                  >
                    정답 제출
                  </button>
                ) : (
                  <button
                    className="btn btn-accent"
                    style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)' }}
                    onClick={handleNext}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                      {currentIdx < activeQuizzes.length - 1 ? (
                        <>
                          다음 문제
                          <ArrowRight size={14} />
                        </>
                      ) : (
                        <>
                          결과 보기
                          <Sparkles size={14} />
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>

              {/* Explanation Panel */}
              {isSubmitted && (
                <div className="quiz-explanation-box" style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontWeight: '700', color: selectedAns === activeQuestion.correctIndex ? 'var(--success)' : 'var(--accent)' }}>
                    {selectedAns === activeQuestion.correctIndex ? <Check size={16} /> : <AlertCircle size={16} />}
                    <span>{selectedAns === activeQuestion.correctIndex ? '정답입니다!' : '오답입니다.'}</span>
                    {selectedAns !== activeQuestion.correctIndex && savedWrongId === activeQuestion.id && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>
                        오답 노트 보관됨 ✍️
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    {activeQuestion.rationale}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
