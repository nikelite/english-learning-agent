import { shuffleChoicesAndRemapRationale } from './types';
import type { MochiCard } from './types';

// Helper function to call fetch with exponential backoff retry
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
  initialDelay = 1000
): Promise<Response> {
  let delay = initialDelay;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status === 429 || response.status >= 500) {
        console.warn(`Gemini API returned status ${response.status}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        delay += Math.floor(Math.random() * 200);
        continue;
      }
      return response;
    } catch (error) {
      console.warn(`Network error during Gemini API request: ${error}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      if (attempt === maxRetries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
      delay += Math.floor(Math.random() * 200);
    }
  }
  throw new Error("Gemini API 요청 실패: 최대 재시도 횟수를 초과했습니다.");
}

// Splits input text into small chunks to prevent API limits on large vocabulary lists
function chunkInputText(text: string, maxItemsPerChunk = 10): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  if (lines.length > 1) {
    const chunks: string[][] = [];
    for (let i = 0; i < lines.length; i += maxItemsPerChunk) {
      chunks.push(lines.slice(i, i + maxItemsPerChunk));
    }
    return chunks.map(chunk => chunk.join('\n'));
  } else {
    // Only one line. Split by sentences.
    const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g)?.map(s => s.trim()).filter(Boolean) || [text];
    if (sentences.length > maxItemsPerChunk) {
      const chunks: string[][] = [];
      for (let i = 0; i < sentences.length; i += maxItemsPerChunk) {
        chunks.push(sentences.slice(i, i + maxItemsPerChunk));
      }
      return chunks.map(chunk => chunk.join(' '));
    }
  }
  
  return [text];
}

export async function generateMochiCards(
  inputText: string,
  mode: 'study' | 'quiz',
  apiKey: string
): Promise<MochiCard[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
  }

  const cleanText = inputText.trim();
  if (!cleanText) {
    throw new Error("입력된 내용이 없습니다.");
  }

  const chunks = chunkInputText(cleanText, 10);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const generateChunk = async (chunkText: string, chunkIdx: number): Promise<MochiCard[]> => {
    let prompt = "";
    if (mode === 'study') {
      prompt = `You are an elite academic English linguist and ESL curriculum developer.
Analyze the following vocabulary list, expressions, or sentences, and generate flashcard content.

Input Text:
"""
${chunkText}
"""

Instructions:
1. Parse the input text to extract English vocabulary words or expressions.
2. If a sentence contains double curly braces (e.g., {{word}} or {{c1::word}}), extract the word inside as the target "english" word/expression, and use that sentence as "exampleEng". Remove the braces in "english" (e.g. {{downstream}} -> "downstream").
3. For each vocabulary word/expression, generate:
   - "english": The English word or expression (in base/dictionary form).
   - "korean": The Korean meaning.
   - "pos": Part of speech (e.g., 명사, 동사, 형용사, 부사, 숙어).
   - "exampleEng": A natural, contextual English example sentence (use the sentence from input if provided, with braces removed).
   - "exampleKor": Korean translation of the example sentence.
   - "phonetic": Phonetic respelling of the word using syllable-capitalized hyphenated phonetic spelling in brackets (e.g., "[DOWN-streem]", "[STAW-ling]"). DO NOT use IPA symbols like /ɪ/, /d/, /ə/, etc.
   - "level": Difficulty or school grade level in Korean (e.g., 초등 5학년, 중학 2학년, 고교 1학년, 토익/대학 수준).
   - "tip": An engaging memorization tip in Korean (etymology, mnemonic device, or usage tip).
4. CRITICAL RULE FOR MULTIPLE MEANINGS: If an English word or expression has multiple distinct meanings, you MUST split them and generate a separate object for EACH meaning. For example, if "compromise" is in the input, generate one card for "타협하다 (동사)" and another card for "손상시키다 (동사)".
5. Return the result in a single, valid JSON array of objects following this schema:
[
  {
    "id": "A unique short string (e.g. c-12345)",
    "english": "downstream",
    "korean": "하위의",
    "pos": "형용사",
    "exampleEng": "How will this change affect other downstream services?",
    "exampleKor": "이 변경사항이 하위 서비스들에 어떤 영향을 주게 되나요?",
    "phonetic": "[DOWN-streem]",
    "level": "고교 1학년",
    "tip": "stream(흐름)이 down(아래로) 내려가는 것이므로, 비즈니스나 시스템 구조에서 '하류' 즉 '하위 단계'를 나타냅니다."
  }
]

Do not wrap the output in markdown code blocks. Return strictly valid JSON.`;
    } else {
      // Quiz Mode
      prompt = `You are an elite academic English linguist and ESL test developer (TOEIC/TOEFL specialist).
Analyze the following vocabulary list, expressions, or sentences, and generate 4-choice 어휘 퀴즈 (cloze vocabulary quizzes).

Input Text:
"""
${chunkText}
"""

Instructions:
1. Parse the input text to extract English vocabulary words or expressions.
2. If a sentence contains double curly braces (e.g., {{word}} or {{c1::word}}), extract the word inside as the correct answer, and use that sentence for the cloze quiz.
3. CRITICAL: If the input text is a full sentence without double curly braces, you MUST select a key vocabulary word from that sentence to be the quiz target. Wrap that word in double curly braces (e.g., {{word}}) in "exampleEng", set it as the "english" property, and generate a 4-choice quiz for it. NEVER output a quiz card without 4 options (options array must always have exactly 4 items) and never output an exampleEng without the target word wrapped in double curly braces.
4. For each vocabulary item, generate:
   - "english": The target correct English word/expression (e.g. "downstream" or "apple").
   - "korean": The Korean translation of the entire example sentence (e.g., "하루에 사과 한 개를 먹으면 의사를 멀리하게 된다.").
   - "pos": Part of speech of the target word (e.g., 형용사, 명사, 동사, 부사).
   - "exampleEng": The English example sentence where the target word is replaced by standard curly braces: {{word}} (e.g., "How will this change affect other {{downstream}} services?").
   - "options": Exactly 4 choices in English (including the correct word, e.g., ["downstream", "upstream", "vertical", "internal"]). They must be grammatically matching (same part of speech) to make it a high-quality TOEIC/TOEFL multiple choice question.
   - "correctIndex": The 0-based index of the correct word in the "options" array.
   - "phonetic": Phonetic respelling of the correct word using syllable-capitalized hyphenated phonetic spelling in brackets (e.g., "[DOWN-streem]", "[STAW-ling]"). DO NOT use IPA symbols like /ɪ/, /d/, /ə/, etc.
   - "level": Difficulty or school grade level of the target word in Korean (e.g., 초등 5학년, 중학 2학년, 고교 1학년, 토익/대학 수준).
   - "rationale": A detailed Korean explanation of why the correct option is correct, and why EACH of the other three wrong options is incorrect or misleading in this context. Reference the choices as A번, B번, C번, D번 matching their indices (0=A, 1=B, 2=C, 3=D).
   - "tip": An engaging memorization tip in Korean for the target word (etymology, mnemonics, etc.).
5. Return the result in a single, valid JSON array of objects following this schema:
[
  {
    "id": "A unique short string (e.g. q-12345)",
    "english": "downstream",
    "korean": "이 변경사항이 하위 서비스들에 어떤 영향을 주게 되나요?",
    "pos": "형용사",
    "exampleEng": "How will this change affect other {{downstream}} services?",
    "options": ["downstream", "upstream", "vertical", "internal"],
    "correctIndex": 0,
    "phonetic": "[DOWN-streem]",
    "level": "고교 1학년",
    "rationale": "정답은 A번(downstream)입니다. 문맥상 '하위 서비스'를 가리키므로 '흐름의 아래방향인' downstream이 적절합니다.\\n- B번: upstream은 '상위의' 뜻으로 문맥상 반대입니다.\\n- C번: vertical은 '수직의' 뜻으로 맞지 않습니다.\\n- D번: internal은 '내부의' 뜻입니다.",
    "tip": "stream(흐름) + down(아래) = 흐름의 아래쪽인 하위 단계를 나타냅니다."
  }
]

Do not wrap the output in markdown code blocks. Return strictly valid JSON.`;
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP 에러 ${response.status}`;
      throw new Error(`Gemini API 통신 실패 (Chunk ${chunkIdx + 1}): ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error(`Gemini가 유효한 결과를 반환하지 않았습니다 (Chunk ${chunkIdx + 1}).`);
    }

    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed)) {
      throw new Error(`결과가 올바른 배열 형식이 아닙니다 (Chunk ${chunkIdx + 1}).`);
    }

    return parsed.map((item: any, itemIdx: number) => {
      const cleanExampleEng = (item.exampleEng || "").replace(/\{\{c\d::/gi, '{{');
      
      let options = Array.isArray(item.options) ? item.options : [];
      let correctIndex = typeof item.correctIndex === 'number' ? item.correctIndex : 0;
      let rationale = item.rationale || "";

      if (mode === 'quiz' && options.length > 0) {
        const result = shuffleChoicesAndRemapRationale(options, correctIndex, rationale);
        options = result.choices;
        correctIndex = result.correctIndex;
        rationale = result.rationale;
      }

      return {
        id: item.id || `mochi-item-${Date.now()}-${chunkIdx}-${itemIdx}-${Math.random().toString(36).substring(2, 6)}`,
        english: item.english || "",
        korean: item.korean || "",
        pos: item.pos || "",
        exampleEng: cleanExampleEng,
        exampleKor: item.exampleKor || "",
        tip: item.tip || "",
        phonetic: item.phonetic || "",
        level: item.level || "",
        options,
        correctIndex,
        rationale
      };
    });
  };

  try {
    const results = await Promise.all(
      chunks.map((chunk, idx) => generateChunk(chunk, idx))
    );
    return results.flat();
  } catch (error: any) {
    console.error("generateMochiCards error:", error);
    throw new Error(error.message || "암기카드/퀴즈 데이터 생성에 실패했습니다.");
  }
}
