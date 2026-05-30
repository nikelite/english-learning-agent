import React from 'react';
import { Flame, Target, BookOpen, Sparkles, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { AppStats } from '../types';

interface AnalyticsProps {
  stats: AppStats;
  wrongAnswersCount: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ stats, wrongAnswersCount }) => {
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
    </div>
  );
};
