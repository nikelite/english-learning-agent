import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, X, ArrowRight, RefreshCw, BookmarkCheck, AlertCircle, HelpCircle, BookOpen, SkipForward, Zap, Lightbulb } from 'lucide-react';
import { ReadingQuizItem, MicroCoachingData, TransferQuizItem } from '../types';
import { generateMicroCoaching } from '../geminiService';

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
  const [coachingData, setCoachingData] = useState<MicroCoachingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransferAnswer, setSelectedTransferAnswer] = useState<number | null>(null);
  const [isMochiAdded, setIsMochiAdded] = useState(false);
  const [addingMochi, setAddingMochi] = useState(false);

  // Compute safe wrong answer and correct answer text
  const safeWrongIdx = (quizItem && userAnswerIndex !== undefined && userAnswerIndex >= 0 && userAnswerIndex < quizItem.choices.length && userAnswerIndex !== quizItem.correctIndex)
    ? userAnswerIndex
    : (quizItem?.correctIndex === 0 ? 1 : 0);

  const userWrongAnswerText = quizItem?.choices[safeWrongIdx] || `보기 ${String.fromCharCode(65 + safeWrongIdx)}`;
  const correctAnswerText = quizItem?.choices[quizItem.correctIndex] || `보기 ${String.fromCharCode(65 + (quizItem?.correctIndex ?? 0))}`;

  // Fetch Micro Coaching Data
  const fetchCoaching = async () => {
    if (!quizItem) return;
    if (!apiKey) {
      setError("Gemini API Key가 필요합니다. 우측 상단 설정(⚙️)에서 키를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedTransferAnswer(null);
    setIsMochiAdded(false);

    try {
      const data = await generateMicroCoaching(
        quizItem.question,
        quizItem.choices,
        userWrongAnswerText,
        correctAnswerText,
        quizItem.rationale,
        apiKey,
        passageContext
      );
      setCoachingData(data);
    } catch (err: any) {
      setError(err.message || "마이크로 오답 코칭 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && quizItem) {
      fetchCoaching();
    }
  }, [isOpen, quizItem?.id, userAnswerIndex]);

  if (!isOpen || !quizItem) return null;

  const handleTransferSelect = (index: number) => {
    if (selectedTransferAnswer !== null) return;
    setSelectedTransferAnswer(index);
  };

  const handleAddCollocationToMochi = async () => {
    if (!coachingData?.collocation || isMochiAdded || !onAddQuizToMochi) return;
    setAddingMochi(true);
    try {
      const syntheticQuiz: TransferQuizItem = {
        id: `colloc-${Date.now()}`,
        question: `[짝꿍 표현] "${coachingData.collocation.phrase}"의 올바른 의미와 쓰임은?`,
        translation: coachingData.collocation.meaning,
        choices: [
          coachingData.collocation.meaning,
          "전혀 다른 의미의 표현",
          "문법적으로 잘못된 표현"
        ],
        correctIndex: 0,
        rationale: `예문: ${coachingData.collocation.example}`
      };
      await onAddQuizToMochi(syntheticQuiz);
      setIsMochiAdded(true);
    } catch (err) {
      console.error("단어장 저장 실패", err);
    } finally {
      setAddingMochi(false);
    }
  };

  const handleDirectRetry = () => {
    if (onRetryOriginalQuestion) {
      onRetryOriginalQuestion(quizItem);
    } else {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Zap size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                  1초 마이크로 오답 코칭
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#4f46e5',
                  background: '#e0e7ff',
                  padding: '2px 7px',
                  borderRadius: '12px'
                }}>
                  원스크린 완결
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                단서 확인 ➔ 1초 인출 테스트 ➔ 본 문제 바로 맞히기
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleDirectRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="코칭을 건너뛰고 바로 본 문제를 다시 풉니다."
            >
              <SkipForward size={14} />
              <span>바로 풀기</span>
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Question & Mistake Overview */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              ❓ {quizItem.question}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
              <div style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: '600'
              }}>
                ❌ 내가 고른 오답: <span style={{ fontWeight: '700' }}>{userWrongAnswerText}</span>
              </div>
              <div style={{
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: '600'
              }}>
                ✅ 실제 정답: <span style={{ fontWeight: '700' }}>{correctAnswerText}</span>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: '#6366f1' }} />
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#475569', margin: 0 }}>
                AI가 핵심 단서와 1초 확인 문제를 생성하고 있습니다...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>⚠️ {error}</span>
              <button
                onClick={fetchCoaching}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                다시 시도
              </button>
            </div>
          )}

          {/* Coaching Content */}
          {coachingData && !loading && (
            <>
              {/* Card 1: 📍 본문 결정적 단서 & 1줄 직관 뉘앙스 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #e0e7ff',
                boxShadow: '0 2px 8px -2px rgba(99, 102, 241, 0.08)'
              }}>
                {/* Passage Excerpt Section */}
                {coachingData.passageExcerpt && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    border: '1px solid #bbf7d0',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#065f46',
                        background: '#d1fae5',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {coachingData.locationLabel || '📍 본문 핵심 단서 발췌'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#064e3b',
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                      marginBottom: '4px'
                    }}>
                      "{coachingData.passageExcerpt}"
                    </div>
                    {coachingData.excerptTranslation && (
                      <div style={{ fontSize: '12px', color: '#047857', lineHeight: '1.4' }}>
                        👉 {coachingData.excerptTranslation}
                      </div>
                    )}
                    {coachingData.connectionExplanation && (
                      <div style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px dashed #a7f3d0',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#047857'
                      }}>
                        🔗 {coachingData.connectionExplanation}
                      </div>
                    )}
                  </div>
                )}

                {/* Core Nuance Contrast */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  marginBottom: coachingData.collocation ? '12px' : '0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Lightbulb size={16} style={{ color: '#eab308' }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                      1줄 핵심 뉘앙스
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
                    {coachingData.coreNuance}
                  </p>
                </div>

                {/* Collocation Partner */}
                {coachingData.collocation && (
                  <div style={{
                    background: '#fefce8',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    border: '1px solid #fef08a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#854d0e', background: '#fef9c3', padding: '1px 6px', borderRadius: '4px' }}>
                          원어민 짝꿍 표현
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#713f12' }}>
                          {coachingData.collocation.phrase}
                        </span>
                        <span style={{ fontSize: '12px', color: '#a16207' }}>
                          ({coachingData.collocation.meaning})
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#854d0e', fontStyle: 'italic', marginTop: '2px' }}>
                        "{coachingData.collocation.example}"
                      </div>
                    </div>

                    {onAddQuizToMochi && (
                      <button
                        onClick={handleAddCollocationToMochi}
                        disabled={isMochiAdded || addingMochi}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fde047',
                          background: isMochiAdded ? '#ecfdf5' : '#ffffff',
                          color: isMochiAdded ? '#059669' : '#854d0e',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: isMochiAdded ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          flexShrink: 0
                        }}
                      >
                        {isMochiAdded ? <BookmarkCheck size={12} /> : <BookOpen size={12} />}
                        {isMochiAdded ? '저장됨' : '단어장'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: 🎯 1초 인출 확인 퀴즈 (1-Shot Transfer) */}
              {coachingData.transferQuiz && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid #fed7aa',
                  boxShadow: '0 2px 8px -2px rgba(249, 115, 22, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#ea580c',
                        background: '#ffedd5',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        🎯 1초 인출 확인 퀴즈
                      </span>
                    </div>
                    {selectedTransferAnswer !== null && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: selectedTransferAnswer === coachingData.transferQuiz.correctIndex ? '#059669' : '#dc2626'
                      }}>
                        {selectedTransferAnswer === coachingData.transferQuiz.correctIndex ? '🎉 정답입니다!' : '💡 힌트를 다시 확인해 보세요!'}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                    {coachingData.transferQuiz.question}
                  </div>
                  {coachingData.transferQuiz.translation && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                      👉 {coachingData.transferQuiz.translation}
                    </div>
                  )}

                  {/* 3-Choices */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {coachingData.transferQuiz.choices.map((choice, cIdx) => {
                      const isSelected = selectedTransferAnswer === cIdx;
                      const isCorrect = cIdx === coachingData.transferQuiz.correctIndex;
                      const isSolved = selectedTransferAnswer !== null;

                      let btnBg = '#f8fafc';
                      let btnBorder = '#e2e8f0';
                      let btnColor = '#334155';

                      if (isSolved) {
                        if (isCorrect) {
                          btnBg = '#ecfdf5';
                          btnBorder = '#10b981';
                          btnColor = '#065f46';
                        } else if (isSelected) {
                          btnBg = '#fef2f2';
                          btnBorder = '#ef4444';
                          btnColor = '#991b1b';
                        } else {
                          btnBg = '#f8fafc';
                          btnBorder = '#e2e8f0';
                          btnColor = '#94a3b8';
                        }
                      }

                      return (
                        <button
                          key={cIdx}
                          onClick={() => handleTransferSelect(cIdx)}
                          disabled={isSolved}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: `2px solid ${btnBorder}`,
                            background: btnBg,
                            color: btnColor,
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isSolved ? 'default' : 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ color: '#94a3b8', marginRight: '4px' }}>
                            {String.fromCharCode(65 + cIdx)}.
                          </span>
                          {choice}
                        </button>
                      );
                    })}
                  </div>

                  {/* Rationale feedback after selection */}
                  {selectedTransferAnswer !== null && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: selectedTransferAnswer === coachingData.transferQuiz.correctIndex ? '#f0fdf4' : '#fff1f2',
                      border: `1px solid ${selectedTransferAnswer === coachingData.transferQuiz.correctIndex ? '#bbf7d0' : '#fecdd3'}`,
                      fontSize: '12px',
                      color: selectedTransferAnswer === coachingData.transferQuiz.correctIndex ? '#166534' : '#9f1239',
                      lineHeight: '1.4'
                    }}>
                      💡 {coachingData.transferQuiz.rationale}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            닫기
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {remainingWrongsCount > 1 && onNextWrongQuestion && (
              <button
                onClick={onNextWrongQuestion}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: '1px solid #818cf8',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>다음 오답 ({remainingWrongsCount - 1}개)</span>
                <ArrowRight size={14} />
              </button>
            )}

            <button
              onClick={handleDirectRetry}
              style={{
                padding: '10px 22px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
              }}
            >
              <Check size={16} />
              <span>🎯 본 문제 바로 맞히기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
