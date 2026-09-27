/**
 * src/lib/ollamaClient.ts — minimal client for a LOCAL model server.
 *
 * SUPPORTS TWO WIRE FORMATS, because the two servers people actually install
 * speak different protocols:
 *
 *   Ollama    POST /api/chat          -> NDJSON  (one JSON object per line)
 *   LM Studio POST /v1/chat/completions -> SSE   ("data: {...}" lines)
 *
 * The format is auto-negotiated once via `detectFormat` and then cached, so
 * the streaming path does not pay a probe on every message.
 *
 * NO CLOUD FALLBACK — BY DESIGN
 * -----------------------------
 * If the local server is unreachable this THROWS. It never silently falls back
 * to a hosted API: the whole promise of the feature is that the learner's
 * study data (weak items, mistakes, curriculum position) never leaves the
 * machine. `responseHandlers.fallbackReply` is the offline story instead.
 *
 * XSS NOTE (accepted, documented): the UI renders model output through
 * `marked` into innerHTML, and `marked` v15 removed its `sanitize` option, so
 * raw HTML in the model's output would pass through. The exposure is bounded
 * because the only producer is a model the learner runs themselves.
 */

import { CHATBOT_CONFIG, normalizeBaseUrl } from '../config/chatbot';
import type { OllamaWireFormat } from '../types/chatbot';

export interface WireMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaClientConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
}

/** Error carrying an actionable hint, so the UI can show a FIX not just a fail. */
export class OllamaError extends Error {
  readonly hint: string;

  constructor(message: string, hint = '') {
    super(message);
    this.name = 'OllamaError';
    this.hint = hint;
  }
}

const CORS_HINT =
  'If this app is open over HTTPS, the browser blocks the request. Restart the server with ' +
  'OLLAMA_ORIGINS set to the site origin, e.g. OLLAMA_ORIGINS="https://your-site" ollama serve.';

/* ── format negotiation ───────────────────────────────────────────────────── */

const formatCache = new Map<string, OllamaWireFormat>();

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/** Probe both endpoints. Returns null when neither answers. */
export async function detectFormat(
  rawBaseUrl: string,
  signal?: AbortSignal,
): Promise<OllamaWireFormat | null> {
  const base = normalizeBaseUrl(rawBaseUrl);
  const cached = formatCache.get(base);
  if (cached) return cached;

  const timeoutMs = CHATBOT_CONFIG.healthTimeoutMs;
  const probe = async (path: string): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(`${base}${path}`, { signal: controller.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  if (await probe('/api/tags')) {
    formatCache.set(base, 'ollama');
    return 'ollama';
  }
  if (await probe('/v1/models')) {
    formatCache.set(base, 'openai');
    return 'openai';
  }
  return null;
}

/** Clear the negotiated-format cache (called when the user edits the URL). */
export function resetFormatCache(): void {
  formatCache.clear();
}

/**
 * List locally installed models. Returns the detected format alongside the
 * names so callers can show "Ollama" vs "LM Studio" in Settings.
 */
export async function listModels(
  rawBaseUrl: string,
  signal?: AbortSignal,
): Promise<{ models: string[]; format: OllamaWireFormat }> {
  const base = normalizeBaseUrl(rawBaseUrl);
  const format = await detectFormat(base, signal);
  if (!format) {
    throw new OllamaError(`No local model server at ${base}.`, CORS_HINT);
  }

  const path = format === 'ollama' ? '/api/tags' : '/v1/models';
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CHATBOT_CONFIG.healthCheckIntervalMs / 2,
  );
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(`${base}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new OllamaError(`Model list failed (HTTP ${res.status}).`, CORS_HINT);
    }
    const data: unknown = await res.json();
    if (format === 'ollama') {
      const models = (data as { models?: Array<{ name?: string; model?: string }> })?.models;
      return {
        format,
        models: (models ?? [])
          .map((m) => m.name ?? m.model ?? '')
          .filter((n): n is string => Boolean(n)),
      };
    }
    const data2 = (data as { data?: Array<{ id?: string }> })?.data;
    return {
      format,
      models: (data2 ?? []).map((m) => m.id ?? '').filter((n): n is string => Boolean(n)),
    };
  } catch (err) {
    if (err instanceof OllamaError) throw err;
    if (isAbort(err)) throw new OllamaError('Timed out listing models.', CORS_HINT);
    throw new OllamaError(
      `Could not reach ${base}.`,
      'Start Ollama with `ollama serve`, or set the correct URL in Settings. ' + CORS_HINT,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pick the model to actually use: the configured one if installed, else the
 * first known-good fallback that is installed, else whatever exists, else the
 * configured name (so the error message names something meaningful).
 */
export function resolveModel(configured: string, available: readonly string[]): string {
  if (!available.length) return configured;
  if (available.includes(configured)) return configured;
  const fallback = CHATBOT_CONFIG.fallbackModels.find((m) => available.includes(m));
  if (fallback) return fallback;
  return available[0] ?? configured;
}

/* ── request construction ─────────────────────────────────────────────────── */

interface BuiltRequest {
  url: string;
  body: Record<string, unknown>;
}

function buildRequest(
  config: OllamaClientConfig,
  messages: WireMessage[],
  format: OllamaWireFormat,
  stream: boolean,
): BuiltRequest {
  const base = normalizeBaseUrl(config.baseUrl);
  if (format === 'ollama') {
    return {
      url: `${base}/api/chat`,
      body: {
        model: config.model,
        messages,
        stream,
        options: { temperature: config.temperature, num_predict: config.maxTokens },
      },
    };
  }
  return {
    url: `${base}/v1/chat/completions`,
    body: {
      model: config.model,
      messages,
      stream,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    },
  };
}

/** Combine the caller's abort signal with our own timeout. */
function withTimeout(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  external?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

async function ensureFormat(config: OllamaClientConfig, signal?: AbortSignal) {
  const format = await detectFormat(config.baseUrl, signal);
  if (!format) {
    throw new OllamaError(
      `No local model server at ${normalizeBaseUrl(config.baseUrl)}.`,
      CORS_HINT,
    );
  }
  return format;
}

/* ── stream decoding ──────────────────────────────────────────────────────── */

function extractOllamaDelta(line: string): string {
  try {
    const obj = JSON.parse(line) as {
      message?: { content?: string };
      response?: string;
    };
    return obj.message?.content ?? obj.response ?? '';
  } catch {
    return '';
  }
}

function extractOpenAiDelta(payload: string): string {
  try {
    const obj = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return obj.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

async function pumpStream(
  res: Response,
  format: OllamaWireFormat,
  onChunk: (delta: string) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new OllamaError('This server does not support streaming.');
  }
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // The trailing element is an incomplete line — keep it for the next read.
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (format === 'openai') {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        const delta = extractOpenAiDelta(payload);
        if (delta) onChunk(delta);
      } else {
        const delta = extractOllamaDelta(line);
        if (delta) onChunk(delta);
      }
    }
  }
}

/* ── public API ───────────────────────────────────────────────────────────── */

/** Map any thrown value into an actionable OllamaError. */
function rethrow(err: unknown, config: OllamaClientConfig): never {
  if (err instanceof OllamaError) throw err;
  if (isAbort(err)) {
    throw new OllamaError(
      'The model took too long to answer.',
      'A 3B model on CPU is slow. Try a smaller model (gemma2:2b) in Settings.',
    );
  }
  throw new OllamaError(
    `Could not reach ${normalizeBaseUrl(config.baseUrl)}.`,
    'Start the server with `ollama serve`, or set the correct URL in Settings. ' + CORS_HINT,
  );
}

async function post(
  config: OllamaClientConfig,
  body: unknown,
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new OllamaError(
      `Model server returned HTTP ${res.status}.`,
      `Is "${config.model}" installed? Try: ollama pull ${config.model}` +
        (detail ? ` — ${detail.slice(0, 160)}` : ''),
    );
  }
  return res;
}

/** One-shot, non-streaming completion. */
export async function chat(
  messages: WireMessage[],
  config: OllamaClientConfig,
  signal?: AbortSignal,
): Promise<string> {
  const format = await ensureFormat(config, signal);
  const { url, body } = buildRequest(config, messages, format, false);
  const timeout = withTimeout(signal, config.timeoutMs ?? CHATBOT_CONFIG.requestTimeoutMs);
  try {
    const res = await post(config, body, url, timeout.signal);
    const data: unknown = await res.json();
    if (format === 'ollama') {
      return (data as { message?: { content?: string } })?.message?.content ?? '';
    }
    return (
      (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
        ?.content ?? ''
    );
  } catch (err) {
    return rethrow(err, config);
  } finally {
    timeout.cleanup();
  }
}

/** Streaming completion — `onChunk` fires per token as it arrives. */
export async function streamChat(
  messages: WireMessage[],
  config: OllamaClientConfig,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const format = await ensureFormat(config, signal);
  const { url, body } = buildRequest(config, messages, format, true);
  const timeout = withTimeout(signal, config.timeoutMs ?? CHATBOT_CONFIG.requestTimeoutMs);
  try {
    const res = await post(config, body, url, timeout.signal);
    await pumpStream(res, format, onChunk);
  } catch (err) {
    rethrow(err, config);
  } finally {
    timeout.cleanup();
  }
}
