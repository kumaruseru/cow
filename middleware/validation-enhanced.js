
const validator = require('validator');

// Input size limits
const INPUT_LIMITS = {
  firstName: 50,
  lastName: 50,
  email: 254, // RFC 5321 limit
  password: 128,
  content: 5000,
  message: 2000,
  bio: 500,
  location: 100,
  workplace: 100
};

// Enhanced validation middleware
const validateInput = (req, res, next) => {
  const { body } = req;
  
  // Check overall payload size
  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 100000) { // 100KB limit
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  // Validate individual fields
  for (const [field, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Check length limits
      const limit = INPUT_LIMITS[field];
      if (limit && value.length > limit) {
        return res.status(400).json({
          success: false,
          error: `Field '${field}' exceeds maximum length of ${limit} characters`,
          code: 'FIELD_TOO_LONG'
        });
      }
      
      // Sanitize HTML content
      if (['content', 'message', 'bio'].includes(field)) {
        body[field] = validator.escape(value);
      }
      
      // Additional email validation
      if (field === 'email' && !validator.isEmail(value)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }
    }
  }
  
  next();
};

module.exports = {
  validateInput,
  INPUT_LIMITS
};