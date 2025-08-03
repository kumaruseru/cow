const Joi = require('joi');

// Enhanced password validation schema with better security
const passwordSchema = Joi.string()
  .min(12) // Increased minimum length
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
  .custom((value, helpers) => {
    // Check for common weak passwords
    const commonPasswords = [
      'password123',
      'admin123',
      'qwerty123',
      '123456789',
      'password!',
      'Admin123!',
      'Welcome123!'
    ];
    
    if (commonPasswords.some(weak => value.toLowerCase().includes(weak.toLowerCase()))) {
      return helpers.error('password.weak');
    }
    
    // Check for sequential characters
    const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(value);
    if (hasSequential) {
      return helpers.error('password.sequential');
    }
    
    // Check for repeated characters
    const hasRepeated = /(.)\1{2,}/.test(value);
    if (hasRepeated) {
      return helpers.error('password.repeated');
    }
    
    return value;
  })
  .required()
  .messages({
    'string.pattern.base':
      'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
    'string.min': 'Password must be at least 12 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'password.weak': 'Password contains common weak patterns',
    'password.sequential': 'Password cannot contain sequential characters',
    'password.repeated': 'Password cannot contain more than 2 repeated characters in a row'
  });

// Username validation schema
const usernameSchema = Joi.string()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username cannot exceed 30 characters'
  });

// Email validation schema
const emailSchema = Joi.string().email().required().messages({
  'string.email': 'Please provide a valid email address'
});

// User registration validation
const registerValidation = Joi.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match'
  }),
  firstName: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'First name can only contain letters and spaces'
    }),
  lastName: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Last name can only contain letters and spaces'
    }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth must be in the past'
  }),
  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .default('prefer_not_to_say'),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the terms and conditions'
  })
});

// User login validation
const loginValidation = Joi.object({
  login: Joi.alternatives().try(emailSchema, usernameSchema).required().messages({
    'alternatives.match': 'Please provide a valid username or email'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  }),
  rememberMe: Joi.boolean().default(false)
});

// Password change validation
const changePasswordValidation = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'New passwords do not match'
  })
});

// Profile update validation
const updateProfileValidation = Joi.object({
  firstName: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s]+$/),
  lastName: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s]+$/),
  bio: Joi.string().max(500).allow(''),
  location: Joi.object({
    city: Joi.string().max(100).allow(''),
    country: Joi.string().max(100).allow('')
  }),
  website: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow(''),
  dateOfBirth: Joi.date().max('now'),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say')
});

// Privacy settings validation
const privacySettingsValidation = Joi.object({
  profileVisibility: Joi.string().valid('public', 'friends', 'private'),
  postVisibility: Joi.string().valid('public', 'friends', 'private'),
  allowFriendRequests: Joi.boolean(),
  showOnlineStatus: Joi.boolean(),
  allowMessageFromStrangers: Joi.boolean()
});

// Email validation for password reset
const forgotPasswordValidation = Joi.object({
  email: emailSchema
});

// Password reset validation
const resetPasswordValidation = Joi.object({
  password: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match'
  })
});

// Post creation validation
const createPostValidation = Joi.object({
  content: Joi.string().min(1).max(5000).required().messages({
    'string.empty': 'Post content is required',
    'string.max': 'Post content cannot exceed 5000 characters'
  }),
  visibility: Joi.string().valid('public', 'friends', 'private').default('friends'),
  tags: Joi.array().items(Joi.string().max(50)).max(10),
  location: Joi.string().max(100).allow(''),
  feeling: Joi.string().max(50).allow('')
});

// Comment validation
const commentValidation = Joi.object({
  content: Joi.string().min(1).max(1000).required().messages({
    'string.empty': 'Comment content is required',
    'string.max': 'Comment cannot exceed 1000 characters'
  })
});

// Message validation
const messageValidation = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.empty': 'Message content is required',
    'string.max': 'Message cannot exceed 2000 characters'
  }),
  messageType: Joi.string().valid('text', 'image', 'file').default('text')
});

// Search validation
const searchValidation = Joi.object({
  query: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Search query is required',
    'string.max': 'Search query cannot exceed 100 characters'
  }),
  type: Joi.string().valid('users', 'posts', 'all').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

// Pagination validation
const paginationValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string()
    .valid('createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name')
    .default('-createdAt')
});

// MongoDB ObjectId validation
const objectIdValidation = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid ID format'
  });

// Middleware function to validate request body
const validateBody = schema => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Middleware function to validate request params
const validateParams = schema => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: errors
      });
    }

    req.params = value;
    next();
  };
};

// Middleware function to validate query parameters
const validateQuery = schema => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errors
      });
    }

    req.query = value;
    next();
  };
};

module.exports = {
  // Validation schemas
  registerValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  privacySettingsValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  createPostValidation,
  commentValidation,
  messageValidation,
  searchValidation,
  paginationValidation,
  objectIdValidation,

  // Middleware functions
  validateBody,
  validateParams,
  validateQuery
};
