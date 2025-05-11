const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');
const botController = require('./controllers/bot');
const axios = require('axios'); // Add axios for self-ping

// Create Express app
const app = express();
const port = process.env.PORT || config.app.port || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint - required for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API endpoints
app.post('/api/bot/start', async (req, res) => {
  try {
    const success = await botController.startBot();
    res.status(200).json({ success });
  } catch (err) {
    logger.error(`Error starting bot: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/stop', async (req, res) => {
  try {
    const success = await botController.stopBot();
    res.status(200).json({ success });
  } catch (err) {
    logger.error(`Error stopping bot: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/tweet', async (req, res) => {
  try {
    const tweet = await botController.generateAndPostTweet();
    res.status(200).json({ success: true, tweet });
  } catch (err) {
    logger.error(`Error posting tweet: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trends', async (req, res) => {
  try {
    const summary = await botController.generateTrendSummary();
    res.status(200).json({ success: true, summary });
  } catch (error) {
    logger.error('Error generating trend summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await botController.getDashboardData();
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'X Memecoin Bot',
    version: '1.0.0',
    description: 'A Twitter bot for memecoin content',
    status: 'Running',
    uptime: process.uptime() + ' seconds'
  });
});

// Start the server
const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  
  // Start the bot
  botController.startBot()
    .then(() => {
      logger.info('Bot started successfully');
    })
    .catch((err) => {
      logger.error(`Failed to start bot: ${err.message}`);
    });
});

// Keep-alive mechanism to prevent Render from putting the service to sleep
// Render free tier services sleep after 15 minutes of inactivity
if (process.env.NODE_ENV === 'production') {
  const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds
  
  const pingServer = async () => {
    try {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
      logger.info(`Pinging health endpoint at ${baseUrl}/health`);
      const response = await axios.get(`${baseUrl}/health`);
      logger.info(`Ping successful, status: ${response.status}`);
    } catch (error) {
      logger.error(`Ping failed: ${error.message}`);
    }
  };

  // Schedule the ping every 14 minutes
  setInterval(pingServer, PING_INTERVAL);
  logger.info(`Keep-alive mechanism enabled, pinging every ${PING_INTERVAL / 60 / 1000} minutes`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    botController.stopBot()
      .then(() => {
        logger.info('Bot stopped successfully');
        process.exit(0);
      })
      .catch((err) => {
        logger.error(`Error stopping bot: ${err.message}`);
        process.exit(1);
      });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  botController.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  botController.stop();
  server.close(() => {
    logger.info('Server closed due to error');
    process.exit(1);
  });
});

module.exports = app;
