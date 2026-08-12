import type { RoleplayScenario } from '../types/curriculum';

export const SCENARIOS: RoleplayScenario[] = [
  {
    id: 'cafe', title: 'Im Café', emoji: '☕',
    steps: [
      { npc: 'Guten Tag! Was möchten Sie?', prompt: 'What do you order?', options: [
        { text: 'Ich hätte gern einen Kaffee, bitte.', ok: true, fb: 'Sehr gut!' },
        { text: 'Wo ist der Bahnhof?', ok: false, fb: 'That is directions, not an order.' },
        { text: 'Ich bin müde.', ok: false, fb: 'True, but you still need to order!' },
      ]},
      { npc: 'Möchten Sie auch etwas zu essen?', prompt: 'What do you answer?', options: [
        { text: 'Nein, danke. Nur den Kaffee.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich heiße Anna.', ok: false, fb: 'That is your name, not about food.' },
      ]},
    ],
  },
  {
    id: 'intro', title: 'Vorstellung', emoji: '👋',
    steps: [
      { npc: 'Hallo! Wie heißt du?', prompt: 'Introduce yourself.', options: [
        { text: 'Ich heiße Pramod. Und du?', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich bin aus Nepal.', ok: false, fb: 'That answers origin, not name.' },
      ]},
      { npc: 'Woher kommst du?', prompt: 'Answer where you are from.', options: [
        { text: 'Ich komme aus Nepal.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich habe Hunger.', ok: false, fb: 'That is about hunger, not origin.' },
      ]},
    ],
  },
  {
    id: 'hotel', title: 'Hotel-Check-in', emoji: '🏨',
    steps: [
      { npc: 'Guten Abend. Haben Sie eine Reservierung?', prompt: 'Answer the hotel clerk.', options: [
        { text: 'Ja, ich habe eine Reservierung.', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich brauche ein Taxi.', ok: false, fb: 'A taxi is not a reservation.' },
      ]},
      { npc: 'Ihr Zimmer ist Nummer 12. Hier ist der Schlüssel.', prompt: 'What do you say?', options: [
        { text: 'Vielen Dank!', ok: true, fb: 'Perfekt!' },
        { text: 'Auf Wiedersehen!', ok: false, fb: 'Thank the clerk first!' },
      ]},
    ],
  },
];
