/**
 * Puppeteer-based scraper for migrate.fun
 * Extracts upcoming migration data from the projects page
 */

const puppeteer = require('puppeteer');

const MIGRATE_FUN_URL = 'https://migrate.fun/projects';

/**
 * Launch browser with appropriate settings for the environment
 */
async function launchBrowser() {
    const isProduction = process.env.NODE_ENV === 'production';

    return puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
        ],
        // Use system Chrome on Railway
        ...(isProduction && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable' })
    });
}

/**
 * Scrape migration projects from migrate.fun
 * @returns {Promise<Array>} Array of migration objects
 */
async function scrape() {
    console.log(`[Scraper] Starting scrape at ${new Date().toISOString()}`);

    let browser;
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to projects page
        await page.goto(MIGRATE_FUN_URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for content to load (adjust selector based on actual page structure)
        await page.waitForSelector('body', { timeout: 30000 });

        // Give extra time for JS to render
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Extract migration data from the page
        const migrations = await page.evaluate(() => {
            const results = [];

            // Try to find project cards/items on the page
            // These selectors may need adjustment based on actual page structure
            const projectElements = document.querySelectorAll('[class*="project"], [class*="card"], [class*="migration"], [class*="token"]');

            projectElements.forEach((el, index) => {
                const text = el.innerText || el.textContent || '';

                // Extract any visible data
                const nameMatch = text.match(/([A-Z]{2,10})/);
                const timeMatch = text.match(/(\d+[hms]|\d+:\d+|\d+ (hour|minute|second|day)s?)/i);
                const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

                if (text.length > 10) {
                    results.push({
                        id: addressMatch ? addressMatch[0] : `unknown-${index}`,
                        name: nameMatch ? nameMatch[1] : `Token ${index + 1}`,
                        rawText: text.substring(0, 500),
                        address: addressMatch ? addressMatch[0] : null,
                        timeText: timeMatch ? timeMatch[0] : null,
                        element: el.className,
                        scrapedAt: new Date().toISOString()
                    });
                }
            });

            // Also try to extract from any visible countdown timers
            const countdowns = document.querySelectorAll('[class*="countdown"], [class*="timer"], [class*="time"]');
            countdowns.forEach((el, index) => {
                const text = el.innerText || '';
                if (text.match(/\d/) && !results.some(r => r.rawText.includes(text))) {
                    results.push({
                        id: `countdown-${index}`,
                        name: `Countdown ${index + 1}`,
                        rawText: text,
                        timeText: text,
                        scrapedAt: new Date().toISOString()
                    });
                }
            });

            // If nothing found with specific selectors, grab all text content for debugging
            if (results.length === 0) {
                const bodyText = document.body.innerText || '';
                results.push({
                    id: 'page-content',
                    name: 'Page Content',
                    rawText: bodyText.substring(0, 2000),
                    debug: true,
                    scrapedAt: new Date().toISOString()
                });
            }

            return results;
        });

        console.log(`[Scraper] Found ${migrations.length} items`);
        return migrations;

    } catch (error) {
        console.error('[Scraper] Error:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Parse time string to minutes until migration
 * @param {string} timeText - Time string like "30m", "2h", "1:30:00"
 * @returns {number|null} Minutes until migration
 */
function parseTimeToMinutes(timeText) {
    if (!timeText) return null;

    // Match patterns like "30m", "2h", "45s"
    const shortMatch = timeText.match(/(\d+)\s*(h|m|s)/i);
    if (shortMatch) {
        const value = parseInt(shortMatch[1]);
        const unit = shortMatch[2].toLowerCase();
        switch (unit) {
            case 'h': return value * 60;
            case 'm': return value;
            case 's': return Math.ceil(value / 60);
        }
    }

    // Match patterns like "2 hours", "30 minutes"
    const longMatch = timeText.match(/(\d+)\s*(hour|minute|second|day)/i);
    if (longMatch) {
        const value = parseInt(longMatch[1]);
        const unit = longMatch[2].toLowerCase();
        switch (unit) {
            case 'day': return value * 24 * 60;
            case 'hour': return value * 60;
            case 'minute': return value;
            case 'second': return Math.ceil(value / 60);
        }
    }

    // Match HH:MM:SS format
    const clockMatch = timeText.match(/(\d+):(\d+):?(\d+)?/);
    if (clockMatch) {
        const hours = parseInt(clockMatch[1]) || 0;
        const minutes = parseInt(clockMatch[2]) || 0;
        return hours * 60 + minutes;
    }

    return null;
}

module.exports = { scrape, parseTimeToMinutes, launchBrowser };
