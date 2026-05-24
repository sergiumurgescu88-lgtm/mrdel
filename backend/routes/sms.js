const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const smsService = require('../services/smsService');

/**
 * GET /api/sms/check-credit
 * Verifică creditul disponibil
 */
router.get('/check-credit', async (req, res) => {
  try {
    const credit = await smsService.checkCredit();
    res.json(credit);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sms/send
 * Trimite SMS către un lead
 */
router.post('/send', async (req, res) => {
  try {
    const { leadId, message } = req.body;

    if (!leadId || !message) {
      return res.status(400).json({
        success: false,
        error: 'leadId și message sunt obligatorii'
      });
    }

    // Încărcăm lead-urile
    const leadsPath = path.join(__dirname, '../../data/leads.json');
    const leads = JSON.parse(await fs.readFile(leadsPath, 'utf8'));
    
    const lead = leads.find(l => l.id === leadId);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead-ul nu a fost găsit'
      });
    }

    if (!lead.phone) {
      return res.status(400).json({
        success: false,
        error: 'Lead-ul nu are număr de telefon'
      });
    }

    // Trimitem SMS
    const smsMessage = smsService.generateMessage(lead);
    const result = await smsService.sendSMS(lead.phone, smsMessage);

    if (result.success) {
      // Actualizăm status-ul lead-ului
      lead.status = 'sent';
      lead.sentAt = new Date().toISOString();
      
      await fs.writeFile(leadsPath, JSON.stringify(leads, null, 2));
      
      return res.json({
        success: true,
        message: 'SMS trimis cu succes',
        messageId: result.messageId,
        phone: result.phone,
        creditRemaining: result.creditRemaining
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        phone: result.phone,
        statusCode: result.statusCode
      });
    }
  } catch (error) {
    console.error('❌ Eroare trimitere SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sms/bulk
 * Trimite SMS în bulk către mai multe lead-uri
 */
router.post('/bulk', async (req, res) => {
  try {
    const { leadIds, message } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || !message) {
      return res.status(400).json({
        success: false,
        error: 'leadIds (array) și message sunt obligatorii'
      });
    }

    // Încărcăm lead-urile
    const leadsPath = path.join(__dirname, '../../data/leads.json');
    const allLeads = JSON.parse(await fs.readFile(leadsPath, 'utf8'));
    
    const leadsToSend = allLeads.filter(l => leadIds.includes(l.id) && l.phone);

    if (leadsToSend.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Niciun lead valid găsit cu număr de telefon'
      });
    }

    // Verificăm creditul înainte
    const creditCheck = await smsService.checkCredit();
    if (!creditCheck.success) {
      return res.status(400).json({
        success: false,
        error: `Nu pot verifica creditul: ${creditCheck.error}`
      });
    }

    if (creditCheck.messagesRemaining < leadsToSend.length) {
      return res.status(400).json({
        success: false,
        error: `Credit insuficient! Ai ${creditCheck.messagesRemaining} mesaje disponibile, dar ai cerut ${leadsToSend.length}`,
        credit: creditCheck.credit,
        messagesRemaining: creditCheck.messagesRemaining
      });
    }

    // Trimitem SMS în bulk
    const result = await smsService.sendBulkSMS(leadsToSend, message);

    // Actualizăm status-urile
    const updatedLeads = allLeads.map(lead => {
      const sentLead = result.results.find(r => r.leadId === lead.id && r.success);
      if (sentLead) {
        return {
          ...lead,
          status: 'sent',
          sentAt: new Date().toISOString()
        };
      }
      return lead;
    });

    await fs.writeFile(leadsPath, JSON.stringify(updatedLeads, null, 2));

    res.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      message: `Trimis ${result.sent}/${result.total} SMS-uri`,
      results: result.results
    });
  } catch (error) {
    console.error('❌ Eroare trimitere SMS bulk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
