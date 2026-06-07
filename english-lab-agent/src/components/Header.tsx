import React, { useState } from 'react';
import { FlaskConical, Flame, BookOpen, Settings, Check, X, Eye, EyeOff } from 'lucide-react';
import type { AppStats } from '../types';

interface HeaderProps {
  stats: AppStats;
  wrongAnswersCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  userId: string;
  onSaveUserId: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  wrongAnswersCount,
  activeTab,
  setActiveTab,
  apiKey,
  onSaveApiKey,
  userId,
  onSaveUserId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempWebhookUrl, setTempWebhookUrl] = useState(() => localStorage.getItem('email_webhook_url') || '');
  const [showKey, setShowKey] = useState(false);
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(tempKey.trim());
    onSaveUserId(tempUserId.trim());
    
    const url = tempWebhookUrl.trim();
    if (url) {
      localStorage.setItem('email_webhook_url', url);
    } else {
      localStorage.removeItem('email_webhook_url');
    }
    
    setIsSavedAlert(true);
    setTimeout(() => {
      setIsSavedAlert(false);
      setIsModalOpen(false);
    }, 1200);
  };

  return (
    <header className="app-header">
      <div className="app-brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('learn')}>
        <FlaskConical className="pulse-glow" style={{ color: 'var(--primary)', fill: 'rgba(16, 185, 129, 0.2)' }} />
        <span>LAB.AGENT</span>
      </div>

      <div className="app-nav">
        {/* Navigation Tabs */}
        <button
          className={`btn btn-secondary ${activeTab === 'learn' ? 'active' : ''}`}
          style={{
            background: activeTab === 'learn' ? 'var(--primary)' : 'transparent',
            borderColor: activeTab === 'learn' ? 'var(--primary)' : 'var(--border-color)',
            color: activeTab === 'learn' ? 'white' : 'var(--text-secondary)'
          }}
          onClick={() => setActiveTab('learn')}
        >
          <BookOpen size={16} />
          학습 &amp; 첨삭
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
          오답 노트
          {wrongAnswersCount > 0 && (
            <span className="badge animate-pop" style={{ marginLeft: '0.25rem' }}>
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
          학습 리포트
        </button>

        {/* Streak Counter */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <Flame size={18} className="streak-fire" />
          <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{stats.streak}일 연속</span>
        </div>

        {/* User Account ID Badge */}
        {userId && (
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700' }}>☁️ {userId}</span>
          </div>
        )}

        {/* API Settings */}
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setTempKey(apiKey);
            setTempUserId(userId);
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
              <Settings size={20} style={{ color: 'var(--primary)' }} />
              서비스 설정
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Gemini API Key */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  *입력하신 API Key는 외부 서버로 전송되지 않고 사용자의 웹 브라우저 로컬 스토리지에만 안전하게 보관됩니다.
                </span>
              </div>

              {/* User ID Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  사용자 ID (User ID) 설정
                </label>
                <input
                  type="text"
                  value={tempUserId}
                  onChange={(e) => setTempUserId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="예: nikelite"
                  className="input-glow"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  * ID를 설정하면 로컬 영작 학습 보관함이 클라우드와 자동으로 양방향 동기화(Sync)되며, 기기 변경이나 캐시 초기화 시에도 학습 기록을 보존할 수 있습니다. (영문/숫자/_/- 만 허용)
                </span>
              </div>

              {/* Webhook URL Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  이메일 리포트 Webhook URL
                </label>
                <input
                  type="text"
                  value={tempWebhookUrl}
                  onChange={(e) => setTempWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="input-glow"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  구글 Firebase SMTP 메일 발송 에러 우회를 위한 Webhook 주소입니다. 등록하면 퀴즈 풀이 완료 시 메일 성적표가 즉시 전송됩니다.
                </span>
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
