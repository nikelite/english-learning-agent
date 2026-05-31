import React, { useState, useEffect } from 'react';
import { X, Share2, Clipboard, Check, Sparkles, Globe, Cloud, Link, AlertCircle, UserPlus } from 'lucide-react';
import { Lesson } from '../types';
import { serializeLesson } from '../geminiService';
import { saveLessonToCloud, shareLessonWithUser } from '../firebaseService';

interface ShareModalProps {
  lesson: Lesson;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  lesson,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'direct' | 'serverless'>('cloud');
  const [cloudUrl, setCloudUrl] = useState<string>('');
  const [serverlessUrl, setServerlessUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Direct sharing state
  const [recipientId, setRecipientId] = useState<string>('');
  const [isDirectSharing, setIsDirectSharing] = useState<boolean>(false);
  const [directShareSuccess, setDirectShareSuccess] = useState<boolean>(false);
  const [directShareError, setDirectShareError] = useState<string | null>(null);

  // Generate the serverless GZIP Base64 link
  useEffect(() => {
    if (isOpen && lesson) {
      serializeLesson(lesson).then((base64Payload) => {
        const url = `${window.location.origin}${window.location.pathname}?share=${base64Payload}`;
        setServerlessUrl(url);
      });
      // Reset states when modal opens
      setCloudUrl('');
      setUploadError(null);
      setIsUploading(false);
      setRecipientId('');
      setDirectShareSuccess(false);
      setDirectShareError(null);
      setIsDirectSharing(false);
    }
  }, [isOpen, lesson]);

  // Upload to Firebase Firestore for Cloud Share
  const handleCloudUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const currentUserId = localStorage.getItem('eng_user_id') || null;
      const docId = await saveLessonToCloud(lesson, currentUserId);
      const url = `${window.location.origin}${window.location.pathname}?cloudShare=${docId}`;
      setCloudUrl(url);
    } catch (err: any) {
      setUploadError(err.message || "클라우드 퀴즈 서버 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // Direct sharing logic
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
      let docId = '';
      if (cloudUrl) {
        const urlParams = new URL(cloudUrl);
        docId = urlParams.searchParams.get('cloudShare') || '';
      }

      if (!docId) {
        // Upload first if not already uploaded
        const currentUserId = localStorage.getItem('eng_user_id') || null;
        docId = await saveLessonToCloud(lesson, currentUserId);
        const url = `${window.location.origin}${window.location.pathname}?cloudShare=${docId}`;
        setCloudUrl(url);
      }

      // Add recipient to the shared list
      await shareLessonWithUser(docId, targetId);
      setDirectShareSuccess(true);
      setRecipientId('');
    } catch (err: any) {
      setDirectShareError(err.message || "다이렉트 공유에 실패했습니다.");
    } finally {
      setIsDirectSharing(false);
    }
  };

  const handleCopy = (urlToCopy: string) => {
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', padding: '2rem 1.75rem' }}>
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
          학습 세트 공유하기
        </h3>

        {/* Tab Navigation Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.55rem 0.25rem',
              fontSize: '0.75rem',
              fontWeight: activeTab === 'cloud' ? '700' : '400',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'cloud' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'cloud' ? 'white' : 'var(--text-secondary)',
              boxShadow: activeTab === 'cloud' ? '0 4px 12px rgba(139,92,246,0.2)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setActiveTab('cloud')}
          >
            <Cloud size={13} />
            단축 링크
          </button>

          <button
            type="button"
            className="btn"
            style={{
              padding: '0.55rem 0.25rem',
              fontSize: '0.75rem',
              fontWeight: activeTab === 'direct' ? '700' : '400',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'direct' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'direct' ? 'white' : 'var(--text-secondary)',
              boxShadow: activeTab === 'direct' ? '0 4px 12px rgba(236,72,153,0.2)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setActiveTab('direct')}
          >
            <UserPlus size={13} />
            사용자 ID 전송
          </button>
          
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.55rem 0.25rem',
              fontSize: '0.75rem',
              fontWeight: activeTab === 'serverless' ? '700' : '400',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'serverless' ? 'var(--secondary)' : 'transparent',
              color: activeTab === 'serverless' ? 'white' : 'var(--text-secondary)',
              boxShadow: activeTab === 'serverless' ? '0 4px 12px rgba(6,182,212,0.2)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setActiveTab('serverless')}
          >
            <Link size={13} />
            서버리스 압축
          </button>
        </div>

        {/* Tab Contents: Cloud Share */}
        {activeTab === 'cloud' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--primary)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.02) 100%)', padding: '1.15rem', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', lineHeight: '1.5' }}>
              <Sparkles size={14} style={{ color: 'var(--primary)', marginRight: '0.25rem', display: 'inline' }} />
              <strong>개인 Cloud 데이터베이스 안전 보관!</strong><br />
              현재 표현의 분석 결과, 암기 팁, 예문과 퀴즈가 구글 Firebase Cloud에 저장되어 **15자 내외의 초단축 고유 ID**가 발급됩니다. 메신저 공유 시 글자 수 제한 없이 깔끔하게 전달 가능합니다.
            </div>

            {!cloudUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCloudUpload}
                  disabled={isUploading}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 15px rgba(139,92,246,0.2)',
                    fontSize: '0.85rem',
                    fontWeight: '700'
                  }}
                >
                  {isUploading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></span>
                      클라우드 서버에 안전하게 보관하는 중...
                    </span>
                  ) : (
                    <>
                      <Cloud size={16} />
                      클라우드 단축 공유 링크 생성하기
                    </>
                  )}
                </button>
                {uploadError && (
                  <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'center' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                  생성된 클라우드 단축 URL
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    readOnly
                    value={cloudUrl}
                    className="input-glow"
                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis' }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button 
                    className="btn btn-primary"
                    style={{
                      background: copied ? 'var(--success)' : 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                      boxShadow: 'none',
                      flexShrink: 0,
                      padding: '0.65rem 1.15rem'
                    }}
                    onClick={() => handleCopy(cloudUrl)}
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? '복사됨!' : '링크 복사'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Contents: Direct User ID Share */}
        {activeTab === 'direct' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--accent)', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', padding: '1.15rem', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', lineHeight: '1.5' }}>
              <UserPlus size={14} style={{ color: 'var(--accent)', marginRight: '0.25rem', display: 'inline' }} />
              <strong>아이디로 보관함에 즉시 배달!</strong><br />
              지정하신 상대방의 **사용자 ID** 보관함으로 이 학습 세트를 직접 쏴줍니다! 상대방이 앱을 켜면 별도로 링크를 입력하지 않아도 보관함 리스트에 실시간으로 자동 노출됩니다.
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
                    placeholder="예: user_friend"
                    className="input-glow"
                    disabled={isDirectSharing}
                  />
                  <button 
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent) 0%, #db2777 100%)',
                      boxShadow: '0 4px 12px rgba(236,72,153,0.15)',
                      flexShrink: 0,
                      padding: '0.65rem 1.15rem'
                    }}
                    disabled={isDirectSharing}
                  >
                    {isDirectSharing ? '전송 중...' : '보관함 전송'}
                  </button>
                </div>
              </div>

              {directShareSuccess && (
                <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.15)', alignItems: 'center' }}>
                  <Check size={14} style={{ flexShrink: 0 }} />
                  <span>상대방 보관함으로 학습 세트가 성공적으로 배송되었습니다!</span>
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
        )}

        {/* Tab Contents: Serverless Share */}
        {activeTab === 'serverless' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--secondary)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.01) 100%)', padding: '1.15rem', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', lineHeight: '1.5' }}>
              <Sparkles size={14} style={{ color: 'var(--secondary)', marginRight: '0.25rem', display: 'inline' }} />
              <strong>서버가 전혀 필요 없는 압축 URL 공유!</strong><br />
              분석, 예문, 퀴즈 내용 일체가 GZIP 알고리즘으로 압축되어 URL 주소 내부에 원형 그대로 보관됩니다. DB 유실이나 점검과 상관없이 언제나 100% 안전하게 작동합니다.<br />
              <span style={{ color: 'var(--error)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem', fontWeight: '600' }}>
                ※ 주의: 해설과 문제의 양이 너무 많으면 주소가 길어져 메신저 공유 시 전송이 차단될 수 있습니다.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                생성된 무제한 압축 URL
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={serverlessUrl}
                  className="input-glow"
                  style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis' }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button 
                  className="btn btn-primary"
                  style={{
                    background: copied ? 'var(--success)' : 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)',
                    boxShadow: 'none',
                    flexShrink: 0,
                    padding: '0.65rem 1.15rem'
                  }}
                  onClick={() => handleCopy(serverlessUrl)}
                >
                  {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  {copied ? '복사됨!' : '링크 복사'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Footnote Information */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.725rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Globe size={13} style={{ color: 'var(--secondary)' }} />
            <span>이 단독 링크는 노션, 슬랙, 블로그, 이메일 등에 자유롭게 공유할 수 있습니다.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Sparkles size={13} style={{ color: 'var(--primary)' }} />
            <span>퀴즈를 받은 학생들은 별도의 가입 없이 링크 클릭만으로 즉시 풀 수 있습니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
