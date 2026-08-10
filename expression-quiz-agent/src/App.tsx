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

function formatDateTimeLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatDisplayDateTime(timestamp: number): string {
  if (!timestamp) return '기록 없음';
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getNextMinuteStartDateTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return formatDateTimeLocal(new Date(Date.now() - 24 * 60 * 60 * 1000));
  }
  // Ceiling to next minute boundary to prevent second/minute truncation overlap
  const nextMinuteMs = Math.ceil((timestamp + 1000) / 60000) * 60000;
  return formatDateTimeLocal(new Date(nextMinuteMs));
}

function getBrowserTimeZoneInfo(): string {
  try {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const offsetMin = -new Date().getTimezoneOffset();
    const offsetHours = offsetMin / 60;
    const sign = offsetHours >= 0 ? '+' : '';
    const formattedOffset = Number.isInteger(offsetHours) 
      ? `UTC${sign}${offsetHours}` 
      : `UTC${sign}${offsetHours.toFixed(1)}`;
    return `${tzName} (${formattedOffset})`;
  } catch (e) {
    return '브라우저 현지 시각';
  }
}

interface NormalizedReview {
  time: number;
  dateStr: string;
  remembered: boolean;
}

interface MochiReviewSession {
  id: string;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  totalCards: number;
  forgotCards: number;
}

function detectReviewSessions(allCards: any[], startBoundMs: number, endBoundMs: number): MochiReviewSession[] {
  const reviewItems: Array<{ time: number; card: any; remembered: boolean }> = [];

  allCards.forEach(card => {
    const reviews = extractMochiReviews(card);
    reviews.forEach(r => {
      if (r.time >= startBoundMs && r.time <= endBoundMs) {
        reviewItems.push({
          time: r.time,
          card,
          remembered: r.remembered
        });
      }
    });
  });

  if (reviewItems.length === 0) return [];

  // Sort chronologically by review time
  reviewItems.sort((a, b) => a.time - b.time);

  // Group into sessions if gap between consecutive reviews <= 45 minutes
  const MAX_GAP_MS = 45 * 60 * 1000;
  const sessions: MochiReviewSession[] = [];
  let currentGroup: typeof reviewItems = [reviewItems[0]];

  for (let i = 1; i < reviewItems.length; i++) {
    const prevTime = reviewItems[i - 1].time;
    const currTime = reviewItems[i].time;

    if (currTime - prevTime <= MAX_GAP_MS) {
      currentGroup.push(reviewItems[i]);
    } else {
      sessions.push(createSessionFromGroup(`session_${sessions.length + 1}`, currentGroup));
      currentGroup = [reviewItems[i]];
    }
  }

  if (currentGroup.length > 0) {
    sessions.push(createSessionFromGroup(`session_${sessions.length + 1}`, currentGroup));
  }

  // Sort sessions newest first
  sessions.sort((a, b) => b.endTime - a.endTime);
  return sessions;
}

function createSessionFromGroup(id: string, group: Array<{ time: number; card: any; remembered: boolean }>): MochiReviewSession {
  const startTime = group[0].time;
  const endTime = group[group.length - 1].time;
  const cardSet = new Set<string>();
  let forgotCount = 0;

  group.forEach(item => {
    cardSet.add(item.card.id);
    if (!item.remembered) forgotCount++;
  });

  return {
    id,
    startTime,
    endTime,
    startTimeStr: formatDisplayDateTime(startTime),
    endTimeStr: formatDisplayDateTime(endTime),
    totalCards: cardSet.size,
    forgotCards: forgotCount
  };
}

function extractMochiReviews(card: any): NormalizedReview[] {
  if (!card) return [];

  const result: NormalizedReview[] = [];
  const reviewsObj = card.reviews || card.history || card['review-history'] || card.reviewHistory;
  
  if (reviewsObj) {
    let entries: Array<[string, any]> = [];

    if (Array.isArray(reviewsObj)) {
      entries = reviewsObj.map((r, i) => [String(i), r]);
    } else if (typeof reviewsObj === 'object') {
      entries = Object.entries(reviewsObj);
    }

    for (const [key, val] of entries) {
      if (!val) continue;

      let rawDate: any = null;
      if (typeof val === 'object') {
        rawDate = val.date || val['reviewed-at'] || val.createdAt || val['created-at'] || val.time;
      } else if (typeof val === 'string' || typeof val === 'number') {
        rawDate = val;
      }

      // Check if key is a date string / timestamp if val didn't have explicit date
      if (!rawDate && key) {
        if (key.includes('-') || key.includes('T') || !isNaN(Number(key))) {
          rawDate = key;
        }
      }

      let timeMs = 0;
      let dateStr = '';

      if (typeof rawDate === 'number') {
        timeMs = rawDate < 1e11 ? rawDate * 1000 : rawDate;
      } else if (typeof rawDate === 'string') {
        dateStr = rawDate;
        if (!rawDate.includes('T') && rawDate.includes(' ')) {
          dateStr = rawDate.replace(' ', 'T');
        }
        timeMs = new Date(dateStr).getTime();
      } else if (rawDate && typeof rawDate === 'object') {
        const innerDate = rawDate.$date || rawDate.date || rawDate._seconds;
        if (typeof innerDate === 'number') {
          timeMs = innerDate < 1e11 ? innerDate * 1000 : innerDate;
        } else if (typeof innerDate === 'string') {
          dateStr = innerDate;
          timeMs = new Date(innerDate).getTime();
        }
      }

      if (isNaN(timeMs) || timeMs <= 0) continue;

      let remembered = true;
      if (typeof val === 'boolean') {
        remembered = val;
      } else if (val && typeof val === 'object') {
        if (val.remembered !== undefined) remembered = Boolean(val.remembered);
        else if (val['remembered?'] !== undefined) remembered = Boolean(val['remembered?']);
        else if (val.forgotten !== undefined) remembered = !Boolean(val.forgotten);
        else if (val['forgotten?'] !== undefined) remembered = !Boolean(val['forgotten?']);
        else if (typeof val.rating === 'number') remembered = val.rating > 1;
        else if (typeof val.grade === 'number') remembered = val.grade > 1;
      }

      result.push({
        time: timeMs,
        dateStr: dateStr || new Date(timeMs).toISOString(),
        remembered
      });
    }
  }

  // Integrate explicit last-reviewed-at timestamp from card level
  const lastReviewedRaw = card['last-reviewed-at'] || card.lastReviewedAt || card['last-reviewed'] || card.lastReviewed;
  if (lastReviewedRaw) {
    let tMs = 0;
    if (typeof lastReviewedRaw === 'number') {
      tMs = lastReviewedRaw < 1e11 ? lastReviewedRaw * 1000 : lastReviewedRaw;
    } else if (typeof lastReviewedRaw === 'string') {
      const dateStr = lastReviewedRaw.includes(' ') && !lastReviewedRaw.includes('T') ? lastReviewedRaw.replace(' ', 'T') : lastReviewedRaw;
      tMs = new Date(dateStr).getTime();
    } else if (typeof lastReviewedRaw === 'object') {
      const inner = lastReviewedRaw.$date || lastReviewedRaw.date;
      if (inner) tMs = new Date(inner).getTime();
    }

    if (!isNaN(tMs) && tMs > 0) {
      const maxExisting = result.length > 0 ? Math.max(...result.map(r => r.time)) : 0;
      if (tMs > maxExisting) {
        result.push({
          time: tMs,
          dateStr: formatDisplayDateTime(tMs),
          remembered: card.forgotten === true || card['forgotten?'] === true ? false : true
        });
      }
    }
  }

  return result;
}

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

  const [lastImportedReviewTime, setLastImportedReviewTime] = useState<number>(() => {
    const saved = localStorage.getItem('mochi_last_imported_time');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [selectedMochiStartDateTime, setSelectedMochiStartDateTime] = useState<string>(() => {
    const saved = localStorage.getItem('mochi_last_imported_time');
    const t = saved ? parseInt(saved, 10) : 0;
    return getNextMinuteStartDateTime(t);
  });

  const [selectedMochiEndDateTime, setSelectedMochiEndDateTime] = useState<string>(() => {
    return formatDateTimeLocal(new Date());
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
  const [excludeAlreadyImported, setExcludeAlreadyImported] = useState(true);
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

  // Time Range Slider States for Instant Real-Time Filtering
  const [rawFetchedMochiCards, setRawFetchedMochiCards] = useState<any[]>([]);
  const [sliderMinTime, setSliderMinTime] = useState<number>(0);
  const [sliderMaxTime, setSliderMaxTime] = useState<number>(0);
  const [sliderStartPercent, setSliderStartPercent] = useState<number>(0);
  const [sliderEndPercent, setSliderEndPercent] = useState<number>(100);

  // Smart Review Session Clusters State
  const [mochiSessions, setMochiSessions] = useState<MochiReviewSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleSelectSession = (session: MochiReviewSession) => {
    setActiveSessionId(session.id);
    const range = sliderMaxTime - sliderMinTime;
    if (range > 0) {
      const startPct = Math.max(0, Math.min(99, Math.floor(((session.startTime - 60000 - sliderMinTime) / range) * 100)));
      const endPct = Math.max(1, Math.min(100, Math.ceil(((session.endTime + 60000 - sliderMinTime) / range) * 100)));

      setSliderStartPercent(startPct);
      setSliderEndPercent(endPct);
      applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, startPct, endPct);
    }
  };

  const handleApplyTimePreset = (preset: 'last_import' | '1h' | '6h' | '24h' | '3d' | 'today' | '7d') => {
    const now = new Date();
    setSelectedMochiEndDateTime(formatDateTimeLocal(now));

    if (preset === 'last_import') {
      const saved = localStorage.getItem('mochi_last_imported_time');
      const t = saved ? parseInt(saved, 10) : 0;
      setSelectedMochiStartDateTime(getNextMinuteStartDateTime(t));
    } else if (preset === '1h') {
      setSelectedMochiStartDateTime(formatDateTimeLocal(new Date(now.getTime() - 1 * 60 * 60 * 1000)));
    } else if (preset === '6h') {
      setSelectedMochiStartDateTime(formatDateTimeLocal(new Date(now.getTime() - 6 * 60 * 60 * 1000)));
    } else if (preset === '24h') {
      setSelectedMochiStartDateTime(formatDateTimeLocal(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
    } else if (preset === '3d') {
      setSelectedMochiStartDateTime(formatDateTimeLocal(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)));
    } else if (preset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      setSelectedMochiStartDateTime(formatDateTimeLocal(todayStart));
    } else if (preset === '7d') {
      setSelectedMochiStartDateTime(formatDateTimeLocal(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
    }
  };

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

    const savedLast = localStorage.getItem('mochi_last_imported_time');
    const lastT = savedLast ? parseInt(savedLast, 10) : 0;
    setLastImportedReviewTime(lastT);
    setSelectedMochiStartDateTime(getNextMinuteStartDateTime(lastT));
    setSelectedMochiEndDateTime(formatDateTimeLocal(new Date()));
    
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

  const applySliderFilter = (
    cardsList: any[],
    minT: number,
    maxT: number,
    startPct: number,
    endPct: number,
    incorrectOnly = filterIncorrectOnly,
    pinnedInc = includePinned,
    newInc = includeNewToReview,
    excludeImp = excludeAlreadyImported
  ) => {
    if (!cardsList || cardsList.length === 0) {
      setMochiCards([]);
      setMochiTotalMatches(0);
      return;
    }

    const range = maxT - minT;
    const filterStartTime = range > 0 ? minT + (startPct / 100) * range : minT;
    const filterEndTime = range > 0 ? minT + (endPct / 100) * range : maxT;

    let reviewedInSlider = 0;
    let forgottenInSlider = 0;

    const isCardPinned = (card: any) => card.pinned === true || card['pinned?'] === true;

    const filtered = cardsList.filter(card => {
      const reviews = extractMochiReviews(card);
      const reviewsInSlider = reviews.filter(r => r.time >= filterStartTime && r.time <= filterEndTime);

      let cardMatchesPeriod = false;
      let cardForgetCountInSlider = 0;

      if (reviewsInSlider.length > 0) {
        cardMatchesPeriod = true;
        reviewedInSlider++;
        const failed = reviewsInSlider.filter(r => !r.remembered);
        if (failed.length > 0) {
          cardForgetCountInSlider = failed.length;
          forgottenInSlider++;
        }
      }

      card.mochiForgetCount = cardForgetCountInSlider;
      card.mochiReviewedInPeriod = cardMatchesPeriod;

      if (excludeImp && card.alreadyImported) return false;

      const matchesPeriod = cardMatchesPeriod && (!incorrectOnly || cardForgetCountInSlider > 0);
      const matchesPinned = pinnedInc && isCardPinned(card);
      const matchesNew = newInc && card.mochiNewToReviewInPeriod;

      return matchesPeriod || matchesPinned || matchesNew;
    });

    filtered.sort((a, b) => (b.mochiLatestReviewTime || 0) - (a.mochiLatestReviewTime || 0));

    setMochiTotalMatches(filtered.length);
    setMochiTotalReviewed(reviewedInSlider);
    setMochiTotalForgotten(forgottenInSlider);
    setMochiTotalPinnedCount(filtered.filter(isCardPinned).length);
    setMochiTotalNewToReviewCount(filtered.filter(c => c.mochiNewToReviewInPeriod).length);
    setMochiCards(filtered.slice(0, 300));
  };

  const handleSearchMochiCards = async () => {
    if (!mochiApiKey.trim()) return;

    const startLocalTime = new Date(selectedMochiStartDateTime).getTime();
    const endLocalTime = new Date(selectedMochiEndDateTime).getTime();

    if (startLocalTime > endLocalTime) {
      setMochiError("시작 일시는 종료 일시보다 이전이어야 합니다.");
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
      
      let globalMinTime = startLocalTime;
      let globalMaxTime = endLocalTime;

      allCards.forEach(card => {
        card.mochiForgetCount = 0;
        card.mochiTotalForgetCount = 0;
        card.mochiReviewedInPeriod = false;
        card.mochiLatestReviewTime = 0;
        card.mochiLatestReviewDateStr = '';

        const normalizedReviews = extractMochiReviews(card);
        if (normalizedReviews.length === 0) return;

        // Compute total overall forgets in entire history
        const allFailedReviews = normalizedReviews.filter(r => !r.remembered);
        card.mochiTotalForgetCount = allFailedReviews.length;

        // Track global min and max review times for slider bounds
        normalizedReviews.forEach(r => {
          if (r.time > 0) {
            if (r.time < globalMinTime) globalMinTime = r.time;
            if (r.time > globalMaxTime) globalMaxTime = r.time;
          }
        });

        // Compute overall latest review
        const sortedReviews = [...normalizedReviews].sort((a, b) => b.time - a.time);
        const overallLatestTime = sortedReviews[0].time;
        const overallLatestDateStr = formatDisplayDateTime(overallLatestTime);

        // Compute overall earliest review (first review ever)
        const sortedChronological = [...normalizedReviews].sort((a, b) => a.time - b.time);
        const overallEarliestTime = sortedChronological[0].time;

        card.mochiNewToReviewInPeriod = false;
        if (overallEarliestTime > 0) {
          card.mochiNewToReviewInPeriod = overallEarliestTime >= startLocalTime && overallEarliestTime <= endLocalTime;
        }

        const reviewsInPeriod = normalizedReviews.filter(r => r.time >= startLocalTime && r.time <= endLocalTime);
        if (reviewsInPeriod.length > 0) {
          card.mochiReviewedInPeriod = true;

          const failedInPeriod = reviewsInPeriod.filter(r => !r.remembered);
          if (failedInPeriod.length > 0) {
            card.mochiForgetCount = failedInPeriod.length;
          }

        card.mochiLatestReviewTime = overallLatestTime;
        card.mochiLatestReviewDateStr = formatDisplayDateTime(overallLatestTime);
        }

        card.alreadyImported = lessonsHistory.some(l => 
          l.id.startsWith('mochi_' + card.id) || 
          (card.content && l.sourceText && l.sourceText.trim() === card.content.trim())
        );

        // Fallback to overall latest review if not reviewed in the selected period (mainly for pinned cards)
        if (!card.mochiLatestReviewTime && overallLatestTime > 0) {
          card.mochiLatestReviewTime = overallLatestTime;
          card.mochiLatestReviewDateStr = `${overallLatestDateStr} (기간 외)`;
        }
      });

      // Set maximum 3-day backward margin prior to the chosen startLocalTime
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const fetchStartTime = startLocalTime - THREE_DAYS_MS;
      const sliderMin = fetchStartTime;
      const sliderMax = Math.max(endLocalTime, globalMaxTime);

      const range = sliderMax - sliderMin;
      const startPct = range > 0 ? Math.max(0, Math.min(99, Math.round(((startLocalTime - sliderMin) / range) * 100))) : 0;
      const endPct = 100;

      const detectedSessions = detectReviewSessions(allCards, fetchStartTime, sliderMax);
      setMochiSessions(detectedSessions);
      setActiveSessionId(null);

      setRawFetchedMochiCards(allCards);
      setSliderMinTime(sliderMin);
      setSliderMaxTime(sliderMax);
      setSliderStartPercent(startPct);
      setSliderEndPercent(endPct);

      applySliderFilter(allCards, sliderMin, sliderMax, startPct, endPct);

      const isCardPinned = (card: any) => card.pinned === true || card['pinned?'] === true;
      const initialFiltered = allCards.filter(card => {
        if (excludeAlreadyImported && card.alreadyImported) return false;
        const matchesPeriod = card.mochiReviewedInPeriod && (!filterIncorrectOnly || card.mochiForgetCount > 0);
        const matchesPinned = includePinned && isCardPinned(card);
        const matchesNewToReview = includeNewToReview && card.mochiNewToReviewInPeriod;
        return matchesPeriod || matchesPinned || matchesNewToReview;
      });

      if (initialFiltered.length === 0) {
        const periodStr = `${formatDisplayDateTime(startLocalTime)} ~ ${formatDisplayDateTime(endLocalTime)}`;
        const totalReviewedInAll = allCards.filter(c => c.mochiReviewedInPeriod).length;
        if (totalReviewedInAll > 0 && filterIncorrectOnly) {
          setMochiError(`${periodStr} 기간에 복습한 카드는 총 ${totalReviewedInAll}개 검색되었으나 모두 맞혀서 틀린(Forgot) 카드가 존재하지 않습니다. ('틀린 카드만 필터링' 체크 해제 또는 아래 타임 슬라이더를 조절해 보세요)`);
        } else {
          setMochiError(`${periodStr} 기간에 ${filterIncorrectOnly ? '복습 시 틀린(Forgot) ' : '복습을 진행한 '}카드가 존재하지 않습니다. ('7일 전' 버튼을 눌러 전체 카드를 조회한 후 타임 슬라이더로 조절해 보세요!)`);
        }
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
      let maxReviewTime = 0;

      for (let i = 0; i < selectedCardsList.length; i++) {
        const card = selectedCardsList[i];
        if (card.mochiLatestReviewTime && card.mochiLatestReviewTime > maxReviewTime) {
          maxReviewTime = card.mochiLatestReviewTime;
        }

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

      if (maxReviewTime > 0) {
        localStorage.setItem('mochi_last_imported_time', maxReviewTime.toString());
        setLastImportedReviewTime(maxReviewTime);
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
          <div className="modal-content" style={{ maxWidth: '920px', width: '94vw', maxHeight: '92vh', height: 'auto', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.35rem', borderRadius: '50%' }}
              onClick={() => setIsMochiModalOpen(false)}
            >
              <X size={18} />
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
                      {/* Timezone and Last Import indicator */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <span>🌐 시간 기준: <strong style={{ color: 'var(--secondary)' }}>{getBrowserTimeZoneInfo()}</strong> (브라우저 현지 시각)</span>
                        {lastImportedReviewTime > 0 && (
                          <span style={{ color: '#c084fc', fontWeight: '600' }}>
                            📌 마지막 카드 가져온 시각: <strong>{formatDisplayDateTime(lastImportedReviewTime)}</strong>
                          </span>
                        )}
                      </div>

                      {/* Quick Presets Bar */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>⚡ 빠른 시간 선택:</span>
                        {lastImportedReviewTime > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', fontWeight: '700' }}
                            onClick={() => handleApplyTimePreset('last_import')}
                            disabled={isMochiLoading}
                            title={`마지막으로 가져온 복습 시각(${formatDisplayDateTime(lastImportedReviewTime)}) 1분 후부터 자동 지정`}
                          >
                            📌 마지막 가져온 시각 이후
                          </button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('1h')} disabled={isMochiLoading}>1시간 전</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('6h')} disabled={isMochiLoading}>6시간 전</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('24h')} disabled={isMochiLoading}>24시간 전</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('3d')} disabled={isMochiLoading}>3일 전</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('today')} disabled={isMochiLoading}>오늘 00:00</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => handleApplyTimePreset('7d')} disabled={isMochiLoading}>7일 전</button>
                      </div>

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
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>시작 일시 (Start Time)</label>
                          <input
                            type="datetime-local"
                            value={selectedMochiStartDateTime}
                            onChange={(e) => setSelectedMochiStartDateTime(e.target.value)}
                            className="input-glow"
                            style={{ height: '40px', fontSize: '0.8rem' }}
                            disabled={isMochiLoading}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>종료 일시 (End Time)</label>
                          <input
                            type="datetime-local"
                            value={selectedMochiEndDateTime}
                            onChange={(e) => setSelectedMochiEndDateTime(e.target.value)}
                            className="input-glow"
                            style={{ height: '40px', fontSize: '0.8rem' }}
                            disabled={isMochiLoading}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSearchMochiCards}
                        disabled={isMochiLoading}
                        style={{ height: '42px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.9rem', marginTop: '0.25rem' }}
                      >
                        🔍 {isMochiLoading ? 'Mochi 카드 데이터 불러오는 중...' : '조건에 맞는 Mochi 카드 조회'}
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={filterIncorrectOnly}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFilterIncorrectOnly(val);
                              applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, sliderStartPercent, sliderEndPercent, val);
                            }}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>선택한 기간에 복습 시 틀린 카드(Forgot)만 필터링하여 표시</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={includePinned}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setIncludePinned(val);
                              applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, sliderStartPercent, sliderEndPercent, filterIncorrectOnly, val);
                            }}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>고정 카드(📌) 항상 포함 (선택 기간 무관)</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={includeNewToReview}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setIncludeNewToReview(val);
                              applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, sliderStartPercent, sliderEndPercent, filterIncorrectOnly, includePinned, val);
                            }}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>신규 복습 진입 카드(🌱) 포함 (선택 기간 내 첫 복습 진행)</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={excludeAlreadyImported}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setExcludeAlreadyImported(val);
                              applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, sliderStartPercent, sliderEndPercent, filterIncorrectOnly, includePinned, includeNewToReview, val);
                            }}
                            disabled={isMochiLoading}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>이미 보관함에 가져온 카드(✅) 검색 결과에서 자동 제외</span>
                        </label>
                      </div>

                      {/* Smart Review Session Clusters Bar */}
                      {mochiSessions.length > 0 && rawFetchedMochiCards.length > 0 && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                          marginTop: '0.4rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>⚡ 자동 감지된 복습 세션 ({mochiSessions.length}개)</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(139, 92, 246, 0.15)', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>AI 45분 세션 클러스터링</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>원하는 세션 버튼을 누르면 슬라이더와 카드 목록이 즉시 원클릭으로 지정됩니다.</span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {mochiSessions.map((session, idx) => {
                              const isSelected = activeSessionId === session.id;
                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSelectSession(session)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    background: isSelected ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))' : 'rgba(255, 255, 255, 0.04)',
                                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    color: isSelected ? 'white' : 'var(--text-secondary)',
                                    fontWeight: isSelected ? '700' : '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    transition: 'all 0.15s ease',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>🔥 세션 {mochiSessions.length - idx}</span>
                                  <span>{session.startTimeStr.split(' ')[1] || session.startTimeStr} ~ {session.endTimeStr.split(' ')[1] || session.endTimeStr}</span>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.85, background: 'rgba(0,0,0,0.25)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                    복습 {session.totalCards}개 {session.forgotCards > 0 && <strong style={{ color: '#f43f5e' }}>/ 오답 {session.forgotCards}개</strong>}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Interactive Time Range Slider */}
                      {sliderMaxTime > sliderMinTime && rawFetchedMochiCards.length > 0 && (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.12))',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '12px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          marginTop: '0.4rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', color: 'white' }}>
                              <span>🎛️ 실시간 타임 슬라이더 (선택 시각 기준 최대 3일 전 여유 탐색)</span>
                              <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>⚡ 0ms 즉시반영</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#c084fc', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                              🕒 {formatDisplayDateTime(sliderMinTime + (sliderStartPercent / 100) * (sliderMaxTime - sliderMinTime))} ~ {formatDisplayDateTime(sliderMinTime + (sliderEndPercent / 100) * (sliderMaxTime - sliderMinTime))}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span>시작 시각 슬라이더 ({sliderStartPercent}%)</span>
                                <span style={{ color: 'white', fontWeight: '600' }}>{formatDisplayDateTime(sliderMinTime + (sliderStartPercent / 100) * (sliderMaxTime - sliderMinTime))}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={Math.min(99, sliderEndPercent - 1)}
                                value={sliderStartPercent}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSliderStartPercent(val);
                                  applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, val, sliderEndPercent);
                                }}
                                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: '6px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span>종료 시각 슬라이더 ({sliderEndPercent}%)</span>
                                <span style={{ color: 'white', fontWeight: '600' }}>{formatDisplayDateTime(sliderMinTime + (sliderEndPercent / 100) * (sliderMaxTime - sliderMinTime))}</span>
                              </div>
                              <input
                                type="range"
                                min={Math.max(1, sliderStartPercent + 1)}
                                max={100}
                                value={sliderEndPercent}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSliderEndPercent(val);
                                  applySliderFilter(rawFetchedMochiCards, sliderMinTime, sliderMaxTime, sliderStartPercent, val);
                                }}
                                style={{ width: '100%', accentColor: 'var(--secondary)', cursor: 'pointer', height: '6px' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
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
                        <span>{formatDisplayDateTime(new Date(selectedMochiStartDateTime).getTime())} ~ {formatDisplayDateTime(new Date(selectedMochiEndDateTime).getTime())}</span>
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
                      maxHeight: !isMochiSearchExpanded ? '520px' : '360px', 
                      minHeight: '220px',
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
                                    {card.alreadyImported && <span style={{ marginRight: '0.35rem', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '600' }}>[보관함에 있음]</span>}
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
