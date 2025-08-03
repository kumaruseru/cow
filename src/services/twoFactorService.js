const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { otplib } = require('otplib');
const crypto = require('crypto');
const logger = require('../utils/logger');

class TwoFactorAuthService {
  // Generate secret for 2FA
  static generateSecret(userEmail, issuer = 'Cow Social Network') {
    try {
      const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: issuer,
        length: 32
      });

      return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        manual_entry_key: secret.base32
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  // Generate QR code for secret
  static async generateQRCode(otpauth_url) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauth_url);
      return qrCodeDataURL;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Verify TOTP token
  static verifyToken(secret, token, window = 1) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window // Allow some time drift
      });

      return verified;
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  // Generate backup codes
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // Verify backup code
  static verifyBackupCode(userBackupCodes, providedCode) {
    const index = userBackupCodes.indexOf(providedCode.toUpperCase());
    return index !== -1 ? index : false;
  }

  // Generate recovery code (for account recovery)
  static generateRecoveryCode() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  // Validate 2FA setup
  static async validateSetup(secret, token) {
    try {
      // Verify the token first
      const isValid = this.verifyToken(secret, token);

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      return {
        success: true,
        backupCodes: backupCodes
      };
    } catch (error) {
      logger.error('Error validating 2FA setup:', error);
      return {
        success: false,
        error: 'Failed to validate 2FA setup'
      };
    }
  }

  // Time-based one-time password generation (for testing)
  static generateTOTP(secret) {
    try {
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });
      return token;
    } catch (error) {
      logger.error('Error generating TOTP:', error);
      return null;
    }
  }

  // Check if 2FA is required for user
  static is2FARequired(user, request = {}) {
    // Always require 2FA for admin accounts
    if (user.role === 'admin') {
      return true;
    }

    // Require 2FA for suspicious login attempts
    if (request.isSuspicious) {
      return true;
    }

    // Require 2FA if user has it enabled
    if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
      return true;
    }

    return false;
  }

  // Generate device trust token
  static generateDeviceTrustToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate device trust token
  static validateDeviceTrustToken(storedToken, providedToken) {
    return crypto.timingSafeEqual(
      Buffer.from(storedToken, 'hex'),
      Buffer.from(providedToken, 'hex')
    );
  }
}

module.exports = TwoFactorAuthService;
