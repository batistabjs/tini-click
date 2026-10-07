-- Schema inicial da aplicação Tini Click
-- Banco: tiniclick
-- Compatível com o uso em server.js e com os scripts de seed em db-scripts/
-- (execução progressiva no MySQL: arquivos em /docker-entrypoint-initdb.d
--  rodam em ordem alfabética — por isso este arquivo usa o prefixo 00_)

CREATE DATABASE IF NOT EXISTS `tiniclick`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tiniclick`;

-- Links encurtados
-- short_code: usado como path (:shortCode) e gerado numericamente em getNextShortCode()
-- ban: nullable — seed usa NULL; a app grava false/0 e filtra `ban IS NULL OR ban = 0`
CREATE TABLE IF NOT EXISTS `links` (
  `id`           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `short_code`   VARCHAR(32)      NOT NULL,
  `original_url` VARCHAR(2048)    NOT NULL,
  `ban`          TINYINT(1)       NULL     DEFAULT NULL,
  `created_at`   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_links_short_code` (`short_code`),
  UNIQUE KEY `uk_links_original_url` (`original_url`),
  KEY `idx_links_ban` (`ban`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Palavras bloqueadas (blacklist_words)
-- Sem UNIQUE: o seed atual contém repetições (ex.: 'cassinos')
CREATE TABLE IF NOT EXISTS `blacklist_words` (
  `id`   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(255)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_blacklist_words_word` (`word`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Domínios bloqueados (blacklist_domains)
CREATE TABLE IF NOT EXISTS `blacklist_domains` (
  `id`     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `domain` VARCHAR(255)  NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_blacklist_domains_domain` (`domain`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
