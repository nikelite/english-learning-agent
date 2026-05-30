export interface QuizItem {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
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
}

export interface WrongAnswer {
  id: string;
  lessonId: string;
  lessonTitle: string;
  quizItem: QuizItem;
  userAnswerIndex: number;
  timestamp: number;
}

export interface AppStats {
  streak: number;
  lastActiveDate: string | null;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
  masteredCount: number;
}
