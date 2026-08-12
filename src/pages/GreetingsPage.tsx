import { useEffect, useState } from 'react';
import { sharedTextDatabase } from '../data/sharedContent';
import { useLang } from '../hooks/useLang';
import { FlipCard } from '../components/FlipCard';
import { SectionGrid } from '../components/SectionGrid';
import { curriculumService } from '../services';
import type { GreetingItem } from '../types/curriculum';

export function GreetingsPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [greetings, setGreetings] = useState<GreetingItem[]>([]);

  useEffect(() => {
    curriculumService.getGreetings().then(setGreetings);
  }, []);

  const title = isDE ? 'Begrüßungen' : sharedTextDatabase.greetings.title;
  const description = isDE
    ? 'Lerne gängige deutsche Begrüßungen'
    : sharedTextDatabase.greetings.description;

  return (
    <SectionGrid
      title={title}
      description={description}
    >
      {greetings.map((item, index) => (
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
