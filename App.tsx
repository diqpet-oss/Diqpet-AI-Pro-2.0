
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageAssets } from './types.ts';
import { generateFitting } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

/**
 * Cloud Asset Manifest
 * Using high-resolution remote resources to replace local assets.
 */
const ASSETS_URLS: Record<string, string> = {
  // Pet Models (Real breed photography)
  poodle: 'https://www.diqpet.com/products/golden_retriever.jpg',
  bichon: 'https://www.diqpet.com/products/corgi.jpg',
  golden: 'https://www.diqpet.com/products/bulldog.jpg',
  // Product Placeholders
  happy_raincoat: 'https://www.diqpet.com/products/happy_raincoat.jpg',
  ribbed_homewear: 'https://www.diqpet.com/products/ribbed_homewear.jpg',

};

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [engine, setEngine] = useState<'doubao' | 'fal' | 'google'>('google');
  const [selectedProductId, setSelectedProductId] = useState('happy_series_vton');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  
  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: ASSETS_URLS.poodle, 
    clothing: ASSETS_URLS.happy_raincoat, 
    result: null 
  });
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const t = UI_STRINGS[lang];

  const products = PRODUCT_DATA[lang].map(p => {
    let imageUrl = ASSETS_URLS.ribbed_homewear;
    if (p.id === 'happy_series_vton') imageUrl = ASSETS_URLS.happy_raincoat;
    if (p.id === 'v3_puffer') imageUrl = ASSETS_URLS.v3_puffer;

    return {
      ...p,
      imageUrl,
      url: p.id === 'v3_puffer' ? 'https://www.diqpet.com/' : `https://www.coupang.com/vp/products/${p.id === 'happy_series_vton' ? '9312183755' : p.id}`
    };
  });

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleGenerate = async () => {
    if (!assets.pet) {
      setErrorMsg(t.petNotSelected);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await generateFitting(engine, assets.pet, activeProduct.description);
      setAssets(prev => ({ ...prev, result: res }));
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "AI Rendering Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAssets(prev => ({ ...prev, pet: reader.result as string, result: null }));
        setSelectedBreedId('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-600 p-4 md:p-8" dir={LANGUAGES.find(l => l.code === lang)?.isRTL ? 'rtl' : 'ltr'}>
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-600/30">
            <i className="fa-solid fa-wand-magic-sparkles text-2xl text-white"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">DIQPET <span className="text-orange-500">AI</span></h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{t.subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 overflow-x-auto max-w-full">
          {LANGUAGES.map(l => (
            <button 
              key={l.code} 
              onClick={() => setLang(l.code)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${lang === l.code ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-zinc-900/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-black flex items-center gap-3 uppercase tracking-widest text-zinc-400">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                {t.step1}
              </h2>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-black uppercase bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-orange-600 hover:border-orange-500 transition-all active:scale-95"
              >
                <i className="fa-solid fa-upload mr-2"></i>{t.upload}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['poodle', 'bichon', 'golden'].map(id => (
                <button 
                  key={id}
                  onClick={() => {
                    setAssets(prev => ({ ...prev, pet: ASSETS_URLS[id], result: null }));
                    setSelectedBreedId(id);
                  }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative group ${selectedBreedId === id ? 'border-orange-600 ring-4 ring-orange-600/20' : 'border-transparent opacity-50 hover:opacity-100 hover:border-white/20'}`}
                >
                  <img src={ASSETS_URLS[id]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={id} />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-zinc-900/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
            <h2 className="text-xs font-black mb-5 flex items-center gap-3 uppercase tracking-widest text-zinc-400">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
              {t.step2}
            </h2>
            <div className="space-y-3">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null }));
                  }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all active:scale-[0.98] ${selectedProductId === p.id ? 'bg-orange-600/10 border-orange-600/50 shadow-inner' : 'bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:bg-white/10'}`}
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-white/5">
                    <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                  </div>
                  <div className="text-left flex-grow">
                    <p className="text-[9px] font-black uppercase text-orange-500/80 mb-0.5 tracking-wider">
                      {p.id.includes('happy') ? t.category1 : (p.id.includes('puffer') ? t.category3 : t.category2)}
                    </p>
                    <p className="text-xs font-bold leading-tight line-clamp-2 text-zinc-100">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setEngine('google')} 
              className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all group ${engine === 'google' ? 'border-orange-600 bg-orange-600/5' : 'border-white/5 bg-zinc-900/50 hover:bg-white/5'}`}
            >
              <i className="fa-brands fa-google text-lg opacity-60 group-hover:opacity-100"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{t.engine2}</span>
            </button>
            <button 
              onClick={() => setEngine('fal')} 
              className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all group ${engine === 'fal' ? 'border-orange-600 bg-orange-600/5' : 'border-white/5 bg-zinc-900/50 hover:bg-white/5'}`}
            >
              <i className="fa-solid fa-bolt text-lg opacity-60 group-hover:opacity-100"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{t.engine3}</span>
            </button>
          </div>

          <button 
            disabled={loading}
            onClick={handleGenerate}
            className="w-full py-7 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all shadow-2xl shadow-orange-600/20 active:scale-95 group"
          >
            <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl group-hover:rotate-12 transition-transform`}></i>
            <span className="text-xl font-black tracking-tighter uppercase italic">{loading ? t.rendering : t.generate}</span>
          </button>
          
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-pulse">
              <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
              <p className="text-[10px] text-red-300 font-bold uppercase">{errorMsg}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8 h-full">
          <div className="flex-grow aspect-square md:aspect-auto md:h-[600px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-2xl group shadow-inner">
            <div className="absolute top-8 left-8 flex items-center gap-3 z-10 bg-black/40 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/5">
              <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping shadow-[0_0_12px_rgba(220,38,38,0.8)]"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-white/70">LIVE AI RENDER</span>
            </div>
            
            {assets.result ? (
              <div className="w-full h-full p-8 animate-in fade-in zoom-in duration-700">
                <img src={assets.result} className="w-full h-full object-contain rounded-[2rem] shadow-2xl" alt="Fitting Result" />
              </div>
            ) : (
              <div className="text-zinc-800 flex flex-col items-center gap-6 transition-all duration-700 group-hover:scale-105">
                <i className="fa-solid fa-dog text-[160px] opacity-20 group-hover:opacity-30 transition-opacity"></i>
                <p className="text-[11px] font-black uppercase tracking-[1em] text-zinc-700">{t.waiting}</p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center gap-8 z-20 transition-all duration-500">
                <div className="relative">
                  <div className="w-28 h-28 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                  <i className="fa-solid fa-sparkles absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-600 text-3xl animate-pulse"></i>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-base font-black uppercase tracking-[0.5em] animate-pulse text-white">{t.rendering}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Neural Engine V4.5 Pro - High Precision Mode</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            <button 
              onClick={() => window.open(activeProduct.url, "_blank")}
              className="flex-grow py-8 bg-[#007AFF] hover:bg-[#0062CC] rounded-[2.5rem] flex items-center justify-center gap-5 transition-all shadow-2xl shadow-blue-600/30 active:scale-95 border-b-8 border-blue-900"
            >
              <i className="fa-solid fa-cart-shopping text-3xl text-white"></i>
              <span className="text-4xl font-black tracking-tighter uppercase italic text-white">{t.buyNow}</span>
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button className="px-12 py-8 bg-zinc-900/80 hover:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center gap-3 border border-white/5 text-zinc-400 hover:text-white transition-all uppercase text-[12px] font-black active:scale-95 shadow-xl">
                <i className="fa-solid fa-share-nodes text-orange-500"></i> {t.share}
              </button>
              <button className="px-12 py-8 bg-zinc-900/80 hover:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center gap-3 border border-white/5 text-zinc-400 hover:text-white transition-all uppercase text-[12px] font-black active:scale-95 shadow-xl">
                <i className="fa-solid fa-cloud-arrow-down text-orange-500"></i> {t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="mt-20 border-t border-white/5 pt-10 flex flex-col md:flex-row items-center justify-between text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] gap-6 max-w-7xl mx-auto opacity-50">
        <div>© 2025 DIQPET LABS &bull; CLOUD-NATIVE FITTING v4.5.3</div>
        <div className="flex gap-8 items-center">
          <span className="flex items-center gap-2"><i className="fa-solid fa-server text-orange-900"></i> STATION 11-SEOUL</span>
          <span className="text-orange-900/50 bg-orange-900/5 px-3 py-1 rounded-full border border-orange-900/20">ENCRYPTED QUANTUM LINK</span>
        </div>
      </footer>
    </div>
  );
}
