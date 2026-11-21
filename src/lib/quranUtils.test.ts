import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAyahVisualState,
  filterSurahs,
  findActiveAyahIndex,
  findActiveWordPosition,
  findTimestampForVerse,
  findTimestampForWord,
  formatTime,
  getAyahLengthTier,
  sanitizeTranslationHtml,
} from './quranUtils';
import type { AyahTiming, SurahChapter } from '../types/quran';

const sampleTimings: AyahTiming[] = [
  {
    verseKey: '1:1',
    verseNumber: 1,
    timestampFrom: 0,
    timestampTo: 5800,
    duration: 5800,
    segments: [
      { wordPosition: 1, timestampFrom: 0, timestampTo: 580 },
      { wordPosition: 2, timestampFrom: 580, timestampTo: 1410 },
      { wordPosition: 3, timestampFrom: 1410, timestampTo: 2500 },
      { wordPosition: 4, timestampFrom: 2500, timestampTo: 5800 },
    ],
  },
  // Note intentional 400ms gap between 5800 and 6200
  { verseKey: '1:2', verseNumber: 2, timestampFrom: 6200, timestampTo: 11500, duration: 5300, segments: [] },
  { verseKey: '1:3', verseNumber: 3, timestampFrom: 11800, timestampTo: 16200, duration: 4400, segments: [] },
  { verseKey: '1:4', verseNumber: 4, timestampFrom: 16200, timestampTo: 20900, duration: 4700, segments: [] },
];

const sampleChapters: SurahChapter[] = [
  {
    id: 1,
    nameSimple: 'Al-Fatihah',
    nameComplex: 'Al-Fātiĥah',
    nameArabic: 'الفاتحة',
    translatedName: 'The Opener',
    revelationPlace: 'makkah',
    versesCount: 7,
    bismillahPre: false,
  },
  {
    id: 2,
    nameSimple: 'Al-Baqarah',
    nameComplex: 'Al-Baqarah',
    nameArabic: 'البقرة',
    translatedName: 'The Cow',
    revelationPlace: 'madinah',
    versesCount: 286,
    bismillahPre: true,
  },
  {
    id: 18,
    nameSimple: 'Al-Kahf',
    nameComplex: 'Al-Kahf',
    nameArabic: 'الكهف',
    translatedName: 'The Cave',
    revelationPlace: 'makkah',
    versesCount: 110,
    bismillahPre: true,
  },
  {
    id: 36,
    nameSimple: 'Ya-Sin',
    nameComplex: 'Yā-Sīn',
    nameArabic: 'يس',
    translatedName: 'Ya Sin',
    revelationPlace: 'makkah',
    versesCount: 83,
    bismillahPre: true,
  },
  {
    id: 55,
    nameSimple: 'Ar-Rahman',
    nameComplex: 'Ar-Raĥmān',
    nameArabic: 'الرحمن',
    translatedName: 'The Beneficent',
    revelationPlace: 'madinah',
    versesCount: 78,
    bismillahPre: true,
  },
  {
    id: 112,
    nameSimple: 'Al-Ikhlas',
    nameComplex: 'Al-Ikhlāş',
    nameArabic: 'الإخلاص',
    translatedName: 'The Sincerity',
    revelationPlace: 'makkah',
    versesCount: 4,
    bismillahPre: true,
  },
];

test('findActiveAyahIndex handles exact boundaries, gaps, pre-start, and post-end', () => {
  assert.equal(findActiveAyahIndex(sampleTimings, 0), 0);
  assert.equal(findActiveAyahIndex(sampleTimings, 3000), 0);
  assert.equal(findActiveAyahIndex(sampleTimings, 6000), 0);
  assert.equal(findActiveAyahIndex(sampleTimings, 6200), 1);
  assert.equal(findActiveAyahIndex(sampleTimings, 11700), 1);
  assert.equal(findActiveAyahIndex(sampleTimings, 11800), 2);
  assert.equal(findActiveAyahIndex(sampleTimings, 16200), 3);
  assert.equal(findActiveAyahIndex(sampleTimings, 99999), 3);
  assert.equal(findActiveAyahIndex([], 5000), 0);
});

test('findTimestampForVerse maps verseKey accurately across reciters', () => {
  const reciterBTimings: AyahTiming[] = [
    { verseKey: '1:1', verseNumber: 1, timestampFrom: 0, timestampTo: 4200, duration: 4200, segments: [] },
    { verseKey: '1:2', verseNumber: 2, timestampFrom: 4200, timestampTo: 9400, duration: 5200, segments: [] },
    { verseKey: '1:3', verseNumber: 3, timestampFrom: 9400, timestampTo: 13800, duration: 4400, segments: [] },
  ];

  assert.equal(findTimestampForVerse(reciterBTimings, '1:3', 0), 9.4);
  assert.equal(findTimestampForVerse(reciterBTimings, '1:99', 1), 4.2);
});

test('filterSurahs fuzzy-matches English transliterations, typos, subsequences, Arabic, and numbers', () => {
  assert.equal(filterSurahs(sampleChapters, '').length, 6);
  // Exact number ranks first
  assert.equal(filterSurahs(sampleChapters, '36')[0]?.id, 36);
  assert.equal(filterSurahs(sampleChapters, '2')[0]?.id, 2);
  // Transliteration without Al-/Ar- prefix
  assert.equal(filterSurahs(sampleChapters, 'Baqarah')[0]?.id, 2);
  assert.equal(filterSurahs(sampleChapters, 'Rahman')[0]?.id, 55);
  assert.equal(filterSurahs(sampleChapters, 'Kahf')[0]?.id, 18);
  // Phonetic transliteration variants
  assert.equal(filterSurahs(sampleChapters, 'yaseen')[0]?.id, 36);
  assert.equal(filterSurahs(sampleChapters, 'fatiha')[0]?.id, 1);
  assert.equal(filterSurahs(sampleChapters, 'bakara')[0]?.id, 2);
  assert.equal(filterSurahs(sampleChapters, 'ikhlaas')[0]?.id, 112);
  // Fuzzy subsequence & typo tolerance
  assert.equal(filterSurahs(sampleChapters, 'bqrh')[0]?.id, 2);
  assert.equal(filterSurahs(sampleChapters, 'baqarh')[0]?.id, 2);
  assert.equal(filterSurahs(sampleChapters, 'fathia')[0]?.id, 1);
  // English meaning & Arabic script
  assert.equal(filterSurahs(sampleChapters, 'opener')[0]?.id, 1);
  assert.equal(filterSurahs(sampleChapters, 'البقرة')[0]?.id, 2);
  // Non-matching query returns empty list
  assert.equal(filterSurahs(sampleChapters, 'zzzzzz').length, 0);
});

test('sanitizeTranslationHtml strips footnote superscripts and decodes entities', () => {
  const raw =
    'In the name of Allāh,<sup foot_note=195932>1</sup> the Entirely Merciful &amp; Especially Merciful.<sup foot_note=195931>2</sup>';
  assert.equal(
    sanitizeTranslationHtml(raw),
    'In the name of Allāh, the Entirely Merciful & Especially Merciful.',
  );
});

test('formatTime formats tabular timestamps safely', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3661), '1:01:01');
  assert.equal(formatTime(-5), '0:00');
  assert.equal(formatTime(Number.NaN), '0:00');
});

test('computeAyahVisualState attenuates opacity and scale smoothly by distance', () => {
  assert.deepEqual(computeAyahVisualState(2, 2), {
    distance: 0,
    isActive: true,
    opacity: 1,
    scale: 1,
  });
  const dist1 = computeAyahVisualState(1, 2);
  const dist2 = computeAyahVisualState(0, 2);
  const dist4 = computeAyahVisualState(6, 2);
  assert.ok(dist1.opacity < 1 && dist1.opacity > dist2.opacity);
  assert.ok(dist2.opacity > dist4.opacity);
  assert.ok(dist1.scale < 1 && dist1.scale > dist2.scale);
});

test('getAyahLengthTier classifies short, medium, long, and extended ayahs accurately', () => {
  assert.equal(
    getAyahLengthTier('ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ', 'Praise belongs to God, Lord of the Worlds.'),
    'short',
  );
  assert.equal(
    getAyahLengthTier('ا'.repeat(120), 'A'.repeat(165)),
    'medium',
  );
  assert.equal(
    getAyahLengthTier('ا'.repeat(300), 'A'.repeat(340)),
    'long',
  );
  assert.equal(
    getAyahLengthTier('ا'.repeat(600), 'A'.repeat(900)),
    'extended',
  );
});

test('findActiveWordPosition and findTimestampForWord resolve real word segments cleanly', () => {
  const segs = sampleTimings[0].segments;
  assert.equal(findActiveWordPosition(segs, 100), 1);
  assert.equal(findActiveWordPosition(segs, 580), 2);
  assert.equal(findActiveWordPosition(segs, 1800), 3);
  assert.equal(findActiveWordPosition(segs, 3200), 4);
  assert.equal(findActiveWordPosition(segs, 7000), null);
  assert.equal(findActiveWordPosition([], 500), null);

  assert.equal(findTimestampForWord(sampleTimings[0], 3), 1.41);
  assert.equal(findTimestampForWord(sampleTimings[0], 99), 0);
  assert.equal(findTimestampForWord(undefined, 1), null);
});


