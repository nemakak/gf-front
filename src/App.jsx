import React, { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gf-backend-uc51.onrender.com';
const PROXY_URL = 'https://gf-images.maxgamingbrawlstars.workers.dev';

const CATEGORIES = [
  { key: 'all',       label: 'Все',            emoji: '✨' },
  { key: 'top',       label: 'Верх',           emoji: '👕' },
  { key: 'bottom',    label: 'Низ',            emoji: '👖' },
  { key: 'outerwear', label: 'Верхняя одежда', emoji: '🧥' },
  { key: 'suit',      label: 'Костюмы',        emoji: '🥼' },
  { key: 'dress',     label: 'Платья',         emoji: '👗' },
  { key: 'autumn',    label: 'Осень',          emoji: '🍂' },
];

const SUBS = [
  { id: 'pro', emoji: '💎', name: 'PRО', subtitle: 'Максимум', priceOld: 999, priceNew: 599, accent: '#D4B595',
    features: [
            { icon: '👗', text: '30 обычных примерок' },
      { icon: '📦', text: '10 примерок своих товаров' },
      { icon: '💬', text: '1 консультация стилиста' },
    ]},
  { id: 'start', emoji: '👌', name: 'START', subtitle: 'Для знакомства', priceOld: 119, priceNew: 65, accent: '#8A6E52',
    features: [
      { icon: '👗', text: '10 обычных примерок' },
      { icon: '💬', text: '1 консультация стилиста' },
    ]},
];

const FALLBACK = [
  { id: 1, wb_id: 183581368, name: 'Платье Y2K миди', price: '3 990 ₽', category: 'dress',
    image_url: 'https://spb-basket-cdn-03.geobasket.ru/vol1835/part183581/183581368/images/hq/1.webp',
    fallback_url: 'https://basket-13.wbbasket.ru/vol1835/part183581/183581368/images/big/1.webp' },
];

const HINTS = [
  'ИИ подбирает образ…',
  'Почти готово ✨',
  'Примеряем на тебя…',
  'Ещё чуть-чуть',
  'Смотрим, как сидит',
];

function haptic(t = 'light') { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(t); } catch {} }

function playReadySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  } catch {}
}

function compressImage(file, maxSide = 720, quality = 0.7) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const k = Math.min(1, maxSide / Math.max(width, height));
        width = Math.round(width * k); height = Math.round(height * k);
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        let dataUrl = c.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 900 * 1024) dataUrl = c.toDataURL('image/jpeg', 0.5);
        res(dataUrl);
      };
      img.onerror = rej;
      img.src = e.target.result;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fixDrive(u) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/(?:uc\?.*id=|file\/d\/)([a-zA-Z0-9_-]+)/);
  return m && m[1] ? `https://lh3.googleusercontent.com/d/${m[1]}` : u;
}

function ProductImage({ src, fallback, alt, className = '' }) {
  const [i, setI] = useState(0);
  const list = (() => {
    const L = [];
    const add = (u) => { if (u && !L.includes(u)) L.push(u); };
    const s = fixDrive(src); const f = fixDrive(fallback);
    if (s) add(`${PROXY_URL}/?url=${encodeURIComponent(s)}`);
    if (s) add(s);
    if (f && f !== s) { add(`${PROXY_URL}/?url=${encodeURIComponent(f)}`); add(f); }
    const m = (src || '').match(/^(https:\/\/[^/]+)\/vol(\d+)\/part(\d+)\/(\d+)\//);
    if (m) {
      const host = m[1], id = m[4];
      for (const size of ['hq', 'big', 'c516x688', 'c246x328', 'small'])
        add(`${PROXY_URL}/?url=${encodeURIComponent(`${host}/vol${m[2]}/part${m[3]}/${id}/images/${size}/1.webp`)}`);
    }
    add('https://placehold.co/400x500/1A1412/D4B595?text=Style+Room');
    return L;
  })();
  const url = list[i] || list[list.length - 1];
  return <img src={url} alt={alt} onError={() => i < list.length - 1 && setI(i + 1)} className={`object-cover bg-card ${className}`} loading="lazy" />;
}

function LikeButton({ liked, onToggle, size = 'md' }) {
  const [pulse, setPulse] = useState(false);
  const handleClick = (e) => {
    e.stopPropagation();
    haptic('medium');
    setPulse(true);
    setTimeout(() => setPulse(false), 400);
    onToggle();
  };
  const sz = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-lg';
  return (
    <button onClick={handleClick}
      className={`${sz} rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90 ${liked ? 'bg-rose-500/20 border-rose-400 text-rose-300' : 'bg-bg/80 backdrop-blur border-border2 text-muted'} ${pulse ? 'scale-125' : ''}`}
      style={{ transition: 'transform 0.2s, background 0.2s' }}>
      {liked ? '❤️' : '🤍'}
    </button>
  );
}

function ProductCard({ item, onPick, selected, onToggle, liked, onLike }) {
  const title = item.description || item.name || 'Товар';
  return (
    <button
      onClick={() => { haptic('light'); onToggle ? onToggle(item) : onPick(item); }}
      className={`group relative bg-card border rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left w-full ${selected ? 'border-accent' : 'border-border1'}`}>
      <div className="relative aspect-[3/4] overflow-hidden">
        <ProductImage src={item.image_url} fallback={item.fallback_url} alt={title} className="w-full h-full" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-bg/80 backdrop-blur border border-border2 text-[9px] uppercase tracking-wider2 text-accentSoft">
          {CATEGORIES.find(c => c.key === item.category)?.label || 'Одежда'}
        </div>
        {onToggle ? (
          <div className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center border ${selected ? 'bg-accent text-bg border-accent' : 'bg-bg/80 border-border2 text-title'}`}>
            {selected ? '✓' : '+'}
          </div>
        ) : (
          <div className="absolute top-2.5 right-2.5">
            {onLike && <LikeButton liked={liked} onToggle={() => onLike(item.id)} />}
          </div>
        )}
        {item.price && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1">
            <span className="text-xs font-bold text-white">≈ {item.price.replace(/^≈\s*/, '')}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="font-sans font-medium text-[13px] leading-snug line-clamp-2 h-[36px] text-title">{title}</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider2 text-muted">{onToggle ? (selected ? 'Выбрано' : 'Выбрать') : 'Примерить'}</span>
          <span className="w-7 h-7 rounded-full border border-accentSoft text-accent flex items-center justify-center text-xs">✨</span>
        </div>
      </div>
    </button>
  );
}

function BeforeAfter({ before, after }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const handleMove = (clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setPos(p);
  };
  return (
    <div ref={ref} className="relative w-full rounded-2xl overflow-hidden select-none border border-border1 bg-card aspect-[3/4]"
      onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
      onMouseDown={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchStart={(e) => handleMove(e.touches[0].clientX)}>
      <img src={after} alt="after" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={before} alt="before" className="absolute inset-0 h-full object-cover" style={{ width: ref.current?.offsetWidth || '100vw', maxWidth: 'none' }} />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-black text-sm font-bold">⇆</div>
      </div>
      <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[9px] uppercase tracking-wider2 pointer-events-none">До</div>
      <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[9px] uppercase tracking-wider2 pointer-events-none">После</div>
    </div>
  );
}

function LoadingAnimation() {
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % HINTS.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-8 text-center">
      <div className="relative w-32 h-32 mb-10">
        <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-accent/50 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-5xl animate-bounce" style={{ animationDuration: '1.5s' }}>✨</div>
        </div>
      </div>
      <div className="font-serif text-2xl mb-3">Подбираем образ</div>
      <div className="text-sm text-muted transition-opacity duration-500">{HINTS[hintIdx]}</div>
      <div className="flex gap-1.5 mt-6">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ emoji, title, text, cta, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="text-6xl mb-5">{emoji}</div>
      <div className="font-serif text-xl text-title mb-2">{title}</div>
      <div className="text-xs text-muted max-w-xs mb-6 leading-relaxed">{text}</div>
      {cta && (
        <button onClick={onCta} className="px-6 py-3 rounded-2xl bg-accent text-bg text-xs font-bold uppercase tracking-wider2 active:scale-[0.98]">
          {cta}
        </button>
      )}
    </div>
  );
}

function SubscriptionsScreen({ onBack, onBuy }) {
  const [expanded, setExpanded] = useState('pro');
  return (
    <main className="px-5 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted">←</button>
        <div><div className="text-[10px] uppercase text-muted">Style Room</div><div className="font-serif text-2xl">Подписки</div></div>
      </div>
      <div className="space-y-4">
        {SUBS.map(sub => {
          const isOpen = expanded === sub.id;
          return (
            <div key={sub.id} className="bg-card rounded-3xl overflow-hidden" style={{ border: `1px solid ${isOpen ? sub.accent : '#2a1f1a'}` }}>
              <button onClick={() => setExpanded(isOpen ? null : sub.id)} className="w-full flex items-center justify-between px-5 py-5 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${sub.accent}20`, border: `1px solid ${sub.accent}40` }}>{sub.emoji}</div>
                  <div>
                    <div className="text-[10px] uppercase" style={{ color: sub.accent }}>{sub.subtitle}</div>
                    <div className="font-serif text-lg">{sub.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted line-through">{sub.priceOld}⭐️</span>
                      <span className="text-base font-bold" style={{ color: sub.accent }}>{sub.priceNew}⭐️</span>
                    </div>
                  </div>
                </div>
              </button>
              <div className="overflow-hidden" style={{ maxHeight: isOpen ? 400 : 0 }}>
                <div className="border-t border-border1 px-5 py-4">
                  <ul className="space-y-3 mb-5">
                    {sub.features.map((f, i) => <li key={i} className="flex items-start gap-3 text-xs"><span>{f.icon}</span><span>{f.text}</span></li>)}
                  </ul>
                  <button onClick={() => onBuy(sub.id)} className="w-full py-4 rounded-2xl text-xs font-bold uppercase text-bg" style={{ background: sub.accent }}>Оформить за {sub.priceNew}⭐️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function BuyTriesScreen({ onBack, onBuy, onBuyOwn, user }) {
  const [mode, setMode] = useState('regular');
  const [count, setCount] = useState(5);
  const price = mode === 'regular' ? 5 : 10;
  const total = count * price;
  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-5">Попытки</h1>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button onClick={() => setMode('regular')} className={`py-3 rounded-2xl border text-xs font-medium ${mode === 'regular' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>✨ Обычные · 5⭐️</button>
        <button onClick={() => setMode('own')} className={`py-3 rounded-2xl border text-xs font-medium ${mode === 'own' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>📦 Свои · 10⭐️</button>
      </div>
      <div className="bg-card border border-border1 rounded-3xl p-6 mb-5 text-center">
        <div className="flex items-center justify-center gap-5 mb-5">
          <button onClick={() => setCount(c => Math.max(1, c - 1))} className="w-12 h-12 rounded-full border border-border2 text-2xl text-accent font-light">−</button>
          <div className="text-6xl font-sans font-bold tracking-tight text-title min-w-[120px]">{count}</div>
          <button onClick={() => setCount(c => Math.min(500, c + 1))} className="w-12 h-12 rounded-full border border-accentSoft text-2xl text-accent font-light">+</button>
        </div>
        <div className="flex gap-2 justify-center mb-6">
          {[5, 10, 25, 50].map(n => (
            <button key={n} onClick={() => setCount(n)} className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${count === n ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>{n}</button>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-wider2 text-muted mb-2">Итого</div>
        <div className="text-4xl font-sans font-bold tracking-tight text-title">{total}<span className="text-accent text-2xl ml-1">⭐️</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-card border border-border1 rounded-2xl p-4">
          <div className="text-[10px] uppercase text-muted">Обычных</div>
          <div className="text-3xl font-sans font-bold text-accent mt-1">{user?.balance ?? 0}</div>
        </div>
        <div className="bg-card border border-border1 rounded-2xl p-4">
          <div className="text-[10px] uppercase text-muted">Своих</div>
          <div className="text-3xl font-sans font-bold text-accent mt-1">{user?.own_tries ?? 0}</div>
        </div>
      </div>
      <button onClick={() => mode === 'regular' ? onBuy(count) : onBuyOwn(count)}
        className="w-full bg-accent text-bg py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2">
        Купить {count} за {total}⭐️
      </button>
    </main>
  );
}

function OwnTriesScreen({ user, onBack, onToast }) {
  const [humanImg, setHumanImg] = useState('');
  const [wbLink, setWbLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const fileRef = useRef(null);

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setHumanImg(await compressImage(f, 720, 0.7)); }
    catch { onToast('Не удалось обработать фото'); }
  };
  const run = async () => {
    if (!humanImg) return onToast('Загрузите фото');
    if (!wbLink.trim()) return onToast('Вставьте ссылку WB');
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/tryon-by-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', humanImg, wbLink: wbLink.trim() }),
      });
      const d = await r.json();
      if (d.success && d.resultUrl) { setResultImage(d.resultUrl); playReadySound(); haptic('medium'); }
      else onToast(d.error || 'Что-то пошло не так');
    } catch { onToast('Нет связи с сервером'); }
    finally { setLoading(false); }
  };
  const share = () => {
    if (!resultImage) return;
    const text = 'Смотри, как я примерила вещь через Style Room ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(resultImage)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };
  const download = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage; a.download = 'style-room.jpg'; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onToast('Фото сохраняется…');
  };

  if (loading) return <LoadingAnimation />;

  if (resultImage) return (
    <main className="px-5 pt-5">
      <div className="text-[10px] uppercase text-muted mb-3">Результат</div>
      <img src={resultImage} alt="result" className="w-full rounded-2xl border border-border1 mb-5"
        onError={(e) => { e.target.src = 'https://placehold.co/600x800/1A1412/D4B595?text=Фото'; }} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={download} className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2">📥 Скачать</button>
        <button onClick={share} className="w-full border border-accentSoft text-accent py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2">📤 Поделиться</button>
      </div>
      <button onClick={() => { setResultImage(null); setHumanImg(''); setWbLink(''); }} className="w-full border border-border2 text-muted2 py-3 rounded-2xl text-sm mb-2">Ещё раз</button>
      <button onClick={onBack} className="w-full text-xs text-muted py-3">← Назад</button>
    </main>
  );

  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="text-xs text-muted mb-5">← Назад</button>
      <h1 className="font-serif text-3xl mb-2">Свои товары</h1>
      <p className="text-xs text-muted mb-5">Вставь ссылку WB — примерим</p>
      <div className="bg-card border border-border2 rounded-2xl p-4 mb-4">
        <div className="text-[10px] uppercase text-accentSoft mb-2">📦 У вас есть</div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Своих примерок</span>
          <span className="text-lg font-sans font-bold text-accent">{user?.own_tries ?? 0}</span>
        </div>
        <div className="text-[10px] text-muted mt-1">10 ⭐️ за штуку</div>
      </div>
      <label className="block mb-4">
        <div className="text-[10px] uppercase text-muted mb-2">🔗 Ссылка WB</div>
        <input value={wbLink} onChange={(e) => setWbLink(e.target.value)} placeholder="https://www.wildberries.ru/catalog/.../detail.aspx"
          className="w-full bg-card border border-border1 rounded-xl px-4 py-3 text-sm outline-none focus:border-accentSoft" />
      </label>
      <button onClick={() => fileRef.current?.click()} className="w-full bg-card border border-dashed border-border2 rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2">
        <span className="text-2xl">{humanImg ? '✓' : '📷'}</span>
        <span>{humanImg ? 'Фото загружено' : 'Загрузить фото'}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      {humanImg && <img src={humanImg} alt="" className="w-full max-h-72 object-contain rounded-2xl mb-4 border border-border1" />}
      <button onClick={run} disabled={(user?.own_tries || 0) <= 0}
        className="w-full bg-accent disabled:opacity-30 text-bg py-4 rounded-2xl text-sm font-medium uppercase mt-4">
        {(user?.own_tries || 0) <= 0 ? 'Купите примерки в профиле' : 'Запустить · 1 попытка'}
      </button>
    </main>
  );
}

function MultiTryonScreen({ catalog, user, onBack, onToast }) {
  const [picked, setPicked] = useState([]);
  const [humanImg, setHumanImg] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);

  const toggle = (item) => {
    const found = picked.find(x => x.id === item.id);
    if (found) { setPicked(picked.filter(x => x.id !== item.id)); return; }
    if (picked.length >= 3) return onToast('Максимум 3 вещи');
    const sameCat = picked.find(x => x.category === item.category);
    if (sameCat) return onToast('Нельзя 2 вещи одной категории');
    setPicked([...picked, item]);
  };
  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setHumanImg(await compressImage(f, 720, 0.7)); } catch { onToast('Ошибка фото'); }
  };
  const run = async () => {
    if (picked.length < 2) return onToast('Выберите 2–3 вещи');
    if (!humanImg) return onToast('Загрузите фото');
    if ((user?.balance || 0) < picked.length) return onToast(`Нужно ${picked.length} попыток`);
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/tryon-multi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', humanImg,
          items: picked.map(p => ({ id: p.id, name: p.name, image_url: p.image_url, category: p.category })) }),
      });
      const d = await r.json();
      if (d.success) { setResults(d.results); playReadySound(); }
      else onToast(d.error || 'Не получилось');
    } catch { onToast('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingAnimation />;

  if (results) return (
    <main className="px-5 pt-5 pb-24">
      <div className="text-[10px] uppercase text-muted mb-3">Результаты</div>
      <div className="space-y-4">
        {results.map((r, i) => (
          <div key={i} className="bg-card border border-border1 rounded-2xl overflow-hidden">
            {r.url ? <img src={r.url} alt={r.name} className="w-full" onError={(e) => { e.target.src = 'https://placehold.co/600x800/1A1412/D4B595?text=Фото'; }} />
              : <div className="aspect-[3/4] flex items-center justify-center text-xs text-muted">Не удалось</div>}
            <div className="p-3">
              <div className="text-xs text-muted mb-2">{r.name}</div>
              {r.url && <a href={r.url} download="style-room.jpg" className="block w-full bg-accent text-bg text-center py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider2">📥 Скачать</a>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => { setResults(null); setPicked([]); setHumanImg(''); }} className="w-full mt-5 border border-border2 text-muted2 py-4 rounded-2xl text-sm">Ещё раз</button>
      <button onClick={onBack} className="w-full text-xs text-muted mt-4">← Назад</button>
    </main>
  );

  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="text-xs text-muted mb-5">← Назад</button>
      <h1 className="font-serif text-3xl mb-2">2–3 вещи сразу</h1>
      <p className="text-xs text-muted mb-5">Только разные категории.</p>
      <div className="bg-card border border-border2 rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted">Выбрано: <b className="text-title">{picked.length}</b> / 3</span>
          <span className="text-muted">Спишется: <b className="text-accent">{picked.length}</b></span>
        </div>
      </div>
      {!humanImg ? (
        <button onClick={() => fileRef.current?.click()} className="w-full bg-card border border-dashed border-border2 rounded-2xl py-8 text-sm text-muted2 mb-4 flex flex-col items-center gap-2">
          <span className="text-2xl">📷</span><span>Загрузить фото</span>
        </button>
      ) : (
        <div className="mb-4">
          <img src={humanImg} alt="" className="w-full max-h-64 object-contain rounded-2xl border border-border1" />
          <button onClick={() => fileRef.current?.click()} className="text-xs text-muted mt-2">Заменить</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      <div className="grid grid-cols-2 gap-3 mb-5">
        {catalog.slice(0, 30).map(item => (
          <ProductCard key={item.id} item={item} selected={!!picked.find(x => x.id === item.id)} onToggle={toggle} />
        ))}
      </div>
      <button onClick={run} disabled={picked.length < 2 || !humanImg || (user?.balance || 0) < picked.length}
        className="w-full bg-accent disabled:opacity-30 text-bg py-4 rounded-2xl text-sm font-medium uppercase">
        {picked.length < 2 ? 'Выберите минимум 2' : `Пример ${picked.length} вещи`}
      </button>
    </main>
  );
}

function HistoryScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${BACKEND}/api/history`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
    }).then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const share = (url) => {
    const text = 'Смотри, как я примерила вещь через Style Room ✨';
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-5">Мои примерки</h1>
      {loading && <div className="text-center py-16 text-muted text-sm">Загрузка…</div>}
      {!loading && items.length === 0 && (
        <EmptyState emoji="👗" title="Пока пусто" text="Сделай первую примерку — она появится здесь" />
      )}
      <div className="grid grid-cols-2 gap-3">
        {items.map(it => (
          <div key={it.id} className="bg-card border border-border1 rounded-2xl overflow-hidden">
            <div className="aspect-[3/4]">
              <img src={it.result_url} alt="" className="w-full h-full object-cover"
                onError={(e) => { e.target.src = 'https://placehold.co/400x500/1A1412/D4B595?text=Style+Room'; }} />
            </div>
            <div className="p-2.5">
              <div className="text-[10px] text-muted line-clamp-2 h-[26px] mb-2">{it.product_name || 'Товар'}</div>
              <div className="flex gap-1.5">
                <a href={it.result_url} download="style-room.jpg" className="flex-1 bg-accent text-bg text-[10px] uppercase tracking-wider2 py-2 rounded-xl text-center font-bold">📥</a>
                <button onClick={() => share(it.result_url)} className="flex-1 bg-bgSoft border border-border2 text-accent text-[10px] uppercase tracking-wider2 py-2 rounded-xl">📤</button>
                {it.product_wb_id && (
                  <a href={`https://www.wildberries.ru/catalog/${it.product_wb_id}/detail.aspx`} target="_blank" rel="noreferrer"
                    className="flex-1 bg-bgSoft border border-border2 text-accent text-[10px] uppercase tracking-wider2 py-2 rounded-xl text-center">🛍</a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function FavoritesScreen({ onBack, onPick, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${BACKEND}/api/favorites/list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
    }).then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const unlike = async (productId) => {
    setItems(items.filter(x => x.id !== productId));
    try {
      await fetch(`${BACKEND}/api/favorites/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', productId }),
      });
      onToast('Убрано из избранного');
    } catch {}
  };
  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-5">❤️ Избранное</h1>
      {loading && <div className="text-center py-16 text-muted text-sm">Загрузка…</div>}
      {!loading && items.length === 0 && (
        <EmptyState emoji="💔" title="Пока пусто" text="Нажимай ❤️ на товары — они появятся здесь" />
      )}
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <ProductCard key={item.id} item={item} onPick={onPick} liked={true} onLike={unlike} />
        ))}
      </div>
    </main>
  );
}

function AchievementsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${BACKEND}/api/achievements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
    }).then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const earned = items.filter(x => x.earned).length;
  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-1">🏆 Достижения</h1>
      <p className="text-xs text-muted mb-5">Открыто {earned} из {items.length}</p>
      {loading && <div className="text-center py-16 text-muted text-sm">Загрузка…</div>}
      <div className="grid grid-cols-2 gap-3">
        {items.map(a => (
          <div key={a.code} className={`rounded-2xl border p-4 text-center transition-all ${a.earned ? 'bg-card border-accentSoft shadow-soft' : 'bg-bgSoft border-border1 opacity-50'}`}>
            <div className={`text-4xl mb-2 ${a.earned ? '' : 'grayscale'}`}>{a.emoji}</div>
            <div className="text-xs font-bold text-title mb-1">{a.name}</div>
            <div className="text-[10px] text-muted leading-snug">{a.desc}</div>
            {a.earned && <div className="text-[9px] text-accent uppercase tracking-wider2 mt-2">✓ Открыто</div>}
          </div>
        ))}
      </div>
    </main>
  );
}

function LeaderboardScreen({ onBack, onPick }) {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/api/top-products`).then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`${BACKEND}/api/leaderboard`).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([p, u]) => {
      setProducts(p.items || []);
      setUsers(u.items || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-4">👑 Лидеры (30 дней)</h1>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button onClick={() => setTab('products')} className={`py-3 rounded-2xl border text-xs font-medium ${tab === 'products' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>🔥 Товары</button>
        <button onClick={() => setTab('users')} className={`py-3 rounded-2xl border text-xs font-medium ${tab === 'users' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>👥 Юзеры</button>
      </div>
      {loading && <div className="text-center py-16 text-muted text-sm">Загрузка…</div>}

      {!loading && tab === 'products' && (
        products.length === 0
          ? <EmptyState emoji="📊" title="Пока нет данных" text="Как только юзеры начнут примерять — здесь появятся топы" />
          : <div className="grid grid-cols-2 gap-3">
              {products.map((p, i) => (
                <div key={p.id} className="relative">
                  <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-accent text-bg flex items-center justify-center text-xs font-bold">#{i+1}</div>
                  <ProductCard item={p} onPick={onPick} />
                  <div className="absolute bottom-16 right-3 text-[10px] text-accent font-bold">🔥 {p.tryons}</div>
                </div>
              ))}
            </div>
      )}

      {!loading && tab === 'users' && (
        users.length === 0
          ? <EmptyState emoji="👥" title="Пока пусто" text="Юзеры с примерками появятся здесь" />
          : <div className="space-y-2">
              {users.map((u, i) => (
                <div key={u.tg_id} className="bg-card border border-border1 rounded-2xl p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-bgSoft text-muted'}`}>#{i+1}</div>
                  <img src={u.photo_url || 'https://placehold.co/60x60/1A1412/D4B595?text=U'} alt="" className="w-10 h-10 rounded-full object-cover border border-border2" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.first_name || '—'}</div>
                    <div className="text-[10px] text-muted truncate">@{u.username || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-sans font-bold text-accent">{u.tryons}</div>
                    <div className="text-[9px] uppercase text-muted">примерок</div>
                  </div>
                </div>
              ))}
            </div>
      )}
    </main>
  );
}

function GiftScreen({ onBack, onToast, user }) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [giftUrl, setGiftUrl] = useState('');
  const total = count * 5;
  const create = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/gift/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', tries: count }),
      });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error || 'Ошибка');
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => {
        if (s === 'paid') {
          const botName = 'GFstyleroom_bot';
          const link = `https://t.me/${botName}/app?startapp=gift_${d.giftCode}`;
          setGiftUrl(link);
          onToast('🎁 Подарок создан!');
        }
      });
    } catch (e) { onToast('Ошибка: ' + e.message); }
    finally { setLoading(false); }
  };
  const shareGift = () => {
    const text = `🎁 Дарю тебе ${count} примерок в Style Room! Открой ссылку:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(giftUrl)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };
  return (
    <main className="px-5 pt-6 pb-24">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="font-serif text-2xl mb-2">🎁 Подарить подруге</h1>
      <p className="text-xs text-muted mb-5">Купи примерки и отправь ссылку — она их активирует</p>

      {!giftUrl ? (
        <>
          <div className="bg-card border border-border1 rounded-3xl p-6 mb-5 text-center">
            <div className="flex items-center justify-center gap-5 mb-5">
              <button onClick={() => setCount(c => Math.max(1, c - 1))} className="w-12 h-12 rounded-full border border-border2 text-2xl text-accent font-light">−</button>
              <div className="text-5xl font-sans font-bold tracking-tight min-w-[100px]">{count}</div>
              <button onClick={() => setCount(c => Math.min(50, c + 1))} className="w-12 h-12 rounded-full border border-accentSoft text-2xl text-accent font-light">+</button>
            </div>
            <div className="text-[10px] uppercase text-muted mb-1">Итого</div>
            <div className="text-3xl font-sans font-bold text-title">{total}<span className="text-accent text-xl ml-1">⭐️</span></div>
          </div>
          <button onClick={create} disabled={loading}
            className="w-full bg-accent text-bg py-4 rounded-2xl text-sm font-bold uppercase tracking-wider2 disabled:opacity-40">
            {loading ? 'Создаю…' : `Оплатить ${total}⭐️`}
          </button>
        </>
      ) : (
        <div className="bg-card border border-accentSoft rounded-3xl p-6 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <div className="font-serif text-xl mb-2">Подарок готов!</div>
          <div className="text-xs text-muted mb-5">Отправь ссылку подруге — она активирует {count} примерок</div>
          <div className="bg-bg border border-border1 rounded-2xl p-3 mb-4 break-all text-[10px] text-muted">{giftUrl}</div>
          <button onClick={shareGift} className="w-full bg-accent text-bg py-4 rounded-2xl text-sm font-bold uppercase tracking-wider2">📤 Поделиться ссылкой</button>
          <button onClick={() => setGiftUrl('')} className="w-full mt-3 text-xs text-muted py-2">Создать ещё один</button>
        </div>
      )}
    </main>
  );
}

function ProfileScreen({ user, onOpenSubs, onOpenBuyTries, onOpenHistory, onOpenOwn, onOpenMulti, onOpenAchievements, onOpenLeaderboard, onOpenFavorites, onOpenGift, onToast }) {
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [ideaLoading, setIdeaLoading] = useState(false);

  const redeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/redeem-promo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', code: promoCode.trim() }),
      });
      const d = await r.json();
      if (d.success) { onToast(d.unlimited ? '🎁 Безлимит!' : `🎁 +${d.tries}!`); setPromoOpen(false); setPromoCode(''); setTimeout(() => window.location.reload(), 1500); }
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка'); } finally { setPromoLoading(false); }
  };
  const sendIdea = async () => {
    if (!ideaText.trim()) return;
    setIdeaLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/idea`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', text: ideaText.trim() }),
      });
      const d = await r.json();
      if (d.success) { onToast('💡 Спасибо!'); setIdeaText(''); setIdeaOpen(false); }
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Нет связи'); } finally { setIdeaLoading(false); }
  };

  return (
    <main className="px-5 pt-6 pb-24">
      <h1 className="font-serif text-3xl mb-6">Профиль</h1>
      <div className="bg-card border border-border1 rounded-3xl p-5 mb-4 flex items-center gap-4">
        <img src={user?.photo_url || 'https://placehold.co/80x80/1A1412/D4B595?text=U'} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border2" />
        <div className="flex-1">
          <div className="text-base font-medium">{user?.first_name || 'Гость'}</div>
          <div className="text-xs text-muted">@{user?.username || 'user'}</div>
          {user?.streak_days > 0 && (
            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40">
              <span className="text-[10px]">🔥</span>
              <span className="text-[10px] text-orange-300 font-bold">{user.streak_days} {user.streak_days === 1 ? 'день' : user.streak_days < 5 ? 'дня' : 'дней'}</span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={onOpenBuyTries} className="bg-card border border-border1 rounded-2xl p-4 text-left">
          <div className="text-2xl mb-1">👗</div>
          <div className="text-3xl font-sans font-bold">{user?.balance ?? 0}</div>
          <div className="text-[10px] uppercase text-muted mt-2">Обычных</div>
        </button>
        <button onClick={onOpenOwn} className="bg-card border border-border1 rounded-2xl p-4 text-left">
          <div className="text-2xl mb-1">📦</div>
          <div className="text-3xl font-sans font-bold">{user?.own_tries ?? 0}</div>
          <div className="text-[10px] uppercase text-muted mt-2">Своих</div>
        </button>
      </div>
      <div className="space-y-2 mb-4">
        <button onClick={onOpenHistory} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">🕓 Мои примерки</span><span className="text-muted">→</span></button>
        <button onClick={onOpenFavorites} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">❤️ Избранное</span><span className="text-muted">→</span></button>
        <button onClick={onOpenAchievements} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">🏆 Достижения</span><span className="text-muted">→</span></button>
        <button onClick={onOpenLeaderboard} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">👑 Лидеры</span><span className="text-muted">→</span></button>
        <button onClick={onOpenSubs} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">💎 Подписки</span><span className="text-muted">→</span></button>
        <button onClick={onOpenOwn} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">📦 Примерка по ссылке</span><span className="text-muted">→</span></button>
        <button onClick={onOpenMulti} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">🎨 Мульти (2–3 вещи)</span><span className="text-muted">→</span></button>
        <button onClick={onOpenGift} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">🎁 Подарить подруге</span><span className="text-muted">→</span></button>
        <button onClick={() => setIdeaOpen(true)} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between"><span className="text-sm">💡 Предложить идею</span><span className="text-muted">→</span></button>
      </div>
      {!promoOpen ? (
        <button onClick={() => setPromoOpen(true)} className="w-full bg-bgSoft border border-accentSoft text-accent rounded-2xl px-4 py-4">🎁 Ввести промокод</button>
      ) : (
        <div className="bg-card border border-accentSoft rounded-2xl p-4">
          <div className="flex gap-2">
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="ВВЕДИ КОД" disabled={promoLoading} className="flex-1 bg-bg border border-border1 rounded-xl px-3 py-3 text-sm uppercase" />
            <button onClick={redeemPromo} disabled={promoLoading || !promoCode.trim()} className="px-4 py-3 rounded-xl bg-accent text-bg text-xs font-bold disabled:opacity-40">{promoLoading ? '…' : 'OK'}</button>
          </div>
        </div>
      )}

      {ideaOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-5" onClick={() => setIdeaOpen(false)}>
          <div className="bg-card border border-border2 rounded-3xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-[10px] uppercase text-accent mb-2">💡 Идея</div>
            <h3 className="font-serif text-xl mb-3">Что хочешь предложить?</h3>
            <textarea value={ideaText} onChange={(e) => setIdeaText(e.target.value)}
              placeholder="Опиши идею…" rows={5} maxLength={2000}
              className="w-full bg-bg border border-border1 rounded-2xl px-4 py-3 text-sm outline-none focus:border-accentSoft resize-none mb-3" />
            <div className="text-[10px] text-muted mb-3">{ideaText.length}/2000</div>
            <button onClick={sendIdea} disabled={ideaLoading || !ideaText.trim()}
              className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase disabled:opacity-40 mb-2">
              {ideaLoading ? '…' : 'Отправить'}
            </button>
            <button onClick={() => setIdeaOpen(false)} className="w-full text-xs text-muted py-2">Отмена</button>
          </div>
        </div>
      )}
    </main>
  );
}

function SearchScreen({ catalog, onPick, likedIds, onLike }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  const hideKeyboard = () => { try { inputRef.current?.blur(); } catch {} haptic('light'); };
  const results = q.trim()
    ? catalog.filter(p => (p.name + ' ' + (p.description || '')).toLowerCase().includes(q.toLowerCase().trim()))
    : [];

  return (
    <main className="px-5 pt-6 pb-24">
      <h1 className="font-serif text-3xl mb-5">Поиск</h1>
      <div className="relative mb-5">
        <input ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hideKeyboard(); } }}
          placeholder="Название вещи…" enterKeyHint="search" inputMode="search"
          className="w-full bg-card border border-border1 rounded-2xl pl-11 pr-12 py-3.5 text-sm outline-none focus:border-accentSoft" />
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
        {q && <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-border2 text-muted flex items-center justify-center text-xs">✕</button>}
      </div>
      {!q.trim() && (
        <EmptyState emoji="🔍" title="Что будем искать?" text="Введи название вещи или категорию" />
      )}
      {q.trim() && results.length === 0 && <EmptyState emoji="🤷‍♀️" title="Ничего не найдено" text="Попробуй другое название" />}
      {q.trim() && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map(item => (
            <ProductCard key={item.id} item={item} onPick={onPick}
              liked={likedIds.has(item.id)} onLike={onLike} />
          ))}
        </div>
      )}
    </main>
  );
}

const SLIDES = [
  { emoji: '✨', title: 'Примерь любой образ', text: 'Загрузите фото, выберите вещь — ИИ покажет, как она сидит' },
  { emoji: '❤️', title: 'Сохраняй любимое', text: 'Лайкай товары и возвращайся к ним в избранном' },
  { emoji: '🎁', title: 'Приглашай подруг', text: 'За первую примерку подруги +1 попытка каждой' },
];
function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  return (
    <div className="min-h-screen flex flex-col px-8 pt-16 pb-10 bg-bg">
      <div className="flex justify-center gap-2 mb-12">
        {SLIDES.map((_, k) => <div key={k} className={`h-[3px] rounded-full ${k === i ? 'w-8 bg-accent' : 'w-2 bg-border2'}`} />)}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-7xl mb-8">{SLIDES[i].emoji}</div>
        <h2 className="font-serif text-3xl mb-4">{SLIDES[i].title}</h2>
        <p className="text-sm text-muted2 max-w-xs">{SLIDES[i].text}</p>
      </div>
      <button onClick={() => { haptic('medium'); last ? onDone() : setI(i + 1); }} className="w-full bg-accent text-bg py-4 rounded-2xl text-sm font-medium uppercase">
        {last ? 'Начать' : 'Продолжить'}
      </button>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const items = [
    { key: 'catalog', label: 'Разделы',  emoji: '🗂' },
    { key: 'search',  label: 'Поиск',    emoji: '🔍' },
    { key: 'subs',    label: 'Подписка', emoji: '💎' },
    { key: 'profile', label: 'Профиль',  emoji: '👤' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg/95 backdrop-blur-md border-t border-border1 px-3 pt-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map(it => {
          const isActive = active === it.key;
          return (
            <button key={it.key} onClick={() => { haptic('light'); onChange(it.key); }} className="flex flex-col items-center gap-1 py-2 px-3">
              <span className={`text-lg ${isActive ? 'opacity-100' : 'opacity-50'}`}>{it.emoji}</span>
              <span className={`text-[9px] uppercase ${isActive ? 'text-accent font-bold' : 'text-muted'}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MaintenanceScreen({ text }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-bg">
      <div className="text-7xl mb-8">🚧</div>
      <h1 className="font-serif text-3xl mb-4 text-title">Ведутся работы</h1>
      <p className="text-sm text-muted2 max-w-xs leading-relaxed">{text || 'Скоро вернёмся, заходите чуть позже ✨'}</p>
      <div className="mt-10 text-[10px] uppercase tracking-wider2 text-muted">Style Room</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [maintenance, setMaintenance] = useState({ on: false, text: '' });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState('catalog');
  const [screen, setScreen] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [humanImg, setHumanImg] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [toast, setToast] = useState('');
  const [welcomeBonus, setWelcomeBonus] = useState(null);
  const [showStreak, setShowStreak] = useState(false);
  const fileRef = useRef(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    fetch(`${BACKEND}/api/settings`).then(r => r.json())
      .then(d => { if (d.maintenance) setMaintenance({ on: true, text: d.maintenance_text || '' }); })
      .catch(() => {});
    const t = setInterval(() => {
      fetch(`${BACKEND}/api/settings`).then(r => r.json())
        .then(d => setMaintenance({ on: d.maintenance, text: d.maintenance_text || '' }))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor?.('#0C0A08'); tg.setBackgroundColor?.('#0C0A08'); tg.disableVerticalSwipes?.(); }
    fetch(`${BACKEND}/api/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg?.initData || '', refCode: tg?.initDataUnsafe?.start_param }),
    }).then(r => r.json()).then(d => {
      if (d.success) {
        setUser(d.user);
        if (!d.user.onboarded && localStorage.getItem('gf_onboarded') !== '1') setShowOnboarding(true);
        if (d.daily_bonus > 0) { setWelcomeBonus(`🎁 +${d.daily_bonus} попытка за вход!`); setTimeout(() => setWelcomeBonus(null), 4000); }
        if (d.streak_bonus > 0) { setTimeout(() => { setWelcomeBonus(`🔥 Стрик 5 дней! +${d.streak_bonus} своих примерки`); setTimeout(() => setWelcomeBonus(null), 5000); }, 5000); }
      } else setUser({ tg_id: 0, first_name: 'Гость', username: '—', photo_url: '', balance: 0, own_tries: 0, onboarded: true, streak_days: 0 });
    }).catch(() => setUser({ tg_id: 0, first_name: 'Гость', username: '—', photo_url: '', balance: 0, own_tries: 0, onboarded: true, streak_days: 0 }));
  }, []);

  useEffect(() => {
    if (!user?.tg_id) return;
    fetch(`${BACKEND}/api/favorites/list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
    }).then(r => r.json()).then(d => {
      if (d.success && d.items) setLikedIds(new Set(d.items.map(x => x.id)));
    }).catch(() => {});
  }, [user?.tg_id]);

  const toggleLike = async (productId) => {
    setLikedIds(prev => {
      const n = new Set(prev);
      if (n.has(productId)) n.delete(productId); else n.add(productId);
      return n;
    });
    try {
      await fetch(`${BACKEND}/api/favorites/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', productId }),
      });
    } catch {}
  };

  const finishOnboarding = async () => {
    localStorage.setItem('gf_onboarded', '1');
    setShowOnboarding(false);
    try { await fetch(`${BACKEND}/api/onboarded`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }) }); } catch {}
  };

  const loadCatalog = useCallback(async (cat) => {
    setLoading(true);
    try {
      const q = cat && cat !== 'all' ? `?category=${encodeURIComponent(cat)}` : '';
      const r = await fetch(`${BACKEND}/api/catalog${q}`);
      const d = await r.json();
      setCatalog(d.success && d.items.length ? d.items : FALLBACK);
    } catch { setCatalog(FALLBACK); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadCatalog(category); }, [category, loadCatalog]);

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setHumanImg(await compressImage(f, 720, 0.7)); showToast('Фото загружено ✓'); }
    catch { showToast('Не удалось обработать фото'); }
  };

  const buySubscription = async (subId) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tgId: user.tg_id, productType: `sub_${subId}` }) });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error);
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => { if (s === 'paid') { showToast('Активировано ✨'); setTimeout(() => window.location.reload(), 1500); } });
    } catch { showToast('Ошибка оплаты'); }
  };
  const buyTries = async (count) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tgId: user.tg_id, productType: 'custom_tries', tries: count }) });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error);
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => { if (s === 'paid') { showToast('Зачислено ✨'); setTimeout(() => window.location.reload(), 1500); } });
    } catch { showToast('Ошибка оплаты'); }
  };
  const buyOwnTries = async (count) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tgId: user.tg_id, productType: 'custom_own_tries', ownTries: count }) });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error);
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => { if (s === 'paid') { showToast('Зачислено ✨'); setTimeout(() => window.location.reload(), 1500); } });
    } catch { showToast('Ошибка оплаты'); }
  };

  const runTryOn = async () => {
    if (!selected) return showToast('Выберите товар');
    if (!humanImg) return showToast('Загрузите фото');
    haptic('medium'); setTab('loading');
    try {
      const r = await fetch(`${BACKEND}/api/tryon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', humanImg,
          garmentUrl: selected.image_url, itemId: selected.id, category: selected.category }),
      });
      const d = await r.json();
      if (d.success && d.resultUrl) {
        setResultImage(d.resultUrl);
        setUser(u => u ? { ...u, balance: Math.max(0, (u.balance || 0) - 1) } : u);
        setTab('result');
        playReadySound();
        haptic('medium');
      } else { showToast(d.error || 'Не получилось. Попробуй другое фото'); setTab('catalog'); }
    } catch { showToast('Нет связи с сервером'); setTab('catalog'); }
  };

  const resetTryOn = () => { setTab('catalog'); setSelected(null); setResultImage(null); setHumanImg(''); };

  const shareResult = () => {
    const text = 'Смотри, как я примерила вещь через Style Room ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(resultImage || '')}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };
  const downloadResult = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage; a.download = 'style-room.jpg'; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Фото сохраняется…');
  };
  const shareRef = () => {
    haptic('medium');
    const refLink = `https://t.me/GFstyleroom_bot/app?startapp=ref_${user?.tg_id || 0}`;
    const text = 'Зацени крутое приложение — можно примерять одежду прямо на себя ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  if (maintenance.on) return <MaintenanceScreen text={maintenance.text} />;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="spinner" /></div>;
  if (showOnboarding) return <Onboarding onDone={finishOnboarding} />;

  const isTryOn = tab === 'upload' || tab === 'loading' || tab === 'result';

  if (screen === 'subs') return <><SubscriptionsScreen onBack={() => setScreen(null)} onBuy={buySubscription} /><BottomNav active="subs" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'buyTries') return <><BuyTriesScreen onBack={() => setScreen(null)} onBuy={buyTries} onBuyOwn={buyOwnTries} user={user} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'history') return <><HistoryScreen onBack={() => setScreen(null)} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'own') return <><OwnTriesScreen user={user} onBack={() => setScreen(null)} onToast={showToast} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'multi') return <><MultiTryonScreen catalog={catalog} user={user} onBack={() => setScreen(null)} onToast={showToast} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'favorites') return <><FavoritesScreen onBack={() => setScreen(null)} onPick={(it) => { setSelected(it); setTab('upload'); }} onToast={showToast} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'achievements') return <><AchievementsScreen onBack={() => setScreen(null)} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'leaderboard') return <><LeaderboardScreen onBack={() => setScreen(null)} onPick={(it) => { setSelected(it); setTab('upload'); }} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;
  if (screen === 'gift') return <><GiftScreen onBack={() => setScreen(null)} onToast={showToast} user={user} /><BottomNav active="profile" onChange={(k) => { setScreen(null); setTab(k); }} /></>;

  return (
    <div className="min-h-screen bg-bg text-title pb-24">
      {!isTryOn && (
        <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-md border-b border-border1 px-5 py-3.5 flex items-center justify-between">
          <button onClick={() => setTab('profile')} className="flex items-center gap-3">
            <img src={user.photo_url || 'https://placehold.co/80x80/1A1412/D4B595?text=U'} alt="" className="w-9 h-9 rounded-full object-cover border border-border2" />
            <div className="text-left">
              <div className="text-sm font-medium">{user.first_name || 'Гость'}</div>
              <div className="text-[11px] text-muted">@{user.username || 'user'}</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {user.streak_days > 0 && (
              <button onClick={() => setShowStreak(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-orange-500/15 border border-orange-400/40 active:scale-95 transition">
                <span className="text-[11px]">🔥</span>
                <span className="text-xs font-bold text-orange-300">{user.streak_days}</span>
              </button>
            )}
            <button onClick={() => setScreen('buyTries')} className="px-3 py-1.5 rounded-full border border-border2 text-xs">✨ {user.balance ?? 0} <span className="text-accent font-bold">+</span></button>
            <button onClick={() => setScreen('subs')} className="px-3 py-1.5 rounded-full bg-accent text-bg text-xs font-bold">💎</button>
          </div>
        </header>
      )}

      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border2 text-xs px-4 py-2.5 rounded-full shadow-soft animate-slide-up">{toast}</div>}
      {welcomeBonus && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-bg text-xs px-4 py-2.5 rounded-full font-bold shadow-soft animate-slide-up">{welcomeBonus}</div>}

      {showStreak && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowStreak(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative w-full max-w-md bg-card rounded-t-3xl border-t border-border2 p-6 pb-8 shadow-soft"
            style={{ animation: 'slideUpStreak 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-border2 rounded-full mx-auto mb-5" />
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">🔥</div>
              <div className="font-serif text-2xl mb-1">Стрик {user.streak_days} {user.streak_days === 1 ? 'день' : user.streak_days < 5 ? 'дня' : 'дней'}</div>
              <div className="text-xs text-muted">Заходи каждый день и получай награды</div>
            </div>

            <div className="space-y-2 mb-5">
              {[1,2,3,4,5].map(day => {
                const current = ((user.streak_days - 1) % 5) + 1;
                const isPast = day < current;
                const isCurrent = day === current;
                const isBonus = day === 5;
                return (
                  <div key={day} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                    isCurrent ? 'bg-accent/15 border-accent shadow-soft' :
                    isPast ? 'bg-bgSoft border-border1 opacity-60' :
                    'bg-bgSoft border-border1'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isCurrent ? 'bg-accent text-bg' :
                      isPast ? 'bg-bg border border-border2 text-muted' :
                      'bg-bg border border-border2 text-title'
                    }`}>
                      {isPast ? '✓' : `Д${day}`}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${isCurrent ? 'text-accent' : 'text-title'}`}>
                        {isBonus ? '🎁 Большой бонус' : `День ${day}`}
                      </div>
                      <div className="text-[10px] text-muted">
                        {isBonus ? '+3 примерки своих товаров' : '+1 обычная примерка'}
                      </div>
                    </div>
                    {isBonus && <span className="text-2xl">✨</span>}
                    {isCurrent && <span className="text-[9px] uppercase tracking-wider2 text-accent font-bold">Сегодня</span>}
                  </div>
                );
              })}
            </div>

            <div className="bg-bgSoft border border-border1 rounded-2xl p-4 text-center">
              <div className="text-[10px] uppercase text-muted mb-1">Правила</div>
              <div className="text-xs text-title leading-relaxed">
                Заходи каждый день → +1 попытка<br />
                Каждый 5-й день → <span className="text-accent font-bold">+3 примерки своих</span>
              </div>
            </div>

            <button onClick={() => setShowStreak(false)} className="w-full mt-5 bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider2">Понятно</button>
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <main className="px-5 pt-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[10px] uppercase text-muted mb-1">Коллекция</div>
              <h1 className="font-serif text-3xl">Гардероб</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setScreen('own')} className="px-3 py-2 rounded-full bg-card border border-border2 text-xs">📦 Свои</button>
              <button onClick={() => setScreen('multi')} className="px-3 py-2 rounded-full bg-card border border-border2 text-xs">🎨 2–3</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-5 px-5">
            {CATEGORIES.map(c => {
              const active = category === c.key;
              return (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-full border flex items-center gap-1.5 ${active ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted2'}`}>
                  <span>{c.emoji}</span>{c.label}
                </button>
              );
            })}
          </div>
          {loading ? <div className="grid grid-cols-2 gap-3">{Array.from({length: 6}).map((_,i)=><div key={i} className="aspect-[3/4] bg-card rounded-2xl animate-pulse" />)}</div>
            : catalog.length === 0
              ? <EmptyState emoji="🛍" title="Каталог пуст" text="Заходи чуть позже — товары обновляются" />
              : <div className="grid grid-cols-2 gap-3">{catalog.map(item => (
                  <ProductCard key={item.id} item={item}
                    onPick={(it) => { setSelected(it); setTab('upload'); }}
                    liked={likedIds.has(item.id)} onLike={toggleLike} />
                ))}</div>}
          <button onClick={shareRef}
            className="w-full mt-8 bg-bgSoft border border-border2 text-accent py-4 rounded-2xl text-xs font-medium uppercase tracking-wider2 flex items-center justify-center gap-2 active:scale-[0.98]">
            <span>👥</span> Поделиться с подругой · +1
          </button>
        </main>
      )}

      {tab === 'search' && <SearchScreen catalog={catalog} onPick={(it) => { setSelected(it); setTab('upload'); }} likedIds={likedIds} onLike={toggleLike} />}

      {tab === 'profile' && <ProfileScreen user={user}
        onOpenSubs={() => setScreen('subs')} onOpenBuyTries={() => setScreen('buyTries')}
        onOpenHistory={() => setScreen('history')} onOpenOwn={() => setScreen('own')}
        onOpenMulti={() => setScreen('multi')} onOpenAchievements={() => setScreen('achievements')}
        onOpenLeaderboard={() => setScreen('leaderboard')} onOpenFavorites={() => setScreen('favorites')}
        onOpenGift={() => setScreen('gift')} onToast={showToast} />}

      {tab === 'upload' && selected && (
        <main className="px-5 pt-5">
          <button onClick={() => setTab('catalog')} className="text-xs text-muted mb-5">← Назад</button>
          <div className="bg-card border border-border1 rounded-2xl overflow-hidden mb-6">
            <div className="aspect-[4/3]"><ProductImage src={selected.image_url} fallback={selected.fallback_url} alt={selected.name} className="w-full h-full" /></div>
            <div className="p-4">
              <div className="text-[10px] uppercase text-accentSoft mb-1">{CATEGORIES.find(x => x.key === selected.category)?.label}</div>
              <div className="font-sans font-medium text-base leading-snug">{selected.description || selected.name}</div>
              {selected.price && <div className="text-xs text-muted mt-1.5">≈ {selected.price.replace(/^≈\s*/, '')}</div>}
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()} className="w-full bg-card border border-dashed border-border2 rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2">
            <span className="text-2xl">{humanImg ? '✓' : '📷'}</span><span>{humanImg ? 'Фото загружено' : 'Загрузить фото'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          {humanImg && <img src={humanImg} alt="" className="w-full max-h-72 object-contain rounded-2xl mb-4" />}
          <button onClick={runTryOn} disabled={!humanImg} className="w-full bg-accent disabled:opacity-30 text-bg py-4 rounded-2xl text-sm font-medium uppercase mt-4">Запустить примерку</button>
        </main>
      )}

      {tab === 'loading' && <LoadingAnimation />}

      {tab === 'result' && (
        <main className="px-5 pt-5">
          <div className="text-[10px] uppercase text-muted mb-3">Результат</div>
          {resultImage && humanImg && (
            <div className="mb-5">
              <BeforeAfter before={humanImg} after={resultImage} />
            </div>
          )}
          {resultImage ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={downloadResult} className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2">📥 Скачать</button>
                <button onClick={shareResult} className="w-full border border-accentSoft text-accent py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2">📤 Поделиться</button>
              </div>
              <a href={`https://www.wildberries.ru/catalog/${selected?.wb_id}/detail.aspx`} target="_blank" rel="noreferrer"
                className="block w-full border border-border2 text-muted2 text-center py-3 rounded-2xl text-xs uppercase tracking-wider2 mb-3">🛍 Открыть на WB</a>
            </>
          ) : (
            <EmptyState emoji="😕" title="Не получилось" text="Попробуй другое фото или другой товар" />
          )}
          <button onClick={resetTryOn} className="w-full border border-border2 text-muted2 py-4 rounded-2xl text-sm">Вернуться</button>
        </main>
      )}

      {!isTryOn && <BottomNav active={tab} onChange={(k) => { setScreen(null); setTab(k); if (k === 'subs') setScreen('subs'); }} />}
    </div>
  );
}
