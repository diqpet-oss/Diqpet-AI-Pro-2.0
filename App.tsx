import React, { useState, useRef } from 'react';
import { ImageAssets } from './types.ts';
import { generateFitting } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

// 资源链接配置
const ASSETS_URLS: Record<string, string> = {
  poodle: 'https://www.diqpet.com/products/golden_retriever.jpg',
  bichon: 'https://www.diqpet.com/products/corgi.jpg',
  golden: 'https://www.diqpet.com/products/bulldog.jpg',
  happy_raincoat: 'https://www.diqpet.com/products/happy_raincoat.jpg',
  ribbed_homewear: 'https://www.diqpet.com/products/ribbed_homewear.jpg',
  winter_vest: 'https://www.diqpet.com/products/winter.jpg',
};

const STYLE_OPTIONS = [
  { id: 'Studio', icon: 'fa-camera-retro', name: { ko: '스튜디오', zh: '影棚', en: 'Studio' } },
  { id: 'Outdoor', icon: 'fa-tree', name: { ko: '야외공원', zh: '户外', en: 'Outdoor' } },
  { id: 'Cyberpunk', icon: 'fa-bolt-lightning', name: { ko: '사이버펑크', zh: '赛博朋克', en: 'Cyberpunk' } }
];

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('happy_series_vton');
  const [engine, setEngine] = useState<'google' | 'doubao' | 'fal'>('google');
  const [selectedStyle, setSelectedStyle] = useState('Studio');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // 新增：用于显示具体执行到了哪一步
  const [errorMsg, setErrorMsg] = useState('');
  const [customPetImage, setCustomPetImage] = useState<string | null>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: ASSETS_URLS.poodle, 
    clothing: ASSETS_URLS.happy_raincoat, 
    result: null 
  });

  const fileInputRef = useRef<HTMLInputElement>(null); 
  const t = UI_STRINGS[lang];

  // --- 产品数据处理 ---
  const products = PRODUCT_DATA[lang].map(p => {
    const imageMap: Record<string, string> = {
      'happy_series_vton': ASSETS_URLS.happy_raincoat,
      '9286790289': ASSETS_URLS.ribbed_homewear,
      'v3_puffer': ASSETS_URLS.winter_vest
    };
    let imageUrl = imageMap[p.id] || ASSETS_URLS.happy_raincoat;
    let externalUrl = p.id === 'v3_puffer' ? 'https://www.coupang.com/vp/products/9325810280' : `https://www.coupang.com/vp/products/${p.id}`;
    return { ...p, imageUrl, url: externalUrl };
  });

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // --- 交互逻辑 ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomPetImage(base64String); 
        setAssets(prev => ({ ...prev, pet: base64String, result: null }));
        setSelectedBreedId('custom');
      };
      reader.readAsDataURL(file);
    }
  };

const handleGenerate = async () => {
  if (!assets.pet) {
    setErrorMsg(t.petNotSelected);
    return;
  }

  setLoading(true);
  setErrorMsg('');
  
  const progressSteps = engine === 'google' 
    ? ["Step 1: Gemini 正在识别宠物特征...", "Step 2: SAM 正在锁定身体位置...", "Step 3: Flux 正在缝制新衣服..."]
    : ["Step 1: 正在生成智能掩码...", "Step 2: 正在重绘宠物服饰..."];

  let stepIdx = 0;
  setLoadingStep(progressSteps[stepIdx]);

  // 使用 ref 或局部变量确保定时器在 catch 中也能被捕获清理
  const interval = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, progressSteps.length - 1);
    setLoadingStep(progressSteps[stepIdx]);
  }, 6000);

  try {
    // 💡 建议：如果 assets.pet 是 Base64 且体积过大，在此处可以增加一个简单的压缩逻辑
    const res = await generateFitting(engine, assets.pet, activeProduct.description, selectedStyle);
    
    if (res) {
      setAssets(prev => ({ ...prev, result: res }));
    } else {
      throw new Error("AI 未返回图片结果");
    }
  } catch (e: any) {
    console.error("Fitting Error:", e);
    // 处理特定的错误，例如 API 余额不足或超时
    if (e.message?.includes('402')) {
      setErrorMsg("API 余额不足，请联系管理员");
    } else if (e.message?.includes('timeout')) {
      setErrorMsg("请求超时，可能是图片太大了");
    } else {
      setErrorMsg(e.message || "渲染失败，请重试");
    }
  } finally {
    clearInterval(interval);
    setLoading(false);
    setLoadingStep('');
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
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Identity-Preserved Fitting</p>
          </div>
        </div>
        <div className="flex gap-2 bg-zinc-900/80 p-1.5 rounded-2xl border border-white/5">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code as Language)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${lang === l.code ? 'bg-orange-600' : 'text-zinc-500'}`}>{l.name}</button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Step 1: Pet Model</h2>
              <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-orange-600 transition-all">
                <i className="fa-solid fa-upload mr-2"></i>UPLOAD
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden'].map(id => (
                <button key={id} onClick={() => { setAssets(prev => ({ ...prev, pet: ASSETS_URLS[id], result: null })); setSelectedBreedId(id); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-lg shadow-orange-600/20' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={ASSETS_URLS[id]} className="w-full h-full object-cover" alt={id} />
                </button>
              ))}
              {customPetImage && (
                <button onClick={() => { setAssets(prev => ({ ...prev, pet: customPetImage, result: null })); setSelectedBreedId('custom'); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative ${selectedBreedId === 'custom' ? 'border-orange-600 scale-105' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={customPetImage} className="w-full h-full object-cover" alt="Custom upload" />
                </button>
              )}
            </div>
          </section>

          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black mb-5 uppercase tracking-widest text-zinc-400">Step 2: Apparel</h2>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all ${selectedProductId === p.id ? 'bg-orange-600/20 border-orange-600/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt={p.name} />
                  <div className="text-left"><p className="text-[10px] font-bold text-zinc-100 leading-tight">{p.name}</p></div>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {['google', 'doubao', 'fal'].map((id) => (
                <button key={id} onClick={() => setEngine(id as any)} className={`py-3 rounded-2xl border-2 text-[10px] font-black transition-all ${engine === id ? 'border-orange-600 bg-orange-600/10 text-orange-500' : 'border-white/5 bg-zinc-900 text-zinc-500'}`}>
                  {id.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((s) => (
                <button key={s.id} onClick={() => setSelectedStyle(s.id)} className={`py-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${selectedStyle === s.id ? 'bg-white text-black border-white' : 'bg-white/5 text-zinc-500 border-white/5 hover:text-zinc-300'}`}>
                  <i className={`fa-solid ${s.icon} text-xs`}></i>
                  <span className="text-[8px] font-black uppercase">{s.name[lang] || s.id}</span>
                </button>
              ))}
            </div>
          </div>

          <button disabled={loading} onClick={handleGenerate} className="w-full py-6 bg-orange-600 hover:bg-orange-500 rounded-[2rem] flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 disabled:opacity-50">
            <div className="flex items-center gap-4">
               <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl`}></i>
               <span className="text-xl font-black italic uppercase">{loading ? t.rendering : t.generate}</span>
            </div>
            {loadingStep && <span className="text-[9px] font-bold mt-1 opacity-60 uppercase tracking-widest">{loadingStep}</span>}
          </button>
          
          {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-500 font-black text-center">{errorMsg}</div>}
        </div>

        {/* Right Side: Display Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[600px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-inner">
            
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center">
                 <div className="w-24 h-24 relative">
                    <div className="absolute inset-0 border-4 border-orange-600/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-orange-600 rounded-full animate-spin"></div>
                    <i className="fa-solid fa-dog absolute inset-0 m-auto w-fit h-fit text-3xl text-orange-600 animate-pulse"></i>
                 </div>
                 <p className="mt-6 text-orange-500 font-black italic uppercase tracking-widest animate-pulse">{loadingStep || 'Processing...'}</p>
              </div>
            )}

            {assets.result ? (
              <img src={assets.result} className="w-full h-full object-contain p-6 animate-in zoom-in duration-500" alt="Result" />
            ) : (
              <div className="text-zinc-800 flex flex-col items-center gap-4">
                <i className="fa-solid fa-dog text-[120px] opacity-10"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">{t.waiting}</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {assets.result && !loading && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
              <button onClick={() => {
                const link = document.createElement('a');
                link.href = assets.result!;
                link.download = `DIQPET_VTON_${Date.now()}.png`;
                link.click();
              }} className="py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/5 active:scale-95">
                <i className="fa-solid fa-download text-lg text-orange-500"></i>
                <span className="text-sm font-bold uppercase">{t.save}</span>
              </button>
              
              <button onClick={async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: 'DIQPET AI', text: 'Check out my pet style!', url: window.location.href }); } catch {}
                } else { alert('Link copied!'); }
              }} className="py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/5 active:scale-95">
                <i className="fa-solid fa-share-nodes text-lg text-orange-500"></i>
                <span className="text-sm font-bold uppercase">{t.share}</span>
              </button>
            </div>
          )}

          {/* Buy Button */}
          <button onClick={() => window.open(activeProduct.url, "_blank")} className="w-full py-6 bg-[#007AFF] hover:bg-[#0062CC] rounded-[2rem] flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95">
            <i className="fa-solid fa-cart-shopping text-2xl"></i>
            <span className="text-3xl font-black italic uppercase">{t.buyNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
