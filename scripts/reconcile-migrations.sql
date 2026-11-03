-- ============================================================================
-- Migration Ledger Reconciliation Script
-- Run with: npm run run-sql -- scripts/reconcile-migrations.sql
-- Or paste into Supabase Dashboard SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version      TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  executed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Repo files missing from ledger (may already be applied to DB)
SELECT 'MISSING_FROM_LEDGER' AS status, version
FROM (
  VALUES
    ('003_add_daily_quests_and_high_scores_tables'),
    ('004_vocabulary_expansion'),
    ('005_repair_sync_tables'),
    ('008_a1_path_state'),
    ('010_dynamic_curriculum'),
    ('011_content_items'),
    ('012_seed_content_items'),
    ('013_vocab_i18n_extras'),
    ('014_guard_article_quiz_pool'),
    ('015_vocab_filters'),
    ('016_notebooklm_vocab'),
    ('017_glossary_quality'),
    ('018_category_tags'),
    ('019_drop_stale_get_random_vocabulary'),
    ('020_increment_activity'),
    ('021_review_queue_error_tag'),
    ('20240520000000_initial_schema'),
    ('20240521000000_user_activity_days'),
    ('20260814000000_harden_database'),
    ('20260814010000_user_activity_days'),
    ('20260826000000_review_queue_id_text'),
    ('20260826164213_seed_uhrzeit_conversation_pools'),
    ('20260826182436_seed_uhrzeit_conversation_pools'),
    ('20260913210001_seed_uhrzeit_conversation_pools'),
    ('20260926170000_seed_grammar_drill_gap'),
    ('20260926190000_add_a1_path_state_path_mode'),
    ('20260927120000_add_profiles_plan'),
    ('20260927140000_seed_grammar_pools_v4'),
    ('20260928000000_security_lockdown'),
    ('20260928010000_drop_sm2_columns_leitner_only'),
    ('20260928020000_harden_review_queue_user_scope'),
    ('20260928030000_vocab_constraints_and_indexes'),
    ('20260928040000_drop_retired_vocabulary_category'),
    ('20260928050000_backfill_harden_triggers_and_lock_functions'),
    ('20260929000000_add_profiles_role_and_banned'),
    ('20260929010000_admin_tables'),
    ('20260929020000_admin_table_counts'),
    ('20260929025000_fix_privilege_guard_use_session_user'),
    ('20260930000000_admin_ban_reason'),
    ('20260930010000_seed_curriculum_source_flag'),
    ('20260930020000_curriculum_units'),
    ('20260930030000_seed_chatbot_config'),
    ('20260930150000_seed_content_pools'),
    ('20260930160000_announcement_banner'),
    ('20260930170000_vocabulary_audio_url'),
    ('20261001000000_admin_rpc_prerequisites'),
    ('20261001010000_admin_dashboard_kpis'),
    ('20261001020000_admin_analytics'),
    ('20261001030000_admin_users_page'),
    ('20261001040000_admin_audit_and_queue_pages'),
    ('20261001050000_vocab_levels'),
    ('20261001060000_admin_user_detail'),
    ('20261002000000_lesson_render_run')
) AS v(version)
WHERE NOT EXISTS (
  SELECT 1 FROM supabase_migrations.schema_migrations sm
  WHERE sm.version = v.version
);

-- 2. Ledger entries with no repo file
SELECT 'NO_REPO_FILE' AS status, sm.version, sm.name, sm.executed_at
FROM supabase_migrations.schema_migrations sm
WHERE sm.version NOT LIKE '%\_%' ESCAPE '\'
  AND sm.version NOT IN (
    '003_add_daily_quests_and_high_scores_tables',
    '004_vocabulary_expansion',
    '005_repair_sync_tables',
    '008_a1_path_state',
    '010_dynamic_curriculum',
    '011_content_items',
    '012_seed_content_items',
    '013_vocab_i18n_extras',
    '014_guard_article_quiz_pool',
    '015_vocab_filters',
    '016_notebooklm_vocab',
    '017_glossary_quality',
    '018_category_tags',
    '019_drop_stale_get_random_vocabulary',
    '020_increment_activity',
    '021_review_queue_error_tag',
    '20240520000000_initial_schema',
    '20240521000000_user_activity_days',
    '20260814000000_harden_database',
    '20260814010000_user_activity_days',
    '20260826000000_review_queue_id_text',
    '20260826164213_seed_uhrzeit_conversation_pools',
    '20260826182436_seed_uhrzeit_conversation_pools',
    '20260913210001_seed_uhrzeit_conversation_pools',
    '20260926170000_seed_grammar_drill_gap',
    '20260926190000_add_a1_path_state_path_mode',
    '20260927120000_add_profiles_plan',
    '20260927140000_seed_grammar_pools_v4',
    '20260928000000_security_lockdown',
    '20260928010000_drop_sm2_columns_leitner_only',
    '20260928020000_harden_review_queue_user_scope',
    '20260928030000_vocab_constraints_and_indexes',
    '20260928040000_drop_retired_vocabulary_category',
    '20260928050000_backfill_harden_triggers_and_lock_functions',
    '20260929000000_add_profiles_role_and_banned',
    '20260929010000_admin_tables',
    '20260929020000_admin_table_counts',
    '20260929025000_fix_privilege_guard_use_session_user',
    '20260930000000_admin_ban_reason',
    '20260930010000_seed_curriculum_source_flag',
    '20260930020000_curriculum_units',
    '20260930030000_seed_chatbot_config',
    '20260930150000_seed_content_pools',
    '20260930160000_announcement_banner',
    '20260930170000_vocabulary_audio_url',
    '20261001000000_admin_rpc_prerequisites',
    '20261001010000_admin_dashboard_kpis',
    '20261001020000_admin_analytics',
    '20261001030000_admin_users_page',
    '20261001040000_admin_audit_and_queue_pages',
    '20261001050000_vocab_levels',
    '20261001060000_admin_user_detail',
    '20261002000000_lesson_render_run'
);

-- 3. Safe INSERT statements (UNCOMMENT and run only for verified-applied migrations)
/*
INSERT INTO supabase_migrations.schema_migrations (version, name, executed_at) VALUES
  ('20260926190000', 'add_a1_path_state_path_mode', now()),
  ('20260927120000', 'add_profiles_plan', now())
ON CONFLICT (version) DO NOTHING;
*/