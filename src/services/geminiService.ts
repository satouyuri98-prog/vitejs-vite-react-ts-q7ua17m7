import { GoogleGenAI, Type, Modality } from '@google/genai';
import { SearchResult, NotebookItem } from '../types';
import { AUDIO_SAMPLE_RATE } from '../constants';

// 初始化 AI 客户端
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 音频系统 (单例模式) ---

let sharedAudioContext: AudioContext | null = null;
const audioCache = new Map<string, Promise<AudioBuffer>>();

const getAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: AUDIO_SAMPLE_RATE,
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
  if (data.length % 2 !== 0) {
    data = data.subarray(0, data.length - 1);
  }
  const dataInt16 = new Int16Array(
    data.buffer,
    data.byteOffset,
    data.length / 2
  );
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, AUDIO_SAMPLE_RATE);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// --- 核心功能 ---

export const lookupWord = async (
  term: string,
  nativeLang: string,
  targetLang: string
): Promise<SearchResult> => {
  const systemInstruction = `
    You are a strict translator and dictionary API.
    INPUT: Term "${term}". USER NATIVE: ${nativeLang}. TARGET: ${targetLang}.
    
    LOGIC:
    1. If term is not in ${targetLang}, TRANSLATE it to ${targetLang} first. Use that as the HEADWORD.
    2. Define the HEADWORD in ${nativeLang}.
    3. PRONUNCIATION: Japanese=Romaji, Chinese=Pinyin, Others=IPA.
    4. EXAMPLES:
       - takarazukaExample: Must use Kanji "天海祐希" (Amami Yuki).
    5. OUTPUT JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Define: ${term}`,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          definition: { type: Type.STRING },
          takarazukaExample: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              translation: { type: Type.STRING },
            },
          },
          generalExample: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              translation: { type: Type.STRING },
            },
          },
          usageGuide: { type: Type.STRING },
        },
        required: [
          'word',
          'pronunciation',
          'partOfSpeech',
          'definition',
          'takarazukaExample',
          'generalExample',
          'usageGuide',
        ],
      },
    },
  });

  if (response.text) return JSON.parse(response.text) as SearchResult;
  throw new Error('解析失败');
};

export const generateSpeech = async (
  text: string,
  voiceName: string = 'Puck'
): Promise<AudioBuffer> => {
  const cacheKey = `${voiceName}:${text}`;
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)!;

  const fetchPromise = (async () => {
    let processedText = text;
    // 日语读音修正：强制把“天海祐希”读作“Amami Yuki”而不是“Tenkai”
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
      if (processedText.includes('天海祐希')) {
        if (!/天海祐希(さん|様|ちゃん|くん)/.test(processedText)) {
          processedText = processedText.replace(
            /天海祐希/g,
            'あまみゆうきさん'
          );
        } else {
          processedText = processedText.replace(/天海祐希/g, 'あまみゆうき');
        }
      }
      processedText = processedText.replace(/天海(?!祐)/g, 'あまみ');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: processedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio');
    return await decodeAudioData(decode(base64Audio), getAudioContext());
  })();

  audioCache.set(cacheKey, fetchPromise);
  fetchPromise.catch(() => audioCache.delete(cacheKey));
  return fetchPromise;
};

export const playAudioBuffer = async (buffer: AudioBuffer) => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};

export const chatWithGemini = async (
  history: any[],
  msg: string,
  word: string
) => {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction: `Explain "${word}" to the user.` },
    history: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
  });
  const res = await chat.sendMessage({ message: msg });
  return res.text || '';
};

export const generateStory = async (
  words: NotebookItem[],
  nativeLang: string
) => {
  const prompt = `Write a short story in ${nativeLang} about Amami Yuki using these words: ${words
    .map((w) => w.word)
    .join(', ')}.`;
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return res.text || '';
};
