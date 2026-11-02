CREATE TABLE "reward_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"due" integer DEFAULT 0 NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"perfect" boolean DEFAULT false NOT NULL,
	"all_prayers" boolean,
	"points" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rewards_built_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reward_days" ADD CONSTRAINT "reward_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_days_user_date_idx" ON "reward_days" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_user_badge_idx" ON "user_badges" USING btree ("user_id","badge_id");--> statement-breakpoint
ALTER TABLE "reward_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;