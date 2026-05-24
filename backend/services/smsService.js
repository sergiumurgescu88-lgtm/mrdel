const axios = require('axios');

class SMSService {
  constructor() {
    this.apiKey = process.env.SMSSO_API_KEY || process.env.SMSSO_TOKEN;
    this.apiUrl = 'https://app.smso.ro/api/v1/send';
    this.creditUrl = 'https://app.smso.ro/api/v1/credit';
  }

  /**
   * Verifică creditul disponibil în contul SMSO
   */
  async checkCredit() {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key SMSO nu este configurat în .env',
        credit: 0,
        messagesRemaining: 0
      };
    }

    try {
      const response = await axios.get(this.creditUrl, {
        headers: {
          'X-Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const credit = response.data.credit || 0;
      const messagesRemaining = Math.floor(credit / 0.05);
      
      return {
        success: true,
        credit: credit,
        currency: response.data.currency || 'RON',
        messagesRemaining: messagesRemaining
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('❌ Eroare verificare credit SMSO:', errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        credit: 0,
        messagesRemaining: 0,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Generează mesajul SMS personalizat pentru fiecare lead
   */
  generateMessage(lead) {
    const restaurantName = lead.name || 'restaurantul dvs';
    return `Buna ziua! Sunt Sergiu de la MrDelivery. Am analizat ${restaurantName} si credem ca va putem ajuta sa automatizati comenzile si sa reduceti costurile. Detalii: https://mrdelivery.ro | Tel: 0768 676 141`;
  }

  /**
   * Normalizează numărul de telefon în format internațional
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('07')) {
      cleaned = '+40' + cleaned.substring(1);
    }
    
    if (cleaned.startsWith('0040')) {
      cleaned = '+40' + cleaned.substring(4);
    }
    
    if (cleaned.startsWith('+40') && cleaned.length === 13 && /^[\d+]+$/.test(cleaned)) {
      return cleaned;
    }
    
    return null;
  }

  /**
   * Trimite un SMS către un singur număr
   */
  async sendSMS(phone, message) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key SMSO nu este configurat',
        phone: phone
      };
    }

    const creditCheck = await this.checkCredit();
    
    if (!creditCheck.success) {
      return {
        success: false,
        error: `Nu pot verifica creditul: ${creditCheck.error}`,
        phone: phone,
        statusCode: creditCheck.statusCode
      };
    }

    if (creditCheck.messagesRemaining < 1) {
      return {
        success: false,
        error: `Credit insuficient! Ai ${creditCheck.credit} ${creditCheck.currency} (${creditCheck.messagesRemaining} mesaje rămase)`,
        phone: phone,
        credit: creditCheck.credit
      };
    }

    const normalizedPhone = this.normalizePhone(phone);
    
    if (!normalizedPhone) {
      return {
        success: false,
        error: 'Număr de telefon invalid. Format acceptat: 07xxxxxxxx sau +407xxxxxxxx',
        phone: phone
      };
    }

    try {
      const params = new URLSearchParams();
      params.append('sender', 'MrDelivery');
      params.append('to', normalizedPhone);
      params.append('body', message);

      const response = await axios.post(this.apiUrl, params, {
        headers: {
          'X-Authorization': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      return {
        success: true,
        messageId: response.data.id || response.data.message_id,
        phone: normalizedPhone,
        creditRemaining: creditCheck.credit - 0.05
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      console.error('❌ Eroare trimitere SMS:', {
        phone: normalizedPhone,
        error: errorMsg,
        statusCode: statusCode,
        responseData: error.response?.data
      });
      
      let userFriendlyError = errorMsg;
      
      if (statusCode === 402) {
        userFriendlyError = 'Credit insuficient sau abonament expirat. Verifică contul SMSO.';
      } else if (statusCode === 401) {
        userFriendlyError = 'API key invalid. Verifică credențialele SMSO.';
      } else if (statusCode === 400) {
        userFriendlyError = 'Date invalide. Verifică numărul de telefon și mesajul.';
      }
      
      return {
        success: false,
        error: userFriendlyError,
        phone: normalizedPhone,
        statusCode: statusCode,
        rawError: errorMsg
      };
    }
  }

  /**
   * Trimite SMS în bulk către mai multe lead-uri
   */
  async sendBulkSMS(leads, customMessage = null) {
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      const message = customMessage || this.generateMessage(lead);
      const result = await this.sendSMS(lead.phone, message);
      results.push({
        ...result,
        leadId: lead.id,
        leadName: lead.name
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        
        if (result.error?.includes('Credit insuficient') || result.statusCode === 402) {
          console.log('⚠️ Credit epuizat, opresc trimiterea bulk');
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      success: sent > 0,
      sent,
      failed,
      total: leads.length,
      results
    };
  }
}

module.exports = new SMSService();
