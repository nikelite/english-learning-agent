import React, { useState, useEffect } from 'react';
import { HelpCircle, Brain, Volume2, ChevronRight } from 'lucide-react';
import { Lesson } from '../types';

interface StudyTabsProps {
  lesson: Lesson;
  activeStudyTab: 'eli5' | 'memory' | 'pronounce';
  setActiveStudyTab: (tab: 'eli5' | 'memory' | 'pronounce') => void;
  apiKey: string;
}

export const StudyTabs: React.FC<StudyTabsProps> = ({
  lesson,
  activeStudyTab,
  setActiveStudyTab,
  apiKey
}) => {
  const { eli5, memoryTips, pronunciation } = lesson;

  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    setChatHistory([]);
    setQuestionInput('');
    setIsAsking(false);
  }, [lesson.id]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = questionInput.trim();
    if (!queryStr || isAsking || !apiKey) return;

    const newHistory = [...chatHistory, { role: 'user' as const, text: queryStr }];
    setChatHistory(newHistory);
    setQuestionInput('');
    setIsAsking(true);

    try {
      const { askGeminiFollowUpQuestion } = await import('../geminiService');
      const response = await askGeminiFollowUpQuestion(lesson, queryStr, chatHistory, apiKey);
      setChatHistory([...newHistory, { role: 'model' as const, text: response }]);
    } catch (err: any) {
      alert("AI 답변 생성에 실패했습니다: " + err.message);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Study Navigation Sub-Tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeStudyTab === 'eli5' ? 'active' : ''}`}
          onClick={() => setActiveStudyTab('eli5')}
        >
          <HelpCircle size={16} />
          쉬운 설명 (ELI10)
        </button>
        <button
          className={`tab-btn ${activeStudyTab === 'memory' ? 'active' : ''}`}
          onClick={() => setActiveStudyTab('memory')}
        >
          <Brain size={16} />
          머릿속 암기 공식
        </button>
        <button
          className={`tab-btn ${activeStudyTab === 'pronounce' ? 'active' : ''}`}
          onClick={() => setActiveStudyTab('pronounce')}
        >
          <Volume2 size={16} />
          원어민 발음 꿀팁
        </button>
      </div>

      {/* Tab Panels */}
      <div style={{ flex: 1 }}>
        {/* ELI5 Tab */}
        {activeStudyTab === 'eli5' && (
          <div className="animate-fade-in">
            <div className="card-section">
              <h4 className="card-title-bar">
                <HelpCircle style={{ color: 'var(--primary)' }} size={20} />
                아주 쉽게 이해하는 핵심 원리 (ELI10)
              </h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                {eli5.explanation}
              </p>
            </div>

            <div className="eli5-analogy-box">
              <h5 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                💡 직관적인 비유로 새기기
              </h5>
              <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                {eli5.analogy}
              </p>
            </div>

            <div className="card-section">
              <h5 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
                📌 핵심 예문 비교 분석
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span className="example-sentence">{eli5.example}</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {eli5.exampleContext}
                </p>
              </div>
            </div>

            {/* AI 추가 질문 (Follow-up Q&A) */}
            <div className="card-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 className="card-title-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', color: 'var(--primary)', fontSize: '1rem' }}>🤖</span>
                <span>AI에게 추가 질문하기 (ELI10 Q&A)</span>
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                이 설명에서 이해가 가지 않는 부분이나 추가로 궁금한 점을 질문해 보세요. AI가 10세 수준으로 한 번 더 쉽게 설명해 드립니다.
              </p>

              {/* Chat History List */}
              {chatHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  {chatHistory.map((msg, index) => (
                    <div 
                      key={index}
                      style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '0.6rem 0.9rem',
                        borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                        border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={apiKey ? "설명 중 이해가 안 가는 점을 물어보세요..." : "설정에서 API Key를 등록하면 질문할 수 있습니다."}
                  className="input-glow"
                  style={{ flex: 1, padding: '0.65rem 1rem' }}
                  disabled={isAsking || !apiKey}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                    whiteSpace: 'nowrap'
                  }}
                  disabled={isAsking || !questionInput.trim() || !apiKey}
                >
                  {isAsking ? '답변 중...' : '질문하기'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Memory Tips Tab */}
        {activeStudyTab === 'memory' && (
          <div className="animate-fade-in">
            {/* Visual Formula Callout */}
            <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--secondary)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)', textAlign: 'center', padding: '1.5rem 1rem' }}>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--secondary)', fontWeight: '700', display: 'block', marginBottom: '0.5rem' }}>
                뇌에 새기는 공식
              </span>
              <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', color: 'white', fontWeight: '700' }}>
                {memoryTips.tipFormula}
              </h4>
            </div>

            {/* A VS B Matrix */}
            <div className="compare-container">
              <div className="compare-card card-a">
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  개념 A
                </span>
                <h5 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0.25rem 0 0.5rem 0', color: 'white' }}>
                  {memoryTips.conceptA}
                </h5>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {memoryTips.conceptADesc}
                </p>
              </div>

              <div className="compare-card card-b">
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  개념 B
                </span>
                <h5 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0.25rem 0 0.5rem 0', color: 'white' }}>
                  {memoryTips.conceptB}
                </h5>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {memoryTips.conceptBDesc}
                </p>
              </div>
            </div>

            {/* Visual Image Trick */}
            <div className="card-section" style={{ marginTop: '1.5rem' }}>
              <h4 className="card-title-bar" style={{ fontSize: '1.05rem', margin: '0' }}>
                <Brain style={{ color: 'var(--primary)' }} size={18} />
                <span>기억 잠금 이미지 (Mental Image)</span>
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.75rem', lineHeight: '1.6' }}>
                {memoryTips.visualImage}
              </p>
            </div>
          </div>
        )}

        {/* Pronunciation Tab */}
        {activeStudyTab === 'pronounce' && (
          <div className="animate-fade-in">
            <div className="pronounce-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                트레이닝 핵심 구절
              </span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                "{pronunciation.wordOrPhrase}"
              </h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <a 
                  href={`https://youglish.com/pronounce/${encodeURIComponent(pronunciation.wordOrPhrase)}/english`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                  }}
                >
                  🔊 YouGlish에서 원어민 실제 발음 듣기 ↗
                </a>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="phonetic-respelling">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>영어 식 발음기호</span>
                  <span style={{ fontWeight: '500', color: 'var(--secondary)' }}>{pronunciation.phoneticRespelling}</span>
                </div>
                <div className="phonetic-respelling" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>한글 연음 가이드</span>
                  <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{pronunciation.koreanPhonetic}</span>
                </div>
              </div>
            </div>

            <div className="card-section" style={{ marginTop: '1.5rem' }}>
              <h4 className="card-title-bar">
                <Volume2 style={{ color: 'var(--primary)' }} size={18} />
                연음 및 리듬 트레이닝 가이드
              </h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {pronunciation.stressGuide}
              </p>
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                <ChevronRight size={16} style={{ color: 'var(--primary)' }} />
                <span>팁: 대문자로 표시된 음절(예: <strong>SPYT</strong>)에 호흡을 싣고 더 강하고 길게 발음하세요.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
