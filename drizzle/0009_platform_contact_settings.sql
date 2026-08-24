CREATE TABLE "platform_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"email_confirmed" boolean DEFAULT false NOT NULL,
	"phone_e164" text,
	"phone_display" text,
	"phone_confirmed" boolean DEFAULT false NOT NULL,
	"whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
-- Seeded unconfirmed: these are the values lib/content/contact.ts carried as
-- plain constants (hello@mujawib.com, a placeholder phone), never verified as
-- receiving mail or reachable on WhatsApp. The site must not show either as a
-- live channel until an operator confirms them from /console/system.
INSERT INTO "platform_contact"
  ("id", "email", "email_confirmed", "phone_e164", "phone_display", "phone_confirmed", "whatsapp_enabled")
VALUES
  ('default', 'hello@mujawib.com', false, '+966920012130', '+966 920 012 130', false, false)
ON CONFLICT ("id") DO NOTHING;
