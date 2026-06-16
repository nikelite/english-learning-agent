import React, { useState } from 'react';
import { BookOpen, Flame, Settings, X, Eye, EyeOff, Check } from 'lucide-react';
import { AppStats } from '../types';

interface HeaderProps {
  stats: AppStats;
  wrongAnswersCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  userId: string;
  onSaveUserId: (id: string) => void;
  isSharedQuiz: boolean;
  userEmail: string;
  onSaveUserEmail: (email: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  wrongAnswersCount,
  activeTab,
  setActiveTab,
  apiKey,
  onSaveApiKey,
  userId,
  onSaveUserId,
  isSharedQuiz,
  userEmail,
  onSaveUserEmail
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempUserEmail, setTempUserEmail] = useState(userEmail);
  const [showKey, setShowKey] = useState(false);
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  const getEmailPlaceholder = (id: string) => {
    const trimmed = id.trim().toLowerCase();
    if (trimmed === 'nikelite') return '기본값: nikelite+quiz@gmail.com';
    if (trimmed === 'junhu') return '기본값: nikelite+quiz@gmail.com, yjkwon98@hanmail.net, junhupark21@gmail.com';
    return '기본값: nikelite@gmail.com';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(tempKey.trim());
    onSaveUserId(tempUserId.trim());
    onSaveUserEmail(tempUserEmail.trim());
    
    setIsSavedAlert(true);
    setTimeout(() => {
      setIsSavedAlert(false);
      setIsModalOpen(false);
    }, 1200);
  };

  return (
    <header className="app-header">
      <div 
        className="app-brand" 
        style={{ cursor: 'pointer' }} 
        onClick={() => {
          if (!isSharedQuiz) setActiveTab('learn');
        }}
      >
        <BookOpen className="pulse-glow" style={{ color: 'var(--secondary)', fill: 'rgba(6, 182, 212, 0.1)' }} />
        <span>READ.AGENT</span>
      </div>

      <div className="app-nav">
        {/* Navigation Tabs (disabled or hidden during shared quiz view to prevent clutter) */}
        {!isSharedQuiz ? (
          <>
            <button
              className={`btn btn-secondary ${activeTab === 'learn' ? 'active' : ''}`}
              style={{
                background: activeTab === 'learn' ? 'var(--primary)' : 'transparent',
                borderColor: activeTab === 'learn' ? 'var(--primary)' : 'var(--border-color)',
                color: activeTab === 'learn' ? 'white' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('learn')}
            >
              독해 학습 &amp; 퀴즈
            </button>

            <button
              className={`btn btn-secondary ${activeTab === 'review' ? 'active' : ''}`}
              style={{
                background: activeTab === 'review' ? 'var(--accent)' : 'transparent',
                borderColor: activeTab === 'review' ? 'var(--accent)' : 'var(--border-color)',
                color: activeTab === 'review' ? 'white' : 'var(--text-secondary)',
                position: 'relative'
              }}
              onClick={() => setActiveTab('review')}
            >
              오답 복습방
              {wrongAnswersCount > 0 && (
                <span className="badge" style={{ marginLeft: '0.25rem' }}>
                  {wrongAnswersCount}
                </span>
              )}
            </button>

            <button
              className={`btn btn-secondary ${activeTab === 'analytics' ? 'active' : ''}`}
              style={{
                background: activeTab === 'analytics' ? 'var(--secondary)' : 'transparent',
                borderColor: activeTab === 'analytics' ? 'var(--secondary)' : 'var(--border-color)',
                color: activeTab === 'analytics' ? 'white' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('analytics')}
            >
              실력 성적표
            </button>
          </>
        ) : (
          <span style={{ fontSize: '0.8rem', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--secondary)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.25)', fontWeight: '700' }}>
            🔗 링크로 공유 받은 퀴즈 진행 중
          </span>
        )}

        {/* Streak Counter */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <Flame size={18} className="streak-fire" />
          <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{stats.streak}일 스트릭</span>
        </div>

        {/* User Account ID Badge if exists */}
        {userId && (
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: '700' }}>☁️ {userId}</span>
          </div>
        )}

        {/* API Settings */}
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setTempKey(apiKey);
            setTempUserId(userId);
            setTempUserEmail(userEmail);
            setIsModalOpen(true);
          }}
          title="서비스 설정"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', borderRadius: '50%' }}
              onClick={() => setIsModalOpen(false)}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} style={{ color: 'var(--secondary)' }} />
              서비스 설정
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Gemini API Key */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  Gemini API Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="input-glow"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                  독해 지문을 AI로 정밀 분석하기 위해 Gemini API Key가 필요합니다. 입력된 키는 오직 브라우저 로컬 스토리지에만 저장됩니다.
                </p>
              </div>

              {/* User ID Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  사용자 ID (User ID) 설정
                </label>
                <input
                  type="text"
                  value={tempUserId}
                  onChange={(e) => setTempUserId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="예: nikelite"
                  className="input-glow"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  * ID를 설정하면 로컬 학습 보관함이 클라우드와 자동으로 양방향 동기화(Sync)되며, 기기 변경이나 캐시 초기화 시에도 학습 기록을 보존할 수 있습니다. 또한, 이 ID를 통해 다른 사용자가 링크 없이 내 보관함으로 학습 자료를 다이렉트 전송할 수 있습니다. (영문/숫자/_/- 만 허용)
                </p>
              </div>

              {/* Recipient Email Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  결과 리포트 수신 이메일 (Recipient Email)
                </label>
                <input
                  type="text"
                  value={tempUserEmail}
                  onChange={(e) => setTempUserEmail(e.target.value)}
                  placeholder={getEmailPlaceholder(tempUserId)}
                  className="input-glow"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  * 빈칸으로 둘 경우 사용자 ID 기준 기본 이메일로 전송됩니다. 여러 개의 이메일은 쉼표(,)로 구분하여 입력하세요.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)', boxShadow: '0 4px 15px rgba(6,182,212,0.2)' }}
                  disabled={isSavedAlert}
                >
                  {isSavedAlert ? (
                    <>
                      <Check size={16} />
                      저장 완료!
                    </>
                  ) : (
                    '저장하기'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
