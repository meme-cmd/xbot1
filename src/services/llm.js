const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const prompts = require('../utils/prompts');

/**
 * Service for interacting with the Together AI LLM API
 */
class LLMService {
  constructor() {
    this.baseUrl = 'https://api.together.xyz/v1/completions';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.llm.apiKey}`
    };
  }

  /**
   * Generate content using the LLM
   * @param {string} promptName - Name of the prompt template to use
   * @param {Object} context - Context data to inject into the prompt
   * @returns {Promise<string>} - Generated content
   */
  async generateContent(promptName, context = {}) {
    try {
      if (!prompts[promptName]) {
        throw new Error(`Prompt template "${promptName}" not found`);
      }

      const promptText = prompts[promptName](context);
      
      logger.info(`Generating content with prompt: ${promptName}`);
      
      const requestBody = {
        model: config.llm.model,
        prompt: promptText,
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
        top_p: 0.9,
        top_k: 50,
        stop: ["</s>", "Human:", "Assistant:"]
      };

      const response = await axios.post(this.baseUrl, requestBody, { headers: this.headers });
      
      if (!response.data.choices || response.data.choices.length === 0) {
        throw new Error('No content generated from LLM');
      }
      
      const generatedText = response.data.choices[0].text.trim();
      logger.info('Content generated successfully');
      
      return generatedText;
    } catch (error) {
      logger.error('Error generating content with LLM:', error);
      throw error;
    }
  }

  /**
   * Generate a tweet about memecoins
   * @param {Object} context - Context information about current trends, etc.
   * @returns {Promise<string>} - Generated tweet content
   */
  async generateTweet(context = {}) {
    return this.generateContent('tweet', context);
  }

  /**
   * Generate a reply to a tweet
   * @param {Object} context - Context including the original tweet
   * @returns {Promise<string>} - Generated reply content
   */
  async generateReply(context = {}) {
    return this.generateContent('reply', context);
  }

  /**
   * Generate a summary of memecoin trends
   * @param {Object} context - Context data about current trends
   * @returns {Promise<string>} - Generated trend summary
   */
  async generateTrendSummary(context = {}) {
    return this.generateContent('trends', context);
  }

  /**
   * Analyze the performance of a tweet
   * @param {Object} context - Context including tweet and metrics
   * @returns {Promise<Object>} - Analysis of the tweet performance
   */
  async analyzeTweetPerformance(context = {}) {
    const analysisText = await this.generateContent('analyze', context);
    
    try {
      // Try to parse the analysis as JSON
      return JSON.parse(analysisText);
    } catch (error) {
      logger.warn('Could not parse LLM analysis as JSON, returning raw text');
      return { analysis: analysisText };
    }
  }
}

module.exports = new LLMService();
