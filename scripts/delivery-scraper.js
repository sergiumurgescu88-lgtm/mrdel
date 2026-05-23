const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
require('dotenv').config();

// Token-urile Apify (folosim același sistem de fallback)
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

// Platforme de delivery din România
const DELIVERY_PLATFORMS = {
  glovo: {
    url: 'https://glovoapp.com/ro/ro/',
    cities: ['bucuresti', 'cluj-napoca', 'timisoara', 'iasi', 'constanta', 'brasov', 'craiova', 'galati', 'oradea', 'sibiu']
  },
  tazz: {
    url: 'https://tazz.ro/',
    cities: ['bucuresti', 'cluj', 'timisoara', 'iasi', 'constanta', 'brasov']
  },
  bolt: {
    url: 'https://food.bolt.eu/ro/',
    cities: ['bucuresti', 'cluj-napoca', 'timisoara', 'iasi', 'constanta', 'brasov']
  }
};

async function scrapeDeliveryPlatforms(platform = 'glovo') {
  console.log(`🛵 Pornesc ${platform.toUpperCase()} Scraper...`);
  
  const config = DELIVERY_PLATFORMS[platform];
  if (!config) {
    console.error(`❌ Platforma ${platform} nu este suportată`);
    return [];
  }

  const allRestaurants = [];
  
  for (const city of config.cities) {
    console.log(`🔍 Scraping ${platform} - ${city}...`);
    
    for (let i = 0; i < APIFY_TOKENS.length; i++) {
      try {
        const client = new ApifyClient({ token: APIFY_TOKENS[i] });
        
        // Folosim Web Scraper actor pentru platforme de delivery
        const input = {
          startUrls: [{ url: `${config.url}${city}` }],
          pseudoUrls: [`${config.url}${city}[/]?.*`],
          linkSelector: 'a[href*="/restaurant/"]',
          pageFunction: async function pageFunction(context) {
            const $ = context.jQuery;
            const results = [];
            
            // Extragem toate restaurantele de pe pagină
            $('.restaurant-card, [data-testid*="restaurant"], .store-card').each((i, el) => {
              const name = $(el).find('h2, h3, [class*="name"]').first().text().trim();
              const address = $(el).find('[class*="address"], p').first().text().trim();
              
              if (name) {
                results.push({
                  name,
                  address,
                  city: city,
                  platform: platform,
                  url: context.request.url
                });
              }
            });
            
            return results;
          },
          maxPagesPerCrawl: 5,
          maxResults: 20
        };
        
        const run = await client.actor('apify/web-scraper').call(input, { waitSecs: 300 });
        const dataset = client.dataset(run.defaultDatasetId);
        const { items } = await dataset.listItems();
        
        console.log(`✅ ${platform}/${city}: ${items.length} restaurante găsite`);
        allRestaurants.push(...items);
        break; // Succes, ieșim din loop-ul de token-uri
        
      } catch (err) {
        console.warn(`❌ Token ${i+1} eșuat pentru ${city}:`, err.message.split('\n')[0]);
        if (i === APIFY_TOKENS.length - 1) {
          console.error(`❌ Toate token-urile au eșuat pentru ${city}`);
        }
      }
    }
  }
  
  return allRestaurants;
}

async function main() {
  const platform = process.argv[2] || 'glovo';
  const restaurants = await scrapeDeliveryPlatforms(platform);
  
  // Încarcă lead-urile existente
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile('data/leads.json', 'utf8'));
  } catch {}
  
  // Creează lead-uri noi (doar cu nume - vom îmbogăți cu telefon ulterior)
  const newLeads = restaurants.map(r => ({
    id: `${platform}-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
    name: r.name,
    phone: '', // Vom căuta telefonul pe Google Maps ulterior
    city: r.city,
    address: r.address || '',
    website: '',
    email: '',
    rating: 0,
    reviews: 0,
    source: platform.toUpperCase(),
    scrapedAt: new Date().toISOString(),
    status: 'pending',
    platform: platform
  }));
  
  // Elimină duplicatele
  const existingPhones = new Set(existing.map(l => l.phone));
  const existingNames = new Set(existing.map(l => l.name.toLowerCase()));
  
  const uniqueLeads = newLeads.filter(l => 
    !existingNames.has(l.name.toLowerCase())
  );
  
  // Salvează
  const all = [...existing, ...uniqueLeads];
  await fs.writeFile('data/leads.json', JSON.stringify(all, null, 2));
  
  console.log(`\n✅ GATA! Am salvat ${uniqueLeads.length} lead-uri noi de pe ${platform.toUpperCase()}. Total: ${all.length}`);
  
  return { success: true, added: uniqueLeads.length, total: all.length };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { scrapeDeliveryPlatforms };
