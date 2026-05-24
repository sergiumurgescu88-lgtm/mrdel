import { useState } from 'react';

interface Category {
  id: string;
  label: string;
  queries: string[];
  description: string;
}

interface ScrapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScrape: (searches: string[]) => void;
  isScraping: boolean;
  platform: string;
}

const CITIES: string[] = [
  'București', 'Cluj-Napoca', 'Timișoara', 'Brașov', 'Constanța',
  'Iași', 'Sibiu', 'Craiova', 'Arad', 'Oradea', 'Galați',
  'Pitești', 'Târgu Mureș', 'Ploiești', 'Baia Mare'
];

// OPTIMIZAT conform Apify docs: termeni DISTINCTI, fără duplicate
const CATEGORIES: Category[] = [
  { id: 'restaurant', label: '🍽️ Restaurant', queries: ['restaurant'], description: 'Restaurante clasice, fine dining' },
  { id: 'pizzeria', label: '🍕 Pizzerie', queries: ['pizzerie'], description: 'Pizza, trattoria, pizzeria italiană' },
  { id: 'fastfood', label: '🍔 Fast Food', queries: ['fast food'], description: 'Burgeri, shaorma, kebab, snack-uri' },
  { id: 'cafenea', label: '☕ Cafenea', queries: ['cafenea'], description: 'Coffee shop, specialty coffee, ceainărie' },
  { id: 'pub', label: '🍺 Pub & Bar', queries: ['pub'], description: 'Baruri, berării, cocktail bar, wine bar' },
  { id: 'sushi', label: '🍣 Sushi & Asian', queries: ['sushi'], description: 'Sushi, ramen, thai, chinezesc, indian' },
  { id: 'brunch', label: '🥐 Brunch & Bistro', queries: ['brunch'], description: 'Brunch, bistro, patiserie, bakery' },
  { id: 'delivery', label: '🛵 Dark Kitchen', queries: ['dark kitchen'], description: 'Cloud kitchen, ghost kitchen, livrare exclusivă' }
];

export default function ScrapeModal({ isOpen, onClose, onScrape, isScraping, platform }: ScrapeModalProps) {
  const [selectedCities, setSelectedCities] = useState<string[]>(['București']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['restaurant']);
  const [maxResults, setMaxResults] = useState<number>(20);

  const toggleCity = (city: string) => {
    setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
  };

  const generateSearches = (): string[] => {
    const searches: string[] = [];
    for (const city of selectedCities) {
      for (const catId of selectedCategories) {
        const cat = CATEGORIES.find(c => c.id === catId);
        if (!cat) continue;
        for (const q of cat.queries) {
          searches.push(`${q} ${city}`);
        }
      }
    }
    return searches;
  };

  const handleStart = () => {
    const searches = generateSearches();
    if (searches.length === 0) { alert('Selectează cel puțin un oraș și o categorie!'); return; }
    onScrape(searches);
  };

  const platformLabel = platform === 'tiktok' ? '🎵 TikTok' : platform === 'instagram' ? '📸 Instagram' : '🗺️ Google Maps';
  const totalSearches = selectedCities.length * selectedCategories.reduce((a, c) => a + (CATEGORIES.find(x => x.id === c)?.queries?.length || 0), 0);
  const estimatedLeads = totalSearches * maxResults;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-orange-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold gradient-text mb-1">{platformLabel} - Configurare Scraping</h2>
            <p className="text-sm text-slate-400">Selectează orașele și categoriile dorite</p>
          </div>
          <button onClick={onClose} disabled={isScraping} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Orașe */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>📍</span> Orașe ({selectedCities.length})
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {CITIES.map(city => (
                <button key={city} onClick={() => toggleCity(city)} disabled={isScraping}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedCities.includes(city) ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gray-800 text-slate-400 hover:bg-gray-700'}`}>
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Categorii */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>🏷️</span> Categorii ({selectedCategories.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => toggleCategory(cat.id)} disabled={isScraping}
                  className={`px-3 py-3 rounded-lg text-sm font-medium transition-all text-left ${selectedCategories.includes(cat.id) ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-gray-800 text-slate-400 hover:bg-gray-700'}`}>
                  <div>{cat.label}</div>
                  <div className={`text-[9px] mt-1 ${selectedCategories.includes(cat.id) ? 'text-purple-200' : 'text-slate-500'}`}>{cat.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Max Results Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>📊</span> Rezultate per căutare
              </h3>
              <span className="text-xl font-bold text-orange-400">{maxResults}</span>
            </div>
            <input type="range" min="4" max="40" step="4" value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              disabled={isScraping}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider" />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Rapid (4)</span>
              <span>Echilibrat (20)</span>
              <span>Complet (40)</span>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Căutări de executat:</span>
              <span className="text-lg font-bold gradient-text">{totalSearches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Lead-uri estimate:</span>
              <span className="text-lg font-bold text-green-400">~{estimatedLeads}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-slate-400">Timp estimat:</span>
              <span className="text-sm text-orange-400">~{Math.max(1, Math.round(totalSearches * 0.5))} minute</span>
            </div>
          </div>

          {/* Apify Tips */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-[10px] text-blue-300">
              💡 <strong>Optimizat conform Apify Docs:</strong> Termeni distincți (fără duplicate), 
              rezultate scalabile, deduplicare automată. Fiecare categorie folosește un singur termen 
              de căutare pentru eficiență maximă.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 p-6 flex items-center justify-between gap-4">
          <button onClick={onClose} disabled={isScraping} className="px-6 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all font-medium">Anulează</button>
          <button onClick={handleStart} disabled={isScraping || selectedCities.length === 0 || selectedCategories.length === 0}
            className="flex-1 max-w-xs px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {isScraping ? '⏳ Se execută...' : `🚀 Start (${totalSearches} căutări)`}
          </button>
        </div>
      </div>
    </div>
  );
}
