export interface MochiCard {
  id: string;
  english: string;       // English word or expression
  korean: string;        // Korean meaning
  pos: string;           // Part of speech (e.g. noun, verb, adj)
  exampleEng: string;    // English example sentence
  exampleKor: string;    // Korean translation of example sentence
  tip: string;           // Memorization tip
  phonetic?: string;     // Phonetic respelling (for quizzes)
  options?: string[];    // 4 choices for quiz mode (shuffled)
  correctIndex?: number; // Correct choice index for quiz mode
  rationale?: string;    // Rationale for correct/wrong choices
}

export interface MochiDeck {
  id: string;
  name: string;
  createdAt: number;
  cards: MochiCard[];
  tags: string[];
  mode: 'study' | 'quiz';
  isExported: boolean;
  exportedDeckId: string | null;
  exportedDeckName: string | null;
  exportedAt: number | null;
  ownerId?: string | null;
}
