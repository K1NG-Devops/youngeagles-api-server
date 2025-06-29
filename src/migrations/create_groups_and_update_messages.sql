-- Create groups table
CREATE TABLE IF NOT EXISTS `groups` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `avatar_url` VARCHAR(255),
  `type` ENUM('class', 'staff', 'parents', 'custom') DEFAULT 'custom',
  FOREIGN KEY (`created_by`) REFERENCES `staff` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create group members table
CREATE TABLE IF NOT EXISTS `group_members` (
  `group_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_type` ENUM('parent', 'teacher', 'admin', 'contact') NOT NULL,
  `role` ENUM('member', 'admin') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`, `user_id`, `user_type`),
  FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add new columns to messages table
ALTER TABLE `messages`
  ADD COLUMN `group_id` INT NULL,
  ADD COLUMN `is_deleted` BOOLEAN DEFAULT FALSE,
  ADD COLUMN `deleted_at` TIMESTAMP NULL,
  ADD COLUMN `deleted_by` INT NULL,
  ADD COLUMN `deleted_by_type` ENUM('parent', 'teacher', 'admin', 'contact') NULL,
  ADD COLUMN `message_type` ENUM('text', 'emoji', 'image', 'file', 'system') DEFAULT 'text',
  ADD FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE; 