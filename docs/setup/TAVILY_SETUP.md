# Tavily Web Search Setup Guide

This guide explains how to configure Tavily API for web search functionality in the Diverge chat application.

## What is Tavily?

Tavily is an AI-optimized search API that provides real-time web search capabilities. It's designed specifically for LLM applications and provides high-quality, relevant search results with optional AI-generated summaries.

## Features

When Tavily is configured, the AI assistant can:
- Search for current information, news, and real-time data
- Access up-to-date information beyond the model's training cutoff
- Automatically detect when web search is needed based on your questions
- Provide source URLs for verification

## Setup Instructions

### Step 1: Get Tavily API Key

1. Go to [Tavily.com](https://tavily.com)
2. Click **Sign Up** to create a free account
3. Once logged in, go to your [API Keys page](https://app.tavily.com/home)
4. Copy your API key

### Step 2: Configure Environment Variable

Add your Tavily API key to your `.env.local` file:

```env
# Tavily API for Web Search
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Replace `tvly-xxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual API key.

### Step 3: Restart the Application

After adding the API key, restart your development server:

```bash
npm run dev
```

Or if deployed, restart your production server.

## Usage

### Automatic Web Search

The AI will automatically perform web searches when it detects queries that need current information, such as:
- Questions containing words like "latest", "current", "today", "recent", "news"
- Queries about real-time data (prices, weather, scores)
- Questions about events after the model's training cutoff

### Web Search Toggle

In the chat interface, you'll see a magnifying glass icon next to the send button:
- **Blue (enabled)**: Web search is active
- **Gray (disabled)**: Web search is turned off

Click the icon to toggle web search on/off for your messages.

## Pricing

Tavily offers different pricing tiers:

### Free Tier
- 1,000 API calls per month
- Basic search depth
- Perfect for personal use

### Paid Tiers
- Higher API call limits
- Advanced search depth
- Priority support
- See [Tavily Pricing](https://tavily.com/#pricing) for details

## Troubleshooting

### Web Search Not Working

1. **Check API Key**: Ensure your API key is correctly set in `.env.local`
2. **Check Logs**: Look for Tavily-related errors in the console
3. **Verify API Limits**: Check if you've exceeded your monthly API limit

### No Search Results

- The AI only searches when it detects the need for current information
- Try using keywords like "latest", "current news about", or "what's happening with"
- Ensure the web search toggle is enabled (blue icon)

## Security Notes

- **Never commit your API key** to version control
- Keep your `.env.local` file in `.gitignore`
- Use environment variables in production deployments
- Rotate your API key regularly

## Advanced Configuration

The search behavior can be customized in `/src/lib/tavily.ts`:

```typescript
// Adjust search parameters
const searchResults = await tavilyClient.search(query, {
  maxResults: 5,        // Number of results (default: 3)
  includeAnswer: true,  // Include AI summary (default: true)
  searchDepth: 'basic'  // 'basic' or 'advanced'
})
```

## Examples of Web Search Queries

- "What's the latest news about AI?"
- "Current stock price of AAPL"
- "Weather in Tokyo today"
- "Recent developments in quantum computing"
- "Who won the game last night?"
- "What's happening with the 2024 Olympics?"

## Support

If you encounter issues:
1. Check the [Tavily Documentation](https://docs.tavily.com)
2. Verify your API key is active
3. Check application logs for error messages
4. Ensure you're within your API usage limits