const fs = require('fs');
let db = JSON.parse(fs.readFileSync('./local-german-db.json', 'utf-8'));

// Generate quiz questions covering 4 skill areas
const quizQuestions = [];

// listening_gap questions (20 questions)
for (let i = 0; i < 20; i++) {
  const word = db.words[i % db.words.length];
  if (word.part_of_speech === 'noun') {
    const gapText = 'Der ' + word.lemma + ' steht vor dem Haus.';
    quizQuestions.push({
      id: 'q-listening-' + i,
      content_item_id: 'c-vocab-001',
      question_type: 'listening_gap',
      prompt_text: 'Höre den Satz und füge das fehlende Wort ein: "' + gapText + '"',
      german_target_text: word.lemma,
      audio_url_target: 'https://example.com/audio/listen-' + i + '.mp3',
      evaluation_rubric_json: {
        type: 'word_match',
        correct_answer: word.lemma,
        case: 'nominative'
      }
    });
  } else if (word.part_of_speech === 'verb') {
    const gapText = 'Ich ' + word.lemma + ' jeden Tag.';
    quizQuestions.push({
      id: 'q-listening-' + i,
      content_item_id: 'c-vocab-001',
      question_type: 'listening_gap',
      prompt_text: 'Höre den Satz und füge das fehlende Wort ein: "' + gapText + '"',
      german_target_text: word.lemma,
      audio_url_target: 'https://example.com/audio/listen-' + i + '.mp3',
      evaluation_rubric_json: {
        type: 'word_match',
        correct_answer: word.lemma
      }
    });
  }
}

// speaking_pronunciation questions (20 questions)
for (let i = 0; i < 20; i++) {
  const word = db.words[db.words.length - 1 - i];
  quizQuestions.push({
    id: 'q-speaking-' + i,
    content_item_id: 'c-vocab-001',
    question_type: 'speaking_pronunciation',
    prompt_text: 'Sprich das Wort aus und Aufnahme: "' + word.lemma + '"',
    german_target_text: word.lemma,
    audio_url_target: 'https://example.com/audio/speak-' + i + '.mp3',
    evaluation_rubric_json: {
      type: 'pronunciation',
      focus: 'IPA comparison',
      target_ipa: '/' + word.lemma.toLowerCase() + '/'
    }
  });
}

// grammar_mcq questions (20 questions)
const verbWords = db.words.filter(w => w.part_of_speech === 'verb');
for (let i = 0; i < 20; i++) {
  const word = verbWords[i % verbWords.length];
  const options = ['bin', 'habe', 'ist'];
  const correctIndex = i % 3;
  options[correctIndex] = word.prasens_third_person || word.lemma;
  
  quizQuestions.push({
    id: 'q-grammar-' + i,
    content_item_id: 'c-vocab-001',
    question_type: 'grammar_mcq',
    prompt_text: 'Welche Form ist korrekt? "Ich _____ gut."',
    german_target_text: word.prasens_third_person || word.lemma,
    options: options,
    correct_answer: options[correctIndex],
    audio_url_target: 'https://example.com/audio/listen-q' + (40 + i) + '.mp3',
    evaluation_rubric_json: {
      type: 'multiple_choice',
      correct_option: options[correctIndex]
    }
  });
}

// free_writing questions (5 questions)
for (let i = 0; i < 5; i++) {
  const word = db.words[db.words.length - 1 - i];
  quizQuestions.push({
    id: 'q-writing-' + i,
    content_item_id: 'c-vocab-001',
    question_type: 'free_writing',
    prompt_text: 'Übersetze ins Deutsche: "' + (word.translations.find(t => t.language === 'ne')?.text || '') + '"',
    german_target_text: word.lemma,
    audio_url_target: 'https://example.com/audio/write-' + i + '.mp3',
    evaluation_rubric_json: {
      type: 'translation',
      correct_answer: word.lemma
    }
  });
}

db.quiz_questions = quizQuestions;

fs.writeFileSync('./local-german-db.json', JSON.stringify(db, null, 2));
console.log('Added', quizQuestions.length, 'quiz questions');
console.log('Types:', ...new Set(quizQuestions.map(q => q.question_type)));
console.log('Total quiz_questions:', db.quiz_questions.length);