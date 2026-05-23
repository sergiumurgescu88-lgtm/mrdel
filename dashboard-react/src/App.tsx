import { useState, useEffect } from 'react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  city: string;
  address?: string;
  website?: string | any;
  email?: string;
  rating?: number;
  reviews?: number;
  source: string;
  scrapedAt: string;
  status: 'pending' | 'sent';
  sentAt?: string;
  smsoToken?: string;
}

interface Stats {
  total: number;
  sent: number;
  pending: number;
  with_phone: number;
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, pending: 0, with_phone: 0 });
  const [loading, setLoading] = useState(false);
  const [scrapingPlatform, setScrapingPlatform] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all');
  const [displayCount, setDisplayCount] = useState(20);
  const ITEMS_PER_PAGE = 20;
  
  // Filtre avansate
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [minReviews, setMinReviews] = useState<number>(0);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/stats')
      ]);
      const leadsData = await leadsRes.json();
      const statsData = await statsRes.json();
      setLeads(leadsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const scrape = async (platform: string) => {
    setLoading(true);
    setScrapingPlatform(platform);
    setProgress(0);
    
    // Progress bar animat
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 5;
      });
    }, 2000);
    
    try {
      const res = await fetch(`/api/scrape-${platform}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      const data = await res.json();
      
      setTimeout(() => {
        alert(data.message || 'Scraping complet!');
        setScrapingPlatform(null);
        setProgress(0);
        fetchData();
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      alert('Eroare la scraping!');
      setScrapingPlatform(null);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const sendSMS = async (leadId?: string) => {
    const endpoint = leadId ? '/api/send-single-sms' : '/api/send-sms';
    const body = leadId ? JSON.stringify({ leadId }) : undefined;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: leadId ? { 'Content-Type': 'application/json' } : undefined,
        body
      });
      const data = await res.json();
      alert(data.message || 'SMS trimis!');
      fetchData();
    } catch (err) {
      alert('Eroare la trimitere SMS!');
    }
  };

  const filteredLeads = leads.filter(lead => {
    // Filtru status
    if (filter !== 'all' && lead.status !== filter) return false;
    
    // Filtru sursă
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
    
    // Filtru oraș
    if (cityFilter !== 'all' && lead.city !== cityFilter) return false;
    
    // Filtru rating minim
    if (minRating > 0 && (lead.rating || 0) < minRating) return false;
    
    // Filtru reviews minim
    if (minReviews > 0 && (lead.reviews || 0) < minReviews) return false;
    
    return true;
  });

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'Google Maps': return 'badge-google';
      case 'TikTok': return 'badge-tiktok';
      case 'Instagram': return 'badge-instagram';
      default: return 'badge-manual';
    }
  };

  return (
    <div className="relative min-h-screen z-10">
      {/* Header Mobile-First */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-white/5 ">
        <div className="container mx-auto px-3 py-3 md:px-6 md:py-5">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold gradient-text mb-0.5 md:mb-1 truncate">
                🚀 Nemo Lab
              </h1>
              <p className="text-[10px] md:text-sm text-slate-400 truncate">
                AI Lead Generation & SMS
              </p>
            </div>
            <div className="flex items-center gap-1.5 glass-card px-2 py-1 md:px-3 md:py-1.5 ml-2">
              <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] md:text-xs font-medium whitespace-nowrap">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      {scrapingPlatform && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-white/10 backdrop-blur-xl border-b border-white/20">
          <div className="container mx-auto px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                <span className="text-sm font-semibold gradient-text">
                  Scraping {scrapingPlatform === 'google' ? '🗺️ Google Maps' : scrapingPlatform === 'tiktok' ? '🎵 TikTok' : '📸 Instagram'}...
                </span>
              </div>
              <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {progress < 30 ? 'Inițializare scraper...' : progress < 60 ? 'Colectare date...' : progress < 90 ? 'Procesare rezultate...' : 'Finalizare...'}
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-3 py-4 md:px-6 md:py-8 max-w-7xl">
        {/* Stats Section - Optimized Mobile */}
        <section className="mb-5 md:mb-10">
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold gradient-text mb-1 md:mb-2">
            📊 Statistici
          </h2>
          <p className="text-[10px] md:text-sm text-slate-400 mb-3 md:mb-5">
            Monitorizare în timp real
          </p>
          
          <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
            <div className="stat-card py-3 md:py-5 px-2 md:px-4">
              <div className="text-2xl md:text-4xl mb-1 md:mb-2">🎯</div>
              <div className="text-xl md:text-3xl lg:text-4xl font-bold gradient-text mb-0.5 md:mb-1">
                {stats.total}
              </div>
              <div className="text-[9px] md:text-xs font-medium text-slate-400 uppercase tracking-wide">
                Total
              </div>
            </div>
            <div className="stat-card py-3 md:py-5 px-2 md:px-4">
              <div className="text-2xl md:text-4xl mb-1 md:mb-2">✅</div>
              <div className="text-xl md:text-3xl lg:text-4xl font-bold gradient-text mb-0.5 md:mb-1">
                {stats.sent}
              </div>
              <div className="text-[9px] md:text-xs font-medium text-slate-400 uppercase tracking-wide">
                Trimise
              </div>
            </div>
            <div className="stat-card py-3 md:py-5 px-2 md:px-4">
              <div className="text-2xl md:text-4xl mb-1 md:mb-2">⏳</div>
              <div className="text-xl md:text-3xl lg:text-4xl font-bold gradient-text mb-0.5 md:mb-1">
                {stats.pending}
              </div>
              <div className="text-[9px] md:text-xs font-medium text-slate-400 uppercase tracking-wide">
                Pending
              </div>
            </div>
            <div className="stat-card py-3 md:py-5 px-2 md:px-4">
              <div className="text-2xl md:text-4xl mb-1 md:mb-2">📞</div>
              <div className="text-xl md:text-3xl lg:text-4xl font-bold gradient-text mb-0.5 md:mb-1">
                {stats.with_phone}
              </div>
              <div className="text-[9px] md:text-xs font-medium text-slate-400 uppercase tracking-wide">
                Cu Telefon
              </div>
            </div>
          </div>
        </section>

        {/* Actions Section - Mobile Grid 2x2 */}
        <section className="mb-5 md:mb-10">
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold gradient-text mb-1 md:mb-2">
            ⚡ Acțiuni
          </h2>
          <p className="text-[10px] md:text-sm text-slate-400 mb-3 md:mb-5">
            Scraping & SMS
          </p>
          
          <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
            <button
              onClick={() => scrape('google')}
              disabled={loading}
              className="antigrav-card py-4 md:py-6 px-2 md:px-4"
            >
              <div className="text-3xl md:text-5xl mb-2 md:mb-3">🗺️</div>
              <h3 className="text-sm md:text-lg lg:text-xl font-bold mb-1 md:mb-2">Google</h3>
              <p className="text-[9px] md:text-xs text-slate-400 mb-2 md:mb-3 line-clamp-2 hidden md:block">
                Restaurante Maps
              </p>
              <div className="btn-scraping text-[10px] md:text-xs text-center py-2 md:py-2.5 px-2 md:px-3">
                Scrape
              </div>
            </button>

            <button
              onClick={() => scrape('tiktok')}
              disabled={loading}
              className="antigrav-card py-4 md:py-6 px-2 md:px-4"
            >
              <div className="text-3xl md:text-5xl mb-2 md:mb-3">🎵</div>
              <h3 className="text-sm md:text-lg lg:text-xl font-bold mb-1 md:mb-2">TikTok</h3>
              <p className="text-[9px] md:text-xs text-slate-400 mb-2 md:mb-3 line-clamp-2 hidden md:block">
                Creatori content
              </p>
              <div className="btn-scraping text-[10px] md:text-xs text-center py-2 md:py-2.5 px-2 md:px-3">
                Scrape
              </div>
            </button>

            <button
              onClick={() => scrape('instagram')}
              disabled={loading}
              className="antigrav-card py-4 md:py-6 px-2 md:px-4"
            >
              <div className="text-3xl md:text-5xl mb-2 md:mb-3">📸</div>
              <h3 className="text-sm md:text-lg lg:text-xl font-bold mb-1 md:mb-2">Instagram</h3>
              <p className="text-[9px] md:text-xs text-slate-400 mb-2 md:mb-3 line-clamp-2 hidden md:block">
                Profile business
              </p>
              <div className="btn-scraping text-[10px] md:text-xs text-center py-2 md:py-2.5 px-2 md:px-3">
                Scrape
              </div>
            </button>

            <button
              onClick={() => sendSMS()}
              disabled={loading}
              className="antigrav-card py-4 md:py-6 px-2 md:px-4"
            >
              <div className="text-3xl md:text-5xl mb-2 md:mb-3">📱</div>
              <h3 className="text-sm md:text-lg lg:text-xl font-bold mb-1 md:mb-2">SMS</h3>
              <p className="text-[9px] md:text-xs text-slate-400 mb-2 md:mb-3 line-clamp-2 hidden md:block">
                Bulk către pending
              </p>
              <div className="btn-scraping text-[10px] md:text-xs text-center py-2 md:py-2.5 px-2 md:px-3">
                Trimite
              </div>
            </button>
          </div>
        </section>

        {/* Filtre Avansate */}
        <div className="glass-card p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl">🔍</span>
              <h3 className="text-lg md:text-xl font-bold gradient-text">Filtre Avansate</h3>
            </div>
            {(filter !== 'all' || sourceFilter !== 'all' || cityFilter !== 'all' || minRating > 0 || minReviews > 0) && (
              <button
                onClick={() => {
                  setFilter('all');
                  setSourceFilter('all');
                  setCityFilter('all');
                  setMinRating(0);
                  setMinReviews(0);
                  setDisplayCount(20);
                }}
                className="text-[10px] md:text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
              >
                <span>🔄</span>
                <span>Resetează</span>
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {/* Filtru Status */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block font-medium">Status</label>
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value as any); setDisplayCount(20); }}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                <option value="all" className="bg-gray-800 text-white">Toate</option>
                <option value="pending" className="bg-gray-800 text-white">⏳ Pending</option>
                <option value="sent" className="bg-gray-800 text-white">✅ Trimise</option>
              </select>
            </div>

            {/* Filtru Sursă */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block font-medium">Sursă</label>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setDisplayCount(20); }}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                <option value="all" className="bg-gray-800 text-white">Toate sursele</option>
                <option value="Google Maps" className="bg-gray-800 text-white">🗺️ Google Maps</option>
                <option value="TikTok" className="bg-gray-800 text-white">🎵 TikTok</option>
                <option value="Instagram" className="bg-gray-800 text-white">📸 Instagram</option>
              </select>
            </div>

            {/* Filtru Oraș */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block font-medium">Oraș</label>
              <select
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setDisplayCount(20); }}
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                <option value="all" className="bg-gray-800 text-white">Toate orașele</option>
                {[...new Set(leads.map(l => l.city).filter(Boolean))].sort().map(city => (
                  <option key={city} value={city} className="bg-gray-800 text-white">{city}</option>
                ))}
              </select>
            </div>

            {/* Filtru Rating Minim */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block font-medium">
                Rating: {minRating > 0 ? `⭐ ${minRating}+` : 'Toate'}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={minRating}
                onChange={(e) => { setMinRating(parseFloat(e.target.value)); setDisplayCount(20); }}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider mt-2"
              />
            </div>

            {/* Filtru Reviews Minim */}
            <div className="col-span-2 md:col-span-1">
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block font-medium">
                Reviews: {minReviews > 0 ? `${minReviews}+` : 'Toate'}
              </label>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={minReviews}
                onChange={(e) => { setMinReviews(parseInt(e.target.value)); setDisplayCount(20); }}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider mt-2"
              />
            </div>
          </div>

          {/* Counter rezultate filtrate */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span>
                <span className="font-bold gradient-text text-sm">{filteredLeads.length}</span> lead-uri găsite
                {filteredLeads.length !== leads.length && (
                  <span className="text-slate-500"> din {leads.length} totale</span>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Leads Section - Mobile Optimized */}
        <section>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3 md:mb-5">
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl lg:text-3xl font-bold gradient-text mb-0.5 md:mb-1">
                🎯 Lead-uri
              </h2>
              <p className="text-[10px] md:text-sm text-slate-400">
                {filteredLeads.length} rezultate · Afișate {Math.min(displayCount, filteredLeads.length)}
              </p>
            </div>
            <div className="flex gap-1.5 md:gap-2 overflow-x-auto">
              {(['all', 'pending', 'sent'] as const).map(f => (
                <button
                  key={f}
                  className={filter === f ? 'filter-btn-active text-[10px] md:text-xs py-1.5 md:py-2 px-2.5 md:px-4' : 'filter-btn-inactive text-[10px] md:text-xs py-1.5 md:py-2 px-2.5 md:px-4'}
                  onClick={() => { setFilter(f); setDisplayCount(20); }}
                  >
                  {f === 'all' ? 'Toate' : f === 'pending' ? 'Pending' : 'Trimise'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
            {filteredLeads.slice(0, displayCount).map(lead => (
              <div key={lead.id} className="lead-card py-3 md:py-4 px-3 md:px-4">
                <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm md:text-base lg:text-lg font-bold mb-0.5 md:mb-1 truncate">
                      {lead.name}
                    </h3>
                    <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1 truncate">
                      <span>📍</span>
                      <span className="truncate">{lead.city}</span>
                    </p>
                  </div>
                  <span className={`${getSourceBadge(lead.source)} text-[10px] md:text-xs shrink-0`}>
                    {lead.source.replace('Google Maps', 'Google')}
                  </span>
                </div>

                <div className="space-y-1 md:space-y-1.5 mb-2 md:mb-3">
                  {lead.phone && (
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300">
                      <span className="text-sm md:text-base">📞</span>
                      <span className="font-mono text-[10px] md:text-xs truncate">
                        {lead.phone}
                      </span>
                    </div>
                  )}
                  {lead.rating && (
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300">
                      <span className="text-sm md:text-base">⭐</span>
                      <span className="text-[10px] md:text-xs">
                        {lead.rating} ({lead.reviews})
                      </span>
                    </div>
                  )}
                  {lead.website && (
                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                      <span className="text-sm md:text-base">🌐</span>
                      <a
                        href={typeof lead.website === "string" ? lead.website : (lead.website?.url || lead.website?.lynx_url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-[10px] md:text-xs truncate"
                      >
                        {(() => {
                          const url = typeof lead.website === 'string' ? lead.website : (lead.website?.url || lead.website?.lynx_url || '');
                          return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
                        })()}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-white/10">
                  <span className={`${lead.status === 'sent' ? 'badge-success' : 'badge-warning'} text-[10px] md:text-xs`}>
                    {lead.status === 'sent' ? '✅ Trimis' : '⏳ Pending'}
                  </span>
                  {lead.status === 'pending' && (
                    <button
                      onClick={() => sendSMS(lead.id)}
                      className="btn-secondary text-[10px] md:text-xs py-1.5 md:py-2 px-2.5 md:px-3"
                    >
                      📤 SMS
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* See More Button */}
          {filteredLeads.length > displayCount && (
            <div className="mt-6 md:mt-8 flex flex-col items-center gap-3">
              <p className="text-[10px] md:text-xs text-slate-400">
                Afișate <span className="font-bold gradient-text">{displayCount}</span> din <span className="font-bold gradient-text">{filteredLeads.length}</span> lead-uri
              </p>
              <button
                onClick={() => setDisplayCount(prev => prev + ITEMS_PER_PAGE)}
                className="btn-primary text-xs md:text-sm py-2.5 md:py-3 px-6 md:px-8 flex items-center gap-2"
              >
                <span>📥</span>
                <span>Vezi încă {Math.min(ITEMS_PER_PAGE, filteredLeads.length - displayCount)} lead-uri</span>
              </button>
              <button
                onClick={() => setDisplayCount(filteredLeads.length)}
                className="text-[10px] md:text-xs text-slate-400 hover:text-white transition-colors underline"
              >
                Arată toate {filteredLeads.length} lead-urile
              </button>
            </div>
          )}

          {filteredLeads.length > 0 && filteredLeads.length <= displayCount && (
            <div className="mt-6 text-center">
              <p className="text-[10px] md:text-xs text-slate-400">
                ✅ Toate <span className="font-bold gradient-text">{filteredLeads.length}</span> lead-urile sunt afișate
              </p>
            </div>
          )}

          {filteredLeads.length === 0 && (
            <div className="glass-card py-8 md:py-12 px-4 text-center">
              <div className="text-4xl md:text-6xl mb-3 md:mb-4">🔍</div>
              <h3 className="text-base md:text-xl lg:text-2xl font-bold mb-2 gradient-text">
                Niciun lead
              </h3>
              <p className="text-[10px] md:text-sm text-slate-400 mb-4 md:mb-6">
                Apasă un buton de scraping pentru a începe
              </p>
              <button
                onClick={() => scrape('google')}
                className="btn-sms text-xs md:text-sm py-2 md:py-3 px-4 md:px-6"
              >
                🗺️ Scrape Google
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer Mobile */}
      <footer className="border-t border-white/10 mt-10 md:mt-16 py-4 md:py-6">
        <div className="container mx-auto px-3 text-center">
          <p className="text-[9px] md:text-xs text-slate-400">
            <p className="text-[10px] md:text-xs text-slate-500">
              MrDelivery Lab © 2026 · AI for HoReCa
            </p>
            <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">
              Powered by MrDelivery AI Agency · part of SSocietyHUB.eu
            </p>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
