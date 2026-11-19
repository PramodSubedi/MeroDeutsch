import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SentenceBuilderPage } from './SentenceBuilderPage';

const { getSentences } = vi.hoisted(() => ({ getSentences: vi.fn() }));
vi.mock('../services', () => ({ curriculumService: { getSentences } }));
vi.mock('../hooks/useLang', () => ({ useLang: () => ({ langMode: 'english' }) }));
vi.mock('../components/common/SEO', () => ({ SEO: () => null }));
vi.mock('../components/exercises/SentenceBuilder', () => ({
  SentenceBuilder: ({ items }: { items: unknown[] }) => <p>Playable exercises: {items.length}</p>,
}));

it('renders playable fallback exercises when the sentence pool request fails', async () => {
  getSentences.mockRejectedValue(new Error('Network unavailable'));
  render(<MemoryRouter><SentenceBuilderPage /></MemoryRouter>);
  expect(await screen.findByText(/^Playable exercises: [1-9]/)).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('fallback exercises');
});
