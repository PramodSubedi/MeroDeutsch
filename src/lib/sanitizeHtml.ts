/**
 * src/lib/sanitizeHtml.ts — an allowlist sanitiser for model output.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ChatMarkdown` injects `marked` output through `dangerouslySetInnerHTML`, and
 * marked v15 REMOVED the `sanitize` option — so raw HTML in a reply survives
 * into the DOM. `ollamaClient` documents why that used to be tolerable (the only
 * producer is a model the learner runs on their own machine over localhost) and
 * also documents the moment it stops being: point the companion at a shared or
 * proxied model and there is no boundary left. `baseUrl` is user-editable AND
 * admin-settable via `chatbot_base_url`, so that boundary is one config row away.
 *
 * WHY AN ALLOWLIST, NOT A BLOCKLIST
 * ---------------------------------
 * A blocklist must enumerate every way to execute script; an allowlist only has
 * to enumerate what a chat reply is allowed to contain. Anything unlisted is
 * dropped, including things nobody has thought of yet.
 *
 * WHY A STRING SANITISER AND NOT `DOMParser`
 * ------------------------------------------
 * Every `check:*` suite runs under `tsx`, with no DOM. A sanitiser that needs
 * `document` cannot be tested in the one place this repo tests its rules, and an
 * untested sanitiser is believed rather than known. This one is pure and covered
 * by `check:chatbot`.
 *
 * THE HONEST LIMIT
 * ----------------
 * A deliberately small, auditable implementation — not a hardened library.
 * Regex-based HTML handling is normally a bad idea. It is acceptable here
 * because the input is not arbitrary HTML: it is `marked`'s own output, a
 * bounded tag set, whose text nodes `marked` has already entity-escaped. If
 * this is ever fed genuinely untrusted third-party HTML, replace it with
 * DOMPurify rather than hardening these regexes.
 */

/**
 * Tags a chat reply may contain: `marked`'s own output set minus `img`. A study
 * companion has no reason to emit a remote image, and allowing one re-opens
 * `onerror`-style injection plus off-device request leakage.
 */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'strong', 'em', 'del',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a',
]);

/** Tags with no closing tag. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr']);

/** Attributes permitted per tag. Everything else — including all `on*` — goes. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'title']),
};

/**
 * Elements dropped WITH their content. Removing only the tags would leave a
 * script body and a stylesheet as visible prose, and `<style>` text would still
 * be applied by the parser.
 */
const DROP_WITH_CONTENT: readonly string[] = [
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript',
  'svg', 'math', 'form', 'textarea', 'input', 'button', 'select', 'option',
  'link', 'meta', 'base', 'title', 'head', 'xmp', 'noembed', 'noframes',
  'plaintext', 'listing',
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t',
  newline: '\n', sol: '/', nbsp: ' ',
};

/**
 * Decode entities so a scheme is judged on what the BROWSER will see.
 *
 * This is the point of the function: `&#106;avascript:alert(1)` and
 * `java&colon;script:alert(1)` are ordinary-looking attribute values and both
 * execute, so a check that only inspects the literal prefix passes them through.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);?/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Is this href safe to put in a link?
 *
 * Rejects `javascript:`, `data:`, `vbscript:` and any other scheme, plus
 * protocol-relative `//host` — not a script vector, but it silently walks a
 * learner off-origin from a study app. Relative paths, fragments and
 * http/https/mailto survive.
 */
export function isSafeHref(raw: string): boolean {
  // C0 controls, DEL and space all go first: `java<TAB>script:` and
  // `<NEWLINE>javascript:` both execute, so a naive prefix test misses them.
  //
  // Filtered by char code rather than a regex character class on purpose: a
  // literal tab inside a source class is invisible, and a unicode range is at
  // the mercy of whatever last rewrote the file. A previous version of this
  // line lost exactly that, and silently stopped rejecting tab-split schemes
  // — which `check:chatbot` caught.
  const compact = Array.from(decodeEntities(raw))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join('');
  if (compact === '') return false;
  if (compact.startsWith('//')) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!scheme) return true; // scheme-less => relative
  const proto = scheme[1].toLowerCase();
  return proto === 'http' || proto === 'https' || proto === 'mailto';
}

const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]+))?/g;

/** Rebuild one tag from scratch — an attribute string is never passed through. */
function rebuildTag(tag: string, closing: boolean, attrs: string): string {
  if (closing) return `</${tag}>`;
  const allowed = ALLOWED_ATTRS[tag];
  let out = `<${tag}`;
  if (allowed) {
    ATTR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ATTR_RE.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      // Belt and braces: `on*` is in no allowlist, but an allowlist that grows
      // later must never be able to grow into an event handler by accident.
      if (name.startsWith('on')) continue;
      if (!allowed.has(name)) continue;
      // A valueless attribute has no legitimate use here, so it is dropped
      // rather than invented.
      const raw = m[2];
      if (raw === undefined) continue;
      const value = raw.replace(/^["']|["']$/g, '');
      if (name === 'href' && !isSafeHref(value)) continue;
      out += ` ${name}="${value.replace(/"/g, '&quot;')}"`;
    }
  }
  return VOID_TAGS.has(tag) ? `${out} />` : `${out}>`;
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;

/** Strip comments/doctypes, then dangerous elements together with their content. */
function stripDangerous(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<![^>]*>/g, '');
  for (const tag of DROP_WITH_CONTENT) {
    // `(?:\/tag>|$)` — an unterminated `<script` at the end has no closing tag,
    // and matching only the paired form would leave its body behind.
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}\\s*>|$)`, 'gi'), '');
  }
  // A truncated final tag with no `>` is still a tag to the parser.
  return out.replace(/<[a-zA-Z][^>]*$/, '');
}

/**
 * Sanitise a fragment of HTML down to the allowlist.
 *
 * A dropped element loses its markup but keeps its text, so a stray `<b>` still
 * shows the sentence it wrapped instead of swallowing a paragraph.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const stripped = stripDangerous(html);
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(stripped)) !== null) {
    // Text between tags is escaped here rather than trusted: `marked` escapes
    // its own text nodes, but a truncated or hand-built fragment is not
    // guaranteed to have passed through it, and a lone `<` re-parses as markup.
    out += stripped.slice(last, m.index).replace(/</g, '&lt;');
    last = m.index + m[0].length;
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    out += rebuildTag(tag, m[1] === '/', m[3]);
  }
  out += stripped.slice(last).replace(/</g, '&lt;');
  return out;
}
