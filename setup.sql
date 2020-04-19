SET @ORIG_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

SET @ORIG_UNIQUE_CHECKS = @@UNIQUE_CHECKS;
SET UNIQUE_CHECKS = 0;

SET @ORIG_TIME_ZONE = @@TIME_ZONE;
SET TIME_ZONE = '+00:00';

SET @ORIG_SQL_MODE = @@SQL_MODE;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';



CREATE DATABASE IF NOT EXISTS `thefifthworld` DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_general_ci;
USE `thefifthworld`;




CREATE TABLE `members` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` char(60) DEFAULT NULL,
  `bio` longtext,
  `facebook` varchar(128) DEFAULT NULL,
  `twitter` varchar(128) DEFAULT NULL,
  `github` varchar(128) DEFAULT NULL,
  `patreon` varchar(128) DEFAULT NULL,
  `web` varchar(128) DEFAULT NULL,
  `active` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `admin` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `invitations` int(11) unsigned NOT NULL DEFAULT '5',
  `reset` int(1) unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8;


CREATE TABLE `authorizations` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `member` int(11) unsigned NOT NULL,
  `provider` varchar(15) NOT NULL DEFAULT '',
  `oauth2_id` varchar(255) DEFAULT NULL,
  `oauth2_token` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `authMember` (`member`),
  CONSTRAINT `authMember` FOREIGN KEY (`member`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `changes` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `page` int(11) unsigned NOT NULL DEFAULT '0',
  `editor` int(10) unsigned NOT NULL DEFAULT '0',
  `timestamp` int(32) unsigned NOT NULL DEFAULT '0',
  `msg` varchar(256) DEFAULT NULL,
  `json` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `changePage` (`page`),
  CONSTRAINT `changePage` FOREIGN KEY (`page`) REFERENCES `pages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `communities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `data` longtext,
  `complete` tinyint(1) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `files` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) DEFAULT NULL,
  `thumbnail` varchar(128) DEFAULT NULL,
  `mime` varchar(128) DEFAULT NULL,
  `size` int(128) unsigned DEFAULT '0',
  `page` int(11) unsigned DEFAULT '0',
  `timestamp` int(32) unsigned DEFAULT '0',
  `uploader` int(11) unsigned DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `filePage` (`page`),
  CONSTRAINT `filePage` FOREIGN KEY (`page`) REFERENCES `pages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `invitations` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `inviteFrom` int(11) unsigned NOT NULL,
  `inviteTo` int(11) unsigned NOT NULL,
  `inviteCode` varchar(128) NOT NULL DEFAULT '',
  `accepted` tinyint(1) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `likes` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `path` varchar(256) NOT NULL DEFAULT '',
  `page` int(11) unsigned NOT NULL DEFAULT '0',
  `member` int(11) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `links` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `src` int(10) unsigned NOT NULL DEFAULT '0',
  `dest` int(10) unsigned DEFAULT '0',
  `title` varchar(128) DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `linkSrc` (`src`),
  KEY `linkDest` (`dest`),
  CONSTRAINT `linkSrc` FOREIGN KEY (`src`) REFERENCES `pages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `messages` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `member` int(10) unsigned NOT NULL DEFAULT '0',
  `type` enum('warning','error','info','confirmation') NOT NULL DEFAULT 'info',
  `message` varchar(512) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `messageMember` (`member`),
  CONSTRAINT `messageMember` FOREIGN KEY (`member`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `pages` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(256) DEFAULT NULL,
  `description` varchar(240) NOT NULL DEFAULT 'Four hundred years from now, humanity thrives beyond civilization.',
  `image` varchar(256) DEFAULT NULL,
  `header` varchar(256) DEFAULT NULL,
  `slug` varchar(256) NOT NULL DEFAULT '',
  `path` varchar(256) NOT NULL DEFAULT '',
  `parent` int(11) unsigned DEFAULT '0',
  `type` varchar(128) DEFAULT NULL,
  `permissions` smallint(5) unsigned NOT NULL DEFAULT '777',
  `owner` int(11) unsigned DEFAULT '0',
  `depth` tinyint(3) unsigned DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `path` (`path`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `places` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `page` int(11) unsigned NOT NULL DEFAULT '0',
  `location` point NOT NULL,
  PRIMARY KEY (`id`),
  SPATIAL KEY `location` (`location`),
  KEY `placePage` (`page`),
  CONSTRAINT `placePage` FOREIGN KEY (`page`) REFERENCES `pages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


CREATE TABLE `responses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form` varchar(128) NOT NULL DEFAULT '',
  `data` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `sequence` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL DEFAULT '',
  `page` int(11) NOT NULL DEFAULT '0',
  `order` int(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `tags` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `page` int(11) unsigned DEFAULT '0',
  `tag` varchar(128) DEFAULT NULL,
  `value` varchar(240) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tagPage` (`page`),
  CONSTRAINT `tagPage` FOREIGN KEY (`page`) REFERENCES `pages` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;


SET FOREIGN_KEY_CHECKS = @ORIG_FOREIGN_KEY_CHECKS;

SET UNIQUE_CHECKS = @ORIG_UNIQUE_CHECKS;

SET @ORIG_TIME_ZONE = @@TIME_ZONE;
SET TIME_ZONE = @ORIG_TIME_ZONE;

SET SQL_MODE = @ORIG_SQL_MODE;
