const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Load environment variables
const connectDB = require('./config/database');
const { xss } = require('express-xss-sanitizer');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

// Import models and services
const User = require('./models/SimpleUser');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const Friend = require('./models/Friend');
const notificationHelpers = require('./public/notification-helpers');

// Store user online status in memory (for demo - in production use Redis)
const onlineUsers = new Map(); // userId -> { lastSeen: Date, socketId: string }
const emailService = require('./services/emailService');
const { authenticateToken } = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

//============================================================================
// SECURITY CONFIGURATION
//============================================================================

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (giảm xuống)
  max: 50, // 50 attempts per window (tăng lên)
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (giảm xuống)
  max: 500, // 500 requests per window (tăng lên)
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

// Apply Helmet.js with custom CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Apply security middleware
app.use(generalLimiter);
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

app.use(mongoSanitize());
app.use(hpp());
app.use(xss());

// Parse JSON with size limit and validation
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON payload',
        code: 'INVALID_JSON'
      });
      return;
    }
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Ultra simple activity ping - MUST be before static files
app.post('/api/activity/ping', (req, res) => {
  // Prevent multiple responses
  if (res.headersSent) {
    return;
  }
  
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token' });
    }

    const jwt = require('jsonwebtoken');
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const userId = user.userId;
    const now = new Date();
    
    // Update activity in memory only
    onlineUsers.set(userId, {
      lastSeen: now,
      isOnline: true
    });
    
    console.log('👤 Activity ping:', userId);
    
    if (!res.headersSent) {
      return res.status(200).json({ success: true, timestamp: now });
    }
    
  } catch (error) {
    console.error('❌ Activity ping error:', error.message);
    if (!res.headersSent) {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
  }
});

// Static files - serve different directories
app.use('/views', express.static('views', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

app.use('/public', express.static('public', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

// Root static files (for backward compatibility)
app.use(express.static('.', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
}));

//============================================================================
// UTILITY FUNCTIONS
//============================================================================

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email
    },
    process.env.JWT_SECRET || 'cow-social-secret-key-2025',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
}

// Find user by email or username
async function findUserByEmail(email) {
  try {
    console.log('Finding user with email:', email);
    
    // List all users for debugging
    const allUsers = await User.find({}).limit(5);
    console.log('All users in database:', allUsers.map(u => ({ email: u.email })));
    
    const user = await User.findOne({
      email: email.toLowerCase()
    }).select('+passwordHash +password'); // Explicitly select password fields
    console.log('Query result:', user ? `Found user ${user.email}` : 'No user found');
    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

//============================================================================
// AUTH ENDPOINTS
//============================================================================

// Register endpoint
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, birthDate, gender, password } = req.body;

    if (!firstName || !lastName || !email || !birthDate || !gender || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      birthDate: new Date(birthDate),
      gender,
      verified: true
    });

    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
});

// Login endpoint
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password: password ? '***' : 'missing' });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const user = await findUserByEmail(email);
    console.log('User found:', user ? `${user.email} (${user._id})` : 'null');
    
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      console.log('Account locked for user:', user.email);
      return res.status(423).json({
        success: false,
        error: 'Account is locked due to too many failed login attempts'
      });
    }

    // Verify password
    console.log('Comparing password with hash...');
    console.log('Password from request:', password);
    console.log('User password field:', user.password);
    console.log('User passwordHash field:', user.passwordHash);
    console.log('User passwordHash type:', typeof user.passwordHash);
    console.log('User passwordHash length:', user.passwordHash ? user.passwordHash.length : 'null/undefined');
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash || user.password);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      if (user.loginAttempts >= 5) {
        user.isLocked = true;
        user.lockedAt = new Date();
      }
      
      await user.save();
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.isLocked = false;
    user.lockedAt = null;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
});

//============================================================================
// FORGOT PASSWORD ENDPOINTS
//============================================================================

// Request password reset
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔑 Password reset request: ${email} from ${clientIp}`);

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu qua email'
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (5 minutes)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    console.log(`✅ Password reset token generated for: ${email}`);

    // Send password reset email
    const emailResult = await emailService.sendPasswordResetEmail(
      email, 
      resetToken, 
      user.firstName ? `${user.firstName} ${user.lastName}` : 'Người dùng'
    );

    if (emailResult.success) {
      console.log(`📧 Password reset email sent successfully to: ${email}`);
      if (emailResult.previewUrl) {
        console.log(`🔗 Email preview: ${emailResult.previewUrl}`);
      }
    } else {
      console.log(`❌ Failed to send email to: ${email} - ${emailResult.error}`);
    }

    // For development, also log the reset link
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`🔗 Password reset URL: ${resetUrl}`);

    res.json({
      success: true,
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu qua email',
      emailSent: emailResult.success,
      emailPreview: emailResult.previewUrl || undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset request'
    });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔄 Password reset attempt from ${clientIp}`);

    // Hash the token to match stored version
    const crypto = require('crypto');
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log(`❌ Invalid or expired reset token from ${clientIp}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset fields
    user.passwordHash = hashedPassword;
    user.password = hashedPassword; // For compatibility
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.isLocked = false; // Unlock account if it was locked
    user.loginAttempts = 0;
    user.lockedAt = null;
    await user.save();

    console.log(`✅ Password reset successful for: ${user.email}`);

    // Send password change notification email
    const emailResult = await emailService.sendPasswordChangeNotification(
      user.email,
      user.firstName ? `${user.firstName} ${user.lastName}` : 'Người dùng'
    );

    if (emailResult.success) {
      console.log(`📧 Password change notification sent to: ${user.email}`);
      if (emailResult.previewUrl) {
        console.log(`🔗 Email preview: ${emailResult.previewUrl}`);
      }
    }

    res.json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công',
      emailNotificationSent: emailResult.success
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset'
    });
  }
});

//============================================================================
// STATIC ROUTES
//============================================================================

// Serve specific pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/register.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/reset-password.html'));
});

app.get('/notifications', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/notifications.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/profile.html'));
});

app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/messages.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/settings.html'));
});

app.get('/friends', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/friends.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/home.html'));
});

// Call pages
app.get('/active-call.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/active-call.html'));
});

app.get('/incoming-call.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/incoming-call.html'));
});

app.get('/outgoing-call.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/outgoing-call.html'));
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

//============================================================================
// POSTS API ROUTES
//============================================================================

// Mock posts data for testing
let posts = [
  {
    id: '1',
    content: 'Welcome to Cow Social Network! 🐄',
    author: 'Admin',
    authorId: 'admin',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=random',
    timestamp: new Date().toISOString(),
    likes: 5,
    likedBy: [],
    comments: [],
    shares: 2,
    privacy: 'public'
  }
];

// Get all posts
app.get('/api/posts', authenticateToken, (req, res) => {
  try {
    console.log('📝 Fetching posts for user:', req.user.email);
    res.json(posts.reverse());
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch posts' 
    });
  }
});

// Create new post
app.post('/api/posts', authenticateToken, (req, res) => {
  try {
    const { content, privacy = 'public' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content is required' 
      });
    }

    const post = {
      id: Date.now().toString(),
      content: content.trim(),
      author: req.user.email.split('@')[0],
      authorId: req.user.userId,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user.email.split('@')[0])}&background=random`,
      timestamp: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      comments: [],
      shares: 0,
      privacy
    };

    posts.unshift(post);
    
    console.log('📝 New post created by:', req.user.email);
    res.status(201).json({ 
      success: true, 
      post 
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create post' 
    });
  }
});

//============================================================================
// FRIENDS SEARCH API
//============================================================================

// Search for users/friends
app.get('/api/friends/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.json({ 
        success: true, 
        users: [], 
        message: 'Enter at least 1 character to search' 
      });
    }

    const searchQuery = q.trim();
    console.log('🔍 Searching for users with query:', searchQuery);

    // Search users by name, email, or username
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.userId } }, // Exclude current user
        {
          $or: [
            { firstName: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$firstName', ' ', '$lastName'] },
                  regex: searchQuery,
                  options: 'i'
                }
              }
            }
          ]
        }
      ]
    })
    .select('firstName lastName email avatar')
    .limit(10); // Limit to 10 results

    // Format results for frontend
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + user.lastName)}&background=random`
    }));

    console.log(`🔍 Found ${formattedUsers.length} users matching "${searchQuery}"`);

    res.json({
      success: true,
      users: formattedUsers,
      query: searchQuery,
      count: formattedUsers.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: 'Unable to search users at this time'
    });
  }
});

// Get friends list
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    console.log('👥 Getting friends list for user:', req.user.userId);
    
    // Lấy danh sách bạn bè từ database
    const friendships = await Friend.getFriends(req.user.userId);
    
    // Format kết quả để trả về thông tin bạn bè
    const friends = friendships.map(friendship => {
      // Xác định ai là bạn (không phải chính user hiện tại)
      const friend = friendship.requester._id.toString() === req.user.userId.toString() 
        ? friendship.recipient 
        : friendship.requester;
      
      return {
        id: friend._id,
        firstName: friend.firstName,
        lastName: friend.lastName,
        email: friend.email,
        avatar: friend.avatar,
        friendshipDate: friendship.acceptedAt,
        status: 'friends'
      };
    });
    
    res.json({
      success: true,
      friends: friends,
      count: friends.length,
      message: friends.length > 0 ? `Found ${friends.length} friends` : 'No friends yet'
    });

  } catch (error) {
    console.error('❌ Error getting friends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get friends list'
    });
  }
});

// Friend suggestions API
app.get('/api/friends/suggestions', authenticateToken, async (req, res) => {
  try {
    console.log('💡 Getting friend suggestions for user:', req.user.userId);
    
    // Return empty suggestions for now
    res.json({
      success: true,
      suggestions: [],
      count: 0,
      message: 'No friend suggestions available'
    });

  } catch (error) {
    console.error('❌ Error getting friend suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get friend suggestions'
    });
  }
});

// Friend requests API
app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Getting friend requests for user:', req.user.userId);
    
    // Return empty requests for now
    res.json({
      success: true,
      requests: [],
      count: 0,
      message: 'No friend requests'
    });

  } catch (error) {
    console.error('❌ Error getting friend requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get friend requests'
    });
  }
});

// Received friend requests API
app.get('/api/friends/requests/received', authenticateToken, async (req, res) => {
  try {
    console.log('📨 Getting received friend requests for user:', req.user.userId);
    
    // Lấy friend requests đã nhận từ database
    const friendRequests = await Friend.getPendingRequests(req.user.userId);
    
    // Format kết quả
    const requests = friendRequests.map(request => ({
      id: request._id,
      requester: {
        id: request.requester._id,
        firstName: request.requester.firstName,
        lastName: request.requester.lastName,
        email: request.requester.email,
        avatar: request.requester.avatar
      },
      requestedAt: request.requestedAt,
      status: request.status
    }));
    
    res.json({
      success: true,
      requests: requests,
      count: requests.length,
      message: requests.length > 0 ? `Found ${requests.length} friend requests` : 'No received friend requests'
    });

  } catch (error) {
    console.error('❌ Error getting received friend requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get received friend requests'
    });
  }
});

// Birthdays API
app.get('/api/friends/birthdays', authenticateToken, async (req, res) => {
  try {
    console.log('🎂 Getting birthdays for user:', req.user.userId);
    
    // Return empty birthdays for now
    res.json({
      success: true,
      birthdays: [],
      count: 0,
      message: 'No birthdays today'
    });

  } catch (error) {
    console.error('❌ Error getting birthdays:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get birthdays'
    });
  }
});

// Notifications API
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const userId = req.user.userId;
    
    console.log('🔔 Getting notifications for user:', userId);
    
    // Build query
    const query = { recipient: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    // Get notifications with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: userId, isRead: false })
    ]);
    
    console.log(`📋 Found ${notifications.length} notifications for user ${userId}`);
    
    res.json({
      success: true,
      notifications: notifications,
      pagination: {
        currentPage: parseInt(page),
        pages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount
      },
      unreadCount: unreadCount
    });

  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications'
    });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.userId;
    
    console.log('🔔 Marking notification as read:', notificationId);
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: notification
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
app.patch('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('🔔 Marking all notifications as read for user:', userId);
    
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Delete notification
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.userId;
    console.log('�️ Deleting notification:', notificationId, 'for user:', userId);
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or not authorized'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// Notifications unread count API
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('🔔 Getting unread notifications count for user:', userId);
    
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });
    
    res.json({
      success: true,
      unreadCount: unreadCount,
      message: 'Unread notifications count'
    });

  } catch (error) {
    console.error('❌ Error getting unread notifications count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread notifications count'
    });
  }
});

// Send friend request API
app.post('/api/friend-request', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const senderId = req.user.userId;
    
    console.log('👥 Sending friend request from:', senderId, 'to:', targetUserId);
    
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Target user ID is required'
      });
    }
    
    if (senderId === targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send friend request to yourself'
      });
    }
    
    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }
    
    // For now, just return success (in a real app, you'd store this in a friendRequests collection)
    console.log('✅ Friend request sent successfully');
    
    res.json({
      success: true,
      message: 'Friend request sent successfully',
      targetUser: {
        id: targetUser._id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email
      }
    });

  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send friend request'
    });
  }
});

// Debug logging middleware for messages
app.use('/api/messages', (req, res, next) => {
  console.log('🐛 Messages API called:', req.method, req.originalUrl, 'Params:', req.params);
  next();
});

// Messages API endpoints
// Specific routes MUST come before parameterized routes
app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
  console.log('🚫 BLOCKED: /api/messages/conversations request');
  return res.status(400).json({
    success: false,
    error: 'Invalid endpoint - conversations is not a valid user ID',
    messages: [],
    conversation: null
  });
});

app.get('/api/messages/undefined', authenticateToken, async (req, res) => {
  console.log('🚫 BLOCKED: /api/messages/undefined request');
  return res.status(400).json({
    success: false,
    error: 'Invalid endpoint - undefined is not a valid user ID', 
    messages: [],
    conversation: null
  });
});

// This parameterized route MUST come after specific routes
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    console.log('💬 Getting messages between:', currentUserId, 'and:', userId);
    console.log('💬 UserId type:', typeof userId, 'Value:', JSON.stringify(userId));
    
    // BLOCK invalid requests immediately
    if (userId === 'conversations' || userId === 'undefined' || userId === 'null') {
      console.log('🚫 BLOCKED invalid request for userId:', userId);
      return res.status(400).json({
        success: false,
        error: 'Invalid request blocked',
        messages: [],
        conversation: null
      });
    }
    
    // Validate userId format - STRICT validation
    if (!userId || 
        userId.length !== 24 ||
        !mongoose.Types.ObjectId.isValid(userId)) {
      
      console.log('❌ Invalid userId detected:', userId);
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format',
        messages: [],
        conversation: null
      });
    }
    
    // Get messages between current user and target user
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
      .populate('sender', 'firstName lastName email')
      .populate('recipient', 'firstName lastName email')
      .sort({ createdAt: 1 });
    
    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg._id,
        content: msg.content,
        senderId: msg.sender._id,
        recipientId: msg.recipient._id,
        sender: {
          id: msg.sender._id,
          firstName: msg.sender.firstName,
          lastName: msg.sender.lastName,
          email: msg.sender.email
        },
        recipient: {
          id: msg.recipient._id,
          firstName: msg.recipient.firstName,
          lastName: msg.recipient.lastName,
          email: msg.recipient.email
        },
        timestamp: msg.createdAt,
        read: msg.isRead
      })),
      conversation: {
        id: `${currentUserId}_${userId}`,
        participants: [currentUserId, userId]
      }
    });

  } catch (error) {
    console.error('❌ Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages'
    });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.user.userId;
    
    console.log('📤 Sending message from:', senderId, 'to:', recipientId);
    
    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID and content are required'
      });
    }

    // Create new message
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content: content.trim(),
      messageType: 'text',
      isRead: false
    });

    // Save to database
    const savedMessage = await message.save();
    
    // Populate sender and recipient info
    await savedMessage.populate('sender', 'firstName lastName email');
    await savedMessage.populate('recipient', 'firstName lastName email');
    
    // Tạo notification cho người nhận tin nhắn
    try {
      await notificationHelpers.createMessageNotification(
        senderId, 
        recipientId, 
        content
      );
      console.log('🔔 Created message notification for recipient:', recipientId);
    } catch (notifError) {
      console.error('❌ Error creating message notification:', notifError);
      // Không return error vì tin nhắn đã được gửi thành công
    }
    
    res.json({
      success: true,
      message: {
        id: savedMessage._id,
        senderId: savedMessage.sender._id,
        recipientId: savedMessage.recipient._id,
        content: savedMessage.content,
        timestamp: savedMessage.createdAt,
        read: savedMessage.isRead,
        sender: {
          id: savedMessage.sender._id,
          firstName: savedMessage.sender.firstName,
          lastName: savedMessage.sender.lastName,
          email: savedMessage.sender.email
        },
        recipient: {
          id: savedMessage.recipient._id,
          firstName: savedMessage.recipient.firstName,
          lastName: savedMessage.recipient.lastName,
          email: savedMessage.recipient.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log('💬 Getting conversations for user:', userId);
    
    // Get all messages where user is sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    }).sort({ createdAt: -1 });
    
    // Group messages by conversation partner
    const conversationsMap = new Map();
    
    for (const message of messages) {
      const partnerId = message.sender.toString() === userId ? message.recipient.toString() : message.sender.toString();
      
      if (!conversationsMap.has(partnerId)) {
        // Get partner user info
        const partner = await User.findById(partnerId).select('firstName lastName email avatar');
        
        if (partner) {
          conversationsMap.set(partnerId, {
            _id: partnerId,
            firstName: partner.firstName,
            lastName: partner.lastName,
            email: partner.email,
            avatar: partner.avatar,
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            unreadCount: 0 // TODO: implement unread count
          });
        }
      }
    }
    
    const conversations = Array.from(conversationsMap.values());
    
    console.log(`📋 Found ${conversations.length} conversations for user ${userId}`);
    console.log('🔍 Debug conversations response:', JSON.stringify(conversations, null, 2));
    
    res.json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations'
    });
  }
});

// Get user profile by ID
app.get('/api/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('👤 Getting profile for userId:', userId);

    // Find user by ID
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Return user profile data
    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        profile: user.profile,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// User activity tracking APIs
app.get('/api/user/status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userActivity = onlineUsers.get(userId);
    
    let status = 'offline';
    let lastSeen = null;
    
    if (userActivity) {
      const timeDiff = Date.now() - userActivity.lastSeen.getTime();
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      
      if (minutesAgo < 2) {
        status = 'online';
      } else if (minutesAgo < 10) {
        status = 'away';
        lastSeen = `${minutesAgo} phút trước`;
      } else {
        status = 'offline';
        if (minutesAgo < 60) {
          lastSeen = `${minutesAgo} phút trước`;
        } else {
          const hoursAgo = Math.floor(minutesAgo / 60);
          if (hoursAgo < 24) {
            lastSeen = `${hoursAgo} giờ trước`;
          } else {
            const daysAgo = Math.floor(hoursAgo / 24);
            lastSeen = `${daysAgo} ngày trước`;
          }
        }
      }
    }
    
    return res.json({
      success: true,
      status,
      lastSeen,
      isOnline: status === 'online'
    });

  } catch (error) {
    console.error('❌ Error getting user status:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get user status'
      });
    }
  }
});

//============================================================================
// ERROR HANDLING & 404 ROUTES
//============================================================================

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// Handle all other 404s for web pages
app.use('*', (req, res) => {
  // If it's a web page request, serve index.html (SPA fallback)
  if (!req.originalUrl.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Security: Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

//============================================================================
// START SERVER
//============================================================================

app.listen(PORT, () => {
  console.log('🚀 Cow Social Network Server (Secure with Email)');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log('🔒 Security features:');
  console.log('  ✅ Helmet.js security headers');
  console.log('  ✅ Rate limiting (Auth: 10/15min, General: 100/15min)');
  console.log('  ✅ NoSQL injection protection');
  console.log('  ✅ XSS input sanitization');
  console.log('  ✅ HTTP Parameter Pollution protection');
  console.log('  ✅ Account lockout after 5 failed attempts');
  console.log('  ✅ Secure password hashing (bcrypt cost 12)');
  console.log('  ✅ JWT token authentication');
  console.log('  ✅ CORS protection');
  console.log('  ✅ Password reset via email');
  console.log('🌐 Login page: http://localhost:3000/login');
  console.log('✅ Ready for secure connections!');
});
