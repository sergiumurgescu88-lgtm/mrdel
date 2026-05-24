const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'dashboard-react', 'dist')));

// === SMSO CONFIG ===
const SMSO_API_KEY = process.env.SMSSO_API_KEY || process.env.SMSSO_TOKEN;

// === HELPER: SMSService ===
class SMSService {
  constructor() {
    this.apiUrl = 'https://app.smso.ro/api/v1/send';
    this.creditUrl = 'https://app.smso.ro/api/v1/credit';
  }

  async checkCredit() {
    if (!SMSO_API_KEY) return { success: false, error: 'API key missing', credit: 0, messagesRemaining: 0 };
    try {
      const res = await axios.get(this.creditUrl, {
        headers: { 'X-Authorization': SMSO_API_KEY, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      const credit = res.data.credit || 0;
      return { success: true, credit, currency: res.data.currency || 'RON', messagesRemaining: Math.floor(credit / 0.05) };
    } catch (e) {
      return { success: false, error: e.message, credit: 0, messagesRemaining: 0, statusCode: e.response?.status };
    }
  }

  generateMessage(lead) {
    return `Buna ziua! Sunt Sergiu de la MrDelivery. Am analizat ${lead.name || 'restaurantul dvs'} si credem ca va putem ajuta sa automatizati comenzile si sa reduceti costurile. Detalii: https://mrdelivery.ro | Tel: 0768 676 141`;
  }

  normalizePhone(phone) {
    if (!phone) return null;
    let p = phone.replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('07')) p = '+40' + p.substring(1);
    if (p.startsWith('0040')) p = '+40' + p.substring(4);
    return (p.startsWith('+40') && p.length === 13 && /^[\d+]+$/.test(p)) ? p : null;
  }

  async sendSMS(phone, message) {
    if (!SMSO_API_KEY) return { success: false, error: 'API key missing', phone };
    const credit = await this.checkCredit();
    if (!credit.success) return { success: false, error: `Credit check failed: ${credit.error}`, phone };
    if (credit.messagesRemaining < 1) return { success: false, error: `Insufficient credit: ${credit.credit} ${credit.currency}`, phone };
    const normalized = this.normalizePhone(phone);
    if (!normalized) return { success: false, error: 'Invalid phone format', phone };
    try {
      const params = new URLSearchParams();
      params.append('sender', 'MrDelivery');
      params.append('to', normalized);
      params.append('body', message);
      const res = await axios.post(this.apiUrl, params, {
        headers: { 'X-Authorization': SMSO_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });
      return { success: true, messageId: res.data.id, phone: normalized, creditRemaining: credit.credit - 0.05 };
    } catch (e) {
      return { success: false, error: e.response?.data?.message || e.message, phone: normalized, statusCode: e.response?.status };
    }
  }
}
const smsService = new SMSService();

// === API ENDPOINTS ===

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const leads = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'leads.json'), 'utf8'));
    res.json({
      total: leads.length,
      sent: leads.filter(l => l.status === 'sent').length,
      pending: leads.filter(l => l.status === 'pending').length,
      with_phone: leads.filter(l => {
        const p = (l.phone || '').replace(/[\s\-\(\)]/g, '');
        return p.startsWith('+407') || p.startsWith('07') || p.startsWith('00407') || p.startsWith('407');
      }).length
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leads list
app.get('/api/leads', async (req, res) => {
  try {
    const leads = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'leads.json'), 'utf8'));
    res.json(leads);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Scrape progress
app.get('/api/scrape-progress', async (req, res) => {
  try {
    const progress = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'scrape_progress.json'), 'utf8'));
    res.json(progress);
  } catch (e) { res.json({ completed_combinations: [], last_run: null, total_scraped: 0 }); }
});

// === SCRAPING ENDPOINTS ===

function runScraper(script, args, res) {
  const cwd = path.join(__dirname, '..');
  exec(`node scripts/scraper.js ${script} ${args}`, { cwd, timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) { console.error('❌ Scraping error:', error.message, stderr); res.status(500).json({ success: false, error: error.message }); }
    else { console.log('✅ Scraping done:', stdout.slice(-200)); res.json({ success: true, message: 'Scraping completed!', output: stdout.slice(-500) }); }
  });
}

app.post('/api/scrape-google', (req, res) => {
  const { searches } = req.body;
  
  // RĂSPUNS IMEDIAT către client (HTTP 202 Accepted)
  res.status(202).json({ 
    success: true, 
    message: 'Scraping pornit în background', 
    searchesCount: searches?.length || 0 
  });
  
  // Scraping-ul rulează ASINCRON în background
  const cwd = path.join(__dirname, '..');
  if (searches && Array.isArray(searches) && searches.length > 0) {
    console.log(`🗺️ Custom scraping (background): ${searches.length} searches`);
    const tmpFile = path.join(__dirname, '..', 'data', 'tmp_searches.json');
    fs.writeFileSync(tmpFile, JSON.stringify(searches));
    exec(`node scripts/scraper.js google --custom`, { cwd, timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch(e) {}
      if (error) console.error('❌ Scraping error:', error.message);
      else console.log('✅ Google scraping finalizat:', stdout.slice(-200));
    });
  } else {
    console.log('🗺️ Default Google scraping (background)');
    exec('node scripts/scraper.js google', { cwd, timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) console.error('❌ Scraping error:', error.message);
      else console.log('✅ Google scraping finalizat:', stdout.slice(-200));
    });
  }
});

app.post('/api/scrape-tiktok', (req, res) => {
  console.log('🎵 TikTok scraping');
  runScraper('tiktok', '', res);
});

app.post('/api/scrape-instagram', (req, res) => {
  console.log('📸 Instagram scraping');
  runScraper('instagram', '', res);
});

// === SMS ENDPOINTS ===

app.get('/api/sms/credit', async (req, res) => {
  const credit = await smsService.checkCredit();
  res.json(credit);
});

app.post('/api/sms/send', async (req, res) => {
  const { leadId, message } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });
  try {
    const leads = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'leads.json'), 'utf8'));
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const smsMsg = message || smsService.generateMessage(lead);
    const result = await smsService.sendSMS(lead.phone, smsMsg);
    if (result.success) {
      lead.status = 'sent';
      lead.sentAt = new Date().toISOString();
      fs.writeFileSync(path.join(__dirname, '..', 'data', 'leads.json'), JSON.stringify(leads, null, 2));
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sms/send-bulk', async (req, res) => {
  const { leadIds, message } = req.body;
  if (!leadIds || !Array.isArray(leadIds)) return res.status(400).json({ error: 'leadIds array required' });
  try {
    const leads = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'leads.json'), 'utf8'));
    const targets = leads.filter(l => leadIds.includes(l.id) && l.status === 'pending');
    const results = [];
    for (const lead of targets) {
      const smsMsg = message || smsService.generateMessage(lead);
      const r = await smsService.sendSMS(lead.phone, smsMsg);
      if (r.success) { lead.status = 'sent'; lead.sentAt = new Date().toISOString(); }
      results.push({ id: lead.id, ...r });
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
    }
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'leads.json'), JSON.stringify(leads, null, 2));
    const sent = results.filter(r => r.success).length;
    res.json({ success: true, sent, total: targets.length, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sms-senders', async (req, res) => {
  try {
    const r = await axios.get('https://app.smso.ro/api/v1/senders', { headers: { 'X-Authorization': SMSO_API_KEY } });
    res.json({ success: true, senders: r.data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard-react', 'dist', 'index.html'));
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Nemo Lab API running on port ${PORT}`);
  console.log(`🤖 Kimi 2.5 AI integration: ACTIVE`);
  console.log(`📱 SMSO.ro integration: ACTIVE`);
});
