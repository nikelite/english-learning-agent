import React, { useState } from 'react';
import { Flame, Target, BookOpen, Sparkles, TrendingUp, Award, AlertTriangle, Search, ChevronDown, ChevronUp, Check, X, Calendar } from 'lucide-react';
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

  let title = "독해 꿈나무 🌱";
  let description = "독해 분석 여정에 입성하셨습니다! 지문을 여러 번 쪼개 읽으며 문장 이해력을 키워가세요.";
  
  if (stats.streak >= 7) {
    title = "숲을 보는 통찰자 🌳";
    description = "7일 연속 지문을 정독하고 계십니다! 나무뿐만 아니라 지문 전체의 숲(핵심 주제)을 꿰뚫어 보고 계십니다.";
  } else if (stats.streak >= 3) {
    title = "학술 지문 정독가 📚";
    description = "매일 독해 지문을 해석하며 독서 리듬을 완벽하게 다져가고 있습니다. 성장의 지름길입니다.";
  } else if (stats.totalQuizzesTaken > 15 && accuracy >= 85) {
    title = "정밀 독해 마스터 🎯";
    description = "엄청난 정확도의 정답률을 기록 중입니다! 인공지능이 숨겨둔 지문의 함정 논리를 완벽히 우회하셨습니다.";
  }

  return (
    <div className="glass-panel main-panel animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
          <TrendingUp size={24} style={{ color: 'var(--secondary)' }} />
          독해 역량 성적표 (Reading Report)
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          지속해 온 학습 스트릭 수치와 실시간 퀴즈 정답 통계를 확인하며 독해 역량을 높이세요.
        </p>
      </div>

      {/* Encouragement banner */}
      <div className="eli5-analogy-box" style={{ borderLeftColor: 'var(--secondary)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.03) 100%)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="pulse-glow" style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={22} style={{ color: 'var(--secondary)' }} />
        </div>
        <div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'white' }}>
            {title}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem', lineHeight: '1.4' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Analytical stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="vocab-card" style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <Flame size={28} className="streak-fire" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>연속 독해 훈련</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '800', color: '#f97316' }}>{stats.streak}일</div>
        </div>

        <div className="vocab-card" style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <Target size={28} style={{ color: 'var(--secondary)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>독해 정확도</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '800', color: 'var(--secondary)' }}>{accuracy}%</div>
        </div>

        <div className="vocab-card" style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <BookOpen size={28} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>누적 푼 문제</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>{stats.totalQuizzesTaken}개</div>
        </div>

        <div className="vocab-card" style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <Award size={28} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>자동 마스터 오답</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '800', color: 'var(--accent)' }}>{stats.masteredCount}개</div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="card-section" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          📊 훈련 상세 역량 수치
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>정답률 추이 점수</span>
              <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>{stats.totalCorrectAnswers} / {stats.totalQuizzesTaken} 문제 맞춤</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${accuracy}%`, background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>자동 오답 복습 극복 진행 상황</span>
              <span style={{ fontWeight: '700', color: 'var(--accent)' }}>{wrongAnswersCount}개 학습 중</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '9999px', overflow: 'hidden' }}>
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
        <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(244, 63, 94, 0.04)', padding: '1rem', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '10px', fontSize: '0.825rem', color: 'var(--text-primary)', alignItems: 'center', marginTop: '1.5rem' }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>현재 오답 노트에 <strong>{wrongAnswersCount}개</strong>의 오답이 보관되어 있습니다. 새로운 퀴즈를 풀 때 **복습 문제 배지**가 붙어 시험지에 자동으로 한두 문제씩 섞여 나오므로, 평소처럼 퀴즈를 해결해 나가며 오답을 복습하세요!</span>
        </div>
      )}

      {/* SECTION: OTHER USER PROGRESS DASHBOARD */}
      <div className="card-section" style={{ background: 'rgba(139, 92, 246, 0.02)', border: '1px dashed var(--primary)', borderRadius: '12px', padding: '1.5rem', marginTop: '2rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontFamily: 'var(--font-display)' }}>
          <Search size={18} style={{ color: 'var(--primary)' }} />
          타 사용자 실시간 학습 성적표 조회 (Cloud Student Progress)
        </h4>
        <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
          친구, 자녀 또는 매칭된 학생의 클라우드 User ID를 검색하여 그들이 풀었던 영어 독해 퀴즈 기록, 점수 분포, 오답 내역 및 AI 오답 원인 분석 해설을 실시간으로 확인하세요!
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
