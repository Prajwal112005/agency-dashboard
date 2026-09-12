-- Every task must have a description and a Developer assignee.
-- Existing legacy rows may have nullable descriptions; preserve them with a
-- deterministic fallback before enforcing NOT NULL.
UPDATE "Task"
SET "description" = CONCAT('Work item for ', LOWER("title"), '.')
WHERE "description" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "description" SET NOT NULL;

-- Existing rows with no assignee cannot be safely assigned automatically.
-- Fail the migration rather than inventing ownership; fresh seeded installs
-- already satisfy this invariant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Task" WHERE "assignedToId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce Task.assignedToId NOT NULL: existing tasks are unassigned';
  END IF;
END $$;

ALTER TABLE "Task" DROP CONSTRAINT "Task_assignedToId_fkey";
ALTER TABLE "Task" ALTER COLUMN "assignedToId" SET NOT NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
