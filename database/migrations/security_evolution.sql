-- =============================================================================
-- FixSquad Security Evolution — Migration Script
-- File   : database/migrations/security_evolution.sql
-- MySQL  : 9.7.1  (ADD COLUMN IF NOT EXISTS removed; use INFORMATION_SCHEMA)
-- Purpose:
--   1. `keys`    table  — Key Management Module (RSA / ECC key pairs)
--   2. `users`   ALTER  — salt, two_factor_secret, is_2fa_enabled
--   3. `messages` ALTER — mac_signature (CBC-MAC integrity tag)
--
-- Idempotency: every object is guarded by an INFORMATION_SCHEMA existence
-- check inside a helper stored procedure so the script can be re-run safely.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  `keys`  TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `keys` (
    id                    INT           AUTO_INCREMENT PRIMARY KEY,
    user_id               INT           NOT NULL,
    public_key            TEXT          NOT NULL
                                        COMMENT 'JSON-encoded public key: RSA {e,n} or ECC {x,y}',
    private_key_encrypted TEXT          NOT NULL
                                        COMMENT 'AES-256-GCM encrypted private key ciphertext (hex)',
    key_type              ENUM('RSA','ECC')
                                        NOT NULL DEFAULT 'RSA'
                                        COMMENT 'Cryptographic algorithm family',
    status                ENUM('active','revoked','rotated')
                                        NOT NULL DEFAULT 'active'
                                        COMMENT 'Key lifecycle state',
    created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_keys_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT = 'Key Management Module — per-user asymmetric key pairs';

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper procedure: add a column only if it does not already exist.
-- Args: p_table  VARCHAR  table name
--       p_column VARCHAR  column name
--       p_def    TEXT     column definition (type + options)
-- ─────────────────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _sec_add_column_if_missing;

DELIMITER $$
CREATE PROCEDURE _sec_add_column_if_missing(
    IN p_table  VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_def    TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = p_table
           AND COLUMN_NAME  = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper procedure: create an index only if it does not already exist.
-- ─────────────────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _sec_create_index_if_missing;

DELIMITER $$
CREATE PROCEDURE _sec_create_index_if_missing(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_def   TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = p_table
           AND INDEX_NAME   = p_index
    ) THEN
        SET @sql = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` ', p_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ── Index on keys(user_id, status) ───────────────────────────────────────────
CALL _sec_create_index_if_missing('keys', 'idx_keys_user_status', '(user_id, status)');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  ALTER users
-- ─────────────────────────────────────────────────────────────────────────────

CALL _sec_add_column_if_missing(
    'users', 'salt',
    "VARCHAR(64) DEFAULT NULL COMMENT 'Hex-encoded 128-bit random salt for custom PBKDF (hash.js)'"
);

CALL _sec_add_column_if_missing(
    'users', 'two_factor_secret',
    "VARCHAR(64) DEFAULT NULL COMMENT 'TOTP/custom 2FA shared secret; NULL until enrolled'"
);

CALL _sec_add_column_if_missing(
    'users', 'is_2fa_enabled',
    "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=2FA active 0=disabled'"
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.  ALTER messages
-- ─────────────────────────────────────────────────────────────────────────────

CALL _sec_add_column_if_missing(
    'messages', 'mac_signature',
    "VARCHAR(16) DEFAULT NULL COMMENT 'Hex-encoded 8-byte CBC-MAC tag (mac.js) for message integrity'"
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup helper procedures (keep schema clean)
-- ─────────────────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _sec_add_column_if_missing;
DROP PROCEDURE IF EXISTS _sec_create_index_if_missing;
