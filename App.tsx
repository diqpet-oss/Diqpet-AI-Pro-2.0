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
  ribbed_homewear: 'https://www.diqpet.com/products/ribbed_homewear.jpg', // 第二个产品图
  winter_vest: 'https://www.diqpet.com/products/winter.jpg', // 第三个产品图
};

const STYLE_OPTIONS = [
  { id: 'Studio', icon: 'fa-camera-retro', name: { ko: '스튜디오', zh: '影棚', en: 'Studio' } },
  { id: 'Outdoor', icon: 'fa-tree', name: { ko: '야외공원', zh: '户外', en: 'Outdoor' } },
  { id: 'Cyberpunk', icon: 'fa-bolt-lightning', name: { ko: '사이버펑크', zh: '赛博朋克', en: 'Cyberpunk' } }
];

export default function App() {
  // --- 状态管理 ---
  const [lang, setLang] = useState<Language>('ko');
  const [selectedBreedId, setSelectedBreedId] = useState('poodle');
  const [selectedProductId, setSelectedProductId] = useState('happy_series_vton');
  const [engine, setEngine] = useState<'google' | 'doubao' | 'fal'>('google');
  const [selectedStyle, setSelectedStyle] = useState('Studio');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 持久化用户上传的图片
  const [customPetImage, setCustomPetImage] = useState<string | null>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: ASSETS_URLS.poodle, 
    clothing: ASSETS_URLS.happy_raincoat, 
    result: null 
  });

  // 关键：全局唯一声明，解决 Vercel 构建错误
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const t = UI_STRINGS[lang];

  // --- 产品数据处理 ---
// --- 产品数据处理 (已根据 translations.ts 修正 ID) ---
// --- 产品数据处理 ---
  const products = PRODUCT_DATA[lang].map(p => {
    // 1. 定义映射表：根据你的 translations.ts 里的 ID 映射图片
    const imageMap: Record<string, string> = {
      'happy_series_vton': ASSETS_URLS.happy_raincoat, // 对应第一个：冲锋衣
      '9286790289': ASSETS_URLS.ribbed_homewear,       // 对应第二个：家居服
      'v3_puffer': ASSETS_URLS.winter_vest             // 对应第三个：保暖衣
    };

    // 2. 匹配图片 URL
    let imageUrl = imageMap[p.id];
    
    // 3. 兜底逻辑：如果 ID 匹配不到，通过名称关键词模糊匹配（防止 ID 变更）
    if (!imageUrl) {
      if (p.name.includes('家居服') || p.name.includes('홈웨어') || p.name.includes('Loungewear')) {
        imageUrl = ASSETS_URLS.ribbed_homewear;
      } else if (p.name.includes('保暖衣') || p.name.includes('방한복') || p.name.includes('Thermal')) {
        imageUrl = ASSETS_URLS.winter_vest;
      } else {
        imageUrl = ASSETS_URLS.happy_raincoat; // 默认显示第一个
      }
    }
  // 3. 链接分配逻辑 (同样根据真实 ID 修正)
  let externalUrl = 'https://www.coupang.com/vp/products/9312183755'; // 默认雨衣链接
  
  if (p.id === 'v3_puffer') {
    externalUrl = 'https://www.coupang.com/vp/products/9325810280?vendorItemId=94606893258';
  } else if (p.id === '9286790289') {
    externalUrl = 'https://www.coupang.com/vp/products/9286790289'; // 这里建议填入家居服的真实链接
  }

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
    try {
      const res = await generateFitting(engine, assets.pet, activeProduct.description, selectedStyle);
      setAssets(prev => ({ ...prev, result: res }));
    } catch (e: any) {
      console.error(e);
      // 处理截图中的 404 或限流错误
      setErrorMsg(e.message || "AI Rendering Failed");
    } finally {
      setLoading(false);
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
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Next-Gen Virtual Fitting</p>
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
          
          {/* Step 1: Pet Model */}
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

              {/* 上传后的图片格子，切换后不消失 */}
              {customPetImage && (
                <button onClick={() => { setAssets(prev => ({ ...prev, pet: customPetImage, result: null })); setSelectedBreedId('custom'); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative ${selectedBreedId === 'custom' ? 'border-orange-600 scale-105' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={customPetImage} className="w-full h-full object-cover" alt="Custom upload" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white bg-orange-600 px-1 rounded shadow-sm">READY</span>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* Step 2: Apparel - 已修复图片重复问题 */}
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

          {/* AI Config */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {['google', 'doubao', 'fal'].map((id) => (
                <button key={id} onClick={() => setEngine(id as any)} className={`py-3 rounded-2xl border-2 text-[10px] font-black transition-all ${engine === id ? 'border-orange-600 bg-orange-600/10' : 'border-white/5 bg-zinc-900'}`}>
                  {id.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((s) => (
                <button key={s.id} onClick={() => setSelectedStyle(s.id)} className={`py-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${selectedStyle === s.id ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                  <i className={`fa-solid ${s.icon} text-xs`}></i>
                  <span className="text-[8px] font-black uppercase">{s.name[lang as 'zh' | 'ko' | 'en'] || s.id}</span>
                </button>
              ))}
            </div>
          </div>

          <button disabled={loading} onClick={handleGenerate} className="w-full py-6 bg-orange-600 hover:bg-orange-500 rounded-[2rem] flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95 disabled:opacity-50">
            <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl`}></i>
            <span className="text-xl font-black italic uppercase">{loading ? t.rendering : t.generate}</span>
          </button>
          
          {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-500 font-black text-center">{errorMsg}</div>}
        </div>

        {/* Display Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex-grow aspect-square md:aspect-auto md:min-h-[600px] bg-zinc-900/60 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-inner">
            <div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
               <span className="text-[9px] font-black tracking-[0.3em] text-orange-500 uppercase italic">
                {engine.toUpperCase()} AI RENDER MODE
               </span>
            </div>
            {assets.result ? (
              <img src={assets.result} className="w-full h-full object-contain p-6 animate-in zoom-in duration-500" alt="Result" />
            ) : (
              <div className="text-zinc-800 flex flex-col items-center gap-4">
                <i className="fa-solid fa-dog text-[120px] opacity-10"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">{t.waiting}</p>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center gap-6 z-20">
                <div className="w-20 h-20 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-black uppercase tracking-[0.4em] animate-pulse">{t.rendering}</p>
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
