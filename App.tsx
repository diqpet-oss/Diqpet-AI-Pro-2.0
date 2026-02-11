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
  const langRef = useRef<HTMLDivElement>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: getLocalModelImage('poodle'), 
    clothing: getLocalApparelImage('9286790289'), 
    result: null 
  });

  const t = UI_STRINGS[lang];

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
    try {
      const res = await generateFitting('google', selectedBreedId, selectedProductId);
      if (res) setAssets(prev => ({ ...prev, result: res }));
    } catch (e) { console.error(e); }
    finally { setTimeout(() => setLoading(false), 800); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
      {/* Header - 强化文字展示，填充空间 */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex items-center justify-between relative z-50 border-b border-white/5">
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Logo 区域 - 无论手机还是PC都保留完整文字 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20 flex-shrink-0">
              <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
            </div>
            <div className="leading-tight">
              <h1 className="text-lg sm:text-xl font-black tracking-tighter italic uppercase whitespace-nowrap">
                DIQPET <span className="text-orange-500">AI</span>
              </h1>
              <p className="text-[7px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                Virtual Pet Fitting Lab
              </p>
            </div>
          </div>
          
          {/* 官网链接 - 增加视觉占位 */}
          <div className="hidden md:flex items-center gap-6 border-l border-white/10 pl-6">
            <a href="https://www.diqpet.com" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-orange-500 transition-colors flex items-center gap-2">
              <i className="fa-solid fa-house text-[8px]"></i>
              <span>Home</span>
            </a>
            <span className="text-zinc-800 text-xs">/</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500/80 cursor-default">Fitting Room</span>
          </div>
        </div>

        {/* 语言选择与移动端Home图标 */}
        <div className="flex items-center gap-3">
          <a href="https://www.diqpet.com" className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 border border-white/5 text-zinc-400">
            <i className="fa-solid fa-house text-sm"></i>
          </a>
          <div className="relative" ref={langRef}>
            <button onClick={() => setIsLangOpen(!isLangOpen)} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800 transition-all text-[11px] font-bold">
              <span className="uppercase">{lang === 'ko' ? '한국어' : lang === 'zh' ? '简体中文' : 'English'}</span>
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${isLangOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-1">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code as Language); setIsLangOpen(false); }}
                    className={`w-full px-4 py-3 text-left text-[11px] font-bold transition-colors hover:bg-white/5 ${lang === l.code ? 'text-orange-500' : 'text-zinc-400'}`}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 mb-12">
        {/* 左侧选择面板 */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-zinc-900/30 p-5 rounded-[2.5rem] border border-white/5 shadow-inner">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-5 px-1 flex items-center gap-2">
              <span className="w-4 h-px bg-zinc-800"></span>{t.step1}
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden', 'jindo'].map(id => (
                <button key={id} onClick={() => { setSelectedBreedId(id); setAssets(prev => ({ ...prev, pet: getLocalModelImage(id), result: null })); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-xl shadow-orange-600/20' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={getLocalModelImage(id)} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-zinc-900/30 p-5 rounded-[2.5rem] border border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-5 px-1 flex items-center gap-2">
              <span className="w-4 h-px bg-zinc-800"></span>{t.step2}
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-2 rounded-2xl border transition-all ${selectedProductId === p.id ? 'bg-orange-600/10 border-orange-600/30 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
                  <div className="text-left flex-grow truncate">
                    <p className="text-[11px] font-black text-zinc-100 truncate">{p.name}</p>
                    <p className="text-[9px] text-zinc-500 truncate opacity-60">Professional Apparel</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <button disabled={loading} onClick={handleGenerate} className="w-full py-5 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98] disabled:opacity-50 group">
            <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-lg group-hover:rotate-12 transition-transform`}></i>
            <span className="text-lg font-black italic uppercase tracking-tight">{loading ? t.rendering : t.generate}</span>
          </button>
        </div>

        {/* 右侧预览及功能按钮 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[550px] bg-zinc-900/50 rounded-[3.5rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-2xl">
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-600/20 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 animate-pulse">{t.rendering}</p>
              </div>
            )}
            {assets.result ? (
              <img src={assets.result} className="w-full h-full object-contain p-8 animate-in zoom-in-95 duration-500" alt="Fitting Result" />
            ) : (
              <div className="flex flex-col items-center gap-6 opacity-10">
                <i className="fa-solid fa-dog text-[120px]"></i>
                <p className="text-xs font-black uppercase tracking-[0.5em]">{t.waiting}</p>
              </div>
            )}
          </div>

          {/* 底部功能组合 - 优化按钮比例与对齐 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => window.open(activeProduct.url, "_blank")} 
              className="flex-grow h-20 bg-[#007AFF] hover:bg-[#0062CC] rounded-[1.8rem] flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 group order-1"
            >
              <i className="fa-solid fa-cart-shopping text-2xl group-hover:scale-110 transition-transform"></i>
              <span className="text-xl font-black italic uppercase tracking-tight">{t.buyNow}</span>
            </button>

            <div className="flex gap-4 h-20 order-2">
              <button 
                onClick={() => {/* 下载逻辑 */}}
                className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-[1.8rem] flex items-center justify-center transition-all border border-white/5 active:scale-90 group"
              >
                <i className="fa-solid fa-download text-xl group-hover:translate-y-0.5 transition-transform"></i>
              </button>
              <button 
                onClick={() => {/* 分享逻辑 */}}
                className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-[1.8rem] flex items-center justify-center transition-all border border-white/5 active:scale-90 group"
              >
                <i className="fa-solid fa-share-nodes text-xl group-hover:scale-110 transition-transform"></i>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-zinc-900/10 py-10 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2 opacity-40">
            <h3 className="text-xs font-black tracking-tighter italic uppercase">DIQPET <span className="text-white">AI</span></h3>
            <p className="text-[10px] font-medium tracking-wide">&copy; 2026 DIQPET LAB. ALL RIGHTS RESERVED.</p>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-zinc-600">
            <a href="https://www.diqpet.com" className="hover:text-orange-500 transition-colors">Official Home</a>
            <span className="opacity-20">|</span>
            <span className="cursor-default">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
