-- Migration: 20260926170000_seed_grammar_drill_gap.sql
--
-- Backfills the `grammar-drill` pool in public.content_items so the cloud
-- matches the bundled offline snapshot (src/data/content-pools.json).
--
-- WHY THIS EXISTS
-- ---------------
-- 1. The 15-module A1 curriculum assigns a grammar CATEGORY per module
--    (M08 stem, M09 prefix, M13 modals, M15 perfekt). Migration 012 only ever
--    seeded the four baseline categories (sein/haben/weakVerb/cases) — `stem`,
--    `modals` and `prefix` existed solely in the offline JSON, so an ONLINE
--    learner silently got an empty pool for exactly the modules that teach
--    those topics, producing short or empty checkpoint decks.
-- 2. Module 15 introduces the Perfekt, which had NO drill pool in either the
--    cloud or the snapshot.
--
-- The client is additionally defensive (A1CheckpointPage unions the module's
-- categories with the baseline four, so a short deck can never happen even if
-- this migration is not yet applied). This migration is what makes the decks
-- FULLY on-topic rather than merely non-empty.
--
-- SCOPE / HONEST LIMITS
-- ---------------------
-- Adds rows to the EXISTING `content_items` table. It deliberately does NOT
-- create the `vocab_entities` table or the `VOCAB_A1_Mnn_nnn` id scheme from the
-- spec's §3 "Database Schema": that would be a new Supabase-backed curriculum
-- pipeline, which is out of scope (.clinerules Part H, "no curriculum Supabase
-- migration"). The existing content_items + Dexie cache path is reused.
--
-- Ids match the generator's scheme (`grammar-<category>-<n>`) so an offline
-- cold start and the cloud cache dedupe onto the SAME primary key instead of
-- storing each drill twice. Idempotent (ON CONFLICT DO UPDATE), so re-running
-- is safe and this repairs a partial/older pool in place.

-- ── sein ────────────────────────────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-sein-0', 'grammar-drill', $json${"prompt":"Ich ___ Student.","options":["bin","bist","ist"],"correct":"bin","category":"sein"}$json$::jsonb, 0),
  ('grammar-sein-1', 'grammar-drill', $json${"prompt":"Du ___ nett.","options":["bin","bist","ist"],"correct":"bist","category":"sein"}$json$::jsonb, 1),
  ('grammar-sein-2', 'grammar-drill', $json${"prompt":"Er ___ müde.","options":["bin","bist","ist"],"correct":"ist","category":"sein"}$json$::jsonb, 2),
  ('grammar-sein-3', 'grammar-drill', $json${"prompt":"Wir ___ hier.","options":["sind","seid","ist"],"correct":"sind","category":"sein"}$json$::jsonb, 3),
  ('grammar-sein-4', 'grammar-drill', $json${"prompt":"Ihr ___ Freunde.","options":["sind","seid","bin"],"correct":"seid","category":"sein"}$json$::jsonb, 4)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── haben ───────────────────────────────────────────────────────────────
-- NOTE: rows 2–4 were previously stranded BELOW the `perfekt` block as an
-- orphaned VALUES list with no INSERT INTO, which made the whole file a hard
-- syntax error (42601) and meant this migration could never apply. They are
-- rejoined here so all five `haben` drills land in one statement.
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-haben-0', 'grammar-drill', $json${"prompt":"Ich ___ ein Buch.","options":["habe","hast","hat"],"correct":"habe","category":"haben"}$json$::jsonb, 0),
  ('grammar-haben-1', 'grammar-drill', $json${"prompt":"Du ___ einen Stift.","options":["habe","hast","hat"],"correct":"hast","category":"haben"}$json$::jsonb, 1),
  ('grammar-haben-2', 'grammar-drill', $json${"prompt":"Sie ___ eine Schwester.","options":["habe","hast","hat"],"correct":"hat","category":"haben"}$json$::jsonb, 2),
  ('grammar-haben-3', 'grammar-drill', $json${"prompt":"Wir ___ Hunger.","options":["haben","habt","hat"],"correct":"haben","category":"haben"}$json$::jsonb, 3),
  ('grammar-haben-4', 'grammar-drill', $json${"prompt":"Ihr ___ Zeit.","options":["haben","habt","hast"],"correct":"habt","category":"haben"}$json$::jsonb, 4)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── cases (Nominativ / Akkusativ) ───────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-cases-0', 'grammar-drill', $json${"prompt":"Der Mann sieht ___ Frau. (who receives?)","options":["den Mann","die Frau"],"correct":"die Frau","category":"cases"}$json$::jsonb, 0),
  ('grammar-cases-1', 'grammar-drill', $json${"prompt":"Ich habe ___ Bruder. (direct object)","options":["einen","ein"],"correct":"einen","category":"cases"}$json$::jsonb, 1),
  ('grammar-cases-2', 'grammar-drill', $json${"prompt":"___ Tisch ist groß. (subject)","options":["Der","Den"],"correct":"Der","category":"cases"}$json$::jsonb, 2),
  ('grammar-cases-3', 'grammar-drill', $json${"prompt":"Wir kaufen ___ Buch. (direct object)","options":["das","die"],"correct":"das","category":"cases"}$json$::jsonb, 3),
  ('grammar-cases-4', 'grammar-drill', $json${"prompt":"Sie liebt ___ Hund. (direct object)","options":["einen","ein"],"correct":"einen","category":"cases"}$json$::jsonb, 4)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── stem (Module 8) — WAS NEVER SEEDED TO THE CLOUD ─────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-stem-0', 'grammar-drill', $json${"prompt":"du ___ (lesen)","options":["liest","lesst","lesest"],"correct":"liest","category":"stem"}$json$::jsonb, 0),
  ('grammar-stem-1', 'grammar-drill', $json${"prompt":"er ___ (sehen)","options":["sieht","seht","sehet"],"correct":"sieht","category":"stem"}$json$::jsonb, 1),
  ('grammar-stem-2', 'grammar-drill', $json${"prompt":"du ___ (sprechen)","options":["sprichst","sprechst","sprecht"],"correct":"sprichst","category":"stem"}$json$::jsonb, 2),
  ('grammar-stem-3', 'grammar-drill', $json${"prompt":"du ___ (fahren)","options":["fährst","fahrst","fahrt"],"correct":"fährst","category":"stem"}$json$::jsonb, 3),
  ('grammar-stem-4', 'grammar-drill', $json${"prompt":"er ___ (essen)","options":["isst","esst","essen"],"correct":"isst","category":"stem"}$json$::jsonb, 4),
  ('grammar-stem-5', 'grammar-drill', $json${"prompt":"du ___ (nehmen)","options":["nimmst","nehmst","nimmt"],"correct":"nimmst","category":"stem"}$json$::jsonb, 5),
  ('grammar-stem-6', 'grammar-drill', $json${"prompt":"er ___ (schlafen)","options":["schläft","schlaft","schlafst"],"correct":"schläft","category":"stem"}$json$::jsonb, 6),
  ('grammar-stem-7', 'grammar-drill', $json${"prompt":"du ___ (laufen)","options":["läufst","lauft","laufst"],"correct":"läufst","category":"stem"}$json$::jsonb, 7)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── modals (Module 13) — WAS NEVER SEEDED TO THE CLOUD ──────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-modals-0', 'grammar-drill', $json${"prompt":"Ich ___ gut schwimmen. (können)","options":["kann","kannst","könne"],"correct":"kann","category":"modals"}$json$::jsonb, 0),
  ('grammar-modals-1', 'grammar-drill', $json${"prompt":"Du ___ heute Hausaufgaben machen. (müssen)","options":["musst","müsst","müsse"],"correct":"musst","category":"modals"}$json$::jsonb, 1),
  ('grammar-modals-2', 'grammar-drill', $json${"prompt":"Er ___ ein Auto kaufen. (wollen)","options":["will","willst","wollen"],"correct":"will","category":"modals"}$json$::jsonb, 2),
  ('grammar-modals-3', 'grammar-drill', $json${"prompt":"Wir ___ hier nicht rauchen. (dürfen)","options":["dürfen","darft","dürft"],"correct":"dürfen","category":"modals"}$json$::jsonb, 3)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── prefix (Module 9, trennbar vs. untrennbar) — NEVER SEEDED ────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-prefix-0', 'grammar-drill', $json${"prompt":"___ (aufstehen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Separable","category":"prefix"}$json$::jsonb, 0),
  ('grammar-prefix-1', 'grammar-drill', $json${"prompt":"ver- (verstehen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Inseparable","category":"prefix"}$json$::jsonb, 1),
  ('grammar-prefix-2', 'grammar-drill', $json${"prompt":"ein- (einkaufen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Separable","category":"prefix"}$json$::jsonb, 2),
  ('grammar-prefix-3', 'grammar-drill', $json${"prompt":"be- (besuchen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Inseparable","category":"prefix"}$json$::jsonb, 3),
  ('grammar-prefix-4', 'grammar-drill', $json${"prompt":"an- (anrufen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Separable","category":"prefix"}$json$::jsonb, 4),
  ('grammar-prefix-5', 'grammar-drill', $json${"prompt":"ge- (gefallen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Inseparable","category":"prefix"}$json$::jsonb, 5),
  ('grammar-prefix-6', 'grammar-drill', $json${"prompt":"zer- (zerbrechen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Inseparable","category":"prefix"}$json$::jsonb, 6),
  ('grammar-prefix-7', 'grammar-drill', $json${"prompt":"mit- (mitkommen) — trennbar oder untrennbar?","options":["Separable","Inseparable"],"correct":"Separable","category":"prefix"}$json$::jsonb, 7)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── perfekt (Module 15) — NEW CATEGORY, EXISTED IN NEITHER SOURCE ───────
-- Drills the two things a beginner actually gets wrong in the spoken past:
-- choosing the auxiliary (sein vs. haben) and forming the Partizip II.
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-perfekt-0', 'grammar-drill', $json${"prompt":"Die Sonne hat gestern ___ (scheinen).","options":["geschienen","gescheint","geschehnen"],"correct":"geschienen","category":"perfekt"}$json$::jsonb, 0),
  ('grammar-perfekt-1', 'grammar-drill', $json${"prompt":"Ich ___ nach Hause gegangen. (sein or haben?)","options":["bin","habe"],"correct":"bin","category":"perfekt"}$json$::jsonb, 1),
  ('grammar-perfekt-2', 'grammar-drill', $json${"prompt":"Wir ___ Fußball gespielt. (sein or haben?)","options":["haben","sind"],"correct":"haben","category":"perfekt"}$json$::jsonb, 2),
  ('grammar-perfekt-3', 'grammar-drill', $json${"prompt":"Er hat ein Buch ___ (lesen).","options":["gelesen","liest","gelesent"],"correct":"gelesen","category":"perfekt"}$json$::jsonb, 3),
  ('grammar-perfekt-4', 'grammar-drill', $json${"prompt":"Sie ist zum Bahnhof ___ (gehen).","options":["gegangen","gegeht","gegangt"],"correct":"gegangen","category":"perfekt"}$json$::jsonb, 4),
  ('grammar-perfekt-5', 'grammar-drill', $json${"prompt":"Ich ___ heute gearbeitet. (sein or haben?)","options":["habe","bin"],"correct":"habe","category":"perfekt"}$json$::jsonb, 5),
  ('grammar-perfekt-6', 'grammar-drill', $json${"prompt":"haben + ___ (machen)","options":["gemacht","gemachet","gemahct"],"correct":"gemacht","category":"perfekt"}$json$::jsonb, 6),
  ('grammar-perfekt-7', 'grammar-drill', $json${"prompt":"Du bist spät ___ (kommen).","options":["gekommen","gekomt","gekommt"],"correct":"gekommen","category":"perfekt"}$json$::jsonb, 7),
  ('grammar-perfekt-8', 'grammar-drill', $json${"prompt":"Hat es heute ___ (regnen)?","options":["geregnet","regent","geregent"],"correct":"geregnet","category":"perfekt"}$json$::jsonb, 8),
  ('grammar-perfekt-9', 'grammar-drill', $json${"prompt":"Ich habe dich gestern ___ (sehen).","options":["gesehen","sah","gesehent"],"correct":"gesehen","category":"perfekt"}$json$::jsonb, 9),
  ('grammar-perfekt-10', 'grammar-drill', $json${"prompt":"Sie ___ mit dem Zug gefahren. (sein or haben?)","options":["ist","hat"],"correct":"ist","category":"perfekt"}$json$::jsonb, 10),
  ('grammar-perfekt-11', 'grammar-drill', $json${"prompt":"haben + ___ (spielen)","options":["gespielt","gespieltet","gespilen"],"correct":"gespielt","category":"perfekt"}$json$::jsonb, 11)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── weakVerb (machen) ───────────────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-weakVerb-0', 'grammar-drill', $json${"prompt":"Ich ___ Kaffee. (machen)","options":["mache","machst","macht"],"correct":"mache","category":"weakVerb"}$json$::jsonb, 0),
  ('grammar-weakVerb-1', 'grammar-drill', $json${"prompt":"Du ___ die Arbeit. (machen)","options":["mache","machst","macht"],"correct":"machst","category":"weakVerb"}$json$::jsonb, 1),
  ('grammar-weakVerb-2', 'grammar-drill', $json${"prompt":"Er ___ Sport. (machen)","options":["mache","machst","macht"],"correct":"macht","category":"weakVerb"}$json$::jsonb, 2),
  ('grammar-weakVerb-3', 'grammar-drill', $json${"prompt":"Wir ___ Musik. (machen)","options":["machen","macht","mache"],"correct":"machen","category":"weakVerb"}$json$::jsonb, 3),
  ('grammar-weakVerb-4', 'grammar-drill', $json${"prompt":"Ihr ___ Hausaufgaben. (machen)","options":["machen","macht","mache"],"correct":"macht","category":"weakVerb"}$json$::jsonb, 4)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;
