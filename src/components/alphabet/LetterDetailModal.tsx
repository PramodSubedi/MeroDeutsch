import type { AlphabetItem, LangMode } from '../../types';
import { speakLetter, speakWord } from '../../hooks/useSpeech';
import { pronunciationTips } from '../../data/pronunciationTips';
import { theme } from '../../config/theme';

interface Props {
  item: AlphabetItem | null;
  langMode: LangMode;
  onClose: () => void;
}

export function LetterDetailModal({ item, langMode, onClose }: Props) {
  if (!item) return null;
  const isDE = langMode === 'german';

  return (
    <div className={theme.modal.overlay} onClick={onClose}>
      <div className={theme.modal.dialog} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={theme.modal.close}
          onClick={onClose}
        >
          ×
        </button>
        <div className="text-center">
          <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">{item.letter}</div>
          <div className="mb-3 text-xl font-semibold">{item.gerPhonetic}</div>
          {!isDE && (
            <div className="mb-3 rounded-lg bg-slate-100 p-3 text-left text-sm dark:bg-slate-700">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-500">Native</span>
                  <div className="font-bold">{item.nepPhonetic}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">English</span>
                  <div className="font-bold">{item.engPhonetic}</div>
                </div>
              </div>
            </div>
          )}
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-left dark:border-blue-800 dark:bg-blue-900/30">
            <div className="mb-1 text-xs font-bold text-blue-500">{isDE ? 'Beispiel' : 'Example'}</div>
            <div className="font-bold">{isDE ? item.example : item.exampleFull}</div>
          </div>
          {pronunciationTips[item.id] && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-800 dark:bg-amber-900/30">
              <div className="mb-1 text-xs font-bold text-amber-600 dark:text-amber-400">💡 {isDE ? 'Aussprache-Tipp' : 'Pronunciation Tip'}</div>
              <div className="text-sm">
                {isDE ? pronunciationTips[item.id].ne : pronunciationTips[item.id].en}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white"
              onClick={() => speakLetter(item.speak)}
            >
              🔊 {isDE ? 'Buchstabe' : 'Letter'}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white"
              onClick={() => speakWord(item.speakWord)}
            >
              🔊 {isDE ? 'Wort' : 'Word'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
