CREATE TABLE "monthly_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"ring" text NOT NULL,
	"target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "prayer_due" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "prayer_fill" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "prayer_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "commit_due" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "commit_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "commit_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "balance_due" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "balance_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "balance_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "prayers_on_time" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "items_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_days" ADD COLUMN "dhuhr" boolean;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "hijri_offset" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_challenges" ADD CONSTRAINT "monthly_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_challenges_user_month_idx" ON "monthly_challenges" USING btree ("user_id","month");--> statement-breakpoint
ALTER TABLE "monthly_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "users" SET "rewards_built_at" = NULL;