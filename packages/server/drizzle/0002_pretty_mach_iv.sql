CREATE TABLE "scene_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"file_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "scene_items_game_scene_kind_key_unique" UNIQUE("game_id","scene_id","kind","key")
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"map_file_name" text NOT NULL,
	"mmf_data" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "scenes_game_id_key_unique" UNIQUE("game_id","key")
);
--> statement-breakpoint
ALTER TABLE "scene_items" ADD CONSTRAINT "scene_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_items" ADD CONSTRAINT "scene_items_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;