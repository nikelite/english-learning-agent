import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, BookOpen, Settings, Check, X, Eye, EyeOff } from 'lucide-react';
import { AppStats } from '../types';
import { fetchMochiDecks } from '../mochiService';

interface HeaderProps {
  stats: AppStats;
  wrongAnswersCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  userId: string;
  onSaveUserId: (id: string) => void;
  userEmail: string;
  onSaveUserEmail: (email: string) => void;
  mochiApiKey: string;
  onSaveMochiApiKey: (key: string) => void;
  mochiDecks: any[];
  mochiQuizDeckId: string;
  onSaveMochiQuizDeckId: (deckId: string) => void;
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
  userEmail,
  onSaveUserEmail,
  mochiApiKey,
  onSaveMochiApiKey,
  mochiDecks,
  mochiQuizDeckId,
  onSaveMochiQuizDeckId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempUserId, setTempUserId] = useState(userId);
  const [tempUserEmail, setTempUserEmail] = useState(userEmail);
  const [tempMochiApiKey, setTempMochiApiKey] = useState(mochiApiKey);
  const [tempMochiQuizDeckId, setTempMochiQuizDeckId] = useState(mochiQuizDeckId);
  const [showKey, setShowKey] = useState(false);
  const [showMochiKey, setShowMochiKey] = useState(false);
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  
  const [localDecks, setLocalDecks] = useState<any[]>(mochiDecks || []);
  const [isFetchingDecks, setIsFetchingDecks] = useState(false);

  useEffect(() => {
    if (!tempMochiApiKey.trim()) {
      setLocalDecks([]);
      return;
    }
    
    const delayDebounceFn = setTimeout(async () => {
      setIsFetchingDecks(true);
      try {
        const decks = await fetchMochiDecks(tempMochiApiKey);
        setLocalDecks(decks);
      } catch (err) {
        console.error("Failed to fetch Mochi decks in Header settings modal:", err);
      } finally {
        setIsFetchingDecks(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [tempMochiApiKey, isModalOpen]);

  useEffect(() => {
    if (localDecks.length > 0 && !tempMochiQuizDeckId) {
      const smartDefault = localDecks.find(d => 
        d.name.toLowerCase().includes('english') || 
        d.name.toLowerCase().includes('영어') || 
        d.name.toLowerCase().includes('quiz') || 
        d.name.toLowerCase().includes('오답')
      );
      if (smartDefault) {
        setTempMochiQuizDeckId(smartDefault.id);
      } else {
        setTempMochiQuizDeckId(localDecks[0].id);
      }
    }
  }, [localDecks, tempMochiQuizDeckId]);

  const getEmailPlaceholder = (id: string) => {
    const trimmed = id.trim().toLowerCase();
    if (trimmed === 'nikelite') return '기본값: nikelite+quiz@gmail.com';
    if (trimmed === 'junhu') return '기본값: nikelite+quiz@gmail.com, yjkwon98@hanmail.net, junhupark21@gmail.com';
    return '기본값: nikelite@gmail.com';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(tempKey.trim());
    onSaveUserId(tempUserId.trim().toLowerCase());
    onSaveUserEmail(tempUserEmail.trim());
    onSaveMochiApiKey(tempMochiApiKey.trim());
    onSaveMochiQuizDeckId(tempMochiQuizDeckId);
    
    setIsSavedAlert(true);
    setTimeout(() => {
      setIsSavedAlert(false);
      setIsModalOpen(false);
    }, 1200);
  };

  return (
    <header className="app-header">
      <div className="app-brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('learn')}>
        <Sparkles className="pulse-glow" style={{ color: 'var(--primary)', fill: 'rgba(139, 92, 246, 0.2)' }} />
        <span>ENG.AGENT</span>
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
          학습 &amp; 퀴즈
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
          학습 리포트
        </button>

        {/* Streak Counter */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <Flame size={18} className="streak-fire" />
          <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{stats.streak}일 연속</span>
        </div>

        {/* User Account ID Badge if exists */}
        {userId && (
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700' }}>☁️ {userId}</span>
          </div>
        )}

        {/* API Settings */}
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setTempKey(apiKey);
            setTempUserId(userId);
            setTempUserEmail(userEmail);
            setTempMochiApiKey(mochiApiKey);
            setTempMochiQuizDeckId(mochiQuizDeckId);
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
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
                  onChange={(e) => setTempUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="예: nikelite"
                  className="input-glow"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  * ID를 설정하면 로컬 학습 보관함이 클라우드와 자동으로 양방향 동기화(Sync)되며, 기기 변경이나 캐시 초기화 시에도 학습 기록을 보존할 수 있습니다. 또한, 이 ID를 통해 다른 사용자가 링크 없이 내 보관함으로 학습 자료를 다이렉트 전송할 수 있습니다. (영문/숫자/_/- 만 허용)
                </span>
              </div>

              {/* Recipient Email Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  결과 리포트 수신 이메일 (Recipient Email)
                </label>
                <input
                  type="text"
                  value={tempUserEmail}
                  onChange={(e) => setTempUserEmail(e.target.value)}
                  placeholder={getEmailPlaceholder(tempUserId)}
                  className="input-glow"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  * 빈칸으로 둘 경우 사용자 ID 기준 기본 이메일로 전송됩니다. 여러 개의 이메일은 쉼표(,)로 구분하여 입력하세요.
                </span>
              </div>

              {/* Mochi API Key Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Mochi API Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showMochiKey ? 'text' : 'password'}
                    value={tempMochiApiKey}
                    onChange={(e) => setTempMochiApiKey(e.target.value)}
                    placeholder="Mochi API Key를 입력하세요"
                    className="input-glow"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => setShowMochiKey(!showMochiKey)}
                  >
                    {showMochiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  * Mochi 카드의 오답 노트를 가져오기 위해 필요한 API Key입니다. 설정 화면에서 키를 생성하여 붙여넣으세요.
                </span>

                {tempMochiApiKey.trim() && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      🎯 오답/퀴즈 전송용 Mochi 덱
                    </label>
                    {isFetchingDecks ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        덱 목록 불러오는 중...
                      </div>
                    ) : localDecks.length > 0 ? (
                      <select
                        value={tempMochiQuizDeckId}
                        onChange={(e) => setTempMochiQuizDeckId(e.target.value)}
                        className="select-glow"
                        style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-input)', color: 'white' }}
                      >
                        <option value="">-- 전송할 덱 선택 --</option>
                        {localDecks.map((deck) => (
                          <option key={deck.id} value={deck.id}>
                            {deck.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                        불러온 Mochi 덱이 없습니다. Mochi에 덱을 먼저 생성해 주세요.
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      * 학습 도중 또는 오답 노출방에서 Mochi 카드를 추가할 때 해당 덱으로 카드가 전송됩니다.
                    </span>
                  </div>
                )}
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
