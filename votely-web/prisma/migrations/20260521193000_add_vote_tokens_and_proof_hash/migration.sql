-- Add proof hash returned to voters after successful submission.
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "proof_hash" VARCHAR(100);

-- One-time voting tokens issued after identity verification.
CREATE TABLE IF NOT EXISTS "vote_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "election_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vote_tokens_token_hash_key" ON "vote_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "vote_tokens_user_id_election_id_used_at_idx" ON "vote_tokens"("user_id", "election_id", "used_at");
CREATE INDEX IF NOT EXISTS "vote_tokens_expires_at_idx" ON "vote_tokens"("expires_at");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vote_tokens_user_id_fkey') THEN
        ALTER TABLE "vote_tokens" ADD CONSTRAINT "vote_tokens_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vote_tokens_election_id_fkey') THEN
        ALTER TABLE "vote_tokens" ADD CONSTRAINT "vote_tokens_election_id_fkey"
            FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
