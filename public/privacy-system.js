const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
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
const mockPosts = new Map();
const mockFriendships = new Map();
const mockGroups = new Map();
const mockBlacklist = new Map();
const mockPrivacySettings = new Map();
const mockFollowers = new Map();
const mockCustomLists = new Map();

let userIdCounter = 1;
let postIdCounter = 1;
let groupIdCounter = 1;

// Helper functions
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// Privacy levels enum
const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  FRIENDS_OF_FRIENDS: 'friends_of_friends',
  SPECIFIC_FRIENDS: 'specific_friends',
  CUSTOM_LIST: 'custom_list',
  GROUP_ONLY: 'group_only',
  ONLY_ME: 'only_me',
  EXCLUDE_FRIENDS: 'exclude_friends',
  CLOSE_FRIENDS: 'close_friends'
};

// Initialize sample data
function initializeSampleData() {
  // Create sample users
  const sampleUsers = [
    { username: 'alice_johnson', email: 'alice@example.com', displayName: 'Alice Johnson' },
    { username: 'bob_smith', email: 'bob@example.com', displayName: 'Bob Smith' },
    { username: 'charlie_brown', email: 'charlie@example.com', displayName: 'Charlie Brown' },
    { username: 'diana_wilson', email: 'diana@example.com', displayName: 'Diana Wilson' },
    { username: 'emma_davis', email: 'emma@example.com', displayName: 'Emma Davis' }
  ];

  sampleUsers.forEach((userData, index) => {
    const userId = `user_${userIdCounter++}`;
    const user = {
      id: userId,
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName,
      avatar: `https://ui-avatars.com/api/?name=${userData.displayName}&background=random`,
      isOnline: Math.random() > 0.5,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      lastActive: new Date(),
      isVerified: Math.random() > 0.7,
      location: ['Vietnam', 'USA', 'UK', 'Japan', 'Australia'][index],
      bio: `Xin chào! Tôi là ${userData.displayName}. Rất vui được kết nối với mọi người!`
    };
    
    mockUsers.set(userId, user);
    
    // Initialize privacy settings for each user
    mockPrivacySettings.set(userId, {
      userId,
      defaultPostPrivacy: PRIVACY_LEVELS.FRIENDS,
      profileVisibility: PRIVACY_LEVELS.PUBLIC,
      friendListVisibility: PRIVACY_LEVELS.FRIENDS,
      messagePrivacy: PRIVACY_LEVELS.FRIENDS,
      tagPermission: PRIVACY_LEVELS.FRIENDS,
      searchVisibility: true,
      allowFriendRequests: true,
      showOnlineStatus: true,
      allowTagging: true,
      commentPermission: PRIVACY_LEVELS.FRIENDS,
      sharePermission: PRIVACY_LEVELS.FRIENDS
    });

    // Initialize followers/following
    mockFollowers.set(userId, {
      followers: new Set(),
      following: new Set(),
      closeFriends: new Set(),
      blockedUsers: new Set()
    });
  });

  // Create sample friendships
  const users = Array.from(mockUsers.keys());
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      if (Math.random() > 0.4) {
        const friendshipId = generateId();
        mockFriendships.set(friendshipId, {
          id: friendshipId,
          user1: users[i],
          user2: users[j],
          status: Math.random() > 0.2 ? 'accepted' : 'pending',
          createdAt: new Date(),
          closeFriend: Math.random() > 0.7
        });

        // Add to followers
        if (Math.random() > 0.2) {
          mockFollowers.get(users[i]).following.add(users[j]);
          mockFollowers.get(users[j]).followers.add(users[i]);
        }
      }
    }
  }

  // Create sample groups
  const sampleGroups = [
    { name: 'Nhóm Du lịch Việt Nam', description: 'Chia sẻ kinh nghiệm du lịch trong nước' },
    { name: 'Công nghệ & Lập trình', description: 'Thảo luận về công nghệ và lập trình' },
    { name: 'Ẩm thực Việt Nam', description: 'Khám phá văn hóa ẩm thực Việt' }
  ];

  sampleGroups.forEach(groupData => {
    const groupId = `group_${groupIdCounter++}`;
    const group = {
      id: groupId,
      name: groupData.name,
      description: groupData.description,
      privacy: Math.random() > 0.5 ? 'public' : 'private',
      members: new Set(users.slice(0, Math.floor(Math.random() * users.length) + 1)),
      admins: new Set([users[0]]),
      createdAt: new Date(),
      coverPhoto: null
    };
    mockGroups.set(groupId, group);
  });

  // Create sample custom lists
  users.forEach(userId => {
    const customLists = new Map();
    customLists.set('work', {
      id: 'work',
      name: 'Đồng nghiệp',
      members: new Set(users.slice(1, 3)),
      color: '#4CAF50'
    });
    customLists.set('family', {
      id: 'family',
      name: 'Gia đình',
      members: new Set(users.slice(3, 5)),
      color: '#FF9800'
    });
    mockCustomLists.set(userId, customLists);
  });
}

// Test route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy-interface.html'));
});

app.get('/api/test-privacy', (req, res) => {
  res.json({
    success: true,
    message: 'Privacy System Active!',
    features: {
      privacyLevels: Object.values(PRIVACY_LEVELS),
      userManagement: 'Available',
      friendshipSystem: 'Available',
      groupSystem: 'Available',
      customLists: 'Available',
      blacklistSystem: 'Available',
      advancedFiltering: 'Available'
    },
    stats: {
      totalUsers: mockUsers.size,
      totalPosts: mockPosts.size,
      totalFriendships: mockFriendships.size,
      totalGroups: mockGroups.size
    }
  });
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Find user by username
  const user = Array.from(mockUsers.values()).find(u => u.username === username);
  
  if (user && password) {
    const token = `privacy_token_${user.id}`;
    
    // Update user status
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

// User management endpoints
app.get('/api/users', (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  let users = Array.from(mockUsers.values());
  
  // Search functionality
  if (search) {
    const searchTerm = search.toLowerCase();
    users = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm) ||
      user.displayName.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm)
    );
  }
  
  // Sort by online status and last active
  users.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return new Date(b.lastActive) - new Date(a.lastActive);
  });
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedUsers = users.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      users: paginatedUsers.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isOnline: user.isOnline,
        isVerified: user.isVerified,
        location: user.location,
        lastActive: user.lastActive
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.length / limit),
        totalUsers: users.length,
        hasNext: endIndex < users.length,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Privacy settings endpoints
app.get('/api/privacy-settings/:userId', (req, res) => {
  const { userId } = req.params;
  const settings = mockPrivacySettings.get(userId);
  
  if (settings) {
    res.json({
      success: true,
      data: settings
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy cài đặt riêng tư'
    });
  }
});

app.put('/api/privacy-settings/:userId', (req, res) => {
  const { userId } = req.params;
  const updatedSettings = req.body;
  
  const currentSettings = mockPrivacySettings.get(userId);
  if (currentSettings) {
    const newSettings = { ...currentSettings, ...updatedSettings };
    mockPrivacySettings.set(userId, newSettings);
    
    res.json({
      success: true,
      message: 'Cập nhật cài đặt riêng tư thành công',
      data: newSettings
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }
});

// Friends management endpoints
app.get('/api/friends/:userId', (req, res) => {
  const { userId } = req.params;
  const { status = 'accepted' } = req.query;
  
  const friendships = Array.from(mockFriendships.values()).filter(friendship => 
    (friendship.user1 === userId || friendship.user2 === userId) &&
    friendship.status === status
  );
  
  const friends = friendships.map(friendship => {
    const friendId = friendship.user1 === userId ? friendship.user2 : friendship.user1;
    const friend = mockUsers.get(friendId);
    return {
      ...friend,
      friendshipId: friendship.id,
      closeFriend: friendship.closeFriend,
      friendshipDate: friendship.createdAt
    };
  });
  
  res.json({
    success: true,
    data: friends
  });
});

app.post('/api/friends/request', (req, res) => {
  const { fromUserId, toUserId } = req.body;
  
  if (!mockUsers.has(fromUserId) || !mockUsers.has(toUserId)) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }
  
  // Check if friendship already exists
  const existingFriendship = Array.from(mockFriendships.values()).find(friendship =>
    (friendship.user1 === fromUserId && friendship.user2 === toUserId) ||
    (friendship.user1 === toUserId && friendship.user2 === fromUserId)
  );
  
  if (existingFriendship) {
    return res.status(400).json({
      success: false,
      message: 'Lời mời kết bạn đã tồn tại'
    });
  }
  
  const friendshipId = generateId();
  const friendship = {
    id: friendshipId,
    user1: fromUserId,
    user2: toUserId,
    status: 'pending',
    createdAt: new Date(),
    closeFriend: false
  };
  
  mockFriendships.set(friendshipId, friendship);
  
  res.json({
    success: true,
    message: 'Gửi lời mời kết bạn thành công',
    data: friendship
  });
});

// Custom lists endpoints
app.get('/api/custom-lists/:userId', (req, res) => {
  const { userId } = req.params;
  const userLists = mockCustomLists.get(userId);
  
  if (userLists) {
    const lists = Array.from(userLists.values()).map(list => ({
      ...list,
      members: Array.from(list.members).map(memberId => {
        const member = mockUsers.get(memberId);
        return {
          id: member.id,
          username: member.username,
          displayName: member.displayName,
          avatar: member.avatar
        };
      })
    }));
    
    res.json({
      success: true,
      data: lists
    });
  } else {
    res.json({
      success: true,
      data: []
    });
  }
});

app.post('/api/custom-lists/:userId', (req, res) => {
  const { userId } = req.params;
  const { name, color, members = [] } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Tên danh sách không được để trống'
    });
  }
  
  const listId = generateId();
  const newList = {
    id: listId,
    name,
    color: color || '#2196F3',
    members: new Set(members)
  };
  
  let userLists = mockCustomLists.get(userId);
  if (!userLists) {
    userLists = new Map();
    mockCustomLists.set(userId, userLists);
  }
  
  userLists.set(listId, newList);
  
  res.json({
    success: true,
    message: 'Tạo danh sách thành công',
    data: {
      ...newList,
      members: Array.from(newList.members)
    }
  });
});

// Groups endpoints
app.get('/api/groups', (req, res) => {
  const { privacy, search } = req.query;
  let groups = Array.from(mockGroups.values());
  
  // Filter by privacy
  if (privacy && privacy !== 'all') {
    groups = groups.filter(group => group.privacy === privacy);
  }
  
  // Search functionality
  if (search) {
    const searchTerm = search.toLowerCase();
    groups = groups.filter(group =>
      group.name.toLowerCase().includes(searchTerm) ||
      group.description.toLowerCase().includes(searchTerm)
    );
  }
  
  const groupsData = groups.map(group => ({
    ...group,
    members: Array.from(group.members).map(memberId => {
      const member = mockUsers.get(memberId);
      return {
        id: member.id,
        username: member.username,
        displayName: member.displayName,
        avatar: member.avatar
      };
    }),
    admins: Array.from(group.admins),
    memberCount: group.members.size
  }));
  
  res.json({
    success: true,
    data: groupsData
  });
});

// Post creation with advanced privacy
app.post('/api/posts', (req, res) => {
  const {
    title,
    content,
    authorId,
    privacy = PRIVACY_LEVELS.FRIENDS,
    specificFriends = [],
    excludedFriends = [],
    customListId,
    groupId,
    allowComments = true,
    allowShares = true,
    allowTags = true,
    hideFromTimeline = false,
    scheduleTime,
    expiryTime
  } = req.body;
  
  if (!title || !content || !authorId) {
    return res.status(400).json({
      success: false,
      message: 'Tiêu đề, nội dung và tác giả là bắt buộc'
    });
  }
  
  const postId = `post_${postIdCounter++}`;
  const author = mockUsers.get(authorId);
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy tác giả'
    });
  }
  
  const post = {
    id: postId,
    title,
    content,
    authorId,
    authorName: author.displayName,
    authorUsername: author.username,
    authorAvatar: author.avatar,
    privacy,
    specificFriends: new Set(specificFriends),
    excludedFriends: new Set(excludedFriends),
    customListId,
    groupId,
    allowComments,
    allowShares,
    allowTags,
    hideFromTimeline,
    scheduleTime: scheduleTime ? new Date(scheduleTime) : null,
    expiryTime: expiryTime ? new Date(expiryTime) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    reactions: new Map(),
    isActive: true
  };
  
  mockPosts.set(postId, post);
  
  // Calculate audience size
  const audienceSize = calculateAudienceSize(post);
  
  res.json({
    success: true,
    message: 'Đăng bài thành công',
    data: {
      ...post,
      specificFriends: Array.from(post.specificFriends),
      excludedFriends: Array.from(post.excludedFriends),
      audienceSize
    }
  });
});

// Get posts with privacy filtering
app.get('/api/posts', (req, res) => {
  const { viewerId, authorId, page = 1, limit = 10 } = req.query;
  let posts = Array.from(mockPosts.values());
  
  // Filter by author if specified
  if (authorId) {
    posts = posts.filter(post => post.authorId === authorId);
  }
  
  // Filter posts based on privacy settings and viewer's relationship
  if (viewerId) {
    posts = posts.filter(post => canViewPost(post, viewerId));
  }
  
  // Sort by creation date
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedPosts = posts.slice(startIndex, endIndex);
  
  // Format posts for response
  const formattedPosts = paginatedPosts.map(post => ({
    ...post,
    specificFriends: Array.from(post.specificFriends),
    excludedFriends: Array.from(post.excludedFriends),
    audienceSize: calculateAudienceSize(post),
    canEdit: viewerId === post.authorId,
    canDelete: viewerId === post.authorId
  }));
  
  res.json({
    success: true,
    data: {
      posts: formattedPosts,
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

// Privacy checking functions
function canViewPost(post, viewerId) {
  // Author can always view their own posts
  if (post.authorId === viewerId) {
    return true;
  }
  
  // Check if post is expired
  if (post.expiryTime && new Date() > post.expiryTime) {
    return false;
  }
  
  // Check if post is scheduled for future
  if (post.scheduleTime && new Date() < post.scheduleTime) {
    return false;
  }
  
  // Check privacy levels
  switch (post.privacy) {
    case PRIVACY_LEVELS.PUBLIC:
      return true;
      
    case PRIVACY_LEVELS.ONLY_ME:
      return false;
      
    case PRIVACY_LEVELS.FRIENDS:
      return areFriends(post.authorId, viewerId);
      
    case PRIVACY_LEVELS.FRIENDS_OF_FRIENDS:
      return areFriends(post.authorId, viewerId) || areFriendsOfFriends(post.authorId, viewerId);
      
    case PRIVACY_LEVELS.SPECIFIC_FRIENDS:
      return post.specificFriends.has(viewerId);
      
    case PRIVACY_LEVELS.EXCLUDE_FRIENDS:
      return areFriends(post.authorId, viewerId) && !post.excludedFriends.has(viewerId);
      
    case PRIVACY_LEVELS.CLOSE_FRIENDS:
      return isCloseFriend(post.authorId, viewerId);
      
    case PRIVACY_LEVELS.CUSTOM_LIST:
      return isInCustomList(post.authorId, post.customListId, viewerId);
      
    case PRIVACY_LEVELS.GROUP_ONLY:
      return isGroupMember(post.groupId, viewerId);
      
    default:
      return false;
  }
}

function areFriends(userId1, userId2) {
  return Array.from(mockFriendships.values()).some(friendship =>
    ((friendship.user1 === userId1 && friendship.user2 === userId2) ||
     (friendship.user1 === userId2 && friendship.user2 === userId1)) &&
    friendship.status === 'accepted'
  );
}

function areFriendsOfFriends(userId1, userId2) {
  const user1Friends = getFriends(userId1);
  const user2Friends = getFriends(userId2);
  
  return user1Friends.some(friendId => user2Friends.includes(friendId));
}

function isCloseFriend(userId1, userId2) {
  const friendship = Array.from(mockFriendships.values()).find(friendship =>
    ((friendship.user1 === userId1 && friendship.user2 === userId2) ||
     (friendship.user1 === userId2 && friendship.user2 === userId1)) &&
    friendship.status === 'accepted'
  );
  
  return friendship && friendship.closeFriend;
}

function isInCustomList(authorId, listId, viewerId) {
  const userLists = mockCustomLists.get(authorId);
  if (!userLists) return false;
  
  const list = userLists.get(listId);
  return list && list.members.has(viewerId);
}

function isGroupMember(groupId, userId) {
  const group = mockGroups.get(groupId);
  return group && group.members.has(userId);
}

function getFriends(userId) {
  return Array.from(mockFriendships.values())
    .filter(friendship =>
      (friendship.user1 === userId || friendship.user2 === userId) &&
      friendship.status === 'accepted'
    )
    .map(friendship => friendship.user1 === userId ? friendship.user2 : friendship.user1);
}

function calculateAudienceSize(post) {
  switch (post.privacy) {
    case PRIVACY_LEVELS.PUBLIC:
      return mockUsers.size;
      
    case PRIVACY_LEVELS.ONLY_ME:
      return 1;
      
    case PRIVACY_LEVELS.FRIENDS:
      return getFriends(post.authorId).length;
      
    case PRIVACY_LEVELS.SPECIFIC_FRIENDS:
      return post.specificFriends.size;
      
    case PRIVACY_LEVELS.CUSTOM_LIST:
      const userLists = mockCustomLists.get(post.authorId);
      const list = userLists?.get(post.customListId);
      return list ? list.members.size : 0;
      
    case PRIVACY_LEVELS.GROUP_ONLY:
      const group = mockGroups.get(post.groupId);
      return group ? group.members.size : 0;
      
    default:
      return 0;
  }
}

// Blacklist management
app.post('/api/blacklist/:userId', (req, res) => {
  const { userId } = req.params;
  const { blockedUserId, reason } = req.body;
  
  if (!mockUsers.has(blockedUserId)) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng cần chặn'
    });
  }
  
  let userBlacklist = mockBlacklist.get(userId);
  if (!userBlacklist) {
    userBlacklist = new Map();
    mockBlacklist.set(userId, userBlacklist);
  }
  
  userBlacklist.set(blockedUserId, {
    blockedUserId,
    reason: reason || 'Không chỉ định lý do',
    blockedAt: new Date()
  });
  
  res.json({
    success: true,
    message: 'Chặn người dùng thành công'
  });
});

app.get('/api/blacklist/:userId', (req, res) => {
  const { userId } = req.params;
  const userBlacklist = mockBlacklist.get(userId);
  
  if (!userBlacklist) {
    return res.json({
      success: true,
      data: []
    });
  }
  
  const blockedUsers = Array.from(userBlacklist.values()).map(blocked => {
    const user = mockUsers.get(blocked.blockedUserId);
    return {
      ...blocked,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      }
    };
  });
  
  res.json({
    success: true,
    data: blockedUsers
  });
});

// Socket.IO for real-time updates
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('authenticate', data => {
    const { token } = data;
    if (token && token.startsWith('privacy_token_')) {
      const userId = token.replace('privacy_token_', '');
      socket.userId = userId;
      socket.join(`user:${userId}`);
      
      socket.emit('authenticated', { success: true, userId });
      console.log('User authenticated:', userId);
    } else {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });
  
  socket.on('privacy_settings_updated', data => {
    socket.broadcast.emit('user_privacy_changed', {
      userId: socket.userId,
      changes: data.changes
    });
  });
  
  socket.on('post_privacy_updated', data => {
    socket.broadcast.emit('post_privacy_changed', {
      postId: data.postId,
      newPrivacy: data.privacy,
      authorId: socket.userId
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Initialize data
initializeSampleData();

// Start server
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`🔒 Cow Social Network - Privacy System running on http://localhost:${PORT}`);
  console.log(`🛡️ Privacy Features available:`);
  console.log(`   👥 Advanced Friend Management`);
  console.log(`   📝 9 Privacy Levels for Posts`);
  console.log(`   📋 Custom Friend Lists`);
  console.log(`   🚫 Blacklist & Blocking System`);
  console.log(`   👪 Group Privacy Management`);
  console.log(`   ⏰ Scheduled & Expiring Posts`);
  console.log(`   🎯 Audience Targeting`);
  console.log(`   ⚙️ Granular Privacy Settings`);
  console.log(`🧪 Test Interface: http://localhost:${PORT}/privacy-interface.html`);
  console.log(`📡 API Test: http://localhost:${PORT}/api/test-privacy`);
});

module.exports = { app, server, io };
