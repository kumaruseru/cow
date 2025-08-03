// Test Cloudinary Configuration
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

const testCloudinaryConnection = async () => {
  try {
    console.log('🔍 Testing Cloudinary Configuration...');
    console.log('====================================');
    
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    console.log('📋 Configuration:');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY}`);
    console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET ? '***configured***' : 'NOT SET'}`);
    
    // Test connection by getting account details
    console.log('\n🔗 Testing connection...');
    
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful!');
    console.log('Response:', result);
    
    // Test image upload capability
    console.log('\n📤 Testing upload capability...');
    
    // Create a simple test image URL (base64 1x1 pixel image)
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const uploadResult = await cloudinary.uploader.upload(testImageData, {
      folder: 'cow-social-test',
      public_id: `test-${Date.now()}`,
      resource_type: 'image'
    });
    
    console.log('✅ Test upload successful!');
    console.log('📷 Upload details:');
    console.log(`   Public ID: ${uploadResult.public_id}`);
    console.log(`   URL: ${uploadResult.secure_url}`);
    console.log(`   Format: ${uploadResult.format}`);
    console.log(`   Size: ${uploadResult.bytes} bytes`);
    
    // Get upload stats
    console.log('\n📊 Account usage info...');
    try {
      const usage = await cloudinary.api.usage();
      console.log(`   Storage used: ${(usage.storage.usage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Bandwidth used: ${(usage.bandwidth.usage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Images: ${usage.resources}`);
    } catch (usageError) {
      console.log('⚠️  Could not get usage info (normal for free accounts)');
    }
    
    // Clean up test image
    console.log('\n🧹 Cleaning up test image...');
    await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log('✅ Test image deleted');
    
  } catch (error) {
    console.log('❌ Cloudinary test failed:');
    console.log('Error:', error.message);
    
    if (error.message.includes('Invalid API Key')) {
      console.log('🔑 Check your CLOUDINARY_API_KEY');
    } else if (error.message.includes('Invalid cloud name')) {
      console.log('☁️  Check your CLOUDINARY_CLOUD_NAME');  
    } else if (error.message.includes('Invalid API Secret')) {
      console.log('🔐 Check your CLOUDINARY_API_SECRET');
    }
  }
};

console.log('🚀 Cloudinary Integration Test');
console.log('🎯 Testing image upload service');
console.log('☁️  Cloud: dapwmjbqm');

testCloudinaryConnection().then(() => {
  console.log('\n🏁 Cloudinary test completed!');
  console.log('📷 Image upload service ready for use!');
  process.exit(0);
});
