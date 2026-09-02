import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, Brain, Volume2, ArrowRight, Sparkles, Check, X, 
  Clock, Lightbulb, ExternalLink, ChevronDown, ChevronUp, MessageSquare 
} from 'lucide-react';
import { Lesson, WritingEvaluationResult } from '../types';
import { normalizeLesson } from '../geminiService';
import { WritingPracticeSection } from './WritingPracticeSection';

interface IntegratedStudyFlowProps {
  lesson: Lesson;
  onStartQuiz: () => void;
  apiKey: string;
  onSaveWriting?: (sentence: string, feedback: WritingEvaluationResult) => void;
}

export const IntegratedStudyFlow: React.FC<IntegratedStudyFlowProps> = ({
  lesson,
  onStartQuiz,
  apiKey,
  onSaveWriting
}) => {
  // Normalize lesson to guarantee all 5 stages exist with fallbacks
  const normalized = normalizeLesson(lesson);
  const prediction = normalized.prediction!;
  const eli10 = normalized.eli10!;
  const decisionTrigger = normalized.decisionTrigger!;
  const pronunciation = normalized.pronunciation;
  const quizzes = normalized.quizzes;

  // Step 1 Prediction State
  const [selectedGuess, setSelectedGuess] = useState<'A' | 'B' | null>(null);
  const [showPredictionAnswer, setShowPredictionAnswer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Chat Q&A State
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    setSelectedGuess(null);
    setShowPredictionAnswer(false);
    setTimerSeconds(30);
    setIsTimerRunning(false);
    setChatHistory([]);
    setQuestionInput('');
    // Randomize placement of the two options so the correct answer isn't always on the left
    setIsFlipped(Math.random() < 0.5);
  }, [lesson.id]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setShowPredictionAnswer(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handleGuess = (choice: 'A' | 'B') => {
    setSelectedGuess(choice);
    setShowPredictionAnswer(true);
    setIsTimerRunning(false);
  };

  const playTTS = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

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
      const response = await askGeminiFollowUpQuestion(normalized, queryStr, chatHistory, apiKey);
      setChatHistory([...newHistory, { role: 'model' as const, text: response }]);
    } catch (err: any) {
      alert("AI 답변 생성 실패: " + err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const cleanSentenceDisplay = (str: string) => {
    if (!str) return '';
    return str
      .replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '')
      .replace(/^\s*[ABab]\s*[:.)-]\s*/, '')
      .replace(/\s*vs\s*.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const rawOptions = [
    {
      originalId: 'A' as const,
      sentence: prediction.sentenceA,
      isIncorrect: prediction.incorrectChoice === 'A'
    },
    {
      originalId: 'B' as const,
      sentence: prediction.sentenceB,
      isIncorrect: prediction.incorrectChoice === 'B'
    }
  ];

  const predictionOptions = isFlipped ? [rawOptions[1], rawOptions[0]] : rawOptions;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* 5-Stage Stepper Overview Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#c084fc' }}>
            5단계 인지 학습 플로우
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            1.추측 ➔ 2.핵심원리 ➔ 3.선택기준 ➔ 4.실전테스트 (객관식 퀴즈 + 상황작문)
          </span>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={onStartQuiz}
          style={{
            fontSize: '0.8rem',
            padding: '0.35rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)'
          }}
        >
          <span>4단계 퀴즈 &amp; 실전작문 ({quizzes.length + 1}문항)</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* ================= STAGE 1: 30초 인지 추측 (Prediction First) ================= */}
      <section className="card-section" style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Lightbulb size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white' }}>
                1단계: 30초 인지 추측 (Prediction First)
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!showPredictionAnswer && (
              <button
                type="button"
                onClick={isTimerRunning ? () => setIsTimerRunning(false) : handleStartTimer}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: isTimerRunning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: isTimerRunning ? '#fca5a5' : '#fde68a',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Clock size={13} />
                <span>{isTimerRunning ? `⏱️ ${timerSeconds}초 남음 (중지)` : '⏱️ 30초 타이머 시작'}</span>
              </button>
            )}
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: '700' }}>
              오답 인지 자극
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.925rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.25rem' }}>
          💡 아래 두 문장을 보고 <strong>30초만</strong> 생각해보세요. 어느 쪽이 <strong>원어민이 절대 쓰지 않는 어색한 문장</strong>이고 왜 그럴까요?
        </p>

        {/* 2 Contrastive Cards for User Prediction (Randomized placement) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {predictionOptions.map((opt, optIdx) => {
            const label = optIdx === 0 ? "문장 A" : "문장 B";
            const isSelected = selectedGuess === opt.originalId;

            return (
              <div
                key={opt.originalId}
                onClick={() => !showPredictionAnswer && handleGuess(opt.originalId)}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  backgroundColor: showPredictionAnswer
                    ? (opt.isIncorrect ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)')
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1.5px solid ${showPredictionAnswer
                    ? (opt.isIncorrect ? 'var(--error)' : 'var(--success)')
                    : (isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)')}`,
                  cursor: showPredictionAnswer ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>{label}</span>
                  {showPredictionAnswer && (
                    opt.isIncorrect ? (
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: '800' }}>
                        ❌ 틀린 문장
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', fontWeight: '800' }}>
                        ✅ 자연스러운 문장
                      </span>
                    )
                  )}
                </div>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'white', margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>
                  "{cleanSentenceDisplay(opt.sentence)}"
                </p>
                {!showPredictionAnswer && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    👉 클릭해서 이 문장을 선택하기
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Reveal Answer Button if not revealed yet */}
        {!showPredictionAnswer ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPredictionAnswer(true)}
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: '700' }}
            >
              👀 정답 및 인지적 착각 원인 바로 확인하기
            </button>
          </div>
        ) : (
          <div className="animate-fade-in" style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: '800', fontSize: '0.9rem' }}>
              <Sparkles size={16} />
              <span>인지적 함정 분석 (Why it happens):</span>
            </div>
            <p style={{ fontSize: '0.925rem', color: '#f8fafc', lineHeight: '1.6', margin: 0 }}>
              {prediction.trapExplanation}
            </p>
          </div>
        )}
      </section>

      {/* ================= STAGE 2: 핵심 원리 & 직관적 비유 (ELI10 & Mental Model) ================= */}
      <section className="card-section" style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white' }}>
                2단계: 핵심 원리 &amp; 직관적 비유 (ELI10 &amp; Mental Model)
              </h3>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', fontWeight: '700' }}>
            10세 눈높이 멘탈 모델
          </span>
        </div>

        {/* Core Principle */}
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#c084fc', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🔑 핵심 원리 (Core Principle)</span>
          </h4>
          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>
            {eli10.corePrinciple}
          </p>
        </div>

        {/* Mental Model Analogy Box */}
        <div className="eli5-analogy-box" style={{
          padding: '1.25rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          borderLeft: '4px solid var(--primary)',
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#c084fc', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>💡 직관적 비유 (Mental Model)</span>
          </h4>
          <p style={{ fontSize: '0.925rem', color: '#f8fafc', lineHeight: '1.65', margin: 0 }}>
            {eli10.mentalModelAnalogy}
          </p>
        </div>

        {/* Contrastive Example */}
        {eli10.contrastiveExample && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(6, 182, 212, 0.06)',
            border: '1px solid rgba(6, 182, 212, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#22d3ee' }}>
                📌 핵심 대조 예문
              </span>
              <button
                type="button"
                onClick={() => playTTS(eli10.contrastiveExample.replace(/\(.*?\)/g, ''))}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '0.1rem' }}
                title="원어민 발음 듣기"
              >
                <Volume2 size={15} />
              </button>
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', margin: '0 0 0.35rem 0' }}>
              {eli10.contrastiveExample}
            </p>
            {eli10.exampleContext && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                {eli10.exampleContext}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ================= STAGE 3: 상황별 선택 기준 & 발음 (Decision Trigger & Pronunciation) ================= */}
      <section className="card-section" style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(6, 182, 212, 0.35)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Brain size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white' }}>
                3단계: 상황별 선택 기준 (Decision Trigger) &amp; 원어민 발음
              </h3>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', fontWeight: '700' }}>
            상황별 즉시 인출 공식
          </span>
        </div>

        {/* Rule Summary Equation */}
        {decisionTrigger.keyRuleSummary && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px dashed rgba(6, 182, 212, 0.4)',
            textAlign: 'center',
            marginBottom: '1.25rem'
          }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#22d3ee', fontWeight: '800', display: 'block', marginBottom: '0.35rem' }}>
              뇌에 새기는 선택 기준 요약 공식
            </span>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', color: 'white', fontWeight: '800', margin: 0 }}>
              {decisionTrigger.keyRuleSummary}
            </h4>
          </div>
        )}

        {/* Decision Trigger Matrix: Trigger A vs Trigger B */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Trigger A */}
          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase' }}>
              선택 기준 A
            </span>
            <h5 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'white', margin: 0 }}>
              {decisionTrigger.triggerA.expression}
            </h5>
            <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.6', margin: 0 }}>
              👉 <strong>언제 쓸까:</strong> {decisionTrigger.triggerA.condition}
            </p>
            {decisionTrigger.triggerA.example && (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: '0.25rem 0 0 0', lineHeight: '1.5' }}>
                "{decisionTrigger.triggerA.example}"
              </p>
            )}
          </div>

          {/* Trigger B */}
          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(6, 182, 212, 0.06)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '800', textTransform: 'uppercase' }}>
              선택 기준 B
            </span>
            <h5 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'white', margin: 0 }}>
              {decisionTrigger.triggerB.expression}
            </h5>
            <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.6', margin: 0 }}>
              👉 <strong>언제 쓸까:</strong> {decisionTrigger.triggerB.condition}
            </p>
            {decisionTrigger.triggerB.example && (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: '0.25rem 0 0 0', lineHeight: '1.5' }}>
                "{decisionTrigger.triggerB.example}"
              </p>
            )}
          </div>
        </div>

        {/* Integrated Pronunciation Guide */}
        {pronunciation && (
          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: '700', fontSize: '0.85rem' }}>
                <Volume2 size={16} />
                <span>원어민 실전 발음 &amp; 연음 꿀팁</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => playTTS(pronunciation.wordOrPhrase)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Volume2 size={14} />
                  <span>듣기</span>
                </button>
                <a
                  href={`https://youglish.com/pronounce/${encodeURIComponent(pronunciation.wordOrPhrase)}/english`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <span>YouGlish 영상 검색</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)' }}>
                "{pronunciation.wordOrPhrase}"
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                /{pronunciation.phoneticRespelling}/
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ({pronunciation.koreanPhonetic})
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
              💡 {pronunciation.stressGuide}
            </p>
          </div>
        )}
      </section>

      {/* ================= STAGE 4: 오개념 점검 퀴즈 안내 (Interference Check) ================= */}
      <section className="card-section" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--success) 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 0.25rem 0', color: 'white' }}>
              4단계: 오개념 점검 퀴즈 &amp; 실전 상황 작문 ({quizzes.length + 1}문항)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              방금 배운 원리를 실전 객관식 퀴즈({quizzes.length}문항)와 마지막 실전 상황 작문(1문항)으로 완벽하게 테스트합니다.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={onStartQuiz}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'linear-gradient(135deg, var(--success) 0%, var(--primary) 100%)',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
          }}
        >
          <span>🚀 점검 퀴즈 &amp; 실전 작문 시작하기</span>
          <ArrowRight size={18} />
        </button>
      </section>

      {/* ================= STAGE 5: 1초 내 상황 작문 (WritingPracticeSection) ================= */}
      <WritingPracticeSection
        lesson={normalized}
        apiKey={apiKey}
        onSaveWriting={onSaveWriting}
      />

      {/* ================= AI FOLLOW-UP Q&A BAR ================= */}
      <section className="card-section" style={{
        marginTop: '0.5rem',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <MessageSquare size={16} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'white', margin: 0 }}>
            궁금한 점이 남아있나요? AI에게 질문하기
          </h4>
        </div>

        {chatHistory.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1rem',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '0.75rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            {chatHistory.map((msg, index) => (
              <div 
                key={index}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '0.65rem 0.95rem',
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

        <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleAskQuestion(e);
              }
            }}
            placeholder={apiKey ? "이 설명에서 더 궁금한 뉘앙스나 의문점을 물어보세요... (Ctrl+Enter)" : "설정에서 API Key를 입력하면 질문할 수 있습니다."}
            className="input-glow"
            style={{ flex: 1, padding: '0.65rem 1rem' }}
            disabled={isAsking || !apiKey}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.25rem',
              whiteSpace: 'nowrap'
            }}
            disabled={isAsking || !questionInput.trim() || !apiKey}
          >
            {isAsking ? '답변 중...' : '질문하기'}
          </button>
        </form>
      </section>

    </div>
  );
};
