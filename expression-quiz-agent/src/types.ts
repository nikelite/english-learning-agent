export interface QuizItem {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
  isReview?: boolean;
}

export interface Eli5Data {
  explanation: string;
  analogy: string;
  example: string;
  exampleContext: string;
}

export interface MemoryTipData {
  tipFormula: string;
  conceptA: string;
  conceptADesc: string;
  conceptB: string;
  conceptBDesc: string;
  visualImage: string;
}

export interface PronunciationData {
  wordOrPhrase: string;
  phoneticRespelling: string;
  koreanPhonetic: string;
  stressGuide: string;
}

// 1단계: 30초 인지 추측 (Prediction First)
export interface PredictionData {
  sentenceA: string; // 예: "I'll see who can help."
  sentenceB: string; // 예: "I'll see if who can help."
  incorrectChoice: 'A' | 'B'; // 틀린 문장
  trapExplanation: string; // 왜 이 문장이 어색하고 원어민이 쓰지 않는지 인지적 함정 설명
}

// 2단계: 핵심 원리 & 직관적 비유 (ELI10 & Mental Model)
export interface Eli10Data {
  corePrinciple: string; // 문법 용어 없는 핵심 원리
  mentalModelAnalogy: string; // 머릿속에 바로 그려지는 직관적 비유 (예: 1명의 문지기 메타포)
  contrastiveExample: string; // 핵심 대조 예문
  exampleContext: string; // 예문 문맥 설명
}

// 3단계: 상황별 선택 기준 (Decision Trigger)
export interface DecisionTriggerItem {
  expression: string; // 표현/패턴 (예: "see who")
  condition: string; // 언제 써야 하는지 상황별 기준 (예: "대상이 될 후보는 이미 있고, 그중 '누구인지(정체)' 특정할 때")
  example: string; // 실사용 예문
}

export interface DecisionTriggerData {
  triggerA: DecisionTriggerItem;
  triggerB: DecisionTriggerItem;
  keyRuleSummary: string; // 한눈에 들어오는 요약 공식
}

// 5단계: 1초 내 상황 작문 (Self-Reference Generation)
export interface WritingScenarioOption {
  category: string; // 예: "🏢 비즈니스 / 업무", "☕ 일상 / 대화"
  situation: string; // 구체적 실전 상황 설명 (예: "내일 긴급 팀 미팅에 참석할 수 있는 사람이 누구인지 명단을 확인해야 할 때")
  koreanIntent: string; // 말하고자 하는 한국어 의도 (예: "내일 회의에 누가 참석 가능한지 확인해 볼게요.")
  template: string; // 빈칸 템플릿 (예: "I will check (who / if anyone) ____________________.")
  sampleSentence: string; // 모범 완성 문장 (예: "I will check who is available for tomorrow's meeting.")
  keyKeywords?: string[]; // 추천 단어/표현 힌트 (예: ["available", "join the meeting"])
  tip?: string; // 팁
}

export interface WritingTemplateData {
  situation?: string; // 구체적 실전 상황 맥락
  koreanIntent?: string; // 표현하고자 하는 한국어 문장 의도
  prompt: string; // 작문 챌린지 지시문
  template: string; // 빈칸 템플릿 (예: "I need to check (who / if anyone) ____________________.")
  sampleSentence: string; // 모범 예시 문장
  tip: string; // 작문 팁
  keyKeywords?: string[]; // 추천 단어/표현 힌트
  scenarios?: WritingScenarioOption[]; // 다각도 상황 선택지 (비즈니스 / 일상)
}

export interface WritingEvaluationResult {
  isNatural: boolean;
  score: number; // 1 ~ 100
  feedback: string; // 칭찬 및 직관적 피드백
  correctedSentence: string; // 교정된 문장
  nativeAlternative: string; // 더 자연스러운 원어민식 대체 표현
  explanation: string; // 뉘앙스/문법 교정 해설
}

export interface Lesson {
  id: string;
  title: string;
  sourceText: string;
  createdAt: number;
  
  // 5-Stage Progressive Learning Data
  prediction?: PredictionData;
  eli10?: Eli10Data;
  decisionTrigger?: DecisionTriggerData;
  pronunciation: PronunciationData;
  writingTemplate?: WritingTemplateData;
  quizzes: QuizItem[];

  // Legacy / Fallback Support
  eli5?: Eli5Data;
  memoryTips?: MemoryTipData;

  isDraft?: boolean;
  isVocabulary?: boolean;
  ownerId?: string | null;
  sharedWith?: string[];
  userAnswers?: Record<string, number>;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: Array<{ score: number; total: number; solvedAt: number }>;
  userWritingSentence?: string;
  userWritingFeedback?: WritingEvaluationResult;
}

export interface WrongAnswer {
  id: string;
  lessonId: string;
  lessonTitle: string;
  quizItem: QuizItem;
  userAnswerIndex: number;
  timestamp: number;
  isArchived?: boolean;
}

export interface AppStats {
  streak: number;
  lastActiveDate: string | null;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
  masteredCount: number;
}

// AI 원스크린 초압축 마이크로 오답 코칭 (1-Screen Micro Coaching)
export interface MicroCoachingData {
  locationLabel?: string;
  passageExcerpt?: string;
  excerptTranslation?: string;
  connectionExplanation?: string;
  coreNuance: string; // 오답과 정답의 핵심 차이 (1~2줄 직관 해설)
  collocation?: { // 실생활에서 바로 쓰는 원어민 짝꿍 표현 1개
    phrase: string;
    meaning: string;
    example: string;
  };
  transferQuiz: { // 1초 인출 확인 변형 퀴즈 1개
    id: string;
    question: string;
    translation: string;
    choices: string[];
    correctIndex: number;
    rationale: string;
  };
}

export interface WrongAnswerCoachingStep1Data {
  cognitiveIllusion: string;
  clueQuestion: string;
}

export interface WrongAnswerCoachingStep2Data {
  nuanceContrast: string;
  collocations: Array<{
    phrase: string;
    meaning: string;
    example: string;
  }>;
}

export interface TransferQuizItem {
  id: string;
  question: string;
  translation?: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
}

export interface WrongAnswerCoachingStep3Data {
  transferQuizzes: TransferQuizItem[];
}
