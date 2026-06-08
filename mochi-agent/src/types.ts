export interface MochiCard {
  id: string;
  english: string;       // English word or expression
  korean: string;        // Korean meaning
  pos: string;           // Part of speech (e.g. noun, verb, adj)
  exampleEng: string;    // English example sentence
  exampleKor: string;    // Korean translation of example sentence
  tip: string;           // Memorization tip
  phonetic?: string;     // Phonetic respelling (for quizzes)
  level?: string;        // Difficulty/Grade level (e.g. 초등 5학년, 토익 등)
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

export function shuffleChoicesAndRemapRationale(
  rawChoices: string[],
  rawCorrectIndex: number,
  rationale: string
): { choices: string[]; correctIndex: number; rationale: string } {
  if (!rawChoices || rawChoices.length === 0) {
    return { choices: [], correctIndex: 0, rationale };
  }

  const correctChoiceText = rawChoices[rawCorrectIndex] || rawChoices[0];

  // Shuffle choices using standard Fisher-Yates
  const choicesWithIndex = rawChoices.map((choice, cIdx) => ({ choice, cIdx }));
  for (let i = choicesWithIndex.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choicesWithIndex[i], choicesWithIndex[j]] = [choicesWithIndex[j], choicesWithIndex[i]];
  }

  const shuffledChoices = choicesWithIndex.map(c => c.choice);
  const shuffledCorrectIndex = shuffledChoices.indexOf(correctChoiceText);

  // Remap A/B/C/D labels in rationale to match shuffled order
  const LABELS = ['A', 'B', 'C', 'D'];
  const oldToNewIdx: Record<number, number> = {};
  choicesWithIndex.forEach((item, newIdx) => {
    oldToNewIdx[item.cIdx] = newIdx;
  });

  let remappedRationale = rationale || "상세 해설이 없습니다.";

  // Phase 1: Replace old labels -> temp placeholders (avoid collision)
  const TEMP = ['##LABEL_A##', '##LABEL_B##', '##LABEL_C##', '##LABEL_D##'];
  LABELS.forEach((label, oldIdx) => {
    if (oldToNewIdx[oldIdx] !== undefined) {
      const temp = TEMP[oldToNewIdx[oldIdx]];
      remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}번`, 'g'), `${temp}번`);
      remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}\\\b`, 'g'), temp);
    }
  });

  // Also remap number-based references (1번->A, 2번->B, 3번->C, 4번->D)
  for (let oldIdx = 0; oldIdx < 4; oldIdx++) {
    if (oldToNewIdx[oldIdx] !== undefined) {
      const numStr = `${oldIdx + 1}번`;
      const temp = `${TEMP[oldToNewIdx[oldIdx]]}번`;
      remappedRationale = remappedRationale.replace(new RegExp(`(?<![0-9])${numStr}`, 'g'), temp);
    }
  }

  // Phase 2: Replace temp placeholders -> final labels
  TEMP.forEach((temp, idx) => {
    remappedRationale = remappedRationale.replace(new RegExp(temp, 'g'), LABELS[idx]);
  });

  return {
    choices: shuffledChoices,
    correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
    rationale: remappedRationale
  };
}

export function formatLevel(level: string): string {
  if (!level) return 'general';
  
  const match = level.match(/(\d+)\s*학년/);
  if (match) {
    const num = match[1];
    if (level.includes('초등')) {
      return `grade ${num}`;
    } else if (level.includes('중학')) {
      return `grade ${parseInt(num) + 6}`;
    } else if (level.includes('고교') || level.includes('고등')) {
      return `grade ${parseInt(num) + 9}`;
    }
    return `grade ${num}`;
  }
  
  if (level.includes('대학') || level.includes('토익')) {
    return 'college/TOEIC';
  }
  return level;
}
