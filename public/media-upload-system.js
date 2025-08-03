const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Create upload directories
const uploadDirs = ['uploads', 'uploads/images', 'uploads/videos', 'uploads/thumbnails'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage configuration for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'vid-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filters
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

// Upload configurations
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos
  }
});

// Mock data storage
const mockPosts = new Map();
const mockUsers = new Map();
const mockMediaFiles = new Map();
let postIdCounter = 1;
let mediaIdCounter = 1;

// Helper functions
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Create sample posts with media
function createSamplePosts() {
  const samplePosts = [
    {
      title: 'Beautiful sunset from my hiking trip!',
      content: 'Just captured this amazing sunset during my weekend hike. Nature never fails to amaze me! The colors were absolutely breathtaking.',
      category: 'travel',
      tags: ['sunset', 'hiking', 'nature', 'photography'],
      privacy: 'public',
      mediaUrls: [] // Will be populated with sample images
    },
    {
      title: 'My latest cooking experiment - homemade pasta!',
      content: 'Spent the entire afternoon making fresh pasta from scratch. Here is the step-by-step process. The result was absolutely delicious!',
      category: 'food',
      tags: ['cooking', 'pasta', 'homemade', 'recipe'],
      privacy: 'public',
      mediaUrls: [] // Will be populated with sample images/videos
    }
  ];
  
  samplePosts.forEach((postData, index) => {
    const postId = `post_${postIdCounter++}`;
    
    const post = {
      id: postId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      tags: postData.tags,
      privacy: postData.privacy,
      mediaUrls: postData.mediaUrls,
      authorId: `demo_user_${index + 1}`,
      authorName: ['Alice Johnson', 'Bob Smith'][index],
      createdAt: new Date(Date.now() - (index * 3600000)),
      updatedAt: new Date(Date.now() - (index * 3600000)),
      likesCount: Math.floor(Math.random() * 50) + 5,
      commentsCount: Math.floor(Math.random() * 20) + 2,
      sharesCount: Math.floor(Math.random() * 10),
      viewsCount: Math.floor(Math.random() * 200) + 50,
      isEdited: false
    };
    
    mockPosts.set(postId, post);
  });
}

// Test route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'media-upload-interface.html'));
});

app.get('/api/test-media', (req, res) => {
  res.json({
    success: true,
    message: 'Media Upload System Active!',
    features: {
      imageUpload: 'Available (Max 10MB)',
      videoUpload: 'Available (Max 100MB)',
      thumbnailGeneration: 'Available',
      mediaGallery: 'Available',
      postIntegration: 'Available'
    },
    supportedFormats: {
      images: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videos: ['MP4', 'WebM', 'AVI', 'MOV']
    },
    stats: {
      totalPosts: mockPosts.size,
      totalMediaFiles: mockMediaFiles.size
    }
  });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    const userId = generateId();
    const token = `demo_token_${userId}`;
    
    mockUsers.set(userId, {
      id: userId,
      username,
      isOnline: true,
      lastActive: new Date()
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: userId,
          username,
          isOnline: true
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Username and password required'
    });
  }
});

// Media upload endpoints
app.post('/api/media/upload-image', uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    const mediaId = `media_${mediaIdCounter++}`;
    const mediaInfo = {
      id: mediaId,
      type: 'image',
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      url: `/uploads/images/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: 'current_user',
      uploadedAt: new Date(),
      metadata: {
        width: null,
        height: null,
        format: path.extname(req.file.originalname).substring(1).toUpperCase()
      }
    };
    
    mockMediaFiles.set(mediaId, mediaInfo);
    
    // Emit upload event
    io.emit('media_uploaded', {
      mediaId,
      type: 'image',
      filename: req.file.filename,
      size: req.file.size
    });
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: mediaInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + error.message
    });
  }
});

app.post('/api/media/upload-video', uploadVideo.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }
    
    const mediaId = `media_${mediaIdCounter++}`;
    const mediaInfo = {
      id: mediaId,
      type: 'video',
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      url: `/uploads/videos/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: 'current_user',
      uploadedAt: new Date(),
      metadata: {
        duration: null,
        width: null,
        height: null,
        format: path.extname(req.file.originalname).substring(1).toUpperCase(),
        thumbnailUrl: null
      }
    };
    
    mockMediaFiles.set(mediaId, mediaInfo);
    
    // Generate thumbnail (simplified - in real app would use ffmpeg)
    setTimeout(() => {
      mediaInfo.metadata.thumbnailUrl = `/uploads/thumbnails/thumb_${req.file.filename}.jpg`;
      mockMediaFiles.set(mediaId, mediaInfo);
    }, 1000);
    
    // Emit upload event
    io.emit('media_uploaded', {
      mediaId,
      type: 'video',
      filename: req.file.filename,
      size: req.file.size
    });
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: mediaInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + error.message
    });
  }
});

// Multiple files upload
app.post('/api/media/upload-multiple', uploadImage.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }
    
    const uploadedFiles = req.files.map(file => {
      const mediaId = `media_${mediaIdCounter++}`;
      const mediaInfo = {
        id: mediaId,
        type: 'image',
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        url: `/uploads/images/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: 'current_user',
        uploadedAt: new Date(),
        metadata: {
          width: null,
          height: null,
          format: path.extname(file.originalname).substring(1).toUpperCase()
        }
      };
      
      mockMediaFiles.set(mediaId, mediaInfo);
      return mediaInfo;
    });
    
    // Emit upload event
    io.emit('multiple_media_uploaded', {
      count: uploadedFiles.length,
      files: uploadedFiles.map(f => ({ id: f.id, filename: f.filename }))
    });
    
    res.json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Upload failed: ' + error.message
    });
  }
});

// Get media files
app.get('/api/media', (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  let mediaFiles = Array.from(mockMediaFiles.values());
  
  // Filter by type
  if (type && type !== 'all') {
    mediaFiles = mediaFiles.filter(file => file.type === type);
  }
  
  // Sort by upload date (newest first)
  mediaFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedFiles = mediaFiles.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      files: paginatedFiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(mediaFiles.length / limit),
        totalFiles: mediaFiles.length,
        hasNext: endIndex < mediaFiles.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Get specific media file
app.get('/api/media/:mediaId', (req, res) => {
  const { mediaId } = req.params;
  const mediaFile = mockMediaFiles.get(mediaId);
  
  if (mediaFile) {
    res.json({
      success: true,
      data: mediaFile
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Media file not found'
    });
  }
});

// Delete media file
app.delete('/api/media/:mediaId', (req, res) => {
  const { mediaId } = req.params;
  const mediaFile = mockMediaFiles.get(mediaId);
  
  if (mediaFile) {
    // Delete physical file
    try {
      if (fs.existsSync(mediaFile.path)) {
        fs.unlinkSync(mediaFile.path);
      }
      
      // Delete thumbnail if exists
      if (mediaFile.metadata.thumbnailUrl) {
        const thumbnailPath = path.join(__dirname, mediaFile.metadata.thumbnailUrl);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    
    mockMediaFiles.delete(mediaId);
    
    res.json({
      success: true,
      message: 'Media file deleted successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Media file not found'
    });
  }
});

// Posts with media support
app.get('/api/posts', (req, res) => {
  const { page = 1, limit = 10, category, search } = req.query;
  let posts = Array.from(mockPosts.values());
  
  // Filter by category
  if (category && category !== 'all') {
    posts = posts.filter(post => post.category === category);
  }
  
  // Search functionality
  if (search) {
    const searchTerm = search.toLowerCase();
    posts = posts.filter(post => 
      post.title.toLowerCase().includes(searchTerm) ||
      post.content.toLowerCase().includes(searchTerm) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }
  
  // Sort by creation date (newest first)
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedPosts = posts.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      posts: paginatedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(posts.length / limit),
        totalPosts: posts.length,
        hasNext: endIndex < posts.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

app.post('/api/posts', (req, res) => {
  const { title, content, category, tags = [], privacy = 'public', mediaIds = [] } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Title and content are required'
    });
  }
  
  const postId = `post_${postIdCounter++}`;
  
  // Get media URLs from media IDs
  const mediaUrls = mediaIds.map(mediaId => {
    const mediaFile = mockMediaFiles.get(mediaId);
    return mediaFile ? mediaFile.url : null;
  }).filter(url => url !== null);
  
  const post = {
    id: postId,
    title,
    content,
    category: category || 'general',
    tags,
    privacy,
    mediaUrls,
    mediaIds,
    authorId: 'current_user',
    authorName: 'Demo User',
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    isEdited: false
  };
  
  mockPosts.set(postId, post);
  
  // Emit new post event
  io.emit('new_post', {
    postId,
    title,
    authorName: post.authorName,
    category,
    hasMedia: mediaUrls.length > 0,
    mediaCount: mediaUrls.length,
    timestamp: post.createdAt
  });
  
  res.json({
    success: true,
    message: 'Post created successfully',
    data: post
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Socket.IO for real-time features
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('authenticate', data => {
    const { token } = data;
    if (token && token.startsWith('demo_token_')) {
      const userId = token.replace('demo_token_', '');
      socket.userId = userId;
      socket.join(`user:${userId}`);
      
      socket.emit('authenticated', { success: true, userId });
      console.log('User authenticated:', userId);
    } else {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });
  
  socket.on('upload_progress', data => {
    socket.broadcast.emit('user_uploading', {
      userId: socket.userId,
      filename: data.filename,
      progress: data.progress
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size allowed is 10MB for images and 100MB for videos.'
      });
    }
  }
  
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize sample data
createSamplePosts();

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`🚀 Cow Social Network - Media Upload System running on http://localhost:${PORT}`);
  console.log(`📸 Features available:`);
  console.log(`   🖼️  Image Upload (Max 10MB) - JPEG, PNG, GIF, WebP`);
  console.log(`   🎬 Video Upload (Max 100MB) - MP4, WebM, AVI, MOV`);
  console.log(`   📁 Multiple Files Upload (Max 10 files)`);
  console.log(`   🖥️  Thumbnail Generation for Videos`);
  console.log(`   📊 Media Gallery & Management`);
  console.log(`   ⚡ Real-time Upload Progress via Socket.IO`);
  console.log(`🧪 Test Interface: http://localhost:${PORT}/media-upload-interface.html`);
  console.log(`📡 API Test: http://localhost:${PORT}/api/test-media`);
});

module.exports = { app, server, io };
