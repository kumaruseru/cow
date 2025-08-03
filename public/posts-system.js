const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Mock data storage for posts system
const mockUsers = new Map();
const mockPosts = new Map();
const mockComments = new Map();
const mockLikes = new Map();
let postIdCounter = 1;
let commentIdCounter = 1;

// Helper functions
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Smart content analysis function
function analyzePostContent(content, title) {
  const analysis = {
    wordCount: content.split(' ').length,
    readingTime: Math.ceil(content.split(' ').length / 200), // 200 WPM average
    sentiment: 'neutral',
    topics: [],
    language: 'en',
    readability: 'medium',
    engagementPrediction: 0,
    contentQuality: 'medium',
    spamScore: 0
  };
  
  // Simple sentiment analysis
  const positiveWords = [
    'good', 'great', 'awesome', 'amazing', 'love', 'excellent', 
    'fantastic', 'wonderful', 'brilliant', 'perfect', 'outstanding'
  ];
  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 
    'disappointing', 'stupid', 'boring', 'annoying'
  ];
  
  const lowerContent = content.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
  
  if (positiveCount > negativeCount) {
    analysis.sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    analysis.sentiment = 'negative';
  }
  
  // Topic extraction (simplified)
  const topicKeywords = {
    technology: ['tech', 'ai', 'software', 'computer', 'digital', 'internet'],
    food: ['food', 'recipe', 'cooking', 'restaurant', 'delicious', 'taste'],
    travel: ['travel', 'trip', 'vacation', 'journey', 'adventure', 'explore'],
    sports: ['sports', 'game', 'team', 'player', 'match', 'championship'],
    music: ['music', 'song', 'album', 'artist', 'concert', 'melody'],
    art: ['art', 'painting', 'drawing', 'creative', 'design', 'artistic'],
    science: ['science', 'research', 'study', 'discovery', 'experiment'],
    business: ['business', 'company', 'market', 'profit', 'investment']
  };
  
  analysis.topics = Object.keys(topicKeywords).filter(topic =>
    topicKeywords[topic].some(keyword => lowerContent.includes(keyword))
  );
  
  // Content quality assessment
  if (analysis.wordCount > 50 && analysis.wordCount < 500) {
    analysis.contentQuality = 'high';
  } else if (analysis.wordCount < 20) {
    analysis.contentQuality = 'low';
  }
  
  // Spam detection (simplified)
  const spamIndicators = ['buy now', 'click here', 'free money', 'urgent', 'limited time'];
  analysis.spamScore = spamIndicators.filter(indicator => 
    lowerContent.includes(indicator)
  ).length * 20;
  
  // Engagement prediction based on multiple factors
  let score = 50; // Base score
  if (analysis.wordCount > 100 && analysis.wordCount < 300) score += 20; // Optimal length
  if (analysis.sentiment === 'positive') score += 15;
  if (title && title.includes('?')) score += 10; // Questions engage more
  if (analysis.topics.length > 0) score += 10; // Clear topic
  if (analysis.contentQuality === 'high') score += 15;
  if (analysis.spamScore > 0) score -= analysis.spamScore;
  
  analysis.engagementPrediction = Math.max(0, Math.min(100, score));
  
  return analysis;
}

// Create some sample posts
function createSamplePosts() {
  const samplePosts = [
    {
      title: 'What do you think about the future of AI?',
      content: 'Artificial Intelligence is rapidly evolving and changing how we work and live. From autonomous vehicles to smart assistants, AI is becoming an integral part of our daily lives. What are your thoughts on how AI will shape our future? Are you excited or concerned about these developments?',
      category: 'technology',
      tags: ['ai', 'technology', 'future'],
      privacy: 'public'
    },
    {
      title: 'Amazing homemade pizza recipe!',
      content: 'Just tried making pizza from scratch and it turned out incredible! The secret is in the dough - let it rise for at least 24 hours for the best flavor. Topped with fresh mozzarella, basil, and a touch of olive oil. Cooking at high heat for just 90 seconds gives you that perfect crispy crust.',
      category: 'food',
      tags: ['pizza', 'recipe', 'cooking', 'homemade'],
      privacy: 'public'
    },
    {
      title: 'My weekend hiking adventure',
      content: 'Spent the weekend exploring the mountain trails. The weather was perfect and the views were absolutely breathtaking. There is something magical about being surrounded by nature and disconnecting from the digital world for a while. Highly recommend the Pine Ridge trail for anyone looking for a moderate hike.',
      category: 'travel',
      tags: ['hiking', 'nature', 'weekend', 'adventure'],
      privacy: 'public'
    }
  ];
  
  samplePosts.forEach((postData, index) => {
    const postId = 'post_' + (postIdCounter++);
    const contentAnalysis = analyzePostContent(postData.content, postData.title);
    
    const post = {
      id: postId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      tags: postData.tags,
      privacy: postData.privacy,
      mediaUrls: [],
      authorId: 'demo_user_' + (index + 1),
      authorName: ['Alice Johnson', 'Bob Smith', 'Carol Davis'][index],
      createdAt: new Date(Date.now() - (index * 3600000)), // Different times
      updatedAt: new Date(Date.now() - (index * 3600000)),
      likesCount: Math.floor(Math.random() * 50) + 5,
      commentsCount: Math.floor(Math.random() * 20) + 2,
      sharesCount: Math.floor(Math.random() * 10),
      viewsCount: Math.floor(Math.random() * 200) + 50,
      isEdited: false,
      contentAnalysis,
      engagement: {
        score: contentAnalysis.engagementPrediction,
        reactions: {
          like: Math.floor(Math.random() * 30) + 5,
          love: Math.floor(Math.random() * 15) + 2,
          haha: Math.floor(Math.random() * 5),
          wow: Math.floor(Math.random() * 8),
          sad: Math.floor(Math.random() * 3),
          angry: Math.floor(Math.random() * 2)
        }
      }
    };
    
    mockPosts.set(postId, post);
  });
}

// Test routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'posts-interface.html'));
});

app.get('/api/test-posts', (req, res) => {
  res.json({
    success: true,
    message: 'Posts Management System Active!',
    features: {
      posting: 'Available',
      smartAnalysis: 'Available',
      comments: 'Available',
      reactions: 'Available',
      analytics: 'Available'
    },
    stats: {
      totalPosts: mockPosts.size,
      totalComments: mockComments.size,
      totalLikes: mockLikes.size
    }
  });
});

// Auth endpoints (simple mock)
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

// Posts Management System
app.get('/api/posts', (req, res) => {
  const { page = 1, limit = 10, category, userId, search, sortBy = 'createdAt' } = req.query;
  let posts = Array.from(mockPosts.values());
  
  // Filter by category
  if (category && category !== 'all') {
    posts = posts.filter(post => post.category === category);
  }
  
  // Filter by user
  if (userId) {
    posts = posts.filter(post => post.authorId === userId);
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
  
  // Sort posts
  switch (sortBy) {
    case 'engagement':
      posts.sort((a, b) => b.engagement.score - a.engagement.score);
      break;
    case 'likes':
      posts.sort((a, b) => b.likesCount - a.likesCount);
      break;
    case 'comments':
      posts.sort((a, b) => b.commentsCount - a.commentsCount);
      break;
    case 'views':
      posts.sort((a, b) => b.viewsCount - a.viewsCount);
      break;
    default:
      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
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
  const { title, content, category, tags = [], privacy = 'public', mediaUrls = [] } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Title and content are required'
    });
  }
  
  const postId = `post_${postIdCounter++}`;
  
  // Smart content analysis
  const contentAnalysis = analyzePostContent(content, title);
  
  const post = {
    id: postId,
    title,
    content,
    category: category || 'general',
    tags,
    privacy,
    mediaUrls,
    authorId: 'current_user',
    authorName: 'Demo User',
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    isEdited: false,
    contentAnalysis,
    engagement: {
      score: contentAnalysis.engagementPrediction,
      reactions: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0
      }
    }
  };
  
  mockPosts.set(postId, post);
  
  // Emit new post event
  io.emit('new_post', {
    postId,
    title,
    authorName: post.authorName,
    category,
    contentAnalysis,
    timestamp: post.createdAt
  });
  
  res.json({
    success: true,
    message: 'Post created successfully',
    data: post
  });
});

app.get('/api/posts/:postId', (req, res) => {
  const { postId } = req.params;
  const post = mockPosts.get(postId);
  
  if (post) {
    // Increment view count
    post.viewsCount++;
    mockPosts.set(postId, post);
    
    // Get comments for this post
    const comments = Array.from(mockComments.values())
      .filter(comment => comment.postId === postId && !comment.parentCommentId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Get replies for each comment
    const commentsWithReplies = comments.map(comment => {
      const replies = Array.from(mockComments.values())
        .filter(reply => reply.parentCommentId === comment.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      return { ...comment, replies };
    });
    
    res.json({
      success: true,
      data: {
        post,
        comments: commentsWithReplies
      }
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }
});

// Comments Management
app.post('/api/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId = null } = req.body;
  const post = mockPosts.get(postId);
  
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment content is required'
    });
  }
  
  const commentId = `comment_${commentIdCounter++}`;
  const comment = {
    id: commentId,
    postId,
    parentCommentId,
    content: content.trim(),
    authorId: 'current_user',
    authorName: 'Demo User',
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    repliesCount: 0,
    isEdited: false
  };
  
  mockComments.set(commentId, comment);
  
  // Update post comment count
  post.commentsCount++;
  mockPosts.set(postId, post);
  
  // If it's a reply, update parent comment reply count
  if (parentCommentId) {
    const parentComment = mockComments.get(parentCommentId);
    if (parentComment) {
      parentComment.repliesCount++;
      mockComments.set(parentCommentId, parentComment);
    }
  }
  
  // Emit new comment event
  io.emit('new_comment', {
    postId,
    commentId,
    authorName: comment.authorName,
    content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
    isReply: !!parentCommentId,
    timestamp: comment.createdAt
  });
  
  res.json({
    success: true,
    message: 'Comment added successfully',
    data: comment
  });
});

// Likes and Reactions Management
app.post('/api/posts/:postId/like', (req, res) => {
  const { postId } = req.params;
  const { reactionType = 'like' } = req.body;
  const post = mockPosts.get(postId);
  
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }
  
  const existingLike = Array.from(mockLikes.values())
    .find(like => like.postId === postId && like.userId === 'current_user');
  
  if (existingLike) {
    // Update existing reaction
    const oldReaction = existingLike.reactionType;
    existingLike.reactionType = reactionType;
    existingLike.updatedAt = new Date();
    mockLikes.set(existingLike.id, existingLike);
    
    // Update post reaction counts
    post.engagement.reactions[oldReaction]--;
    post.engagement.reactions[reactionType]++;
    mockPosts.set(postId, post);
    
    res.json({
      success: true,
      message: 'Reaction updated',
      data: existingLike
    });
  } else {
    // Create new reaction
    const likeId = `like_${generateId()}`;
    const like = {
      id: likeId,
      postId,
      userId: 'current_user',
      userName: 'Demo User',
      reactionType,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockLikes.set(likeId, like);
    
    // Update post like count and engagement
    post.likesCount++;
    post.engagement.reactions[reactionType]++;
    post.engagement.score = Math.min(100, post.engagement.score + 5);
    mockPosts.set(postId, post);
    
    // Emit like event
    io.emit('post_liked', {
      postId,
      userName: like.userName,
      reactionType,
      timestamp: like.createdAt
    });
    
    res.json({
      success: true,
      message: 'Reaction added successfully',
      data: like
    });
  }
});

// Post Analytics
app.get('/api/posts/:postId/analytics', (req, res) => {
  const { postId } = req.params;
  const post = mockPosts.get(postId);
  
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }
  
  // Calculate engagement metrics
  const totalInteractions = post.likesCount + post.commentsCount + post.sharesCount;
  const engagementRate = post.viewsCount > 0 ? (totalInteractions / post.viewsCount) * 100 : 0;
  
  const analytics = {
    postId,
    metrics: {
      views: post.viewsCount,
      likes: post.likesCount,
      comments: post.commentsCount,
      shares: post.sharesCount,
      totalInteractions,
      engagementRate: parseFloat(engagementRate.toFixed(2))
    },
    reactions: post.engagement.reactions,
    contentAnalysis: post.contentAnalysis,
    performance: {
      trending: engagementRate > 5,
      viral: totalInteractions > 100,
      quality: post.contentAnalysis.engagementPrediction > 70,
      spam: post.contentAnalysis.spamScore > 40
    },
    recommendations: {
      posting: getPostingRecommendations(post),
      engagement: getEngagementRecommendations(post)
    }
  };
  
  res.json({
    success: true,
    data: analytics
  });
});

// Helper functions for recommendations
function getPostingRecommendations(post) {
  const recommendations = [];
  
  if (post.contentAnalysis.wordCount < 50) {
    recommendations.push('Consider adding more detail to increase engagement');
  }
  
  if (post.contentAnalysis.wordCount > 500) {
    recommendations.push('Consider breaking long posts into series for better readability');
  }
  
  if (post.contentAnalysis.topics.length === 0) {
    recommendations.push('Add relevant hashtags to help categorize your content');
  }
  
  if (post.contentAnalysis.sentiment === 'negative') {
    recommendations.push('Positive content typically receives higher engagement');
  }
  
  return recommendations;
}

function getEngagementRecommendations(post) {
  const recommendations = [];
  
  if (post.engagement.score < 50) {
    recommendations.push('Try asking questions to encourage comments');
    recommendations.push('Share personal experiences to create connection');
  }
  
  if (post.commentsCount === 0) {
    recommendations.push('Respond to comments quickly to boost engagement');
  }
  
  if (post.contentAnalysis.readingTime > 3) {
    recommendations.push('Consider using bullet points or shorter paragraphs');
  }
  
  return recommendations;
}

// Socket.IO for real-time features
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  // Authentication
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
  
  // Real-time post interactions
  socket.on('view_post', data => {
    const { postId } = data;
    io.emit('post_viewed', {
      postId,
      viewerId: socket.userId,
      timestamp: new Date()
    });
  });
  
  socket.on('start_typing_comment', data => {
    const { postId } = data;
    socket.broadcast.emit('user_typing_comment', {
      postId,
      userId: socket.userId,
      isTyping: true
    });
  });
  
  socket.on('stop_typing_comment', data => {
    const { postId } = data;
    socket.broadcast.emit('user_typing_comment', {
      postId,
      userId: socket.userId,
      isTyping: false
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize sample data
createSamplePosts();

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Cow Social Network - Posts System running on http://localhost:${PORT}`);
  console.log(`📝 Features available:`);
  console.log(`   ✍️  Smart Post Creation with AI Analysis`);
  console.log(`   💬 Comments & Replies System`);
  console.log(`   ❤️  Reactions & Likes Management`);
  console.log(`   📊 Advanced Analytics & Insights`);
  console.log(`   🔍 Search & Filter Posts`);
  console.log(`   ⚡ Real-time Updates via Socket.IO`);
  console.log(`🧪 Test Interface: http://localhost:${PORT}/posts-interface.html`);
  console.log(`📡 API Test: http://localhost:${PORT}/api/test-posts`);
});

module.exports = { app, server, io };
