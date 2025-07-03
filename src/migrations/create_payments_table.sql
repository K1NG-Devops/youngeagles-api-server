CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    proof_image TEXT NOT NULL,
    description TEXT,
    status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    submitted_by INT NOT NULL,
    verified_by INT,
    verification_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (verified_by) REFERENCES users(id)
);
