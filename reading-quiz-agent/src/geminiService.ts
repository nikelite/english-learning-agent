import sbd from 'sbd';
import { 
  ReadingLesson, ReadingVocabulary, SentenceAnalysis,
  WritingTemplateData, WritingEvaluationResult,
  MicroCoachingData,
  WrongAnswerCoachingStep1Data, WrongAnswerCoachingStep2Data, WrongAnswerCoachingStep3Data
} from './types';

// Centralized sentence splitting function using sbd (Sentence Boundary Detection) with robust masking for abbreviations and initials
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  
  // 1. Preprocess line breaks and normalize spaces
  let cleaned = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // 2. Masking abbreviations and initials using a safe private Unicode character (U+E000)
  const PLACEHOLDER = "\uE000";
  
  // Mask standard abbreviations (case-insensitive)
  const abbrRegex = /\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Co|Corp|Inc|Ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|vs|etc|approx)\b\./gi;
  cleaned = cleaned.replace(abbrRegex, (match, p1) => {
    return `${p1}${PLACEHOLDER}`;
  });
  
  // Mask e.g. and i.e.
  cleaned = cleaned.replace(/\b(e\.g|i\.e)\./gi, (match, p1) => {
    return p1.replace(/\./g, PLACEHOLDER) + PLACEHOLDER;
  });

  // Mask initials like "A. Avery" or "J. K. Rowling" (capital letter followed by dot, then space and another capital/Korean word)
  const initialRegex = /\b([A-Z])\.(?=\s+[A-Z가-힣])/g;
  cleaned = cleaned.replace(initialRegex, (match, p1) => {
    return `${p1}${PLACEHOLDER}`;
  });

  // 3. Sentence segmentation
  const rawSentences = sbd.sentences(cleaned, {
    sanitize: false,
    preserve_whitespace: true
  });
  
  // 4. Restore original periods
  return rawSentences.map(s => {
    return s.replace(new RegExp(PLACEHOLDER, 'g'), '.');
  });
}

// Dynamic Adaptive Rate Control Manager for API Throttling
export class AdaptiveRateLimiter {
  private pacingDelay = 200; // Base pacing delay (ms)
  private minPacing = 100;   // Minimum pacing delay (ms)
  private maxPacing = 3000;  // Maximum pacing delay (ms)

  public async waitPacing() {
    if (this.pacingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.pacingDelay));
    }
  }

  public onSuccess() {
    // Gradually speed up (decay pacing delay) on successful calls
    this.pacingDelay = Math.max(this.minPacing, Math.floor(this.pacingDelay * 0.85));
  }

  public onRateLimit(status: number) {
    // Dynamically scale up pacing delay when HTTP 429 or server errors occur
    if (status === 429) {
      this.pacingDelay = Math.min(this.maxPacing, Math.max(1000, Math.floor(this.pacingDelay * 2.5)));
    } else {
      this.pacingDelay = Math.min(this.maxPacing, Math.max(500, Math.floor(this.pacingDelay * 1.5)));
    }
    console.warn(`[Adaptive Rate Control] Adjusted pacing delay to ${this.pacingDelay}ms (HTTP ${status})`);
  }
}

// Helper function to call fetch with dynamic exponential backoff with jitter
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 4,
  initialDelay = 1000,
  onRetry?: (attempt: number, maxRetries: number, statusOrError: string) => void
): Promise<Response> {
  let delay = initialDelay;
  const maxBackoffDelay = 16000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s hard timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }
      
      // Handle HTTP 429 (Rate Limit) or HTTP 5xx (Server Error) with Exponential Backoff + Jitter
      if (response.status === 429 || response.status >= 500) {
        const jitter = Math.floor(Math.random() * 300);
        const currentDelay = delay + jitter;
        const msg = response.status === 429
          ? `HTTP 429 (Rate Limit) - ${attempt + 1}/${maxRetries}회 지수 백오프 대기 (${currentDelay}ms)`
          : `HTTP ${response.status} (Server Error) - ${attempt + 1}/${maxRetries}회 대기 (${currentDelay}ms)`;

        console.warn(`[Gemini API] ${msg}`);
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, msg);
        }

        if (attempt === maxRetries - 1) {
          return response;
        }

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        delay = Math.min(maxBackoffDelay, delay * 2); // Exponential backoff (2x)
        continue;
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const isAbort = error.name === 'AbortError';
      const jitter = Math.floor(Math.random() * 300);
      const currentDelay = delay + jitter;
      const msg = isAbort ? 'API 요청 시간 초과 (45초)' : (error?.message || String(error));
      
      console.warn(`[Gemini API] Network Error: ${msg}. Retrying in ${currentDelay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, msg);
      }

      if (attempt === maxRetries - 1) {
        throw new Error(isAbort ? 'Gemini API 응답 시간이 초과되었습니다 (45초). 다시 시도해 주세요.' : msg);
      }

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      delay = Math.min(maxBackoffDelay, delay * 2);
    }
  }
  throw new Error("Gemini API 요청 실패: 최대 재시도 횟수를 초과했습니다.");
}

// Preloaded Premium Reading Lessons (Upgraded to TOEFL 7th Grade Style with English Questions and Citing Korean Rationales)
export const PRESET_READING_LESSONS: ReadingLesson[] = [
  {
    id: "preset-wood-wide-web",
    title: "나무들의 비밀 통신망 (The Wood Wide Web)",
    passageText: "Trees are not isolated individuals standing competing for sunlight, but are instead members of a complex, highly connected subterranean community. Beneath the forest floor lies a vast, intricate network of fungal threads known as mycelium, which acts as a biological internet connecting tree roots. Through this network, which scientists affectionately call the 'Wood Wide Web,' trees can share vital nutrients like carbon, phosphorus, and water with struggling neighbors. Moreover, they use these networks as an early-warning system. When an individual tree is attacked by pest insects, it can transmit warning chemical signals through the mycelium to alert neighboring trees. Upon receiving the signal, neighboring trees immediately synthesize defensive chemicals, such as tannins, to deter the impending invasion. This cooperative behavior completely reshapes our traditional understanding of natural selection as purely competitive, highlighting a profound cooperative harmony built deep in the earth.",
    createdAt: 1716656400000,
    paragraphs: [
      {
        id: 1,
        englishText: "Trees are not isolated individuals standing competing for sunlight, but are instead members of a complex, highly connected subterranean community.",
        koreanTranslation: "나무들은 햇빛을 차지하기 위해 단순 경쟁하는 고립된 개체들이 아니라, 그 대신 지하 깊은 곳에서 정교하고 고도로 연결된 공동체의 일원입니다."
      },
      {
        id: 2,
        englishText: "Beneath the forest floor lies a vast, intricate network of fungal threads known as mycelium, which acts as a biological internet connecting tree roots.",
        koreanTranslation: "숲의 바닥 아래에는 '균사체(mycelium)'라고 알려진 곰팡이 실 모양 세포들의 거대하고 복잡한 그물이 놓여 있으며, 이는 나무뿌리들을 연결하는 일종의 생물학적 인터넷 역할을 수행합니다."
      },
      {
        id: 3,
        englishText: "Through this network, which scientists affectionately call the 'Wood Wide Web,' trees can share vital nutrients like carbon, phosphorus, and water with struggling neighbors.",
        koreanTranslation: "과학자들이 친근하게 '우드 와이드 웹(Wood Wide Web)'이라 부르는 이 통신망을 통해, 나무들은 탄소, 인, 그리고 물과 같은 필수 영양소를 생존을 위해 몸부림치는 옆의 이웃 나무들과 공유할 수 있습니다."
      },
      {
        id: 4,
        englishText: "Moreover, they use these networks as an early-warning system. When an individual tree is attacked by pest insects, it can transmit warning chemical signals through the mycelium to alert neighboring trees.",
        koreanTranslation: "그뿐만 아니라, 나무들은 이 그물망을 조기 경보 시스템으로도 활용합니다. 어떤 단일 나무가 유해 해충에 의해 공격받을 때, 그 나무는 균사체를 통해 경보 화학 신호를 전송하여 주변 이웃 나무들에게 위험을 알릴 수 있습니다."
      },
      {
        id: 5,
        englishText: "Upon receiving the signal, neighboring trees immediately synthesize defensive chemicals, such as tannins, to deter the impending invasion.",
        koreanTranslation: "신호를 감지한 주변 나무들은 닥쳐올 외침을 저지하기 위해 타닌과 같은 방어용 화학물질을 즉각적으로 합성해 냅니다."
      },
      {
        id: 6,
        englishText: "This cooperative behavior completely reshapes our traditional understanding of natural selection as purely competitive, highlighting a profound cooperative harmony built deep in the earth.",
        koreanTranslation: "이러한 협력적 행위는 자연선택을 오직 '순수 경쟁 관계'로만 규정해 오던 우리의 전통적인 고정관념을 완전히 재구조화하며, 대지 깊은 곳에 구축된 심오한 상생 협력의 조화를 강조합니다."
      }
    ],
    vocabulary: [
      {
        word: "isolated",
        meaning: "고립된, 외따로 떨어진",
        sentence: "Trees are not isolated individuals but connected members.",
        pronunciation: "AY-soh-lay-ted"
      },
      {
        word: "subterranean",
        meaning: "지하의, 숨은",
        sentence: "They are members of a highly connected subterranean community.",
        pronunciation: "sub-tuh-RAY-nee-uhn"
      },
      {
        word: "intricate",
        meaning: "복잡한, 얽힌",
        sentence: "Beneath the forest floor lies a vast, intricate network.",
        pronunciation: "IN-trih-kit"
      },
      {
        word: "synthesize",
        meaning: "합성하다, 통합하다",
        sentence: "Neighboring trees immediately synthesize defensive chemicals.",
        pronunciation: "SIN-thuh-syz"
      },
      {
        word: "deter",
        meaning: "제지하다, 단념시키다",
        sentence: "They synthesize chemicals to deter the impending invasion.",
        pronunciation: "dih-TUR"
      }
    ],
    quizzes: [
      {
        id: "q-rpreset-1",
        question: "Q1. TOEFL Academic Style: Factual Information\n\nAccording to paragraph 1, which of the following is true about trees in a forest?",
        choices: [
          "They grow in complete isolation without affecting other nearby plants.",
          "They are members of a highly connected underground community.",
          "They focus exclusively on competing for sunlight above the ground.",
          "They communicate primarily through their leaves waving in the wind."
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다.\n\n본문의 첫 번째 문장을 인용하면: \"Trees are not isolated individuals... but are instead members of a complex, highly connected subterranean community.\" (나무들은 고립된 개체들이 아니라 지하에서 서로 긴밀하게 연결된 공동체의 구성원이다)라고 명시되어 있습니다.\n\n오답 설명:\n- A번: \"isolated individuals(고립된 개체)\"가 아니라고 원문에서 명확히 부인하고 있으므로 오답입니다.\n- C번: 단순한 햇빛 경쟁(\"competing for sunlight\")을 넘어서는 관계라고 설명했으므로 오답입니다.\n- D번: 지하 균사체망으로 연결된다고 하였으므로 나뭇잎 흔들림으로 대화한다는 것은 전혀 어울리지 않습니다.",
        type: "comprehension"
      },
      {
        id: "q-rpreset-2",
        question: "Q2. TOEFL Academic Style: Inference\n\nWhat can be inferred from paragraph 4 about how neighboring trees react to warning signals?",
        choices: [
          "They stop absorbing water to prevent sharing with the infected tree.",
          "They immediately prepare biological defenses to protect themselves.",
          "They relocate their root systems away from the threat zone.",
          "They send predatory insects to attack the neighboring tree."
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다.\n\n원문의 4-5번째 문장을 인용하면: \"When an individual tree is attacked... it can transmit warning chemical signals... neighboring trees immediately synthesize defensive chemicals... to deter the impending invasion.\" (한 나무가 해충의 공격을 받으면 경보 화학 신호를 보내고, 이웃 나무들은 침입을 막기 위해 방어용 화학물질을 합성한다)라고 설명합니다. 따라서 침입에 대비해 자신을 보호할 생물학적 방어를 수립한다는 B번이 확실한 추론입니다.\n\n오답 설명:\n- A번: 물 흡수를 멈춘다는 언급은 전혀 나타나 있지 않습니다.\n- C번: 나무는 스스로 뿌리 위치를 이동(\"relocate their root systems\")할 수 없으므로 비현실적인 설명입니다.\n- D번: 이웃 나무들이 해충을 보내어 원래 나무를 공격하게 한다는 것은 지문의 흐름과 완전히 어긋납니다.",
        type: "comprehension"
      },
      {
        id: "q-rpreset-3",
        question: "Q3. TOEFL Academic Style: Vocabulary in Context\n\nThe word 'deter' in paragraph 5 is closest in meaning to which of the following?",
        choices: [
          "encourage (격려하다)",
          "accelerate (가속하다)",
          "prevent (막다, 방지하다)",
          "observe (관찰하다)"
        ],
        correctIndex: 2,
        rationale: "정답은 C번입니다.\n\n본문의 다섯 번째 문장을 인용하면: \"Upon receiving the signal, neighboring trees immediately synthesize defensive chemicals... to deter the impending invasion.\" (신호를 받으면 이웃 나무들은 다가올 침입을 'deter'하기 위해 방어 물질을 합성한다)라고 되어 있습니다. 닥쳐올 외침을 저지하고 단념시키기 위한 행동이므로 'deter'의 유의어는 'prevent(막다, 방지하다)'가 가장 적합합니다.\n\n오답 설명:\n- A번 encourage(격려하다)와 B번 accelerate(가속하다)는 침입을 도와주는 꼴이 되므로 문맥상 맞지 않는 반대말입니다.\n- D번 observe(관찰하다)는 방어 화학물질을 합성해 능동적으로 대항하는 본문의 어조를 담아내지 못합니다.",
        type: "vocab"
      },
      {
        id: "q-rpreset-4",
        question: "Q4. TOEFL Academic Style: Detail Verification\n\nAccording to paragraph 3, how do trees share essential resources like carbon and water with struggling neighbors?",
        choices: [
          "By releasing moisture into the clouds to trigger local rain showers.",
          "Through a vast underground fungal network called the 'Wood Wide Web'.",
          "By dropping dead branches onto the forest floor to decay into nutrients.",
          "Through bird species that carry mineral deposits between tree hollows."
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다.\n\n본문의 세 번째 문장을 인용하면: \"Through this network, which scientists affectionately call the 'Wood Wide Web,' trees can share vital nutrients...\" (과학자들이 '우드 와이드 웹'이라고 부르는 이 네트워크를 통해 영양소를 공유한다)라고 구체적으로 밝히고 있습니다.\n\n오답 설명:\n- A번: 구름 속으로 수분을 뿜어 비를 내리게 한다는 공상적인 설명은 본문에 없습니다.\n- C번: 썩은 가지가 거름이 된다는 일반 지식은 본문에서 언급하는 지하 통신망의 설명이 아닙니다.\n- D번: 새가 미네랄을 옮겨준다는 주장은 지문에 전혀 존재하지 않는 엉뚱한 정보입니다.",
        type: "comprehension"
      },
      {
        id: "q-rpreset-5",
        question: "Q5. TOEFL Academic Style: Vocabulary in Context\n\nThe word 'intricate' in paragraph 2 is closest in meaning to...",
        choices: [
          "simple (단순한)",
          "complex (복잡하고 정교한)",
          "temporary (임시의)",
          "dangerous (위험한)"
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다.\n\n본문의 두 번째 문장을 인용하면: \"Beneath the forest floor lies a vast, intricate network of fungal threads...\" (숲 바닥 아래에는 균사체로 이루어진 거대하고 'intricate'한 통신망이 놓여 있다)라고 나옵니다. 거미줄이나 인터넷처럼 얽히고설킨 정교하고 복잡한 네트워크를 묘사하므로 'complex'가 문맥상 유의어입니다.\n\n오답 설명:\n- A번 simple(단순한)은 복잡하고 광대한 균사체 망의 설명과 반대되는 단어입니다.\n- C번 temporary(임시의)는 본문에서 묘사하는 거대한 생태학적 상시 망과 조화를 이루지 못합니다.\n- D번 dangerous(위험한)는 이 망이 나무들에게 생명선이자 도움을 주는 순기능을 하므로 문맥상 어색합니다.",
        type: "vocab"
      }
    ]
  }
];

// Asynchronous GZIP serialization helpers for high-efficiency database-free sharing links (80% URL size reduction)
export async function serializeLesson(lesson: ReadingLesson): Promise<string> {
  try {
    const jsonStr = JSON.stringify(lesson);
    
    // 1. Convert string to UTF-8 byte array
    const byteArray = new TextEncoder().encode(jsonStr);
    
    // 2. Compress via GZIP stream
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    
    // 3. Read compressed chunks
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // 4. Concatenate chunks
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
    // 5. Convert binary to URL-safe Base64
    let binary = "";
    for (let i = 0; i < concat.byteLength; i++) {
      binary += String.fromCharCode(concat[i]);
    }
    const base64 = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
      
    return base64;
  } catch (error) {
    console.error("Failed to serialize reading lesson:", error);
    return "";
  }
}

export async function deserializeLesson(base64Str: string): Promise<ReadingLesson | null> {
  if (!base64Str) return null;
  try {
    // 1. Restore standard Base64 characters
    let standardBase64 = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    while (standardBase64.length % 4) {
      standardBase64 += "=";
    }
    
    // 2. Decode Base64 to binary string
    const binary = atob(standardBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // 3. Decompress GZIP stream
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    
    // 4. Read decompressed chunks
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // 5. Concatenate and decode to string
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
    const jsonStr = new TextDecoder().decode(concat);
    const parsed = JSON.parse(jsonStr);
    
    // Safety structure check
    if (parsed && parsed.title && parsed.passageText && Array.isArray(parsed.quizzes)) {
      return parsed as ReadingLesson;
    }
    return null;
  } catch (error) {
    console.error("Failed to deserialize shared lesson:", error);
    return null;
  }
}

// Refined System Prompt: Strictly enforces US 7th Grade difficulty, TOEFL/TOEIC academic English style for quizzes/choices, and direct sentence-citing Korean rationales
const SYSTEM_PROMPT = `You are an elite academic English test designer and expert ESL curriculum developer. Your task is to analyze the provided English reading passage and generate highly structured study materials matching the exact JSON structure provided below.

Strict Target & Formatting Rules:
1. TARGET AUDIENCE DIFFICULTY: Enforce a US 7th Grade school level (approx. Lexile 800L-1000L). The vocabulary and syntactic complexity of the questions and distractors must target an advanced middle-school reader.
2. TOEFL/TOEIC QUIZ STYLE:
   - All quiz questions MUST be written in academic ENGLISH.
   - All answer options (choices) MUST be written in academic ENGLISH.
   - Follow formal TOEFL/TOEIC reading formats: "According to paragraph X, which of the following is true...", "It can be inferred from paragraph Y...", "The word 'Z' in paragraph W is closest in meaning to...".
   - CRITICAL STABILITY RULE: DO NOT mention specific sentence numbers (e.g. "sentence 3", "3번째 문장", "the second sentence", "2번 문장") anywhere in the quiz questions, choices, or rationales, as sentence numbers can be unstable. Instead, refer to paragraph numbers (e.g., "paragraph 2"), quote the text directly, or refer to the content semantically.
3. EASY & DETAILED KOREAN RATIONALES (오답 해설):
   - The 'rationale' (해설) for each quiz MUST be written in simple, clear, and highly encouraging KOREAN.
   - IMPORTANT: To prove the correct/incorrect answers, you MUST DIRECTLY CITE AND QUOTE the exact original English sentence(s) from the passage in your Korean rationale, translating and explaining them step-by-step.
    - CRITICAL LABEL RULE: You MUST use letter labels A, B, C, D (NOT numbers like 1번, 2번, 3번, 4번) to refer to each choice. choices[0]=A번, choices[1]=B번, choices[2]=C번, choices[3]=D번.
    - Format: "정답은 A번입니다. [원문 인용 문장]에 의하면... 따라서 ~의 의미가 되므로 A가 적절합니다."
    - Dissect why each of the other three wrong choices (e.g. B번, C번, D번) is incorrect or misleading by referencing the passage details.
4. CORE STUDY ITEMS (VIBRANT VOCABULARY & ANALYSIS LIST):
   - The 'vocabulary' array MUST contain at least 6 key items extracted from the passage, representing a balanced mix of:
     - 'vocabulary': Key academic/TOEFL vocabulary words.
     - 'grammar': Key grammatical structures or syntax rules used in the passage.
     - 'expression': Key idioms, collocations, or common English expressions found in the text.
     - 'context': Thematic terms, context markers, or cultural backgrounds essential to understand the passage.
   - For each item, you must specify the 'type' (which must be 'vocabulary', 'grammar', 'expression', or 'context') and a 'contextNote' in KOREAN providing a clear grammatical explanation, context detail, or translation tip.
5. CRITICAL COMPLETE QUESTION RULE FOR FILL-IN-THE-BLANK / GRAMMAR QUIZZES:
   - When asking fill-in-the-blank or sentence completion questions (e.g., "Select the grammatically correct phrase...", "Which word best fits...", "Complete the sentence..."), you MUST INCLUDE THE FULL TARGET SENTENCE WITH A BLANK ("_______") directly inside the "question" text string!
   - Example CORRECT: "Select the grammatically correct phrase to complete the sentence: 'Looking up at the sky, we saw _______ moving across the horizon.'"
   - Example INCORRECT (FORBIDDEN): "Select the grammatically correct phrase to complete the sentence:" (WITHOUT any sentence or blank). NEVER output empty or sentence-less question stems!
6. SITUATIONAL WRITING TEMPLATE (1초 실전 상황 작문 템플릿 - 핵심 어휘 1개 집중 훈련):
   - You MUST include a 'writingTemplate' object with 2 realistic scenarios ('scenarios' array) aligned with the passage's domain/theme.
   - CRITICAL REQUIREMENT - ONE TARGET VOCABULARY PER SCENARIO:
     - In Scenario 1, pick EXACTLY 1 important core word/expression from your 'vocabulary' list.
     - In Scenario 2, pick ANOTHER 1 important core word/expression from your 'vocabulary' list.
     - Design a clear, easy-to-understand, real-world situation focused 100% on practicing that SINGLE selected target word.
     - Do NOT make the situation overly difficult or require complex sentence structures! Keep the English sentence clean, short, and natural (8~12 words).
   - "category": A vivid Korean category name matching the passage theme (e.g. "🔬 과학/학술 탐구 상황", "💻 IT/실무 회의 상황", "🏛️ 인문·역사 분석 상황", "🌍 사회·환경 이슈 상황", "☕ 일상 대화 상황").
   - "targetWord": The single target word and its meaning (e.g. "deter (단념시키다/방어하다)").
   - "situation": 1-2 clear, easy sentences in Korean describing why you need to say this sentence.
   - "koreanIntent": The target Korean sentence to say, with the target English word in parentheses (e.g. "우리는 잠재적 위험을 방지하기(deter) 위해 사전 조치를 취해야 합니다.").
   - "template": English sentence frame with blanks "_______" (e.g. "We need to take action to _______ potential risks.").
   - "sampleSentence": A natural native English completion (e.g. "We need to take action to deter potential risks.").
   - "keyKeywords": An array with the 1 target word (e.g. ["deter (단념시키다/방어하다)"]).
   - "tip": 1 friendly sentence in Korean explaining how to use this target word.

Strict JSON Schema Requirements:
{
  "title": "An engaging academic title in Korean for this reading passage",
  "paragraphs": [
    {
      "id": 1,
      "englishText": "The original paragraph text in English",
      "koreanTranslation": "High-fidelity translation in Korean"
    }
  ],
  "vocabulary": [
    {
      "word": "word, grammar rule, or idiom in English",
      "meaning": "translation or short summary in Korean",
      "sentence": "the original sentence from the passage or an illustrative example showing its usage in context",
      "pronunciation": "Phonetic respelling with capitalized stressed syllable, e.g. 'SIN-thuh-syz'",
      "type": "Must be one of: 'vocabulary', 'grammar', 'expression', or 'context'",
      "contextNote": "A highly informative explanation or grammatical/contextual breakdown in Korean (e.g. '이 구문은 ~로 쓰였으며, 독해 시 주어-동사 수일치에 유의해야 합니다.')"
    }
  ],
  "quizzes": [
    {
      "id": "A unique string ID, e.g. 'q1', 'q2', etc.",
      "question": "The academic TOEFL/TOEIC question written in ENGLISH (targeting 7th-grade level)",
      "choices": [
        "Choice A in English",
        "Choice B in English",
        "Choice C in English",
        "Choice D in English"
      ],
      "correctIndex": 0,
      "rationale": "Extremely detailed, easy-to-understand explanation in KOREAN that directly cites the original English sentences to clarify correct and incorrect choices.",
      "type": "comprehension or vocab"
    }
  ],
  "writingTemplate": {
    "targetWord": "Core target word 1 (meaning)",
    "situation": "Detailed scenario in Korean matching passage domain",
    "koreanIntent": "The target Korean sentence to say in quotes",
    "prompt": "본문의 핵심 어휘를 활용하여 상황에 맞는 1문장을 완성해 보세요.",
    "template": "English fill-in-the-blank template with blanks _______",
    "sampleSentence": "A natural, high-quality native English completion",
    "tip": "Helpful tip in Korean",
    "keyKeywords": ["targetWord 1 (meaning)"],
    "scenarios": [
      {
        "category": "Vivid category in Korean matching the passage context",
        "targetWord": "Target Word 1 (meaning in Korean)",
        "situation": "Easy and clear situation in Korean (1-2 sentences)",
        "koreanIntent": "The target Korean sentence to say in quotes",
        "template": "English fill-in-the-blank template with blanks _______",
        "sampleSentence": "Natural native English sentence",
        "keyKeywords": ["Target Word 1 (meaning in Korean)"],
        "tip": "Friendly tip in Korean"
      },
      {
        "category": "Another vivid category in Korean matching the passage context",
        "targetWord": "Target Word 2 (meaning in Korean)",
        "situation": "Easy and clear situation in Korean (1-2 sentences)",
        "koreanIntent": "The target Korean sentence to say in quotes",
        "template": "English fill-in-the-blank template with blanks _______",
        "sampleSentence": "Natural native English sentence",
        "keyKeywords": ["Target Word 2 (meaning in Korean)"],
        "tip": "Friendly tip in Korean"
      }
    ]
  }
}`;

export async function generateReadingLesson(
  text: string,
  apiKey: string,
  comprehensionCount: number,
  vocabCount: number
): Promise<ReadingLesson> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("분석할 독해 지문 텍스트가 비어 있습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}
            
            Strict Request Parameters:
            - Generate EXACTLY ${comprehensionCount} Comprehension quiz questions (which have "type": "comprehension").
            - Generate EXACTLY ${vocabCount} Vocabulary quiz questions (which have "type": "vocab").
            - The total number of quizzes in the output array MUST be EXACTLY ${comprehensionCount + vocabCount}.
            - Target academic difficulty: US 7th Grade Reading Level.
            
            Here is the English reading passage text to analyze:
            """
            ${cleanText}
            """`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  try {
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
      throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Gemini가 유효한 지문 분석결과를 반환하지 않았습니다.");
    }

    const parsedJson = JSON.parse(responseText);

    const lesson: ReadingLesson = {
      id: `reading-${Date.now()}`,
      title: parsedJson.title || "새로운 영어 독해 지문",
      passageText: cleanText,
      createdAt: Date.now(),
      paragraphs: (parsedJson.paragraphs || []).map((p: any, idx: number) => ({
        id: p.id || idx + 1,
        englishText: p.englishText || "",
        koreanTranslation: p.koreanTranslation || ""
      })),
      vocabulary: (parsedJson.vocabulary || []).map((v: any) => ({
        word: v?.word || "",
        meaning: v?.meaning || "",
        sentence: v?.sentence || "",
        pronunciation: v?.pronunciation || "",
        type: v?.type || "vocabulary",
        contextNote: v?.contextNote || ""
      })),
      quizzes: (parsedJson.quizzes || []).map((q: any, idx: number) => {
        const rawChoices = q?.choices || ["A", "B", "C", "D"];
        const rawCorrectIndex = typeof q?.correctIndex === 'number' ? q.correctIndex : 0;
        const correctChoiceText = rawChoices[rawCorrectIndex] || rawChoices[0];

        // Shuffle choices using standard Fisher-Yates
        const choicesWithIndex = rawChoices.map((choice: string, cIdx: number) => ({ choice, cIdx }));
        for (let i = choicesWithIndex.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choicesWithIndex[i], choicesWithIndex[j]] = [choicesWithIndex[j], choicesWithIndex[i]];
        }

        const shuffledChoices = choicesWithIndex.map((c: any) => c.choice);
        const shuffledCorrectIndex = shuffledChoices.indexOf(correctChoiceText);

        // Remap A/B/C/D labels in rationale to match shuffled order
        const LABELS = ['A', 'B', 'C', 'D'];
        const oldToNewIdx: Record<number, number> = {};
        choicesWithIndex.forEach((item: any, newIdx: number) => {
          oldToNewIdx[item.cIdx] = newIdx;
        });
        let remappedRationale = q?.rationale || "상세 해설이 없습니다.";
        // Phase 1: Replace old labels → temp placeholders (avoid collision)
        const TEMP = ['##LABEL_A##', '##LABEL_B##', '##LABEL_C##', '##LABEL_D##'];
        LABELS.forEach((label, oldIdx) => {
          if (oldToNewIdx[oldIdx] !== undefined) {
            const temp = TEMP[oldToNewIdx[oldIdx]];
            remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}번`, 'g'), `${temp}번`);
          }
        });
        // Also remap number-based references (1번→A, 2번→B, 3번→C, 4번→D)
        for (let oldIdx = 0; oldIdx < 4; oldIdx++) {
          if (oldToNewIdx[oldIdx] !== undefined) {
            const numStr = `${oldIdx + 1}번`;
            const temp = `${TEMP[oldToNewIdx[oldIdx]]}번`;
            remappedRationale = remappedRationale.replace(new RegExp(`(?<![0-9])${numStr}`, 'g'), temp);
          }
        }
        // Phase 2: Replace temp placeholders → final labels
        TEMP.forEach((temp, idx) => {
          remappedRationale = remappedRationale.replace(new RegExp(temp, 'g'), LABELS[idx]);
        });

        let questionText = q?.question || "문제가 생성되지 않았습니다.";
        
        // Auto-repair fill-in-the-blank questions if Gemini omitted the target sentence string
        const lowerQ = questionText.toLowerCase();
        if (
          (lowerQ.includes("complete the sentence") || lowerQ.includes("fill in the blank") || lowerQ.includes("grammatically correct phrase")) &&
          !questionText.includes("_______") &&
          !questionText.includes("_") &&
          !questionText.includes('"') &&
          !questionText.includes("'")
        ) {
          const matchQuote = remappedRationale?.match(/["']([^"']{10,})["']/);
          if (matchQuote) {
            questionText = `${questionText} "${matchQuote[1]}"`;
          }
        }

        return {
          id: `read-q-${Date.now()}-${idx}`,
          question: questionText,
          choices: shuffledChoices,
          correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
          rationale: remappedRationale,
          type: q?.type === 'vocab' ? 'vocab' : 'comprehension'
        };
      })
    };

    return lesson;
  } catch (error: any) {
    console.error("Gemini Reading Generation Error:", error);
    throw new Error(error.message || "지문을 분석하고 퀴즈를 출제하는 중 알 수 없는 장애가 발생했습니다.");
  }
}

// Generate a detailed study card for a user-submitted custom word or expression, using the passage's context
export async function generateCustomVocabItem(
  passageText: string,
  targetWordOrPhrase: string,
  apiKey: string
): Promise<ReadingVocabulary> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
  }
  
  const cleanWord = targetWordOrPhrase.trim();
  if (!cleanWord) {
    throw new Error("분석할 단어 또는 표현이 비어 있습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an elite academic English linguist and ESL curriculum developer.
Analyze the following English target word or phrase: "${cleanWord}"
strictly in the context of this English reading passage:
\"\"\"
${passageText}
\"\"\"

Generate a highly detailed and helpful vocabulary study card for this item in the following strict JSON format:
{
  "word": "${cleanWord}",
  "meaning": "Clear, contextual meaning or definition in Korean, matching how it is used in the passage",
  "sentence": "The exact original sentence from the passage where this word/phrase is used, or a highly relevant contextual example from the passage",
  "pronunciation": "Phonetic respelling with capitalized stressed syllable (e.g. 'SIN-thuh-syz')",
  "type": "Categorize it as one of: 'vocabulary', 'grammar', 'expression', or 'context'",
  "contextNote": "A brief, highly informative contextual analysis in Korean explaining its grammatical role, syntax breakdown, or usage context in the passage (e.g. '이 문맥에서는 ~한 뜻을 지닌 분사구문으로 쓰여 주어가 ~함을 묘사합니다.')"
}

Ensure the response is a single, valid JSON object and nothing else. Do not wrap in markdown code blocks.`;

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

  try {
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
      throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("Gemini가 유효한 분석결과를 반환하지 않았습니다.");
    }

    const parsed = JSON.parse(responseText);
    return {
      word: parsed?.word || cleanWord,
      meaning: parsed?.meaning || "의미를 분석할 수 없습니다.",
      sentence: parsed?.sentence || "",
      pronunciation: parsed?.pronunciation || "",
      type: parsed?.type || "vocabulary",
      contextNote: parsed?.contextNote || ""
    };
  } catch (error: any) {
    console.error("Gemini Custom Vocab Generation Error:", error);
    throw new Error(error.message || "단어 분석 중 오류가 발생했습니다.");
  }
}

// Helper to analyze a small group of English sentences in parallel with Gemini
export async function analyzeParagraphChunkSentences(
  paragraphId: number,
  chunkIdx: number,
  sentences: string[],
  passageText: string,
  apiKey: string,
  onRetry?: (attempt: number, maxRetries: number, statusOrError: string) => void
): Promise<SentenceAnalysis[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const targetText = sentences.join(' ');

  const prompt = `You are an elite academic English linguist and ESL curriculum developer.
Analyze the sentences in the following sentence group from paragraph ID ${paragraphId} of the English reading passage.

Passage Context (for background reference):
"""
${passageText}
"""

Target sentences to analyze:
"${targetText}"

For each of the English sentences listed below, generate a highly detailed linguistic analysis in the following strict JSON format:
[
  {
    "sentence": "The original complete English sentence",
    "vocabulary": [
      {
        "word": "important word",
        "meaning": "contextual meaning in Korean"
      }
    ],
    "expressions": [
      {
        "expression": "idiom or phrase",
        "meaning": "meaning in Korean",
        "contextNote": "why/how it is used in this context"
      }
    ],
    "grammar": "Detailed explanation of key grammatical structures, clauses, syntax, or structural elements in this sentence, in Korean.",
    "context": "Contextual explanation of this sentence's role inside the paragraph (e.g. introduces the topic, provides supporting evidence, transitions, wraps up), in Korean."
  }
]

Analyze exactly these sentences:
${sentences.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

Ensure the response is a single, valid JSON array of objects. Do not wrap in markdown code blocks.`;

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

  const response = await fetchWithRetry(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    },
    7,
    1000,
    onRetry
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `HTTP 에러 ${response.status}`;
    throw new Error(`Paragraph ${paragraphId} Chunk ${chunkIdx} 분석 실패: ${errorMessage}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("Gemini가 유효한 분석결과를 반환하지 않았습니다.");
  }

  const parsed = JSON.parse(responseText);
  if (!Array.isArray(parsed)) {
    throw new Error("결과가 올바른 배열 형식이 아닙니다.");
  }

  const normalize = (txt: string) => txt.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

  return parsed.map((item: any, idx: number) => {
    // Find matching original sentence in the input chunk
    let bestSentence = sentences[idx] || "";
    if (item.sentence) {
      const normItem = normalize(item.sentence);
      const match = sentences.find(s => {
        const normS = normalize(s);
        return normS === normItem || normS.includes(normItem) || normItem.includes(normS);
      });
      if (match) {
        bestSentence = match;
      }
    }

    return {
      sentence: bestSentence,
      translation: "",
      vocabulary: Array.isArray(item.vocabulary) ? item.vocabulary.map((v: any) => ({
        word: v.word || "",
        meaning: v.meaning || ""
      })) : [],
      expressions: Array.isArray(item.expressions) ? item.expressions.map((e: any) => ({
        expression: e.expression || "",
        meaning: e.meaning || "",
        contextNote: e.contextNote || ""
      })) : [],
      grammar: item.grammar || "문법 분석이 제공되지 않았습니다.",
      context: item.context || "문맥 분석이 제공되지 않았습니다."
    };
  });
}

// Dynamically analyze the entire passage by chunking sentences and executing in parallel
export async function analyzePassageSentences(
  paragraphs: { id: number; englishText: string }[],
  passageText: string,
  apiKey: string,
  onProgress?: (completed: number, total: number) => void,
  onParagraphAnalyzed?: (paragraphId: number, analysis: SentenceAnalysis[]) => void,
  onRetry?: (attempt: number, maxRetries: number, statusOrError: string) => void
): Promise<Record<number, SentenceAnalysis[]>> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
  }

  if (!paragraphs || paragraphs.length === 0) {
    throw new Error("분석할 문단 목록이 비어 있습니다.");
  }

  const CHUNK_SIZE = 10;
  const result: Record<number, SentenceAnalysis[]> = {};

  // 1. Prepare paragraph chunking tasks
  const paragraphTasks = paragraphs.map(p => {
    const sentences = splitIntoSentences(p.englishText);
    const chunks: string[][] = [];
    for (let i = 0; i < sentences.length; i += CHUNK_SIZE) {
      chunks.push(sentences.slice(i, i + CHUNK_SIZE));
    }
    return {
      paragraph: p,
      chunks,
      sentences
    };
  });

  // 2. Compute total chunks for progress tracking
  const totalChunks = paragraphTasks.reduce((acc, t) => acc + t.chunks.length, 0);
  let completedChunks = 0;

  // 3. Process each paragraph's chunks sequentially with dynamic adaptive rate control
  const rateLimiter = new AdaptiveRateLimiter();

  const runParagraphAnalysis = async (task: typeof paragraphTasks[0]) => {
    const { paragraph, chunks } = task;
    const chunkResults: SentenceAnalysis[][] = new Array(chunks.length);

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      try {
        // Dynamically wait pacing delay before next request
        await rateLimiter.waitPacing();

        const cResult = await analyzeParagraphChunkSentences(
          paragraph.id,
          chunkIdx,
          chunk,
          passageText,
          apiKey,
          (attempt, maxRetries, statusMsg) => {
            if (statusMsg.includes('429')) {
              rateLimiter.onRateLimit(429);
            }
            if (onRetry) {
              onRetry(attempt, maxRetries, statusMsg);
            }
          }
        );
        rateLimiter.onSuccess();
        chunkResults[chunkIdx] = cResult;
      } catch (err) {
        rateLimiter.onRateLimit(500);
        console.error(`Error analyzing paragraph ${paragraph.id} chunk ${chunkIdx}:`, err);
        // Fallback for this chunk
        chunkResults[chunkIdx] = chunk.map(s => ({
          sentence: s,
          translation: "",
          vocabulary: [],
          expressions: [],
          grammar: "문법 분석을 생성하지 못했습니다. (네트워크/API 오류)",
          context: "문맥 분석을 생성하지 못했습니다."
        }));
      } finally {
        completedChunks++;
        if (onProgress) {
          onProgress(completedChunks, totalChunks);
        }
      }
    }

    // Flatten chunk results in order and map to paragraph
    const pResult = chunkResults.flat();
    result[paragraph.id] = pResult;

    if (onParagraphAnalyzed) {
      onParagraphAnalyzed(paragraph.id, pResult);
    }
  };

  // Run all paragraph analyses sequentially
  for (const task of paragraphTasks) {
    await runParagraphAnalysis(task);
  }

  return result;
}

interface SemanticChapter {
  title: string;
  startParagraphIndex: number;
  endParagraphIndex: number;
}

/**
 * Uses Gemini API to semantically analyze the passage paragraph structure 
 * and group them into natural chapters/sections with engaging titles.
 */
/**
 * Counts English words in a text block
 */
export function countEnglishWords(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
  return words.length;
}

/**
 * Determines semantic chapter groupings for a long passage based on paragraph index ranges,
 * aiming for approximately wordLimit words per section while preserving sentence/paragraph completeness.
 */
export async function determineSemanticChapters(
  passageText: string,
  apiKey: string,
  targetChapterCount: number,
  wordLimit: number
): Promise<SemanticChapter[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 등록해 주세요.");
  }

  const cleanText = passageText.trim();
  if (!cleanText) {
    throw new Error("지문 내용이 비어 있습니다.");
  }

  // Split into raw paragraphs (by double newlines)
  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    // Single paragraph or less, no split needed
    return [{
      title: "기본 단원",
      startParagraphIndex: 0,
      endParagraphIndex: 0
    }];
  }

  // Create lightweight outline: index + English word count + first 100 characters of each paragraph
  const outline = paragraphs.map((p, idx) => {
    const wordCount = countEnglishWords(p);
    const snippet = p.length > 100 ? `${p.substring(0, 100)}...` : p;
    return `[Paragraph ${idx}] (${wordCount} English words): "${snippet}"`;
  }).join('\n\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an elite academic textbook editor and ESL curriculum architect.
Your task is to analyze the outline of a long English passage and group its paragraphs semantically into EXACTLY ${targetChapterCount} coherent, natural thematic chapters/sections.

Here is the paragraph outline with corresponding index numbers and the number of English words in each paragraph:
${outline}

CRITICAL INSTRUCTIONS:
1. You MUST group these paragraphs sequentially into EXACTLY ${targetChapterCount} chapters/sections. The returned JSON array MUST contain exactly ${targetChapterCount} elements.
2. Group the paragraphs logically by topic, narrative progression, or subject shift, but also try to balance the total number of English words in each chapter/section as evenly as possible.
3. The ideal target is about ${wordLimit} English words per chapter/section. Try to avoid any single chapter exceeding ${wordLimit} English words if possible while preserving paragraph boundaries.
4. If the total number of English words in the passage is small or if it's not possible to balance perfectly, prioritize grouping paragraphs into EXACTLY ${targetChapterCount} chapters/sections anyway.

You must return the grouping in the following strict JSON array format. Every paragraph index MUST be assigned to exactly one chapter, sequentially:
[
  {
    "title": "A highly engaging thematic title in Korean for this section (e.g. 우주 탐사의 역사)",
    "startParagraphIndex": 0,
    "endParagraphIndex": 4
  }
]

Ensure the JSON is fully valid. Do not omit any paragraph index. Start with index 0 and end with the last index (${paragraphs.length - 1}).
Do not wrap the output in markdown code blocks. Output strictly valid JSON.`;

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

  try {
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
      throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("Gemini가 유효한 분석결과를 반환하지 않았습니다.");
    }

    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed)) {
      throw new Error("Gemini가 단원 분할 결과를 배열 형식으로 반환하지 않았습니다.");
    }

    return parsed.map((item: any) => ({
      title: item.title || "새로운 단원",
      startParagraphIndex: typeof item.startParagraphIndex === 'number' ? item.startParagraphIndex : 0,
      endParagraphIndex: typeof item.endParagraphIndex === 'number' ? item.endParagraphIndex : 0
    }));
  } catch (error: any) {
    console.error("Gemini determineSemanticChapters error:", error);
    // Fallback: entire passage as a single chapter
    return [{
      title: "전체 지문",
      startParagraphIndex: 0,
      endParagraphIndex: paragraphs.length - 1
    }];
  }
}

/**
 * Splits a long text passage semantically by chapters, and then sequentially by word count thresholds,
 * returning an array of placeholder lessons awaiting lazy on-demand generation.
 * Always preserves complete sentences.
 */
export async function splitPassageIntoLessons(
  passageText: string,
  titleInput: string,
  wordLimit: number,
  apiKey: string
): Promise<ReadingLesson[]> {
  const cleanText = passageText.trim();
  if (!cleanText) {
    throw new Error("지문 내용이 비어 있습니다.");
  }

  // 1. Split into paragraphs
  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  // Count total English words across the entire passage
  const totalEnglishWords = countEnglishWords(cleanText);
  const targetChapterCount = Math.max(1, Math.round(totalEnglishWords / wordLimit));

  // 2. Fetch semantic chapters via lightweight outline Gemini check
  let semanticChapters = await determineSemanticChapters(cleanText, apiKey, targetChapterCount, wordLimit);
  
  // Post-process: If Gemini returned more chapters than targetChapterCount, merge adjacent ones sequentially
  if (semanticChapters.length > targetChapterCount) {
    while (semanticChapters.length > targetChapterCount) {
      const currentCounts = semanticChapters.map(chapter => {
        const startIdx = Math.max(0, Math.min(chapter.startParagraphIndex, paragraphs.length - 1));
        const endIdx = Math.max(startIdx, Math.min(chapter.endParagraphIndex, paragraphs.length - 1));
        const chapterParagraphs = paragraphs.slice(startIdx, endIdx + 1);
        return countEnglishWords(chapterParagraphs.join('\n\n'));
      });

      // Find the adjacent pair (i, i+1) with the minimum combined word count
      let minCombined = Infinity;
      let mergeIdx = 0;
      for (let i = 0; i < semanticChapters.length - 1; i++) {
        const combined = currentCounts[i] + currentCounts[i + 1];
        if (combined < minCombined) {
          minCombined = combined;
          mergeIdx = i;
        }
      }

      const ch1 = semanticChapters[mergeIdx];
      const ch2 = semanticChapters[mergeIdx + 1];
      
      let mergedTitle = ch1.title === ch2.title ? ch1.title : `${ch1.title} & ${ch2.title}`;
      if (mergedTitle.length > 40) {
        mergedTitle = mergedTitle.substring(0, 37) + "...";
      }

      const mergedChapter: SemanticChapter = {
        title: mergedTitle,
        startParagraphIndex: Math.min(ch1.startParagraphIndex, ch2.startParagraphIndex),
        endParagraphIndex: Math.max(ch1.endParagraphIndex, ch2.endParagraphIndex)
      };

      semanticChapters.splice(mergeIdx, 2, mergedChapter);
    }
  }

  // Calculate final English word count for each chapter
  const finalChapterWordCounts = semanticChapters.map(chapter => {
    const startIdx = Math.max(0, Math.min(chapter.startParagraphIndex, paragraphs.length - 1));
    const endIdx = Math.max(startIdx, Math.min(chapter.endParagraphIndex, paragraphs.length - 1));
    const chapterParagraphs = paragraphs.slice(startIdx, endIdx + 1);
    return countEnglishWords(chapterParagraphs.join('\n\n'));
  });

  // Apportionment: allocate partsCount to each chapter such that the sum is exactly targetChapterCount
  const partsCount = new Array(semanticChapters.length).fill(1);
  let currentTotalParts = semanticChapters.length;
  
  while (currentTotalParts < targetChapterCount) {
    let maxRatio = -1;
    let maxIdx = 0;
    for (let i = 0; i < semanticChapters.length; i++) {
      const wordsPerPart = finalChapterWordCounts[i] / partsCount[i];
      if (wordsPerPart > maxRatio) {
        maxRatio = wordsPerPart;
        maxIdx = i;
      }
    }
    partsCount[maxIdx]++;
    currentTotalParts++;
  }
  
  const baseTitle = titleInput.trim() || cleanText.substring(0, 20).replace(/\n/g, ' ') + '...';
  const lessons: ReadingLesson[] = [];

  let totalLessonsCount = 0;
  for (let chIdx = 0; chIdx < semanticChapters.length; chIdx++) {
    totalLessonsCount += partsCount[chIdx];
  }

  let lessonCounter = 1;
  const cleanBase = baseTitle.length > 25 ? baseTitle.substring(0, 22).trim() + "..." : baseTitle;

  // 3. Process each semantic chapter
  for (let chIdx = 0; chIdx < semanticChapters.length; chIdx++) {
    const chapter = semanticChapters[chIdx];
    const totalParts = partsCount[chIdx];
    const cleanChapterTitle = chapter.title.length > 20 ? chapter.title.substring(0, 17).trim() + "..." : chapter.title;
    
    // Safety check indices
    const startIdx = Math.max(0, Math.min(chapter.startParagraphIndex, paragraphs.length - 1));
    const endIdx = Math.max(startIdx, Math.min(chapter.endParagraphIndex, paragraphs.length - 1));
    
    // Reconstruct chapter text
    const chapterParagraphs = paragraphs.slice(startIdx, endIdx + 1);
    const chapterText = chapterParagraphs.join('\n\n');
    
    // Robust sentence splitter supporting mixed English/Korean layout and varied punctuation using sbd
    const sentences: string[] = [];
    const paragraphsList = chapterText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const para of paragraphsList) {
      sentences.push(...splitIntoSentences(para));
    }
    
    if (totalParts === 1) {
      // Create a single placeholder lesson for this chapter
      const suffix = totalLessonsCount > 1 ? ` (${lessonCounter}/${totalLessonsCount})` : '';
      const lessonTitle = `${cleanBase}` + (semanticChapters.length > 1 ? ` - ${cleanChapterTitle}` : '') + suffix;
      lessonCounter++;

      lessons.push({
        id: `reading-pending-${Date.now()}-${chIdx}-${Math.random().toString(36).substring(2, 6)}`,
        title: lessonTitle,
        passageText: chapterText,
        createdAt: Date.now() - chIdx * 1000,
        paragraphs: [],
        vocabulary: [],
        quizzes: [],
        isPending: true
      });
    } else {
      // Split chapter locally into totalParts balanced parts by English word count, preserving complete sentences
      const chapterWordCount = finalChapterWordCounts[chIdx];
      const targetWordsPerPart = Math.max(1, Math.ceil(chapterWordCount / totalParts));
      
      const parts: string[][] = [];
      let currentPart: string[] = [];
      let wordCountInPart = 0;
      
      for (const sentence of sentences) {
        currentPart.push(sentence);
        wordCountInPart += countEnglishWords(sentence);

        // Cut when the balanced target size is reached (but not for the last part)
        if (wordCountInPart >= targetWordsPerPart && parts.length < totalParts - 1) {
          parts.push(currentPart);
          currentPart = [];
          wordCountInPart = 0;
        }
      }
      if (currentPart.length > 0) {
        parts.push(currentPart);
      }

      const totalPartsCount = parts.length;
      for (let pIdx = 0; pIdx < totalPartsCount; pIdx++) {
        const partText = parts[pIdx].join(' ');

        const suffix = totalLessonsCount > 1 ? ` (${lessonCounter}/${totalLessonsCount})` : '';
        const lessonTitle = `${cleanBase}` + (semanticChapters.length > 1 ? ` - ${cleanChapterTitle}` : '') + suffix;
        lessonCounter++;

        lessons.push({
          id: `reading-pending-${Date.now()}-${chIdx}-${pIdx}-${Math.random().toString(36).substring(2, 6)}`,
          title: lessonTitle,
          passageText: partText,
          createdAt: Date.now() - (chIdx * 1000 + pIdx * 100),
          paragraphs: [],
          vocabulary: [],
          quizzes: [],
          isPending: true
        });
      }
    }
  }

  return lessons;
}
export const matchSentenceAnalysis = (analyses: SentenceAnalysis[] | undefined, sentence: string): SentenceAnalysis | undefined => {
  if (!analyses || !sentence) return undefined;
  const cleanS = sentence.trim().toLowerCase();
  
  // 1. Exact or simple substring match first
  let match = analyses.find(
    a => a.sentence.trim().toLowerCase() === cleanS ||
         a.sentence.toLowerCase().includes(cleanS) ||
         cleanS.includes(a.sentence.toLowerCase())
  );
  if (match) return match;
  
  // 2. Normalized alphanumeric match
  const normalize = (txt: string) => txt.toLowerCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
  const normS = normalize(sentence);
  if (!normS) return undefined;
  
  return analyses.find(a => {
    const normA = normalize(a.sentence);
    return normA === normS || normA.includes(normS) || normS.includes(normA);
  });
};

export async function autoFillMissingAnalyses(
  lesson: { id: string; passageText: string; paragraphs: Array<{ id: number; englishText: string }> },
  currentCache: Record<number, SentenceAnalysis[]>,
  apiKey: string
): Promise<Record<number, SentenceAnalysis[]>> {
  const isEnglishSentence = (s: string): boolean => {
    const hasEnglish = /[a-zA-Z]/.test(s);
    const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
    return hasEnglish && !hasKorean;
  };

  // Find all missing sentences
  const missingByParagraph: Record<number, string[]> = {};
  let totalMissingCount = 0;

  lesson.paragraphs.forEach(p => {
    const sentences = splitIntoSentences(p.englishText);
    const paragraphAnalyses = currentCache[p.id] || [];
    sentences.forEach(sentence => {
      if (!matchSentenceAnalysis(paragraphAnalyses, sentence)) {
        if (!missingByParagraph[p.id]) {
          missingByParagraph[p.id] = [];
        }
        missingByParagraph[p.id].push(sentence);
        totalMissingCount++;
      }
    });
  });

  if (totalMissingCount === 0) {
    return currentCache;
  }

  console.log(`[AutoFill] Detected ${totalMissingCount} missing sentence analyses. Automatically recovering...`);

  const updatedCache = { ...currentCache };
  const paragraphIds = Object.keys(missingByParagraph).map(Number);

  try {
    let currentCompleted = 0;
    for (const pId of paragraphIds) {
      const sentencesToAnalyze = missingByParagraph[pId];
      
      // Delay to avoid rate limit (429)
      if (currentCompleted > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await analyzeParagraphChunkSentences(
        pId,
        99, // special index for auto-fill chunk
        sentencesToAnalyze,
        lesson.passageText,
        apiKey
      );

      if (result && result.length > 0) {
        const currentParagraphAnalysis = updatedCache[pId] || [];
        const cleanSentencesToAnalyze = sentencesToAnalyze.map(s => s.trim().toLowerCase());
        
        // Filter out old matching items to prevent duplicate records
        const filtered = currentParagraphAnalysis.filter(a => {
          const cleanA = a.sentence.trim().toLowerCase();
          return !cleanSentencesToAnalyze.includes(cleanA);
        });
        
        updatedCache[pId] = [...filtered, ...result];
      }

      currentCompleted++;
    }
    console.log(`[AutoFill] Successfully recovered ${totalMissingCount} missing analyses!`);
  } catch (err) {
    console.error("[AutoFill] Failed to auto-recover missing analyses:", err);
  }

  return updatedCache;
}

/**
 * Formats and cleans lesson titles for PDF export and browser print dialogs,
 * replacing slashes with 'of' (e.g. 1/4 -> 1of4), removing special characters, and truncating long titles cleanly at CHxx / Chapter xx.
 */
export function formatPdfFileName(title: string): string {
  if (!title) return "Reading_Lesson";

  let clean = title.trim();

  // 1. Extract part notation (e.g. (1/4), (1-4), (1of4)) if present anywhere in title
  let partStr = '';
  const partMatch = clean.match(/\((\d+)\s*[/|-|of]\s*(\d+)\)/i);
  if (partMatch) {
    partStr = `(${partMatch[1]}of${partMatch[2]})`;
    clean = clean.replace(/\((\d+)\s*[/|-|of]\s*(\d+)\)/gi, '').trim();
  } else {
    const inlinePartMatch = clean.match(/\b(\d+)\s*[/|-|of]\s*(\d+)\b/i);
    if (inlinePartMatch) {
      partStr = `(${inlinePartMatch[1]}of${inlinePartMatch[2]})`;
      clean = clean.replace(/\b(\d+)\s*[/|-|of]\s*(\d+)\b/gi, '').trim();
    }
  }

  // 2. Replace illegal filename characters with space: / \ : * ? " < > |
  clean = clean.replace(/[/\\:*?"<>|]/g, ' ').trim();

  // 3. Search for chapter pattern (e.g. CH10, CH 10, Chapter 10) and cut off long subtitles after it
  const chMatch = clean.match(/^(.*?\b(?:ch|chapter)\s*\d+)(.*)$/i);
  if (chMatch) {
    clean = chMatch[1].trim();
  } else {
    // 4. Otherwise, if there is a ' - ' separator, cut off at the first ' - '
    if (clean.includes(' - ')) {
      clean = clean.split(' - ')[0].trim();
    }
  }

  // 5. Clean trailing dots, dashes, underscores, spaces
  clean = clean.replace(/[\s._-]+$/g, '').trim();

  // 6. Limit base title length so total filename length (including partStr suffix) <= 40
  const maxBaseLength = partStr ? Math.max(15, 38 - partStr.length) : 40;
  if (clean.length > maxBaseLength) {
    clean = clean.substring(0, maxBaseLength - 3).trim() + "...";
  }

  // 7. Append partStr at the VERY BACK of filename
  if (partStr) {
    clean = `${clean} ${partStr}`;
  }

  return clean || "Reading_Lesson";
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * AI 원스크린 초압축 마이크로 오답 코칭 (1-Screen Micro Coaching):
 * 단 1회의 초고속 API 호출로 [본문 발췌 + 1줄 직관 뉘앙스 + 실생활 짝꿍 표현 1개 + 1초 확인 미니 퀴즈 1개]를 생성
 */
export async function generateMicroCoaching(
  question: string,
  choices: string[],
  userWrongAnswer: string,
  correctAnswer: string,
  rationale: string,
  apiKey: string,
  passageContext?: string
): Promise<MicroCoachingData> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const choicesStr = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n');
  const prompt = `You are an elite, encouraging 1:1 English coach utilizing cognitive microlearning principles.
The student solved a reading comprehension or vocabulary quiz and picked a WRONG answer.

${passageContext ? `Reading Passage Context:\n"${passageContext.slice(0, 1500)}..."\n` : ''}
Quiz Question:
${question}

Choices:
${choicesStr}

Student's Selected Wrong Answer:
"${userWrongAnswer}"

Actual Correct Answer:
"${correctAnswer}"

Original Rationale:
${rationale}

CRITICAL TASK: Generate a compact, all-in-one micro coaching package designed to be absorbed in 15 seconds.
1. locationLabel: Specify the exact paragraph location if passage is given (e.g. '📍 본문 제 2문단 (Paragraph 2)').
2. passageExcerpt: Quote the EXACT 1~2 key sentences from the passage that give the decisive clue (in English).
3. excerptTranslation: Clear, natural Korean translation of the excerpted sentence.
4. connectionExplanation: 1 simple, friendly sentence in Korean explaining how the passage excerpt directly connects to the correct choice.
5. coreNuance: 1~2 super-clear, friendly Korean sentences explaining why the wrong choice doesn't fit and why the correct answer is perfect (ELI5 level, friendly, everyday tone).
6. collocation: Exactly 1 high-frequency native partner expression with meaning and a short 5~8 word example.
7. transferQuiz: Exactly 1 super-easy 3-choice fill-in-the-blank question testing the exact same concept in a simple everyday context, with Korean translation and 1-line explanation.

Output JSON matching this schema:
{
  "locationLabel": "📍 본문 제 2문단 (Paragraph 2)",
  "passageExcerpt": "Exact English sentence from the passage containing the decisive clue",
  "excerptTranslation": "발췌 문장의 자연스러운 쉬운 한글 해석",
  "connectionExplanation": "발췌된 문장이 문제의 정답과 어떻게 바로 연결되는지 알기 쉬운 1문장 설명",
  "coreNuance": "오답과 정답의 차이를 초등학생도 알기 쉽게 설명한 1~2문장",
  "collocation": {
    "phrase": "Easy native phrase",
    "meaning": "쉬운 한글 뜻",
    "example": "Simple everyday example sentence"
  },
  "transferQuiz": {
    "id": "micro-t1",
    "question": "Short 6~10 word English sentence with a blank (e.g. 'I drink water to stay _______ .')",
    "translation": "자연스러운 한글 해석",
    "choices": ["Option A", "Option B", "Option C"],
    "correctIndex": 0,
    "rationale": "친절하고 쉬운 1문장 해설"
  }
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.message || `Gemini API 오류 (${data.error.code || 'UNKNOWN'})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 마이크로 코칭 데이터를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as MicroCoachingData;
}

/**
 * 3단계 오답 코칭 Step 1: 정답을 가리고 인지적 착각 원인과 소크라테스식 힌트 질문 생성
 */
export async function generateWrongAnswerCoachingStep1(
  question: string,
  choices: string[],
  userWrongAnswer: string,
  apiKey: string,
  passageContext?: string
): Promise<WrongAnswerCoachingStep1Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const choicesStr = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n');
  const prompt = `You are a friendly, encouraging 1:1 English reading coach. The student solved a reading comprehension or vocabulary quiz and picked a WRONG answer.
Do NOT reveal the correct answer. Your goal is to guide the student with VERY EASY, FRIENDLY, and INTUITIVE Korean hints (ELI5 level: Explain Like I'm 5) so they can effortlessly discover the answer themselves by connecting the passage clue directly to the question.

${passageContext ? `Reading Passage Context:\n"${passageContext.slice(0, 1500)}..."\n` : ''}
Quiz Question:
${question}

Choices:
${choicesStr}

Student's Selected Wrong Answer:
"${userWrongAnswer}"

CRITICAL GUIDELINES:
1. locationLabel: Specify EXACTLY which paragraph or section this clue comes from (e.g. '📍 본문 제 2문단 (Paragraph 2)' or '📍 본문 제 1문단').
2. passageExcerpt: Directly quote the EXACT 1~2 key sentences or clauses from that paragraph that contain the decisive clue for this question (in English).
3. excerptTranslation: Provide a clear, natural Korean translation of the excerpted sentence so the student immediately understands its meaning.
4. connectionExplanation: Explain in 1~2 simple, friendly Korean sentences HOW this excerpted sentence in that paragraph connects to the question and helps resolve the confusion (e.g. '본문 제 2문단의 이 부분에서 주인공에게 ~역할이 주어졌다고 직접 언급되어 있으므로, 질문의 역할 보기와 바로 연결됩니다.').
5. socraticHint: 1~2 easy sentences pointing out the logical bridge without giving away the direct choice index.
6. reflectiveQuestion: A very easy, direct question in Korean (e.g. '발췌된 문장의 ~표현을 볼 때, 주인공의 의도는 A에 가까울까요, B에 가까울까요?').
7. guidedChoices: 2~3 friendly, short hint chips in Korean comparing the choices.
8. guidingInsight: A 1-line easy takeaway summary.

Output JSON matching this schema:
{
  "locationLabel": "📍 본문 제 2문단 (Paragraph 2)",
  "passageExcerpt": "Exact English sentence or clause from the passage containing the decisive clue",
  "excerptTranslation": "발췌 문장의 자연스러운 쉬운 한글 해석",
  "connectionExplanation": "발췌된 본문 문장이 문제의 질문/보기와 어떻게 연결되는지 알기 쉬운 1~2문장 설명",
  "socraticHint": "초등학생도 이해할 수 있는 매우 쉽고 명확한 본문 단서 힌트",
  "reflectiveQuestion": "정답을 쉽게 떠올릴 수 있는 직관적인 한 줄 질문",
  "guidedChoices": ["💡 보기 힌트 1", "💡 보기 힌트 2"],
  "guidingInsight": "한 줄 핵심 꿀팁 요약"
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.message || `Gemini API 오류 (${data.error.code || 'UNKNOWN'})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 1단계 코칭 힌트를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep1Data;
}

/**
 * 3단계 오답 코칭 Step 2: 뉘앙스 비교 및 멘탈 모델 교정 + 원어민 짝꿍 표현 2개 (쉬운 설명 & 실생활 예문)
 */
export async function generateWrongAnswerCoachingStep2(
  question: string,
  userWrongAnswer: string,
  correctAnswer: string,
  rationale: string,
  apiKey: string,
  passageContext?: string
): Promise<WrongAnswerCoachingStep2Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an encouraging, friendly 1:1 English coach.
The student has now seen the correct answer. Your goal is to explain why [Wrong Choice] was misleading and why [Correct Answer] fits best in VERY EASY, INTUITIVE, and CLEAR Korean (ELI5 level).

${passageContext ? `Reading Passage Context:\n"${passageContext.slice(0, 1000)}..."\n` : ''}
Question:
${question}

Student's Wrong Choice:
"${userWrongAnswer}"

Actual Correct Answer:
"${correctAnswer}"

Explanation/Rationale:
${rationale}

CRITICAL GUIDELINES:
1. nuanceContrast: Explain in 2 super-simple, friendly Korean sentences why the wrong choice doesn't fit and why the correct answer is the perfect choice (use an easy real-life metaphor if helpful).
2. collocations: Provide EXACTLY 2 super-useful, everyday native English partner expressions (5~8 words each, easy vocabulary) with natural Korean translations and simple examples.

Output JSON matching this schema:
{
  "nuanceContrast": "오답과 정답의 차이를 초등학생도 알기 쉽게 설명한 2문장",
  "collocations": [
    {
      "phrase": "Easy native collocation 1",
      "meaning": "쉬운 한글 뜻",
      "example": "Simple, everyday English example sentence"
    },
    {
      "phrase": "Easy native collocation 2",
      "meaning": "쉬운 한글 뜻",
      "example": "Simple, everyday English example sentence"
    }
  ]
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.message || `Gemini API 오류 (${data.error.code || 'UNKNOWN'})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 2단계 뉘앙스 대조를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep2Data;
}

/**
 * 3단계 오답 코칭 Step 3: 즉시 적용을 위한 쉬운 실전 변형 문제 2개 (Easy & Intuitive Far Transfer)
 */
export async function generateWrongAnswerCoachingStep3(
  question: string,
  userWrongAnswer: string,
  correctAnswer: string,
  apiKey: string
): Promise<WrongAnswerCoachingStep3Data> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert, encouraging English teacher.
The student made a mistake on a specific vocabulary/grammar concept:
Original Question: "${question}"
Wrong Choice: "${userWrongAnswer}"
Correct Choice: "${correctAnswer}"

CRITICAL TASK:
Generate EXACTLY 2 NEW 3-choice fill-in-the-blank questions in simple everyday situations that test the SAME core word or rule, but are VERY EASY AND ACCESSIBLE TO SOLVE.

CRITICAL GUIDELINES FOR EASY VARIATION QUIZZES:
1. Sentence Length & Vocabulary: Keep sentences short (6~10 words) with simple, high-frequency everyday vocabulary.
2. Context Clue: Make the context clue super obvious so applying the correct word feels natural and rewarding.
3. Distractors: The other 2 choices must be clearly different and easy words, so the student can solve it with confidence.
4. Include a clear Korean translation of the question sentence so the user understands the context without stress.
5. Provide a short, friendly 1~2 sentence Korean explanation.

Output JSON matching this schema:
{
  "transferQuizzes": [
    {
      "id": "t1",
      "question": "Short, clear English sentence with a blank (e.g. 'I drink water every morning to stay _______ .')",
      "translation": "자연스러운 한글 해석 (예: '나는 매일 아침 수분을 유지하기 위해 물을 마신다.')",
      "choices": ["Option A", "Option B", "Option C"],
      "correctIndex": 0,
      "rationale": "초등학생도 쉽게 이해할 수 있는 친절한 1~2문장 해설"
    },
    {
      "id": "t2",
      "question": "Short, clear English sentence with a blank",
      "translation": "자연스러운 한글 해석",
      "choices": ["Option A", "Option B", "Option C"],
      "correctIndex": 1,
      "rationale": "친절하고 쉬운 1~2문장 해설"
    }
  ]
}
Do not wrap in markdown \`\`\`json.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.message || `Gemini API 오류 (${data.error.code || 'UNKNOWN'})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 3단계 변형 문제를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WrongAnswerCoachingStep3Data;
}

/**
 * Generates 2 bespoke writing scenarios based on the reading passage's core vocabulary & theme.
 */
export async function generateReadingWritingScenarios(
  lesson: ReadingLesson,
  apiKey: string
): Promise<WritingTemplateData> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const vocabListStr = (lesson.vocabulary || []).map(v => `${v.word} (${v.meaning})`).join(', ');

  const prompt = `You are an expert native English instructional designer and writing tutor.
Analyze this reading passage:
- Article Title: "${lesson.title}"
- Passage Excerpt: "${lesson.passageText.slice(0, 1500)}"
- Key Vocabulary/Expressions: "${vocabListStr}"

CRITICAL TASK:
Generate 2 DISTINCT, EASY-TO-PRACTICE, REAL-WORLD SITUATIONAL SCENARIOS tailored to the domain/theme of this passage (e.g. Science, Technology, History, Culture, Society, Business, or Daily Life).

CRITICAL GUIDELINES (ONE TARGET VOCABULARY PER SCENARIO):
1. TARGET 1 CORE VOCABULARY/EXPRESSION PER SCENARIO:
   - Scenario 1: Pick EXACTLY 1 primary core word/expression from the list (from: ${vocabListStr}).
   - Scenario 2: Pick ANOTHER 1 primary core word/expression from the list (from: ${vocabListStr}).
   - The user will practice using this ONE specific target word in a natural 1-sentence response.
2. EASY, INTUITIVE SITUATION (situation in Korean):
   - 1-2 clear, easy sentences in Korean describing a simple, realistic situation where saying this sentence makes total sense. Do NOT make it overly difficult or complicated.
3. CONCRETE TARGET KOREAN INTENT (koreanIntent in Korean):
   - The exact Korean sentence the user wants to express, with the target English word in parentheses (e.g. '우리는 잠재적 리스크를 단념시키기(deter) 위해 사전 조치를 취해야 합니다.').
4. SENTENCE SCAFFOLD (template in English):
   - A clean, helpful fill-in-the-blank sentence frame (8~12 words) with blanks '_______'.
5. NATURAL SAMPLE SENTENCE (sampleSentence in English):
   - A natural, clear native English sentence (8~12 words) completing the thought using the target word.
6. TARGET KEYWORD (keyKeywords):
   - Array containing the 1 target word, e.g. ["deter (단념시키다/방어하다)"].
7. PRACTICAL TIP (tip in Korean):
   - 1 friendly sentence explaining how to use this target word in this context.

Return a JSON object with this exact schema:
{
  "targetWord": "Target Word 1 (meaning in Korean)",
  "situation": "Easy and clear situation in Korean (1-2 sentences)",
  "koreanIntent": "The target Korean sentence to say in quotes",
  "prompt": "본문의 핵심 어휘를 활용하여 상황에 맞는 1문장을 완성해 보세요.",
  "template": "English fill-in-the-blank template matching the target structure",
  "sampleSentence": "A natural, clear native English completion",
  "tip": "Friendly tip in Korean explaining how to use this target word",
  "keyKeywords": ["Target Word 1 (meaning in Korean)"],
  "scenarios": [
    {
      "category": "Vivid category in Korean matching the passage context",
      "targetWord": "Target Word 1 (meaning in Korean)",
      "situation": "Easy and clear situation in Korean (1-2 sentences)",
      "koreanIntent": "The target Korean sentence to say in quotes",
      "template": "English fill-in-the-blank template with blanks _______",
      "sampleSentence": "Natural native English sentence",
      "keyKeywords": ["Target Word 1 (meaning in Korean)"],
      "tip": "Friendly tip in Korean"
    },
    {
      "category": "Another vivid category in Korean matching the passage context",
      "targetWord": "Target Word 2 (meaning in Korean)",
      "situation": "Easy and clear situation in Korean (1-2 sentences)",
      "koreanIntent": "The target Korean sentence to say in quotes",
      "template": "English fill-in-the-blank template with blanks _______",
      "sampleSentence": "Natural native English sentence",
      "keyKeywords": ["Target Word 2 (meaning in Korean)"],
      "tip": "Friendly tip in Korean"
    }
  ]
}

Do not wrap in markdown \`\`\`json. Return raw JSON string only.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 실전 시나리오를 생성하지 못했습니다.");
  return JSON.parse(cleanJsonString(text)) as WritingTemplateData;
}

/**
 * 실시간 작문 첨삭 및 코칭 함수 for Reading Lesson
 */
export async function evaluateReadingUserSentence(
  lesson: ReadingLesson,
  userSentence: string,
  apiKey: string,
  activeContext?: { situation?: string; koreanIntent?: string; template?: string }
): Promise<WritingEvaluationResult> {
  if (!apiKey) throw new Error("Gemini API Key가 필요합니다.");
  if (!userSentence.trim()) throw new Error("작문 문장을 입력해 주세요.");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an encouraging, expert native English writing coach and tutor.
The student is practicing writing based on this reading lesson:
- Article Title: "${lesson.title}"
- Passage Theme: "${lesson.passageText.slice(0, 800)}"
- Real-Life Situation Given: "${activeContext?.situation || lesson.writingTemplate?.situation || ''}"
- Target Korean Intent: "${activeContext?.koreanIntent || lesson.writingTemplate?.koreanIntent || ''}"
- Given Template: "${activeContext?.template || lesson.writingTemplate?.template || ''}"
- Student's Written Sentence: "${userSentence.trim()}"

CRITICAL EVALUATION INSTRUCTIONS:
1. PRIMARY GOAL: Check whether the student effectively expressed the intended meaning in natural English suitable for the given situation.
2. If the sentence is grammatically correct and matches the situation well, award a HIGH SCORE (85~100) and praise their expression!
3. 'correctedSentence' should polish minor grammar, prepositions, or phrasing.
4. 'nativeAlternative' should demonstrate how a native speaker naturally says this exact thought in this context.
5. 'feedback' and 'explanation' in Korean must provide warm, constructive feedback.

Return a JSON object matching this schema:
{
  "isNatural": true or false,
  "score": integer between 1 and 100,
  "feedback": "Warm, encouraging 1-2 sentences in Korean evaluating how well they expressed the thought.",
  "correctedSentence": "The perfected English sentence.",
  "nativeAlternative": "A natural native speaker alternative sentence in English in this situation.",
  "explanation": "Clear 1-2 sentence Korean explanation of key nuances or grammar."
}

Do not wrap in markdown \`\`\`json. Return raw JSON string only.`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini가 유효한 첨삭 결과를 반환하지 않았습니다.");
  return JSON.parse(cleanJsonString(text)) as WritingEvaluationResult;
}


