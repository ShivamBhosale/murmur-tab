// Quotes. To add one, append an object to QUOTES:
//   { orig: 'original line or null', lang: 'sa' | 'mr' | null, text: 'English', src: 'Source', word: 'RISE' }
// `word` (optional) is what the animals may spell during a murmuration.
// lang: 'sa' = Sanskrit, 'mr' = Marathi. Leave orig and lang null for English-only quotes.

import { get, set } from './storage.js';

export const QUOTES = [
  {
    orig: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्', lang: 'sa',
    text: 'Lift yourself up by your own effort. Never let yourself sink.',
    src: 'Bhagavad Gita 6.5',
    word: 'RISE',
  },
  {
    orig: 'उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत', lang: 'sa',
    text: 'Arise. Awake. Seek out the great, and learn.',
    src: 'Katha Upanishad 1.3.14',
    word: 'AWAKE',
  },
  {
    orig: 'क्लैब्यं मा स्म गमः पार्थ', lang: 'sa',
    text: 'Do not yield to weakness. Shake off this faintness of heart and rise.',
    src: 'Bhagavad Gita 2.3',
    word: 'RISE',
  },
  {
    orig: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन', lang: 'sa',
    text: 'Your right is to the work alone, never to its fruits.',
    src: 'Bhagavad Gita 2.47',
    word: 'WORK',
  },
  {
    orig: 'मन करा रे प्रसन्न, सर्व सिद्धीचे कारण', lang: 'mr',
    text: 'Keep your mind clear and glad. It is the root of every achievement.',
    src: 'Sant Tukaram',
    word: 'GLAD',
  },
  {
    orig: null, lang: null,
    text: 'At dawn, when you don’t want to get up, tell yourself: I am rising to do the work of a human being.',
    src: 'Marcus Aurelius, Meditations 5.1',
    word: 'RISE',
  },
  {
    orig: null, lang: null,
    text: 'A journey of a thousand miles begins beneath your own feet.',
    src: 'Tao Te Ching 64',
    word: 'BEGIN',
  },
  {
    orig: null, lang: null,
    text: 'No one is free who is not master of themselves.',
    src: 'Epictetus',
    word: 'FREE',
  },
];

const RECENT_KEY = 'recentQuotes';
const RECENT_MAX = 3;

/** The word a murmuration spells for a quote: its `word`, or its longest word. */
export function quoteWord(q) {
  if (q.word) return q.word;
  return q.text.replace(/[^\p{L}\s']/gu, '').split(/\s+/).sort((a, b) => b.length - a.length)[0].toUpperCase();
}

/** Pick a random quote that isn't among the last few shown, and remember it. */
export function pickQuote() {
  const recent = get(RECENT_KEY, []);
  let pool = QUOTES.filter(q => !recent.includes(q.text));
  if (!pool.length) pool = QUOTES.filter(q => q.text !== recent[0]);
  const q = pool[Math.floor(Math.random() * pool.length)] ?? QUOTES[0];
  set(RECENT_KEY, [q.text, ...recent.filter(t => t !== q.text)].slice(0, RECENT_MAX));
  return q;
}
