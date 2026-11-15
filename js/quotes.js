// Quotes. To add one, append an object to QUOTES:
//   { orig: 'original line or null', lang: 'sa' | 'zh' | ... | null, text: 'English', src: 'Source', word: 'RISE' }
// `word` (optional) is what the animals may spell during a murmuration.
// lang: any BCP 47 code ('sa' Sanskrit, 'mr' Marathi, 'zh', 'ja', 'ar', ...). Right-to-left
// scripts are handled automatically. Leave orig and lang null for English-only quotes.

import { get, set } from './storage.js';

export const QUOTES = [
  // ---- Sanskrit -----------------------------------------------------------
  { orig: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्', lang: 'sa',
    text: 'Lift yourself up by your own effort. Never let yourself sink.', src: 'Bhagavad Gita 6.5', word: 'RISE' },
  { orig: 'उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत', lang: 'sa',
    text: 'Arise. Awake. Seek out the great, and learn.', src: 'Katha Upanishad 1.3.14', word: 'AWAKE' },
  { orig: 'क्लैब्यं मा स्म गमः पार्थ', lang: 'sa',
    text: 'Do not yield to weakness. Shake off this faintness of heart and rise.', src: 'Bhagavad Gita 2.3', word: 'RISE' },
  { orig: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन', lang: 'sa',
    text: 'Your right is to the work alone, never to its fruits.', src: 'Bhagavad Gita 2.47', word: 'WORK' },
  { orig: 'योगः कर्मसु कौशलम्', lang: 'sa',
    text: 'Yoga is skill in action.', src: 'Bhagavad Gita 2.50', word: 'SKILL' },
  { orig: 'वसुधैव कुटुम्बकम्', lang: 'sa',
    text: 'The whole world is one family.', src: 'Maha Upanishad 6.71', word: 'ONE' },

  // ---- Marathi / Hindi / Tamil -----------------------------------------------
  { orig: 'मन करा रे प्रसन्न, सर्व सिद्धीचे कारण', lang: 'mr',
    text: 'Keep your mind clear and glad. It is the root of every achievement.', src: 'Sant Tukaram', word: 'GLAD' },
  { orig: 'वृक्षवल्ली आम्हा सोयरी वनचरे', lang: 'mr',
    text: 'Trees and vines are our kin, and so are the creatures of the forest.', src: 'Sant Tukaram', word: 'KIN' },
  { orig: 'काल करे सो आज कर, आज करे सो अब', lang: 'hi',
    text: 'What you would do tomorrow, do today. What you would do today, do now.', src: 'Kabir', word: 'NOW' },
  { orig: 'கற்க கசடறக் கற்பவை கற்றபின் நிற்க அதற்குத் தக', lang: 'ta',
    text: 'Learn thoroughly what is worth learning, then live by what you have learned.', src: 'Thirukkural 391', word: 'LEARN' },

  // ---- Chinese / Japanese / Korean ---------------------------------------------
  { orig: '千里之行，始於足下', lang: 'zh',
    text: 'A journey of a thousand miles begins beneath your own feet.', src: 'Tao Te Ching 64', word: 'BEGIN' },
  { orig: '上善若水', lang: 'zh',
    text: 'The highest good is like water. It nourishes all things and does not compete.', src: 'Tao Te Ching 8', word: 'WATER' },
  { orig: '知人者智，自知者明', lang: 'zh',
    text: 'Knowing others is intelligence. Knowing yourself is true wisdom.', src: 'Tao Te Ching 33', word: 'WISE' },
  { orig: '学而不思则罔，思而不学则殆', lang: 'zh',
    text: 'Learning without thinking is wasted. Thinking without learning is dangerous.', src: 'Confucius, Analects 2.15', word: 'THINK' },
  { orig: '知之为知之，不知为不知，是知也', lang: 'zh',
    text: 'To know what you know, and to know what you do not know: that is knowledge.', src: 'Confucius, Analects 2.17', word: 'KNOW' },
  { orig: '古池や蛙飛び込む水の音', lang: 'ja',
    text: 'An old pond. A frog jumps in. The sound of water.', src: 'Matsuo Bashō', word: 'STILL' },
  { orig: '七転び八起き', lang: 'ja',
    text: 'Fall down seven times, stand up eight.', src: 'Japanese proverb', word: 'STAND' },
  { orig: '一期一会', lang: 'ja',
    text: 'One time, one meeting. Treasure this moment; it will not come again.', src: 'Japanese tea ceremony saying', word: 'NOW' },
  { orig: '시작이 반이다', lang: 'ko',
    text: 'Starting is half the work.', src: 'Korean proverb', word: 'START' },

  // ---- Pali / Greek / Latin ---------------------------------------------------
  { orig: 'Manopubbaṅgamā dhammā', lang: 'pi',
    text: 'Mind comes before all things. Mind is their chief; they are made of mind.', src: 'Dhammapada 1', word: 'MIND' },
  { orig: 'Πάντα ῥεῖ', lang: 'grc',
    text: 'Everything flows.', src: 'Heraclitus', word: 'FLOW' },
  { orig: 'Γνῶθι σεαυτόν', lang: 'grc',
    text: 'Know yourself.', src: 'Inscription at Delphi', word: 'SELF' },
  { orig: null, lang: null,
    text: 'No one is free who is not master of themselves.', src: 'Epictetus', word: 'FREE' },
  { orig: null, lang: null,
    text: 'At dawn, when you don’t want to get up, tell yourself: I am rising to do the work of a human being.', src: 'Marcus Aurelius, Meditations 5.1', word: 'RISE' },
  { orig: 'Dum differtur vita transcurrit', lang: 'la',
    text: 'While we put things off, life runs past.', src: 'Seneca, Letters to Lucilius 1', word: 'NOW' },
  { orig: 'Festina lente', lang: 'la',
    text: 'Make haste slowly.', src: 'Augustus, via Suetonius', word: 'SLOW' },
  { orig: 'Carpe diem', lang: 'la',
    text: 'Seize the day.', src: 'Horace, Odes 1.11', word: 'SEIZE' },

  // ---- Hebrew / Arabic ----------------------------------------------------------
  { orig: 'ואם לא עכשיו, אימתי?', lang: 'he',
    text: 'And if not now, when?', src: 'Hillel, Pirkei Avot 1.14', word: 'NOW' },
  { orig: 'من جدّ وجد', lang: 'ar',
    text: 'Whoever strives, finds.', src: 'Arabic proverb', word: 'STRIVE' },

  // ---- European -----------------------------------------------------------------
  { orig: 'Caminante, no hay camino, se hace camino al andar.', lang: 'es',
    text: 'Traveller, there is no road. The road is made by walking.', src: 'Antonio Machado', word: 'WALK' },
  { orig: 'Le cœur a ses raisons que la raison ne connaît point.', lang: 'fr',
    text: 'The heart has its reasons, which reason does not know.', src: 'Blaise Pascal, Pensées', word: 'HEART' },
  { orig: 'Wer ein Warum zum Leben hat, erträgt fast jedes Wie.', lang: 'de',
    text: 'One who has a why to live for can bear almost any how.', src: 'Friedrich Nietzsche', word: 'WHY' },
  { orig: 'Sei geduldig gegen alles Ungelöste in deinem Herzen.', lang: 'de',
    text: 'Be patient toward all that is unsolved in your heart.', src: 'Rainer Maria Rilke, Letters to a Young Poet', word: 'WAIT' },
  { orig: 'Тише едешь — дальше будешь.', lang: 'ru',
    text: 'The calmer you go, the farther you get.', src: 'Russian proverb', word: 'CALM' },
  { orig: 'Ní neart go cur le chéile.', lang: 'ga',
    text: 'There is no strength without unity.', src: 'Irish proverb', word: 'UNITY' },

  // ---- African ------------------------------------------------------------------
  { orig: 'Umuntu ngumuntu ngabantu', lang: 'zu',
    text: 'A person is a person through other people.', src: 'Zulu proverb (Ubuntu)', word: 'US' },
  { orig: 'Haba na haba hujaza kibaba.', lang: 'sw',
    text: 'Little by little fills the measure.', src: 'Swahili proverb', word: 'GROW' },
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
