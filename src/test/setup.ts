import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// ── Mock Supabase ───────────────────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// ── Mock Dexie ──────────────────────────────────────────────────────────────
vi.mock('dexie', () => {
  const mockTable = {
    add: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(undefined),
    bulkAdd: vi.fn().mockResolvedValue(undefined),
    bulkPut: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: class MockDexie {
      version = vi.fn().mockReturnThis();
      stores = vi.fn().mockReturnThis();
      open = vi.fn().mockResolvedValue(undefined);
      close = vi.fn();
      on = vi.fn();
      table = vi.fn(() => mockTable);
      vocab = mockTable;
      progress = mockTable;
      reviewQueue = mockTable;
      settings = mockTable;
      userData = mockTable;
      contentItems = mockTable;
      ankiVocab = mockTable;
    },
    liveQuery: vi.fn((_fn) => ({ subscribe: vi.fn(), unsubscribe: vi.fn() })),
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn) => fn()),
  useObservable: vi.fn(() => undefined),
}));

// ── Mock react-router-dom ───────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '' })),
    useNavigate: vi.fn(() => vi.fn()),
    useParams: vi.fn(() => ({})),
    Link: ({ children, to, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
    Navigate: ({ to, replace }: any) =>
      React.createElement('a', { href: to, 'data-replace': replace }),
  };
});

// ── Mock lucide-react ───────────────────────────────────────────────────────
// Icons that render as a LABELLED stub, so tests can assert on a stable
// `data-testid`. Anything else keeps its real implementation (see below).
vi.mock('lucide-react', async () => {
  const React = (await import('react')).default;
  const actual = await vi.importActual<Record<string, unknown>>('lucide-react');

  // Icons whose `data-testid` existing tests already assert on. Adding a name
  // here changes its rendering, so it is not a catch-all.
  const labelled = [
    'Menu', 'Volume2', 'VolumeX', 'Home', 'BookOpen', 'Target', 'LayoutDashboard',
    'LifeBuoy', 'Send', 'Settings', 'ArrowLeft', 'ArrowRight', 'Lock',
    'ChevronsLeft', 'ChevronsRight', 'ArrowUpRight', 'MessageCircle', 'Hash',
    'Calendar', 'FileText', 'Mic', 'MessageSquare', 'Zap', 'Layers', 'Puzzle',
    'Gamepad2', 'Mail', 'Library', 'BookA', 'WifiOff',
  ];

  const overrides: Record<string, unknown> = {};
  for (const name of labelled) {
    overrides[name] = (props: Record<string, unknown>) =>
      React.createElement('svg', { ...props, 'data-testid': `icon-${name.toLowerCase()}` }, name);
  }

  // WHY THE SPREAD MATTERS. This mock used to be a CLOSED list of exports, so
  // importing one previously-unused lucide icon anywhere in the app threw
  // `No "X" export is defined on the "lucide-react" mock` at render time — which
  // is exactly how the list came to require hand-maintaining against the whole
  // codebase, and how it drifted. Spreading the real module first means every
  // icon resolves, present and future, and only the labelled ones above are
  // swapped for a stub. No list to keep in sync.
  return { ...actual, ...overrides };
});

// ── Mock framer-motion ──────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, key) => (props: any) => React.createElement(key, props, props.children),
  }),
  AnimatePresence: ({ children }: any) => children,
  LazyMotion: ({ children }: any) => children,
  domAnimation: {},
}));

// ── Mock recharts ───────────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: (props: any) => React.createElement('div', { 'data-testid': 'line', ...props }),
  BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: (props: any) => React.createElement('div', { 'data-testid': 'bar', ...props }),
  // `ActivityTrend` plots raw daily counts as a filled area under a moving
  // average. Both were missing here, so the component threw
  // `No "AreaChart" export is defined on the "recharts" mock` the moment any
  // test rendered it — which is how a component ships completely unrendered.
  AreaChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: (props: any) => React.createElement('div', { 'data-testid': 'area', ...props }),
  PieChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: (props: any) => React.createElement('div', { 'data-testid': 'pie', ...props }),
  Cell: (props: any) => React.createElement('div', { 'data-testid': 'cell', ...props }),
  XAxis: (props: any) => React.createElement('div', { 'data-testid': 'x-axis', ...props }),
  YAxis: (props: any) => React.createElement('div', { 'data-testid': 'y-axis', ...props }),
  CartesianGrid: (props: any) => React.createElement('div', { 'data-testid': 'cartesian-grid', ...props }),
  Tooltip: (props: any) => React.createElement('div', { 'data-testid': 'tooltip', ...props }),
  Legend: (props: any) => React.createElement('div', { 'data-testid': 'legend', ...props }),
  ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LabelList: (props: any) => React.createElement('div', { 'data-testid': 'label-list', ...props }),
  // `CheckpointTrajectory` draws the 80% gate as a ReferenceLine, and asserts
  // its `y` value. Mocking it as a passthrough keeps that assertion possible
  // without recharts trying to measure a chart in jsdom.
  ReferenceLine: (props: any) => React.createElement('div', { 'data-testid': 'reference-line', ...props }),
}));

// ── Mock canvas-confetti ────────────────────────────────────────────────────
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
  __esModule: true,
}));

// ── Mock window.matchMedia ──────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── Mock window.localStorage ────────────────────────────────────────────────
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── Mock navigator.onLine ───────────────────────────────────────────────────
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// ── Mock IntersectionObserver ───────────────────────────────────────────────
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// ── Mock ResizeObserver ─────────────────────────────────────────────────────
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// ── Mock SpeechRecognition ──────────────────────────────────────────────────
const MockSpeechRecognition = vi.fn(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onresult: null,
  onerror: null,
  onend: null,
  continuous: false,
  interimResults: false,
  lang: 'de-DE',
}));
Object.defineProperty(window, 'SpeechRecognition', { value: MockSpeechRecognition });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: MockSpeechRecognition });

// ── Mock crypto.randomUUID ──────────────────────────────────────────────────
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2)),
  },
});

// ── Console error suppression for known test noise ──────────────────────────
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('act(...)') ||
      args[0]?.includes?.('Warning:') ||
      args[0]?.includes?.('useLayoutEffect')
    ) return;
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});