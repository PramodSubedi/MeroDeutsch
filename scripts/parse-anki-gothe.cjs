const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join('d:', 'project', 'extract_vocab', 'anki_german_a1_vocab-main', 'anki_german_a1_vocab-main', 'Goethe Institute A1 Wordlist.txt');
const OUTPUT_FILE = path.join('scripts', 'anki-gothe-parsed.json');

function parseAnkiLine(line) {
  const parts = line.split('\t');
  if (parts.length < 8) return null;

  const [ankiId, germanLemmaWithArticle, germanExample, englishTranslation, englishExample, formality, notes, audioRef] = parts;

  if (!ankiId || !germanLemmaWithArticle) return null;

  // Parse article and lemma from "die Ansage, -n" format
  const lemmaMatch = germanLemmaWithArticle.match(/^(der|die|das)\s+(.+?)(?:,\s*([-\w]+))?$/);
  let article = null;
  let lemma = germanLemmaWithArticle;
  let pluralSuffix = null;

  if (lemmaMatch) {
    article = lemmaMatch[1];
    lemma = lemmaMatch[2];
    pluralSuffix = lemmaMatch[3] || null;
  }

  // Infer gender from article
  let gender = null;
  if (article === 'der') gender = 'm';
  else if (article === 'die') gender = 'f';
  else if (article === 'das') gender = 'n';

  // Extract audio reference
  const audioMatch = audioRef.match(/\[sound:(.+?)\]/);
  const audioFileName = audioMatch ? audioMatch[1] : null;

  // Clean lemma
  const cleanLemma = lemma.trim();

  return {
    ankiId: ankiId.trim(),
    lemma: cleanLemma,
    article: article,
    gender: gender,
    pluralSuffix: pluralSuffix,
    partOfSpeech: article ? 'noun' : 'unknown',
    cefrLevel: 'A1',
    germanExample: germanExample ? germanExample.trim() : '',
    englishTranslation: englishTranslation ? englishTranslation.trim() : '',
    englishExample: englishExample ? englishExample.trim() : '',
    formality: formality ? formality.trim() : null,
    notes: notes ? notes.trim() : null,
    audioRef: audioFileName,
    source: 'anki-goethe-a1'
  };
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('Input file not found:', INPUT_FILE);
    process.exit(1);
  }

  const content = fs.readFileSync(INPUT_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const entries = [];
  const skipped = [];

  for (const line of lines) {
    try {
      const parsed = parseAnkiLine(line);
      if (parsed) {
        entries.push(parsed);
      } else {
        skipped.push(line.substring(0, 60));
      }
    } catch (err) {
      skipped.push(line.substring(0, 60));
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');

  console.log('Parsed Anki Goethe A1 Wordlist');
  console.log('Total lines:', lines.length);
  console.log('Parsed entries:', entries.length);
  console.log('Skipped:', skipped.length);
  if (skipped.length > 0) {
    console.log('Skipped samples:', skipped.slice(0, 5));
  }
  console.log('Output:', OUTPUT_FILE);
}

main();
