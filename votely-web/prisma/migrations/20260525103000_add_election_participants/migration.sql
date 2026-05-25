CREATE TABLE IF NOT EXISTS "election_participants" (
    "id" TEXT NOT NULL,
    "election_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "election_participants_election_id_user_id_key" ON "election_participants"("election_id", "user_id");

CREATE INDEX IF NOT EXISTS "election_participants_user_id_idx" ON "election_participants"("user_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'election_participants_election_id_fkey') THEN
        ALTER TABLE "election_participants" ADD CONSTRAINT "election_participants_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'election_participants_user_id_fkey') THEN
        ALTER TABLE "election_participants" ADD CONSTRAINT "election_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
