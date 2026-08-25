const fs = require('fs');
const db = require('./local-german-db-v2.json');

function normalizeLemma(lemma) {
  return lemma.toLowerCase().replace(/[^a-zäöüß]/g, '').trim();
}

function scoreWord(w) {
  let score = 0;
  if (w.translations && w.translations.length > 0) score += 10;
  if (w.gender) score += 5;
  if (w.plural_form) score += 5;
  if (w.genitive_singular) score += 5;
  if (w.metadata && Object.keys(w.metadata).length > 0) score += 5;
  if (w.id && w.id.startsWith('w-')) score += 3;
  return score;
}

const bestByKey = new Map();

for (const w of db.words) {
  const key = normalizeLemma(w.lemma) + '|' + w.part_of_speech;
  const current = bestByKey.get(key);
  if (!current || scoreWord(w) > scoreWord(current)) {
    bestByKey.set(key, w);
  }
}

const wordsToKeep = Array.from(bestByKey.values());
const wordsToRemove = new Set(db.words.map(w => w.id));
for (const w of wordsToKeep) {
  wordsToRemove.delete(w.id);
}

console.log('Total words before:', db.words.length);
console.log('Words to remove:', wordsToRemove.size);
console.log('Words to keep:', wordsToKeep.length);
console.log('Sanity check:', db.words.length - wordsToRemove.size, '==', wordsToKeep.length, '?', db.words.length - wordsToRemove.size === wordsToKeep.length);

db.words = wordsToKeep;

db.noun_metadata = Object.fromEntries(
  Object.entries(db.noun_metadata).filter(([id]) => !wordsToRemove.has(id))
);
db.verb_metadata = Object.fromEntries(
  Object.entries(db.verb_metadata).filter(([id]) => !wordsToRemove.has(id))
);
db.vocabulary_translations = Object.fromEntries(
  Object.entries(db.vocabulary_translations).filter(([id]) => !wordsToRemove.has(id))
);

const validWordIds = new Set(db.words.map(w => w.id));

db.sentences = db.sentences.filter(s => {
  if (!s.word_references) return false;
  return s.word_references.some(ref => validWordIds.has(ref));
});

const validContentIds = new Set(db.content_items_reference.map(c => c.id));
db.quiz_questions = db.quiz_questions.filter(q => {
  const cId = q.content_item_id || '';
  return validContentIds.has(cId);
});

db.content_items_reference = db.content_items_reference.filter(c => {
  if (c.content_type === 'anki-vocab-item') {
    return validWordIds.has(c.payload?.word_id);
  }
  return true;
});

db.statistics.total_words = db.words.length;
db.statistics.total_sentences = db.sentences.length;
db.statistics.total_quiz_questions = db.quiz_questions.length;
db.statistics.total_content_items = db.content_items_reference.length;

const byPos = {};
const byCefr = {};
for (const word of db.words) {
  byPos[word.part_of_speech] = (byPos[word.part_of_speech] || 0) + 1;
  byCefr[word.cefr_level] = (byCefr[word.cefr_level] || 0) + 1;
}
db.statistics.by_part_of_speech = byPos;
db.statistics.by_cefr = byCefr;

fs.writeFileSync('scripts/local-german-db-v2.json', JSON.stringify(db, null, 2), 'utf-8');

console.log('Deduplication complete');
console.log('Words after dedup:', db.words.length);
console.log('Sentences after filter:', db.sentences.length);
console.log('Quiz questions after filter:', db.quiz_questions.length);
console.log('Content items after filter:', db.content_items_reference.length);
console.log('POS distribution:', db.statistics.by_part_of_speech);
console.log('CEFR distribution:', db.statistics.by_cefr);

const seenFinal = new Set();
let finalDups = 0;
for (const w of db.words) {
  const key = normalizeLemma(w.lemma) + '|' + w.part_of_speech;
  if (seenFinal.has(key)) finalDups++;
  seenFinal.add(key);
}
console.log('Remaining duplicates:', finalDups);
