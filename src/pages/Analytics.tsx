import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';

// Chart colors
const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

// Analytics data types
interface DailyStats {
  date: string;
  minutes: number;
  reviews: number;
}

interface ModuleAccuracy {
  module: string;
  correct: number;
  total: number;
}

interface RetentionData {
  week: string;
  avgBoxLevel: number;
}

// Generate sample analytics data (in real app, this would come from Supabase)
function generateRetentionData(): RetentionData[] {
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  return weeks.map((week, i) => ({
    week,
    avgBoxLevel: Math.min(5, 1 + (i * 0.5) + Math.random() * 0.5),
  }));
}

function generateDailyStats(): DailyStats[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    date: day,
    minutes: Math.floor(Math.random() * 60) + 10,
    reviews: Math.floor(Math.random() * 30) + 5,
  }));
}

function generateModuleAccuracy(): ModuleAccuracy[] {
  return [
    { module: 'Numbers', correct: 42, total: 50 },
    { module: 'Calendar', correct: 38, total: 45 },
    { module: 'Greetings', correct: 45, total: 50 },
    { module: 'Stories', correct: 30, total: 40 },
  ];
}

export function AnalyticsPage() {
  usePageTitle('Analytics');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [moduleAccuracy, setModuleAccuracy] = useState<ModuleAccuracy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from Supabase
    // For now, we generate sample data
    const timer = setTimeout(() => {
      setRetentionData(generateRetentionData());
      setDailyStats(generateDailyStats());
      setModuleAccuracy(generateModuleAccuracy());
      setLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const title = isDE ? 'Lernanalytik' : 'Learning Analytics';
  const description = isDE
    ? 'Verfolge deinen Fortschritt und Lernroutinen.'
    : 'Track your progress and learning habits.';

  // Calculate accuracy percentages
  const accuracyData = useMemo(() => {
    return moduleAccuracy.map(m => ({
      name: m.module,
      value: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0,
      correct: m.correct,
      total: m.total,
    }));
  }, [moduleAccuracy]);

  if (loading) {
    return (
      <div className={theme.page.container}>
        <h1 className={theme.page.heading}>{title}</h1>
        <p className={theme.page.description}>{description}</p>
        <div className="mt-8 text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
        {/* Retention Trend - Line Chart */}
        <div className={theme.panel.surface}>
          <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Behaltungsrate über Wochen' : 'Retention Trend (Weekly)'}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={retentionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="week" stroke="#64748b" />
              <YAxis domain={[1, 5]} stroke="#64748b" />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="avgBoxLevel" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Investment - Bar Chart */}
        <div className={theme.panel.surface}>
          <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Zeitaufwand pro Tag' : 'Time Investment (Daily Minutes)'}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Module Accuracy - Pie Chart */}
        <div className={theme.panel.surface}>
          <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Modulgenauigkeit' : 'Module Accuracy'}
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <Pie
                data={accuracyData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent ?? 0) * 100}%`}
              >
                {accuracyData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="space-y-4">
          <div className={theme.panel.accent}>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {isDE ? 'Gesamtstatistik' : 'Overall Stats'}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {dailyStats.reduce((sum, d) => sum + d.minutes, 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isDE ? 'Gesamt-Minuten' : 'Total Minutes'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(accuracyData.reduce((sum, d) => sum + d.value, 0) / accuracyData.length)}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isDE ? 'Durchschn. Genauigkeit' : 'Avg Accuracy'}
                </div>
              </div>
            </div>
          </div>

          <div className={theme.panel.surface}>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              {isDE ? 'Neueste Fortschritte' : 'Recent Progress'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isDE 
                ? 'Dein Lernfortschritt wird hier angezeigt. Daten werden aus deinem SRS-System abgerufen.'
                : 'Your learning progress is displayed here. Data is fetched from your SRS system.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}