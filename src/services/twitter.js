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
        'tweet.fields': ['created_at', 'public_metrics', 'conversation_id'],
      });
      
      logger.info(`Retrieved ${mentions.data.meta.result_count} mentions`);
      return mentions.data.data || [];
    } catch (error) {
      logger.error('Error fetching mentions:', error);
      throw error;
    }
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
