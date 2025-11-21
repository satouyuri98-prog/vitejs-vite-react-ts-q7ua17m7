export interface Language {
  code: string;
  name: string;
  flag: string;
  voiceName?: string;
}

export interface SearchResult {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  takarazukaExample: {
    text: string;
    translation: string;
  };
  generalExample: {
    text: string;
    translation: string;
  };
  usageGuide: string;
  imageUrl?: string;
}

export interface NotebookItem extends SearchResult {
  id: string;
  timestamp: number;
}

export enum AppView {
  LANG_SELECT = 'LANG_SELECT',
  HOME = 'HOME',
  RESULT = 'RESULT',
  NOTEBOOK = 'NOTEBOOK',
  STORY = 'STORY',
  FLASHCARDS = 'FLASHCARDS',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
