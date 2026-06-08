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
    // For Quiz, we format using Mochi's cloze format
    // exampleEng already has {{c1::word}} from Gemini
    const content = `${card.exampleEng}

---

**정답:** **${card.english}** ${card.phonetic ? `[${card.phonetic}]` : ''}
**품사:** ${card.pos}
**뜻 (전체 번역):** ${card.korean}

**선택지:**
${card.options?.map((opt, i) => `- ${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}

**해설:**
${card.rationale}

**암기 팁:**
${card.tip}`;

    await createCardReq(content);
  } else {
    // Memorization Card Mode
    if (style === 'eng-first' || style === 'both') {
      const content = `# ${card.english} ${card.phonetic ? `[${card.phonetic}]` : ''}

---

**뜻:** ${card.korean} (${card.pos})

**예문:**
- **ENG:** ${card.exampleEng}
- **KOR:** ${card.exampleKor}

**암기 팁:**
${card.tip}`;
      await createCardReq(content);
    }

    if (style === 'kor-first' || style === 'both') {
      const content = `# ${card.korean} (${card.pos})

---

**단어:** **${card.english}** ${card.phonetic ? `[${card.phonetic}]` : ''}

**예문:**
- **KOR:** ${card.exampleKor}
- **ENG:** ${card.exampleEng}

**암기 팁:**
${card.tip}`;
      await createCardReq(content);
    }
  }
}
