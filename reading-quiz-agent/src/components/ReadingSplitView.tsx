import { useState, useEffect, useRef, Fragment } from 'react';
import { HelpCircle, Brain, Volume2, Sparkles, Check, X, ArrowLeft, ArrowRight, BookmarkCheck, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Share2 } from 'lucide-react';
import { ReadingLesson, ReadingQuizItem, ReadingVocabulary, SentenceAnalysis } from '../types';
import { generateCustomVocabItem, analyzePassageSentences } from '../geminiService';
import { loadPassageAnalysisFromCloud, savePassageAnalysisToCloud } from '../firebaseService';

interface ReadingSplitViewProps {
  lesson: ReadingLesson;
  onAddWrongAnswer: (quizItem: ReadingQuizItem, selectedAnswerIndex: number) => void;
  onQuizCompleted: (correctCount: number, totalCount: number, wrongQuestionsList: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => void;
  onProgressUpdate: (userAnswers: Record<string, number>) => void;
  onOpenShare: () => void;
  onBackToCreator?: () => void;
  injectedQuizzes: ReadingQuizItem[]; // Contains standard + review wrong answers injected
  onGraduateReview: (wrongId: string) => void; // Call when review question is answered correctly
  apiKey: string;
  onAddCustomVocabulary: (newVocab: ReadingVocabulary) => void;
}

export const ReadingSplitView: React.FC<ReadingSplitViewProps> = ({
  lesson,
  onAddWrongAnswer,
  onQuizCompleted,
  onProgressUpdate,
  onOpenShare,
  onBackToCreator,
  injectedQuizzes,
  onGraduateReview,
  apiKey,
  onAddCustomVocabulary
}) => {
  // Active questions under play (changes if user filters to 'retry incorrect')
  const [activeQuizzes, setActiveQuizzes] = useState<ReadingQuizItem[]>(() => injectedQuizzes);
  const [sessionWrongs, setSessionWrongs] = useState<ReadingQuizItem[]>([]);
  const [attemptWrongs, setAttemptWrongs] = useState<any[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number>>(() => lesson.userAnswers || {});

  const lastLessonIdRef = useRef<string | null>(null);
  
  // Font scaling sizes for readability
  const [fontSize, setFontSize] = useState(16);
  const [rightActiveTab, setRightActiveTab] = useState<'quiz' | 'vocab'>('quiz');
  const [activeParagraphId, setActiveParagraphId] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [isCustomVocabLoading, setIsCustomVocabLoading] = useState(false);
  const [customVocabError, setCustomVocabError] = useState<string | null>(null);

  // Sentence click states
  const [activeSentenceText, setActiveSentenceText] = useState<string | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<number, SentenceAnalysis[]>>({});
  const [analyzingParagraphId, setAnalyzingParagraphId] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const bgFetchTriggeredRef = useRef<boolean>(false);
  const [isAnalyzingBg, setIsAnalyzingBg] = useState<boolean>(false);
  const [bgProgress, setBgProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });

  // Quiz States
  const [activeQuizzesState, setActiveQuizzesState] = useState<ReadingQuizItem[]>(() => injectedQuizzes);

  useEffect(() => {
    // Only run initialization if switching to a different lesson
    if (lastLessonIdRef.current === lesson.id) {
      return;
    }
    lastLessonIdRef.current = lesson.id;

    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    setSelectedAns(null);
    setIsSubmitted(false);
    
    // Clear sentence states on lesson change
    setActiveSentenceText(null);
    setAnalysisCache({});
    setAnalyzingParagraphId(null);
    setAnalysisError(null);
    setActiveParagraphId(null);
    bgFetchTriggeredRef.current = false;
    setIsAnalyzingBg(false);
    setBgProgress({ completed: 0, total: 0 });
    
    if (lesson.userAnswers) {
      const initialScore = lesson.quizzes.filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length;
      setScore(initialScore);
      
      const allSolved = injectedQuizzes.length > 0 && injectedQuizzes.every(q => lesson.userAnswers?.[q.id] !== undefined);
      setShowResult(allSolved);
      setSubmittedAnswers(lesson.userAnswers);
      
      if (!allSolved) {
        const startIdx = injectedQuizzes.findIndex(q => lesson.userAnswers?.[q.id] === undefined);
        setCurrentIdx(startIdx !== -1 ? startIdx : 0);
      } else {
        setCurrentIdx(0);
      }
    } else {
      setScore(0);
      setShowResult(false);
      setSubmittedAnswers({});
      setCurrentIdx(0);
    }
    
    setSavedWrongId(null);
  }, [lesson.id, lesson.userAnswers, injectedQuizzes]);

  // Background auto-fetching and analysis effect
  useEffect(() => {
    if (!lesson.id || lesson.isPending) {
      return;
    }

    let isCurrent = true;

    const runAutoAnalysis = async () => {
      // 1. Try cloud cache
      try {
        const cloudCached = await loadPassageAnalysisFromCloud(lesson.id);
        if (cloudCached && Object.keys(cloudCached).length > 0) {
          if (isCurrent) {
            setAnalysisCache(cloudCached);
            bgFetchTriggeredRef.current = true;
          }
          return;
        }
      } catch (err) {
        console.warn("Failed to check cloud analysis cache:", err);
      }

      // 2. If not cached, trigger silent background fetch
      if (!bgFetchTriggeredRef.current && apiKey && lesson.paragraphs && lesson.paragraphs.length > 0) {
        bgFetchTriggeredRef.current = true;
        if (isCurrent) {
          setIsAnalyzingBg(true);
          setBgProgress({ completed: 0, total: lesson.paragraphs.length });
        }
        console.log("Auto-starting background analysis for the passage...");
        try {
          const fullResult = await analyzePassageSentences(
            lesson.paragraphs.map(p => ({ id: p.id, englishText: p.englishText })),
            lesson.passageText,
            apiKey,
            (completed, total) => {
              if (isCurrent) {
                setBgProgress({ completed, total });
              }
            },
            (paragraphId, pAnalysis) => {
              if (isCurrent) {
                setAnalysisCache(prev => ({
                  ...prev,
                  [paragraphId]: pAnalysis
                }));
              }
            }
          );
          if (isCurrent) {
            setAnalysisCache(fullResult);
            await savePassageAnalysisToCloud(lesson.id, fullResult);
            console.log("Auto-started passage analysis successfully cached!");
          }
        } catch (bgErr) {
          console.warn("Auto background passage analysis failed:", bgErr);
          if (isCurrent) {
            bgFetchTriggeredRef.current = false;
          }
        } finally {
          if (isCurrent) {
            setIsAnalyzingBg(false);
          }
        }
      }
    };

    runAutoAnalysis();

    return () => {
      isCurrent = false;
    };
  }, [lesson.id, lesson.isPending, apiKey]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [savedWrongId, setSavedWrongId] = useState<string | null>(null);

  const handleSentenceClick = (paragraph: any, sentence: string) => {
    // If clicking already active sentence, close it
    if (activeSentenceText === sentence && activeParagraphId === paragraph.id) {
      setActiveSentenceText(null);
      setActiveParagraphId(null);
      return;
    }

    setActiveParagraphId(paragraph.id);
    setActiveSentenceText(sentence);
    setAnalysisError(null);
  };

  const handleManualRetry = async () => {
    if (!apiKey) {
      setAnalysisError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 등록해 주세요.");
      return;
    }
    setIsAnalyzingBg(true);
    setBgProgress({ completed: 0, total: lesson.paragraphs.length });
    bgFetchTriggeredRef.current = true;
    setAnalysisError(null);
    try {
      const fullResult = await analyzePassageSentences(
        lesson.paragraphs.map(p => ({ id: p.id, englishText: p.englishText })),
        lesson.passageText,
        apiKey,
        (completed, total) => {
          setBgProgress({ completed, total });
        },
        (paragraphId, pAnalysis) => {
          setAnalysisCache(prev => ({
            ...prev,
            [paragraphId]: pAnalysis
          }));
        }
      );
      setAnalysisCache(fullResult);
      await savePassageAnalysisToCloud(lesson.id, fullResult);
    } catch (err: any) {
      setAnalysisError(err.message || "문장 분석 생성에 실패했습니다.");
      bgFetchTriggeredRef.current = false;
    } finally {
      setIsAnalyzingBg(false);
    }
  };

  const activeQuestion = activeQuizzes[currentIdx];
  const progressPercent = activeQuizzes.length > 0 ? ((currentIdx) / activeQuizzes.length) * 100 : 0;

  const handleSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedAns(idx);
  };

  const handleSubmit = () => {
    if (selectedAns === null || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = selectedAns === activeQuestion.correctIndex;

    const newAnswers = {
      ...submittedAnswers,
      [activeQuestion.id]: selectedAns
    };
    setSubmittedAnswers(newAnswers);

    // Call progress update callback (merge with previous lesson answers if retry)
    if (activeQuizzes.length === injectedQuizzes.length) {
      onProgressUpdate(newAnswers);
    } else {
      const mergedAnswers = {
        ...(lesson.userAnswers || {}),
        ...newAnswers
      };
      onProgressUpdate(mergedAnswers);
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
      
      // If this was an injected review question, graduate it!
      if (activeQuestion.isReview) {
        onGraduateReview(activeQuestion.id);
      }
    } else {
      // Add to session wrongs for targeted review
      setSessionWrongs(prev => {
        if (prev.some(q => q.id === activeQuestion.id)) return prev;
        return [...prev, activeQuestion];
      });
      // Track wrong answer and choice for attempt logging
      setAttemptWrongs(prev => {
        if (prev.some(w => w.question === activeQuestion.question)) return prev;
        return [...prev, {
          question: activeQuestion.question,
          choices: activeQuestion.choices,
          userAnswerIndex: selectedAns,
          correctIndex: activeQuestion.correctIndex,
          rationale: activeQuestion.rationale
        }];
      });
      // Save to Wrong Answers local storage
      onAddWrongAnswer(activeQuestion, selectedAns);
      setSavedWrongId(activeQuestion.id);
    }
  };

  const handleNext = () => {
    setSavedWrongId(null);
    setSelectedAns(null);
    setIsSubmitted(false);

    if (currentIdx < activeQuizzes.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setShowResult(true);
      const finalScore = score;
      let finalWrongs = [...attemptWrongs];
      if (selectedAns !== null && selectedAns !== activeQuestion.correctIndex) {
        if (!finalWrongs.some(w => w.question === activeQuestion.question)) {
          finalWrongs.push({
            question: activeQuestion.question,
            choices: activeQuestion.choices,
            userAnswerIndex: selectedAns,
            correctIndex: activeQuestion.correctIndex,
            rationale: activeQuestion.rationale
          });
        }
      }

      const finalAnswers: Record<string, number> = {};
      Object.entries(submittedAnswers).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          finalAnswers[key] = val;
        }
      });
      if (selectedAns !== null) {
        finalAnswers[activeQuestion.id] = selectedAns;
      }

      // Complete quiz in parent state
      if (activeQuizzes.length === injectedQuizzes.length) {
        onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers);
      } else {
        onQuizCompleted(finalScore, activeQuizzes.length, finalWrongs, finalAnswers, true);
      }
    }
  };

  const handleRestart = () => {
    setActiveQuizzes(injectedQuizzes);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
    
    // Reset completed/progress state in parent
    onProgressUpdate({});
    onQuizCompleted(0, 0, [], undefined);
  };

  const handleRetryIncorrect = () => {
    const wrongs = activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex);
    setActiveQuizzes(wrongs);
    setSessionWrongs([]);
    setAttemptWrongs([]);
    // Reset answers for retry
    setSubmittedAnswers({});
    setCurrentIdx(0);
    setSelectedAns(null);
    setIsSubmitted(false);
    setScore(0);
    setShowResult(false);
    setSavedWrongId(null);
  };

  const handleAddNewVocab = async () => {
    const word = customInput.trim();
    if (!word) return;
    if (!apiKey) {
      setCustomVocabError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 먼저 등록해 주세요.");
      return;
    }

    setIsCustomVocabLoading(true);
    setCustomVocabError(null);
    try {
      const newItem = await generateCustomVocabItem(lesson.passageText, word, apiKey);
      onAddCustomVocabulary(newItem);
      setCustomInput('');
    } catch (err: any) {
      setCustomVocabError(err.message || "표현 분석 및 추가에 실패했습니다.");
    } finally {
      setIsCustomVocabLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (isAnalyzingBg) {
      alert("AI가 전체 지문을 분석하는 중입니다. 분석이 완료되면 PDF 저장이 가능합니다. 잠시만 대기해 주세요!");
      return;
    }

    const hasAnyCache = Object.keys(analysisCache).length > 0;
    if (!hasAnyCache) {
      alert("분석된 내용이 없습니다. Gemini API Key를 등록하여 문장 분석이 완료된 후 다운로드해 주세요.");
      return;
    }

    let contentHtml = '';
    lesson.paragraphs.forEach((p, pIdx) => {
      const sentences = p.englishText.match(/[^.!?]+[.!?]+(\s+|$)/g)?.map(s => s.trim()) || [p.englishText];
      const paragraphAnalyses = analysisCache[p.id] || [];

      contentHtml += `<div class="paragraph-header">Paragraph ${pIdx + 1}</div>`;

      sentences.forEach((sentence, sIdx) => {
        const activeAnalysis = paragraphAnalyses.find(
          a => a.sentence.trim().toLowerCase() === sentence.trim().toLowerCase() ||
               a.sentence.includes(sentence) ||
               sentence.includes(a.sentence)
        );

        if (activeAnalysis) {
          let vocabHtml = '';
          if (activeAnalysis.vocabulary && activeAnalysis.vocabulary.length > 0) {
            vocabHtml += `<div class="analysis-section"><div class="section-title">🔤 주요 어휘</div><ul class="vocab-list">`;
            activeAnalysis.vocabulary.forEach(v => {
              vocabHtml += `<li class="vocab-item"><strong>${v.word}</strong>: ${v.meaning}</li>`;
            });
            vocabHtml += `</ul></div>`;
          }

          let exprHtml = '';
          if (activeAnalysis.expressions && activeAnalysis.expressions.length > 0) {
            exprHtml += `<div class="analysis-section"><div class="section-title">✨ 주요 표현</div><ul class="vocab-list">`;
            activeAnalysis.expressions.forEach(e => {
              exprHtml += `<li class="vocab-item"><strong>${e.expression}</strong>: ${e.meaning} ${e.contextNote ? `(${e.contextNote})` : ''}</li>`;
            });
            exprHtml += `</ul></div>`;
          }

          let grammarHtml = '';
          if (activeAnalysis.grammar) {
            grammarHtml += `<div class="analysis-section"><div class="section-title">⚖️ 구문 & 문법 구조</div><p class="grammar-text">${activeAnalysis.grammar}</p></div>`;
          }

          let contextHtmlSec = '';
          if (activeAnalysis.context) {
            contextHtmlSec += `<div class="analysis-section"><div class="section-title">🌐 문맥 & 흐름 분석</div><p class="context-text">${activeAnalysis.context}</p></div>`;
          }

          contentHtml += `
            <div class="sentence-block">
              <div class="english-text">S${sIdx + 1}. ${sentence}</div>
              ${activeAnalysis.translation ? `<div class="translation">📝 번역: ${activeAnalysis.translation}</div>` : ''}
              ${vocabHtml}
              ${exprHtml}
              ${grammarHtml}
              ${contextHtmlSec}
            </div>
          `;
        } else {
          contentHtml += `
            <div class="sentence-block">
              <div class="english-text">S${sIdx + 1}. ${sentence}</div>
              <div class="translation" style="color: #ef4444;">(이 문장의 AI 분석 정보가 준비되지 않았습니다.)</div>
            </div>
          `;
        }
      });
    });

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>[READ.AGENT] ${lesson.title} - 전체 문장 구문 분석</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Nanum+Gothic:wght@400;700&display=swap');
          body {
            font-family: 'Inter', 'Nanum Gothic', sans-serif;
            color: #1e293b;
            line-height: 1.6;
            margin: 40px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #06b6d4;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #0f172a;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 13px;
            color: #64748b;
          }
          .paragraph-header {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin: 30px 0 15px 0;
            background-color: #e2e8f0;
            padding: 6px 12px;
            border-radius: 6px;
            page-break-after: avoid;
          }
          .sentence-block {
            page-break-inside: avoid;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #06b6d4;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 20px;
            background-color: #f8fafc;
          }
          .english-text {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
          }
          .translation {
            font-size: 13.5px;
            color: #0284c7;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .analysis-section {
            margin-top: 10px;
            font-size: 12.5px;
            border-top: 1px dashed #e2e8f0;
            padding-top: 8px;
          }
          .section-title {
            font-weight: 700;
            color: #475569;
            margin-bottom: 4px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .vocab-list {
            margin: 0;
            padding-left: 18px;
          }
          .vocab-item {
            margin-bottom: 3px;
          }
          .grammar-text, .context-text {
            margin: 0;
            color: #334155;
          }
          @media print {
            body {
              margin: 20px;
            }
            .sentence-block {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📖 READ.AGENT - 전체 문장 구문 분석 학습 리포트</h1>
          <p>지문 제목: "${lesson.title}" | 출력 시간: ${new Date().toLocaleString()}</p>
        </div>
        ${contentHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const stats = (() => {
    // 1. Concatenate all English paragraph texts to ensure we ONLY analyze actual English content (excluding Korean annotations)
    const cleanEnglishText = lesson.paragraphs.map(p => p.englishText).join(' ');
    
    // 2. Count English words only
    const words = cleanEnglishText.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
    const totalWords = words.length;

    // 3. Count English sentences only
    const sentences = cleanEnglishText.match(/[^.!?]+[.!?]+(\s+|$)/g) || [];
    const totalSentences = Math.max(1, sentences.length);

    // 4. Estimate English syllables only
    let totalSyllables = 0;
    words.forEach(w => {
      let word = w.toLowerCase().replace(/[^a-z]/g, '');
      if (word.length === 0) return;
      if (word.length <= 3) {
        totalSyllables += 1;
        return;
      }
      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');
      const syllables = word.match(/[aeiouy]{1,2}/g);
      totalSyllables += syllables ? syllables.length : 1;
    });

    // 5. Calculate average sentence length and average syllables per word
    const asl = totalWords / totalSentences;
    const asw = totalSyllables / Math.max(1, totalWords);

    // 6. Calculate Flesch-Kincaid Grade Level (capped between Grade 1 and Grade 12 for realistic US K-12 schooling metrics)
    const rawGrade = 0.39 * asl + 11.8 * asw - 15.59;
    const grade = Math.max(1, Math.min(12, rawGrade));
    const roundedGrade = Math.round(grade);

    // 7. Map Grade Level to typical Lexile range
    const lexileRanges: Record<number, { min: number; max: number; label: string }> = {
      1: { min: 100, max: 400, label: "초등 1학년" },
      2: { min: 300, max: 600, label: "초등 2학년" },
      3: { min: 500, max: 800, label: "초등 3학년" },
      4: { min: 600, max: 900, label: "초등 4학년" },
      5: { min: 700, max: 1000, label: "초등 5학년" },
      6: { min: 800, max: 1050, label: "초등 6학년" },
      7: { min: 850, max: 1100, label: "중학 1학년" },
      8: { min: 900, max: 1150, label: "중학 2학년" },
      9: { min: 950, max: 1200, label: "중학 3학년" },
      10: { min: 1000, max: 1250, label: "고교 1학년" },
      11: { min: 1050, max: 1300, label: "고교 2학년" },
      12: { min: 1100, max: 1400, label: "고교 3학년/대학" }
    };

    const info = lexileRanges[roundedGrade] || lexileRanges[12];
    const estimatedLexileVal = Math.round(info.min + (info.max - info.min) * (grade % 1));

    return {
      words: totalWords,
      sentences: totalSentences,
      lexile: `${Math.max(info.min, Math.min(info.max, estimatedLexileVal))}L`,
      grade: grade.toFixed(1),
      label: info.label
    };
  })();

  return (
    <div className="split-view-container animate-fade-in">
      
      {/* LEFT PANEL: The English Reading Passage Reader */}
      <div className="glass-panel passage-panel">
        {/* Panel controls header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
              ENGLISH PASSAGE
            </span>
            <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
              {lesson.title}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.5rem' }} 
              onClick={() => setFontSize(prev => Math.max(13, prev - 1.5))}
              title="글씨 축소"
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fontSize}px</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.5rem' }} 
              onClick={() => setFontSize(prev => Math.min(23, prev + 1.5))}
              title="글씨 확대"
            >
              <ZoomIn size={15} />
            </button>

            <button 
              className="btn btn-primary" 
              style={{ 
                padding: '0.35rem 0.75rem', 
                fontSize: '0.725rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }} 
              onClick={handleExportPDF}
              title="전체 분석 PDF 저장"
            >
              📄 PDF 인쇄/저장
            </button>
          </div>
        </div>

        {/* The Passage text content */}
        <div className="scroll-content" style={{ fontSize: `${fontSize}px` }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '0.75rem', fontFamily: 'var(--font-display)', lineHeight: '1.4' }}>
            {lesson.title}
          </h1>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: '600' }}>
              📊 {stats.sentences}문장 / {stats.words}단어
            </span>
            <span style={{ fontSize: '0.7rem', background: 'rgba(6, 182, 212, 0.08)', color: 'var(--secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.15)', fontWeight: '700' }}>
              🎓 예상 Lexile: {stats.lexile} ({stats.label} 수준)
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>
            💡 공부하고 싶은 문장을 마우스로 클릭하면 해당 문장의 한글 번역, 구문 분석(문법), 핵심 어휘 및 문맥 설명을 실시간 AI 과외 서비스로 볼 수 있습니다.
          </p>

          {isAnalyzingBg && (
            <div className="eli5-analogy-box animate-pulse-glow" style={{ margin: '0 0 1.5rem 0', padding: '1rem', background: 'rgba(6, 182, 212, 0.06)', borderColor: 'rgba(6, 182, 212, 0.2)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--secondary)', borderRadius: '50%' }}></span>
                  AI 지문 전체 문장 분석 중 (백그라운드)
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>
                  {bgProgress.completed} / {bgProgress.total} 문단 완료 ({bgProgress.total > 0 ? Math.round((bgProgress.completed / bgProgress.total) * 100) : 0}%)
                </span>
              </div>
              <div className="quiz-progress-bar" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  className="quiz-progress-fill" 
                  style={{ 
                    width: `${bgProgress.total > 0 ? (bgProgress.completed / bgProgress.total) * 100 : 0}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--secondary) 0%, var(--primary) 100%)',
                    transition: 'width 0.4s ease'
                  }}
                ></div>
              </div>
            </div>
          )}

          {lesson.paragraphs.map((p) => {
            const isActive = activeParagraphId === p.id;
            // Split paragraph englishText into complete sentences
            const sentences = p.englishText.match(/[^.!?]+[.!?]+(\s+|$)/g)?.map(s => s.trim()) || [p.englishText];
            const paragraphAnalyses = analysisCache[p.id];

            return (
              <div 
                key={p.id} 
                className={`paragraph-block ${isActive ? 'active' : ''}`}
                style={{ padding: '1rem', margin: '0.5rem 0', borderRadius: '12px' }}
              >
                <div style={{ color: 'white', lineHeight: '1.8' }}>
                  {sentences.map((sentence, sIdx) => {
                    const isSentenceActive = activeSentenceText === sentence && activeParagraphId === p.id;
                    const sentenceAnalysis = paragraphAnalyses?.find(
                      a => a.sentence.trim().toLowerCase() === sentence.trim().toLowerCase() ||
                           a.sentence.includes(sentence) ||
                           sentence.includes(a.sentence)
                    );

                    return (
                      <Fragment key={sIdx}>
                        <span 
                          className={`interactive-sentence ${isSentenceActive ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSentenceClick(p, sentence);
                          }}
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            display: 'inline',
                            backgroundColor: isSentenceActive ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                            color: isSentenceActive ? 'var(--primary)' : 'inherit',
                            borderBottom: isSentenceActive ? '2px solid var(--primary)' : 'none',
                            fontWeight: isSentenceActive ? '600' : 'normal'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSentenceActive) {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.color = '#fff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSentenceActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'inherit';
                            }
                          }}
                        >
                          {sentence}{' '}
                        </span>

                        {isSentenceActive && (
                          <div 
                            style={{ display: 'block', width: '100%', margin: '0.75rem 0', cursor: 'default' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 1. Loading state */}
                            {!sentenceAnalysis && isAnalyzingBg && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(6, 182, 212, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                                <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
                                <span>AI가 이 문장을 포함한 전체 지문을 정밀 분석 중입니다... ({bgProgress.completed} / {bgProgress.total} 문단 완료)</span>
                              </div>
                            )}

                            {/* 2. Error state */}
                            {!sentenceAnalysis && !isAnalyzingBg && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                <span>⚠️ {analysisError || "이 문장의 분석 정보를 가져오지 못했거나 분석되지 않은 문장입니다. API 키를 등록하고 다시 시도해 보세요."}</span>
                                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); handleManualRetry(); }}>
                                  다시 시도
                                </button>
                              </div>
                            )}

                            {/* 3. Detailed Sentence Analysis Display */}
                            {sentenceAnalysis && (
                              <div className="sentence-analysis-box animate-slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                                  {/* Sentence Translation */}
                                  {sentenceAnalysis.translation && (
                                    <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>
                                        📝 문장 번역
                                      </span>
                                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#f1f5f9', fontWeight: '600', lineHeight: '1.6' }}>
                                        {sentenceAnalysis.translation}
                                      </p>
                                    </div>
                                  )}

                                  {/* Vocabulary & Expressions */}
                                  {((sentenceAnalysis.vocabulary && sentenceAnalysis.vocabulary.length > 0) || (sentenceAnalysis.expressions && sentenceAnalysis.expressions.length > 0)) && (
                                    <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>
                                        🔤 주요 어휘 &amp; 표현
                                      </span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {sentenceAnalysis.vocabulary?.map((v: any, vIdx: number) => (
                                          <div key={vIdx} style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                                            <strong style={{ color: 'var(--secondary)' }}>{v.word}</strong>: {v.meaning}
                                          </div>
                                        ))}
                                        {sentenceAnalysis.expressions?.map((e: any, eIdx: number) => (
                                          <div key={eIdx} style={{ fontSize: '0.8rem', color: '#e2e8f0', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.25rem' }}>
                                            <strong style={{ color: 'var(--success)' }}>{e.expression}</strong>: {e.meaning}
                                            {e.contextNote && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>({e.contextNote})</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Grammar structure */}
                                  {sentenceAnalysis.grammar && (
                                    <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.25rem' }}>
                                        ⚖️ 구문 &amp; 문법 구조
                                      </span>
                                      <p style={{ margin: 0, fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                                        {sentenceAnalysis.grammar}
                                      </p>
                                    </div>
                                  )}

                                  {/* Context Analysis */}
                                  {sentenceAnalysis.context && (
                                    <div className="eli5-analogy-box" style={{ margin: 0, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.25rem' }}>
                                        🌐 문맥 &amp; 흐름 분석
                                      </span>
                                      <p style={{ margin: 0, fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                                        {sentenceAnalysis.context}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Interactive Dashboard (Quiz / Vocab / Share) */}
      <div className="glass-panel passage-panel">
        {/* Navigation for right panel tabs */}
        <div style={{ padding: '0.85rem 1.25rem 0 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '-1px' }}>
            <button
              className={`btn`}
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                color: rightActiveTab === 'quiz' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: rightActiveTab === 'quiz' ? '2px solid var(--primary)' : '2px solid transparent',
                borderRadius: '0',
                padding: '0.5rem 0.75rem',
                fontWeight: rightActiveTab === 'quiz' ? '700' : '400'
              }}
              onClick={() => setRightActiveTab('quiz')}
            >
              인터랙티브 퀴즈
            </button>
            <button
              className={`btn`}
              style={{
                background: 'transparent',
                borderColor: 'transparent',
                color: rightActiveTab === 'vocab' ? 'var(--secondary)' : 'var(--text-secondary)',
                borderBottom: rightActiveTab === 'vocab' ? '2px solid var(--secondary)' : '2px solid transparent',
                borderRadius: '0',
                padding: '0.5rem 0.75rem',
                fontWeight: rightActiveTab === 'vocab' ? '700' : '400'
              }}
              onClick={() => setRightActiveTab('vocab')}
            >
              핵심 어휘장
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', transform: 'translateY(-4px)' }}>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={onOpenShare}>
              <Share2 size={13} />
              공유
            </button>
            {onBackToCreator && (
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={onBackToCreator}>
                목록
              </button>
            )}
          </div>
        </div>

        {/* Tab contents */}
        <div className="scroll-content">
          
          {/* TAB 1: INTERACTIVE QUIZZES PLAYER */}
          {rightActiveTab === 'quiz' && (
            <div className="animate-fade-in" style={{ height: '100%' }}>
              {showResult ? (
                /* QUIZ COMPLETED CARD */
                <div className="text-center" style={{ padding: '1rem 0' }}>
                  <div className="eli5-analogy-box" style={{ border: 'none', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)', borderRadius: '16px', padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
                    <Sparkles className="pulse-glow" style={{ color: 'var(--secondary)', width: '40px', height: '40px', margin: '0 auto 0.75rem auto' }} />
                    <h3 style={{ fontSize: '1.45rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                      퀴즈 세트 완료!
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      실전 훈련 결과를 확인하세요.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>정답률</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--secondary)' }}>
                          {Math.round((score / activeQuizzes.length) * 100)}%
                        </span>
                      </div>
                      <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>점수</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)' }}>
                          {score} / {activeQuizzes.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                    {activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length > 0 && (
                      <button 
                        className="btn btn-accent" 
                        onClick={handleRetryIncorrect}
                        style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, #f43f5e 100%)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
                      >
                        ✍️ 틀린 문제만 다시 풀기 ({activeQuizzes.filter(q => submittedAnswers[q.id] !== undefined && submittedAnswers[q.id] !== q.correctIndex).length})
                      </button>
                    )}
                    
                    <button className="btn btn-primary" onClick={handleRestart} style={{ width: '100%' }}>
                      <RefreshCw size={16} />
                      이 지문으로 다시 풀기
                    </button>
                  </div>

                  {/* 문항별 상세 풀이 결과 분석 피드백 */}
                  <div style={{ marginTop: '2.5rem', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                      📖 실전 퀴즈 풀이 결과 분석
                    </h4>
                    
                    {activeQuizzes.map((quiz, qIdx) => {
                      const userAnswer = submittedAnswers[quiz.id];
                      const isCorrect = userAnswer === quiz.correctIndex;
                      
                      return (
                        <div key={quiz.id} style={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.015)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '12px', 
                          padding: '1.25rem', 
                          marginBottom: '1rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc', lineHeight: '1.5', display: 'flex', gap: '0.5rem' }}>
                            <span style={{ 
                              color: isCorrect ? 'var(--success)' : 'var(--accent)',
                              fontWeight: '900'
                            }}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                            Q{qIdx + 1}. {quiz.question.replace(/^🔄\s*\[.*?\]\s*/, '')}
                          </h5>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                            {quiz.choices.map((choice, cIdx) => {
                              const isThisCorrect = cIdx === quiz.correctIndex;
                              const isThisUserSelection = cIdx === userAnswer;
                              
                              let style: React.CSSProperties = {
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                              };
                              
                              if (isThisCorrect) {
                                style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                                style.borderColor = 'var(--success)';
                                style.color = 'var(--success)';
                                style.fontWeight = '700';
                              } else if (isThisUserSelection) {
                                style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                                style.borderColor = 'var(--accent)';
                                style.color = 'var(--accent)';
                                style.fontWeight = '700';
                              }
                              
                              return (
                                <div key={cIdx} style={style}>
                                  <span>{choice}</span>
                                  {isThisCorrect && (
                                    <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                      정답
                                    </span>
                                  )}
                                  {isThisUserSelection && !isThisCorrect && (
                                    <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                      내가 선택한 오답
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="eli5-analogy-box" style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', lineHeight: '1.5', color: 'var(--text-muted)', margin: 0, borderRadius: '8px', borderStyle: 'dashed' }}>
                            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>💡 AI 상세 해설:</strong>
                            {quiz.rationale}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* PLAY ACTIVE QUESTION */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Progress info */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>실전 테스트</span>
                      <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>
                        {currentIdx + 1} / {activeQuizzes.length} 문항
                      </span>
                    </div>
                    <div className="quiz-progress-bar" style={{ height: '4px' }}>
                      <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>

                  {/* Question details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      {/* Active Quiz Categories badges */}
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {activeQuestion.type === 'comprehension' ? '📚 독해 이해' : '🔤 문맥 어휘'}
                      </span>
                      
                      {/* Spaced repetition review warning badge */}
                      {activeQuestion.isReview && (
                        <span className="badge badge-review" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                          🔄 과거 오답 복습 문제
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: '500', color: 'white', whiteSpace: 'pre-line', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                      {activeQuestion.question}
                    </div>

                    {/* Choices buttons */}
                    <div className="quiz-choices">
                      {activeQuestion.choices.map((choice, idx) => {
                        let btnClass = "choice-btn";
                        let icon: any = null;

                        if (selectedAns === idx) btnClass += " selected";
                        
                        if (isSubmitted) {
                          if (idx === activeQuestion.correctIndex) {
                            btnClass += " correct";
                            icon = <Check size={16} style={{ color: 'var(--success)' }} />;
                          } else if (selectedAns === idx) {
                            btnClass += " incorrect";
                            icon = <X size={16} style={{ color: 'var(--error)' }} />;
                          }
                        }

                        return (
                          <button
                            key={idx}
                            className={btnClass}
                            disabled={isSubmitted}
                            onClick={() => handleSelect(idx)}
                          >
                            <span>
                              <strong style={{ marginRight: '0.4rem', opacity: 0.5 }}>{String.fromCharCode(65 + idx)}.</strong>
                              {choice}
                            </span>
                            {icon}
                          </button>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    {!isSubmitted ? (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.85rem' }}
                        disabled={selectedAns === null}
                        onClick={handleSubmit}
                      >
                        답안 검증 및 Rationale 보기
                      </button>
                    ) : (
                      <button
                        className="btn btn-accent"
                        style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)' }}
                        onClick={handleNext}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          {currentIdx < activeQuizzes.length - 1 ? (
                            <>
                              다음 문제 넘어가기
                              <ArrowRight size={15} />
                            </>
                          ) : (
                            <>
                              시험 완료! 결과 보기
                              <Sparkles size={15} />
                            </>
                          )}
                        </span>
                      </button>
                    )}

                    {/* Explanations rationale box */}
                    {isSubmitted && (
                      <div className="quiz-explanation-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                          {selectedAns === activeQuestion.correctIndex ? (
                            <span className="explanation-heading success" style={{ fontSize: '0.9rem' }}>
                              <BookmarkCheck size={18} /> 정답입니다! {activeQuestion.isReview && "오답 노트 정복 완료! 🎉"}
                            </span>
                          ) : (
                            <span className="explanation-heading error" style={{ fontSize: '0.9rem' }}>
                              <AlertCircle size={18} /> 오답입니다. 오답 자동 보관됨 ✍️
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                          {activeQuestion.rationale}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KEY STUDY LIST FLASHCARDS (VOCAB, GRAMMAR, EXPRESSIONS, CONTEXT) */}
          {rightActiveTab === 'vocab' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Context-aware Word/Expression Addition Form */}
              <div className="vocab-card" style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px dashed var(--primary)', padding: '1.25rem', marginBottom: '0.25rem', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)' }}>
                  <Sparkles size={14} /> AI 문맥 분석 단어/구문/문법 추가
                </h4>
                <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: '1.4' }}>
                  공부하고 싶은 단어, 표현, 숙어나 특정 문법 구문을 입력하세요. AI가 본문 문맥(Context)을 분석하여 뜻과 원문 활용예문, 상세 학습 가이드를 자동으로 채워 넣습니다!
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="예: deter, upon receiving, tannin 등 본문 단어나 표현"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="input-glow"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', flex: 1 }}
                    disabled={isCustomVocabLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customInput.trim() && !isCustomVocabLoading) {
                        handleAddNewVocab();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddNewVocab}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', flexShrink: 0 }}
                    disabled={isCustomVocabLoading || !customInput.trim()}
                  >
                    {isCustomVocabLoading ? "분석 중..." : "추가"}
                  </button>
                </div>
                {customVocabError && (
                  <div style={{ color: 'var(--error)', fontSize: '0.725rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>⚠️ {customVocabError}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                💡 본문에서 엄선한 핵심 어휘, 문법 요소, 중요 표현 및 맥락 정보의 상세 분석 목록입니다.
              </div>

              {lesson.vocabulary.map((v, idx) => {
                const itemType = v.type || 'vocabulary';
                let typeBadge: any = null;
                if (itemType === 'vocabulary') typeBadge = <span className="badge badge-vocabulary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>🔤 주요어휘</span>;
                else if (itemType === 'grammar') typeBadge = <span className="badge badge-grammar" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⚖️ 문법구조</span>;
                else if (itemType === 'expression') typeBadge = <span className="badge badge-expression" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>💬 핵심표현</span>;
                else if (itemType === 'context') typeBadge = <span className="badge badge-context" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>🌐 맥락정보</span>;

                return (
                  <div key={idx} className="vocab-card" style={{ borderLeft: `4px solid ${
                    itemType === 'vocabulary' ? 'var(--secondary)' : 
                    itemType === 'grammar' ? 'var(--primary)' : 
                    itemType === 'expression' ? 'var(--success)' : 
                    'var(--accent)'
                  }` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {typeBadge}
                        <h4 style={{ fontSize: '1.2rem', color: 'white', fontFamily: 'var(--font-display)', fontWeight: '700' }}>
                          {v.word}
                        </h4>
                      </div>
                      {v.pronunciation && (
                        <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', background: 'rgba(6,182,212,0.08)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          /{v.pronunciation}/
                        </span>
                      )}
                    </div>

                    <p style={{ color: 'white', fontSize: '0.925rem', fontWeight: '600', marginTop: '0.25rem' }}>
                      {v.meaning}
                    </p>

                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                      <strong>Context Ex:</strong> "{v.sentence}"
                    </div>

                    {v.contextNote && (
                      <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.15rem', letterSpacing: '0.5px' }}>
                          💡 상세 분석 및 학습 가이드
                        </span>
                        {v.contextNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
