CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"item_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"devices" integer DEFAULT 0 NOT NULL,
	"action" text
);
--> statement-breakpoint
CREATE TABLE "reminder_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"item_id" uuid,
	"date" date NOT NULL,
	"slot" text DEFAULT '' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"snooze_min" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "reminders_muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "snooze_min" integer;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "reminder_profiles" jsonb DEFAULT '{"low":{"enabled":false,"leadMin":0,"repeatEveryMin":null,"maxRepeats":0,"snoozeMin":10},"medium":{"enabled":true,"leadMin":0,"repeatEveryMin":null,"maxRepeats":0,"snoozeMin":10},"high":{"enabled":true,"leadMin":0,"repeatEveryMin":30,"maxRepeats":1,"snoozeMin":10},"critical":{"enabled":true,"leadMin":0,"repeatEveryMin":30,"maxRepeats":6,"snoozeMin":10}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "checkin_time" text DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "plan_tomorrow_at" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "morning_summary_at" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_queue" ADD CONSTRAINT "reminder_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_queue" ADD CONSTRAINT "reminder_queue_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_deliveries_user_idx" ON "reminder_deliveries" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_queue_user_key_idx" ON "reminder_queue" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "reminder_queue_due_idx" ON "reminder_queue" USING btree ("status","fire_at");--> statement-breakpoint
CREATE INDEX "reminders_item_idx" ON "reminders" USING btree ("item_id");--> statement-breakpoint
-- Server-only tables: RLS on with no policies (the API connects as owner).
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminder_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ENABLE ROW LEVEL SECURITY;
