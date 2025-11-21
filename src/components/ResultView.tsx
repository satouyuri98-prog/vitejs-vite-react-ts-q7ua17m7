import React, { useState, useEffect, useRef } from 'react';
import { SearchResult, ChatMessage } from '../types';
import {
  generateSpeech,
  playAudioBuffer,
  chatWithGemini,
} from '../services/geminiService';

interface ResultViewProps {
  result: SearchResult;
  onSave: (item: SearchResult) => void;
  isSaved: boolean;
  onBack: () => void;
  voiceName?: string;
  onSearchTerm: (term: string) => void;
  langCode?: string;
}

const SpeakerIcon = ({ loading }: { loading?: boolean }) =>
  loading ? (
    <svg
      className="animate-spin w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.88.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  );

const InteractiveSentence: React.FC<{
  text: string;
  lang: string;
  onWordClick: (word: string) => void;
}> = ({ text, lang, onWordClick }) => {
  const [segments, setSegments] = useState<
    { segment: string; isWordLike: boolean }[]
  >([]);

  useEffect(() => {
    try {
      if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
        const segmenter = new (Intl as any).Segmenter(lang, {
          granularity: 'word',
        });
        const rawSegments = Array.from(segmenter.segment(text));
        setSegments(
          rawSegments.map((s: any) => ({
            segment: s.segment,
            isWordLike: s.isWordLike,
          }))
        );
      } else {
        setSegments(
          text.split(' ').map((s) => ({ segment: s + ' ', isWordLike: true }))
        );
      }
    } catch (e) {
      setSegments(
        text.split(' ').map((s) => ({ segment: s + ' ', isWordLike: true }))
      );
    }
  }, [text, lang]);

  return (
    <p className="text-lg font-medium text-gray-800 mb-1 flex flex-wrap">
      {segments.map((s, i) =>
        s.isWordLike ? (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(s.segment.trim());
            }}
            className="cursor-pointer hover:bg-tenma-light hover:text-tenma-secondary rounded px-0.5 transition-colors"
          >
            {s.segment}
          </span>
        ) : (
          <span key={i}>{s.segment}</span>
        )
      )}
    </p>
  );
};

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onSave,
  isSaved,
  onBack,
  voiceName = 'Puck',
  onSearchTerm,
  langCode = 'en',
}) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateSpeech(result.word, voiceName).catch(() => {});
    const timer = setTimeout(() => {
      [result.takarazukaExample.text, result.generalExample.text].forEach(
        (text) => {
          generateSpeech(text, voiceName).catch(() => {});
        }
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [result, voiceName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const handlePlayAudio = async (text: string, id: string) => {
    if (playingAudio) return;
    try {
      setPlayingAudio(id);
      const buffer = await generateSpeech(text, voiceName);
      await playAudioBuffer(buffer);
    } catch (e) {
      console.error('Playback error:', e);
      alert('语音加载失败，请重试');
    } finally {
      setPlayingAudio(null);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    try {
      const responseText = await chatWithGemini(
        chatMessages,
        userMsg.text,
        result.word
      );
      setChatMessages((prev) => [
        ...prev,
        { role: 'model', text: responseText },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-gray-50 overflow-y-auto pb-24">
      <div className="relative w-full shrink-0 bg-gradient-to-br from-tenma-light via-white to-indigo-50 border-b-4 border-tenma-primary flex flex-col justify-end pt-16 pb-6 px-6">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-10 bg-gray-200/50 text-tenma-dark p-2 rounded-full hover:bg-gray-300 transition"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex justify-between items-end">
          <div className="w-full">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-tenma-primary text-white px-2 py-0.5 rounded text-sm font-mono shadow-sm">
                {result.partOfSpeech}
              </span>
              <span className="font-serif italic tracking-wide text-tenma-dark drop-shadow-sm">
                {result.pronunciation}
              </span>
            </div>
            <h1 className="text-5xl font-bold text-tenma-dark tracking-tight mb-2">
              {result.word}
            </h1>
            <p className="text-lg font-medium leading-snug text-gray-600 pl-1">
              {result.definition}
            </p>
          </div>
          <button
            onClick={() => handlePlayAudio(result.word, 'main')}
            className={`mb-1 ml-4 p-4 rounded-full shadow-lg border border-gray-100 transition transform hover:scale-105 flex-shrink-0 ${
              playingAudio === 'main'
                ? 'bg-gray-200 text-gray-500'
                : 'bg-tenma-accent text-tenma-dark'
            }`}
            disabled={!!playingAudio}
          >
            <SpeakerIcon loading={playingAudio === 'main'} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        <div className="grid gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-md border border-pink-100 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-tenma-secondary to-pink-300"></div>
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-bold tracking-widest text-tenma-secondary uppercase border border-tenma-secondary/30 px-2 py-1 rounded-full bg-pink-50">
                Tenma Style
              </span>
            </div>
            <div className="mt-4">
              <InteractiveSentence
                text={result.takarazukaExample.text}
                lang={langCode || 'en'}
                onWordClick={onSearchTerm}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1 border-t border-gray-100 pt-2">
              {result.takarazukaExample.translation}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayAudio(result.takarazukaExample.text, 'ex1');
              }}
              className="mt-3 text-tenma-secondary flex items-center text-xs font-bold hover:underline uppercase tracking-wide px-2 py-1 hover:bg-pink-50 rounded transition-colors w-fit"
              disabled={!!playingAudio}
            >
              <SpeakerIcon loading={playingAudio === 'ex1'} />{' '}
              <span className="ml-1">Listen</span>
            </button>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-md border border-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-tenma-primary to-indigo-300"></div>
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-bold tracking-widest text-tenma-primary uppercase border border-tenma-primary/30 px-2 py-1 rounded-full bg-indigo-50">
                Daily Life
              </span>
            </div>
            <div className="mt-4">
              <InteractiveSentence
                text={result.generalExample.text}
                lang={langCode || 'en'}
                onWordClick={onSearchTerm}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1 border-t border-gray-100 pt-2">
              {result.generalExample.translation}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayAudio(result.generalExample.text, 'ex2');
              }}
              className="mt-3 text-tenma-primary flex items-center text-xs font-bold hover:underline uppercase tracking-wide px-2 py-1 hover:bg-indigo-50 rounded transition-colors w-fit"
              disabled={!!playingAudio}
            >
              <SpeakerIcon loading={playingAudio === 'ex2'} />{' '}
              <span className="ml-1">Listen</span>
            </button>
          </div>
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 shadow-inner">
          <h3 className="text-indigo-900 font-bold flex items-center mb-2 text-sm uppercase tracking-wider">
            <span className="text-lg mr-2">💡</span> Pro Tips
          </h3>
          <p className="text-indigo-800 text-sm leading-relaxed font-medium">
            {result.usageGuide}
          </p>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-tenma-dark text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition transform border-2 border-white/10"
        >
          {isChatOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          )}
        </button>
        <button
          onClick={() => onSave({ ...result })}
          disabled={isSaved}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition transform border-2 border-white/10 ${
            isSaved
              ? 'bg-green-500 text-white'
              : 'bg-tenma-secondary text-white hover:scale-105'
          }`}
        >
          {isSaved ? (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          )}
        </button>
      </div>

      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-20 border border-gray-200 animate-fade-in">
          <div className="bg-tenma-dark text-white p-3 font-bold text-center text-sm">
            Ask about "{result.word}"
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-tenma-primary text-white'
                      : 'bg-white border text-gray-800'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t bg-white flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
              placeholder="Ask a question..."
              className="flex-1 border rounded-full px-3 py-1 text-sm focus:outline-none focus:border-tenma-primary"
            />
            <button
              onClick={handleChatSend}
              className="bg-tenma-primary text-white p-2 rounded-full"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
