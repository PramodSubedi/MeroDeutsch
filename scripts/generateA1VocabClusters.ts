/**
 * scripts/generateA1VocabClusters.ts  (Phase A — A1 vocabulary pool expansion)
 *
 * Generates NEW A1 vocabulary entries for Units 2–5 and writes them as
 * entity-shaped JSON files into `src/data/vocab/` — the exact directory
 * `scripts/seedVocab.ts` scans. Nothing is written to the database here;
 * apply afterwards with `npm run seed-vocab` (append-only upsert).
 *
 * Providers (first available wins):
 *   1. Groq   — GROQ_API_KEY (free tier; default model openai/gpt-oss-120b)
 *   2. OpenAI — OPENAI_API_KEY (requires billing)
 *
 * Curation stays HUMAN: this script ships curated lists of core A1 German
 * words per cluster (the "authority" word list). The LLM is used ONLY to
 * localize each word (English + Nepali Devanagari translation) — it never
 * invents vocabulary. Romanized Nepali (`translation_ne_roman`) is derived
 * LOCALLY via scripts/devanagari.ts, never requested from the API.
 *
 * Validation before emit:
 *   - article ∈ {der, die, das} for nouns, null otherwise
 *   - non-empty translation_en / translation_np
 *   - translation_np must contain Devanagari script
 *   - length caps (word ≤ 40, en ≤ 60, ne ≤ 60)
 *   - dedupe against existing `vocabulary` rows (word|part_of_speech)
 *     and within the generated batch
 *
 * Env:
 *   GROQ_API_KEY      (preferred — free tier)
 *   GEN_MODEL         (optional override; default per provider)
 *   OPENAI_API_KEY    (fallback provider; requires billing)
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional — enables
 *                     dedupe against live DB rows; skipped if absent)
 *
 * Usage:
 *   npm run generate-a1                 # all clusters
 *   npm run generate-a1 -- a1-unit2-nouns  # single cluster
 */
// Load .env first, then .env.local (override) so keys resolve regardless of
// which file they live in. Must run BEFORE the provider consts below.
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { devanagariToRoman } from './devanagari';
import type { VocabularyEntity } from '../src/types/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/data/vocab');

const BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Provider selection: Groq first (free tier), OpenAI fallback
// ---------------------------------------------------------------------------
const groqKey = process.env.GROQ_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const PROVIDER: 'groq' | 'openai' = groqKey ? 'groq' : 'openai';
const MODEL =
  process.env.GEN_MODEL ||
  (PROVIDER === 'groq' ? 'openai/gpt-oss-120b' : process.env.OPENAI_MODEL || 'gpt-4o');

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (PROVIDER === 'groq') {
    _client = new OpenAI({ apiKey: groqKey!, baseURL: 'https://api.groq.com/openai/v1' });
  } else {
    if (!openaiKey) throw new Error('Set GROQ_API_KEY or OPENAI_API_KEY');
    _client = new OpenAI({ apiKey: openaiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Curated A1 word seeds per cluster (human authority — the model only localizes)
// NOTE: words already present in the DB are skipped automatically by dedupe,
// so these lists can safely grow over time.
// ---------------------------------------------------------------------------
interface Cluster {
  file: string;
  category: string;
  pos: VocabularyEntity['part_of_speech'];
  words: string[];
}

const CLUSTERS: Cluster[] = [
  {
    file: 'a1-unit2-nouns',
    category: 'unit2-nouns',
    pos: 'noun',
    words: [
      // family & people
      'Mutter', 'Vater', 'Bruder', 'Schwester', 'Kind', 'Freund', 'Freundin',
      'Frau', 'Mann', 'Mädchen', 'Junge', 'Oma', 'Opa', 'Nachbar',
      // home & objects
      'Bett', 'Sofa', 'Lampe', 'Bild', 'Spiegel', 'Schlüssel', 'Tasche',
      'Handy', 'Fernseher', 'Telefon', 'Uhr',
      // animals & transport
      'Schwein', 'Ente', 'Maus', 'Auto', 'Fahrrad', 'Zug', 'Bus', 'Flugzeug',
      'Schiff',
      // clothing
      'Hemd', 'Hose', 'Kleid', 'Jacke', 'Mütze', 'Schuh', 'Brille',
    ],
  },
  {
    file: 'a1-nature-time',
    category: 'nature-time',
    pos: 'noun',
    words: [
      // nature & weather
      'Sonne', 'Mond', 'Stern', 'Himmel', 'Wolke', 'Regen', 'Schnee',
      'Wind', 'Feuer', 'Erde', 'Luft', 'Meer', 'See', 'Wald', 'Wiese',
      'Feld', 'Weg', 'Insel', 'Strand', 'Stein', 'Stern',
      // time
      'Tag', 'Woche', 'Monat', 'Jahr', 'Stunde', 'Minute', 'Frühling',
      'Sommer', 'Herbst', 'Winter', 'Morgen', 'Abend', 'Nacht', 'Geburtstag',
    ],
  },
  {
    file: 'a1-unit3-verbs',
    category: 'unit3-verbs',
    pos: 'verb',
    words: [
      'geben', 'nehmen', 'finden', 'denken', 'wissen', 'bringen', 'holen',
      'sitzen', 'stehen', 'laufen', 'schwimmen', 'tanzen', 'singen',
      'fragen', 'antworten', 'erzählen', 'zeigen', 'öffnen', 'schließen',
      'vergessen', 'versuchen', 'üben', 'reisen', 'besuchen',
      'müssen', 'können', 'wollen', 'dürfen', 'sollen',
    ],
  },
  {
    file: 'a1-unit3-adjectives',
    category: 'unit3-adjectives',
    pos: 'adjective',
    words: [
      'lang', 'kurz', 'dick', 'dünn', 'stark', 'jung', 'frisch', 'sauber',
      'laut', 'leise', 'hell', 'dunkel', 'richtig', 'falsch', 'fertig',
      'wichtig', 'interessant', 'lustig', 'traurig', 'glücklich', 'krank',
      'gesund', 'hungrig', 'durstig', 'voll', 'leer', 'offen',
    ],
  },
  {
    file: 'a1-food-drink',
    category: 'food-drink',
    pos: 'noun',
    words: [
      'Kartoffel', 'Tomate', 'Gurke', 'Zwiebel', 'Karotte', 'Apfel', 'Birne',
      'Orange', 'Zitrone', 'Erdbeere', 'Traube', 'Nuss', 'Brezel', 'Brötchen',
      'Müsli', 'Joghurt', 'Käsekuchen', 'Pommes', 'Pizza', 'Salzstreuer',
    ],
  },
  {
    file: 'a1-unit4-places',
    category: 'unit4-places',
    pos: 'noun',
    words: [
      // places
      'Zoo', 'Schwimmbad', 'Spielplatz', 'Garage', 'Keller', 'Aufzug',
      'Treppe', 'Flur', 'Bad', 'Balkon',
      // food & drink
      'Suppe', 'Salat', 'Nudeln', 'Kuchen', 'Eis', 'Saft', 'Bier', 'Wein',
      'Pfeffer', 'Honig', 'Marmelade', 'Schokolade', 'Wurst', 'Hähnchen',
    ],
  },
  {
    file: 'a1-unit5-expressions',
    category: 'unit5-expressions',
    pos: 'phrase',
    words: [
      'Ich hätte gern einen Kaffee.', 'Die Rechnung, bitte.',
      'Wo finde ich eine Apotheke?', 'Wie komme ich zum Flughafen?',
      'Können Sie das bitte wiederholen?', 'Was bedeutet das?',
      'Ich lerne Deutsch.', 'Bis bald!', 'Viel Glück!', 'Alles klar.',
      'Kein Problem.', 'Wo ist die Toilette?', 'Ich habe Durst.',
      'Das ist zu teuer.', 'Ich nehme das.',
    ],
  },
  {
    file: 'a1-smalltalk-phrases',
    category: 'smalltalk-phrases',
    pos: 'phrase',
    words: [
      'Wie geht es dir?', 'Mir geht es gut.', 'Woher kommst du?',
      'Ich komme aus Nepal.', 'Was machst du?', 'Wie alt bist du?',
      'Ich bin zwanzig Jahre alt.', 'Hast du Geschwister?',
      'Magst du Musik?', 'Kannst du schwimmen?', 'Wann beginnt der Film?',
      'Warum lernst du Deutsch?', 'Weil ich in Deutschland studieren will.',
      'Was ist dein Hobby?', 'Mein Hobby ist Lesen.',
    ],
  },
  {
    file: 'a1-colors',
    category: 'colors',
    pos: 'adjective',
    words: [
      'rot', 'blau', 'grün', 'gelb', 'schwarz', 'weiß', 'braun', 'grau',
      'rosa', 'lila', 'orange', 'bunt',
    ],
  },
  {
    file: 'a1-body-health',
    category: 'body-health',
    pos: 'noun',
    words: [
      'Kopf', 'Ohr', 'Nase', 'Mund', 'Zahn', 'Hand', 'Arm', 'Bein', 'Fuß',
      'Bauch', 'Rücken', 'Haar', 'Herz', 'Finger', 'Knie', 'Haut', 'Stimme',
      'Kopfschmerzen', 'Fieber', 'Husten', 'Schnupfen',
    ],
  },
  {
    file: 'a1-school-office',
    category: 'school-office',
    pos: 'noun',
    words: [
      'Heft', 'Stift', 'Bleistift', 'Radiergummi', 'Lineal', 'Aufgabe',
      'Prüfung', 'Note', 'Pause', 'Lehrer', 'Lehrerin', 'Schüler', 'Klasse',
      'Tafel', 'Papier', 'Brief', 'Karte', 'Einladung', 'Zeitung', 'Briefmarke',
    ],
  },
  {
    file: 'a1-action-verbs',
    category: 'action-verbs',
    pos: 'verb',
    words: [
      'anrufen', 'einkaufen', 'aufräumen', 'waschen', 'putzen', 'duschen',
      'warten', 'suchen', 'verlieren', 'bezahlen', 'bestellen', 'reservieren',
      'einladen', 'schenken', 'packen', 'fliegen', 'steigen', 'aussteigen',
      'umsteigen', 'abbiegen', 'überqueren', 'sich freuen',
    ],
  },
  {
    file: 'a1-describing-adjectives',
    category: 'describing-adjectives',
    pos: 'adjective',
    words: [
      'ruhig', 'komisch', 'ernst', 'höflich', 'freundlich', 'ehrlich',
      'fleißig', 'faul', 'klug', 'dumm', 'schwach', 'reich', 'arm', 'allein',
      'gleich', 'anders', 'möglich', 'nötig', 'genug', 'ganz', 'halb',
    ],
  },
  {
    file: 'a1-city-travel',
    category: 'city-travel',
    pos: 'noun',
    words: [
      'Haltestelle', 'Fahrkarte', 'Ausflug', 'Urlaub', 'Reise', 'Koffer',
      'Gepäck', 'Pass', 'Grenze', 'Stadtzentrum', 'Ampel', 'Parkplatz',
      'Tankstelle', 'Fahrplan', 'Ankunft', 'Abfahrt', 'Umgebung', 'Sehenswürdigkeit',
    ],
  },
  {
    file: 'a1-weather-wishes',
    category: 'weather-wishes',
    pos: 'phrase',
    words: [
      'Es regnet.', 'Es schneit.', 'Die Sonne scheint.', 'Mir ist kalt.',
      'Mir ist heiß.', 'Das macht Spaß.', 'Ich habe keine Zeit.',
      'Bis morgen!', 'Bis später!', 'Guten Appetit!', 'Prost!',
      'Herzlichen Glückwunsch!', 'Alles Gute zum Geburtstag!',
      'Gute Reise!', 'Schönes Wochenende!',
    ],
  },
  {
    file: 'a1-daily-routine',
    category: 'daily-routine',
    pos: 'phrase',
    words: [
      'Ich stehe um 7 Uhr auf.', 'Ich frühstücke um halb acht.',
      'Ich fahre mit dem Bus zur Arbeit.', 'Ich komme um 18 Uhr nach Hause.',
      'Am Abend sehe ich fern.', 'Ich gehe um 23 Uhr ins Bett.',
      'Am Wochenende treffe ich Freunde.', 'Jeden Tag lerne ich Deutsch.',
      'Normalerweise koche ich selbst.', 'Ich war gestern im Kino.',
      'Morgen gehe ich einkaufen.', 'Ich rufe meine Mutter an.',
    ],
  },
  {
    file: 'a1-kitchen-household',
    category: 'kitchen-household',
    pos: 'noun',
    words: [
      'Löffel', 'Gabel', 'Messer', 'Teller', 'Tasse', 'Glas', 'Flasche',
      'Topf', 'Pfanne', 'Kühlschrank', 'Herd', 'Ofen', 'Mikrowelle',
      'Waschmaschine', 'Vorhang', 'Teppich', 'Kissen', 'Decke', 'Handtuch',
      'Eimer', 'Besen', 'Mülleimer',
    ],
  },
  {
    file: 'a1-professions',
    category: 'professions',
    pos: 'noun',
    words: [
      'Arzt', 'Ärztin', 'Krankenschwester', 'Polizist', 'Bäcker', 'Verkäufer',
      'Kellner', 'Fahrer', 'Mechaniker', 'Ingenieur', 'Student', 'Studentin',
      'Kollege', 'Chef', 'Mitarbeiter', 'Friseur',
    ],
  },
  {
    file: 'a1-hobby-verbs',
    category: 'hobby-verbs',
    pos: 'verb',
    words: [
      'feiern', 'klettern', 'wandern', 'sammeln', 'basteln', 'malen',
      'zeichnen', 'fotografieren', 'aufnehmen', 'herunterladen', 'hochladen',
      'teilen', 'drucken', 'speichern', 'löschen', 'trainieren', 'joggen',
    ],
  },
  {
    file: 'a1-taste-texture-adjectives',
    category: 'taste-texture-adjectives',
    pos: 'adjective',
    words: [
      'süß', 'sauer', 'bitter', 'salzig', 'lecker', 'trocken', 'nass',
      'weich', 'hart', 'glatt', 'eng', 'weit', 'tief', 'flach', 'rund',
      'eckig', 'frisch',
    ],
  },
  {
    file: 'a1-doctor-shopping-phrases',
    category: 'doctor-shopping-phrases',
    pos: 'phrase',
    words: [
      'Ich habe Kopfschmerzen.', 'Ich brauche einen Termin.',
      'Ich fühle mich nicht gut.', 'Hier tut es weh.',
      'Haben Sie das in meiner Größe?', 'Kann ich das anprobieren?',
      'Wo ist die Umkleidekabine?', 'Gibt es das auch in Blau?',
      'Ich möchte Geld wechseln.', 'Ich möchte ein Konto eröffnen.',
      'Wie viel kostet das Porto?', 'Ich habe meinen Pass verloren.',
      'Brauche ich ein Visum?', 'Wo kann ich Tickets kaufen?',
    ],
  },
  {
    file: 'a1-travel-questions',
    category: 'travel-questions',
    pos: 'phrase',
    words: [
      'Wie bitte?', 'Was kostet die Fahrkarte?',
      'Von wo bis wo fährt der Zug?', 'Muss ich umsteigen?',
      'Wie lange dauert die Fahrt?', 'Gibt es eine Direktverbindung?',
      'Wann kommt der nächste Bus?', 'Ist dieser Platz frei?',
      'Können Sie mir den Weg zeigen?', 'Sind wir schon da?',
    ],
  },
];

// ---------------------------------------------------------------------------
// Robust JSON extraction (handles code fences / reasoning preamble)
// ---------------------------------------------------------------------------
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Prompt — localization only, never vocabulary invention
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a localization engineer for MeroDeutsch, a German
learning app for Nepali speakers (CEFR A1).

You will receive a JSON array of German words/phrases. For EACH item return a
localized entry. Return ONLY a JSON object: {"entries": [ ... ]} with one entry
per input item, in the SAME ORDER.

Entry schema:
{
  "word": "<the German word/phrase, copied verbatim>",
  "article": "der" | "die" | "das" | null,
  "part_of_speech": "noun" | "verb" | "adjective" | "phrase",
  "translation_en": "<natural English translation>",
  "translation_np": "<Nepali translation in Devanagari script>"
}

RULES:
- NEVER invent new German words — copy "word" verbatim from the input.
- "article" is the correct definite article for nouns; use null for verbs,
  adjectives, and phrases.
- translation_np MUST be natural spoken NEPALI in Devanagari script — NOT
  Hindi/Sanskrit conventions (e.g. use होइन not नहीं, use Nepali verb forms).
- Keep translations short and A1-appropriate.
- If a word has no sensible Nepali translation, still return the entry with
  your best natural Nepali equivalent.`;

function userPrompt(words: string[]): string {
  return `Localize these ${words.length} German item(s). Return ONLY {"entries": [...]} in this exact order:
${JSON.stringify(words)}`;
}

/** Sleep helper for rate-limit backoff. */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Call the model with retry on 429 rate limits. Parses "Please try again in
 * Xs" hints from Groq/OpenAI error bodies when available.
 */
async function createWithRetry(
  messages: { role: 'system' | 'user'; content: string }[],
  maxAttempts = 5,
): Promise<string> {
  const client = getClient();
  let lastError: Error = new Error('unreachable');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 2000,
        messages,
      });
      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error('Empty completion from model');
      return text;
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message;
      const isRateLimit = msg.includes('429') || /rate limit/i.test(msg);
      if (!isRateLimit || attempt === maxAttempts) throw lastError;
      const match = msg.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : attempt * 8000;
      console.warn(`   ⏳ rate limited — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const DEVANAGARI_RE = /[\u0900-\u097F]/;

interface RawEntry {
  word?: unknown;
  article?: unknown;
  part_of_speech?: unknown;
  translation_en?: unknown;
  translation_np?: unknown;
}

function validateEntry(raw: RawEntry, expectedPos: VocabularyEntity['part_of_speech']): string | null {
  const word = raw.word;
  const en = raw.translation_en;
  const np = raw.translation_np;
  const article = raw.article;

  if (typeof word !== 'string' || word.trim().length === 0 || word.length > 40) {
    return 'invalid word';
  }
  if (typeof en !== 'string' || en.trim().length === 0 || en.length > 60) {
    return 'invalid translation_en';
  }
  if (typeof np !== 'string' || np.trim().length === 0 || np.length > 60) {
    return 'invalid translation_np';
  }
  if (!DEVANAGARI_RE.test(np)) {
    return 'translation_np is not Devanagari';
  }
  if (expectedPos === 'noun') {
    if (article !== 'der' && article !== 'die' && article !== 'das') {
      return `noun missing valid article (got ${String(article)})`;
    }
  } else if (article !== null && article !== undefined) {
    return 'non-noun must have null article';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Existing-row dedupe (live DB, optional)
// ---------------------------------------------------------------------------
async function loadExistingKeys(): Promise<Set<string>> {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('⚠ No Supabase service credentials — skipping live-DB dedupe.');
    return new Set();
  }
  const client = createClient(url, serviceKey);
  const { data, error } = await client.from('vocabulary').select('word, part_of_speech');
  if (error) {
    console.warn(`⚠ Could not fetch existing rows for dedupe: ${error.message}`);
    return new Set();
  }
  return new Set((data ?? []).map((r) => `${r.word}|${r.part_of_speech}`));
}

// ---------------------------------------------------------------------------
// Generation for one cluster
// ---------------------------------------------------------------------------
async function generateCluster(
  cluster: Cluster,
  existingKeys: Set<string>,
): Promise<{ written: number; skippedExisting: number; rejected: string[] }> {
  const rejected: string[] = [];
  const entries: VocabularyEntity[] = [];
  const batchKeys = new Set<string>();
  let skippedExisting = 0;

  for (let i = 0; i < cluster.words.length; i += BATCH_SIZE) {
    const chunk = cluster.words.slice(i, i + BATCH_SIZE);
    const text = await createWithRetry([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(chunk) },
    ]);
    const parsed = extractJson(text) as { entries?: RawEntry[] };
    const arr = parsed.entries ?? [];

    chunk.forEach((seedWord, idx) => {
      const raw = arr[idx];
      if (!raw || typeof raw !== 'object') {
        rejected.push(`${seedWord}: no entry returned`);
        return;
      }
      const problem = validateEntry(raw, cluster.pos);
      if (problem) {
        rejected.push(`${seedWord}: ${problem}`);
        return;
      }
      const key = `${raw.word}|${cluster.pos}`;
      if (existingKeys.has(key)) {
        skippedExisting += 1;
        return;
      }
      if (batchKeys.has(key)) {
        rejected.push(`${seedWord}: duplicate within batch`);
        return;
      }
      batchKeys.add(key);
      entries.push({
        word: (raw.word as string).trim(),
        article: cluster.pos === 'noun' ? (raw.article as 'der' | 'die' | 'das') : undefined,
        part_of_speech: cluster.pos,
        translation_en: (raw.translation_en as string).trim(),
        translation_np: (raw.translation_np as string).trim(),
        translation_ne_roman: devanagariToRoman((raw.translation_np as string).trim()),
        category: cluster.category,
        level: 'A1',
      });
    });
  }

  if (entries.length > 0) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const outFile = path.join(OUT_DIR, `${cluster.file}.json`);
    // Merge with any previously generated file for this cluster.
    let merged: VocabularyEntity[] = entries;
    try {
      const prev = JSON.parse(await fs.readFile(outFile, 'utf8')) as VocabularyEntity[];
      const seen = new Set(prev.map((e) => `${e.word}|${e.part_of_speech}`));
      merged = [...prev, ...entries.filter((e) => !seen.has(`${e.word}|${e.part_of_speech}`))];
    } catch {
      // no previous file — fine
    }
    await fs.writeFile(outFile, JSON.stringify(merged, null, 2), 'utf-8');
  }

  return { written: entries.length, skippedExisting, rejected };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`Provider: ${PROVIDER} | Model: ${MODEL}`);

  const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const clusters = filter.length > 0 ? CLUSTERS.filter((c) => filter.includes(c.file)) : CLUSTERS;
  if (clusters.length === 0) {
    console.error(`No clusters match: ${filter.join(', ')}`);
    console.error(`Available: ${CLUSTERS.map((c) => c.file).join(', ')}`);
    process.exit(1);
  }

  const existingKeys = await loadExistingKeys();
  console.log(`🚀 Generating A1 clusters (dedupe set: ${existingKeys.size} existing rows)...`);

  let totalWritten = 0;
  let totalSkipped = 0;
  const allRejected: string[] = [];

  for (const cluster of clusters) {
    process.stdout.write(`   • ${cluster.file} (${cluster.words.length} seeds)... `);
    try {
      const { written, skippedExisting, rejected } = await generateCluster(cluster, existingKeys);
      totalWritten += written;
      totalSkipped += skippedExisting;
      allRejected.push(...rejected.map((r) => `[${cluster.file}] ${r}`));
      console.log(`${written} new, ${skippedExisting} already in DB, ${rejected.length} rejected`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      allRejected.push(`[${cluster.file}] batch error: ${(err as Error).message}`);
    }
  }

  console.log(`✅ Done. ${totalWritten} new entries written to src/data/vocab/*.json (${totalSkipped} skipped as already in DB).`);
  if (allRejected.length > 0) {
    console.log(`⚠ Rejected (${allRejected.length}):`);
    for (const r of allRejected) console.log(`   - ${r}`);
  }
  console.log('Next step: review the JSON files, then run `npm run seed-vocab` to upsert.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});