CREATE TRIGGER `session_require_site_guest_account`
BEFORE INSERT ON `session`
WHEN EXISTS (
	SELECT 1 FROM `user`
	WHERE `id` = NEW.`user_id` AND instr(',' || `role` || ',', ',guest,') > 0
)
AND NOT EXISTS (
	SELECT 1 FROM `account`
	WHERE `user_id` = NEW.`user_id` AND `account_id` = NEW.`user_id` AND `provider_id` = 'vitehub-site-guest'
)
BEGIN
	SELECT RAISE(ABORT, 'Site access guest sessions require an ownership record');
END;
--> statement-breakpoint
DELETE FROM `session`
WHERE `user_id` IN (
	SELECT `user`.`id` FROM `user`
	WHERE instr(',' || `user`.`role` || ',', ',guest,') > 0
	AND NOT EXISTS (
		SELECT 1 FROM `account`
		WHERE `user_id` = `user`.`id` AND `account_id` = `user`.`id` AND `provider_id` = 'vitehub-site-guest'
	)
);
