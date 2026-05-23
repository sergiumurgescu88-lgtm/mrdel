const cron = require('node-cron');
const { exec } = require('child_process');

console.log('🕐 MrDelivery Scheduler pornit...');

cron.schedule('0 3 * * *', () => {
    console.log('⏰ [03:00] Scraping...');
    exec('node /var/www/nemolab-agent/scripts/scraper.js');
});

cron.schedule('30 3 * * *', () => {
    console.log('⏰ [03:30] Enrichment...');
    exec('node /var/www/nemolab-agent/scripts/enrich.js');
});

cron.schedule('0 10 * * *', () => {
    console.log('⏰ [10:00] Outreach...');
    exec('node /var/www/nemolab-agent/scripts/outreach.js');
});

console.log('✅ Program: 03:00 Scrape | 03:30 Enrich | 10:00 Outreach');
