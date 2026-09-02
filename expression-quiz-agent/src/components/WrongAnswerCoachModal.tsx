import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, X, ArrowRight, RefreshCw, BookmarkCheck, AlertCircle, HelpCircle, SkipForward } from 'lucide-react';
import { QuizItem, WrongAnswerCoachingStep1Data, WrongAnswerCoachingStep2Data, WrongAnswerCoachingStep3Data, TransferQuizItem } from '../types';
import { generateWrongAnswerCoachingStep1, generateWrongAnswerCoachingStep2, generateWrongAnswerCoachingStep3 } from '../geminiService';

interface WrongAnswerCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizItem: QuizItem | null;
  userAnswerIndex: number;
  lessonTitle?: string;
  apiKey: string;
  onAddQuizToMochi?: (quiz: QuizItem | TransferQuizItem) => Promise<void>;
  onGraduate?: () => void;
  onRetryOriginalQuestion?: (quizItem: QuizItem) => void;
  remainingWrongsCount?: number;
  onNextWrongQuestion?: () => void;
}

export const WrongAnswerCoachModal: React.FC<WrongAnswerCoachModalProps> = ({
  isOpen,
  onClose,
  quizItem,
  userAnswerIndex,
  lessonTitle,
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
  const [step1SelectedChoice, setStep1SelectedChoice] = useState<number | null>(null);

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
      setStep1SelectedChoice(null);
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
        apiKey
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
        apiKey
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
      setStep3Error("Gemini API Key가 필요합니다.");
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
        rationale: tQuiz.rationale
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
              boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)'
            }}>
              <Brain size={18} style={{ color: 'white' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                AI 3단계 오답 코칭
                {lessonTitle && (
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    {lessonTitle}
                  </span>
                )}
              </h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1'
              }}
              title="코칭을 건너뛰고 계속 진행합니다"
            >
              <SkipForward size={13} />
              <span>건너뛰기 (스킵)</span>
            </button>

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
        </div>

        {/* 3-Step Stepper Header */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            onClick={() => setCurrentStep(1)}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: currentStep === 1 ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: currentStep === 1 ? '2px solid var(--primary)' : '2px solid transparent',
              color: currentStep === 1 ? '#c084fc' : 'var(--text-muted)',
              fontWeight: currentStep === 1 ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <span>💡 1단계: 소크라테스 힌트</span>
          </button>

          <button
            onClick={handleGoToStep2}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: currentStep === 2 ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: currentStep === 2 ? '2px solid var(--secondary)' : '2px solid transparent',
              color: currentStep === 2 ? '#22d3ee' : 'var(--text-muted)',
              fontWeight: currentStep === 2 ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <span>⚖️ 2단계: 뉘앙스 &amp; 짝꿍</span>
          </button>

          <button
            onClick={handleGoToStep3}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: currentStep === 3 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: currentStep === 3 ? '2px solid var(--success)' : '2px solid transparent',
              color: currentStep === 3 ? '#34d399' : 'var(--text-muted)',
              fontWeight: currentStep === 3 ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <span>🎯 3단계: 실전 변형 문제</span>
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
          {/* Original Problem Context Card */}
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: '600' }}>
              틀린 문제 원문
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white', lineHeight: '1.5', margin: 0 }}>
              {quizItem.question}
            </h4>
            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: '700' }}>
                ❌ 내가 고른 오답: {userWrongAnswerText}
              </span>
              {currentStep > 1 && (
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '700' }}>
                  ✅ 실제 정답: {correctAnswerText}
                </span>
              )}
            </div>
          </div>

          {/* ================= STEP 1: SOCRATIC HINT ================= */}
          {currentStep === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingStep1 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                    AI가 인지적 착각 원인과 소크라테스식 힌트를 분석하고 있습니다...
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    정답을 바로 알려주지 않고 스스로 유추할 수 있도록 돕습니다.
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
                  {/* Cause analysis */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <Brain size={18} />
                      <span>왜 이 오답을 골랐을까? (인지적 착각 분석)</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.6', margin: 0 }}>
                      {step1Data.cognitiveIllusion}
                    </p>
                  </div>

                  {/* Socratic Clue Question */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                    border: '1px solid rgba(6, 182, 212, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#22d3ee', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <HelpCircle size={18} />
                      <span>소크라테스식 유추 단서 질문</span>
                    </div>
                    <p style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
                      "{step1Data.clueQuestion}"
                    </p>
                  </div>

                  {/* Interactive Rethink Choice Selector */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white', marginBottom: '0.6rem' }}>
                      🤔 힌트를 바탕으로 정답을 다시 골라보세요:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {quizItem.choices.map((choice, cIdx) => {
                        const isChosen = step1SelectedChoice === cIdx;
                        const isRealCorrect = cIdx === quizItem.correctIndex;
                        
                        let borderColor = 'rgba(255, 255, 255, 0.1)';
                        let bgColor = 'rgba(255, 255, 255, 0.02)';
                        let textColor = 'var(--text-secondary)';

                        if (step1SelectedChoice !== null) {
                          if (isRealCorrect) {
                            borderColor = 'var(--success)';
                            bgColor = 'rgba(16, 185, 129, 0.15)';
                            textColor = '#6ee7b7';
                          } else if (isChosen) {
                            borderColor = 'var(--error)';
                            bgColor = 'rgba(239, 68, 68, 0.15)';
                            textColor = '#fca5a5';
                          }
                        }

                        return (
                          <button
                            key={cIdx}
                            onClick={() => setStep1SelectedChoice(cIdx)}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '8px',
                              border: `1px solid ${borderColor}`,
                              backgroundColor: bgColor,
                              color: textColor,
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span>
                              <strong>{String.fromCharCode(65 + cIdx)}.</strong> {choice}
                            </span>
                            {step1SelectedChoice !== null && (
                              isRealCorrect ? <Check size={16} style={{ color: 'var(--success)' }} /> : (isChosen ? <X size={16} style={{ color: 'var(--error)' }} /> : null)
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {step1SelectedChoice !== null && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: step1SelectedChoice === quizItem.correctIndex ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: step1SelectedChoice === quizItem.correctIndex ? '#6ee7b7' : '#fca5a5', fontSize: '0.85rem', fontWeight: '600' }}>
                        {step1SelectedChoice === quizItem.correctIndex ? (
                          <span>🎉 정답입니다! 스스로 인출에 성공하셨습니다! 이제 2단계에서 깊이 있는 뉘앙스를 학습해보세요.</span>
                        ) : (
                          <span>💡 아쉽네요! 2단계 뉘앙스 대조를 통해 왜 정답이 맞는지 확실히 멘탈 모델을 교정해보세요.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Step Action Button */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                      style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}
                    >
                      <SkipForward size={14} />
                      <span>코칭 건너뛰기 (스킵)</span>
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleGoToStep2}
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <span>2단계: 뉘앙스 &amp; 멘탈 모델 교정</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ================= STEP 2: NUANCE & COLLOCATION ================= */}
          {currentStep === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingStep2 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--secondary)', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                    실사용 맥락 뉘앙스 대조 및 원어민 짝꿍 표현을 분석 중입니다...
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
                  {/* Nuance Contrast 2 sentences */}
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
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentStep(1)}
                        style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                      >
                        1단계 다시보기
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}
                      >
                        <SkipForward size={14} />
                        <span>스킵하기</span>
                      </button>
                    </div>
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
                    🎯 <strong>실전 변형 테스트 (Far Transfer)</strong>: 새로운 맥락의 3지선다 문제를 직접 풀며 개념을 온전히 내 것으로 만드세요!
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {step3Data.transferQuizzes.map((tQuiz, qIdx) => {
                      const userChosenIdx = transferAnswers[tQuiz.id];
                      const isSolved = userChosenIdx !== undefined;
                      const isCorrect = userChosenIdx === tQuiz.correctIndex;

                      return (
                        <div 
                          key={tQuiz.id}
                          style={{
                            padding: '1.25rem',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isSolved ? (isCorrect ? 'var(--success)' : 'var(--error)') : 'rgba(255, 255, 255, 0.08)'}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                              변형 문제 #{qIdx + 1}
                            </span>
                            {onAddQuizToMochi && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem' }}
                                onClick={() => handlePushTransferToMochi(tQuiz)}
                                disabled={addingMochiIds.has(tQuiz.id)}
                              >
                                {addingMochiIds.has(tQuiz.id) ? "✓ Mochi 추가됨" : "⚡ Mochi 카드 추가"}
                              </button>
                            )}
                          </div>

                          <h5 style={{ fontSize: '0.925rem', fontWeight: '600', color: 'white', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>
                            {tQuiz.question}
                          </h5>

                          {tQuiz.translation && (
                            <div style={{ fontSize: '0.8rem', color: '#93c5fd', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '0.35rem 0.65rem', borderRadius: '6px', borderLeft: '2px solid #3b82f6', marginBottom: '0.75rem' }}>
                              <span style={{ fontWeight: '600' }}>💡 문맥 해석:</span> {tQuiz.translation}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem' }}>
                            {tQuiz.choices.map((choice, cIdx) => {
                              let choiceBorder = 'rgba(255, 255, 255, 0.08)';
                              let choiceBg = 'rgba(255, 255, 255, 0.015)';
                              let choiceColor = 'var(--text-secondary)';

                              if (isSolved) {
                                if (cIdx === tQuiz.correctIndex) {
                                  choiceBorder = 'var(--success)';
                                  choiceBg = 'rgba(16, 185, 129, 0.15)';
                                  choiceColor = '#6ee7b7';
                                } else if (cIdx === userChosenIdx) {
                                  choiceBorder = 'var(--error)';
                                  choiceBg = 'rgba(239, 68, 68, 0.15)';
                                  choiceColor = '#fca5a5';
                                }
                              }

                              return (
                                <button
                                  key={cIdx}
                                  onClick={() => setTransferAnswers(prev => ({ ...prev, [tQuiz.id]: cIdx }))}
                                  disabled={isSolved}
                                  style={{
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: '8px',
                                    border: `1px solid ${choiceBorder}`,
                                    backgroundColor: choiceBg,
                                    color: choiceColor,
                                    fontSize: '0.85rem',
                                    textAlign: 'left',
                                    cursor: isSolved ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <span>
                                    <strong>{String.fromCharCode(65 + cIdx)}.</strong> {choice}
                                  </span>
                                  {isSolved && (
                                    cIdx === tQuiz.correctIndex ? <Check size={16} style={{ color: 'var(--success)' }} /> : (cIdx === userChosenIdx ? <X size={16} style={{ color: 'var(--error)' }} /> : null)
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
