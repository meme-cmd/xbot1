const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');

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
          rank: coin.item.market_cap_rank || 9999
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
   * Get trending hashtags related to crypto
   * @param {number} limit - Number of hashtags to fetch
   * @returns {Promise<Array>} - Array of trending hashtags
   */
  async getTrendingHashtags(limit = 5) {
    try {
      logger.info('Fetching trending crypto hashtags');
      
      // This is a placeholder. In a real implementation, you would use 
      // Twitter's API to get trending hashtags in the crypto category
      
      // Simulating with common crypto hashtags
      const hashtags = [
        'solana',
        'memecoin',
        'crypto',
        'defi',
        'nft',
        'web3',
        'altcoin',
        'airdrop',
        'blockchain'
      ];
      
      return hashtags.slice(0, limit);
    } catch (error) {
      logger.error('Error fetching trending hashtags:', error);
      return [];
    }
  }

  /**
   * Gather context for tweet generation
   * @returns {Promise<Object>} - Context object for LLM
   */
  async gatherTweetContext() {
    logger.info('Gathering context for tweet generation');
    
    const [trendingCoins, recentEvents, trendingHashtags] = await Promise.all([
      this.getTrendingMemecoins(),
      this.getRecentEvents(),
      this.getTrendingHashtags()
    ]);
    
    return {
      trends: trendingHashtags,
      recentEvents: recentEvents,
      topCoins: trendingCoins.map(coin => `${coin.name} (${coin.symbol})`)
    };
  }

  /**
   * Gather context for reply generation
   * @param {string} originalTweet - The tweet to reply to
   * @param {string} authorName - The author of the original tweet
   * @returns {Promise<Object>} - Context object for LLM
   */
  async gatherReplyContext(originalTweet, authorName) {
    logger.info(`Gathering context for reply to tweet by ${authorName}`);
    
    // For replies, we mainly need the original tweet and author,
    // but we could also analyze the tweet content for better context
    
    return {
      originalTweet,
      authorName,
      // Additional context could be added here
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
