import React, { useState } from 'react';
import type { MochiCard } from '../types';
import { Trash2 } from 'lucide-react';

interface PreviewMemorizationCardProps {
  card: MochiCard;
  showDelete: boolean;
  onDelete?: () => void;
}

export const PreviewMemorizationCard: React.FC<PreviewMemorizationCardProps> = ({
  card,
  showDelete,
  onDelete,
}) => {
  const [direction, setDirection] = useState<'eng' | 'kor'>('eng');

  return (
    <div className="preview-card">
      {showDelete && onDelete && (
        <button
          className="preview-card-delete-btn"
          onClick={onDelete}
          title="이 카드 제외"
        >
          <Trash2 size={16} />
        </button>
      )}

      <div className="preview-card-header">
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span className="preview-card-pos font-korean">{card.pos}</span>
            {card.level && (
              <span className="preview-card-pos font-korean" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', borderColor: 'var(--secondary)', padding: '1px 6px', fontSize: '0.7rem' }}>
                {card.level}
              </span>
            )}
          </div>
          <div className="card-direction-toggle" style={{ display: 'flex', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2px' }}>
            <button
              onClick={() => setDirection('eng')}
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                borderRadius: '10px',
                border: 'none',
                background: direction === 'eng' ? 'var(--primary)' : 'transparent',
                color: direction === 'eng' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              ENG → KOR
            </button>
            <button
              onClick={() => setDirection('kor')}
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                borderRadius: '10px',
                border: 'none',
                background: direction === 'kor' ? 'var(--secondary)' : 'transparent',
                color: direction === 'kor' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              KOR → ENG
            </button>
          </div>
        </div>
      </div>

      <div className="preview-card-split">
        {direction === 'eng' ? (
          <>
            {/* English -> Korean Preview Card */}
            {/* Front Side */}
            <div className="preview-card-face-col">
              <span className="face-label">앞면 (Front)</span>
              <div className="preview-face-content">
                <div className="preview-card-term font-english" style={{ fontSize: '1.1rem', textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                  {card.english} {card.phonetic && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.25rem' }}>{card.phonetic}</span>}
                </div>
              </div>
            </div>

            {/* Back Side */}
            <div className="preview-card-face-col">
              <span className="face-label">뒷면 (Back)</span>
              <div className="preview-face-content">
                <div className="preview-card-meaning font-korean" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {card.korean}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                  <strong>단어 레벨:</strong> {card.level || '일반'}
                </div>
                <div className="preview-card-example font-korean" style={{ fontSize: '0.85rem', padding: '0.5rem', margin: 0, background: 'var(--bg-main)', borderLeft: '2px solid var(--primary)', borderRadius: '0 4px 4px 0' }}>
                  <div className="eng font-english" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{card.exampleEng}</div>
                  <div className="kor font-korean" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{card.exampleKor}</div>
                </div>
                {card.tip && (
                  <div className="preview-card-tip font-korean" style={{ padding: '0.4rem 0.5rem', margin: '0.4rem 0 0 0', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    💡 {card.tip}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Korean -> English Preview Card */}
            {/* Front Side */}
            <div className="preview-card-face-col">
              <span className="face-label">앞면 (Front)</span>
              <div className="preview-face-content">
                <div className="preview-card-meaning font-korean" style={{ fontWeight: '600', textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-primary)' }}>
                  {card.korean}
                </div>
              </div>
            </div>

            {/* Back Side */}
            <div className="preview-card-face-col">
              <span className="face-label">뒷면 (Back)</span>
              <div className="preview-face-content">
                <div className="preview-card-term font-english" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {card.english} {card.phonetic && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '0.25rem' }}>{card.phonetic}</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                  <strong>단어 레벨:</strong> {card.level || '일반'}
                </div>
                <div className="preview-card-example font-korean" style={{ fontSize: '0.85rem', padding: '0.5rem', margin: 0, background: 'var(--bg-main)', borderLeft: '2px solid var(--secondary)', borderRadius: '0 4px 4px 0' }}>
                  <div className="eng font-english" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{card.exampleEng}</div>
                  <div className="kor font-korean" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{card.exampleKor}</div>
                </div>
                {card.tip && (
                  <div className="preview-card-tip font-korean" style={{ padding: '0.4rem 0.5rem', margin: '0.4rem 0 0 0', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    💡 {card.tip}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
