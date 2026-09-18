/**
 * scripts/seedCurriculum.enriched.ts
 *
 * Extended curriculum seed data for A1 Phase 1 (U5 content depth):
 *   - 150+ nouns with articles (organized by categories)
 *     · TIME & CLOCK batch (12 items) tagged `time` (unit-3)
 *   - 60+ verbs (common A1 verbs including separable/modals)
 *     · ROUTINE & SEPARABLE batch (14 items) tagged `routine` (unit-3)
 *   - 58 sentences with akkusativ and other grammar focus
 *     · U5 Akkusativ depth batch (18 items) enriches the Sentence Builder pool
 *
 * Usage / re-seed:
 *   1. Set SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in .env
 *      — the service-role key bypasses RLS for seeding. NEVER commit it.
 *   2. Run: npm run seed-curriculum
 *   3. Re-running is safe: idempotent upserts on
 *      (word, part_of_speech) for vocabulary and sentences.id for sentences.
 *
 * Required env vars:
 *   SUPABASE_URL               — project URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (secret, never committed)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/* ────────────────────────────────────────────────────────────
 * Dataset A — NOUNS (120+ items organized by category)
 * [noun, article, meaning "EN / NP", example sentence, tags]
 * ──────────────────────────────────────────────────────────── */

type NounRow = [noun: string, art: string, meaning: string, sentence: string];

const NOUNS: NounRow[] = [
  // FAMILY & PEOPLE (17 items)
  ['Mutter', 'die', 'Mother / आमा', 'Die Mutter kocht.'],
  ['Vater', 'der', 'Father / बुबा', 'Der Vater arbeitet.'],
  ['Kind', 'das', 'Child / बच्चा', 'Das Kind spielt.'],
  ['Sohn', 'der', 'Son / बेटा', 'Der Sohn ist zwölf.'],
  ['Tochter', 'die', 'Daughter / बेटी', 'Die Tochter geht zur Schule.'],
  ['Bruder', 'der', 'Brother / भाई', 'Der Bruder ist dreizehn.'],
  ['Schwester', 'die', 'Sister / दिदी', 'Die Schwester schläft.'],
  ['Großmutter', 'die', 'Grandmother / दादी', 'Die Großmutter ist alt.'],
  ['Großvater', 'der', 'Grandfather / दाजु', 'Der Großvater singt.'],
  ['Onkel', 'der', 'Uncle / काका', 'Der Onkel ist lustig.'],
  ['Tante', 'die', 'Aunt / चाची', 'Die Tante kocht gut.'],
  ['Freund', 'der', 'Friend (m) / साथी', 'Der Freund ist nett.'],
  ['Freundin', 'die', 'Friend (f) / सहेली', 'Die Freundin lacht.'],
  ['Lehrer', 'der', 'Teacher (m) / शिक्षक', 'Der Lehrer erklärt.'],
  ['Lehrerin', 'die', 'Teacher (f) / शिक्षिका', 'Die Lehrerin ist freundlich.'],
  ['Arzt', 'der', 'Doctor (m) / डाक्टर', 'Der Arzt hilft.'],
  ['Ärztin', 'die', 'Doctor (f) / महिला डाक्टर', 'Die Ärztin untersucht.'],
  
  // HOME & FURNITURE (16 items)
  ['Haus', 'das', 'House / घर', 'Das Haus ist alt.'],
  ['Wohnung', 'die', 'Apartment / अपार्टमेन्ट', 'Die Wohnung ist klein.'],
  ['Zimmer', 'das', 'Room / कोठा', 'Das Zimmer ist hell.'],
  ['Schlafzimmer', 'das', 'Bedroom / सुत्ने को कोठा', 'Das Schlafzimmer ist gemütlich.'],
  ['Küche', 'die', 'Kitchen / भान्सा', 'Die Küche ist sauber.'],
  ['Wohnzimmer', 'das', 'Living room / बैठक', 'Das Wohnzimmer ist groß.'],
  ['Badezimmer', 'das', 'Bathroom / बाथरूम', 'Das Badezimmer ist klein.'],
  ['Tür', 'die', 'Door / दरवाजा', 'Die Tür ist offen.'],
  ['Fenster', 'das', 'Window / झ्याल', 'Das Fenster ist groß.'],
  ['Tisch', 'der', 'Table / मेज', 'Der Tisch ist groß.'],
  ['Stuhl', 'der', 'Chair / कुर्सी', 'Der Stuhl ist bequem.'],
  ['Bett', 'das', 'Bed / खट', 'Das Bett ist weich.'],
  ['Sofa', 'das', 'Sofa / सोफा', 'Das Sofa ist rot.'],
  ['Schrank', 'der', 'Cabinet / अलमारी', 'Der Schrank ist voll.'],
  ['Lampe', 'die', 'Lamp / बत्ती', 'Die Lampe ist hell.'],
  ['Bild', 'das', 'Picture / तस्वीर', 'Das Bild ist schön.'],
  
  // FOOD & DRINK (28 items)
  ['Brot', 'das', 'Bread / ब्रेड', 'Das Brot ist frisch.'],
  ['Butter', 'die', 'Butter / मक्खन', 'Die Butter ist gelb.'],
  ['Käse', 'der', 'Cheese / पनीर', 'Der Käse ist lecker.'],
  ['Milch', 'die', 'Milk / दुध', 'Die Milch ist kalt.'],
  ['Kaffee', 'der', 'Coffee / कफी', 'Der Kaffee ist heiß.'],
  ['Tee', 'der', 'Tea / चिया', 'Der Tee ist warm.'],
  ['Wasser', 'das', 'Water / पानी', 'Das Wasser ist kalt.'],
  ['Saft', 'der', 'Juice / रस', 'Der Saft ist süß.'],
  ['Wein', 'der', 'Wine / वाइन', 'Der Wein ist rot.'],
  ['Bier', 'das', 'Beer / बियर', 'Das Bier ist kalt.'],
  ['Apfel', 'der', 'Apple / सेब', 'Der Apfel ist rot.'],
  ['Birne', 'die', 'Pear / नाशपाती', 'Die Birne ist grün.'],
  ['Banane', 'die', 'Banana / केला', 'Die Banane ist gelb.'],
  ['Orange', 'die', 'Orange / सुन्तला', 'Die Orange ist süß.'],
  ['Zitrone', 'die', 'Lemon / नींबू', 'Die Zitrone ist sauer.'],
  ['Erdbeere', 'die', 'Strawberry / स्ट्रबेरी', 'Die Erdbeere ist rot.'],
  ['Fleisch', 'das', 'Meat / माँस', 'Das Fleisch ist gut.'],
  ['Huhn', 'das', 'Chicken / कुखुरा', 'Das Huhn ist weiß.'],
  ['Fisch', 'der', 'Fish / माछ', 'Der Fisch ist lecker.'],
  ['Gemüse', 'das', 'Vegetables / सब्जी', 'Das Gemüse ist frisch.'],
  ['Kartoffel', 'die', 'Potato / आलु', 'Die Kartoffel ist braun.'],
  ['Tomate', 'die', 'Tomato / टमाटर', 'Die Tomate ist rot.'],
  ['Gurke', 'die', 'Cucumber / काकडी', 'Die Gurke ist grün.'],
  ['Salat', 'der', 'Salad / सलाद', 'Der Salat ist frisch.'],
  ['Suppe', 'die', 'Soup / सूप', 'Die Suppe ist heiष.'],
  ['Ei', 'das', 'Egg / अण्डा', 'Das Ei ist weiß.'],
  ['Zucker', 'der', 'Sugar / चिनी', 'Der Zucker ist süß.'],
  ['Obst', 'das', 'Fruit / फल', 'Das Obst ist süß.'],
  
  // ANIMALS (6 items)
  ['Hund', 'der', 'Dog / कुत्ता', 'Der Hund bellt.'],
  ['Katze', 'die', 'Cat / बिल्ली', 'Die Katze schläft.'],
  ['Vogel', 'der', 'Bird / पक्षी', 'Der Vogel singt.'],
  ['Pferd', 'das', 'Horse / घोडा', 'Das Pferd läuft.'],
  ['Kuh', 'die', 'Cow / गाई', 'Die Kuh moht.'],
  ['Schwein', 'das', 'Pig / सूर', 'Das Schwein ist rosa.'],
  
  // NATURE & WEATHER (18 items)
  ['Baum', 'der', 'Tree / पेड', 'Der Baum ist hoch.'],
  ['Blume', 'die', 'Flower / फूल', 'Die Blume ist schön.'],
  ['Gras', 'das', 'Grass / घाँस', 'Das Gras ist grün.'],
  ['Wald', 'der', 'Forest / जंगल', 'Der Wald ist dunkel.'],
  ['Berg', 'der', 'Mountain / पर्वत', 'Der Berg ist hoch.'],
  ['See', 'der', 'Lake / झील', 'Der See ist sauber.'],
  ['Fluss', 'der', 'River / नदी', 'Der Fluss ist lang.'],
  ['Strand', 'der', 'Beach / समुद्री किनार', 'Der Strand ist schön.'],
  ['Himmel', 'der', 'Sky / आकाश', 'Der Himmel ist blु.'],
  ['Sonne', 'die', 'Sun / सूरज', 'Die Sonne scheint.'],
  ['Mond', 'der', 'Moon / चाँद', 'Der Mond scheint nachts.'],
  ['Stern', 'der', 'Star / तारा', 'Der Stern leuchtet.'],
  ['Wolke', 'die', 'Cloud / बादल', 'Die Wolke zieht.'],
  ['Regen', 'der', 'Rain / बर्षा', 'Der Regen ist kalt.'],
  ['Schnee', 'der', 'Snow / हिमाल', 'Der Schnee ist weiष.'],
  ['Wind', 'der', 'Wind / हवा', 'Der Wind ist कूल.'],
  ['Wetter', 'das', 'Weather / मौसम', 'Das Wetter ist schön.'],
  ['Garten', 'der', 'Garden / बगैचा', 'Der Garten ist grün.'],
  
  // SCHOOL & EDUCATION (11 items)
  ['Schule', 'die', 'School / स्कूल', 'Die Schule ist groष.'],
  ['Klasse', 'die', 'Classroom / कक्षा', 'Die Klasse ist voll.'],
  ['Schulzimmer', 'das', 'Classroom / स्कूल कोठा', 'Das Schulzimmer ist hell.'],
  ['Schreibtisch', 'der', 'Desk / डेस्क', 'Der Schreibtisch ist sauber.'],
  ['Buch', 'das', 'Book / किताब', 'Das Buch ist neu.'],
  ['Heft', 'das', 'Notebook / नोटबुक', 'Das Heft ist groष.'],
  ['Stift', 'der', 'Pen / कलम', 'Der Stift schreibt gut.'],
  ['Bleistift', 'der', 'Pencil / पेन्सिल', 'Der Bleistift ist grau.'],
  ['Radiergummi', 'der', 'Eraser / इरेजर', 'Der Radiergummi ist weiष.'],
  ['Lineal', 'das', 'Ruler / स्केल', 'Das Lineal ist lang.'],
  ['Ranzen', 'der', 'Backpack / झोला', 'Der Ranzen ist नीलो.'],
  
  // CLOTHING (9 items)
  ['Kleid', 'das', 'Dress / लुगा', 'Das Kleid ist rot.'],
  ['Hemd', 'das', 'Shirt / कमीज', 'Das Hemd ist weiष.'],
  ['Hose', 'die', 'Pants / प्यान्ट', 'Die Hose ist नीलो.'],
  ['Jacke', 'die', 'Jacket / ज्याकेट', 'Die Jacke ist warm.'],
  ['Schuh', 'der', 'Shoe / जुत्ता', 'Der Schuh ist braun.'],
  ['Socke', 'die', 'Sock / मोजा', 'Die Socke ist dunkel.'],
  ['Hut', 'der', 'Hat / टोपी', 'Der Hut ist rot.'],
  ['Schal', 'der', 'Scarf / स्कार्फ', 'Der Schal ist lang.'],
  ['Handschuh', 'der', 'Glove / दस्ताना', 'Der Handschuh ist warm.'],
  
  // OBJECTS & ACCESSORIES (14 items)
  ['Tasche', 'die', 'Bag / झोला', 'Die Tasche ist schwer.'],
  ['Rucksack', 'der', 'Backpack / रक्सैक', 'Der Rucksack ist groष.'],
  ['Uhr', 'die', 'Clock/Watch / घडी', 'Die Uhr ist genau.'],
  ['Handy', 'das', 'Mobile phone / मोबाइल', 'Das Handy ist neu.'],
  ['Computer', 'der', 'Computer / कम्प्युटर', 'Der Computer ist schnेल.'],
  ['Telefon', 'das', 'Telephone / टेलिफोन', 'Das Telefon klingelt.'],
  ['Brille', 'die', 'Glasses / चश्मा', 'Die Brille ist neu.'],
  ['Schlüssel', 'der', 'Key / चाभी', 'Der Schlüssel ist hier.'],
  ['Münze', 'die', 'Coin / सिक्का', 'Die Münze ist klein.'],
  ['Geld', 'das', 'Money / पैसा', 'Das Geld liegt hier.'],
  ['Karte', 'die', 'Card / कार्ड', 'Die Karte ist महत्वपूर्ण.'],
  ['Brief', 'der', 'Letter / पत्र', 'Der Brief ist lang.'],
  ['Zeitung', 'die', 'Newspaper / अखबार', 'Die Zeitung ist alt.'],
  ['Magazin', 'das', 'Magazine / पत्रिका', 'Das Magazin ist interessant.'],
  
  // CITY & PLACES (20 items)
  ['Stadt', 'die', 'City / शहर', 'Die Stadt ist groष.'],
  ['Land', 'das', 'Country / देश', 'Das Land ist schön.'],
  ['Dorf', 'das', 'Village / गाँव', 'Das Dorf ist klein.'],
  ['Straße', 'die', 'Street / सडक', 'Die Straße ist lang.'],
  ['Platz', 'der', 'Square / चौपाल', 'Der Platz ist voll.'],
  ['Weg', 'der', 'Way / बाटो', 'Der Weg ist कम.'],
  ['Bahnhof', 'der', 'Train station / रेल स्टेशन', 'Der Bahnhof ist voll.'],
  ['Bushaltestelle', 'die', 'Bus stop / बस स्टप', 'Die Bushaltestelle ist hier.'],
  ['Restaurant', 'das', 'Restaurant / रेस्तोरा', 'Das Restaurant ist teuer.'],
  ['Café', 'das', 'Café / कफी हाउस', 'Das Café ist gemütlich.'],
  ['Geschäft', 'das', 'Shop / दुकान', 'Das Geschäft ist groष.'],
  ['Supermarkt', 'der', 'Supermarket / सुपरमार्केट', 'Der Supermarkt ist offen.'],
  ['Bank', 'die', 'Bank / बैंक', 'Die Bank ist geschlossen.'],
  ['Kirche', 'die', 'Church / चर्च', 'Die Kirche ist alt.'],
  ['Krankenhaus', 'das', 'Hospital / अस्पताल', 'Das Krankenhaus ist groष.'],
  ['Museum', 'das', 'Museum / म्यूजियम', 'Das Museum ist interessant.'],
  ['Park', 'der', 'Park / पार्क', 'Der Park ist schön.'],
  ['Hotel', 'das', 'Hotel / होटल', 'Das Hotel ist teuer.'],
  ['Büro', 'das', 'Office / कार्यालय', 'Das Büro ist modern.'],
  ['Fabrik', 'die', 'Factory / कारखाना', 'Die Fabrik ist groष.'],
  
  // TRANSPORT (8 items)
  ['Auto', 'das', 'Car / गाडी', 'Das Auto ist rot.'],
  ['Wagen', 'der', 'Car / गाडी', 'Der Wagen ist alt.'],
  ['Fahrrad', 'das', 'Bicycle / साइकिल', 'Das Fahrrad ist नीलो.'],
  ['Motorrad', 'das', 'Motorcycle / मोटरसाइकिल', 'Das Motorrad ist schnेल.'],
  ['Zug', 'der', 'Train / रेल', 'Der Zug kommt.'],
  ['Bus', 'der', 'Bus / बस', 'Der Bus ist voll.'],
  ['Flugzeug', 'das', 'Airplane / हवाइजहाज', 'Das Flugzeug ist schnेल.'],
  ['Schiff', 'das', 'Ship / जहाज', 'Das Schiff ist groष.'],
  
  // TIME (10 items)
  ['Minute', 'die', 'Minute / मिनेट', 'Die Minute ist कम.'],
  ['Stunde', 'die', 'Hour / घंटा', 'Die Stunde ist lang.'],
  ['Tag', 'der', 'Day / दिन', 'Der Tag ist schön.'],
  ['Woche', 'die', 'Week / हप्ता', 'Die Woche ist कम.'],
  ['Monat', 'der', 'Month / महीना', 'Der Monat ist lang.'],
  ['Jahr', 'das', 'Year / वर्ष', 'Das Jahr ist neu.'],
  ['Morgen', 'der', 'Morning / बिहान', 'Der Morgen ist früh.'],
  ['Mittag', 'der', 'Noon / दिउँसो', 'Der Mittag ist heiष.'],
  ['Abend', 'der', 'Evening / साँझ', 'Der Abend ist कूल.'],
  ['Nacht', 'die', 'Night / रात', 'Die Nacht ist dunkel.'],
  
  // COLORS (1 item)
  ['Farbe', 'die', 'Color / रंग', 'Die Farbe ist नीलो.'],

  // TIME & CLOCK (12 items) — tag 'time'
  ['Uhr', 'die', 'Clock / घडी', 'Die Uhr zeigt die Zeit.'],
  ['Uhrzeit', 'die', 'Time (of day) / समय', 'Die Uhrzeit ist wichtig.'],
  ['Viertel', 'das', 'Quarter / पाउ', 'Es ist Viertel nach acht.'],
  ['Halb', 'das', 'Half / आधा', 'Es ist halb neun.'],
  ['Stunde', 'die', 'Hour / घण्टा', 'Eine Stunde hat sechzig Minuten.'],
  ['Minute', 'die', 'Minute / मिनेट', 'Die Minute ist kurz.'],
  ['Sekunde', 'die', 'Second / सेकेन्ड', 'Eine Sekunde ist sehr kurz.'],
  ['Morgen', 'der', 'Morning / बिहान', 'Am Morgen trinke ich Kaffee.'],
  ['Mittag', 'der', 'Noon / दिउँसो', 'Am Mittag esse ich zu Mittag.'],
  ['Nachmittag', 'der', 'Afternoon / अपराह्न', 'Am Nachmittag arbeite ich.'],
  ['Abend', 'der', 'Evening / साँझ', 'Am Abend sehe ich fern.'],
  ['Nacht', 'die', 'Night / रात', 'In der Nacht schlafe ich.'],
];

/* ────────────────────────────────────────────────────────────
 * Dataset B — VERBS (45+ items)
 * [verb infinitive, meaning "EN / NP", example sentence]
 * ──────────────────────────────────────────────────────────── */

type VerbRow = [verb: string, meaning: string, sentence: string];

const VERBS: VerbRow[] = [
  // Regular verbs (weak)
  ['machen', 'make / गर्नु', 'Ich mache die Aufgabe.'],
  ['sagen', 'say / भन्नु', 'Sie sagt guten Tag.'],
  ['denken', 'think / सोच्नु', 'Ich denke an dich.'],
  ['fragen', 'ask / सोध्नु', 'Er fragt eine Frage.'],
  ['antworten', 'answer / जवाफ दिनु', 'Sie antwortet schnell.'],
  ['lernen', 'learn / सिक्नु', 'Wir lernen Deutsch.'],
  ['spielen', 'play / खेल्नु', 'Das Kind spielt im Park.'],
  ['arbeiten', 'work / काम गर्नु', 'Er arbeitet im Büro.'],
  ['wohnen', 'live / बस्नु', 'Sie wohnt in Berlin.'],
  ['zählen', 'count / गन्नु', 'Ich zähle von eins bis zehn.'],
  ['kochen', 'cook / पकाउनु', 'Die Mutter kocht Suppe.'],
  ['waschen', 'wash / धुनु', 'Ich wasche das Auto.'],
  ['kaufen', 'buy / किन्नु', 'Wir kaufen Brot.'],
  ['verkaufen', 'sell / बेच्नु', 'Der Geschäft verkauft Äpfel.'],
  ['suchen', 'search / खोज्नु', 'Ich suche meinen Schlüssel.'],
  ['finden', 'find / पाउनु', 'Wir finden das Buch.'],
  ['zeigen', 'show / देखाउनु', 'Er zeigt ein Bild.'],
  ['hören', 'hear / सुन्नु', 'Ich höre Musik.'],
  ['singen', 'sing / गाउनु', 'Der Vogel singt.'],
  ['tanzen', 'dance / नाच्नु', 'Die Mädchen tanzen.'],
  ['rennen', 'run / दौडनु', 'Der Junge rennt schnell.'],
  ['laufen', 'walk / हिँड्नु', 'Das Pferd läuft.'],
  ['gehen', 'go / जानु', 'Ich gehe zur Schule.'],
  ['kommen', 'come / आनु', 'Der Zug kommt.'],
  ['fahren', 'drive / गाडी चलाउनु', 'Sie fahrt mit dem Auto.'],
  
  // Irregular verbs (strong)
  ['sein', 'be / हुनु', 'Ich bin Student.'],
  ['haben', 'have / हुनु', 'Sie hat ein Handy.'],
  ['werden', 'become / हुनु', 'Ich werde Lehrer.'],
  ['müssen', 'must / पर्नु', 'Du musst aufstehen.'],
  ['können', 'can / सक्नु', 'Ich kann schwimmen.'],
  ['wollen', 'want / चाहनु', 'Er will spielen.'],
  ['sollen', 'should / गरु पर्नु', 'Ich soll aufstehen.'],
  ['dürfen', 'may / पाउनु', 'Darf ich fragen?'],
  ['mögen', 'like / मन पर्नु', 'Ich mag Schokolade.'],
  ['möchte', 'would like / चाहान्छु', 'Ich möchte Kaffee.'],
  ['lieben', 'love / प्रेम गर्नु', 'Ich liebe dich.'],
  ['hassen', 'hate / घृणा गर्नु', 'Ich hasse Wartezeit.'],
  ['sprechen', 'speak / कुरा गर्नु', 'Wir sprechen Deutsch.'],
  ['schreiben', 'write / लेख्नु', 'Ich schreibe einen Brief.'],
  ['lesen', 'read / पढ्नु', 'Sie liest ein Buch.'],
  ['verstehen', 'understand / बुझ्नु', 'Ich verstehe nicht.'],
  ['wissen', 'know / थाह्नु', 'Ich weiß nicht.'],
  ['essen', 'eat / खानु', 'Ich esse Brot.'],
  ['trinken', 'drink / पिउनु', 'Sie trinkt Kaffee.'],
  ['nehmen', 'take / लिनु', 'Ich nehme ein Buch.'],

  // ROUTINE & SEPARABLE VERBS (14 items) — tag 'routine'
  ['aufstehen', 'get up / उठ्नु', 'Ich stehe um sieben auf.'],
  ['aufwachen', 'wake up / ब्युँझनु', 'Ich wache früh auf.'],
  ['einkaufen', 'shop / किनमेल गर्नु', 'Wir kaufen am Samstag ein.'],
  ['anfangen', 'begin / सुरु गर्नु', 'Der Kurs fängt um neun an.'],
  ['mitkommen', 'come along / सँगै आउनु', 'Kommst du mit?'],
  ['fernsehen', 'watch TV / टिभी हेर्नु', 'Am Abend sehe ich fern.'],
  ['aufräumen', 'tidy up / सफा गर्नु', 'Ich räume das Zimmer auf.'],
  ['anrufen', 'call / फोन गर्नु', 'Ich rufe dich an.'],
  ['ausgehen', 'go out / बाहिर जानु', 'Wir gehen am Freitag aus.'],
  ['zurückkommen', 'come back / फर्कनु', 'Er kommt um sechs zurück.'],
  ['mitmachen', 'join in / सहभागी हुनु', 'Machst du mit?'],
  ['aufhören', 'stop / रोक्नु', 'Der Regen hört auf.'],
  ['anziehen', 'put on / लगाउनु', 'Ich ziehe die Jacke an.'],
  ['ausziehen', 'take off / फुकाल्नु', 'Er zieht die Schuhe aus.'],
];

/* ────────────────────────────────────────────────────────────
 * Dataset C — SENTENCES (40+ items)
 * Grammar focus: akkusativ, gender, verbs
 * ──────────────────────────────────────────────────────────── */

interface SentenceSeed {
  id: string;
  phrase_de: string;
  expected_array: string[];
  distractors_array: string[];
  grammar_focus: string;
  tags: string[];
}

const SENTENCES: SentenceSeed[] = [
  // Akkusativ (masculine definite article)
  {
    id: 'u2-sb-1',
    phrase_de: 'Ich sehe den Mann',
    expected_array: ['Ich', 'sehe', 'den', 'Mann'],
    distractors_array: ['der', 'dem', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles', 'masculine'],
  },
  {
    id: 'u2-sb-2',
    phrase_de: 'Ich kenne den Lehrer',
    expected_array: ['Ich', 'kenne', 'den', 'Lehrer'],
    distractors_array: ['der', 'dem', 'den'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-3',
    phrase_de: 'Sie nimmt den Stift',
    expected_array: ['Sie', 'nimmt', 'den', 'Stift'],
    distractors_array: ['der', 'dem', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-4',
    phrase_de: 'Ich habe einen Hund',
    expected_array: ['Ich', 'habe', 'einen', 'Hund'],
    distractors_array: ['ein', 'einen', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  
  // Akkusativ (feminine)
  {
    id: 'u2-sb-5',
    phrase_de: 'Ich sehe die Frau',
    expected_array: ['Ich', 'sehe', 'die', 'Frau'],
    distractors_array: ['der', 'das', 'eine'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles', 'feminine'],
  },
  {
    id: 'u2-sb-6',
    phrase_de: 'Sie nimmt eine Tasche',
    expected_array: ['Sie', 'nimmt', 'eine', 'Tasche'],
    distractors_array: ['ein', 'die', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-7',
    phrase_de: 'Ich hole die Katze',
    expected_array: ['Ich', 'hole', 'die', 'Katze'],
    distractors_array: ['der', 'das', 'eine'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  
  // Akkusativ (neuter)
  {
    id: 'u2-sb-8',
    phrase_de: 'Ich habe einen Tisch',
    expected_array: ['Ich', 'habe', 'einen', 'Tisch'],
    distractors_array: ['ein', 'eine', 'das'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-9',
    phrase_de: 'Er liest das Buch',
    expected_array: ['Er', 'liest', 'das', 'Buch'],
    distractors_array: ['den', 'der', 'Die'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles', 'neuter'],
  },
  {
    id: 'u2-sb-10',
    phrase_de: 'Sie nimmt das Kind',
    expected_array: ['Sie', 'nimmt', 'das', 'Kind'],
    distractors_array: ['den', 'dem', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-11',
    phrase_de: 'Ich trinke einen Kaffee',
    expected_array: ['Ich', 'trinke', 'einen', 'Kaffee'],
    distractors_array: ['ein', 'eine', 'Tee'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'articles'],
  },
  
  // Gender recognition (nominative)
  {
    id: 'u2-sb-12',
    phrase_de: 'Die Tasche ist schwer',
    expected_array: ['Die', 'Tasche', 'ist', 'schwer'],
    distractors_array: ['Der', 'Das', 'sind'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-13',
    phrase_de: 'Das Handy ist neu',
    expected_array: ['Das', 'Handy', 'ist', 'neu'],
    distractors_array: ['Der', 'Die', 'seid'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-14',
    phrase_de: 'Der Stuhl ist bequem',
    expected_array: ['Der', 'Stuhl', 'ist', 'bequem'],
    distractors_array: ['Die', 'Das', 'bin'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-15',
    phrase_de: 'Die Küche ist sauber',
    expected_array: ['Die', 'Küche', 'ist', 'sauber'],
    distractors_array: ['Der', 'Das', 'ist'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-16',
    phrase_de: 'Das Kind spielt heute',
    expected_array: ['Das', 'Kind', 'spielt', 'heute'],
    distractors_array: ['Den', 'Der', 'morgen'],
    grammar_focus: 'gender',
    tags: ['unit-2', 'articles'],
  },
  
  // Present tense verbs
  {
    id: 'u2-sb-17',
    phrase_de: 'Ich bin Lehrer',
    expected_array: ['Ich', 'bin', 'Lehrer'],
    distractors_array: ['bist', 'seid', 'ist'],
    grammar_focus: 'verbs',
    tags: ['unit-2', 'present'],
  },
  {
    id: 'u2-sb-18',
    phrase_de: 'Du bist Student',
    expected_array: ['Du', 'bist', 'Student'],
    distractors_array: ['bin', 'sind', 'seid'],
    grammar_focus: 'verbs',
    tags: ['unit-2', 'present'],
  },
  {
    id: 'u2-sb-19',
    phrase_de: 'Er hat ein Auto',
    expected_array: ['Er', 'hat', 'ein', 'Auto'],
    distractors_array: ['habe', 'habt', 'haben'],
    grammar_focus: 'verbs',
    tags: ['unit-2', 'present'],
  },
  {
    id: 'u2-sb-20',
    phrase_de: 'Wir spielen Fußball',
    expected_array: ['Wir', 'spielen', 'Fußball'],
    distractors_array: ['spielt', 'spiele', 'spielen'],
    grammar_focus: 'verbs',
    tags: ['unit-2', 'present'],
  },
  
  // Plural nominative
  {
    id: 'u2-sb-21',
    phrase_de: 'Die Bücher sind neu',
    expected_array: ['Die', 'Bücher', 'sind', 'neu'],
    distractors_array: ['Der', 'Das', 'ist'],
    grammar_focus: 'plural',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-22',
    phrase_de: 'Die Stühle sind alt',
    expected_array: ['Die', 'Stühle', 'sind', 'alt'],
    distractors_array: ['Der', 'Das', 'sein'],
    grammar_focus: 'plural',
    tags: ['unit-2', 'articles'],
  },
  
  // Dative (with prepositions)
  {
    id: 'u2-sb-23',
    phrase_de: 'Der Stift liegt auf dem Tisch',
    expected_array: ['Der', 'Stift', 'liegt', 'auf', 'dem', 'Tisch'],
    distractors_array: ['den', 'die', 'dem'],
    grammar_focus: 'dativ',
    tags: ['unit-2', 'prepositions'],
  },
  {
    id: 'u2-sb-24',
    phrase_de: 'Die Katze sitzt in der Küche',
    expected_array: ['Die', 'Katze', 'sitzt', 'in', 'der', 'Küche'],
    distractors_array: ['den', 'die', 'dem'],
    grammar_focus: 'dativ',
    tags: ['unit-2', 'prepositions'],
  },
  
  // Verb + Akkusativ combinations
  {
    id: 'u2-sb-25',
    phrase_de: 'Sie sieht den Vogel',
    expected_array: ['Sie', 'sieht', 'den', 'Vogel'],
    distractors_array: ['der', 'dem', 'sehen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-26',
    phrase_de: 'Ich höre die Musik',
    expected_array: ['Ich', 'höre', 'die', 'Musik'],
    distractors_array: ['der', 'das', 'hören'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-27',
    phrase_de: 'Wir besuchen das Museum',
    expected_array: ['Wir', 'besuchen', 'das', 'Museum'],
    distractors_array: ['den', 'der', 'besuchst'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-28',
    phrase_de: 'Ihr seht die Blume',
    expected_array: ['Ihr', 'seht', 'die', 'Blume'],
    distractors_array: ['der', 'das', 'sehen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  
  // Possessive articles
  {
    id: 'u2-sb-29',
    phrase_de: 'Mein Freund ist groß',
    expected_array: ['Mein', 'Freund', 'ist', 'groß'],
    distractors_array: ['Meiner', 'Meinen', 'Meine'],
    grammar_focus: 'possessive',
    tags: ['unit-2', 'articles'],
  },
  {
    id: 'u2-sb-30',
    phrase_de: 'Deine Schwester ist klein',
    expected_array: ['Deine', 'Schwester', 'ist', 'klein'],
    distractors_array: ['Deiner', 'Deinen', 'Dein'],
    grammar_focus: 'possessive',
    tags: ['unit-2', 'articles'],
  },
  
  // Negation
  {
    id: 'u2-sb-31',
    phrase_de: 'Der Wald ist nicht klein',
    expected_array: ['Der', 'Wald', 'ist', 'nicht', 'klein'],
    distractors_array: ['nie', 'kein', 'nichts'],
    grammar_focus: 'negation',
    tags: ['unit-2', 'grammar'],
  },
  {
    id: 'u2-sb-32',
    phrase_de: 'Ich bin kein Arzt',
    expected_array: ['Ich', 'bin', 'kein', 'Arzt'],
    distractors_array: ['nicht', 'keine', 'keinen'],
    grammar_focus: 'negation',
    tags: ['unit-2', 'grammar'],
  },
  
  // Adjectives
  {
    id: 'u2-sb-33',
    phrase_de: 'Das rote Auto ist schnell',
    expected_array: ['Das', 'rote', 'Auto', 'ist', 'schnell'],
    distractors_array: ['rot', 'roten', 'roter'],
    grammar_focus: 'adjectives',
    tags: ['unit-2', 'adjectives'],
  },
  {
    id: 'u2-sb-34',
    phrase_de: 'Die grüne Blume ist schön',
    expected_array: ['Die', 'grüne', 'Blume', 'ist', 'schön'],
    distractors_array: ['grün', 'grünen', 'grüner'],
    grammar_focus: 'adjectives',
    tags: ['unit-2', 'adjectives'],
  },
  
  // More diverse sentences
  {
    id: 'u2-sb-35',
    phrase_de: 'Sie schreiben einen Brief',
    expected_array: ['Sie', 'schreiben', 'einen', 'Brief'],
    distractors_array: ['den', 'der', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-36',
    phrase_de: 'Ich kenne die Stadt',
    expected_array: ['Ich', 'kenne', 'die', 'Stadt'],
    distractors_array: ['den', 'das', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-37',
    phrase_de: 'Der Freund bringt das Buch',
    expected_array: ['Der', 'Freund', 'bringt', 'das', 'Buch'],
    distractors_array: ['den', 'die', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-38',
    phrase_de: 'Wir öffnen das Fenster',
    expected_array: ['Wir', 'öffnen', 'das', 'Fenster'],
    distractors_array: ['den', 'der', 'die'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-39',
    phrase_de: 'Sie machen eine Frage',
    expected_array: ['Sie', 'machen', 'eine', 'Frage'],
    distractors_array: ['ein', 'den', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },
  {
    id: 'u2-sb-40',
    phrase_de: 'Ich trage einen Rucksack',
    expected_array: ['Ich', 'trage', 'einen', 'Rucksack'],
    distractors_array: ['ein', 'die', 'den'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs'],
  },

  // U5 — Akkusativ depth batch (18 items) — enriches the Sentence Builder pool.
  {
    id: 'u2-sb-41',
    phrase_de: 'Ich kaufe einen Apfel',
    expected_array: ['Ich', 'kaufe', 'einen', 'Apfel'],
    distractors_array: ['ein', 'eine', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-42',
    phrase_de: 'Er trinkt einen Saft',
    expected_array: ['Er', 'trinkt', 'einen', 'Saft'],
    distractors_array: ['ein', 'eine', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-43',
    phrase_de: 'Wir suchen den Schlüssel',
    expected_array: ['Wir', 'suchen', 'den', 'Schlüssel'],
    distractors_array: ['der', 'dem', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-44',
    phrase_de: 'Ich finde den Bahnhof',
    expected_array: ['Ich', 'finde', 'den', 'Bahnhof'],
    distractors_array: ['der', 'dem', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-45',
    phrase_de: 'Sie braucht eine Lampe',
    expected_array: ['Sie', 'braucht', 'eine', 'Lampe'],
    distractors_array: ['ein', 'den', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-46',
    phrase_de: 'Ich lese die Zeitung',
    expected_array: ['Ich', 'lese', 'die', 'Zeitung'],
    distractors_array: ['der', 'das', 'eine'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-47',
    phrase_de: 'Er kocht eine Suppe',
    expected_array: ['Er', 'kocht', 'eine', 'Suppe'],
    distractors_array: ['ein', 'den', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-48',
    phrase_de: 'Wir kaufen das Brot',
    expected_array: ['Wir', 'kaufen', 'das', 'Brot'],
    distractors_array: ['den', 'der', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-49',
    phrase_de: 'Ich wasche das Auto',
    expected_array: ['Ich', 'wasche', 'das', 'Auto'],
    distractors_array: ['den', 'der', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-50',
    phrase_de: 'Sie schließt das Fenster',
    expected_array: ['Sie', 'schließt', 'das', 'Fenster'],
    distractors_array: ['den', 'der', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-51',
    phrase_de: 'Ich sehe einen Film',
    expected_array: ['Ich', 'sehe', 'einen', 'Film'],
    distractors_array: ['ein', 'eine', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-52',
    phrase_de: 'Er hat einen Bruder',
    expected_array: ['Er', 'hat', 'einen', 'Bruder'],
    distractors_array: ['ein', 'eine', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-53',
    phrase_de: 'Wir besuchen die Oma',
    expected_array: ['Wir', 'besuchen', 'die', 'Oma'],
    distractors_array: ['der', 'das', 'eine'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-54',
    phrase_de: 'Ich rufe den Arzt',
    expected_array: ['Ich', 'rufe', 'den', 'Arzt'],
    distractors_array: ['der', 'dem', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-55',
    phrase_de: 'Sie nimmt den Bus',
    expected_array: ['Sie', 'nimmt', 'den', 'Bus'],
    distractors_array: ['der', 'dem', 'ein'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-56',
    phrase_de: 'Ich mag den Kaffee',
    expected_array: ['Ich', 'mag', 'den', 'Kaffee'],
    distractors_array: ['der', 'dem', 'einen'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-57',
    phrase_de: 'Wir öffnen die Tür',
    expected_array: ['Wir', 'öffnen', 'die', 'Tür'],
    distractors_array: ['der', 'das', 'eine'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
  {
    id: 'u2-sb-58',
    phrase_de: 'Er kauft einen Stuhl',
    expected_array: ['Er', 'kauft', 'einen', 'Stuhl'],
    distractors_array: ['ein', 'eine', 'der'],
    grammar_focus: 'akkusativ',
    tags: ['unit-2', 'verbs', 'akkusativ'],
  },
];

/* ────────────────────────────────────────────────────────────
 * Seeding
 * ──────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      '[seedCurriculum] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
        'The service-role key is required to bypass RLS for seeding. Never commit it.'
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Vocabulary (nouns with gender) — upsert on (word, part_of_speech).
  // Time/clock nouns get the 'time' tag; all others keep the article tags.
  // DEDUPE by word BEFORE upserting: Postgres rejects ON CONFLICT DO UPDATE
  // when one statement hits the same conflict key twice ("ON CONFLICT DO
  // UPDATE command cannot affect row a second time"). The TIME & CLOCK batch
  // intentionally refreshes some existing time nouns — last occurrence wins
  // so the newer example sentence + 'time' tag apply.
  const TIME_NOUNS = new Set([
    'Uhr', 'Uhrzeit', 'Viertel', 'Halb', 'Sekunde', 'Nachmittag',
    'Stunde', 'Minute', 'Morgen', 'Mittag', 'Abend', 'Nacht',
    'Tag', 'Woche', 'Monat', 'Jahr',
  ]);
const nounRows = Array.from(
    new Map(
      NOUNS.map(([noun, art, meaning, sentence]) => {
        const [en, np] = meaning.split('/').map((s) => s.trim());
        const tags = TIME_NOUNS.has(noun)
          ? ['unit-3', 'time', `gender-${art}`]
          : ['unit-2', 'articles', `gender-${art}`];
        const category = TIME_NOUNS.has(noun) ? 'time' : 'core';
        return [
          noun,
          {
            word: noun,
            article: art,
            part_of_speech: 'noun',
            translation_en: en || noun,
            translation_np: np || '',
            example_de: sentence,
            category,
            level: 'A1',
            tags,
          },
        ] as const;
      })
    ).values()
  );

  const { error: nounError } = await admin
    .from('vocabulary')
    .upsert(nounRows, { onConflict: 'word,part_of_speech' });

  if (nounError) {
    console.error('[seedCurriculum] nouns upsert failed:', nounError.message);
    process.exit(1);
  }
  console.log(`[seedCurriculum] vocabulary: ${nounRows.length} nouns upserted.`);

  // 2. Vocabulary (verbs) — upsert on (word, part_of_speech).
  // Separable/routine verbs get the 'routine' tag; all others keep 'verbs'.
  // Same dedupe-by-word guard as nouns (see above).
  const ROUTINE_VERBS = new Set([
    'aufstehen', 'aufwachen', 'einkaufen', 'anfangen', 'mitkommen',
    'fernsehen', 'aufräumen', 'anrufen', 'ausgehen', 'zurückkommen',
    'mitmachen', 'aufhören', 'anziehen', 'ausziehen',
  ]);
const verbRows = Array.from(
    new Map(
      VERBS.map(([verb, meaning, sentence]) => {
        const [en, np] = meaning.split('/').map((s) => s.trim());
        const tags = ROUTINE_VERBS.has(verb)
          ? ['unit-3', 'routine', 'separable']
          : ['unit-2', 'verbs'];
        const category = ROUTINE_VERBS.has(verb) ? 'routine' : 'core';
        return [
          verb,
          {
            word: verb,
            article: null,
            part_of_speech: 'verb',
            translation_en: en || verb,
            translation_np: np || '',
            example_de: sentence,
            category,
            level: 'A1',
            tags,
          },
        ] as const;
      })
    ).values()
  );

  const { error: verbError } = await admin
    .from('vocabulary')
    .upsert(verbRows, { onConflict: 'word,part_of_speech' });

  if (verbError) {
    console.error('[seedCurriculum] verbs upsert failed:', verbError.message);
    process.exit(1);
  }
  console.log(`[seedCurriculum] vocabulary: ${verbRows.length} verbs upserted.`);

  // 3. Sentences — upsert on id.
  const { error: sentError } = await admin.from('sentences').upsert(SENTENCES, {
    onConflict: 'id',
  });

  if (sentError) {
    console.error('[seedCurriculum] sentences upsert failed:', sentError.message);
    process.exit(1);
  }
  console.log(`[seedCurriculum] sentences: ${SENTENCES.length} exercises upserted.`);

  // 4. Smoke-test the randomized RPC endpoints. Pass all five params so the
  // call targets the (TEXT, TEXT, TEXT, TEXT, INT) overload unambiguously
  // (see supabase/migrations/019_drop_stale_get_random_vocabulary.sql).
  const { data: randVocab, error: rpcVocabErr } = await admin.rpc('get_random_vocabulary', {
    p_pos: 'noun',
    p_tag: null,
    p_level: null,
    p_category: null,
    p_limit: 15,
  });
  if (rpcVocabErr) {
    console.warn('[seedCurriculum] get_random_vocabulary smoke test failed:', rpcVocabErr.message);
  } else {
    console.log(`[seedCurriculum] get_random_vocabulary (nouns) returned ${randVocab?.length ?? 0} random rows.`);
  }

  const { data: randVerbs, error: rpcVerbErr } = await admin.rpc('get_random_vocabulary', {
    p_pos: 'verb',
    p_tag: null,
    p_level: null,
    p_category: null,
    p_limit: 10,
  });
  if (rpcVerbErr) {
    console.warn('[seedCurriculum] get_random_vocabulary (verbs) failed:', rpcVerbErr.message);
  } else {
    console.log(`[seedCurriculum] get_random_vocabulary (verbs) returned ${randVerbs?.length ?? 0} random rows.`);
  }

  const { data: randSent, error: rpcSentErr } = await admin.rpc('get_random_sentences', {
    p_limit: 10,
  });
  if (rpcSentErr) {
    console.warn('[seedCurriculum] get_random_sentences smoke test failed:', rpcSentErr.message);
  } else {
    console.log(`[seedCurriculum] get_random_sentences returned ${randSent?.length ?? 0} random rows.`);
  }

  console.log('[seedCurriculum] Done.');
}

void main();
