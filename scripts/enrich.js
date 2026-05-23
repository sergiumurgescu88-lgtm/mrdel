const fs = require('fs');

function enrichLeads() {
    const raw = JSON.parse(fs.readFileSync('/var/www/nemolab-agent/data/raw_leads.json', 'utf8'));
    const enriched = [];
    
    for (const lead of raw) {
        const score = calculateScore(lead);
        
        enriched.push({
            id: lead.pageUrl?.split('/').pop() || Math.random().toString(36).substr(2, 9),
            name: lead.pageName || 'Unknown Restaurant',
            facebook_url: lead.pageUrl,
            phone: cleanPhone(lead.phone),
            email: lead.email || null,
            website: lead.website || null,
            address: lead.address || null,
            city: extractCity(lead.address),
            followers: lead.likes || lead.followers || 0,
            rating: lead.rating || null,
            reviews: lead.reviewCount || 0,
            category: lead.category || 'Restaurant',
            score: score,
            priority: score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW',
            status: 'new',
            contacted_at: null,
            replied_at: null,
            notes: '',
            pitch_sent: null,
            follow_up_1: null,
            follow_up_2: null
        });
    }
    
    enriched.sort((a, b) => b.score - a.score);
    
    fs.writeFileSync('/var/www/nemolab-agent/data/enriched_leads.json', JSON.stringify(enriched, null, 2));
    console.log(`✅ ${enriched.length} lead-uri îmbogățite`);
    
    const high = enriched.filter(l => l.priority === 'HIGH').length;
    const withPhone = enriched.filter(l => l.phone).length;
    const withEmail = enriched.filter(l => l.email).length;
    console.log(`📊 HIGH: ${high} | Telefon: ${withPhone} | Email: ${withEmail}`);
}

function calculateScore(lead) {
    let score = 0;
    if (!lead.phone) score += 3;
    if (!lead.website) score += 2;
    if (lead.rating && lead.rating < 4.0) score += 2;
    if (!lead.email) score += 1;
    if ((lead.likes || 0) > 5000) score += 1;
    if ((lead.reviewCount || 0) > 100) score += 1;
    return Math.max(0, Math.min(10, score));
}

function cleanPhone(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) cleaned = '+4' + cleaned;
    if (cleaned.startsWith('4') && !cleaned.startsWith('+4')) cleaned = '+' + cleaned;
    return cleaned.length >= 10 ? cleaned : null;
}

function extractCity(address) {
    if (!address) return 'Unknown';
    const cities = ['Bucuresti', 'Cluj', 'Timisoara', 'Iasi', 'Brasov', 'Constanta', 'Craiova', 'Sibiu', 'Oradea', 'Galati'];
    for (const city of cities) {
        if (address.toLowerCase().includes(city.toLowerCase())) return city;
    }
    return 'Unknown';
}

enrichLeads();
