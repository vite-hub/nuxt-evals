CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite` text NOT NULL,
	`task` text NOT NULL,
	`agent` text NOT NULL,
	`model` text NOT NULL,
	`reasoning` text NOT NULL,
	`setup` text NOT NULL,
	`repeat` integer NOT NULL,
	`status` text NOT NULL,
	`score` real NOT NULL,
	`started_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`usage` text NOT NULL,
	`probes` text NOT NULL,
	`diagnostics` text NOT NULL,
	`final_text` text NOT NULL
);
