/**
 * src/pages/GamesPage.tsx
 *
 * German Games hub — one route (/games) hosting ALL practice minigames
 * behind a tab switch:
 *   - Conjugation Tic-Tac-Toe   (claim cells by conjugating A1_VERBS)
 *   - Mystery Code Cracker      (German arithmetic → hidden word)
 *   - Verb-Dice Challenge       (Würfelspiel — conjugate within 10s)
 *   - Odd-One-Out               (phonetic + family-pronoun trap detectors)
 *
 * Deep-linkable via ?game=… (the /learn spine bonus chips point here).
 * Guests welcome — all games are purely local practice feeding the shared
 * XP/SRS pipeline (useAnswerReporter).
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Dices, Gamepad2, Puzzle } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { PageHeading } from '../components/common/PageHeading';
import { TabGroup } from '../components/TabGroup';
import { theme } from '../config/theme';
import { ConjugationTicTacToe } from '../components/games/ConjugationTicTacToe';
import { NumberCypher } from '../components/games/NumberCypher';
import { VerbDice } from '../components/games/VerbDice';
import { OddOneOut } from '../components/games/OddOneOut';
import { ODD_ONE_OUT_SETS } from '../data/a1ResourcePack';

type GameTab = 'tictactoe' | 'cypher' | 'dice' | 'oddoneout';

const GAME_IDS: readonly string[] = ['tictactoe', 'cypher', 'dice', 'oddoneout'];

export function GamesPage() {
  usePageTitle('Games');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<GameTab>(() => {
    const param = searchParams.get('game');
    return (GAME_IDS as readonly string[]).includes(param ?? '')
      ? (param as GameTab)
      : 'tictactoe';
  });

  return (
    <div className={theme.page.container}>
      <PageHeading
        title={isDE ? 'Deutsche Spiele' : 'German Games'}
        subtitle={
          isDE
            ? 'Konjugieren, rechnen, hören und gewinnen — Übung im Spielformat.'
            : 'Conjugate, calculate, listen and win — practice disguised as play.'
        }
      />
      <div className="mt-4">
        <TabGroup
          tabs={[
            { id: 'tictactoe', label: isDE ? 'Tic-Tac-Toe' : 'Tic-Tac-Toe', icon: Gamepad2 },
            { id: 'cypher', label: isDE ? 'Code knacken' : 'Code Cracker', icon: Calculator },
            { id: 'dice', label: isDE ? 'Würfelspiel' : 'Verb Dice', icon: Dices },
            { id: 'oddoneout', label: isDE ? 'Odd-One-Out' : 'Odd One Out', icon: Puzzle },
          ]}
          activeTab={tab}
          onTabChange={(t) => {
            const safe = t as string;
            setTab((GAME_IDS as readonly string[]).includes(safe) ? (safe as GameTab) : 'tictactoe');
          }}
        />
      </div>
      {tab === 'tictactoe' && <ConjugationTicTacToe />}
      {tab === 'cypher' && <NumberCypher />}
      {tab === 'dice' && <VerbDice />}
      {tab === 'oddoneout' && (
        <div className="space-y-6">
          {/* Both data-driven trap sets (U1 phonetic + U5 family pronouns). */}
          {ODD_ONE_OUT_SETS.map((set) => (
            <OddOneOut key={set.id} set={set} module={set.id === 'phonetic' ? 'phonetic-traps' : 'pronoun-traps'} />
          ))}
        </div>
      )}
    </div>
  );
}