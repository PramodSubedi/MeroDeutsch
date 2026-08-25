/**
 * scripts/repair-conversation-defs.cjs  (temporary repair utility — safe to delete)
 *
 * Repairs conversational_scenario_defs.json after partial third-party edits:
 *  1. Inserts missing commas between scenario objects (`}\n{` -> `},\n{`).
 *  2. Restores the destroyed conv-hotel object opener.
 *  3. Converts `ref` options that do not exist in the vocab bank into
 *     self-contained inline options (with en/ne/ne_roman translations).
 *  4. Pedagogy repairs: 112 vs 110 emergency numbers, bank role reversal,
 *     Arztbesuch typo, umlaut restoration sweep.
 *  5. Writes pretty-printed JSON back and prints a validation report.
 */
const fs = require('fs');
const path = require('path');

const DEFS = path.join(__dirname, '..', 'src', 'data', 'conversational_scenario_defs.json');
const VOCAB = path.join(__dirname, '..', 'src', 'data', 'conversational_german_vocab.json');

let raw = fs.readFileSync(DEFS, 'utf8');

// --- 1. structural string fixes -------------------------------------------
raw = raw.replace(/\}\s*\n\s*\{/g, '},\n{'); // missing commas between objects

// restore conv-hotel opener (kilo's paste consumed it + left stray closers)
const brokenHotelA = '] }\n]\n}\n],\n]\n},\n"title": "Hotel-Check-in"';
if (raw.includes(brokenHotelA)) {
  raw = raw.replace(
    brokenHotelA,
    '] }\n],\n{\n"sid": "conv-hotel",\n"title": "Hotel-Check-in"',
  );
  console.log('fixed: conv-hotel opener restored (multi-stray)');
}
const brokenHotelB = '],\n]\n},\n"title"';
if (raw.includes(brokenHotelB)) {
  raw = raw.replace(
    brokenHotelB,
    '],\n{\n"sid": "conv-hotel",\n"title"',
  );
  console.log('fixed: conv-hotel opener restored (variant B)');
}

// --- 2. parse ---------------------------------------------------------------
let defs;
try {
  defs = JSON.parse(raw);
} catch (e) {
  console.error('STILL INVALID JSON:', e.message);
  process.exit(1);
}
console.log('parsed OK. scenarios:', defs.length);

// --- 3. vocab bank + translation table for orphaned refs --------------------
const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const cards = new Set(vocab.map((c) => c.german_text));

const T = {
  '110 wählen.': { en: 'Dial 110.', ne: '११० डायल गर्नुहोस्।', neR: 'ek sau das dial garnuhos' },
  'Er ist um die Ecke.': { en: 'It is around the corner.', ne: 'यो छेउमै छ।', neR: 'yo chheumai chha' },
  'Auf Wiedersehen.': { en: 'Goodbye.', ne: 'अलविदा।', neR: 'alavidha' },
  'Ja, ich bin da.': { en: 'Yes, I am here.', ne: 'जा, म यहाँ छु।', neR: 'ja ma yahaa chhu' },
  'Ein Moment, ich hol ihn.': { en: 'One moment, I will get him.', ne: 'एक क्षण, म उहाँलाई बोलाउँछु।', neR: 'ek kshan ma uhaanlaai bolaaunchhu' },
  'Welche Währung möchten Sie?': { en: 'Which currency would you like?', ne: 'तपाईंलाई कुन मुद्रा चाहियो?', neR: 'tapaaailaai kun mudraa chaahiyo' },
  'Das macht 135 Dollar.': { en: 'That makes 135 dollars.', ne: 'यो १३५ डलर हो।', neR: 'yo ek sai painchatis dollar ho' },
  'Danke, auf Wiedersehen.': { en: 'Thanks, goodbye.', ne: 'धन्यवाद, अलविदा।', neR: 'dhanyabaad alavidha' },
  'Gerne, folgen Sie mir.': { en: 'Certainly, follow me.', ne: 'अवश्य, मसँग आउनुहोस्।', neR: 'awashya masanga aaunuhos' },
  'Ich hätte gerne die Suppe.': { en: 'I would like the soup, please.', ne: 'मलाई कृपया सूप चाहियो।', neR: 'malai kripaya soup chaahiyo' },
  'Das macht 45 Euro.': { en: 'That comes to 45 euros.', ne: 'यो ४५ यूरो हो।', neR: 'yo paitaalis euro ho' },
  'Ich habe Kopfschmerzen und Fieber.': { en: 'I have a headache and a fever.', ne: 'मेरो टाउको दुखेको र ज्वरो आएको छ।', neR: 'mero tauko dukheko ra jwaro aaeko chha' },
  'Danke, ich hole sie apotheke.': { en: 'Thanks, I will get it at the pharmacy.', ne: 'धन्यवाद, म यो औषधि भण्डारबाट लिन्छु।', neR: 'dhanyabaad ma yo aushadhi bhandaar baat linchhu' },
};

// --- 4. walk + repair --------------------------------------------------------
let convertedRefs = 0;
const umlauts = [
  ['naechsten', 'nächsten'], ['Naechste', 'Nächste'], ['naechte', 'nächte'],
  ['natuerlich', 'natürlich'], ['Natuerlich', 'Natürlich'],
  ['moechte', 'möchte'], ['Moechten', 'Möchten'],
  ['faengt', 'fängt'], ['faehrt', 'fährt'],
  ['Schoenes', 'Schönes'], ['schoen', 'schön'], ['Schoen', 'Schön'],
  ['hoeren', 'hören'], ['Hoeren', 'Hören'], ['Glueck', 'Glück'],
  ['Fuer', 'Für'], ['fuer', 'für'], ['haette', 'hätte'],
  ['ausfuellen', 'ausfüllen'], ['Schluessel', 'Schlüssel'],
  ['muessen', 'müssen'], ['Muessen', 'Müssen'], ['Spass', 'Spaß'],
  ['laeuft', 'läuft'], ['spaeter', 'später'],
  ['koennen', 'können'], ['Koenntest', 'Könntest'],
  ['gewoehnen', 'gewöhnen'], ['frueh', 'früh'], ['Frueh', 'Früh'],
  ['goenn', 'gönn'], ['drueben', 'drüben'], ['Weisst du', 'Weißt du'],
  ['Selbstverstaendlich', 'Selbstverständlich'], ['Arzbesuch', 'Arztbesuch'],
];
function sweep(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [a, b] of umlauts) out = out.split(a).join(b);
  return out;
}

for (const sc of defs) {
  sc.title = sweep(sc.title);
  if (sc.closing) sc.closing = sweep(sc.closing);
  for (const vr of sc.variants) {
    vr.name = sweep(vr.name);
    for (const st of vr.steps) {
      st.n = sweep(st.n);
      st.p = sweep(st.p || '');
      const nextOpts = [];
      for (const o of st.opts) {
        if (typeof o.ref === 'string' && !cards.has(o.ref)) {
          const tr = T[o.ref];
          if (!tr) { console.log('UNKNOWN REF (kept as inline, untranslated):', o.ref); }
          nextOpts.push({
            t: o.ref,
            en: tr ? tr.en : o.ref,
            ne: tr ? tr.ne : '',
            neR: tr ? tr.neR : '',
            ok: o.ok ?? false,
            fb: sweep(o.fb || ''),
          });
          convertedRefs++;
        } else {
          o.fb = sweep(o.fb || '');
          nextOpts.push(o);
        }
      }
      st.opts = nextOpts;
    }
  }
}
console.log('converted orphaned refs to inline options:', convertedRefs);

// --- 5. targeted pedagogy repairs -------------------------------------------
for (const sc of defs) {
  if (sc.sid === 'conv-emergency') {
    const v0 = sc.variants[0];
    const dialStep = v0.steps[0];
    for (const o of dialStep.opts) {
      if ((o.t || o.ref || '').startsWith('112')) { o.ok = true; }
      if ((o.t || o.ref || '') === '110 wählen.') {
        o.ok = false;
        o.fb = '110 ist die Polizei - bei medizinischen Notfaellen waehlt man 112.';
      }
    }
  }
  if (sc.sid === 'conv-bank') {
    const v0 = sc.variants[0];
    if (v0.steps[0]) {
      v0.steps[0].n = 'Guten Tag! Was kann ich für Sie tun?';
      v0.steps[0].nEn = 'Hello! What can I do for you?';
      const first = v0.steps[0].opts[0];
      if (first && typeof first.ref === 'string' && !cards.has(first.ref)) {
        const tr = T[first.ref];
        v0.steps[0].opts = [
          {
            t: 'Ich möchte gerne Geld wechseln.',
            en: 'I would like to exchange money.',
            ne: 'म पैसा साट्न चाहन्छु।',
            neR: 'ma paisa saatna chahanchhu',
            ok: true,
          },
          {
            t: first.ref,
            en: tr ? tr.en : '',
            ne: tr ? tr.ne : '',
            neR: tr ? tr.neR : '',
            fb: "That is the clerk's question - you are the customer!",
          },
        ];
      }
    }
  }
}

// --- 6. write + validate ------------------------------------------------------
fs.writeFileSync(DEFS, JSON.stringify(defs, null, 2) + '\n', 'utf8');

// final validation
const reParsed = JSON.parse(fs.readFileSync(DEFS, 'utf8'));
let badRefs = 0, noOk = 0, dupIds = 0;
const seen = new Set();
for (const sc of reParsed) {
  for (const vr of sc.variants) {
    if (seen.has(vr.id)) dupIds++;
    seen.add(vr.id);
    for (const st of vr.steps) {
      if (!st.opts.some((o) => o.ok)) noOk++;
      for (const o of st.opts) {
        if (o.ref && !cards.has(o.ref)) badRefs++;
      }
    }
  }
}
console.log('--- validation ---');
console.log('scenarios:', reParsed.length,
  '| variants:', reParsed.reduce((a, x) => a + x.variants.length, 0),
  '| steps:', reParsed.reduce((a, x) => a + x.variants.reduce((b, v) => b + v.steps.length, 0), 0));
console.log('bad refs:', badRefs, '| steps without ok:', noOk, '| duplicate variant ids:', dupIds);
