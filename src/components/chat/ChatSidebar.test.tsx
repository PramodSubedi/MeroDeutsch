import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ContextSnapshot } from '../../types/chatbot';
import { useChatStore } from '../../lib/chatStore';
import { ChatSidebar } from './ChatSidebar';

vi.unmock('react-router-dom');
vi.mock('../../lib/db', () => ({ db: null }));
vi.mock('../../hooks/useChatbotTriggers', () => ({ useChatbotTriggers: () => {} }));
const { reportAnswer } = vi.hoisted(() => ({ reportAnswer: vi.fn() }));
vi.mock('../../hooks/useExerciseSession', () => ({ useAnswerReporter: () => reportAnswer }));
vi.mock('./ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { content: string } }) => <p>{message.content}</p>,
}));

const snapshot: ContextSnapshot = {
  userName: null,
  isAuthenticated: false,
  isDE: false,
  currentPathname: '/practice',
  currentModuleLabel: null,
  xp: { totalXp: 0, level: 1, rank: '', xpToNextLevel: 0, xpProgress: 0 },
  streak: { current: 0, longest: 0 },
  review: { total: 0, due: 0, recent: [] },
  skills: [],
  weakestSkill: null,
  weakItems: [],
  a1: {
    unitIndex: 0, unitTitle: 'Greetings', unitTitleDE: 'Begrüßungen',
    unlockedUnitIndex: 0, completedCount: 0, totalLearnNodes: 0,
    checkpointBest: {}, passedCheckpoints: 0, pushNode: null,
  },
  cefr: 'a1',
};

vi.mock('../../context/LearningContext', () => ({
  useLearningContext: () => ({ snapshot, navigateTo: vi.fn() }),
}));

beforeEach(() => {
  reportAnswer.mockClear();
  snapshot.weakItems = [];
  useChatStore.setState({ open: true, quiz: null, isBusy: false, messages: [], adminEnabled: true, mode: 'coach' });
});

it('plays a full three-question round without vocabulary storage and counts the final answer', async () => {
  render(<MemoryRouter initialEntries={['/practice']}><ChatSidebar /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Play with Mero' }));
  await screen.findByText('Question 1/3');

  for (let index = 0; index < 3; index++) {
    const question = useChatStore.getState().activeQuestion();
    expect(question).not.toBeNull();
    const button = screen.getByRole('button', { name: question!.correct });
    expect(button).toBeEnabled();
    fireEvent.click(button);
  }

  expect(screen.getByText(/Round complete — 3\/3 correct/)).toBeVisible();
  expect(reportAnswer).toHaveBeenCalledTimes(3);
  expect(useChatStore.getState().activeQuestion()).toBeNull();
  expect(screen.getByRole('button', { name: 'Play with Mero' })).toBeEnabled();
});

it('reacts when the learner pets Mero', () => {
  render(<MemoryRouter initialEntries={['/practice']}><ChatSidebar /></MemoryRouter>);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Pet Mero' })));
  expect(screen.getByText(/ruffled my feathers/)).toBeVisible();
  expect(useChatStore.getState().mood).toBe('happy');
});

it('turns a past article mistake into a fresh question and records a new miss once', async () => {
  snapshot.weakItems = [{
    itemKey: 'hund',
    moduleType: 'articles',
    errorCount: 3,
    correctAnswer: 'der Hund',
    userAnswer: 'die Hund',
  }];
  render(<MemoryRouter initialEntries={['/practice']}><ChatSidebar /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Play with Mero' }));
  expect(await screen.findByText('From your mistakes')).toBeVisible();
  expect(screen.getByText('Welcher Artikel passt zu „Hund“?')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Hear the question' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'die Hund' }));
  expect(reportAnswer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    correct: false, itemKey: 'hund', correctAnswer: 'der Hund',
  }));
  expect(screen.getByText('Question 2/3')).toBeVisible();
});
