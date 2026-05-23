const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

async function sendBulkSMS() {
  console.log('📱 Încep trimitere SMS prin SMSO.ro (Docs: app.smso.ro/api/v1/send)...');
  
  const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
  const leads = JSON.parse(await fs.readFile(leadsPath, 'utf8'));
  
  const pendingLeads = leads.filter(l => l.status === 'pending' && l.phone);
  console.log(`🎯 Am găsit ${pendingLeads.length} lead-uri pending cu telefon.`);
  
  if (pendingLeads.length === 0) {
    console.log('ℹ️ Nu există lead-uri pending.');
    return;
  }

  const SMSO_API_KEY = process.env.SMSO_API_KEY;
  const SMSO_SENDER_ID = process.env.SMSO_SENDER_ID || '4';
  let sentCount = 0;

  for (const lead of pendingLeads) {
    try {
      const message = `Buna ziua! Sunt Sergiu de la MrDelivery. Am analizat ${lead.name} si credem ca va putem ajuta sa automatizati comenzile si sa reduceti costurile. Detalii: https://mrdelivery.ro`;
      
      const params = new URLSearchParams();
      params.append('sender', SMSO_SENDER_ID);
      params.append('to', lead.phone);
      params.append('body', message);

      const response = await axios.post('https://app.smso.ro/api/v1/send', params, {
        headers: {
          'X-Authorization': SMSO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      lead.status = 'sent';
      lead.sentAt = new Date().toISOString();
      lead.smsoToken = response.data.responseToken;
      sentCount++;
      
      console.log(`✅ SMS trimis către ${lead.name} (${lead.phone}) - Cost: ${response.data.transaction_cost} eurocenți`);
      
      // Mic pauza pentru a nu depasi limita de rate (409 Too Many Requests)
      await new Promise(r => setTimeout(r, 500)); 
      
    } catch (error) {
      console.error(`❌ Eroare la ${lead.name}:`, error.response?.data || error.message);
    }
  }

  await fs.writeFile(leadsPath, JSON.stringify(leads, null, 2));
  console.log(`\n🎉 Campanie terminată! ${sentCount} SMS-uri trimise cu succes.`);
}

sendBulkSMS();
