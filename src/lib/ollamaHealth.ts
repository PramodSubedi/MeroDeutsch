/**
 * src/lib/ollamaHealth.ts — "is there a model server, and which kind?"
 *
 * Kept separate from `ollamaClient` so the UI can ask the connectivity
 * question WITHOUT pulling in the streaming machinery. The header status dot
 * and the Settings panel both call only this.
 *
 * NEVER THROWS. A failed check is a legitimate state (Ollama not installed is
 * the common case for a first-time visitor), so it is reported as data.
 */

import { listModels, OllamaError } from './ollamaClient';
import type { OllamaStatus } from '../types/chatbot';

export async function healthCheck(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<OllamaStatus> {
  try {
    const { models, format } = await listModels(baseUrl, signal);
    return { reachable: true, checking: false, format, models, error: null };
  } catch (err) {
    const message =
      err instanceof OllamaError
        ? [err.message, err.hint].filter(Boolean).join(' ')
        : 'Could not reach the local model server.';
    return { reachable: false, checking: false, format: null, models: [], error: message };
  }
}

/** Human label for the detected server kind. */
export function serverLabel(status: OllamaStatus): string {
  if (status.checking) return 'Checking…';
  if (!status.reachable) return 'Offline';
  return status.format === 'openai' ? 'LM Studio' : 'Ollama';
}

/** The one-line setup hint shown in the header tooltip and Settings. */
export function statusHint(status: OllamaStatus): string {
  if (status.reachable) {
    return status.models.length
      ? `${serverLabel(status)} — ${status.models.length} model(s) installed`
      : `${serverLabel(status)} reachable`;
  }
  return status.error ?? 'No local model server detected.';
}
