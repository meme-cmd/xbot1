# X Memecoin Bot

An autonomous memecoin-themed Twitter bot powered by Together AI LLM.

## Features

- **Twitter Integration**: Post tweets, monitor mentions, and engage with users
- **AI-Powered Content**: Generate witty, bullish memecoin content using Together AI's LLM
- **Engagement Tracking**: Monitor performance metrics and optimize content strategy
- **Autonomous Operation**: Scheduled posting and auto-replies
- **Adaptive Learning**: Continuously improves based on engagement metrics
- **24/7 Hosting**: Deployable to Render for continuous operation

## Tech Stack

- Node.js
- Twitter API v2
- Together AI LLM API
- SQLite for data storage
- Express (for optional dashboard)

## Local Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment example and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
4. Configure the Twitter API keys and Together AI API key in the `.env` file
5. Start the application:
   ```bash
   npm run dev
   ```

## Deployment on Render

The bot can be deployed to Render for 24/7 operation:

1. Push your code to GitHub
2. Create a Render account and connect it to your GitHub repository
3. Create a Web Service pointing to your repository
4. Configure the environment variables in Render dashboard
5. Deploy!

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Environment Variables

```
# Twitter API Credentials
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_SECRET=your_twitter_access_secret

# Together AI API
TOGETHER_API_KEY=your_together_ai_api_key
TOGETHER_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo

# App Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Scheduler Settings
TWEET_INTERVAL_HOURS=2
METRICS_CHECK_HOURS=3

# Optional API Keys
COINGECKO_API_KEY=your_coingecko_api_key
HELIUS_RPC_URL=your_helius_rpc_url

# Database Settings
DB_PATH=./data/engagement.db
```

## Folder Structure

```
├── src/
│   ├── config/        # Configuration files
│   ├── controllers/   # Business logic
│   ├── models/        # Data models
│   ├── routes/        # API routes (for dashboard)
│   ├── services/      # External service integrations
│   ├── utils/         # Utility functions
│   └── index.js       # Application entry point
├── public/            # Static files for dashboard
├── data/              # SQLite database storage
├── .env               # Environment variables
├── render.yaml        # Render deployment configuration
└── package.json       # Project dependencies
```

## Testing

Before deployment, you can test Twitter API credentials:

```bash
node test-twitter.js
```

## License

MIT
