import React, { useState } from 'react';
import { Award, Check, X, RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { WrongReadingAnswer } from '../types';

interface ReviewRoomProps {
  wrongAnswers: WrongReadingAnswer[];
  onRemoveWrongAnswer: (id: string) => void;
  onClearAll: () => void;
}

export const ReviewRoom: React.FC<ReviewRoomProps> = ({
  wrongAnswers,
  onRemoveWrongAnswer,
  onClearAll
}) => {
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
      <div className="glass-panel main-panel animate-fade-in text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', minHeight: '400px' }}>
        <div className="pulse-glow" style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Award size={32} style={{ color: 'var(--success)' }} />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
          독해 오답 노트가 완전히 비어 있습니다!
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', lineHeight: '1.5' }}>
          모든 퀴즈 문제를 성공적으로 맞췄거나 오답 복습을 끝내셨습니다. 대단히 훌륭합니다! 🏆
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel main-panel animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
            <span>오답 복습방 (Mistakes Review)</span>
            <span className="badge">{wrongAnswers.length}</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            틀린 독해 및 단어 퀴즈를 맞출 때까지 몇 번이고 반복 학습이 진행됩니다.
          </p>
        </div>

        <button className="btn btn-danger" onClick={onClearAll} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
          <Trash2 size={13} />
          오답 기록 전체 지우기
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {wrongAnswers.map((wa) => {
          const { quizItem, lessonTitle, id: wrongId } = wa;
          const userSelectedIdx = retriedAnswers[wrongId];
          const isCorrect = isAnsweredCorrectly[wrongId];

          return (
            <div key={wrongId} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', background: 'rgba(255, 255, 255, 0.01)', borderColor: isCorrect ? 'var(--success)' : 'var(--border-color)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.04)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    📖 {lessonTitle}
                  </span>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                    {quizItem.type === 'comprehension' ? '독해 내용' : '단어 어휘'}
                  </span>
                </div>

                <h4 style={{ fontSize: '0.925rem', fontWeight: '500', lineHeight: '1.5', marginBottom: '1rem', whiteSpace: 'pre-line', color: 'white' }}>
                  {quizItem.question}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          ...btnStyle
                        }}
                        onClick={() => handleChoiceClick(wrongId, idx, quizItem.correctIndex)}
                        disabled={isCorrect}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <strong>{String.fromCharCode(65 + idx)}.</strong> {choice}
                        </span>
                        {userSelectedIdx === idx && (
                          idx === quizItem.correctIndex ? <Check size={13} /> : <X size={13} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                {userSelectedIdx !== undefined && userSelectedIdx !== null && (
                  <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '1rem' }}>
                    {isCorrect ? (
                      <span style={{ color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <CheckCircle2 size={13} /> 정답입니다! 오답 노트 완치!
                      </span>
                    ) : (
                      <span style={{ color: 'var(--error)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <X size={13} /> 오답입니다. Rationale를 다시 해독하세요.
                      </span>
                    )}
                    <p style={{ color: 'var(--text-secondary)' }}>{quizItem.rationale}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  {!isCorrect ? (
                    userSelectedIdx !== null && userSelectedIdx !== undefined && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: '6px' }}
                        onClick={() => handleResetCard(wrongId)}
                      >
                        <RefreshCw size={12} /> 다시도전
                      </button>
                    )
                  ) : (
                    <button
                      className="btn btn-accent"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.4rem 0.7rem',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--success) 0%, #047857 100%)',
                        boxShadow: 'none'
                      }}
                      onClick={() => onRemoveWrongAnswer(wrongId)}
                    >
                      오답 노트 해제 🎉
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: '6px', background: 'transparent', borderColor: 'rgba(239,68,68,0.2)' }}
                    onClick={() => onRemoveWrongAnswer(wrongId)}
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
