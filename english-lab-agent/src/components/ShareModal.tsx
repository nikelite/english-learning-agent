import React, { useState, useEffect } from 'react';
import { X, Share2, Check, AlertCircle, UserPlus } from 'lucide-react';
import type { LabLesson } from '../types';
import { saveLessonToCloud, shareLessonWithUser } from '../firebaseService';

interface ShareModalProps {
  lessons: LabLesson[];
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  lessons,
  isOpen,
  onClose
}) => {
  const [recipientId, setRecipientId] = useState<string>('');
  const [isDirectSharing, setIsDirectSharing] = useState<boolean>(false);
  const [directShareSuccess, setDirectShareSuccess] = useState<boolean>(false);
  const [directShareError, setDirectShareError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipientId('');
      setDirectShareSuccess(false);
      setDirectShareError(null);
      setIsDirectSharing(false);
    }
  }, [isOpen]);

  const handleDirectShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = recipientId.trim();
    if (!targetId) {
      setDirectShareError("전송받을 상대방의 User ID를 입력해 주세요.");
      return;
    }

    setIsDirectSharing(true);
    setDirectShareError(null);
    setDirectShareSuccess(false);

    try {
      const currentUserId = localStorage.getItem('lab_user_id') || null;
      
      for (const lesson of lessons) {
        let docId = lesson.id;
        // If the lesson is not uploaded to cloud yet, upload it first
        const isLocalOnly = !lesson.ownerId || lesson.id.startsWith('wrong-') || lesson.id.length <= 5;
        if (isLocalOnly) {
          docId = await saveLessonToCloud(lesson, currentUserId);
        }
        // Share with target user
        await shareLessonWithUser(docId, targetId);
      }
      
      setDirectShareSuccess(true);
      setRecipientId('');
    } catch (err: any) {
      setDirectShareError(err.message || "다이렉트 공유에 실패했습니다.");
    } finally {
      setIsDirectSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '2rem 1.75rem' }}>
        {/* Close Button */}
        <button 
          className="btn btn-secondary" 
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', borderRadius: '50%' }}
          onClick={onClose}
        >
          <X size={16} />
        </button>

        {/* Title */}
        <h3 style={{ fontSize: '1.3rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', fontWeight: '800' }}>
          <Share2 size={22} style={{ color: 'var(--primary)' }} />
          {lessons.length > 1 ? `학습 세트 ${lessons.length}개 일괄 공유` : '학습 세트 공유하기'}
        </h3>

        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--accent)', background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', padding: '1.15rem', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', lineHeight: '1.5' }}>
            <UserPlus size={14} style={{ color: 'var(--accent)', marginRight: '0.25rem', display: 'inline' }} />
            <strong>아이디로 보관함에 직접 전송!</strong><br />
            지정하신 상대방의 **사용자 ID** 보관함으로 선택한 학습 세트를 직접 전송합니다! 상대방이 접속하면 메인 히스토리 보관함에 실시간으로 즉시 나타납니다.
          </div>

          <form onSubmit={handleDirectShare} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                상대방 User ID 입력
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="예: friend_id"
                  className="input-glow"
                  disabled={isDirectSharing}
                />
                <button 
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent) 0%, #b91c1c 100%)',
                    boxShadow: '0 4px 12px rgba(244,63,94,0.15)',
                    flexShrink: 0,
                    padding: '0.65rem 1.15rem'
                  }}
                  disabled={isDirectSharing}
                >
                  {isDirectSharing ? '전송 중...' : '보내기'}
                </button>
              </div>
            </div>

            {directShareSuccess && (
              <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.15)', alignItems: 'center' }}>
                <Check size={14} style={{ flexShrink: 0 }} />
                <span>{lessons.length}개의 학습 세트가 상대방 보관함으로 전송 완료되었습니다!</span>
              </div>
            )}

            {directShareError && (
              <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'center' }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{directShareError}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
