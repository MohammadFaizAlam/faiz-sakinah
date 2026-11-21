import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import { sanitizeTranslationHtml } from './src/lib/quranUtils';
import {
  asNumber,
  asString,
  isRecord,
  type AyahItem,
  type AyahTiming,
  type AyahWord,
  type Reciter,
  type SurahChapter,
  type SurahPayload,
  type TranslationMeta,
} from './src/types/quran';

const gzipAsync = promisify(gzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QURAN_API_BASE = 'https://api.quran.com/api/v4';
const PORT = Number(process.env.PORT) || 3000;

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const serverCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

function peekCached<T>(key: string): T | undefined {
  const cached = serverCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  return undefined;
}

async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = peekCached<T>(key);
  if (existing !== undefined) {
    return existing;
  }

  const pending = inflightRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = fetcher()
    .then((data) => {
      serverCache.set(key, { expiresAt: Date.now() + ttlMs, data });
      inflightRequests.delete(key);
      return data;
    })
    .catch((err) => {
      inflightRequests.delete(key);
      throw err;
    });

  inflightRequests.set(key, promise);
  return promise;
}

/**
 * Sends gzip-compressed JSON when the client supports gzip (cuts large chapter payloads by ~82%).
 */
async function sendCompressedJson(
  req: Request,
  res: Response,
  payload: unknown,
  cacheControl: string,
): Promise<void> {
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', 'Accept-Encoding');

  const jsonStr = JSON.stringify(payload);
  const acceptEncoding = String(req.headers['accept-encoding'] ?? '');

  if (jsonStr.length > 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    try {
      const zipped = await gzipAsync(Buffer.from(jsonStr, 'utf8'));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', String(zipped.length));
      res.send(zipped);
      return;
    } catch {
      // Fall back to plain JSON if compression fails
    }
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(jsonStr);
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Quran.com API error (${response.status}) for ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchChapters(): Promise<SurahChapter[]> {
  return getCached('chapters:en', 24 * 60 * 60 * 1000, async () => {
    const raw = await fetchJson(`${QURAN_API_BASE}/chapters?language=en`);
    if (!isRecord(raw) || !Array.isArray(raw.chapters)) {
      throw new Error('Unexpected chapters payload from Quran.com API');
    }

    const chapters: SurahChapter[] = [];
    for (const item of raw.chapters) {
      if (!isRecord(item)) continue;
      const id = asNumber(item.id, 0);
      if (id < 1 || id > 114) continue;
      const translatedObj = isRecord(item.translated_name) ? item.translated_name : null;

      chapters.push({
        id,
        nameSimple: asString(item.name_simple, `Surah ${id}`),
        nameComplex: asString(item.name_complex, asString(item.name_simple, `Surah ${id}`)),
        nameArabic: asString(item.name_arabic, ''),
        translatedName: translatedObj ? asString(translatedObj.name, '') : '',
        revelationPlace: asString(item.revelation_place, 'makkah'),
        versesCount: asNumber(item.verses_count, 0),
        bismillahPre: Boolean(item.bismillah_pre),
      });
    }

    chapters.sort((a, b) => a.id - b.id);
    if (chapters.length === 0) {
      throw new Error('No chapters returned from Quran.com API');
    }
    return chapters;
  });
}

async function fetchReciters(): Promise<Reciter[]> {
  return getCached('reciters:en', 24 * 60 * 60 * 1000, async () => {
    const raw = await fetchJson(`${QURAN_API_BASE}/resources/chapter_reciters?language=en`);
    if (!isRecord(raw) || !Array.isArray(raw.reciters)) {
      throw new Error('Unexpected reciters payload from Quran.com API');
    }

    const seen = new Set<number>();
    const reciters: Reciter[] = [];

    for (const item of raw.reciters) {
      if (!isRecord(item)) continue;
      const id = asNumber(item.id, 0);
      if (id <= 0 || seen.has(id)) continue;

      const rawName = asString(item.name, '').trim();
      if (!rawName) continue;

      if (rawName.toLowerCase().includes('streaming')) continue;

      seen.add(id);
      const styleObj = isRecord(item.style) ? item.style : null;
      const qiratObj = isRecord(item.qirat) ? item.qirat : null;

      reciters.push({
        id,
        name: rawName.replace(/`/g, "'"),
        style: styleObj ? asString(styleObj.name, '') || null : null,
        qirat: qiratObj ? asString(qiratObj.name, '') || null : null,
      });
    }

    const preferredOrder = [7, 97, 2, 9, 6, 4, 5, 3, 10, 161, 1, 12];
    reciters.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.id);
      const idxB = preferredOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    if (reciters.length === 0) {
      throw new Error('No reciters returned from Quran.com API');
    }
    return reciters;
  });
}

async function resolveEnglishTranslation(): Promise<TranslationMeta> {
  return getCached('translation:en:default', 24 * 60 * 60 * 1000, async () => {
    const raw = await fetchJson(`${QURAN_API_BASE}/resources/translations?language=en`);
    if (!isRecord(raw) || !Array.isArray(raw.translations)) {
      throw new Error('Unexpected translations list from Quran.com API');
    }

    const candidates: Array<TranslationMeta & { slug: string }> = [];
    for (const item of raw.translations) {
      if (!isRecord(item)) continue;
      const id = asNumber(item.id, 0);
      const lang = asString(item.language_name, '').toLowerCase();
      if (id <= 0 || (lang && lang !== 'english')) continue;

      candidates.push({
        id,
        name: asString(item.name, 'English Translation'),
        authorName: asString(item.author_name, ''),
        slug: asString(item.slug, '').toLowerCase(),
      });
    }

    const preferred =
      candidates.find((t) => t.slug === 'en-haleem' || t.name.toLowerCase().includes('abdel haleem')) ||
      candidates.find((t) => t.name.toLowerCase().includes('clear quran') || t.authorName.toLowerCase().includes('khattab')) ||
      candidates.find((t) => t.name.toLowerCase().includes('saheeh international')) ||
      candidates[0];

    if (!preferred) {
      throw new Error('No English translation available from Quran.com API');
    }

    return {
      id: preferred.id,
      name: preferred.name,
      authorName: preferred.authorName,
    };
  });
}

/**
 * Ultra-fast single-request chapter verse fetch (words=false, per_page=300)
 * so switching to ANY surah (including 286-verse Al-Baqarah) renders & plays in ~200ms.
 */
async function fetchChapterVersesFast(
  chapterId: number,
  translation: TranslationMeta,
): Promise<AyahItem[]> {
  return getCached(`verses:fast:${chapterId}:${translation.id}`, 24 * 60 * 60 * 1000, async () => {
    const ayahs: AyahItem[] = [];
    let page = 1;
    let nextPage: number | null = 1;

    while (nextPage !== null && page <= 3) {
      const url = `${QURAN_API_BASE}/verses/by_chapter/${chapterId}?language=en&words=false&translations=${translation.id}&fields=text_uthmani&per_page=300&page=${page}`;
      const raw = await fetchJson(url);
      if (!isRecord(raw) || !Array.isArray(raw.verses)) {
        throw new Error(`Unexpected verses payload for chapter ${chapterId}`);
      }

      for (const verse of raw.verses) {
        if (!isRecord(verse)) continue;
        const verseNumber = asNumber(verse.verse_number, ayahs.length + 1);
        const verseKey = asString(verse.verse_key, `${chapterId}:${verseNumber}`);
        const textUthmani = asString(verse.text_uthmani, '');
        let translationRaw = '';

        if (Array.isArray(verse.translations) && verse.translations.length > 0) {
          const firstTr = verse.translations[0];
          if (isRecord(firstTr)) {
            translationRaw = asString(firstTr.text, '');
          }
        }

        ayahs.push({
          id: asNumber(verse.id, verseNumber),
          verseNumber,
          verseKey,
          textUthmani,
          translationText: sanitizeTranslationHtml(translationRaw),
          juzNumber: asNumber(verse.juz_number, 1),
          pageNumber: asNumber(verse.page_number, 1),
          words: [],
        });
      }

      const pagination = isRecord(raw.pagination) ? raw.pagination : null;
      nextPage =
        pagination && typeof pagination.next_page === 'number'
          ? pagination.next_page
          : null;
      page += 1;
    }

    ayahs.sort((a, b) => a.verseNumber - b.verseNumber);
    return ayahs;
  });
}

/**
 * Fetches rich word-by-word Uthmani, transliteration, English gloss, and isolated pronunciation URLs
 * with parallel pagination, cached for 24h so hydration never blocks surah switching or audio playback.
 */
async function fetchChapterWords(
  chapterId: number,
): Promise<Record<string, AyahWord[]>> {
  return getCached(`words:wbw:${chapterId}`, 24 * 60 * 60 * 1000, async () => {
    const buildUrl = (page: number) =>
      `${QURAN_API_BASE}/verses/by_chapter/${chapterId}?language=en&words=true&word_fields=text_uthmani,transliteration,translation&per_page=50&page=${page}`;

    const wordsByVerse: Record<string, AyahWord[]> = {};

    const collectPage = (raw: unknown) => {
      if (!isRecord(raw) || !Array.isArray(raw.verses)) return;
      for (const verse of raw.verses) {
        if (!isRecord(verse)) continue;
        const verseKey = asString(verse.verse_key, '');
        if (!verseKey || !Array.isArray(verse.words)) continue;

        const words: AyahWord[] = [];
        for (const rawWord of verse.words) {
          if (!isRecord(rawWord)) continue;
          const charType = asString(rawWord.char_type_name, 'word').toLowerCase();
          if (charType !== 'word') continue;

          const position = asNumber(rawWord.position, words.length + 1);
          const wordText = asString(rawWord.text_uthmani, asString(rawWord.text, '')).trim();
          if (!wordText) continue;

          const trObj = isRecord(rawWord.translation) ? rawWord.translation : null;
          const translitObj = isRecord(rawWord.transliteration) ? rawWord.transliteration : null;
          const audioRel = asString(rawWord.audio_url, '').trim();

          words.push({
            position,
            textUthmani: wordText,
            translation: trObj ? asString(trObj.text, '').trim() : '',
            transliteration: translitObj ? asString(translitObj.text, '').trim() : '',
            audioUrl: audioRel
              ? audioRel.startsWith('http')
                ? audioRel
                : `https://audio.qurancdn.com/${audioRel.replace(/^\/+/, '')}`
              : null,
          });
        }

        wordsByVerse[verseKey] = words;
      }
    };

    const firstRaw = await fetchJson(buildUrl(1));
    collectPage(firstRaw);

    const pagination =
      isRecord(firstRaw) && isRecord(firstRaw.pagination) ? firstRaw.pagination : null;
    const totalPages = Math.min(
      12,
      Math.max(1, pagination ? asNumber(pagination.total_pages, 1) : 1),
    );

    if (totalPages > 1) {
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const restPayloads = await Promise.all(
        remainingPages.map((pageNum) => fetchJson(buildUrl(pageNum))),
      );
      for (const p of restPayloads) {
        collectPage(p);
      }
    }

    return wordsByVerse;
  });
}

async function fetchChapterAudioWithTimings(
  chapterId: number,
  reciterId: number,
): Promise<{ audioUrl: string; timings: AyahTiming[] }> {
  return getCached(`audio:seg:${reciterId}:${chapterId}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${QURAN_API_BASE}/chapter_recitations/${reciterId}/${chapterId}?segments=true`;
    const raw = await fetchJson(url);
    if (!isRecord(raw) || !isRecord(raw.audio_file)) {
      throw new Error(`Unexpected audio_file payload for reciter ${reciterId}, chapter ${chapterId}`);
    }

    const audioFile = raw.audio_file;
    const audioUrl = asString(audioFile.audio_url, '');
    if (!audioUrl) {
      throw new Error(`Missing audio_url for reciter ${reciterId}, chapter ${chapterId}`);
    }

    const timings: AyahTiming[] = [];
    if (Array.isArray(audioFile.timestamps)) {
      for (let i = 0; i < audioFile.timestamps.length; i += 1) {
        const ts = audioFile.timestamps[i];
        if (!isRecord(ts)) continue;
        const verseKey = asString(ts.verse_key, `${chapterId}:${i + 1}`);
        const parsedVerseNum = Number.parseInt(verseKey.split(':')[1] ?? '', 10);
        const verseNumber = Number.isFinite(parsedVerseNum) ? parsedVerseNum : i + 1;
        const timestampFrom = Math.max(0, asNumber(ts.timestamp_from, 0));
        const timestampTo = Math.max(timestampFrom, asNumber(ts.timestamp_to, timestampFrom));
        const duration = Math.max(0, timestampTo - timestampFrom);

        const segments: AyahTiming['segments'] = [];
        if (Array.isArray(ts.segments)) {
          for (const rawSeg of ts.segments) {
            if (!Array.isArray(rawSeg) || rawSeg.length < 3) continue;
            const wordPosition = asNumber(rawSeg[0], 0);
            const segFrom = asNumber(rawSeg[1], -1);
            const segTo = asNumber(rawSeg[2], -1);
            if (wordPosition <= 0 || segFrom < 0 || segTo < segFrom) continue;
            segments.push({
              wordPosition,
              timestampFrom: segFrom,
              timestampTo: segTo,
            });
          }
          segments.sort((a, b) => a.timestampFrom - b.timestampFrom || a.wordPosition - b.wordPosition);
        }

        timings.push({
          verseKey,
          verseNumber,
          timestampFrom,
          timestampTo,
          duration,
          segments,
        });
      }
    }

    timings.sort((a, b) => a.timestampFrom - b.timestampFrom || a.verseNumber - b.verseNumber);
    return { audioUrl, timings };
  });
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/chapters', async (req, res) => {
    try {
      const chapters = await fetchChapters();
      await sendCompressedJson(req, res, { chapters }, 'public, max-age=3600, s-maxage=86400');
    } catch (error) {
      console.error('[/api/chapters] Error:', error);
      res.status(502).json({ error: 'Unable to load surah list from Quran.com API.' });
    }
  });

  app.get('/api/reciters', async (req, res) => {
    try {
      const reciters = await fetchReciters();
      await sendCompressedJson(req, res, { reciters }, 'public, max-age=3600, s-maxage=86400');
    } catch (error) {
      console.error('[/api/reciters] Error:', error);
      res.status(502).json({ error: 'Unable to load reciters from Quran.com API.' });
    }
  });

  // Fast-path surah endpoint: returns all verses + audio + timings in 1 parallel hop (~200ms).
  // If word-by-word data is already warm in server cache, merges it inline in 0ms; otherwise
  // client hydrates /api/words/:chapterId asynchronously without blocking playback or render.
  app.get('/api/surah/:chapterId', async (req, res) => {
    const chapterId = Number.parseInt(req.params.chapterId, 10);
    const reciterIdRaw = typeof req.query.reciterId === 'string' ? req.query.reciterId : '';
    let reciterId = Number.parseInt(reciterIdRaw, 10);

    if (!Number.isFinite(chapterId) || chapterId < 1 || chapterId > 114) {
      res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
      return;
    }

    try {
      if (!Number.isFinite(reciterId) || reciterId <= 0) {
        const reciters = await fetchReciters();
        reciterId = reciters[0]?.id ?? 7;
      }

      const translation = await resolveEnglishTranslation();
      const [fastAyahs, audioData] = await Promise.all([
        fetchChapterVersesFast(chapterId, translation),
        fetchChapterAudioWithTimings(chapterId, reciterId),
      ]);

      const cachedWords = peekCached<Record<string, AyahWord[]>>(`words:wbw:${chapterId}`);
      const ayahs = cachedWords
        ? fastAyahs.map((a) => ({ ...a, words: cachedWords[a.verseKey] ?? a.words }))
        : fastAyahs;

      const payload: SurahPayload = {
        chapterId,
        reciterId,
        audioUrl: audioData.audioUrl,
        translation,
        ayahs,
        timings: audioData.timings,
        wordsHydrated: Boolean(cachedWords),
      };

      // Silently warm word-by-word cache in server background if not yet cached
      if (!cachedWords) {
        void fetchChapterWords(chapterId).catch(() => {});
      }

      await sendCompressedJson(req, res, payload, 'public, max-age=1800, s-maxage=21600');
    } catch (error) {
      console.error(`[/api/surah/${chapterId}] Error:`, error);
      res.status(502).json({
        error: 'Unable to load surah verses and synced audio from Quran.com API.',
      });
    }
  });

  // Dedicated background hydration endpoint for per-word Arabic glosses & transliterations
  app.get('/api/words/:chapterId', async (req, res) => {
    const chapterId = Number.parseInt(req.params.chapterId, 10);
    if (!Number.isFinite(chapterId) || chapterId < 1 || chapterId > 114) {
      res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
      return;
    }

    try {
      const wordsByVerse = await fetchChapterWords(chapterId);
      await sendCompressedJson(
        req,
        res,
        { chapterId, wordsByVerse },
        'public, max-age=86400, s-maxage=86400',
      );
    } catch (error) {
      console.error(`[/api/words/${chapterId}] Error:`, error);
      res.status(502).json({ error: 'Unable to load word-by-word data.' });
    }
  });

  // Lightweight audio+timestamps endpoint for near-instant reciter switches
  app.get('/api/audio/:chapterId', async (req, res) => {
    const chapterId = Number.parseInt(req.params.chapterId, 10);
    const reciterIdRaw = typeof req.query.reciterId === 'string' ? req.query.reciterId : '';
    let reciterId = Number.parseInt(reciterIdRaw, 10);

    if (!Number.isFinite(chapterId) || chapterId < 1 || chapterId > 114) {
      res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
      return;
    }

    try {
      if (!Number.isFinite(reciterId) || reciterId <= 0) {
        const reciters = await fetchReciters();
        reciterId = reciters[0]?.id ?? 7;
      }

      const audioData = await fetchChapterAudioWithTimings(chapterId, reciterId);
      await sendCompressedJson(
        req,
        res,
        {
          chapterId,
          reciterId,
          audioUrl: audioData.audioUrl,
          timings: audioData.timings,
        },
        'public, max-age=1800, s-maxage=21600',
      );
    } catch (error) {
      console.error(`[/api/audio/${chapterId}] Error:`, error);
      res.status(502).json({
        error: 'Unable to load reciter audio from Quran.com API.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sakinah server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
