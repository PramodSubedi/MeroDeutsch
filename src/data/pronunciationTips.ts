export interface PronunciationTip {
  en: string;
  ne: string;
}

/** Tips for tricky German sounds — keyed by alphabet item id. */
export const pronunciationTips: Record<string, PronunciationTip> = {
  Ae: {
    en: 'Like the "e" in "bed", but with lips spread wide. Say "eh" with a smile.',
    ne: 'अंग्रेजीको "bed" को "e" जस्तै, तर ओठ फराकिलो पारेर। "ए" भन्नुहोस्।',
  },
  Oe: {
    en: 'Round your lips like "o", then say "e". Like the French "eu".',
    ne: 'ओठलाई "ओ" जस्तै गोलो पारेर "ए" भन्नुहोस्। फ्रेन्च "eu" जस्तै।',
  },
  Ue: {
    en: 'Round your lips like "u", then say "ee". Like the French "u".',
    ne: 'ओठलाई "उ" जस्तै गोलो पारेर "ई" भन्नुहोस्। फ्रेन्च "u" जस्तै।',
  },
  Sz: {
    en: 'A sharp "s" sound, like "ss" in "hiss". Never a "z" sound.',
    ne: 'तीखो "स" ध्वनि, अंग्रेजीको "hiss" को "ss" जस्तै। कहिल्यै "ज" जस्तो होइन।',
  },
  R: {
    en: 'A soft rolled "r" at the back of the throat, or a light tap like Spanish "r".',
    ne: 'घाँटीको पछाडिबाट हल्का गड्गडाउने "र", वा स्पेनिस "r" जस्तै हल्का ट्याप।',
  },
  Z: {
    en: 'Say "ts" together, like "ts" in "cats". Not a "z" sound.',
    ne: '"ts" सँगै भन्नुहोस्, अंग्रेजीको "cats" को "ts" जस्तै। "ज" ध्वनि होइन।',
  },
  C: {
    en: 'Before e/i: "ts". Otherwise like "k".',
    ne: '"e" वा "i" अघि: "ts"। अन्यथा "k" जस्तै।',
  },
  V: {
    en: 'Usually pronounced like "f" in German words.',
    ne: 'जर्मन शब्दहरूमा प्रायः "f" जस्तै उच्चारण हुन्छ।',
  },
  W: {
    en: 'Like English "v" — lips touch the teeth.',
    ne: 'अंग्रेजीको "v" जस्तै — ओठ दाँतमा छुन्छन्।',
  },
  J: {
    en: 'Like English "y" in "yes".',
    ne: 'अंग्रेजीको "yes" को "y" जस्तै।',
  },
  S: {
    en: 'Before a vowel: like "z". Otherwise: like "s".',
    ne: 'स्वर अघि: "z" जस्तै। अन्यथा: "s" जस्तै।',
  },
  H: {
    en: 'A breathy "h", like English "h" in "hat".',
    ne: 'सास फेर्ने "h", अंग्रेजीको "hat" को "h" जस्तै।',
  },
};