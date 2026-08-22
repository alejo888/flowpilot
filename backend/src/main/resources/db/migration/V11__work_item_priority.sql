ALTER TABLE work_items ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));
