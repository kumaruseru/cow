const crypto = require('crypto');

/**
 * Generate secure JWT secrets for the application
 */
function generateSecrets() {
  console.log('🔐 Generating secure JWT secrets for Cow Social Network...\n');
  
  // Generate JWT secret (64 bytes = 512 bits)
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  
  // Generate refresh token secret (64 bytes = 512 bits)
  const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
  
  // Generate session secret (32 bytes = 256 bits)
  const sessionSecret = crypto.randomBytes(32).toString('hex');
  
  // Generate encryption key (32 bytes = 256 bits for AES-256)
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  
  console.log('Copy these secrets to your .env file:\n');
  console.log('# JWT Configuration');
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
  console.log('\n# Session Configuration');
  console.log(`SESSION_SECRET=${sessionSecret}`);
  console.log('\n# Encryption Configuration');
  console.log(`ENCRYPTION_KEY=${encryptionKey}`);
  
  console.log('\n✅ Secrets generated successfully!');
  console.log('⚠️  Keep these secrets secure and never commit them to version control!');
  console.log('🔒 These secrets provide cryptographic security for your application.');
}

// Generate secrets
generateSecrets();
