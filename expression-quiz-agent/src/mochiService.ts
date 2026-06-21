const BASE_URL = 'https://app.mochi.cards/api';

function getAuthHeader(apiKey: string): string {
  return `Basic ${btoa(apiKey + ':')}`;
}

export interface MochiDeckInfo {
  id: string;
  name: string;
  parent?: string;
}

/**
 * Fetch wrapper with exponential backoff for rate limits and temporary network/server issues.
 */
async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  retries = 5,
  initialDelay = 1000
): Promise<Response> {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on 429 (Rate Limit) or 5xx (Server Error)
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        console.warn(`Mochi API returned status ${response.status}. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= 2;
        continue;
      }
      return response;
    } catch (error) {
      console.warn(`Mochi API network error: ${error}. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= 2;
    }
  }
  return fetch(url, options);
}

export async function fetchMochiDecks(apiKey: string): Promise<MochiDeckInfo[]> {
  const response = await fetchWithBackoff(`${BASE_URL}/decks`, {
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

  const response = await fetchWithBackoff(url, {
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
  deckId?: string,
  onProgress?: (loadedCount: number) => void
): Promise<any[]> {
  let allCards: any[] = [];
  let bookmark: string | null = null;
  const maxPages = 1000; // Supports up to 100,000 cards
  let page = 0;

  do {
    let url = `${BASE_URL}/cards?limit=100`;
    if (deckId && deckId !== 'all') {
      url += `&deck-id=${deckId}`;
    }
    if (bookmark) {
      url += `&bookmark=${bookmark}`;
    }

    const response = await fetchWithBackoff(url, {
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
    if (onProgress) {
      onProgress(allCards.length);
    }
    bookmark = data.bookmark || null;
    page++;
  } while (bookmark && page < maxPages);

  return allCards;
}

