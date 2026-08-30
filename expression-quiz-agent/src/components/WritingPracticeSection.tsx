import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Send, CheckCircle2, AlertCircle, Eye, EyeOff, Copy, 
  RefreshCw, Volume2, Award, Lightbulb, Edit3, Briefcase, Coffee, Target, Plus, Wand2
} from 'lucide-react';
import { Lesson, WritingTemplateData, WritingScenarioOption, WritingEvaluationResult } from '../types';
import { evaluateUserSentence, generateWritingScenarios, normalizeLesson } from '../geminiService';

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
  const normalized = normalizeLesson(lesson);
  const [localWritingTemplate, setLocalWritingTemplate] = useState<WritingTemplateData>(
    normalized.writingTemplate || {
      situation: "실전 비즈니스 및 일상 대화에서 배운 핵심 표현을 활용해야 하는 상황입니다.",
      koreanIntent: "배운 표현을 활용해 자연스러운 1문장을 완성해보세요.",
      prompt: "주어진 실전 상황에 맞춰 1문장으로 작문해보세요.",
      template: `(${normalized.decisionTrigger?.triggerA?.expression || 'Expression'}) ____________________.`,
      sampleSentence: normalized.eli10?.contrastiveExample || "I will check this matter right away.",
      tip: "실제 일어날 법한 상황을 머릿속에 떠올리며 작성해보세요.",
      keyKeywords: ["available", "check", "meeting"],
      scenarios: []
    }
  );

  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [userSentence, setUserSentence] = useState(lesson.userWritingSentence || initialSentence);
  const [feedback, setFeedback] = useState<WritingEvaluationResult | null>(lesson.userWritingFeedback || initialFeedback);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [copied, setCopied] = useState(false);

  const isGenericScenario = (wt: WritingTemplateData | undefined): boolean => {
    if (!wt || !wt.scenarios || wt.scenarios.length === 0) return true;
    const sit = wt.scenarios[0].situation || wt.situation || '';
    const intent = wt.scenarios[0].koreanIntent || wt.koreanIntent || '';
    return (
      sit.includes("오늘 배운 핵심 원리") ||
      sit.includes("실전 대화에서 적용") ||
      sit.includes("어색한 표현") ||
      sit.includes("불분명") ||
      sit.includes("설명") ||
      intent.includes("말해보세요") ||
      intent.includes("영작해보세요") ||
      intent.includes("어색한") ||
      intent.includes("진행해 볼게요") ||
      intent.includes("처리해 둘게요")
    );
  };

  const hasReadyScenarios = Boolean(
    localWritingTemplate.scenarios && 
    localWritingTemplate.scenarios.length > 0 && 
    !isGenericScenario(localWritingTemplate)
  );

  // Sync when lesson changes
  useEffect(() => {
    const norm = normalizeLesson(lesson);
    if (norm.writingTemplate) {
      setLocalWritingTemplate(norm.writingTemplate);
    }
    setUserSentence(lesson.userWritingSentence || '');
    setFeedback(lesson.userWritingFeedback || null);
    setActiveScenarioIdx(0);
  }, [lesson.id]);

  const defaultScenario: WritingScenarioOption = {
    category: "🏢 실전 비즈니스 / 업무 상황",
    situation: localWritingTemplate.situation || "업무 진행 중 팀원들과 상황을 확인하고 공유해야 하는 시나리오입니다.",
    koreanIntent: localWritingTemplate.koreanIntent || "상황에 알맞은 1문장을 영어로 완성해보세요.",
    template: localWritingTemplate.template || `(${normalized.decisionTrigger?.triggerA?.expression || 'Expression'}) ____________________.`,
    sampleSentence: localWritingTemplate.sampleSentence || normalized.eli10?.contrastiveExample || "",
    keyKeywords: localWritingTemplate.keyKeywords || [],
    tip: localWritingTemplate.tip || ""
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
      const generated = await generateWritingScenarios(lesson, apiKey);
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
      const result = await evaluateUserSentence(lesson, userSentence.trim(), apiKey, activeContext);
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

  const cleanKoreanIntentDisplay = (intent: string) => {
    if (!intent) return '';
    let clean = intent
      .replace(/상황을 영어로 말해보세요\.?/g, '')
      .replace(/상황을 영어 1문장으로 표현해보세요\.?/g, '')
      .replace(/상황을 영어로 표현해보세요\.?/g, '')
      .replace(/영어로 표현해보세요\.?/g, '')
      .replace(/영어로 말해보세요\.?/g, '')
      .replace(/영작해보세요\.?/g, '')
      .replace(/말해보세요\.?/g, '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .trim();

    const expr = (localWritingTemplate.template || '').toLowerCase();
    if (clean.includes('다음 날') || clean.includes('오전') || clean.includes('하루') || expr.includes('morning')) {
      return "다음 날 오전에 회의 일정 및 결과를 회신드릴게요.";
    }
    if (clean.includes('비공개') || expr.includes('private')) {
      return "제가 그 회의 일정을 비공개로 설정해 둘게요.";
    }
    if (clean.includes('구성') || clean.includes('설정') || expr.includes('configured') || expr.includes('handled')) {
      return "해당 설정은 이미 시스템에 정상적으로 구성되어 있습니다.";
    }
    if (clean.includes('표현') || clean.includes('나타내는') || clean.includes('설명') || clean.includes('처리해 둘게요')) {
      return "제가 관련 내용을 확인한 뒤 바로 회신드릴게요.";
    }

    return clean;
  };

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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

  const handleResetSentence = () => {
    setUserSentence('');
    setFeedback(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="card-section animate-fade-in" style={{
      marginTop: '1.5rem',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(236, 72, 153, 0.35)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)'
    }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '34px',
            height: '34px',
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
              <span>5단계: 1초 내 상황 작문</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>(Self-Reference Generation)</span>
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
                padding: '0.25rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: '1px solid rgba(236, 72, 153, 0.4)',
                color: '#f472b6'
              }}
              title="현재 학습 주제에 맞춘 새로운 비즈니스/일상 상황 시나리오를 AI로 생성합니다."
            >
              {isGeneratingScenarios ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  <span>시나리오 생성 중...</span>
                </>
              ) : (
                <>
                  <Wand2 size={13} />
                  <span>AI 상황 새로고침</span>
                </>
              )}
            </button>
          )}

          <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', borderRadius: '9999px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', fontWeight: '800' }}>
            실전 상황 시뮬레이션
          </span>
        </div>
      </div>

      {/* If scenarios are not ready yet, display clean AI generation card */}
      {!hasReadyScenarios ? (
        <div style={{
          padding: '2.5rem 1.5rem',
          borderRadius: '14px',
          backgroundColor: 'rgba(236, 72, 153, 0.04)',
          border: '1px dashed rgba(236, 72, 153, 0.3)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          marginTop: '0.5rem'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            border: '1px solid rgba(236, 72, 153, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f472b6'
          }}>
            <Wand2 size={26} />
          </div>

          <div>
            <h5 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'white', margin: '0 0 0.4rem 0' }}>
              실전 대화 상황을 AI로 생성해 보세요
            </h5>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0, maxWidth: '440px', lineHeight: '1.5' }}>
              오늘 배운 핵심 원리(<strong>{lesson.title}</strong>)를 실제 비즈니스 및 일상 대화에 바로 적용할 수 있도록 Gemini 3.7이 맞춤형 실전 상황과 목표 문장을 즉시 구성합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateScenariosWithAI}
            disabled={isGeneratingScenarios}
            className="btn btn-primary"
            style={{
              padding: '0.8rem 1.85rem',
              fontSize: '0.95rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
              boxShadow: '0 6px 20px rgba(236, 72, 153, 0.35)',
              cursor: isGeneratingScenarios ? 'not-allowed' : 'pointer'
            }}
          >
            {isGeneratingScenarios ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                <span>Gemini 3.7이 실전 상황 생성 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>✨ 실전 상황 시나리오 생성하고 작문 시작하기</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Scenario Selector Tabs if multiple scenarios available */}
          {scenarios.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {scenarios.map((sc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveScenarioIdx(idx)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeScenarioIdx === idx ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeScenarioIdx === idx ? '#f472b6' : 'var(--text-secondary)',
                    border: activeScenarioIdx === idx ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {sc.category.includes('비즈니스') || sc.category.includes('업무') ? <Briefcase size={14} /> : <Coffee size={14} />}
                  <span>{sc.category}</span>
                </button>
              ))}
            </div>
          )}

          {/* Realistic Situation Card */}
          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {/* Scenario Description */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f472b6', fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                <Target size={15} />
                <span>실전 상황 시나리오 (Context Situation)</span>
              </div>
              <p style={{ fontSize: '0.925rem', color: '#e2e8f0', lineHeight: '1.6', margin: 0 }}>
                {currentScenario.situation}
              </p>
            </div>

            {/* Korean Target Intent Speech Bubble */}
            <div style={{
              padding: '0.9rem 1.15rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              borderLeft: '4px solid #ec4899',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f472b6', textTransform: 'uppercase' }}>
                🎯 내가 전달하고자 하는 의도 (말하고 싶은 문장)
              </span>
              <p style={{ fontSize: '1.05rem', fontWeight: '800', color: 'white', margin: 0, lineHeight: '1.4' }}>
                "{cleanKoreanIntentDisplay(currentScenario.koreanIntent)}"
              </p>
            </div>

            {/* Collapsible Hint Trigger Button */}
            <div>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                style={{
                  background: showHint ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${showHint ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
                  borderRadius: '8px',
                  color: showHint ? '#d8b4fe' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                <Lightbulb size={14} style={{ color: showHint ? '#c084fc' : 'var(--secondary)' }} />
                <span>{showHint ? '💡 힌트 접기' : '💡 힌트 보기 (문장 구조 & 추천 표현)'}</span>
                {showHint ? <EyeOff size={13} style={{ opacity: 0.7 }} /> : <Eye size={13} style={{ opacity: 0.7 }} />}
              </button>
            </div>

            {/* Collapsible Hint Container (Hidden by default, shown on click) */}
            {showHint && (
              <div className="animate-fade-in" style={{
                padding: '1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {/* Template Structure */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px dashed rgba(139, 92, 246, 0.35)',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#c084fc' }}>구조 힌트:</span>
                    <code style={{ fontSize: '0.875rem', color: '#f1f5f9', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {currentScenario.template}
                    </code>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    onClick={handleCopyTemplate}
                  >
                    📋 템플릿 복사
                  </button>
                </div>

                {/* Suggested Keyword Chips */}
                {currentScenario.keyKeywords && currentScenario.keyKeywords.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700' }}>추천 표현:</span>
                    {currentScenario.keyKeywords.map((kw, kwIdx) => (
                      <button
                        key={kwIdx}
                        type="button"
                        onClick={() => handleAppendKeyword(kw)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                        title="클릭하여 입력창에 추가"
                      >
                        <span>{kw}</span>
                        <Plus size={11} style={{ opacity: 0.6 }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              <span>{showSample ? '모범 예시 문장 숨기기' : '💡 모범 예시 문장 및 코칭 팁 보기'}</span>
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
                  🎯 <strong>Sample:</strong> "{currentScenario.sampleSentence}"
                </p>
                {currentScenario.tip && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Lightbulb size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                    <span>{currentScenario.tip}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Writing Form */}
          <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
                placeholder="위 상황과 의도에 맞게 나만의 영어 문장을 직접 완성해보세요..."
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {feedback ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetSentence}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  >
                    🔄 처음부터 다시 쓰기
                  </button>
                </div>
              ) : <div />}

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
        </>
      )}
    </div>
  );
};
