import React, { useState } from 'react';
import { Award, Check, X, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import type { WrongLabAnswer } from '../types';

interface ReviewRoomProps {
  wrongAnswers: WrongLabAnswer[];
  onRemoveWrongAnswer: (id: string) => void;
  onClearAll: () => void;
}

export const ReviewRoom: React.FC<ReviewRoomProps> = ({
  wrongAnswers,
  onRemoveWrongAnswer,
  onClearAll
}) => {
  // Store retry states per question ID
  const [retriedAnswers, setRetriedAnswers] = useState<Record<string, number | null>>({});
  const [isAnsweredCorrectly, setIsAnsweredCorrectly] = useState<Record<string, boolean>>({});

  const handleChoiceClick = (wrongId: string, choiceIdx: number, correctIdx: number) => {
    if (isAnsweredCorrectly[wrongId]) return;

    setRetriedAnswers(prev => ({ ...prev, [wrongId]: choiceIdx }));
    
    if (choiceIdx === correctIdx) {
      setIsAnsweredCorrectly(prev => ({ ...prev, [wrongId]: true }));
    }
  };

  const handleResetCard = (wrongId: string) => {
    setRetriedAnswers(prev => {
      const next = { ...prev };
      delete next[wrongId];
      return next;
    });
    setIsAnsweredCorrectly(prev => {
      const next = { ...prev };
      delete next[wrongId];
      return next;
    });
  };

  if (wrongAnswers.length === 0) {
    return (
      <div className="glass-panel main-panel animate-fade-in text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
        <div className="pulse-glow" style={{ width: '70px', height: '70px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Award size={36} style={{ color: 'var(--success)' }} />
        </div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
          오답 노트가 비어 있습니다!
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', lineHeight: '1.5' }}>
          틀린 문항이 없거나 복습 정리를 완료했습니다. 훌륭한 학습 속도입니다! 🏆
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel main-panel animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
            <span>오답 노출 복습방 (Review Room)</span>
            <span className="badge">{wrongAnswers.length}</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            실전 연습이나 첨삭 분석 과정에서 틀린 퀴즈들을 완벽히 익힐 때까지 반복 복습할 수 있습니다.
          </p>
        </div>

        <button className="btn btn-danger" onClick={onClearAll} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          <Trash2 size={14} />
          오답노트 전체 초기화
        </button>
      </div>

      <div className="review-grid">
        {wrongAnswers.map((wa) => {
          const { quizItem, lessonTitle, id: wrongId } = wa;
          const userSelectedIdx = retriedAnswers[wrongId];
          const isCorrect = isAnsweredCorrectly[wrongId];

          return (
            <div key={wrongId} className="glass-panel review-card" style={{ background: 'rgba(255, 255, 255, 0.01)', borderColor: isCorrect ? 'var(--success)' : 'var(--border-color)' }}>
              <div>
                {/* Source lesson link tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    📖 {lessonTitle}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {new Date(wa.timestamp).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* Question */}
                <h4 style={{ fontSize: '0.9rem', fontWeight: '500', lineHeight: '1.5', marginBottom: '1rem', whiteSpace: 'pre-line', color: 'white' }}>
                  {quizItem.question}
                </h4>

                {/* Choice List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {quizItem.choices.map((choice, idx) => {
                    let btnStyle: React.CSSProperties = {
                      background: 'rgba(255, 255, 255, 0.01)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)'
                    };

                    if (userSelectedIdx === idx) {
                      if (idx === quizItem.correctIndex) {
                        btnStyle.borderColor = 'var(--success)';
                        btnStyle.background = 'rgba(16, 185, 129, 0.1)';
                        btnStyle.color = '#a7f3d0';
                      } else {
                        btnStyle.borderColor = 'var(--error)';
                        btnStyle.background = 'rgba(239, 68, 68, 0.1)';
                        btnStyle.color = '#fecaca';
                      }
                    } else if (isCorrect && idx === quizItem.correctIndex) {
                      btnStyle.borderColor = 'var(--success)';
                      btnStyle.background = 'rgba(16, 185, 129, 0.05)';
                      btnStyle.color = '#a7f3d0';
                    }

                    return (
                      <button
                        key={idx}
                        className="choice-btn"
                        style={{
                          padding: '0.6rem 0.75rem',
                          fontSize: '0.825rem',
                          borderRadius: '8px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          ...btnStyle
                        }}
                        onClick={() => handleChoiceClick(wrongId, idx, quizItem.correctIndex)}
                        disabled={isCorrect}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <strong>{String.fromCharCode(65 + idx)}.</strong> {choice}
                        </span>
                        {userSelectedIdx === idx && (
                          idx === quizItem.correctIndex ? <Check size={14} /> : <X size={14} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rationale and Master buttons */}
              <div>
                {userSelectedIdx !== undefined && userSelectedIdx !== null && (
                  <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '1rem' }}>
                    {isCorrect ? (
                      <span style={{ color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <CheckCircle2 size={14} /> 정답입니다! 마스터 완료!
                      </span>
                    ) : (
                      <span style={{ color: 'var(--error)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <X size={14} /> 오답입니다. 해설을 참고하세요.
                      </span>
                    )}
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{quizItem.rationale}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  {!isCorrect ? (
                    userSelectedIdx !== null && userSelectedIdx !== undefined && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '6px' }}
                        onClick={() => handleResetCard(wrongId)}
                      >
                        <RefreshCw size={12} /> 다시 시도
                      </button>
                    )
                  ) : (
                    <button
                      className="btn btn-accent"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--success) 0%, #047857 100%)',
                        boxShadow: 'none'
                      }}
                      onClick={() => onRemoveWrongAnswer(wrongId)}
                    >
                      <Award size={12} /> 오답 노트 졸업
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '6px', background: 'transparent', borderColor: 'rgba(239,68,68,0.2)' }}
                    onClick={() => onRemoveWrongAnswer(wrongId)}
                    title="바로 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
