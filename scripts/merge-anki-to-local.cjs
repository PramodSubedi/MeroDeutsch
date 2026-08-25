const fs = require('fs');
const path = require('path');

const V2_DB_PATH = path.join('scripts', 'local-german-db-v2.json');
const ENRICHED_ANKI_PATH = path.join('scripts', 'anki-gothe-enriched.json');

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeLemma(lemma) {
  return lemma.toLowerCase().replace(/[^a-zäöüß]/g, '').trim();
}

function buildDedupIndex(words) {
  const index = new Set();
  for (const word of words) {
    const key = `${normalizeLemma(word.lemma)}|${word.part_of_speech}`;
    index.add(key);
  }
  return index;
}

function generateId(prefix, index) {
  return `${prefix}-${Date.now().toString(36)}-${index.toString(36)}`;
}

function mapPartOfSpeech(ankiPos) {
  const map = {
    'noun': 'noun',
    'verb': 'verb',
    'adjective': 'adjective',
    'adverb': 'adverb',
    'preposition': 'preposition',
    'pronoun': 'pronoun',
    'conjunction': 'conjunction',
    'interjection': 'interjection',
    'unknown': 'phrase'
  };
  return map[ankiPos] || 'phrase';
}

function mapGender(ankiGender) {
  const map = { 'm': 'm', 'f': 'f', 'n': 'n' };
  return map[ankiGender] || null;
}

function inferPlural(lemma, pluralSuffix, article) {
  if (!pluralSuffix) return null;
  if (pluralSuffix.startsWith('-')) {
    return pluralSuffix.substring(1);
  }
  return pluralSuffix;
}

function inferGenitive(lemma, gender) {
  if (!gender) return null;
  if (gender === 'n') return `des ${lemma.toLowerCase()}s`;
  if (gender === 'f') return `der ${lemma.toLowerCase()}`;
  if (gender === 'm') return `des ${lemma.toLowerCase()}s`;
  return null;
}

function createWordEntry(ankiEntry, frequencyRank) {
  const id = generateId('anki', Math.floor(Math.random() * 10000));
  const partOfSpeech = mapPartOfSpeech(ankiEntry.partOfSpeech);
  const gender = mapGender(ankiEntry.gender);
  const pluralForm = inferPlural(ankiEntry.lemma, ankiEntry.pluralSuffix, ankiEntry.article);
  const genitiveSingular = inferGenitive(ankiEntry.lemma, gender);

  return {
    id,
    lemma: ankiEntry.lemma,
    part_of_speech: partOfSpeech,
    cefr_level: ankiEntry.cefrLevel || 'A1',
    frequency_rank: frequencyRank,
    gender: gender,
    plural_form: pluralForm,
    genitive_singular: genitiveSingular,
    preposition_governed_case: null,
    translations: [
      {
        language: 'en',
        text: ankiEntry.englishTranslation || '',
        romanized: ankiEntry.lemma
      },
      {
        language: 'ne',
        text: ankiEntry.translationNe || '',
        romanized: ankiEntry.translationNeRoman || ''
      }
    ],
    metadata: {
      source: 'anki-goethe-a1',
      formality: ankiEntry.formality,
      notes: ankiEntry.notes,
      audio_ref: ankiEntry.audioRef
    }
  };
}

function createNounMetadata(word) {
  if (word.part_of_speech !== 'noun' || !word.gender) return null;
  return {
    gender: word.gender,
    plural: word.plural_form,
    genitive: word.genitive_singular
  };
}

function createVerbMetadata(word) {
  if (word.part_of_speech !== 'verb') return null;
  return {
    auxiliary: 'haben',
    present_3rd: word.lemma,
    simple_past_3rd: word.lemma,
    perfect: word.lemma,
    reflexive: false
  };
}

function createSentence(ankiEntry, wordId, sentenceIndex) {
  const germanText = ankiEntry.germanExample;
  if (!germanText) return null;

  const audioUrl = ankiEntry.audioRef
    ? `https://example.com/audio/anki/${ankiEntry.audioRef}`
    : `https://example.com/audio/anki/${ankiEntry.ankiId}.mp3`;

  return {
    id: `s-anki-${ankiEntry.ankiId}`,
    german_text: germanText,
    english_translation: ankiEntry.englishExample || '',
    nepali_translation: '',
    cefr_level: ankiEntry.cefrLevel || 'A1',
    word_references: [wordId],
    audio_url: audioUrl
  };
}

function createQuizQuestions(ankiEntry, wordId, word, sentence) {
  const questions = [];
  const baseId = ankiEntry.ankiId;

  if (sentence) {
    const gapSentence = sentence.german_text.replace(new RegExp(word.lemma, 'i'), '_____');
    questions.push({
      id: `q-listen-${baseId}`,
      content_item_id: `c-anki-${baseId}`,
      question_type: 'listening_gap',
      prompt_text: `Höre den Satz und füge das fehlende Wort ein: "${gapSentence}"`,
      german_target_text: word.lemma,
      audio_url_target: sentence.audio_url,
      evaluation_rubric_json: {
        type: 'word_match',
        correct_answer: word.lemma,
        case: 'nominative'
      }
    });

    questions.push({
      id: `q-speak-${baseId}`,
      content_item_id: `c-anki-${baseId}`,
      question_type: 'speaking_pronunciation',
      prompt_text: `Sage das Wort: "${word.lemma}"`,
      german_target_text: word.lemma,
      audio_url_target: `https://example.com/audio/anki/${word.metadata.audio_ref || baseId}.mp3`,
      evaluation_rubric_json: {
        type: 'pronunciation_match',
        correct_answer: word.lemma
      }
    });
  }

  if (ankiEntry.englishTranslation) {
    questions.push({
      id: `q-mcq-${baseId}`,
      content_item_id: `c-anki-${baseId}`,
      question_type: 'grammar_mcq',
      prompt_text: `Welches Wort bedeutet "${ankiEntry.englishTranslation}"?`,
      german_target_text: word.lemma,
      audio_url_target: `https://example.com/audio/anki/${word.metadata.audio_ref || baseId}.mp3`,
      evaluation_rubric_json: {
        type: 'multiple_choice',
        correct_answer: word.lemma,
        options: [word.lemma]
      }
    });
  }

  if (sentence && ankiEntry.englishExample) {
    questions.push({
      id: `q-write-${baseId}`,
      content_item_id: `c-anki-${baseId}`,
      question_type: 'free_writing',
      prompt_text: `Übersetze ins Deutsche: "${ankiEntry.englishExample}"`,
      german_target_text: sentence.german_text,
      audio_url_target: sentence.audio_url,
      evaluation_rubric_json: {
        type: 'translation_match',
        correct_answer: sentence.german_text
      }
    });
  }

  return questions;
}

function createContentItem(ankiEntry, wordId) {
  return {
    id: `c-anki-${ankiEntry.ankiId}`,
    content_type: 'anki-vocab-item',
    title_de: ankiEntry.lemma,
    title_en: ankiEntry.englishTranslation || '',
    title_ne: '',
    payload: {
      anki_id: ankiEntry.ankiId,
      word_id: wordId,
      lemma: ankiEntry.lemma,
      audio_ref: ankiEntry.audioRef
    }
  };
}

async function main() {
  const db = loadJson(V2_DB_PATH);
  const ankiEntries = loadJson(ENRICHED_ANKI_PATH);

  console.log('Merging Anki entries into v2 DB...');
  console.log('Current words:', db.words.length);
  console.log('Anki entries to process:', ankiEntries.length);

  const dedupIndex = buildDedupIndex(db.words);
  const newWords = [];
  const newSentences = [];
  const newQuizQuestions = [];
  const newContentItems = [];
  const skipped = [];

  let frequencyRank = Math.max(...db.words.map(w => w.frequency_rank || 0)) + 1;

  for (const ankiEntry of ankiEntries) {
    const key = `${normalizeLemma(ankiEntry.lemma)}|${mapPartOfSpeech(ankiEntry.partOfSpeech)}`;
    
    if (dedupIndex.has(key)) {
      skipped.push(ankiEntry.lemma);
      continue;
    }

    const word = createWordEntry(ankiEntry, frequencyRank++);
    newWords.push(word);

    const nounMeta = createNounMetadata(word);
    if (nounMeta) {
      db.noun_metadata[word.id] = nounMeta;
    }

    const verbMeta = createVerbMetadata(word);
    if (verbMeta) {
      db.verb_metadata[word.id] = verbMeta;
    }

    db.vocabulary_translations[word.id] = {
      word_id: word.id,
      translations: word.translations
    };

    const sentence = createSentence(ankiEntry, word.id, newSentences.length);
    if (sentence) {
      newSentences.push(sentence);
    }

    const questions = createQuizQuestions(ankiEntry, word.id, word, sentence);
    newQuizQuestions.push(...questions);

    const contentItem = createContentItem(ankiEntry, word.id);
    newContentItems.push(contentItem);

    dedupIndex.add(key);
  }

  db.words.push(...newWords);
  db.sentences.push(...newSentences);
  db.quiz_questions.push(...newQuizQuestions);
  Object.assign(db.content_items_reference, ...newContentItems.map(item => ({ [item.id]: item })));

  db.statistics.total_words = db.words.length;
  db.statistics.total_sentences = db.sentences.length;
  db.statistics.total_quiz_questions = db.quiz_questions.length;

  const byPos = {};
  const byCefr = {};
  for (const word of db.words) {
    byPos[word.part_of_speech] = (byPos[word.part_of_speech] || 0) + 1;
    byCefr[word.cefr_level] = (byCefr[word.cefr_level] || 0) + 1;
  }
  db.statistics.by_part_of_speech = byPos;
  db.statistics.by_cefr = byCefr;

  fs.writeFileSync(V2_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  console.log('\nMerge complete');
  console.log('New words added:', newWords.length);
  console.log('Skipped duplicates:', skipped.length);
  console.log('New sentences:', newSentences.length);
  console.log('New quiz questions:', newQuizQuestions.length);
  console.log('Total words in v2:', db.words.length);
  console.log('Total sentences in v2:', db.sentences.length);
  console.log('Total quiz questions in v2:', db.quiz_questions.length);
  console.log('\nPOS distribution:', db.statistics.by_part_of_speech);
  console.log('CEFR distribution:', db.statistics.by_cefr);
  console.log('Output:', V2_DB_PATH);
}

main().catch(err => {
  console.error('Merge failed:', err);
  process.exit(1);
});
