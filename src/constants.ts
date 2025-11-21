import { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', voiceName: 'Puck' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', voiceName: 'Kore' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', voiceName: 'Kore' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voiceName: 'Puck' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voiceName: 'Charon' },
  { code: 'de', name: 'German', flag: '🇩🇪', voiceName: 'Fenrir' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', voiceName: 'Kore' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voiceName: 'Puck' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', voiceName: 'Puck' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voiceName: 'Fenrir' },
];

export const MOCK_IMAGE_PLACEHOLDER = 'https://picsum.photos/400/400';
export const AUDIO_SAMPLE_RATE = 24000;
