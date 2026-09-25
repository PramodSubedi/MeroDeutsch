import { useState, useRef } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import type { VocabEntry, WrongAnswerItem } from '../types';
import { useReviewQueue } from '../hooks/useReviewQueue';

interface ImportResult {
  success: number;
  errors: string[];
}

interface ParsedRow {
  de: string;
  en: string;
  ne: string;
  moduleTag?: string;
}

// CSV parser utility
function parseCSV(content: string): ParsedRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  const rows: ParsedRow[] = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header row
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV parsing (simple case - comma separated)
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    
    if (parts.length >= 3) {
      rows.push({
        de: parts[0],
        en: parts[1],
        ne: parts[2],
        moduleTag: parts[3] || undefined,
      });
    }
  }
  
  return rows;
}

// Validate a row
function validateRow(row: ParsedRow, lineNumber: number): string | null {
  if (!row.de || !row.de.trim()) {
    return `Zeile ${lineNumber}: Deutsches Wort fehlt`;
  }
  if (!row.en || !row.en.trim()) {
    return `Zeile ${lineNumber}: Englisches Wort fehlt`;
  }
  if (!row.ne || !row.ne.trim()) {
    return `Zeile ${lineNumber}: Nepalesisches Wort fehlt`;
  }
  return null;
}

export function ImportDeckPage() {
  usePageTitle('Import Deck');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setError(null);
    setResult(null);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      const errors: string[] = [];
      const validRows: VocabEntry[] = [];
      
      // Validate rows
      rows.forEach((row, index) => {
        const lineNumber = index + 2; // +2 because we skip header and 0-indexed
        const validationError = validateRow(row, lineNumber);
        if (validationError) {
          errors.push(validationError);
        } else {
          validRows.push({
            id: `imported-${Date.now()}-${index}`,
            de: row.de,
            en: row.en,
            ne: row.ne,
            tags: row.moduleTag ? [row.moduleTag] : ['Imported'],
            level: 'A1',
          });
        }
      });
      
      // Add to SRS queue (Box 1)
      for (const vocab of validRows) {
        addWrongAnswer({
          moduleType: 'imported',
          itemKey: vocab.de,
          userAnswer: '',
          correctAnswer: vocab.de,
          errorCount: 0,
          boxLevel: 1,
        } as WrongAnswerItem);
      }
      
      setResult({
        success: validRows.length,
        errors,
      });
      
    } catch {
      setError(isDE ? 'Datei konnte nicht gelesen werden.' : 'Could not read file.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const title = isDE ? 'Wortschatz importieren' : 'Import Vocabulary';
  const description = isDE
    ? 'Laden Sie CSV-Dateien mit deutschen Wörtern hoch.'
    : 'Upload CSV files with German vocabulary.';

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <div className="mt-6">
        <div className={theme.panel.surface}>
          <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
            {isDE ? 'CSV-Format' : 'CSV Format'}
          </h2>
          <p className="mb-2 text-body text-ink-600 dark:text-ink-400">
            {isDE ? 'Benötigte Spalten:' : 'Required columns:'}
          </p>
          <pre className="bg-ink-100 dark:bg-ink-800 p-3 rounded-sm text-body">
            {`de,en,ne,moduleTag
Haus,house,घर,Numbers
Hund,dog,कुत्ता,Animals`}
          </pre>
          <p className="mt-2 text-body text-ink-500 dark:text-ink-400">
            {isDE 
              ? 'Spalten: deutsches Wort, englisches Wort, nepalesisches Wort, optionaler Modultag'
              : 'Columns: German word, English word, Nepali word, optional module tag'}
          </p>
        </div>

        <div className="mt-6">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
            id="csv-upload"
          />
          
          <label
            htmlFor="csv-upload"
            className={`inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-body font-medium transition ${
              file 
                ? 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                : `${theme.button.primary} cursor-pointer`
            }`}
          >
            📁 {file ? file.name : isDE ? 'Datei auswählen' : 'Choose file'}
          </label>

          {file && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className={theme.button.primary}
              >
                {importing 
                  ? (isDE ? 'Importiere...' : 'Importing...')
                  : (isDE ? 'Importieren' : 'Import')}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={importing}
                className={theme.button.secondary}
              >
                {isDE ? 'Zurücksetzen' : 'Reset'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-sm bg-danger-50 p-4 text-body text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className={theme.panel.surface}>
            <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Import-Ergebnis' : 'Import Result'}
            </h2>
            
            <div className="mb-4 rounded-sm bg-success-50 p-4 text-body text-success-700 dark:bg-success-900/30 dark:text-success-300">
              {isDE 
                ? `${result.success} Wörter erfolgreich importiert`
                : `${result.success} words successfully imported`}
            </div>

            {result.errors.length > 0 && (
              <div>
                <h3 className="mb-2 text-body font-semibold text-ink-700 dark:text-ink-200">
                  {isDE ? 'Fehler:' : 'Errors:'}
                </h3>
                <ul className="list-inside space-y-1 text-body text-danger-600 dark:text-danger-400">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-sm border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
            <h3 className="mb-2 text-body font-semibold text-ink-700 dark:text-ink-200">
              {isDE ? 'Nächste Schritte' : 'Next Steps'}
            </h3>
            <ul className="list-inside space-y-1 text-body text-ink-600 dark:text-ink-400">
              <li>• {isDE ? 'Gehen Sie zu "Lernen" um die importierten Wörter zu üben.' : 'Go to "Learn" to practice the imported words.'}</li>
              <li>• {isDE ? 'Die Wörter beginnen in Box 1 des SRS-Systems.' : 'Words start in Box 1 of the SRS system.'}</li>
              <li>• {isDE ? 'Korrekte Antworten bewegen sie zur nächsten Box.' : 'Correct answers move them to the next box.'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}