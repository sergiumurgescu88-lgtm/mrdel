const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/var/www/nemolab-agent/config/fb_cookies.json';
const LOG_PATH = '/var/www/nemolab-agent/logs/outreach.log';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function loadCookies(page) {
    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
        await page.setCookie(...cookies);
    }
}

async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

function log(message) {
    const line = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFileSync(LOG_PATH, line);
    console.log(message);
}

async function getAIPitch(lead) {
    try {
        const res = await axios.post('http://localhost:3001/api/generate-pitch', { leadId: lead.id });
        return res.data.pitch;
    } catch (e) {
        return null;
    }
}

async function facebookDM(lead) {
    if (lead.priority !== 'HIGH') {
        log(`⏭️ SKIP ${lead.name} - scor ${lead.score}`);
        return;
    }
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
        const page = await browser.newPage();
        await loadCookies(page);
        await page.goto('https://facebook.com', { waitUntil: 'networkidle2' });
        
        if (await page.$('input[name="email"]')) {
            log('🔑 Login Facebook...');
            await page.type('input[name="email"]', process.env.FB_EMAIL, { delay: 100 });
            await page.type('input[name="pass"]', process.env.FB_PASSWORD, { delay: 100 });
            await page.click('button[name="login"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            await saveCookies(page);
            log('✅ Login reușit');
        }
        
        await page.goto(lead.facebook_url, { waitUntil: 'networkidle2' });
        await randomDelay(3000, 6000);
        
        const followBtn = await page.$('[aria-label="Follow"], [aria-label="Urmărește"]');
        if (followBtn) {
            await followBtn.click();
            log(`✅ Follow pe ${lead.name}`);
            await randomDelay(2000, 4000);
        }
        
        const msgBtn = await page.$('[aria-label="Message"], [aria-label="Trimite un mesaj"]');
        if (msgBtn) {
            await msgBtn.click();
            await page.waitForSelector('div[role="textbox"]', { timeout: 5000 });
            await randomDelay(2000, 3000);
            
            const pitch = await getAIPitch(lead) || `Salut ${lead.name}! 🤖 Suntem MrDelivery.ro — ajutăm restaurantele cu AI Voice Agents 24/7. Demo gratuit?`;
            await page.type('div[role="textbox"]', pitch, { delay: 50 });
            await randomDelay(1000, 2000);
            await page.keyboard.press('Enter');
            
            lead.status = 'contacted';
            lead.contacted_at = new Date().toISOString();
            lead.pitch_sent = pitch;
            log(`💬 DM trimis către ${lead.name}`);
        }
        
    } catch (err) {
        log(`❌ Eroare FB ${lead.name}: ${err.message}`);
        lead.notes += `Error: ${err.message}; `;
    } finally {
        await browser.close();
    }
}

async function sendEmail(lead) {
    if (!lead.email || lead.priority !== 'HIGH') return;
    
    const pitch = await getAIPitch(lead) || `Salut ${lead.name}! MrDelivery.ro = AI pentru restaurante. Demo gratuit?`;
    
    try {
        await transporter.sendMail({
            from: `"Sergiu - MrDelivery" <${process.env.SMTP_USER}>`,
            to: lead.email,
            subject: `Ai pierdut comenzi azi? - ${lead.name}`,
            text: pitch + '\n\n---\nMrDelivery.ro | AI Voice Agents\nDemo: https://mrdelivery.ro/demo',
            html: `<p>${pitch.replace(/\n/g, '<br>')}</p><hr><p><strong>MrDelivery.ro</strong> | AI pentru restaurante 🚀</p>`
        });
        
        lead.status = 'contacted';
        lead.contacted_at = new Date().toISOString();
        lead.pitch_sent = pitch;
        log(`📧 Email trimis către ${lead.email}`);
        
    } catch (err) {
        log(`❌ Eroare email ${lead.name}: ${err.message}`);
    }
}

function randomDelay(min, max) {
    return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function runOutreach() {
    const leads = JSON.parse(fs.readFileSync('/var/www/nemolab-agent/data/enriched_leads.json'));
    const today = new Date().toDateString();
    
    let counters = { fb_dms: 0, emails: 0, follows: 0 };
    const counterPath = '/var/www/nemolab-agent/config/daily_counters.json';
    if (fs.existsSync(counterPath)) {
        const saved = JSON.parse(fs.readFileSync(counterPath));
        if (saved.date === today) counters = saved;
    }
    
    log(`🚀 Outreach start. FB: ${counters.fb_dms}/${process.env.MAX_DMS_PER_DAY}`);
    
    for (const lead of leads) {
        if (lead.status !== 'new') continue;
        if (counters.fb_dms >= parseInt(process.env.MAX_DMS_PER_DAY)) {
            log('🛑 Limit zilnic atins');
            break;
        }
        
        try {
            if (lead.priority === 'HIGH' && counters.fb_dms < process.env.MAX_DMS_PER_DAY) {
                await facebookDM(lead);
                counters.fb_dms++;
                counters.follows++;
            } else if (lead.email && counters.emails < 10) {
                await sendEmail(lead);
                counters.emails++;
            }
            
            fs.writeFileSync('/var/www/nemolab-agent/data/enriched_leads.json', JSON.stringify(leads, null, 2));
            await randomDelay(300000, 900000); // 5-15 min
            
        } catch (err) {
            log(`❌ Eroare: ${err.message}`);
        }
    }
    
    counters.date = today;
    fs.writeFileSync(counterPath, JSON.stringify(counters));
    log('✅ Outreach completat');
}

runOutreach().catch(console.error);
