import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CorrectionRoom } from './components/CorrectionRoom';
import { ReviewRoom } from './components/ReviewRoom';
import { Analytics } from './components/Analytics';
import { ShareModal } from './components/ShareModal';
import type { LabLesson, WrongLabAnswer, AppStats, LabQuizItem, LabMessage, ConversationSituation } from './types';
import { 
  PRESET_LESSONS, 
  generateCorrection, 
  deserializeLesson,
  generateAIPresentedSituation,
  generateChatPartnerResponse,
  generateConversationFeedback
} from './geminiService';
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
  saveCustomPersonasToCloud,
  loadCustomPersonasFromCloud
} from './firebaseService';
import { 
  Sparkles, Info, BookOpen, Trash2, Calendar, Edit2, Search, PlusCircle, Check,
  MessageSquare, Mic, MicOff
} from 'lucide-react';

interface PresetSituation extends ConversationSituation {
  id: string;
  category: 'roleplay' | 'debate' | 'meeting' | 'free';
}

const PRESET_SITUATIONS: PresetSituation[] = [
  {
    id: 'rp-hotel',
    category: 'roleplay',
    title: '호텔 체크인 (Hotel Check-in)',
    myRole: '호텔에 도착하여 예약 확인 및 체크인을 하려는 고객',
    partnerRole: '친절하고 격식 있는 호텔 프론트 데스크 직원',
    openingLine: 'Welcome to the Grand Hyatt Hotel. How can I assist you today?',
    goal: '예약 세부 정보를 말하고, 아침 식사 포함 여부를 확인하고, 방 열쇠 받기'
  },
  {
    id: 'rp-restaurant',
    category: 'roleplay',
    title: '식당에서 음식 주문 (Ordering Food)',
    myRole: '레스토랑에서 음식을 주문하고 특별 요구사항을 말하려는 손님',
    partnerRole: '주문을 받는 바쁘지만 친절한 웨이터',
    openingLine: 'Hello! Welcome to Bella Italia. Are you ready to order, or do you need a few more minutes?',
    goal: '주 메뉴를 주문하고, 알레르기/선호사항(예: 소스 따로)을 말하고, 음료 추천 받기'
  },
  {
    id: 'rp-airport',
    category: 'roleplay',
    title: '공항 탑승 수속 (Airport Check-in)',
    myRole: '비행기 탑승 수속을 하고 수하물을 부치려는 승객',
    partnerRole: '꼼꼼하게 서류와 수하물을 확인하는 공항 지상직 직원',
    openingLine: 'Good morning. May I please see your passport and booking reference?',
    goal: '여권 제시, 위탁 수하물 부치기, 창가/복도 좌석 요청하기'
  },
  {
    id: 'db-ai',
    category: 'debate',
    title: 'AI와 일자리 (AI and the Future of Work)',
    myRole: '인공지능 발전이 인간의 일자리를 위협하므로 규제가 필요하다고 주장하는 토론자',
    partnerRole: 'AI는 새로운 기회를 창출하며 규제보다 기술 활용 교육이 시급하다고 주장하는 반대 토론자',
    openingLine: 'I understand the concern about AI replacing workers, but I believe technology has always created more jobs than it destroyed. What do you think is the biggest threat AI poses?',
    goal: 'AI 규제의 필요성에 대해 근거를 들어 반박하고 설득하기'
  },
  {
    id: 'db-sns',
    category: 'debate',
    title: 'SNS의 사회적 영향 (Social Media Impact)',
    myRole: 'SNS가 청소년의 정신 건강과 사회에 부정적인 영향을 준다고 주장하는 토론자',
    partnerRole: 'SNS는 글로벌 연결성을 높이고 표현의 자유를 돕는 긍정적 도구라고 주장하는 토론자',
    openingLine: 'Social media allows people to connect globally and share ideas freely. Do you really think its negative impacts outweigh these benefits?',
    goal: 'SNS의 중독성 및 비교 심리 문제점을 지적하고 주장을 방어하기'
  },
  {
    id: 'mt-pitch',
    category: 'meeting',
    title: '신제품 투자 피칭 (Product Pitch)',
    myRole: '혁신적인 친환경 스타트업의 창업자이자 제품 발표자',
    partnerRole: '시장성, 수익성, 투자 회수율을 꼼꼼하게 따지는 깐깐한 벤처 캐피털(VC) 투자자',
    openingLine: 'Thank you for pitching to us today. Your green tech concept sounds interesting, but we have concerns about its scalability and production cost. Can you explain your business model?',
    goal: '제품의 독창성과 비용 절감 계획을 설명하고 투자 필요성을 피력하기'
  },
  {
    id: 'mt-review',
    category: 'meeting',
    title: '프로젝트 성과 검토 회의 (Project Review)',
    myRole: '최근 완료된 마케팅 캠페인의 프로젝트 매니저',
    partnerRole: '결과 데이터를 중요시하는 부서 총괄 임원(Director)',
    openingLine: 'Thanks for putting the report together. The campaign generated high traffic, but the conversion rate was below our target. How do you plan to address this?',
    goal: '성과가 타겟 미달한 구체적인 원인 분석을 보고하고 개선 방안을 제시하기'
  },
  {
    id: 'fr-weekend',
    category: 'free',
    title: '주말 계획 대화 (Weekend Plans)',
    myRole: '동료에게 친근하게 주말 계획을 이야기하는 친구',
    partnerRole: '활발하고 질문이 많은 대화적인 원어민 친구',
    openingLine: 'Hey there! Finally, it is Friday. Do you have any fun plans for this weekend?',
    goal: '자신의 주말 계획을 편하게 이야기하고 상대방에게 질문을 던지며 대화 이어나가기'
  }
];

export default function App() {
  // 1. Core API & ID Config States
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('lab_gemini_api_key') || '';
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('lab_user_id') || '';
  });

  // 2. Tab Navigation & Loading States
  const [activeTab, setActiveTab] = useState<string>('learn');
  const [activeLesson, setActiveLesson] = useState<LabLesson | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // 3. User Input States
  const [inputText, setInputText] = useState('');
  const [contextText, setContextText] = useState('');
  const [customPersonas, setCustomPersonas] = useState<string[]>(() => {
    const saved = localStorage.getItem('lab_custom_personas');
    return saved ? JSON.parse(saved) : [];
  });
  const [personaType, setPersonaType] = useState<string>(() => {
    return localStorage.getItem('last_lab_persona') || '40대 엔지니어 직장인';
  });
  const [customPersona, setCustomPersona] = useState('');
  const [writingStyle, setWritingStyle] = useState<'spoken' | 'written'>(() => {
    return (localStorage.getItem('last_lab_style') as 'spoken' | 'written') || 'written';
  });
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const saved = localStorage.getItem('last_lab_question_count');
    return saved ? Number(saved) : 5;
  });
  const [formError, setFormError] = useState<string | null>(null);

  // 4. History Log Library
  const [lessonsHistory, setLessonsHistory] = useState<LabLesson[]>(() => {
    const saved = localStorage.getItem('lab_lessons_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unsolved' | 'solved' | 'correction'>('all');
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('lab_user_email') || '';
  });

  const handleSaveUserEmail = (email: string) => {
    setUserEmail(email);
    localStorage.setItem('lab_user_email', email);
  };

  // 5. Spaced Repetition Notebook Databases
  const [wrongAnswers, setWrongAnswers] = useState<WrongLabAnswer[]>(() => {
    const saved = localStorage.getItem('lab_agent_wrong_answers');
    return saved ? JSON.parse(saved) : [];
  });

  // 6. Streak & Accuracy Analytics State
  const [stats, setStats] = useState<AppStats>(() => {
    const saved = localStorage.getItem('lab_agent_stats');
    if (saved) return JSON.parse(saved);
    return {
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
      masteredCount: 0
    };
  });

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // 6b. Conversation Mode States
  const [labMode, setLabMode] = useState<'correction' | 'conversation'>('correction');
  const [convType, setConvType] = useState<'roleplay' | 'debate' | 'meeting' | 'free'>('roleplay');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('rp-hotel');
  const [ideationInput, setIdeationInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [activeSituation, setActiveSituation] = useState<ConversationSituation | null>(null);
  const [chatMessages, setChatMessages] = useState<LabMessage[]>([]);
  const [isChattingActive, setIsChattingActive] = useState<boolean>(false);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [chatInputValue, setChatInputValue] = useState('');
  const [customSituationDesigned, setCustomSituationDesigned] = useState<boolean>(false);
  const [isDesigningSituation, setIsDesigningSituation] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);

  // Clean up Speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (isChattingActive && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading, isChattingActive]);

  // Synchronize preset selection when category changes
  useEffect(() => {
    const filtered = PRESET_SITUATIONS.filter(p => p.category === convType);
    if (filtered.length > 0) {
      setSelectedPresetId(filtered[0].id);
      setActiveSituation({
        title: filtered[0].title,
        myRole: filtered[0].myRole,
        partnerRole: filtered[0].partnerRole,
        openingLine: filtered[0].openingLine,
        goal: filtered[0].goal
      });
      setCustomSituationDesigned(false);
    } else {
      setSelectedPresetId('custom');
      setActiveSituation(null);
      setCustomSituationDesigned(false);
    }
  }, [convType]);

  // Speech Synthesis (TTS) Reader
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google')) ||
                        voices.find(v => v.lang.startsWith('en-') && v.name.includes('Natural')) ||
                        voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (STT) Toggle
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저에서는 음성 인식(STT)을 지원하지 않습니다. 크롬 브라우저를 사용해 주세요.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!recognitionRef.current) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setChatInputValue(prev => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + finalTranscript;
          });
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Start speech recognition error", e);
      setIsListening(false);
    }
  };

  // Design Custom Situation using AI
  const handleDesignCustomSituation = async () => {
    setFormError(null);
    const input = ideationInput.trim();
    if (!input) {
      setFormError("브레인스토밍할 주제나 상황 맥락을 입력해 주세요.");
      return;
    }
    if (!apiKey) {
      setFormError("우측 상단 설정(⚙️) 아이콘을 눌러 Gemini API Key를 먼저 입력해 주세요.");
      return;
    }

    setIsDesigningSituation(true);
    try {
      const situation = await generateAIPresentedSituation(input, convType, apiKey);
      setActiveSituation(situation);
      setCustomSituationDesigned(true);
    } catch (err: any) {
      setFormError(err.message || "커스텀 상황을 생성하는 도중 오류가 발생했습니다.");
    } finally {
      setIsDesigningSituation(false);
    }
  };

  // Start Conversation Chat Session
  const handleStartConversation = async () => {
    setFormError(null);
    if (!apiKey) {
      setFormError("우측 상단 설정(⚙️) 아이콘을 눌러 Gemini API Key를 먼저 입력하셔야 대화 연습이 가능합니다!");
      return;
    }

    let situation: ConversationSituation | null = null;

    if (selectedPresetId === 'custom') {
      if (!customSituationDesigned || !activeSituation) {
        setFormError("AI 상황 추천받기 버튼을 눌러 먼저 대화 상황을 생성해 주세요.");
        return;
      }
      situation = activeSituation;
    } else {
      const preset = PRESET_SITUATIONS.find(p => p.id === selectedPresetId);
      if (!preset) {
        setFormError("선택된 프리셋 상황이 올바르지 않습니다.");
        return;
      }
      situation = {
        title: preset.title,
        myRole: preset.myRole,
        partnerRole: preset.partnerRole,
        openingLine: preset.openingLine,
        goal: preset.goal
      };
      setActiveSituation(situation);
    }

    setIsChattingActive(true);
    setChatInputValue('');
    
    // Create the AI's opening message
    const openingMessage: LabMessage = {
      id: `msg-${Date.now()}-ai-opening`,
      sender: 'ai',
      text: situation.openingLine,
      createdAt: Date.now()
    };
    setChatMessages([openingMessage]);

    // Speak the opening line if voice mode is enabled
    if (voiceEnabled) {
      setTimeout(() => {
        speakText(situation!.openingLine);
      }, 300);
    }
  };

  // Send active chat message to partner
  const handleSendConversationMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInputValue.trim();
    if (!text || isChatLoading) return;

    // Stop listening if mic is active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage: LabMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: text,
      createdAt: Date.now()
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInputValue('');
    setIsChatLoading(true);

    try {
      const chosenPersona = personaType === 'custom' ? customPersona.trim() : personaType;
      const response = await generateChatPartnerResponse(
        newMessages,
        activeSituation!,
        chosenPersona || "일반 원어민 튜터",
        apiKey
      );

      const aiMessage: LabMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: response,
        createdAt: Date.now()
      };

      setChatMessages(prev => [...prev, aiMessage]);

      if (voiceEnabled) {
        speakText(response);
      }
    } catch (err: any) {
      alert("AI 상대방의 답변을 가져오는 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsChatLoading(false);
    }
  };

  // End active conversation and generate feedback lesson
  const handleEndConversationSession = async () => {
    const userMsgCount = chatMessages.filter(m => m.sender === 'user').length;
    if (userMsgCount === 0) {
      if (!window.confirm("아직 한 번도 발화하지 않으셨습니다. 대화방을 그냥 종료하시겠습니까?")) {
        return;
      }
      setIsChattingActive(false);
      setChatMessages([]);
      setActiveSituation(null);
      setCustomSituationDesigned(false);
      return;
    }

    if (!window.confirm("대화를 종료하고 AI 종합 첨삭 피드백 및 퀴즈를 생성하시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const chosenPersona = personaType === 'custom' ? customPersona.trim() : personaType;
      const result = await generateConversationFeedback(
        chatMessages,
        activeSituation!,
        chosenPersona || "일반 원어민 튜터",
        questionCount,
        apiKey
      );

      setActiveLesson(result);
      saveLessonToHistory(result);

      setIsChattingActive(false);
      setChatMessages([]);
      setActiveSituation(null);
      setCustomSituationDesigned(false);
      setIdeationInput('');
    } catch (err: any) {
      alert("대화 결과 분석 도중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Persist Local Data and Back up to Firestore if Cloud User ID is configured
  useEffect(() => {
    localStorage.setItem('lab_agent_wrong_answers', JSON.stringify(wrongAnswers));
    if (userId) {
      saveWrongAnswersToCloud(userId, wrongAnswers);
    }
  }, [wrongAnswers, userId]);

  useEffect(() => {
    localStorage.setItem('lab_agent_stats', JSON.stringify(stats));
    if (userId) {
      saveStatsToCloud(userId, stats);
    }
  }, [stats, userId]);

  // Synchronize Cloud & Local History Data
  useEffect(() => {
    if (!userId) {
      setSyncStatus('idle');
      return;
    }
    
    let isMounted = true;
    setSyncStatus('syncing');
    
    const localSaved = localStorage.getItem('lab_lessons_history');
    const localList: LabLesson[] = localSaved ? JSON.parse(localSaved) : [];
    
    // Sync Lesson Logs list
    syncUserLessons(userId, localList).then((syncedList) => {
      if (isMounted) {
        setLessonsHistory(syncedList);
        localStorage.setItem('lab_lessons_history', JSON.stringify(syncedList));
        setSyncStatus('synced');
      }
    }).catch((err: any) => {
      if (isMounted) {
        console.error("Auto sync lessons failed:", err);
        setSyncStatus('error');
      }
    });

    // Sync Stats
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

    // Sync Wrong answers mistakes review list
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
    
    // Sync presets progress in parallel
    loadPresetsProgressFromCloud(userId).then((cloudPresetsProgress) => {
      if (isMounted) {
        const localSaved = localStorage.getItem('lab_presets_progress');
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
          localStorage.setItem('lab_presets_progress', JSON.stringify(mergedPresetsProgress));
          savePresetsProgressToCloud(userId, mergedPresetsProgress);
        }
      }
    }).catch(err => console.error("Cloud presets progress load failed:", err));
    
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Persist last selected options
  useEffect(() => {
    localStorage.setItem('last_lab_persona', personaType);
  }, [personaType]);

  useEffect(() => {
    localStorage.setItem('last_lab_style', writingStyle);
  }, [writingStyle]);

  useEffect(() => {
    localStorage.setItem('last_lab_question_count', String(questionCount));
  }, [questionCount]);

  // Synchronize Custom Personas with Cloud
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    loadCustomPersonasFromCloud(userId).then((cloudPersonas) => {
      if (cloudPersonas && isMounted) {
        setCustomPersonas(prev => {
          const merged = Array.from(new Set([...prev, ...cloudPersonas]));
          localStorage.setItem('lab_custom_personas', JSON.stringify(merged));
          if (merged.length > cloudPersonas.length) {
            saveCustomPersonasToCloud(userId, merged);
          }
          return merged;
        });
      }
    }).catch(err => console.error("Cloud custom personas load failed:", err));
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Daily Streak Incrementor Logic
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
            newStreak += 1;
          } else if (diffDays > 1) {
            newStreak = 1;
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
  }, [stats.lastActiveDate]);

  // 8. Process URL Share Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    const cloudDocId = params.get('cloudShare');
    
    if (sharePayload) {
      deserializeLesson(sharePayload).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setActiveTab('learn');
          saveLessonToHistory(decodedLesson);
        }
      });
    } else if (cloudDocId) {
      setIsLoading(true);
      loadLessonFromCloud(cloudDocId).then((decodedLesson) => {
        if (decodedLesson) {
          setActiveLesson(decodedLesson);
          setActiveTab('learn');
          
          const currentUserId = localStorage.getItem('lab_user_id') || null;
          let sharedLessonWithUser = { ...decodedLesson };
          if (currentUserId) {
            sharedLessonWithUser.sharedWith = [...(decodedLesson.sharedWith || [])];
            if (!sharedLessonWithUser.sharedWith.includes(currentUserId) && decodedLesson.ownerId !== currentUserId) {
              sharedLessonWithUser.sharedWith.push(currentUserId);
            }
          }
          saveLessonToHistory(sharedLessonWithUser);
        }
      }).catch((err: any) => {
        console.error("Firestore shared lesson loading failed:", err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, []);

  const saveLessonToHistory = async (lesson: LabLesson) => {
    if (!lesson || lesson.id.startsWith('preset-')) return;
    
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
        setSyncStatus('synced');
      } catch (err: any) {
        console.error("Failed to upload lesson to cloud on save:", err);
        setSyncStatus('error');
      }
    }
    
    setLessonsHistory(prev => {
      const filtered = prev.filter(item => item.id !== updatedLesson.id && item.title !== updatedLesson.title);
      const updated = [updatedLesson, ...filtered];
      localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('lab_gemini_api_key', key);
  };

  const handleSaveUserId = (newId: string) => {
    setUserId(newId);
    localStorage.setItem('lab_user_id', newId);
  };

  // AI Correction trigger
  const handleGenerateCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const text = inputText.trim();
    if (!text) {
      setFormError("교정할 영문 텍스트를 입력해 주세요.");
      return;
    }

    if (!apiKey) {
      setFormError("우측 상단 설정(⚙️) 아이콘을 눌러 Gemini API Key를 먼저 입력하시거나, 우측의 프리셋 자료를 선택해 체험해 보세요!");
      return;
    }

    setIsLoading(true);
    const chosenPersona = personaType === 'custom' ? customPersona.trim() : personaType;
    
    if (personaType === 'custom' && customPersona.trim()) {
      const newCustom = customPersona.trim();
      if (!customPersonas.includes(newCustom)) {
        const updated = [...customPersonas, newCustom];
        setCustomPersonas(updated);
        localStorage.setItem('lab_custom_personas', JSON.stringify(updated));
        if (userId) {
          saveCustomPersonasToCloud(userId, updated);
        }
      }
      setPersonaType(newCustom);
    }
    
    try {
      const result = await generateCorrection(
        text,
        chosenPersona || "일반 원어민 튜터",
        writingStyle,
        contextText.trim(),
        questionCount,
        apiKey
      );
      
      setActiveLesson(result);
      setInputText('');
      setContextText('');
      setCustomPersona('');
      saveLessonToHistory(result);
    } catch (err: any) {
      setFormError(err.message || "첨삭 세트를 생성하는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadPreset = (preset: LabLesson) => {
    // Check local storage progress for this preset
    const savedProgress = localStorage.getItem('lab_presets_progress');
    const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
    const progress = presetsProgress[preset.id];
    
    let presetWithProgress = { ...preset };
    if (progress) {
      const userAnswers = progress.userAnswers !== undefined ? progress.userAnswers : undefined;
      presetWithProgress = { 
        ...preset, 
        userAnswers,
        solvedAt: progress.solvedAt,
        firstAttemptScore: progress.firstAttemptScore,
        retryHistory: progress.retryHistory,
        chatHistory: progress.chatHistory,
        correctedText: progress.correctedText || preset.correctedText,
        overallFeedback: progress.overallFeedback || preset.overallFeedback,
        corrections: progress.corrections || preset.corrections
      };
    }
    
    setActiveLesson(presetWithProgress);
  };

  const handleDeleteHistory = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (window.confirm("이 학습 세트를 보관함에서 완전히 삭제하시겠습니까?")) {
      setLessonsHistory(prev => {
        const updated = prev.filter(item => item.id !== lessonId);
        localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
        return updated;
      });
      
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

  const handleStartRename = (e: React.MouseEvent, lesson: LabLesson) => {
    e.stopPropagation();
    setEditingTitleId(lesson.id);
    setEditingTitleText(lesson.title);
  };

  const handleSaveRename = async (e: React.FormEvent, lessonId: string) => {
    e.preventDefault();
    if (!editingTitleText.trim()) return;

    if (activeLesson && activeLesson.id === lessonId) {
      setActiveLesson(prev => prev ? { ...prev, title: editingTitleText.trim() } : null);
    }

    let updatedLesson: LabLesson | null = null;
    setLessonsHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === lessonId) {
          updatedLesson = { ...item, title: editingTitleText.trim() };
          return updatedLesson;
        }
        return item;
      });
      localStorage.setItem('lab_lessons_history', JSON.stringify(updated));
      return updated;
    });

    setEditingTitleId(null);

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

  // 9. Interactive Quiz callbacks
  const handleAddWrongAnswer = (quizItem: LabQuizItem, selectedAnswerIndex: number) => {
    if (!activeLesson) return;

    setWrongAnswers(prev => {
      if (prev.some(wa => wa.quizItem.id === quizItem.id || wa.quizItem.question === quizItem.question)) {
        return prev;
      }
      const newWrong: WrongLabAnswer = {
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
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  const handleRemoveWrongAnswer = (wrongId: string) => {
    setWrongAnswers(prev => prev.filter(wa => wa.id !== wrongId));
    setStats(prev => ({
      ...prev,
      masteredCount: prev.masteredCount + 1
    }));
  };

  const handleClearAllWrong = () => {
    if (window.confirm("오답 노트의 모든 문항을 완전히 비우시겠습니까?")) {
      setWrongAnswers([]);
    }
  };

  const handleQuizCompleted = (correctCount: number, totalCount: number, wrongQuestionsList?: any[], userAnswers?: Record<string, number>, isRetry?: boolean) => {
    const list = wrongQuestionsList || [];

    if (totalCount > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          totalQuizzesTaken: prev.totalQuizzesTaken + totalCount,
          totalCorrectAnswers: prev.totalCorrectAnswers + correctCount
        };

        if (userId && activeLesson) {
          const loggedTitle = isRetry ? `🔄 [재시험] ${activeLesson.title}` : activeLesson.title;
          
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
            alert(`🧪 [LAB.AGENT 리포트 알림]\n\n실전 퀴즈 결과가 클라우드에 연동되었습니다.\n📧 ${resolvedEmail} 메일로 분석 리포트(정답/오답 해설 및 종합 점수)가 발송 대기열에 들어갔습니다!`);
          }, 500);
        }

        return newStats;
      });
    }

    if (activeLesson) {
      let updatedLesson: LabLesson;
      if (totalCount === 0) {
        updatedLesson = {
          ...activeLesson,
          userAnswers: undefined,
          firstAttemptScore: undefined,
          retryHistory: undefined,
          solvedAt: undefined
        };
      } else if (isRetry) {
        const history = activeLesson.retryHistory || [];
        updatedLesson = {
          ...activeLesson,
          userAnswers,
          solvedAt: Date.now(),
          retryHistory: [...history, { score: correctCount, total: totalCount, solvedAt: Date.now() }]
        };
      } else {
        updatedLesson = {
          ...activeLesson,
          userAnswers,
          solvedAt: Date.now(),
          firstAttemptScore: { score: correctCount, total: totalCount }
        };
      }

      // If it's a preset lesson, save preset progress to local storage
      if (activeLesson.id.startsWith('preset-')) {
        const savedProgress = localStorage.getItem('lab_presets_progress');
        const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
        presetsProgress[activeLesson.id] = {
          userAnswers: updatedLesson.userAnswers,
          solvedAt: updatedLesson.solvedAt,
          firstAttemptScore: updatedLesson.firstAttemptScore,
          retryHistory: updatedLesson.retryHistory
        };
        localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
        if (userId) {
          savePresetsProgressToCloud(userId, presetsProgress);
        }
      } else {
        saveLessonToHistory(updatedLesson);
      }

      setActiveLesson(updatedLesson);
    }
  };

  const handleProgressUpdate = (userAnswers: Record<string, number>) => {
    if (!activeLesson) return;

    const updatedLesson = {
      ...activeLesson,
      userAnswers
    };

    if (activeLesson.id.startsWith('preset-')) {
      const savedProgress = localStorage.getItem('lab_presets_progress');
      const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
      presetsProgress[activeLesson.id] = {
        ...(presetsProgress[activeLesson.id] || {}),
        userAnswers,
        solvedAt: Date.now()
      };
      localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
      if (userId) {
        savePresetsProgressToCloud(userId, presetsProgress);
      }
    } else {
      saveLessonToHistory(updatedLesson);
    }

    setActiveLesson(updatedLesson);
  };

  const handleLessonUpdate = (updatedLesson: LabLesson) => {
    if (updatedLesson.id.startsWith('preset-')) {
      const savedProgress = localStorage.getItem('lab_presets_progress');
      const presetsProgress = savedProgress ? JSON.parse(savedProgress) : {};
      presetsProgress[updatedLesson.id] = {
        ...(presetsProgress[updatedLesson.id] || {}),
        userAnswers: updatedLesson.userAnswers,
        solvedAt: updatedLesson.solvedAt,
        firstAttemptScore: updatedLesson.firstAttemptScore,
        retryHistory: updatedLesson.retryHistory,
        chatHistory: updatedLesson.chatHistory,
        correctedText: updatedLesson.correctedText,
        overallFeedback: updatedLesson.overallFeedback,
        corrections: updatedLesson.corrections
      };
      localStorage.setItem('lab_presets_progress', JSON.stringify(presetsProgress));
      if (userId) {
        savePresetsProgressToCloud(userId, presetsProgress);
      }
    } else {
      saveLessonToHistory(updatedLesson);
    }
    setActiveLesson(updatedLesson);
  };


  // Inject current/past wrong answers into study session for spaced repetition
  const injectedQuizzes = (() => {
    if (!activeLesson) return [];
    let list = [...(activeLesson.quizzes || [])];

    if (wrongAnswers.length > 0) {
      const oldestMistakes = [...wrongAnswers]
        .filter(wa => {
          if (wa.lessonId.startsWith('preset-')) {
            return wa.lessonId === activeLesson.id;
          }
          return !activeLesson.id.startsWith('preset-');
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 2)
        .map((wa) => {
          const isSameLesson = wa.lessonId === activeLesson.id || wa.lessonTitle === activeLesson.title;
          const label = isSameLesson 
            ? `🔄 [오답 복습] ` 
            : `🔄 [이전 학습 오답] (출처: ${wa.lessonTitle}) `;
          return {
            ...wa.quizItem,
            id: wa.id,
            isReview: true,
            question: `${label}\n\n${wa.quizItem.question}`
          };
        });
      list = [...list, ...oldestMistakes];
    }
    return list;
  })();

  const filteredHistory = lessonsHistory.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lesson.sourceText.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const hasQuiz = (lesson.quizzes || []).length > 0;
    const isSolved = lesson.userAnswers !== undefined;

    if (filterMode === 'solved') {
      return isSolved;
    }
    if (filterMode === 'unsolved') {
      return !isSolved && hasQuiz;
    }
    if (filterMode === 'correction') {
      return !hasQuiz;
    }
    return true;
  });

  const solvedCount = lessonsHistory.filter(l => l.userAnswers !== undefined).length;
  const unsolvedCount = lessonsHistory.filter(l => !l.userAnswers && (l.quizzes || []).length > 0).length;
  const correctionCount = lessonsHistory.filter(l => !(l.quizzes || []).length).length;

  return (
    <div className="app-container">
      <Header
        stats={stats}
        wrongAnswersCount={wrongAnswers.length}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'learn') {
            setActiveLesson(null);
          }
        }}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        userId={userId}
        onSaveUserId={handleSaveUserId}
        userEmail={userEmail}
        onSaveUserEmail={handleSaveUserEmail}
      />

      <main style={{ padding: '1.5rem 0' }}>
        {isLoading && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-panel text-center" style={{ padding: '2.5rem 2rem', background: 'var(--bg-secondary)', borderRadius: '16px' }}>
              <div className="pulse-glow" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                <Sparkles className="streak-fire" style={{ color: 'var(--primary)' }} />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>영작 심층 교정 중</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Gemini AI가 문장 구조, 어조, 시제 및 문맥을 정밀 분석하고 있습니다...
              </p>
            </div>
          </div>
        )}

        {/* Tab 1: Learn & Correction Room */}
        {activeTab === 'learn' && (
          activeLesson ? (
            /* Active correction analysis & practice room */
            <div className="animate-fade-in">
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveLesson(null)}
                >
                  ◀ 새로운 영작 첨삭하기
                </button>
                
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}
                  onClick={() => setIsShareOpen(true)}
                >
                  🔗 학습 세트 공유
                </button>
              </div>

              <CorrectionRoom
                lesson={{
                  ...activeLesson,
                  quizzes: injectedQuizzes
                }}
                apiKey={apiKey}
                onAddWrongAnswer={handleAddWrongAnswer}
                onQuizCompleted={handleQuizCompleted}
                onProgressUpdate={handleProgressUpdate}
                onGraduateReview={handleGraduateReview}
                onLessonUpdate={handleLessonUpdate}
                onClose={() => setActiveLesson(null)}
              />

              <ShareModal
                lesson={activeLesson}
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
              />
            </div>
          ) : (
            /* Dashboard home screen */
            <div className="dashboard-grid animate-fade-in">
              {/* Left Column: Input or Settings Panel */}
              <div className="sidebar-panel glass-panel">
                {/* Mode Selector (Hidden during active chat session) */}
                {!isChattingActive && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${labMode === 'correction' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px' }}
                      onClick={() => setLabMode('correction')}
                    >
                      📝 에세이 첨삭
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${labMode === 'conversation' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px' }}
                      onClick={() => setLabMode('conversation')}
                    >
                      🗣️ 대화형 회화
                    </button>
                  </div>
                )}

                {isChattingActive ? (
                  /* Active Chat Left Panel: Active Situation Status */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <span className="badge" style={{ background: 'var(--secondary)', color: 'white', marginBottom: '0.4rem' }}>
                        {convType === 'roleplay' ? '🏨 롤플레잉' : convType === 'debate' ? '⚖️ 토론 연습' : convType === 'meeting' ? '💼 회의 상황' : '💬 자유 대화'}
                      </span>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white', marginTop: '0.2rem' }}>
                        대화 연습 진행 중
                      </h3>
                    </div>

                    {activeSituation && (
                      <div className="eli5-analogy-box" style={{ background: 'rgba(6, 182, 212, 0.03)', borderLeftColor: 'var(--secondary)', padding: '1rem', borderRadius: '0 8px 8px 0', margin: 0 }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.6rem' }}>
                          🎯 {activeSituation.title}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <p style={{ margin: 0 }}>
                            <strong>내 역할:</strong> {activeSituation.myRole}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>상대방 역할:</strong> {activeSituation.partnerRole}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>학습 목표:</strong> {activeSituation.goal}
                          </p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="active-voice-checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="active-voice-checkbox" style={{ fontSize: '0.775rem', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        🔊 AI 답변 음성 읽기 (TTS 활성화)
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.85rem' }}
                        onClick={handleEndConversationSession}
                      >
                        🔴 대화 종료 및 첨삭 받기
                      </button>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                        대화를 종료하면 본인이 대화창에 발화한 문장에 대해 AI 정밀 첨삭과 문법 퀴즈가 생성됩니다.
                      </p>
                    </div>
                  </div>
                ) : labMode === 'correction' ? (
                  /* Original Correction Mode Sidebar Form */
                  <>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white' }}>
                        <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                        AI 영어 연구실 (LAB.AGENT)
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        작성하신 영어 에세이나 어색한 회화 표현을 분석해 원어민 뉘앙스와 완벽한 문법으로 첨삭해 드립니다.
                      </p>
                    </div>

                    <form onSubmit={handleGenerateCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>교정할 영어 문장 / 에세이</label>
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="여기에 직접 쓴 영작 문장이나 에세이를 입력하세요.&#10;예시: I goes to office yesterday. My manager check code..."
                          className="textarea-glow"
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>상황 맥락 (Context - 선택)</label>
                        <input
                          type="text"
                          value={contextText}
                          onChange={(e) => setContextText(e.target.value)}
                          placeholder="예: 회사 매니저에게 현황을 보고하는 업무용 이메일"
                          className="input-glow"
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>작성자 페르소나 (Persona)</label>
                        <select
                          value={personaType}
                          onChange={(e) => setPersonaType(e.target.value)}
                          className="input-glow select-glow"
                          disabled={isLoading}
                          style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                        >
                          <option value="40대 엔지니어 직장인">40대 엔지니어 직장인</option>
                          <option value="미국 중학생 청소년">미국 중학생 청소년</option>
                          <option value="40대 일상 / 학부모 / 관공서/가게 등..">40대 일상 / 학부모 / 관공서/가게 등..</option>
                          {customPersonas.map((cp) => (
                            <option key={cp} value={cp}>{cp}</option>
                          ))}
                          <option value="custom">직접 입력...</option>
                        </select>
                      </div>

                      {personaType === 'custom' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>커스텀 페르소나 직접 적기</label>
                          <input
                            type="text"
                            value={customPersona}
                            onChange={(e) => setCustomPersona(e.target.value)}
                            placeholder="예: 대학원 진학을 앞둔 20대 유학생"
                            className="input-glow"
                            disabled={isLoading}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>스타일 필터</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className={`btn ${writingStyle === 'spoken' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.55rem 0.25rem', fontSize: '0.85rem' }}
                            onClick={() => setWritingStyle('spoken')}
                            disabled={isLoading}
                          >
                            🗣️ 구어체 (Spoken)
                          </button>
                          <button
                            type="button"
                            className={`btn ${writingStyle === 'written' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.55rem 0.25rem', fontSize: '0.85rem' }}
                            onClick={() => setWritingStyle('written')}
                            disabled={isLoading}
                          >
                            📝 문어체 (Written)
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>퀴즈 문항 개수</label>
                        <select
                          value={questionCount}
                          onChange={(e) => setQuestionCount(Number(e.target.value))}
                          className="input-glow select-glow"
                          disabled={isLoading}
                          style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                        >
                          <option value={3}>3 문항</option>
                          <option value={5}>5 문항 (기본)</option>
                          <option value={8}>8 문항</option>
                          <option value={10}>10 문항</option>
                        </select>
                      </div>

                      {formError && (
                        <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'center' }}>
                          <Info size={16} style={{ flexShrink: 0 }} />
                          <span>{formError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0.85rem' }}
                        disabled={isLoading}
                      >
                        🚀 첨삭 분석 &amp; 퀴즈 생성
                      </button>
                    </form>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                    {/* Preset Recommendation List */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'white', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <BookOpen size={16} style={{ color: 'var(--secondary)' }} />
                        추천 템플릿 학습 세트
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {PRESET_LESSONS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              justifyContent: 'flex-start',
                              fontSize: '0.825rem',
                              padding: '0.6rem 0.75rem',
                              display: 'block',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden'
                            }}
                            onClick={() => handleLoadPreset(preset)}
                          >
                            ⚡ {preset.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Conversation Mode Setup Wizard Sidebar Form */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white' }}>
                        <MessageSquare size={18} style={{ color: 'var(--secondary)' }} />
                        1:1 회화 상황실
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        다양한 프리셋 대화 상황(롤플레잉, 토론, 회의)을 골라 원어민 AI와 대화하고 실전 감각을 키워보세요.
                      </p>
                    </div>

                    {/* Category tabs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>대화 카테고리</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className={`btn ${convType === 'roleplay' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.45rem 0.25rem', fontSize: '0.8rem' }}
                          onClick={() => setConvType('roleplay')}
                        >
                          🏨 롤플레잉
                        </button>
                        <button
                          type="button"
                          className={`btn ${convType === 'debate' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.45rem 0.25rem', fontSize: '0.8rem' }}
                          onClick={() => setConvType('debate')}
                        >
                          ⚖️ 토론 연습
                        </button>
                        <button
                          type="button"
                          className={`btn ${convType === 'meeting' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.45rem 0.25rem', fontSize: '0.8rem' }}
                          onClick={() => setConvType('meeting')}
                        >
                          💼 비즈니스 회의
                        </button>
                        <button
                          type="button"
                          className={`btn ${convType === 'free' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.45rem 0.25rem', fontSize: '0.8rem' }}
                          onClick={() => setConvType('free')}
                        >
                          💬 자유 대화
                        </button>
                      </div>
                    </div>

                    {/* Presets dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>대화 상황 선택</label>
                      <select 
                        value={selectedPresetId} 
                        onChange={(e) => {
                          setSelectedPresetId(e.target.value);
                          if (e.target.value !== 'custom') {
                            const preset = PRESET_SITUATIONS.find(p => p.id === e.target.value);
                            if (preset) setActiveSituation(preset);
                          } else {
                            setActiveSituation(null);
                            setCustomSituationDesigned(false);
                          }
                        }}
                        className="input-glow select-glow"
                        disabled={isLoading}
                        style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                      >
                        {PRESET_SITUATIONS.filter(p => p.category === convType).map(preset => (
                          <option key={preset.id} value={preset.id}>{preset.title}</option>
                        ))}
                        <option value="custom">✨ 직접 주제 입력 (AI 브레인스토밍)...</option>
                      </select>
                    </div>

                    {/* Custom situation ideation */}
                    {selectedPresetId === 'custom' && !customSituationDesigned && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI 상황 설계 브레인스토밍 입력</label>
                        <textarea
                          value={ideationInput}
                          onChange={(e) => setIdeationInput(e.target.value)}
                          placeholder="원하는 대화 주제나 컨텍스트를 자유롭게 적어주세요.&#10;예: SpaceX의 화성 여행 관련 찬반 토론, 혹은 마트에서 물건 반품하기 등"
                          className="textarea-glow"
                          style={{ minHeight: '100px', fontSize: '0.8rem', padding: '0.75rem' }}
                          disabled={isDesigningSituation}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleDesignCustomSituation}
                          disabled={isDesigningSituation || !ideationInput.trim()}
                          style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                        >
                          {isDesigningSituation ? '🪄 상황 설계 중...' : '🪄 AI 상황 추천받기'}
                        </button>
                      </div>
                    )}

                    {selectedPresetId === 'custom' && customSituationDesigned && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCustomSituationDesigned(false)}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                        >
                          🔄 다른 상황 설계하기
                        </button>
                      </div>
                    )}

                    {/* Situation details card */}
                    {activeSituation && (
                      <div className="eli5-analogy-box" style={{ background: 'rgba(6, 182, 212, 0.03)', borderLeftColor: 'var(--secondary)', marginTop: '0.25rem', padding: '1rem', borderRadius: '0 8px 8px 0', margin: 0 }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.4rem' }}>
                          🎯 {activeSituation.title}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <p style={{ margin: 0 }}>
                            <strong>내 역할:</strong> {activeSituation.myRole}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>상대방 역할:</strong> {activeSituation.partnerRole}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>학습 목표:</strong> {activeSituation.goal}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Persona select */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>대화 상대방 영어 난이도 설정 (페르소나)</label>
                      <select
                        value={personaType}
                        onChange={(e) => setPersonaType(e.target.value)}
                        className="input-glow select-glow"
                        disabled={isLoading}
                        style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                      >
                        <option value="40대 엔지니어 직장인">40대 엔지니어 직장인 (비즈니스/IT)</option>
                        <option value="미국 중학생 청소년">미국 중학생 청소년 (또래/구어체)</option>
                        <option value="40대 일상 / 학부모 / 관공서/가게 등..">40대 일상 / 학부모 / 가게 점원</option>
                        {customPersonas.map((cp) => (
                          <option key={cp} value={cp}>{cp}</option>
                        ))}
                        <option value="custom">직접 입력...</option>
                      </select>
                    </div>

                    {personaType === 'custom' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>커스텀 페르소나 직접 적기</label>
                        <input
                          type="text"
                          value={customPersona}
                          onChange={(e) => setCustomPersona(e.target.value)}
                          placeholder="예: 대학원 진학을 앞둔 20대 유학생"
                          className="input-glow"
                          disabled={isLoading}
                        />
                      </div>
                    )}

                    {/* Quiz question count */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>종료 후 생성될 복습 퀴즈 개수</label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="input-glow select-glow"
                        disabled={isLoading}
                        style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}
                      >
                        <option value={3}>3 문항</option>
                        <option value={5}>5 문항 (기본)</option>
                        <option value={8}>8 문항</option>
                        <option value={10}>10 문항</option>
                      </select>
                    </div>

                    {/* Voice mode checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="voice-mode-checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="voice-mode-checkbox" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        🔊 AI 답변 음성 읽기 (TTS 활성화)
                      </label>
                    </div>

                    {/* Form error warning */}
                    {formError && (
                      <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.15)', alignItems: 'center' }}>
                        <Info size={16} style={{ flexShrink: 0 }} />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Start session trigger */}
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.85rem' }}
                      onClick={handleStartConversation}
                      disabled={isLoading || (selectedPresetId === 'custom' && !customSituationDesigned)}
                    >
                      🗣️ 대화 연습 시작하기 (Start Session)
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: History List or Chat Screen */}
              <div className="main-panel glass-panel">
                {isChattingActive ? (
                  /* Active Chatting UI */
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}>
                    {/* Active Chat Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isChatLoading ? 'var(--secondary)' : 'var(--success)', animation: isChatLoading ? 'pulse 1.5s infinite' : 'none' }}></div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'white', margin: 0 }}>
                          AI 대화 파트너 {activeSituation && `(${activeSituation.title})`}
                        </h3>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {chatMessages.length}개 메시지
                      </span>
                    </div>

                    {/* Chat Messages Bubble List */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      maxHeight: '460px',
                      minHeight: '400px',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      marginBottom: '1rem'
                    }}>
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            maxWidth: '80%',
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{
                            backgroundColor: msg.sender === 'user' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            border: msg.sender === 'user' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                            color: msg.sender === 'user' ? '#34d399' : 'var(--text-primary)',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            borderTopRightRadius: msg.sender === 'user' ? '2px' : '12px',
                            borderTopLeftRadius: msg.sender === 'ai' ? '2px' : '12px',
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            boxShadow: 'var(--shadow-sm)',
                            position: 'relative'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                                {msg.sender === 'user' ? '나 (User)' : 'AI 파트너'}
                              </span>
                              {msg.sender === 'ai' && (
                                <button
                                  onClick={() => speakText(msg.text)}
                                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}
                                  title="다시 읽기"
                                >
                                  🔊
                                </button>
                              )}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                          </div>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))}

                      {isChatLoading && (
                        <div style={{ alignSelf: 'flex-start', maxWidth: '80%', display: 'flex', gap: '0.5rem' }}>
                          <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            padding: '0.65rem 1rem',
                            borderRadius: '12px',
                            borderTopLeftRadius: '2px',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                          }}>
                            <span className="animate-pulse">✍️ AI 파트너가 답변을 작성하는 중...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Bottom Input Form */}
                    <form onSubmit={handleSendConversationMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`btn ${isListening ? 'btn-danger animate-pulse' : 'btn-secondary'}`}
                        style={{ padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        title={isListening ? "음성 인식 중지" : "마이크로 영어 말하기"}
                      >
                        {isListening ? <MicOff size={18} style={{ color: 'var(--accent)' }} /> : <Mic size={18} />}
                      </button>
                      <input
                        type="text"
                        value={chatInputValue}
                        onChange={(e) => setChatInputValue(e.target.value)}
                        placeholder={isListening ? "🎙️ 듣고 있습니다... 영어로 말씀해 보세요." : "메시지를 입력하세요..."}
                        className="input-glow"
                        style={{ flex: 1, padding: '0.75rem 1rem' }}
                        disabled={isChatLoading}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        disabled={isChatLoading || !chatInputValue.trim()}
                      >
                        전송
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Standard History Panel (Displayed when not chatting) */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontFamily: 'var(--font-display)' }}>
                          📝 영작 첨삭 보관함
                          <span className="badge badge-outline" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                            {lessonsHistory.length}
                          </span>
                        </h3>
                        {userId && (
                          <span style={{ 
                            fontSize: '0.725rem', 
                            color: syncStatus === 'error' ? 'var(--error)' : 'var(--primary)', 
                            fontWeight: '700' 
                          }}>
                            {syncStatus === 'syncing' && '🔄 클라우드 연동 동기화 중...'}
                            {syncStatus === 'synced' && '✓ 클라우드 동기화 완료'}
                            {syncStatus === 'error' && '❌ 클라우드 동기화 실패 (Firebase 권한 오류)'}
                          </span>
                        )}
                      </div>

                      {/* Search Bar */}
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="학습 목록 검색..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="input-glow"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem 0.4rem 1.8rem', borderRadius: '6px' }}
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
                        onClick={() => setFilterMode('correction')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          borderRadius: '8px',
                          border: filterMode === 'correction' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: filterMode === 'correction' ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                          color: filterMode === 'correction' ? 'white' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: filterMode === 'correction' ? '700' : '500',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        교정 전용 ({correctionCount})
                      </button>
                    </div>

                    {filteredHistory.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '4rem 1rem' }}>
                        <PlusCircle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>첨삭 내역이 없습니다. 새로운 문장을 적어 분석해 보세요!</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '580px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {filteredHistory.map((lesson) => {
                          const score = lesson.userAnswers 
                            ? (lesson.quizzes || []).filter(q => lesson.userAnswers?.[q.id] === q.correctIndex).length
                            : null;
                          const hasQuiz = (lesson.quizzes || []).length > 0;

                          return (
                            <div
                              key={lesson.id}
                              className="history-item-container"
                              onClick={() => handleLoadPreset(lesson)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div style={{ flex: 1, overflow: 'hidden', marginRight: '1rem', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap', minWidth: 0 }}>
                                  <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: lesson.style === 'spoken' ? 'var(--primary)' : 'var(--secondary)' }}>
                                    {lesson.style === 'spoken' ? '구어' : '문어'}
                                  </span>
                                  {lesson.writingLevel && (
                                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: '#3b82f6', color: 'white', fontWeight: 'bold' }}>
                                      Level {lesson.writingLevel}
                                    </span>
                                  )}
                                  {lesson.chatHistory && lesson.chatHistory.length > 0 && (
                                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', fontWeight: '700' }}>
                                      💬 대화 피드백
                                    </span>
                                  )}
                                  
                                  {editingTitleId === lesson.id ? (
                                    <form 
                                      onSubmit={(e) => handleSaveRename(e, lesson.id)} 
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
                                    >
                                      <input
                                        type="text"
                                        value={editingTitleText}
                                        onChange={(e) => setEditingTitleText(e.target.value)}
                                        className="input-glow"
                                        style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: '180px' }}
                                        autoFocus
                                      />
                                      <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.2rem' }}>
                                        <Check size={12} />
                                      </button>
                                    </form>
                                  ) : (
                                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'white', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
                                      {lesson.title}
                                    </span>
                                  )}
                                  
                                  {editingTitleId !== lesson.id && (
                                    <button 
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
                                      onClick={(e) => handleStartRename(e, lesson)}
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                  )}
                                </div>

                                {/* Solved Status and Cloud Chips Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem', marginBottom: '0.35rem' }}>
                                  {score !== null ? (() => {
                                    const firstScore = lesson.firstAttemptScore 
                                      ? `${lesson.firstAttemptScore.score}/${lesson.firstAttemptScore.total}`
                                      : `${score}/${(lesson.quizzes || []).length}`;
                                    
                                    const retryStr = lesson.retryHistory && lesson.retryHistory.length > 0
                                      ? `, 재시도: ` + lesson.retryHistory.map(r => `${r.score}/${r.total}`).join(', ')
                                      : '';

                                    return (
                                      <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                        ✅ 풀이 완료 ({firstScore}{retryStr})
                                      </span>
                                    );
                                  })() : hasQuiz ? (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                                      📖 미풀이
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', fontWeight: '500' }}>
                                      ✏️ 교정 전용
                                    </span>
                                  )}

                                  {lesson.ownerId && lesson.ownerId !== userId && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                      📥 다른 사용자 공유
                                    </span>
                                  )}
                                  {lesson.ownerId && lesson.ownerId === userId && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.125rem 0.45rem', borderRadius: '9999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}>
                                      ☁️ My 클라우드
                                    </span>
                                  )}
                                </div>
                                
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', margin: 0 }}>
                                  {lesson.sourceText}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Calendar size={12} /> {new Date(lesson.createdAt).toLocaleDateString('ko-KR')}
                                </span>

                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '0.3rem', borderRadius: '6px' }}
                                  onClick={(e) => handleDeleteHistory(e, lesson.id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}

        {/* Tab 2: Mistakes review room */}
        {activeTab === 'review' && (
          <ReviewRoom
            wrongAnswers={wrongAnswers}
            onRemoveWrongAnswer={handleRemoveWrongAnswer}
            onClearAll={handleClearAllWrong}
          />
        )}

        {/* Tab 3: Analytics dashboard */}
        {activeTab === 'analytics' && (
          <Analytics
            stats={stats}
            wrongAnswersCount={wrongAnswers.length}
          />
        )}
      </main>
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
