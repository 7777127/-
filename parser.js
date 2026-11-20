const fs = require('fs');
const cheerio = require('cheerio');

const UPDATE_INTERVAL_MS = 30 * 1000;
const RETENTION_DAYS = 3;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const OUTPUT_FILE = 'news.json';

const CHANNELS = [
  {
    idPrefix: 'kyivinfo',
    source: 'Київ ІНФО',
    username: 'kievinfo_kyiv',
    url: 'https://t.me/kievinfo_kyiv'
  },
  {
    idPrefix: 'kyivnebo',
    source: 'Київ Небо',
    username: 'kyiv_nebo',
    url: 'https://t.me/kyiv_nebo'
  }
];

function loadExistingNews() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.news) ? parsed.news : [];
  } catch (err) {
    console.warn('Не вдалося прочитати news.json, почнемо заново:', err.message);
    return [];
  }
}

function getPostKey(item) {
  if (item.url && item.url.includes('/')) {
    return item.url.trim();
  }
  return `${item.source}::${item.text}`.trim();
}

async function fetchChannelNews(channel) {
  try {
    const response = await fetch(`https://t.me/s/${channel.username}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const posts = [];
    const messages = $('.tgme_widget_message_wrap');

    messages.slice(-15).each((index, el) => {
      const textEl = $(el).find('.tgme_widget_message_text');
      const timeEl = $(el).find('time.time');
      const linkEl = $(el).find('.tgme_widget_message_date');

      const fullText = textEl.text().trim();
      if (!fullText) return;

      const firstLine = fullText.split('\n')[0];
      const title = firstLine.length > 65 ? firstLine.slice(0, 65) + '...' : firstLine;

      const rawDate = timeEl.attr('datetime');
      const timestamp = rawDate ? new Date(rawDate).getTime() : Date.now();

      const formattedTime = rawDate
        ? new Date(rawDate).toLocaleString('uk-UA', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Щойно';

      const postUrl = linkEl.attr('href') || channel.url;

      posts.push({
        id: `${channel.idPrefix}-${timestamp}-${index}`,
        source: channel.source,
        time: formattedTime,
        timestamp,
        title,
        text: fullText,
        url: postUrl
      });
    });

    return posts;
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString('uk-UA')}] Помилка ${channel.source}:`, error.message);
    return null;
  }
}

async function runUpdateCycle() {
  const cutoffTime = Date.now() - RETENTION_MS;
  console.log(`[${new Date().toLocaleTimeString('uk-UA')}] Оновлюємо стрічку...`);

  const results = await Promise.all(CHANNELS.map(fetchChannelNews));
  const freshPosts = results.filter((item) => Array.isArray(item)).flat();

  if (freshPosts.length === 0) {
    console.log(`[${new Date().toLocaleTimeString('uk-UA')}] Свіжих даних не отримано, поточний news.json збережено.`);
    return;
  }

  const existingPosts = loadExistingNews().map((item) => ({
    ...item,
    timestamp: item.timestamp || Date.now()
  }));

  const mergedMap = new Map();

  for (const item of existingPosts) {
    if (item.timestamp >= cutoffTime) {
      mergedMap.set(getPostKey(item), item);
    }
  }

  for (const item of freshPosts) {
    if (item.timestamp >= cutoffTime) {
      mergedMap.set(getPostKey(item), item);
    }
  }

  const allNews = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    retentionDays: RETENTION_DAYS,
    count: allNews.length,
    news: allNews
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[${new Date().toLocaleTimeString('uk-UA')}] Збережено ${allNews.length} новин у news.json.`);
}

async function startLoop() {
  await runUpdateCycle();
  setTimeout(startLoop, UPDATE_INTERVAL_MS);
}

startLoop();