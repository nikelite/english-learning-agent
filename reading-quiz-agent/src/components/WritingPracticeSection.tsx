import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, CheckCircle2, Edit3, Volume2, 
  Copy, RefreshCw, Award, HelpCircle, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { ReadingLesson, WritingTemplateData, WritingEvaluationResult, WritingScenarioOption } from '../types';
import { generateReadingWritingScenarios, evaluateReadingUserSentence } from '../geminiService';

interface WritingPracticeSectionProps {
  lesson: ReadingLesson;
  apiKey: string;
  onSaveWriting?: (sentence: string, feedback: WritingEvaluationResult) => void;
  isQuizMode?: boolean;
  onCompleteQuiz?: () => void;
}

export const WritingPracticeSection: React.FC<WritingPracticeSectionProps> = ({
  lesson,
  apiKey,
  onSaveWriting,
  isQuizMode = false,
  onCompleteQuiz
}) => {
  const [localWritingTemplate, setLocalWritingTemplate] = useState<WritingTemplateData>(() => {
    if (lesson.writingTemplate) return lesson.writingTemplate;
    return {
      prompt: "본문의 핵심 표현과 주제를 활용하여 1초 내에 실전 영어 문장을 완성해 보세요.",
      template: "____________________.",
      sampleSentence: "",
      tip: "본문에서 배운 어휘나 표현을 자유롭게 활용해 보세요.",
      scenarios: []
    };
  });

  const [activeScenarioIdx, setActiveScenarioIdx] = useState<number>(0);
  const [userSentence, setUserSentence] = useState<string>(lesson.userWritingSentence || '');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<WritingEvaluationResult | null>(lesson.userWritingFeedback || null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showSample, setShowSample] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when lesson changes
  useEffect(() => {
    if (lesson.writingTemplate) {
      setLocalWritingTemplate(lesson.writingTemplate);
    }
    setUserSentence(lesson.userWritingSentence || '');
    setFeedback(lesson.userWritingFeedback || null);
    setActiveScenarioIdx(0);
  }, [lesson.id]);

  const defaultScenario: WritingScenarioOption = {
    category: "🏢 실전 비즈니스 / 대화 상황",
    situation: localWritingTemplate.situation || "본문의 핵심 주제와 관련된 실전 대화 상황입니다.",
    koreanIntent: localWritingTemplate.koreanIntent || "상황에 알맞은 1문장을 영어로 완성해 보세요.",
    template: localWritingTemplate.template || "____________________.",
    sampleSentence: localWritingTemplate.sampleSentence || "",
    keyKeywords: localWritingTemplate.keyKeywords || (lesson.vocabulary ? lesson.vocabulary.slice(0, 3).map(v => v.word) : []),
    tip: localWritingTemplate.tip || "본문의 핵심 표현을 응용해 보세요."
  };

  const scenarios: WritingScenarioOption[] = (localWritingTemplate.scenarios && localWritingTemplate.scenarios.length > 0)
    ? localWritingTemplate.scenarios 
    : [defaultScenario];

  const currentScenario = scenarios[activeScenarioIdx] || scenarios[0] || defaultScenario;

  const handleGenerateScenariosWithAI = async () => {
    if (!apiKey) {
      alert("Gemini API Key가 필요합니다. 설정(⚙️) 창에서 키를 등록해 주세요.");
      return;
    }
    setIsGeneratingScenarios(true);
    try {
      const generated = await generateReadingWritingScenarios(lesson, apiKey);
      if (generated && generated.scenarios && generated.scenarios.length > 0) {
        setLocalWritingTemplate(generated);
        setActiveScenarioIdx(0);
      }
    } catch (err: any) {
      alert("AI 실전 시나리오 생성 실패: " + err.message);
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userSentence.trim() || isEvaluating) return;
    if (!apiKey) {
      alert("Gemini API Key가 필요합니다. 우측 상단 설정(⚙️)에서 키를 입력해 주세요.");
      return;
    }

    setIsEvaluating(true);
    try {
      const activeContext = {
        situation: currentScenario.situation,
        koreanIntent: currentScenario.koreanIntent,
        template: currentScenario.template
      };
      const result = await evaluateReadingUserSentence(lesson, userSentence.trim(), apiKey, activeContext);
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

  const handleNextScenarioAndRetry = async () => {
    setUserSentence('');
    setFeedback(null);
    setShowHint(false);
    setShowSample(false);

    if (scenarios.length > 1 && activeScenarioIdx < scenarios.length - 1) {
      setActiveScenarioIdx(prev => prev + 1);
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 100);
    } else {
      if (apiKey) {
        setIsGeneratingScenarios(true);
        try {
          const generated = await generateReadingWritingScenarios(lesson, apiKey);
          if (generated && generated.scenarios && generated.scenarios.length > 0) {
            setLocalWritingTemplate(generated);
            setActiveScenarioIdx(0);
          }
        } catch (err: any) {
          console.error("AI 시나리오 생성 실패:", err);
          setActiveScenarioIdx(0);
        } finally {
          setIsGeneratingScenarios(false);
        }
      } else {
        setActiveScenarioIdx(prev => (prev + 1) % scenarios.length);
      }
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 100);
    }
  };

  const handleCopyTemplate = () => {
    const rawTemplate = currentScenario.template.replace(/_{3,}/g, '');
    setUserSentence(rawTemplate);
  };

  const handleAppendKeyword = (kw: string) => {
    setUserSentence(prev => prev ? `${prev} ${kw}` : kw);
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

  const handleRetryEdit = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleUseCorrectedSentence = () => {
    if (feedback?.correctedSentence) {
      setUserSentence(feedback.correctedSentence);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  return (
    <div className="card-section animate-fade-in" style={{
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      border: '1.5px solid rgba(236, 72, 153, 0.4)',
      boxShadow: '0 8px 25px rgba(236, 72, 153, 0.12)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginTop: '1rem'
    }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
          }}>
            <Edit3 size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{isQuizMode ? '🎯 마지막 문제: 1초 실전 상황 작문' : '1초 실전 상황 작문'}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isQuizMode ? '#f472b6' : 'var(--text-secondary)' }}>
                {isQuizMode ? '(Situational Writing Challenge)' : '(Situational Writing)'}
              </span>
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {apiKey && (
            <button
              type="button"
              onClick={handleGenerateScenariosWithAI}
              disabled={isGeneratingScenarios}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: '1px solid rgba(236, 72, 153, 0.3)'
              }}
            >
              {isGeneratingScenarios ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  <span>새 상황 생성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} style={{ color: '#f472b6' }} />
                  <span>✨ AI 새 상황 생성</span>
                </>
              )}
            </button>
          )}

          {scenarios.length > 1 && (
            <button
              type="button"
              onClick={handleNextScenarioAndRetry}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <RefreshCw size={12} />
              <span>상황 전환 ({activeScenarioIdx + 1}/{scenarios.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Scenario Context Card */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {currentScenario.category}
          </span>
          {scenarios.length > 1 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              시나리오 {activeScenarioIdx + 1} / {scenarios.length}
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.95rem', color: '#f1f5f9', lineHeight: '1.6', margin: '0 0 0.75rem 0' }}>
          {currentScenario.situation}
        </p>

        {/* Target Korean Intent */}
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          borderLeft: '3px solid #ec4899'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: '700', display: 'block', marginBottom: '0.2rem' }}>
            🎯 전달하고자 하는 핵심 의도
          </span>
          <p style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff', margin: 0, lineHeight: '1.4' }}>
            "{currentScenario.koreanIntent}"
          </p>
        </div>
      </div>

      {/* Recommended Keywords & Template Hint */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Keywords */}
        {currentScenario.keyKeywords && currentScenario.keyKeywords.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>추천 표현:</span>
            {currentScenario.keyKeywords.map((kw, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAppendKeyword(kw)}
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                + {kw}
              </button>
            ))}
          </div>
        )}

        {/* Hint Accordion */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowHint(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: 0
            }}
          >
            <HelpCircle size={14} />
            <span>{showHint ? "💡 힌트 접기" : "💡 작문 힌트 보기"}</span>
            {showHint ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {currentScenario.sampleSentence && (
            <button
              type="button"
              onClick={() => setShowSample(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: 0,
                marginLeft: '0.5rem'
              }}
            >
              <span>{showSample ? "예시 문장 숨기기" : "예시 문장 확인"}</span>
            </button>
          )}
        </div>

        {showHint && (
          <div className="animate-fade-in" style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            fontSize: '0.85rem',
            color: '#cbd5e1',
            lineHeight: '1.5'
          }}>
            <strong style={{ color: '#c084fc', display: 'block', marginBottom: '0.25rem' }}>작문 팁 &amp; 구조:</strong>
            {currentScenario.tip || "본문에서 다룬 핵심 단어와 자연스러운 영어 어순을 활용해 보세요."}
            {currentScenario.template && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                <code style={{ color: '#a78bfa', fontSize: '0.8rem' }}>{currentScenario.template}</code>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
                >
                  불러오기
                </button>
              </div>
            )}
          </div>
        )}

        {showSample && currentScenario.sampleSentence && (
          <div className="animate-fade-in" style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.85rem',
            color: '#6ee7b7'
          }}>
            모범 예시: <strong>"{currentScenario.sampleSentence}"</strong>
          </div>
        )}
      </div>

      {/* Writing Textarea & Submit Form */}
      <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={userSentence}
            onChange={(e) => setUserSentence(e.target.value)}
            placeholder="상황에 알맞은 영어 문장을 작성해 보세요... (Enter 키로 줄바꿈, 제출 버튼으로 첨삭)"
            rows={3}
            disabled={isEvaluating}
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: `1.5px solid ${userSentence.trim() ? '#ec4899' : 'rgba(255, 255, 255, 0.15)'}`,
              color: 'white',
              fontSize: '1rem',
              lineHeight: '1.5',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={!userSentence.trim() || isEvaluating}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.35rem',
              fontSize: '0.9rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
              cursor: (!userSentence.trim() || isEvaluating) ? 'not-allowed' : 'pointer'
            }}
          >
            {isEvaluating ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>AI 상황 적합도 및 뉘앙스 첨삭 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{feedback ? "🚀 수정된 문장 다시 첨삭받기 (재도전)" : "AI 실시간 상황 첨삭 및 코칭 받기"}</span>
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
                {feedback.isNatural ? "🎉 상황에 딱 맞고 자연스러운 문장입니다!" : "💡 주어진 상황에 맞게 조금 더 다듬어볼까요?"}
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
              <span>상황 완성도 {feedback.score}점</span>
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
                상황 맞춤 교정 완성 문장
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
                🌟 원어민 실사용 추천 대체 표현
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

          {/* Action Bar to Retry / Refine based on feedback */}
          <div style={{
            marginTop: '0.5rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={handleUseCorrectedSentence}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Copy size={13} />
              <span>교정 완성 문장 불러오기</span>
            </button>

            <button
              type="button"
              onClick={handleRetryEdit}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
                fontWeight: '700'
              }}
            >
              <Edit3 size={13} />
              <span>✏️ 피드백 반영해서 문장 고쳐 쓰기 (재도전)</span>
            </button>
          </div>
        </div>
      )}

      {/* In Quiz Mode: Conditional Action Bar Based on 90 Point Threshold */}
      {isQuizMode && (
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          {!feedback ? (
            /* Before submitting feedback in quiz mode */
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              💡 본문 핵심 맥락에 맞게 1문장을 작성하고 <strong>90점 이상</strong>을 획득하면 퀴즈가 최종 완료됩니다.
            </p>
          ) : feedback.score >= 90 ? (
            /* Score >= 90: Passed! */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <div style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <CheckCircle2 size={16} />
                <span>🎉 90점 이상 달성 ({feedback.score}점)! 실전 작문 기준을 완벽히 통과하셨습니다.</span>
              </div>

              {onCompleteQuiz && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCompleteQuiz}
                  style={{
                    padding: '0.85rem 2.25rem',
                    fontSize: '1rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
                    boxShadow: '0 6px 20px rgba(236, 72, 153, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <span>✨ 퀴즈 &amp; 작문 최종 결과 확인하기</span>
                  <Sparkles size={18} />
                </button>
              )}
            </div>
          ) : (
            /* Score < 90: Fail threshold -> Switch Scenario & Retry */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <div style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fde68a',
                fontWeight: '700',
                fontSize: '0.85rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                maxWidth: '560px'
              }}>
                <span style={{ color: '#fbbf24', fontSize: '0.925rem' }}>
                  ⚠️ 작문 퀴즈 기준 점수 미달 ({feedback.score}점 / 목표 90점)
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '500' }}>
                  본문 표현의 실전 응용력을 완벽히 익히기 위해 <strong>새로운 상황 시나리오</strong>로 전환하여 다시 도전해 보세요!
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextScenarioAndRetry}
                  disabled={isGeneratingScenarios}
                  style={{
                    padding: '0.8rem 1.75rem',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  {isGeneratingScenarios ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>새로운 상황 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      <span>🔄 새로운 실전 상황으로 다시 도전하기</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRetryEdit}
                  style={{ fontSize: '0.85rem', fontWeight: '700' }}
                >
                  <Edit3 size={15} />
                  <span>현재 상황에서 문장 고쳐 쓰기</span>
                </button>
              </div>

              {onCompleteQuiz && (
                <button
                  type="button"
                  onClick={onCompleteQuiz}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    marginTop: '0.35rem'
                  }}
                >
                  현재 점수({feedback.score}점)로 퀴즈 완료하고 넘어가기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
