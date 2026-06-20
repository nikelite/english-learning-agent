const BASE_URL = 'https://app.mochi.cards/api';

function getAuthHeader(apiKey: string): string {
  return `Basic ${btoa(apiKey + ':')}`;
}

export interface MochiDeckInfo {
  id: string;
  name: string;
  parent?: string;
}

export async function fetchMochiDecks(apiKey: string): Promise<MochiDeckInfo[]> {
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

export async function fetchMochiDueCards(
  apiKey: string,
  dateISO: string,
  deckId?: string
): Promise<any[]> {
  let url = `${BASE_URL}/due`;
  if (deckId && deckId !== 'all') {
    url += `/${deckId}`;
  }
  url += `?date=${encodeURIComponent(dateISO)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(apiKey),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mochi Due 카드 조회 실패: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.cards || [];
}

export async function fetchMochiCards(
  apiKey: string,
  deckId?: string
): Promise<any[]> {
  let allCards: any[] = [];
  let bookmark: string | null = null;
  const maxPages = 15;
  let page = 0;

  do {
    let url = `${BASE_URL}/cards?limit=100`;
    if (deckId && deckId !== 'all') {
      url += `&deck-id=${deckId}`;
    }
    if (bookmark) {
      url += `&bookmark=${bookmark}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(apiKey),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi 카드 목록 조회 실패: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const docs = data.docs || [];
    allCards = [...allCards, ...docs];
    bookmark = data.bookmark || null;
    page++;
  } while (bookmark && page < maxPages);

  return allCards;
}
