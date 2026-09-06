CREATE TABLE IF NOT EXISTS provider_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id INT NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_blocked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    provider_id INT NOT NULL,
    service_id INT NOT NULL,
    status ENUM('Pending', 'Accepted', 'Rejected', 'In-Progress', 'Completed', 'Cancelled', 'Disputed') DEFAULT 'Pending',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    total_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
