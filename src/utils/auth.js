import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class PasswordManager {
  /**
   * Generate password hash using bcrypt
   */
  static async generateHash(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verify(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

export class TokenManager {
  /**
   * Generate secure random token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate session token
   */
  static generateSessionToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate verification code (numeric)
   */
  static generateVerificationCode(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
