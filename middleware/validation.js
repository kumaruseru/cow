const validator = require('validator');
const xss = require('xss');

// Input validation middleware
const validateInput = (validationRules) => {
  return (req, res, next) => {
    const errors = [];
    const data = { ...req.body, ...req.query, ...req.params };

    for (const field in validationRules) {
      const rules = validationRules[field];
      const value = data[field];

      // Check required fields
      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if field is optional and empty
      if (!rules.required && (!value || value.toString().trim() === '')) {
        continue;
      }

      // Type validation
      if (rules.type === 'email' && !validator.isEmail(value)) {
        errors.push(`${field} must be a valid email`);
      }

      if (rules.type === 'username' && !validator.isAlphanumeric(value.replace(/[._-]/g, ''))) {
        errors.push(`${field} can only contain letters, numbers, dots, underscores and hyphens`);
      }

      if (rules.type === 'password' && !validator.isLength(value, { min: 8 })) {
        errors.push(`${field} must be at least 8 characters long`);
      }

      // Length validation
      if (rules.minLength && !validator.isLength(value, { min: rules.minLength })) {
        errors.push(`${field} must be at least ${rules.minLength} characters long`);
      }

      if (rules.maxLength && !validator.isLength(value, { max: rules.maxLength })) {
        errors.push(`${field} must be no more than ${rules.maxLength} characters long`);
      }

      // Custom validation
      if (rules.custom && !rules.custom(value)) {
        errors.push(rules.customMessage || `${field} is invalid`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  };
};

// XSS Protection middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = xss(obj[key], {
          whiteList: {
            // Allow safe HTML tags for rich text
            p: [],
            br: [],
            strong: [],
            em: [],
            u: [],
            i: [],
            b: []
          },
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script', 'style']
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
};

// Utility function to sanitize a single string
const sanitizeString = (str) => {
  return xss(str, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
};

// Common validation rules
const validationRules = {
  login: {
    email: {
      required: true,
      type: 'email'
    },
    password: {
      required: true,
      minLength: 1
    }
  },
  register: {
    firstName: {
      required: true,
      minLength: 1,
      maxLength: 50
    },
    lastName: {
      required: true,
      minLength: 1,
      maxLength: 50
    },
    username: {
      required: false,
      type: 'username',
      minLength: 3,
      maxLength: 30
    },
    email: {
      required: true,
      type: 'email'
    },
    password: {
      required: true,
      type: 'password',
      minLength: 8,
      custom: (value) => {
        // Password must contain at least one uppercase, one lowercase, one number
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value);
      },
      customMessage: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  },
  createPost: {
    content: {
      required: true,
      minLength: 1,
      maxLength: 2000
    },
    privacy: {
      required: false,
      custom: (value) => ['public', 'friends', 'private'].includes(value),
      customMessage: 'Privacy must be public, friends, or private'
    }
  },
  updateProfile: {
    username: {
      required: false,
      type: 'username',
      minLength: 3,
      maxLength: 30
    },
    email: {
      required: false,
      type: 'email'
    },
    bio: {
      required: false,
      maxLength: 500
    }
  }
};

// Specific validation middleware functions
const validateRegistration = (req, res, next) => {
  const { firstName, lastName, username, email, password, birthDate, gender, profile } = req.body;
  
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required' });
  }
  
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }
  
  // Username is optional, validate only if provided
  if (username && (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9._-]+$/.test(username))) {
    return res.status(400).json({ error: 'Username must be 3-20 characters, alphanumeric and underscores only' });
  }

  // Validate profile data if provided
  if (profile) {
    if (profile.firstName && (typeof profile.firstName !== 'string' || profile.firstName.length > 50)) {
      return res.status(400).json({ error: 'First name must be a string with maximum 50 characters' });
    }
    if (profile.lastName && (typeof profile.lastName !== 'string' || profile.lastName.length > 50)) {
      return res.status(400).json({ error: 'Last name must be a string with maximum 50 characters' });
    }
  }

  // Validate birthDate if provided
  if (birthDate) {
    const { day, month, year } = birthDate;
    if (day && (day < 1 || day > 31)) {
      return res.status(400).json({ error: 'Invalid birth day' });
    }
    if (month && (month < 1 || month > 12)) {
      return res.status(400).json({ error: 'Invalid birth month' });
    }
    if (year && (year < 1900 || year > new Date().getFullYear())) {
      return res.status(400).json({ error: 'Invalid birth year' });
    }
  }

  // Validate gender if provided
  if (gender && !['male', 'female', 'other'].includes(gender)) {
    return res.status(400).json({ error: 'Invalid gender value' });
  }
  
  // Sanitize inputs
  req.body.firstName = sanitizeString(firstName);
  req.body.lastName = sanitizeString(lastName);
  if (username) req.body.username = sanitizeString(username);
  req.body.email = sanitizeString(email);
  
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Sanitize inputs
  req.body.email = sanitizeString(email);
  
  next();
};

const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  next();
};

module.exports = {
  validateInput,
  sanitizeInput,
  validationRules,
  validateRegistration,
  validateLogin,
  validateRefreshToken
};
