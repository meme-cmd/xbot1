const logger = require('../utils/logger');
const scheduler = require('../services/scheduler');
const twitterService = require('../services/twitter');
const llmService = require('../services/llm');
const contentService = require('../services/content');
const metricsTracker = require('../utils/metrics');
const engagementModel = require('../models/engagement');

/**
 * Controller for the Twitter bot
 */
class BotController {
  /**
   * Start the bot
   */
  async startBot() {
    try {
      logger.info('Starting X Memecoin Bot');
      
      // Verify Twitter API credentials
      await this.verifyTwitterCredentials();
      
      // Verify Together AI LLM API
      await this.verifyLLMCredentials();
      
      // Start all scheduled jobs
      scheduler.startAllJobs();
      
      logger.info('X Memecoin Bot started successfully');
      return true;
    } catch (error) {
      logger.error('Failed to start bot:', error);
      return false;
    }
  }

  /**
   * Stop the bot
   */
  async stopBot() {
    try {
      logger.info('Stopping X Memecoin Bot');
      
      // Stop all scheduled jobs
      scheduler.stopAllJobs();
      
      // Close database connection
      engagementModel.close();
      
      logger.info('X Memecoin Bot stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping bot:', error);
      return false;
    }
  }

  /**
   * Generate and post a tweet
   * @returns {Promise<Object>} - Posted tweet data
   */
  async generateAndPostTweet() {
    try {
      logger.info('Generating and posting tweet');
      
      // Generate content using LLM
      const context = await contentService.gatherTweetContext();
      const tweetContent = await llmService.generateTweet(context);
      
      // Post to Twitter
      const tweet = await twitterService.postTweet(tweetContent);
      
      // Save to database
      await engagementModel.saveTweet(
        { 
          id: tweet.id, 
          text: tweetContent, 
          created_at: new Date().toISOString(),
          type: 'generated'
        }, 
        'tweet', 
        context
      );
      
      logger.info(`Posted generated tweet with ID: ${tweet.id}`);
      return tweet;
    } catch (error) {
      logger.error('Error posting generated tweet:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a tweet
   * @param {string} customContent - Optional custom content (if not provided, LLM will generate)
   * @returns {Promise<Object>} - Posted tweet data
   */
  async tweet(customContent = null) {
    try {
      logger.info('Manually triggering tweet');
      
      let tweetContent = customContent;
      let context = null;
      
      if (!tweetContent) {
        // Generate content using LLM
        context = await contentService.gatherTweetContext();
        tweetContent = await llmService.generateTweet(context);
      }
      
      // Post to Twitter
      const tweet = await twitterService.postTweet(tweetContent);
      
      // Save to database
      await engagementModel.saveTweet(
        { 
          id: tweet.id, 
          text: tweetContent, 
          created_at: new Date().toISOString(),
          type: 'manual'
        }, 
        customContent ? null : 'tweet', 
        context
      );
      
      logger.info(`Manually posted tweet with ID: ${tweet.id}`);
      return tweet;
    } catch (error) {
      logger.error('Error posting manual tweet:', error);
      throw error;
    }
  }

  /**
   * Manually generate a trend summary
   * @returns {Promise<string>} - Generated trend summary
   */
  async generateTrendSummary() {
    try {
      logger.info('Manually generating trend summary');
      
      // Gather context
      const context = await contentService.gatherTrendSummaryContext();
      
      // Generate the summary
      const summary = await llmService.generateTrendSummary(context);
      
      logger.info('Trend summary generated successfully');
      return summary;
    } catch (error) {
      logger.error('Error generating trend summary:', error);
      throw error;
    }
  }

  /**
   * Get performance dashboard data
   * @returns {Promise<Object>} - Dashboard data
   */
  async getDashboardData() {
    try {
      logger.info('Getting dashboard data');
      
      // Get performance insights
      const insights = await metricsTracker.getPerformanceInsights();
      
      // Get recent tweets with metrics
      const recentTweets = await engagementModel.getRecentTweetsWithMetrics(10);
      
      // Get top performing tweets
      const topTweets = await engagementModel.getTopPerformingTweets(5);
      
      return {
        insights,
        recentTweets,
        topTweets,
        botStatus: {
          isRunning: Object.keys(scheduler.jobs).length > 0,
          nextTweetTime: this.getNextScheduledTweetTime()
        }
      };
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Verify Twitter API credentials
   * @returns {Promise<boolean>} - Whether credentials are valid
   */
  async verifyTwitterCredentials() {
    try {
      logger.info('Verifying Twitter API credentials');
      
      // Try to get user info to verify credentials
      const user = await twitterService.getMentions(10);
      
      logger.info('Twitter API credentials verified successfully');
      return true;
    } catch (error) {
      logger.error('Invalid Twitter API credentials:', error);
      throw new Error('Failed to verify Twitter API credentials');
    }
  }

  /**
   * Verify Together AI LLM API credentials
   * @returns {Promise<boolean>} - Whether credentials are valid
   */
  async verifyLLMCredentials() {
    try {
      logger.info('Verifying Together AI LLM credentials');
      
      // Try to generate a simple test prompt
      const test = await llmService.generateContent('tweet', { topCoins: ['Test Coin (TEST)'] });
      
      logger.info('Together AI LLM credentials verified successfully');
      return true;
    } catch (error) {
      logger.error('Invalid Together AI LLM credentials:', error);
      throw new Error('Failed to verify Together AI LLM credentials');
    }
  }

  /**
   * Get the next scheduled tweet time
   * @returns {Date|null} - Next scheduled tweet time
   */
  getNextScheduledTweetTime() {
    const tweetJob = scheduler.jobs.tweet;
    
    if (!tweetJob) {
      return null;
    }
    
    // This is a rough estimation as node-cron doesn't expose next execution time
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    return nextHour;
  }
}

module.exports = new BotController();
