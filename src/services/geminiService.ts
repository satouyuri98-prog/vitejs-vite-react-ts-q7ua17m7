import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SearchResult, NotebookItem } from "../types";
import { AUDIO_SAMPLE_RATE } from "../constants";

// --- FIX: 告诉 TypeScript 检查员 process 是存在的 ---
declare const process: {
  env: {
    API_KEY: string;
  }
};

// Initialize Gemini Client
// Note: The API key is injected via vite.config.ts defining process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Audio System (Singleton & Caching) ---

let sharedAudioContext: AudioContext | null = null;
const audioCache = new Map<string, Promise<AudioBuffer>>();

const getAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: AUDIO_SAMPLE_RATE
    });
  }
  return sharedAudioContext;
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> {
  // SAFETY: Ensure data length is even for Int16Array
  if (data.length % 2 !== 0) {
    data = data.subarray(0, data.length - 1);
  }

  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, AUDIO_SAMPLE_RATE);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// --- API Functions ---

export const lookupWord = async (
  term: string,
  nativeLang: string,
  targetLang: string
): Promise<SearchResult> => {
  // Optimized for EXTREME SPEED & LOGIC ACCURACY.
  const systemInstruction = `
    You are a strict translator and dictionary API.
    
    INPUT: Term "${term}".
    USER NATIVE LANG: ${nativeLang}.
    TARGET LANG: ${targetLang}.

    LOGIC STEPS:
    1. DETECT: Is "${term}" in ${targetLang}? 
       - YES: Use it as the HEADWORD.
       - NO: TRANSLATE "${term}" into ${targetLang} to get the HEADWORD.
    2. DEFINE: Provide the definition of the HEADWORD in ${nativeLang}.
    3. PRONUNCIATION RULES:
       - If Target is Japanese: MUST use Standard Romaji (e.g., "konnichiwa").
       - If Target is Chinese: MUST use Pinyin.
       - Others: IPA or standard phonetic spelling.
    4. OUTPUT JSON ONLY.

    CRITICAL OUTPUT RULES:
    - "word": The HEADWORD in ${targetLang} (e.g., if input "Apple" -> output "りんご").
    - "pronunciation": See rule #3.
    - "takarazukaExample": MUST use Kanji "天海祐希" (never Hiragana). Text in ${targetLang}.
    - "generalExample": Simple sentence in ${targetLang}.
    - "definition": In ${nativeLang}.
    - "partOfSpeech": in ${nativeLang} or standard abbr.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: `Map term: ${term}`, 
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 }, // Maximum speed
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: `The word in ${targetLang}` },
          pronunciation: { type: Type.STRING, description: `Romaji for JP, Pinyin for CN, IPA for others` },
          partOfSpeech: { type: Type.STRING },
          definition: { type: Type.STRING },
          takarazukaExample: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              translation: { type: Type.STRING }
            }
          },
          generalExample: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              translation: { type: Type.STRING }
            }
          },
          usageGuide: { type: Type.STRING },
        },
        required: ["word", "pronunciation", "partOfSpeech", "definition", "takarazukaExample", "generalExample", "usageGuide"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as SearchResult;
  }
  throw new Error("Failed to parse dictionary response");
};

export const generateSpeech = async (text: string, voiceName: string = 'Puck'): Promise<AudioBuffer> => {
  const cacheKey = `${voiceName}:${text}`;
  
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    // Pronunciation / Audio-Only Replacements
    // The text displayed on screen remains Kanji, but we send Hiragana/Phonetic to the audio engine.
    let processedText = text;
    
    // JAPANESE SPECIFIC FIXES
    // We assume Japanese context if the text contains Kanji/Kana AND specifically matches our Amami patterns.
    const hasJapaneseChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
    
    if (hasJapaneseChars) {
        // 1. Specific fix for "天海祐希" -> "あまみゆうき"
        // Check if honorifics exist, if not, add "san" for politeness in audio
        if (processedText.includes("天海祐希")) {
           if (!/天海祐希(さん|様|ちゃん|くん)/.test(processedText)) {
               processedText = processedText.replace(/天海祐希/g, "あまみゆうきさん");
           } else {
               processedText = processedText.replace(/天海祐希/g, "あまみゆうき");
           }
        }
        
        // 2. Fix for "天海" (Surname alone) -> "あまみ" (Prevent 'Tenkai')
        processedText = processedText.replace(/天海(?!祐)/g, "あまみ");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: processedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");

    const ctx = getAudioContext();
    return await decodeAudioData(decode(base64Audio), ctx);
  })();

  audioCache.set(cacheKey, fetchPromise);
  
  fetchPromise.catch((e) => {
    console.error("Audio generation failed", e);
    audioCache.delete(cacheKey);
  });

  return fetchPromise;
};

export const playAudioBuffer = async (buffer: AudioBuffer) => {
  const ctx = getAudioContext();
  
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};

export const chatWithGemini = async (
  history: { role: 'user'|'model', text: string }[], 
  currentMessage: string,
  contextWord: string
): Promise<string> => {
  const systemInstruction = `
    Context: User is learning "${contextWord}".
    Persona: Friendly study buddy.
    Topic: Help explain nuances, culture, or answer questions about the word.
    Keep it short.
  `;
  
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }))
  });

  const result = await chat.sendMessage({ message: currentMessage });
  return result.text || "";
};

export const generateStory = async (words: NotebookItem[], nativeLang: string): Promise<string> => {
  const wordList = words.map(w => w.word).join(", ");
  const prompt = `
    Write a short story in ${nativeLang} featuring Amami Yuki-san.
    Include these words: ${wordList}.
    Keep it under 200 words.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text || "Could not generate story.";
};