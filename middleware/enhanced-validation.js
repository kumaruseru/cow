const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoSanitize = require('express-mongo-sanitize');

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize against NoSQL injection
  req.body = mongoSanitize.sanitize(req.body);
  req.query = mongoSanitize.sanitize(req.query);
  req.params = mongoSanitize.sanitize(req.params);

  // Sanitize HTML content
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = DOMPurify.sanitize(req.body[key]);
      }
    });
  }

  next();
};

// Enhanced validation rules
const validationRules = {
  // User registration validation
  register: [
    body('firstName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
      .withMessage('First name must contain only letters and spaces'),
    
    body('lastName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
      .withMessage('Last name must contain only letters and spaces'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .isLength({ max: 100 })
      .withMessage('Valid email address required'),
    
    body('password')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
    
    body('birthDate')
      .optional()
      .isISO8601()
      .custom(date => {
        const birth = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        if (age < 13 || age > 120) {
          throw new Error('Age must be between 13 and 120 years');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be male, female, or other')
  ],

  // User login validation
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
    
    body('password')
      .isLength({ min: 1, max: 128 })
      .withMessage('Password is required')
  ],

  // Post creation validation
  createPost: [
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Post content must be between 1 and 5000 characters'),
    
    body('privacy')
      .optional()
      .isIn(['public', 'friends', 'private'])
      .withMessage('Privacy must be public, friends, or private')
  ],

  // Message validation
  sendMessage: [
    body('recipientId')
      .isMongoId()
      .withMessage('Valid recipient ID required'),
    
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message content must be between 1 and 1000 characters')
  ],

  // File upload validation
  fileUpload: [
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
  ],

  // Search validation
  search: [
    query('q')
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9À-ÿ\s\-_.@]+$/)
      .withMessage('Search query contains invalid characters'),
    
    query('type')
      .optional()
      .isIn(['users', 'posts', 'all'])
      .withMessage('Search type must be users, posts, or all'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ]
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formattedErrors
    });
  }
  
  next();
};

module.exports = {
  sanitizeInput,
  validationRules,
  handleValidationErrors
};