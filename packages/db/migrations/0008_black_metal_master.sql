CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"definition_id" text NOT NULL,
	"definition_version" integer DEFAULT 1 NOT NULL,
	"current_state" jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "record_templates" ADD COLUMN "workflow_definition_id" text DEFAULT 'two-step-review' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_instances_entity_idx" ON "workflow_instances" USING btree ("entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "workflow_instances_org_idx" ON "workflow_instances" USING btree ("organization_id");