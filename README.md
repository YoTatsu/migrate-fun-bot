# Migrate.fun Discord Alert Bot 🚀

A Discord webhook bot that monitors [migrate.fun](https://migrate.fun/projects) for upcoming Solana token migrations and sends alerts before they occur.

## Features

- 🔍 Monitors migrate.fun for upcoming migrations
- ⏰ Sends tiered alerts (30min, 15min, 5min before)
- 🎨 Beautiful Discord embeds with urgency colors
- 🔄 Runs on a configurable schedule
- ☁️ Ready for cloud deployment (Railway, Render, Fly.io)

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Step 1: Create a Discord Webhook

1. Open your Discord server settings
2. Go to **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Copy the webhook URL

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Connect this repository
4. Add environment variable:
   - `DISCORD_WEBHOOK_URL` = Your webhook URL from Step 1
5. Railway will automatically deploy!

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHECK_INTERVAL_MINUTES` | 5 | How often to check for migrations |
| `ALERT_THRESHOLD_MINUTES` | 30 | Alert when migration is within this time |

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your Discord webhook URL
# Then start the bot
npm start
```

## Alert System

The bot sends different alerts based on urgency:

| Time Until Migration | Alert Level | Color |
|---------------------|-------------|-------|
| ≤ 5 minutes | 🚨 IMMINENT | Red |
| ≤ 15 minutes | ⚠️ SOON | Orange |
| ≤ 30 minutes | 📢 UPCOMING | Gold |

## Project Structure

```
├── src/
│   ├── index.js      # Main entry point & scheduler
│   ├── scraper.js    # Puppeteer scraper for migrate.fun
│   ├── discord.js    # Discord webhook integration
│   └── tracker.js    # Migration tracking & dedup
├── package.json
├── Procfile          # For Railway/Heroku deployment
└── .env.example      # Environment template
```

## License

MIT
