const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// === FALLBACK TOKENS ===
const APIFY_TOKENS = [
  process.env.APIFY_TOKEN,
  process.env.APIFY_FALLBACK_1 || '',
  process.env.APIFY_FALLBACK_2 || '',
  process.env.APIFY_FALLBACK_3 || '',
  process.env.APIFY_FALLBACK_4 || '',
  process.env.APIFY_FALLBACK_6 || '',
  process.env.APIFY_FALLBACK_7 || '',
  process.env.APIFY_FALLBACK_8 || '',
  process.env.APIFY_FALLBACK_9 || ''
].filter(Boolean);

async function runActorWithFallback(actorId, input) {
  for (let i = 0; i < APIFY_TOKENS.length; i++) {
    try {
      console.log(`🔄 Încerc token ${i+1}/${APIFY_TOKENS.length} pentru ${actorId}...`);
      const client = new ApifyClient({ token: APIFY_TOKENS[i] });
      const run = await client.actor(actorId).call(input, { waitSecs: 900 });
      const dataset = client.dataset(run.defaultDatasetId);
      const { items } = await dataset.listItems();
      console.log(`✅ Succes cu token ${i+1}!`);
      return items;
    } catch (err) {
      console.warn(`❌ Token ${i+1} a eșuat:`, err.message.split('\n')[0]);
    }
  }
  throw new Error('Toate tokenurile Apify au eșuat.');
}

// === GOOGLE MAPS ===
async function scrapeGoogleMaps() {
  console.log('🗺️ Pornesc Google Maps Scraper (MEGA - 50+ căutări diverse)...');
  const input = {
    searchStringsArray: [
      // RESTAURANTE DELIVERY BUCUREȘTI (cu "România" pentru localizare)
      'restaurant livrare București România',
      'pizza delivery București România',
      'shaorma livrare București România',
      'burger livrare București România',
      'sushi livrare București România',
      
      // DARK KITCHENS (foarte specifici pentru România)
      'dark kitchen București România',
      'ghost kitchen Cluj România',
      'cloud kitchen Timișoara România'
    ],
    maxCrawledPlacesPerSearch: 4, // CONSERVATOR: 9 căutări × 4 = 36 total
    maxImages: 0,
    language: 'ro',
    oneGeo: true,
    includePersonalData: true
  };
  const items = await runActorWithFallback('compass/crawler-google-places', input);
  
  console.log(`✅ Google Maps: ${items.length} locații găsite`);
  
  return items.map(p => ({
    id: `gm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
    name: p.title || p.name || 'Necunoscut',
    phone: p.phone || p.internationalPhoneNumber || '',
    city: p.city || p.address || 'România',
    address: p.address || '',
    website: p.website || '',
    email: p.email || '',
    rating: p.totalScore || 0,
    reviews: p.reviewsCount || 0,
    source: 'Google Maps',
    scrapedAt: new Date().toISOString(),
    status: 'pending'
  }));
}

// === TIKTOK ===
async function scrapeTikTok() {
  console.log('🎵 Pornesc TikTok Scraper (max 5 lead-uri)...');
  const input = {
    searchQueries: [
      'restaurant București',
      'pizzerie Cluj',
      'cafenea Timișoara',
      'restaurant Iași',
      'bistro Constanța',
      'shaormerie Brașov',
      'burger Oradea'
    ],
    resultsPerPage: 5,
    shouldDownloadVideos: false
  };
  const items = await runActorWithFallback('GdWCkxBtKWOsKjdch', input);
  return items
    .filter(i => {
      // Exclude creatorii cu peste 50k followers (sunt travel bloggeri, nu restaurante)
      if (!i.authorMeta || !i.authorMeta.name) return false;
      if (i.authorMeta.fans && i.authorMeta.fans > 50000) {
        console.log(`⚠️ Exclude ${i.authorMeta.name} (${i.authorMeta.fans} followers - probabil travel blogger)`);
        return false;
      }
      return true;
    })
    .map(i => ({
      id: `tt-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
      name: i.authorMeta.name || 'Creator TikTok',
      phone: '',
      city: 'România',
      address: '',
      website: i.authorMeta.signature?.match(/https?:\/\/[^\s]+/)?.[0] || '',
      email: '',
      rating: 0,
      reviews: i.diggCount || 0,
      source: 'TikTok',
      scrapedAt: new Date().toISOString(),
      status: 'pending'
    }));
  
  console.log(`✅ TikTok: ${items.length} rezultate găsite, filtrate la lead-uri valide`);
}

// === INSTAGRAM ===
async function scrapeInstagram() {
  console.log('📸 Pornesc Instagram Profile Scraper (max 5 lead-uri)...');
  
  // Username-uri cunoscute de restaurante românești
  const restaurantUsernames = [
    'tavernaracilor',
    'petrarestaurant',
    'casaboema',
    'restaurantbuenavista',
    'casanumaa',
    'olivobistro',
    'lepremierconstanta',
    'restaurantbueno',
    'mangiamangia',
    'hanusararie1896'
  ];
  
  const input = {
    usernames: restaurantUsernames,
    maxItems: 5,
    resultsType: 'posts'
  };
  
  const items = await runActorWithFallback('apify/instagram-profile-scraper', input);
  
  console.log(`✅ Instagram: ${items.length} profiluri extrase`);
  
  return items.map(p => ({
    id: `ig-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
    name: p.fullName || p.username || 'Restaurant Instagram',
    phone: '',
    city: p.location || 'România',
    address: '',
    website: p.websiteUrl || p.externalUrls?.[0] || '',
    email: '',
    rating: 0,
    reviews: p.followersCount || 0,
    source: 'Instagram',
    scrapedAt: new Date().toISOString(),
    status: 'pending',
    instagramData: {
      username: p.username,
      bio: p.biography || '',
      followers: p.followersCount || 0,
      following: p.followsCount || 0,
      posts: p.postsCount || 0,
      isBusiness: p.isBusinessAccount || false,
      category: p.category || '',
      verified: p.isVerified || false
    }
  }));
}

// === MAIN ===
async function main() {
  const platform = process.argv[2] || 'google';
  let newLeads = [];

  try {
    switch(platform) {
      case 'google': newLeads = await scrapeGoogleMaps(); break;
      case 'tiktok': newLeads = await scrapeTikTok(); break;
      case 'instagram': newLeads = await scrapeInstagram(); break;
      default: console.log('❌ Platformă necunoscută.'); return;
    }
  } catch (err) {
    console.error('❌ Eroare scraping:', err.message);
    return;
  }

  // Salvare cu eliminare duplicate
  const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
  let existing = [];
  try { existing = JSON.parse(await fs.readFile(leadsPath, 'utf8')); } catch {}

  // Deduplicare SUPER-inteligentă: nume + telefon + adresă (combinație unică)
  const existingKeys = new Set(existing.map(l => {
    const name = l.name.toLowerCase().trim();
    const phone = (l.phone || '').replace(/\s/g, '');
    const address = (l.address || '').toLowerCase().trim().substring(0, 50);
    
    // Dacă avem telefon, folosim nume + telefon + adresă
    if (phone.length > 5) {
      return `${name}_${phone}_${address}`;
    }
    // Altfel folosim nume + adresă + sursă
    return `${name}_${address}_${l.source}`;
  }));
  
  const unique = newLeads.filter(l => {
    const name = l.name.toLowerCase().trim();
    const phone = (l.phone || '').replace(/\s/g, '');
    const address = (l.address || '').toLowerCase().trim().substring(0, 50);
    
    let key;
    if (phone.length > 5) {
      key = `${name}_${phone}_${address}`;
    } else {
      key = `${name}_${address}_${l.source}`;
    }
    return !existingKeys.has(key);
  });

  const all = [...existing, ...unique];
  await fs.writeFile(leadsPath, JSON.stringify(all, null, 2));
  console.log(`✅ GATA! Am salvat ${unique.length} lead-uri noi de pe ${platform.toUpperCase()}. Total: ${all.length}`);
}

main();

// === EXPORTS pentru API ===
module.exports = {
  scrapeGoogleMaps,
  scrapeTikTok,
  scrapeInstagram,
  runActorWithFallback
};
