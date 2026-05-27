import React from 'react';
import { Flame, Target, Award, BookOpen, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { AppStats } from '../types';

interface AnalyticsProps {
  stats: AppStats;
  wrongAnswersCount: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ stats, wrongAnswersCount }) => {
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
    </div>
  );
};
