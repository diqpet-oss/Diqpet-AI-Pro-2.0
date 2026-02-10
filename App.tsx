import React, { useState, useRef } from 'react';
import { ImageAssets } from './types.ts';
import { generateFitting } from './services/gemini.ts';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations.ts';

// 1. 资源链接定义
const ASSETS_URLS: Record<string, string> = {
  poodle: 'https://www.diqpet.com/products/golden_retriever.jpg',
  bichon: 'https://www.diqpet.com/products/corgi.jpg',
  golden: 'https://www.diqpet.com/products/bulldog.jpg',
  happy_raincoat: 'https://www.diqpet.com/products/happy_raincoat.jpg',
  ribbed_homewear: 'https://www.diqpet.com/products/ribbed_homewear.jpg', // 第二张图
  winter_vest: 'https://www.diqpet.com/products/winter.jpg', // 第三张图
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
  const [errorMsg, setErrorMsg] = useState('');
  
  // 持久化自定义上传图片
  const [customPetImage, setCustomPetImage] = useState<string | null>(null);

  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: ASSETS_URLS.poodle, 
    clothing: ASSETS_URLS.happy_raincoat, 
    result: null 
  });

  // 修复：此处仅声明一次，彻底解决 Vercel "fileInputRef has already been declared" 报错
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const t = UI_STRINGS[lang];

  // 2. 核心修复：产品图匹配逻辑
  // 请确保 translations.ts 中的 ID 与下方判断完全一致
  const products = PRODUCT_DATA[lang].map(p => {
    let imageUrl = ASSETS_URLS.happy_raincoat; // 默认第一张
    let externalUrl = `https://www.coupang.com/vp/products/${p.id}`;

    if (p.id === 'happy_series_vton') {
      imageUrl = ASSETS_URLS.happy_raincoat;
      externalUrl = 'https://www.coupang.com/vp/products/9312183755';
    } 
    else if (p.id === 'ribbed_homewear' || p.name.includes('골지') || p.name.includes('Lounge')) {
      imageUrl = ASSETS_URLS.ribbed_homewear; // 修复第二张图
    } 
    else if (p.id === 'winter_padding_vest' || p.name.includes('Padding') || p.name.includes('윈터')) {
      imageUrl = ASSETS_URLS.winter_vest; // 修复第三张图
      externalUrl = 'https://www.coupang.com/vp/products/9325810280?vendorItemId=94606893258';
    }

    return { ...p, imageUrl, url: externalUrl };
  });

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

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
      // 如果遇到 404，请确认 gemini.ts 中使用的是 "gemini-1.5-flash"
      const res = await generateFitting(engine, assets.pet, activeProduct.description, selectedStyle);
      setAssets(prev => ({ ...prev, result: res }));
    } catch (e: any) {
      // 捕获并显示截图中的 API 错误信息
      setErrorMsg(e.message || "AI Rendering Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8">
      {/* Header 省略...保持原样 */}
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          
          {/* Step 1: Pet Model */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-black uppercase text-zinc-400">Step 1: Pet Model</h2>
              <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-orange-600">
                <i className="fa-solid fa-upload mr-2"></i>UPLOAD
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {['poodle', 'bichon', 'golden'].map(id => (
                <button key={id} onClick={() => { setAssets(prev => ({ ...prev, pet: ASSETS_URLS[id], result: null })); setSelectedBreedId(id); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedBreedId === id ? 'border-orange-600 scale-105 shadow-orange-600/20 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                  <img src={ASSETS_URLS[id]} className="w-full h-full object-cover" alt={id} />
                </button>
              ))}

              {/* 上传后的格子，即使切换也会保留 */}
              {customPetImage && (
                <button onClick={() => { setAssets(prev => ({ ...prev, pet: customPetImage, result: null })); setSelectedBreedId('custom'); }}
                  className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all relative ${selectedBreedId === 'custom' ? 'border-orange-600 scale-105' : 'border-transparent opacity-40'}`}>
                  <img src={customPetImage} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white bg-orange-600 px-1 rounded">READY</span>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* Step 2: Apparel - 已修复三张图重复问题 */}
          <section className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black mb-5 uppercase text-zinc-400">Step 2: Apparel</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setAssets(prev => ({ ...prev, clothing: p.imageUrl, result: null })); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-[1.5rem] border transition-all ${selectedProductId === p.id ? 'bg-orange-600/20 border-orange-600/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt={p.name} />
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-zinc-100 leading-tight uppercase opacity-50 mb-1">{p.id.split('_')[0]}</p>
                    <p className="text-[11px] font-black text-white leading-tight">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 其他配置按钮及生成按钮保持原样... */}
          <div className="space-y-4">
             {/* Engine Select... Style Select... */}
             <button disabled={loading} onClick={handleGenerate} className="w-full py-6 bg-orange-600 hover:bg-orange-500 rounded-[2rem] flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95 disabled:opacity-50">
                <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'} text-xl`}></i>
                <span className="text-xl font-black italic uppercase">{loading ? t.rendering : t.generate}</span>
             </button>
          </div>

          {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-500 font-bold text-center leading-relaxed">{errorMsg}</div>}
        </div>

        {/* Display Area 保持原样... */}
      </div>
    </div>
  );
}
