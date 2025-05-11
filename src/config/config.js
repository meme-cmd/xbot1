require('dotenv').config();

module.exports = {
  // Twitter API configuration
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },
  
  // Together AI configuration
  llm: {
    apiKey: process.env.TOGETHER_API_KEY,
    model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3-8b-chat',
    maxTokens: 500,
    temperature: 0.7,
  },
  
  // App configuration
  app: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  // Scheduler configuration
  scheduler: {
    tweetIntervalHours: parseInt(process.env.TWEET_INTERVAL_HOURS || '2', 10),
    metricsCheckHours: parseInt(process.env.METRICS_CHECK_HOURS || '3', 10),
  },
  
  // Optional API keys
  apis: {
    coingecko: process.env.COINGECKO_API_KEY,
    heliusRpc: process.env.HELIUS_RPC_URL,
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './data/engagement.db',
  },
};
