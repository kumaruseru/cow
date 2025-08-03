const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'check-users.js',
  'migrate-users.js', 
  'debug-database.js',
  'create-sample-notifications.js',
  'check-all-users.js',
  'create-notifications-for-current-user.js',
  'remove-username-field.js',
  'fix-username-index.js',
  'create-more-test-data.js',
  'update-test-credentials.js',
  'setup-test-messages.js',
  'check-user-friends.js',
  'create-nghia-user.js',
  'create-nghia-friend.js'
];

function updateDatabaseConnections() {
  console.log('🔄 Updating database connections from cowsocial to cow_social_network...');
  
  let updatedCount = 0;
  
  filesToUpdate.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Replace cowsocial with cow_social_network
        content = content.replace(/mongodb:\/\/localhost:27017\/cowsocial/g, 'mongodb://localhost:27017/cow_social_network');
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✅ Updated ${filename}`);
          updatedCount++;
        } else {
          console.log(`⏭️  No changes needed in ${filename}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${filename}:`, error.message);
      }
    } else {
      console.log(`⚠️  File not found: ${filename}`);
    }
  });
  
  console.log(`\n🎉 Database connection update complete! Updated ${updatedCount} files.`);
}

updateDatabaseConnections();
