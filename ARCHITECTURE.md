# German Learner — Structured Project

Prototype: single file `../german_alphabet_app.html` (still works for demos).  
**This folder** is the modular app so you can change one concern without opening everything.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS** (v4 via `@tailwindcss/vite`)
- **React Router** for Alphabet / Numbers / Calendar

## Folder map — what to open for each task

| You want to change… | Open only… |
|---------------------|------------|
| Letter list, examples, phonetics | `src/data/alphabet.ts` |
| Numbers content / rules | `src/data/numbers.ts` *(add when porting)* |
| Days / months | `src/data/calendar.ts` *(add when porting)* |
| Types / interfaces | `src/types/index.ts` |
| Speech (🔊) | `src/hooks/useSpeech.ts` |
| Progress / localStorage | `src/hooks/useProgress.ts` |
| Nepali vs German-only mode | `src/hooks/useLang.ts` |
| Dark mode | `src/hooks/useDarkMode.ts` |
| Top nav, logo, shell | `src/components/Layout.tsx` |
| Alphabet UI (cards, quiz, spelling) | `src/pages/AlphabetPage.tsx` + `src/components/alphabet/*` |
| Numbers UI | `src/pages/NumbersPage.tsx` |
| Calendar UI | `src/pages/CalendarPage.tsx` |
| Routes | `src/App.tsx` |
| Global CSS / dark / lang hide rules | `src/index.css` |

## How to run (after `npm install`)

```bash
cd german-learner
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom
# wire Tailwind in vite.config.ts (see below)
npm run dev
```

### Tailwind in `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

## Migration plan (one aspect at a time)

1. **Done:** scaffold, types, alphabet data, hooks, layout, routes, page stubs  
2. **Next:** port Alphabet flip cards → `components/alphabet/LetterCard.tsx`  
3. Alphabet quiz + spelling components  
4. `data/numbers.ts` + Numbers page  
5. `data/calendar.ts` + Calendar page  
6. i18n strings file, PWA, branding  

Keep the HTML prototype until the React page feature-matches it; then retire the single file.

## Rule of thumb

> One feature = one folder or one data file.  
> Never put alphabet data inside a React component.  
> Never put speech logic inside a page — use the hook.

