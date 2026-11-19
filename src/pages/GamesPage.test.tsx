import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { GamesPage } from './GamesPage';

vi.unmock('react-router-dom');
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ langMode: 'english' }) }));
vi.mock('../components/games/ConjugationTicTacToe', () => ({ ConjugationTicTacToe: () => <>Conjugation board</> }));
vi.mock('../components/games/NumberCypher', () => ({ NumberCypher: () => <>Arithmetic puzzle</> }));
vi.mock('../components/games/VerbDice', () => ({ VerbDice: () => <>Verb dice exercise</> }));

function Navigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Go back</button>;
}

it('restores the selected game when navigating back within the page', () => {
  render(
    <MemoryRouter initialEntries={['/games?game=cypher']}>
      <Navigation />
      <GamesPage />
    </MemoryRouter>,
  );

  expect(screen.getByText('Arithmetic puzzle')).toBeVisible();
  fireEvent.click(screen.getByText('Verb Dice'));
  expect(screen.getByText('Verb dice exercise')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(screen.getByText('Arithmetic puzzle')).toBeVisible();
});
