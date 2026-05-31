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

export interface ReadingLesson {
  id: string;
  title: string;
  passageText: string;
  createdAt: number;
  paragraphs: ReadingParagraph[];
  vocabulary: ReadingVocabulary[];
  quizzes: ReadingQuizItem[];
  ownerId?: string | null;
  sharedWith?: string[];
  userAnswers?: Record<string, number>;
}

export interface WrongReadingAnswer {
  id: string;
  lessonId: string;
  lessonTitle: string;
  quizItem: ReadingQuizItem;
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

export interface SentenceAnalysis {
  sentence: string;
  translation: string;
  vocabulary: { word: string; meaning: string }[];
  expressions: { expression: string; meaning: string; contextNote: string }[];
  grammar: string;
  context: string;
}
