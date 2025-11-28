import { PlaywrightCrawler } from 'crawlee';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import type { Page, ElementHandle } from 'playwright';

// Configuration
const CONFIG = {
  startUrl: 'https://doc.ua/ua/doctors/kharkov/all/page-1?order_by=reviews&sort_asc=false',
  city: 'Харків',
  csvPath: '../data/doctor_reviews.csv',
  headless: false,
  timeout: 2000000,
} as const;

let totalReviews = 0;

// Initialize CSV file
if (!existsSync(CONFIG.csvPath)) {
  writeFileSync(CONFIG.csvPath, 'Місто,Ім\'я лікаря,Коментар,Ім\'я коментатора,Дата коментаря\n', 'utf-8');
}

// Utilities
const escapeCsv = (value: string): string =>
  value.includes(',') || value.includes('"') || value.includes('\n')
    ? `"${value.replace(/"/g, '""')}"`
    : value;

const saveReview = (doctorName: string, comment: string, author: string, date: string): void => {
  const row = [CONFIG.city, doctorName, comment, author, date]
    .map(v => escapeCsv(v.trim()))
    .join(',') + '\n';
  appendFileSync(CONFIG.csvPath, row, 'utf-8');
  totalReviews++;
};

const getNextPage = async (page: Page): Promise<ElementHandle | null> => {
  const items = await page.$$('.paginator__item');
  const activeIdx = (await Promise.all(
    items.map(async (item, idx) => ({
      idx,
      active: (await item.getAttribute('class'))?.includes('active')
    }))
  )).find(x => x.active)?.idx ?? -1;

  if (activeIdx === -1 || activeIdx + 1 >= items.length) return null;

  const next = items[activeIdx + 1];
  const className = await next.getAttribute('class');
  return className?.includes('paginator__item') && !className?.includes('active') ? next : null;
};

const scrapeReviews = async (page: Page, doctorName: string, log: any): Promise<void> => {
  let pageNum = 1;

  while (true) {
    await page.waitForSelector('.review-card', { timeout: 5000 }).catch(() => {});
    const reviews = await page.$$('.review-card');

    log.info(`Сторінка ${pageNum}: ${reviews.length} відгуків`);

    for (const review of reviews) {
      try {
        const comment = await review.$eval('.review-card__comment', el => el.textContent || '').catch(() => '');
        const author = await review.$eval('.review-card__author-name', el => el.textContent || '').catch(() => '');
        const date = await review.$eval('.review-card__date', el => el.textContent || '').catch(() => '');
        saveReview(doctorName, comment, author, date);
      } catch (err) {
        log.error(`Помилка відгуку: ${err}`);
      }
    }

    const nextPage = await getNextPage(page);
    if (!nextPage) break;

    await nextPage.click();
    await page.waitForTimeout(1000);
    pageNum++;
  }
};

const processDoctor = async (page: Page, index: number, total: number, log: any): Promise<void> => {
  const names = await page.$$('.doctor-card__h3');
  const nameEl = names[index];
  const mainUrl = page.url();

  await nameEl.click();
  await page.waitForTimeout(3000);

  const doctorName = (await nameEl.textContent()) || 'Невідомий';
  log.info(`[${index + 1}/${total}] ${doctorName.trim()}`);

  const reviewsTab = await page.$('.nav-tabs__item.nav-tabs__item_review');
  if (!reviewsTab) {
    log.warning(`Немає відгуків: ${doctorName.trim()}`);
    await page.goto(mainUrl);
    await page.waitForLoadState('networkidle');
    return;
  }

  await reviewsTab.click();
  await page.waitForTimeout(1000);
  await scrapeReviews(page, doctorName, log);

  log.info(`✓ ${doctorName.trim()}`);

  await page.goto(mainUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.doctor-card__content', { timeout: 5000 });
};

const crawler = new PlaywrightCrawler({
  headless: CONFIG.headless,
  requestHandlerTimeoutSecs: CONFIG.timeout,
  requestHandler: async ({ page, log }) => {
    let pageNum = 1;

    while (true) {
      log.info(`\n========== Сторінка лікарів ${pageNum} ==========`);

      await page.waitForSelector('.doctor-card__content', { timeout: 3000 }).catch(() => {});
      const doctors = await page.$$('.doctor-card__content');
      log.info(`Знайдено ${doctors.length} лікарів`);

      for (let i = 0; i < doctors.length; i++) {
        try {
          await processDoctor(page, i, doctors.length, log);
        } catch (err) {
          log.error(`Помилка лікаря ${i + 1}: ${err}`);
        }
      }

      const nextPage = await getNextPage(page);
      if (!nextPage) {
        log.info('Остання сторінка лікарів');
        break;
      }

      log.info(`Перехід на сторінку ${pageNum + 1}`);
      await nextPage.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      pageNum++;
    }

    log.info('\n-----КІНЕЦЬ-----');
  },
});

// Run crawler
await crawler.run([CONFIG.startUrl]);

console.log(`\n✓ Зібрано ${totalReviews} відгуків`);
console.log(`Файл: ${CONFIG.csvPath}`);
