
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Secure file upload configuration
const createSecureUpload = (uploadPath, allowedTypes, maxSize = 5 * 1024 * 1024) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generate secure filename
      const randomName = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomName}${extension}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error);
    }
    
    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExtensions.includes(extension)) {
      const error = new Error('Invalid file extension');
      error.code = 'INVALID_FILE_EXTENSION';
      return cb(error);
    }
    
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: 1,
      fieldSize: 1024 * 1024, // 1MB for other fields
    }
  });
};

// Avatar upload configuration
const avatarUpload = createSecureUpload(
  'uploads/avatars',
  ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  2 * 1024 * 1024 // 2MB
);

// Cover photo upload configuration
const coverUpload = createSecureUpload(
  'uploads/covers',
  ['image/jpeg', 'image/png', 'image/webp'],
  5 * 1024 * 1024 // 5MB
);

module.exports = {
  avatarUpload,
  coverUpload,
  createSecureUpload
};