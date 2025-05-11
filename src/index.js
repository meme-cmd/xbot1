const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');
const botController = require('./controllers/bot');

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
    const success = await botController.start();
    res.status(success ? 200 : 500).json({ success });
  } catch (error) {
    logger.error('Error starting bot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bot/stop', (req, res) => {
  try {
    const success = botController.stop();
    res.status(success ? 200 : 500).json({ success });
  } catch (error) {
    logger.error('Error stopping bot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tweet', async (req, res) => {
  try {
    const { content } = req.body;
    const tweet = await botController.tweet(content);
    res.status(200).json({ success: true, tweet });
  } catch (error) {
    logger.error('Error posting tweet:', error);
    res.status(500).json({ success: false, error: error.message });
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

// Start the Express server
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`X Memecoin Bot server started on port ${port}`);
  
  // Auto-start the bot based on environment
  if (config.app.environment === 'production') {
    logger.info('Production environment detected, auto-starting bot');
    setTimeout(() => {
      botController.start().then(success => {
        if (!success) {
          logger.error('Failed to auto-start bot');
        } else {
          logger.info('Bot started successfully in production mode');
        }
      });
    }, 5000); // 5 second delay to ensure everything is initialized
  } else {
    logger.info('Development environment detected, bot needs to be started manually');
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  botController.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
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
