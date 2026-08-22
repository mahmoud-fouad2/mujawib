ALTER TYPE "public"."call_status" ADD VALUE 'completed_no_transcript' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE 'route_failed' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE 'accept_failed' BEFORE 'failed';