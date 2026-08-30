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

export interface Lesson {
  id: string;
  title: string;
  sourceText: string;
  createdAt: number;
  eli5: Eli5Data;
  memoryTips: MemoryTipData;
  pronunciation: PronunciationData;
  quizzes: QuizItem[];
  isDraft?: boolean;
  isVocabulary?: boolean;
  ownerId?: string | null;
  sharedWith?: string[];
  userAnswers?: Record<string, number>;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: Array<{ score: number; total: number; solvedAt: number }>;
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

export interface WrongAnswerCoachingStep1Data {
  cognitiveIllusion: string; // 왜 이 오답을 골랐을지 인지적 착각 원인 분석
  clueQuestion: string; // 정답을 유추할 수 있는 결정적 단서 질문 (소크라테스식 힌트)
}

export interface WrongAnswerCoachingStep2Data {
  nuanceContrast: string; // 오답과 정답의 뉘앙스 차이 대조 (비즈니스/일상 맥락 2문장)
  collocations: Array<{
    phrase: string;
    meaning: string;
    example: string;
  }>; // 원어민이 자주 쓰는 짝꿍 표현 2개
}

export interface TransferQuizItem {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
}

export interface WrongAnswerCoachingStep3Data {
  transferQuizzes: TransferQuizItem[]; // 새로운 맥락의 3지선다 빈칸 문제 2개
}
