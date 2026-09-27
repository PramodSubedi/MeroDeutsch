/**
 * src/admin/pages/VocabularyPage.tsx
 *
 * Browse, filter and export the app's vocabulary. Read-only, virtualized.
 *
 * ── WHY EXPORT EXISTS BUT IMPORT DOES NOT ──────────────────────────────────
 * Export is a pure client-side transform of data already loaded, so it works
 * today and needs no new authority. Import would write to `vocabulary`, whose
 * INSERT/UPDATE/DELETE are revoked from `anon` AND `authenticated` — the table
 * is public-READ by design so the Glossary works before sign-in. Shipping an
 * import button that cannot succeed would be worse than not shipping it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import { Download, RefreshCw, Search } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { fetchVocabulary, toCsv, type VocabRow, type VocabSource } from '../data/vocabulary';

const ROW_HEIGHT = 48;
const GRID = 'grid grid-cols-[minmax(10rem,1.5fr)_5rem_5rem_4rem_minmax(9rem,1.2fr)_minmax(9rem,1.2fr)] gap-3';

/** A missing value is a dash, never an empty cell that reads as "blank data". */
function Cell({ value }: { value: string | null }) {
  if (value === null || value === '') {
    return <span className="text-ink-300 dark:text-ink-600">—</span>;
  }
  return <span>{value}</span>;
}

/** German article + word, coloured by the locked gender tokens. */
function Word({ row }: { row: VocabRow }) {
  const tone =
    row.article === 'der'
      ? 'text-accent-600 dark:text-accent-400'
      : row.article === 'das'
        ? 'text-success-600 dark:text-success-500'
        : row.article === 'die'
          ? 'text-[#e11d48] dark:text-[#fb7185]'
          : 'text-ink-700 dark:text-ink-200';
  return (
    <span className="truncate font-semibold">
      {row.article && <span className={`mr-1 ${tone}`}>{row.article}</span>}
      {row.word}
    </span>
  );
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="min-h-[36px] max-w-[12rem] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ErrorsPanel({ errors }: { errors: string[] }) {
  return (
    <div
      className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
      role="status"
    >
      <p className="font-semibold">Some sources could not be read</p>
      <ul className="mt-1 list-inside list-disc text-meta">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function FilterBar({
  search,
  onSearch,
  source,
  onSource,
  counts,
  level,
  onLevel,
  pos,
  onPos,
  tag,
  onTag,
  facets,
  shown,
  total,
}: {
  search: string;
  onSearch: (v: string) => void;
  source: string;
  onSource: (v: string) => void;
  counts: { total: number; dict: number; items: number };
  level: string;
  onLevel: (v: string) => void;
  pos: string;
  onPos: (v: string) => void;
  tag: string;
  onTag: (v: string) => void;
  facets: { levels: string[]; partsOfSpeech: string[]; tags: string[] };
  shown: number;
  total: number;
}) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search German, English or Nepali…"
            aria-label="Search vocabulary"
            className={`${theme.input} pl-9`}
          />
        </div>
        <Select
          label="Source"
          value={source}
          onChange={onSource}
          options={[
            { value: 'all', label: `All (${counts.total})` },
            { value: 'vocabulary', label: `Dictionary (${counts.dict})` },
            { value: 'content_items', label: `Content items (${counts.items})` },
          ]}
        />
        <Select
          label="Level"
          value={level}
          onChange={onLevel}
          options={[{ value: 'all', label: 'All' }, ...facets.levels.map((l) => ({ value: l, label: l }))]}
        />
        <Select
          label="POS"
          value={pos}
          onChange={onPos}
          options={[
            { value: 'all', label: 'All' },
            ...facets.partsOfSpeech.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label="Tag"
          value={tag}
          onChange={onTag}
          options={[{ value: 'all', label: 'All' }, ...facets.tags.map((t) => ({ value: t, label: t }))]}
        />
        <span className="text-meta text-ink-500 dark:text-ink-400">
          {shown} of {total}
        </span>
      </div>
    </section>
  );
}

function VocabTable({
  rows,
  loading,
  totalRows,
  scrollRef,
  virtualizer,
}: {
  rows: VocabRow[];
  loading: boolean;
  totalRows: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Typed to the concrete scroll element; `ReturnType<typeof useVirtualizer>`
   *  erases the generic to `Element`, which is not assignable from the real one. */
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div
        className={`${GRID} border-b border-ink-200 px-4 py-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:border-ink-800 dark:text-ink-400`}
      >
        <span>Word</span>
        <span>POS</span>
        <span>Level</span>
        <span>Source</span>
        <span>English</span>
        <span>Nepali</span>
      </div>

      {loading && totalRows === 0 ? (
        <p className="px-4 py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-body font-semibold text-ink-700 dark:text-ink-200">No entries match</p>
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
            {totalRows === 0
              ? 'No vocabulary is readable. Check the RLS policies for your admin role.'
              : 'Try clearing the search or filters above.'}
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[34rem] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const r = rows[item.index];
              return (
                <div
                  key={r.key}
                  className={`${GRID} absolute left-0 w-full items-center border-b border-ink-100 px-4 dark:border-ink-800/60`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <span className="min-w-0">
                    <Word row={r} />
                  </span>
                  <span className="truncate text-meta text-ink-600 dark:text-ink-300">
                    <Cell value={r.partOfSpeech} />
                  </span>
                  <span className="text-meta">
                    <Cell value={r.level} />
                  </span>
                  <span className="truncate text-micro text-ink-400">
                    {r.source === 'vocabulary' ? 'dict' : 'item'}
                  </span>
                  <span className="truncate text-meta text-ink-700 dark:text-ink-200">
                    <Cell value={r.translationEn} />
                  </span>
                  <span className="truncate text-meta text-ink-600 dark:text-ink-300">
                    <Cell value={r.translationNp} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function VocabularyPage() {
  const [rows, setRows] = useState<VocabRow[]>([]);
  const [facets, setFacets] = useState<{ levels: string[]; partsOfSpeech: string[]; tags: string[] }>({
    levels: [],
    partsOfSpeech: [],
    tags: [],
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [pos, setPos] = useState('all');
  const [tag, setTag] = useState('all');
  const [source, setSource] = useState<'all' | VocabSource>('all');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchVocabulary();
    setRows(result.rows);
    setFacets(result.facets);
    setErrors(result.errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Search covers the translations too: an admin looking for "apple" is
      // usually searching the English or Nepali column, not the German headword.
      if (
        q &&
        !r.word.toLowerCase().includes(q) &&
        !(r.translationEn ?? '').toLowerCase().includes(q) &&
        !(r.translationNp ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (level !== 'all' && (r.level ?? '') !== level) return false;
      if (pos !== 'all' && (r.partOfSpeech ?? '') !== pos) return false;
      if (tag !== 'all' && !r.tags.includes(tag)) return false;
      if (source !== 'all' && r.source !== source) return false;
      return true;
    });
  }, [rows, search, level, pos, tag, source]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const counts = useMemo(
    () => ({
      total: rows.length,
      dict: rows.filter((r) => r.source === 'vocabulary').length,
      items: rows.filter((r) => r.source === 'content_items').length,
      tagged: rows.filter((r) => r.tags.length > 0).length,
    }),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Content</p>
          <h1 className={theme.page.heading}>Vocabulary</h1>
          <p className={theme.page.description}>
            Read-only. Writes to both source tables are revoked from client roles; import needs a
            privileged function.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download('vocabulary.csv', toCsv(filtered), 'text/csv;charset=utf-8')}
            className={theme.button.secondary}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV ({filtered.length})
          </button>
          <button
            type="button"
            onClick={() =>
              download('vocabulary.json', JSON.stringify(filtered, null, 2), 'application/json')
            }
            className={theme.button.secondary}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className={theme.button.secondary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {errors.length > 0 && <ErrorsPanel errors={errors} />}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total" value={String(counts.total)} hint="across both tables" loading={loading} />
        <KpiCard label="Dictionary" value={String(counts.dict)} hint="rows in vocabulary" loading={loading} />
        <KpiCard label="Content items" value={String(counts.items)} hint="vocab-item rows" loading={loading} />
        <KpiCard label="Tagged" value={String(counts.tagged)} hint="rows with tags" loading={loading} />
      </section>

      <FilterBar
        search={search}
        onSearch={setSearch}
        source={source}
        onSource={(v) => setSource(v as 'all' | VocabSource)}
        counts={counts}
        level={level}
        onLevel={setLevel}
        pos={pos}
        onPos={setPos}
        tag={tag}
        onTag={setTag}
        facets={facets}
        shown={filtered.length}
        total={rows.length}
      />

      <VocabTable
        rows={filtered}
        loading={loading}
        totalRows={rows.length}
        scrollRef={scrollRef}
        virtualizer={virtualizer}
      />
    </div>
  );
}
