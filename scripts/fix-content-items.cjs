const fs = require('fs');
const db = require('./local-german-db-v2.json');

db.content_items_reference = Array.isArray(db.content_items_reference)
  ? db.content_items_reference
  : Object.values(db.content_items_reference);

const ankiItems = db.words
  .filter(w => w.metadata && w.metadata.source === 'anki-goethe-a1')
  .map(w => ({
    id: `c-anki-${w.id}`,
    content_type: 'anki-vocab-item',
    title_de: w.lemma,
    title_en: w.translations.find(t => t.language === 'en')?.text || '',
    title_ne: w.translations.find(t => t.language === 'ne')?.text || '',
    payload: {
      word_id: w.id,
      lemma: w.lemma
    }
  }));

db.content_items_reference.push(...ankiItems);
fs.writeFileSync('scripts/local-german-db-v2.json', JSON.stringify(db, null, 2), 'utf-8');
console.log('Fixed content_items_reference. Total items:', db.content_items_reference.length);
