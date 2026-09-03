export interface ReadingQuizItem {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
  type: 'comprehension' | 'vocab';
  isReview?: boolean; // Flag to indicate if it was injected from past wrong answers
}

export interface ReadingVocabulary {
  word: string;
  meaning: string;
  sentence: string;
  pronunciation?: string;
  type?: 'vocabulary' | 'grammar' | 'expression' | 'context';
  contextNote?: string;
}

export interface ReadingParagraph {
  id: number;
  englishText: string;
  koreanTranslation: string;
}

// 1초 실전 상황 작문 (Situational Writing)
export interface WritingScenarioOption {
  category: string; // 예: "🔬 과학/학술", "☕ 일상/대화"
  targetWord?: string; // 이 상황에서 집중 연습할 핵심 어휘 1개 (예: "deter (단념시키다/방지하다)")
  situation: string; // 친절하고 이해하기 쉬운 실전 상황 설명
  koreanIntent: string; // 말하고자 하는 한국어 의도
  template: string; // 빈칸 템플릿
  sampleSentence: string; // 모범 완성 문장
  keyKeywords?: string[]; // 추천 단어/표현 힌트
  tip?: string; // 팁
}

export interface WritingTemplateData {
  targetWord?: string;
  situation?: string;
  koreanIntent?: string;
  prompt: string;
  template: string;
  sampleSentence: string;
  tip: string;
  keyKeywords?: string[];
  scenarios?: WritingScenarioOption[];
}

export interface WritingEvaluationResult {
  isNatural: boolean;
  score: number; // 1 ~ 100
  feedback: string;
  correctedSentence: string;
  nativeAlternative: string;
  explanation: string;
}

// AI 원스크린 초압축 마이크로 오답 코칭 (1-Screen Micro Coaching)
export interface MicroCoachingData {
  locationLabel?: string; // 발췌 위치 (예: "📍 본문 제 2문단 (Paragraph 2)")
  passageExcerpt?: string; // 본문에서 직접 발췌한 결정적 핵심 문장/단서
  excerptTranslation?: string; // 발췌 문장의 쉬운 한글 해석
  connectionExplanation?: string; // 발췌한 본문 문장과 문제의 인과관계/단서 연결 설명
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

// 기존 3단계 호환용 인터페이스
export interface WrongAnswerCoachingStep1Data {
  locationLabel?: string;
  passageExcerpt?: string;
  excerptTranslation?: string;
  connectionExplanation?: string;
  socraticHint: string;
  reflectiveQuestion: string;
  guidedChoices: string[];
  guidingInsight: string;
}

export interface WrongAnswerCoachingStep2Data {
  nuanceContrast: string;
  collocations: {
    phrase: string;
    meaning: string;
    example: string;
  }[];
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

export interface ReadingLesson {
  id: string;
  title: string;
  passageText: string;
  createdAt: number;
  paragraphs: ReadingParagraph[];
  vocabulary: ReadingVocabulary[];
  quizzes: ReadingQuizItem[];
  writingTemplate?: WritingTemplateData;
  userWritingSentence?: string;
  userWritingFeedback?: WritingEvaluationResult;
  ownerId?: string | null;
  sharedWith?: string[];
  userAnswers?: Record<string, number>;
  isPending?: boolean;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: Array<{ score: number; total: number; solvedAt: number }>;
  isArchived?: boolean;
  updatedAt?: number;
}

export interface WrongReadingAnswer {
  id: string;
  lessonId: string;
  lessonTitle: string;
  quizItem: ReadingQuizItem;
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

export interface SentenceAnalysis {
  sentence: string;
  translation?: string;
  vocabulary: { word: string; meaning: string }[];
  expressions: { expression: string; meaning: string; contextNote: string }[];
  grammar: string;
  context: string;
}
