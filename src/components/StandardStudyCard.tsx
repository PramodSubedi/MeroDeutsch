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
 * Used by calendar, greetings, and other study modules.
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
      { color: 'bg-ink-300 dark:bg-ink-600', label: isDE ? 'Neu' : 'New' },
      { color: 'bg-danger-400 dark:bg-danger-600', label: isDE ? 'Lernen' : 'Learning' },
      { color: 'bg-warning-400 dark:bg-warning-600', label: isDE ? 'Review' : 'Review' },
      { color: 'bg-accent-400 dark:bg-accent-600', label: isDE ? 'Vertraut' : 'Familiar' },
      { color: 'bg-success-500 dark:bg-success-600', label: isDE ? 'Gemeistert' : 'Mastered' },
    ];
    
    return levels[level] || levels[0];
  };

  const masteryInfo = getMasteryInfo(masteryLevel);

  return (
    <div className="group relative flex h-full min-h-[180px] flex-col rounded-lg border border-ink-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-ink-900 dark:border-ink-800 sm:p-5">
      {/* Mastery level indicator (bottom progress bar) */}
      {masteryInfo && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-[22px] bg-ink-100 dark:bg-ink-800">
          <div
            className={`h-full transition-all duration-500 ${masteryInfo.color}`}
            // Clamp to 0–100% so out-of-range mastery levels can't overflow the bar.
            style={{ width: `${Math.min(100, Math.max(0, ((masteryLevel ?? 0) + 1) * 20))}%` }}
            title={masteryInfo.label}
          />
        </div>
      )}
      {/* Top row: Badge + Audio Button */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent-50 text-body font-bold text-accent-600 dark:bg-accent-900/30 dark:text-accent-400">
          {badge}
        </div>
        <AudioButton word={german} />
      </div>

      {/* Vertical content stack */}
      <div className="flex flex-1 flex-col items-start gap-2 text-left">
        {/* 1. Primary German term */}
        <div className="text-2xl font-bold leading-tight text-accent-600 dark:text-accent-400">
          {german}
        </div>

        {/* 2. Phonetic guide */}
        {phonetic && (
          <div className="text-body text-ink-500 dark:text-ink-400">
            {phonetic}
          </div>
        )}

        {/* 3. Bilingual translation */}
        {showTranslations && (
          <div className="text-body text-ink-600 dark:text-ink-300">
            {nepali && english ? `${nepali} · ${english}` : nepali || english}
          </div>
        )}

        {/* 4. Context badge */}
        {contextNote && (
          <div className="mt-auto inline-flex items-center justify-center rounded-full bg-ink-100 px-3 py-1 text-meta font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-400">
            {contextNote}
          </div>
        )}
      </div>
    </div>
  );
}
