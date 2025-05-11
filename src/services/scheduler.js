const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../config/config');
const twitterService = require('./twitter');
const llmService = require('./llm');
const contentService = require('./content');
const metricsTracker = require('../utils/metrics');

/**
 * Service for scheduling bot tasks
 */
class SchedulerService {
  constructor() {
    this.jobs = {};
    this.tweetInterval = config.scheduler.tweetIntervalHours;
    this.metricsCheckHours = config.scheduler.metricsCheckHours;
    this.recentTweets = []; // Store recent tweet IDs for tracking
  }

  /**
   * Start all scheduled jobs
   */
  startAllJobs() {
    logger.info('Starting all scheduled jobs');
    this.startTweetJob();
    this.startMentionsCheckJob();
    this.startMetricsTrackingJob();
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    logger.info('Stopping all scheduled jobs');
    Object.values(this.jobs).forEach(job => job.stop());
    this.jobs = {};
  }

  /**
   * Start the job that posts tweets periodically
   */
  startTweetJob() {
    logger.info(`Scheduling tweets every ${this.tweetInterval} hours`);
    
    // Schedule using cron
    // For every X hours: `0 */${this.tweetInterval} * * *`
    this.jobs.tweet = cron.schedule(`0 */${this.tweetInterval} * * *`, async () => {
      try {
        logger.info('Executing scheduled tweet job');
        await this.postScheduledTweet();
      } catch (error) {
        logger.error('Error in scheduled tweet job:', error);
      }
    });
    
    // Also run immediately
    this.postScheduledTweet().catch(error => {
      logger.error('Error in initial tweet job:', error);
    });
  }

  /**
   * Start the job that checks for mentions
   */
  startMentionsCheckJob() {
    logger.info('Scheduling mentions check every 15 minutes');
    
    // Schedule for every 15 minutes
    this.jobs.mentions = cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('Executing mentions check job');
        await this.checkAndReplyToMentions();
      } catch (error) {
        logger.error('Error in mentions check job:', error);
      }
    });
    
    // Also run immediately
    this.checkAndReplyToMentions().catch(error => {
      logger.error('Error in initial mentions check:', error);
    });
  }

  /**
   * Start the job that tracks metrics for previous tweets
   */
  startMetricsTrackingJob() {
    logger.info(`Scheduling metrics tracking every ${this.metricsCheckHours} hours`);
    
    // Schedule using cron
    // For every X hours: `0 */${this.metricsCheckHours} * * *`
    this.jobs.metrics = cron.schedule(`0 */${this.metricsCheckHours} * * *`, async () => {
      try {
        logger.info('Executing metrics tracking job');
        await this.trackTweetMetrics();
      } catch (error) {
        logger.error('Error in metrics tracking job:', error);
      }
    });
  }

  /**
   * Post a scheduled tweet
   */
  async postScheduledTweet() {
    try {
      logger.info('Posting scheduled tweet');
      
      // Gather context data for the tweet
      const context = await contentService.gatherTweetContext();
      
      // Generate tweet content
      const tweetContent = await llmService.generateTweet(context);
      
      // Post to Twitter
      const tweet = await twitterService.postTweet(tweetContent);
      
      // Store the tweet ID for later metrics tracking
      this.recentTweets.push({
        id: tweet.id,
        createdAt: new Date(),
        content: tweetContent,
        context
      });
      
      // Keep only the last 20 tweets in memory
      if (this.recentTweets.length > 20) {
        this.recentTweets.shift();
      }
      
      logger.info(`Posted scheduled tweet with ID: ${tweet.id}`);
      return tweet;
    } catch (error) {
      logger.error('Error posting scheduled tweet:', error);
      throw error;
    }
  }

  /**
   * Check for mentions and reply to them
   */
  async checkAndReplyToMentions() {
    try {
      logger.info('Checking for mentions');
      
      // Get recent mentions
      const mentions = await twitterService.getMentions(10);
      
      // Filter out mentions we've already replied to (would need storage in a real implementation)
      const newMentions = mentions.filter(mention => {
        // For simplicity, we're just checking if it's recent (last hour)
        const mentionDate = new Date(mention.created_at);
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        
        return mentionDate > oneHourAgo;
      });
      
      logger.info(`Found ${newMentions.length} new mentions to reply to`);
      
      // Reply to each mention
      for (const mention of newMentions) {
        await this.replyToMention(mention);
      }
      
      return newMentions.length;
    } catch (error) {
      logger.error('Error checking for mentions:', error);
      throw error;
    }
  }

  /**
   * Reply to a specific mention
   * @param {Object} mention - The mention tweet
   */
  async replyToMention(mention) {
    try {
      logger.info(`Replying to mention ${mention.id}`);
      
      // Get author name (in a real implementation, would fetch from API)
      const authorName = mention.author_id || 'user';
      
      // Gather context for the reply
      const context = await contentService.gatherReplyContext(mention.text, authorName);
      
      // Generate reply content
      const replyContent = await llmService.generateReply(context);
      
      // Post the reply
      const reply = await twitterService.replyToTweet(mention.id, replyContent);
      
      logger.info(`Posted reply to mention ${mention.id} with ID: ${reply.id}`);
      return reply;
    } catch (error) {
      logger.error(`Error replying to mention ${mention.id}:`, error);
      throw error;
    }
  }

  /**
   * Track metrics for recent tweets
   */
  async trackTweetMetrics() {
    try {
      logger.info('Tracking metrics for recent tweets');
      
      // Filter to tweets that are old enough to have gathered engagement
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.metricsCheckHours);
      
      const tweetsToTrack = this.recentTweets.filter(tweet => {
        return new Date(tweet.createdAt) < cutoffTime;
      });
      
      logger.info(`Found ${tweetsToTrack.length} tweets to track metrics for`);
      
      // Track metrics for each tweet
      for (const tweet of tweetsToTrack) {
        await metricsTracker.trackTweetMetrics(tweet.id);
        
        // After tracking metrics, analyze performance
        await metricsTracker.analyzeTweetPerformance(tweet.id);
        
        // Remove from tracking list after processing
        const index = this.recentTweets.findIndex(t => t.id === tweet.id);
        if (index !== -1) {
          this.recentTweets.splice(index, 1);
        }
      }
      
      // After tracking, get insights to inform future tweets
      const insights = await metricsTracker.getPerformanceInsights();
      logger.info('Performance insights generated', { insights });
      
      return tweetsToTrack.length;
    } catch (error) {
      logger.error('Error tracking tweet metrics:', error);
      throw error;
    }
  }
}

module.exports = new SchedulerService();
