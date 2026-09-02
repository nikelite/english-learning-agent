import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, X, ArrowRight, RefreshCw, BookmarkCheck, AlertCircle, HelpCircle, BookOpen } from 'lucide-react';
import { ReadingQuizItem, WrongAnswerCoachingStep1Data, WrongAnswerCoachingStep2Data, WrongAnswerCoachingStep3Data, TransferQuizItem } from '../types';
import { generateWrongAnswerCoachingStep1, generateWrongAnswerCoachingStep2, generateWrongAnswerCoachingStep3 } from '../geminiService';

interface WrongAnswerCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizItem: ReadingQuizItem | null;
  userAnswerIndex: number;
  lessonTitle?: string;
  passageContext?: string;
  apiKey: string;
  onAddQuizToMochi?: (quiz: ReadingQuizItem | TransferQuizItem) => Promise<void>;
  onGraduate?: () => void;
  onRetryOriginalQuestion?: (quizItem: ReadingQuizItem) => void;
  remainingWrongsCount?: number;
  onNextWrongQuestion?: () => void;
}

export const WrongAnswerCoachModal: React.FC<WrongAnswerCoachModalProps> = ({
  isOpen,
  onClose,
  quizItem,
  userAnswerIndex,
  lessonTitle,
  passageContext,
  apiKey,
  onAddQuizToMochi,
  onGraduate,
  onRetryOriginalQuestion,
  remainingWrongsCount = 0,
  onNextWrongQuestion
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
  const [step1Data, setStep1Data] = useState<WrongAnswerCoachingStep1Data | null>(null);
  const [loadingStep1, setLoadingStep1] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 State
  const [step2Data, setStep2Data] = useState<WrongAnswerCoachingStep2Data | null>(null);
  const [loadingStep2, setLoadingStep2] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3 State
  const [step3Data, setStep3Data] = useState<WrongAnswerCoachingStep3Data | null>(null);
  const [loadingStep3, setLoadingStep3] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [transferAnswers, setTransferAnswers] = useState<Record<string, number>>({});
  const [addingMochiIds, setAddingMochiIds] = useState<Set<string>>(new Set());

  // Reset and load Step 1 when modal opens or quiz changes
  useEffect(() => {
    if (isOpen && quizItem) {
      setCurrentStep(1);
      setStep1Data(null);
      setStep1Error(null);
      setStep2Data(null);
      setStep2Error(null);
      setStep3Data(null);
      setStep3Error(null);
      setTransferAnswers({});
      setAddingMochiIds(new Set());

      fetchStep1();
    }
  }, [isOpen, quizItem?.id, userAnswerIndex]);

  if (!isOpen || !quizItem) return null;

  const userWrongAnswerText = quizItem.choices[userAnswerIndex] || `보기 ${String.fromCharCode(65 + userAnswerIndex)}`;
  const correctAnswerText = quizItem.choices[quizItem.correctIndex] || `보기 ${String.fromCharCode(65 + quizItem.correctIndex)}`;

  // Fetch Step 1
  const fetchStep1 = async () => {
    if (!apiKey) {
      setStep1Error("Gemini API Key가 필요합니다. 우측 상단 설정(⚙️)에서 키를 입력해 주세요.");
      return;
    }
    setLoadingStep1(true);
    setStep1Error(null);
    try {
      const data = await generateWrongAnswerCoachingStep1(
        quizItem.question,
        quizItem.choices,
        userWrongAnswerText,
        apiKey,
        passageContext
      );
      setStep1Data(data);
    } catch (err: any) {
      setStep1Error(err.message || "1단계 힌트 생성에 실패했습니다.");
    } finally {
      setLoadingStep1(false);
    }
  };

  // Fetch Step 2
  const fetchStep2 = async () => {
    if (step2Data || loadingStep2) return;
    if (!apiKey) {
      setStep2Error("Gemini API Key가 필요합니다.");
      return;
    }
    setLoadingStep2(true);
    setStep2Error(null);
    try {
      const data = await generateWrongAnswerCoachingStep2(
        quizItem.question,
        userWrongAnswerText,
        correctAnswerText,
        quizItem.rationale,
        apiKey,
        passageContext
      );
      setStep2Data(data);
    } catch (err: any) {
      setStep2Error(err.message || "2단계 뉘앙스 대조 생성에 실패했습니다.");
    } finally {
      setLoadingStep2(false);
    }
  };

  // Fetch Step 3
  const fetchStep3 = async () => {
    if (step3Data || loadingStep3) return;
    if (!apiKey) {
      setStep2Error("Gemini API Key가 필요합니다.");
      return;
    }
    setLoadingStep3(true);
    setStep3Error(null);
    try {
      const data = await generateWrongAnswerCoachingStep3(
        quizItem.question,
        userWrongAnswerText,
        correctAnswerText,
        apiKey
      );
      setStep3Data(data);
    } catch (err: any) {
      setStep3Error(err.message || "3단계 변형 문제 생성에 실패했습니다.");
    } finally {
      setLoadingStep3(false);
    }
  };

  const handleGoToStep2 = () => {
    setCurrentStep(2);
    if (!step2Data) fetchStep2();
  };

  const handleGoToStep3 = () => {
    setCurrentStep(3);
    if (!step3Data) fetchStep3();
  };

  const handlePushTransferToMochi = async (tQuiz: TransferQuizItem) => {
    if (!onAddQuizToMochi) return;
    setAddingMochiIds(prev => new Set(prev).add(tQuiz.id));
    try {
      await onAddQuizToMochi({
        id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        question: tQuiz.question,
        choices: tQuiz.choices,
        correctIndex: tQuiz.correctIndex,
        rationale: tQuiz.rationale,
        type: 'comprehension'
      });
    } catch (err: any) {
      alert(err.message || "Mochi 추가 실패");
      setAddingMochiIds(prev => {
        const next = new Set(prev);
        next.delete(tQuiz.id);
        return next;
      });
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Brain size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>AI 3단계 소크라테스 오답 코칭</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#c084fc' }}>
                  Step {currentStep}/3
                </span>
              </h3>
              {lessonTitle && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                  "{lessonTitle}"
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 3-Step Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            style={{
              flex: 1,
              padding: '0.75rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentStep === 1 ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: currentStep === 1 ? '#c084fc' : 'var(--text-muted)',
              borderBottom: currentStep === 1 ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            1. 힌트 탐구 (소크라테스)
          </button>

          <button
            type="button"
            onClick={handleGoToStep2}
            style={{
              flex: 1,
              padding: '0.75rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentStep === 2 ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: currentStep === 2 ? '#22d3ee' : 'var(--text-muted)',
              borderBottom: currentStep === 2 ? '2px solid var(--secondary)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            2. 뉘앙스 대조 &amp; 함정
          </button>

          <button
            type="button"
            onClick={handleGoToStep3}
            style={{
              flex: 1,
              padding: '0.75rem 0.5rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentStep === 3 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: currentStep === 3 ? '#6ee7b7' : 'var(--text-muted)',
              borderBottom: currentStep === 3 ? '2px solid var(--success)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            3. 실전 변형 문제 (2문항)
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Target Question Summary Banner */}
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              틀린 문제 문항
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
              {quizItem.question.replace(/^🔄\s*\[.*?\]\s*/, '')}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                선택한 오답: <strong>{userWrongAnswerText}</strong>
              </span>
              {currentStep >= 2 && (
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  실제 정답: <strong>{correctAnswerText}</strong>
                </span>
              )}
            </div>
          </div>

          {/* ================= STEP 1: SOCRATIC GUIDANCE ================= */}
          {currentStep === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingStep1 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                    소크라테스식 힌트와 질문을 구성하고 있습니다...
                  </p>
                </div>
              ) : step1Error ? (
                <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem' }}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                  {step1Error}
                  <button className="btn btn-secondary btn-sm" onClick={fetchStep1} style={{ marginLeft: '0.5rem' }}>다시 시도</button>
                </div>
              ) : step1Data ? (
                <>
                  {/* Passage Clue Excerpt (본문 직접 발췌) */}
                  {step1Data.passageExcerpt && (
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      border: '1.5px solid rgba(59, 130, 246, 0.3)',
                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#60a5fa', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>
                        <BookOpen size={16} />
                        <span>📖 본문 결정적 단서 문장 발췌</span>
                      </div>
                      <p style={{ fontSize: '1rem', color: '#ffffff', fontWeight: '600', lineHeight: '1.6', margin: '0 0 0.5rem 0', fontStyle: 'italic', backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                        "{step1Data.passageExcerpt}"
                      </p>
                      {step1Data.excerptTranslation && (
                        <p style={{ fontSize: '0.85rem', color: '#93c5fd', margin: 0, lineHeight: '1.5' }}>
                          <strong style={{ color: '#bfdbfe' }}>한글 해석:</strong> {step1Data.excerptTranslation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Connection / Bridge Explanation (발췌문과 문제의 연결 고리) */}
                  {step1Data.connectionExplanation && (
                    <div style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#34d399', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        <Sparkles size={16} />
                        <span>🔗 발췌 문장과 문제의 연결 고리</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.55', margin: 0 }}>
                        {step1Data.connectionExplanation}
                      </p>
                    </div>
                  )}

                  {/* Socratic Hint */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <HelpCircle size={18} />
                      <span>💡 소크라테스 힌트 탐구</span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: '#f8fafc', lineHeight: '1.6', margin: 0 }}>
                      {step1Data.socraticHint}
                    </p>
                  </div>

                  {/* Reflective Question */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <Sparkles size={18} />
                      <span>🤔 스스로 생각해보기</span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: 'white', fontWeight: '700', lineHeight: '1.6', margin: 0 }}>
                      "{step1Data.reflectiveQuestion}"
                    </p>
                  </div>

                  {/* Guided Clue Bullets */}
                  {step1Data.guidedChoices && step1Data.guidedChoices.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {step1Data.guidedChoices.map((clue, idx) => (
                        <div key={idx} style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '0.85rem',
                          color: '#cbd5e1'
                        }}>
                          📌 {clue}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next Step Action Button */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleGoToStep2}
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
                    >
                      <span>2단계: 정답 공개 &amp; 뉘앙스 대조 보기</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ================= STEP 2: NUANCE CONTRAST ================= */}
          {currentStep === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingStep2 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--secondary)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                    실사용 맥락 뉘앙스 대조 및 핵심 표현을 분석 중입니다...
                  </p>
                </div>
              ) : step2Error ? (
                <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem' }}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                  {step2Error}
                  <button className="btn btn-secondary btn-sm" onClick={fetchStep2} style={{ marginLeft: '0.5rem' }}>다시 시도</button>
                </div>
              ) : step2Data ? (
                <>
                  {/* Nuance Contrast */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                    border: '1px solid rgba(6, 182, 212, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#22d3ee', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <span>⚖️ 실사용 맥락 뉘앙스 대조 (오답 vs 정답)</span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: '#f8fafc', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>
                      {step2Data.nuanceContrast}
                    </p>
                  </div>

                  {/* Collocations */}
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>🤝 원어민이 자주 쓰는 필수 짝꿍 표현 (Collocations)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {step2Data.collocations.map((colloc, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', fontWeight: '700' }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white' }}>
                              {colloc.phrase}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              ({colloc.meaning})
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.4rem 0 0 0', fontStyle: 'italic', lineHeight: '1.5' }}>
                            "{colloc.example}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Step Action Button */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentStep(1)}
                      style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                    >
                      1단계 다시보기
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleGoToStep3}
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)' }}
                    >
                      <span>3단계: 변형 문제로 실전 검증하기</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ================= STEP 3: FAR TRANSFER QUIZZES ================= */}
          {currentStep === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingStep3 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--success)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                    방금 틀린 개념을 체화할 수 있는 새로운 맥락의 실전 변형 문제 2개를 생성하고 있습니다...
                  </p>
                </div>
              ) : step3Error ? (
                <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem' }}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                  {step3Error}
                  <button className="btn btn-secondary btn-sm" onClick={fetchStep3} style={{ marginLeft: '0.5rem' }}>다시 시도</button>
                </div>
              ) : step3Data ? (
                <>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    💡 새로운 문맥에서 동일한 개념을 적용해 보세요:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {step3Data.transferQuizzes.map((tQuiz, tIdx) => {
                      const userChoice = transferAnswers[tQuiz.id];
                      const isSolved = userChoice !== undefined;
                      const isCorrect = isSolved && userChoice === tQuiz.correctIndex;

                      return (
                        <div 
                          key={tQuiz.id || tIdx}
                          style={{
                            padding: '1.25rem',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSolved ? (isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.08)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'white', lineHeight: '1.5' }}>
                              <span style={{ color: 'var(--primary)', marginRight: '0.4rem' }}>변형 Q{tIdx + 1}.</span>
                              {tQuiz.question}
                            </h5>
                            {onAddQuizToMochi && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', flexShrink: 0, marginLeft: '0.5rem' }}
                                onClick={() => handlePushTransferToMochi(tQuiz)}
                                disabled={addingMochiIds.has(tQuiz.id)}
                              >
                                {addingMochiIds.has(tQuiz.id) ? "Mochi 추가됨" : "⚡ Mochi 추가"}
                              </button>
                            )}
                          </div>

                          {tQuiz.translation && (
                            <div style={{ fontSize: '0.8rem', color: '#93c5fd', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '0.35rem 0.65rem', borderRadius: '6px', borderLeft: '2px solid #3b82f6' }}>
                              <span style={{ fontWeight: '600' }}>💡 문맥 해석:</span> {tQuiz.translation}
                            </div>
                          )}

                          {/* Choices */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {tQuiz.choices.map((choice, cIdx) => {
                              const isThisCorrect = cIdx === tQuiz.correctIndex;
                              const isThisUserSelected = cIdx === userChoice;

                              let choiceBg = 'rgba(255, 255, 255, 0.04)';
                              let choiceBorder = '1px solid rgba(255, 255, 255, 0.08)';
                              let choiceColor = 'white';

                              if (isSolved) {
                                if (isThisCorrect) {
                                  choiceBg = 'rgba(16, 185, 129, 0.15)';
                                  choiceBorder = '1px solid #10b981';
                                  choiceColor = '#6ee7b7';
                                } else if (isThisUserSelected) {
                                  choiceBg = 'rgba(239, 68, 68, 0.15)';
                                  choiceBorder = '1px solid #ef4444';
                                  choiceColor = '#fca5a5';
                                }
                              }

                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => {
                                    if (!isSolved) {
                                      setTransferAnswers(prev => ({ ...prev, [tQuiz.id]: cIdx }));
                                    }
                                  }}
                                  disabled={isSolved}
                                  style={{
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: '8px',
                                    backgroundColor: choiceBg,
                                    border: choiceBorder,
                                    color: choiceColor,
                                    textAlign: 'left',
                                    fontSize: '0.85rem',
                                    fontWeight: isThisCorrect || isThisUserSelected ? '700' : '500',
                                    cursor: isSolved ? 'default' : 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  <span>{String.fromCharCode(65 + cIdx)}. {choice}</span>
                                  {isSolved && isThisCorrect && (
                                    <span style={{ fontSize: '0.7rem', backgroundColor: '#10b981', color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                      정답
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Rationale if solved */}
                          {isSolved && (
                            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                              <strong style={{ color: isCorrect ? '#6ee7b7' : '#fca5a5', display: 'block', marginBottom: '0.2rem' }}>
                                {isCorrect ? "✅ 정답입니다!" : "❌ 아쉽게 틀렸습니다."}
                              </strong>
                              {tQuiz.rationale}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Completion Banner & Action Buttons */}
                  <div style={{
                    marginTop: '1rem',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    textAlign: 'center'
                  }}>
                    <Sparkles size={24} style={{ color: 'var(--success)', margin: '0 auto 0.5rem auto' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: '0 0 0.25rem 0' }}>
                      3단계 오답 코칭 워크플로우를 완주하셨습니다! 🏆
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
                      소크라테스식 힌트 ➔ 뉘앙스 대조 ➔ 변형 실전 적용까지 완벽하게 체화되었습니다.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {onRetryOriginalQuestion && (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            onRetryOriginalQuestion(quizItem);
                            onClose();
                          }}
                          style={{
                            padding: '0.65rem 1.35rem',
                            fontSize: '0.9rem',
                            fontWeight: '800',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
                            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <Sparkles size={16} />
                          <span>🎯 본 문제 바로 다시 풀기</span>
                        </button>
                      )}

                      {onNextWrongQuestion && remainingWrongsCount > 0 && (
                        <button
                          className="btn btn-accent"
                          onClick={onNextWrongQuestion}
                          style={{
                            padding: '0.65rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <span>➡️ 다음 오답 코칭 ({remainingWrongsCount}개 남음)</span>
                          <ArrowRight size={15} />
                        </button>
                      )}

                      {onGraduate && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            onGraduate();
                            onClose();
                          }}
                          style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <BookmarkCheck size={16} />
                          <span>오답 마스터 완료 (졸업)</span>
                        </button>
                      )}

                      <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem' }}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
