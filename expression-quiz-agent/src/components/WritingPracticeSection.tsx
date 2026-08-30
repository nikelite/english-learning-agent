import React, { useState } from 'react';
import { Sparkles, Send, CheckCircle2, AlertCircle, Eye, EyeOff, Copy, RefreshCw, Volume2, Award, Lightbulb, Edit3 } from 'lucide-react';
import { Lesson, WritingTemplateData, WritingEvaluationResult } from '../types';
import { evaluateUserSentence } from '../geminiService';

interface WritingPracticeSectionProps {
  lesson: Lesson;
  apiKey: string;
  onSaveWriting?: (sentence: string, feedback: WritingEvaluationResult) => void;
  initialSentence?: string;
  initialFeedback?: WritingEvaluationResult;
}

export const WritingPracticeSection: React.FC<WritingPracticeSectionProps> = ({
  lesson,
  apiKey,
  onSaveWriting,
  initialSentence = '',
  initialFeedback = null
}) => {
  const writingTemplate: WritingTemplateData = lesson.writingTemplate || {
    prompt: "오늘 배운 핵심 개념을 실사용 맥락에서 직접 1문장으로 작문해보세요.",
    template: `I need to ... ____________________.`,
    sampleSentence: lesson.eli10?.contrastiveExample || lesson.eli5?.example || "I need to check who is available for the team meeting.",
    tip: "실제 업무나 일상에서 일어날 법한 상황을 머릿속에 떠올리며 작성해보세요."
  };

  const [userSentence, setUserSentence] = useState(lesson.userWritingSentence || initialSentence);
  const [feedback, setFeedback] = useState<WritingEvaluationResult | null>(lesson.userWritingFeedback || initialFeedback);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userSentence.trim() || isEvaluating) return;
    if (!apiKey) {
      alert("Gemini API Key가 필요합니다. 우측 상단 설정(⚙️)에서 키를 입력해 주세요.");
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await evaluateUserSentence(lesson, userSentence.trim(), apiKey);
      setFeedback(result);
      if (onSaveWriting) {
        onSaveWriting(userSentence.trim(), result);
      }
    } catch (err: any) {
      alert("작문 첨삭 실패: " + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyTemplate = () => {
    const rawTemplate = writingTemplate.template.replace(/_{3,}/g, '');
    setUserSentence(rawTemplate);
  };

  const handleCopyCorrected = () => {
    if (feedback?.correctedSentence) {
      navigator.clipboard.writeText(feedback.correctedSentence);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const playTTS = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="card-section animate-fade-in" style={{
      marginTop: '1.5rem',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(139, 92, 246, 0.35)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Edit3 size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>5단계: 1초 내 상황 작문</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>(Self-Reference Generation)</span>
            </h4>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', fontWeight: '700' }}>
          실전 체화 트레이닝
        </span>
      </div>

      {/* Challenge Prompt */}
      <div style={{
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600', lineHeight: '1.5', marginBottom: '0.6rem' }}>
          ✍️ {writingTemplate.prompt}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          border: '1px dashed rgba(139, 92, 246, 0.4)',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase' }}>Template:</span>
            <code style={{ fontSize: '0.9rem', color: 'white', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
              {writingTemplate.template}
            </code>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            onClick={handleCopyTemplate}
          >
            📋 템플릿 가져오기
          </button>
        </div>
      </div>

      {/* Sample Sentence Toggle */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setShowSample(!showSample)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--secondary)',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: 0
          }}
        >
          {showSample ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{showSample ? '모범 예시 문장 숨기기' : '💡 모범 예시 문장 및 팁 보기'}</span>
        </button>

        {showSample && (
          <div className="animate-fade-in" style={{
            marginTop: '0.5rem',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(6, 182, 212, 0.06)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ margin: '0 0 0.4rem 0', color: 'white', fontWeight: '600' }}>
              🎯 <strong>Sample:</strong> "{writingTemplate.sampleSentence}"
            </p>
            {writingTemplate.tip && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Lightbulb size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                <span>{writingTemplate.tip}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Writing Form */}
      <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={userSentence}
            onChange={(e) => setUserSentence(e.target.value)}
            placeholder="위 템플릿을 활용해 나만의 실사용 문장을 영어로 완성해보세요..."
            rows={2}
            className="input-glow"
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              color: 'white',
              fontSize: '0.95rem',
              resize: 'vertical',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
            disabled={isEvaluating}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.35rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)'
            }}
            disabled={isEvaluating || !userSentence.trim()}
          >
            {isEvaluating ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>AI 첨삭 및 뉘앙스 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>AI 실시간 첨삭 및 피드백 받기</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* AI Feedback Evaluation Result Card */}
      {feedback && (
        <div className="animate-fade-in" style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          borderRadius: '12px',
          backgroundColor: feedback.isNatural ? 'rgba(16, 185, 129, 0.08)' : 'rgba(139, 92, 246, 0.08)',
          border: `1px solid ${feedback.isNatural ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          {/* Feedback Header with Score */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {feedback.isNatural ? (
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              ) : (
                <Sparkles size={20} style={{ color: 'var(--primary)' }} />
              )}
              <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                {feedback.isNatural ? "🎉 훌륭합니다! 자연스러운 문장입니다." : "💡 조금 더 다듬으면 완벽해집니다!"}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              backgroundColor: feedback.score >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: feedback.score >= 80 ? '#6ee7b7' : '#fde68a',
              fontWeight: '800',
              fontSize: '0.8rem'
            }}>
              <Award size={14} />
              <span>완성도 {feedback.score}점</span>
            </div>
          </div>

          {/* Feedback Message */}
          <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.6', margin: 0 }}>
            {feedback.feedback}
          </p>

          {/* Corrected Sentence Box */}
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                교정된 완성 문장
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => playTTS(feedback.correctedSentence)}
                  style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '0.1rem' }}
                  title="원어민 발음 듣기"
                >
                  <Volume2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyCorrected}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem' }}
                  title="문장 복사"
                >
                  <Copy size={15} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: '700', color: '#34d399', margin: 0, lineHeight: '1.4' }}>
              "{feedback.correctedSentence}"
            </p>
            {copied && (
              <span style={{ fontSize: '0.7rem', color: '#34d399', display: 'block', marginTop: '0.2rem' }}>
                ✓ 클립보드에 복사되었습니다!
              </span>
            )}
          </div>

          {/* Native Alternative Expression */}
          {feedback.nativeAlternative && feedback.nativeAlternative !== feedback.correctedSentence && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(6, 182, 212, 0.06)',
              border: '1px solid rgba(6, 182, 212, 0.2)'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#22d3ee', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                🌟 원어민 추천 자연스러운 대체 표현
              </span>
              <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white', margin: 0, lineHeight: '1.4' }}>
                "{feedback.nativeAlternative}"
              </p>
            </div>
          )}

          {/* Explanation */}
          {feedback.explanation && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0, fontStyle: 'italic' }}>
              💡 {feedback.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
