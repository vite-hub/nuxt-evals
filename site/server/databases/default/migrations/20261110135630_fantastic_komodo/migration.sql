CREATE TABLE `vitehub_comment_counters` (
	`scope` text PRIMARY KEY NOT NULL,
	`next` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vitehub_comment_forge` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
	`repository` text NOT NULL,
	`pull_request` integer NOT NULL,
	`remote_id` text,
	`node_id` text,
	`url` text,
	`digest` text,
	`posted_as` text,
	`minimized` integer DEFAULT false NOT NULL,
	`error` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vitehub_comment_forge_thread` ON `vitehub_comment_forge` (`thread_id`);--> statement-breakpoint
CREATE INDEX `vitehub_comment_forge_pull_request` ON `vitehub_comment_forge` (`repository`,`pull_request`);--> statement-breakpoint
CREATE TABLE `vitehub_comment_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text,
	`author_image` text,
	`actor` text,
	`mentions` text NOT NULL,
	`attachments` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer
);
--> statement-breakpoint
CREATE INDEX `vitehub_comment_messages_thread` ON `vitehub_comment_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `vitehub_comment_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`n` integer NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`anchor` text NOT NULL,
	`status` text NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`author_id` text NOT NULL,
	`author_name` text,
	`author_image` text,
	`actor` text,
	`metadata` text,
	`context` text,
	`revision` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vitehub_comment_threads_scope_n` ON `vitehub_comment_threads` (`scope`,`n`);--> statement-breakpoint
CREATE INDEX `vitehub_comment_threads_subject` ON `vitehub_comment_threads` (`subject_kind`,`subject_id`);--> statement-breakpoint
CREATE INDEX `vitehub_comment_threads_status` ON `vitehub_comment_threads` (`status`,`updated_at`);