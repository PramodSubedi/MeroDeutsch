import { useState } from 'react';
import type { AlphabetItem, LangMode } from '../../types';
import { speakLetter, speakWord } from '../../hooks/useSpeech';
import { getWordBreakdownParts } from './wordBreakdown';

interface Props {
  item: AlphabetItem;
  practiced: boolean;
  langMode: LangMode;
  onPracticed: (id: string) => void;
  onOpenDetail: (item: AlphabetItem) => void;
}

/** Single flip card — edit card UI only here */
export function LetterCard({ item, practiced, langMode, onPracticed, onOpenDetail }: Props) {
  const [flipped, setFlipped] = useState(false);
  const isSpecial = item.category === 'special';
  const isDE = langMode === 'german';

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    if (next) {
      speakLetter(item.speak);
      onPracticed(item.id);
    }
  };

  const parts = getWordBreakdownParts(item.example, item.id);

  return (
    <div
      className={`relative h-[160px] cursor-pointer rounded-md [perspective:1200px] z-[1] hover:z-20 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 ${flipped ? 'z-20' : ''}`}
      onClick={flip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && flip()}
    >
      <div
        className={`relative h-full w-full transition-transform duration-400 [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-md border-2 bg-white p-1.5 shadow dark:bg-ink-800 [backface-visibility:hidden] ${
            isSpecial
              ? 'border-warning-500 dark:border-warning-400'
              : 'border-ink-200 dark:border-ink-600 hover:border-accent-500'
          }`}
        >
          {practiced && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-success-500 px-1.5 text-[9px] font-semibold text-white">
              ✓
            </span>
          )}
          <span className="absolute right-2 top-2 rounded-sm border border-ink-200 bg-ink-100 px-1 text-[9px] text-ink-500 dark:border-ink-500 dark:bg-ink-600">
            {item.id}
          </span>
          <div className="text-[2rem] font-bold leading-none text-accent-600 dark:text-accent-400">
            {item.letter}
          </div>
          <div className="mt-0.5 text-body font-semibold text-ink-700 dark:text-ink-200">
            {item.gerPhonetic}
          </div>
          {!isDE && <div className="mt-0.5 text-[9px] text-ink-500">Tap to flip</div>}
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 flex h-full flex-col justify-between rounded-md p-1.5 text-white shadow [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            isSpecial
              ? 'bg-gradient-to-br from-warning-500 to-warning-700 dark:from-warning-700 dark:to-warning-900'
              : 'bg-accent-600'}
          `}
        >
          <div>
            <div className="text-[9px] uppercase tracking-wider opacity-80">
              {isDE ? 'Name' : 'German Name'}
            </div>
            <div className="text-body font-bold">{item.gerPhonetic}</div>
          </div>

          <div className="my-0.5 grid grid-cols-2 gap-1 border-y border-white/20 py-0.5 text-left">
            {!isDE && (
              <>
                <div>
                  <div className="text-[8px] uppercase opacity-75">Native</div>
                  <div className="text-body font-bold text-warning-100">{item.nepPhonetic}</div>
                </div>
                <div>
                  <div className="text-[8px] uppercase opacity-75">English</div>
                  <div className="text-meta font-semibold">{item.engPhonetic}</div>
                </div>
              </>
            )}
          </div>

          <div className="text-center">
            <div className="text-[8px] uppercase opacity-75">
              {isDE ? 'Beispiel' : 'Example'}:{' '}
              <span className="font-semibold normal-case">{item.example}</span>
            </div>
            <div className="text-[9px] leading-snug">
              {parts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="opacity-50"> + </span>}
                  <span
                    className={
                      p.highlight
                        ? 'rounded-sm bg-warning-300 px-0.5 font-bold text-accent-900'
                        : 'opacity-90'
                    }
                  >
                    {p.name}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-1 flex w-full gap-1">
            <button
              type="button"
              className="flex-1 rounded-sm bg-white/25 py-1.5 min-h-[40px] text-meta font-medium hover:bg-white/40"
              onClick={() => speakLetter(item.speak)}
            >
              🔊 {isDE ? 'Buchstabe' : 'Letter'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-sm bg-white/25 py-1.5 min-h-[40px] text-meta font-medium hover:bg-white/40"
              onClick={() => speakWord(item.speakWord)}
            >
              🔊 {isDE ? 'Wort' : 'Word'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-sm bg-white/25 py-1.5 min-h-[40px] text-meta font-medium hover:bg-white/40"
              onClick={() => onOpenDetail(item)}
            >
              {isDE ? 'Mehr' : 'More'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}