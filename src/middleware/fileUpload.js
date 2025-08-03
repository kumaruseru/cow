const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('../utils/logger');

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate secure random filename
    const randomName = crypto.randomBytes(32).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomName}${ext}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_VIDEO_TYPES];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Create multer instance with security configurations
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max size for all
    files: 5, // Maximum 5 files per upload
    fieldSize: 1024 * 1024, // 1MB field size limit
    fieldNameSize: 100, // Field name size limit
    headerPairs: 2000 // Maximum header pairs
  }
});

// Virus scanning simulation (in production, use real antivirus)
const scanFile = async filePath => {
  try {
    // Basic file content scanning
    const stats = fs.statSync(filePath);

    // Check if file is empty
    if (stats.size === 0) {
      throw new Error('Empty file detected');
    }

    // Read first few bytes to check for suspicious patterns
    const buffer = Buffer.alloc(1024);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    // Check for executable signatures
    const executableSignatures = [
      Buffer.from([0x4d, 0x5a]), // PE executable
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF executable
      Buffer.from([0xca, 0xfe, 0xba, 0xbe]), // Mach-O executable
      Buffer.from([0xfe, 0xed, 0xfa, 0xce]) // Mach-O executable
    ];

    for (const signature of executableSignatures) {
      if (buffer.indexOf(signature) === 0) {
        throw new Error('Executable file detected');
      }
    }

    return true;
  } catch (error) {
    logger.error('File scanning error:', error);
    throw error;
  }
};

// Image processing and validation
const processImage = async (filePath, outputPath) => {
  try {
    const metadata = await sharp(filePath).metadata();

    // Validate image dimensions
    if (metadata.width > 4096 || metadata.height > 4096) {
      throw new Error('Image dimensions too large');
    }

    // Remove EXIF data and optimize
    await sharp(filePath)
      .jpeg({ quality: 85, mozjpeg: true })
      .png({ compressionLevel: 9 })
      .webp({ quality: 85 })
      .withMetadata(false) // Remove EXIF data
      .toFile(outputPath);

    return true;
  } catch (error) {
    logger.error('Image processing error:', error);
    throw error;
  }
};

// File validation middleware
const validateFile = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      if (!file) continue;

      // Validate file size based on type
      if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && file.size > MAX_IMAGE_SIZE) {
        throw new Error('Image file too large');
      }

      if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype) && file.size > MAX_DOCUMENT_SIZE) {
        throw new Error('Document file too large');
      }

      if (ALLOWED_VIDEO_TYPES.includes(file.mimetype) && file.size > MAX_VIDEO_SIZE) {
        throw new Error('Video file too large');
      }

      // Scan file for malicious content
      await scanFile(file.path);

      // Process images
      if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const processedPath = file.path.replace(/\.[^/.]+$/, '_processed.jpg');
        await processImage(file.path, processedPath);

        // Replace original with processed version
        fs.unlinkSync(file.path);
        fs.renameSync(processedPath, file.path);
      }

      logger.info(`File validated successfully: ${file.filename}`);
    }

    next();
  } catch (error) {
    // Clean up uploaded files on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    logger.error('File validation failed:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'File validation failed'
    });
  }
};

// File cleanup utility
const cleanupFile = filePath => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File cleaned up: ${filePath}`);
    }
  } catch (error) {
    logger.error('File cleanup error:', error);
  }
};

module.exports = {
  upload,
  validateFile,
  processImage,
  scanFile,
  cleanupFile,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_VIDEO_TYPES
};
