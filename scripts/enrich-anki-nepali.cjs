const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join('scripts', 'anki-gothe-parsed.json');
const OUTPUT_FILE = path.join('scripts', 'anki-gothe-enriched.json');

const NEpaliDict = {
  'sein': { ne: 'हो', roman: 'ho' },
  'haben': { ne: 'हुनु', roman: 'hunu' },
  'gut': { ne: 'राम्रो', roman: 'ramro' },
  'haus': { ne: 'घर', roman: 'ghar' },
  'apfel': { ne: 'आँगूर', roman: 'aangu' },
  'buch': { ne: 'किताब', roman: 'kitab' },
  'wasser': { ne: 'पानी', roman: 'pani' },
  'essen': { ne: 'खाना', roman: 'khana' },
  'trinken': { ne: 'पिउनु', roman: 'piunu' },
  'schlafen': { ne: 'सुत्नु', roman: 'sutnu' },
  'laufen': { ne: 'दौड्नु', roman: 'daudnu' },
  'sprechen': { ne: 'बोल्नु', roman: 'bolnu' },
  'verstehen': { ne: 'बुझ्नु', roman: 'bujhnu' },
  'lesen': { ne: 'पढ्नु', roman: 'padhnu' },
  'schreiben': { ne: 'लेख्नु', roman: 'lekhnu' },
  'lernen': { ne: 'सिक्नु', roman: 'siknu' },
  'arbeiten': { ne: 'काम गर्नु', roman: 'kam garnu' },
  'kommen': { ne: 'आउनु', roman: 'aunu' },
  'gehen': { ne: 'जानु', roman: 'jaanu' },
  'warten': { ne: 'पर्खनु', roman: 'parkhanu' },
  'suchen': { ne: 'खोज्नु', roman: 'khojnu' },
  'finden': { ne: 'पाउनु', roman: 'paaunu' },
  'nehmen': { ne: 'लिनु', roman: 'linu' },
  'geben': { ne: 'दिनु', roman: 'dinu' },
  'helfen': { ne: 'मदत गर्नु', roman: 'madat garnu' },
  'kaufen': { ne: 'किन्नु', roman: 'kinnu' },
  'bezahlen': { ne: 'भुक्तानी गर्नु', roman: 'bhuktaani garnu' },
  'auto': { ne: 'गाडी', roman: 'gaadi' },
  'bus': { ne: 'बस', roman: 'bas' },
  'zug': { ne: 'रेल', roman: 'rel' },
  'fahrrad': { ne: 'साइकल', roman: 'saikal' },
  'flugzeug': { ne: 'हवाइ जहाज', roman: 'hawaai jahaaj' },
  'hotel': { ne: 'होटेल', roman: 'hotel' },
  'restaurant': { ne: 'रेस्टुरेन्ट', roman: 'restaurant' },
  'stadt': { ne: 'शहर', roman: 'sahar' },
  'land': { ne: 'देश', roman: 'desh' },
  'strasse': { ne: 'सडक', roman: 'sadak' },
  'bahnsteig': { ne: 'प्लेटफर्म', roman: 'platform' },
  'bahnhof': { ne: 'रेलवे स्टेशन', roman: 'railway station' },
  'ticket': { ne: 'टिकट', roman: 'ticket' },
  'karte': { ne: 'मानचित्र', roman: 'manchitra' },
  'geld': { ne: 'पैसा', roman: 'paisa' },
  'zeit': { ne: 'समय', roman: 'samay' },
  'tag': { ne: 'दिन', roman: 'din' },
  'nacht': { ne: 'रात', roman: 'raat' },
  'morgen': { ne: 'बिहान', roman: 'bihan' },
  'abend': { ne: 'बेलुकी', roman: 'beluki' },
  'woche': { ne: 'हप्ता', roman: 'hapta' },
  'monat': { ne: 'महिना', roman: 'mahina' },
  'jahr': { ne: 'बर्ष', roman: 'barsha' },
  'freund': { ne: 'साथी', roman: 'saathi' },
  'frau': { ne: 'स्त्री', roman: 'stri' },
  'mann': { ne: 'पुरुष', roman: 'purush' },
  'kind': { ne: 'बालक', roman: 'baalak' },
  'mutter': { ne: 'आमा', roman: 'aama' },
  'vater': { ne: 'बुबा', roman: 'buba' },
  'eltern': { ne: 'अभिभावक', roman: 'abhhibhaawak' },
  'hund': { ne: 'कुकुर', roman: 'kukur' },
  'katze': { ne: 'बिरालो', roman: 'biralo' },
  'blume': { ne: 'फूल', roman: 'phool' },
  'baum': { ne: 'रूख', roman: 'rukh' },
  'sonne': { ne: 'सूर्य', roman: 'surya' },
  'mond': { ne: 'चन्द्रमा', roman: 'chandrama' },
  'regen': { ne: 'वर्षा', roman: 'barsha' },
  'schnee': { ne: 'बर्फ', roman: 'barf' },
  'wind': { ne: 'हावा', roman: 'hawa' },
  'wasser': { ne: 'पानी', roman: 'pani' },
  'feuer': { ne: 'आगो', roman: 'aago' },
  'essen': { ne: 'खाना', roman: 'khana' },
  'trinken': { ne: 'पिउनु', roman: 'piunu' },
  'kaffee': { ne: 'कफी', roman: 'kafi' },
  'tee': { ne: 'चिया', roman: 'chiya' },
  'brot': { ne: 'रोटी', roman: 'roti' },
  'fleisch': { ne: 'मासु', roman: 'masu' },
  'gemüse': { ne: 'तरकारी', roman: 'tarkaari' },
  'fisch': { ne: 'माछा', roman: 'macha' },
  'apotheke': { ne: 'अस्पताल', roman: 'aspatal' },
  'arzt': { ne: 'डाक्टर', roman: 'doctor' },
  'krankenhaus': { ne: 'अस्पताल', roman: 'aspatal' },
  'medikament': { ne: 'औषधि', roman: 'ausadhi' },
  'krank': { ne: 'बिरामी', roman: 'birami' },
  'fieber': { ne: 'ज्वरो', roman: 'jwaro' },
  'schmerz': { ne: 'दुःख', roman: 'dukha' },
  'kopfschmerz': { ne: 'टाउको दुखाइ', roman: 'tauko dukhai' },
  'danke': { ne: 'धन्यवाद', roman: 'dhanyabaad' },
  'bitte': { ne: 'कृपया', roman: 'kripaya' },
  'ja': { ne: 'हो', roman: 'ho' },
  'nein': { ne: 'होइन', roman: 'hoina' },
  'hallo': { ne: 'नमस्कार', roman: 'namaskaar' },
  'tschüss': { ne: 'बाइ', roman: 'bai' },
  'entschuldigung': { ne: 'माफ गर्नुहोस्', roman: 'maaf garnuhos' },
  'wo': { ne: 'कहाँ', roman: 'kahan' },
  'wann': { ne: 'कब', roman: 'kab' },
  'wie': { ne: 'कसरी', roman: 'kasari' },
  'was': { ne: 'के', roman: 'ke' },
  'wer': { ne: 'को', roman: 'ko' },
  'warum': { ne: 'किन', roman: 'kin' },
  'wie viel': { ne: 'कति', roman: 'kati' },
  'gut': { ne: 'राम्रो', roman: 'ramro' },
  'schlecht': { ne: 'खराब', roman: 'kharab' },
  'gross': { ne: 'ठूलो', roman: 'thulo' },
  'klein': { ne: 'सानो', roman: 'sano' },
  'alt': { ne: 'पुरानो', roman: 'purano' },
  'neu': { ne: 'नयाँ', roman: 'naya' },
  'heiss': { ne: 'तातो', roman: 'tato' },
  'kalt': { ne: 'चिसो', roman: 'chiso' },
  'schnell': { ne: 'छिटो', roman: 'chhito' },
  'langsam': { ne: 'बिस्तारै', roman: 'bistare' },
  'schön': { ne: 'सुन्दर', roman: 'sundar' },
  'hässlich': { ne: 'कुरूप', roman: 'kurup' },
  'reich': { ne: 'धनी', roman: 'dhani' },
  'arm': { ne: 'गरिब', roman: 'garib' },
  'leicht': { ne: 'हलुका', roman: 'haluka' },
  'schwer': { ne: 'भारी', roman: 'bhari' },
  'hell': { ne: 'उज्यालो', roman: 'ujyalo' },
  'dunkel': { ne: 'अन्धकार', roman: 'andhakaar' },
  'offen': { ne: 'खुला', roman: 'khula' },
  'geschlossen': { ne: 'बन्द', roman: 'banda' },
  'richtig': { ne: 'सही', roman: 'sahi' },
  'falsch': { ne: 'गलत', roman: 'galat' },
  'warm': { ne: 'गर्म', roman: 'garm' },
  'kühl': { ne: 'चिसो', roman: 'chiso' },
  'trocken': { ne: 'सुख्खा', roman: 'sukhkha' },
  'nass': { ne: 'भिजेको', roman: 'bhijeko' },
  'voll': { ne: 'भरियो', roman: 'bhariyo' },
  'leer': { ne: 'खाली', roman: 'khaali' },
  'still': { ne: 'शान्त', roman: 'shaanta' },
  'laut': { ne: 'तोड़ी', roman: 'todi' },
  'fertig': { ne: 'तयार', roman: 'tayar' },
  'pleite': { ne: 'दिवालिया', roman: 'divaliya' },
  'gesund': { ne: 'स्वस्थ', roman: 'swasth' },
  'krank': { ne: 'बिरामी', roman: 'birami' },
  'hungrig': { ne: 'भोको', roman: 'bhoko' },
  'durstig': { ne: 'तिर्खा', roman: 'tirkha' },
  'müde': { ne: 'थाकेको', roman: 'thakeko' },
  'wach': { ne: 'जागेको', roman: 'jaageko' },
  'glücklich': { ne: 'खुसी', roman: 'khusi' },
  'traurig': { ne: 'दुःखी', roman: 'dukhi' },
  'wütend': { ne: 'रिसाएको', roman: 'risaeko' },
  'ängstlich': { ne: 'डराउने', roman: 'daraune' },
  'müde': { ne: 'थाकेको', roman: 'thakeko' },
  'aufgeregt': { ne: 'उत्साहित', roman: 'utsahit' },
  'überrascht': { ne: 'आश्चर्य', roman: 'aashcharya' },
  'verwirrt': { ne: 'भ्रमित', roman: 'bhramit' },
  'sicher': { ne: 'सुरक्षित', roman: 'surakshit' },
  'unsicher': { ne: 'असुरक्षित', roman: 'asurakshit' },
  'möglich': { ne: 'सम्भव', roman: 'sambhav' },
  'unmöglich': { ne: 'असम्भव', roman: 'asambhav' },
  'nötig': { ne: 'आवश्यक', roman: 'aavashyak' },
  'unnötig': { ne: 'अनावश्यक', roman: 'anaavashyak' },
  'billig': { ne: 'सस्तो', roman: 'sasto' },
  'teuer': { ne: 'महँगो', roman: 'mahango' },
  'einfach': { ne: 'सजिलो', roman: 'sajilo' },
  'schwer': { ne: 'कठिन', roman: 'kathin' },
  'interessant': { ne: 'रोचक', roman: 'rochak' },
  'langweilig': { ne: 'बोरिंग', roman: 'boring' },
  'wichtig': { ne: 'महत्त्वपूर्ण', roman: 'mahattvapurna' },
  'unwichtig': { ne: 'महत्त्वहीन', roman: 'mahattvahin' },
  'normal': { ne: 'सामान्य', roman: 'saamany' },
  'komisch': { ne: 'रमाइलो', roman: 'ramailo' },
  'ernst': { ne: 'गम्भीर', roman: 'gambhir' },
  'ruhig': { ne: 'शान्त', roman: 'shaanta' },
  'laut': { ne: 'तोड़ी', roman: 'todi' },
  'fleißig': { ne: 'परिश्रमी', roman: 'parishrami' },
  'faul': { ne: 'आलसी', roman: 'aalsi' },
  'klug': { ne: 'बुद्धिमान', roman: 'buddhimaan' },
  'dumm': { ne: 'मूर्ख', roman: 'murkha' },
  'schwach': { ne: 'कमजोर', roman: 'kamjor' },
  'stark': { ne: 'बलियो', roman: 'baliyo' },
  'jung': { ne: 'युवा', roman: 'yuva' },
  'alt': { ne: 'पुरानो', roman: 'purano' },
  'arm': { ne: 'गरिब', roman: 'garib' },
  'reich': { ne: 'धनी', roman: 'dhani' },
  'allein': { ne: 'एक्लो', roman: 'eklo' },
  'zusammen': { ne: 'एकत्र', roman: 'ekatra' },
  'anders': { ne: 'फरक', roman: 'farak' },
  'gleich': { ne: 'उस्तै', roman: 'ustai' },
  'links': { ne: 'बायाँ', roman: 'baya' },
  'rechts': { ne: 'दायाँ', roman: 'daya' },
  'oben': { ne: 'माथि', roman: 'maathi' },
  'unten': { ne: 'तल', roman: 'tal' },
  'vorne': { ne: 'अगाडि', roman: 'agaadi' },
  'hinten': { ne: 'पछाडि', roman: 'pachhadi' },
  'draussen': { ne: 'बाहिर', roman: 'bahir' },
  'drinnen': { ne: 'भित्र', roman: 'bhitra' },
  'heute': { ne: 'आज', roman: 'aaja' },
  'gestern': { ne: 'हिजो', roman: 'hijo' },
  'morgen': { ne: 'भोलि', roman: 'boli' },
  'jetzt': { ne: 'अब', roman: 'aba' },
  'später': { ne: 'पछि', roman: 'pachi' },
  'bald': { ne: 'चाँडै', roman: 'chandai' },
  'nie': { ne: 'कहिले पनि', roman: 'kahile pani' },
  'immer': { ne: 'सधैं', roman: 'sadhai' },
  'oft': { ne: 'अक्सर', roman: 'aksar' },
  'manchmal': { ne: 'कहिलेकाहीं', roman: 'kahilekahin' },
  'sehr': { ne: 'धेरै', roman: 'dherai' },
  'ein bisschen': { ne: 'अलि', roman: 'ali' },
  'viel': { ne: 'धेरै', roman: 'dherai' },
  'wenig': { ne: 'थोरै', roman: 'thorai' },
  'alle': { ne: 'सबै', roman: 'sabai' },
  'kein': { ne: 'कुनै पनि होइन', roman: 'kunai pani hoina' },
  'jemand': { ne: 'कुनै व्यक्ति', roman: 'kunai vyakti' },
  'niemand': { ne: 'कुनै पनि होइन', roman: 'kunai pani hoina' },
  'etwas': { ne: 'केही', roman: 'kehi' },
  'nichts': { ne: 'केही पनि होइन', roman: 'kehi pani hoina' },
  'alles': { ne: 'सबै', roman: 'sabai' },
  'hier': { ne: 'यहाँ', roman: 'yaha' },
  'da': { ne: 'त्यहाँ', roman: 'tyaha' },
  'dort': { ne: 'त्यहाँ', roman: 'tyaha' },
  'woher': { ne: 'कहाँ बाट', roman: 'kahan baat' },
  'wohin': { ne: 'कहाँ जान', roman: 'kahan jaan' },
  'von': { ne: 'बाट', roman: 'baat' },
  'nach': { ne: 'अगाडि', roman: 'agaadi' },
  'zu': { ne: 'मा', roman: 'ma' },
  'mit': { ne: 'सँग', roman: 'sanga' },
  'für': { ne: 'लागि', roman: 'laagi' },
  'gegen': { ne: 'विरुद्ध', roman: 'biruddha' },
  'ohne': { ne: 'बिना', roman: 'bina' },
  'um': { ne: 'चारै पटक', roman: 'charaai patak' },
  'am': { ne: 'मा', roman: 'ma' },
  'im': { ne: 'भित्र', roman: 'bhitra' },
  'ins': { ne: 'भित्र', roman: 'bhitra' },
  'an': { ne: 'मा', roman: 'ma' },
  'auf': { ne: 'माथि', roman: 'maathi' },
  'aus': { ne: 'बाट', roman: 'baat' },
  'ein': { ne: 'एक', roman: 'ek' },
  'die': { ne: 'उन', roman: 'una' },
  'der': { ne: 'उहाँ', roman: 'uhan' },
  'das': { ne: 'त्यो', roman: 'tyo' },
  'und': { ne: 'र', roman: 'ra' },
  'oder': { ne: 'वा', roman: 'wa' },
  'aber': { ne: 'तर', roman: 'tara' },
  'weil': { ne: 'किनकि', roman: 'kinaki' },
  'denn': { ne: 'किनकि', roman: 'kinaki' },
  'wenn': { ne: 'यदि', roman: 'yadi' },
  'dass': { ne: 'भन्ने', roman: 'bhanne' },
  'bis': { ne: 'सम्म', roman: 'samma' },
  'seit': { ne: 'देखी', roman: 'dekhi' },
  'während': { ne: 'जबकि', roman: 'jabaki' },
  'trotzdem': { ne: 'तापनि', roman: 'taapani' },
  'deshalb': { ne: 'त्यसैले', roman: 'tyasaile' },
  'deshalb': { ne: 'त्यसैले', roman: 'tyasaile' }
};

function transliterateToDevanagari(word) {
  let result = word.toLowerCase();
  result = result.replace(/ä/g, 'ए');
  result = result.replace(/ö/g, 'ओ');
  result = result.replace(/ü/g, 'उ');
  result = result.replace(/ß/g, 'ss');
  result = result.replace(/sch/g, 'श');
  result = result.replace(/ch/g, 'च');
  result = result.replace(/ei/g, 'आइ');
  result = result.replace(/eu/g, 'ओइ');
  result = result.replace(/ie/g, 'ई');
  result = result.replace(/z/g, 'ज');
  result = result.replace(/x/g, 'क्स');
  result = result.replace(/v/g, 'भ');
  result = result.replace(/w/g, 'भ');
  result = result.replace(/c/g, 'क');
  result = result.replace(/j/g, 'ज');
  result = result.replace(/y/g, 'य');
  result = result.replace(/k/g, 'क');
  result = result.replace(/q/g, 'क्यू');
  result = result.replace(/ph/g, 'फ');
  result = result.replace(/th/g, 'थ');
  result = result.replace(/dh/g, 'ध');
  result = result.replace(/bh/g, 'भ');
  result = result.replace(/sh/g, 'श');
  result = result.replace(/nh/g, 'न');
  result = result.replace(/ng/g, 'ङ');
  result = result.replace(/tz/g, 'त्स');
  result = result.replace(/ck/g, 'क');
  result = result.replace(/mm/g, 'म');
  result = result.replace(/nn/g, 'न');
  result = result.replace(/ll/g, 'ल');
  result = result.replace(/rr/g, 'र');
  result = result.replace(/ss/g, 'स');
  result = result.replace(/ff/g, 'फ');
  result = result.replace(/tt/g, 'ट');
  result = result.replace(/pp/g, 'प');
  result = result.replace(/bb/g, 'ब');
  result = result.replace(/dd/g, 'ड');
  result = result.replace(/gg/g, 'ग');
  result = result.replace(/aa/g, 'आ');
  result = result.replace(/ee/g, 'ई');
  result = result.replace(/oo/g, 'ऊ');
  result = result.replace(/a/g, 'अ');
  result = result.replace(/b/g, 'ब');
  result = result.replace(/c/g, 'क');
  result = result.replace(/d/g, 'ड');
  result = result.replace(/e/g, 'ए');
  result = result.replace(/f/g, 'फ');
  result = result.replace(/g/g, 'ग');
  result = result.replace(/h/g, 'ह');
  result = result.replace(/i/g, 'इ');
  result = result.replace(/j/g, 'ज');
  result = result.replace(/k/g, 'क');
  result = result.replace(/l/g, 'ल');
  result = result.replace(/m/g, 'म');
  result = result.replace(/n/g, 'न');
  result = result.replace(/o/g, 'ओ');
  result = result.replace(/p/g, 'प');
  result = result.replace(/r/g, 'र');
  result = result.replace(/s/g, 'स');
  result = result.replace(/t/g, 'ट');
  result = result.replace(/u/g, 'उ');
  result = result.replace(/v/g, 'भ');
  result = result.replace(/w/g, 'भ');
  result = result.replace(/x/g, 'क्स');
  result = result.replace(/y/g, 'य');
  result = result.replace(/z/g, 'ज');
  return result;
}

function translateToNepali(lemma, partOfSpeech) {
  const key = lemma.toLowerCase();
  
  if (NEpaliDict[key]) {
    return NEpaliDict[key];
  }
  
  const devanagari = transliterateToDevanagari(lemma);
  const roman = lemma.toLowerCase();
  
  return {
    ne: devanagari,
    roman: roman
  };
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Enriching ${entries.length} Anki entries with rule-based Nepali translations...`);

  const enriched = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const translation = translateToNepali(entry.lemma, entry.partOfSpeech);
    
    enriched.push({
      ...entry,
      translationNe: translation.ne,
      translationNeRoman: translation.roman
    });

    if ((i + 1) % 100 === 0) {
      console.log(`   Processed ${i + 1}/${entries.length}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2), 'utf-8');

  console.log('\nEnrichment complete');
  console.log('Total entries:', enriched.length);
  console.log('Output:', OUTPUT_FILE);
}

main();
