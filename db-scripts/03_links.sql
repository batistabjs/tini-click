-- INSERT IGNORE: não falha se o seed já tiver sido executado (UNIQUE em short_code/original_url)
INSERT IGNORE INTO tiniclick.links (short_code, original_url, ban, created_at) VALUES
	 ('0', 'https://github.com/batistabjs', NULL, '2025-10-10 16:57:53');
