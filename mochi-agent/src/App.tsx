import { useState, useEffect } from 'react';
import type { MochiCard, MochiDeck } from './types';
import { generateMochiCards } from './geminiService';
import { 
  fetchMochiDecks, 
  createMochiDeck, 
  createMochiCard 
} from './mochiService';
import { 
  saveDeckToCloud, 
  deleteDeckFromCloud, 
  syncUserDecks 
} from './firebaseService';
import { MochiStudyRoom } from './components/MochiStudyRoom';
import { 
  Settings, 
  Sparkles, 
  History, 
  Trash2, 
  Play, 
  UploadCloud, 
  Save, 
  BookOpen,
  AlertCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';

function App() {
  // Config & Keys
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mochiApiKey, setMochiApiKey] = useState('');
  const [userId, setUserId] = useState('nikelite');
  const [showSettings, setShowSettings] = useState(false);

  // App Main State
  const [inputText, setInputText] = useState('');
  const [deckMode, setDeckMode] = useState<'study' | 'quiz'>('study');
  const [previewCards, setPreviewCards] = useState<MochiCard[]>([]);
  const [decks, setDecks] = useState<MochiDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<MochiDeck | null>(null);

  // Status & Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State for Save / Export
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveType, setSaveType] = useState<'local' | 'mochi'>('local');
  const [deckName, setDeckName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedMochiDeckId, setSelectedMochiDeckId] = useState('new');
  const [existingMochiDecks, setExistingMochiDecks] = useState<any[]>([]);
  const [cardStyle, setCardStyle] = useState<'eng-first' | 'kor-first' | 'both'>('eng-first');
  
  // Progress in Modal
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load configuration and decks on mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('mochi_gemini_api_key') || '';
    const savedMochiKey = localStorage.getItem('mochi_api_key') || '';
    const savedUserId = localStorage.getItem('mochi_user_id') || 'nikelite';
    
    setGeminiApiKey(savedGeminiKey);
    setMochiApiKey(savedMochiKey);
    setUserId(savedUserId);

    // Load local decks first
    const localDecksJson = localStorage.getItem('mochi_local_decks');
    let localDecks: MochiDeck[] = [];
    if (localDecksJson) {
      try {
        localDecks = JSON.parse(localDecksJson);
        setDecks(localDecks);
      } catch (e) {
        console.error("Failed to parse local decks", e);
      }
    }

    // Dynamic sync if userId is present
    if (savedUserId) {
      syncWithCloud(savedUserId, localDecks);
    }
  }, []);

  const syncWithCloud = async (uid: string, currentDecks: MochiDeck[]) => {
    try {
      const synced = await syncUserDecks(uid, currentDecks);
      setDecks(synced);
      localStorage.setItem('mochi_local_decks', JSON.stringify(synced));
    } catch (err) {
      console.warn("Could not sync with cloud on mount:", err);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('mochi_gemini_api_key', geminiApiKey.trim());
    localStorage.setItem('mochi_api_key', mochiApiKey.trim());
    localStorage.setItem('mochi_user_id', userId.trim());
    
    setShowSettings(false);
    showNotification('설정이 안전하게 저장되었습니다!', 'success');

    // Run sync after user updates settings
    const localDecksJson = localStorage.getItem('mochi_local_decks');
    const localDecks = localDecksJson ? JSON.parse(localDecksJson) : [];
    syncWithCloud(userId.trim(), localDecks);
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  // Generate cards via Gemini
  const handleGenerate = async () => {
    if (!inputText.trim()) {
      showNotification('영어 단어 또는 예문을 입력해 주세요.', 'error');
      return;
    }
    if (!geminiApiKey.trim()) {
      showNotification('Gemini API Key가 누락되었습니다. 설정창에서 등록해 주세요.', 'error');
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setPreviewCards([]);

    try {
      const parsedCards = await generateMochiCards(inputText, deckMode, geminiApiKey);
      if (parsedCards.length === 0) {
        throw new Error("생성된 카드가 없습니다. 입력 텍스트를 확인해 주세요.");
      }
      setPreviewCards(parsedCards);
      
      // Default deck name suggestion
      const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      setDeckName(`영어 암기 - ${deckMode === 'study' ? '카드' : '퀴즈'} (${dateStr})`);
      setTagsInput(deckMode === 'study' ? 'vocabulary, study' : 'vocabulary, quiz');
      showNotification(`${parsedCards.length}개의 어휘 카드가 성공적으로 분석되었습니다.`, 'success');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "카드 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete card from preview prior to export
  const handleDeletePreviewCard = (id: string) => {
    setPreviewCards(prev => prev.filter(c => c.id !== id));
  };

  // Open Save/Export Modal
  const openSaveModal = async (type: 'local' | 'mochi') => {
    setSaveType(type);
    setShowSaveModal(true);
    setSaveSuccess(false);
    setIsSaving(false);
    setSaveProgress(0);
    setSaveStatusText('');
    
    if (type === 'mochi') {
      if (!mochiApiKey.trim()) {
        showNotification('Mochi API Key가 등록되어 있지 않습니다. 설정창에서 확인해 주세요.', 'error');
        setShowSaveModal(false);
        setShowSettings(true);
        return;
      }
      // Fetch existing mochi decks
      try {
        setSaveStatusText('Mochi 덱 목록 조회 중...');
        const fetchedDecks = await fetchMochiDecks(mochiApiKey);
        setExistingMochiDecks(fetchedDecks);
        setSaveStatusText('');
      } catch (err: any) {
        console.warn("Mochi 덱 목록 가져오기 실패:", err);
        setSaveStatusText('Mochi 덱 목록을 가져오지 못했습니다. 새 덱으로 생성만 가능합니다.');
      }
    }
  };

  // Final Action to Save/Export
  const handleConfirmSave = async () => {
    if (!deckName.trim()) {
      alert("덱 이름을 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setSaveProgress(10);
    setSaveStatusText('데이터 준비 중...');

    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    try {
      let exportedDeckId: string | null = null;
      let exportedDeckName: string | null = null;

      if (saveType === 'mochi') {
        // Step 1: Handle Deck on Mochi
        if (selectedMochiDeckId === 'new') {
          setSaveStatusText('Mochi에 새 덱 생성 중...');
          const newMochiDeck = await createMochiDeck(deckName, mochiApiKey);
          exportedDeckId = newMochiDeck.id;
          exportedDeckName = newMochiDeck.name;
        } else {
          exportedDeckId = selectedMochiDeckId;
          const found = existingMochiDecks.find(d => d.id === selectedMochiDeckId);
          exportedDeckName = found ? found.name : deckName;
        }

        setSaveProgress(30);

        // Step 2: Upload cards to Mochi
        const totalCards = previewCards.length;
        for (let i = 0; i < totalCards; i++) {
          const card = previewCards[i];
          const progressPercent = 30 + Math.round((i / totalCards) * 60);
          setSaveProgress(progressPercent);
          setSaveStatusText(`Mochi 카드 업로드 중 (${i + 1}/${totalCards}): ${card.english}`);
          
          await createMochiCard(card, exportedDeckId, tagsArray, deckMode, cardStyle, mochiApiKey);
        }
      }

      setSaveProgress(90);
      setSaveStatusText('클라우드 데이터베이스 저장 중...');

      // Step 3: Compile MochiDeck object and save to LocalStorage & Firebase Firestore
      const newDeck: MochiDeck = {
        id: `deck-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: deckName.trim(),
        createdAt: Date.now(),
        cards: previewCards,
        tags: tagsArray,
        mode: deckMode,
        isExported: saveType === 'mochi',
        exportedDeckId: exportedDeckId,
        exportedDeckName: exportedDeckName,
        exportedAt: saveType === 'mochi' ? Date.now() : null,
        ownerId: userId.trim() || null
      };

      // Save to Cloud
      if (userId.trim()) {
        await saveDeckToCloud(newDeck, userId.trim());
      }

      // Update Local State & LocalStorage
      const updatedDecks = [newDeck, ...decks];
      setDecks(updatedDecks);
      localStorage.setItem('mochi_local_decks', JSON.stringify(updatedDecks));

      setSaveProgress(100);
      setSaveStatusText(saveType === 'mochi' ? 'Mochi 내보내기 및 저장이 완료되었습니다!' : '로컬 및 클라우드 저장이 완료되었습니다!');
      setSaveSuccess(true);
      setPreviewCards([]); // Clear preview list
    } catch (err: any) {
      console.error(err);
      alert(`저장 중 오류가 발생했습니다: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Deck History
  const handleDeleteDeck = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("이 덱을 삭제하시겠습니까? 클라우드와 로컬 저장소 모두에서 영구 삭제됩니다.")) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDeckFromCloud(deckId);
      
      // Update local storage
      const updated = decks.filter(d => d.id !== deckId);
      setDecks(updated);
      localStorage.setItem('mochi_local_decks', JSON.stringify(updated));
      
      if (activeDeck && activeDeck.id === deckId) {
        setActiveDeck(null);
      }
      showNotification('덱이 안전하게 삭제되었습니다.', 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(`삭제 실패: ${err.message}`, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Navigation Bar */}
      <header className="app-navbar">
        <div className="logo-container">
          <span className="logo-icon">
            <Sparkles size={22} />
          </span>
          <span className="logo-text">MOCHI.AGENT</span>
        </div>
        <div className="nav-actions">
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="btn btn-secondary"
            title="설정 열기"
          >
            <Settings size={16} /> 설정
          </button>
        </div>
      </header>

      {/* Split Dashboard Screen */}
      <main className="dashboard-layout">
        {/* Left Control Panel */}
        <section className="left-panel">
          {/* Settings Section */}
          {showSettings && (
            <div className="card-section animate-fade-in">
              <h3 className="section-title">
                <Settings size={18} className="text-primary" /> API Key 및 클라우드 설정
              </h3>
              <div className="form-group">
                <label className="form-label">Gemini API Key</label>
                <input 
                  type="password" 
                  className="form-input font-english"
                  placeholder="AIzaSy..."
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mochi.cards API Key</label>
                <input 
                  type="password" 
                  className="form-input font-english"
                  placeholder="mochi-key-..."
                  value={mochiApiKey}
                  onChange={(e) => setMochiApiKey(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Firebase User ID (동기화 기준)</label>
                <input 
                  type="text" 
                  className="form-input font-english"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button onClick={handleSaveSettings} className="btn btn-primary" style={{ flex: 1 }}>
                  저장
                </button>
                <button onClick={() => setShowSettings(false)} className="btn btn-secondary">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* New Input Generator Section */}
          <div className="card-section">
            <h3 className="section-title">
              <Sparkles size={18} className="text-secondary" /> 새로운 암기카드 / 퀴즈 생성
            </h3>
            
            <div className="form-group">
              <label className="form-label">어휘 단어 또는 예문 입력 (여러 줄 입력 가능)</label>
              <textarea 
                className="form-textarea font-english"
                placeholder="영어 단어 리스트를 입력하거나, 예문을 입력해 보세요.
예문 입력 예시:
How will this change affect other {{downstream}} services?
I’m curious about your {{perspective}} on the new tech stack."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">학습 형태 모드 선택</label>
              <div className="mode-selector">
                <button 
                  className={`mode-option-btn ${deckMode === 'study' ? 'active' : ''}`}
                  onClick={() => setDeckMode('study')}
                >
                  암기 카드
                </button>
                <button 
                  className={`mode-option-btn ${deckMode === 'quiz' ? 'active' : ''}`}
                  onClick={() => setDeckMode('quiz')}
                >
                  어휘 퀴즈
                </button>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>AI 어휘 분석 및 생성 중...</>
              ) : (
                <>
                  <Sparkles size={16} /> 카드 만들기 (Gemini)
                </>
              )}
            </button>
          </div>

          {/* History Deck List Section */}
          <div className="card-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="section-title">
              <History size={18} className="text-muted" /> 학습 이력 및 덱 리스트
            </h3>
            {decks.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '2rem 1rem', fontSize: '0.85rem' }}>
                저장된 학습 이력이 없습니다.
              </div>
            ) : (
              <div className="deck-history-list">
                {decks.map((deck) => (
                  <div 
                    key={deck.id} 
                    className={`deck-item-card ${activeDeck?.id === deck.id ? 'active' : ''}`}
                    onClick={() => {
                      setPreviewCards([]); // Close preview if we study a deck
                      setActiveDeck(deck);
                    }}
                  >
                    <div className="deck-item-info">
                      <span className="deck-item-name">{deck.name}</span>
                      <div className="deck-item-meta">
                        <span className={`deck-badge ${deck.mode}`}>
                          {deck.mode === 'study' ? '암기' : '퀴즈'}
                        </span>
                        <span>• Card: {deck.cards?.length || 0}개</span>
                        <span>
                          {deck.isExported ? (
                            <span className="sync-status-badge synced" title="Mochi 동기화 완료">Mochi</span>
                          ) : (
                            <span className="sync-status-badge local" title="로컬/클라우드 저장됨">Saved</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="deck-item-actions">
                      <button className="deck-delete-btn" onClick={(e) => handleDeleteDeck(deck.id, e)} title="삭제">
                        <Trash2 size={14} />
                      </button>
                      <Play size={14} className="text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Preview/Study Room Panel */}
        <section className="right-panel">
          {/* Notification toasts */}
          {successMessage && (
            <div className="alert-toast success animate-slide-up" style={{
              position: 'fixed', top: '80px', right: '20px', zIndex: 999,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'var(--success-light)', color: 'var(--success)',
              border: '1px solid var(--success)', padding: '0.75rem 1.25rem', borderRadius: '8px'
            }}>
              <CheckCircle2 size={18} /> {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="alert-toast error animate-slide-up" style={{
              position: 'fixed', top: '80px', right: '20px', zIndex: 999,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'var(--danger-light)', color: 'var(--danger)',
              border: '1px solid var(--danger)', padding: '0.75rem 1.25rem', borderRadius: '8px'
            }}>
              <AlertCircle size={18} /> {errorMessage}
            </div>
          )}

          {activeDeck ? (
            /* Active Study Room */
            <MochiStudyRoom 
              deck={activeDeck} 
              onClose={() => setActiveDeck(null)} 
            />
          ) : previewCards.length > 0 ? (
            /* Preview of Generated Cards Prior to saving */
            <div className="animate-fade-in" style={{ width: '100%', maxWidth: '800px' }}>
              <div className="preview-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} className="text-primary" />
                  <h3 className="preview-title">
                    AI 분석 카드 검토 ({previewCards.length}개)
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => openSaveModal('local')} className="btn btn-secondary">
                    <Save size={16} /> 저장만 하기
                  </button>
                  <button onClick={() => openSaveModal('mochi')} className="btn btn-primary">
                    <UploadCloud size={16} /> Mochi로 내보내기 & 저장
                  </button>
                </div>
              </div>

              <div className="preview-cards-grid">
                {previewCards.map((card) => (
                  <div key={card.id} className="preview-card">
                    <button 
                      className="preview-card-delete-btn" 
                      onClick={() => handleDeletePreviewCard(card.id)}
                      title="이 카드 제외"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="preview-card-header">
                      <span className="preview-card-term font-english">{card.english}</span>
                      <span className="preview-card-pos font-korean">{card.pos}</span>
                    </div>

                    <div className="preview-card-meaning font-korean">
                      {card.korean}
                    </div>

                    <div className="preview-card-example font-korean">
                      <div className="eng font-english">{card.exampleEng}</div>
                      <div className="kor font-korean">{card.exampleKor}</div>
                    </div>

                    {card.tip && (
                      <div className="preview-card-tip font-korean">
                        <span>💡</span>
                        <span>{card.tip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Idle Empty State */
            <div className="empty-right-panel">
              <div className="empty-icon-container">
                <BookOpen size={48} />
              </div>
              <h2>Mochi 학습 덱 플래너</h2>
              <p>
                왼쪽 창에 영어 단어나 cloze 예문을 입력하고 <strong>카드 만들기</strong>를 실행하면,
                AI가 단어의 다의어를 분할하고, 품사 정보, 한국어 뜻, 양방향 예문, 그리고 연상 암기 팁을 생성합니다.
                완성된 카드 덱은 로컬 및 파이어베이스 클라우드에 영구 백업되며, <strong>Mochi.cards</strong> 앱의 
                스페이스 반복 학습용 덱으로 클릭 한 번에 내보낼 수 있습니다.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  onClick={() => {
                    setInputText(`How will this change affect other {{downstream}} services?\nI’m curious about your {{perspective}} on the new tech stack.`);
                    setDeckMode('study');
                  }} 
                  className="btn btn-secondary"
                >
                  샘플 텍스트 로드
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Export / Save Dialog Modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {saveType === 'mochi' ? 'Mochi.cards 내보내기 & 저장' : '로컬 및 클라우드 저장'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowSaveModal(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              {saveSuccess ? (
                <div className="text-center animate-fade-in" style={{ padding: '1rem 0' }}>
                  <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                    <CheckCircle2 size={48} style={{ margin: '0 auto' }} />
                  </div>
                  <h4>덱 저장이 완벽하게 성공했습니다!</h4>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {saveType === 'mochi' 
                      ? 'Mochi.cards 계정의 덱에 새로운 카드가 성공적으로 업로드되었습니다.' 
                      : '로컬 히스토리 및 Firestore 클라우드 백업이 완료되었습니다.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">덱 이름</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">태그 (쉼표로 구분)</label>
                    <input 
                      type="text" 
                      className="form-input font-english" 
                      placeholder="vocabulary, toeic, custom"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>

                  {saveType === 'mochi' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">대상 Mochi 덱 선택</label>
                        <select 
                          className="form-input"
                          value={selectedMochiDeckId}
                          onChange={(e) => setSelectedMochiDeckId(e.target.value)}
                          disabled={isSaving}
                        >
                          <option value="new">[새로운 Mochi 덱으로 생성]</option>
                          {existingMochiDecks.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      {deckMode === 'study' && (
                        <div className="form-group">
                          <label className="form-label">카드 생성 레이아웃 방식</label>
                          <select
                            className="form-input"
                            value={cardStyle}
                            onChange={(e) => setCardStyle(e.target.value as any)}
                            disabled={isSaving}
                          >
                            <option value="eng-first">영어단어 먼저 (Front: English / Back: Korean)</option>
                            <option value="kor-first">한국어 뜻 먼저 (Front: Korean / Back: English)</option>
                            <option value="both">양방향 모두 생성 (영어 Front 카드 + 한국어 Front 카드 총 2개 생성)</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {isSaving && (
                    <div className="export-progress-container animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span className="export-progress-text">{saveStatusText}</span>
                        <span>{saveProgress}%</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${saveProgress}%` }} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              {saveSuccess ? (
                <button 
                  onClick={() => setShowSaveModal(false)} 
                  className="btn btn-primary"
                >
                  확인 완료
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setShowSaveModal(false)} 
                    className="btn btn-secondary"
                    disabled={isSaving}
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleConfirmSave} 
                    className="btn btn-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>저장 중...</>
                    ) : saveType === 'mochi' ? (
                      <>
                        <UploadCloud size={16} /> Mochi 내보내기 & 저장
                      </>
                    ) : (
                      <>
                        <Save size={16} /> 로컬/클라우드 저장
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
