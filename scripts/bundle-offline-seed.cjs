const fs = require('fs');
const path = require('path');

const V2_DB_PATH = path.join('scripts', 'local-german-db-v2.json');
const OUTPUT_PATH = path.join('public', 'data', 'enriched-vocab.json');

function mapGenderToArticle(gender) {
  const map = { m: 'der', f: 'die', n: 'das' };
  return map[gender] || null;
}

function getNepaliTranslation(translations) {
  if (!translations || !Array.isArray(translations)) return '';
  const ne = translations.find(t => t.language === 'ne');
  return ne ? ne.text : '';
}

function getNepaliRomanized(translations) {
  if (!translations || !Array.isArray(translations)) return undefined;
  const ne = translations.find(t => t.language === 'ne');
  return ne ? ne.romanized : undefined;
}

function getEnglishTranslation(translations) {
  if (!translations || !Array.isArray(translations)) return '';
  const en = translations.find(t => t.language === 'en');
  return en ? en.text : '';
}

function extractAudioRef(metadata) {
  if (!metadata?.audio_ref) return null;
  const ref = metadata.audio_ref;
  const match = ref.match(/tts-\d+\.mp3/);
  return match ? `/audio/anki/${match[0]}` : null;
}

async function main() {
  const db = JSON.parse(fs.readFileSync(V2_DB_PATH, 'utf-8'));
  console.log('Bundling offline seed from v2 JSON...');
  console.log('Words:', db.words.length);
  console.log('Sentences:', db.sentences.length);

  // Build word ID → sentence map
  const wordSentenceMap = new Map();
  for (const sentence of db.sentences) {
    if (!sentence.word_references || !Array.isArray(sentence.word_references)) continue;
    for (const wordId of sentence.word_references) {
      if (!wordSentenceMap.has(wordId)) {
        wordSentenceMap.set(wordId, []);
      }
      const examples = wordSentenceMap.get(wordId);
      if (examples.length < 3) {
        examples.push({
          de: sentence.german_text,
          en: sentence.english_translation || '',
          np: sentence.nepali_translation || ''
        });
      }
    }
  }

  const cards = db.words.map(word => {
    const examples = wordSentenceMap.get(word.id) || [];
    // Anki-sourced Nepali is a letter-by-letter transliteration artifact, not a
    // real translation (e.g. "Ansage" -> Devanagari spelling of "ansage").
    // Ship EMPTY Nepali until a real translation pass exists — never fabricate.
    const isAnki = word.metadata && word.metadata.source === 'anki-goethe-a1';
    const nepali = isAnki ? '' : getNepaliTranslation(word.translations);
    const english = getEnglishTranslation(word.translations);
    const neRoman = isAnki ? undefined : getNepaliRomanized(word.translations);

    return {
      id: word.id,
      lemma: word.lemma,
      // Articles exist ONLY on nouns; `gender` on other POS is schema noise.
      article: word.part_of_speech === 'noun' ? mapGenderToArticle(word.gender) : null,
      plural: word.plural_form || null,
      partOfSpeech: word.part_of_speech,
      cefrLevel: word.cefr_level || 'A1',
      translation: {
        en: english,
        np: nepali
      },
      translationNeRoman: neRoman,
      phonetics: {
        ipa: '',
        devanagari: nepali
      },
      tags: [word.part_of_speech, word.cefr_level || 'A1'],
      examples: examples,
      audioUrl: extractAudioRef(word.metadata)
    };
  });

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── Curriculum merge: never drop unique lemmas from hand-authored sources ──
  // Sources: src/data/vocab/*.json (seedVocab batches) + seedCurriculum.ts
  // NOUNS/VERBS arrays. Union by stable key (normalizedLemma|POS); curated
  // translations/articles win; existing audioUrl/plurals preserved.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const byKey = new Map(cards.map((c) => [norm(c.lemma) + '|' + c.partOfSpeech, c]));

  const oldRows = [];
  const vocabDir = path.join(__dirname, '..', 'src', 'data', 'vocab');
  if (fs.existsSync(vocabDir)) {
    for (const f of fs.readdirSync(vocabDir)) {
      if (!f.endsWith('.json')) continue;
      const rows = JSON.parse(fs.readFileSync(path.join(vocabDir, f), 'utf8'));
      for (const r of rows) oldRows.push({ src: 'batch', ...r });
    }
  }
  const scPath = path.join(__dirname, 'seedCurriculum.ts');
  if (fs.existsSync(scPath)) {
    const sc = fs.readFileSync(scPath, 'utf8');
    const extract = (name) => {
      const decl = new RegExp(`const ${name}\\b[^=]*=\\s*\\[`).exec(sc);
      if (!decl) return [];
      const open = decl.index + decl[0].length - 1;
      let depth = 0, end = -1;
      for (let i = open; i < sc.length; i++) {
        if (sc[i] === '[') depth++;
        else if (sc[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = sc.slice(open + 1, end);
      const out = [];
      const re = /\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*(?:,\s*'([^']*)')?\s*\]/g;
      let m;
      while ((m = re.exec(body))) out.push(m.slice(1).map((v) => v ?? ''));
      return out;
    };
    for (const [lemma, art, meaning, sentence] of extract('NOUNS')) {
      oldRows.push({ src: 'seedCurriculum', word: lemma, part_of_speech: 'noun', article: art, meaning, example: sentence });
    }
    for (const [lemma, meaning, sentence] of extract('VERBS')) {
      oldRows.push({ src: 'seedCurriculum', word: lemma, part_of_speech: 'verb', meaning, example: sentence });
    }
  }

  function parseMeaning(meaning) {
    const slash = String(meaning || '').indexOf('/');
    if (slash === -1) return { en: String(meaning || '').trim(), np: '' };
    return {
      en: meaning.slice(0, slash).trim(),
      np: meaning.slice(slash + 1).trim(),
    };
  }

  // Pre-existing mojibake in seedCurriculum.ts examples: "groष"/"weiष"/"heiष"
  // (Devanagari ष standing in for ß) and fully-Nepali substitutions ("नीलो").
  // Repair the ß-class; DROP any example still containing Devanagari rather
  // than shipping wrong German.
  const DEVA = /[\u0900-\u097F]/;
  function sanitizeGermanExample(de) {
    let s = String(de || '').replace(/([A-Za-zÄÖÜäöü])ष/g, '$1ß');
    return DEVA.test(s) ? null : s.trim();
  }

  let added = 0, upgraded = 0;
  for (const r of oldRows) {
    const pos = r.part_of_speech || '';
    const key = norm(r.word) + '|' + pos;
    const existing = byKey.get(key);
    if (!existing) {
      const { en, np } = r.meaning ? parseMeaning(r.meaning) : { en: r.translation_en || '', np: r.translation_np || '' };
      if (!en && !np) continue;
      const card = {
        id: `cur-${norm(r.word) || 'x'}-${pos}`,
        lemma: r.word,
        article: pos === 'noun' ? (r.article || null) : null,
        plural: null,
        partOfSpeech: pos,
        cefrLevel: (r.level || 'A1').toUpperCase() === 'A2' ? 'A2' : 'A1',
        translation: { en: en || r.translation_en || '', np: np || r.translation_np || '' },
        translationNeRoman: r.translation_ne_roman || undefined,
        phonetics: { ipa: '', devanagari: np || r.translation_np || '' },
        tags: [pos, r.category, 'A1'].filter(Boolean),
        examples: sanitizeGermanExample(r.example) ? [{ de: sanitizeGermanExample(r.example), en: '', np: '' }] : [],
        audioUrl: null,
      };
      cards.push(card);
      byKey.set(key, card);
      added++;
      continue;
    }
    // In both: prefer curated translations/article, keep Anki audio + plurals.
    let changed = false;
    const curEn = r.translation_en || (r.meaning ? parseMeaning(r.meaning).en : '');
    const curNp = r.translation_np || (r.meaning ? parseMeaning(r.meaning).np : '');
    if (curEn && !existing.translation.en) { existing.translation.en = curEn; changed = true; }
    if (curNp && !existing.translation.np) {
      existing.translation.np = curNp;
      existing.phonetics.devanagari = curNp;
      changed = true;
    }
    // Devanagari hygiene: some legacy rows carry the GERMAN lemma (plain
    // Latin) in phonetics.devanagari — that field must hold Devanagari
    // script. Repair from the Nepali translation (this script's own
    // convention, see above) whenever the field is empty, Latin, or a
    // duplicate of the lemma. Rows with real Devanagari (Nepali glosses or
    // German pronunciation guides like "लईबएन") are left untouched.
    const npNow = existing.translation.np || curNp;
    const dev = (existing.phonetics && existing.phonetics.devanagari) || '';
    if (npNow && (!dev || !DEVA.test(dev) || dev.toLowerCase() === String(existing.lemma).toLowerCase())) {
      existing.phonetics = existing.phonetics || { ipa: '', devanagari: '' };
      existing.phonetics.devanagari = npNow;
      changed = true;
    }
    if (pos === 'noun' && !existing.article && /^(der|die|das)$/i.test(r.article || '')) {
      existing.article = r.article.toLowerCase();
      changed = true;
    }
    if (r.category && !existing.tags.includes(r.category)) { existing.tags.push(r.category); changed = true; }
    if (r.example) {
      const cleanDe = sanitizeGermanExample(r.example);
      if (cleanDe && (!existing.examples || existing.examples.length === 0)) {
        existing.examples = [{ de: cleanDe, en: '', np: '' }];
        changed = true;
      }
    }
    if (changed) upgraded++;
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cards, null, 2), 'utf-8');

  // Emit runtime lemma -> local-audio map so the shared speech helper can
  // prefer bundled MP3s before falling back to speechSynthesis.
  const manifest = {};
  for (const card of cards) {
    if (card.audioUrl) manifest[card.lemma.toLowerCase()] = card.audioUrl;
  }
  const manifestTs = `/**
 * GENERATED by scripts/bundle-offline-seed.cjs — do not edit by hand.
 * Maps lowercased German lemma to a bundled TTS clip under /audio/anki/.
 * Source: Goethe Institute A1 Wordlist Anki deck (CC BY-SA 4.0),
 * audio generated with Thorsten-Voice.
 */
export const AUDIO_BY_LEMMA: Record<string, string> = ${JSON.stringify(manifest, null, 2)};
`;
  const manifestPath = path.join(__dirname, '..', 'src', 'data', 'audioManifest.ts');
  fs.writeFileSync(manifestPath, manifestTs, 'utf-8');

  const statFinal = fs.statSync(OUTPUT_PATH);

  console.log('\nBundle complete');
  console.log('Cards bundled:', cards.length);
  console.log('Curriculum merge: +' + added + ' recovered, ' + upgraded + ' enriched from curated sources');
  console.log('Cards with audioUrl:', Object.keys(manifest).length);
  console.log('Output:', OUTPUT_PATH);
  console.log('File size:', (statFinal.size / 1024).toFixed(1), 'KB');
  console.log('Manifest:', manifestPath);
}

main().catch(err => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
