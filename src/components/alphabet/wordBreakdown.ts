/** Letter-name breakdown for example words — edit phonetics mapping only here */
const charToPhonetic: Record<string, string> = {
  A: 'Ah', Ä: 'Ä', B: 'Be', C: 'Ce', D: 'De', E: 'E', F: 'Eff', G: 'Ge',
  H: 'Ha', I: 'I', J: 'Jot', K: 'Ka', L: 'Ell', M: 'Emm', N: 'Enn', O: 'O',
  Ö: 'Ö', P: 'Pe', Q: 'Ku', R: 'Err', S: 'Ess', T: 'Te', U: 'U', Ü: 'Ü',
  V: 'Fau', W: 'We', X: 'Iks', Y: 'Ypsilon', Z: 'Zett', ß: 'Eszett',
};

const highlightCharMap: Record<string, string> = {
  A: 'A', Ae: 'Ä', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'H',
  I: 'I', J: 'J', K: 'K', L: 'L', M: 'M', N: 'N', O: 'O', Oe: 'Ö', P: 'P',
  Q: 'Q', R: 'R', S: 'S', T: 'T', U: 'U', Ue: 'Ü', V: 'V', W: 'W', X: 'X',
  Y: 'Y', Z: 'Z', Sz: 'ß',
};

export function getWordBreakdownParts(word: string, highlightId: string) {
  const highlightChar = highlightCharMap[highlightId] || highlightId;
  return word.split('').map((ch) => {
    let c = ch;
    if (ch === 'ä' || ch === 'Ä') c = 'Ä';
    else if (ch === 'ö' || ch === 'Ö') c = 'Ö';
    else if (ch === 'ü' || ch === 'Ü') c = 'Ü';
    else if (ch === 'ß') c = 'ß';
    else c = ch.toUpperCase();
    return {
      name: charToPhonetic[c] || c,
      highlight: c === highlightChar,
    };
  });
}
