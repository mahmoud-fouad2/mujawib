ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account"
SET "issuer" = 'local:credential', "account_id" = "user_id"
WHERE "provider_id" = 'credential';--> statement-breakpoint
UPDATE "account"
SET "issuer" = 'https://accounts.google.com'
WHERE "provider_id" = 'google';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "account" WHERE "issuer" IS NULL OR "issuer" = '') THEN
    RAISE EXCEPTION 'Account issuer backfill requires an explicit provider mapping';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "account"
    GROUP BY "issuer", "account_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Account issuer backfill found duplicate identities';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");
