import { 
  Lesson, 
  QuizItem, 
  PredictionData, 
  Eli10Data, 
  DecisionTriggerData, 
  WritingTemplateData, 
  WritingEvaluationResult,
  WrongAnswerCoachingStep1Data, 
  WrongAnswerCoachingStep2Data, 
  WrongAnswerCoachingStep3Data 
} from './types';

// Dynamic Adaptive Rate Control Manager for API Throttling
export class AdaptiveRateLimiter {
  private pacingDelay = 200;
  private minPacing = 100;
  private maxPacing = 3000;

  public async waitPacing() {
    if (this.pacingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.pacingDelay));
    }
  }

  public onSuccess() {
    this.pacingDelay = Math.max(this.minPacing, Math.floor(this.pacingDelay * 0.85));
  }

  public onRateLimit(status: number) {
    if (status === 429) {
      this.pacingDelay = Math.min(this.maxPacing, Math.max(1000, Math.floor(this.pacingDelay * 2.5)));
    } else {
      this.pacingDelay = Math.min(this.maxPacing, Math.max(500, Math.floor(this.pacingDelay * 1.5)));
    }
  }
}

// Helper function to call fetch with dynamic exponential backoff with jitter
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 4,
  initialDelay = 1000
): Promise<Response> {
  let delay = initialDelay;
  const maxBackoffDelay = 16000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }
      
      if (response.status === 429 || response.status >= 500) {
        const jitter = Math.floor(Math.random() * 300);
        const currentDelay = delay + jitter;
        console.warn(`[Gemini API] HTTP ${response.status}. Retrying in ${currentDelay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        
        if (attempt === maxRetries - 1) {
          return response;
        }

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        delay = Math.min(maxBackoffDelay, delay * 2);
        continue;
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const isAbort = error.name === 'AbortError';
      const jitter = Math.floor(Math.random() * 300);
      const currentDelay = delay + jitter;
      const msg = isAbort ? 'API 요청 시간 초과 (45초)' : (error?.message || String(error));
      
      console.warn(`[Gemini API] Network error: ${msg}. Retrying in ${currentDelay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      if (attempt === maxRetries - 1) {
        throw new Error(isAbort ? 'Gemini API 응답 시간이 초과되었습니다 (45초). 다시 시도해 주세요.' : msg);
      }
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      delay = Math.min(maxBackoffDelay, delay * 2);
    }
  }
  throw new Error("Gemini API 요청 실패: 최대 재시도 횟수를 초과했습니다.");
}

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  
  // Remove control characters except standard whitespace characters (tab, newline, carriage return)
  cleaned = cleaned.replace(/[\u0000-\u0008\u000b-\u000f\u0010-\u001f]/g, "");
  
  return cleaned;
}

function cleanKoreanIntent(intent: string): string {
  if (!intent) return "";
  return intent
    .replace(/상황을 영어로 말해보세요\.?/g, '')
    .replace(/상황을 영어 1문장으로 표현해보세요\.?/g, '')
    .replace(/영어로 표현해보세요\.?/g, '')
    .replace(/영어로 말해보세요\.?/g, '')
    .replace(/영작해보세요\.?/g, '')
    .replace(/말해보세요\.?/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
}

function makeDirectSpokenSentence(
  condition: string,
  expression: string,
  example?: string,
  category: 'business' | 'daily' = 'business'
): string {
  if (example) {
    const parenMatch = example.match(/[\(（](.*?)[\)）]/);
    if (parenMatch && parenMatch[1] && parenMatch[1].length >= 3) {
      let t = parenMatch[1]
        .replace(/주로 쓰는 표현.*$/, '')
        .replace(/정형화된 표현.*$/, '')
        .replace(/때$/, '')
        .replace(/상황$/, '')
        .trim();
      if (!t.endsWith('요') && !t.endsWith('다') && !t.endsWith('어') && !t.endsWith('음') && !t.endsWith('죠')) {
        t += (category === 'business' ? ' 확인해 볼게요.' : ' 해볼게요.');
      }
      return t;
    }
  }

  if (!condition) {
    return category === 'business' 
      ? `제가 관련 내용을 ${expression} 처리해 둘게요.` 
      : `우리 ${expression} 쪽으로 해보자.`;
  }

  let clean = condition
    .replace(/주로 쓰는 표현.*$/, '')
    .replace(/정형화된 표현.*$/, '')
    .replace(/상황을 영어로.*$/, '')
    .replace(/표현 상황.*$/, '')
    .replace(/사용할 때.*$/, '')
    .replace(/사용합니다.*$/, '')
    .replace(/때$/, '')
    .replace(/상황$/, '')
    .trim();

  if (clean.includes('바꿀') || clean.includes('전환할') || clean.includes('설정할')) {
    return clean.replace(/바꿀.*$/, '바꿔 둘게요.').replace(/전환할.*$/, '전환했어요.').replace(/설정할.*$/, '설정해 둘게요.');
  }
  if (clean.includes('지정할') || clean.includes('표시할')) {
    return clean.replace(/지정할.*$/, '지정해 두었습니다.').replace(/표시할.*$/, '표시해 둘게요.');
  }
  if (clean.includes('확인할') || clean.includes('알아볼')) {
    return clean.replace(/확인할.*$/, '확인해 볼게요.').replace(/알아볼.*$/, '알아볼게요.');
  }
  if (clean.includes('불확실할') || clean.includes('존재 유무')) {
    return `혹시 도와줄 사람이 있기는 한지 알아볼게요.`;
  }
  if (clean.includes('특정할') || clean.includes('누구인지')) {
    return `누가 참석할 수 있는지 명단을 확인해 볼게요.`;
  }

  if (clean.endsWith('할') || clean.endsWith('될')) {
    clean = clean.replace(/할$/, '해 볼게요.').replace(/될$/, '되어 있어요.');
  } else if (!clean.endsWith('요') && !clean.endsWith('다') && !clean.endsWith('어')) {
    clean = `${clean} 상황이라 제가 직접 진행해 볼게요.`;
  }

  return clean;
}

/**
 * Normalizes any lesson object (legacy or newly generated) to guarantee 
 * all 5-stage fields exist with graceful fallbacks.
 */
export function normalizeLesson(raw: any): Lesson {
  if (!raw) {
    throw new Error("Invalid lesson object");
  }

  // 1. Prediction fallback
  let prediction: PredictionData = raw.prediction;
  if (!prediction || !prediction.sentenceA) {
    const rawExample = raw.eli10?.contrastiveExample || raw.eli5?.example || "";
    let sA = "I'll see who can help.";
    let sB = "I'll see if who can help.";
    let incorrect: 'A' | 'B' = 'B';

    if (rawExample.includes('vs') || rawExample.includes('/')) {
      const parts = rawExample.split(/vs|\//i);
      if (parts.length >= 2) {
        sA = parts[0].replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '').trim();
        sB = parts[1].replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '').trim();
        if (parts[0].includes('(X)') || parts[0].includes('(x)')) {
          incorrect = 'A';
        }
      }
    }

    prediction = {
      sentenceA: sA,
      sentenceB: sB,
      incorrectChoice: incorrect,
      trapExplanation: raw.eli10?.corePrinciple || raw.eli5?.explanation || "한국어 직역 습관으로 인해 발생하는 인지적 착각 패턴입니다."
    };
  } else {
    prediction = {
      sentenceA: prediction.sentenceA.replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '').trim(),
      sentenceB: prediction.sentenceB.replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '').trim(),
      incorrectChoice: prediction.incorrectChoice === 'A' ? 'A' : 'B',
      trapExplanation: prediction.trapExplanation || ""
    };
  }

  // 2. ELI10 fallback
  let eli10: Eli10Data = raw.eli10;
  if (!eli10 || !eli10.corePrinciple) {
    eli10 = {
      corePrinciple: raw.eli5?.explanation || "핵심 원리 설명입니다.",
      mentalModelAnalogy: raw.eli5?.analogy || "직관적인 비유로 원리를 이해해보세요.",
      contrastiveExample: raw.eli5?.example || prediction.sentenceA,
      exampleContext: raw.eli5?.exampleContext || ""
    };
  }

  // 3. Decision Trigger fallback
  let decisionTrigger: DecisionTriggerData = raw.decisionTrigger;
  if (!decisionTrigger || !decisionTrigger.triggerA) {
    decisionTrigger = {
      triggerA: {
        expression: raw.memoryTips?.conceptA || "개념 A",
        condition: raw.memoryTips?.conceptADesc || "상황 A일 때 사용합니다.",
        example: ""
      },
      triggerB: {
        expression: raw.memoryTips?.conceptB || "개념 B",
        condition: raw.memoryTips?.conceptBDesc || "상황 B일 때 사용합니다.",
        example: ""
      },
      keyRuleSummary: raw.memoryTips?.tipFormula || `${raw.memoryTips?.conceptA || 'A'} vs ${raw.memoryTips?.conceptB || 'B'}`
    };
  }

  // 4. Pronunciation fallback
  let pronunciation = raw.pronunciation || {
    wordOrPhrase: raw.title?.split(' ')[0] || "English Expression",
    phoneticRespelling: "ING-glish",
    koreanPhonetic: "잉글리시",
    stressGuide: "주요 강세와 연음에 유의하여 발음합니다."
  };

  // 5. Writing Template fallback & smart enrichment
  let writingTemplate: WritingTemplateData = raw.writingTemplate;
  const exprA = decisionTrigger.triggerA?.expression || raw.title?.split(' ')[0] || "Target Expression";
  const condA = decisionTrigger.triggerA?.condition || "";
  const exprB = decisionTrigger.triggerB?.expression || "";
  const condB = decisionTrigger.triggerB?.condition || "";

  const isGeneric = !writingTemplate?.situation ||
    writingTemplate.situation.includes("오늘 배운 핵심 원리") ||
    writingTemplate.situation.includes("실전 대화에서 적용") ||
    writingTemplate.template?.includes("I need to ...") ||
    !writingTemplate.scenarios ||
    writingTemplate.scenarios.length === 0 ||
    writingTemplate.koreanIntent?.includes("말해보세요") ||
    writingTemplate.koreanIntent?.includes("표현해보세요");

  if (!writingTemplate || isGeneric) {
    const rawExample = eli10.contrastiveExample 
      ? eli10.contrastiveExample.replace(/[\(（\[][\s]*[OXox대조정답오답틀림맞음][\s]*[\)）\]]/gi, '').split(/vs|\//i)[0].trim() 
      : "";

    const baseTemplate = `(${exprA}${exprB ? ` / ${exprB}` : ''}) ____________________.`;

    const businessIntent = makeDirectSpokenSentence(condA, exprA, decisionTrigger.triggerA?.example, 'business');
    const dailyIntent = makeDirectSpokenSentence(condB || condA, exprB || exprA, decisionTrigger.triggerB?.example, 'daily');

    const businessSit = `[🏢 비즈니스 / 업무 상황] ${condA ? `${condA.replace(/때$/, '')} 상황에서 팀원 또는 거래처에 명확하게 의사를 전달해야 합니다.` : `업무 미팅 중 ${exprA}을(를) 활용하여 상황을 명확하게 전달해야 하는 상황입니다.`}`;
    const dailySit = exprB
      ? `[☕ 일상 / 대화 상황] ${condB ? `${condB.replace(/때$/, '')} 상황에서 친구나 지인에게 자연스럽게 이야기해야 합니다.` : `일상 대화 중 ${exprB}을(를) 활용하여 자연스럽게 이야기하는 상황입니다.`}`
      : `[☕ 일상 / 대화 상황] 일상 대화 중 ${exprA}을(를) 활용하여 자연스럽게 이야기하는 상황입니다.`;

    const defaultKeywords = [
      exprA.split(' ')[0].replace(/[^a-zA-Z]/g, ''),
      exprB ? exprB.split(' ')[0].replace(/[^a-zA-Z]/g, '') : '',
      'tomorrow',
      'meeting'
    ].filter(Boolean);

    writingTemplate = {
      situation: businessSit,
      koreanIntent: businessIntent,
      prompt: `주어진 실전 상황에 맞춰 (${exprA}${exprB ? ` / ${exprB}` : ''})을(를) 활용한 1문장을 완성해보세요.`,
      template: baseTemplate,
      sampleSentence: rawExample || `I will (${exprA}) right away.`,
      tip: condA || `${exprA}의 쓰임새와 조건에 유의하여 완성해보세요.`,
      keyKeywords: defaultKeywords,
      scenarios: [
        {
          category: "🏢 비즈니스 / 업무 상황",
          situation: businessSit,
          koreanIntent: businessIntent,
          template: baseTemplate,
          sampleSentence: rawExample || `I will (${exprA}) right away.`,
          keyKeywords: defaultKeywords,
          tip: condA || `${exprA}의 조건에 맞춰 작성하세요.`
        },
        {
          category: "☕ 일상 / 대화 상황",
          situation: dailySit,
          koreanIntent: dailyIntent,
          template: `(${exprB || exprA}) ____________________.`,
          sampleSentence: rawExample || `Let me (${exprB || exprA}) right away.`,
          keyKeywords: defaultKeywords,
          tip: condB || `${exprB || exprA}의 뉘앙스를 살려 작성하세요.`
        }
      ]
    };
  } else if (writingTemplate.scenarios) {
    writingTemplate = {
      ...writingTemplate,
      koreanIntent: cleanKoreanIntent(writingTemplate.koreanIntent || ""),
      scenarios: writingTemplate.scenarios.map(s => ({
        ...s,
        koreanIntent: cleanKoreanIntent(s.koreanIntent || "")
      }))
    };
  }

  // Quizzes fallback
  const quizzes: QuizItem[] = (raw.quizzes || []).map((q: any, idx: number) => ({
    id: q.id || `q-${idx + 1}`,
    question: q.question || "",
    choices: q.choices || [],
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
    rationale: q.rationale || "",
    isReview: q.isReview
  }));

  return {
    ...raw,
    prediction,
    eli10,
    decisionTrigger,
    pronunciation,
    writingTemplate,
    quizzes
  };
}

// Preloaded Premium Lessons for immediate offline exploration
export const PRESET_LESSONS: Lesson[] = [
  {
    id: "preset-see-who-if-anyone",
    title: "see who vs see if anyone (문지기 원리)",
    sourceText: "I'll see who can help vs I'll see if who can help 문장 분석 및 영어 접속사/의문사 단일성 원리",
    createdAt: 1716656300000,
    prediction: {
      sentenceA: "I'll see who can help.",
      sentenceB: "I'll see if who can help.",
      incorrectChoice: "B",
      trapExplanation: "한국어 '~인지(if)'와 '누가(who)'를 둘 다 살리려다 see if who로 겹쳐 쓰기 쉽지만, 영어는 문장 연결 고리(문지기)를 단 하나만 씁니다."
    },
    eli10: {
      corePrinciple: "한국어 '~인지(if)'와 '누가(who)'를 둘 다 살리려다 see if who로 겹쳐 쓰기 쉽지만, 영어는 문장 연결 고리(접속사/의문사)를 단 하나만 씁니다.",
      mentalModelAnalogy: "방으로 들어가는 문에는 문지기가 한 명만 서 있어야 합니다. who 혼자 서거나, if가 설 거라면 뒤에 일반 손님인 anyone을 데려와야 합니다.",
      contrastiveExample: "I'll see who can help (O) vs I'll see if who can help (X)",
      exampleContext: "who 자체가 이미 '~누가 ...하는지'라는 연결 고리 역할을 완벽하게 수행하므로 if가 끼어들면 문지기 중복 충돌이 일어납니다."
    },
    decisionTrigger: {
      triggerA: {
        expression: "see who",
        condition: "대상이 될 후보는 이미 있고, 그중 '누구인지(정체)' 특정할 때",
        example: "I'll check who is coming to the meeting. (누가 오는지 명단을 확인할 때)"
      },
      triggerB: {
        expression: "see if anyone",
        condition: "도와줄 사람이 '있기는 한지(존재 유무)'조차 불확실할 때",
        example: "Let's see if anyone has a spare charger. (혹시 충전기 가진 사람이 있기는 한지)"
      },
      keyRuleSummary: "정체 특정 = who / 존재 유무 = if anyone (문지기는 무조건 1명만!)"
    },
    pronunciation: {
      wordOrPhrase: "I'll see who can help",
      phoneticRespelling: "ayl SEE hoo kn HELP",
      koreanPhonetic: "아일 씨 후 끈 헬프",
      stressGuide: "I'll see who에서 SEE와 WHO에 리듬감 있는 강세를 주며, can은 약화되어 [끈]처럼 짧게 지나갑니다."
    },
    writingTemplate: {
      situation: "내일 오후 긴급 프로젝트 회의를 앞두고, 팀원들 중 배석이 가능한 사람이 '누구인지' 명단을 직접 확인해서 회신해야 하는 상황입니다.",
      koreanIntent: "내일 회의에 누가 참석 가능한지 제가 확인해 볼게요.",
      prompt: "주어진 비즈니스 및 일상 상황에 맞춰 'see who' 또는 'see if anyone'을 선택하여 1문장을 완성해보세요.",
      template: "I'll check (who / if anyone) ____________________.",
      sampleSentence: "I'll check who is available for tomorrow's team meeting.",
      tip: "참석 후보자 중 '누구인지' 특정 인물의 정체를 확인하므로 who를 사용합니다.",
      keyKeywords: ["available for", "tomorrow's meeting", "can attend", "join us"],
      scenarios: [
        {
          category: "🏢 비즈니스 / 업무 상황",
          situation: "내일 오후 긴급 프로젝트 회의를 앞두고, 팀원들 중 배석이 가능한 사람이 '누구인지' 명단을 직접 확인해서 회신해야 하는 상황입니다.",
          koreanIntent: "내일 회의에 누가 참석 가능한지 제가 확인해 볼게요.",
          template: "I'll check (who / if anyone) ____________________.",
          sampleSentence: "I'll check who is available for tomorrow's team meeting.",
          keyKeywords: ["available for", "tomorrow's meeting", "can attend", "join us"],
          tip: "참석 후보자 중 '누구인지' 특정 인물의 정체를 확인하므로 who를 사용합니다."
        },
        {
          category: "☕ 일상 / 대화 상황",
          situation: "사무실에 노트북 충전기를 두고 와서, 동료나 팀원 중 여분의 충전기를 가진 사람이 '혹시 있기는 한지' 물어봐야 하는 상황입니다.",
          koreanIntent: "혹시 여분 충전기 가진 사람이 있는지 알아볼게요.",
          template: "Let's see (who / if anyone) ____________________.",
          sampleSentence: "Let's see if anyone has a spare charger.",
          keyKeywords: ["has a spare charger", "around here", "brought an extra"],
          tip: "도와줄 사람이 존재하는지 유무 자체가 불확실하므로 if anyone을 사용합니다."
        }
      ]
    },
    quizzes: [
      {
        id: "q-sw-1",
        question: "다음 중 어색한(틀린) 문장을 고르세요.",
        choices: [
          "Let me check if who is joining the meeting.",
          "Let me check who is joining the meeting.",
          "Let me check if anyone is joining the meeting.",
          "Let me see who answered the phone."
        ],
        correctIndex: 0,
        rationale: "A번이 오답(틀린 문장)입니다. 영어에서는 if와 who 같은 연결 고리를 겹쳐 쓸 수 없습니다(문지기 중복 오류). B번(who만 사용)과 C번(if + anyone 사용)이 올바른 문장입니다."
      },
      {
        id: "q-sw-2",
        question: "회사에서 내일 프레젠테이션을 도와줄 사람이 '혹시 있기는 한지' 존재 유무를 알아보고자 할 때 가장 자연스러운 표현은?",
        choices: [
          "I'll see if who is free tomorrow.",
          "I'll see if anyone is free tomorrow.",
          "I'll see who if someone is free tomorrow.",
          "I'll see that who can help tomorrow."
        ],
        correctIndex: 1,
        rationale: "B번이 정답입니다. 도와줄 사람이 존재하는지 유무 자체가 불확실할 때는 'if + anyone' 패턴을 사용합니다. A, C, D번은 연결고리 중복 오류입니다."
      },
      {
        id: "q-sw-3",
        question: "다음 빈칸에 가장 알맞은 표현은?\n\n'I want to find out ________ left this jacket in the conference room.'",
        choices: [
          "if who",
          "who",
          "if that",
          "who that"
        ],
        correctIndex: 1,
        rationale: "B번 who가 정답입니다. 회의실에 자켓을 두고 간 '특정 인물의 정체'를 알아내는 상황이므로 의문사 who 하나만 단독으로 와야 합니다. A번 if who는 문지기 중복입니다."
      }
    ]
  },
  {
    id: "preset-despite-although",
    title: "Despite vs Although 완벽 구분하기",
    sourceText: "Despite our preparation, we failed the exam. / Although we prepared well, we failed the exam. 두 문장의 문법 요소와 전치사 vs 접속사 차이점 분석",
    createdAt: 1716656400000,
    prediction: {
      sentenceA: "Despite our preparation, we failed the exam.",
      sentenceB: "Although our preparation, we failed the exam.",
      incorrectChoice: "B",
      trapExplanation: "Although는 '주어+동사'를 갖춘 완전한 문장(절)을 연결하는 접속사입니다. 명사 덩어리 앞에는 전치사인 Despite를 써야 합니다."
    },
    eli10: {
      corePrinciple: "Despite와 Although는 둘 다 '~임에도 불구하고'라는 뜻이지만, Despite는 명사(이름표)만 데려오는 '전치사'이고, Although는 주어+동사 문장을 데려오는 '접속사'입니다.",
      mentalModelAnalogy: "기차(Although)와 트렁크 가방(Despite)의 차이입니다! Although는 기관사(주어)와 조수(동사)가 탄 기차 칸을 연결하는 연결고리이고, Despite는 짐더미(명사)만 툭 넣는 트렁크 가방입니다.",
      contrastiveExample: "Despite the heavy rain (O) vs Although the heavy rain (X)",
      exampleContext: "Despite 뒤에는 명사(the heavy rain)만 왔으므로 옳습니다. Although 뒤에 명사만 딸랑 오면 문법적 에러가 납니다!"
    },
    decisionTrigger: {
      triggerA: {
        expression: "Despite / In spite of",
        condition: "뒤에 주어+동사가 없고 '명사' 또는 '-ing(동명사)' 덩어리만 올 때",
        example: "Despite the noise, she fell asleep. (소음에도 불구하고)"
      },
      triggerB: {
        expression: "Although / Even though",
        condition: "뒤에 '주어 + 동사'를 갖춘 완전한 절이 이어질 때",
        example: "Although it was noisy, she fell asleep. (시끄러웠음에도 불구하고)"
      },
      keyRuleSummary: "Despite + 명사 덩어리 VS Although + 주어 + 동사"
    },
    pronunciation: {
      wordOrPhrase: "Despite our preparation",
      phoneticRespelling: "dih-SPYT ow-er prep-uh-RAY-shun",
      koreanPhonetic: "디스파이 타워 프레퍼레-이션",
      stressGuide: "dih-SPYT에서 'SPYT'에 강세가 들어가며, Despite의 t와 our가 연음되어 [디스파이 타워]처럼 들립니다. preparation에서는 RAY에 가장 강한 강세를 줍니다."
    },
    writingTemplate: {
      situation: "프로젝트 일정이 매우 촉박하고 예산이 부족했음에도 불구하고, 팀원들과 함께 마감 기한 내에 런칭을 성공적으로 마친 상황을 회의에서 보고하는 상황입니다.",
      koreanIntent: "촉박한 마감 일정에도 불구하고 우리는 프로젝트를 제시간에 완료했습니다.",
      prompt: "주어진 상황에 맞춰 Despite(+명사구) 또는 Although(+주어+동사)를 올바르게 선택하여 1문장을 완성해보세요.",
      template: "(Despite / Although) ____________________, we completed the project on time.",
      sampleSentence: "Despite the tight deadline, we completed the project on time.",
      tip: "the tight deadline은 명사구이므로 전치사 Despite를 선택합니다.",
      keyKeywords: ["the tight deadline", "the budget constraints", "it was challenging", "we worked hard"],
      scenarios: [
        {
          category: "🏢 비즈니스 / 업무 상황",
          situation: "프로젝트 일정이 매우 촉박하고 예산이 부족했음에도 불구하고, 팀원들과 함께 마감 기한 내에 런칭을 성공적으로 마친 상황을 회의에서 보고하는 상황입니다.",
          koreanIntent: "촉박한 마감 일정에도 불구하고 우리는 프로젝트를 제시간에 완료했습니다.",
          template: "(Despite / Although) ____________________, we completed the project on time.",
          sampleSentence: "Despite the tight deadline, we completed the project on time.",
          keyKeywords: ["the tight deadline", "the budget constraints", "we worked hard"],
          tip: "명사구(the tight deadline) 앞에는 Despite를 씁니다."
        },
        {
          category: "☕ 일상 / 대화 상황",
          situation: "주말에 비가 쏟아졌지만, 오랜만에 잡힌 친구들과의 여행을 취소하지 않고 신나게 즐기고 온 경험을 이야기하는 상황입니다.",
          koreanIntent: "비가 많이 내렸지만, 우리는 여행을 정말 재미있게 즐겼어요.",
          template: "(Despite / Although) ____________________, we had a fantastic trip.",
          sampleSentence: "Although it rained heavily all weekend, we had a fantastic trip.",
          keyKeywords: ["it rained heavily", "the bad weather", "all weekend"],
          tip: "주어+동사 절(it rained heavily) 앞에는 Although를 씁니다."
        }
      ]
    },
    quizzes: [
      {
        id: "q-da-1",
        question: "다음 빈칸에 들어갈 알맞은 단어는? \n\n________ the loud noise, baby Sophia slept peacefully all afternoon.",
        choices: [
          "Although",
          "Despite",
          "Even though",
          "Though"
        ],
        correctIndex: 1,
        rationale: "빈칸 뒤에 'the loud noise'(시끄러운 소음)라는 명사 덩어리만 존재하므로, 명사를 이끄는 전치사인 'Despite'(B번)가 정답입니다. A번 Although, C번 Even though, D번 Though는 모두 뒤에 주어+동사를 동반하는 접속사이므로 이 자리에 올 수 없습니다."
      },
      {
        id: "q-da-2",
        question: "다음 중 문법적으로 올바른 문장을 고르세요.",
        choices: [
          "Although the bad weather, they played soccer.",
          "Despite it was raining heavily, they went out.",
          "In spite of the bad weather, they played soccer.",
          "Even though the bad weather, they went out."
        ],
        correctIndex: 2,
        rationale: "'In spite of'는 'Despite'와 마찬가지로 전치사이며, 뒤에 명사구인 'the bad weather'를 취했으므로 올바른 문장입니다(C번). A, D번은 명사구 앞에 접속사 Although/Even though를 써서 틀렸고, B번은 주어+동사 문장 앞에 전치사 Despite를 써서 틀렸습니다."
      },
      {
        id: "q-da-3",
        question: "다음 두 문장을 한 문장으로 합칠 때 빈칸에 들어갈 말은?\n\n'She was very tired. She finished her homework.'\n-> She finished her homework ________ she was very tired.",
        choices: [
          "despite",
          "in spite of",
          "although",
          "despite of"
        ],
        correctIndex: 2,
        rationale: "합쳐진 문장 빈칸 뒤에 'she(주어) was(동사) very tired'가 오고 있습니다. 주어와 동사를 이끄는 것은 양보의 접속사 'although'(C번)입니다. A번 despite와 B번 in spite of는 전치사라서 안 되며, D번 'despite of'는 존재하지 않는 엉터리 표현입니다."
      }
    ]
  },
  {
    id: "preset-boring-bored",
    title: "감정 형용사 -ing vs -ed 종결하기",
    sourceText: "I am boring vs I am bored. The movie was confusing vs The movie was confused. 사람 주어 사물 주어에 따른 분사 형용사의 올바른 매칭법",
    createdAt: 1716656460000,
    prediction: {
      sentenceA: "I was so boring during the presentation.",
      sentenceB: "I was so bored during the presentation.",
      incorrectChoice: "A",
      trapExplanation: "'-ing'는 감정을 유발하는 '원인'을 나타냅니다. 내가 지루함을 '느낀' 것이라면 수동적 상태인 '-ed(bored)'를 써야 합니다. 'I am boring'은 '내가 지루한 인간이다'라는 뜻이 됩니다!"
    },
    eli10: {
      corePrinciple: "현재분사(-ing)는 그 감정을 '일으키는 원인'을 설명하고, 과거분사(-ed)는 그 감정을 '느끼게 된 상태'를 뜻합니다. 주어가 사람인지 사물인지가 아니라 '원인인가, 체험자인가?'가 핵심입니다.",
      mentalModelAnalogy: "'-ing'는 남에게 쏘는 감정의 화살(활)이고, '-ed'는 날아온 화살에 찔려 아파하는 심장입니다. 내가 하품을 하는 중이라면 화살에 찔린 상태인 '-ed'입니다.",
      contrastiveExample: "The class is boring (O) vs The students are bored (O)",
      exampleContext: "수업(Class)은 지루함을 뿜어내는 '원인(-ing)'이고, 학생들(Students)은 지루함을 느끼는 '체험자(-ed)'입니다."
    },
    decisionTrigger: {
      triggerA: {
        expression: "Exciting / Boring / Confusing (-ing)",
        condition: "어떤 대상이 주변에 그 감정을 '풍기고 뿜어내고 있는 원인'일 때",
        example: "The new movie was thrilling. (그 영화가 스릴을 뿜어냄)"
      },
      triggerB: {
        expression: "Excited / Bored / Confused (-ed)",
        condition: "외부 원인으로 인해 마음속에 그 감정을 '느끼고 탑재된 상태'일 때",
        example: "I felt confused by the instructions. (설명 때문에 내가 혼란을 느낌)"
      },
      keyRuleSummary: "원인 제공자 = -ing (Active) VS 감정 체험자 = -ed (Passive)"
    },
    pronunciation: {
      wordOrPhrase: "I was confused by the movie",
      phoneticRespelling: "ay wuz kun-FYOODZD by the MOO-vee",
      koreanPhonetic: "아이 워즈 컨퓨즈드 바이 더 무비",
      stressGuide: "confused에서 'FYOODZD'에 강한 강세를 주어 발음합니다. by the가 뭉쳐지면서 '바이 더'로 부드럽게 넘어가며, movie의 'MOO'에 주강세를 줍니다."
    },
    writingTemplate: {
      situation: "2시간 동안 이어진 분기 실적 회의가 너무 지루하고 데이터만 나열되어 있어서, 참가자들이 모두 지루함을 느끼고 집중력을 잃었던 상황을 동료에게 털어놓는 상황입니다.",
      koreanIntent: "그 회의는 너무 지루해서 나는 발표 내내 정말 지루했어.",
      prompt: "감정을 유발하는 원인(-ing)과 감정을 느끼는 상태(-ed)를 구분하여 1문장을 완성해보세요.",
      template: "The quarterly meeting was so (boring / bored) that I felt completely (boring / bored).",
      sampleSentence: "The quarterly meeting was so boring that I felt completely bored the whole time.",
      tip: "회의는 지루함을 유발하는 원인이므로 boring, 내가 느낀 감정 상태는 bored를 씁니다.",
      keyKeywords: ["boring meeting", "felt so bored", "the whole time", "lost focus"],
      scenarios: [
        {
          category: "🏢 비즈니스 / 업무 상황",
          situation: "2시간 동안 이어진 분기 실적 회의가 너무 지루하고 데이터만 나열되어 있어서, 참가자들이 모두 지루함을 느끼고 집중력을 잃었던 상황을 동료에게 털어놓는 상황입니다.",
          koreanIntent: "그 회의는 너무 지루해서 나는 발표 내내 정말 지루했어.",
          template: "The quarterly meeting was so (boring / bored) that I felt completely (boring / bored).",
          sampleSentence: "The quarterly meeting was so boring that I felt completely bored the whole time.",
          keyKeywords: ["boring meeting", "felt so bored", "the whole time", "lost focus"],
          tip: "회의(원인) = boring / 내 감정(체험) = bored"
        },
        {
          category: "☕ 일상 / 대화 상황",
          situation: "친구가 추천해준 영화가 기대와 달리 줄거리가 너무 지루해서 보는 내내 지루해졌던 감정을 친구에게 감상평으로 이야기하는 상황입니다.",
          koreanIntent: "그 영화는 너무 지루해서 나는 보는 내내 지루했어.",
          template: "The movie was really (boring / bored), so I got (boring / bored) quickly.",
          sampleSentence: "The movie was really boring, so I got bored after just twenty minutes.",
          keyKeywords: ["boring movie", "got bored", "after 20 minutes", "the plot"],
          tip: "영화(원인) = boring / 나(체험자) = bored"
        }
      ]
    },
    quizzes: [
      {
        id: "q-bb-1",
        question: "다음 대화의 빈칸에 들어갈 알맞은 짝은?\n\nA: How was the horror movie yesterday?\nB: It was really ________! I was so ________ that I couldn't sleep.",
        choices: [
          "frightened - frightening",
          "frightening - frightened",
          "frightening - frightening",
          "frightened - frightened"
        ],
        correctIndex: 1,
        rationale: "B번이 정답입니다. 영화(It)는 무서움을 뿜어내는 '원인'이므로 현재분사인 'frightening'이 알맞고, 나(I)는 그 영화 때문에 무서움을 당해 느낀 '피해자(체험자)'이므로 과거분사 'frightened'가 들어맞습니다."
      },
      {
        id: "q-bb-2",
        question: "선생님의 문법 설명이 너무 어려워서 이해가 안 되는 상황입니다. 올바른 표현을 고르세요.",
        choices: [
          "The teacher's explanation was confused.",
          "We were confusing by the explanation.",
          "The teacher's explanation was confusing.",
          "We felt confusing during the class."
        ],
        correctIndex: 2,
        rationale: "선생님의 설명(Explanation)이 혼란을 유발하는 원인이므로 C번 'confusing'이 맞습니다. A번은 설명 자체가 감정을 느끼고 혼란스러워한다는 어색한 표현이 됩니다."
      }
    ]
  }
];

// System Prompt for Gemini to guarantee perfect 5-stage parsing and compliance
const SYSTEM_PROMPT = `You are a world-class cognitive linguistics expert and English educational tutor. Your task is to analyze the provided English quiz, expression, explanation, or text, and generate a 5-Stage Cognitive Progressive Learning Material matching the exact JSON structure provided below.

Your response MUST be a single, valid JSON object and nothing else. Do not wrap in markdown \`\`\`json ... \`\`\`, just return the raw JSON string.

You must fill out all fields in KOREAN (except the English keywords/examples where appropriate).

Strict Schema Requirements:
{
  "title": "A short, engaging title in Korean summarizing the core topic (e.g., 'see who vs see if anyone (문지기 원리)')",
  "prediction": {
    "sentenceA": "Sentence A in English (e.g. 'I\\'ll see who can help.')",
    "sentenceB": "Sentence B in English (e.g. 'I\\'ll see if who can help.')",
    "incorrectChoice": "A" or "B" (indicating which one is incorrect/awkward for native speakers),
    "trapExplanation": "Explain in Korean why Korean speakers make this cognitive illusion/trap (e.g. trying to translate both '~인지' and '누가') and why native speakers never say the incorrect sentence."
  },
  "eli10": {
    "corePrinciple": "Explain Like I'm 10 in Korean. The fundamental underlying rule without difficult grammar jargon.",
    "mentalModelAnalogy": "A vivid, unforgettable mental model or analogy in Korean (e.g., '방 문에는 문지기가 1명만 서 있어야 한다').",
    "contrastiveExample": "English contrastive example sentence (e.g., 'I\\'ll see who can help (O) vs I\\'ll see if who can help (X)')",
    "exampleContext": "Brief Korean explanation about why this example works."
  },
  "decisionTrigger": {
    "triggerA": {
      "expression": "Expression A (e.g., 'see who')",
      "condition": "Specific decision trigger condition in Korean (e.g., '대상이 될 후보는 이미 있고, 그중 누구인지(정체)를 특정할 때')",
      "example": "Natural example sentence in English with Korean context"
    },
    "triggerB": {
      "expression": "Expression B (e.g., 'see if anyone')",
      "condition": "Specific decision trigger condition in Korean (e.g., '도와줄 사람이 있기는 한지(존재 유무)조차 불확실할 때')",
      "example": "Natural example sentence in English with Korean context"
    },
    "keyRuleSummary": "One-line punchy rule formula (e.g., '정체 특정 = who / 존재 유무 = if anyone (문지기는 1명만!)')"
  },
  "pronunciation": {
    "wordOrPhrase": "The key word or phrase from the lesson that needs pronunciation training",
    "phoneticRespelling": "Phonetic respelling with syllable capitals for stress (e.g., 'ayl SEE hoo kn HELP')",
    "koreanPhonetic": "Natural Korean phonetic pronunciation guide showing linked sounds (e.g., '아일 씨 후 끈 헬프')",
    "stressGuide": "Detailed tips in Korean on linking, rhythm, and where to put primary stress."
  },
  "writingTemplate": {
    "situation": "Detailed real-world situation description in Korean (2 sentences describing context)",
    "koreanIntent": "The target Korean sentence the student wants to convey in quotes (e.g. '내일 회의에 누가 참석 가능한지 제가 확인해 볼게요.')",
    "prompt": "Specific 1-second real-life writing challenge in Korean",
    "template": "Fill-in-the-blank English template strictly matching the grammar/expression structure with options in parentheses (e.g. '(Despite / Although) ____________________, we completed the task.')",
    "sampleSentence": "A high-quality sample English sentence completing the template with Korean meaning",
    "tip": "Helpful writing tip in Korean",
    "keyKeywords": ["keyword1", "keyword2", "keyword3"],
    "scenarios": [
      {
        "category": "🏢 비즈니스 / 업무 상황",
        "situation": "Detailed workplace situation in Korean",
        "koreanIntent": "Target Korean sentence to convey",
        "template": "English template matching the grammar topic",
        "sampleSentence": "Model English sentence",
        "keyKeywords": ["keyword1", "keyword2", "keyword3"],
        "tip": "Tip for business scenario"
      },
      {
        "category": "☕ 일상 / 대화 상황",
        "situation": "Detailed daily conversation situation in Korean",
        "koreanIntent": "Target Korean sentence to convey",
        "template": "English template matching the grammar topic",
        "sampleSentence": "Model English sentence",
        "keyKeywords": ["keyword1", "keyword2", "keyword3"],
        "tip": "Tip for daily scenario"
      }
    ]
  },
  "quizzes": [
    {
      "id": "A unique string ID, e.g., 'q1', 'q2', etc.",
      "question": "The question in Korean testing interference check (can include English sentence with blanks or asking to find natural sentences)",
      "choices": [
        "Four plausible multiple-choice options. Make them deceptive based on the wrong cognitive patterns."
      ],
      "correctIndex": "0-indexed integer (0, 1, 2, or 3) representing the correct choice",
      "rationale": "Extremely detailed explanation in Korean explaining why the correct choice is correct and why EACH of the other options is incorrect. CRITICAL: Use letter labels A번, B번, C번, D번 to reference choices."
    }
  ]
}

Important Instructions:
1. Make sure to generate exactly the requested number of distinct multiple-choice quizzes under the 'quizzes' array.
2. In the quizzes, test different angles of the topic.
3. Keep the tone friendly, encouraging, and highly professional yet simple (ELI10).
4. CRITICAL: Never use raw unescaped double quotes (\") inside any JSON string values. For any inner quotations, use single quotes (') instead.
5. Ensure the JSON is completely valid, all quotation marks are escaped properly, and no trailing commas exist.`;

export async function generateLessonFromText(
  text: string,
  apiKey: string,
  questionCount: number = 5
): Promise<Lesson> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("분석할 텍스트가 입력되지 않았습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}
            
            Strict Request Parameters:
            - Generate EXACTLY ${questionCount} multiple-choice quizzes under the 'quizzes' array.
            
            Here is the study text to analyze:
            """
            ${cleanText}
            """`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          prediction: {
            type: "object",
            properties: {
              sentenceA: { type: "string" },
              sentenceB: { type: "string" },
              incorrectChoice: { type: "string", enum: ["A", "B"] },
              trapExplanation: { type: "string" }
            },
            required: ["sentenceA", "sentenceB", "incorrectChoice", "trapExplanation"]
          },
          eli10: {
            type: "object",
            properties: {
              corePrinciple: { type: "string" },
              mentalModelAnalogy: { type: "string" },
              contrastiveExample: { type: "string" },
              exampleContext: { type: "string" }
            },
            required: ["corePrinciple", "mentalModelAnalogy", "contrastiveExample", "exampleContext"]
          },
          decisionTrigger: {
            type: "object",
            properties: {
              triggerA: {
                type: "object",
                properties: {
                  expression: { type: "string" },
                  condition: { type: "string" },
                  example: { type: "string" }
                },
                required: ["expression", "condition", "example"]
              },
              triggerB: {
                type: "object",
                properties: {
                  expression: { type: "string" },
                  condition: { type: "string" },
                  example: { type: "string" }
                },
                required: ["expression", "condition", "example"]
              },
              keyRuleSummary: { type: "string" }
            },
            required: ["triggerA", "triggerB", "keyRuleSummary"]
          },
          pronunciation: {
            type: "object",
            properties: {
              wordOrPhrase: { type: "string" },
              phoneticRespelling: { type: "string" },
              koreanPhonetic: { type: "string" },
              stressGuide: { type: "string" }
            },
            required: ["wordOrPhrase", "phoneticRespelling", "koreanPhonetic", "stressGuide"]
          },
          writingTemplate: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              template: { type: "string" },
              sampleSentence: { type: "string" },
              tip: { type: "string" }
            },
            required: ["prompt", "template", "sampleSentence", "tip"]
          },
          quizzes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: {
                  type: "array",
                  items: { type: "string" }
                },
                correctIndex: { type: "integer" },
                rationale: { type: "string" }
              },
              required: ["question", "choices", "correctIndex", "rationale"]
            }
          }
        },
        required: ["title", "prediction", "eli10", "decisionTrigger", "pronunciation", "writingTemplate", "quizzes"]
      },
      temperature: 0.2
    }
  };

  try {
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP 에러 ${response.status}`;
      throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    const cleanedText = cleanJsonString(responseText);
    const parsedJson = JSON.parse(cleanedText);

    // Build randomized options with remapped rationales
    const rawQuizzes = Array.isArray(parsedJson.quizzes) ? parsedJson.quizzes : [];
    const normalized = normalizeLesson({
      id: `lesson-${Date.now()}`,
      title: parsedJson.title || "영어 표현 심층 학습",
      sourceText: cleanText,
      createdAt: Date.now(),
      prediction: parsedJson.prediction,
      eli10: parsedJson.eli10,
      decisionTrigger: parsedJson.decisionTrigger,
      pronunciation: parsedJson.pronunciation,
      writingTemplate: parsedJson.writingTemplate,
      quizzes: rawQuizzes.map((quiz: any, index: number) => {
        const originalChoices: string[] = Array.isArray(quiz.choices) ? quiz.choices : [];
        const originalCorrectIndex: number = typeof quiz.correctIndex === 'number' ? quiz.correctIndex : 0;
        const correctChoiceValue = originalChoices[originalCorrectIndex];

        // Shuffle choices while maintaining correct index
        const mappedChoices = originalChoices.map((choice, i) => ({
          choice,
          isCorrect: i === originalCorrectIndex,
          originalLetter: String.fromCharCode(65 + i)
        }));

        for (let i = mappedChoices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mappedChoices[i], mappedChoices[j]] = [mappedChoices[j], mappedChoices[i]];
        }

        const shuffledChoices = mappedChoices.map(m => m.choice);
        const shuffledCorrectIndex = mappedChoices.findIndex(m => m.isCorrect);

        let remappedRationale = quiz.rationale || "";
        mappedChoices.forEach((item, newIndex) => {
          const newLetter = String.fromCharCode(65 + newIndex);
          if (item.originalLetter !== newLetter) {
            const regex = new RegExp(`(?<![A-Z])${item.originalLetter}번`, 'g');
            remappedRationale = remappedRationale.replace(regex, `__TEMP_${newLetter}__`);
          }
        });
        remappedRationale = remappedRationale.replace(/__TEMP_([A-D])__/g, '$1번');

        return {
          id: quiz.id || `q-${index + 1}`,
          question: quiz.question || `Question ${index + 1}`,
          choices: shuffledChoices.length > 0 ? shuffledChoices : [correctChoiceValue || "Option A"],
          correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
          rationale: remappedRationale
        };
      })
    });

    return normalized;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "학습자료를 생성하는 도중 알 수 없는 에러가 발생했습니다.");
  }
}

export async function serializeLesson(lesson: Lesson): Promise<string> {
  try {
    const jsonStr = JSON.stringify(lesson);
    const byteArray = new TextEncoder().encode(jsonStr);
    
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
    let binary = "";
    for (let i = 0; i < concat.byteLength; i++) {
      binary += String.fromCharCode(concat[i]);
    }
    const base64 = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
      
    return base64;
  } catch (error) {
    console.error("Failed to serialize expression lesson:", error);
    return "";
  }
}

export async function deserializeLesson(base64Str: string): Promise<Lesson | null> {
  if (!base64Str) return null;
  try {
    let standardBase64 = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    while (standardBase64.length % 4) {
      standardBase64 += "=";
    }
    
    const binaryStr = atob(standardBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
    const jsonStr = new TextDecoder().decode(concat);
    const parsed = JSON.parse(jsonStr);
    return normalizeLesson(parsed);
  } catch (error) {
    console.error("Failed to deserialize expression lesson:", error);
    return null;
  }
}

// Vocabulary Mode System Prompt for Gemini
const VOCABULARY_SYSTEM_PROMPT = `You are a native English linguistic expert and educational tutor. Your task is to analyze the provided English vocabulary root word, word list, or text, identify all distinct vocabulary words, meanings, or nuances, and generate a list of 5-Stage Cognitive Progressive Learning Materials.

For each distinct word, derivative, or nuance, generate a corresponding lesson study material.

Your response MUST be a single, valid JSON object with a "lessons" array containing the lesson objects. Do not wrap in markdown \`\`\`json ... \`\`\`, just return the raw JSON string.

You must fill out all fields in KOREAN (except the English keywords/examples where appropriate).

Strict Schema Requirements:
{
  "lessons": [
    {
      "title": "The vocabulary word and its part of speech/meaning in Korean (e.g., 'affect (v. 영향을 미치다)')",
      "prediction": {
        "sentenceA": "Sentence A in English (e.g. 'Smoking affects your health.')",
        "sentenceB": "Sentence B in English (e.g. 'Smoking effects your health.')",
        "incorrectChoice": "A" or "B",
        "trapExplanation": "Explain in Korean why Korean learners confuse affect vs effect and why the incorrect choice is wrong."
      },
      "eli10": {
        "corePrinciple": "Explain the core feeling of the word and native sensations in Korean in a friendly tone for a 10-year-old child (ELI10).",
        "mentalModelAnalogy": "A clever, highly intuitive analogy or visual metaphor in Korean to visualize the core nuance.",
        "contrastiveExample": "A clear, natural example sentence in English showing the word in its typical context",
        "exampleContext": "Brief Korean explanation about why this example is natural."
      },
      "decisionTrigger": {
        "triggerA": {
          "expression": "This vocabulary word",
          "condition": "When to use this specific word in Korean",
          "example": "Natural example sentence"
        },
        "triggerB": {
          "expression": "A confusing synonym or derivative (e.g., effect)",
          "condition": "When to use the other word in Korean",
          "example": "Natural example sentence"
        },
        "keyRuleSummary": "One-line punchy rule formula"
      },
      "pronunciation": {
        "wordOrPhrase": "The key vocabulary word",
        "phoneticRespelling": "Phonetic respelling with syllable capitals for stress (e.g., 'uh-FEKT')",
        "koreanPhonetic": "Natural Korean phonetic pronunciation guide (e.g., '어펙트')",
        "stressGuide": "Detailed tips in Korean on linking, rhythm, and where to put primary stress."
      },
      "writingTemplate": {
        "prompt": "Specific 1-second real-life writing challenge in Korean",
        "template": "Fill-in-the-blank English template",
        "sampleSentence": "A sample English sentence completing the template with Korean meaning",
        "tip": "Helpful writing tip in Korean"
      },
      "quizzes": [
        {
          "question": "A multiple-choice question in Korean testing usage in context.",
          "choices": [
            "Four plausible options in English (or Korean as appropriate)."
          ],
          "correctIndex": "0-indexed integer (0, 1, 2, or 3) representing the correct choice",
          "rationale": "Extremely detailed explanation in Korean explaining why the correct choice is correct and why EACH other option is incorrect. Reference choices using A번, B번, C번, D번."
        }
      ]
    }
  ]
}

Important Instructions:
1. Make sure to generate exactly the requested number of distinct multiple-choice quizzes under the 'quizzes' array for each lesson.
2. Keep the tone friendly, encouraging, and highly professional yet simple (ELI10).
3. CRITICAL: Never use raw unescaped double quotes (\") inside any JSON string values. Use single quotes (') instead.
4. Ensure the JSON is completely valid, all quotation marks are escaped properly, and no trailing commas exist.`;

export async function generateVocabularyLessons(
  text: string,
  apiKey: string,
  questionCount: number = 5
): Promise<Lesson[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("분석할 텍스트가 입력되지 않았습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${VOCABULARY_SYSTEM_PROMPT}
            
            Strict Request Parameters:
            - Generate EXACTLY ${questionCount} multiple-choice quizzes under the 'quizzes' array for each lesson.
            
            Here is the study vocabulary/text to analyze:
            """
            ${cleanText}
            """`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          lessons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                prediction: {
                  type: "object",
                  properties: {
                    sentenceA: { type: "string" },
                    sentenceB: { type: "string" },
                    incorrectChoice: { type: "string", enum: ["A", "B"] },
                    trapExplanation: { type: "string" }
                  },
                  required: ["sentenceA", "sentenceB", "incorrectChoice", "trapExplanation"]
                },
                eli10: {
                  type: "object",
                  properties: {
                    corePrinciple: { type: "string" },
                    mentalModelAnalogy: { type: "string" },
                    contrastiveExample: { type: "string" },
                    exampleContext: { type: "string" }
                  },
                  required: ["corePrinciple", "mentalModelAnalogy", "contrastiveExample", "exampleContext"]
                },
                decisionTrigger: {
                  type: "object",
                  properties: {
                    triggerA: {
                      type: "object",
                      properties: {
                        expression: { type: "string" },
                        condition: { type: "string" },
                        example: { type: "string" }
                      },
                      required: ["expression", "condition", "example"]
                    },
                    triggerB: {
                      type: "object",
                      properties: {
                        expression: { type: "string" },
                        condition: { type: "string" },
                        example: { type: "string" }
                      },
                      required: ["expression", "condition", "example"]
                    },
                    keyRuleSummary: { type: "string" }
                  },
                  required: ["triggerA", "triggerB", "keyRuleSummary"]
                },
                pronunciation: {
                  type: "object",
                  properties: {
                    wordOrPhrase: { type: "string" },
                    phoneticRespelling: { type: "string" },
                    koreanPhonetic: { type: "string" },
                    stressGuide: { type: "string" }
                  },
                  required: ["wordOrPhrase", "phoneticRespelling", "koreanPhonetic", "stressGuide"]
                },
                writingTemplate: {
                  type: "object",
                  properties: {
                    prompt: { type: "string" },
                    template: { type: "string" },
                    sampleSentence: { type: "string" },
                    tip: { type: "string" }
                  },
                  required: ["prompt", "template", "sampleSentence", "tip"]
                },
                quizzes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      choices: {
                        type: "array",
                        items: { type: "string" }
                      },
                      correctIndex: { type: "integer" },
                      rationale: { type: "string" }
                    },
                    required: ["question", "choices", "correctIndex", "rationale"]
                  }
                }
              },
              required: ["title", "prediction", "eli10", "decisionTrigger", "pronunciation", "writingTemplate", "quizzes"]
            }
          }
        },
        required: ["lessons"]
      },
      temperature: 0.2
    }
  };

  try {
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP 에러 ${response.status}`;
      throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    const cleanedText = cleanJsonString(responseText);
    const parsedJson = JSON.parse(cleanedText);

    const lessonsArray = Array.isArray(parsedJson.lessons) ? parsedJson.lessons : [];
    if (lessonsArray.length === 0) {
      throw new Error("단어/표현 분석 결과를 생성하지 못했습니다. 입력 내용을 확인해 주세요.");
    }

    return lessonsArray.map((rawLesson: any, lessonIdx: number) => {
      const rawQuizzes = Array.isArray(rawLesson.quizzes) ? rawLesson.quizzes : [];
      return normalizeLesson({
        id: `lesson-vocab-${Date.now()}-${lessonIdx}`,
        title: rawLesson.title || `Vocabulary Unit ${lessonIdx + 1}`,
        sourceText: cleanText,
        createdAt: Date.now() + lessonIdx,
        isVocabulary: true,
        prediction: rawLesson.prediction,
        eli10: rawLesson.eli10,
        decisionTrigger: rawLesson.decisionTrigger,
        pronunciation: rawLesson.pronunciation,
        writingTemplate: rawLesson.writingTemplate,
        quizzes: rawQuizzes.map((quiz: any, qIdx: number) => {
          const originalChoices: string[] = Array.isArray(quiz.choices) ? quiz.choices : [];
          const originalCorrectIndex: number = typeof quiz.correctIndex === 'number' ? quiz.correctIndex : 0;
          const correctChoiceValue = originalChoices[originalCorrectIndex];

          const mappedChoices = originalChoices.map((choice, i) => ({
            choice,
            isCorrect: i === originalCorrectIndex,
            originalLetter: String.fromCharCode(65 + i)
          }));

          for (let i = mappedChoices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mappedChoices[i], mappedChoices[j]] = [mappedChoices[j], mappedChoices[i]];
          }

          const shuffledChoices = mappedChoices.map(m => m.choice);
          const shuffledCorrectIndex = mappedChoices.findIndex(m => m.isCorrect);

          let remappedRationale = quiz.rationale || "";
          mappedChoices.forEach((item, newIndex) => {
            const newLetter = String.fromCharCode(65 + newIndex);
            if (item.originalLetter !== newLetter) {
              const regex = new RegExp(`(?<![A-Z])${item.originalLetter}번`, 'g');
              remappedRationale = remappedRationale.replace(regex, `__TEMP_${newLetter}__`);
            }
          });
          remappedRationale = remappedRationale.replace(/__TEMP_([A-D])__/g, '$1번');

          return {
            id: quiz.id || `q-${lessonIdx + 1}-${qIdx + 1}`,
            question: quiz.question || `Question ${qIdx + 1}`,
            choices: shuffledChoices.length > 0 ? shuffledChoices : [correctChoiceValue || "Option A"],
            correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
            rationale: remappedRationale
          };
        })
      });
    });
  } catch (error: any) {
    console.error("Gemini Vocabulary Generation Error:", error);
    throw new Error(error.message || "어휘 학습자료 생성 도중 알 수 없는 에러가 발생했습니다.");
  }
}

/**
 * 5단계 작문 실시간 AI 첨삭 및 코칭 함수
 */
export async function evaluateUserSentence(
  lesson: Lesson,
  userSentence: string,
  apiKey: string,
  activeContext?: { situation?: string; koreanIntent?: string; template?: string }
): Promise<WritingEvaluationResult> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");
  if (!userSentence.trim()) throw new Error("작문 문장을 입력해 주세요.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an encouraging, expert native English writing coach and tutor.
The student is practicing this English topic:
- Topic Title: "${lesson.title}"
- Core Principle: "${lesson.eli10?.corePrinciple || lesson.eli5?.explanation || ''}"
- Decision Trigger / Key Rule: "${lesson.decisionTrigger?.keyRuleSummary || lesson.memoryTips?.tipFormula || ''}"
- Real-Life Situation Given: "${activeContext?.situation || lesson.writingTemplate?.situation || ''}"
- Target Korean Intent: "${activeContext?.koreanIntent || lesson.writingTemplate?.koreanIntent || ''}"
- Writing Template Given: "${activeContext?.template || lesson.writingTemplate?.template || ''}"
- Student's Written Sentence: "${userSentence.trim()}"

Evaluate the student's sentence based on:
1. Did they accurately convey the intended Korean meaning in this specific real-world situation?
2. Did they apply the target grammar/expression correctly?
3. Naturalness in native English business/daily contexts.
4. Minor grammar, preposition, or spelling errors.

Return a JSON object matching this schema:
{
  "isNatural": true or false,
  "score": integer between 1 and 100,
  "feedback": "Warm, encouraging 1-2 sentences in Korean evaluating how well their sentence fits the situation and what they did well.",
  "correctedSentence": "The grammatically perfected version of their sentence in English.",
  "nativeAlternative": "An even more natural/idiomatic alternative expression a native speaker would say in this exact situation in English.",
  "explanation": "Clear, punchy 1-2 sentence Korean explanation of why this correction/alternative is better in this situation."
}

Do not wrap in markdown \`\`\`json. Return raw JSON string only. Use single quotes inside string values if needed.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 첨삭 결과를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WritingEvaluationResult;
}

/**
 * Generates 2 bespoke, highly vivid real-world writing scenarios (Business vs Daily)
 * tailored precisely to the lesson's target expressions.
 */
export async function generateWritingScenarios(
  lesson: Lesson,
  apiKey: string
): Promise<WritingTemplateData> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert native English instructional designer and tutor.
Analyze this English lesson topic:
- Title: "${lesson.title}"
- Core Principle: "${lesson.eli10?.corePrinciple || lesson.eli5?.explanation || ''}"
- Decision Trigger / Key Rule: "${lesson.decisionTrigger?.keyRuleSummary || lesson.memoryTips?.tipFormula || ''}"
- Expression A: "${lesson.decisionTrigger?.triggerA?.expression || ''}" (${lesson.decisionTrigger?.triggerA?.condition || ''})
- Expression B: "${lesson.decisionTrigger?.triggerB?.expression || ''}" (${lesson.decisionTrigger?.triggerB?.condition || ''})
- Example sentence: "${lesson.eli10?.contrastiveExample || lesson.eli5?.example || ''}"

Generate 2 DISTINCT, HIGHLY VIVID, REAL-WORLD SITUATIONAL SCENARIOS (1 Business/Workplace scenario, 1 Daily Life/Casual scenario) tailored specifically to test and apply these exact expressions in 1 second.
CRITICAL: Never use a generic 'I need to...' template unless the expression is literally 'need to'. The template MUST match the actual grammar structure of this lesson (e.g. for Despite vs Although, write '(Despite / Although) ____________________, ____________________.').

Return a JSON object with this exact schema:
{
  "situation": "Detailed Workplace scenario in Korean (2 sentences describing context)",
  "koreanIntent": "The specific Korean sentence the student wants to say in quotes (e.g. '내일 회의에 누가 참석 가능한지 확인해 볼게요.')",
  "prompt": "Punchy 1-line writing challenge in Korean",
  "template": "English fill-in-the-blank template matching the grammar topic with options in parentheses",
  "sampleSentence": "A natural, high-quality native English completion of the template",
  "tip": "Helpful tip in Korean explaining the choice in this scenario",
  "keyKeywords": ["keyword1", "keyword2", "keyword3"],
  "scenarios": [
    {
      "category": "🏢 비즈니스 / 업무 상황",
      "situation": "Detailed workplace situation in Korean",
      "koreanIntent": "The target Korean sentence to say",
      "template": "English fill-in-the-blank template matching the grammar topic",
      "sampleSentence": "Natural native English sentence",
      "keyKeywords": ["keyword1", "keyword2", "keyword3"],
      "tip": "Tip in Korean"
    },
    {
      "category": "☕ 일상 / 대화 상황",
      "situation": "Detailed daily conversation situation in Korean",
      "koreanIntent": "The target Korean sentence to say",
      "template": "English fill-in-the-blank template matching the grammar topic",
      "sampleSentence": "Natural native English sentence",
      "keyKeywords": ["keyword1", "keyword2", "keyword3"],
      "tip": "Tip in Korean"
    }
  ]
}

Do not wrap in markdown \`\`\`json. Return raw JSON string only. Use single quotes inside string values if needed.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 실전 시나리오를 생성하지 못했습니다.");
  return JSON.parse(cleanJsonString(text)) as WritingTemplateData;
}

export async function generateAdditionalQuizzes(
  lesson: Lesson,
  wrongDetailsOrCount: any = 3,
  countOrApiKey: any = '',
  optionalApiKey?: string
): Promise<QuizItem[]> {
  let count = 3;
  let apiKey = '';
  let wrongDetails: any[] = [];

  if (typeof wrongDetailsOrCount === 'number') {
    count = wrongDetailsOrCount;
    apiKey = countOrApiKey;
  } else if (Array.isArray(wrongDetailsOrCount)) {
    wrongDetails = wrongDetailsOrCount;
    count = typeof countOrApiKey === 'number' ? countOrApiKey : 3;
    apiKey = optionalApiKey || '';
  } else {
    apiKey = optionalApiKey || countOrApiKey || '';
  }

  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert English quiz creator.
The student is studying this topic:
Topic Title: "${lesson.title}"
Core Principle: "${lesson.eli10?.corePrinciple || lesson.eli5?.explanation || ''}"
Decision Trigger: "${lesson.decisionTrigger?.keyRuleSummary || lesson.memoryTips?.tipFormula || ''}"
Original source text: "${lesson.sourceText}"

Generate EXACTLY ${count} NEW and UNIQUE multiple-choice quizzes that test different nuances and real-world usage scenarios of this topic.

Return a JSON object with this exact structure:
{
  "quizzes": [
    {
      "id": "A unique string ID, e.g. 'extra-q1'",
      "question": "Question in Korean with English sentences or blanks",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "rationale": "Extremely detailed explanation in Korean explaining why the correct choice is correct and why each other choice is wrong. Reference choices using A번, B번, C번, D번."
    }
  ]
}

Do not wrap in markdown \`\`\`json. Return raw JSON string only.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 퀴즈를 반환하지 않았습니다.");

  const parsed = JSON.parse(cleanJsonString(text));
  const rawQuizzes = Array.isArray(parsed.quizzes) ? parsed.quizzes : [];

  return rawQuizzes.map((quiz: any, index: number) => {
    const originalChoices: string[] = Array.isArray(quiz.choices) ? quiz.choices : [];
    const originalCorrectIndex: number = typeof quiz.correctIndex === 'number' ? quiz.correctIndex : 0;
    const correctChoiceValue = originalChoices[originalCorrectIndex];

    const mappedChoices = originalChoices.map((choice, i) => ({
      choice,
      isCorrect: i === originalCorrectIndex,
      originalLetter: String.fromCharCode(65 + i)
    }));

    for (let i = mappedChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mappedChoices[i], mappedChoices[j]] = [mappedChoices[j], mappedChoices[i]];
    }

    const shuffledChoices = mappedChoices.map(m => m.choice);
    const shuffledCorrectIndex = mappedChoices.findIndex(m => m.isCorrect);

    let remappedRationale = quiz.rationale || "";
    mappedChoices.forEach((item, newIndex) => {
      const newLetter = String.fromCharCode(65 + newIndex);
      if (item.originalLetter !== newLetter) {
        const regex = new RegExp(`(?<![A-Z])${item.originalLetter}번`, 'g');
        remappedRationale = remappedRationale.replace(regex, `__TEMP_${newLetter}__`);
      }
    });
    remappedRationale = remappedRationale.replace(/__TEMP_([A-D])__/g, '$1번');

    return {
      id: quiz.id || `extra-q-${Date.now()}-${index + 1}`,
      question: quiz.question || `Question ${index + 1}`,
      choices: shuffledChoices.length > 0 ? shuffledChoices : [correctChoiceValue || "Option A"],
      correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
      rationale: remappedRationale
    };
  });
}

/**
 * Sends a user follow-up question context-aware to Gemini
 */
export async function askGeminiFollowUpQuestion(
  lesson: Lesson,
  userQuestion: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }> = [],
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const historyPrompt = chatHistory.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');

  const prompt = `You are a friendly, encouraging native English tutor specializing in Explain-Like-I'm-10 (ELI10) methodology.
The student is currently learning this topic:
Topic Title: "${lesson.title}"
Core Principle: "${lesson.eli10?.corePrinciple || lesson.eli5?.explanation || ''}"
Mental Model Analogy: "${lesson.eli10?.mentalModelAnalogy || lesson.eli5?.analogy || ''}"
Decision Trigger: "${lesson.decisionTrigger?.keyRuleSummary || lesson.memoryTips?.tipFormula || ''}"
Source text: "${lesson.sourceText}"

Previous Q&A Conversation with the student:
${historyPrompt ? historyPrompt : '(No previous conversation)'}

The student has asked this follow-up question:
"${userQuestion}"

Provide a warm, clear, and direct explanation in Korean.
Guidelines:
1. Explain in simple, intuitive terms suitable for a 10-year-old child (ELI10).
2. Avoid complicated grammatical jargon.
3. Provide clear English contrastive examples where relevant.
4. Keep the response concise, punchy, and structured with bullet points if helpful.`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.4
    }
  };

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `HTTP 에러 ${response.status}`;
    throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
  }

  const data = await response.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) {
    throw new Error("Gemini가 답변을 반환하지 않았습니다.");
  }

  return answer.trim();
}

/**
 * 3단계 오답 코칭 Step 1: 정답을 가리고 인지적 착각 원인과 소크라테스식 힌트 질문 생성
 */
export async function generateWrongAnswerCoachingStep1(
  question: string,
  choices: string[],
  userWrongAnswer: string,
  apiKey: string
): Promise<WrongAnswerCoachingStep1Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const choicesStr = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n');
  const prompt = `You are a Socratic English tutor. The student solved an English quiz and chose a WRONG answer.
Do NOT reveal the correct answer. The goal is to stimulate cognitive retrieval and self-correction.

Quiz Question:
${question}

Choices:
${choicesStr}

Student's Selected Wrong Answer:
"${userWrongAnswer}"

Provide:
1. cognitiveIllusion: Why did the student likely choose this wrong answer? Analyze the cognitive trap or Korean translation habit in 1-2 Korean sentences.
2. clueQuestion: ONE decisive Socratic clue question (contextual or grammatical hint) in Korean that leads the student to infer the correct answer without naming it directly.

Output JSON only matching this schema:
{
  "cognitiveIllusion": "왜 이 오답을 골랐을지 인지적 착각 원인 분석",
  "clueQuestion": "정답을 유추할 수 있는 결정적 단서 질문"
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 1단계 코칭 힌트를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep1Data;
}

/**
 * 3단계 오답 코칭 Step 2: 뉘앙스 비교 및 멘탈 모델 교정 + 원어민 짝꿍 표현 2개
 */
export async function generateWrongAnswerCoachingStep2(
  question: string,
  userWrongAnswer: string,
  correctAnswer: string,
  rationale: string,
  apiKey: string
): Promise<WrongAnswerCoachingStep2Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const prompt = `You are an expert native English linguist and coach.
The student has now seen the correct answer. Your goal is deep nuance comparison and mental model correction.

Question:
${question}

Student's Wrong Choice:
"${userWrongAnswer}"

Actual Correct Answer:
"${correctAnswer}"

Explanation/Rationale:
${rationale}

Provide:
1. nuanceContrast: Contrast the nuance difference between [Wrong Choice] and [Correct Answer] in business/daily real-world contexts in EXACTLY 2 clear Korean sentences.
2. collocations: Provide EXACTLY 2 native English collocations (natural partner phrases) featuring the correct word/expression, with Korean meaning and a practical example sentence.

Output JSON matching this schema:
{
  "nuanceContrast": "오답과 정답의 뉘앙스 차이 실사용 맥락 2문장 대조",
  "collocations": [
    {
      "phrase": "Native collocation 1",
      "meaning": "한글 의미",
      "example": "Practical example sentence in English"
    },
    {
      "phrase": "Native collocation 2",
      "meaning": "한글 의미",
      "example": "Practical example sentence in English"
    }
  ]
}
Do not wrap in markdown \`\`\`json.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 2단계 뉘앙스 대조를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep2Data;
}

/**
 * 3단계 오답 코칭 Step 3: 즉시 적용을 위한 실전 변형 문제 2개 (Far Transfer)
 */
export async function generateWrongAnswerCoachingStep3(
  question: string,
  userWrongAnswer: string,
  correctAnswer: string,
  apiKey: string
): Promise<WrongAnswerCoachingStep3Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert English quiz creator.
The student made a mistake on a specific grammar/vocabulary/expression concept:
Original Question Context: "${question}"
Wrong Choice: "${userWrongAnswer}"
Correct Choice: "${correctAnswer}"

Generate EXACTLY 2 NEW 3-choice multiple-choice fill-in-the-blank questions in DIFFERENT real-world contexts (Far Transfer) that test the same underlying concept/rule.

Output JSON matching this schema:
{
  "transferQuizzes": [
    {
      "id": "t1",
      "question": "Question sentence in English with a blank (e.g. She decided to go ________ the bad weather.)",
      "choices": ["Option A", "Option B", "Option C"],
      "correctIndex": 0,
      "rationale": "Clear Korean explanation of why this answer is correct and why other choices are wrong."
    },
    {
      "id": "t2",
      "question": "Question sentence in English with a blank",
      "choices": ["Option A", "Option B", "Option C"],
      "correctIndex": 1,
      "rationale": "Clear Korean explanation."
    }
  ]
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 3단계 변형 문제를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep3Data;
}
