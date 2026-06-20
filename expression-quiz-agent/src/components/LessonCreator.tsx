import React, { useState } from 'react';
import { Sparkles, BookOpen, AlertCircle, HelpCircle } from 'lucide-react';
import { Lesson } from '../types';
import { PRESET_LESSONS } from '../geminiService';

interface LessonCreatorProps {
  apiKey: string;
  onGenerate: (text: string, questionCount: number, title?: string) => Promise<void>;
  onLoadPreset: (preset: Lesson) => void;
  isLoading: boolean;
  activeLesson: Lesson | null;
  onOpenMochiImport: (onImport: (importedText: string) => void) => void;
}

export const LessonCreator: React.FC<LessonCreatorProps> = ({
  apiKey,
  onGenerate,
  onLoadPreset,
  isLoading,
  activeLesson,
  onOpenMochiImport
}) => {
  const [inputText, setInputText] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const saved = localStorage.getItem('last_expr_question_count');
    return saved ? Number(saved) : 5;
  });
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    localStorage.setItem('last_expr_question_count', String(questionCount));
  }, [questionCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const text = inputText.trim();
    if (!text) {
      setError("분석할 영어 퀴즈나 텍스트를 입력해 주세요.");
      return;
    }

    if (!apiKey) {
      setError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 먼저 입력하시거나, 아래 프리셋 학습 세트를 선택해 체험해 보세요!");
      return;
    }

    try {
      await onGenerate(text, questionCount, titleInput.trim());
      setInputText('');
      setTitleInput('');
    } catch (err: any) {
      setError(err.message || "학습 데이터를 생성하는 중 에러가 발생했습니다.");
    }
  };

  const handleMochiImportClick = () => {
    onOpenMochiImport((importedText) => {
      setInputText(prev => {
        const prefix = prev.trim() ? prev + '\n\n' : '';
        return prefix + importedText;
      });
    });
  };

  return (
    <div className="sidebar-panel glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            AI 학습 어시스턴트
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            틀린 퀴즈 해설, 단어, 혹은 영어 문장을 붙여넣으세요. AI가 심층 학습 자료를 생성합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}
          onClick={handleMochiImportClick}
          disabled={isLoading}
        >
          ⚡ Mochi에서 가져오기
        </button>
      </div>


      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="예시 입력:&#10;Despite our preparation, we failed the exam. / Although we prepared well... 두 표현의 차이를 알려줘."
            className="textarea-glow"
            style={{ minHeight: '130px', fontSize: '0.9rem' }}
            disabled={isLoading}
          />
        </div>

        {/* Title Input Field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>학습 세트 제목 (선택)</label>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="미입력 시 지문 내용으로 자동 설정"
            className="input-glow"
            style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
            disabled={isLoading}
          />
        </div>

        {/* Question Count Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>생성할 퀴즈 문항 수</label>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="select-glow"
            disabled={isLoading}
            style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-input)', color: 'white' }}
          >
            <option value={3}>3 문항</option>
            <option value={5}>5 문항 (기본)</option>
            <option value={8}>8 문항</option>
            <option value={10}>10 문항</option>
          </select>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.2)', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={isLoading}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></span>
              AI가 심화 분석하는 중...
            </span>
          ) : (
            <>
              <Sparkles size={16} />
              AI 심화 분석 &amp; 퀴즈 생성
            </>
          )}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

      {/* Preset premium lessons */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={15} style={{ color: 'var(--secondary)' }} />
          프리미엄 추천 학습 세트
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {PRESET_LESSONS.map((preset) => {
            const isActive = activeLesson?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`btn ${isActive ? 'btn-accent' : 'btn-secondary'}`}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  fontSize: '0.825rem',
                  padding: '0.65rem 0.75rem',
                  fontWeight: isActive ? '700' : '400',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  display: 'block'
                }}
                onClick={() => onLoadPreset(preset)}
                disabled={isLoading}
              >
                ⚡ {preset.title}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--border-color)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        <h5 style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <HelpCircle size={12} />
          사용 방법
        </h5>
        1. 퀴즈 틀린 문제 해설이나 문법 질문을 적어 분석합니다.<br />
        2. 생성된 <strong>ELI5 / 암기법 / 발음</strong> 자료를 학습합니다.<br />
        3. <strong>인터랙티브 퀴즈</strong>를 풀어 실력을 검증합니다.<br />
        4. 틀린 문제는 <strong>오답 노트</strong>에서 무한 복습합니다!
      </div>
    </div>
  );
};
