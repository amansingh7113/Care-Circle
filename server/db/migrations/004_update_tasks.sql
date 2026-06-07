ALTER TABLE tasks ADD COLUMN category TEXT;
ALTER TABLE tasks ADD COLUMN due_date TEXT;

ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'pending';
UPDATE tasks SET status = 'pending' WHERE status = 'TODO';
