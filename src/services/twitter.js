const { TwitterApi } = require('twitter-api-v2');
const config = require('../config/config');
const logger = require('../utils/logger');

// Create a client instance
const client = new TwitterApi({
  appKey: config.twitter.apiKey,
  appSecret: config.twitter.apiSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

// Get a read-write client
const rwClient = client.readWrite;

/**
 * Service for interacting with the Twitter API
 */
class TwitterService {
  constructor() {
    this.repliedToMentions = new Set(); // Track mentions we've already replied to
    this.recentTokens = new Map(); // Map of token symbols to their first seen timestamp
  }

  /**
   * Post a tweet
   * @param {string} content - The tweet content
   * @returns {Promise<Object>} - Tweet data
   */
  async postTweet(content) {
    try {
      logger.info('Posting tweet');
      const response = await rwClient.v2.tweet(content);
      logger.info(`Tweet posted with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Error posting tweet:', error);
      throw error;
    }
  }

  /**
   * Reply to a tweet
   * @param {string} tweetId - The ID of the tweet to reply to
   * @param {string} content - The reply content
   * @returns {Promise<Object>} - Reply tweet data
   */
  async replyToTweet(tweetId, content) {
    try {
      logger.info(`Replying to tweet ${tweetId}`);
      const response = await rwClient.v2.reply(content, tweetId);
      logger.info(`Reply posted with ID: ${response.data.id}`);
      
      // Record that we've replied to this tweet
      this.repliedToMentions.add(tweetId);
      
      return response.data;
    } catch (error) {
      logger.error(`Error replying to tweet ${tweetId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch recent mentions of the user
   * @param {number} count - Number of mentions to fetch (default 10)
   * @returns {Promise<Array>} - Array of mention tweets
   */
  async getMentions(count = 10) {
    try {
      logger.info(`Fetching ${count} recent mentions`);
      // Get user ID of the authenticated user
      const user = await rwClient.v2.me();
      const userId = user.data.id;
      
      // Search for mentions
      const mentions = await rwClient.v2.search(`@${user.data.username}`, {
        max_results: count,
        'tweet.fields': ['created_at', 'public_metrics', 'conversation_id', 'author_id', 'text'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id']
      });
      
      // Enhance tweets with author information
      const tweets = mentions.data.data || [];
      const users = mentions.data.includes?.users || [];
      
      const enhancedTweets = tweets.map(tweet => {
        const author = users.find(user => user.id === tweet.author_id);
        return {
          ...tweet,
          author_username: author ? author.username : 'unknown',
          author_name: author ? author.name : 'Unknown User'
        };
      });
      
      logger.info(`Retrieved ${enhancedTweets.length} mentions`);
      return enhancedTweets;
    } catch (error) {
      logger.error('Error fetching mentions:', error);
      throw error;
    }
  }

  /**
   * Check if we've already replied to a mention
   * @param {string} tweetId - The ID of the mention tweet
   * @returns {boolean} - Whether we've already replied
   */
  hasRepliedToMention(tweetId) {
    return this.repliedToMentions.has(tweetId);
  }

  /**
   * Get top tweets from accounts the bot follows
   * @param {number} hours - How many hours back to look (default 24)
   * @param {number} limit - Max number of tweets to return (default 20)
   * @returns {Promise<Array>} - Array of popular tweets
   */
  async getPopularTweetsFromFollowing(hours = 24, limit = 20) {
    try {
      logger.info(`Getting popular tweets from following from the last ${hours} hours`);
      
      // Get the authenticated user
      const me = await rwClient.v2.me();
      
      // Get accounts the user follows
      const following = await rwClient.v2.following(me.data.id, {
        max_results: 100 // Maximum allowed by Twitter API
      });
      
      const followingIds = (following.data || []).map(user => user.id);
      
      if (followingIds.length === 0) {
        logger.warn('Bot is not following any accounts');
        return [];
      }
      
      // Calculate the start time
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      // Get tweets from these users
      const tweets = [];
      
      // Due to API limitations, we need to request tweets for each user separately
      for (const userId of followingIds.slice(0, 10)) { // Limit to 10 users to avoid rate limits
        try {
          const userTweets = await rwClient.v2.userTimeline(userId, {
            start_time: startTime.toISOString(),
            max_results: 10,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'text'],
            'user.fields': ['username', 'name'],
            expansions: ['author_id']
          });
          
          if (userTweets.data.data) {
            const userData = userTweets.data.includes?.users?.find(user => user.id === userId);
            
            // Add author data to each tweet
            const enhancedTweets = userTweets.data.data.map(tweet => ({
              ...tweet,
              author_username: userData ? userData.username : 'unknown',
              author_name: userData ? userData.name : 'Unknown User',
              engagement_score: this.calculateEngagementScore(tweet.public_metrics)
            }));
            
            tweets.push(...enhancedTweets);
          }
        } catch (err) {
          logger.error(`Error fetching tweets for user ${userId}:`, err);
          // Continue with other users
        }
      }
      
      // Sort by engagement score and take the top ones
      tweets.sort((a, b) => b.engagement_score - a.engagement_score);
      
      logger.info(`Retrieved ${tweets.length} tweets from followed accounts`);
      return tweets.slice(0, limit);
    } catch (error) {
      logger.error('Error fetching popular tweets from following:', error);
      return []; // Return empty array instead of throwing to prevent breaking flows
    }
  }
  
  /**
   * Calculate engagement score for a tweet
   * @param {Object} metrics - Public metrics from Twitter API
   * @returns {number} - Engagement score
   */
  calculateEngagementScore(metrics) {
    if (!metrics) return 0;
    
    return (
      (metrics.like_count || 0) * 1 + 
      (metrics.retweet_count || 0) * 3 + 
      (metrics.reply_count || 0) * 2 + 
      (metrics.quote_count || 0) * 2
    );
  }

  /**
   * Track a cryptocurrency token and check if it's recent
   * @param {string} symbol - The token symbol
   * @returns {boolean} - Whether this is a recent token (< 120 hours old)
   */
  isRecentToken(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    const now = Date.now();
    
    // If we haven't seen this token before, add it to our tracking
    if (!this.recentTokens.has(normalizedSymbol)) {
      this.recentTokens.set(normalizedSymbol, now);
      return true; // First time we've seen it, so consider it recent
    }
    
    // Check how old the token is in our tracking
    const firstSeen = this.recentTokens.get(normalizedSymbol);
    const hoursSinceSeen = (now - firstSeen) / (1000 * 60 * 60);
    
    return hoursSinceSeen < 120; // Less than 120 hours (5 days) old
  }

  /**
   * Extract potential token symbols from text
   * @param {string} text - Text to analyze
   * @returns {Array<string>} - Array of potential token symbols
   */
  extractTokenSymbols(text) {
    // Look for patterns that match token symbols
    // Common patterns: $SYMBOL, #SYMBOL (3-5 letters usually)
    const symbolRegex = /[$#]([A-Z]{2,6})\b/g;
    const matches = [...text.toUpperCase().matchAll(symbolRegex)];
    
    return matches.map(match => match[1]); // Extract just the symbol part
  }

  /**
   * Get metrics for a specific tweet
   * @param {string} tweetId - The ID of the tweet
   * @returns {Promise<Object>} - Tweet metrics
   */
  async getTweetMetrics(tweetId) {
    try {
      logger.info(`Fetching metrics for tweet ${tweetId}`);
      const tweet = await rwClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['created_at', 'public_metrics'],
      });
      
      logger.info(`Retrieved metrics for tweet ${tweetId}`);
      return tweet.data.public_metrics;
    } catch (error) {
      logger.error(`Error fetching metrics for tweet ${tweetId}:`, error);
      throw error;
    }
  }

  /**
   * Get all tweets in a conversation/thread
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<Array>} - Array of tweets in the conversation
   */
  async getConversation(conversationId) {
    try {
      logger.info(`Fetching conversation ${conversationId}`);
      const conversation = await rwClient.v2.search(`conversation_id:${conversationId}`, {
        'tweet.fields': ['created_at', 'public_metrics', 'conversation_id', 'in_reply_to_user_id'],
      });
      
      logger.info(`Retrieved ${conversation.data.meta.result_count} tweets from conversation ${conversationId}`);
      return conversation.data.data || [];
    } catch (error) {
      logger.error(`Error fetching conversation ${conversationId}:`, error);
      throw error;
    }
  }
}

module.exports = new TwitterService();
