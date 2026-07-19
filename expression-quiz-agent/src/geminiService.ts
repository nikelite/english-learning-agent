import { Lesson, QuizItem } from './types';

// Helper function to call fetch with exponential backoff retry for network errors/transient API limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 7,
  initialDelay = 1000
): Promise<Response> {
  let delay = initialDelay;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      // Retry on HTTP 429 (Rate Limit) or HTTP 5xx (Server Error)
      if (response.status === 429 || response.status >= 500) {
        console.warn(`Gemini API returned status ${response.status}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        delay += Math.floor(Math.random() * 200); // add jitter
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
      delay += Math.floor(Math.random() * 200); // add jitter
    }
  }
  throw new Error("Gemini API 요청 실패: 최대 재시도 횟수를 초과했습니다.");
}

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  
  // Remove control characters except standard whitespace characters (tab, newline, carriage return)
  cleaned = cleaned.replace(/[\u0000-\u0008\u000b-\u000f\u0010-\u001f]/g, "");
  
  return cleaned;
}

// Preloaded Premium Lessons for immediate offline exploration
export const PRESET_LESSONS: Lesson[] = [
  {
    id: "preset-despite-although",
    title: "Despite vs Although 완벽 구분하기",
    sourceText: "Despite our preparation, we failed the exam. / Although we prepared well, we failed the exam. 두 문장의 문법 요소와 전치사 vs 접속사 차이점 분석",
    createdAt: 1716656400000,
    eli5: {
      explanation: "Despite와 Although는 둘 다 '~임에도 불구하고'라는 뜻으로 양보의 의미를 나타내요. 하지만 뒤에 데려오는 친구들의 성격이 완전히 달라요! Despite는 명사(이름표)만 데려올 수 있는 '전치사 힘'을 가지고 있고, Although는 주어+동사가 들어있는 완전한 문장(절)을 데려오는 '접속사 힘'을 가지고 있습니다.",
      analogy: "기차(Although)와 자동차 트렁크(Despite)의 차이로 이해해보세요! 'Although'는 기관사(주어)와 조수(동사)가 타고 있는 진짜 기차 칸들을 연결해 주는 연결고리예요. 반면 'Despite'는 단순한 트렁크 가방 같아서, 그 안에는 짐더미(명사/동명사)만 툭 던져 넣을 수 있어요. 기차가 아닌 짐더미에 연결고리를 붙이거나, 가방 안에 기관차를 통째로 억지로 구겨 넣으면 고장 나겠죠?",
      example: "Despite the heavy rain (O) / Although the heavy rain (X)",
      exampleContext: "Despite 뒤에는 명사(the heavy rain)만 왔으므로 옳습니다. Although 뒤에 명사만 딸랑 오면 문법적 에러가 납니다!"
    },
    memoryTips: {
      tipFormula: "Despite + 명사 덩어리 VS Although + 주어 + 동사",
      conceptA: "Despite / In spite of",
      conceptADesc: "뒤에 '명사(Noun) 또는 -ing(동명사)'만 옴! (전치사 패밀리)",
      conceptB: "Although / Even though / Though",
      conceptBDesc: "뒤에 반드시 '주어 + 동사'를 갖춘 절이 옴! (접속사 패밀리)",
      visualImage: "Despite는 명사 가방을 메고 다니고, Although는 뒤에 주어-동사 기차를 운전한다!"
    },
    pronunciation: {
      wordOrPhrase: "Despite our preparation",
      phoneticRespelling: "dih-SPYT ow-er prep-uh-RAY-shun",
      koreanPhonetic: "디스파이 타워 프레퍼레-이션",
      stressGuide: "dih-SPYT에서 'SPYT'에 강세가 들어가며, Despite의 t와 our가 연음되어 [디스파이 타워]처럼 들립니다. preparation에서는 RAY에 가장 강한 강세를 줍니다."
    },
    quizzes: [
      {
        id: "q-da-1",
        question: "다음 빈칸에 들어갈 알맞은 단어는? \n\n________ the loud noise, baby Sophia slept peacefully all afternoon.",
        choices: [
          "Although",
          "Despite",
          "Even though",
          "Though"
        ],
        correctIndex: 1,
        rationale: "빈칸 뒤에 'the loud noise'(시끄러운 소음)라는 명사 덩어리만 존재하므로, 명사를 이끄는 전치사인 'Despite'(B번)가 정답입니다. A번 Although, C번 Even though, D번 Though는 모두 뒤에 주어+동사를 동반하는 접속사이므로 이 자리에 올 수 없습니다."
      },
      {
        id: "q-da-2",
        question: "다음 중 문법적으로 올바른 문장을 고르세요.",
        choices: [
          "Although the bad weather, they played soccer.",
          "Despite it was raining heavily, they went out.",
          "In spite of the bad weather, they played soccer.",
          "Even though the bad weather, they went out."
        ],
        correctIndex: 2,
        rationale: "'In spite of'는 'Despite'와 마찬가지로 전치사이며, 뒤에 명사구인 'the bad weather'를 취했으므로 올바른 문장입니다(C번). A, D번은 명사구 앞에 접속사 Although/Even though를 써서 틀렸고, B번은 주어+동사 문장 앞에 전치사 Despite를 써서 틀렸습니다."
      },
      {
        id: "q-da-3",
        question: "다음 두 문장을 한 문장으로 합칠 때 빈칸에 들어갈 말은?\n\n'She was very tired. She finished her homework.'\n-> She finished her homework ________ she was very tired.",
        choices: [
          "despite",
          "in spite of",
          "although",
          "despite of"
        ],
        correctIndex: 2,
        rationale: "합쳐진 문장 빈칸 뒤에 'she(주어) was(동사) very tired'가 오고 있습니다. 주어와 동사를 이끄는 것은 양보의 접속사 'although'(C번)입니다. A번 despite와 B번 in spite of는 전치사라서 안 되며, D번 'despite of'는 존재하지 않는 엉터리 표현입니다."
      },
      {
        id: "q-da-4",
        question: "빈칸에 들어갈 짝으로 가장 적절한 것은?\n\n1) ________ we ran fast, we missed the bus.\n2) ________ our fast running, we missed the bus.",
        choices: [
          "Although - Despite",
          "Despite - Although",
          "Even though - In spite",
          "Despite - In spite of"
        ],
        correctIndex: 0,
        rationale: "A번이 정답입니다. 1) 문장은 'we(주어) ran(동사) fast'이므로 접속사 'Although'가 적절하고, 2) 문장은 'our fast running'(우리의 빠른 달리기)이라는 동명사/명사구이므로 전치사 'Despite'가 적합합니다. B번은 순서가 반대이고, C번 'In spite'는 단독으로 쓸 수 없으며, D번은 둘 다 전치사라 절을 이끌 수 없습니다."
      },
      {
        id: "q-da-5",
        question: "다음 빈칸에 문법적으로 들어갈 수 없는 단어는?\n\nI went to work ________ feeling extremely unwell.",
        choices: [
          "despite",
          "in spite of",
          "although",
          "notwithstanding"
        ],
        correctIndex: 2,
        rationale: "빈칸 뒤의 'feeling extremely unwell'은 동명사(-ing) 덩어리입니다. 따라서 명사/동명사를 목적어로 취하는 전치사 A번 Despite, B번 In spite of, D번 Notwithstanding(격식체 전치사)은 모두 사용 가능합니다. 반면 접속사인 C번 Although는 뒤에 주어+동사(Although I felt~) 형태로 와야 하므로 들어갈 수 없습니다."
      }
    ]
  },
  {
    id: "preset-boring-bored",
    title: "감정 형용사 -ing vs -ed 종결하기",
    sourceText: "I am boring vs I am bored. The movie was confusing vs The movie was confused. 사람 주어 사물 주어에 따른 분사 형용사의 올바른 매칭법",
    createdAt: 1716656460000,
    eli5: {
      explanation: "사람의 감정을 나타내는 형용사는 기본적으로 동사(남에게 ~한 감정을 주다)에서 출발했어요. 그래서 현재분사(-ing)는 그 감정을 '일으키는 원인'을 설명하고, 과거분사(-ed)는 그 감정을 '느끼게 된 상태'를 뜻합니다! 주어가 사람인지 사물인지 공식처럼 기계적으로 외우면 실수가 생겨요. 핵심은 '원인인가? 아니면 피해자(체험자)인가?'입니다.",
      analogy: "감정 화살표 비유를 들어볼게요! '-ing'는 내 가슴속에서 남에게 쏘는 '감정의 활(화살)'입니다. 반대로 '-ed'는 날아오는 감정 화살에 푹 찔려 아파하는 '화살 박힌 심장'이에요. 그래서 'I am boring'이라고 하면 '나는 남을 심심하게 만드는 인간 화살발사기다'라는 뜻이 되어버려 내 매력이 뚝 떨어져요! 지루함을 당해 하품을 하는 중이라면 화살에 찔린 상태인 'I am bored'라고 해야 자연스럽습니다.",
      example: "The class is boring, so the students are bored.",
      exampleContext: "수업(Class)은 지루함을 뿜어내는 '원인(-ing)'이고, 학생들(Students)은 그 지루함을 받아서 느끼는 '체험자(-ed)'입니다."
    },
    memoryTips: {
      tipFormula: "원인 제공자 = -ing (Active) VS 감정 체험자 = -ed (Passive)",
      conceptA: "Exciting / Boring / Confusing",
      conceptADesc: "어떤 대상이 주변에 그 감정을 '풍기고 뿜어내고 있는' 느낌!",
      conceptB: "Excited / Bored / Confused",
      conceptBDesc: "외부 원인으로 인해 마음속에 그 감정이 '탑재되고 채워진' 느낌!",
      visualImage: "-ing는 뿜어져 나오는 향기 뿜뿜, -ed는 그 향기를 맡고 취한 얼굴!"
    },
    pronunciation: {
      wordOrPhrase: "I was confused by the movie",
      phoneticRespelling: "ay wuz kun-FYOODZD by the MOO-vee",
      koreanPhonetic: "아이 워즈 컨퓨즈드 바이 더 무비",
      stressGuide: "confused에서 'FYOODZD'에 강한 강세를 주어 발음합니다. by the가 뭉쳐지면서 '바이 더'로 부드럽게 넘어가며, movie의 'MOO'에 주강세를 줍니다."
    },
    quizzes: [
      {
        id: "q-bb-1",
        question: "다음 대화의 빈칸에 들어갈 알맞은 짝은?\n\nA: How was the horror movie yesterday?\nB: It was really ________! I was so ________ that I couldn't sleep.",
        choices: [
          "frightened - frightening",
          "frightening - frightened",
          "frightening - frightening",
          "frightened - frightened"
        ],
        correctIndex: 1,
        rationale: "B번이 정답입니다. 영화(It)는 무서움을 뿜어내는 '원인'이므로 현재분사인 'frightening'이 알맞고, 나(I)는 그 영화 때문에 무서움을 당해 느낀 '피해자(체험자)'이므로 과거분사 'frightened'가 들어맞습니다. A번은 순서가 반대이고, C번과 D번은 두 빈칸에 같은 분사를 넣어 의미가 맞지 않습니다."
      },
      {
        id: "q-bb-2",
        question: "선생님의 문법 설명이 너무 어려워서 이해가 안 되는 상황입니다. 올바른 표현을 고르세요.",
        choices: [
          "The teacher's explanation was confused.",
          "We were confusing by the explanation.",
          "The teacher's explanation was confusing.",
          "We felt confusing during the class."
        ],
        correctIndex: 2,
        rationale: "선생님의 설명(Explanation)이 혼란을 유발하는 원인이므로 C번 'confusing'이 맞습니다. A번은 설명 자체가 감정을 느끼고 혼란스러워한다는 황당한 소리가 되며, B, D번은 혼란을 느낀 주체(We)이므로 'confused'를 써야 맞습니다."
      },
      {
        id: "q-bb-3",
        question: "다음 빈칸에 알맞은 단어는?\n\nJeremy has won a lottery! He is extremely ________ right now.",
        choices: [
          "exciting",
          "excited",
          "excite",
          "excitedly"
        ],
        correctIndex: 1,
        rationale: "복권에 당첨된 제레미(Jeremy)가 엄청난 신남을 느끼는 '상태'이므로 과거분사 형용사인 B번 'excited'가 들어와야 합니다. A번 exciting은 제레미가 남들을 엄청 흥분시키는 존재라는 뜻이 되며, C번 excite는 동사 원형이라 be동사 뒤에 올 수 없고, D번 excitedly는 부사라 보어 자리에 부적합합니다."
      },
      {
        id: "q-bb-4",
        question: "다음 문장 중 어법상 틀린 부분을 찾아 바르게 고친 것은?\n\n'Visiting new cities is always bored because I love staying home.'",
        choices: [
          "Visiting -> Visit",
          "bored -> boring",
          "staying -> stayed",
          "love -> loving"
        ],
        correctIndex: 1,
        rationale: "B번이 정답입니다. 새로운 도시를 방문하는 것(Visiting new cities)은 집돌이인 나에게 따분함을 주는 '원인'입니다. 사물 성격의 동명사 구가 주어이므로 bored(지루함을 느끼는)를 boring(지루함을 유발하는)으로 고쳐야 올바릅니다. A번 Visiting→Visit은 동명사 주어 변경과 무관하고, C번과 D번은 문법적으로 문제가 없는 부분을 고치려는 오류입니다."
      },
      {
        id: "q-bb-5",
        question: "다음 두 문장의 빈칸에 차례대로 들어갈 가장 알맞은 것은?\n\n- The dynamic show was deeply ________ to watch.\n- The children were so ________ by the magic tricks.",
        choices: [
          "amused - amusing",
          "amusing - amusing",
          "amusing - amused",
          "amused - amused"
        ],
        correctIndex: 2,
        rationale: "C번이 정답입니다. 첫 번째 빈칸은 쇼(show)가 즐거움을 주는 원인이므로 현재분사 'amusing', 두 번째 빈칸은 마술에 의해 아이들(children)이 즐거움을 느꼈으므로 과거분사 'amused'가 올바른 조합입니다. A번은 순서가 반대이고, B번과 D번은 두 빈칸에 같은 분사를 넣어 부적절합니다."
      }
    ]
  }
];

// System Prompt for Gemini to guarantee perfect parsing and compliance
const SYSTEM_PROMPT = `You are a native English linguistic expert and educational tutor. Your task is to analyze the provided English quiz, explanation, or text, and generate a deep study material matching the exact JSON structure provided below.

Your response MUST be a single, valid JSON object and nothing else. Do not wrap in markdown \`\`\`json ... \`\`\`, just return the raw JSON string.

You must fill out all fields in KOREAN (except the English keywords/examples where appropriate).

Strict Schema Requirements:
{
  "title": "A short, engaging title in Korean summarizing the core topic (e.g., 'Despite vs Although 완벽 구분하기')",
  "eli5": {
    "explanation": "Explain Like I'm Five in Korean. Why this grammar/expression was correct and why the wrong choice is awkward. Use a simple, non-jargon explanation.",
    "analogy": "A clever, highly intuitive analogy or visual metaphor in Korean to help the student visualize the rules.",
    "example": "A clear, natural contrastive example sentence in English (e.g., 'Despite the rain (O) vs Although the rain (X)')",
    "exampleContext": "Brief Korean explanation about the example sentence context and why it works."
  },
  "memoryTips": {
    "tipFormula": "A short, memorable 'formula' or rule equation (e.g., 'Despite + Noun vs Although + S + V')",
    "conceptA": "Name of Concept A (e.g., 'Despite / In spite of')",
    "conceptADesc": "Brief, punchy description of Concept A in Korean",
    "conceptB": "Name of Concept B (e.g., 'Although / Even though')",
    "conceptBDesc": "Brief, punchy description of Concept B in Korean",
    "visualImage": "A mental image or vivid memory trick in Korean to lock this rule in the user's brain forever."
  },
  "pronunciation": {
    "wordOrPhrase": "The key word or phrase from the lesson that needs pronunciation training",
    "phoneticRespelling": "Phonetic respelling with syllable capitals for stress (e.g., 'dih-SPYT ow-er prep-uh-RAY-shun')",
    "koreanPhonetic": "Natural Korean phonetic pronunciation guide showing linked sounds (e.g., '디스파이 타워 프레퍼레-이션')",
    "stressGuide": "Detailed tips in Korean on linking, rhythm, and where to put primary stress."
  },
  "quizzes": [
    {
      "id": "A unique string ID, e.g., 'q1', 'q2', etc.",
      "question": "The question in Korean (can include English sentence with a blank like 'Fill in the blank: She went to bed ________ being tired.')",
      "choices": [
        "Four plausible multiple-choice options. Make them highly deceptive based on the wrong answers mentioned in the prompt."
      ],
      "correctIndex": "0-indexed integer (0, 1, 2, or 3) representing the correct choice",
      "rationale": "Extremely detailed explanation in Korean explaining why the correct choice is correct and why EACH of the other options is incorrect or grammatically invalid in this context. CRITICAL: Use letter labels A번, B번, C번, D번 (NOT numbers like 1번, 2번, 3번, 4번) to reference choices. choices[0]=A번, choices[1]=B번, choices[2]=C번, choices[3]=D번."
    }
  ]
}

Important Instructions:
1. Make sure to generate exactly the requested number of distinct multiple-choice quizzes under the 'quizzes' array.
2. In the quizzes, test different angles of the topic: preposition matching, active vs passive voice, tense, subject-verb agreement, etc.
3. Keep the tone friendly, encouraging, and highly professional yet simple.
4. CRITICAL: Never use raw unescaped double quotes (") inside any JSON string values. For any inner quotations or wrapping words in the explanations, analogies, examples, and rationales, you MUST use single quotes (') instead. E.g., write 'affect' or '영향을 주다' instead of "affect" or "영향을 주다". This is absolutely critical to prevent JSON parsing failures.
5. Ensure the JSON is completely valid, all quotation marks are escaped properly, and no trailing commas exist.`;

export async function generateLessonFromText(
  text: string,
  apiKey: string,
  questionCount: number = 5
): Promise<Lesson> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("분석할 텍스트가 입력되지 않았습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}
            
            Strict Request Parameters:
            - Generate EXACTLY ${questionCount} multiple-choice quizzes under the 'quizzes' array.
            
            Here is the study text to analyze:
            """
            ${cleanText}
            """`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          eli5: {
            type: "object",
            properties: {
              explanation: { type: "string" },
              analogy: { type: "string" },
              example: { type: "string" },
              exampleContext: { type: "string" }
            },
            required: ["explanation", "analogy", "example", "exampleContext"]
          },
          memoryTips: {
            type: "object",
            properties: {
              tipFormula: { type: "string" },
              conceptA: { type: "string" },
              conceptADesc: { type: "string" },
              conceptB: { type: "string" },
              conceptBDesc: { type: "string" },
              visualImage: { type: "string" }
            },
            required: ["tipFormula", "conceptA", "conceptADesc", "conceptB", "conceptBDesc", "visualImage"]
          },
          pronunciation: {
            type: "object",
            properties: {
              wordOrPhrase: { type: "string" },
              phoneticRespelling: { type: "string" },
              koreanPhonetic: { type: "string" },
              stressGuide: { type: "string" }
            },
            required: ["wordOrPhrase", "phoneticRespelling", "koreanPhonetic", "stressGuide"]
          },
          quizzes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: {
                  type: "array",
                  items: { type: "string" }
                },
                correctIndex: { type: "integer" },
                rationale: { type: "string" }
              },
              required: ["question", "choices", "correctIndex", "rationale"]
            }
          }
        },
        required: ["title", "eli5", "memoryTips", "pronunciation", "quizzes"]
      },
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

    const cleanedText = cleanJsonString(responseText);
    const parsedJson = JSON.parse(cleanedText);

    // Map properties and guarantee compliance
    const lesson: Lesson = {
      id: `lesson-${Date.now()}`,
      title: parsedJson.title || "새로운 영어 학습 세트",
      sourceText: cleanText,
      createdAt: Date.now(),
      eli5: {
        explanation: parsedJson.eli5?.explanation || "설명이 누락되었습니다.",
        analogy: parsedJson.eli5?.analogy || "비유가 누락되었습니다.",
        example: parsedJson.eli5?.example || "예문이 누락되었습니다.",
        exampleContext: parsedJson.eli5?.exampleContext || "해설이 누락되었습니다."
      },
      memoryTips: {
        tipFormula: parsedJson.memoryTips?.tipFormula || "",
        conceptA: parsedJson.memoryTips?.conceptA || "",
        conceptADesc: parsedJson.memoryTips?.conceptADesc || "",
        conceptB: parsedJson.memoryTips?.conceptB || "",
        conceptBDesc: parsedJson.memoryTips?.conceptBDesc || "",
        visualImage: parsedJson.memoryTips?.visualImage || ""
      },
      pronunciation: {
        wordOrPhrase: parsedJson.pronunciation?.wordOrPhrase || "",
        phoneticRespelling: parsedJson.pronunciation?.phoneticRespelling || "",
        koreanPhonetic: parsedJson.pronunciation?.koreanPhonetic || "",
        stressGuide: parsedJson.pronunciation?.stressGuide || ""
      },
      quizzes: (parsedJson.quizzes || []).map((q: any, index: number) => {
        const rawChoices = q.choices || ["A", "B", "C", "D"];
        const rawCorrectIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
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
        let remappedRationale = q.rationale || "상세 해설이 없습니다.";
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

        return {
          id: `expr-q-${Date.now()}-${index}`,
          question: q.question || "문제가 생성되지 않았습니다.",
          choices: shuffledChoices,
          correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
          rationale: remappedRationale
        };
      })
    };

    return lesson;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "학습자료를 생성하는 도중 알 수 없는 에러가 발생했습니다.");
  }
}

export async function serializeLesson(lesson: Lesson): Promise<string> {
  try {
    const jsonStr = JSON.stringify(lesson);
    const byteArray = new TextEncoder().encode(jsonStr);
    
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
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
    console.error("Failed to serialize expression lesson:", error);
    return "";
  }
}

export async function deserializeLesson(base64Str: string): Promise<Lesson | null> {
  if (!base64Str) return null;
  try {
    let standardBase64 = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    while (standardBase64.length % 4) {
      standardBase64 += "=";
    }
    
    const binaryStr = atob(standardBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const concat = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concat.set(chunk, offset);
      offset += chunk.length;
    }
    
    const jsonStr = new TextDecoder().decode(concat);
    return JSON.parse(jsonStr) as Lesson;
  } catch (error) {
    console.error("Failed to deserialize expression lesson:", error);
    return null;
  }
}

// Vocabulary Mode System Prompt for Gemini
const VOCABULARY_SYSTEM_PROMPT = `You are a native English linguistic expert and educational tutor. Your task is to analyze the provided English vocabulary root word, word list, or text, identify all distinct vocabulary words, meanings, or nuances, and generate a list of deep study materials.

For each distinct word, derivative, or meaning/nuance (e.g., if the user lists 'affect' with different part-of-speeches or meanings, or lists 'affection', 'affectionate' as related derivatives, create a separate lesson entry for each one), generate a corresponding lesson study material.

Your response MUST be a single, valid JSON object with a "lessons" array containing the lesson objects. Do not wrap in markdown \`\`\`json ... \`\`\`, just return the raw JSON string.

You must fill out all fields in KOREAN (except the English keywords/examples where appropriate).

Strict Schema Requirements:
{
  "lessons": [
    {
      "title": "The vocabulary word and its part of speech/meaning in Korean (e.g., 'affect (v. 영향을 미치다)')",
      "eli5": {
        "explanation": "Explain the word's native nuance and dictionary definition in Korean. Focus on the core feeling of the word, native-speaker sensations, nuances, and things usually missed in standard vocabulary books. Write in a friendly, engaging tone suitable for a 10-year-old child (ELI10) in Korean.",
        "analogy": "A clever, highly intuitive analogy or visual metaphor in Korean to help the student visualize the word's core nuance.",
        "example": "A clear, natural example sentence in English showing the word in its typical context (e.g., 'Smoking affects your health. (O)')",
        "exampleContext": "Brief Korean explanation about the example sentence context, usage, and why it is natural."
      },
      "memoryTips": {
        "tipFormula": "A short, memorable 'formula' or visual equation (e.g., 'Affect = Action -> Effect = Result')",
        "conceptA": "The word's main concept/뉘앙스",
        "conceptADesc": "Brief, punchy description of the main concept in Korean",
        "conceptB": "A confusing synonym, antonym, or close nuance (e.g. influence, or effect)",
        "conceptBDesc": "Brief, punchy explanation of the difference in Korean",
        "visualImage": "A mental image or vivid memory trick in Korean to lock this word in the user's brain forever."
      },
      "pronunciation": {
        "wordOrPhrase": "The key vocabulary word",
        "phoneticRespelling": "Phonetic respelling with syllable capitals for stress (e.g., 'uh-FEKT')",
        "koreanPhonetic": "Natural Korean phonetic pronunciation guide (e.g., '어펙트')",
        "stressGuide": "Detailed tips in Korean on linking, rhythm, and where to put primary stress."
      },
      "quizzes": [
        {
          "question": "A multiple-choice question in Korean, testing the correct usage of this word in context (e.g. selecting the correct word/preposition for an English blank sentence).",
          "choices": [
            "Four plausible options in English (or Korean as appropriate). Make them highly deceptive based on confusing nuances."
          ],
          "correctIndex": "0-indexed integer (0, 1, 2, or 3) representing the correct choice",
          "rationale": "Extremely detailed explanation in Korean explaining why the correct choice is correct and why EACH of the other options is incorrect. Reference choices using A번, B번, C번, D번."
        }
      ]
    }
  ]
}

Important Instructions:
1. Make sure to generate exactly the requested number of distinct multiple-choice quizzes under the 'quizzes' array for each lesson.
2. Keep the tone friendly, encouraging, and highly professional yet simple (ELI10).
3. CRITICAL: Never use raw unescaped double quotes (") inside any JSON string values. For any inner quotations or wrapping words in the explanations, analogies, examples, and rationales, you MUST use single quotes (') instead. E.g., write 'affect' or '영향을 주다' instead of "affect" or "영향을 주다". This is absolutely critical to prevent JSON parsing failures.
4. Ensure the JSON is completely valid, all quotation marks are escaped properly, and no trailing commas exist.`;

export async function generateVocabularyLessons(
  text: string,
  apiKey: string,
  questionCount: number = 5
): Promise<Lesson[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("분석할 텍스트가 입력되지 않았습니다.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${VOCABULARY_SYSTEM_PROMPT}
            
            Strict Request Parameters:
            - Generate EXACTLY ${questionCount} multiple-choice quizzes under the 'quizzes' array for each lesson.
            
            Here is the study vocabulary/text to analyze:
            """
            ${cleanText}
            """`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          lessons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                eli5: {
                  type: "object",
                  properties: {
                    explanation: { type: "string" },
                    analogy: { type: "string" },
                    example: { type: "string" },
                    exampleContext: { type: "string" }
                  },
                  required: ["explanation", "analogy", "example", "exampleContext"]
                },
                memoryTips: {
                  type: "object",
                  properties: {
                    tipFormula: { type: "string" },
                    conceptA: { type: "string" },
                    conceptADesc: { type: "string" },
                    conceptB: { type: "string" },
                    conceptBDesc: { type: "string" },
                    visualImage: { type: "string" }
                  },
                  required: ["tipFormula", "conceptA", "conceptADesc", "conceptB", "conceptBDesc", "visualImage"]
                },
                pronunciation: {
                  type: "object",
                  properties: {
                    wordOrPhrase: { type: "string" },
                    phoneticRespelling: { type: "string" },
                    koreanPhonetic: { type: "string" },
                    stressGuide: { type: "string" }
                  },
                  required: ["wordOrPhrase", "phoneticRespelling", "koreanPhonetic", "stressGuide"]
                },
                quizzes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      choices: {
                        type: "array",
                        items: { type: "string" }
                      },
                      correctIndex: { type: "integer" },
                      rationale: { type: "string" }
                    },
                    required: ["question", "choices", "correctIndex", "rationale"]
                  }
                }
              },
              required: ["title", "eli5", "memoryTips", "pronunciation", "quizzes"]
            }
          }
        },
        required: ["lessons"]
      },
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

    const cleanedText = cleanJsonString(responseText);
    const parsedJson = JSON.parse(cleanedText);
    const rawLessons = parsedJson.lessons || [];

    return rawLessons.map((item: any, idx: number) => {
      const lesson: Lesson = {
        id: `lesson-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title || "새로운 영어 어휘 학습 세트",
        sourceText: cleanText,
        createdAt: Date.now() - idx * 1000,
        isVocabulary: true,
        eli5: {
          explanation: item.eli5?.explanation || "설명이 누락되었습니다.",
          analogy: item.eli5?.analogy || "비유가 누락되었습니다.",
          example: item.eli5?.example || "예문이 누락되었습니다.",
          exampleContext: item.eli5?.exampleContext || "해설이 누락되었습니다."
        },
        memoryTips: {
          tipFormula: item.memoryTips?.tipFormula || "",
          conceptA: item.memoryTips?.conceptA || "",
          conceptADesc: item.memoryTips?.conceptADesc || "",
          conceptB: item.memoryTips?.conceptB || "",
          conceptBDesc: item.memoryTips?.conceptBDesc || "",
          visualImage: item.memoryTips?.visualImage || ""
        },
        pronunciation: {
          wordOrPhrase: item.pronunciation?.wordOrPhrase || "",
          phoneticRespelling: item.pronunciation?.phoneticRespelling || "",
          koreanPhonetic: item.pronunciation?.koreanPhonetic || "",
          stressGuide: item.pronunciation?.stressGuide || ""
        },
        quizzes: (item.quizzes || []).map((q: any, qIdx: number) => {
          const rawChoices = q.choices || ["A", "B", "C", "D"];
          const rawCorrectIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
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
          choicesWithIndex.forEach((c: any, newIdx: number) => {
            oldToNewIdx[c.cIdx] = newIdx;
          });
          let remappedRationale = q.rationale || "상세 해설이 없습니다.";
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
          TEMP.forEach((temp, labelIdx) => {
            remappedRationale = remappedRationale.replace(new RegExp(temp, 'g'), LABELS[labelIdx]);
          });

          return {
            id: `expr-q-${Date.now()}-${idx}-${qIdx}`,
            question: q.question || "문제가 생성되지 않았습니다.",
            choices: shuffledChoices,
            correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
            rationale: remappedRationale
          };
        })
      };
      return lesson;
    });
  } catch (error: any) {
    console.error("Gemini Vocabulary Generation Error:", error);
    throw new Error(error.message || "어휘 학습자료를 생성하는 도중 알 수 없는 에러가 발생했습니다.");
  }
}

export async function generateAdditionalQuizzes(
  lesson: Lesson,
  wrongDetails: Array<{ question: string; userAnswer: string; correctAnswer: string; rationale: string }>,
  questionCount: number,
  apiKey: string
): Promise<QuizItem[]> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const cleanTitle = lesson.title.replace(/"/g, "'");
  const cleanSourceText = lesson.sourceText.replace(/"/g, "'");
  const cleanExplanation = lesson.eli5.explanation.replace(/"/g, "'");

  let wrongContext = "";
  if (wrongDetails.length > 0) {
    wrongContext = `
The student previously got the following quizzes WRONG. You MUST analyze these mistakes and generate new, different questions that specifically target the concepts, nuances, or grammar/vocabulary errors demonstrated in these mistakes. Test them in different sentences/contexts to verify if they have fully corrected their understanding:
${wrongDetails.map((w, idx) => `
[Mistake #${idx + 1}]
- Question: ${w.question.replace(/"/g, "'")}
- Student's Wrong Selection: ${w.userAnswer.replace(/"/g, "'")}
- Correct Answer: ${w.correctAnswer.replace(/"/g, "'")}
- Rationale: ${w.rationale.replace(/"/g, "'")}
`).join('\n')}
`;
  } else {
    wrongContext = `
The student has no recorded mistakes or has got everything correct. Generate general additional quizzes to further verify and reinforce their understanding of this lesson's concepts.
`;
  }

  const prompt = `You are a native English linguistic expert and educational tutor. Your task is to generate additional quizzes to reinforce the student's understanding of the following English lesson:

Lesson Title: ${cleanTitle}
Lesson Main Content / Source Text:
"""
${cleanSourceText}
"""
Nuance Explanation (ELI10):
"""
${cleanExplanation}
"""
${wrongContext}

Strict Instructions:
1. Generate EXACTLY ${questionCount} multiple-choice quizzes under a "quizzes" array in the returned JSON object.
2. If wrong answers were provided above, make sure the generated quizzes target those exact mistake areas but with DIFFERENT sentences, different answer choices, or different phrasing. Do not reuse the exact same sentences or questions from the mistakes.
3. If it is a vocabulary lesson, ensure all quizzes test the usage, definitions, or nuances of this specific vocabulary word: '${cleanTitle}'.
4. Keep the tone friendly, encouraging, and highly professional yet simple.
5. CRITICAL: Never use raw unescaped double quotes (") inside any JSON string values. For any inner quotations or wrapping words in the explanations and rationales, you MUST use single quotes (') instead. E.g., write 'affect' or '영향을 주다' instead of "affect" or "영향을 주다". This is absolutely critical to prevent JSON parsing failures.
6. The response MUST be a single, valid JSON object.
Do not wrap in markdown \`\`\`json ... \`\`\`, just return the raw JSON string.`;

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
      responseSchema: {
        type: "object",
        properties: {
          quizzes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: {
                  type: "array",
                  items: { type: "string" }
                },
                correctIndex: { type: "integer" },
                rationale: { type: "string" }
              },
              required: ["question", "choices", "correctIndex", "rationale"]
            }
          }
        },
        required: ["quizzes"]
      },
      temperature: 0.3
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
    throw new Error(`Gemini API 통신 실패: ${errorMessage}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error("Gemini가 유효한 결과를 반환하지 않았습니다.");
  }

  const cleanedText = cleanJsonString(responseText);
  const parsedJson = JSON.parse(cleanedText);
  const rawQuizzes = parsedJson.quizzes || [];

  return rawQuizzes.map((q: any, index: number) => {
    const rawChoices = q.choices || ["A", "B", "C", "D"];
    const rawCorrectIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
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
    let remappedRationale = q.rationale || "상세 해설이 없습니다.";
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

    return {
      id: `expr-q-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      question: q.question || "문제가 생성되지 않았습니다.",
      choices: shuffledChoices,
      correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
      rationale: remappedRationale
    };
  });
}

/**
 * Sends a user follow-up question context-aware to Gemini
 */
export async function askGeminiFollowUpQuestion(
  lesson: Lesson,
  question: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }>,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const cleanTitle = lesson.title.replace(/"/g, "'");
  const cleanSourceText = lesson.sourceText.replace(/"/g, "'");
  const cleanExplanation = lesson.eli5.explanation.replace(/"/g, "'");

  const formattedContents = [
    {
      role: "user",
      parts: [
        {
          text: `You are an encouraging native English tutor. The student is currently studying this lesson:
Title: ${cleanTitle}
Content: ${cleanSourceText}
ELI10 Explanation: ${cleanExplanation}

Answer the student's follow-up questions clearly, simply, and in Korean. Do not use complex jargon. Keep the tone friendly, helpful, and engaging (suitable for a 10-year-old child).`
        }
      ]
    },
    ...chatHistory.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    })),
    {
      role: "user",
      parts: [{ text: question }]
    }
  ];

  const requestBody = {
    contents: formattedContents,
    generationConfig: {
      temperature: 0.5
    }
  };

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
    throw new Error("Gemini가 답변을 반환하지 않았습니다.");
  }

  return responseText;
}

