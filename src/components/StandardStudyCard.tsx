import { AudioButton } from './AudioButton';

interface StandardStudyCardProps {
  /** Numeric badge (e.g., 1, 2, 3) */
  badge: string | number;
  /** Primary German term (bold, blue) */
  german: string;
  /** Phonetic/transliteration guide */
  phonetic?: string;
  /** Nepali translation */
  nepali?: string;
  /** English translation */
  english?: string;
  /** Optional context badge at bottom */
  contextNote?: string;
  /** Language mode for conditional rendering */
  langMode: 'normal' | 'german';
  /** SRS mastery level (0-4): 0=New, 1=Learning, 2=Review, 3=Familiar, 4=Mastered */
  masteryLevel?: number;
}

/**
 * Universal StandardStudyCard with vertical stacked design.
 * Replaces minimal horizontal FlipCard for calendar, greetings, and other modules.
 * 
 * Layout (top to bottom):
 * 1. Badge (top-left) + AudioButton (top-right)
 * 2. Primary German term (bold, blue, prominent)
 * 3. Phonetic guide (small, gray)
 * 4. Bilingual translation: "Nepali · English"
 * 5. Optional context badge
 */
export function StandardStudyCard({
  badge,
  german,
  phonetic,
  nepali,
  english,
  contextNote,
  langMode,
  masteryLevel,
}: StandardStudyCardProps) {
  const isDE = langMode === 'german';
  const showTranslations = !isDE && (nepali || english);

  // Get mastery indicator color and label
  const getMasteryInfo = (level?: number) => {
    if (level === undefined) return null;
    
    const levels = [
      { color: 'bg-slate-300 dark:bg-slate-600', label: isDE ? 'Neu' : 'New' },
      { color: 'bg-red-400 dark:bg-red-600', label: isDE ? 'Lernen' : 'Learning' },
      { color: 'bg-amber-400 dark:bg-amber-600', label: isDE ? 'Review' : 'Review' },
      { color: 'bg-blue-400 dark:bg-blue-600', label: isDE ? 'Vertraut' : 'Familiar' },
      { color: 'bg-emerald-500 dark:bg-emerald-600', label: isDE ? 'Gemeistert' : 'Mastered' },
    ];
    
    return levels[level] || levels[0];
  };

  const masteryInfo = getMasteryInfo(masteryLevel);

  return (
    <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500">
      {/* Mastery level indicator (bottom progress bar) */}
      {masteryInfo && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl bg-slate-100 dark:bg-slate-800">
          <div 
            className={`h-full transition-all duration-500 ${masteryInfo.color}`}
            style={{ width: `${((masteryLevel ?? 0) + 1) * 20}%` }}
            title={masteryInfo.label}
          />
        </div>
      )}
      {/* Top row: Badge + Audio Button */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {badge}
        </div>
        <AudioButton word={german} />
      </div>

      {/* Vertical content stack */}
      <div className="flex flex-col gap-2 text-center">
        {/* 1. Primary German term */}
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {german}
        </div>

        {/* 2. Phonetic guide */}
        {phonetic && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {phonetic}
          </div>
        )}

        {/* 3. Bilingual translation */}
        {showTranslations && (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {nepali && english ? `${nepali} · ${english}` : nepali || english}
          </div>
        )}

        {/* 4. Context badge */}
        {contextNote && (
          <div className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {contextNote}
          </div>
        )}
      </div>
    </div>
  );
}
