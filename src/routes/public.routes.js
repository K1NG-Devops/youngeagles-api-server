import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, execute } from '../db.js';
import nodemailer from 'nodemailer';

const router = Router();

// Email configuration (you'll need to configure this with your SMTP settings)
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// POST /api/public/contact - Contact form submission
router.post('/contact',
  [
    body('name').notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('inquiryType').notEmpty().withMessage('Inquiry type is required.'),
    body('subject').notEmpty().withMessage('Subject is required.'),
    body('message').isLength({ min: 10 }).withMessage('Message must be at least 10 characters long.'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number format.'),
    body('preferredContact').isIn(['email', 'phone', 'either']).withMessage('Invalid contact preference.'),
    body('isUrgent').optional().isBoolean().withMessage('Urgent flag must be boolean.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      email,
      phone,
      inquiryType,
      subject,
      message,
      preferredContact,
      isUrgent
    } = req.body;

    try {
      // Store in database
      const contactQuery = `
        INSERT INTO contact_inquiries (
          name, email, phone, inquiry_type, subject, message, 
          preferred_contact, is_urgent, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'new')
      `;

      const result = await execute(
        contactQuery,
        [name, email, phone, inquiryType, subject, message, preferredContact, isUrgent || false],
        'skydek_DB'
      );

      // Send notification email to admin
      try {
        const transporter = createEmailTransporter();
        const urgentText = isUrgent ? '[URGENT] ' : '';
        
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: process.env.ADMIN_EMAIL || 'admin@youngeagles.org',
          subject: `${urgentText}New Contact Inquiry: ${subject}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Priority:</strong> ${isUrgent ? 'URGENT' : 'Normal'}</p>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Inquiry Type:</strong> ${inquiryType}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><em>Submitted at: ${new Date().toLocaleString()}</em></p>
          `,
        });

        // Send confirmation email to user
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: 'Young Eagles - We received your inquiry',
          html: `
            <h2>Thank you for contacting Young Eagles!</h2>
            <p>Dear ${name},</p>
            <p>We have received your inquiry about: <strong>${subject}</strong></p>
            <p>We will respond to your message within 24 hours during business days.</p>
            ${isUrgent ? '<p><strong>Note:</strong> Your inquiry has been marked as urgent and will receive priority attention.</p>' : ''}
            <p>If you need immediate assistance, please call us at (555) 123-EAGLE.</p>
            <br>
            <p>Best regards,<br>The Young Eagles Team</p>
            <hr>
            <p><em>Your message:</em><br>${message.replace(/\n/g, '<br>')}</p>
          `,
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        message: 'Contact form submitted successfully',
        id: result.insertId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Contact form submission error:', error);
      res.status(500).json({ 
        message: 'Failed to submit contact form',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// POST /api/public/register-2026 - Young Eagles 2026 registration
router.post('/register-2026',
  [
    // Parent/Guardian validation
    body('parentName').notEmpty().withMessage('Parent/Guardian name is required.'),
    body('parentEmail').isEmail().withMessage('Valid parent email is required.'),
    body('parentPhone').notEmpty().withMessage('Parent phone number is required.'),
    
    // Child validation
    body('childName').notEmpty().withMessage('Child name is required.'),
    body('childAge').isInt({ min: 8, max: 17 }).withMessage('Child age must be between 8 and 17.'),
    body('childGrade').notEmpty().withMessage('Child grade is required.'),
    body('childDob').isISO8601().withMessage('Valid date of birth is required.'),
    
    // Emergency contact validation
    body('emergencyName').notEmpty().withMessage('Emergency contact name is required.'),
    body('emergencyPhone').notEmpty().withMessage('Emergency contact phone is required.'),
    body('emergencyRelation').notEmpty().withMessage('Emergency contact relationship is required.'),
    
    // Agreement validation
    body('agreedToTerms').equals('true').withMessage('You must agree to the terms and conditions.'),
    body('agreedToWaiver').equals('true').withMessage('You must agree to the waiver requirements.'),
    
    // Optional fields
    body('preferredMonth').optional().isString(),
    body('sessionPreference').optional().isIn(['morning', 'afternoon', 'flexible']),
    body('hasFlownBefore').optional().isIn(['yes', 'no']),
    body('interests').optional().isArray(),
    body('medicalConditions').optional().isString(),
    body('specialNeeds').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      parentName,
      parentEmail,
      parentPhone,
      childName,
      childAge,
      childGrade,
      childDob,
      emergencyName,
      emergencyPhone,
      emergencyRelation,
      preferredMonth,
      sessionPreference,
      hasFlownBefore,
      interests,
      medicalConditions,
      specialNeeds,
      agreedToTerms,
      agreedToWaiver
    } = req.body;

    try {
      // Store registration in database
      const registrationQuery = `
        INSERT INTO young_eagles_registrations_2026 (
          parent_name, parent_email, parent_phone,
          child_name, child_age, child_grade, child_dob,
          emergency_name, emergency_phone, emergency_relation,
          preferred_month, session_preference, has_flown_before,
          interests, medical_conditions, special_needs,
          agreed_to_terms, agreed_to_waiver,
          created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')
      `;

      const interestsJson = interests ? JSON.stringify(interests) : null;

      const result = await execute(
        registrationQuery,
        [
          parentName, parentEmail, parentPhone,
          childName, childAge, childGrade, childDob,
          emergencyName, emergencyPhone, emergencyRelation,
          preferredMonth, sessionPreference, hasFlownBefore,
          interestsJson, medicalConditions, specialNeeds,
          agreedToTerms, agreedToWaiver
        ],
        'skydek_DB'
      );

      // Send notification emails
      try {
        const transporter = createEmailTransporter();
        
        // Email to admin
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: process.env.ADMIN_EMAIL || 'admin@youngeagles.org',
          subject: `New Young Eagles 2026 Registration: ${childName}`,
          html: `
            <h2>New Young Eagles 2026 Registration</h2>
            
            <h3>Parent/Guardian Information:</h3>
            <p><strong>Name:</strong> ${parentName}</p>
            <p><strong>Email:</strong> ${parentEmail}</p>
            <p><strong>Phone:</strong> ${parentPhone}</p>
            
            <h3>Young Eagle Information:</h3>
            <p><strong>Name:</strong> ${childName}</p>
            <p><strong>Age:</strong> ${childAge}</p>
            <p><strong>Grade:</strong> ${childGrade}</p>
            <p><strong>Date of Birth:</strong> ${childDob}</p>
            <p><strong>Has flown before:</strong> ${hasFlownBefore || 'Not specified'}</p>
            
            <h3>Emergency Contact:</h3>
            <p><strong>Name:</strong> ${emergencyName}</p>
            <p><strong>Phone:</strong> ${emergencyPhone}</p>
            <p><strong>Relationship:</strong> ${emergencyRelation}</p>
            
            <h3>Preferences:</h3>
            <p><strong>Preferred Month:</strong> ${preferredMonth || 'No preference'}</p>
            <p><strong>Session Preference:</strong> ${sessionPreference || 'Flexible'}</p>
            <p><strong>Interests:</strong> ${interests ? interests.join(', ') : 'None specified'}</p>
            
            ${medicalConditions ? `<h3>Medical Conditions:</h3><p>${medicalConditions}</p>` : ''}
            ${specialNeeds ? `<h3>Special Needs:</h3><p>${specialNeeds}</p>` : ''}
            
            <hr>
            <p><em>Registration ID: ${result.insertId}</em></p>
            <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
          `,
        });

        // Confirmation email to parent
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: parentEmail,
          subject: 'Young Eagles 2026 Registration Confirmation',
          html: `
            <h2>Registration Confirmed!</h2>
            <p>Dear ${parentName},</p>
            <p>Thank you for registering <strong>${childName}</strong> for the Young Eagles 2026 program!</p>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>What's Next?</h3>
              <ul>
                <li>We'll email you a confirmation with program details</li>
                <li>You'll receive a welcome packet with forms and waivers</li>
                <li>We'll contact you to schedule ${childName}'s flight</li>
                <li>Orientation materials will be sent 2 weeks before the program</li>
              </ul>
            </div>
            
            <p><strong>Registration Number:</strong> YE2026-${result.insertId.toString().padStart(6, '0')}</p>
            <p>We'll contact you within 48 hours to confirm your spot and provide additional information.</p>
            
            <p>If you have any questions, please contact us at:</p>
            <ul>
              <li>Phone: (555) 123-EAGLE</li>
              <li>Email: info@youngeagles.org</li>
            </ul>
            
            <p>We're excited to share the wonder of flight with ${childName}!</p>
            
            <p>Best regards,<br>The Young Eagles Team</p>
          `,
        });
      } catch (emailError) {
        console.error('Registration email sending failed:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        message: 'Registration submitted successfully',
        registrationId: `YE2026-${result.insertId.toString().padStart(6, '0')}`,
        id: result.insertId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Registration submission error:', error);
      res.status(500).json({ 
        message: 'Failed to submit registration',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// GET /api/public/registrations-stats - Get registration statistics (for admin dashboard)
router.get('/registrations-stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_registrations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_registrations,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_registrations,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as registrations_this_week,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as registrations_this_month
      FROM young_eagles_registrations_2026
    `, [], 'skydek_DB');

    const contactStats = await query(`
      SELECT 
        COUNT(*) as total_inquiries,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_inquiries,
        COUNT(CASE WHEN is_urgent = 1 THEN 1 END) as urgent_inquiries,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as inquiries_this_week
      FROM contact_inquiries
    `, [], 'skydek_DB');

    res.json({
      registrations: stats[0] || {},
      contacts: contactStats[0] || {}
    });

  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;

