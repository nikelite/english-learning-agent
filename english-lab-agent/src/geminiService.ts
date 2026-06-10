import type { LabLesson, LabQuizItem, CorrectionItem, LabMessage, ConversationSituation } from './types';


// Helper function to call fetch with exponential backoff retry for network errors/transient API limits
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

// Preloaded Preset Lessons for immediate offline exploration
export const PRESET_LESSONS: LabLesson[] = [
  {
    id: "preset-dujin-code-review",
    title: "두진 씨의 코드 리뷰 요청 이메일 첨삭",
    sourceText: "I goes to office yesterday. My manager check my code and say it is good, but I need fix some bug. I am working on it today.",
    correctedText: "I went to the office yesterday. My manager checked my code and said it was good, but I need to fix some bugs. I am working on it today.",
    overallFeedback: "두진 씨의 연령대(40대)와 직종(엔지니어)에 맞는 깔끔하고 전문적인 비즈니스 문어체로 수정했습니다. 과거 시제 사용(went, checked, said)과 단/복수 표현(some bugs), 그리고 준조동사 표현(need to)을 바르게 수정하면 훨씬 신뢰감을 주는 비즈니스 이메일이 완성됩니다. IT 업계에서 자주 사용하는 자연스러운 흐름을 반영하였습니다.",
    createdAt: 1716656400000,
    persona: "두진 (40대 엔지니어, 직장인)",
    style: "written",
    writingLevel: "A2",
    corrections: [
      {
        id: "corr-dj-1",
        original: "I goes to office yesterday",
        corrected: "I went to the office yesterday",
        type: "grammar",
        explanation: "'yesterday'(어제)라는 과거 시점 부사가 있으므로 동사 'goes'를 과거형인 'went'로 고쳐야 합니다. 또한 특정 목적지로서의 사무실을 지칭하므로 정관사 'the'를 붙여 'the office'라고 표현하는 것이 훨씬 자연스럽습니다."
      },
      {
        id: "corr-dj-2",
        original: "My manager check my code and say it is good",
        corrected: "My manager checked my code and said it was good",
        type: "grammar",
        explanation: "이것 역시 과거에 일어난 일을 기술하고 있으므로 'check'와 'say'를 각각 과거 동사 형태인 'checked'와 'said'로 일치시켜야 합니다. 또한 매니저가 칭찬했던 상황도 과거이므로 'is'를 'was'로 시제 일치해 줍니다."
      },
      {
        id: "corr-dj-3",
        original: "need fix some bug",
        corrected: "need to fix some bugs",
        type: "grammar",
        explanation: "동사 'need'는 뒤에 행동을 목적어로 취할 때 to부정사 형태(need to do)를 가집니다. 또한 여러 버그 중 일부를 수정하는 뉘앙스이며 'some' 뒤에는 복수 명사가 오므로 'bug'를 복수형인 'bugs'로 수정하는 것이 올바릅니다."
      }
    ],
    quizzes: [
      {
        id: "q-dj-1",
        question: "다음 문장의 빈칸에 들어갈 알맞은 단어는?\n\nI ________ to the office yesterday to meet our main client.",
        choices: [
          "goes",
          "went",
          "go",
          "gone"
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다. 문장 끝에 과거를 뜻하는 'yesterday'가 있으므로 과거형 동사 'went'(B번)가 필요합니다. A번은 주어가 3인칭 단수일 때의 현재형, C번은 현재형, D번은 과거분사 형태이므로 문법적으로 불가능합니다."
      },
      {
        id: "q-dj-2",
        question: "어법상 자연스럽지 못한 부분을 고르세요.",
        choices: [
          "My manager checked my code.",
          "I need to fix some bugs in the program.",
          "He suggested that I should review the plan.",
          "She needs fix the issue as soon as possible."
        ],
        correctIndex: 3,
        rationale: "정답은 D번입니다. 'need' 동사 뒤에 다른 동작을 연결할 때는 to부정사 형태를 써야 하므로 'needs to fix'로 고쳐야 합니다. 따라서 D번이 문법적으로 어색한 문장입니다. A, B, C번은 모두 올바른 문법적 구성을 취하고 있습니다."
      },
      {
        id: "q-dj-3",
        question: "다음 빈칸에 알맞은 형태로 짝지어진 것은?\n\n- The client ________ (say) it was fine yesterday.\n- We need ________ (check) the system database.",
        choices: [
          "says - checking",
          "said - to check",
          "sayed - check",
          "said - checking"
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다. 첫 번째 문장은 'yesterday'가 있어 과거 시제인 'said'가 와야 하며 (sayed는 잘못된 형태), 두 번째 문장은 'need'의 목적어로 to부정사인 'to check'가 필요합니다. 따라서 두 조건을 만족하는 것은 B번입니다."
      }
    ]
  },
  {
    id: "preset-junhoo-basketball",
    title: "미국 중학생 준후의 농구 클럽 가입 신청 구어체 교정",
    sourceText: "Hi, I am Junhoo. I am new student from Korea. I like play basketball. Can I join your team? I not good at English but I want make friend.",
    correctedText: "Hi, I'm Junhoo. I'm a new student from Korea. I like playing basketball. Can I join your team? I'm not very good at English, but I want to make friends.",
    overallFeedback: "미국 중학교에 재학 중인 한국 중학생 준후의 페르소나에 맞추어, 또래 친구들에게 건네는 친근하고 활기찬 구어체(spoken) 스타일로 다듬었습니다. 원어민 청소년들이 매일 사용하는 일상 회화 패턴을 반영하고, 생략된 관사(a new student), 동명사 목적어(playing), 그리고 친구를 사귀다(make friends)의 관용 표현을 바로잡았습니다.",
    createdAt: 1716656460000,
    persona: "준후 (미국 중학생, 청소년)",
    style: "spoken",
    writingLevel: "A2",
    corrections: [
      {
        id: "corr-jh-1",
        original: "I am new student",
        corrected: "I'm a new student",
        type: "grammar",
        explanation: "단수 셀 수 있는 명사인 'student' 앞에는 관사 'a'가 필수적입니다. 또한 구어체 대화에서는 'I am'을 축약형인 'I'm'으로 표현하는 것이 대화 흐름상 훨씬 자연스럽고 또래다운 표현입니다."
      },
      {
        id: "corr-jh-2",
        original: "I like play basketball",
        corrected: "I like playing basketball",
        type: "expression",
        explanation: "취미나 즐겨 하는 활동을 나타낼 때 'like' 뒤에는 동명사 '-ing' 형태나 to부정사를 써야 합니다. 구어체에서는 동명사 형태인 'playing'을 자주 선호하여 활기차고 자연스러운 뉘앙스를 전달합니다."
      },
      {
        id: "corr-jh-3",
        original: "I not good at English",
        corrected: "I'm not very good at English",
        type: "grammar",
        explanation: "형용사 'good'을 부정하기 위해서는 be동사가 빠질 수 없습니다. 'I'm not' 형태로 만들어 주어야 하며, 'very'를 살짝 얹어 '영어를 아주 잘하진 못하지만'이라는 부드러운 뉘앙스로 조율했습니다."
      },
      {
        id: "corr-jh-4",
        original: "want make friend",
        corrected: "want to make friends",
        type: "expression",
        explanation: "'want' 뒤에는 to부정사인 'to make'를 쓰며, 친구를 사귄다고 할 때는 한 명만 사귀는 것이 아니므로 관용적으로 복수형인 'make friends'라고 표현해야 원어민 표현에 가깝습니다."
      }
    ],
    quizzes: [
      {
        id: "q-jh-1",
        question: "다음 중 '친구를 사귀다'라는 표현으로 가장 올바른 구어체 형태는?",
        choices: [
          "make a friend",
          "make friends",
          "do friends",
          "build friend"
        ],
        correctIndex: 1,
        rationale: "정답은 B번입니다. 영어에서 여러 사람들과 친분을 쌓으며 친구 관계를 맺는다는 관용구는 복수형을 사용한 'make friends'(B번)입니다. 'make a friend'는 아주 특수한 경우(단 한 명의 친구)에만 쓰이며 일반적으로 어색하고, 동사 do나 build는 함께 쓰이지 않습니다."
      },
      {
        id: "q-jh-2",
        question: "빈칸에 들어갈 말이 알맞게 나열된 것은?\n\n- I like ________ (play) games with my classmate.\n- I want ________ (meet) him tomorrow.",
        choices: [
          "playing - to meet",
          "play - meeting",
          "playing - meeting",
          "played - to meet"
        ],
        correctIndex: 0,
        rationale: "정답은 A번입니다. 'like' 뒤에는 동명사 형태인 'playing'이 어울리고, 'want' 뒤에는 반드시 to부정사 형태인 'to meet'가 이어져야 합니다. 따라서 정답은 A번이 됩니다."
      },
      {
        id: "q-jh-3",
        question: "다음 빈칸에 들어갈 알맞은 be동사는?\n\nI ________ not very good at drawing, but I enjoy art class.",
        choices: [
          "is",
          "are",
          "am",
          "be"
        ],
        correctIndex: 2,
        rationale: "정답은 C번입니다. 주어가 1인칭 단수인 'I'이므로 알맞은 be동사는 'am'(C번)입니다. 대화에서는 보통 'I'm not'으로 축약하여 사용하게 됩니다."
      }
    ]
  }
];

// System Prompt for LAB.AGENT Gemini Engine
const SYSTEM_PROMPT = `You are a professional native English linguistic editor, proofreader, and educational tutor.
Your task is to analyze the user's raw English writing (essay, email, or spoken expressions), apply correction rules customized to a specific persona and writing style, and output a detailed structural review.

You must reply with a single, valid JSON object and nothing else. Do not wrap the JSON inside markdown code blocks (e.g. do NOT include \`\`\`json or \`\`\`). Output only the raw string.
All explanation and feedback fields MUST be written in friendly, encouraging, and detailed KOREAN.

Key Constraints & Guidelines for Analysis:
1. **Persona Customization**:
   - The user will specify a persona (e.g., "준후 - 한국에서 온 미국 중학생", "두진 - 한국에서 온 40대 남성 엔지니어", or a custom persona like "대학원생", "비즈니스 기획자").
   - Adjust the corrected text's complexity, vocabulary, and tone to fit this persona naturally. Avoid making a middle schooler sound like a legal advisor, and avoid making a business manager sound like a teenager. Keep their voice but make it grammatically flawless and natural to native ears.
2. **Style Alignment**:
   - Spoken (구어체): Focus on natural conversational flow, daily life idioms, active expressions, and standard contractions (e.g., I'm, don't) that 원어민 (native speakers) use. Keep grammar clear but informal.
   - Written (문어체): Focus on formal composition, academic or professional transition words, rich vocabulary, clear sentence structure, and avoiding informal abbreviations or slangs.
3. **Diff-like Corrections Array**:
   - Identify specific points where the original text was wrong, awkward, or could be improved.
   - For each correction, specify:
     * "original": The EXACT substring from the raw input text that was modified. It MUST match the raw text character-for-character so it can be located in the UI.
     * "corrected": The replacement substring.
     * "type": Either "grammar" (문법 오류), "expression" (어색한 어조/뉘앙스), "vocab" (더 적절한 어휘 선택), or "flow" (문장 연결 및 문맥 흐름).
     * "explanation": Detailed, easy-to-understand Korean explanation of why this was changed, what the rules are, and the difference in nuance.
4. **Overall Feedback**:
   - Provide a encouraging, multi-line paragraph summarizing the user's strong points, areas of improvement, and how they can write better next time. Write this in Korean.
5. **Interactive Multiple-Choice Quizzes**:
   - Generate EXACTLY the requested number of quizzes (N) based on the corrections made.
   - The quizzes MUST be formatted as standard, professional TOEIC or TOEFL multiple-choice questions (e.g. sentence completion with a blank, choosing the correct grammatical option, or finding error corrections).
   - CRITICAL: The question text itself MUST be written entirely in ENGLISH, in the style of TOEIC/TOEFL questions (e.g., 'Choose the option that best completes the sentence:' or 'Identify the grammatically correct sentence:').
   - Each quiz must have exactly 4 choices (English words or sentences).
   - "correctIndex" is a 0-indexed integer (0, 1, 2, or 3) indicating the correct option.
   - "rationale": Extremely detailed Korean explanation of why the correct option is right and why the other options are wrong or awkward.
   - CRITICAL RATIONALE LABEL RULE: You MUST reference choices using letters A, B, C, D (choices[0]=A번, choices[1]=B번, choices[2]=C번, choices[3]=D번) and NOT numbers like 1번, 2번, 3번, 4번 in the rationale string.
6. **Writing Level Evaluation (CEFR)**:
   - Evaluate the CEFR level of the user's raw English writing (A1, A2, B1, B2, C1, C2) and provide it in the "writingLevel" field.
   - Criteria:
     * A1 (Beginner): Very simple sentences, frequent basic grammar/spelling errors, extremely limited vocabulary.
     * A2 (Elementary): Can write simple phrases and sentences, uses basic connectors, but has basic grammar/spelling issues.
     * B1 (Intermediate): Writes straightforward, connected text on familiar topics, correct basic grammar but limited advanced syntax or word choice.
     * B2 (Upper Intermediate): Can write clear, detailed text, uses a variety of sentences and good vocabulary, minor mistakes that do not hinder communication.
     * C1 (Advanced): Fluent, well-structured, clear writing, precise vocabulary, complex grammar rules applied correctly.
     * C2 (Proficiency): Flawless, idiomatic, and highly sophisticated native-level writing.

Strict JSON Schema Requirements:
{
  "title": "A short, engaging title in Korean summarizing this correction session (e.g. '매니저에게 보내는 이메일 피드백')",
  "writingLevel": "The evaluated CEFR level of the raw writing, strictly one of: 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'",
  "correctedText": "The entire corrected English text in full.",
  "overallFeedback": "Detailed overall analysis and encouraging feedback in Korean.",
  "corrections": [
    {
      "id": "A unique string (e.g. 'c1', 'c2')",
      "original": "The exact original substring",
      "corrected": "The corrected replacement substring",
      "type": "grammar",
      "explanation": "Detailed Korean explanation of the correction"
    }
  ],
  "quizzes": [
    {
      "id": "A unique string (e.g. 'q1', 'q2')",
      "question": "The quiz question written entirely in English in TOEIC/TOEFL format (e.g. testing grammar, vocabulary, or expression blanks), testing the correction points.",
      "choices": [
        "Choice A",
        "Choice B",
        "Choice C",
        "Choice D"
      ],
      "correctIndex": 0,
      "rationale": "Detailed Korean explanation. Must reference options as A번, B번, C번, D번."
    }
  ]
}`;

export async function generateCorrection(
  sourceText: string,
  persona: string,
  style: 'spoken' | 'written',
  context: string,
  questionCount: number,
  apiKey: string
): Promise<LabLesson> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const cleanText = sourceText.trim();
  if (!cleanText) {
    throw new Error("교정할 영문 텍스트를 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const userPrompt = `
Analyze and correct the following text.
Persona constraints: ${persona}
Writing Style format: ${style === 'spoken' ? 'Spoken (구어체 - natural spoken dialogue)' : 'Written (문어체 - formal writing)'}
Optional Context: ${context || 'None provided'}
Generate exactly ${questionCount} multiple-choice questions under the 'quizzes' array.

Raw English Writing to Analyze:
"""
${cleanText}
"""
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nStrict Request:\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3
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
      throw new Error("Gemini가 영작 교정 피드백을 반환하지 않았습니다.");
    }

    const parsedJson = JSON.parse(responseText.trim());

    // Validate and process the quizzes (Fisher-Yates shuffle and choice label remapping)
    const quizzes: LabQuizItem[] = (parsedJson.quizzes || []).map((q: any, index: number) => {
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
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}가`, 'g'), `${temp}가`);
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}는`, 'g'), `${temp}는`);
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}를`, 'g'), `${temp}를`);
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}을`, 'g'), `${temp}을`);
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
        id: `lab-q-${Date.now()}-${index}`,
        question: q.question || "문제가 생성되지 않았습니다.",
        choices: shuffledChoices,
        correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
        rationale: remappedRationale
      };
    });

    const corrections: CorrectionItem[] = (parsedJson.corrections || []).map((c: any, index: number) => {
      return {
        id: c.id || `corr-${Date.now()}-${index}`,
        original: c.original || '',
        corrected: c.corrected || '',
        type: c.type === 'grammar' || c.type === 'expression' || c.type === 'vocab' || c.type === 'flow' ? c.type : 'expression',
        explanation: c.explanation || '설명이 없습니다.'
      };
    });

    return {
      id: `lab-${Date.now()}`,
      title: parsedJson.title || "새로운 영어 교정 첨삭",
      sourceText: cleanText,
      correctedText: parsedJson.correctedText || cleanText,
      overallFeedback: parsedJson.overallFeedback || "교정 분석이 성공적으로 완료되었습니다.",
      createdAt: Date.now(),
      persona,
      style,
      corrections,
      quizzes,
      writingLevel: parsedJson.writingLevel
    };

  } catch (error: any) {
    console.error("Gemini correction generation failed:", error);
    throw new Error(error.message || "교정 데이터를 분석하고 생성하는 동안 오류가 발생했습니다.");
  }
}

// Compression & Serialization of LabLesson to Base64 (gzip)
export async function serializeLesson(lesson: LabLesson): Promise<string> {
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
    console.error("Failed to serialize lab lesson:", error);
    return "";
  }
}

export async function deserializeLesson(base64Str: string): Promise<LabLesson | null> {
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
    return JSON.parse(jsonStr) as LabLesson;
  } catch (error) {
    console.error("Failed to deserialize lab lesson:", error);
    return null;
  }
}

const FOLLOW_UP_SYSTEM_PROMPT = `You are a professional native English linguistic editor, proofreader, and educational tutor.
The user has previously received an English correction for their writing. Now, they are asking a follow-up question or requesting a refinement/revision of the corrected text.

You must reply with a single, valid JSON object and nothing else. Do not wrap the JSON inside markdown code blocks (e.g. do NOT include \`\`\`json or \`\`\`). Output only the raw string.
All explanation, feedback, and answers MUST be written in friendly, encouraging, and detailed KOREAN.

Key Constraints & Guidelines:
1. Determine if the user is asking an educational/general question, OR requesting a rewrite/revision/refinement of the corrected text.
2. If it is an educational or explanation question (e.g., "Why is X better than Y?", "Explain this grammar rule", "Can you explain why you changed goes to went?"):
   - Set "textUpdated" to false.
   - Provide a clear, detailed, and encouraging explanation in Korean under "answer".
3. If it is a revision or rewrite request (e.g., "Make it sound more professional", "Rewrite in a polite business tone", "Make it sound like a teenager", "Make it shorter", "Change it to spoken style"):
   - Set "textUpdated" to true.
   - Provide a clear Korean explanation of what changes you made under "answer" (e.g. "더 격식있는 비즈니스 톤으로 수정하였습니다...").
   - Provide the entire new corrected English text under "correctedText".
   - Provide the updated overall feedback in Korean under "overallFeedback".
   - Provide the updated corrections array under "corrections" conforming to the original schema. For each correction item:
     * "original": The EXACT substring from the user's original raw text (sourceText) that was modified. It MUST match the raw text character-for-character.
     * "corrected": The new corrected substring.
     * "type": "grammar", "expression", "vocab", or "flow".
     * "explanation": Detailed, easy-to-understand Korean explanation.

Strict JSON Response Schema:
{
  "answer": "Korean explanation/answer to the user.",
  "textUpdated": true,
  "correctedText": "New full corrected text (only if textUpdated is true)",
  "overallFeedback": "New overall feedback in Korean (only if textUpdated is true)",
  "corrections": [
    {
      "original": "The exact original substring from sourceText",
      "corrected": "The corrected replacement substring",
      "type": "grammar",
      "explanation": "Detailed Korean explanation of the correction"
    }
  ]
}`;

export async function processFollowUp(
  lesson: LabLesson,
  messageText: string,
  apiKey: string
): Promise<{
  answer: string;
  textUpdated: boolean;
  correctedText?: string;
  overallFeedback?: string;
  corrections?: CorrectionItem[];
}> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Build lesson context for the prompt
  const contextPrompt = `
Lesson Context:
- User's Original Text (sourceText): "${lesson.sourceText}"
- Target Persona: "${lesson.persona}"
- Style: "${lesson.style === 'spoken' ? '구어체' : '문어체'}"
- Current Corrected Text: "${lesson.correctedText}"
- Current Overall Feedback: "${lesson.overallFeedback}"
- Current Corrections:
${JSON.stringify(lesson.corrections.map(c => ({ original: c.original, corrected: c.corrected, type: c.type, explanation: c.explanation })), null, 2)}

User's New Message (Question or Revision request):
"${messageText}"
`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${FOLLOW_UP_SYSTEM_PROMPT}\n\nStrict Request:\n${contextPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
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
    throw new Error("Gemini가 응답을 반환하지 않았습니다.");
  }

  try {
    const parsedJson = JSON.parse(responseText.trim());
    
    const corrections: CorrectionItem[] | undefined = parsedJson.corrections 
      ? parsedJson.corrections.map((c: any, index: number) => ({
          id: c.id || `corr-refine-${Date.now()}-${index}`,
          original: c.original || '',
          corrected: c.corrected || '',
          type: c.type === 'grammar' || c.type === 'expression' || c.type === 'vocab' || c.type === 'flow' ? c.type : 'expression',
          explanation: c.explanation || '설명이 없습니다.'
        }))
      : undefined;

    return {
      answer: parsedJson.answer || "답변을 가져오지 못했습니다.",
      textUpdated: !!parsedJson.textUpdated,
      correctedText: parsedJson.correctedText,
      overallFeedback: parsedJson.overallFeedback,
      corrections
    };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Gemini 응답의 형식이 올바르지 않습니다.");
  }
}

// 1. Generate AI Brainstormed / custom situation
export async function generateAIPresentedSituation(
  ideationInput: string,
  type: string,
  apiKey: string
): Promise<ConversationSituation> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a creative educational counselor. Your task is to design a highly engaging, custom English conversation situation based on the user's ideation prompt (which could be a news topic, question-answer, or simple keywords).
The conversation category is: ${type}.

You must respond with a single, valid JSON object and nothing else. Do not wrap in markdown \`\`\`json or similar.
All description, myRole, partnerRole, and goal fields MUST be written in detailed, encouraging KOREAN.
The 'openingLine' (first sentence the AI partner says) MUST be written in natural, fluent English.

JSON Schema:
{
  "title": "A short, engaging title in Korean summarizing this situation",
  "myRole": "Detailed description in Korean of the user's role, background, and their conversation objectives",
  "partnerRole": "Detailed description in Korean of the AI's role, name (if applicable), and attitude",
  "openingLine": "The opening greeting and question in English that the AI partner will say to start the session.",
  "goal": "Specific learning/speaking objectives in Korean for the user to achieve in this session"
}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nUser's custom ideation prompt:\n"""\n${ideationInput}\n"""`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7
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
    throw new Error("Gemini가 상황을 생성하지 못했습니다.");
  }

  try {
    const parsed = JSON.parse(responseText.trim());
    return {
      title: parsed.title || "새로운 영어 토론/롤플레잉",
      myRole: parsed.myRole || "대화 참가자",
      partnerRole: parsed.partnerRole || "대화 상대방",
      openingLine: parsed.openingLine || "Hello, nice to meet you. Shall we start our conversation?",
      goal: parsed.goal || "자유로운 영어 회화 연습"
    };
  } catch (error) {
    console.error("Failed to parse AI situation:", error);
    throw new Error("Gemini 응답의 형식이 올바르지 않습니다.");
  }
}

// 2. Generate Chat Partner Response (single turn)
export async function generateChatPartnerResponse(
  chatHistory: LabMessage[],
  situation: ConversationSituation,
  userPersona: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const systemInstructions = `You are roleplaying as a conversation partner in a specific situation.
Situation Context:
- Title: ${situation.title}
- Your Role & Character: ${situation.partnerRole}
- User's Role & Goal: ${situation.myRole}
- User's Persona (English skill / difficulty level): ${userPersona}
- Overall Conversation Goal: ${situation.goal}

Roleplay Constraints:
1. Play your character naturally and stay in character at all times.
2. Respond entirely in English.
3. Keep your response relatively brief (1-3 sentences) so the user can easily reply.
4. Try to ask a natural follow-up question or make a statement that prompts the user to respond.
5. CRITICAL: Do NOT correct the user's English, point out errors, or explain grammar rules during this chat. Just converse naturally as a native speaker would. The correction will be done separately after the chat session ends.`;

  // Format history for Gemini
  const contents = chatHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: systemInstructions }]
    },
    generationConfig: {
      temperature: 0.7
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
    throw new Error("Gemini가 대화 응답을 반환하지 않았습니다.");
  }

  return responseText.trim();
}

// 3. Generate Final Conversation Correction & Feedback (End Session)
export async function generateConversationFeedback(
  chatHistory: LabMessage[],
  situation: ConversationSituation,
  userPersona: string,
  questionCount: number,
  apiKey: string
): Promise<LabLesson> {
  if (!apiKey) {
    throw new Error("Gemini API Key가 필요합니다. 설정창에서 입력해 주세요.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  // Format chat history into a human-readable transcript
  const transcript = chatHistory
    .map(msg => `${msg.sender === 'user' ? 'User (Me)' : 'AI Partner'}: ${msg.text}`)
    .join('\n');

  // We compile user messages to serve as sourceText
  const userMessages = chatHistory
    .filter(msg => msg.sender === 'user')
    .map(msg => msg.text);
  const combinedUserText = userMessages.join('\n');

  const systemPrompt = `You are a professional native English linguistic editor and conversation tutor.
Your task is to analyze the English utterances made by the 'User (Me)' in the provided chat conversation transcript.
You must generate a detailed structural review and study material based on their mistakes.

You must reply with a single, valid JSON object and nothing else. Do not wrap the JSON inside markdown code blocks (e.g. do NOT include \`\`\`json or \`\`\`). Output only the raw string.
All explanation and feedback fields MUST be written in friendly, encouraging, and detailed KOREAN.

Key Constraints & Guidelines for Analysis:
1. **CEFR Writing/Speaking Level**:
   - Evaluate the CEFR level of the user's utterances (A1, A2, B1, B2, C1, C2) and provide it in the "writingLevel" field.
2. **Overall Feedback**:
   - Write a detailed, encouraging paragraph in Korean summarizing the user's vocabulary range, fluency, grammar patterns, and areas of improvement based on this conversation.
3. **Corrected Text**:
   - Set "correctedText" to a fully polished, natural English paragraph or list summarizing what the user said (or a polished version of their statements in context).
4. **Diff-like Corrections Array**:
   - Identify specific grammar, spelling, or natural phrasing errors in the User's messages.
   - For each correction:
     * "original": The EXACT substring from the User's spoken message that contains the error. It must match a portion of their spoken messages exactly.
     * "corrected": The natural, native replacement.
     * "type": "grammar", "expression", "vocab", or "flow".
     * "explanation": Detailed Korean explanation of why this was changed, nuancing differences.
5. **Interactive Quizzes**:
   - Generate EXACTLY ${questionCount} multiple-choice questions in English based on the corrections.
   - Question text must be in English. Rationale must be in Korean.
   - Rationale must refer to choices using A번, B번, C번, D번 labels (NOT 1번, 2번, 3번, 4번).

JSON Response Schema:
{
  "title": "A short engaging title in Korean summarizing this session (e.g. '호텔 체크인 대화 피드백')",
  "writingLevel": "A1 | A2 | B1 | B2 | C1 | C2",
  "correctedText": "The polished/corrected version of user's spoken content.",
  "overallFeedback": "Detailed overall feedback in Korean.",
  "corrections": [
    {
      "id": "A unique correction id (e.g., 'corr-1')",
      "original": "The exact awkward/wrong substring from the user's messages",
      "corrected": "The corrected replacement substring",
      "type": "grammar",
      "explanation": "Detailed explanation in Korean"
    }
  ],
  "quizzes": [
    {
      "id": "A unique quiz id (e.g., 'q-1')",
      "question": "The question in English",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctIndex": 0,
      "rationale": "Detailed Korean explanation using letters A, B, C, D"
    }
  ]
}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nConversation Details:\n- Situation: ${situation.title} (${situation.goal})\n- Persona: ${userPersona}\n\nFull Transcript:\n"""\n${transcript}\n"""`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
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
    throw new Error("Gemini가 대화 첨삭 피드백을 반환하지 않았습니다.");
  }

  try {
    const parsedJson = JSON.parse(responseText.trim());

    // Process quizzes
    const quizzes: LabQuizItem[] = (parsedJson.quizzes || []).map((q: any, idx: number) => {
      const rawChoices = q.choices || ["A", "B", "C", "D"];
      const rawCorrectIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
      const correctChoiceText = rawChoices[rawCorrectIndex] || rawChoices[0];

      // Fisher-Yates shuffle
      const choicesWithIndex = rawChoices.map((choice: string, cIdx: number) => ({ choice, cIdx }));
      for (let i = choicesWithIndex.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choicesWithIndex[i], choicesWithIndex[j]] = [choicesWithIndex[j], choicesWithIndex[i]];
      }

      const shuffledChoices = choicesWithIndex.map((c: any) => c.choice);
      const shuffledCorrectIndex = shuffledChoices.indexOf(correctChoiceText);

      // Remap rationale labels
      const LABELS = ['A', 'B', 'C', 'D'];
      const oldToNewIdx: Record<number, number> = {};
      choicesWithIndex.forEach((item: any, newIdx: number) => {
        oldToNewIdx[item.cIdx] = newIdx;
      });
      let remappedRationale = q.rationale || "상세 해설이 없습니다.";
      const TEMP = ['##LABEL_A##', '##LABEL_B##', '##LABEL_C##', '##LABEL_D##'];
      LABELS.forEach((label, oldIdx) => {
        if (oldToNewIdx[oldIdx] !== undefined) {
          const temp = TEMP[oldToNewIdx[oldIdx]];
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}번`, 'g'), `${temp}번`);
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![a-zA-Z])${label}\\\b`, 'g'), temp);
        }
      });
      for (let oldIdx = 0; oldIdx < 4; oldIdx++) {
        if (oldToNewIdx[oldIdx] !== undefined) {
          const numStr = `${oldIdx + 1}번`;
          const temp = `${TEMP[oldToNewIdx[oldIdx]]}번`;
          remappedRationale = remappedRationale.replace(new RegExp(`(?<![0-9])${numStr}`, 'g'), temp);
        }
      }
      TEMP.forEach((temp, labelIdx) => {
        remappedRationale = remappedRationale.replace(new RegExp(temp, 'g'), LABELS[labelIdx]);
      });

      return {
        id: q.id || `q-${Date.now()}-${idx}`,
        question: q.question || "문제가 생성되지 않았습니다.",
        choices: shuffledChoices,
        correctIndex: shuffledCorrectIndex === -1 ? 0 : shuffledCorrectIndex,
        rationale: remappedRationale
      };
    });

    const corrections: CorrectionItem[] = (parsedJson.corrections || []).map((c: any, idx: number) => {
      return {
        id: c.id || `corr-${Date.now()}-${idx}`,
        original: c.original || '',
        corrected: c.corrected || '',
        type: c.type === 'grammar' || c.type === 'expression' || c.type === 'vocab' || c.type === 'flow' ? c.type : 'expression',
        explanation: c.explanation || '설명이 없습니다.'
      };
    });

    return {
      id: `lab-${Date.now()}`,
      title: parsedJson.title || `${situation.title} 피드백`,
      sourceText: combinedUserText || "대화가 진행되지 않았습니다.",
      correctedText: parsedJson.correctedText || combinedUserText,
      overallFeedback: parsedJson.overallFeedback || "대화 교정이 성공적으로 완료되었습니다.",
      createdAt: Date.now(),
      persona: userPersona,
      style: 'spoken',
      corrections,
      quizzes,
      writingLevel: parsedJson.writingLevel,
      chatHistory: chatHistory
    };
  } catch (error) {
    console.error("Failed to parse Gemini conversation feedback:", error);
    throw new Error("Gemini 응답의 형식이 올바르지 않습니다.");
  }
}
