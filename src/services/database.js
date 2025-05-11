const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Service for database operations
 */
class DatabaseService {
  constructor() {
    this.dbPath = config.database.path;
    
    // Ensure the directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }
    
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        logger.error(`Error opening database: ${err.message}`);
      } else {
        logger.info(`Connected to SQLite database at ${this.dbPath}`);
        this.initializeDatabase();
      }
    });
  }

  /**
   * Initialize database tables
   */
  initializeDatabase() {
    // Create table for tracking tweet engagement
    const createEngagementTableSQL = `
      CREATE TABLE IF NOT EXISTS tweet_engagement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tweet_id TEXT UNIQUE,
        content TEXT,
        posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        engagement_score REAL DEFAULT 0
      )
    `;

    this.db.run(createEngagementTableSQL, (err) => {
      if (err) {
        logger.error(`Error creating engagement table: ${err.message}`);
      } else {
        logger.info('Engagement table initialized');
      }
    });
  }

  /**
   * Store a new tweet in the database
   * @param {string} tweetId - The ID of the tweet
   * @param {string} content - The content of the tweet
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async storeTweet(tweetId, content) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO tweet_engagement (tweet_id, content) VALUES (?, ?)`;
      this.db.run(sql, [tweetId, content], function(err) {
        if (err) {
          logger.error(`Failed to store tweet: ${err.message}`);
          resolve(false);
        } else {
          logger.info(`Stored tweet ${tweetId} in database`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Update engagement metrics for a tweet
   * @param {string} tweetId - The ID of the tweet
   * @param {number} likes - Number of likes
   * @param {number} retweets - Number of retweets
   * @param {number} replies - Number of replies
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateEngagement(tweetId, likes, retweets, replies) {
    return new Promise((resolve, reject) => {
      const engagementScore = this.calculateEngagementScore(likes, retweets, replies);
      const sql = `
        UPDATE tweet_engagement 
        SET likes = ?, retweets = ?, replies = ?, 
            engagement_score = ?, last_checked = CURRENT_TIMESTAMP
        WHERE tweet_id = ?
      `;
      
      this.db.run(sql, [likes, retweets, replies, engagementScore, tweetId], function(err) {
        if (err) {
          logger.error(`Failed to update engagement: ${err.message}`);
          resolve(false);
        } else {
          logger.info(`Updated engagement for tweet ${tweetId}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Calculate an engagement score based on various metrics
   * @param {number} likes - Number of likes
   * @param {number} retweets - Number of retweets
   * @param {number} replies - Number of replies
   * @returns {number} - The calculated engagement score
   */
  calculateEngagementScore(likes, retweets, replies) {
    // Simple weighted scoring
    return (likes * 1) + (retweets * 3) + (replies * 2);
  }

  /**
   * Get the top performing tweets by engagement score
   * @param {number} limit - Number of tweets to return
   * @returns {Promise<Array>} - Array of tweet objects
   */
  async getTopTweets(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tweet_engagement
        ORDER BY engagement_score DESC
        LIMIT ?
      `;
      
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          logger.error(`Failed to get top tweets: ${err.message}`);
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  /**
   * Close the database connection
   */
  close() {
    this.db.close((err) => {
      if (err) {
        logger.error(`Error closing database: ${err.message}`);
      } else {
        logger.info('Database connection closed');
      }
    });
  }
}

module.exports = new DatabaseService(); 