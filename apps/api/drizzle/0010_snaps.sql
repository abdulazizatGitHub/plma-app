CREATE TABLE "snap_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" uuid NOT NULL,
	"user_b" uuid NOT NULL,
	"date" date NOT NULL,
	"a_sent" boolean DEFAULT false NOT NULL,
	"b_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snap_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_recipients" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "snap_days" ADD CONSTRAINT "snap_days_user_a_users_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_days" ADD CONSTRAINT "snap_days_user_b_users_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_nudges" ADD CONSTRAINT "snap_nudges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_nudges" ADD CONSTRAINT "snap_nudges_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "snap_days_pair_date_idx" ON "snap_days" USING btree ("user_a","user_b","date");--> statement-breakpoint
CREATE UNIQUE INDEX "snap_nudges_idx" ON "snap_nudges" USING btree ("user_id","friend_id","date");--> statement-breakpoint
ALTER TABLE "snap_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "snap_nudges" ENABLE ROW LEVEL SECURITY;