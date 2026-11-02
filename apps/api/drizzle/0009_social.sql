CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker" uuid NOT NULL,
	"blocked" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" uuid NOT NULL,
	"user_b" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invite_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "kudos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"from_user" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "podium_periods" (
	"period" text PRIMARY KEY NOT NULL,
	"finalized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visibility_allow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_color" text;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_users_id_fk" FOREIGN KEY ("blocker") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_users_id_fk" FOREIGN KEY ("blocked") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_users_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_users_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kudos" ADD CONSTRAINT "kudos_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_recipients" ADD CONSTRAINT "share_recipients_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_recipients" ADD CONSTRAINT "share_recipients_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_allow" ADD CONSTRAINT "visibility_allow_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_allow" ADD CONSTRAINT "visibility_allow_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_pair_idx" ON "blocks" USING btree ("blocker","blocked");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_idx" ON "friendships" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "friendships_b_idx" ON "friendships" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "invite_links_user_idx" ON "invite_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kudos_pair_idx" ON "kudos" USING btree ("share_id","from_user");--> statement-breakpoint
CREATE UNIQUE INDEX "share_recipients_pair_idx" ON "share_recipients" USING btree ("share_id","recipient_id");--> statement-breakpoint
CREATE INDEX "share_recipients_recipient_idx" ON "share_recipients" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "shares_sender_idx" ON "shares" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "visibility_allow_pair_idx" ON "visibility_allow" USING btree ("owner_id","friend_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invite_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visibility_allow" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "share_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kudos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "podium_periods" ENABLE ROW LEVEL SECURITY;
