const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/cow_social_network', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstName: String,
    lastName: String,
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    avatar: String,
    lastActivity: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    bio: String,
    location: String,
    website: String,
    joinDate: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    private: { type: Boolean, default: false }
});

// Message Schema
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    fileUrl: String,
    fileName: String
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

async function createSampleData() {
    try {
        console.log('Connecting to MongoDB...');
        
        // Check if users already exist
        const existingUsers = await User.find();
        console.log(`Found ${existingUsers.length} existing users`);
        
        let user1, user2;
        
        if (existingUsers.length === 0) {
            // Create sample users
            const hashedPassword = await bcrypt.hash('123456', 10);
            
            user1 = await User.create({
                username: 'john_doe',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: hashedPassword,
                avatar: 'https://placehold.co/100x100/0066cc/FFFFFF?text=JD',
                isOnline: true
            });
            
            user2 = await User.create({
                username: 'jane_smith',
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane@example.com',
                passwordHash: hashedPassword,
                avatar: 'https://placehold.co/100x100/cc6600/FFFFFF?text=JS',
                isOnline: false
            });
            
            console.log('Created sample users:', user1.username, user2.username);
        } else {
            user1 = existingUsers[0];
            user2 = existingUsers[1] || existingUsers[0]; // If only one user, use same for demo
            console.log(`Using existing users: ${user1.username}, ${user2.username}`);
        }
        
        // Create sample messages
        const messages = [
            {
                sender: user1._id,
                recipient: user2._id,
                content: 'Chào bạn! Bạn có khỏe không?',
                timestamp: new Date(Date.now() - 3600000), // 1 hour ago
                read: true
            },
            {
                sender: user2._id,
                recipient: user1._id,
                content: 'Chào! Tôi khỏe, cảm ơn bạn. Còn bạn thì sao?',
                timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
                read: true
            },
            {
                sender: user1._id,
                recipient: user2._id,
                content: 'Tôi cũng ổn. Hôm nay bạn có rảnh không?',
                timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
                read: false
            },
            {
                sender: user2._id,
                recipient: user1._id,
                content: 'Có, tôi rảnh cả ngày. Chúng ta có thể gặp nhau.',
                timestamp: new Date(Date.now() - 600000), // 10 minutes ago
                read: false
            }
        ];
        
        // Clear existing messages for clean test
        await Message.deleteMany({});
        console.log('Cleared existing messages');
        
        // Insert new messages
        const createdMessages = await Message.insertMany(messages);
        console.log(`Created ${createdMessages.length} sample messages`);
        
        // Display created data
        console.log('\nCreated Messages:');
        for (const msg of createdMessages) {
            const sender = await User.findById(msg.sender);
            const recipient = await User.findById(msg.recipient);
            console.log(`${sender.firstName} -> ${recipient.firstName}: ${msg.content}`);
        }
        
        console.log('\nSample data created successfully!');
        
    } catch (error) {
        console.error('Error creating sample data:', error);
    } finally {
        mongoose.connection.close();
    }
}

createSampleData();
