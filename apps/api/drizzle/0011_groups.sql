CREATE TABLE "bonus_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"points" integer NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_goal_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"met_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"tracking" text NOT NULL,
	"unit" text,
	"target" double precision NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reward" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"invited_user" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "group_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_snap_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'users' NOT NULL,
	"color" text DEFAULT 'sky' NOT NULL,
	"owner_id" uuid NOT NULL,
	"visibility" text DEFAULT 'members' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bonus_points" ADD CONSTRAINT "bonus_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_goal_results" ADD CONSTRAINT "group_goal_results_goal_id_group_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."group_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_goal_results" ADD CONSTRAINT "group_goal_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_goals" ADD CONSTRAINT "group_goals_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_goals" ADD CONSTRAINT "group_goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_user_users_id_fk" FOREIGN KEY ("invited_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_links" ADD CONSTRAINT "group_links_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_snap_days" ADD CONSTRAINT "group_snap_days_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_snap_days" ADD CONSTRAINT "group_snap_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_points_user_key_idx" ON "bonus_points" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "group_goal_results_pair_idx" ON "group_goal_results" USING btree ("goal_id","user_id");--> statement-breakpoint
CREATE INDEX "group_goals_group_idx" ON "group_goals" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_invites_pair_idx" ON "group_invites" USING btree ("group_id","invited_user");--> statement-breakpoint
CREATE INDEX "group_links_group_idx" ON "group_links" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_pair_idx" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_snap_days_idx" ON "group_snap_days" USING btree ("group_id","user_id","date");--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_goal_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bonus_points" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_snap_days" ENABLE ROW LEVEL SECURITY;
