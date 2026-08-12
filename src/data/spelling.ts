import type { SpellingWord } from '../types';

export const spellingWords: Record<'easy' | 'medium', SpellingWord[]> = {
  easy: [
    { word: 'JA', meaning: 'Yes / हो', letters: ['J', 'A'] },
    { word: 'HAUS', meaning: 'House / घर', letters: ['H', 'A', 'U', 'S'] },
    { word: 'GUT', meaning: 'Good / राम्रो', letters: ['G', 'U', 'T'] },
    { word: 'TEE', meaning: 'Tea / चिया', letters: ['T', 'E', 'E'] },
    { word: 'UHR', meaning: 'Clock / घडी', letters: ['U', 'H', 'R'] },
    { word: 'NAME', meaning: 'Name / नाम', letters: ['N', 'A', 'M', 'E'] },
    { word: 'BUCH', meaning: 'Book / किताब', letters: ['B', 'U', 'C', 'H'] },
    { word: 'ZUG', meaning: 'Train / रेल', letters: ['Z', 'U', 'G'] },
    { word: 'AUTO', meaning: 'Car / गाडी', letters: ['A', 'U', 'T', 'O'] },
    { word: 'KIND', meaning: 'Child / बच्चा', letters: ['K', 'I', 'N', 'D'] },
  ],
  medium: [
    { word: 'WASSER', meaning: 'Water / पानी', letters: ['W', 'A', 'S', 'S', 'E', 'R'] },
    { word: 'VATER', meaning: 'Father / बुबा', letters: ['V', 'A', 'T', 'E', 'R'] },
    { word: 'MUTTER', meaning: 'Mother / आमा', letters: ['M', 'U', 'T', 'T', 'E', 'R'] },
    { word: 'SCHULE', meaning: 'School / स्कूल', letters: ['S', 'C', 'H', 'U', 'L', 'E'] },
    { word: 'FREUND', meaning: 'Friend / साथी', letters: ['F', 'R', 'E', 'U', 'N', 'D'] },
    { word: 'MORGEN', meaning: 'Morning / बिहान', letters: ['M', 'O', 'R', 'G', 'E', 'N'] },
    { word: 'NACHT', meaning: 'Night / रात', letters: ['N', 'A', 'C', 'H', 'T'] },
    { word: 'ARBEIT', meaning: 'Work / काम', letters: ['A', 'R', 'B', 'E', 'I', 'T'] },
  ],
};
