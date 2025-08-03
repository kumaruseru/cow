const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const CryptoJS = require('crypto-js');
const sodium = require('libsodium-wrappers');
const logger = require('../utils/logger');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
  }

  // Initialize sodium (for high-security encryption)
  async initSodium() {
    try {
      await sodium.ready;
      return true;
    } catch (error) {
      logger.error('Failed to initialize sodium:', error);
      return false;
    }
  }

  // Generate RSA key pair for user
  generateRSAKeyPair(keySize = 2048) {
    try {
      const key = new NodeRSA({ b: keySize });

      return {
        publicKey: key.exportKey('public'),
        privateKey: key.exportKey('private'),
        publicKeyPem: key.exportKey('pkcs8-public-pem'),
        privateKeyPem: key.exportKey('pkcs8-private-pem')
      };
    } catch (error) {
      logger.error('Error generating RSA key pair:', error);
      throw new Error('Failed to generate RSA key pair');
    }
  }

  // Generate X25519 key pair (for modern elliptic curve encryption)
  async generateX25519KeyPair() {
    try {
      await this.initSodium();
      const keyPair = sodium.crypto_box_keypair();

      return {
        publicKey: sodium.to_hex(keyPair.publicKey),
        privateKey: sodium.to_hex(keyPair.privateKey),
        keyType: 'x25519'
      };
    } catch (error) {
      logger.error('Error generating X25519 key pair:', error);
      throw new Error('Failed to generate X25519 key pair');
    }
  }

  // Encrypt message with AES-256-GCM
  encryptMessage(message, key) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, key, iv);

      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      logger.error('Error encrypting message:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt message with AES-256-GCM
  decryptMessage(encryptedData, key) {
    try {
      const { encrypted, iv, tag, algorithm } = encryptedData;

      const decipher = crypto.createDecipher(algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Error decrypting message:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // End-to-end encryption for messages using X25519
  async e2eEncryptMessage(message, recipientPublicKey, senderPrivateKey) {
    try {
      await this.initSodium();

      const messageBuffer = sodium.from_string(message);
      const recipientPubKey = sodium.from_hex(recipientPublicKey);
      const senderPrivKey = sodium.from_hex(senderPrivateKey);

      // Generate a random nonce
      const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

      // Encrypt using box (X25519 + XSalsa20 + Poly1305)
      const encrypted = sodium.crypto_box_easy(
        messageBuffer,
        nonce,
        recipientPubKey,
        senderPrivKey
      );

      return {
        encrypted: sodium.to_hex(encrypted),
        nonce: sodium.to_hex(nonce),
        algorithm: 'x25519-xsalsa20-poly1305'
      };
    } catch (error) {
      logger.error('Error in E2E encryption:', error);
      throw new Error('Failed to encrypt message end-to-end');
    }
  }

  // End-to-end decryption for messages
  async e2eDecryptMessage(encryptedData, senderPublicKey, recipientPrivateKey) {
    try {
      await this.initSodium();

      const { encrypted, nonce } = encryptedData;
      const encryptedBuffer = sodium.from_hex(encrypted);
      const nonceBuffer = sodium.from_hex(nonce);
      const senderPubKey = sodium.from_hex(senderPublicKey);
      const recipientPrivKey = sodium.from_hex(recipientPrivateKey);

      // Decrypt using box_open
      const decrypted = sodium.crypto_box_open_easy(
        encryptedBuffer,
        nonceBuffer,
        senderPubKey,
        recipientPrivKey
      );

      return sodium.to_string(decrypted);
    } catch (error) {
      logger.error('Error in E2E decryption:', error);
      throw new Error('Failed to decrypt message end-to-end');
    }
  }

  // Encrypt file for secure storage
  encryptFile(fileBuffer, password) {
    try {
      // Generate salt
      const salt = crypto.randomBytes(32);

      // Derive key from password using PBKDF2
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      // Generate IV
      const iv = crypto.randomBytes(16);

      // Encrypt file
      const cipher = crypto.createCipher('aes-256-cbc', key, iv);
      let encrypted = cipher.update(fileBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      return {
        encrypted: encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting file:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  // Decrypt file
  decryptFile(encryptedData, password) {
    try {
      const { encrypted, salt, iv } = encryptedData;

      // Derive key from password
      const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');

      // Decrypt file
      const decipher = crypto.createDecipher('aes-256-cbc', key, Buffer.from(iv, 'hex'));
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      logger.error('Error decrypting file:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  // Secure hash with salt (for storing sensitive data)
  hashWithSalt(data, salt = null) {
    try {
      if (!salt) {
        salt = crypto.randomBytes(32);
      } else if (typeof salt === 'string') {
        salt = Buffer.from(salt, 'hex');
      }

      const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha256');

      return {
        hash: hash.toString('hex'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      logger.error('Error hashing with salt:', error);
      throw new Error('Failed to hash data');
    }
  }

  // Verify hash
  verifyHash(data, storedHash, salt) {
    try {
      const { hash } = this.hashWithSalt(data, salt);
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch (error) {
      logger.error('Error verifying hash:', error);
      return false;
    }
  }

  // Generate secure session token
  generateSessionToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  // Generate encryption key for conversation
  generateConversationKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Encrypt user profile data
  encryptProfileData(profileData, userKey) {
    try {
      const serializedData = JSON.stringify(profileData);
      return this.encryptMessage(serializedData, userKey);
    } catch (error) {
      logger.error('Error encrypting profile data:', error);
      throw new Error('Failed to encrypt profile data');
    }
  }

  // Decrypt user profile data
  decryptProfileData(encryptedData, userKey) {
    try {
      const decryptedString = this.decryptMessage(encryptedData, userKey);
      return JSON.parse(decryptedString);
    } catch (error) {
      logger.error('Error decrypting profile data:', error);
      throw new Error('Failed to decrypt profile data');
    }
  }

  // Forward secrecy: Generate new key for each conversation
  async generateForwardSecrecyKeys(conversationId) {
    try {
      await this.initSodium();

      // Generate new key pair for this conversation
      const keyPair = sodium.crypto_box_keypair();

      // Generate conversation-specific encryption key
      const conversationKey = sodium.randombytes_buf(32);

      return {
        conversationId,
        publicKey: sodium.to_hex(keyPair.publicKey),
        privateKey: sodium.to_hex(keyPair.privateKey),
        conversationKey: sodium.to_hex(conversationKey),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      logger.error('Error generating forward secrecy keys:', error);
      throw new Error('Failed to generate forward secrecy keys');
    }
  }

  // Encrypt call signaling data
  encryptCallSignaling(signalingData, sharedSecret) {
    try {
      const serializedData = JSON.stringify(signalingData);
      return this.encryptMessage(serializedData, sharedSecret);
    } catch (error) {
      logger.error('Error encrypting call signaling:', error);
      throw new Error('Failed to encrypt call signaling');
    }
  }

  // Generate DTLS-SRTP keys for WebRTC
  generateWebRTCKeys() {
    try {
      return {
        fingerprint: crypto.randomBytes(32).toString('hex'),
        dtlsKey: crypto.randomBytes(32).toString('hex'),
        srtpKey: crypto.randomBytes(30).toString('hex'), // SRTP master key
        srtpSalt: crypto.randomBytes(14).toString('hex') // SRTP master salt
      };
    } catch (error) {
      logger.error('Error generating WebRTC keys:', error);
      throw new Error('Failed to generate WebRTC keys');
    }
  }
}

module.exports = new EncryptionService();
