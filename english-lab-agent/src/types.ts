export interface CorrectionItem {
  id: string;
  original: string;
  corrected: string;
  type: 'grammar' | 'expression' | 'vocab' | 'flow';
  explanation: string;
}

export interface LabQuizItem {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  rationale: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
}

export interface LabMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  createdAt: number;
  textUpdated?: boolean;
}

export interface LabLesson {
  id: string;
  title: string;
  sourceText: string;
  correctedText: string;
  overallFeedback: string;
  createdAt: number;
  persona: string;
  style: 'spoken' | 'written';
  corrections: CorrectionItem[];
  quizzes: LabQuizItem[];
  ownerId?: string | null;
  sharedWith?: string[];
  userAnswers?: Record<string, number>;
  solvedAt?: number;
  firstAttemptScore?: { score: number; total: number };
  retryHistory?: Array<{ score: number; total: number; solvedAt: number }>;
  chatHistory?: LabMessage[];
  writingLevel?: string;
  isDraft?: boolean;
}

export interface WrongLabAnswer {
  id: string;
  lessonId: string;
  lessonTitle: string;
  quizItem: LabQuizItem;
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

export interface ConversationSituation {
  title: string;
  myRole: string;
  partnerRole: string;
  openingLine: string;
  goal: string;
}
