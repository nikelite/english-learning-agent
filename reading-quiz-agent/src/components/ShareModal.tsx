import React, { useState, useEffect } from 'react';
import { X, Share2, Clipboard, Check, Sparkles, Globe, Shield } from 'lucide-react';
import { ReadingLesson } from '../types';
import { serializeLesson } from '../geminiService';

interface ShareModalProps {
  lesson: ReadingLesson;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  lesson,
  isOpen,
  onClose
}) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && lesson) {
      const base64Payload = serializeLesson(lesson);
      const url = `${window.location.origin}${window.location.pathname}?share=${base64Payload}`;
      setShareUrl(url);
    }
  }, [isOpen, lesson]);

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button 
          className="btn btn-secondary" 
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', borderRadius: '50%' }}
          onClick={onClose}
        >
          <X size={16} />
        </button>

        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
          <Share2 size={20} style={{ color: 'var(--secondary)' }} />
          스마트 퀴즈 링크 공유
        </h3>

        <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--secondary)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', padding: '1.25rem', borderRadius: '0 12px 12px 0', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: '1.5' }}>
          <Sparkles size={14} style={{ color: 'var(--secondary)', marginRight: '0.25rem' }} />
          <strong>서버가 없는 혁신적인 쉐어링 시스템!</strong><br />
          이 지문의 해석, 단어장, 퀴즈 문제들 일체가 URL 주소 안에 압축되어 저장되었습니다. 링크를 받는 사람은 별도의 백엔드 데이터베이스 없이 즉시 시험을 치를 수 있습니다!
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            생성된 단독 공유 링크
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="input-glow"
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis' }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button 
              className="btn btn-primary"
              style={{
                background: copied ? 'var(--success)' : 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)',
                boxShadow: 'none',
                flexShrink: 0
              }}
              onClick={handleCopy}
            >
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Globe size={13} style={{ color: 'var(--secondary)' }} />
            <span>이 링크는 카카오톡, 라인, 이메일, 노션 페이지에 붙여넣어 무제한 공유할 수 있습니다.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Shield size={13} style={{ color: 'var(--primary)' }} />
            <span>어떠한 백엔드 서버도 거치지 않고 직접 상대방 브라우저에서 해독되므로 개인정보 및 보안상 100% 안전합니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
