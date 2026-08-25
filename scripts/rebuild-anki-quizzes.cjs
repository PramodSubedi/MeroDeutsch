const fs = require('fs');
const db = require('./local-german-db-v2.json');

const ankiWords = db.words.filter(w => w.metadata && w.metadata.source === 'anki-goethe-a1');
const ankiWordIds = new Set(ankiWords.map(w => w.id));

db.quiz_questions = db.quiz_questions.filter(q => {
  const cId = q.content_item_id || '';
  if (cId.startsWith('c-anki-')) {
    return ankiWordIds.has(cId.replace('c-anki-', 'w-'));
  }
  return true;
});

db.content_items_reference = db.content_items_reference.filter(c => {
  if (c.content_type === 'anki-vocab-item') {
    return ankiWordIds.has(c.payload?.word_id);
  }
  return true;
});

const newContentItems = [];
const newQuizQuestions = [];

for (const word of ankiWords) {
  const ankiId = word.id.replace('anki-', '');
  const sentence = db.sentences.find(s => s.word_references && s.word_references.includes(word.id));

  const contentItem = {
    id: `c-anki-${ankiId}`,
    content_type: 'anki-vocab-item',
    title_de: word.lemma,
    title_en: word.translations.find(t => t.language === 'en')?.text || '',
    title_ne: word.translations.find(t => t.language === 'ne')?.text || '',
    payload: {
      word_id: word.id,
      lemma: word.lemma,
      audio_ref: word.metadata?.audio_ref
    }
  };
  newContentItems.push(contentItem);

  if (sentence) {
    const gapSentence = sentence.german_text.replace(new RegExp(word.lemma, 'i'), '_____');
    newQuizQuestions.push({
      id: `q-listen-${ankiId}`,
      content_item_id: contentItem.id,
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

    newQuizQuestions.push({
      id: `q-speak-${ankiId}`,
      content_item_id: contentItem.id,
      question_type: 'speaking_pronunciation',
      prompt_text: `Sage das Wort: "${word.lemma}"`,
      german_target_text: word.lemma,
      audio_url_target: `https://example.com/audio/anki/${word.metadata?.audio_ref || ankiId}.mp3`,
      evaluation_rubric_json: {
        type: 'pronunciation_match',
        correct_answer: word.lemma
      }
    });
  }

  if (word.translations.find(t => t.language === 'en')?.text) {
    newQuizQuestions.push({
      id: `q-mcq-${ankiId}`,
      content_item_id: contentItem.id,
      question_type: 'grammar_mcq',
      prompt_text: `Welches Wort bedeutet "${word.translations.find(t => t.language === 'en').text}"?`,
      german_target_text: word.lemma,
      audio_url_target: `https://example.com/audio/anki/${word.metadata?.audio_ref || ankiId}.mp3`,
      evaluation_rubric_json: {
        type: 'multiple_choice',
        correct_answer: word.lemma,
        options: [word.lemma]
      }
    });
  }

  if (sentence && sentence.english_translation) {
    newQuizQuestions.push({
      id: `q-write-${ankiId}`,
      content_item_id: contentItem.id,
      question_type: 'free_writing',
      prompt_text: `Übersetze ins Deutsche: "${sentence.english_translation}"`,
      german_target_text: sentence.german_text,
      audio_url_target: sentence.audio_url,
      evaluation_rubric_json: {
        type: 'translation_match',
        correct_answer: sentence.german_text
      }
    });
  }
}

db.content_items_reference.push(...newContentItems);
db.quiz_questions.push(...newQuizQuestions);

db.statistics.total_sentences = db.sentences.length;
db.statistics.total_quiz_questions = db.quiz_questions.length;
db.statistics.total_content_items = db.content_items_reference.length;

fs.writeFileSync('scripts/local-german-db-v2.json', JSON.stringify(db, null, 2), 'utf-8');

console.log('Quiz/content regeneration complete');
console.log('New content items:', newContentItems.length);
console.log('New quiz questions:', newQuizQuestions.length);
console.log('Total quiz questions:', db.quiz_questions.length);
console.log('Total content items:', db.content_items_reference.length);
