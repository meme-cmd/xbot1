# Deploying X Memecoin Bot to Render

This guide explains how to deploy your X Memecoin Bot to Render so it runs continuously even when your computer is off.

## Prerequisites

1. Create a [Render account](https://render.com/)
2. Connect your GitHub account to Render
3. Push your code to a GitHub repository

## Deployment Steps

### Option 1: Automatic Deployment via render.yaml

1. Push your code to GitHub including the `render.yaml` file
2. In Render dashboard, click "New+" and select "Blueprint"
3. Connect to your GitHub repository
4. Render will detect the `render.yaml` configuration and set up your service

### Option 2: Manual Deployment

1. In Render dashboard, click "New+" and select "Web Service"
2. Connect to your GitHub repository
3. Configure the service with the following settings:
   - **Name**: x-memecoin-bot
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free

## Environment Variables

You must add the following environment variables in the Render dashboard:

- `TWITTER_API_KEY`: Your Twitter API key
- `TWITTER_API_SECRET`: Your Twitter API secret
- `TWITTER_ACCESS_TOKEN`: Your Twitter access token
- `TWITTER_ACCESS_SECRET`: Your Twitter access token secret
- `TOGETHER_API_KEY`: Your Together AI API key
- `TOGETHER_MODEL`: meta-llama/Llama-3.3-70B-Instruct-Turbo
- `NODE_ENV`: production
- `PORT`: 10000
- `COINGECKO_API_KEY`: Your CoinGecko API key (if applicable)
- `HELIUS_RPC_URL`: Your Helius RPC URL (if applicable)

## Important Notes

1. The free tier on Render has some limitations:
   - Services are spun down after 15 minutes of inactivity
   - Limited to 750 hours of runtime per month

2. For more reliable operation, consider upgrading to a paid plan.

3. Make sure your Twitter API credentials have the necessary Read and Write permissions.

## Database Persistence

The application stores data in a SQLite database located in the `data` directory. On Render, this will persist as long as your service exists, but be aware that if you delete and recreate the service, the database will be lost.

For production use, consider migrating to a more robust database solution like PostgreSQL, which Render supports. 