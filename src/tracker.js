/**
 * Migration tracker
 * Tracks seen migrations and determines when to send alerts
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SEEN_FILE = path.join(DATA_DIR, 'seen_migrations.json');

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load seen migrations from file
 */
function loadSeenMigrations() {
    ensureDataDir();
    try {
        if (fs.existsSync(SEEN_FILE)) {
            const data = fs.readFileSync(SEEN_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Tracker] Error loading seen migrations:', error.message);
    }
    return {};
}

/**
 * Save seen migrations to file
 */
function saveSeenMigrations(seen) {
    ensureDataDir();
    try {
        fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
    } catch (error) {
        console.error('[Tracker] Error saving seen migrations:', error.message);
    }
}

/**
 * Track which migrations we've already alerted about
 * Returns migrations that need alerts
 * 
 * @param {Array} migrations - All current migrations
 * @param {number} thresholdMinutes - Alert when within this many minutes
 * @returns {Array} Migrations that need alerts
 */
function getMigrationsToAlert(migrations, thresholdMinutes = 30) {
    const seen = loadSeenMigrations();
    const now = Date.now();
    const toAlert = [];

    for (const migration of migrations) {
        // Skip debug/page content entries
        if (migration.debug) continue;

        const id = migration.id || migration.address || migration.name;
        if (!id) continue;

        const minutesUntil = migration.minutesUntil;

        // Only alert if we know when the migration is happening
        if (minutesUntil === null || minutesUntil === undefined) continue;

        // Only alert if within threshold
        if (minutesUntil > thresholdMinutes) continue;

        // Determine alert tier (we alert at different thresholds)
        const alertTier = minutesUntil <= 5 ? 'imminent' :
            minutesUntil <= 15 ? 'soon' :
                minutesUntil <= 30 ? 'upcoming' : 'scheduled';

        const alertKey = `${id}_${alertTier}`;

        // Check if we've already sent this tier of alert
        if (seen[alertKey]) {
            const lastAlert = seen[alertKey];
            // Don't re-alert for the same tier within 10 minutes
            if (now - lastAlert < 10 * 60 * 1000) continue;
        }

        // Mark as seen
        seen[alertKey] = now;

        toAlert.push({
            ...migration,
            alertTier,
            minutesUntil
        });
    }

    // Clean up old entries (older than 24 hours)
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const key of Object.keys(seen)) {
        if (seen[key] < oneDayAgo) {
            delete seen[key];
        }
    }

    saveSeenMigrations(seen);

    return toAlert;
}

/**
 * Clear all tracking data (for testing)
 */
function clearTracking() {
    ensureDataDir();
    if (fs.existsSync(SEEN_FILE)) {
        fs.unlinkSync(SEEN_FILE);
    }
}

module.exports = { getMigrationsToAlert, clearTracking, loadSeenMigrations };
