const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../utils/logger');
const config = require('../config/config');

class EngagementModel {
  constructor() {
    this.dbPath = config.database.path;
    this.ensureDatabaseExists();
    this.db = new sqlite3.Database(this.dbPath);
    this.initDatabase();
  }

  ensureDatabaseExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created database directory: ${dir}`);
    }
  }

  initDatabase() {
    this.db.serialize(() => {
      // Create tweets table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tweets (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          type TEXT NOT NULL,
          prompt_used TEXT,
          context TEXT
        )
      `);

      // Create metrics table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tweet_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          likes INTEGER DEFAULT 0,
          retweets INTEGER DEFAULT 0,
          replies INTEGER DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          FOREIGN KEY(tweet_id) REFERENCES tweets(id)
        )
      `);

      // Create performance_analysis table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS performance_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tweet_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          analysis TEXT NOT NULL,
          success_factors TEXT,
          improvement_areas TEXT,
          recommended_approach TEXT,
          FOREIGN KEY(tweet_id) REFERENCES tweets(id)
        )
      `);

      logger.info('Database initialized successfully');
    });
  }

  /**
   * Save a new tweet to the database
   * @param {Object} tweet - Tweet object with id, content, etc.
   * @param {string} promptUsed - The prompt template used
   * @param {Object} context - Context data provided to the LLM
   * @returns {Promise<Object>} The saved tweet
   */
  saveTweet(tweet, promptUsed = null, context = null) {
    return new Promise((resolve, reject) => {
      const { id, text, created_at, type = 'tweet' } = tweet;
      const contextStr = context ? JSON.stringify(context) : null;
      
      this.db.run(
        `INSERT INTO tweets (id, content, created_at, type, prompt_used, context)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, text, created_at, type, promptUsed, contextStr],
        function(err) {
          if (err) {
            logger.error(`Error saving tweet ${id}:`, err);
            return reject(err);
          }
          
          logger.info(`Tweet ${id} saved to database`);
          resolve({ id, text, created_at, type, promptUsed, context });
        }
      );
    });
  }

  /**
   * Save metrics for a tweet
   * @param {string} tweetId - Tweet ID
   * @param {Object} metrics - Engagement metrics
   * @returns {Promise<Object>} The saved metrics
   */
  saveMetrics(tweetId, metrics) {
    return new Promise((resolve, reject) => {
      const { likes, retweets, replies, impressions = 0 } = metrics;
      const timestamp = new Date().toISOString();
      
      this.db.run(
        `INSERT INTO metrics (tweet_id, timestamp, likes, retweets, replies, impressions)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tweetId, timestamp, likes, retweets, replies, impressions],
        function(err) {
          if (err) {
            logger.error(`Error saving metrics for tweet ${tweetId}:`, err);
            return reject(err);
          }
          
          logger.info(`Metrics saved for tweet ${tweetId}`);
          resolve({ id: this.lastID, tweetId, timestamp, likes, retweets, replies, impressions });
        }
      );
    });
  }

  /**
   * Save performance analysis for a tweet
   * @param {string} tweetId - Tweet ID 
   * @param {Object} analysis - Performance analysis
   * @returns {Promise<Object>} The saved analysis
   */
  saveAnalysis(tweetId, analysis) {
    return new Promise((resolve, reject) => {
      const { 
        analysis: analysisText, 
        successFactors, 
        improvementAreas, 
        recommendedApproach 
      } = analysis;
      
      const timestamp = new Date().toISOString();
      
      this.db.run(
        `INSERT INTO performance_analysis 
         (tweet_id, timestamp, analysis, success_factors, improvement_areas, recommended_approach)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tweetId, 
          timestamp, 
          analysisText, 
          JSON.stringify(successFactors), 
          JSON.stringify(improvementAreas), 
          recommendedApproach
        ],
        function(err) {
          if (err) {
            logger.error(`Error saving analysis for tweet ${tweetId}:`, err);
            return reject(err);
          }
          
          logger.info(`Analysis saved for tweet ${tweetId}`);
          resolve({ 
            id: this.lastID, 
            tweetId, 
            timestamp, 
            analysisText, 
            successFactors, 
            improvementAreas, 
            recommendedApproach 
          });
        }
      );
    });
  }

  /**
   * Get the latest metrics for a tweet
   * @param {string} tweetId - Tweet ID
   * @returns {Promise<Object>} Latest metrics
   */
  getLatestMetrics(tweetId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM metrics 
         WHERE tweet_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [tweetId],
        (err, row) => {
          if (err) {
            logger.error(`Error fetching metrics for tweet ${tweetId}:`, err);
            return reject(err);
          }
          
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Get recent tweets with their latest metrics
   * @param {number} limit - Number of tweets to fetch
   * @returns {Promise<Array>} Recent tweets with metrics
   */
  getRecentTweetsWithMetrics(limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.*, 
                (SELECT likes FROM metrics WHERE tweet_id = t.id ORDER BY timestamp DESC LIMIT 1) as likes,
                (SELECT retweets FROM metrics WHERE tweet_id = t.id ORDER BY timestamp DESC LIMIT 1) as retweets,
                (SELECT replies FROM metrics WHERE tweet_id = t.id ORDER BY timestamp DESC LIMIT 1) as replies
         FROM tweets t
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            logger.error('Error fetching recent tweets with metrics:', err);
            return reject(err);
          }
          
          // Parse JSON strings
          const parsedRows = rows.map(row => {
            if (row.context && typeof row.context === 'string') {
              try {
                row.context = JSON.parse(row.context);
              } catch (e) {
                // Keep as string if parsing fails
              }
            }
            return row;
          });
          
          resolve(parsedRows);
        }
      );
    });
  }

  /**
   * Get top performing tweets based on engagement
   * @param {number} limit - Number of tweets to fetch
   * @returns {Promise<Array>} Top performing tweets
   */
  getTopPerformingTweets(limit = 5) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.*, 
                m.likes, 
                m.retweets, 
                m.replies,
                (m.likes + m.retweets * 2 + m.replies * 3) as engagement_score
         FROM tweets t
         JOIN metrics m ON t.id = m.tweet_id
         ORDER BY engagement_score DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            logger.error('Error fetching top performing tweets:', err);
            return reject(err);
          }
          
          resolve(rows);
        }
      );
    });
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = new EngagementModel();
