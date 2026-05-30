import { ReadingLesson } from './types';

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
        rationale: "정답은 2번입니다.\n\n본문의 첫 번째 문장을 인용하면: \"Trees are not isolated individuals... but are instead members of a complex, highly connected subterranean community.\" (나무들은 고립된 개체들이 아니라 지하에서 서로 긴밀하게 연결된 공동체의 구성원이다)라고 명시되어 있습니다.\n\n오답 설명:\n- 1번: \"isolated individuals(고립된 개체)\"가 아니라고 원문에서 명확히 부인하고 있으므로 오답입니다.\n- 3번: 단순한 햇빛 경쟁(\"competing for sunlight\")을 넘어서는 관계라고 설명했으므로 오답입니다.\n- 4번: 지하 균사체망으로 연결된다고 하였으므로 나뭇잎 흔들림으로 대화한다는 것은 전혀 어울리지 않습니다.",
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
        rationale: "정답은 2번입니다.\n\n원문의 4-5번째 문장을 인용하면: \"When an individual tree is attacked... it can transmit warning chemical signals... neighboring trees immediately synthesize defensive chemicals... to deter the impending invasion.\" (한 나무가 해충의 공격을 받으면 경보 화학 신호를 보내고, 이웃 나무들은 침입을 막기 위해 방어용 화학물질을 합성한다)라고 설명합니다. 따라서 침입에 대비해 자신을 보호할 생물학적 방어를 수립한다는 2번이 확실한 추론입니다.\n\n오답 설명:\n- 1번: 물 흡수를 멈춘다는 언급은 전혀 나타나 있지 않습니다.\n- 3번: 나무는 스스로 뿌리 위치를 이동(\"relocate their root systems\")할 수 없으므로 비현실적인 설명입니다.\n- 4번: 이웃 나무들이 해충을 보내어 원래 나무를 공격하게 한다는 것은 지문의 흐름과 완전히 어긋납니다.",
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
        rationale: "정답은 3번입니다.\n\n본문의 다섯 번째 문장을 인용하면: \"Upon receiving the signal, neighboring trees immediately synthesize defensive chemicals... to deter the impending invasion.\" (신호를 받으면 이웃 나무들은 다가올 침입을 'deter'하기 위해 방어 물질을 합성한다)라고 되어 있습니다. 닥쳐올 외침을 저지하고 단념시키기 위한 행동이므로 'deter'의 유의어는 'prevent(막다, 방지하다)'가 가장 적합합니다.\n\n오답 설명:\n- 1번 encourage(격려하다)와 2번 accelerate(가속하다)는 침입을 도와주는 꼴이 되므로 문맥상 맞지 않는 반대말입니다.\n- 4번 observe(관찰하다)는 방어 화학물질을 합성해 능동적으로 대항하는 본문의 어조를 담아내지 못합니다.",
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
        rationale: "정답은 2번입니다.\n\n본문의 세 번째 문장을 인용하면: \"Through this network, which scientists affectionately call the 'Wood Wide Web,' trees can share vital nutrients...\" (과학자들이 '우드 와이드 웹'이라고 부르는 이 네트워크를 통해 영양소를 공유한다)라고 구체적으로 밝히고 있습니다.\n\n오답 설명:\n- 1번: 구름 속으로 수분을 뿜어 비를 내리게 한다는 공상적인 설명은 본문에 없습니다.\n- 3번: 썩은 가지가 거름이 된다는 일반 지식은 본문에서 언급하는 지하 통신망의 설명이 아닙니다.\n- 4번: 새가 미네랄을 옮겨준다는 주장은 지문에 전혀 존재하지 않는 엉뚱한 정보입니다.",
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
        rationale: "정답은 2번입니다.\n\n본문의 두 번째 문장을 인용하면: \"Beneath the forest floor lies a vast, intricate network of fungal threads...\" (숲 바닥 아래에는 균사체로 이루어진 거대하고 'intricate'한 통신망이 놓여 있다)라고 나옵니다. 거미줄이나 인터넷처럼 얽히고설킨 정교하고 복잡한 네트워크를 묘사하므로 'complex'가 문맥상 유의어입니다.\n\n오답 설명:\n- 1번 simple(단순한)은 복잡하고 광대한 균사체 망의 설명과 반대되는 단어입니다.\n- 3번 temporary(임시의)는 본문에서 묘사하는 거대한 생태학적 상시 망과 조화를 이루지 못합니다.\n- 4번 dangerous(위험한)는 이 망이 나무들에게 생명선이자 도움을 주는 순기능을 하므로 문맥상 어색합니다.",
        type: "vocab"
      }
    ]
  }
];

// Base64 Serialization helpers for database-free serverless quiz sharing
export function serializeLesson(lesson: ReadingLesson): string {
  try {
    const jsonStr = JSON.stringify(lesson);
    // URL-safe Base64 compression
    const utf8Bytes = encodeURIComponent(jsonStr);
    const base64 = btoa(unescape(utf8Bytes));
    return base64;
  } catch (error) {
    console.error("Failed to serialize reading lesson:", error);
    return "";
  }
}

export function deserializeLesson(base64Str: string): ReadingLesson | null {
  if (!base64Str) return null;
  try {
    const decodedUtf8 = escape(atob(base64Str));
    const jsonStr = decodeURIComponent(decodedUtf8);
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
3. EASY & DETAILED KOREAN RATIONALES (오답 해설):
   - The 'rationale' (해설) for each quiz MUST be written in simple, clear, and highly encouraging KOREAN.
   - IMPORTANT: To prove the correct/incorrect answers, you MUST DIRECTLY CITE AND QUOTE the exact original English sentence(s) from the passage in your Korean rationale, translating and explaining them step-by-step.
    - Format: "정답은 X번입니다. [원문 인용 문장]에 의하면... 따라서 ~의 의미가 되므로 X가 적절합니다."
    - Dissect why each of the other three wrong choices is incorrect or misleading by referencing the passage details.
4. CORE STUDY ITEMS (VIBRANT VOCABULARY & ANALYSIS LIST):
   - The 'vocabulary' array MUST contain at least 6 key items extracted from the passage, representing a balanced mix of:
     - 'vocabulary': Key academic/TOEFL vocabulary words.
     - 'grammar': Key grammatical structures or syntax rules used in the passage.
     - 'expression': Key idioms, collocations, or common English expressions found in the text.
     - 'context': Thematic terms, context markers, or cultural backgrounds essential to understand the passage.
   - For each item, you must specify the 'type' (which must be 'vocabulary', 'grammar', 'expression', or 'context') and a 'contextNote' in KOREAN providing a clear grammatical explanation, context detail, or translation tip.

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
  ]
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
    const response = await fetch(endpoint, {
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
        word: v.word || "",
        meaning: v.meaning || "",
        sentence: v.sentence || "",
        pronunciation: v.pronunciation || "",
        type: v.type || "vocabulary",
        contextNote: v.contextNote || ""
      })),
      quizzes: (parsedJson.quizzes || []).map((q: any, idx: number) => ({
        id: q.id || `q-${Date.now()}-${idx}`,
        question: q.question || "문제가 생성되지 않았습니다.",
        choices: q.choices || ["A", "B", "C", "D"],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        rationale: q.rationale || "상세 해설이 없습니다.",
        type: q.type === 'vocab' ? 'vocab' : 'comprehension'
      }))
    };

    return lesson;
  } catch (error: any) {
    console.error("Gemini Reading Generation Error:", error);
    throw new Error(error.message || "지문을 분석하고 퀴즈를 출제하는 중 알 수 없는 장애가 발생했습니다.");
  }
}
