import React, { useState } from 'react';
import { BookOpen, Flame, Settings, X, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { AppStats } from '../types';

interface HeaderProps {
  stats: AppStats;
  wrongAnswersCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  isSharedQuiz: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  wrongAnswersCount,
  activeTab,
  setActiveTab,
  apiKey,
  onSaveApiKey,
  isSharedQuiz
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(tempKey.trim());
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

        {/* API Settings */}
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setTempKey(apiKey);
            setIsModalOpen(true);
          }}
          title="Gemini API Key 설정"
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

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} style={{ color: 'var(--secondary)' }} />
              Gemini API Key 설정
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              독해 지문을 AI로 정밀 분석하기 위해 Gemini API Key가 필요합니다. 입력된 키는 오직 본인 웹 브라우저(`localStorage`)에만 안전하게 저장됩니다.
            </p>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
