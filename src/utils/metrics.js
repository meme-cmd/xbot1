const twitterService = require('../services/twitter');
const engagementModel = require('../models/engagement');
const llmService = require('../services/llm');
const logger = require('./logger');

/**
 * Utility for tracking and analyzing tweet performance
 */
class MetricsTracker {
  /**
   * Track metrics for a tweet
   * @param {string} tweetId - The ID of the tweet to track
   * @returns {Promise<Object>} - Metrics data
   */
  async trackTweetMetrics(tweetId) {
    try {
      logger.info(`Tracking metrics for tweet ${tweetId}`);
      
      // Fetch metrics from Twitter
      const metrics = await twitterService.getTweetMetrics(tweetId);
      
      // Save metrics to database
      await engagementModel.saveMetrics(tweetId, metrics);
      
      return metrics;
    } catch (error) {
      logger.error(`Error tracking metrics for tweet ${tweetId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze the performance of a tweet
   * @param {string} tweetId - The ID of the tweet to analyze
   * @returns {Promise<Object>} - Analysis data
   */
  async analyzeTweetPerformance(tweetId) {
    try {
      logger.info(`Analyzing performance for tweet ${tweetId}`);
      
      // Get tweet data
      const tweetRows = await engagementModel.getRecentTweetsWithMetrics(1);
      if (tweetRows.length === 0 || tweetRows[0].id !== tweetId) {
        throw new Error(`Tweet ${tweetId} not found in database`);
      }
      
      const tweet = tweetRows[0];
      
      // Get metrics
      const metrics = await engagementModel.getLatestMetrics(tweetId);
      if (!metrics) {
        throw new Error(`No metrics found for tweet ${tweetId}`);
      }
      
      // Get previous tweets for comparison
      const previousTweets = await engagementModel.getRecentTweetsWithMetrics(5);
      
      // Format previous tweet data for LLM
      const previousPerformance = previousTweets
        .filter(t => t.id !== tweetId)
        .map(t => ({
          tweet: t.content,
          metrics: {
            likes: t.likes || 0,
            retweets: t.retweets || 0,
            replies: t.replies || 0
          }
        }));
      
      // Analyze with LLM
      const analysis = await llmService.analyzeTweetPerformance({
        tweet: tweet.content,
        metrics: {
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          impressions: metrics.impressions
        },
        previousPerformance
      });
      
      // Save analysis to database
      await engagementModel.saveAnalysis(tweetId, analysis);
      
      return analysis;
    } catch (error) {
      logger.error(`Error analyzing performance for tweet ${tweetId}:`, error);
      throw error;
    }
  }

  /**
   * Get insights from recent tweet performance
   * @returns {Promise<Object>} - Performance insights
   */
  async getPerformanceInsights() {
    try {
      logger.info('Getting performance insights');
      
      // Get top performing tweets
      const topTweets = await engagementModel.getTopPerformingTweets(5);
      
      // Get recent tweets
      const recentTweets = await engagementModel.getRecentTweetsWithMetrics(10);
      
      // Calculate average engagement
      const avgEngagement = recentTweets.reduce((acc, tweet) => {
        const engagement = (tweet.likes || 0) + (tweet.retweets || 0) * 2 + (tweet.replies || 0) * 3;
        return acc + engagement;
      }, 0) / (recentTweets.length || 1);
      
      // Identify patterns in top tweets
      const patterns = this.identifyPatterns(topTweets);
      
      return {
        topTweets,
        avgEngagement,
        patterns,
        sampleSize: recentTweets.length
      };
    } catch (error) {
      logger.error('Error getting performance insights:', error);
      throw error;
    }
  }

  /**
   * Identify patterns in top performing tweets
   * @param {Array} tweets - Array of tweet objects
   * @returns {Object} - Identified patterns
   */
  identifyPatterns(tweets) {
    // This is a simple implementation that could be enhanced with NLP or more sophisticated analysis
    const patterns = {
      hasEmojis: 0,
      hasMentions: 0,
      hasHashtags: 0,
      hasQuestions: 0,
      charCount: 0
    };
    
    if (!tweets || tweets.length === 0) {
      return patterns;
    }
    
    tweets.forEach(tweet => {
      const content = tweet.content;
      
      // Check for emojis (simple check for common emoji unicode ranges)
      if (/[\u{1F300}-\u{1F6FF}]/u.test(content)) {
        patterns.hasEmojis++;
      }
      
      // Check for mentions
      if (/@\w+/.test(content)) {
        patterns.hasMentions++;
      }
      
      // Check for hashtags
      if (/#\w+/.test(content)) {
        patterns.hasHashtags++;
      }
      
      // Check for questions
      if (/\?/.test(content)) {
        patterns.hasQuestions++;
      }
      
      // Track character count
      patterns.charCount += content.length;
    });
    
    // Calculate averages
    patterns.avgCharCount = patterns.charCount / tweets.length;
    patterns.emojisPercentage = (patterns.hasEmojis / tweets.length) * 100;
    patterns.hashtagsPercentage = (patterns.hasHashtags / tweets.length) * 100;
    patterns.questionsPercentage = (patterns.hasQuestions / tweets.length) * 100;
    
    return patterns;
  }
}

module.exports = new MetricsTracker();
