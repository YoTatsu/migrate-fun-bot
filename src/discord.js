/**
 * Discord webhook integration
 * Sends formatted embed messages about upcoming migrations
 */

const https = require('https');
const http = require('http');

/**
 * Send a message to Discord via webhook
 * @param {string} webhookUrl - Discord webhook URL
 * @param {Object} payload - Message payload
 */
async function sendWebhookMessage(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(webhookUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const data = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, statusCode: res.statusCode });
                } else {
                    reject(new Error(`Discord API error: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Send a migration alert to Discord
 * @param {string} webhookUrl - Discord webhook URL
 * @param {Object} migration - Migration data
 * @param {number} minutesUntil - Minutes until migration
 */
async function sendMigrationAlert(webhookUrl, migration, minutesUntil) {
    const urgencyColor = minutesUntil <= 5 ? 0xFF0000 : // Red - imminent
        minutesUntil <= 15 ? 0xFF8C00 : // Orange - soon
            minutesUntil <= 30 ? 0xFFD700 : // Gold - upcoming
                0x00FF00; // Green - scheduled

    const urgencyLabel = minutesUntil <= 5 ? '🚨 IMMINENT' :
        minutesUntil <= 15 ? '⚠️ SOON' :
            minutesUntil <= 30 ? '📢 UPCOMING' :
                '📅 SCHEDULED';

    const embed = {
        title: `${urgencyLabel} Migration: ${migration.name || 'Unknown Token'}`,
        description: `A Solana token migration is approaching!`,
        color: urgencyColor,
        fields: [
            {
                name: '⏰ Time Until Migration',
                value: formatTimeUntil(minutesUntil),
                inline: true
            }
        ],
        footer: {
            text: 'Migrate.fun Alert Bot'
        },
        timestamp: new Date().toISOString()
    };

    // Add token address if available
    if (migration.address) {
        embed.fields.push({
            name: '📍 Token Address',
            value: `\`${migration.address}\``,
            inline: false
        });
        embed.fields.push({
            name: '🔗 Links',
            value: `[Migrate.fun](https://migrate.fun/projects) • [Solscan](https://solscan.io/token/${migration.address})`,
            inline: false
        });
    } else {
        embed.fields.push({
            name: '🔗 View on Migrate.fun',
            value: '[Go to Projects](https://migrate.fun/projects)',
            inline: false
        });
    }

    // Add raw info for debugging if needed
    if (migration.rawText && migration.rawText.length < 200) {
        embed.fields.push({
            name: '📝 Details',
            value: migration.rawText.substring(0, 200),
            inline: false
        });
    }

    const payload = {
        embeds: [embed]
    };

    console.log(`[Discord] Sending alert for ${migration.name} (${minutesUntil}min until migration)`);
    return sendWebhookMessage(webhookUrl, payload);
}

/**
 * Send a startup notification
 */
async function sendStartupNotification(webhookUrl) {
    const payload = {
        embeds: [{
            title: '🚀 Migration Alert Bot Started',
            description: 'Now monitoring migrate.fun for upcoming Solana token migrations.',
            color: 0x5865F2,
            fields: [
                {
                    name: '⚙️ Check Interval',
                    value: `Every ${process.env.CHECK_INTERVAL_MINUTES || 5} minutes`,
                    inline: true
                },
                {
                    name: '🔔 Alert Threshold',
                    value: `${process.env.ALERT_THRESHOLD_MINUTES || 30} minutes before`,
                    inline: true
                }
            ],
            footer: {
                text: 'Migrate.fun Alert Bot'
            },
            timestamp: new Date().toISOString()
        }]
    };

    return sendWebhookMessage(webhookUrl, payload);
}

/**
 * Send an error notification
 */
async function sendErrorNotification(webhookUrl, error) {
    const payload = {
        embeds: [{
            title: '❌ Bot Error',
            description: `An error occurred: ${error.message}`,
            color: 0xFF0000,
            footer: {
                text: 'Migrate.fun Alert Bot'
            },
            timestamp: new Date().toISOString()
        }]
    };

    return sendWebhookMessage(webhookUrl, payload).catch(console.error);
}

/**
 * Format minutes into readable time
 */
function formatTimeUntil(minutes) {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${Math.round(minutes)} minute${minutes !== 1 ? 's' : ''}`;

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
}

module.exports = {
    sendMigrationAlert,
    sendStartupNotification,
    sendErrorNotification,
    sendWebhookMessage
};
