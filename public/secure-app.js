// Secure JavaScript for Cow Social Network
'use strict';

// Security configuration
const SecurityConfig = {
  // API endpoints
  API_BASE: '/api',
  
  // Security headers
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  
  // Input validation patterns
  patterns: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    name: /^[a-zA-ZÀ-ÿ\s]{1,50}$/
  }
};

// Secure HTTP client
class SecureHTTP {
  static async request(method, url, data = null) {
    const token = localStorage.getItem('accessToken');
    
    const config = {
      method: method.toUpperCase(),
      headers: {
        ...SecurityConfig.headers,
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      
      // Check for authentication errors
      if (response.status === 401) {
        // Token expired or invalid
        this.handleAuthError();
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('HTTP request failed:', error);
      throw error;
    }
  }

  static handleAuthError() {
    // Clear invalid tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login.html';
    }
  }
}

// Input sanitization
class InputSanitizer {
  static sanitizeHTML(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static validateEmail(email) {
    return SecurityConfig.patterns.email.test(email);
  }

  static validatePassword(password) {
    return SecurityConfig.patterns.password.test(password);
  }

  static validateName(name) {
    return SecurityConfig.patterns.name.test(name);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>"\']/g, '') // Remove dangerous characters
      .substring(0, 1000); // Limit length
  }
}

// Form validation
class FormValidator {
  static validateRegistrationForm(formData) {
    const errors = [];

    if (!InputSanitizer.validateName(formData.firstName)) {
      errors.push('First name must contain only letters and spaces (1-50 characters)');
    }

    if (!InputSanitizer.validateName(formData.lastName)) {
      errors.push('Last name must contain only letters and spaces (1-50 characters)');
    }

    if (!InputSanitizer.validateEmail(formData.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!InputSanitizer.validatePassword(formData.password)) {
      errors.push('Password must contain at least 8 characters with uppercase, lowercase, number and special character');
    }

    if (formData.password !== formData.confirmPassword) {
      errors.push('Passwords do not match');
    }

    return errors;
  }

  static validateLoginForm(formData) {
    const errors = [];

    if (!InputSanitizer.validateEmail(formData.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!formData.password || formData.password.length < 1) {
      errors.push('Password is required');
    }

    return errors;
  }
}

// Secure event handlers
class SecureEventHandlers {
  static async handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const loginData = {
      email: InputSanitizer.sanitizeInput(formData.get('email')),
      password: formData.get('password') // Don't sanitize password
    };

    // Validate form
    const errors = FormValidator.validateLoginForm(loginData);
    if (errors.length > 0) {
      this.showErrors(errors);
      return;
    }

    try {
      const response = await SecureHTTP.request('POST', '/api/auth/login', loginData);
      
      if (response.success) {
        // Store tokens securely
        localStorage.setItem('accessToken', response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        // Redirect to dashboard
        window.location.href = '/home.html';
      } else {
        this.showErrors([response.error || 'Login failed']);
      }
    } catch (error) {
      this.showErrors([error.message || 'Login failed']);
    }
  }

  static async handleRegistration(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const registrationData = {
      firstName: InputSanitizer.sanitizeInput(formData.get('firstName')),
      lastName: InputSanitizer.sanitizeInput(formData.get('lastName')),
      email: InputSanitizer.sanitizeInput(formData.get('email')),
      password: formData.get('password'), // Don't sanitize password
      confirmPassword: formData.get('confirmPassword'),
      birthDate: formData.get('birthDate'),
      gender: formData.get('gender')
    };

    // Validate form
    const errors = FormValidator.validateRegistrationForm(registrationData);
    if (errors.length > 0) {
      this.showErrors(errors);
      return;
    }

    // Remove confirmPassword before sending
    delete registrationData.confirmPassword;

    try {
      const response = await SecureHTTP.request('POST', '/api/auth/register', registrationData);
      
      if (response.success) {
        // Store tokens securely
        localStorage.setItem('accessToken', response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        // Redirect to dashboard
        window.location.href = '/home.html';
      } else {
        this.showErrors([response.error || 'Registration failed']);
      }
    } catch (error) {
      this.showErrors([error.message || 'Registration failed']);
    }
  }

  static showErrors(errors) {
    const errorContainer = document.getElementById('error-messages');
    if (errorContainer) {
      errorContainer.innerHTML = errors
        .map(error => `<div class="alert alert-danger">${InputSanitizer.sanitizeHTML(error)}</div>`)
        .join('');
      errorContainer.style.display = 'block';
    }
  }

  static hideErrors() {
    const errorContainer = document.getElementById('error-messages');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }
}

// Initialize secure functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Bind secure event handlers
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', SecureEventHandlers.handleLogin.bind(SecureEventHandlers));
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', SecureEventHandlers.handleRegistration.bind(SecureEventHandlers));
  }

  // Hide error messages when user starts typing
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', SecureEventHandlers.hideErrors);
  });
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SecurityConfig,
    SecureHTTP,
    InputSanitizer,
    FormValidator,
    SecureEventHandlers
  };
}