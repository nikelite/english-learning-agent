import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ReadingSplitView } from './components/ReadingSplitView';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { ShareModal } from './components/ShareModal';
import { ReadingLesson, WrongReadingAnswer, AppStats, ReadingQuizItem, ReadingVocabulary } from './types';
import { PRESET_READING_LESSONS, generateReadingLesson, deserializeLesson, splitPassageIntoLessons, splitIntoSentences } from './geminiService';
import { Sparkles, Info, BookOpen, AlertCircle, RefreshCw, Layers, Edit2 } from 'lucide-react';
import { 
  loadLessonFromCloud, 
  saveLessonToCloud, 
  syncUserLessons, 
  removeLessonAssociation,
  saveStatsToCloud,
  loadStatsFromCloud,
  saveWrongAnswersToCloud,
  loadWrongAnswersFromCloud,
  logQuizAttempt,
  sendEmailReport
} from './firebaseService';

interface SentenceItem {
  id: string;
  text: string;
  isEnglish: boolean;
  included: boolean;
  paragraphIndex: number;
}

const reconstructText = (items: SentenceItem[]): string => {
  const paragraphsMap: Record<number, string[]> = {};
  items.forEach(item => {
    if (item.included) {
      if (!paragraphsMap[item.paragraphIndex]) {
        paragraphsMap[item.paragraphIndex] = [];
      }
      paragraphsMap[item.paragraphIndex].push(item.text);
    }
  });

  const sortedIndices = Object.keys(paragraphsMap)
    .map(Number)
    .sort((a, b) => a - b);

  return sortedIndices
    .map(idx => paragraphsMap[idx].join(' '))
    .filter(Boolean)
    .join('\n\n');
};

export default function App() {
  // 1. Core API & Key Settings
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('eng_reading_api_key') || '';
  });

  // 2. Navigation Tab & Views
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [viewMode, setViewMode] = useState<'creator' | 'split'>('creator');
  
  // 3. Spaced repetition storage state trees
  const [wrongAnswers, setWrongAnswers] = useState<WrongReadingAnswer[]>(() => {
    const saved = localStorage.getItem('eng_reading_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('eng_reading_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  // 4. Main Generation configuration states
  const [inputText, setInputText] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [comprehensionCount, setComprehensionCount] = useState<number>(() => {
    const saved = localStorage.getItem('last_reading_comprehension_count');
    return saved ? Number(saved) : 3;
  });
  const [vocabCount, setVocabCount] = useState<number>(() => {
    const saved = localStorage.getItem('last_reading_vocab_count');
    return saved ? Number(saved) : 2;
  });
  const [sentenceLimit, setSentenceLimit] = useState<number>(() => {
    const saved = localStorage.getItem('last_reading_sentence_limit');
    return saved ? Number(saved) : 75;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [splitConfirm, setSplitConfirm] = useState<{
    show: boolean;
    text: string;
    title: string;
    originalSentences: number;
    originalWords: number;
    remainingSentences: number;
    remainingWords: number;
    filteredSentences: number;
    filteredWords: number;
    exceedsLimit: boolean;
    originalSentenceList: string[];
    remainingSentenceList: string[];
    filteredSentenceList: string[];
    sentences: SentenceItem[];
  }>({
    show: false,
    text: '',
    title: '',
    originalSentences: 0,
    originalWords: 0,
    remainingSentences: 0,
    remainingWords: 0,
    filteredSentences: 0,
    filteredWords: 0,
    exceedsLimit: false,
    originalSentenceList: [],
    remainingSentenceList: [],
    filteredSentenceList: [],
    sentences: []
  });
  const [reportExpand, setReportExpand] = useState<{ original: boolean; remaining: boolean; filtered: boolean }>({ original: false, remaining: false, filtered: false });

  // 5. Active Lesson State (default to wood wide web preset)
  const [activeLesson, setActiveLesson] = useState<ReadingLesson | null>(() => {
    const defaultPreset = PRESET_READING_LESSONS[0] || null;
    if (defaultPreset) {
      const savedPresetsProgress = localStorage.getItem('eng_reading_presets_progress');
      const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
      const progress = presetsProgress[defaultPreset.id];
      if (progress) {
        const userAnswers = progress.userAnswers !== undefined ? progress.userAnswers : progress;
        const solvedAt = progress.solvedAt;
        const firstAttemptScore = progress.firstAttemptScore;
        const retryHistory = progress.retryHistory;
        return { ...defaultPreset, userAnswers, solvedAt, firstAttemptScore, retryHistory };
      }
    }
    return defaultPreset;
  });

  // 6. Sharing mechanisms
  const [isSharedQuiz, setIsSharedQuiz] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);

  // 7. Recent Lessons History Library
  const [lessonsHistory, setLessonsHistory] = useState<ReadingLesson[]>(() => {
    const saved = localStorage.getItem('eng_reading_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unsolved' | 'solved'>('all');

  // 7.1 Cloud Sync State
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('eng_user_id') || '';
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSaveUserId = (newId: string) => {
    setUserId(newId);
    localStorage.setItem('eng_user_id', newId);
  };

  // Injected quizzes (includes standard ones + oldest past mistakes) calculated synchronously
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...activeLesson.quizzes];

    if (!isSharedQuiz && wrongAnswers.length > 0) {
      const oldestMistakes = [...wrongAnswers]
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
            ? `🔄 [현재 지문 오답 복습]` 
            : `🔄 [과거 다른 지문 오답] (지문: ${wa.lessonTitle})`;
          return {
            ...wa.quizItem,
            id: wa.id, // Keep the wrong answer ID to identify it during graduation
            isReview: true,
            question: `${label} ${wa.quizItem.question.replace(/^Q\d+\.\s*/i, '')}`
          };
        });
      
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  // Local storage and cloud background backup persistence
  useEffect(() => {
    localStorage.setItem('eng_reading_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      saveWrongAnswersToCloud(userId, wrongAnswers);
    }
  }, [wrongAnswers, userId]);

  useEffect(() => {
    localStorage.setItem('eng_reading_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Daily Streak calculations
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

          if (diffDays === 1) newStreak += 1;
          else if (diffDays > 1) newStreak = 1;
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
    const localSaved = localStorage.getItem('eng_reading_lessons_history');
    const localList: ReadingLesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson History
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('eng_reading_lessons_history', JSON.stringify(syncedList));
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
    loadWrongAnswersFromCloud(userId).then((cloudWrong) => {
      if (cloudWrong && isMounted) {
        setWrongAnswers(prev => {
          const merged = [...prev];
          cloudWrong.forEach(cw => {
            if (!merged.some(w => w.quizItem.question === cw.quizItem.question)) {
              merged.push(cw);
            }
          });
          return merged;
        });
      }
    }).catch(err => console.error("Cloud wrong answers load failed:", err));
    
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Persist last selected configurations
  useEffect(() => {
    localStorage.setItem('last_reading_comprehension_count', String(comprehensionCount));
  }, [comprehensionCount]);

  useEffect(() => {
    localStorage.setItem('last_reading_vocab_count', String(vocabCount));
  }, [vocabCount]);

  useEffect(() => {
    localStorage.setItem('last_reading_sentence_limit', String(sentenceLimit));
  }, [sentenceLimit]);

  // Save lesson to history library (caches locally and uploads/syncs to cloud if userId is active)
  const saveLessonToHistory = async (lesson: ReadingLesson): Promise<ReadingLesson> => {
    if (!lesson || lesson.id.startsWith('preset-')) return lesson;
    
    let updatedLesson = { ...lesson };

    // If it is a pending lesson and we are offline/guest, generate a clean ID
    if (!userId && updatedLesson.id.startsWith('reading-pending-')) {
      updatedLesson.id = `reading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Optimistic local save
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => 
        item.id !== lesson.id && 
        item.id !== updatedLesson.id && 
        item.title !== updatedLesson.title
      );
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
      return updated;
    });

    // If user is configured with an ID, save to Cloud
    if (userId) {
      try {
        setSyncStatus('syncing');
        const docId = await saveLessonToCloud(lesson, userId);
        const cloudLesson = {
          ...lesson,
          id: docId,
          ownerId: userId,
          sharedWith: lesson.sharedWith || []
        };
        
        // If docId changed, update history and localStorage again
        if (docId !== lesson.id) {
          setLessonsHistory(prev => {
            const filtered = prev.filter(item => 
              item.id !== lesson.id && 
              item.id !== docId && 
              item.title !== cloudLesson.title
            );
            const updated = [cloudLesson, ...filtered];
            localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
            return updated;
          });
        }
        updatedLesson = cloudLesson;
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

    let updatedLesson: ReadingLesson | null = null;
    setLessonsHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === lessonId) {
          updatedLesson = { ...item, title: newTitle };
          return updatedLesson;
        }
        return item;
      });
      localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
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
    e.stopPropagation(); // Prevent loading the lesson
    if (window.confirm("이 학습 세트를 보관함에서 삭제하시겠습니까?")) {
      // Remove locally immediately
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
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

  // CHECK AND DECODE URL SHARE LINK (`?share=...` or `?cloudShare=...`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    const cloudDocId = params.get('cloudShare');
    
    if (sharePayload) {
      deserializeLesson(sharePayload).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setIsSharedQuiz(true);
          setViewMode('split');
          saveLessonToHistory(decodedLesson);
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      setError(null);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setIsSharedQuiz(true);
          setViewMode('split');
          saveLessonToHistory(decodedLesson);
        } else {
          setError("공유된 클라우드 학습 데이터를 찾을 수 없습니다.");
        }
      }).catch((err: any) => {
        setError(err.message || "클라우드 데이터를 가져오는 중 에러가 발생했습니다.");
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  // English sentence counter matching geminiService split algorithm
  const countEnglishSentences = (txt: string): number => {
    const sentences: string[] = [];
    const paragraphsList = txt.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const para of paragraphsList) {
      sentences.push(...splitIntoSentences(para));
    }
    
    const isEnglishSentence = (s: string): boolean => {
      const hasEnglish = /[a-zA-Z]/.test(s);
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
      return hasEnglish && !hasKorean;
    };
    return sentences.filter(isEnglishSentence).length;
  };

  const toggleSentenceInReport = (id: string) => {
    setSplitConfirm(prev => {
      const updatedSentences = prev.sentences.map(s => 
        s.id === id ? { ...s, included: !s.included } : s
      );

      const remainingList = updatedSentences.filter(s => s.included);
      const remainingSentencesCount = remainingList.length;
      
      const filteredList = updatedSentences.filter(s => !s.included);
      const filteredSentencesCount = filteredList.length;

      const cleanEnglishText = remainingList.map(s => s.text).join(' ');
      const remainingWords = cleanEnglishText.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
      const remainingWordsCount = remainingWords.length;

      const filteredText = filteredList.map(s => s.text).join(' ');
      const filteredWords = filteredText.split(/\s+/).filter(Boolean);
      const filteredWordsCount = filteredWords.length;

      const exceedsLimit = remainingSentencesCount > sentenceLimit;
      const reconstructedText = reconstructText(updatedSentences);

      return {
        ...prev,
        text: reconstructedText,
        remainingSentences: remainingSentencesCount,
        remainingWords: remainingWordsCount,
        filteredSentences: filteredSentencesCount,
        filteredWords: filteredWordsCount,
        exceedsLimit,
        sentences: updatedSentences,
        originalSentenceList: prev.originalSentenceList,
        remainingSentenceList: remainingList.map(s => s.text),
        filteredSentenceList: filteredList.map(s => s.text)
      };
    });
  };

  const executeAnalysis = async (text: string, title: string, shouldSplit: boolean) => {
    setSplitConfirm(prev => ({ ...prev, show: false }));
    setIsLoading(true);
    setError(null);
    
    try {
      if (!shouldSplit) {
        // [Bypass splitting entirely] Generate the lesson immediately using the whole raw text
        const baseTitle = title.trim() || text.substring(0, 20).replace(/\n/g, ' ') + '...';
        const generated = await generateReadingLesson(text, apiKey, comprehensionCount, vocabCount);
        generated.title = baseTitle;
        
        setActiveLesson(generated);
        setViewMode('split');
        setInputText('');
        setTitleInput('');
        await saveLessonToHistory(generated);
      } else {
        // Only run splitting logic if the user explicitly wants to split
        const splitLessons = await splitPassageIntoLessons(text, title, sentenceLimit, apiKey);
        
        if (splitLessons.length === 0) {
          throw new Error("지문 분석 결과 단원을 분할하지 못했습니다.");
        }
  
        if (splitLessons.length === 1) {
          // Single part: generate immediately
          const singlePlaceholder = splitLessons[0];
          const generated = await generateReadingLesson(singlePlaceholder.passageText, apiKey, comprehensionCount, vocabCount);
          generated.title = singlePlaceholder.title;
          
          setActiveLesson(generated);
          setViewMode('split');
          setInputText('');
          setTitleInput('');
          await saveLessonToHistory(generated);
        } else {
          // Multiple parts: save placeholders to history
          const generatedLessons: ReadingLesson[] = [];
          for (const lesson of splitLessons) {
            let updatedLesson = { ...lesson };
            if (userId) {
              try {
                setSyncStatus('syncing');
                const docId = await saveLessonToCloud(lesson, userId);
                updatedLesson = {
                  ...lesson,
                  id: docId,
                  ownerId: userId,
                  sharedWith: lesson.sharedWith || []
                };
              } catch (err) {
                console.error("Failed to upload placeholder lesson to cloud:", err);
              }
            }
            generatedLessons.push(updatedLesson);
          }
  
          setLessonsHistory(prev => {
            const generatedIds = new Set(generatedLessons.map(l => l.id));
            const generatedTitles = new Set(generatedLessons.map(l => l.title));
            const filtered = prev.filter(item => !generatedIds.has(item.id) && !generatedTitles.has(item.title));
            const updated = [...generatedLessons, ...filtered];
            localStorage.setItem('eng_reading_lessons_history', JSON.stringify(updated));
            return updated;
          });
  
          setSyncStatus(userId ? 'synced' : 'idle');
          setInputText('');
          setTitleInput('');
          
          alert(`📚 [지문 분량 초과 분할 분석]\n\n입력하신 긴 본문이 주제별/길이별로 총 ${splitLessons.length}개의 학습 단원(Part)으로 자동 분할되어 아래 보관함에 대기 상태로 등록되었습니다.`);
        }
      }
    } catch (err: any) {
      setError(err.message || "지문 생성 중 알 수 없는 에러가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('eng_reading_api_key', key);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const text = inputText.trim();

    if (!text) {
      setError("분석할 독해 지문을 입력해 주세요.");
      return;
    }
    if (!apiKey) {
      setError("우측 상단 톱니바퀴(⚙️)를 눌러 Gemini API Key를 등록하시거나, 아래 추천 프리셋 지문을 체험해 보세요!");
      return;
    }

    // 1. Split into paragraph-preserving sentence items
    const paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    const sentenceItems: SentenceItem[] = [];
    let sentenceIdCounter = 0;

    // Filter criteria (isEnglishSentence)
    const isEnglishSentence = (s: string): boolean => {
      const hasEnglish = /[a-zA-Z]/.test(s);
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
      return hasEnglish && !hasKorean;
    };

    paragraphs.forEach((para, paraIdx) => {
      const paraSentences = splitIntoSentences(para);
      paraSentences.forEach(s => {
        const isEng = isEnglishSentence(s);
        sentenceItems.push({
          id: `s-${paraIdx}-${sentenceIdCounter++}`,
          text: s,
          isEnglish: isEng,
          included: isEng,
          paragraphIndex: paraIdx
        });
      });
    });

    const sentences = sentenceItems.map(s => s.text);
    const originalWords = text.split(/\s+/).filter(Boolean);
    const originalWordsCount = originalWords.length;
    const originalSentencesCount = sentences.length;

    const remainingSentencesList = sentenceItems.filter(s => s.included).map(s => s.text);
    const remainingSentencesCount = remainingSentencesList.length;

    const filteredSentencesList = sentenceItems.filter(s => !s.included).map(s => s.text);
    const filteredSentencesCount = filteredSentencesList.length;

    // Word count after filtering (only count words matching /[a-zA-Z]/ in remaining sentences)
    const cleanEnglishText = remainingSentencesList.join(' ');
    const remainingWords = cleanEnglishText.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
    const remainingWordsCount = remainingWords.length;

    const filteredWordsCount = Math.max(0, originalWordsCount - remainingWordsCount);

    const exceedsLimit = remainingSentencesCount > sentenceLimit;

    // Reset expand states and open the preview modal
    setReportExpand({ original: false, remaining: false, filtered: false });
    setSplitConfirm({
      show: true,
      text: text,
      title: titleInput,
      originalSentences: originalSentencesCount,
      originalWords: originalWordsCount,
      remainingSentences: remainingSentencesCount,
      remainingWords: remainingWordsCount,
      filteredSentences: filteredSentencesCount,
      filteredWords: filteredWordsCount,
      exceedsLimit: exceedsLimit,
      originalSentenceList: sentences,
      remainingSentenceList: remainingSentencesList,
      filteredSentenceList: filteredSentencesList,
      sentences: sentenceItems
    });
  };

  // On-demand Lazy Loading trigger
  const handleStartLesson = async (item: ReadingLesson) => {
    setIsSharedQuiz(false); // Reset shared banner when playing own history

    if (item.isPending) {
      if (!apiKey) {
        setError("지문을 마저 분석하려면 Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // 1. Generate lesson details on-demand using the saved passageText
        const generated = await generateReadingLesson(item.passageText, apiKey, comprehensionCount, vocabCount);
        
        // 2. Merge into the placeholder (keeping same ID, title, createdAt, ownerId, and setting isPending to false)
        const completedLesson: ReadingLesson = {
          ...item,
          paragraphs: generated.paragraphs,
          vocabulary: generated.vocabulary,
          quizzes: generated.quizzes,
          isPending: false
        };

        // 3. Save/sync the completed lesson back to lessonsHistory & Cloud
        const savedLesson = await saveLessonToHistory(completedLesson);

        // 4. Set as active lesson and open split-view
        setActiveLesson(savedLesson);
        setViewMode('split');
      } catch (err: any) {
        setError(err.message || "지문 실시간 대기 학습 생성 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Classic instant open
      setActiveLesson(item);
      setViewMode('split');
    }
  };

  // Preset load trigger
  const handleLoadPreset = (preset: ReadingLesson) => {
    const savedPresetsProgress = localStorage.getItem('eng_reading_presets_progress');
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
    setViewMode('split');
  };

  // Wrong Answers notebook callbacks
  const handleAddWrongAnswer = (quizItem: ReadingQuizItem, selectedIndex: number) => {
    if (!activeLesson) return;

    setWrongAnswers(prev => {
      // Avoid duplicates based on original question string
      if (prev.some(wa => wa.quizItem.question === quizItem.question)) {
        return prev;
      }
      const newWrong: WrongReadingAnswer = {
        id: `wrong-reading-${Date.now()}-${quizItem.id}`,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        quizItem,
        userAnswerIndex: selectedIndex,
        timestamp: Date.now()
      };
      return [newWrong, ...prev];
    });
  };

  // Graduation from mistakes notebook (triggered when review question is answered correctly)
  const handleGraduateReview = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  // Manual dismiss wrong answer from notebook
  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
  };

  const handleClearAllWrong = () => {
    if (window.confirm("독해 오답 노트의 모든 기록을 영구 삭제하시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

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
          sendEmailReport(userId, loggedTitle, correctCount, totalCount, allQuestionsList, newStats);
          
          setTimeout(() => {
            alert(`📝 [클라우드 연동 성공]\n\n이번 학습 내역이 안전하게 클라우드에 백업되었습니다.\n📧 nikelite@gmail.com 으로 학습 결과 리포트 메일이 발송 대기열에 등록되었습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      let updatedLesson: ReadingLesson;
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
        const savedPresetsProgress = localStorage.getItem('eng_reading_presets_progress');
        const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
        presetsProgress[activeLesson.id] = {
          userAnswers: updatedLesson.userAnswers,
          solvedAt: updatedLesson.solvedAt,
          firstAttemptScore: updatedLesson.firstAttemptScore,
          retryHistory: updatedLesson.retryHistory
        };
        localStorage.setItem('eng_reading_presets_progress', JSON.stringify(presetsProgress));
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
      const savedPresetsProgress = localStorage.getItem('eng_reading_presets_progress');
      const presetsProgress = savedPresetsProgress ? JSON.parse(savedPresetsProgress) : {};
      presetsProgress[activeLesson.id] = {
        userAnswers,
        solvedAt: Date.now(),
        firstAttemptScore: activeLesson.firstAttemptScore,
        retryHistory: activeLesson.retryHistory
      };
      localStorage.setItem('eng_reading_presets_progress', JSON.stringify(presetsProgress));
    } else {
      const savedLesson = await saveLessonToHistory(updatedLesson);
      setActiveLesson(savedLesson);
    }
  };

  const handleAddCustomVocabulary = (newVocab: ReadingVocabulary) => {
    if (!activeLesson) return;
    const updatedLesson = {
      ...activeLesson,
      vocabulary: [newVocab, ...activeLesson.vocabulary]
    };
    setActiveLesson(updatedLesson);
    saveLessonToHistory(updatedLesson);
  };

  const filteredHistory = lessonsHistory.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.passageText.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterMode === 'solved') {
      return !!item.userAnswers;
    }
    if (filterMode === 'unsolved') {
      return !item.userAnswers;
    }
    return true;
  });

  const solvedCount = lessonsHistory.filter(item => item.userAnswers).length;
  const unsolvedCount = lessonsHistory.filter(item => !item.userAnswers).length;

  return (
    <div className="app-container">
      {/* Universal header */}
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
        isSharedQuiz={isSharedQuiz}
      />

      {/* Shared quiz exit warning overlay banner */}
      {isSharedQuiz && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', marginTop: '1rem' }}>
          <span>💡 공유 링크를 통해 학습 테스트 세트에 접속해 계십니다. 나만의 지문을 업로드해 풀고 싶다면 복제하여 사용하세요.</span>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => {
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsSharedQuiz(false);
            setViewMode('creator');
          }}>
            나의 독해방으로 가기
          </button>
        </div>
      )}

      {/* Dashboard navigation tabs */}
      {activeTab === 'learn' && (
        viewMode === 'creator' ? (
          /* SECTION A: THE CREATOR & INPUT FORM */
          <div className="dashboard-layout animate-fade-in">
            {/* Input Form Column */}
            <div className="glass-panel sidebar-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} style={{ color: 'var(--secondary)' }} />
                  독해 분석 대시보드
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  영어 지문/텍스트를 붙여넣으세요. AI가 문단별 번역, 단어장 및 맞춤형 퀴즈를 출제합니다.
                </p>
              </div>

              <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="영어 독해 본문이나 모의고사 텍스트를 이곳에 붙여넣어 주세요..."
                    className="textarea-glow"
                    style={{ minHeight: '180px', fontSize: '0.85rem' }}
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

                {/* Configurations */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>독해 문항 수</label>
                    <select
                      value={comprehensionCount}
                      onChange={(e) => setComprehensionCount(Number(e.target.value))}
                      className="select-glow"
                      disabled={isLoading}
                    >
                      <option value={0}>0 문제</option>
                      <option value={1}>1 문제</option>
                      <option value={2}>2 문제</option>
                      <option value={3}>3 문제</option>
                      <option value={4}>4 문제</option>
                      <option value={5}>5 문제</option>
                      <option value={8}>8 문제</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>어휘 문항 수</label>
                    <select
                      value={vocabCount}
                      onChange={(e) => setVocabCount(Number(e.target.value))}
                      className="select-glow"
                      disabled={isLoading}
                    >
                      <option value={0}>0 문제</option>
                      <option value={1}>1 문제</option>
                      <option value={2}>2 문제</option>
                      <option value={3}>3 문제</option>
                      <option value={4}>4 문제</option>
                      <option value={5}>5 문제</option>
                      <option value={8}>8 문제</option>
                    </select>
                  </div>
                </div>

                {/* Text Chunking Sentence Limit Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>지문 분할 기준 (문장 수)</label>
                  <select
                    value={sentenceLimit}
                    onChange={(e) => setSentenceLimit(Number(e.target.value))}
                    className="select-glow"
                    disabled={isLoading}
                  >
                    <option value={30}>30 문장 (짧은 단원 - 빠른 훈련)</option>
                    <option value={50}>50 문장 (일반 단원)</option>
                    <option value={75}>75 문장 (기본값 - 표준 학습)</option>
                    <option value={100}>100 문장 (심층 학습 - 긴 본문)</option>
                    <option value={150}>150 문장 (초장문 학습 - 고난도)</option>
                  </select>
                </div>

                {error && (
                  <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'flex-start' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', boxShadow: '0 4px 15px rgba(6,182,212,0.2)' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></span>
                      지문 정독 및 출제하는 중...
                    </span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      영어 지문 분석 &amp; 출제
                    </>
                  )}
                </button>
              </form>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

              {/* Preset selector list */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Layers size={14} style={{ color: 'var(--primary)' }} />
                  추천 프리셋 지문 훈련
                </h4>
                {PRESET_READING_LESSONS.map((preset) => (
                  <button
                    key={preset.id}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '0.6rem 0.75rem' }}
                    onClick={() => handleLoadPreset(preset)}
                  >
                    📖 {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction manual / Recent Library column */}
            {/* Recent Library column */}
            <main className="glass-panel main-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', padding: '1.75rem', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <BookOpen size={20} style={{ color: 'var(--secondary)' }} />
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
                      : "생성하거나 공유받은 독해 지문들이 안전하게 보관됩니다. 우측 상단 ⚙️ 설정을 눌러 User ID를 등록하시면 클라우드와 자동 동기화됩니다."}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <input
                    type="text"
                    placeholder="학습 제목 및 지문 검색..."
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
                    border: filterMode === 'all' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                    background: filterMode === 'all' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
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
                    border: filterMode === 'unsolved' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                    background: filterMode === 'unsolved' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
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
                    border: filterMode === 'solved' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                    background: filterMode === 'solved' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    color: filterMode === 'solved' ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: filterMode === 'solved' ? '700' : '500',
                    transition: 'all 0.15s ease',
                  }}
                >
                  풀이 완료 ({solvedCount})
                </button>
              </div>

              <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(100vh - 280px)', minHeight: '480px', paddingRight: '0.25rem', overflowY: 'auto', overflowX: 'hidden' }}>
                {lessonsHistory.length === 0 ? (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
                    <div className="pulse-glow" style={{ width: '48px', height: '48px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} style={{ color: 'var(--secondary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>보관함에 아직 학습 세트가 없습니다</h4>
                      <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '360px', margin: '0 auto' }}>
                        좌측 지문 생성기에 본문을 붙여넣고 분석하시거나, 아래 추천 프리셋 지문을 선택해 즉시 훈련을 진행해 보세요! 생성된 학습 세트는 여기에 자동으로 저장됩니다.
                      </p>
                    </div>
                  </div>
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleStartLesson(item)}
                      className="eli5-analogy-box"
                      style={{
                        margin: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        borderLeftWidth: '4px',
                        borderLeftColor: item.isPending ? 'var(--text-muted)' : 'var(--secondary)',
                        transition: 'transform 0.15s ease, background 0.15s ease',
                        borderRadius: '0 8px 8px 0',
                        opacity: item.isPending ? 0.85 : 1,
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, minWidth: 0, marginRight: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            📅 {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {!item.isPending && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '600' }}>
                              📝 {item.quizzes.length} 문항
                            </span>
                          )}
                          {item.isPending ? (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                              ⏳ 분석 대기중
                            </span>
                          ) : item.userAnswers ? (() => {
                            const firstScore = item.firstAttemptScore 
                              ? `${item.firstAttemptScore.score} / ${item.firstAttemptScore.total}`
                              : `${item.quizzes.filter(q => item.userAnswers?.[q.id] === q.correctIndex).length} / ${item.quizzes.length}`;
                            
                            const retryStr = item.retryHistory && item.retryHistory.length > 0
                              ? `, 재시도: ` + item.retryHistory.map(r => `${r.score}/${r.total}`).join(', ')
                              : '';

                            return (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                ✅ 풀이 완료 ({firstScore}{retryStr})
                                {item.solvedAt && ` | 📅 ${new Date(item.solvedAt).toLocaleDateString()} ${new Date(item.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                              </span>
                            );
                          })() : (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                              📖 미풀이
                            </span>
                          )}
                          {item.ownerId && item.ownerId !== userId && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                              📥 {item.ownerId}님 공유
                            </span>
                          )}
                          {item.ownerId && item.ownerId === userId && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
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
                                border: '1px solid var(--secondary)',
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
                          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </h4>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                          {item.passageText}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartLesson(item);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >
                          {item.isPending ? "학습 개시" : item.userAnswers ? "📊 결과 분석" : "학습 개시"}
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
                            background: 'rgba(6, 182, 212, 0.1)',
                            color: 'var(--secondary)',
                            border: '1px solid rgba(6, 182, 212, 0.15)',
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
                    검색어와 일치하는 보관함 지문이 없습니다.
                  </div>
                )}
              </div>
            </main>
          </div>
        ) : (
          /* SECTION B: SPLIT PASSAGE & INTERACTIVE PANEL VIEW */
          <div style={{ padding: '1.5rem 0 3rem 0' }}>
            {activeLesson && (
              <ReadingSplitView
                lesson={activeLesson}
                onAddWrongAnswer={handleAddWrongAnswer}
                onQuizCompleted={handleQuizCompleted}
                onProgressUpdate={handleProgressUpdate}
                onOpenShare={() => setIsShareOpen(true)}
                onBackToCreator={!isSharedQuiz ? () => setViewMode('creator') : undefined}
                injectedQuizzes={injectedQuizzes}
                onGraduateReview={handleGraduateReview}
                apiKey={apiKey}
                onAddCustomVocabulary={handleAddCustomVocabulary}
              />
            )}
          </div>
        )
      )}

      {/* Review room Notebook */}
      {activeTab === 'review' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onClearAll={handleClearAllWrong}
          />
        </div>
      )}

      {/* Analytics progress chart */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '1.5rem 0 3rem 0' }}>
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        </div>
      )}

      {/* Base64 dynamic Share link popup modal */}
      {activeLesson && (
        <ShareModal
          lesson={activeLesson}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      {/* Smart Split Confirmation Modal */}
      {splitConfirm.show && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
            <h3 style={{ fontSize: '1.35rem', color: 'white', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              지문 분석 및 필터링 리포트
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              영어 문장(알파벳 5자 이상)과 한국어 설명/기타 텍스트를 분류하여 사전 검사를 수행했습니다.
            </p>

            {/* Stats Table / Card Grid */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem', 
              marginBottom: '1.5rem',
            }}>
              {/* Card Grid */}
              <div style={{
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                {/* Original */}
                <div
                  onClick={() => setReportExpand(prev => ({ original: !prev.original, remaining: false, filtered: false }))}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: reportExpand.original ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', border: reportExpand.original ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent' }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500' }}>📄 원본 텍스트</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                    {splitConfirm.originalSentences}문장
                  </span>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {splitConfirm.originalWords}단어
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reportExpand.original ? '▲ 접기' : '▼ 문장 보기'}</span>
                </div>

                {/* Remaining */}
                <div
                  onClick={() => setReportExpand(prev => ({ original: false, remaining: !prev.remaining, filtered: false }))}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: reportExpand.remaining ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.05)', borderRadius: '8px', border: reportExpand.remaining ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(6, 182, 212, 0.15)', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '600' }}>✅ 남은 영어 콘텐츠</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--secondary)' }}>
                    {splitConfirm.remainingSentences}문장
                  </span>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {splitConfirm.remainingWords}단어
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reportExpand.remaining ? '▲ 접기' : '▼ 문장 보기'}</span>
                </div>

                {/* Filtered */}
                <div
                  onClick={() => setReportExpand(prev => ({ original: false, remaining: false, filtered: !prev.filtered }))}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: reportExpand.filtered ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: reportExpand.filtered ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.15)', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'rgb(239, 68, 68)', fontWeight: '500' }}>🚫 필터링된 텍스트</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'rgb(239, 68, 68)' }}>
                    {splitConfirm.filteredSentences}문장
                  </span>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {splitConfirm.filteredWords}단어
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reportExpand.filtered ? '▲ 접기' : '▼ 문장 보기'}</span>
                </div>
              </div>

              {/* Expandable Sentence Lists */}
              {reportExpand.original && splitConfirm.sentences && splitConfirm.sentences.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: '600' }}>📄 원본 문장 목록 ({splitConfirm.sentences.length}개)</div>
                  {splitConfirm.sentences.map((sentence, i) => (
                    <div key={sentence.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontSize: '0.775rem', 
                      color: sentence.included ? 'var(--text-secondary)' : 'rgba(255,255,255,0.3)', 
                      padding: '0.4rem 0', 
                      borderBottom: '1px solid rgba(255,255,255,0.04)', 
                      lineHeight: '1.45',
                      textDecoration: sentence.included ? 'none' : 'line-through',
                      textDecorationColor: 'rgba(255,255,255,0.15)'
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem', fontSize: '0.7rem' }}>{i + 1}.</span>
                        {sentence.text}
                      </div>
                      <button 
                        onClick={() => toggleSentenceInReport(sentence.id)}
                        style={{ 
                          padding: '0.2rem 0.4rem', 
                          fontSize: '0.7rem', 
                          background: sentence.included ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)', 
                          color: sentence.included ? 'rgb(239, 68, 68)' : 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {sentence.included ? '제외' : '포함'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {reportExpand.remaining && splitConfirm.sentences && splitConfirm.sentences.filter(s => s.included).length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(6, 182, 212, 0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(6, 182, 212, 0.12)', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>✅ 남은 영어 문장 목록 ({splitConfirm.sentences.filter(s => s.included).length}개)</div>
                  {splitConfirm.sentences.filter(s => s.included).map((sentence, i) => (
                    <div key={sentence.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontSize: '0.775rem', 
                      color: 'var(--text-secondary)', 
                      padding: '0.4rem 0', 
                      borderBottom: '1px solid rgba(6, 182, 212, 0.06)', 
                      lineHeight: '1.45' 
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--secondary)', marginRight: '0.4rem', fontSize: '0.7rem', opacity: 0.7 }}>{i + 1}.</span>
                        {sentence.text}
                      </div>
                      <button 
                        onClick={() => toggleSentenceInReport(sentence.id)}
                        title="이 문장 제외하기"
                        style={{ 
                          padding: '0.2rem 0.4rem', 
                          fontSize: '0.7rem', 
                          background: 'rgba(239, 68, 68, 0.15)', 
                          color: 'rgb(239, 68, 68)', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        제외
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {reportExpand.filtered && splitConfirm.sentences && splitConfirm.sentences.filter(s => !s.included).length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(239, 68, 68, 0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.12)', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', color: 'rgb(239, 68, 68)', marginBottom: '0.5rem', fontWeight: '600' }}>🚫 필터링된 문장 목록 ({splitConfirm.sentences.filter(s => !s.included).length}개)</div>
                  {splitConfirm.sentences.filter(s => !s.included).map((sentence, i) => (
                    <div key={sentence.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontSize: '0.775rem', 
                      color: 'rgba(239, 68, 68, 0.7)', 
                      padding: '0.4rem 0', 
                      borderBottom: '1px solid rgba(239, 68, 68, 0.06)', 
                      lineHeight: '1.45'
                    }}>
                      <div style={{ flex: 1, textDecoration: 'line-through', textDecorationColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ color: 'rgb(239, 68, 68)', marginRight: '0.4rem', fontSize: '0.7rem', opacity: 0.7 }}>{i + 1}.</span>
                        {sentence.text}
                      </div>
                      <button 
                        onClick={() => toggleSentenceInReport(sentence.id)}
                        title="이 문장 포함하기"
                        style={{ 
                          padding: '0.2rem 0.4rem', 
                          fontSize: '0.7rem', 
                          background: 'rgba(6, 182, 212, 0.15)', 
                          color: 'var(--secondary)', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        복원
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {reportExpand.filtered && splitConfirm.filteredSentenceList.length === 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.12)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  필터링된 문장이 없습니다. 모든 문장이 영어 콘텐츠로 유효합니다. ✨
                </div>
              )}
            </div>

            {/* Split analogy/exceed message */}
            {splitConfirm.exceedsLimit ? (
              <div className="eli5-analogy-box" style={{ margin: '0 0 1.5rem 0', padding: '0.75rem 1rem', background: 'rgba(139, 92, 246, 0.05)', border: '1px dashed rgba(139, 92, 246, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: '1.5' }}>
                ⚠️ 설정된 분할 기준(<strong style={{ color: 'var(--primary)' }}>{sentenceLimit}문장</strong>)을 초과하는 방대한 지문입니다. 
                단원 분할 기능 사용을 적극 권장합니다. (보관함에 분할 생성됨)
              </div>
            ) : (
              <div className="eli5-analogy-box" style={{ margin: '0 0 1.5rem 0', padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.05)', border: '1px dashed rgba(6, 182, 212, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: '1.5' }}>
                ✅ 학습에 무리 없는 아담한 분량의 지문입니다. 바로 분석 및 학습을 시작할 수 있습니다.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {splitConfirm.exceedsLimit ? (
                <>
                  <button
                    onClick={() => executeAnalysis(splitConfirm.text, splitConfirm.title, true)}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem' }}
                  >
                    ✂️ {Math.ceil(splitConfirm.remainingSentences / sentenceLimit)}개 단원으로 분할하여 분석 시작
                  </button>
                  
                  <button
                    onClick={() => executeAnalysis(splitConfirm.text, splitConfirm.title, false)}
                    className="btn btn-accent"
                    style={{ width: '100%', padding: '0.85rem' }}
                  >
                    📖 분할 없이 전체 한 번에 즉시 분석 시작
                  </button>
                </>
              ) : (
                <button
                  onClick={() => executeAnalysis(splitConfirm.text, splitConfirm.title, false)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem' }}
                >
                  🚀 분석 및 학습 즉시 시작
                </button>
              )}
              
              <button
                onClick={() => setSplitConfirm(prev => ({ ...prev, show: false }))}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.85rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Cyber Loading Overlay */}
      {isLoading && (
        <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(5, 5, 10, 0.85)', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '2.5rem', background: 'var(--bg-secondary)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '20px', boxShadow: 'var(--shadow-glow)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div className="pulse-glow" style={{ width: '64px', height: '64px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--secondary)', animation: 'spin 4s linear infinite' }}>
              <Sparkles size={28} style={{ color: 'var(--secondary)' }} />
            </div>
            
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'white', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                AI 정밀 분석 및 출제 중
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Gemini AI가 영어 지문을 다각도로 분석하고<br />
                맞춤형 실전 퀴즈를 출제하는 중입니다.<br />
                <span style={{ color: 'var(--secondary)', fontWeight: '600' }}>약 10 ~ 15초 정도 소요됩니다.</span>
              </p>
            </div>
            
            {/* Loading dots */}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
              <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--secondary)', borderRadius: '50%' }}></span>
              <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
              <span className="pulse-glow" style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%' }}></span>
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}
