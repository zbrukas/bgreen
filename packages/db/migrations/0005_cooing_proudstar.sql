CREATE TABLE "pt_cae" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"level" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_postal_codes" (
	"postal_code" text PRIMARY KEY NOT NULL,
	"freguesia" text,
	"concelho" text,
	"distrito" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pt_cae_description_idx" ON "pt_cae" USING btree ("description");--> statement-breakpoint
CREATE INDEX "pt_postal_codes_freguesia_idx" ON "pt_postal_codes" USING btree ("freguesia");