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
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Mock data storage
const mockUsers = new Map();
const mockFriendRequests = new Map();
const mockFriendships = new Map();
const mockUserSearchHistory = new Map();
const mockUserSuggestions = new Map();
const mockUserBlocked = new Map();
const mockUserPreferences = new Map();

let userIdCounter = 1;
let requestIdCounter = 1;
let friendshipIdCounter = 1;

// Helper functions
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Friend request status enum
const REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

// Friendship type enum
const FRIENDSHIP_TYPE = {
  FRIEND: 'friend',
  CLOSE_FRIEND: 'close_friend',
  ACQUAINTANCE: 'acquaintance',
  FAMILY: 'family',
  COLLEAGUE: 'colleague'
};

// Initialize sample data
function initializeSampleData() {
  // Create sample users with diverse profiles
  const sampleUsers = [
    {
      username: 'alice_nguyen',
      email: 'alice.nguyen@example.com',
      displayName: 'Alice Nguyễn',
      firstName: 'Alice',
      lastName: 'Nguyễn',
      age: 25,
      location: 'Hồ Chí Minh, Việt Nam',
      occupation: 'Software Engineer',
      education: 'HCMUS - Computer Science',
      interests: ['Programming', 'Travel', 'Photography', 'Coffee'],
      bio: 'Passionate developer who loves to explore new technologies and travel around the world. Always eager to learn and share knowledge with others.',
      avatar: 'https://ui-avatars.com/api/?name=Alice+Nguyen&background=4CAF50',
      coverPhoto: null,
      mutualFriends: 0,
      isVerified: true,
      joinedDate: new Date('2023-01-15'),
      lastActive: new Date()
    },
    {
      username: 'bob_tran',
      email: 'bob.tran@example.com',
      displayName: 'Bob Trần',
      firstName: 'Bob',
      lastName: 'Trần',
      age: 28,
      location: 'Hà Nội, Việt Nam',
      occupation: 'UI/UX Designer',
      education: 'HUST - Design',
      interests: ['Design', 'Art', 'Music', 'Gaming'],
      bio: 'Creative designer with 5+ years experience. Love creating beautiful and user-friendly interfaces. Music and gaming enthusiast.',
      avatar: 'https://ui-avatars.com/api/?name=Bob+Tran&background=2196F3',
      coverPhoto: null,
      mutualFriends: 3,
      isVerified: false,
      joinedDate: new Date('2022-08-20'),
      lastActive: new Date(Date.now() - 3600000)
    },
    {
      username: 'charlie_le',
      email: 'charlie.le@example.com',
      displayName: 'Charlie Lê',
      firstName: 'Charlie',
      lastName: 'Lê',
      age: 30,
      location: 'Đà Nẵng, Việt Nam',
      occupation: 'Marketing Manager',
      education: 'NEU - Marketing',
      interests: ['Marketing', 'Business', 'Reading', 'Yoga'],
      bio: 'Marketing professional passionate about digital strategies and brand building. Love reading business books and practicing yoga in free time.',
      avatar: 'https://ui-avatars.com/api/?name=Charlie+Le&background=FF9800',
      coverPhoto: null,
      mutualFriends: 8,
      isVerified: true,
      joinedDate: new Date('2021-11-10'),
      lastActive: new Date(Date.now() - 7200000)
    },
    {
      username: 'diana_pham',
      email: 'diana.pham@example.com',
      displayName: 'Diana Phạm',
      firstName: 'Diana',
      lastName: 'Phạm',
      age: 23,
      location: 'Cần Thơ, Việt Nam',
      occupation: 'Content Creator',
      education: 'CTU - Communications',
      interests: ['Content Creation', 'Social Media', 'Fashion', 'Food'],
      bio: 'Content creator and social media enthusiast. Love sharing lifestyle, fashion tips and food reviews. Always looking for new trends and inspiration.',
      avatar: 'https://ui-avatars.com/api/?name=Diana+Pham&background=E91E63',
      coverPhoto: null,
      mutualFriends: 5,
      isVerified: true,
      joinedDate: new Date('2023-03-05'),
      lastActive: new Date(Date.now() - 1800000)
    },
    {
      username: 'emma_vo',
      email: 'emma.vo@example.com',
      displayName: 'Emma Võ',
      firstName: 'Emma',
      lastName: 'Võ',
      age: 26,
      location: 'Nha Trang, Việt Nam',
      occupation: 'Data Scientist',
      education: 'VNU - Data Science',
      interests: ['Data Science', 'Machine Learning', 'Swimming', 'Cooking'],
      bio: 'Data scientist passionate about AI and machine learning. Love analyzing data to find meaningful insights. Enjoy swimming and cooking in leisure time.',
      avatar: 'https://ui-avatars.com/api/?name=Emma+Vo&background=9C27B0',
      coverPhoto: null,
      mutualFriends: 12,
      isVerified: false,
      joinedDate: new Date('2022-06-18'),
      lastActive: new Date(Date.now() - 900000)
    },
    {
      username: 'frank_hoang',
      email: 'frank.hoang@example.com',
      displayName: 'Frank Hoàng',
      firstName: 'Frank',
      lastName: 'Hoàng',
      age: 32,
      location: 'Vũng Tàu, Việt Nam',
      occupation: 'Project Manager',
      education: 'UIT - Information Technology',
      interests: ['Project Management', 'Leadership', 'Sports', 'Investment'],
      bio: 'Experienced project manager with expertise in tech projects. Passionate about team leadership and agile methodologies. Love sports and investment.',
      avatar: 'https://ui-avatars.com/api/?name=Frank+Hoang&background=607D8B',
      coverPhoto: null,
      mutualFriends: 7,
      isVerified: true,
      joinedDate: new Date('2021-04-12'),
      lastActive: new Date(Date.now() - 5400000)
    },
    {
      username: 'grace_ly',
      email: 'grace.ly@example.com',
      displayName: 'Grace Ly',
      firstName: 'Grace',
      lastName: 'Ly',
      age: 24,
      location: 'Huế, Việt Nam',
      occupation: 'Graphic Designer',
      education: 'HUDA - Fine Arts',
      interests: ['Graphic Design', 'Photography', 'History', 'Traditional Arts'],
      bio: 'Graphic designer with love for traditional Vietnamese arts. Passionate about preserving cultural heritage through modern design approaches.',
      avatar: 'https://ui-avatars.com/api/?name=Grace+Ly&background=795548',
      coverPhoto: null,
      mutualFriends: 4,
      isVerified: false,
      joinedDate: new Date('2023-02-28'),
      lastActive: new Date(Date.now() - 10800000)
    },
    {
      username: 'henry_dao',
      email: 'henry.dao@example.com',
      displayName: 'Henry Đào',
      firstName: 'Henry',
      lastName: 'Đào',
      age: 29,
      location: 'Hải Phòng, Việt Nam',
      occupation: 'DevOps Engineer',
      education: 'PTIT - Information Technology',
      interests: ['DevOps', 'Cloud Computing', 'Automation', 'Cycling'],
      bio: 'DevOps engineer specializing in cloud infrastructure and automation. Love building scalable systems and optimizing workflows. Cycling enthusiast.',
      avatar: 'https://ui-avatars.com/api/?name=Henry+Dao&background=009688',
      coverPhoto: null,
      mutualFriends: 9,
      isVerified: true,
      joinedDate: new Date('2022-01-30'),
      lastActive: new Date(Date.now() - 14400000)
    }
  ];

  sampleUsers.forEach((userData, index) => {
    const userId = `user_${userIdCounter++}`;
    const user = {
      id: userId,
      ...userData,
      isOnline: Math.random() > 0.4,
      privacySettings: {
        profileVisibility: 'friends',
        searchVisibility: true,
        allowFriendRequests: true,
        showMutualFriends: true,
        showOnlineStatus: true
      },
      stats: {
        totalFriends: Math.floor(Math.random() * 200) + 50,
        totalPosts: Math.floor(Math.random() * 500) + 20,
        totalPhotos: Math.floor(Math.random() * 300) + 10
      }
    };
    
    mockUsers.set(userId, user);
    
    // Initialize user preferences
    mockUserPreferences.set(userId, {
      autoAcceptFrom: [],
      autoRejectKeywords: [],
      friendSuggestions: true,
      mutualFriendsVisible: true,
      profileViewNotifications: true
    });
  });

  // Create sample friend requests
  const users = Array.from(mockUsers.keys());
  for (let i = 0; i < 10; i++) {
    const fromUser = users[Math.floor(Math.random() * users.length)];
    const toUser = users[Math.floor(Math.random() * users.length)];
    
    if (fromUser !== toUser) {
      const requestId = `req_${requestIdCounter++}`;
      const request = {
        id: requestId,
        fromUserId: fromUser,
        toUserId: toUser,
        status: Math.random() > 0.3 ? REQUEST_STATUS.PENDING : REQUEST_STATUS.ACCEPTED,
        message: [
          'Hi! I would like to connect with you.',
          'Hello! I saw your profile and would love to be friends.',
          'Hey! We have mutual friends and similar interests.',
          '',
          'Hi there! Let\'s connect and share experiences.'
        ][Math.floor(Math.random() * 5)],
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        respondedAt: null
      };
      
      if (request.status === REQUEST_STATUS.ACCEPTED) {
        request.respondedAt = new Date(request.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        // Create friendship
        const friendshipId = `friendship_${friendshipIdCounter++}`;
        mockFriendships.set(friendshipId, {
          id: friendshipId,
          user1Id: fromUser,
          user2Id: toUser,
          type: Object.values(FRIENDSHIP_TYPE)[Math.floor(Math.random() * Object.values(FRIENDSHIP_TYPE).length)],
          createdAt: request.respondedAt,
          isCloseFriend: Math.random() > 0.8,
          mutualInteractions: Math.floor(Math.random() * 100),
          lastInteraction: new Date()
        });
      }
      
      mockFriendRequests.set(requestId, request);
    }
  }

  // Generate friend suggestions for each user
  users.forEach(userId => {
    const suggestions = [];
    const otherUsers = users.filter(id => id !== userId);
    
    // Random suggestions with score
    for (let i = 0; i < Math.min(10, otherUsers.length); i++) {
      const suggestionUserId = otherUsers[Math.floor(Math.random() * otherUsers.length)];
      if (!suggestions.find(s => s.userId === suggestionUserId)) {
        suggestions.push({
          userId: suggestionUserId,
          score: Math.random() * 100,
          reasons: generateSuggestionReasons(),
          mutualFriends: Math.floor(Math.random() * 15),
          commonInterests: Math.floor(Math.random() * 5),
          createdAt: new Date()
        });
      }
    }
    
    suggestions.sort((a, b) => b.score - a.score);
    mockUserSuggestions.set(userId, suggestions);
  });
}

function generateSuggestionReasons() {
  const allReasons = [
    'Cùng thành phố',
    'Bạn chung',
    'Cùng công ty',
    'Cùng trường học',
    'Sở thích chung',
    'Cùng nhóm',
    'Liên hệ trong danh bạ',
    'Hoạt động gần đây'
  ];
  
  const numReasons = Math.floor(Math.random() * 3) + 1;
  const selectedReasons = [];
  
  for (let i = 0; i < numReasons; i++) {
    const reason = allReasons[Math.floor(Math.random() * allReasons.length)];
    if (!selectedReasons.includes(reason)) {
      selectedReasons.push(reason);
    }
  }
  
  return selectedReasons;
}

// Test route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'friends-interface.html'));
});

app.get('/api/test-friends', (req, res) => {
  res.json({
    success: true,
    message: 'Friends & Search System Active!',
    features: {
      userSearch: 'Advanced search with filters',
      friendRequests: 'Send, accept, reject requests',
      friendSuggestions: 'AI-powered suggestions',
      friendManagement: 'Organize and categorize friends',
      mutualFriends: 'Show mutual connections',
      realTimeUpdates: 'Socket.IO integration',
      privacyControls: 'Granular privacy settings',
      blockingSystem: 'Block unwanted users'
    },
    stats: {
      totalUsers: mockUsers.size,
      totalFriendRequests: mockFriendRequests.size,
      totalFriendships: mockFriendships.size,
      activeSuggestions: Array.from(mockUserSuggestions.values()).reduce((sum, suggestions) => sum + suggestions.length, 0)
    }
  });
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = Array.from(mockUsers.values()).find(u => u.username === username);
  
  if (user && password) {
    const token = `friends_token_${user.id}`;
    
    user.isOnline = true;
    user.lastActive = new Date();
    mockUsers.set(user.id, user);
    
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          isVerified: user.isVerified
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không đúng'
    });
  }
});

// User search endpoints
app.get('/api/users/search', (req, res) => {
  const { 
    q: query = '', 
    location, 
    occupation, 
    minAge, 
    maxAge, 
    education,
    interests,
    isVerified,
    isOnline,
    mutualFriends,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let users = Array.from(mockUsers.values());
  
  // Text search
  if (query) {
    const searchTerm = query.toLowerCase();
    users = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm) ||
      user.displayName.toLowerCase().includes(searchTerm) ||
      user.firstName.toLowerCase().includes(searchTerm) ||
      user.lastName.toLowerCase().includes(searchTerm) ||
      user.bio.toLowerCase().includes(searchTerm) ||
      user.occupation.toLowerCase().includes(searchTerm) ||
      user.education.toLowerCase().includes(searchTerm) ||
      user.interests.some(interest => interest.toLowerCase().includes(searchTerm))
    );
  }
  
  // Location filter
  if (location) {
    users = users.filter(user => 
      user.location.toLowerCase().includes(location.toLowerCase())
    );
  }
  
  // Occupation filter
  if (occupation) {
    users = users.filter(user => 
      user.occupation.toLowerCase().includes(occupation.toLowerCase())
    );
  }
  
  // Age filter
  if (minAge) {
    users = users.filter(user => user.age >= parseInt(minAge));
  }
  if (maxAge) {
    users = users.filter(user => user.age <= parseInt(maxAge));
  }
  
  // Education filter
  if (education) {
    users = users.filter(user => 
      user.education.toLowerCase().includes(education.toLowerCase())
    );
  }
  
  // Interests filter
  if (interests) {
    const interestList = interests.split(',').map(i => i.trim().toLowerCase());
    users = users.filter(user => 
      interestList.some(interest => 
        user.interests.some(userInterest => 
          userInterest.toLowerCase().includes(interest)
        )
      )
    );
  }
  
  // Verified filter
  if (isVerified !== undefined) {
    users = users.filter(user => user.isVerified === (isVerified === 'true'));
  }
  
  // Online filter
  if (isOnline !== undefined) {
    users = users.filter(user => user.isOnline === (isOnline === 'true'));
  }
  
  // Sort by relevance (online status, verification, mutual friends, last active)
  users.sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    
    if (a.isOnline) scoreA += 10;
    if (b.isOnline) scoreB += 10;
    
    if (a.isVerified) scoreA += 5;
    if (b.isVerified) scoreB += 5;
    
    scoreA += a.mutualFriends || 0;
    scoreB += b.mutualFriends || 0;
    
    if (scoreA !== scoreB) return scoreB - scoreA;
    
    return new Date(b.lastActive) - new Date(a.lastActive);
  });
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedUsers = users.slice(startIndex, endIndex);
  
  // Format results
  const results = paginatedUsers.map(user => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    age: user.age,
    location: user.location,
    occupation: user.occupation,
    education: user.education,
    interests: user.interests,
    bio: user.bio,
    avatar: user.avatar,
    isVerified: user.isVerified,
    isOnline: user.isOnline,
    lastActive: user.lastActive,
    mutualFriends: user.mutualFriends,
    stats: user.stats,
    canSendFriendRequest: true // This would be calculated based on existing relationships
  }));
  
  res.json({
    success: true,
    data: {
      users: results,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.length / limit),
        totalUsers: users.length,
        hasNext: endIndex < users.length,
        hasPrev: startIndex > 0
      },
      filters: {
        query,
        location,
        occupation,
        minAge,
        maxAge,
        education,
        interests,
        isVerified,
        isOnline
      }
    }
  });
});

// Get user details
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const user = mockUsers.get(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }
  
  // Get mutual friends (simplified)
  const mutualFriends = Array.from(mockUsers.values())
    .slice(0, Math.floor(Math.random() * 10))
    .map(u => ({
      id: u.id,
      displayName: u.displayName,
      avatar: u.avatar
    }));
  
  res.json({
    success: true,
    data: {
      ...user,
      mutualFriends,
      relationshipStatus: 'none' // none, friend, pending_sent, pending_received, blocked
    }
  });
});

// Friend request endpoints
app.post('/api/friend-requests', (req, res) => {
  const { fromUserId, toUserId, message = '' } = req.body;
  
  if (!mockUsers.has(fromUserId) || !mockUsers.has(toUserId)) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }
  
  if (fromUserId === toUserId) {
    return res.status(400).json({
      success: false,
      message: 'Không thể gửi lời mời kết bạn cho chính mình'
    });
  }
  
  // Check if request already exists
  const existingRequest = Array.from(mockFriendRequests.values()).find(req =>
    (req.fromUserId === fromUserId && req.toUserId === toUserId) ||
    (req.fromUserId === toUserId && req.toUserId === fromUserId)
  );
  
  if (existingRequest) {
    return res.status(400).json({
      success: false,
      message: 'Lời mời kết bạn đã tồn tại'
    });
  }
  
  const requestId = `req_${requestIdCounter++}`;
  const request = {
    id: requestId,
    fromUserId,
    toUserId,
    status: REQUEST_STATUS.PENDING,
    message: message.trim(),
    createdAt: new Date(),
    respondedAt: null
  };
  
  mockFriendRequests.set(requestId, request);
  
  // Add to search history
  let searchHistory = mockUserSearchHistory.get(fromUserId) || [];
  searchHistory.unshift({
    userId: toUserId,
    action: 'friend_request_sent',
    timestamp: new Date()
  });
  searchHistory = searchHistory.slice(0, 50); // Keep last 50
  mockUserSearchHistory.set(fromUserId, searchHistory);
  
  res.json({
    success: true,
    message: 'Gửi lời mời kết bạn thành công',
    data: request
  });
});

// Get friend requests
app.get('/api/friend-requests/:userId', (req, res) => {
  const { userId } = req.params;
  const { type = 'received', status = 'all', page = 1, limit = 20 } = req.query;
  
  let requests = Array.from(mockFriendRequests.values());
  
  // Filter by type (sent/received)
  if (type === 'sent') {
    requests = requests.filter(req => req.fromUserId === userId);
  } else if (type === 'received') {
    requests = requests.filter(req => req.toUserId === userId);
  }
  
  // Filter by status
  if (status !== 'all') {
    requests = requests.filter(req => req.status === status);
  }
  
  // Sort by creation date (newest first)
  requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedRequests = requests.slice(startIndex, endIndex);
  
  // Enrich with user data
  const enrichedRequests = paginatedRequests.map(request => {
    const otherUserId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
    const otherUser = mockUsers.get(otherUserId);
    
    return {
      ...request,
      user: {
        id: otherUser.id,
        username: otherUser.username,
        displayName: otherUser.displayName,
        avatar: otherUser.avatar,
        isVerified: otherUser.isVerified,
        isOnline: otherUser.isOnline,
        mutualFriends: otherUser.mutualFriends
      }
    };
  });
  
  res.json({
    success: true,
    data: {
      requests: enrichedRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(requests.length / limit),
        totalRequests: requests.length,
        hasNext: endIndex < requests.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Respond to friend request
app.put('/api/friend-requests/:requestId', (req, res) => {
  const { requestId } = req.params;
  const { action, userId } = req.body; // action: 'accept' | 'reject' | 'cancel'
  
  const request = mockFriendRequests.get(requestId);
  
  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy lời mời kết bạn'
    });
  }
  
  // Validate permissions
  if (action === 'cancel' && request.fromUserId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền hủy lời mời này'
    });
  }
  
  if ((action === 'accept' || action === 'reject') && request.toUserId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền phản hồi lời mời này'
    });
  }
  
  // Update request
  if (action === 'accept') {
    request.status = REQUEST_STATUS.ACCEPTED;
    request.respondedAt = new Date();
    
    // Create friendship
    const friendshipId = `friendship_${friendshipIdCounter++}`;
    const friendship = {
      id: friendshipId,
      user1Id: request.fromUserId,
      user2Id: request.toUserId,
      type: FRIENDSHIP_TYPE.FRIEND,
      createdAt: new Date(),
      isCloseFriend: false,
      mutualInteractions: 0,
      lastInteraction: new Date()
    };
    
    mockFriendships.set(friendshipId, friendship);
    
  } else if (action === 'reject') {
    request.status = REQUEST_STATUS.REJECTED;
    request.respondedAt = new Date();
    
  } else if (action === 'cancel') {
    request.status = REQUEST_STATUS.CANCELLED;
  }
  
  mockFriendRequests.set(requestId, request);
  
  const actionMessages = {
    accept: 'Đã chấp nhận lời mời kết bạn',
    reject: 'Đã từ chối lời mời kết bạn',
    cancel: 'Đã hủy lời mời kết bạn'
  };
  
  res.json({
    success: true,
    message: actionMessages[action],
    data: request
  });
});

// Get friend suggestions
app.get('/api/friend-suggestions/:userId', (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  const suggestions = mockUserSuggestions.get(userId) || [];
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedSuggestions = suggestions.slice(startIndex, endIndex);
  
  // Enrich with user data
  const enrichedSuggestions = paginatedSuggestions.map(suggestion => {
    const user = mockUsers.get(suggestion.userId);
    return {
      ...suggestion,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isVerified: user.isVerified,
        isOnline: user.isOnline,
        location: user.location,
        occupation: user.occupation,
        stats: user.stats
      }
    };
  });
  
  res.json({
    success: true,
    data: {
      suggestions: enrichedSuggestions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(suggestions.length / limit),
        totalSuggestions: suggestions.length,
        hasNext: endIndex < suggestions.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Dismiss suggestion
app.delete('/api/friend-suggestions/:userId/:suggestionUserId', (req, res) => {
  const { userId, suggestionUserId } = req.params;
  
  const suggestions = mockUserSuggestions.get(userId) || [];
  const filteredSuggestions = suggestions.filter(s => s.userId !== suggestionUserId);
  mockUserSuggestions.set(userId, filteredSuggestions);
  
  res.json({
    success: true,
    message: 'Đã ẩn gợi ý kết bạn'
  });
});

// Get friends list
app.get('/api/friends/:userId', (req, res) => {
  const { userId } = req.params;
  const { type = 'all', search, page = 1, limit = 20 } = req.query;
  
  let friendships = Array.from(mockFriendships.values()).filter(friendship =>
    friendship.user1Id === userId || friendship.user2Id === userId
  );
  
  // Filter by type
  if (type !== 'all') {
    friendships = friendships.filter(friendship => friendship.type === type);
  }
  
  // Get friend user data
  let friends = friendships.map(friendship => {
    const friendId = friendship.user1Id === userId ? friendship.user2Id : friendship.user1Id;
    const friend = mockUsers.get(friendId);
    
    return {
      friendshipId: friendship.id,
      ...friend,
      friendshipType: friendship.type,
      isCloseFriend: friendship.isCloseFriend,
      friendshipDate: friendship.createdAt,
      lastInteraction: friendship.lastInteraction
    };
  });
  
  // Search filter
  if (search) {
    const searchTerm = search.toLowerCase();
    friends = friends.filter(friend =>
      friend.username.toLowerCase().includes(searchTerm) ||
      friend.displayName.toLowerCase().includes(searchTerm) ||
      friend.firstName.toLowerCase().includes(searchTerm) ||
      friend.lastName.toLowerCase().includes(searchTerm)
    );
  }
  
  // Sort by last interaction
  friends.sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedFriends = friends.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      friends: paginatedFriends,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(friends.length / limit),
        totalFriends: friends.length,
        hasNext: endIndex < friends.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Block user
app.post('/api/users/block', (req, res) => {
  const { userId, blockedUserId, reason = '' } = req.body;
  
  if (!mockUsers.has(userId) || !mockUsers.has(blockedUserId)) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }
  
  let userBlocked = mockUserBlocked.get(userId) || new Set();
  userBlocked.add(blockedUserId);
  mockUserBlocked.set(userId, userBlocked);
  
  // Remove any existing friend requests
  const requestsToRemove = Array.from(mockFriendRequests.entries()).filter(([id, req]) =>
    (req.fromUserId === userId && req.toUserId === blockedUserId) ||
    (req.fromUserId === blockedUserId && req.toUserId === userId)
  );
  
  requestsToRemove.forEach(([id]) => {
    mockFriendRequests.delete(id);
  });
  
  // Remove friendship if exists
  const friendshipToRemove = Array.from(mockFriendships.entries()).find(([id, friendship]) =>
    (friendship.user1Id === userId && friendship.user2Id === blockedUserId) ||
    (friendship.user1Id === blockedUserId && friendship.user2Id === userId)
  );
  
  if (friendshipToRemove) {
    mockFriendships.delete(friendshipToRemove[0]);
  }
  
  res.json({
    success: true,
    message: 'Đã chặn người dùng thành công'
  });
});

// Unblock user
app.delete('/api/users/block/:userId/:blockedUserId', (req, res) => {
  const { userId, blockedUserId } = req.params;
  
  let userBlocked = mockUserBlocked.get(userId) || new Set();
  userBlocked.delete(blockedUserId);
  mockUserBlocked.set(userId, userBlocked);
  
  res.json({
    success: true,
    message: 'Đã bỏ chặn người dùng'
  });
});

// Get blocked users
app.get('/api/users/blocked/:userId', (req, res) => {
  const { userId } = req.params;
  
  const blockedUserIds = mockUserBlocked.get(userId) || new Set();
  const blockedUsers = Array.from(blockedUserIds).map(blockedUserId => {
    const user = mockUsers.get(blockedUserId);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar
    };
  });
  
  res.json({
    success: true,
    data: blockedUsers
  });
});

// Socket.IO for real-time features
io.on('connection', socket => {
  console.log('User connected to friends system:', socket.id);
  
  socket.on('authenticate', data => {
    const { token } = data;
    if (token && token.startsWith('friends_token_')) {
      const userId = token.replace('friends_token_', '');
      socket.userId = userId;
      socket.join(`user:${userId}`);
      
      socket.emit('authenticated', { success: true, userId });
      console.log('User authenticated in friends system:', userId);
    } else {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });
  
  socket.on('friend_request_sent', data => {
    socket.to(`user:${data.toUserId}`).emit('new_friend_request', {
      requestId: data.requestId,
      fromUser: data.fromUser,
      message: data.message
    });
  });
  
  socket.on('friend_request_responded', data => {
    socket.to(`user:${data.fromUserId}`).emit('friend_request_response', {
      requestId: data.requestId,
      action: data.action,
      user: data.user
    });
  });
  
  socket.on('typing_search', data => {
    socket.broadcast.emit('user_searching', {
      userId: socket.userId,
      query: data.query
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected from friends system:', socket.id);
  });
});

// Initialize sample data
initializeSampleData();

// Start server
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`👥 Cow Social Network - Friends & Search System running on http://localhost:${PORT}`);
  console.log(`🔍 Features available:`);
  console.log(`   🔎 Advanced User Search with Filters`);
  console.log(`   📨 Friend Request System (Send/Accept/Reject)`);
  console.log(`   💡 AI-Powered Friend Suggestions`);
  console.log(`   👨‍👩‍👧‍👦 Friend Management & Categorization`);
  console.log(`   🤝 Mutual Friends Discovery`);
  console.log(`   🚫 User Blocking System`);
  console.log(`   ⚡ Real-time Notifications via Socket.IO`);
  console.log(`   🔒 Privacy Controls & Settings`);
  console.log(`🧪 Test Interface: http://localhost:${PORT}/friends-interface.html`);
  console.log(`📡 API Test: http://localhost:${PORT}/api/test-friends`);
});

module.exports = { app, server, io };
