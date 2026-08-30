-- AI-assisted user story generation (spec: work-items).
-- Structured acceptance criteria stored as an ordered JSON array via a JPA
-- AttributeConverter<List<String>, String>; NOT a child table, never folded
-- into description. Client-asserted AI provenance for items created from a
-- confirmed AI draft. All three columns have defaults, so no backfill and no
-- table-rewrite lock at demo scale; the optimistic-locking `version` column
-- (V16) is untouched.
ALTER TABLE work_items
    ADD COLUMN acceptance_criteria jsonb        NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN ai_generated        boolean      NOT NULL DEFAULT false,
    ADD COLUMN ai_model            varchar(120);
