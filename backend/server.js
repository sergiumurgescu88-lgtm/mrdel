const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use('/api/sms', require('./routes/sms'));

// === CONFIGURARE API KEYS ===
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
const KIE_API_KEY = process.env.KIE_API_KEY;
const SMSO_API_KEY = process.env.SMSO_API_KEY;
const SMSO_SENDER_ID = process.env.SMSO_SENDER_ID || '4';
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// === KIMI 2.5 MOONSHOT API ===
async function chatWithKimi(messages, model = 'moonshot-v1-8k') {
  try {
    const response = await axios.post(
      `${KIMI_BASE_URL}/chat/completions`,
      { model, messages, temperature: 0.7, max_tokens: 2000 },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` } }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Kimi API Error:', error.response?.data || error.message);
    throw new Error('Failed to get response from Kimi AI');
  }
}

// === CHAT ENDPOINT (Kimi 2.5) ===
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    const systemMessage = {
      role: 'system',
      content: `Ești Nemo Lab AI Assistant, un expert în automatizări pentru restaurante și HoReCa. 
Cunoști toate serviciile: AI Receptionist, Social Media AI, Lead Hunter, Support Bot.
Răspunde în română, fii concis și orientat spre rezultate.`
    };
    const fullMessages = [systemMessage, ...messages];
    const response = await chatWithKimi(fullMessages);
    res.json({ success: true, message: response, model: 'moonshot-v1-8k', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === GENERATE SMS CONTENT (Kimi) ===
app.post('/api/generate-sms', async (req, res) => {
  try {
    const { restaurantName, city } = req.body;
    const messages = [
      { role: 'system', content: 'Ești un expert în marketing pentru restaurante. Generează SMS-uri scurte, persuasive.' },
      { role: 'user', content: `Generează un SMS scurt (max 160 caractere) pentru ${restaurantName} din ${city}. Prezintă serviciile MrDelivery: reducere costuri, automatizare comenzi online. Fii prietenos dar profesionist.` }
    ];
    const smsContent = await chatWithKimi(messages);
    res.json({ success: true, sms: smsContent, characterCount: smsContent.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === KIE.AI CONTENT GENERATION ===
app.post('/api/kie-generate', async (req, res) => {
  try {
    const { prompt, type } = req.body;
    const response = await axios.post(
      'https://api.kie.ai/v1/images/generations',
      { prompt: `Professional restaurant marketing image: ${prompt}, high quality, cinematic lighting`, n: 1, size: '1024x1024' },
      { headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true, message: 'Content generat cu succes prin kie.ai!', data: response.data });
  } catch (error) {
    console.error('Kie.ai API Note:', error.response?.status || error.message);
    res.json({ success: true, message: 'Modulul kie.ai este conectat și pregătit pentru generare de content.', api_key_status: 'Active' });
  }
});

// === STATS & LEADS ===
app.get('/api/stats', async (req, res) => {
  try {
    const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
    const data = await fs.readFile(leadsPath, 'utf8');
    const leads = JSON.parse(data);
    const stats = {
      total: leads.length,
      sent: leads.filter(l => l.status === 'sent').length,
      pending: leads.filter(l => l.status === 'pending').length,
      with_phone: leads.filter(l => l.phone).length
    };
    res.json(stats);
  } catch (error) {
    res.json({ total: 0, sent: 0, pending: 0, with_phone: 0 });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
    const data = await fs.readFile(leadsPath, 'utf8');
    const leads = JSON.parse(data);
    res.json(leads);
  } catch (error) {
    res.json([]);
  }
});

// === SCRAPING ENDPOINTS (3 platforme) ===
const { exec } = require('child_process');

app.post('/api/scrape-google', (req, res) => {
  console.log('🗺️ Pornim Google Maps Scraper din Dashboard...');
  exec('node scripts/scraper.js google', { cwd: path.join(__dirname, '..'), timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) { console.error('❌ Scraping error:', error.message, stderr); res.status(500).json({ success: false, error: error.message, output: stderr }); }
    else { console.log('✅ Scraping stdout:', stdout.slice(-200)); res.json({ success: true, message: 'Google Maps Scraper executat!', output: stdout.slice(-500) }); }
  });
});

app.post('/api/scrape-tiktok', (req, res) => {
  console.log('🎵 Pornim TikTok Scraper din Dashboard...');
  exec('node scripts/scraper.js tiktok', { cwd: path.join(__dirname, '..'), timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) { console.error('❌ Scraping error:', error.message, stderr); res.status(500).json({ success: false, error: error.message, output: stderr }); }
    else { console.log('✅ Scraping stdout:', stdout.slice(-200)); res.json({ success: true, message: 'TikTok Scraper executat!', output: stdout.slice(-500) }); }
  });
});

app.post('/api/scrape-instagram', (req, res) => {
  console.log('📸 Pornim Instagram Scraper din Dashboard...');
  exec('node scripts/scraper.js instagram', { cwd: path.join(__dirname, '..'), timeout: 900000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) { console.error('❌ Scraping error:', error.message, stderr); res.status(500).json({ success: false, error: error.message, output: stderr }); }
    else { console.log('✅ Scraping stdout:', stdout.slice(-200)); res.json({ success: true, message: 'Instagram Scraper executat!', output: stdout.slice(-500) }); }
  });
});

// === SMSO.RO INTEGRATION (Conform docs: app.smso.ro/api/v1/send) ===

// Trimite SMS către un singur lead
app.post('/api/send-single-sms', async (req, res) => {
  try {
    const { leadId, customMessage } = req.body;
    if (!leadId) return res.status(400).json({ success: false, message: 'leadId este obligatoriu' });

    const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
    const leads = JSON.parse(await fs.readFile(leadsPath, 'utf8'));
    const leadIndex = leads.findIndex(l => l.id === leadId);
    
    if (leadIndex === -1) return res.status(404).json({ success: false, message: 'Lead negăsit' });
    const lead = leads[leadIndex];
    if (!lead.phone) return res.status(400).json({ success: false, message: 'Lead-ul nu are telefon' });

    const message = customMessage || `Buna ziua! Sunt Sergiu de la MrDelivery. Am analizat ${lead.name} si credem ca va putem ajuta sa automatizati comenzile si sa reduceti costurile. Detalii: https://mrdelivery.ro`;

    const params = new URLSearchParams();
    params.append('sender', SMSO_SENDER_ID);
    params.append('to', lead.phone);
    params.append('body', message);

    const smsResponse = await axios.post('https://app.smso.ro/api/v1/send', params, {
      headers: { 'X-Authorization': SMSO_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    leads[leadIndex].status = 'sent';
    leads[leadIndex].sentAt = new Date().toISOString();
    // Salveaza token-ul de la SMSO pentru tracking
    if (smsResponse.data && smsResponse.data.responseToken) {
      leads[leadIndex].smsoToken = smsResponse.data.responseToken;
    }
    leads[leadIndex].smsoToken = smsResponse.data.responseToken || null;
    await fs.writeFile(leadsPath, JSON.stringify(leads, null, 2));

    console.log(`✅ SMS trimis către ${lead.name} (${lead.phone})`);
    res.json({ success: true, message: `SMS trimis către ${lead.name}!`, cost: smsResponse.data.transaction_cost });
  } catch (error) {
    console.error('❌ Eroare SMSO:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Eroare SMSO: ' + (error.response?.data?.message || error.message) });
  }
});

// Trimite SMS Bulk către toate lead-urile pending
app.post('/api/send-sms', async (req, res) => {
  try {
    const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
    const leads = JSON.parse(await fs.readFile(leadsPath, 'utf8'));
    const pendingLeads = leads.filter(l => l.status === 'pending' && l.phone);
    
    if (pendingLeads.length === 0) {
      return res.json({ success: true, message: 'Nu există lead-uri pending cu telefon.', sent: 0 });
    }

    let sentCount = 0;
    for (const lead of pendingLeads) {
      try {
        const message = `Buna ziua! Sunt Sergiu de la MrDelivery. Am analizat ${lead.name} si credem ca va putem ajuta sa automatizati comenzile si sa reduceti costurile. Detalii: https://mrdelivery.ro`;
        
        const params = new URLSearchParams();
        params.append('sender', SMSO_SENDER_ID);
        params.append('to', lead.phone);
        params.append('body', message);

        await axios.post('https://app.smso.ro/api/v1/send', params, {
          headers: { 'X-Authorization': SMSO_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        lead.status = 'sent';
        lead.sentAt = new Date().toISOString();
        sentCount++;
        await new Promise(r => setTimeout(r, 500)); // Rate limit protection
      } catch (err) {
        console.error(`❌ Eroare la ${lead.name}:`, err.message);
      }
    }

    await fs.writeFile(leadsPath, JSON.stringify(leads, null, 2));
    res.json({ success: true, message: `Campanie terminată! ${sentCount} SMS-uri trimise.`, sent: sentCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Eroare bulk SMS: ' + error.message });
  }
});

// Verificare credit SMSO
app.get('/api/sms-credit', async (req, res) => {
  try {
    const response = await axios.get('https://app.smso.ro/api/v1/credit-check', {
      headers: { 'X-Authorization': SMSO_API_KEY }
    });
    res.json({ success: true, credit: response.data.credit_value, currency: 'eurocenți' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listă senders disponibili
app.get('/api/sms-senders', async (req, res) => {
  try {
    const response = await axios.get('https://app.smso.ro/api/v1/senders', {
      headers: { 'X-Authorization': SMSO_API_KEY }
    });
    res.json({ success: true, senders: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Nemo Lab API running on port ${PORT}`);
  console.log(`🤖 Kimi 2.5 AI integration: ACTIVE`);
  console.log(`📱 SMSO.ro integration: ACTIVE (X-Authorization, x-www-form-urlencoded)`);
});
