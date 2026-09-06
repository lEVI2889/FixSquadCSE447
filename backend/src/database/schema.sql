-- ==========================================================
-- Feature 12: Global Category Manager Database Schema
-- Strict Raw SQL - Zero ORMs
-- Matches Week1_Rohan_CONTRACT.md constraints for category_id FK
-- ==========================================================

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'folder',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Initial Category Seed Data
INSERT INTO categories (name, description, icon, is_active) VALUES
('Home Cleaning', 'Professional home, office, and apartment cleaning services.', 'sparkles', 1),
('Plumbing & Pipe Repair', 'Emergency leak fixes, pipe installation, and drain maintenance.', 'wrench', 1),
('Electrical & Wiring', 'Licensed electrical installations, inspections, and circuit repairs.', 'zap', 1),
('Carpentry & Woodwork', 'Custom furniture crafting, cabinet repairs, and wood framing.', 'hammer', 1),
('Painting & Wall Decor', 'Interior and exterior painting, wallpapering, and plaster repair.', 'palette', 1),
('Appliance Repair', 'Diagnostics and repairs for AC, refrigerators, washing machines, and ovens.', 'cpu', 1),
('Pest Control & Fumigation', 'Eco-friendly pest extermination, termite treatments, and inspection.', 'shield', 1),
('Lawn Care & Landscaping', 'Lawn mowing, tree trimming, garden design, and seasonal yard cleanup.', 'scissors', 1)
ON DUPLICATE KEY UPDATE description = VALUES(description), icon = VALUES(icon);
