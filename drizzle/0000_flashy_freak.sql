CREATE TABLE `inventory_records` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_revision` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation` text DEFAULT '' NOT NULL,
	`next_id` integer DEFAULT 1 NOT NULL
);
