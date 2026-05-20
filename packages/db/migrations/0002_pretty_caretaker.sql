CREATE TYPE "public"."organization_size" AS ENUM('micro', 'pequena', 'media', 'grande');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "nif" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "self_reported_size" "organization_size";--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_nif_unique" UNIQUE("nif");