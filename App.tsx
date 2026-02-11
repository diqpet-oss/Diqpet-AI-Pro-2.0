import React, { useState, useRef } from 'react';
import { ImageAssets } from './types.ts';
// 导入我们重写的本地逻辑函数
import { generateFitting, getLocalModelImage, getLocalApparelImage } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('9286790289'); // 默认选中产品A
  const [engine, setEngine] = useState<'google' | 'doubao' | 'fal'>('google');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [customPetImage, setCustomPetImage] = useState<string | null>(null);

  // 初始化资产：全部指向本地 getLocal 函数
  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: getLocalModelImage('poodle'), 
    clothing: getLocalApparelImage('9286790289'), 
    result: null 
  });

  const fileInputRef = useRef<HTMLInputElement>(null); 
  const t = UI_STRINGS[lang];

  // 产品数据处理：对接本地目录和 Coupang 链接
  const products = PRODUCT_DATA[lang].map(p => {
    // 自动根据 ID 映射到本地 /apparel/ 目录下的图片
    const imageUrl = getLocalApparelImage(p.id);
    // 统一 Coupang 跳转链接逻辑
    const externalUrl = `https://www.coupang.com/vp/products/${p.id}`;
    return { ...p, imageUrl, url: externalUrl };
  });

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // 自定义图片上传逻辑（保留压缩逻辑，但静态模式下仅做展示）
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      setLoadingStep("Processing...");
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
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

  // 核心生成逻辑：现在是秒级调取本地 /assets/fittings/
  const handleGenerate = async () => {
    if (selectedBreedId === 'custom') {
      setErrorMsg("抱歉，静态模式目前仅支持预设模特。请选择预设狗狗进行试衣。");
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setLoadingStep("Searching high-quality result...");

    try {
      // 这里的 assets.pet 现在传递的是 petId，activeProduct.id 是 Coupang ID
      const res = await generateFitting(engine, selectedBreedId, selectedProductId);
      
      if (res) {
        setAssets(prev => ({ ...prev, result: res }));
      }
    } catch (e: any) {
      setErrorMsg("图片调取失败，请检查文件名是否正确");
    } finally {
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
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Local Static Assets Mode</p>
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
          {/* Step 1: Model Selection (指向本地 /models/) */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Step 1: Pet Model</h2>
              <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-orange-600 transition-all">
                <i className="fa-solid fa-upload mr-2"></i>UPLOAD
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
            </div>

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
              {customPetImage && (
                <button onClick={() => { setAssets(prev => ({ ...prev, pet: customPetImage, result: null })); setSelectedBreedId('custom'); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative ${selectedBreedId === 'custom' ? 'border-orange-600 scale-105' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={customPetImage} className="w-full h-full object-cover" alt="Custom" />
                </button>
              )}
            </div>
          </section>

          {/* Step 2: Apparel Selection (指向本地 /apparel/) */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black mb-5 uppercase tracking-widest text-zinc-400">Step 2: Apparel</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { 
                  setSelectedProductId(p.id); 
                  setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); 
                }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all ${selectedProductId === p.id ? 'bg-orange-600/20 border-orange-600/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt={p.name} />
                  <div className="text-left"><p className="text-[10px] font-bold text-zinc-100 leading-tight">{p.name}</p></div>
                </button>
              ))}
            </div>
          </section>

          <button disabled={loading} onClick={handleGenerate} className="w-full py-6 bg-orange-600 hover:bg-orange-500 rounded-[2rem] flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 disabled:opacity-50">
            <div className="flex items-center gap-4">
               <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl`}></i>
               <span className="text-xl font-black italic uppercase">{loading ? t.rendering : t.generate}</span>
            </div>
          </button>
          
          {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-500 font-black text-center">{errorMsg}</div>}
        </div>

        {/* Display Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[600px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-inner">
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center">
                  <div className="w-24 h-24 relative">
                    <div className="absolute inset-0 border-4 border-orange-600/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-orange-600 rounded-full animate-spin"></div>
                    <i className="fa-solid fa-dog absolute inset-0 m-auto w-fit h-fit text-3xl text-orange-600 animate-pulse"></i>
                  </div>
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
