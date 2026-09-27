-- Migration: 20260927140000_seed_grammar_pools_v4.sql
--
-- Seeds the v4.0 grammar pools into public.content_items so the ONLINE pool
-- matches the bundled offline snapshot (src/data/content-pools.json).
--
-- WHY THIS EXISTS
-- ---------------
-- supabaseCurriculumService.getGrammarDrills() is CLOUD-FIRST with a local
-- fallback: it only reads src/data/content-pools.json when the content_items
-- fetch FAILS. Editing the snapshot alone therefore changes nothing for a
-- signed-in learner on a working connection — the cloud copy wins.
--
-- The cloud pool still held only the 8 baseline categories (52 drills), so:
--   · M08's new word-order items resolved to 0 and the deck rendered
--     "8 questions" instead of the 12 the unit declares;
--   · M05 kein, M07 prepositions, M11 demonstrative and M12 dative
--     would all have drawn from an EMPTY pool;
--   · M13 draws 6 without replacement from a 4-item modals pool, so it
--     cycled and repeated items inside one sitting.
--
-- SCOPE
-- -----
-- Adds rows to the EXISTING content_items table, reusing the existing
-- content_items + Dexie cache path. No new table, no new curriculum pipeline
-- (.clinerules Part H). Ids match the generator's grammar-<category>-<n>
-- scheme so the cold-start Dexie seed and the cloud cache dedupe onto the SAME
-- primary key instead of storing each drill twice.
--
-- Idempotent (ON CONFLICT DO UPDATE), so re-running is safe and this also
-- repairs a partial pool in place. modals is re-upserted in full because it
-- GREW; the six new rows are new ids and the four existing ones are corrected.

-- ── dative (10 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-dative-0', 'grammar-drill', $json${"prompt":"Ich fahre ___ Bus. (mit)","options":["mit dem","mit der","mit den"],"correct":"mit dem","category":"dative"}$json$::jsonb, 0),
  ('grammar-dative-1', 'grammar-drill', $json${"prompt":"Wir treffen uns ___ Bahnhof. (an)","options":["am","an dem","auf dem"],"correct":"am","category":"dative"}$json$::jsonb, 1),
  ('grammar-dative-2', 'grammar-drill', $json${"prompt":"Sie arbeitet ___ Computer. (an)","options":["am","an der","im"],"correct":"am","category":"dative"}$json$::jsonb, 2),
  ('grammar-dative-3', 'grammar-drill', $json${"prompt":"Das Kind spielt ___ Garten. (in)","options":["im","in dem","in den"],"correct":"im","category":"dative"}$json$::jsonb, 3),
  ('grammar-dative-4', 'grammar-drill', $json${"prompt":"Ich gehe ___ Arbeit. (zu)","options":["zur","zu der","zum"],"correct":"zur","category":"dative"}$json$::jsonb, 4),
  ('grammar-dative-5', 'grammar-drill', $json${"prompt":"Er geht ___ Strand. (zu)","options":["zum","zur","zu dem"],"correct":"zum","category":"dative"}$json$::jsonb, 5),
  ('grammar-dative-6', 'grammar-drill', $json${"prompt":"Die Kinder gehen ___ Schule. (zu)","options":["zur","zum","zu den"],"correct":"zur","category":"dative"}$json$::jsonb, 6),
  ('grammar-dative-7', 'grammar-drill', $json${"prompt":"Wie geht es ___? (to me)","options":["dir","Sie","ihnen"],"correct":"dir","category":"dative"}$json$::jsonb, 7),
  ('grammar-dative-8', 'grammar-drill', $json${"prompt":"Ich gebe ___ Bruder das Buch.","options":["meinem","mein","meine"],"correct":"meinem","category":"dative"}$json$::jsonb, 8),
  ('grammar-dative-9', 'grammar-drill', $json${"prompt":"Wir trinken ___ Tee. (mit)","options":["mit dem","mit der","mit das"],"correct":"mit dem","category":"dative"}$json$::jsonb, 9)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── prepositions (8 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-prepositions-0', 'grammar-drill', $json${"prompt":"Ich gehe ___ Park. (in — movement)","options":["in den","im","in dem"],"correct":"in den","category":"prepositions"}$json$::jsonb, 0),
  ('grammar-prepositions-1', 'grammar-drill', $json${"prompt":"Ich bin ___ Park. (in — location)","options":["im","in den","in das"],"correct":"im","category":"prepositions"}$json$::jsonb, 1),
  ('grammar-prepositions-2', 'grammar-drill', $json${"prompt":"Die Flasche steht ___ Tisch. (an — location)","options":["auf dem","auf den","in dem"],"correct":"auf dem","category":"prepositions"}$json$::jsonb, 2),
  ('grammar-prepositions-3', 'grammar-drill', $json${"prompt":"Er stellt die Flasche ___ Tisch. (an — movement)","options":["auf den","auf dem","im"],"correct":"auf den","category":"prepositions"}$json$::jsonb, 3),
  ('grammar-prepositions-4', 'grammar-drill', $json${"prompt":"in + das =","options":["im","am","zum"],"correct":"im","category":"prepositions"}$json$::jsonb, 4),
  ('grammar-prepositions-5', 'grammar-drill', $json${"prompt":"zu + das =","options":["zum","zur","im"],"correct":"zum","category":"prepositions"}$json$::jsonb, 5),
  ('grammar-prepositions-6', 'grammar-drill', $json${"prompt":"zu + die =","options":["zur","zum","am"],"correct":"zur","category":"prepositions"}$json$::jsonb, 6),
  ('grammar-prepositions-7', 'grammar-drill', $json${"prompt":"an + dem =","options":["am","im","ans"],"correct":"am","category":"prepositions"}$json$::jsonb, 7)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── v2 (6 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-v2-0', 'grammar-drill', $json${"prompt":"Heute ___ ich Deutsch. (lernen)","options":["lerne","lernst","lernt"],"correct":"lerne","category":"v2"}$json$::jsonb, 0),
  ('grammar-v2-1', 'grammar-drill', $json${"prompt":"In der Nacht ___ ich. (schlafen)","options":["schlafe","schläft","schlafen"],"correct":"schlafe","category":"v2"}$json$::jsonb, 1),
  ('grammar-v2-2', 'grammar-drill', $json${"prompt":"Morgen ___ wir nach Berlin. (fahren)","options":["fahren","fahrt","fährt"],"correct":"fahren","category":"v2"}$json$::jsonb, 2),
  ('grammar-v2-3', 'grammar-drill', $json${"prompt":"___ ist Montag. (today)","options":["Heute","Ich","Montag"],"correct":"Heute","category":"v2"}$json$::jsonb, 3),
  ('grammar-v2-4', 'grammar-drill', $json${"prompt":"___ trinke ich Kaffee. (tomorrow)","options":["Morgen","Ich","Kaffee"],"correct":"Morgen","category":"v2"}$json$::jsonb, 4),
  ('grammar-v2-5', 'grammar-drill', $json${"prompt":"Am Montag ___ er zur Schule. (gehen)","options":["geht","gehe","gehst"],"correct":"geht","category":"v2"}$json$::jsonb, 5)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── accusative (8 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-accusative-0', 'grammar-drill', $json${"prompt":"Ich schreibe ___ Brief.","options":["einen","ein","keinen"],"correct":"einen","category":"accusative"}$json$::jsonb, 0),
  ('grammar-accusative-1', 'grammar-drill', $json${"prompt":"Ich trinke ___ Kaffee.","options":["einen","ein","der"],"correct":"einen","category":"accusative"}$json$::jsonb, 1),
  ('grammar-accusative-2', 'grammar-drill', $json${"prompt":"Ich kaufe ___ Apfel.","options":["einen","ein","keine"],"correct":"einen","category":"accusative"}$json$::jsonb, 2),
  ('grammar-accusative-3', 'grammar-drill', $json${"prompt":"Ich habe ___ Hund.","options":["keinen","kein","eine"],"correct":"keinen","category":"accusative"}$json$::jsonb, 3),
  ('grammar-accusative-4', 'grammar-drill', $json${"prompt":"Ich lese ___ Buch.","options":["ein","einen","keine"],"correct":"ein","category":"accusative"}$json$::jsonb, 4),
  ('grammar-accusative-5', 'grammar-drill', $json${"prompt":"Ich trinke ___ Wasser.","options":["kein","einen","eine"],"correct":"kein","category":"accusative"}$json$::jsonb, 5),
  ('grammar-accusative-6', 'grammar-drill', $json${"prompt":"Ich schreibe ___ E-Mail.","options":["eine","einen","ein"],"correct":"eine","category":"accusative"}$json$::jsonb, 6),
  ('grammar-accusative-7', 'grammar-drill', $json${"prompt":"Ich mag ___ Salat.","options":["einen","ein","kein"],"correct":"einen","category":"accusative"}$json$::jsonb, 7)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── kein (6 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-kein-0', 'grammar-drill', $json${"prompt":"Ich habe ___ Tisch.","options":["keinen","kein","nicht"],"correct":"keinen","category":"kein"}$json$::jsonb, 0),
  ('grammar-kein-1', 'grammar-drill', $json${"prompt":"Ich habe ___ Zeit.","options":["keine","kein","nicht"],"correct":"keine","category":"kein"}$json$::jsonb, 1),
  ('grammar-kein-2', 'grammar-drill', $json${"prompt":"Ich habe ___ Geld.","options":["kein","keine","nicht"],"correct":"kein","category":"kein"}$json$::jsonb, 2),
  ('grammar-kein-3', 'grammar-drill', $json${"prompt":"Das ist ___ Apfel.","options":["kein","keinen","nicht"],"correct":"kein","category":"kein"}$json$::jsonb, 3),
  ('grammar-kein-4', 'grammar-drill', $json${"prompt":"Der Tisch ist ___ groß.","options":["nicht","kein","keine"],"correct":"nicht","category":"kein"}$json$::jsonb, 4),
  ('grammar-kein-5', 'grammar-drill', $json${"prompt":"Ich ___ nicht Auto fahren. (können)","options":["kann","kein","keine"],"correct":"kann","category":"kein"}$json$::jsonb, 5)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── possessive (6 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-possessive-0', 'grammar-drill', $json${"prompt":"___ Vater heißt Hari.","options":["Mein","Meine","Meins"],"correct":"Mein","category":"possessive"}$json$::jsonb, 0),
  ('grammar-possessive-1', 'grammar-drill', $json${"prompt":"___ Mutter kocht gut.","options":["Meine","Mein","Meins"],"correct":"Meine","category":"possessive"}$json$::jsonb, 1),
  ('grammar-possessive-2', 'grammar-drill', $json${"prompt":"___ Kinder spielen im Garten.","options":["Meine","Mein","Meinen"],"correct":"Meine","category":"possessive"}$json$::jsonb, 2),
  ('grammar-possessive-3', 'grammar-drill', $json${"prompt":"___ Bruder ist Lehrer.","options":["Mein","Meine","Meinen"],"correct":"Mein","category":"possessive"}$json$::jsonb, 3),
  ('grammar-possessive-4', 'grammar-drill', $json${"prompt":"Wie heißt ___ Name?","options":["Ihr","Ihre","ihr"],"correct":"Ihr","category":"possessive"}$json$::jsonb, 4),
  ('grammar-possessive-5', 'grammar-drill', $json${"prompt":"___ Hund heißt Bello.","options":["Mein","Meine","Meinen"],"correct":"Mein","category":"possessive"}$json$::jsonb, 5)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── demonstrative (6 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-demonstrative-0', 'grammar-drill', $json${"prompt":"___ Pullover ist blau.","options":["Dieser","Diese","Dieses"],"correct":"Dieser","category":"demonstrative"}$json$::jsonb, 0),
  ('grammar-demonstrative-1', 'grammar-drill', $json${"prompt":"___ Jacke ist schön.","options":["Diese","Dieser","Dieses"],"correct":"Diese","category":"demonstrative"}$json$::jsonb, 1),
  ('grammar-demonstrative-2', 'grammar-drill', $json${"prompt":"___ Hemd ist weiß.","options":["Dieses","Dieser","Diese"],"correct":"Dieses","category":"demonstrative"}$json$::jsonb, 2),
  ('grammar-demonstrative-3', 'grammar-drill', $json${"prompt":"Ich nehme ___ Saal.","options":["diesen","dieser","diese"],"correct":"diesen","category":"demonstrative"}$json$::jsonb, 3),
  ('grammar-demonstrative-4', 'grammar-drill', $json${"prompt":"___ Schuhe sind neu.","options":["Diese","Dieser","Dieses"],"correct":"Diese","category":"demonstrative"}$json$::jsonb, 4),
  ('grammar-demonstrative-5', 'grammar-drill', $json${"prompt":"___ Buch ist interessant.","options":["Dieses","Diese","Dieser"],"correct":"Dieses","category":"demonstrative"}$json$::jsonb, 5)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── wordOrder (6 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-wordOrder-0', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["Heute lerne ich Deutsch.","Ich lerne heute Deutsch.","Heute ich lerne Deutsch."],"correct":"Heute lerne ich Deutsch.","category":"wordOrder"}$json$::jsonb, 0),
  ('grammar-wordOrder-1', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["Morgen fahren wir nach Berlin.","Morgen wir fahren nach Berlin.","Fahren wir morgen nach Berlin."],"correct":"Morgen fahren wir nach Berlin.","category":"wordOrder"}$json$::jsonb, 1),
  ('grammar-wordOrder-2', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["In der Nacht schlafe ich.","In der Nacht ich schlafe.","Ich schlafe in der Nacht."],"correct":"In der Nacht schlafe ich.","category":"wordOrder"}$json$::jsonb, 2),
  ('grammar-wordOrder-3', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["Am Montag geht er zur Schule.","Am Montag er geht zur Schule.","Geht er am Montag zur Schule."],"correct":"Am Montag geht er zur Schule.","category":"wordOrder"}$json$::jsonb, 3),
  ('grammar-wordOrder-4', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["Heute trinke ich Kaffee.","Heute ich trinke Kaffee.","Ich trinke heute Kaffee."],"correct":"Heute trinke ich Kaffee.","category":"wordOrder"}$json$::jsonb, 4),
  ('grammar-wordOrder-5', 'grammar-drill', $json${"prompt":"Which sentence is correct?","options":["Im Sommer fahren wir ans Meer.","Im Sommer wir fahren ans Meer.","Fahren wir im Sommer ans Meer."],"correct":"Im Sommer fahren wir ans Meer.","category":"wordOrder"}$json$::jsonb, 5)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;

-- ── modals (10 drills) ───────────────────────────────────────────
INSERT INTO public.content_items (id, content_type, payload, sort) VALUES
  ('grammar-modals-0', 'grammar-drill', $json${"prompt":"Ich ___ gut schwimmen. (können)","options":["kann","kannst","könne"],"correct":"kann","category":"modals"}$json$::jsonb, 0),
  ('grammar-modals-1', 'grammar-drill', $json${"prompt":"Du ___ heute Hausaufgaben machen. (müssen)","options":["musst","müsst","müsse"],"correct":"musst","category":"modals"}$json$::jsonb, 1),
  ('grammar-modals-2', 'grammar-drill', $json${"prompt":"Er ___ ein Auto kaufen. (wollen)","options":["will","willst","wollen"],"correct":"will","category":"modals"}$json$::jsonb, 2),
  ('grammar-modals-3', 'grammar-drill', $json${"prompt":"Wir ___ hier nicht rauchen. (dürfen)","options":["dürfen","darft","dürft"],"correct":"dürfen","category":"modals"}$json$::jsonb, 3),
  ('grammar-modals-4', 'grammar-drill', $json${"prompt":"Ihr ___ jetzt gehen. (müssen)","options":["müsst","musst","müssen"],"correct":"müsst","category":"modals"}$json$::jsonb, 4),
  ('grammar-modals-5', 'grammar-drill', $json${"prompt":"Sie ___ gut sprechen. (können)","options":["können","könnt","kann"],"correct":"können","category":"modals"}$json$::jsonb, 5),
  ('grammar-modals-6', 'grammar-drill', $json${"prompt":"Ich ___ nicht kommen. (wollen)","options":["will","wollen","willst"],"correct":"will","category":"modals"}$json$::jsonb, 6),
  ('grammar-modals-7', 'grammar-drill', $json${"prompt":"Du ___ das machen. (sollen)","options":["sollst","soll","sollen"],"correct":"sollst","category":"modals"}$json$::jsonb, 7),
  ('grammar-modals-8', 'grammar-drill', $json${"prompt":"Er ___ ein Gespräch führen. (können)","options":["kann","könnt","können"],"correct":"kann","category":"modals"}$json$::jsonb, 8),
  ('grammar-modals-9', 'grammar-drill', $json${"prompt":"Wir ___ hier bleiben. (müssen)","options":["müssen","müsst","muss"],"correct":"müssen","category":"modals"}$json$::jsonb, 9)
ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;
