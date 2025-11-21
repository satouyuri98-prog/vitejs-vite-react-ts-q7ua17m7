import React, { useState } from 'react';
import { NotebookItem } from '../types';
import { generateStory } from '../services/geminiService';

interface NotebookViewProps {
  items: NotebookItem[];
  nativeLang: string;
  onBack: () => void;
}

type Mode = 'LIST' | 'STORY' | 'FLASHCARDS';

export const NotebookView: React.FC<NotebookViewProps> = ({
  items,
  nativeLang,
  onBack,
}) => {
  const [mode, setMode] = useState<Mode>('LIST');
  const [story, setStory] = useState<string | null>(null);
  const [loadingStory, setLoadingStory] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleGenerateStory = async () => {
    setMode('STORY');
    if (!story) {
      setLoadingStory(true);
      try {
        const txt = await generateStory(items, nativeLang);
        setStory(txt);
      } catch (e) {
        setStory('Sorry, the story writer is on break. Try again later.');
      } finally {
        setLoadingStory(false);
      }
    }
  };

  const renderList = () => (
    <div className="p-4 pb-20">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 font-bold hover:text-tenma-dark transition-colors"
        >
          <svg
            className="w-6 h-6 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Stage
        </button>
      </div>

      <h2 className="text-2xl font-bold text-tenma-dark mb-4 flex items-center">
        <span>📔 My Collection</span>
        <span className="ml-auto text-sm font-normal bg-tenma-light px-3 py-1 rounded-full border border-tenma-secondary text-tenma-secondary">
          {items.length} Words
        </span>
      </h2>

      {items.length === 0 ? (
        <div className="text-center text-gray-400 mt-10">
          No words saved yet. Go explore!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover mr-4"
                />
              )}
              <div>
                <div className="font-bold text-lg text-gray-800">
                  {item.word}
                </div>
                <div className="text-sm text-gray-500">{item.definition}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            onClick={handleGenerateStory}
            className="bg-gradient-to-r from-tenma-secondary to-pink-600 text-white py-3 px-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-2"
          >
            <span>🎭 Story Mode</span>
          </button>
          <button
            onClick={() => {
              setMode('FLASHCARDS');
              setCurrentCardIndex(0);
              setIsFlipped(false);
            }}
            className="bg-gradient-to-r from-tenma-primary to-indigo-600 text-white py-3 px-4 rounded-xl font-bold shadow-md flex items-center justify-center gap-2"
          >
            <span>⚡ Study Mode</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderStory = () => (
    <div className="p-4 flex flex-col h-full">
      <div className="mb-4">
        <button
          onClick={() => setMode('LIST')}
          className="text-tenma-dark font-bold flex items-center"
        >
          <svg
            className="w-5 h-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Notebook
        </button>
      </div>
      <div className="flex-1 bg-white p-6 rounded-2xl shadow-lg border border-yellow-100 overflow-y-auto">
        <h3 className="text-xl font-bold text-tenma-dark mb-4 border-b pb-2">
          The Amami Chronicle
        </h3>
        {loadingStory ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        ) : (
          <p className="leading-loose text-gray-700 whitespace-pre-wrap font-serif">
            {story}
          </p>
        )}
      </div>
    </div>
  );

  const renderFlashcards = () => {
    const currentCard = items[currentCardIndex];
    return (
      <div className="p-4 h-full flex flex-col">
        <div className="mb-4 flex justify-between items-center">
          <button
            onClick={() => setMode('LIST')}
            className="text-tenma-dark font-bold"
          >
            Close
          </button>
          <span className="text-gray-500 font-mono">
            {currentCardIndex + 1} / {items.length}
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center perspective-1000 relative">
          <div
            className={`relative w-full max-w-sm aspect-[3/4] cursor-pointer transition-transform duration-700 preserve-3d ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl border-2 border-tenma-primary flex flex-col items-center justify-center p-6">
              {currentCard.imageUrl && (
                <img
                  src={currentCard.imageUrl}
                  className="w-32 h-32 rounded-full object-cover mb-6 shadow-md"
                />
              )}
              <h2 className="text-4xl font-bold text-center text-tenma-dark">
                {currentCard.word}
              </h2>
              <p className="mt-4 text-gray-400 text-sm text-center">
                Tap to reveal
              </p>
            </div>

            {/* Back */}
            <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-tenma-primary to-indigo-900 rounded-3xl shadow-2xl text-white p-6 flex flex-col justify-center">
              <h3 className="text-2xl font-bold mb-2 text-center">
                {currentCard.definition}
              </h3>
              <div className="w-full h-px bg-white/30 my-4"></div>
              <p className="text-sm italic opacity-90 text-center mb-2">
                "{currentCard.takarazukaExample.text}"
              </p>
              <p className="text-xs text-center text-yellow-300">
                {currentCard.takarazukaExample.translation}
              </p>
            </div>
          </div>
        </div>

        <div className="h-20 flex justify-center items-center gap-8">
          <button
            onClick={() => {
              setCurrentCardIndex(
                (curr) => (curr - 1 + items.length) % items.length
              );
              setIsFlipped(false);
            }}
            className="p-4 bg-white rounded-full shadow-md text-gray-600 hover:bg-gray-100"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              setCurrentCardIndex((curr) => (curr + 1) % items.length);
              setIsFlipped(false);
            }}
            className="p-4 bg-tenma-dark text-white rounded-full shadow-md hover:bg-gray-800"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-50">
      {mode === 'LIST' && renderList()}
      {mode === 'STORY' && renderStory()}
      {mode === 'FLASHCARDS' && renderFlashcards()}
    </div>
  );
};
