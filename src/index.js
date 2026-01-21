/**
 * Migrate.fun Discord Alert Bot
 * Main entry point - schedules periodic checks and sends Discord alerts
 */

require('dotenv').config();
const cron = require('node-cron');
const { scrape, parseTimeToMinutes } = require('./scraper');
const { sendMigrationAlert, sendStartupNotification, sendErrorNotification } = require('./discord');
const { getMigrationsToAlert } = require('./tracker');

// Configuration
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5;
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD_MINUTES) || 30;

/**
 * Main check function - scrapes and sends alerts
 */
async function checkMigrations() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[Main] Checking migrations at ${new Date().toISOString()}`);
    console.log(`${'='.repeat(50)}`);

    try {
        // Scrape current migrations
        const rawMigrations = await scrape();

        // Parse time information and add minutesUntil
        const migrations = rawMigrations.map(m => ({
            ...m,
            minutesUntil: parseTimeToMinutes(m.timeText)
        }));

        console.log(`[Main] Found ${migrations.length} migration items`);

        // Log what we found
        migrations.forEach(m => {
            if (!m.debug) {
                console.log(`  - ${m.name}: ${m.minutesUntil !== null ? `${m.minutesUntil} min` : 'unknown time'}`);
            }
        });

        // Get migrations that need alerts
        const toAlert = getMigrationsToAlert(migrations, ALERT_THRESHOLD);

        console.log(`[Main] Sending ${toAlert.length} alert(s)`);

        // Send alerts
        for (const migration of toAlert) {
            try {
                await sendMigrationAlert(DISCORD_WEBHOOK_URL, migration, migration.minutesUntil);
                console.log(`[Main] ✓ Sent alert for ${migration.name}`);

                // Small delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[Main] ✗ Failed to send alert for ${migration.name}:`, error.message);
            }
        }

    } catch (error) {
        console.error('[Main] Error during check:', error.message);
        await sendErrorNotification(DISCORD_WEBHOOK_URL, error);
    }
}

/**
 * Start the bot
 */
async function start() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║          Migrate.fun Discord Alert Bot                  ║
╠══════════════════════════════════════════════════════════╣
║  Monitoring: https://migrate.fun/projects               ║
║  Check Interval: Every ${CHECK_INTERVAL} minutes                       ║
║  Alert Threshold: ${ALERT_THRESHOLD} minutes before migration           ║
╚══════════════════════════════════════════════════════════╝
  `);

    // Validate webhook URL
    if (!DISCORD_WEBHOOK_URL || !DISCORD_WEBHOOK_URL.includes('discord.com/api/webhooks')) {
        console.error('ERROR: Invalid or missing DISCORD_WEBHOOK_URL in .env file');
        console.error('Please set DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN');
        process.exit(1);
    }

    // Send startup notification
    try {
        await sendStartupNotification(DISCORD_WEBHOOK_URL);
        console.log('[Main] ✓ Startup notification sent to Discord');
    } catch (error) {
        console.error('[Main] ✗ Failed to send startup notification:', error.message);
        console.error('Please check your DISCORD_WEBHOOK_URL');
        process.exit(1);
    }

    // Run initial check
    await checkMigrations();

    // Schedule periodic checks
    const cronExpression = `*/${CHECK_INTERVAL} * * * *`;
    console.log(`\n[Main] Scheduling checks with cron: ${cronExpression}`);

    cron.schedule(cronExpression, () => {
        checkMigrations().catch(console.error);
    });

    console.log('[Main] Bot is now running. Press Ctrl+C to stop.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Main] Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Main] Received SIGTERM, shutting down...');
    process.exit(0);
});

// Start the bot
start().catch(error => {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
});
