DELETE FROM `runs`;--> statement-breakpoint
ALTER TABLE `runs` DROP COLUMN `task`;--> statement-breakpoint
ALTER TABLE `runs` DROP COLUMN `agent`;