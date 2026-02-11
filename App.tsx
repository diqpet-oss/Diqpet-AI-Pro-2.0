import React, { useState } from 'react';
import { ImageAssets } from './types.ts';
// 导入自定义的静态调取函数
import { generateFitting, getLocalModelImage, getLocalApparelImage } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('9286790289'); // 默认选中产品 A
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 初始化资产：使用本地函数获取路径
  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: getLocalModelImage('poodle'), 
    clothing: getLocalApparelImage('9286790289'), 
    result: null 
  });

  const t = UI_STRINGS[lang];

  // 处理产品数据：映射本地图片与 Coupang 链接
  const products = PRODUCT_DATA[lang].map(p => {
    const imageUrl = getLocalApparelImage(p.id);
    const externalUrl = `https://www.coupang.com/vp/products/${p.id}`;
    return { ...p, imageUrl, url: externalUrl };
  });

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // 核心功能：生成试衣结果（调取本地成品图）
  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg('');
    setLoadingStep(t.rendering || "Rendering...");

    try {
      // 直接从本地目录匹配：品种_产品级别.png
      const res = await generateFitting('google', selectedBreedId, selectedProductId);
      
      if (res) {
        setAssets(prev => ({ ...prev, result: res }));
      } else {
        throw new Error("Local asset not found");
      }
    } catch (e: any) {
      console.error("Fitting Error:", e);
      setErrorMsg("Failed to load result image.");
    } finally {
      // 模拟 600ms 加载动画，提升用户交互体验
      setTimeout(() => {
        setLoading(false);
        setLoadingStep('');
      }, 600);
    }
  };

  // 功能：下载结果图
  const handleDownload = async () => {
    if (!assets.result) return;
    try {
      const response = await fetch(assets.result);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diqpet_${selectedBreedId}_${selectedProductId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed. Please long-press the image to save.");
    }
  };

  // 功能：分享链接
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DIQPET AI Fitting',
          text: 'Look at this amazing pet fitting result!',
          url: window.location.href,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      // 降级处理：复制链接到剪贴板
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center shadow-2xl">
            <i className="fa-solid fa-wand-magic-sparkles text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">DIQPET <span className="text-orange-500">AI</span></h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Virtual Pet Fitting Lab</p>
          </div>
        </div>
        <div className="flex gap-2 bg-zinc-900/80 p-1.5 rounded-2xl border border-white/5">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code as Language)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${lang === l.code ? 'bg-orange-600 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>{l.name}</button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧控制区 */}
        <div className="lg:col-span-4 space-y-6">
          {/* Step 1: 模特选择 */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-5">{t.step1}</h2>
            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden', 'jindo'].map(id => (
                <button key={id} onClick={() => { 
                  setSelectedBreedId(id);
                  setAssets(prev => ({ ...prev, pet: getLocalModelImage(id), result: null })); 
                }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-lg shadow-orange-600/20' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={getLocalModelImage(id)} className="w-full h-full object-cover" alt={id} />
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: 衣服选择 */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black mb-5 uppercase tracking-widest text-zinc-400">{t.step2}</h2>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { 
                  setSelectedProductId(p.id); 
                  setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); 
                }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all ${selectedProductId === p.id ? 'bg-orange-600/20 border-orange-600/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <img src={p.imageUrl} className="w-14 h-14 rounded-xl object-cover" alt={p.name} />
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-zinc-100 leading-tight">{p.name}</p>
                    <p className="text-[9px] text-zinc-500 mt-1 line-clamp-1">{p.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 生成按钮 */}
          <button disabled={loading} onClick={handleGenerate} className="w-full py-6 bg-orange-600 hover:bg-orange-500 rounded-[2rem] flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 disabled:opacity-50">
             <div className="flex items-center gap-3">
                <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl`}></i>
                <span className="text-xl font-black italic uppercase">{loading ? t.rendering : t.generate}</span>
             </div>
          </button>
          
          {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-500 font-black text-center">{errorMsg}</div>}
        </div>

        {/* 右侧展示区 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[600px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-inner">
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
                  <div className="w-20 h-20 relative">
                    <div className="absolute inset-0 border-4 border-orange-600/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-orange-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="mt-6 text-orange-500 font-black italic uppercase tracking-widest animate-pulse">{loadingStep}</p>
              </div>
            )}

            {assets.result ? (
              <img src={assets.result} className="w-full h-full object-contain p-8 animate-in zoom-in duration-500" alt="Result" />
            ) : (
              <div className="text-zinc-800 flex flex-col items-center gap-4">
                <i className="fa-solid fa-dog text-[140px] opacity-10"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">{t.waiting}</p>
              </div>
            )}
          </div>

          {/* 功能组按钮 */}
          <div className="flex gap-4">
            <button 
              onClick={() => window.open(activeProduct.url, "_blank")} 
              className="flex-grow py-6 bg-[#007AFF] hover:bg-[#0062CC] rounded-[2.5rem] flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
            >
              <i className="fa-solid fa-cart-shopping text-2xl"></i>
              <span className="text-2xl font-black italic uppercase">{t.buyNow}</span>
            </button>

            <button 
              onClick={handleDownload}
              title={t.save}
              className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all border border-white/10 active:scale-90 shadow-xl"
            >
              <i className="fa-solid fa-download text-xl"></i>
            </button>

            <button 
              onClick={handleShare}
              title={t.share}
              className="w-20 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all border border-white/10 active:scale-90 shadow-xl"
            >
              <i className="fa-solid fa-share-nodes text-xl"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
