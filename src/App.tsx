import React, { useState, useEffect } from 'react';
import { SUPPORTED_LANGUAGES } from './constants';
import { Language, AppView, SearchResult, NotebookItem } from './types';
import { lookupWord, generateSpeech } from './services/geminiService';
import { ResultView } from './components/ResultView';
import { NotebookView } from './components/NotebookView';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANG_SELECT);
  const [nativeLang, setNativeLang] = useState<Language | null>(null);
  const [targetLang, setTargetLang] = useState<Language | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notebook, setNotebook] = useState<NotebookItem[]>([]);

  // --- Persistence Logic (LocalStorage) ---

  // 1. Load from storage on startup
  useEffect(() => {
    const savedNotebook = localStorage.getItem('tenma_notebook');
    if (savedNotebook) {
      try {
        setNotebook(JSON.parse(savedNotebook));
      } catch (e) {
        console.error('Failed to load notebook', e);
      }
    }
  }, []);

  // 2. Save helper function
  const saveToStorage = (items: NotebookItem[]) => {
    localStorage.setItem('tenma_notebook', JSON.stringify(items));
  };

  const handleSearch = async (termOverride?: string) => {
    const termToSearch = termOverride || searchTerm;
    if (!termToSearch.trim() || !nativeLang || !targetLang) return;

    if (termOverride) setSearchTerm(termOverride);

    setIsSearching(true);

    if (targetLang.voiceName) {
      generateSpeech(termToSearch.trim(), targetLang.voiceName).catch((e) => {
        console.debug('Audio prefetch background error:', e);
      });
    }

    try {
      const result = await lookupWord(
        termToSearch,
        nativeLang.name,
        targetLang.name
      );
      setSearchResult(result);
      setView(AppView.RESULT);
    } catch (error) {
      console.error('Search failed', error);
      alert('Oops! Even AI stars need a break. Try again!');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveToNotebook = (item: SearchResult) => {
    if (notebook.some((n) => n.word === item.word)) return;

    const noteItem: NotebookItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    // Update State AND LocalStorage
    const newNotebook = [noteItem, ...notebook];
    setNotebook(newNotebook);
    saveToStorage(newNotebook);
  };

  // --- View Routing ---

  if (view === AppView.LANG_SELECT) {
    return (
      <div className="flex flex-col h-full p-6 bg-gradient-to-br from-indigo-50 to-pink-50 justify-center">
        <h1 className="text-4xl font-bold text-tenma-dark mb-2 text-center">
          Tenma Dream
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Your Stage. Your Words.
        </p>

        <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              I speak (Native)
            </label>
            <select
              className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-tenma-primary outline-none"
              onChange={(e) =>
                setNativeLang(
                  SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value) ||
                    null
                )
              }
              value={nativeLang?.code || ''}
            >
              <option value="">Select Language</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              I want to learn (Target)
            </label>
            <select
              className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-tenma-secondary outline-none"
              onChange={(e) =>
                setTargetLang(
                  SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value) ||
                    null
                )
              }
              value={targetLang?.code || ''}
            >
              <option value="">Select Language</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            disabled={!nativeLang || !targetLang}
            onClick={() => setView(AppView.HOME)}
            className="w-full bg-tenma-dark text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-900 transition"
          >
            Enter the Theater
          </button>
        </div>
      </div>
    );
  }

  if (view === AppView.RESULT && searchResult) {
    return (
      <>
        {isSearching && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl flex items-center space-x-3">
              <svg
                className="animate-spin h-6 w-6 text-tenma-primary"
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
              <span className="font-bold text-tenma-dark">Loading...</span>
            </div>
          </div>
        )}
        <ResultView
          result={searchResult}
          onSave={handleSaveToNotebook}
          isSaved={notebook.some((n) => n.word === searchResult.word)}
          onBack={() => setView(AppView.HOME)}
          voiceName={targetLang?.voiceName}
          onSearchTerm={(term) => handleSearch(term)}
          langCode={targetLang?.code}
        />
      </>
    );
  }

  if (view === AppView.NOTEBOOK) {
    return (
      <NotebookView
        items={notebook}
        nativeLang={nativeLang?.name || 'English'}
        onBack={() => setView(AppView.HOME)}
      />
    );
  }

  // HOME View
  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
          <span className="text-xl">{nativeLang?.flag}</span>
          <span className="text-gray-400">→</span>
          <span className="text-xl">{targetLang?.flag}</span>
        </div>
        <button
          onClick={() => setView(AppView.NOTEBOOK)}
          className="relative p-2"
        >
          <span className="text-3xl">📔</span>
          {notebook.length > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notebook.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-tenma-dark mb-8">
          What's on your mind?
        </h2>

        <div className="relative">
          <textarea
            className="w-full h-40 p-5 rounded-3xl border-2 border-gray-100 bg-gray-50 focus:border-tenma-primary focus:bg-white outline-none text-xl shadow-inner resize-none transition-all"
            placeholder="Type a word, phrase, or sentence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          ></textarea>

          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !searchTerm.trim()}
            className="absolute -bottom-6 right-6 bg-tenma-accent text-tenma-dark p-4 rounded-full shadow-xl hover:scale-110 transition transform disabled:opacity-50 disabled:scale-100"
          >
            {isSearching ? (
              <svg
                className="animate-spin h-8 w-8"
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
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">
            Try: "Perseverance", "Stage light", "Success"
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
