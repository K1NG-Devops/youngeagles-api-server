CREATE TABLE IF NOT EXISTS payment_proofs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT NOT NULL,
    child_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    file_url TEXT NOT NULL,
    payment_date DATE NOT NULL,
    reference_number VARCHAR(255),
    payment_method ENUM('bank_transfer', 'eft', 'cash', 'card') DEFAULT 'bank_transfer',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id),
    FOREIGN KEY (child_id) REFERENCES children(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
