require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

// Create a client with your credentials
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN, 
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Get a read-write client for testing
const rwClient = client.readWrite;

async function testTwitterApi() {
  try {
    console.log('Testing Twitter API credentials...');
    
    // Step 1: Verify credentials by getting user info
    console.log('Step 1: Verifying credentials by getting user info...');
    const user = await rwClient.v2.me();
    console.log('✅ Authentication successful!');
    console.log(`Authenticated as user: ${user.data.name} (@${user.data.username})`);
    console.log('User ID:', user.data.id);
    
    // Step 2: Test posting a tweet
    console.log('\nStep 2: Testing tweet posting capability...');
    const tweetContent = `Test tweet from xBOT ${new Date().toISOString()}`;
    console.log(`Attempting to post: "${tweetContent}"`);
    
    // Try posting a tweet
    const tweet = await rwClient.v2.tweet(tweetContent);
    console.log('✅ Tweet posted successfully!');
    console.log('Tweet ID:', tweet.data.id);
    
    console.log('\n✅ All tests passed! Your Twitter API credentials have the correct permissions.');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    
    if (error.code === 401) {
      console.error('Authentication failed. Please check your API credentials.');
    } else if (error.code === 403) {
      console.error('Permission denied. Your app does not have the necessary permissions.');
      console.error('Make sure your Twitter Developer App has Read and Write permissions.');
      console.error('Ensure you regenerated your Access Token after setting the proper permissions.');
    } else {
      console.error('Error details:', error);
    }
  }
}

// Run the test
testTwitterApi(); 