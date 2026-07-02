import { useState } from 'react';
import { Award, Check, X, RefreshCw, Trash2, CheckCircle2, Archive, CheckSquare, Square } from 'lucide-react';
import { WrongAnswer } from '../types';

interface ReviewRoomProps {
  wrongAnswers: WrongAnswer[];
  onRemoveWrongAnswer: (id: string) => void;
  onDeleteWrongAnswer: (id: string) => void;
  onUnarchiveWrongAnswer: (id: string) => void;
  onClearAll: () => void;
  mochiApiKey: string;
  mochiQuizDeckId: string;
  onAddQuizToMochi: (quiz: any) => Promise<void>;
}

export const ReviewRoom: React.FC<ReviewRoomProps> = ({
  wrongAnswers,
  onRemoveWrongAnswer,
  onDeleteWrongAnswer,
  onUnarchiveWrongAnswer,
  onClearAll,
  mochiApiKey,
  mochiQuizDeckId,
  onAddQuizToMochi
}) => {
  // Store retry states per question ID
  const [retriedAnswers, setRetriedAnswers] = useState<Record<string, number | null>>({});
  const [isAnsweredCorrectly, setIsAnsweredCorrectly] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<'active' | 'archived'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingToMochiIds, setAddingToMochiIds] = useState<Set<string>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);

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

  const activeAnswers = wrongAnswers.filter(wa => !wa.isArchived);
  const archivedAnswers = wrongAnswers.filter(wa => wa.isArchived);
  const displayedAnswers = activeFilter === 'active' ? activeAnswers : archivedAnswers;

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedAnswers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedAnswers.map(wa => wa.id)));
    }
  };

  const toggleSelectCard = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePushSingleToMochi = async (wa: WrongAnswer) => {
    if (!mochiApiKey.trim() || !mochiQuizDeckId.trim()) {
      alert("우측 상단 서비스 설정(⚙️)에서 Mochi API Key와 오답/퀴즈 전송용 Mochi 덱을 먼저 설정해 주세요.");
      return;
    }
    setAddingToMochiIds(prev => new Set(prev).add(wa.id));
    try {
      await onAddQuizToMochi(wa.quizItem);
    } catch (err: any) {
      alert(err.message || "Mochi 카드 전송에 실패했습니다.");
      setAddingToMochiIds(prev => {
        const next = new Set(prev);
        next.delete(wa.id);
        return next;
      });
    }
  };

  const handleBulkPushToMochi = async () => {
    if (!mochiApiKey.trim() || !mochiQuizDeckId.trim()) {
      alert("우측 상단 서비스 설정(⚙️)에서 Mochi API Key와 오답/퀴즈 전송용 Mochi 덱을 먼저 설정해 주세요.");
      return;
    }
    const idsToPush = Array.from(selectedIds);
    if (idsToPush.length === 0) return;

    setIsBulkAdding(true);
    let successCount = 0;
    try {
      for (let i = 0; i < idsToPush.length; i++) {
        const wrongId = idsToPush[i];
        const wa = displayedAnswers.find(item => item.id === wrongId);
        if (wa) {
          setBulkProgress(`Mochi 카드 전송 중... (${i + 1}/${idsToPush.length})`);
          try {
            setAddingToMochiIds(prev => new Set(prev).add(wa.id));
            await onAddQuizToMochi(wa.quizItem);
            successCount++;
          } catch (err) {
            console.error("Failed to push quiz to Mochi:", err);
            setAddingToMochiIds(prev => {
              const next = new Set(prev);
              next.delete(wa.id);
              return next;
            });
          }
        }
      }
      alert(`${successCount}개의 오답 퀴즈 카드가 Mochi에 성공적으로 추가되었습니다!`);
      setSelectedIds(new Set());
    } finally {
      setIsBulkAdding(false);
      setBulkProgress(null);
    }
  };

  if (wrongAnswers.length === 0) {
    return (
      <div className="glass-panel main-panel animate-fade-in text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
        <div className="pulse-glow" style={{ width: '70px', height: '70px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Award size={36} style={{ color: 'var(--success)' }} />
        </div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
          오답 노트가 텅 비어 있습니다!
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', lineHeight: '1.5' }}>
          모든 퀴즈 문제를 완벽히 풀었거나 오답 정리를 완료하셨습니다. 아주 멋진 학습 성과입니다! 🏆
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel main-panel animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
            <span>오답 노출 복습방 (Review Room)</span>
            <span className="badge">{displayedAnswers.length}</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            틀렸던 문제들을 완벽히 정답으로 맞출 때까지 몇 번이고 다시 복습할 수 있습니다.
          </p>
        </div>

        <button className="btn btn-danger" onClick={onClearAll} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          <Trash2 size={14} />
          오답노트 전체 초기화
        </button>
      </div>

      {/* Active vs Archived Tabs Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => { setActiveFilter('active'); setSelectedIds(new Set()); }}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid',
            cursor: 'pointer',
            fontWeight: activeFilter === 'active' ? '700' : '400',
            backgroundColor: activeFilter === 'active' ? 'var(--primary)' : 'transparent',
            borderColor: activeFilter === 'active' ? 'var(--primary)' : 'var(--border-color)',
            color: activeFilter === 'active' ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          📖 활성 오답 ({activeAnswers.length})
        </button>
        <button
          onClick={() => { setActiveFilter('archived'); setSelectedIds(new Set()); }}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid',
            cursor: 'pointer',
            fontWeight: activeFilter === 'archived' ? '700' : '400',
            backgroundColor: activeFilter === 'archived' ? 'var(--accent)' : 'transparent',
            borderColor: activeFilter === 'archived' ? 'var(--accent)' : 'var(--border-color)',
            color: activeFilter === 'archived' ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          🗂️ 아카이브된 오답 ({archivedAnswers.length})
        </button>
      </div>

      {/* Bulk Action Toolbar */}
      {displayedAnswers.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'white' }} onClick={toggleSelectAll}>
            {selectedIds.size === displayedAnswers.length ? (
              <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
            ) : (
              <Square size={16} style={{ color: 'var(--text-muted)' }} />
            )}
            <span>전체 선택 ({selectedIds.size} / {displayedAnswers.length})</span>
          </div>

          {selectedIds.size > 0 && (
            <button
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)' }}
              onClick={handleBulkPushToMochi}
              disabled={isBulkAdding}
            >
              {isBulkAdding ? (bulkProgress || "전송 중...") : `⚡ Mochi 카드 일괄 추가 (${selectedIds.size})`}
            </button>
          )}
        </div>
      )}

      {displayedAnswers.length === 0 ? (
        <div style={{ padding: '4rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          {activeFilter === 'active' ? (
            <>📖 활성 상태인 오답이 없습니다. 대단해요! 🎉</>
          ) : (
            <>🗂️ 아카이브된 오답이 없습니다. 학습 완료 후 졸업한 문제들이 이곳에 보관됩니다.</>
          )}
        </div>
      ) : (
        <div className="review-grid">
          {displayedAnswers.map((wa) => {
            const { quizItem, lessonTitle, id: wrongId } = wa;
            const userSelectedIdx = retriedAnswers[wrongId];
            const isCorrect = isAnsweredCorrectly[wrongId];
            const isSelected = selectedIds.has(wrongId);

            return (
              <div key={wrongId} className="glass-panel review-card" style={{ background: 'rgba(255, 255, 255, 0.01)', borderColor: isCorrect ? 'var(--success)' : 'var(--border-color)', position: 'relative' }}>
                
                {/* Checkbox Select Control overlay */}
                <div 
                  style={{ position: 'absolute', top: '1rem', left: '1rem', cursor: 'pointer', zIndex: 10 }}
                  onClick={(e) => { e.stopPropagation(); toggleSelectCard(wrongId); }}
                >
                  {isSelected ? (
                    <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                  ) : (
                    <Square size={18} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>

                <div style={{ paddingLeft: '1.8rem' }}>
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
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '500', lineHeight: '1.5', marginBottom: '1rem', whiteSpace: 'pre-line', color: 'white' }}>
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
                            padding: '0.65rem 0.75rem',
                            fontSize: '0.85rem',
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
                <div style={{ paddingLeft: '1.8rem' }}>
                  {userSelectedIdx !== undefined && userSelectedIdx !== null && (
                    <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '1rem' }}>
                      {isCorrect ? (
                        <span style={{ color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                          <CheckCircle2 size={14} /> 정답입니다! 마스터 완료!
                        </span>
                      ) : (
                        <span style={{ color: 'var(--error)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                          <X size={14} /> 오답입니다. 해설을 다시 참고해보세요.
                        </span>
                      )}
                      <p style={{ color: 'var(--text-secondary)' }}>{quizItem.rationale}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '6px', marginRight: 'auto' }}
                      onClick={() => handlePushCardToMochi(wa)}
                      disabled={addingToMochiIds.has(wrongId)}
                    >
                      {addingToMochiIds.has(wrongId) ? "✓ Mochi 추가 완료" : "⚡ Mochi 카드 추가"}
                    </button>

                    {wa.isArchived && (
                      <button
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          borderColor: 'var(--success)',
                          color: 'var(--success)',
                          background: 'transparent'
                        }}
                        onClick={() => onUnarchiveWrongAnswer(wrongId)}
                      >
                        활성 오답으로 복구
                      </button>
                    )}

                    {!isCorrect ? (
                      !wa.isArchived && userSelectedIdx !== null && userSelectedIdx !== undefined && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '6px' }}
                          onClick={() => handleResetCard(wrongId)}
                        >
                          <RefreshCw size={12} /> 다시 시도
                        </button>
                      )
                    ) : (
                      !wa.isArchived && (
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
                          <Award size={12} /> 오답 노트에서 졸업
                        </button>
                      )
                    )}
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '6px', background: 'transparent', borderColor: 'rgba(239,68,68,0.2)' }}
                      onClick={() => onDeleteWrongAnswer(wrongId)}
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
      )}
    </div>
  );

  async function handlePushCardToMochi(wa: WrongAnswer) {
    await handlePushSingleToMochi(wa);
  }
};
