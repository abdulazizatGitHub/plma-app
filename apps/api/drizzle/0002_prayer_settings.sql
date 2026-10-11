ALTER TABLE "user_settings" ADD COLUMN "prayer_manual" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "jumuah_label" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "location_mode" text DEFAULT 'unset' NOT NULL;