import { useEffect, useState } from 'react';
import { sharedTextDatabase } from '../data/sharedContent';
import { useLang } from '../hooks/useLang';
import { FlipCard } from '../components/FlipCard';
import { SectionGrid } from '../components/SectionGrid';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { CalendarItem } from '../types';

export function CalendarPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [tab, setTab] = useState<'days' | 'months'>('days');
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);

  useEffect(() => {
    curriculumService.getCalendar().then(setCalendar);
  }, []);

  const data = tab === 'days' ? calendar.slice(0, 7) : calendar.slice(7);

  const title = isDE ? 'Tage & Monate' : sharedTextDatabase.calendar.title;
  const description = isDE
    ? 'Lerne die Wochentage und Monate'
    : sharedTextDatabase.calendar.description;

  return (
    <SectionGrid
      title={title}
      description={description}
      controls={
        <>
          <button
            type="button"
            onClick={() => setTab('days')}
            className={tab === 'days' ? theme.button.toggleActive : theme.button.toggleInactive}
          >
            {isDE ? 'Wochentage' : 'Days of the Week'}
          </button>
          <button
            type="button"
            onClick={() => setTab('months')}
            className={tab === 'months' ? theme.button.toggleActive : theme.button.toggleInactive}
          >
            {isDE ? 'Monate' : 'Months'}
          </button>
        </>
      }
    >
      {data.map((item, index) => (
        <FlipCard
          key={item.de}
          badge={index + 1}
          front={item.de}
          back={isDE ? undefined : `${item.en} · ${item.ne}`}
          langMode={langMode}
        />
      ))}
    </SectionGrid>
  );
}