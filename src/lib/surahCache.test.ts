import test from 'node:test';
import assert from 'node:assert/strict';
import { SurahCache } from './surahCache';
import type { SurahPayload } from '../types/quran';

function makePayload(chapterId: number, reciterId: number): SurahPayload {
  return {
    chapterId,
    reciterId,
    audioUrl: `https://example.com/${reciterId}/${chapterId}.mp3`,
    translation: { id: 85, name: 'Abdel Haleem', authorName: 'Abdul Haleem' },
    ayahs: [],
    timings: [],
  };
}

test('SurahCache returns cached entries immediately and evicts least-recently-used beyond capacity', () => {
  const cache = new SurahCache(2);
  cache.set(makePayload(1, 7));
  cache.set(makePayload(2, 7));

  // Touch chapter 1 so chapter 2 becomes LRU
  assert.equal(cache.get(1, 7)?.chapterId, 1);

  cache.set(makePayload(3, 7));
  assert.equal(cache.size, 2);
  assert.equal(cache.has(1, 7), true);
  assert.equal(cache.has(2, 7), false);
  assert.equal(cache.has(3, 7), true);
});

test('SurahCache coalesces concurrent in-flight fetches into a single network call', async () => {
  const cache = new SurahCache(4);
  let calls = 0;

  const fetcher = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 15));
    return makePayload(36, 7);
  };

  const [a, b] = await Promise.all([
    cache.getOrFetch(36, 7, fetcher),
    cache.getOrFetch(36, 7, fetcher),
  ]);

  assert.equal(calls, 1);
  assert.equal(a.chapterId, 36);
  assert.equal(b.chapterId, 36);

  // Subsequent fetch hits cache with 0 additional calls
  const c = await cache.getOrFetch(36, 7, fetcher);
  assert.equal(calls, 1);
  assert.equal(c.audioUrl, a.audioUrl);
});
