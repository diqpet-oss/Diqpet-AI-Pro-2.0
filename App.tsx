import React, { useState, useRef, useEffect } from 'react';
import { ImageAssets } from './types.ts';
import { generateFitting, getLocalModelImage, getLocalApparelImage } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('9286790289');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const langRef = useRef<HTMLDivElement>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: getLocalModelImage('poodle'), 
    clothing: getLocalApparelImage('9286790289'), 
    result: null 
  });

  const t = UI_STRINGS[lang];

  // 点击外部关闭语言下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setIsLangOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const products = PRODUCT_DATA[lang].map(p => ({
    ...p,
    imageUrl: getLocalApparelImage(p.id),
    url: `https://www.coupang.com/vp/products/${p.id}`
  }));

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await generateFitting('google', selectedBreedId, selectedProductId);
      if (res) setAssets(prev => ({ ...prev, result: res }));
    } catch (e) {
      setErrorMsg("Error loading result.");
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  const handleDownload = async () => {
    if (!assets.result) return;
    const link = document.createElement('a');
    link.href = assets.result;
    link.download = `diqpet_fitting.png`;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      navigator.share({ title: 'DIQPET AI', url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied!");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black tracking-tighter italic uppercase">DIQPET <span className="text-orange-500">AI</span></h1>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Virtual Fitting Lab</p>
          </div>
        </div>

        {/* 语言下拉列表 */}
        <div className="relative" ref={langRef}>
          <button 
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl hover:bg-zinc-800 transition-all shadow-xl"
          >
            <span className="text-sm font-bold">{LANGUAGES.find(l => l.code === lang)?.name}</span>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isLangOpen ? 'rotate-180' : ''}`}></i>
          </button>
          
          {isLangOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              {LANGUAGES.map(l => (
                <button 
                  key={l.code} 
                  onClick={() => { setLang(l.code as Language); setIsLangOpen(false); }}
                  className={`w-full px-5 py-3 text-left text-xs font-bold transition-colors hover:bg-orange-600/10 ${lang === l.code ? 'text-orange-500 bg-orange-600/5' : 'text-zinc-400'}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 控制面板 */}
        <div className="lg:col-span-4 space-y-6">
          {/* Step 1: Model */}
          <section className="bg-zinc-900/40 p-5 rounded-[2rem] border border-white/5 shadow-inner">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 px-2">{t.step1}</h2>
            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden', 'jindo'].map(id => (
                <button key={id} onClick={() => { setSelectedBreedId(id); setAssets(prev => ({ ...prev, pet: getLocalModelImage(id), result: null })); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={getLocalModelImage(id)} className="w-full h-full object-cover" alt={id} />
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Product */}
          <section className="bg-zinc-900/40 p-5 rounded-[2rem] border border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 px-2">{t.step2}</h2>
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-2.5 rounded-2xl border transition-all ${selectedProductId === p.id ? 'bg-orange-600/10 border-orange-600/40' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div className="text-left flex-grow">
                    <p className="text-[11px] font-black text-zinc-100">{p.name}</p>
                    <p className="text-[9px] text-zinc-500 line-clamp-1">{p.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 生成按钮 */}
          <button 
            disabled={loading} 
            onClick={handleGenerate} 
            className="w-full py-5 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98] disabled:opacity-50"
          >
            <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-lg`}></i>
            <span className="text-lg font-black italic uppercase tracking-tight">{loading ? t.rendering : t.generate}</span>
          </button>
        </div>

        {/* 预览展示区 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[550px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-2xl">
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">{t.rendering}</p>
                </div>
              </div>
            )}
            
            {assets.result ? (
              <img src={assets.result} className="w-full h-full object-contain p-8 animate-in zoom-in-95 duration-500" alt="Result" />
            ) : (
              <div className="text-zinc-800 flex flex-col items-center gap-4 opacity-20">
                <i className="fa-solid fa-dog text-[120px]"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">{t.waiting}</p>
              </div>
            )}
          </div>

          {/* 底部按钮组 - 手机端对齐优化 */}
          <div className="grid grid-cols-4 sm:flex gap-3">
            <button 
              onClick={() => window.open(activeProduct.url, "_blank")} 
              className="col-span-2 sm:flex-grow py-5 bg-[#007AFF] hover:bg-[#0062CC] rounded-full flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
            >
              <i className="fa-solid fa-cart-shopping text-xl"></i>
              <span className="text-base sm:text-lg font-black italic uppercase whitespace-nowrap">{t.buyNow}</span>
            </button>

            <button 
              onClick={handleDownload}
              className="col-span-1 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 shadow-lg"
            >
              <i className="fa-solid fa-download text-lg"></i>
            </button>

            <button 
              onClick={handleShare}
              className="col-span-1 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 shadow-lg"
            >
              <i className="fa-solid fa-share-nodes text-lg"></i>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
