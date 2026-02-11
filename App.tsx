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
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
            </div>
            <div className="hidden xs:block leading-none">
              <h1 className="text-xl font-black tracking-tighter italic uppercase">DIQPET <span className="text-orange-500">AI</span></h1>
            </div>
          </div>
          
          {/* 新增：官网链接 */}
          <a href="https://www.diqpet.com" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-2 border-l border-white/10 pl-6">
            <i className="fa-solid fa-house"></i>
            <span>Home</span>
          </a>
        </div>

        {/* 语言下拉 */}
        <div className="relative" ref={langRef}>
          <button onClick={() => setIsLangOpen(!isLangOpen)} className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800 transition-all text-xs font-bold">
            {LANGUAGES.find(l => l.code === lang)?.name}
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
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* 左侧选择面板 */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-zinc-900/30 p-5 rounded-[2.5rem] border border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-5 px-1">{t.step1}</h2>
            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden', 'jindo'].map(id => (
                <button key={id} onClick={() => { setSelectedBreedId(id); setAssets(prev => ({ ...prev, pet: getLocalModelImage(id), result: null })); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-xl' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={getLocalModelImage(id)} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-zinc-900/30 p-5 rounded-[2.5rem] border border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-5 px-1">{t.step2}</h2>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-2 rounded-2xl border transition-all ${selectedProductId === p.id ? 'bg-orange-600/10 border-orange-600/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div className="text-left"><p className="text-[11px] font-black text-zinc-100">{p.name}</p></div>
                </button>
              ))}
            </div>
          </section>

          <button disabled={loading} onClick={handleGenerate} className="w-full py-5 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98] disabled:opacity-50">
            <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-lg`}></i>
            <span className="text-lg font-black italic uppercase tracking-tight">{loading ? t.rendering : t.generate}</span>
          </button>
        </div>

        {/* 右侧预览及功能按钮 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[500px] bg-zinc-900/50 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-2xl">
            {loading && <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="w-10 h-10 border-4 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div></div>}
            {assets.result ? <img src={assets.result} className="w-full h-full object-contain p-8 animate-in zoom-in-95" alt="" /> : <i className="fa-solid fa-dog text-[100px] text-white/5"></i>}
          </div>

          {/* 重点优化：底部按钮布局 */}
          <div className="flex flex-col sm:flex-row gap-4 h-auto sm:h-20">
            {/* Coupang 购买 - 占据主要空间 */}
            <button onClick={() => window.open(activeProduct.url, "_blank")} 
              className="flex-grow h-20 bg-[#007AFF] hover:bg-[#0062CC] rounded-[1.5rem] flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 group">
              <i className="fa-solid fa-cart-shopping text-2xl group-hover:animate-bounce"></i>
              <span className="text-xl font-black italic uppercase tracking-tight">{t.buyNow}</span>
            </button>

            {/* 下载与分享 - 手机端保持比例，PC端保持高度对齐 */}
            <div className="flex gap-4 h-20">
              <button title="Download" className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-[1.5rem] flex items-center justify-center transition-all border border-white/5 active:scale-90">
                <i className="fa-solid fa-download text-xl"></i>
              </button>
              <button title="Share" className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-[1.5rem] flex items-center justify-center transition-all border border-white/5 active:scale-90">
                <i className="fa-solid fa-share-nodes text-xl"></i>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-zinc-900/10 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">&copy; 2026 DIQPET LAB. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
            <a href="https://www.diqpet.com" className="hover:text-white transition-colors">Official Website</a>
            <span className="text-zinc-800">|</span>
            <span>Virtual Fitting Room v2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
