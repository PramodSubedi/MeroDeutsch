import { useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { microStories, type MicroStory, type StorySentence, type StoryWord } from '../data/stories';

/**
 * Interactive word tooltip component
 * Shows Nepali and English translations on hover/tap
 */
function WordTooltip({ word }: { word: StoryWord }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-dotted underline-offset-2 transition-colors"
        aria-label={`${word.de}: ${word.ne} (${word.en})`}
      >
        {word.de}
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-max max-w-xs rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-xl dark:bg-slate-700 pointer-events-none">
          <div className="font-bold text-blue-300">{word.de}</div>
          <div className="mt-1 text-slate-200">{word.ne}</div>
          <div className="text-slate-300">{word.en}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Sentence component with interactive word tooltips and audio playback
 */
function SentenceCard({ sentence }: { sentence: StorySentence }) {
  const playAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentence.de);
      utterance.lang = 'de-DE';
      utterance.rate = 0.9; // Slightly slower for learning
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          {/* German text with interactive words */}
          <p className="text-lg leading-relaxed text-slate-900 dark:text-slate-100">
            {sentence.words.map((word, idx) => (
              <span key={idx}>
                {idx > 0 && ' '}
                <WordTooltip word={word} />
                {/* Add punctuation if the original sentence has it */}
                {sentence.de.includes(word.de + '.') && '.'}
                {sentence.de.includes(word.de + ',') && ','}
                {sentence.de.includes(word.de + '!') && '!'}
                {sentence.de.includes(word.de + '?') && '?'}
              </span>
            ))}
          </p>
          {/* Nepali translation */}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {sentence.ne}
          </p>
          {/* English translation */}
          <p className="text-xs text-slate-500 dark:text-slate-500">
            {sentence.en}
          </p>
        </div>
        {/* Audio button */}
        <button
          type="button"
          onClick={playAudio}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          aria-label={`Play audio: ${sentence.de}`}
        >
          <span aria-hidden="true">🔊</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Story card component
 */
function StoryCard({ story, onSelect }: { story: MicroStory; onSelect: () => void }) {
  const { langMode } = useLang();

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {story.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {langMode === 'german' ? story.titleNe : story.titleEn}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {story.level}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-500">
              {story.sentences.length} {story.sentences.length === 1 ? 'sentence' : 'sentences'}
            </span>
          </div>
        </div>
        <div className="text-2xl">📖</div>
      </div>
    </button>
  );
}

/**
 * Micro-Stories Page - Interactive German stories with word-level translations
 */
export function StoriesPage() {
  usePageTitle('Stories');
  const { langMode } = useLang();
  const [selectedStory, setSelectedStory] = useState<MicroStory | null>(null);

  const handleBackToList = () => {
    setSelectedStory(null);
  };

  return (
    <div className={theme.page.container}>
      <div className={theme.section.surface}>
        {!selectedStory ? (
          // Story selection view
          <>
            <h1 className={theme.section.title}>
              {langMode === 'german' ? 'Mikrogeschichten' : 'Micro-Stories'}
            </h1>
            <p className={theme.section.description}>
              {langMode === 'german'
                ? 'Kurze Geschichten auf A1-Niveau mit interaktiven Wortübersetzungen'
                : 'Short A1-level German stories with interactive word translations'}
            </p>
            
            <div className={theme.panel.info}>
              <p className="text-sm">
                💡 <strong>{langMode === 'german' ? 'Tipp:' : 'Tip:'}</strong>{' '}
                {langMode === 'german'
                  ? 'Klicken oder bewegen Sie die Maus über deutsche Wörter, um Übersetzungen anzuzeigen'
                  : 'Click or hover over German words to see translations'}
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {microStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onSelect={() => setSelectedStory(story)}
                />
              ))}
            </div>
          </>
        ) : (
          // Story reading view
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={handleBackToList}
                className={theme.button.secondary}
              >
                ← {langMode === 'german' ? 'Zurück zur Liste' : 'Back to list'}
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedStory.title}
                  </h1>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    {langMode === 'german' ? selectedStory.titleNe : selectedStory.titleEn}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {selectedStory.level}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {selectedStory.sentences.map((sentence) => (
                <SentenceCard key={sentence.id} sentence={sentence} />
              ))}
            </div>

            <div className={theme.panel.tip + ' mt-6'}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>📚 {langMode === 'german' ? 'Lerntipp:' : 'Study Tip:'}</strong>{' '}
                {langMode === 'german'
                  ? 'Lesen Sie die Geschichte mehrmals. Hören Sie sich jeden Satz an und wiederholen Sie laut.'
                  : 'Read the story multiple times. Listen to each sentence and repeat aloud.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
