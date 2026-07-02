const BASE_URL = 'https://app.mochi.cards/api';

function getAuthHeader(apiKey: string): string {
  return `Basic ${btoa(apiKey + ':')}`;
}

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

export async function fetchMochiDecks(apiKey: string): Promise<any[]> {
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

export async function createMochiCard(
  apiKey: string,
  deckId: string,
  content: string,
  tags: string[]
): Promise<any> {
  const response = await fetchWithBackoff(`${BASE_URL}/cards`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(apiKey),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'deck-id': deckId,
      content,
      tags
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mochi 카드 생성 실패: ${response.status} ${errorText}`);
  }

  return response.json();
}
