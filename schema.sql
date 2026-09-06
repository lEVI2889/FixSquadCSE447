
-- CONTRACT REQUIREMENT (Rohan's Week1_Rohan_CONTRACT.md, Section 1):
-- id must be INT / PRIMARY KEY so services.provider_id (INT, FK -> users.id)
-- can reference it without a type mismatch. AUTO_INCREMENT is just an
-- attribute on top of INT and does not change the column's type for FK
-- matching purposes.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
