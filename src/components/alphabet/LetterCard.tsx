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
      className={`relative h-[230px] cursor-pointer [perspective:1200px] z-[1] hover:z-20 ${flipped ? 'z-20' : ''}`}
      onClick={flip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && flip()}
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 bg-white p-2.5 shadow dark:bg-slate-800 [backface-visibility:hidden] ${
            isSpecial
              ? 'border-amber-500 dark:border-amber-400'
              : 'border-slate-200 dark:border-slate-600 hover:border-blue-500'
          }`}
        >
          {practiced && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-green-500 px-1.5 text-[10px] font-semibold text-white">
              ✓
            </span>
          )}
          <span className="absolute right-2 top-2 rounded border border-slate-200 bg-slate-100 px-1 text-[10px] text-slate-400 dark:border-slate-500 dark:bg-slate-600">
            {item.id}
          </span>
          <div className="text-[2.5rem] font-bold leading-none text-blue-600 dark:text-blue-400">
            {item.letter}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {item.gerPhonetic}
          </div>
          {!isDE && <div className="mt-1 text-[10px] text-slate-400">Click to flip</div>}
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 flex h-full flex-col justify-between rounded-xl p-2.5 text-white shadow [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            isSpecial
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-700 dark:to-amber-900'
              : 'bg-blue-600'
          }`}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              {isDE ? 'Name' : 'German Name'}
            </div>
            <div className="text-lg font-bold">{item.gerPhonetic}</div>
          </div>

          <div className="my-1 grid grid-cols-2 gap-1 border-y border-white/20 py-1 text-left">
            {!isDE && (
              <>
                <div>
                  <div className="text-[9px] uppercase opacity-75">Native</div>
                  <div className="text-base font-bold text-yellow-100">{item.nepPhonetic}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase opacity-75">English</div>
                  <div className="text-sm font-semibold">{item.engPhonetic}</div>
                </div>
              </>
            )}
          </div>

          <div className="text-center">
            <div className="text-[9px] uppercase opacity-75">
              {isDE ? 'Beispiel' : 'Example'}:{' '}
              <span className="font-semibold normal-case">{item.example}</span>
            </div>
            <div className="text-[11px] leading-snug">
              {parts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="opacity-50"> + </span>}
                  <span
                    className={
                      p.highlight
                        ? 'rounded bg-yellow-300 px-0.5 font-bold text-blue-900'
                        : 'opacity-90'
                    }
                  >
                    {p.name}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex w-full gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="flex-1 rounded bg-white/25 py-1.5 text-[11px] font-medium hover:bg-white/40"
              onClick={() => speakLetter(item.speak)}
            >
              🔊 {isDE ? 'Buchstabe' : 'Letter'}
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-white/25 py-1.5 text-[11px] font-medium hover:bg-white/40"
              onClick={() => speakWord(item.speakWord)}
            >
              🔊 {isDE ? 'Wort' : 'Word'}
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-white/25 py-1.5 text-[11px] font-medium hover:bg-white/40"
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
