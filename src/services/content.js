const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');
const twitterService = require('./twitter');

/**
 * Service for gathering content data for the bot
 */
class ContentService {
  constructor() {
    this.apiKeys = {
      coingecko: config.apis.coingecko,
      heliusRpc: config.apis.heliusRpc
    };
  }

  /**
   * Get trending memecoins from CoinGecko
   * @param {number} limit - Number of coins to fetch
   * @returns {Promise<Array>} - Array of trending coins
   */
  async getTrendingMemecoins(limit = 5) {
    try {
      logger.info('Fetching trending memecoins from CoinGecko');
      
      const options = {
        headers: {}
      };
      
      if (this.apiKeys.coingecko) {
        options.headers['x-cg-pro-api-key'] = this.apiKeys.coingecko;
      }
      
      // Always use the free API endpoint regardless of API key
      // Free API also accepts the API key for higher rate limits
      const baseUrl = 'https://api.coingecko.com/api/v3';
      
      const response = await axios.get(`${baseUrl}/search/trending`, options);
      
      if (!response.data || !response.data.coins) {
        throw new Error('Invalid response from CoinGecko API');
      }
      
      // Filter to potential memecoins (this is a simple heuristic that could be improved)
      const memecoins = response.data.coins
        .filter(coin => {
          const name = coin.item.name.toLowerCase();
          const symbol = coin.item.symbol.toLowerCase();
          
          // Basic filter for memecoin-like characteristics
          return (
            name.includes('dog') || 
            name.includes('shib') || 
            name.includes('pepe') || 
            name.includes('meme') || 
            name.includes('elon') ||
            name.includes('doge') ||
            symbol.includes('meme') ||
            (symbol.length <= 4 && !symbol.includes('btc') && !symbol.includes('eth'))
          );
        })
        .slice(0, limit)
        .map(coin => ({
          name: coin.item.name,
          symbol: coin.item.symbol,
          price: coin.item.price_btc,
          rank: coin.item.market_cap_rank || 9999,
          // Add information about how recent this token is
          isRecent: twitterService.isRecentToken(coin.item.symbol)
        }));
      
      logger.info(`Found ${memecoins.length} trending memecoins`);
      return memecoins;
    } catch (error) {
      logger.error('Error fetching trending memecoins:', error);
      // Return empty array instead of throwing to prevent breaking the flow
      return [];
    }
  }

  /**
   * Get recent tokens (less than 120 hours old)
   * @param {number} limit - Number of tokens to return
   * @returns {Promise<Array>} - Array of recent tokens
   */
  async getRecentTokens(limit = 3) {
    try {
      logger.info('Filtering for recent tokens');
      
      const allTokens = await this.getTrendingMemecoins(20); // Get a bigger sample
      const recentTokens = allTokens.filter(token => token.isRecent);
      
      logger.info(`Found ${recentTokens.length} recent tokens (< 120 hours old)`);
      return recentTokens.slice(0, limit);
    } catch (error) {
      logger.error('Error filtering recent tokens:', error);
      return [];
    }
  }

  /**
   * Get recent crypto market events
   * @returns {Promise<Array>} - Array of recent events
   */
  async getRecentEvents() {
    try {
      logger.info('Fetching recent crypto market events');
      
      // This is a placeholder. In a real implementation, you might:
      // 1. Call a news API like CryptoCompare, CryptoNews, etc.
      // 2. Scrape crypto news sites
      // 3. Use Twitter API to find trending crypto topics
      
      // Simulating with a basic implementation
      const events = [
        'Solana ecosystem growth',
        'New memecoin launches',
        'DEX volume increases',
        'Major protocol upgrades',
        'Crypto influencer activity'
      ];
      
      return events;
    } catch (error) {
      logger.error('Error fetching recent events:', error);
      return [];
    }
  }

  /**
   * Get trending tweets from accounts the bot follows
   * @param {number} limit - Number of tweets to fetch
   * @returns {Promise<Array>} - Array of trending tweets with author info
   */
  async getTrendingTweets(limit = 5) {
    try {
      logger.info('Fetching trending tweets from accounts the bot follows');
      
      const tweets = await twitterService.getPopularTweetsFromFollowing(24, limit * 2);
      
      // Format tweets for easier consumption by LLM
      const formattedTweets = tweets.slice(0, limit).map(tweet => ({
        author: `@${tweet.author_username}`,
        text: tweet.text,
        engagement: tweet.engagement_score
      }));
      
      logger.info(`Formatted ${formattedTweets.length} trending tweets`);
      return formattedTweets;
    } catch (error) {
      logger.error('Error fetching trending tweets:', error);
      return [];
    }
  }

  /**
   * Gather context for reply generation
   * @param {string} originalTweet - The tweet to reply to
   * @param {Object} mentionData - Data about the mention
   * @returns {Promise<Object>} - Context object for LLM
   */
  async gatherReplyContext(originalTweet, mentionData) {
    logger.info(`Gathering context for reply to tweet by ${mentionData.author_username}`);
    
    // Get recent tokens
    const recentTokens = await this.getRecentTokens(3);
    
    // Get trending tweets
    const trendingTweets = await this.getTrendingTweets(3);
    
    // Extract any token mentions from the original tweet
    const mentionedTokens = twitterService.extractTokenSymbols(originalTweet)
      .filter(token => twitterService.isRecentToken(token));
    
    return {
      originalTweet,
      authorName: mentionData.author_name,
      authorUsername: mentionData.author_username,
      recentTokens: recentTokens.map(t => `${t.name} (${t.symbol})`),
      trendingTweets,
      mentionedTokens
    };
  }

  /**
   * Gather context for tweet generation
   * @returns {Promise<Object>} - Context object for LLM
   */
  async gatherTweetContext() {
    logger.info('Gathering context for tweet generation');
    
    const [trendingCoins, recentEvents, trendingTweets] = await Promise.all([
      this.getTrendingMemecoins(),
      this.getRecentEvents(),
      this.getTrendingTweets(3)
    ]);
    
    // Filter to only include recent tokens (< 120 hours old)
    const recentTokens = trendingCoins.filter(coin => coin.isRecent);
    
    return {
      recentEvents: recentEvents,
      topCoins: trendingCoins.map(coin => `${coin.name} (${coin.symbol})`),
      recentTokens: recentTokens.map(coin => `${coin.name} (${coin.symbol})`),
      trendingTweets
    };
  }

  /**
   * Gather context for trend summary generation
   * @returns {Promise<Object>} - Context object for LLM
   */
  async gatherTrendSummaryContext() {
    logger.info('Gathering context for trend summary');
    
    const trendingCoins = await this.getTrendingMemecoins(10);
    
    // Calculate market condition (placeholder logic)
    const marketCondition = trendingCoins.length > 5 ? 'bullish' : 'neutral';
    
    return {
      recentTrends: [
        'DeFi integrations',
        'Multi-chain expansion',
        'Memecoin launchpads',
        'Airdrop season'
      ],
      topCoins: trendingCoins.map(coin => `${coin.name} (${coin.symbol})`),
      marketCondition
    };
  }
}

module.exports = new ContentService();
