/**
 * scripts/seedCurriculum.ts
 *
 * One-time migration of the former hardcoded curriculum sources into Supabase:
 *   - src/data/nouns.json        -> public.vocabulary   (part_of_speech='noun')
 *   - src/data/unit2Sentences.ts -> public.sentences
 *
 * The datasets are EMBEDDED below so this script remains runnable after the
 * hardcoded files are deleted from src/ (no accidental re-coupling).
 *
 * Usage:
 *   1. Apply supabase/migrations/010_dynamic_curriculum.sql in your project.
 *   2. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (service role
 *      bypasses RLS; NEVER expose it to the client bundle).
 *   3. Run: npm run seed-curriculum
 *
 * Idempotent: upserts on (word, part_of_speech) / sentences.id.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/* ────────────────────────────────────────────────────────────
 * Dataset A — nouns (former src/data/nouns.json)
 * [noun, article, meaning "EN / NP", example sentence]
 * ──────────────────────────────────────────────────────────── */

type NounRow = [noun: string, art: string, meaning: string, sentence: string];

const NOUNS: NounRow[] = [
  ['Tisch', 'der', 'Table / मेच', 'Der Tisch ist groß.'],
  ['Sonne', 'die', 'Sun / घाम', 'Die Sonne scheint.'],
  ['Buch', 'das', 'Book / किताब', 'Das Buch ist neu.'],
  ['Mutter', 'die', 'Mother / आमा', 'Die Mutter kocht.'],
  ['Vater', 'der', 'Father / बुबा', 'Der Vater arbeitet.'],
  ['Auto', 'das', 'Car / गाडी', 'Das Auto ist rot.'],
  ['Wasser', 'das', 'Water / पानी', 'Das Wasser ist kalt.'],
  ['Zug', 'der', 'Train / रेल', 'Der Zug kommt.'],
  ['Haus', 'das', 'House / घर', 'Das Haus ist alt.'],
  ['Freund', 'der', 'Friend / साथी', 'Der Freund ist nett.'],
  ['Blume', 'die', 'Flower / फूल', 'Die Blume ist schön.'],
  ['Schule', 'die', 'School / स्कूल', 'Die Schule ist groß.'],
  ['Stuhl', 'der', 'Chair / कर्सी', 'Der Stuhl ist bequem.'],
  ['Lampe', 'die', 'Lamp / बत्ती', 'Die Lampe ist hell.'],
  ['Tür', 'die', 'Door / दरवाजा', 'Die Tür ist offen.'],
  ['Fenster', 'das', 'Window / झ्याल', 'Das Fenster ist groß.'],
  ['Brot', 'das', 'Bread / ब्रेड', 'Das Brot ist frisch.'],
  ['Milch', 'die', 'Milk / दुध', 'Die Milch ist kalt.'],
  ['Fleisch', 'das', 'Meat / माँस', 'Das Fleisch ist gut.'],
  ['Gemüse', 'das', 'Vegetables / सब्जी', 'Das Gemüse ist frisch.'],
  ['Obst', 'das', 'Fruit / फल', 'Das Obst ist süß.'],
  ['Apfel', 'der', 'Apple / सेब', 'Der Apfel ist rot.'],
  ['Birne', 'die', 'Pear / नाशपाती', 'Die Birne ist grün.'],
  ['Zitrone', 'die', 'Lemon / नींबू', 'Die Zitrone ist sauer.'],
  ['Banane', 'die', 'Banana / केला', 'Die Banane ist gelb.'],
  ['Hund', 'der', 'Dog / कुत्ता', 'Der Hund bellt.'],
  ['Katze', 'die', 'Cat / बिल्ली', 'Die Katze schläft.'],
  ['Vogel', 'der', 'Bird / पक्षी', 'Der Vogel singt.'],
  ['Baum', 'der', 'Tree / पेड', 'Der Baum ist hoch.'],
  ['Stern', 'der', 'Star / तारा', 'Der Stern leuchtet.'],
  ['Mond', 'der', 'Moon / चाँद', 'Der Mond scheint.'],
  ['Wolke', 'die', 'Cloud / बादल', 'Die Wolke zieht.'],
  ['Regen', 'der', 'Rain / वर्षा', 'Der Regen ist kalt.'],
  ['Schnee', 'der', 'Snow / बर्फ', 'Der Schnee ist weiß.'],
  ['See', 'der', 'Lake / झील', 'Der See ist sauber.'],
  ['Berg', 'der', 'Mountain / पर्वत', 'Der Berg ist hoch.'],
  ['Tasche', 'die', 'Bag / झोला', 'Die Tasche ist schwer.'],
  ['Stift', 'der', 'Pen / कलम', 'Der Stift schreibt gut.'],
  ['Schlüssel', 'der', 'Key / साँचो', 'Der Schlüssel ist hier.'],
  ['Handy', 'das', 'Mobile phone / मोबाइल', 'Das Handy ist neu.'],
  ['Computer', 'der', 'Computer / कम्प्युटर', 'Der Computer ist schnell.'],
  ['Geld', 'das', 'Money / पैसा', 'Das Geld liegt hier.'],
  ['Uhr', 'die', 'Clock / घडी', 'Die Uhr ist genau.'],
  ['Brille', 'die', 'Glasses / ऐना', 'Die Brille ist neu.'],
  ['Kaffee', 'der', 'Coffee / कफी', 'Der Kaffee ist heiß.'],
  ['Tee', 'der', 'Tea / चिया', 'Der Tee ist warm.'],
  ['Zimmer', 'das', 'Room / कोठा', 'Das Zimmer ist hell.'],
  ['Küche', 'die', 'Kitchen / भान्सा', 'Die Küche ist sauber.'],
  ['Stadt', 'die', 'City / सहर', 'Die Stadt ist groß.'],
  ['Straße', 'die', 'Street / सडक', 'Die Straße ist lang.'],
  ['Bahnhof', 'der', 'Train station / रेल स्टेशन', 'Der Bahnhof ist voll.'],
  ['Hotel', 'das', 'Hotel / होटल', 'Das Hotel ist teuer.'],
  ['Arzt', 'der', 'Doctor / डाक्टर', 'Der Arzt hilft.'],
  ['Lehrer', 'der', 'Teacher / शिक्षक', 'Der Lehrer erklärt.'],
  ['Kind', 'das', 'Child / बच्चा', 'Das Kind spielt.'],
  ['Arbeit', 'die', 'Work / काम', 'Die Arbeit ist fertig.'],
];

/* ────────────────────────────────────────────────────────────
 * Dataset B — sentences (former src/data/unit2Sentences.ts)
 * ──────────────────────────────────────────────────────────── */

interface SentenceSeed {
  id: string;
  phrase_de: string;
  expected_array: string[];
  distractors_array: string[];
  grammar_focus: string;
  tags: string[];
}

const SENTENCES: SentenceSeed[] = [
  {
    id: 'u2-sb-tisch',
    phrase_de: 'Ich habe einen Tisch',
    expected_array: ['Ich', 'habe', 'einen', 'Tisch'],
    distractors_array: ['ein', 'eine', 'das'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-tasche',
    phrase_de: 'Die Tasche ist schwer',
    expected_array: ['Die', 'Tasche', 'ist', 'schwer'],
    distractors_array: ['Der', 'Das', 'sind'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-buch',
    phrase_de: 'Er liest das Buch',
    expected_array: ['Er', 'liest', 'das', 'Buch'],
    distractors_array: ['den', 'der', 'Die'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-stift',
    phrase_de: 'Sie nimmt den Stift',
    expected_array: ['Sie', 'nimmt', 'den', 'Stift'],
    distractors_array: ['der', 'dem', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-handy',
    phrase_de: 'Das Handy ist neu',
    expected_array: ['Das', 'Handy', 'ist', 'neu'],
    distractors_array: ['Der', 'Die', 'seid'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-kaffee',
    phrase_de: 'Ich trinke einen Kaffee',
    expected_array: ['Ich', 'trinke', 'einen', 'Kaffee'],
    distractors_array: ['ein', 'eine', 'Tee'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-kuche',
    phrase_de: 'Die Küche ist sauber',
    expected_array: ['Die', 'Küche', 'ist', 'sauber'],
    distractors_array: ['Der', 'Das', 'ist'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-kind',
    phrase_de: 'Das Kind spielt heute',
    expected_array: ['Das', 'Kind', 'spielt', 'heute'],
    distractors_array: ['Den', 'Der', 'morgen'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
];

/* ────────────────────────────────────────────────────────────
 * Seeding
 * ──────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      '[seedCurriculum] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
        'The service-role key is required to bypass RLS for seeding. Never commit it.'
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Vocabulary (nouns with gender) — upsert on (word, part_of_speech).
  const vocabRows = NOUNS.map(([noun, art, meaning, sentence]) => {
    const [en, np] = meaning.split('/').map((s) => s.trim());
    return {
      word: noun,
      article: art,
      part_of_speech: 'noun',
      translation_en: en || noun,
      translation_np: np || '',
      example_de: sentence,
      category: 'core',
      level: 'A1',
      tags: ['unit-2', 'articles', `gender-${art}`],
    };
  });

  const { error: vocabError } = await admin
    .from('vocabulary')
    .upsert(vocabRows, { onConflict: 'word,part_of_speech' });

  if (vocabError) {
    console.error('[seedCurriculum] vocabulary upsert failed:', vocabError.message);
    process.exit(1);
  }
  console.log(`[seedCurriculum] vocabulary: ${vocabRows.length} nouns upserted.`);

  // 2. Sentences — upsert on id.
  const { error: sentError } = await admin.from('sentences').upsert(SENTENCES, {
    onConflict: 'id',
  });

  if (sentError) {
    console.error('[seedCurriculum] sentences upsert failed:', sentError.message);
    process.exit(1);
  }
  console.log(`[seedCurriculum] sentences: ${SENTENCES.length} exercises upserted.`);

  // 3. Smoke-test the randomized RPC endpoints.
  const { data: randVocab, error: rpcVocabErr } = await admin.rpc('get_random_vocabulary', {
    p_pos: 'noun',
    p_limit: 15,
  });
  if (rpcVocabErr) {
    console.warn('[seedCurriculum] get_random_vocabulary smoke test failed:', rpcVocabErr.message);
  } else {
    console.log(`[seedCurriculum] get_random_vocabulary returned ${randVocab?.length ?? 0} random rows.`);
  }

  const { data: randSent, error: rpcSentErr } = await admin.rpc('get_random_sentences', {
    p_limit: 10,
  });
  if (rpcSentErr) {
    console.warn('[seedCurriculum] get_random_sentences smoke test failed:', rpcSentErr.message);
  } else {
    console.log(`[seedCurriculum] get_random_sentences returned ${randSent?.length ?? 0} random rows.`);
  }

  console.log('[seedCurriculum] Done.');
}

void main();