import { HelpCircle, Brain, Volume2, ChevronRight } from 'lucide-react';
import { Lesson } from '../types';

interface StudyTabsProps {
  lesson: Lesson;
  activeStudyTab: 'eli5' | 'memory' | 'pronounce';
  setActiveStudyTab: (tab: 'eli5' | 'memory' | 'pronounce') => void;
}

export const StudyTabs: React.FC<StudyTabsProps> = ({
  lesson,
  activeStudyTab,
  setActiveStudyTab
}) => {
  const { eli5, memoryTips, pronunciation } = lesson;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Study Navigation Sub-Tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeStudyTab === 'eli5' ? 'active' : ''}`}
          onClick={() => setActiveStudyTab('eli5')}
        >
          <HelpCircle size={16} />
          쉬운 설명 (ELI5)
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
                아주 쉽게 이해하는 핵심 원리
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
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)' }}>
                "{pronunciation.wordOrPhrase}"
              </h3>
              
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
