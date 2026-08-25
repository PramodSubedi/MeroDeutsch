/**
 * scripts/build-conversation-defs.cjs  (temporary — regenerates the defs JSON)
 * Authoritative source while repairing. Builds the scenarios as JS objects and
 * writes JSON, so commas/brackets can never corrupt the output.
 */
const fs = require('fs');
const path = require('path');

// compact step/option helpers
const oRef = (ref, opts = {}) => ({ ref, ...opts });              // ref option
const oInline = (t, en, ne, neR, fb, ok = false) => ({ t, en, ne, neR, fb, ok }); // inline option
const S = (n, nEn, p, opts) => ({ n, nEn, p, opts });
const V = (id, name, steps) => ({ id, name, steps });

const SCENARIOS = [];
const add = (sid, title, titleEn, emoji, ctx, band, closing, variants) =>
  SCENARIOS.push({ sid, title, titleEn, emoji, ctx, band, closing, variants });
// ── conv-intro ─────────────────────────────────────────────
add('conv-intro', 'Vorstellung', 'Meeting people', '👋', 'Self-introduction', 'A1-B1',
  'Sehr schön! Bis bald!', [
  V('intro-kurs', 'Neu im Kurs', [
    S('Hallo! Bist du neu hier im Kurs?', 'Hi! Are you new here in the course?', 'Introduce yourself briefly.',
      [oInline('Ich möchte mich kurz vorstellen.', 'I would like to introduce myself briefly.', 'म आफ्नो छोटो परिचय दिन चाहन्छु।', 'ma aphno choto parichaya dina chahanchu', 'Perfekt!', true),
       oInline('Ich muss mich beeilen.', 'I have to hurry up.', 'मलाई हतार गर्नु पर्छ।', 'malai hataar garna parcha', 'That is about hurrying - introduce yourself instead!')]),
    S('Freut mich! Woher kommst du?', 'Nice to meet you! Where are you from?', 'Say where you come from.',
      [oRef('Ich bin Aisha und komme aus Nepal.', { ok: true }),
       oInline('Ich habe heute viel gearbeitet.', 'I worked a lot today.', 'मैले आज धेरै काम गरें।', 'maile aaja dherai kaam garen', 'Work talk will not tell her where you are from!')]),
    S('Und? Sprichst du schon gut Deutsch?', 'And? Do you already speak German well?', 'Be modest about your level.',
      [oRef('Ich kann ein bisschen Deutsch sprechen.', { ok: true }),
       oInline('Ich gehe heute einkaufen.', 'I am going shopping today.', 'म आज किनमेल गर्न जान्छु।', 'ma aaja kinmel garna jaanchhu', 'Shopping plans do not answer a language question!')]),
  ]),
  V('intro-zug', 'Platz im Zug', [
    S('Entschuldigung, ist dieser Platz frei?', 'Excuse me, is this seat free?', 'Offer the seat politely.',
      [oInline('Ja, natürlich! Bitte setzen Sie sich.', 'Yes, of course! Please sit down.', 'ठीक छ, अवश्य! कृपया बस्नुहोस्।', 'thik chha awashya kripaya basnuhos', 'Sehr gut!', true),
       oRef('Ich steige an der nächsten Haltestelle aus.', { fb: 'That is about getting off - offer the seat first!' })]),
    S('Danke schön! Sag mal, woher kommst du?', 'Thank you! Tell me, where are you from?', 'Say where you come from.',
      [oRef('Ich bin Aisha und komme aus Nepal.', { ok: true }),
       oInline('Der Zug fährt gleich ab.', 'The train leaves soon.', 'ट्रेन चाँड़ै छुट्छ।', 'tren chandai chhutcha', 'Timetables later - answer the question!')]),
    S('Interessant! Und wie lange wohnst du schon hier?', 'Interesting! How long have you lived here?', 'Say how long you have been living here.',
      [oRef('Ich wohne seit drei Jahren in Deutschland.', { ok: true }),
       oInline('Ich stehe um sechs Uhr auf.', 'I get up at six o\'clock.', 'म बिहान छ बजे उठ्छु।', 'ma bihana chha baje uthchhu', 'Wake-up times do not answer this!')]),
  ]),
]);