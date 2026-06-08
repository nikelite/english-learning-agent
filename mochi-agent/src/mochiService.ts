import { shuffleChoicesAndRemapRationale, formatLevel } from './types';
import type { MochiCard } from './types';

const BASE_URL = 'https://app.mochi.cards/api';

function getAuthHeader(apiKey: string) {
  return `Basic ${btoa(apiKey + ':')}`;
}

export async function fetchMochiDecks(apiKey: string): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/decks`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(apiKey),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mochi 덱 목록 조회 실패: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.docs || [];
}

export async function createMochiDeck(
  name: string,
  apiKey: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const body: any = { name };
  if (parentId) {
    body['parent-id'] = parentId;
  }

  const response = await fetch(`${BASE_URL}/decks`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mochi 덱 생성 실패: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function createMochiCard(
  card: MochiCard,
  deckId: string,
  tags: string[],
  mode: 'study' | 'quiz',
  style: 'eng-first' | 'kor-first' | 'both',
  apiKey: string
): Promise<void> {
  const cleanTags = tags.map(t => t.trim().replace(/^#/, '')).filter(Boolean);

  const createCardReq = async (content: string) => {
    const response = await fetch(`${BASE_URL}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        'deck-id': deckId,
        'manual-tags': cleanTags,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi 카드 생성 실패: ${response.status} ${errorText}`);
    }
  };

  if (mode === 'quiz') {
    // Shuffling choices and remapping rationale using shared utility
    const result = shuffleChoicesAndRemapRationale(
      card.options || [],
      card.correctIndex ?? 0,
      card.rationale || ''
    );
    const shuffledOptions = result.choices;
    const correctWord = shuffledOptions[result.correctIndex] || card.english;
    const remappedRationale = result.rationale;

    // Replace curly braces/clozes in sentence with a blank (e.g. _______)
    const blankSentence = card.exampleEng.replace(/\{\{(?:c\d::)?(.*?)\}\}/gi, '_______');

    const formattedLevel = formatLevel(card.level || '');
    const cleanPhonetic = card.phonetic ? card.phonetic.replace(/[\[\]]/g, '') : '';
    const phoneticPart = cleanPhonetic ? ` [${cleanPhonetic}]` : '';

    const content = `${blankSentence}

**전체 번역:** ${card.korean}

**선택지:**
${shuffledOptions.map((opt, i) => `- ${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}

---

**${correctWord}${phoneticPart} | ${card.pos} | ${formattedLevel}**

**해설:**
${remappedRationale}

**암기 팁:**
${card.tip}`;

    await createCardReq(content);
  } else {
    // Memorization Card Mode
    if (style === 'eng-first' || style === 'both') {
      const content = `**${card.english}** ${card.phonetic ? `${card.phonetic}` : ''}

---

**뜻:** ${card.korean} (${card.pos})
**단어 레벨:** ${card.level || '일반'}

**예문:**
- **ENG:** ${card.exampleEng}
- **KOR:** ${card.exampleKor}

**암기 팁:**
${card.tip}`;
      await createCardReq(content);
    }

    if (style === 'kor-first' || style === 'both') {
      const content = `**${card.korean}** (${card.pos})

---

**단어:** **${card.english}** ${card.phonetic ? `${card.phonetic}` : ''}
**단어 레벨:** ${card.level || '일반'}

**예문:**
- **KOR:** ${card.exampleKor}
- **ENG:** ${card.exampleEng}

**암기 팁:**
${card.tip}`;
      await createCardReq(content);
    }
  }
}
