-- Migration for Young Eagles public forms
-- Creates tables for contact inquiries and 2026 registrations

-- Contact inquiries table
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    inquiry_type VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    preferred_contact ENUM('email', 'phone', 'either') DEFAULT 'email',
    is_urgent BOOLEAN DEFAULT FALSE,
    status ENUM('new', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    notes TEXT COMMENT 'Admin notes for follow-up',
    assigned_to INT COMMENT 'User ID of assigned staff member',
    
    INDEX idx_status (status),
    INDEX idx_urgent (is_urgent),
    INDEX idx_created_at (created_at),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Young Eagles 2026 registrations table
CREATE TABLE IF NOT EXISTS young_eagles_registrations_2026 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Parent/Guardian Information
    parent_name VARCHAR(255) NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    
    -- Young Eagle Information
    child_name VARCHAR(255) NOT NULL,
    child_age INT NOT NULL CHECK (child_age >= 8 AND child_age <= 17),
    child_grade VARCHAR(50) NOT NULL,
    child_dob DATE NOT NULL,
    
    -- Emergency Contact
    emergency_name VARCHAR(255) NOT NULL,
    emergency_phone VARCHAR(20) NOT NULL,
    emergency_relation VARCHAR(100) NOT NULL,
    
    -- Program Preferences
    preferred_month VARCHAR(20),
    session_preference ENUM('morning', 'afternoon', 'flexible'),
    has_flown_before ENUM('yes', 'no'),
    interests JSON COMMENT 'Array of aviation interests',
    
    -- Medical/Special Needs
    medical_conditions TEXT,
    special_needs TEXT,
    
    -- Agreements
    agreed_to_terms BOOLEAN NOT NULL DEFAULT FALSE,
    agreed_to_waiver BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Administrative
    status ENUM('pending', 'confirmed', 'scheduled', 'completed', 'cancelled') DEFAULT 'pending',
    flight_date DATE NULL,
    pilot_assigned VARCHAR(255),
    aircraft_assigned VARCHAR(255),
    notes TEXT COMMENT 'Admin notes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_parent_email (parent_email),
    INDEX idx_child_name (child_name),
    INDEX idx_created_at (created_at),
    INDEX idx_flight_date (flight_date),
    INDEX idx_child_age (child_age)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add sample inquiry types for reference
INSERT IGNORE INTO contact_inquiries (name, email, inquiry_type, subject, message, status) VALUES
('System', 'system@youngeagles.org', 'General Information', 'Sample Inquiry Types', 
'This is a reference entry showing available inquiry types:
- General Information
- 2026 Program Registration
- Volunteer Opportunities
- Scheduling & Availability
- Safety & Requirements
- Group/Organization Visits
- Media & Press Inquiries
- Partnership Opportunities
- Other', 'resolved');

-- Create view for registration statistics
CREATE OR REPLACE VIEW registration_stats_2026 AS
SELECT 
    COUNT(*) as total_registrations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_registrations,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_registrations,
    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_registrations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_registrations,
    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as registrations_this_week,
    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as registrations_this_month,
    AVG(child_age) as average_age,
    MIN(child_age) as youngest_participant,
    MAX(child_age) as oldest_participant
FROM young_eagles_registrations_2026;

-- Create view for contact inquiry statistics  
CREATE OR REPLACE VIEW contact_inquiry_stats AS
SELECT 
    COUNT(*) as total_inquiries,
    COUNT(CASE WHEN status = 'new' THEN 1 END) as new_inquiries,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_inquiries,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_inquiries,
    COUNT(CASE WHEN is_urgent = 1 THEN 1 END) as urgent_inquiries,
    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as inquiries_this_week,
    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as inquiries_this_month,
    inquiry_type,
    COUNT(*) as count_by_type
FROM contact_inquiries
GROUP BY inquiry_type;

-- Ensure nodemailer dependency is noted
-- Note: Run `npm install nodemailer` in the api directory to add email functionality

