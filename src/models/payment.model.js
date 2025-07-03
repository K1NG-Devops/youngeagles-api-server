import mysql from 'mysql2/promise';
import config from '../config/database.js';

class Payment {
    constructor({
        student_id,
        amount,
        payment_date,
        proof_image,
        description,
        status = 'pending',
        submitted_by,
        verified_by = null,
        verification_date = null
    }) {
        this.student_id = student_id;
        this.amount = amount;
        this.payment_date = payment_date;
        this.proof_image = proof_image;
        this.description = description;
        this.status = status;
        this.submitted_by = submitted_by;
        this.verified_by = verified_by;
        this.verification_date = verification_date;
    }

    static async create(payment) {
        const connection = await mysql.createConnection(config);
        try {
            const [result] = await connection.execute(
                `INSERT INTO payments (
                    student_id, amount, payment_date, proof_image, 
                    description, status, submitted_by, verified_by, 
                    verification_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    payment.student_id,
                    payment.amount,
                    payment.payment_date,
                    payment.proof_image,
                    payment.description,
                    payment.status,
                    payment.submitted_by,
                    payment.verified_by,
                    payment.verification_date
                ]
            );
            return { ...payment, id: result.insertId };
        } finally {
            await connection.end();
        }
    }

    static async findById(id) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM payments WHERE id = ?',
                [id]
            );
            return rows[0];
        } finally {
            await connection.end();
        }
    }
}

export default Payment;
