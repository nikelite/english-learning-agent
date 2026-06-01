import React, { useState } from 'react';
import { Flame, Target, Award, BookOpen, Sparkles, TrendingUp, AlertTriangle, Search, ChevronDown, ChevronUp, Check, X, Calendar } from 'lucide-react';
import { AppStats } from '../types';
import { loadUserQuizAttemptsFromCloud } from '../firebaseService';

interface AnalyticsProps {
  stats: AppStats;
  wrongAnswersCount: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ stats, wrongAnswersCount }) => {
  // Other User Progress Search States
  const [searchUserId, setSearchUserId] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchUserId.trim();
    if (!id) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setExpandedAttemptId(null);

    try {
      const results = await loadUserQuizAttemptsFromCloud(id);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError(`사용자 ID '${id}'의 학습 매칭 기록이 없습니다.`);
      }
    } catch (err: any) {
      setSearchError(err.message || '학습 기록을 불러오는데 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const accuracy = stats.totalQuizzesTaken > 0 
    ? Math.round((stats.totalCorrectAnswers / stats.totalQuizzesTaken) * 100)
    : 0;

  let title = "꿈꾸는 영어 모험가 🎒";
  let description = "첫걸음을 내딛으셨네요! 퀴즈를 풀고 분석하며 매일매일 성장해 나갈 수 있습니다.";
  
  if (stats.streak >= 7) {
    title = "거침없는 영어 정복자 👑";
    description = "7일 이상 매일 열심히 학습하고 계십니다! 정말 대단한 페이스예요. 이대로 계속 가보자고요!";
  } else if (stats.streak >= 3) {
    title = "열정적인 실력파 러너 🏃";
    description = "학습 습관이 완벽히 자리 잡아가고 있군요! 지속적인 반복 복습이 성과의 핵심입니다.";
  } else if (stats.totalQuizzesTaken > 15 && accuracy >= 85) {
    title = "디테일의 완벽주의자 🎯";
    description = "높은 퀴즈 정답률을 보여주고 계십니다! 문법의 미묘한 차이를 기가 막히게 잡아내시네요.";
  }

  return (
    <div className="glass-panel main-panel animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
          <TrendingUp size={24} style={{ color: 'var(--secondary)' }} />
          나의 영어 학습 리포트
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          지속해 온 스트릭 수치와 실시간 퀴즈 정답 통계를 한눈에 확인하며 동기를 얻으세요.
        </p>
      </div>

      {/* Encouragement Badge Banner */}
      <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--primary)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.03) 100%)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="pulse-glow" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={24} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {title}
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.15rem', lineHeight: '1.4' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Analytical Stats Grid */}
      <div className="analytics-cards">
        <div className="analytics-stat-card">
          <div style={{ display: 'flex', justifyContent: 'center', color: '#f97316', marginBottom: '0.5rem' }}>
            <Flame size={28} className="streak-fire" />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>연속 학습</span>
          <div className="stat-number" style={{ color: '#f97316' }}>{stats.streak}일</div>
        </div>

        <div className="analytics-stat-card">
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--secondary)', marginBottom: '0.5rem' }}>
            <Target size={28} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>실전 정답률</span>
          <div className="stat-number" style={{ color: 'var(--secondary)' }}>{accuracy}%</div>
        </div>

        <div className="analytics-stat-card">
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            <BookOpen size={28} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>누적 푼 문제</span>
          <div className="stat-number" style={{ color: 'var(--primary)' }}>{stats.totalQuizzesTaken}개</div>
        </div>

        <div className="analytics-stat-card">
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent)', marginBottom: '0.5rem' }}>
            <Award size={28} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>학습 완수한 오답</span>
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{stats.masteredCount}개</div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="card-section">
        <h4 className="card-title-bar" style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>
          🎯 상세 역량 및 복습 상황
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>퀴즈 정확도 점수</span>
              <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>{stats.totalCorrectAnswers} / {stats.totalQuizzesTaken} 정답</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${accuracy}%`, background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>오답 정복 진행 상황 (Mastery)</span>
              <span style={{ fontWeight: '700', color: 'var(--accent)' }}>{wrongAnswersCount}개 보관 중</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${stats.masteredCount + wrongAnswersCount > 0 ? (stats.masteredCount / (stats.masteredCount + wrongAnswersCount)) * 100 : 100}%`,
                  background: 'linear-gradient(90deg, var(--accent) 0%, #f43f5e 100%)'
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {wrongAnswersCount > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(244, 63, 94, 0.05)', padding: '1rem', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-primary)', alignItems: 'center' }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>현재 오답 노트에 <strong>{wrongAnswersCount}개</strong>의 헷갈리는 영어 문제가 보습을 기다리고 있습니다. 오답 노트를 복습하고 정답을 맞춰 졸업시키세요!</span>
        </div>
      )}

      {/* SECTION: OTHER USER PROGRESS DASHBOARD */}
      <div className="card-section" style={{ background: 'rgba(139, 92, 246, 0.02)', border: '1px dashed var(--primary)', borderRadius: '12px', padding: '1.5rem', marginTop: '2rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontFamily: 'var(--font-display)' }}>
          <Search size={18} style={{ color: 'var(--primary)' }} />
          타 사용자 실시간 학습 성적표 조회 (Cloud Student Progress)
        </h4>
        <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
          친구, 자녀 또는 매칭된 학생의 클라우드 User ID를 검색하여 그들이 풀었던 영어 표현 &amp; 문법 퀴즈 기록, 점수 분포, 오답 내역 및 AI 오답 원인 분석 해설을 실시간으로 확인하세요!
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            placeholder="조회할 사용자 클라우드 ID 입력 (예: nikelite)"
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            className="input-glow"
            style={{ fontSize: '0.85rem', padding: '0.6rem 0.85rem', flex: 1 }}
            disabled={isSearching}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}
            disabled={isSearching || !searchUserId.trim()}
          >
            {isSearching ? '검색 중...' : '조회하기'}
          </button>
        </form>

        {searchError && (
          <div style={{ color: 'var(--error)', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '1rem' }}>
            ⚠️ {searchError}
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h5 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.25rem' }}>
              🎯 '{searchUserId.trim()}' 님의 최근 클라우드 학습 퀴즈 기록 ({searchResults.length}건)
            </h5>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {searchResults.map((attempt) => {
                const isExpanded = expandedAttemptId === attempt.id;
                const scorePercent = Math.round((attempt.correctCount / attempt.totalCount) * 100);
                const isPerfect = attempt.correctCount === attempt.totalCount;
                const dateStr = attempt.timestamp ? new Date(attempt.timestamp).toLocaleString() : '일시 불명';

                return (
                  <div key={attempt.id} style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', transition: 'all 0.2s' }}>
                    <div 
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '0.75rem' }}
                      onClick={() => setExpandedAttemptId(isExpanded ? null : attempt.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white' }}>
                          📖 {attempt.lessonTitle}
                        </span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={12} /> {dateStr}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: '900', color: isPerfect ? 'var(--success)' : scorePercent >= 80 ? 'var(--secondary)' : 'var(--accent)' }}>
                          {attempt.correctCount} / {attempt.totalCount} 문제 ({scorePercent}%)
                        </span>
                        {attempt.wrongQuestions && attempt.wrongQuestions.length > 0 ? (
                          isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        ) : (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}>만점 💯</span>
                        )}
                      </div>
                    </div>

                    {/* EXPANDED DETAILS: Wrong answers & AI Rationales breakdown */}
                    {isExpanded && attempt.wrongQuestions && attempt.wrongQuestions.length > 0 && (
                      <div className="animate-slide-down" style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.85rem', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📝 틀린 문항 분석 가이드
                        </span>

                        {attempt.wrongQuestions.map((wq: any, wIdx: number) => (
                          <div key={wIdx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '8px', padding: '0.85rem' }}>
                            <h6 style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: '#f8fafc', lineHeight: '1.4' }}>
                              <span style={{ color: 'var(--accent)', fontWeight: '800', marginRight: '0.25rem' }}>✗</span>
                              {wq.question.replace(/^🔄\s*\[.*?\]\s*/, '')}
                            </h6>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.6rem' }}>
                              {wq.choices?.map((choice: string, cIdx: number) => {
                                const isUserSelect = cIdx === wq.userAnswerIndex;
                                const isCorrect = cIdx === wq.correctIndex;
                                let itemStyle: React.CSSProperties = {
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.03)',
                                  color: 'var(--text-secondary)'
                                };

                                if (isCorrect) {
                                  itemStyle.background = 'rgba(16, 185, 129, 0.05)';
                                  itemStyle.borderColor = 'var(--success)';
                                  itemStyle.color = 'var(--success)';
                                  itemStyle.fontWeight = '600';
                                } else if (isUserSelect) {
                                  itemStyle.background = 'rgba(239, 68, 68, 0.05)';
                                  itemStyle.borderColor = 'var(--accent)';
                                  itemStyle.color = 'var(--accent)';
                                  itemStyle.fontWeight = '600';
                                }

                                return (
                                  <div key={cIdx} style={itemStyle}>
                                    <strong style={{ marginRight: '0.25rem' }}>{String.fromCharCode(65 + cIdx)}.</strong>
                                    {choice}
                                    {isCorrect && ' (정답)'}
                                    {isUserSelect && !isCorrect && ' (선택한 오답)'}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.6rem 0.75rem', fontSize: '0.725rem', lineHeight: '1.4', background: 'rgba(0,0,0,0.12)', borderStyle: 'dashed' }}>
                              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.15rem' }}>💡 AI 오답 해설:</strong>
                              {wq.rationale}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
