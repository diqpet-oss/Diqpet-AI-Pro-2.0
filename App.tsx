import React, { useState, useRef } from 'react';
import { ImageAssets } from './types.ts';
import { generateFitting } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

const ASSETS_URLS: Record<string, string> = {
  poodle: 'https://www.diqpet.com/products/golden_retriever.jpg',
  bichon: 'https://www.diqpet.com/products/corgi.jpg',
  golden: 'https://www.diqpet.com/products/bulldog.jpg',
  happy_raincoat: 'https://www.diqpet.com/products/happy_raincoat.jpg',
  ribbed_homewear: 'https://www.diqpet.com/products/ribbed_homewear.jpg',
  winter_vest: 'https://www.diqpet.com/products/winter.jpg',
};

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('happy_series_vton');
  const [engine, setEngine] = useState<'google' | 'doubao' | 'fal'>('google');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [customPetImage, setCustomPetImage] = useState<string | null>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: ASSETS_URLS.poodle, 
    clothing: ASSETS_URLS.happy_raincoat, 
    result: null 
  });

  const fileInputRef = useRef<HTMLInputElement>(null); 
  const t = UI_STRINGS[lang];

  // 产品数据处理逻辑
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

  // 关键：高性能图片上传与压缩逻辑
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      setLoadingStep("正在压缩图片...");
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024; // 强制限制宽度
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 导出为 0.7 质量的 JPEG，极大减小体积，防止 AI 流程卡死
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setCustomPetImage(compressedBase64);
          setAssets(prev => ({ ...prev, pet: compressedBase64, result: null }));
          setSelectedBreedId('custom');
          setLoading(false);
          setLoadingStep('');
        };
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
    
    // 进度条文案，模拟串行逻辑步骤
    const progressSteps = ["AI 正在识别品种...", "提取宠物身体轮廓...", "正在智能缝制新衣...", "渲染超高清画质..."];
    let stepIdx = 0;
    setLoadingStep(progressSteps[stepIdx]);

    const interval = setInterval(() => {
      if (stepIdx < progressSteps.length - 1) {
        stepIdx++;
        setLoadingStep(progressSteps[stepIdx]);
      }
    }, 4500); 

    try {
      // 调用我们在 gemini.ts 中锁定的白底 Studio 模式
      const res = await generateFitting(engine, assets.pet, activeProduct.description, "Studio");
      
      if (res) {
        setAssets(prev => ({ ...prev, result: res }));
      } else {
        throw new Error("AI 未返回图片结果，请检查 API Key 余额");
      }
    } catch (e: any) {
      console.error("Fitting Error:", e);
      setErrorMsg(e.message || "渲染超时，请尝试换一张背景简单的图片");
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
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Quick White-Background Mode</p>
          </div>
        </div>
        <div className="flex gap-2 bg-zinc-900/80 p-1.5 rounded-2xl border border-white/5">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code as Language)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${lang === l.code ? 'bg-orange-600' : 'text-zinc-500'}`}>{l.name}</button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          {/* Step 1: Model Selection */}
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

          {/* Step 2: Apparel Selection */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black mb-5 uppercase tracking-widest text-zinc-400">Step 2: Apparel</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all ${selectedProductId === p.id ? 'bg-orange-600/20 border-orange-600/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt={p.name} />
                  <div className="text-left"><p className="text-[10px] font-bold text-zinc-100 leading-tight">{p.name}</p></div>
                </button>
              ))}
            </div>
          </section>

          {/* Engine Selector */}
          <div className="grid grid-cols-3 gap-2">
            {['google', 'doubao', 'fal'].map((id) => (
              <button key={id} onClick={() => setEngine(id as any)} className={`py-3 rounded-2xl border-2 text-[10px] font-black transition-all ${engine === id ? 'border-orange-600 bg-orange-600/10 text-orange-500' : 'border-white/5 bg-zinc-900 text-zinc-500'}`}>
                {id.toUpperCase()}
              </button>
            ))}
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

          <button onClick={() => window.open(activeProduct.url, "_blank")} className="w-full py-6 bg-[#007AFF] hover:bg-[#0062CC] rounded-[2rem] flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95">
            <i className="fa-solid fa-cart-shopping text-2xl"></i>
            <span className="text-3xl font-black italic uppercase">{t.buyNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
