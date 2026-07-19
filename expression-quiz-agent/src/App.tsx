import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { LessonCreator } from './components/LessonCreator';
import { StudyTabs } from './components/StudyTabs';
import { QuizPanel } from './components/QuizPanel';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { Lesson, WrongAnswer, AppStats, QuizItem } from './types';
import { PRESET_LESSONS, generateLessonFromText, deserializeLesson, generateVocabularyLessons, generateAdditionalQuizzes } from './geminiService';
import { GraduationCap, Info, BookOpen, Share2, Sparkles, Edit2, X } from 'lucide-react';
import { 
  loadLessonFromCloud, 
  saveLessonToCloud, 
  syncUserLessons, 
  removeLessonAssociation,
  saveStatsToCloud,
  loadStatsFromCloud,
  saveWrongAnswersToCloud,
  loadWrongAnswersFromCloud,
  savePresetsProgressToCloud,
  loadPresetsProgressFromCloud,
  logQuizAttempt,
  sendEmailReport,
  shareLessonWithUser
} from './firebaseService';
import { ShareModal } from './components/ShareModal';
import { fetchMochiDecks, fetchMochiCards, createMochiCard } from './mochiService';

export default function App() {
  // 1. API Key State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('eng_agent_api_key') || '';
  });

  // 2. Navigation & UI View Modes
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [activeStudyTab, setActiveStudyTab] = useState<'eli5' | 'memory' | 'pronounce'>('eli5');
  const [viewMode, setViewMode] = useState<'study' | 'quiz'>('study');
  
  // 3. Active Lesson State (default to null to show Recent Lessons Library dashboard on load)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSharedQuiz, setIsSharedQuiz] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [lessonsToShare, setLessonsToShare] = useState<Lesson[]>([]);

  // 7. Recent Lessons History Library
  const [lessonsHistory, setLessonsHistory] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem('eng_expr_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unsolved' | 'solved' | 'draft'>('all');
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('eng_user_email') || '';
  });

  const handleSaveUserEmail = (email: string) => {
    setUserEmail(email);
    localStorage.setItem('eng_user_email', email);
  };

  // Mochi Integration States
  const [mochiApiKey, setMochiApiKey] = useState<string>(() => {
    return localStorage.getItem('mochi_api_key') || '';
  });

  const handleSaveMochiApiKey = (key: string) => {
    setMochiApiKey(key);
    localStorage.setItem('mochi_api_key', key);
  };

  const [mochiQuizDeckId, setMochiQuizDeckId] = useState<string>(() => {
    return localStorage.getItem('mochi_quiz_deck_id') || '';
  });

  const handleSaveMochiQuizDeckId = (deckId: string) => {
    setMochiQuizDeckId(deckId);
    localStorage.setItem('mochi_quiz_deck_id', deckId);
  };

  const [isMochiModalOpen, setIsMochiModalOpen] = useState(false);
  const [mochiDecks, setMochiDecks] = useState<any[]>([]);
  const [selectedMochiDeck, setSelectedMochiDeck] = useState<string>('all');
  const [selectedMochiStartDate, setSelectedMochiStartDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedMochiEndDate, setSelectedMochiEndDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [mochiCards, setMochiCards] = useState<any[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [mochiTotalMatches, setMochiTotalMatches] = useState<number>(0);
  const [isMochiLoading, setIsMochiLoading] = useState(false);
  const [mochiLoadedCount, setMochiLoadedCount] = useState<number>(0);
  const [mochiError, setMochiError] = useState<string | null>(null);
  const [filterIncorrectOnly, setFilterIncorrectOnly] = useState(true);
  const [includePinned, setIncludePinned] = useState(true);
  const [includeNewToReview, setIncludeNewToReview] = useState(true);
  const [mochiTotalReviewed, setMochiTotalReviewed] = useState<number>(0);
  const [mochiTotalForgotten, setMochiTotalForgotten] = useState<number>(0);
  const [mochiTotalPinnedCount, setMochiTotalPinnedCount] = useState<number>(0);
  const [mochiTotalNewToReviewCount, setMochiTotalNewToReviewCount] = useState<number>(0);
  const [mochiImportingProgress, setMochiImportingProgress] = useState<{current: number, total: number} | null>(null);
  const [isMochiSearchExpanded, setIsMochiSearchExpanded] = useState<boolean>(true);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{current: number, total: number} | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);

  const handleOpenMochiModal = async () => {
    setIsMochiModalOpen(true);
    setMochiError(null);
    setMochiCards([]);
    setMochiTotalMatches(0);
    setSelectedCardIds(new Set());
    setMochiTotalReviewed(0);
    setMochiTotalForgotten(0);
    setMochiTotalPinnedCount(0);
    setMochiTotalNewToReviewCount(0);
    setMochiLoadedCount(0);
    setIsMochiSearchExpanded(true);
    
    if (!mochiApiKey.trim()) {
      return;
    }

    setIsMochiLoading(true);
    try {
      const decks = await fetchMochiDecks(mochiApiKey);
      setMochiDecks(decks);
    } catch (err: any) {
      setMochiError(err.message || 'Mochi 덱 목록을 불러오지 못했습니다.');
    } finally {
      setIsMochiLoading(false);
    }
  };

  const handleSearchMochiCards = async () => {
    if (!mochiApiKey.trim()) return;
    if (selectedMochiStartDate > selectedMochiEndDate) {
      setMochiError("시작 날짜는 종료 날짜보다 이전이어야 합니다.");
      return;
    }
    setIsMochiLoading(true);
    setMochiLoadedCount(0);
    setMochiError(null);
    setMochiCards([]);
    setSelectedCardIds(new Set());
    setMochiTotalReviewed(0);
    setMochiTotalForgotten(0);
    setMochiTotalPinnedCount(0);
    setMochiTotalNewToReviewCount(0);

    try {
      const allCards = await fetchMochiCards(mochiApiKey, selectedMochiDeck, (count) => {
        setMochiLoadedCount(count);
      });
      
      const startLocalTime = new Date(selectedMochiStartDate + 'T00:00:00').getTime();
      const endLocalTime = new Date(selectedMochiEndDate + 'T23:59:59.999').getTime();
      
      const isWithinDateRangeLocal = (reviewDateObj: any) => {
        if (!reviewDateObj) return false;
        let dateStr = '';
        if (typeof reviewDateObj === 'string') {
          dateStr = reviewDateObj;
        } else if (reviewDateObj && typeof reviewDateObj === 'object') {
          if (reviewDateObj.$date) {
            dateStr = reviewDateObj.$date;
          } else if (reviewDateObj.date) {
            dateStr = reviewDateObj.date;
          }
        }
        
        if (!dateStr) return false;
        try {
          const reviewTime = new Date(dateStr).getTime();
          if (isNaN(reviewTime)) return false;
          return reviewTime >= startLocalTime && reviewTime <= endLocalTime;
        } catch (e) {
          return false;
        }
      };

      const isForgotten = (review: any) => {
        const remembered = review.remembered !== undefined ? review.remembered : review['remembered?'];
        return remembered === false;
      };

      // Calculate reviewed and forgotten stats from allCards list
      let reviewed = 0;
      let forgotten = 0;
      
      allCards.forEach(card => {
        card.mochiForgetCount = 0;
        card.mochiTotalForgetCount = 0;
        card.mochiReviewedInPeriod = false;
        card.mochiLatestReviewTime = 0;
        card.mochiLatestReviewDateStr = '';

        if (!card.reviews || !Array.isArray(card.reviews)) return;
        
        // Compute total overall forgets in entire history
        const allFailedReviews = card.reviews.filter((r: any) => isForgotten(r));
        card.mochiTotalForgetCount = allFailedReviews.length;

        // Compute overall latest review
        let overallLatestTime = 0;
        let overallLatestDateStr = '';
        const allReviewsWithTime = card.reviews.map((r: any) => {
          let t = 0;
          let dateStr = '';
          if (typeof r.date === 'string') {
            dateStr = r.date;
          } else if (r.date && typeof r.date === 'object') {
            dateStr = r.date.$date || r.date.date || '';
          }
          if (dateStr) {
            t = new Date(dateStr).getTime();
          }
          return { time: t, dateStr };
        }).filter(item => item.time > 0);

        if (allReviewsWithTime.length > 0) {
          allReviewsWithTime.sort((a, b) => b.time - a.time);
          overallLatestTime = allReviewsWithTime[0].time;
          try {
            const d = new Date(overallLatestTime);
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            overallLatestDateStr = `${yy}-${mm}-${dd} ${hh}:${min}`;
          } catch (e) {
            overallLatestDateStr = allReviewsWithTime[0].dateStr;
          }
        }

        // Compute overall earliest review (first review ever)
        let overallEarliestTime = 0;
        if (allReviewsWithTime.length > 0) {
          const sortedChronological = [...allReviewsWithTime].sort((a, b) => a.time - b.time);
          overallEarliestTime = sortedChronological[0].time;
        }

        card.mochiNewToReviewInPeriod = false;
        if (overallEarliestTime > 0) {
          card.mochiNewToReviewInPeriod = overallEarliestTime >= startLocalTime && overallEarliestTime <= endLocalTime;
        }

        const reviewsInPeriod = card.reviews.filter((r: any) => isWithinDateRangeLocal(r.date));
        if (reviewsInPeriod.length > 0) {
          card.mochiReviewedInPeriod = true;
          reviewed++;
          
          const failedReviews = reviewsInPeriod.filter((r: any) => isForgotten(r));
          if (failedReviews.length > 0) {
            card.mochiForgetCount = failedReviews.length;
            forgotten++;
          }

          // Find the latest review within the period
          const reviewsWithTime = reviewsInPeriod.map((r: any) => {
            let t = 0;
            let dateStr = '';
            if (typeof r.date === 'string') {
              dateStr = r.date;
            } else if (r.date && typeof r.date === 'object') {
              dateStr = r.date.$date || r.date.date || '';
            }
            if (dateStr) {
              t = new Date(dateStr).getTime();
            }
            return { time: t, dateStr };
          }).filter(item => item.time > 0);

          if (reviewsWithTime.length > 0) {
            reviewsWithTime.sort((a, b) => b.time - a.time);
            card.mochiLatestReviewTime = reviewsWithTime[0].time;
            try {
              const d = new Date(reviewsWithTime[0].time);
              const yy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const hh = String(d.getHours()).padStart(2, '0');
              const min = String(d.getMinutes()).padStart(2, '0');
              card.mochiLatestReviewDateStr = `${yy}-${mm}-${dd} ${hh}:${min}`;
            } catch (e) {
              card.mochiLatestReviewDateStr = reviewsWithTime[0].dateStr;
            }
          }
        }

        // Fallback to overall latest review if not reviewed in the selected period (mainly for pinned cards)
        if (!card.mochiLatestReviewTime && overallLatestTime > 0) {
          card.mochiLatestReviewTime = overallLatestTime;
          card.mochiLatestReviewDateStr = `${overallLatestDateStr} (기간 외)`;
        }
      });

      setMochiTotalReviewed(reviewed);
      setMochiTotalForgotten(forgotten);

      // Display cards reviewed in the selected period OR pinned cards OR new to review cards
      const isCardPinned = (card: any) => card.pinned === true || card['pinned?'] === true;

      let filtered = allCards.filter(card => {
        const matchesPeriod = card.mochiReviewedInPeriod && (!filterIncorrectOnly || card.mochiForgetCount > 0);
        const matchesPinned = includePinned && isCardPinned(card);
        const matchesNewToReview = includeNewToReview && card.mochiNewToReviewInPeriod;
        return matchesPeriod || matchesPinned || matchesNewToReview;
      });

      // Sort: cards reviewed more recently (higher mochiLatestReviewTime) appear first
      filtered.sort((a, b) => (b.mochiLatestReviewTime || 0) - (a.mochiLatestReviewTime || 0));

      setMochiTotalMatches(filtered.length);
      setMochiTotalPinnedCount(filtered.filter(isCardPinned).length);
      setMochiTotalNewToReviewCount(filtered.filter(c => c.mochiNewToReviewInPeriod).length);
      setMochiCards(filtered.slice(0, 300));
      if (filtered.length === 0) {
        const periodStr = selectedMochiStartDate === selectedMochiEndDate 
          ? selectedMochiStartDate 
          : `${selectedMochiStartDate} ~ ${selectedMochiEndDate}`;
        setMochiError(`${periodStr} 기간에 ${filterIncorrectOnly ? '복습 시 틀린(Forgot) ' : '복습을 진행한 '}카드가 존재하지 않습니다.`);
        setIsMochiSearchExpanded(true);
      } else {
        setIsMochiSearchExpanded(false);
      }
    } catch (err: any) {
      setMochiError(err.message || 'Mochi 카드를 불러오는 중 에러가 발생했습니다.');
    } finally {
      setIsMochiLoading(false);
    }
  };

  const handleImportSelectedCards = async () => {
    if (selectedCardIds.size === 0) return;

    const selectedCardsList = mochiCards.filter(card => selectedCardIds.has(card.id));
    if (selectedCardsList.length === 0) return;

    setIsMochiLoading(true);
    setMochiError(null);
    setMochiImportingProgress({ current: 0, total: selectedCardsList.length });

    try {
      let lastImportedLesson: Lesson | null = null;

      for (let i = 0; i < selectedCardsList.length; i++) {
        const card = selectedCardsList[i];
        setMochiImportingProgress({ current: i + 1, total: selectedCardsList.length });

        const text = card.content 
          ? card.content 
          : (card.fields ? Object.values(card.fields).map((f: any) => f.value).filter(Boolean).join('\n') : '');

        if (!text.trim()) continue;

        // Extract title from card content preview
        const firstLine = text.split('\n')[0].replace(/[#*`]/g, '').trim().substring(0, 25);
        const title = `[Mochi] ${firstLine || '가져온 오답 카드'}...`;

        const draftLesson: Lesson = {
          id: 'mochi_' + card.id + '_' + Date.now(),
          title: title,
          sourceText: text,
          createdAt: Date.now(),
          isDraft: true,
          eli5: { explanation: '', analogy: '', example: '', exampleContext: '' },
          memoryTips: { tipFormula: '', conceptA: '', conceptADesc: '', conceptB: '', conceptBDesc: '', visualImage: '' },
          pronunciation: { wordOrPhrase: '', phoneticRespelling: '', koreanPhonetic: '', stressGuide: '' },
          quizzes: []
        };

        // Save directly to lessons history library
        const saved = await saveLessonToHistory(draftLesson);
        lastImportedLesson = saved;
      }

      if (selectedCardsList.length === 1 && lastImportedLesson) {
        setActiveLesson(lastImportedLesson);
        setViewMode('study');
        setActiveStudyTab('eli5');
      } else {
        // If multiple cards are imported, show the library list so they can see all of them
        setActiveLesson(null);
      }
      
      setIsMochiModalOpen(false);
    } catch (err: any) {
      setMochiError(err.message || '카드를 보관함에 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsMochiLoading(false);
      setMochiImportingProgress(null);
    }
  };

  const handleGenerateSingleDraft = async () => {
    if (!apiKey) {
      alert("AI 학습 세트를 생성하려면 설정(⚙️)에서 Gemini API Key를 먼저 등록해 주세요.");
      return;
    }
    if (!activeLesson) return;

    setIsGeneratingDraft(true);
    try {
      const savedCount = localStorage.getItem('last_expr_question_count');
      const qCount = savedCount ? Number(savedCount) : 5;

      if (activeLesson.isVocabulary) {
        const generatedList = await generateVocabularyLessons(activeLesson.sourceText, apiKey, qCount);
        if (generatedList.length === 0) {
          throw new Error("어휘 분석 데이터를 생성하지 못했습니다.");
        }

        const firstGenerated = generatedList[0];
        firstGenerated.id = activeLesson.id; // Keep original draft ID
        const savedFirst = await saveLessonToHistory(firstGenerated);

        // Save the rest as new lessons
        for (let i = 1; i < generatedList.length; i++) {
          await saveLessonToHistory(generatedList[i]);
        }

        setActiveLesson(savedFirst);
      } else {
        const generated = await generateLessonFromText(activeLesson.sourceText, apiKey, qCount);
        generated.id = activeLesson.id; // Keep original ID
        generated.title = activeLesson.title;

        const saved = await saveLessonToHistory(generated);
        setActiveLesson(saved);
      }
    } catch (err: any) {
      alert(err.message || 'AI 학습 세트 생성에 실패했습니다.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleBulkGenerateQuizzes = async () => {
    if (!apiKey) {
      alert("AI 학습 세트를 생성하려면 설정(⚙️)에서 Gemini API Key를 먼저 등록해 주세요.");
      return;
    }
    const idsToGenerate = Array.from(selectedDraftIds);
    if (idsToGenerate.length === 0) return;

    setIsBulkGenerating(true);
    setBulkProgress({ current: 0, total: idsToGenerate.length });

    try {
      const savedCount = localStorage.getItem('last_expr_question_count');
      const qCount = savedCount ? Number(savedCount) : 5;

      for (let i = 0; i < idsToGenerate.length; i++) {
        const lessonId = idsToGenerate[i];
        setBulkProgress({ current: i + 1, total: idsToGenerate.length });

        const draftLesson = lessonsHistory.find(item => item.id === lessonId);
        if (!draftLesson) continue;

        if (draftLesson.isVocabulary) {
          const generatedList = await generateVocabularyLessons(draftLesson.sourceText, apiKey, qCount);
          if (generatedList.length > 0) {
            const firstGenerated = generatedList[0];
            firstGenerated.id = draftLesson.id; // Keep original draft ID
            await saveLessonToHistory(firstGenerated);

            // Save the rest as new lessons
            for (let j = 1; j < generatedList.length; j++) {
              await saveLessonToHistory(generatedList[j]);
            }
          }
        } else {
          const generated = await generateLessonFromText(draftLesson.sourceText, apiKey, qCount);
          generated.id = draftLesson.id;
          generated.title = draftLesson.title;
          await saveLessonToHistory(generated);
        }
      }

      setSelectedDraftIds(new Set());
    } catch (err: any) {
      alert(err.message || '일괄 생성 중 오류가 발생했습니다.');
    } finally {
      setIsBulkGenerating(false);
      setBulkProgress(null);
    }
  };

  const formatQuestionForMochi = (question: string, correctChoiceText: string): string => {
    const blankRegex = /_(?:\s*_){1,}|_{2,}|\(\s*blank\s*\)|\[\s*blank\s*\]|\(\s*빈칸\s*\)|\[\s*빈칸\s*\]/gi;
    if (blankRegex.test(question)) {
      return question.replace(blankRegex, `{{${correctChoiceText}}}`);
    }
    return question;
  };

  const handlePushSingleQuizToMochi = async (quiz: QuizItem) => {
    if (!mochiApiKey.trim() || !mochiQuizDeckId.trim()) {
      throw new Error("Mochi API Key와 전송할 Mochi 덱을 먼저 설정해 주세요.");
    }
    
    const choiceLabels = ["A", "B", "C", "D", "E", "F"];
    const choicesText = quiz.choices.map((c, i) => `${choiceLabels[i]}) ${c}`).join('\n');
    const correctChoiceText = quiz.choices[quiz.correctIndex];
    const correctChoiceTextFull = `${choiceLabels[quiz.correctIndex]}) ${correctChoiceText}`;

    // Convert blank/cloze to {correctAnswer} format
    const formattedQuestion = formatQuestionForMochi(quiz.question, correctChoiceText);

    const content = `### Q. ${formattedQuestion}

${choicesText}

---

**정답**: ${quiz.correctIndex + 1}번 / ${correctChoiceTextFull}

**풀이 및 해설**:
${quiz.rationale}`;

    await createMochiCard(
      mochiApiKey,
      mochiQuizDeckId,
      content,
      ["expression-agent", "quiz-review"]
    );
  };

  const handleGenerateAdditionalQuizzes = async (count: number): Promise<QuizItem[]> => {
    if (!activeLesson) return [];
    if (!apiKey) {
      throw new Error("Gemini API Key가 필요합니다. 설정(⚙️) 창에서 먼저 키를 등록해 주세요.");
    }

    const lessonWrongs = wrongAnswers.filter(wa => wa.lessonId === activeLesson.id && !wa.isArchived);
    const wrongDetails = lessonWrongs.map(wa => ({
      question: wa.quizItem.question,
      userAnswer: wa.quizItem.choices[wa.userAnswerIndex],
      correctAnswer: wa.quizItem.choices[wa.quizItem.correctIndex],
      rationale: wa.quizItem.rationale
    }));

    try {
      const newQuizzes = await generateAdditionalQuizzes(activeLesson, wrongDetails, count, apiKey);
      if (newQuizzes.length === 0) {
        throw new Error("추가 문제를 생성하지 못했습니다. 다시 시도해 주세요.");
      }

      const updatedLesson: Lesson = {
        ...activeLesson,
        quizzes: [...activeLesson.quizzes, ...newQuizzes]
      };

      const savedLesson = await saveLessonToHistory(updatedLesson);
      setActiveLesson(savedLesson);

      return newQuizzes;
    } catch (err: any) {
      console.error("Failed to generate additional quizzes:", err);
      throw err;
    }
  };

  // 7.1 Cloud Sync State
  const [userId, setUserId] = useState<string>(() => {
    return (localStorage.getItem('eng_user_id') || '').trim().toLowerCase();
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSaveUserId = (newId: string) => {
    const cleanedId = newId.trim().toLowerCase();
    setUserId(cleanedId);
    localStorage.setItem('eng_user_id', cleanedId);
  };

  const isSyncingWrongAnswersRef = useRef(false);

  // 4. Wrong Answers State (Mistakes review database)
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>(() => {
    const saved = localStorage.getItem('eng_agent_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  // 5. Statistics State
  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('eng_agent_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  // Persist Wrong Answers & Cloud background backup
  useEffect(() => {
    localStorage.setItem('eng_agent_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      if (isSyncingWrongAnswersRef.current) {
        isSyncingWrongAnswersRef.current = false;
        saveWrongAnswersToCloud(userId, wrongAnswers, parseInt(localStorage.getItem('eng_wrong_answers_updated_at') || '0', 10));
      } else {
        const newTime = Date.now();
        localStorage.setItem('eng_wrong_answers_updated_at', newTime.toString());
        saveWrongAnswersToCloud(userId, wrongAnswers, newTime);
      }
    }
  }, [wrongAnswers, userId]);

  // Persist Stats & Cloud background backup
  useEffect(() => {
    localStorage.setItem('eng_agent_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Trigger cloud sync when userId changes or on mount
  useEffect(() => {
    if (!userId) {
      setSyncStatus('idle');
      return;
    }
    
    let isMounted = true;
    setSyncStatus('syncing');
    setSyncError(null);
    
    // Fetch local history to merge
    const localSaved = localStorage.getItem('eng_expr_lessons_history');
    const localList: Lesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson History
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('eng_expr_lessons_history', JSON.stringify(syncedList));
        setSyncStatus('synced');
      }
    }).catch((err: any) => {
      if (isMounted) {
        console.error("Auto sync failed:", err);
        setSyncStatus('error');
        setSyncError(err.message || "동기화 오류");
      }
    });

    // Sync lifetime stats in parallel
    loadStatsFromCloud(userId).then((cloudStats) => {
      if (cloudStats && isMounted) {
        setStats(prev => ({
          streak: Math.max(prev.streak, cloudStats.streak),
          lastActiveDate: prev.lastActiveDate || cloudStats.lastActiveDate,
          totalQuizzesTaken: Math.max(prev.totalQuizzesTaken, cloudStats.totalQuizzesTaken),
          totalCorrectAnswers: Math.max(prev.totalCorrectAnswers, cloudStats.totalCorrectAnswers),
          masteredCount: Math.max(prev.masteredCount, cloudStats.masteredCount)
        }));
      }
    }).catch(err => console.error("Cloud stats load failed:", err));

    // Sync mistakes notebook in parallel
    loadWrongAnswersFromCloud(userId).then((cloudData) => {
      if (isMounted) {
        const localSavedTime = localStorage.getItem('eng_wrong_answers_updated_at');
        const localTime = localSavedTime ? parseInt(localSavedTime, 10) : 0;
        
        if (!cloudData) {
          // Initialize cloud
          saveWrongAnswersToCloud(userId, wrongAnswers, localTime || Date.now());
          if (!localSavedTime) {
            localStorage.setItem('eng_wrong_answers_updated_at', (localTime || Date.now()).toString());
          }
        } else if (cloudData.updatedAt > localTime) {
          isSyncingWrongAnswersRef.current = true;
          setWrongAnswers(cloudData.list);
          localStorage.setItem('eng_agent_wrong_answers', JSON.stringify(cloudData.list));
          localStorage.setItem('eng_wrong_answers_updated_at', cloudData.updatedAt.toString());
        } else if (localTime > cloudData.updatedAt) {
          saveWrongAnswersToCloud(userId, wrongAnswers, localTime);
        } else {
          // Equal: set local just to sync lists, no update needed
          isSyncingWrongAnswersRef.current = true;
          setWrongAnswers(cloudData.list);
        }
      }
    }).catch(err => console.error("Cloud wrong answers load failed:", err));
    
    // Sync presets progress in parallel
    loadPresetsProgressFromCloud(userId).then((cloudPresetsProgress) => {
      if (isMounted) {
        const localSaved = localStorage.getItem('eng_expression_presets_progress');
        const localPresetsProgress = localSaved ? JSON.parse(localSaved) : {};
        
        const mergedPresetsProgress = { ...localPresetsProgress };
        let hasChanges = false;
        
        if (cloudPresetsProgress) {
          Object.keys(cloudPresetsProgress).forEach((presetId) => {
            const localVal = localPresetsProgress[presetId];
            const cloudVal = cloudPresetsProgress[presetId];
            
            if (!localVal) {
              mergedPresetsProgress[presetId] = cloudVal;
              hasChanges = true;
            } else {
              const localTime = localVal.solvedAt || 0;
              const cloudTime = cloudVal.solvedAt || 0;
              if (cloudTime > localTime) {
                mergedPresetsProgress[presetId] = cloudVal;
                hasChanges = true;
              } else if (localTime > cloudTime) {
                hasChanges = true;
              }
            }
          });
        }
        
        Object.keys(localPresetsProgress).forEach((presetId) => {
          if (!cloudPresetsProgress || !cloudPresetsProgress[presetId]) {
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          localStorage.setItem('eng_expression_presets_progress', JSON.stringify(mergedPresetsProgress));
          savePresetsProgressToCloud(userId, mergedPresetsProgress);
        }
      }
    }).catch(err => console.error("Cloud presets progress load failed:", err));
    
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Save lesson to history library (caches locally and uploads/syncs to cloud if userId is active)
  const saveLessonToHistory = async (lesson: Lesson): Promise<Lesson> => {
    if (!lesson || lesson.id.startsWith('preset-')) return lesson;
    
    let updatedLesson = { ...lesson };
    
    // Optimistic local save
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => item.id !== lesson.id && item.id !== updatedLesson.id && item.title !== updatedLesson.title);
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
      return updated;
    });

    // If user is configured with an ID, save to Cloud
    if (userId) {
      try {
        setSyncStatus('syncing');
        
        // If this is a shared lesson owned by someone else, save progress separately
        if (lesson.ownerId && lesson.ownerId !== userId) {
          const { saveSharedLessonProgress } = await import('./firebaseService');
          await saveSharedLessonProgress(lesson.id, userId, {
            userAnswers: lesson.userAnswers,
            solvedAt: lesson.solvedAt,
            firstAttemptScore: lesson.firstAttemptScore,
            retryHistory: lesson.retryHistory
          });
        } else {
          const docId = await saveLessonToCloud(lesson, userId);
          const cloudLesson = {
            ...lesson,
            id: docId,
            ownerId: userId,
            sharedWith: lesson.sharedWith || []
          };

          if (docId !== lesson.id) {
            setLessonsHistory(prev => {
              const filtered = prev.filter(item => item.id !== lesson.id && item.id !== docId && item.title !== cloudLesson.title);
              const updated = [cloudLesson, ...filtered];
              localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
              return updated;
            });
          }
          updatedLesson = cloudLesson;
        }
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to upload lesson on save:", err);
        setSyncStatus('error');
      }
    }
    
    return updatedLesson;
  };

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');

  const handleUpdateLessonTitle = async (lessonId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    // Update active lesson title if matches
    if (activeLesson && activeLesson.id === lessonId) {
      setActiveLesson(prev => prev ? { ...prev, title: newTitle } : null);
    }

    let updatedLesson: Lesson | null = null;
    setLessonsHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === lessonId) {
          updatedLesson = { ...item, title: newTitle };
          return updatedLesson;
        }
        return item;
      });
      localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
      return updated;
    });

    if (userId && updatedLesson) {
      try {
        setSyncStatus('syncing');
        await saveLessonToCloud(updatedLesson, userId);
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to update lesson title in cloud:", err);
        setSyncStatus('error');
      }
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (window.confirm("이 학습 세트를 보관함에서 삭제하시겠습니까?")) {
      // Remove locally immediately
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
        return updated;
      });
      
      // If user ID is configured, delete/disassociate in cloud in the background
      if (userId) {
        try {
          setSyncStatus('syncing');
          await removeLessonAssociation(lessonId, userId);
          setSyncStatus('synced');
        } catch (err: any) {
          console.error("Failed to remove cloud association on delete:", err);
          setSyncStatus('error');
        }
      }
    }
  };

  const handleBulkDeleteLessons = async () => {
    if (selectedDraftIds.size === 0) return;
    if (window.confirm(`선택한 ${selectedDraftIds.size}개의 학습 세트를 완전히 삭제하시겠습니까?`)) {
      const idsToDelete = Array.from(selectedDraftIds);
      setLessonsHistory(prev => {
        const updated = prev.filter(item => !selectedDraftIds.has(item.id));
        localStorage.setItem('eng_expr_lessons_history', JSON.stringify(updated));
        return updated;
      });
      setSelectedDraftIds(new Set());
      
      if (userId) {
        try {
          setSyncStatus('syncing');
          for (const id of idsToDelete) {
            await removeLessonAssociation(id, userId);
          }
          setSyncStatus('synced');
        } catch (err: any) {
          console.error("Failed to remove cloud association on bulk delete:", err);
          setSyncStatus('error');
        }
      }
    }
  };

  // CHECK AND DECODE URL SHARE LINK (`?share=...` or `?cloudShare=...`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    const cloudDocId = params.get('cloudShare');
    
    if (sharePayload) {
      deserializeLesson(sharePayload).then((decodedLesson) => {
        if (decodedLesson) {
          setIsSharedQuiz(true);
          setViewMode('study');
          setActiveStudyTab('eli5');
          saveLessonToHistory(decodedLesson).then(saved => setActiveLesson(saved));
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setIsSharedQuiz(true);
          setViewMode('study');
          setActiveStudyTab('eli5');
          // If we are logged in, associate this shared lesson with this user!
          const currentUserId = localStorage.getItem('eng_user_id') || null;
          let sharedLessonWithUser = { ...decodedLesson };
          if (currentUserId) {
            sharedLessonWithUser.sharedWith = [...(decodedLesson.sharedWith || [])];
            if (!sharedLessonWithUser.sharedWith.includes(currentUserId) && decodedLesson.ownerId !== currentUserId) {
              sharedLessonWithUser.sharedWith.push(currentUserId);
              shareLessonWithUser(decodedLesson.id, currentUserId).catch(err =>
                console.error("Failed to associate shared lesson in cloud on link load:", err)
              );
            }
          }
          saveLessonToHistory(sharedLessonWithUser).then(saved => setActiveLesson(saved));
        }
      }).catch((err: any) => {
        console.error("Firestore loading error:", err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  // Daily Streak Counter Logic
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (stats.lastActiveDate !== today) {
      setStats(prev => {
        let newStreak = prev.streak;
        if (prev.lastActiveDate) {
          const lastDate = new Date(prev.lastActiveDate);
          const currentDate = new Date(today);
          const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            newStreak += 1; // consecutive day
          } else if (diffDays > 1) {
            newStreak = 1; // streak broken, reset
          }
        } else {
          newStreak = 1;
        }

        return {
          ...prev,
          streak: newStreak,
          lastActiveDate: today
        };
      });
    }
  }, []);

  // Injected quizzes calculated synchronously in the render phase
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...activeLesson.quizzes];

    if (wrongAnswers.length > 0) {
      const oldestMistakes = wrongAnswers
        .filter(wa => !wa.isArchived)
        .filter(wa => {
          // If the wrong answer is from a preset, only inject it when studying that exact same preset
          if (wa.lessonId.startsWith('preset-')) {
            return wa.lessonId === activeLesson.id;
          }
          // Custom lesson mistakes are only injected when studying custom lessons
          return !activeLesson.id.startsWith('preset-');
        })
        .sort((a, b) => a.timestamp - b.timestamp) // Oldest first
        .slice(0, 2)
        .map((wa, idx) => {
          const isSameLesson = wa.lessonId === activeLesson.id || wa.lessonTitle === activeLesson.title;
          const label = isSameLesson 
            ? `🔄 [현재 세트 오답 복습]` 
            : `🔄 [과거 다른 세트 오답] (출처: ${wa.lessonTitle})`;
          return {
            ...wa.quizItem,
            id: wa.id, // Keep the wrong answer ID for graduation
            isReview: true,
            question: `${label}\n\n${wa.quizItem.question}`
          };
        });
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  // Save API Key
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('eng_agent_api_key', key);
  };

  // AI custom generation trigger
  const handleGenerateLesson = async (text: string, questionCount: number, customTitle?: string, isDraft?: boolean, isVocabulary?: boolean) => {
    if (isDraft) {
      const chunks = text.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean);
      if (chunks.length === 0) return;

      setIsLoading(true);
      try {
        const draftLessons: Lesson[] = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const defaultTitle = chunk.replace(/[#*`]/g, '').trim().substring(0, 25) + (chunk.length > 25 ? '...' : '');
          const title = chunks.length === 1 && customTitle && customTitle.trim()
            ? customTitle.trim()
            : defaultTitle;

          const draftLesson: Lesson = {
            id: `pending_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            title: title,
            sourceText: chunk,
            createdAt: Date.now() - idx * 1000,
            isDraft: true,
            isVocabulary: isVocabulary || false,
            eli5: { explanation: '', analogy: '', example: '', exampleContext: '' },
            memoryTips: { tipFormula: '', conceptA: '', conceptADesc: '', conceptB: '', conceptBDesc: '', visualImage: '' },
            pronunciation: { wordOrPhrase: '', koreanPhonetic: '', stressGuide: '', phoneticRespelling: '' },
            quizzes: []
          };

          const savedLesson = await saveLessonToHistory(draftLesson);
          draftLessons.push(savedLesson);
        }

        setFilterMode('draft');
        alert(`📥 ${chunks.length}개의 영어 문장이 미생성 초안 상태로 등록되었습니다!`);
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      if (isVocabulary) {
        const generatedList = await generateVocabularyLessons(text, apiKey, questionCount);
        if (generatedList.length === 0) {
          throw new Error("어휘 분석 데이터를 생성하지 못했습니다.");
        }

        const savedLessons: Lesson[] = [];
        for (const item of generatedList) {
          const saved = await saveLessonToHistory(item);
          savedLessons.push(saved);
        }

        setViewMode('study');
        setActiveStudyTab('eli5');
        setActiveLesson(savedLessons[0]);
      } else {
        const generated = await generateLessonFromText(text, apiKey, questionCount);
        if (customTitle && customTitle.trim()) {
          generated.title = customTitle.trim();
        }
        setViewMode('study');
        setActiveStudyTab('eli5');
        const savedLesson = await saveLessonToHistory(generated);
        setActiveLesson(savedLesson);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Preset lesson load trigger
  const handleLoadPreset = (preset: Lesson) => {
    const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
    const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
    const progress = presetsProgress[preset.id];
    let presetWithProgress = preset;
    if (progress) {
      const userAnswers = progress.userAnswers !== undefined ? progress.userAnswers : progress;
      const solvedAt = progress.solvedAt;
      const firstAttemptScore = progress.firstAttemptScore;
      const retryHistory = progress.retryHistory;
      presetWithProgress = { ...preset, userAnswers, solvedAt, firstAttemptScore, retryHistory };
    }
    
    setActiveLesson(presetWithProgress);
    setViewMode('study');
    setActiveStudyTab('eli5');
  };

  // Quiz wrong answer tracking
  const handleAddWrongAnswer = (quizItem: QuizItem, selectedAnswerIndex: number) => {
    if (!activeLesson) return;

    // Avoid duplicating exact same question
    setWrongAnswers(prev => {
      if (prev.some(wa => wa.quizItem.id === quizItem.id || wa.quizItem.question === quizItem.question)) {
        return prev;
      }
      const newWrong: WrongAnswer = {
        id: `wrong-${Date.now()}-${quizItem.id}`,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        quizItem,
        userAnswerIndex: selectedAnswerIndex,
        timestamp: Date.now()
      };
      return [newWrong, ...prev];
    });
  };

  const handleGraduateReview = (wrongId: string) => {
    setWrongAnswers(prev => prev.map(wa => wa.id === wrongId ? { ...wa, isArchived: true } : wa));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Archive single wrong answer from mistakes notebook
  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.map(wa => wa.id === wrongId ? { ...wa, isArchived: true } : wa));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Delete single wrong answer completely
  const handleDeleteWrongAnswer = (wrongId: string) => {
    if (window.confirm("이 오답 데이터를 오답노트에서 완전히 삭제하시겠습니까?")) {
      setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    }
  };

  const handleUnarchiveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.map(wa => wa.id === wrongId ? { ...wa, isArchived: false } : wa));
    setStats(prev => ({
      ...prev,
      masteredCount: Math.max(0, prev.masteredCount - 1)
    }));
  };

  // Clear all mistakes
  const handleClearAllWrong = () => {
    if (window.confirm("오답 노트의 모든 데이터를 삭제하시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

  // Update stats on quiz completion
  const handleQuizCompleted = async (correctCount: number, totalCount: number, wrongQuestionsList?: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => {
    const list = wrongQuestionsList || [];

    if (totalCount > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
        };

        if (userId && activeLesson) {
          const loggedTitle = isRetry ? `🔄 [재시도] ${activeLesson.title}` : activeLesson.title;
          
          let allQuestionsList: any[] = [];
          if (userAnswers) {
            allQuestionsList = activeLesson.quizzes.map(q => {
              const userAnswerIndex = userAnswers[q.id];
              return {
                question: q.question,
                choices: q.choices,
                userAnswerIndex: userAnswerIndex !== undefined ? userAnswerIndex : -1,
                correctIndex: q.correctIndex,
                rationale: q.rationale
              };
            }).filter(q => q.userAnswerIndex !== -1);
          } else {
            allQuestionsList = list;
          }

          logQuizAttempt(userId, activeLesson.id, loggedTitle, correctCount, totalCount, list);
          sendEmailReport(userId, loggedTitle, correctCount, totalCount, allQuestionsList, newStats, userEmail);

          const getEmailText = (id: string, custom?: string) => {
            if (custom && custom.trim()) return custom.trim();
            const trimmed = id.trim().toLowerCase();
            if (trimmed === 'nikelite') return 'nikelite+quiz@gmail.com';
            if (trimmed === 'junhu') return 'nikelite+quiz@gmail.com, yjkwon98@hanmail.net, junhupark21@gmail.com';
            return 'nikelite@gmail.com';
          };
          const resolvedEmail = getEmailText(userId, userEmail);

          setTimeout(() => {
            alert(`📝 [클라우드 연동 성공]\n\n표현 학습 시험 결과가 클라우드에 백업되었습니다.\n📧 ${resolvedEmail} 으로 학습 결과 리포트 메일이 발송 대기열에 추가되었습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      let updatedLesson: Lesson;
      if (totalCount === 0) {
        // Reset/Restart
        updatedLesson = {
          ...activeLesson,
          userAnswers: undefined,
          firstAttemptScore: undefined,
          retryHistory: undefined,
          solvedAt: undefined
        };
      } else if (isRetry) {
        const mergedAnswers = {
          ...(activeLesson.userAnswers || {}),
          ...userAnswers
        };
        const newRetry = {
          score: correctCount,
          total: totalCount,
          solvedAt: Date.now()
        };
        const retryHistory = activeLesson.retryHistory ? [...activeLesson.retryHistory, newRetry] : [newRetry];
        
        updatedLesson = {
          ...activeLesson,
          userAnswers: mergedAnswers,
          retryHistory,
          solvedAt: Date.now()
        };
      } else {
        updatedLesson = {
          ...activeLesson,
          userAnswers: userAnswers,
          firstAttemptScore: { score: correctCount, total: totalCount },
          solvedAt: Date.now()
        };
      }
      setActiveLesson(updatedLesson);
      
      if (activeLesson.id.startsWith('preset-')) {
        const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
        const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
        presetsProgress[activeLesson.id] = {
          userAnswers: updatedLesson.userAnswers,
          solvedAt: updatedLesson.solvedAt,
          firstAttemptScore: updatedLesson.firstAttemptScore,
          retryHistory: updatedLesson.retryHistory
        };
        localStorage.setItem('eng_expression_presets_progress', JSON.stringify(presetsProgress));
        if (userId) {
          savePresetsProgressToCloud(userId, presetsProgress);
        }
      } else {
        const savedLesson = await saveLessonToHistory(updatedLesson);
        setActiveLesson(savedLesson);
      }
    }
  };

  const handleProgressUpdate = async (userAnswers: Record<string, number>) => {
    if (!activeLesson) return;
    
    const updatedLesson = {
      ...activeLesson,
      userAnswers: userAnswers,
      solvedAt: Date.now()
    };
    setActiveLesson(updatedLesson);
    
    if (activeLesson.id.startsWith('preset-')) {
      const savedPresetsProgress = localStorage.getItem('eng_expression_presets_progress');
      const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
      presetsProgress[activeLesson.id] = {
        userAnswers,
        solvedAt: Date.now(),
        firstAttemptScore: activeLesson.firstAttemptScore,
        retryHistory: activeLesson.retryHistory
      };
      localStorage.setItem('eng_expression_presets_progress', JSON.stringify(presetsProgress));
      if (userId) {
        savePresetsProgressToCloud(userId, presetsProgress);
      }
    } else {
      const savedLesson = await saveLessonToHistory(updatedLesson);
      setActiveLesson(savedLesson);
    }
  };

  const solvedCount = lessonsHistory.filter(item => item.userAnswers && !item.isDraft).length;
  const unsolvedCount = lessonsHistory.filter(item => !item.userAnswers && !item.isDraft).length;
  const draftCount = lessonsHistory.filter(item => item.isDraft).length;

  const getNextUnsolvedLesson = (): Lesson | null => {
    if (!activeLesson) return null;
    const currentIndex = lessonsHistory.findIndex(item => item.id === activeLesson.id);
    if (currentIndex === -1) return null;

    // Search forward
    for (let i = currentIndex + 1; i < lessonsHistory.length; i++) {
      const item = lessonsHistory[i];
      if (!item.userAnswers && !item.isDraft) {
        return item;
      }
    }

    // Wrap around and search backward
    for (let i = 0; i < currentIndex; i++) {
      const item = lessonsHistory[i];
      if (!item.userAnswers && !item.isDraft) {
        return item;
      }
    }

    return null;
  };

  const nextUnsolvedLesson = getNextUnsolvedLesson();

  const filteredHistory = lessonsHistory.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.sourceText.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterMode === 'solved') {
      return !!item.userAnswers && !item.isDraft;
    }
    if (filterMode === 'unsolved') {
      return !item.userAnswers && !item.isDraft;
    }
    if (filterMode === 'draft') {
      return !!item.isDraft;
    }
    return true;
  });

  return (
    <div className="app-container">
      {/* Header coordinates stats, api modal, and active navigations */}
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
        userEmail={userEmail}
        onSaveUserEmail={handleSaveUserEmail}
        mochiApiKey={mochiApiKey}
        onSaveMochiApiKey={handleSaveMochiApiKey}
        mochiDecks={mochiDecks}
        mochiQuizDeckId={mochiQuizDeckId}
        onSaveMochiQuizDeckId={handleSaveMochiQuizDeckId}
      />

      {/* Main Workspace Dashboard */}
      {activeTab === 'learn' && (
        <div className={`dashboard-grid ${activeLesson ? 'has-active-lesson' : ''}`}>
          {/* Left Column: Lesson creator & presets switcher */}
          <LessonCreator
            apiKey={apiKey}
            onGenerate={handleGenerateLesson}
            onLoadPreset={handleLoadPreset}
            isLoading={isLoading}
            activeLesson={activeLesson}
            onOpenMochiImport={handleOpenMochiModal}
          />

          {/* Right Column: Active Study tabs or Interactive Quiz Player */}
          {activeLesson ? (
            <main className="glass-panel main-panel">
              {/* Header inside right canvas showing Title & play buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', fontWeight: '700' }}>
                    {viewMode === 'study' ? '학습 단계' : '실전 테스트 단계'}
                  </span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                    {activeLesson.title}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setActiveLesson(null);
                    }}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}
                  >
                    목록으로 가기
                  </button>

                  {!activeLesson.id.startsWith('preset-') && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setLessonsToShare([activeLesson]);
                        setIsShareOpen(true);
                      }}
                      style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                      disabled={activeLesson.isDraft}
                    >
                      <Share2 size={15} style={{ color: 'var(--secondary)' }} />
                      공유하기
                    </button>
                  )}

                  {!activeLesson.isDraft && (
                    viewMode === 'study' ? (
                      <button
                        className="btn btn-accent"
                        onClick={() => setViewMode('quiz')}
                        style={{ padding: '0.6rem 1.25rem' }}
                      >
                        <GraduationCap size={16} />
                        인터랙티브 퀴즈 풀기
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setViewMode('study')}
                        style={{ padding: '0.6rem 1.25rem' }}
                      >
                        학습자료 다시보기
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Toggle views between Learn tabs and Quiz panel */}
              {activeLesson.isDraft ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 1.5rem', alignItems: 'center', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
                  <span style={{ fontSize: '3rem' }}>🌱</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white' }}>AI 학습자료 미생성 상태</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: '1.6', margin: 0 }}>
                    이 카드는 Mochi에서 가져온 원본 텍스트만 저장된 상태입니다.<br />
                    아래 버튼을 눌러 AI 퀴즈, 문장 해설, 발음 가이드 및 메모리 팁을 즉시 생성할 수 있습니다.
                  </p>

                  <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>카드 원본 텍스트</label>
                    <div style={{ fontSize: '0.85rem', color: 'white', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.25rem' }} className="custom-scrollbar">
                      {activeLesson.sourceText}
                    </div>
                  </div>

                  {isGeneratingDraft ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                      <div className="spinner" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.08)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>AI 학습 세트를 생성하는 중... (약 5~10초 소요)</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '280px', marginTop: '1rem' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleGenerateSingleDraft}
                        style={{ width: '100%', padding: '0.75rem', fontWeight: '700' }}
                      >
                        ✨ AI 학습자료 생성하기
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setActiveLesson(null)}
                        style={{ width: '100%', padding: '0.75rem' }}
                      >
                        목록으로 돌아가기
                      </button>
                    </div>
                  )}
                </div>
              ) : viewMode === 'study' ? (
                <StudyTabs
                  lesson={activeLesson}
                  activeStudyTab={activeStudyTab}
                  setActiveStudyTab={setActiveStudyTab}
                  apiKey={apiKey}
                />
              ) : (
                <QuizPanel
                  lesson={activeLesson}
                  onAddWrongAnswer={handleAddWrongAnswer}
                  onQuizCompleted={handleQuizCompleted}
                  onProgressUpdate={handleProgressUpdate}
                  onBackToStudy={() => setViewMode('study')}
                  injectedQuizzes={injectedQuizzes}
                  onGraduateReview={handleGraduateReview}
                  onLoadNextUnsolvedLesson={nextUnsolvedLesson ? () => {
                    setActiveLesson(nextUnsolvedLesson);
                    setViewMode('study');
                    setActiveStudyTab('eli5');
                  } : undefined}
                  mochiApiKey={mochiApiKey}
                  mochiQuizDeckId={mochiQuizDeckId}
                  onAddQuizToMochi={handlePushSingleQuizToMochi}
                  onGenerateAdditionalQuizzes={handleGenerateAdditionalQuizzes}
                  unsolvedLessonsCount={unsolvedCount}
                />
              )}
            </main>
          ) : (
            /* Recent Library column */
            <main className="glass-panel main-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', padding: '1.75rem', minWidth: 0 }}>
              <div className="library-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                    📚 나의 최근 학습 보관함
                    {userId ? (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: syncStatus === 'syncing' ? 'rgba(234, 179, 8, 0.15)' : syncStatus === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: syncStatus === 'syncing' ? '#eab308' : syncStatus === 'error' ? 'var(--error)' : 'var(--success)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid currentColor',
                        fontWeight: '600',
                        marginLeft: '0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {syncStatus === 'syncing' ? '🔄 동기화 중...' : syncStatus === 'error' ? '⚠️ 동기화 실패' : '☁️ 클라우드 동기화 완료'}
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontWeight: '500',
                        marginLeft: '0.5rem'
                      }}>
                        🔒 로컬 보관함 사용 중
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {userId 
                      ? `클라우드 계정 '${userId}'에 실시간 동기화되는 안전한 보관함입니다.`
                      : "생성하거나 공유받은 문법/표현 세트가 안전하게 보관됩니다. 우측 상단 ⚙️ 설정을 눌러 User ID를 등록하시면 클라우드와 자동 동기화됩니다."}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <input
                    type="text"
                    placeholder="학습 제목 및 내용 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-glow"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.775rem', borderRadius: '8px', width: '100%' }}
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterMode('all')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'all' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'all' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'all' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  전체 ({lessonsHistory.length})
                </button>
                <button
                  onClick={() => setFilterMode('unsolved')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'unsolved' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'unsolved' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'unsolved' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'unsolved' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  미풀이 ({unsolvedCount})
                </button>
                <button
                  onClick={() => setFilterMode('solved')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'solved' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'solved' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'solved' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'solved' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  풀이 완료 ({solvedCount})
                </button>
                <button
                  onClick={() => setFilterMode('draft')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: filterMode === 'draft' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: filterMode === 'draft' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'draft' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'draft' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  AI 미생성 ({draftCount})
                </button>
              </div>

              {/* Lesson selection controls */}
              {filteredHistory.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        const visibleIds = filteredHistory.map(item => item.id);
                        setSelectedDraftIds(new Set(visibleIds));
                      }}
                    >
                      전체 선택 ({filteredHistory.length}개)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setSelectedDraftIds(new Set());
                      }}
                    >
                      전체 해제
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk action panel */}
              {selectedDraftIds.size > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '0.75rem',
                  fontSize: '0.85rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <span style={{ color: 'white', fontWeight: '600' }}>
                    학습 세트 {selectedDraftIds.size}개 선택됨
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedDraftIds(new Set())}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      선택 해제
                    </button>
                    {Array.from(selectedDraftIds).every(id => lessonsHistory.find(l => l.id === id)?.isDraft) && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleBulkGenerateQuizzes}
                        disabled={isBulkGenerating}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: '700' }}
                      >
                        {isBulkGenerating ? '생성 중...' : '⚡ AI 일괄 생성'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                      onClick={() => {
                        const selectedLessons = Array.from(selectedDraftIds)
                          .map(id => lessonsHistory.find(l => l.id === id))
                          .filter(Boolean) as Lesson[];
                        setLessonsToShare(selectedLessons);
                        setIsShareOpen(true);
                      }}
                    >
                      🔗 선택 공유
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleBulkDeleteLessons}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      🗑️ 선택 삭제
                    </button>
                  </div>
                </div>
              )}

              {bulkProgress && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600' }}>
                    <span style={{ color: 'var(--primary)' }}>⚡ AI 학습 세트 일괄 생성 중...</span>
                    <span style={{ color: 'white' }}>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                      background: 'var(--primary)',
                      transition: 'width 0.2s ease'
                    }}></div>
                  </div>
                </div>
              )}

              <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(100vh - 280px)', minHeight: '480px', paddingRight: '0.25rem', overflowY: 'auto', overflowX: 'hidden' }}>
                {lessonsHistory.length === 0 ? (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
                    <div className="pulse-glow" style={{ width: '48px', height: '48px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>보관함에 아직 학습 세트가 없습니다</h4>
                      <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto' }}>
                        좌측 분석기 창에 질문이나 문장을 입력해 제출하시거나, 프리셋 지문을 선택해 즉시 훈련을 진행해 보세요! 생성된 학습 세트는 여기에 자동으로 저장됩니다.
                      </p>
                    </div>
                  </div>
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveLesson(item);
                        setIsSharedQuiz(false); // Reset shared banner when playing own history
                        setViewMode('study');
                        setActiveStudyTab('eli5');
                      }}
                      className="lesson-item-card"
                      style={{
                        borderLeftColor: item.isVocabulary 
                          ? '#10b981' 
                          : item.isDraft 
                            ? '#f59e0b' 
                            : 'var(--secondary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, gap: '0.75rem' }}>
                         <div 
                           style={{ display: 'flex', alignItems: 'center', paddingTop: '0.2rem' }}
                           onClick={(e) => e.stopPropagation()}
                         >
                           <input
                             type="checkbox"
                             checked={selectedDraftIds.has(item.id)}
                             style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                             onChange={() => {
                               setSelectedDraftIds(prev => {
                                 const next = new Set(prev);
                                 if (next.has(item.id)) {
                                   next.delete(item.id);
                                 } else {
                                   next.add(item.id);
                                 }
                                 return next;
                               });
                             }}
                           />
                         </div>

                        <div className="lesson-card-content">
                          <div className="lesson-card-badges">
                            <span className="lesson-card-badge date">
                              📅 {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            {item.isVocabulary && (
                              <span className="lesson-card-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                📚 어휘 학습
                              </span>
                            )}
                            {item.isDraft ? (
                              <span className="lesson-card-badge draft">
                                ⚡ AI 미생성
                              </span>
                            ) : (
                              <span className="lesson-card-badge quizzes">
                                📝 {item.quizzes.length} 문항
                              </span>
                            )}
                            {item.userAnswers ? (() => {
                              const firstScore = item.firstAttemptScore 
                                ? `${item.firstAttemptScore.score} / ${item.firstAttemptScore.total}`
                                : `${item.quizzes.filter(q => item.userAnswers?.[q.id] === q.correctIndex).length} / ${item.quizzes.length}`;
                              
                              const retryStr = item.retryHistory && item.retryHistory.length > 0
                                ? `, 재시도: ` + item.retryHistory.map(r => `${r.score}/${r.total}`).join(', ')
                                : '';

                              return (
                                <span className="lesson-card-badge solved">
                                  ✅ 풀이 완료 ({firstScore}{retryStr})
                                </span>
                              );
                            })() : (
                              <span className="lesson-card-badge unsolved">
                                📖 미풀이
                              </span>
                            )}
                            {item.ownerId && item.ownerId !== userId && (
                               <span className="lesson-card-badge shared">
                                📥 {item.ownerId}님 공유
                              </span>
                            )}
                            {item.ownerId && item.ownerId === userId && (
                              <span className="lesson-card-badge cloud">
                                ☁️ My 클라우드
                              </span>
                            )}
                          </div>
                          {editingLessonId === item.id ? (
                            <div 
                              style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.25rem', marginBottom: '0.25rem' }} 
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitleInput}
                                onChange={(e) => setEditTitleInput(e.target.value)}
                                className="input-glow"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.8rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--primary)',
                                  background: 'rgba(0,0,0,0.4)',
                                  color: 'white',
                                  width: '100%',
                                  maxWidth: '240px'
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateLessonTitle(item.id, editTitleInput);
                                    setEditingLessonId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingLessonId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateLessonTitle(item.id, editTitleInput);
                                  setEditingLessonId(null);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                저장
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLessonId(null);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <h4 className="lesson-card-title">
                              {item.title}
                            </h4>
                          )}
                          <p className="lesson-card-desc">
                            {item.sourceText}
                          </p>
                        </div>
                      </div>

                      <div className="lesson-card-actions-wrapper">
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          {item.userAnswers ? "📊 결과 분석" : "학습 개시"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLessonId(item.id);
                            setEditTitleInput(item.title);
                          }}
                          className="btn"
                          style={{
                            padding: '0.45rem',
                            borderRadius: '6px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(139, 92, 246, 0.15)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="제목 수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          className="btn"
                          style={{
                            padding: '0.45rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--error)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    검색어와 일치하는 보관함 세트가 없습니다.
                  </div>
                )}
              </div>
            </main>
          )}
        </div>
      )}

      {/* Mistakes notebook review suite */}
      {activeTab === 'review' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onDeleteWrongAnswer={handleDeleteWrongAnswer}
            onUnarchiveWrongAnswer={handleUnarchiveWrongAnswer}
            onClearAll={handleClearAllWrong}
            mochiApiKey={mochiApiKey}
            mochiQuizDeckId={mochiQuizDeckId}
            onAddQuizToMochi={handlePushSingleQuizToMochi}
          />
        </div>
      )}

      {/* Gamified tracking statistical chart room */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        </div>
      )}
      {/* Share Modal Popup */}
      <ShareModal
        lessons={lessonsToShare}
        isOpen={isShareOpen}
        onClose={() => {
          setIsShareOpen(false);
          setLessonsToShare([]);
        }}
      />
      <footer style={{ 
        textAlign: 'center', 
        padding: '2rem 0 1.5rem 0', 
        fontSize: '0.7rem', 
        color: '#6b7280', 
        opacity: 0.75, 
        fontFamily: 'monospace',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: '2rem'
      }}>
        Version: {(import.meta.env as any).VITE_BUILD_TIME || 'dev'}
      </footer>

      {/* Mochi Import Modal */}
      {isMochiModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMochiModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '650px', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem', borderRadius: '50%' }}
              onClick={() => setIsMochiModalOpen(false)}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: 'var(--primary)' }} />
              Mochi 오답 카드 가져오기
            </h3>

            {!mochiApiKey.trim() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>🔒</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Mochi API Key가 등록되어 있지 않습니다.<br />
                  우측 상단의 설정(⚙️) 아이콘을 눌러 API Key를 먼저 입력해 주세요.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsMochiModalOpen(false)}
                  style={{ marginTop: '0.5rem' }}
                >
                  확인
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }} className="custom-scrollbar">
                  {/* Search Settings */}
                  {isMochiSearchExpanded ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="mochi-search-grid">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>선택 덱 (Deck)</label>
                          <select
                            value={selectedMochiDeck}
                            onChange={(e) => setSelectedMochiDeck(e.target.value)}
                            className="input-glow select-glow"
                            style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)', height: '40px', padding: '0.5rem' }}
                            disabled={isMochiLoading}
                          >
                            <option value="all">모든 덱 (All Decks)</option>
                            {mochiDecks.map((deck) => (
                              <option key={deck.id} value={deck.id}>
                                {deck.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>시작 날짜 (Start)</label>
                          <input
                            type="date"
                            value={selectedMochiStartDate}
                            onChange={(e) => setSelectedMochiStartDate(e.target.value)}
                            className="input-glow"
                            style={{ height: '40px' }}
                            disabled={isMochiLoading}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>종료 날짜 (End)</label>
                          <input
                            type="date"
                            value={selectedMochiEndDate}
                            onChange={(e) => setSelectedMochiEndDate(e.target.value)}
                            className="input-glow"
                            style={{ height: '40px' }}
                            disabled={isMochiLoading}
                          />
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleSearchMochiCards}
                          disabled={isMochiLoading}
                          style={{ height: '40px', padding: '0 1.25rem' }}
                        >
                          {isMochiLoading ? '조회 중...' : '카드 조회'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={filterIncorrectOnly}
                            onChange={(e) => setFilterIncorrectOnly(e.target.checked)}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>선택한 기간에 복습 시 틀린 카드(Forgot)만 필터링하여 표시</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={includePinned}
                            onChange={(e) => setIncludePinned(e.target.checked)}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>고정 카드(📌) 항상 포함 (선택 기간 무관)</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={includeNewToReview}
                            onChange={(e) => setIncludeNewToReview(e.target.checked)}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>신규 복습 진입 카드(🌱) 포함 (선택 기간 내 첫 복습 진행)</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: '1px solid var(--border-color)', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '8px',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>🔍 {mochiDecks.find(d => d.id === selectedMochiDeck)?.name || '모든 덱'}</span>
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span>{selectedMochiStartDate === selectedMochiEndDate ? selectedMochiStartDate : `${selectedMochiStartDate} ~ ${selectedMochiEndDate}`}</span>
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span style={{ opacity: 0.75 }}>
                          {filterIncorrectOnly ? '❌ 틀린 카드만' : '전체 복습 카드'}
                        </span>
                        {includePinned && mochiTotalPinnedCount > 0 && <span style={{ opacity: 0.75 }}>📌 고정 포함</span>}
                        {includeNewToReview && mochiTotalNewToReviewCount > 0 && <span style={{ opacity: 0.75 }}>🌱 신규 포함</span>}
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        onClick={() => setIsMochiSearchExpanded(true)}
                      >
                        조건 변경
                      </button>
                    </div>
                  )}

                {(mochiTotalReviewed > 0 || mochiTotalPinnedCount > 0 || mochiTotalNewToReviewCount > 0) && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      📊 {mochiTotalReviewed > 0 ? (
                        <>
                          선택 기간 복습 진행 <strong>{mochiTotalReviewed}개</strong> 중 <strong>{mochiTotalForgotten}개</strong> 틀렸습니다.
                          {(mochiTotalPinnedCount > 0 || mochiTotalNewToReviewCount > 0) && (
                            <>
                              {' '}
                              (
                              {mochiTotalPinnedCount > 0 && <>고정 <strong>{mochiTotalPinnedCount}개</strong></>}
                              {mochiTotalPinnedCount > 0 && mochiTotalNewToReviewCount > 0 && <>, </>}
                              {mochiTotalNewToReviewCount > 0 && <>신규 진입 <strong>{mochiTotalNewToReviewCount}개</strong></>}
                              {' 포함)'}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {mochiTotalPinnedCount > 0 && <>고정 카드 <strong>{mochiTotalPinnedCount}개</strong></>}
                          {mochiTotalPinnedCount > 0 && mochiTotalNewToReviewCount > 0 && <> 및 </>}
                          {mochiTotalNewToReviewCount > 0 && <>신규 진입 카드 <strong>{mochiTotalNewToReviewCount}개</strong></>}
                          {'를 가져왔습니다.'}
                        </>
                      )}
                    </span>
                    {mochiTotalReviewed > 0 && mochiTotalForgotten > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '700' }}>오답률 {Math.round((mochiTotalForgotten / mochiTotalReviewed) * 100)}%</span>
                    )}
                  </div>
                )}

                {mochiImportingProgress && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                      <span>📥 개별 학습 세트 생성 및 보관함 등록 중...</span>
                      <span>{mochiImportingProgress.current} / {mochiImportingProgress.total}</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(mochiImportingProgress.current / mochiImportingProgress.total) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                )}

                {mochiError && (
                  <div style={{ color: 'var(--accent)', background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                    {mochiError}
                  </div>
                )}

                {/* Card List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      조회된 오답 카드 ({mochiTotalMatches > 300 ? `최근 복습 300개 표시 중 (총 ${mochiTotalMatches}개)` : `${mochiTotalMatches}개`})
                    </span>
                    {mochiCards.length > 0 && !mochiImportingProgress && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedCardIds(new Set(mochiCards.map(c => c.id)))}
                        >
                          전체 선택
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedCardIds(new Set())}
                        >
                          전체 해제
                        </button>
                      </div>
                    )}
                  </div>

                  <div 
                    style={{ 
                      maxHeight: !isMochiSearchExpanded ? '400px' : '200px', 
                      overflowY: 'auto', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '10px', 
                      background: 'var(--bg-input)',
                      padding: '0.5rem'
                    }}
                  >
                    {isMochiLoading ? (
                      <div style={{ 
                        padding: '2.5rem 1.5rem', 
                        textAlign: 'center', 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                      }}>
                        <div className="spinner" style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          border: '2.5px solid rgba(255,255,255,0.08)', 
                          borderTopColor: 'var(--primary)', 
                          animation: 'spin 1s linear infinite' 
                        }}></div>
                        <div style={{ fontWeight: '600', color: 'white' }}>
                          {mochiLoadedCount > 0 ? 'Mochi에서 카드 목록을 불러오는 중...' : 'Mochi 데이터를 불러오는 중...'}
                        </div>
                        {mochiLoadedCount > 0 && (
                          <div style={{ 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            padding: '0.35rem 0.75rem', 
                            borderRadius: '20px', 
                            fontSize: '0.75rem', 
                            border: '1px solid var(--border-color)',
                            color: 'var(--primary)',
                            fontWeight: '700'
                          }}>
                            ⚡ 현재 {mochiLoadedCount}개 카드 읽음
                          </div>
                        )}
                      </div>
                    ) : mochiCards.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {!mochiError && '복습 날짜를 선택한 후 조회해 주세요.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {mochiCards.map((card) => {
                          const isSelected = selectedCardIds.has(card.id);
                          const isCardPinned = card.pinned === true || card['pinned?'] === true;
                          const cardPreview = card.content 
                            ? card.content.split('---')[0].trim() 
                            : (card.fields ? Object.values(card.fields).map((f: any) => f.value).filter(Boolean)[0] || '내용 없음' : '내용 없음');

                          return (
                            <label
                              key={card.id}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '0.5rem', 
                                padding: '0.6rem 0.75rem', 
                                borderRadius: '8px', 
                                background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid',
                                borderColor: isSelected ? 'var(--primary)' : 'transparent',
                                cursor: isSelected ? 'pointer' : (mochiImportingProgress ? 'not-allowed' : 'pointer'),
                                transition: 'all 0.2s ease',
                                opacity: mochiImportingProgress ? 0.7 : 1
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={mochiImportingProgress !== null}
                                style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                                onChange={() => {
                                  setSelectedCardIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(card.id)) {
                                      next.delete(card.id);
                                    } else {
                                      next.add(card.id);
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, overflow: 'hidden' }}>
                                <div className="mochi-card-row-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ fontSize: '0.85rem', color: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
                                    {isCardPinned && <span style={{ marginRight: '0.35rem', color: 'var(--primary)' }} title="고정 카드">📌</span>}
                                    {card.mochiNewToReviewInPeriod && <span style={{ marginRight: '0.35rem', color: 'var(--primary)' }} title="신규 복습 진입">🌱</span>}
                                    {cardPreview}
                                  </div>
                                  {(card.mochiForgetCount > 0 || card.mochiTotalForgetCount > 0) && (
                                    <span 
                                      style={{ 
                                        fontSize: '0.7rem', 
                                        color: card.mochiForgetCount > 0 ? '#f43f5e' : '#9ca3af', 
                                        background: card.mochiForgetCount > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)', 
                                        padding: '0.15rem 0.45rem', 
                                        borderRadius: '6px', 
                                        fontWeight: '700',
                                        flexShrink: 0,
                                        border: card.mochiForgetCount > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-color)',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {card.mochiForgetCount > 0 
                                        ? `❌ 기간 ${card.mochiForgetCount}회 / 누적 ${card.mochiTotalForgetCount}회`
                                        : `누적 ${card.mochiTotalForgetCount}회`}
                                    </span>
                                  )}
                                </div>
                                {card.mochiLatestReviewDateStr && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.1rem' }}>
                                    <span>🕒 최근 복습: {card.mochiLatestReviewDateStr}</span>
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem', flexShrink: 0 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setIsMochiModalOpen(false)}
                    disabled={isMochiLoading || mochiImportingProgress !== null}
                  >
                    취소
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={selectedCardIds.size === 0 || isMochiLoading || mochiImportingProgress !== null}
                    onClick={handleImportSelectedCards}
                  >
                    선택한 카드 가져오기 ({selectedCardIds.size}개)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
