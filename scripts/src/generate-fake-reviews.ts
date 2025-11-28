import Groq from 'groq-sdk';
import { writeFile, appendFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Configuration
const CONFIG = {
  MODEL: 'llama-3.3-70b-versatile',
  OUTPUT_FILE: '../data/fake_reviews.csv',
  TOTAL_REVIEWS: 5000,
  RATE_LIMIT_DELAY: 1100, // ms
  RETRY_DELAY: 5000, // ms
  RATE_LIMIT_RETRY: 240000, // ms
  TEMPERATURE: 1.1,
  TOP_P: 0.95,
  MAX_TOKENS: 300,
} as const;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const STRATEGIES = {
  replaceWithEmotions: `Створи неавтентичний відгук про лікаря, замінюючи факти на емоції:
- Використовуй загальні емоційні оцінки замість конкретних фактів
- "Дуже добре обстежили" і подібне замість деталей процедур`,

  addExcessiveEmotions: `Створи неавтентичний відгук про лікаря з надмірною емоційністю:
- Додай інтенсифікатори: "надзвичайно", "неймовірно", "фантастично" та подібні.
- Використовуй суперлативи: "найкращий лікар", "ідеальне лікування" та подібні`,

  breakLogic: `Створи неавтентичний відгук про лікаря з порушеннями логіки:
- Створи невідповідності між симптомами та лікуванням
- Поруш хронологію подій`,

copyTemplates: `Створи неавтентичний відгук про лікаря, використовуючи шаблонні фрази:
- Використовуй рекламні кліше: "Рекомендую всім!", "Звертайтеся тільки сюди", "Не пожалкуєте" та подібні.
- Додай типові заклики до дії: "Не гайте часу", "Йдіть сміливо", "Варто своїх грошей" і подібні
- Використовуй загальні фрази без конкретики: "все на найвищому рівні", "професіонал своєї справи" та подібні
- Уникай унікальних деталей, пиши узагальнено`
};

const CONTEXTS = [
  'Гострий випадок (високе температура, сильний біль)',
  'Планова консультація (профілактичний огляд)',
  'Повторний візит після лікування',
  'Консультація для дитини',
  'Хронічне захворювання',
  'Післяопераційний огляд',
  'Невідкладна допомога',
  'Другу думку від лікаря',
  'Направлення від сімейного лікаря'
];

const SPECIALTIES = [
  'терапевт', 'кардіолог', 'хірург', 'педіатр', 'невролог',
  'гастроентеролог', 'дерматолог', 'ЛОР', 'офтальмолог',
  'ендокринолог', 'уролог', 'гінеколог', 'ортопед', 'стоматолог'
];

const TONES = [
  'спокійний і стриманий',
  'трохи нервовий',
  'вдячний',
  'розчарований але коректний',
  'енергійний і позитивний',
  'втомлений',
  'детальний і аналітичний'
];

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const escapeCSV = (text: string): string => text.replace(/"/g, '""').replace(/\n/g, ' ');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateFakeReview(strategy: string): Promise<string> {
  const minWords = Math.random() > 0.5 ? 50 : 100;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'Ти експерт зі створення неавтентичних медичних відгуків українською мовою.'
      },
      {
        role: 'user',
        content: `${strategy}
        Контекст візиту: ${getRandomElement(CONTEXTS)}
        Спеціальність лікаря: ${getRandomElement(SPECIALTIES)}
        Тон відгуку: ${getRandomElement(TONES)}

        Створи один відгук довжиною ${minWords}-${minWords + 50} слів про візит до лікаря з урахуванням вказаного контексту, спеціальності та тону. Відповідь має містити ЛИШЕ текст відгуку, без додаткових коментарів.
        ВАЖЛИВО:
          – Використовуй тільки українські літери: [а-я, ї, є, ґ, і, І Ї Є Ґ — великі й малі].
        `
      }
    ],
    model: CONFIG.MODEL,
    temperature: CONFIG.TEMPERATURE,
    top_p: CONFIG.TOP_P,
    max_tokens: CONFIG.MAX_TOKENS
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function loadProgress(filename: string): Promise<number> {
  if (!existsSync(filename)) return 0;

  const content = await readFile(filename, 'utf-8');
  const lines = content.trim().split('\n');

  return lines.length - 1; // Exclude header
}

async function saveReview(id: number, text: string, strategy: string, filename: string): Promise<void> {
  const csvLine = `${id},"${escapeCSV(text)}",${strategy},true\n`;
  await appendFile(filename, csvLine, 'utf-8');
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY не встановлено');
    process.exit(1);
  }

  const strategies = Object.entries(STRATEGIES);
  const reviewsPerStrategy = Math.ceil(CONFIG.TOTAL_REVIEWS / strategies.length);
  const startFrom = await loadProgress(CONFIG.OUTPUT_FILE);

  if (startFrom === 0) {
    await writeFile(CONFIG.OUTPUT_FILE, 'id,text,strategy,isFake\n', 'utf-8');
  }

  console.log(`Генерація ${CONFIG.TOTAL_REVIEWS} відгуків (продовження з ${startFrom})...\n`);

  for (let i = startFrom; i < CONFIG.TOTAL_REVIEWS; i++) {
    const strategyIndex = Math.floor(i / reviewsPerStrategy) % strategies.length;
    const [strategyName, strategyPrompt] = strategies[strategyIndex];

    try {
      const text = await generateFakeReview(strategyPrompt);

      if (!text) throw new Error('Порожній відгук');

      await saveReview(i + 1, text, strategyName, CONFIG.OUTPUT_FILE);

      if ((i + 1) % 100 === 0) {
        console.log(`Прогрес: ${i + 1}/${CONFIG.TOTAL_REVIEWS}`);
      }

      await delay(CONFIG.RATE_LIMIT_DELAY);
    } catch (error: any) {
      const waitTime = error.status === 429
        ? (parseInt(error.headers?.['retry-after']) * 1000 || CONFIG.RATE_LIMIT_RETRY)
        : CONFIG.RETRY_DELAY;

      console.log(`Помилка на #${i + 1}. Повтор через ${waitTime / 1000}с...`);

      await delay(waitTime);
      i--; // Retry
    }
  }

  console.log('\n✅ Готово! Збережено в ' + CONFIG.OUTPUT_FILE);
}

main().catch(console.error);
