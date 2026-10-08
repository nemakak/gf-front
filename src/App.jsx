import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gf-backend-uc51.onrender.com';
const PROXY_URL = 'https://gf-images.maxgamingbrawlstars.workers.dev';
const BUY_STARS_URL = 'https://buynstars.com/?ref=5wsgoi6fjrn2';

const CATEGORIES = [
  { key: 'personal',  label: 'Для тебя',       emoji: '💫' },
  { key: 'autumn',    label: 'Осень',          emoji: '🍂' },
  { key: 'top',       label: 'Верх',           emoji: '👕' },
  { key: 'bottom',    label: 'Низ',            emoji: '👖' },
  { key: 'outerwear', label: 'Верхняя одежда', emoji: '🧥' },
  { key: 'suit',      label: 'Костюмы',        emoji: '🥼' },
  { key: 'dress',     label: 'Платья',         emoji: '👗' },
  { key: 'all',       label: 'Все',            emoji: '✨' },
];

const HINTS = ['Подбираем образ…', 'Почти готово ✨', 'Примеряем на тебя…', 'Ещё чуть-чуть', 'Смотрим, как сидит'];

// ============ ОНБОРДИНГ-ТЕСТ ============
const ONBOARD_QUESTIONS = [
  { id: 'age', q: 'Сколько тебе лет?', options: [
    { text: 'До 18', emoji: '🌱', value: 'teen' },
    { text: '18–24', emoji: '✨', value: 'young' },
    { text: '25–34', emoji: '💫', value: 'adult' },
    { text: '35+',  emoji: '🌹', value: 'mature' },
  ]},
  { id: 'style', q: 'Какой стиль тебе ближе?', options: [
    { text: 'Романтичный', emoji: '🌸', value: 'romantic', cat: 'dress' },
    { text: 'Кэжуал', emoji: '👕', value: 'casual', cat: 'top' },
    { text: 'Строгий / деловой', emoji: '🥼', value: 'formal', cat: 'suit' },
    { text: 'Y2K / уличный', emoji: '🎨', value: 'y2k', cat: 'top' },
  ]},
  { id: 'season', q: 'Что сейчас носишь?', options: [
    { text: 'Осеннее / тёплое', emoji: '🍂', value: 'autumn', cat: 'autumn' },
    { text: 'Лёгкое / летнее', emoji: '☀️', value: 'summer', cat: 'top' },
    { text: 'Универсальное', emoji: '🌤', value: 'all', cat: 'all' },
  ]},
  { id: 'color', q: 'Любимые цвета?', options: [
    { text: 'Тёплые (беж, коричневый)', emoji: '🤎', value: 'warm' },
    { text: 'Тёмные (чёрный, серый)',   emoji: '🖤', value: 'dark' },
    { text: 'Яркие',                    emoji: '❤️', value: 'bright' },
  ]},
];

const STYLE_QUESTIONS = [
  { q: 'Какой образ тебе ближе?', options: [
    { text: 'Романтичный и нежный', emoji: '🌸', cat: 'dress' },
    { text: 'Удобный на каждый день', emoji: '👕', cat: 'top' },
    { text: 'Строгий и элегантный', emoji: '🥼', cat: 'suit' },
  ]},
  { q: 'Что чаще носишь?', options: [
    { text: 'Платья и юбки', emoji: '👗', cat: 'dress' },
    { text: 'Джинсы и брюки', emoji: '👖', cat: 'bottom' },
    { text: 'Худи и футболки', emoji: '🧥', cat: 'top' },
  ]},
  { q: 'Любимый сезон?', options: [
    { text: 'Осень (уютный)', emoji: '🍂', cat: 'autumn' },
    { text: 'Лето (легкий)', emoji: '☀️', cat: 'top' },
    { text: 'Зима (тёплый)', emoji: '❄️', cat: 'outerwear' },
  ]},
  { q: 'Что главное в образе?', options: [
    { text: 'Комфорт', emoji: '😌', cat: 'top' },
    { text: 'Стиль', emoji: '✨', cat: 'suit' },
    { text: 'Уникальность', emoji: '🎨', cat: 'dress' },
  ]},
  { q: 'Твой цвет?', options: [
    { text: 'Бежевый / тёплый', emoji: '🤎', cat: 'autumn' },
    { text: 'Чёрный / классика', emoji: '🖤', cat: 'top' },
    { text: 'Яркий / акцентный', emoji: '❤️', cat: 'dress' },
  ]},
];

function haptic(t = 'light') { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(t); } catch {} }

function playReadySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
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

async function downloadImage(url, filename = 'style-room.jpg') {
  haptic('medium');
  if (!url) return;
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.downloadFile) {
      const maybe = tg.downloadFile({ url, file_name: filename });
      if (maybe && typeof maybe.then === 'function') { await maybe; return; }
      return;
    }
  } catch (e) {}
  const tryFetch = async (u) => {
    const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.blob();
  };
  let blob = null;
  const urls = [url];
  if (!url.startsWith('data:')) urls.push(`${PROXY_URL}/?url=${encodeURIComponent(url)}`);
  for (const u of urls) {
    try { blob = await tryFetch(u); if (blob) break; } catch {}
  }
  if (blob) {
    try {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
      return;
    } catch {}
  }
  try {
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url, { try_instant_view: false });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {}
}

function fixDrive(u) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/(?:uc\?.*id=|file\/d\/)([a-zA-Z0-9_-]+)/);
  return m && m[1] ? `https://lh3.googleusercontent.com/d/${m[1]}` : u;
}

function wbUrl(wbId) { return `https://www.wildberries.ru/catalog/${wbId}/detail.aspx`; }

const SHARE_TEXT = 'Смотри что померяла в @GFstyleroom_bot';

function tgShare(url, text = SHARE_TEXT) {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  try {
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(u);
    else window.open(u, '_blank');
  } catch { window.open(u, '_blank'); }
}

// ============ IMAGE ============
function ProductImage({ src, fallback, alt, className = '' }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const list = useMemo(() => {
    const L = [];
    const add = (u) => { if (u && !L.includes(u)) L.push(u); };
    const s = fixDrive(src); const f = fixDrive(fallback);
    if (s) add(s);
    if (f && f !== s) add(f);
    if (s) add(`${PROXY_URL}/?url=${encodeURIComponent(s)}`);
    if (f && f !== s) add(`${PROXY_URL}/?url=${encodeURIComponent(f)}`);
    const m = (s || '').match(/^(https:\/\/[^/]+)\/vol(\d+)\/part(\d+)\/(\d+)\//);
    if (m) {
      const host = m[1], id = m[4];
      for (const size of ['big', 'c516x688', 'c246x328'])
        add(`${host}/vol${m[2]}/part${m[3]}/${id}/images/${size}/1.webp`);
    }
    add('https://placehold.co/400x500/1A1412/D4B595?text=Style+Room');
    return L;
  }, [src, fallback]);
  const url = list[i] || list[list.length - 1];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-bgSoft via-card to-bgSoft">
          <div className="absolute inset-0 shimmer" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => i < list.length - 1 && setI(i + 1)}
        className={`object-cover bg-card w-full h-full transition-all duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} ${className}`}
        loading="lazy"
      />
    </div>
  );
}

// ============ LIKE ============
function LikeButton({ liked, onToggle, size = 'md' }) {
  const [animate, setAnimate] = useState(false);
  const handleClick = (e) => {
    e.stopPropagation();
    haptic('medium');
    setAnimate(true);
    setTimeout(() => setAnimate(false), 400);
    onToggle();
  };
  const sz = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-lg';
  return (
    <button onClick={handleClick}
      className={`${sz} rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90 ${liked ? 'bg-rose-500/20 border-rose-400 text-rose-300' : 'bg-bg/80 backdrop-blur border-border2 text-muted'} ${animate ? 'animate-heart' : ''}`}>
      {liked ? '❤️' : '🤍'}
    </button>
  );
}

// ============ PRODUCT CARD ============
function ProductCard({ item, onPick, selected, onToggle, liked, onLike, onTryon }) {
  const title = item.description || item.name || 'Товар';
  const shopUrl = wbUrl(item.wb_id);
  const priceText = item.price ? `≈ ${item.price.replace(/^≈\s*/, '')}` : null;

  return (
    <div className={`group relative bg-card border rounded-2xl overflow-hidden transition-all ${selected ? 'border-accent shadow-soft' : 'border-border1 hover:border-accentSoft'}`}>
      <button onClick={() => { haptic('light'); onToggle ? onToggle(item) : onPick(item); }} className="block w-full text-left active:scale-[0.98] transition">
        <div className="relative aspect-[3/4] overflow-hidden">
          <ProductImage src={item.image_url} fallback={item.fallback_url} alt={title} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />

          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-bg/85 backdrop-blur border border-border2 text-[9px] uppercase tracking-wider2 text-accentSoft font-btn">
            {CATEGORIES.find(c => c.key === item.category)?.label || 'Одежда'}
          </div>

          {onToggle ? (
            <div className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center border ${selected ? 'bg-accent text-bg border-accent' : 'bg-bg/85 border-border2 text-title'}`}>
              {selected ? '✓' : '+'}
            </div>
          ) : (
            onLike && (
              <div className="absolute top-2.5 right-2.5">
                <LikeButton liked={liked} onToggle={() => onLike(item.id)} />
              </div>
            )
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
            {priceText ? (
              <span className="text-[13px] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-btn">
                {priceText}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-white/70 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-btn">
                Цена на WB →
              </span>
            )}
          </div>
        </div>

        <div className="p-3 pb-2">
          <div className="font-product text-[13px] leading-snug line-clamp-2 h-[38px] text-title">{title}</div>
        </div>
      </button>

      <div className="px-3 pb-3 flex items-center gap-2">
        <a href={shopUrl} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-9 h-9 rounded-xl bg-bgSoft border border-border2 flex items-center justify-center text-base active:scale-95 transition">
          🛍
        </a>
        <button
          onClick={() => { haptic('medium'); onTryon ? onTryon(item) : onPick(item); }}
          className="flex-1 h-9 rounded-xl text-bg active:scale-[0.97] transition-all relative overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #E5CBAA 0%, #D4B595 50%, #B89876 100%)' }}
        >
          <span className="relative z-10 flex items-center justify-center h-full w-full text-[10px] font-bold uppercase tracking-[0.06em] font-btn leading-none">
            Примерить
          </span>
          <span className="absolute inset-0 -translate-x-full group-active:translate-x-0 transition-transform bg-white/10" />
        </button>
      </div>
    </div>
  );
}

// ============ BEFORE/AFTER ============
function BeforeAfter({ before, after }) {
  const [pos, setPos] = useState(50);
  const [afterLoaded, setAfterLoaded] = useState(false);
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const ref = useRef(null);

  const handleMove = (clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setPos(p);
  };

  const ready = afterLoaded && beforeLoaded;

  return (
    <div ref={ref} className="relative w-full rounded-2xl overflow-hidden select-none border border-border1 bg-card aspect-[3/4]"
      onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
      onMouseDown={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchStart={(e) => handleMove(e.touches[0].clientX)}>

      {/* Лоадер пока грузятся обе картинки */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-bgSoft via-card to-bgSoft z-20">
          <div className="absolute inset-0 shimmer" />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <div className="text-xs text-muted font-btn">Загружаем результат…</div>
          </div>
        </div>
      )}

      {/* After — фон */}
      <img
        src={after}
        alt="after"
        onLoad={() => setAfterLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Before — обрезается по width */}
      <div className="absolute inset-0 overflow-hidden transition-opacity duration-500" style={{ width: `${pos}%`, opacity: ready ? 1 : 0 }}>
        <img
          src={before}
          alt="before"
          onLoad={() => setBeforeLoaded(true)}
          className="absolute inset-0 h-full object-cover"
          style={{ width: ref.current?.offsetWidth || '100vw', maxWidth: 'none' }}
        />
      </div>

      {/* Ползунок и метки — только после загрузки */}
      {ready && (
        <>
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none" style={{ left: `${pos}%` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-black text-sm font-bold">⇆</div>
          </div>
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[9px] uppercase tracking-wider2 pointer-events-none font-btn">До</div>
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[9px] uppercase tracking-wider2 pointer-events-none font-btn">После</div>
        </>
      )}
    </div>
  );
}

// ============ LOADING ============
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
          <div className="text-5xl animate-float">✨</div>
        </div>
      </div>
      <div className="text-xl font-btn font-bold mb-3">Подбираем образ</div>
      <div className="text-sm text-muted transition-opacity duration-500 font-btn">{HINTS[hintIdx]}</div>
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
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in">
      <div className="text-6xl mb-5 animate-float">{emoji}</div>
      <div className="text-lg font-btn font-bold text-title mb-2">{title}</div>
      <div className="text-xs text-muted max-w-xs mb-6 leading-relaxed">{text}</div>
      {cta && <button onClick={onCta} className="px-6 py-3 rounded-2xl bg-accent text-bg text-xs font-bold uppercase tracking-wider2 active:scale-[0.98] font-btn">{cta}</button>}
    </div>
  );
}

// ============ SUBSCRIPTION SUCCESS ANIMATION ============
function SubscriptionSuccess({ sub, subscription, onClose }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Анимация появления — 3 стадии
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const accent = sub?.accent || '#D4B595';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5"
      style={{ background: 'rgba(12, 10, 8, 0.95)', backdropFilter: 'blur(20px)' }}>

      {/* Конфетти/частицы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i}
            className="absolute text-2xl"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-50px',
              animation: `fall ${2 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`,
              opacity: 0,
            }}>
            {['✨', '💎', '⭐️', '🎉', '🔥'][i % 5]}
          </div>
        ))}
      </div>

      <div className="relative w-full max-w-sm text-center"
        style={{
          transform: stage >= 1 ? 'scale(1)' : 'scale(0.8)',
          opacity: stage >= 1 ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>

        {/* Верхний огонёк / галочка */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${accent}40` }} />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
                boxShadow: `0 0 60px ${accent}80, 0 0 100px ${accent}40`,
              }}>
              <span style={{ animation: 'pop 0.6s ease-out 0.3s both' }}>✓</span>
            </div>
          </div>
        </div>

        {/* Заголовок */}
        <div
          className="text-3xl font-btn font-bold mb-3"
          style={{
            color: accent,
            transform: stage >= 2 ? 'translateY(0)' : 'translateY(10px)',
            opacity: stage >= 2 ? 1 : 0,
            transition: 'all 0.5s ease-out 0.2s',
          }}>
          Подписка активирована!
        </div>

        {/* Подписка */}
        <div
          className="mb-6 rounded-2xl p-5 border"
          style={{
            background: `linear-gradient(135deg, ${accent}15 0%, transparent 100%)`,
            borderColor: `${accent}40`,
            transform: stage >= 2 ? 'translateY(0)' : 'translateY(10px)',
            opacity: stage >= 2 ? 1 : 0,
            transition: 'all 0.5s ease-out 0.3s',
          }}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="text-4xl">{sub.emoji || '💎'}</div>
            <div className="text-2xl font-btn font-bold" style={{ color: accent }}>
              {sub.name}
            </div>
          </div>

          {subscription ? (
            <div className="space-y-2 text-sm font-btn">
              <div className="flex justify-between items-center">
                <span className="text-muted">Примерок начислено</span>
                <span className="font-bold text-title">{subscription.tries_left}</span>
              </div>
              {subscription.tries_total > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted">Всего доступно</span>
                  <span className="font-bold text-title">{subscription.tries_total}</span>
                </div>
              )}
              {subscription.expires_at && (
                <div className="flex justify-between items-center pt-2 border-t border-border1">
                  <span className="text-muted">Действует до</span>
                  <span className="font-bold text-title">{formatDate(subscription.expires_at)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted font-btn py-2">
              Подписка успешно оформлена
            </div>
          )}
        </div>

        {/* Кнопка */}
        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl text-sm font-bold uppercase font-btn active:scale-[0.98] transition"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
            color: '#0C0A08',
            opacity: stage >= 2 ? 1 : 0,
            transition: 'all 0.5s ease-out 0.5s',
          }}>
          Продолжить
        </button>
      </div>

      <style>{`
        @keyframes fall {
          0% { top: -50px; opacity: 0; transform: rotate(0deg); }
          10% { opacity: 1; }
          100% { top: 110vh; opacity: 1; transform: rotate(360deg); }
        }
        @keyframes pop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ============ СТРИК ============
function StreakSheet({ streak, onClose }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const current = ((streak - 1) % 5) + 1;

  useEffect(() => {
    fetch(`${BACKEND}/api/streak-rewards`)
      .then(r => r.json())
      .then(d => { if (d.success) setRewards(d.rewards || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl border-t border-border2 p-6 pb-8 animate-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1 bg-border2 rounded-full mx-auto mb-5" />
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🔥</div>
          <div className="text-xl font-btn font-bold mb-1">Серия {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</div>
          <div className="text-xs text-muted font-btn">Заходи каждый день и получай награды</div>
        </div>
        <div className="space-y-2 mb-5">
          {loading ? (
            <div className="text-center py-6 text-muted text-xs font-btn">Загрузка…</div>
          ) : (
            [1,2,3,4,5].map(day => {
              const r = rewards.find(x => x.day === day) || { enabled: true, tries: 0, text: '' };
              const isPast = day < current;
              const isCurrent = day === current;
              const disabled = !r.enabled;

              return (
                <div key={day}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${disabled ? 'opacity-40' : ''} ${isCurrent ? 'bg-accent/15 border-accent shadow-soft' : isPast ? 'bg-bgSoft border-border1 opacity-60' : 'bg-bgSoft border-border1'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-btn ${isCurrent ? 'bg-accent text-bg' : 'bg-bg border border-border2 text-muted'}`}>
                    {isPast ? '✓' : `Д${day}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium font-btn ${isCurrent ? 'text-accent' : 'text-title'}`}>
                      {r.text || `День ${day}`}
                    </div>
                    <div className="text-[10px] text-muted font-btn">
                      {disabled ? 'Отключено' : r.tries > 0 ? `+${r.tries} примерок` : 'Без награды'}
                    </div>
                  </div>
                  {isCurrent && <span className="text-[9px] uppercase tracking-wider2 text-accent font-bold font-btn">Сегодня</span>}
                </div>
              );
            })
          )}
        </div>
        <button onClick={onClose} className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider2 font-btn">Понятно</button>
      </div>
    </div>
  );
}

// ============ ONBOARDING ============
const SLIDES = [
  { emoji: '✨', title: 'Примерь любой образ', text: 'Загрузите фото в полный рост, выберите вещь — ИИ покажет, как она сидит именно на вас' },
  { emoji: '🛍', title: 'Готовый гардероб', text: 'Свежие находки с Wildberries каждый день' },
  { emoji: '❤️', title: 'Сохраняй любимое', text: 'Тапни ❤️ на товаре — он уйдёт в избранное' },
];
function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  return (
    <div className="min-h-screen flex flex-col px-8 pt-16 pb-10 bg-bg">
      <div className="flex justify-center gap-2 mb-12">
        {SLIDES.map((_, k) => <div key={k} className={`h-[3px] rounded-full transition-all duration-300 ${k === i ? 'w-8 bg-accent' : 'w-2 bg-border2'}`} />)}
      </div>
      <div key={i} className="flex-1 flex flex-col items-center justify-center text-center animate-slide-up">
        <div className="text-7xl mb-8 animate-float">{SLIDES[i].emoji}</div>
        <h2 className="text-2xl font-btn font-bold mb-4">{SLIDES[i].title}</h2>
        <p className="text-sm text-muted2 max-w-xs leading-relaxed">{SLIDES[i].text}</p>
      </div>
      <button onClick={() => { haptic('medium'); last ? onDone() : setI(i + 1); }} className="w-full bg-accent text-bg py-4 rounded-2xl text-sm font-medium uppercase font-btn">
        {last ? 'Продолжить' : 'Далее'}
      </button>
    </div>
  );
}

// ============ ОБЯЗАТЕЛЬНЫЙ ТЕСТ ПЕРСОНАЛИЗАЦИИ ============
function PersonalizationTest({ user, onDone, onToast }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  const choose = (q, opt) => {
    haptic('medium');
    const next = { ...answers, [q.id]: opt.value, [`${q.id}_cat`]: opt.cat };
    setAnswers(next);

    if (step < ONBOARD_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      fetch(`${BACKEND}/api/save-personalization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || '',
          answers: next,
        }),
      })
        .then(r => r.json())
        .then(d => { if (d.success) onDone(); else onToast('Ошибка сохранения'); })
        .catch(() => onToast('Нет связи'))
        .finally(() => setSaving(false));
    }
  };

  if (saving) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
      <div className="spinner mb-6" />
      <div className="text-sm text-muted font-btn">Подбираем для тебя…</div>
    </div>
  );

  const q = ONBOARD_QUESTIONS[step];
  return (
    <div className="min-h-screen flex flex-col px-6 pt-12 pb-8 bg-bg">
      <div className="text-center mb-8">
        <div className="text-[10px] uppercase tracking-wider2 text-accent mb-2 font-btn">Шаг {step + 1} из {ONBOARD_QUESTIONS.length}</div>
        <h2 className="text-xl font-btn font-bold">Немного о тебе</h2>
        <p className="text-xs text-muted mt-2 font-btn">Чтобы подобрать вещи именно под тебя</p>
      </div>
      <div className="flex gap-1.5 mb-8">
        {ONBOARD_QUESTIONS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-border2'} transition-all`} />
        ))}
      </div>
      <div className="text-base font-btn font-bold mb-6">{q.q}</div>
      <div className="space-y-3 flex-1">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => choose(q, opt)}
            className="w-full bg-card border border-border1 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition hover:border-accent animate-slide-up"
            style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="text-3xl">{opt.emoji}</div>
            <div className="text-left flex-1 font-btn font-bold text-sm">{opt.text}</div>
            <div className="text-accent text-xl">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ BOTTOM NAV ============
function BottomNav({ active, onChange }) {
  const items = [
    { key: 'catalog', label: 'Каталог',  emoji: '👗' },
    { key: 'search',  label: 'Поиск',    emoji: '🔍' },
    { key: 'subs',    label: 'Подписка', emoji: '💎' },
    { key: 'profile', label: 'Профиль',  emoji: '👤' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}>
      <nav className="mx-auto max-w-md pointer-events-auto rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(26, 20, 18, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(212, 181, 149, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}>
        <div className="flex items-center justify-around px-2 py-2">
          {items.map(it => {
            const isActive = active === it.key;
            return (
              <button key={it.key}
                onClick={() => { haptic('light'); onChange(it.key); }}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-accent/15' : ''}`}>
                <span className={`text-lg transition-transform duration-300 ${isActive ? 'scale-110' : 'opacity-60'}`}>{it.emoji}</span>
                <span className={`text-[9px] uppercase font-btn transition-colors ${isActive ? 'text-accent font-bold' : 'text-muted'}`}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MaintenanceScreen({ text }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-bg">
      <div className="text-7xl mb-8 animate-float">🚧</div>
      <h1 className="text-2xl font-btn font-bold mb-4 text-title">Ведутся работы</h1>
      <p className="text-sm text-muted2 max-w-xs leading-relaxed font-btn">{text || 'Скоро вернёмся, заходите чуть позже ✨'}</p>
      <div className="mt-10 text-[10px] uppercase tracking-wider2 text-muted font-btn">Style Room</div>
    </div>
  );
}

// ============ ЗАГЛУШКА В РАЗРАБОТКЕ ============
function ComingSoonScreen({ onBack, title = 'В разработке', description = 'Эта функция скоро появится' }) {
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="text-7xl mb-6 animate-float">🚧</div>
        <h1 className="text-2xl font-btn font-bold mb-3">{title}</h1>
        <p className="text-sm text-muted max-w-xs leading-relaxed font-btn mb-6">{description}</p>
        <div className="text-[10px] uppercase tracking-wider2 text-accent font-btn">Style Room · скоро</div>
      </div>
    </main>
  );
}

// ============ SUBSCRIPTIONS ============
function SubscriptionsScreen({ onBack, onBuy, subs = [], user, triesPrice = 10, onSubscriptionChange }) {
  const [expanded, setExpanded] = useState('secret');
  const [mySub, setMySub] = useState(null);
  const [loadingMy, setLoadingMy] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null); // { sub, warning }

  // Загружаем текущую подписку юзера
  useEffect(() => {
    fetch(`${BACKEND}/api/my-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) setMySub(d.subscription); })
      .catch(() => {})
      .finally(() => setLoadingMy(false));
  }, []);

  // Форматирование даты: "6 ноября 2025"
  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Считаем выгоду: сколько было бы поштучно vs цена подписки
  const calcSaving = (sub) => {
  if (!sub.tries || sub.tries === 0) return null;
  const byPiece = sub.tries * triesPrice;
  const saving = byPiece - sub.price;
  return { byPiece, saving };
};

  // Клик по подписке
  const handleBuy = (sub) => {
    // Если есть активная подписка и это НЕ она — показываем предупреждение
    if (mySub && mySub.id !== sub.id && mySub.tries_left > 0) {
      setConfirmModal({
        sub,
        warning: {
          oldName: mySub.name,
          oldEmoji: mySub.emoji,
          oldTries: mySub.tries_left,
        },
      });
      return;
    }
    onBuy(sub.id);
  };

  const confirmBuy = () => {
    if (!confirmModal) return;
    const subId = confirmModal.sub.id;
    setConfirmModal(null);
    onBuy(subId);
  };

  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted">←</button>
        <div>
          <div className="text-[10px] uppercase text-muted font-btn">Style Room</div>
          <div className="text-2xl font-btn font-bold">Подписки</div>
        </div>
      </div>

      {/* ============ БЛОК «ВЫ СЕЙЧАС НА...» ============ */}
      {!loadingMy && mySub && (
        <div className="mb-6 rounded-3xl overflow-hidden animate-slide-up"
          style={{
            background: `linear-gradient(135deg, ${mySub.accent || '#D4B595'} 20%, #1A1412 100%)`,
            border: `1px solid ${mySub.accent || '#D4B595'}`,
            boxShadow: `0 8px 30px ${(mySub.accent || '#D4B595')}30`,
          }}>
          <div className="p-5">
            <div className="text-[10px] uppercase tracking-wider2 text-white/70 font-btn mb-2">
              ✅ Вы сейчас на подписке
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{mySub.emoji}</div>
              <div className="flex-1">
                <div className="text-xl font-btn font-bold text-white">{mySub.name}</div>
                <div className="text-xs text-white/80 font-btn">
  💎 Подписка на месяц · до {formatDate(mySub.expires_at)}
</div>
              </div>
            </div>

            {/* Прогресс-бар */}
            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-white/90 font-btn mb-1.5">
                <span>Примерок осталось</span>
                <span className="font-bold">{mySub.tries_left} / {mySub.tries_total}</span>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${mySub.tries_total > 0 ? (mySub.tries_left / mySub.tries_total) * 100 : 0}%`,
                    background: mySub.accent || '#D4B595',
                  }} />
              </div>
            </div>

            {/* Дни */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/30 rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase text-white/60 font-btn">Осталось</div>
                <div className="text-sm font-btn font-bold text-white">{mySub.days_left} дн.</div>
              </div>
              <div className="bg-black/30 rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase text-white/60 font-btn">Примерок</div>
                <div className="text-sm font-btn font-bold text-white">{mySub.tries_left}</div>
              </div>
            </div>

            {/* Плашка заканчивается */}
            {mySub.days_left <= 3 && mySub.days_left > 0 && (
              <div className="mt-3 rounded-xl bg-red-500/20 border border-red-500/40 p-3 flex items-start gap-2">
                <span className="text-base">⏰</span>
                <div className="flex-1">
                  <div className="text-[11px] font-btn font-bold text-red-300">
                    Заканчивается через {mySub.days_left} {mySub.days_left === 1 ? 'день' : 'дня'}
                  </div>
                  <div className="text-[10px] text-white/70 font-btn mt-0.5">
                    Продли подписку, чтобы сохранить доступ
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ СПИСОК ПОДПИСОК ============ */}
      <div className="space-y-4">
        {subs.map(sub => {
          const isOpen = expanded === sub.id;
          const isSecret = sub.id === 'secret';
          const isActive = mySub && mySub.id === sub.id;
          const saving = calcSaving(sub);

          return (
            <div key={sub.id}
              className={`bg-card rounded-3xl overflow-hidden transition-all duration-300 ${isActive ? 'ring-2 ring-accent' : ''}`}
              style={{
                border: `1px solid ${isOpen ? sub.accent : '#2a1f1a'}`,
                boxShadow: isOpen ? `0 0 30px ${sub.accent}20` : 'none',
              }}>
              <button onClick={() => { haptic('light'); setExpanded(isOpen ? null : sub.id); }}
                className="w-full flex items-center justify-between px-5 py-5 text-left">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${isSecret ? 'animate-pulse-glow' : ''}`}
                    style={{ background: `${sub.accent}20`, border: `1px solid ${sub.accent}40` }}>
                    {sub.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] uppercase mb-0.5 font-btn" style={{ color: sub.accent }}>{sub.subtitle}</div>
                      {isActive && (
                        <div className="text-[9px] uppercase tracking-wider2 bg-accent text-bg px-1.5 py-0.5 rounded font-btn font-bold">
                          Активна
                        </div>
                      )}
                    </div>
                    <div className="text-base font-btn font-bold">{sub.name}</div>
                    <div className="flex items-center gap-2 mt-1 font-btn">
                      {sub.price_old > 0 && <span className="text-xs text-muted line-through">{sub.price_old}⭐️</span>}
                      <span className="text-base font-bold" style={{ color: sub.accent }}>   {sub.price}⭐️{sub.duration_days > 0 ? <span className="text-[11px] text-muted font-normal ml-0.5">/мес</span> : null} </span>
                    </div>
                  </div>
                </div>
                {!isSecret && <span className="text-lg" style={{ color: sub.accent, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>⌄</span>}
              </button>

              {!isSecret && (
                <div className="overflow-hidden" style={{ maxHeight: isOpen ? 600 : 0 }}>
                  <div className="border-t border-border1 px-5 py-4">
                    {/* Выгода */}
                    {saving && saving.saving > 0 && (
                      <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/30 px-3 py-2.5">
                        <div className="text-[10px] uppercase text-green-400 font-btn font-bold mb-1">
                          💰 Выгода
                        </div>
                        <div className="text-[11px] text-title font-btn">
                          Поштучно: <span className="text-muted line-through">{saving.byPiece}⭐️</span>
                        </div>
                        <div className="text-[11px] text-title font-btn">
                          Экономия: <span className="text-green-400 font-bold">{saving.saving}⭐️</span>
                        </div>
                      </div>
                    )}

                    {/* Фичи */}
                    {sub.features && sub.features.length > 0 && (
                      <ul className="space-y-3 mb-5">
                        {(Array.isArray(sub.features) ? sub.features : []).map((f, i) => (
                          <li key={i} className="flex items-start gap-3 text-xs font-btn">
                            <span>{f.icon}</span>
                            <span>{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Кнопка */}
                    <button
                      onClick={() => handleBuy(sub)}
                      className="w-full py-4 rounded-2xl text-xs font-bold uppercase text-bg active:scale-[0.98] transition font-btn mb-2"
                      style={{ background: sub.accent }}>
                      {isActive   ? `💎 Продлить за ${sub.price}⭐️${sub.duration_days > 0 ? '/мес' : ''}`   : `Оформить за ${sub.price}⭐️${sub.duration_days > 0 ? '/мес' : ''}` }
                    </button>

                    <a href={BUY_STARS_URL} target="_blank" rel="noreferrer"
                      className="block w-full text-center border border-border2 text-muted2 py-3 rounded-2xl text-[11px] font-btn uppercase active:scale-95">
                      💰 Купить звёзды
                    </a>
                  </div>
                </div>
              )}

              {isSecret && (
                <div className="border-t border-border1 px-5 py-4">
                  <div className="text-xs text-muted mb-4 italic font-btn">Секретное предложение. Внутри — сюрприз 🎁</div>
                  <button onClick={() => handleBuy(sub)}
                    className="w-full py-4 rounded-2xl text-xs font-bold uppercase text-bg active:scale-[0.98] transition font-btn mb-2"
                    style={{ background: sub.accent }}>
                    Оформить за {sub.price}⭐️
                  </button>
                  <a href={BUY_STARS_URL} target="_blank" rel="noreferrer"
                    className="block w-full text-center border border-border2 text-muted2 py-3 rounded-2xl text-[11px] font-btn uppercase active:scale-95">
                    💰 Купить звёзды
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============ МОДАЛКА ПОДТВЕРЖДЕНИЯ ============ */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-5 animate-fade-in" onClick={() => setConfirmModal(null)}>
          <div className="bg-card border border-border2 rounded-3xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <div className="text-lg font-btn font-bold mb-2">Перейти на {confirmModal.sub.name}?</div>
              <div className="text-xs text-muted leading-relaxed font-btn">
                У вас активна подписка <b className="text-accent">{confirmModal.warning.oldEmoji} {confirmModal.warning.oldName}</b> с{' '}
                <b className="text-accent">{confirmModal.warning.oldTries} примерками</b>.
                <br /><br />
                При переходе на <b>{confirmModal.sub.name}</b> неиспользованные примерки сгорят.
              </div>
            </div>
            <button onClick={confirmBuy}
              className="w-full py-3.5 rounded-2xl text-xs font-bold uppercase text-bg font-btn mb-2"
              style={{ background: confirmModal.sub.accent }}>
              Продолжить
            </button>
            <button onClick={() => setConfirmModal(null)}
              className="w-full py-3 rounded-2xl text-xs font-btn text-muted border border-border2">
              Отмена
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ============ BUY TRIES ============
function BuyTriesScreen({ onBack, onBuy, user, triesPrice = 10 }) {
  const [count, setCount] = useState(5);
  const price = triesPrice;
  const total = count * price;
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-5">Попытки</h1>

      <div className="bg-card border border-border1 rounded-3xl p-6 mb-5 text-center">
        <div className="flex items-center justify-center gap-5 mb-5">
          <button onClick={() => setCount(c => Math.max(1, c - 1))} className="w-12 h-12 rounded-full border border-border2 text-2xl text-accent font-light">−</button>
          <div className="text-6xl font-btn font-bold text-title min-w-[120px]">{count}</div>
          <button onClick={() => setCount(c => Math.min(500, c + 1))} className="w-12 h-12 rounded-full border border-accentSoft text-2xl text-accent font-light">+</button>
        </div>
        <div className="flex gap-2 justify-center mb-6">
          {[5, 10, 25, 50].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold font-btn ${count === n ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="text-[10px] uppercase text-muted mb-2 font-btn">Итого</div>
        <div className="text-4xl font-btn font-bold">{total}<span className="text-accent text-2xl ml-1">⭐️</span></div>
      </div>

      <div className="bg-card border border-border1 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase text-muted font-btn">Сейчас у тебя</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-btn font-bold text-accent">{user?.balance ?? 0}</span>
            <span className="text-accent text-xl">✨</span>
          </div>
        </div>
      </div>

      <button onClick={() => onBuy(count)}
        className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2 font-btn">
        Купить {count} за {total}⭐️
      </button>

      <a href={BUY_STARS_URL} target="_blank" rel="noreferrer"
        className="block w-full mt-2 text-center border border-border2 text-muted2 py-3 rounded-2xl text-xs font-btn uppercase active:scale-95">
        💰 Купить звёзды
      </a>
    </main>
  );
}

// ============ OWN TRIES ============
function OwnTriesScreen({ user, onBack, onToast }) {
  const [humanImg, setHumanImg] = useState('');
  const [wbLink, setWbLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const fileRef = useRef(null);

  const onPickFile = async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    // сбрасываем старое фото — анимация «уход»
    setHumanImg('');
    showToast('Обрабатываю фото…');
    const compressed = await compressImage(f, 720, 0.7);
    // пауза для плавности
    await new Promise(r => setTimeout(r, 150));
    setHumanImg(compressed);
    showToast('Фото загружено ✓');
  } catch { showToast('Ошибка'); }
};
  const run = async () => {
    if (!humanImg) return onToast('Загрузите фото');
    if (!wbLink.trim()) return onToast('Вставьте ссылку WB');
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/tryon-by-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', humanImg, wbLink: wbLink.trim() }) });
      const d = await r.json();
      if (d.success && d.resultUrl) { setResultImage(d.resultUrl); playReadySound(); haptic('medium'); }
      else onToast(d.error || 'Не получилось. Попробуй другое фото');
    } catch { onToast('Нет связи'); }
    finally { setLoading(false); }
  };

  if (loading) return <LoadingAnimation />;
  if (resultImage) return (
    <main className="px-5 pt-5 animate-fade-in">
      <div className="text-[10px] uppercase text-muted mb-3 font-btn">Результат</div>
      <img src={resultImage} alt="result" className="w-full rounded-2xl border border-border1 mb-5" onError={(e) => { e.target.src = 'https://placehold.co/600x800/1A1412/D4B595?text=Фото'; }} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={() => downloadImage(resultImage, 'style-room-own.jpg')} className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase font-btn">📥 Скачать</button>
        <button onClick={() => tgShare(resultImage)} className="w-full border border-accentSoft text-accent py-4 rounded-2xl text-xs font-bold uppercase font-btn">📤 Поделиться</button>
      </div>
      <button onClick={() => { setResultImage(null); setHumanImg(''); setWbLink(''); }} className="w-full border border-border2 text-muted2 py-3 rounded-2xl text-sm font-btn mb-2">Ещё раз</button>
      <button onClick={onBack} className="w-full text-xs text-muted py-3 font-btn">← Назад</button>
    </main>
  );

  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="text-xs text-muted mb-5 font-btn">← Назад</button>
      <h1 className="text-2xl font-btn font-bold mb-2">Свои товары</h1>
      <p className="text-xs text-muted mb-5 font-btn">Вставь ссылку WB — примерим</p>
      <div className="bg-card border border-border2 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-btn">Своих примерок</span>
          <span className="text-lg font-btn font-bold text-accent">{user?.own_tries ?? 0}</span>
        </div>
      </div>
      <label className="block mb-4">
        <div className="text-[10px] uppercase text-muted mb-2 font-btn">🔗 Ссылка WB</div>
        <input value={wbLink} onChange={(e) => setWbLink(e.target.value)} placeholder="https://www.wildberries.ru/catalog/..." className="w-full bg-card border border-border1 rounded-xl px-4 py-3 text-sm outline-none focus:border-accentSoft" />
      </label>
      <button onClick={() => fileRef.current?.click()} className="w-full bg-card border border-dashed border-border2 rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2 font-btn">
        <span className="text-2xl">{humanImg ? '✓' : '📷'}</span>
        <span>{humanImg ? 'Фото загружено' : 'Загрузить фото'}</span>
        <span className="text-[10px] text-muted/70 mt-1">Хорошее освещение · полный рост</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      {humanImg && <img src={humanImg} alt="" className="w-full max-h-72 object-contain rounded-2xl mb-4 border border-border1 animate-scale-in" />}
      <button onClick={run} disabled={(user?.own_tries || 0) <= 0} className="btn-shine w-full disabled:opacity-30 text-bg py-4 rounded-2xl text-xs font-bold uppercase mt-4 font-btn">
        {(user?.own_tries || 0) <= 0 ? 'Купите примерки' : 'Запустить · 1 попытка'}
      </button>
    </main>
  );
}

// ============ HISTORY ============
function HistoryScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${BACKEND}/api/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }) })
      .then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-5">Мои примерки</h1>
      {loading && <div className="text-center py-16 text-muted text-sm font-btn">Загрузка…</div>}
      {!loading && items.length === 0 && <EmptyState emoji="👗" title="Пока пусто" text="Сделай первую примерку — она появится здесь" />}
      <div className="grid grid-cols-2 gap-3">
        {items.map(it => (
          <div key={it.id} className="bg-card border border-border1 rounded-2xl overflow-hidden">
            <div className="aspect-[3/4]">
              <img src={it.result_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/400x500/1A1412/D4B595?text=Style+Room'; }} />
            </div>
            <div className="p-2.5">
              <div className="text-[10px] text-muted line-clamp-2 h-[26px] mb-2">{it.product_name || 'Товар'}</div>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => downloadImage(it.result_url, `style-room-${it.id}.jpg`)} className="bg-accent text-bg text-[10px] py-2 rounded-xl font-bold active:scale-95 transition">📥</button>
                <button onClick={() => tgShare(it.result_url)} className="bg-bgSoft border border-border2 text-accent text-[10px] py-2 rounded-xl active:scale-95 transition">📤</button>
                {it.product_wb_id ? <a href={wbUrl(it.product_wb_id)} target="_blank" rel="noreferrer" className="bg-bgSoft border border-border2 text-accent text-[10px] py-2 rounded-xl text-center">🛍</a> : <div />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ============ FAVORITES ============
function FavoritesScreen({ onBack, onPick, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const load = useCallback((c) => {
    setLoading(true);
    fetch(`${BACKEND}/api/favorites/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', category: c === 'personal' ? 'all' : c }) })
      .then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(cat); }, [cat, load]);
  const unlike = async (productId) => {
    setItems(items.filter(x => x.id !== productId));
    try { await fetch(`${BACKEND}/api/favorites/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', productId }) }); onToast('Убрано'); } catch {}
  };
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-5">❤️ Избранное</h1>
      <div className="relative -mx-5 mb-5">
  <div
    className="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1"
    style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
  >
    {CATEGORIES.map(c => {
      const active = cat === c.key;
      return (
        <button
          key={c.key}
          onClick={() => { haptic('light'); setCat(c.key); }}
          className={`shrink-0 whitespace-nowrap text-xs px-3.5 py-2 rounded-full border flex items-center gap-1.5 transition-all font-btn ${active ? 'bg-accent text-bg border-accent font-bold shadow-soft' : 'border-border2 text-muted2'}`}
        >
          <span>{c.emoji}</span>{c.label}
        </button>
      );
    })}
  </div>
</div>
      {loading && <div className="text-center py-16 text-muted text-sm font-btn">Загрузка…</div>}
      {!loading && items.length === 0 && <EmptyState emoji="💔" title="Пока пусто" text="Нажимай ❤️ на товары — они появятся здесь" />}
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => <ProductCard key={item.id} item={item} onPick={onPick} liked={true} onLike={unlike} />)}
      </div>
    </main>
  );
}

// ============ ACHIEVEMENTS ============
function AchievementsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${BACKEND}/api/achievements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }) })
      .then(r => r.json()).then(d => { if (d.success) setItems(d.items || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const earned = items.filter(x => x.earned).length;
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-1">🏆 Достижения</h1>
      <p className="text-xs text-muted mb-5 font-btn">Открыто {earned} из {items.length}</p>
      {loading && <div className="text-center py-16 text-muted text-sm font-btn">Загрузка…</div>}
      <div className="grid grid-cols-2 gap-3">
        {items.map(a => (
          <div key={a.code} className={`rounded-2xl border p-4 text-center transition-all ${a.earned ? 'bg-card border-accentSoft shadow-soft' : 'bg-bgSoft border-border1 opacity-50'}`}>
            <div className={`text-4xl mb-2 ${a.earned ? 'animate-float' : 'grayscale'}`}>{a.emoji}</div>
            <div className="text-xs font-bold text-title mb-1 font-btn">{a.name}</div>
            <div className="text-[10px] text-muted leading-snug font-btn">{a.desc}</div>
            {a.earned && <div className="text-[9px] text-accent uppercase tracking-wider2 mt-2 font-btn">✓ Открыто</div>}
          </div>
        ))}
      </div>
    </main>
  );
}

// ============ LEADERBOARD ============
function LeaderboardScreen({ onBack, onPick, user, myRank }) {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/api/top-products`).then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`${BACKEND}/api/leaderboard`).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([p, u]) => { setProducts(p.items || []); setUsers(u.items || []); }).finally(() => setLoading(false));
  }, []);
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-4">👑 Лидеры</h1>

      {myRank && myRank.rank && (
        <div className="bg-gradient-to-r from-accent/20 to-accent/5 border border-accent rounded-2xl p-4 mb-5 animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent text-bg flex items-center justify-center text-lg font-bold font-btn">#{myRank.rank}</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-accent font-btn">Твоё место</div>
              <div className="text-[11px] text-muted font-btn">{myRank.my_count} примерок · из {myRank.total}</div>
            </div>
            <div className="text-2xl">🌟</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5">
        <button onClick={() => setTab('products')} className={`py-3 rounded-2xl border text-xs font-bold font-btn ${tab === 'products' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>🔥 Товары</button>
        <button onClick={() => setTab('users')} className={`py-3 rounded-2xl border text-xs font-bold font-btn ${tab === 'users' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>👥 Юзеры</button>
      </div>
      {loading && <div className="text-center py-16 text-muted text-sm font-btn">Загрузка…</div>}
      {!loading && tab === 'products' && (
        products.length === 0 ? <EmptyState emoji="📊" title="Пока нет данных" text="Топы появятся после примерок" /> :
        <div className="grid grid-cols-2 gap-3">
          {products.map((p, i) => (
            <div key={p.id} className="relative animate-slide-up" style={{ animationDelay: `${i*0.05}s` }}>
              <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-accent text-bg flex items-center justify-center text-xs font-bold font-btn">#{i+1}</div>
              <ProductCard item={p} onPick={onPick} />
              <div className="absolute bottom-[70px] right-3 text-[10px] text-accent font-bold font-btn">🔥 {p.tryons}</div>
            </div>
          ))}
        </div>
      )}
      {!loading && tab === 'users' && (
        users.length === 0 ? <EmptyState emoji="👥" title="Пока пусто" text="Юзеры с примерками появятся здесь" /> :
        <div className="space-y-2">
          {users.map((u, i) => {
            const isMe = u.tg_id === user?.tg_id;
            return (
              <div key={u.tg_id} className={`rounded-2xl p-3 flex items-center gap-3 animate-slide-up ${isMe ? 'bg-accent/15 border-2 border-accent' : 'bg-card border border-border1'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-btn ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-bgSoft text-muted'}`}>#{i+1}</div>
                <img src={u.photo_url || 'https://placehold.co/60x60/1A1412/D4B595?text=U'} alt="" className="w-10 h-10 rounded-full object-cover border border-border2" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate font-btn ${isMe ? 'text-accent' : ''}`}>{u.first_name || '—'} {isMe && '· ты'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-btn font-bold text-accent">{u.tryons}</div>
                  <div className="text-[9px] uppercase text-muted font-btn">примерок</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ============ GIFT ============
function GiftScreen({ onBack, onToast, user }) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [giftUrl, setGiftUrl] = useState('');
  const total = count * 5;
  const create = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/gift/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', tries: count }) });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error || 'Ошибка');
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => {
        if (s === 'paid') {
          const link = `https://t.me/GFstyleroom_bot/app?startapp=gift_${d.giftCode}`;
          setGiftUrl(link);
          onToast('🎁 Подарок создан!');
        }
      });
    } catch (e) { onToast('Ошибка: ' + e.message); }
    finally { setLoading(false); }
  };
  const shareGift = () => {
    const text = `🎁 Дарю тебе ${count} примерок в Style Room! Открой:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(giftUrl)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink?.(url) || window.open(url, '_blank');
  };
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <h1 className="text-2xl font-btn font-bold mb-2">🎁 Подарить подруге</h1>
      <p className="text-xs text-muted mb-5 font-btn">Купи примерки и отправь ссылку</p>
      {!giftUrl ? (
        <>
          <div className="bg-card border border-border1 rounded-3xl p-6 mb-5 text-center">
            <div className="flex items-center justify-center gap-5 mb-5">
              <button onClick={() => setCount(c => Math.max(1, c - 1))} className="w-12 h-12 rounded-full border border-border2 text-2xl text-accent font-light">−</button>
              <div className="text-5xl font-btn font-bold min-w-[100px]">{count}</div>
              <button onClick={() => setCount(c => Math.min(50, c + 1))} className="w-12 h-12 rounded-full border border-accentSoft text-2xl text-accent font-light">+</button>
            </div>
            <div className="text-[10px] uppercase text-muted mb-1 font-btn">Итого</div>
            <div className="text-3xl font-btn font-bold">{total}<span className="text-accent text-xl ml-1">⭐️</span></div>
          </div>
          <button onClick={create} disabled={loading} className="btn-shine w-full text-bg py-4 rounded-2xl text-xs font-bold uppercase disabled:opacity-40 font-btn">
            {loading ? 'Создаю…' : `Оплатить ${total}⭐️`}
          </button>
          <a href={BUY_STARS_URL} target="_blank" rel="noreferrer"
            className="block w-full mt-2 text-center border border-border2 text-muted2 py-3 rounded-2xl text-xs font-btn uppercase active:scale-95">
            💰 Купить звёзды
          </a>
        </>
      ) : (
        <div className="bg-card border border-accentSoft rounded-3xl p-6 text-center animate-bounce-in">
          <div className="text-5xl mb-4">🎉</div>
          <div className="text-xl font-btn font-bold mb-2">Подарок готов!</div>
          <div className="text-xs text-muted mb-5 font-btn">Отправь ссылку подруге</div>
          <div className="bg-bg border border-border1 rounded-2xl p-3 mb-4 break-all text-[10px] text-muted">{giftUrl}</div>
          <button onClick={shareGift} className="btn-shine w-full text-bg py-4 rounded-2xl text-xs font-bold uppercase font-btn">📤 Поделиться</button>
          <button onClick={() => setGiftUrl('')} className="w-full mt-3 text-xs text-muted py-2 font-btn">Создать ещё один</button>
        </div>
      )}
    </main>
  );
}

// ============ STREAK TIMER (в шапке) ============
function StreakTimer({ user, onOpenSheet, onComplete, BACKEND }) {
  const [seconds, setSeconds] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.tg_id) return;

    let isActive = true;
    let localSeconds = 0;
    let unsentSeconds = 0;

    // Загружаем текущий прогресс
    const loadStatus = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/streak/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
        });
        const d = await r.json();
        if (d.success && isActive) {
          localSeconds = d.seconds_today || 0;
          setSeconds(localSeconds);
          setReady(true);
        }
      } catch {
        if (isActive) setReady(true);
      }
    };
    loadStatus();

    // Локальный тик — каждую секунду
    const localInterval = setInterval(() => {
      if (document.hidden) return;
      if (!isActive) return;
      if (localSeconds >= 600) return;
      localSeconds = Math.min(600, localSeconds + 1);
      unsentSeconds += 1;
      setSeconds(localSeconds);

      if (localSeconds >= 600) {
        clearInterval(localInterval);
      }
    }, 1000);

    // Отправка на бэк — раз в 30 сек
    const sendInterval = setInterval(async () => {
      if (!isActive || document.hidden) return;
      if (unsentSeconds <= 0) return;
      const toSend = unsentSeconds;
      unsentSeconds = 0;
      try {
        const r = await fetch(`${BACKEND}/api/streak/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: window.Telegram?.WebApp?.initData || '',
            seconds: toSend,
          }),
        });
        const d = await r.json();
        if (d.success && isActive && d.just_completed) {
          onComplete?.(d.streak_days);
        }
      } catch {}
    }, 30000);

    return () => {
      isActive = false;
      clearInterval(localInterval);
      clearInterval(sendInterval);
    };
  }, [user?.tg_id]);

  const completed = seconds >= 600;
  const mins = Math.floor((600 - seconds) / 60);
  const secs = (600 - seconds) % 60;

  if (!ready) return null;

  return (
    <button
      onClick={onOpenSheet}
      className={`relative flex items-center gap-1 px-2 py-1.5 rounded-full border active:scale-95 transition font-btn shrink-0 ${
        completed
          ? 'bg-orange-500/15 border-orange-400/40'
          : 'bg-card border-border2 opacity-70'
      }`}
    >
      {completed ? (
        <>
          <span className="text-[11px]">🔥</span>
          <span className="text-[11px] font-bold text-orange-300">{user.streak_days || 0}</span>
        </>
      ) : (
        <>
          <span className="text-[11px] opacity-60">⏱</span>
          <span className="text-[11px] font-bold text-muted">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span
            className="absolute bottom-0 left-0 h-[2px] bg-accent rounded-full transition-all duration-500"
            style={{ width: `${(seconds / 600) * 100}%` }}
          />
        </>
      )}
    </button>
  );
}

// ============ ADMIN SCREEN ============
function AdminScreen({ user, onBack, onToast, onCatalogRefreshed }) {
  const [tab, setTab] = useState('refresh');
  const [loading, setLoading] = useState(null);
  const [last, setLast] = useState(null);

  const CATS = [
    { key: 'autumn',    label: 'Осень',           emoji: '🍂' },
    { key: 'top',       label: 'Верх',            emoji: '👕' },
    { key: 'bottom',    label: 'Низ',             emoji: '👖' },
    { key: 'outerwear', label: 'Верхняя одежда',  emoji: '🧥' },
    { key: 'suit',      label: 'Костюмы',         emoji: '🥼' },
    { key: 'dress',     label: 'Платья',          emoji: '👗' },
  ];

  const refresh = (category) => {
    if (!user?.is_admin) return onToast('Нет доступа');
    if (loading) return onToast('Уже идёт пополнение');

    setLoading(category);
    setLast(null);
    const startedAt = Date.now();
    localStorage.setItem('admin_refresh_started', JSON.stringify({ category, startedAt }));
    onToast(`🔄 Пополняю…`);
    haptic('medium');

    fetch(`${BACKEND}/api/admin/refresh-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', category }),
    })
      .then(async (r) => {
        const txt = await r.text().catch(() => '');
        let d = {};
        try { d = JSON.parse(txt); } catch { d = { success: false, reason: `HTTP ${r.status}` }; }
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        const result = { category, elapsed, ...d };
        setLast(result);
        setLoading(null);
        localStorage.removeItem('admin_refresh_started');
        localStorage.setItem('admin_last_refresh', JSON.stringify(result));

        if (d.success) {
          onToast(`✅ +${d.added || 0} за ${elapsed}с`);
          onCatalogRefreshed?.();
        } else {
          onToast(`❌ ${d.reason || d.error || 'Ошибка'}`);
        }
      })
      .catch((e) => {
        setLast({ category, success: false, reason: 'Ошибка сети: ' + e.message });
        setLoading(null);
        localStorage.removeItem('admin_refresh_started');
        onToast('❌ Ошибка сети');
      });
  };

  useEffect(() => {
    try {
      const started = localStorage.getItem('admin_refresh_started');
      if (started) {
        const { category, startedAt } = JSON.parse(started);
        if (Date.now() - startedAt > 60000) localStorage.removeItem('admin_refresh_started');
        else setLoading(category);
      }
      const lastStr = localStorage.getItem('admin_last_refresh');
      if (lastStr) setLast(JSON.parse(lastStr));
    } catch {}
  }, []);

  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <div className="text-[10px] uppercase text-accent mb-1 font-btn">👑 Только для админа</div>
      <h1 className="text-2xl font-btn font-bold mb-2">Админка</h1>
      <p className="text-xs text-muted mb-5 font-btn">Пополнение и подчистка</p>

     <div className="grid grid-cols-2 gap-2 mb-6">
  <button onClick={() => setTab('refresh')} className={`py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider2 font-btn ${tab === 'refresh' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>🔄 Пополнение</button>
  <button onClick={() => setTab('cleanup')} className={`py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider2 font-btn ${tab === 'cleanup' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>🧹 Подчистка</button>
  <button onClick={() => setTab('streak')} className={`py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider2 font-btn ${tab === 'streak' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>🔥 Серия</button>
  <button onClick={() => setTab('banner')} className={`py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider2 font-btn ${tab === 'banner' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>📢 Баннер</button>
  <button onClick={() => setTab('subs')} className={`col-span-2 py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider2 font-btn ${tab === 'subs' ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted'}`}>💎 Подписки</button>
</div>

      {tab === 'refresh' && (
        <>
          <button
            onClick={() => refresh('all')}
            disabled={!!loading}
            className="w-full bg-accent text-bg py-5 rounded-3xl text-xs font-bold uppercase tracking-wider2 mb-2 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 font-btn"
          >
            {loading === 'all'
              ? <><span className="inline-block w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" /> Пополняю…</>
              : <>🚀 Пополнить всё разом</>}
          </button>
          <p className="text-[10px] text-muted text-center mb-5 font-btn">Можно уйти — пополнение продолжится</p>

          <div className="text-[10px] uppercase text-muted mb-3 font-btn">Отдельные разделы</div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {CATS.map(c => (
              <button key={c.key} onClick={() => refresh(c.key)} disabled={!!loading}
                className="bg-card border border-border1 rounded-2xl p-4 text-left active:scale-[0.98] disabled:opacity-50 transition">
                <div className="text-3xl mb-2">{c.emoji}</div>
                <div className="text-xs font-bold mb-1 text-title font-btn">{c.label}</div>
                <div className="text-[10px] text-accent font-semibold font-btn">
                  {loading === c.key ? '⏳ Загрузка…' : '🔄 Пополнить'}
                </div>
              </button>
            ))}
          </div>

          {loading && (
            <div className="rounded-2xl p-4 border border-accent bg-accent/10 mb-5 animate-pulse">
              <div className="flex items-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                <div className="text-xs font-bold text-accent font-btn">Идёт пополнение…</div>
              </div>
            </div>
          )}

          {last && !loading && (
            <div className={`rounded-2xl p-4 border mb-5 ${last.success ? 'bg-card border-accentSoft' : 'bg-card border-red-500/40'}`}>
              <div className="text-xs font-bold mb-2 font-btn">
                {last.success ? '✅ Готово' : '❌ Ошибка'} · {last.category === 'all' ? 'всё разом' : last.category}
                {last.elapsed && <span className="text-muted font-normal"> · {last.elapsed}с</span>}
              </div>
              {last.success ? (
                <div className="text-[11px] text-muted2 space-y-0.5 font-btn">
                  <div>➕ Новых: <b className="text-accent">{last.added || 0}</b></div>
                  <div>🔄 Обновлено: <b>{last.updated || 0}</b></div>
                  <div>⊘ Пропущено: <b>{last.failed || 0}</b></div>
                </div>
              ) : (
                <div className="text-[11px] text-muted2 leading-relaxed break-words font-btn">{last.reason || 'Не удалось'}</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'cleanup' && <AdminCleanup onToast={onToast} onCatalogRefreshed={onCatalogRefreshed} />}
{tab === 'streak' && <AdminStreak onToast={onToast} />}
{tab === 'banner' && <AdminBanner onToast={onToast} />}
{tab === 'subs' && <AdminSubscriptions onToast={onToast} />}
</main>
  );
}

// ============ ADMIN STREAK ============
function AdminStreak({ onToast }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/streak-rewards`);
      const d = await r.json();
      if (d.success) {
        setRewards(d.rewards || []);
        setDirty({});
      }
    } catch { onToast('Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const setField = (day, field, value) => {
    const current = rewards.find(x => x.day === day) || { day, enabled: true, tries: 0, text: '' };
    setDirty(prev => ({
      ...prev,
      [day]: { ...(prev[day] || current), [field]: value },
    }));
  };

  const getVal = (day, field, fallback) => {
    if (dirty[day] && dirty[day][field] !== undefined) return dirty[day][field];
    const r = rewards.find(x => x.day === day);
    return r ? r[field] : fallback;
  };

  const hasChanges = Object.keys(dirty).length > 0;

  const saveAll = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const promises = Object.entries(dirty).map(([day, patch]) => {
        const current = rewards.find(x => x.day === Number(day)) || { day: Number(day), enabled: true, tries: 0, text: '' };
        const merged = { ...current, ...patch };
        return fetch(`${BACKEND}/api/admin/streak-rewards/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: window.Telegram?.WebApp?.initData || '',
            day: Number(day),
            enabled: merged.enabled,
            tries: merged.tries,
            own_tries: 0,
            text: merged.text,
          }),
        }).then(r => r.json());
      });
      const results = await Promise.all(promises);
      if (results.every(r => r.success)) {
        await load();
        onToast('✅ Все изменения сохранены');
      } else {
        onToast('❌ Ошибка сохранения');
      }
    } catch { onToast('Ошибка сети'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12 text-muted text-sm font-btn">Загрузка…</div>;

  return (
    <div>
      <p className="text-xs text-muted mb-4 font-btn">
        Настрой награды за серию. Отключи день — награда не выдаётся.
      </p>

      <div className="space-y-3 mb-4">
        {[1,2,3,4,5].map(day => {
          const enabled = getVal(day, 'enabled', true);
          const tries = getVal(day, 'tries', 0);
          const text = getVal(day, 'text', '');
          const isDirty = !!dirty[day];
          return (
            <div key={day}
              className={`bg-card border rounded-2xl p-4 transition-all ${enabled ? 'border-accentSoft' : 'border-border1 opacity-60'} ${isDirty ? 'ring-1 ring-accent/40' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-btn font-bold">День {day}</div>
                <button
                  onClick={() => setField(day, 'enabled', !enabled)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-btn ${enabled ? 'bg-accent text-bg' : 'bg-bgSoft border border-border2 text-muted'}`}
                >
                  {enabled ? '✓ ВКЛ' : 'ВЫКЛ'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="block">
                  <div className="text-[10px] uppercase text-muted mb-1 font-btn">Примерок</div>
                  <input
                    type="number" min="0" inputMode="numeric"
                    value={tries}
                    onChange={(e) => setField(day, 'tries', Number(e.target.value) || 0)}
                    className="w-full bg-bg border border-border1 rounded-xl px-3 py-2 text-sm outline-none font-btn"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase text-muted mb-1 font-btn">Текст награды</div>
                  <input
                    type="text" maxLength={100}
                    value={text}
                    placeholder={`День ${day} · +${tries} примерок`}
                    onChange={(e) => setField(day, 'text', e.target.value)}
                    className="w-full bg-bg border border-border1 rounded-xl px-3 py-2 text-sm outline-none font-btn"
                  />
                </label>
              </div>

              {isDirty && (
                <div className="text-[9px] uppercase text-accent font-btn">● не сохранено</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={saveAll}
        disabled={!hasChanges || saving}
        className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase font-btn disabled:opacity-40 sticky bottom-4"
      >
        {saving ? '⏳ Сохраняю…' : hasChanges ? `💾 Сохранить всё (${Object.keys(dirty).length})` : '💾 Сохранить всё'}
      </button>
    </div>
  );
}

// ============ ADMIN SUBSCRIPTIONS ============
function AdminSubscriptions({ onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // объект подписки или null
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/subscriptions/list`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
      });
      const d = await r.json();
      if (d.success) setItems(d.items || []);
      else onToast(d.error || 'Ошибка загрузки');
    } catch { onToast('Ошибка сети'); }
    finally { setLoading(false); }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.id || !editing.name) return onToast('Заполни ID и название');
    if (!Number.isFinite(editing.price)) return onToast('Некорректная цена');

    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/subscriptions/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', sub: editing }),
      });
      const d = await r.json();
      if (d.success) {
        onToast('✅ Сохранено');
        setEditing(null);
        load();
      } else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm(`Удалить подписку «${id}»?\nЭто необратимо.`)) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/subscriptions/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', id }),
      });
      const d = await r.json();
      if (d.success) { onToast('🗑 Удалено'); load(); }
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
  };

  const move = async (id, dir) => {
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    const orders = newItems.map((x, i) => ({ id: x.id, sort_order: i }));
    setItems(newItems.map((x, i) => ({ ...x, sort_order: i })));
    try {
      await fetch(`${BACKEND}/api/admin/subscriptions/reorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', orders }),
      });
    } catch {}
  };

  const createNew = () => {
    setEditing({
      id: 'new_' + Date.now().toString(36),
      name: 'Новая подписка',
      subtitle: '',
      emoji: '⭐',
      price: 100,
      price_old: 0,
      tries: 10,
      own_tries: 0,
      duration_days: 30,
      features: [],
      accent: '#D4B595',
      image_url: '',
      bg_from: '#1A1412',
      bg_to: '#2A1F1A',
      sort_order: items.length,
      enabled: true,
    });
  };

  // ============ РЕДАКТОР ============
  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="text-xs text-muted mb-4 font-btn">← Назад к списку</button>

        <div className="bg-card border border-border1 rounded-2xl p-4 mb-4">
          <div className="text-sm font-btn font-bold mb-4">Редактировать тариф</div>

          <label className="block mb-3">
            <div className="text-[10px] uppercase text-muted mb-1 font-btn">ID (латиница, без пробелов)</div>
            <input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
          </label>

          <label className="block mb-3">
            <div className="text-[10px] uppercase text-muted mb-1 font-btn">Название (видит юзер)</div>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
          </label>

          <label className="block mb-3">
            <div className="text-[10px] uppercase text-muted mb-1 font-btn">Подзаголовок</div>
            <input value={editing.subtitle} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
              className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
          </label>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Эмодзи</div>
              <input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn text-center" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Цена ⭐️</div>
              <input type="number" min="0" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Старая ⭐️</div>
              <input type="number" min="0" value={editing.price_old} onChange={(e) => setEditing({ ...editing, price_old: Number(e.target.value) || 0 })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Примерок</div>
              <input type="number" min="0" value={editing.tries} onChange={(e) => setEditing({ ...editing, tries: Number(e.target.value) || 0 })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Своих</div>
              <input type="number" min="0" value={editing.own_tries} onChange={(e) => setEditing({ ...editing, own_tries: Number(e.target.value) || 0 })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Дней</div>
              <input type="number" min="0" value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) || 0 })}
                className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Цвет акцента</div>
              <input type="color" value={editing.accent} onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                className="w-full h-10 bg-bg border border-border1 rounded-xl outline-none" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Фон 1</div>
              <input type="color" value={editing.bg_from} onChange={(e) => setEditing({ ...editing, bg_from: e.target.value })}
                className="w-full h-10 bg-bg border border-border1 rounded-xl outline-none" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase text-muted mb-1 font-btn">Фон 2</div>
              <input type="color" value={editing.bg_to} onChange={(e) => setEditing({ ...editing, bg_to: e.target.value })}
                className="w-full h-10 bg-bg border border-border1 rounded-xl outline-none" />
            </label>
          </div>

          <label className="block mb-4">
            <div className="text-[10px] uppercase text-muted mb-1 font-btn">Картинка (URL, необязательно)</div>
            <input value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
              placeholder="https://..."
              className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
          </label>

          {/* ФИЧИ */}
          <div className="mb-4">
            <div className="text-[10px] uppercase text-muted mb-2 font-btn">Фичи (что входит)</div>
            <div className="space-y-2 mb-2">
              {(editing.features || []).map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={f.icon} onChange={(e) => {
                    const nf = [...editing.features]; nf[i] = { ...nf[i], icon: e.target.value };
                    setEditing({ ...editing, features: nf });
                  }} className="w-12 bg-bg border border-border1 rounded-xl px-2 py-2 text-sm text-center font-btn" />
                  <input value={f.text} onChange={(e) => {
                    const nf = [...editing.features]; nf[i] = { ...nf[i], text: e.target.value };
                    setEditing({ ...editing, features: nf });
                  }} className="flex-1 bg-bg border border-border1 rounded-xl px-3 py-2 text-sm font-btn" />
                  <button onClick={() => setEditing({ ...editing, features: editing.features.filter((_, j) => j !== i) })}
                    className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-btn">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setEditing({ ...editing, features: [...(editing.features || []), { icon: '✨', text: '' }] })}
              className="w-full py-2 rounded-xl border border-dashed border-border2 text-xs text-muted font-btn">
              + Добавить фичу
            </button>
          </div>

          <div className="flex items-center justify-between mb-4 bg-bgSoft border border-border1 rounded-xl p-3">
            <span className="text-xs font-btn">Показывать юзерам</span>
            <button onClick={() => setEditing({ ...editing, enabled: !editing.enabled })}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-btn ${editing.enabled ? 'bg-accent text-bg' : 'bg-bg border border-border2 text-muted'}`}>
              {editing.enabled ? '✓ ВКЛ' : 'ВЫКЛ'}
            </button>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase font-btn mb-2 disabled:opacity-50">
            {saving ? '⏳ Сохраняю…' : '💾 Сохранить'}
          </button>

          {/* Кнопка удаления — только для существующих (не new_) */}
          {!editing.id.startsWith('new_') && (
            <button onClick={() => del(editing.id)}
              className="w-full bg-red-500/10 border border-red-500/40 text-red-400 py-3 rounded-2xl text-xs font-bold uppercase font-btn">
              🗑 Удалить тариф
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============ СПИСОК ============
  if (loading) return <div className="text-center py-12 text-muted text-sm font-btn">Загрузка…</div>;

  return (
    <div>
      <p className="text-xs text-muted mb-4 font-btn">Тарифы подписок. Тапни — редактировать.</p>

      <button onClick={createNew}
        className="w-full mb-4 py-3 rounded-2xl border border-dashed border-accent/60 text-accent text-xs font-bold uppercase font-btn">
        + Создать новый тариф
      </button>

      <div className="space-y-3">
        {items.map((sub, idx) => (
          <div key={sub.id} className={`bg-card border rounded-2xl p-4 ${sub.enabled ? 'border-border1' : 'border-red-500/30 opacity-60'}`}
            style={{ background: `linear-gradient(135deg, ${sub.bg_from || '#1A1412'} 0%, ${sub.bg_to || '#2A1F1A'} 100%)` }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl">{sub.emoji}</div>
              <div className="flex-1">
                <div className="text-sm font-btn font-bold" style={{ color: sub.accent }}>{sub.name}</div>
                <div className="text-[10px] text-muted font-btn">{sub.subtitle}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-btn font-bold">{sub.price}⭐️</div>
                {sub.price_old > 0 && <div className="text-[10px] text-muted line-through font-btn">{sub.price_old}⭐️</div>}
              </div>
            </div>
            <div className="text-[10px] text-muted mb-2 font-btn">
              {sub.tries} примерок · {sub.duration_days > 0 ? `${sub.duration_days} дней` : 'бессрочно'}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...sub, features: sub.features || [] })}
                className="flex-1 bg-accent/20 border border-accent/40 text-accent py-2 rounded-xl text-[10px] font-btn uppercase">✏️ Изменить</button>
              <button onClick={() => move(sub.id, 'up')} disabled={idx === 0}
                className="w-9 py-2 rounded-xl border border-border2 text-muted text-xs disabled:opacity-30 font-btn">↑</button>
              <button onClick={() => move(sub.id, 'down')} disabled={idx === items.length - 1}
                className="w-9 py-2 rounded-xl border border-border2 text-muted text-xs disabled:opacity-30 font-btn">↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ADMIN BANNER ============
function AdminBanner({ onToast }) {
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/banner`).then(r => r.json()).then(d => {
      setBanner(d.banner || { title: 'Ограниченное предложение', subtitle: 'СЕКРЕТНАЯ подписка', sub_id: 'secret', bg_from: '#E91E63', bg_to: '#880E4F', emoji: '🎁', enabled: true });
    }).catch(() => {
      setBanner({ title: 'Ограниченное предложение', subtitle: 'СЕКРЕТНАЯ подписка', sub_id: 'secret', bg_from: '#E91E63', bg_to: '#880E4F', emoji: '🎁', enabled: true });
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/banner/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', ...banner }),
      });
      const d = await r.json();
      if (d.success) onToast('✅ Сохранено');
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
    finally { setSaving(false); }
  };

  if (loading || !banner) return <div className="text-center py-12 text-muted text-sm font-btn">Загрузка…</div>;

  return (
    <div>
      <p className="text-xs text-muted mb-4 font-btn">Баннер в каталоге. Нажми — откроются подписки.</p>

      {/* Превью */}
      <div className="rounded-2xl overflow-hidden mb-4 p-4"
        style={{ background: `linear-gradient(135deg, ${banner.bg_from} 0%, ${banner.bg_to} 100%)` }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{banner.emoji}</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase text-white/70 font-btn">{banner.title}</div>
            <div className="text-sm font-btn font-bold text-white">{banner.subtitle}</div>
          </div>
          <div className="text-white text-2xl">→</div>
        </div>
      </div>

      <label className="block mb-3">
        <div className="text-[10px] uppercase text-muted mb-1 font-btn">Заголовок</div>
        <input value={banner.title} maxLength={100}
          onChange={(e) => setBanner({ ...banner, title: e.target.value })}
          className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
      </label>

      <label className="block mb-3">
        <div className="text-[10px] uppercase text-muted mb-1 font-btn">Подзаголовок</div>
        <input value={banner.subtitle} maxLength={100}
          onChange={(e) => setBanner({ ...banner, subtitle: e.target.value })}
          className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
      </label>

      <label className="block mb-3">
        <div className="text-[10px] uppercase text-muted mb-1 font-btn">Подписка (sub_id)</div>
        <select value={banner.sub_id}
          onChange={(e) => setBanner({ ...banner, sub_id: e.target.value })}
          className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn">
          <option value="secret">🎁 СЕКРЕТНАЯ</option>
          <option value="start">👌 START</option>
          <option value="medium">💥 MEDIUM</option>
          <option value="pro">💎 PRО</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <div className="text-[10px] uppercase text-muted mb-1 font-btn">Цвет 1</div>
          <input type="color" value={banner.bg_from}
            onChange={(e) => setBanner({ ...banner, bg_from: e.target.value })}
            className="w-full h-10 bg-bg border border-border1 rounded-xl outline-none" />
        </label>
        <label className="block">
          <div className="text-[10px] uppercase text-muted mb-1 font-btn">Цвет 2</div>
          <input type="color" value={banner.bg_to}
            onChange={(e) => setBanner({ ...banner, bg_to: e.target.value })}
            className="w-full h-10 bg-bg border border-border1 rounded-xl outline-none" />
        </label>
      </div>

      <label className="block mb-3">
        <div className="text-[10px] uppercase text-muted mb-1 font-btn">Эмодзи</div>
        <input value={banner.emoji} maxLength={4}
          onChange={(e) => setBanner({ ...banner, emoji: e.target.value })}
          className="w-full bg-bg border border-border1 rounded-xl px-3 py-2.5 text-sm outline-none font-btn" />
      </label>

      <div className="flex items-center justify-between mb-4 bg-card border border-border1 rounded-2xl p-3">
        <span className="text-xs font-btn">Показывать баннер</span>
        <button onClick={() => setBanner({ ...banner, enabled: !banner.enabled })}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-btn ${banner.enabled ? 'bg-accent text-bg' : 'bg-bgSoft border border-border2 text-muted'}`}>
          {banner.enabled ? '✓ ВКЛ' : 'ВЫКЛ'}
        </button>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase font-btn disabled:opacity-50">
        {saving ? '⏳ Сохраняю…' : 'Сохранить баннер'}
      </button>
    </div>
  );
}

// ============ ADMIN CLEANUP ============
function AdminCleanup({ onToast, onCatalogRefreshed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);

  const CATS = [
    { key: 'all',       label: 'Все',             emoji: '✨' },
    { key: 'autumn',    label: 'Осень',           emoji: '🍂' },
    { key: 'top',       label: 'Верх',            emoji: '👕' },
    { key: 'bottom',    label: 'Низ',             emoji: '👖' },
    { key: 'outerwear', label: 'Верх.одежда',     emoji: '🧥' },
    { key: 'suit',      label: 'Костюмы',         emoji: '🥼' },
    { key: 'dress',     label: 'Платья',          emoji: '👗' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/products/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || '',
          category: filter === 'all' ? null : filter,
        }),
      });
      const d = await r.json();
      if (d.success) setItems(d.items || []);
      else onToast(d.error || 'Ошибка загрузки');
    } catch { onToast('Ошибка сети'); }
    finally { setLoading(false); }
  }, [filter, onToast]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, productId, wbId) => {
    setBusy(productId);
    try {
      const r = await fetch(`${BACKEND}/api/admin/products/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', action, productId, wbId }),
      });
      const d = await r.json();
      if (d.success) {
        onToast(d.message || '✅ Готово');
        haptic('medium');
        onCatalogRefreshed?.();
        if (action === 'delete') setItems(prev => prev.filter(x => x.id !== productId));
        else if (action === 'hide') setItems(prev => prev.map(x => x.id === productId ? { ...x, is_active: false } : x));
        else if (action === 'unhide') setItems(prev => prev.map(x => x.id === productId ? { ...x, is_active: true } : x));
        else if (action === 'pin') setItems(prev => prev.map(x => x.id === productId ? { ...x, is_pinned: true } : x));
        else if (action === 'unpin') setItems(prev => prev.map(x => x.id === productId ? { ...x, is_pinned: false } : x));
      } else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
    finally { setBusy(null); }
  };

  const rename = async (item) => {
    const newName = prompt('Новое название:', item.name);
    if (!newName || newName === item.name) return;
    setBusy(item.id);
    try {
      const r = await fetch(`${BACKEND}/api/admin/products/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', productId: item.id, newName }),
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, name: d.name } : x));
        onToast('✏️ Переименовано');
        onCatalogRefreshed?.();
      } else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
    finally { setBusy(null); }
  };

  const clearCategory = async (mode) => {
    if (filter === 'all') return;
    const label = CATS.find(c => c.key === filter)?.label || filter;
    if (mode === 'delete') {
      if (!confirm(`УДАЛИТЬ ВСЕ товары из раздела «${label}»?`)) return;
      if (!confirm('Точно? Это необратимо.')) return;
    } else {
      if (!confirm(`Скрыть все товары из раздела «${label}»?`)) return;
    }
    setBusy('category');
    try {
      const r = await fetch(`${BACKEND}/api/admin/products/clear-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', category: filter, mode }),
      });
      const d = await r.json();
      if (d.success) {
        onToast(mode === 'delete' ? `🗑 Удалено: ${d.affected}` : `🙈 Скрыто: ${d.affected}`);
        load();
        onCatalogRefreshed?.();
      } else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка сети'); }
    finally { setBusy(null); }
  };

  const filtered = q.trim()
    ? items.filter(x => (x.name || '').toLowerCase().includes(q.toLowerCase().trim()))
    : items;

  return (
    <div>
      <div className="bg-card border border-border2 rounded-2xl p-3 mb-3 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию…"
          className="flex-1 bg-bg border border-border1 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accentSoft font-btn" />
        <button onClick={load} className="px-3 py-2.5 rounded-xl border border-border2 text-xs font-btn">🔄</button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-5 px-5">
        {CATS.map(c => {
          const active = filter === c.key;
          return (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className={`whitespace-nowrap text-xs px-3 py-2 rounded-full border flex items-center gap-1.5 font-btn ${active ? 'bg-accent text-bg border-accent font-bold' : 'border-border2 text-muted2'}`}>
              <span>{c.emoji}</span>{c.label}
            </button>
          );
        })}
      </div>

      {filter !== 'all' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => clearCategory('hide')} disabled={busy === 'category'}
            className="bg-card border border-orange-500/40 text-orange-300 py-3 rounded-2xl text-[10px] font-bold uppercase active:scale-[0.98] disabled:opacity-50 font-btn">
            🙈 Скрыть раздел
          </button>
          <button onClick={() => clearCategory('delete')} disabled={busy === 'category'}
            className="bg-card border border-red-500/40 text-red-400 py-3 rounded-2xl text-[10px] font-bold uppercase active:scale-[0.98] disabled:opacity-50 font-btn">
            🗑 Удалить раздел
          </button>
        </div>
      )}

      <div className="text-[10px] text-muted mb-3 font-btn">Товаров: <b className="text-title">{filtered.length}</b></div>

      {loading && <div className="text-center py-12 text-muted text-sm font-btn">Загрузка…</div>}
      {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted text-sm font-btn">Пусто</div>}

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className={`bg-card border rounded-2xl overflow-hidden flex gap-3 ${item.is_active ? 'border-border1' : 'border-red-500/30 opacity-60'}`}>
            <div className="w-20 h-24 flex-shrink-0 bg-bgSoft">
              <ProductImage src={item.image_url} fallback={item.fallback_url} alt={item.name} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0 py-2.5 pr-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] uppercase text-accentSoft font-btn">{CATS.find(c => c.key === item.category)?.label || item.category}</span>
                {item.is_pinned && <span className="text-[9px] text-yellow-400">📌</span>}
                {!item.is_active && <span className="text-[9px] text-red-400 font-btn">СКРЫТ</span>}
              </div>
              <div className="text-[11px] text-title line-clamp-2 leading-snug mb-1">{item.name}</div>
              <div className="text-[10px] text-muted mb-1.5 font-btn">{item.price || '—'} · WB {item.wb_id}</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => act(item.is_pinned ? 'unpin' : 'pin', item.id, item.wb_id)} disabled={busy === item.id}
                  className="text-[9px] px-2 py-1 rounded-lg border border-border2 text-muted2 disabled:opacity-40 font-btn">
                  {item.is_pinned ? '📌 Убрать' : '📌 Пин'}
                </button>
                {item.is_active ? (
                  <button onClick={() => act('hide', item.id, item.wb_id)} disabled={busy === item.id}
                    className="text-[9px] px-2 py-1 rounded-lg border border-border2 text-muted2 disabled:opacity-40 font-btn">🙈 Скрыть</button>
                ) : (
                  <button onClick={() => act('unhide', item.id, item.wb_id)} disabled={busy === item.id}
                    className="text-[9px] px-2 py-1 rounded-lg border border-accentSoft text-accent disabled:opacity-40 font-btn">👁 Вернуть</button>
                )}
                <button onClick={() => rename(item)} disabled={busy === item.id}
                  className="text-[9px] px-2 py-1 rounded-lg border border-border2 text-muted2 disabled:opacity-40 font-btn">✏️ Имя</button>
                <a href={wbUrl(item.wb_id)} target="_blank" rel="noreferrer"
                  className="text-[9px] px-2 py-1 rounded-lg border border-border2 text-muted2 font-btn">🛍 WB</a>
                <button onClick={() => { if (confirm('Удалить товар насовсем?')) act('delete', item.id, item.wb_id); }} disabled={busy === item.id}
                  className="text-[9px] px-2 py-1 rounded-lg border border-red-500/40 text-red-400 disabled:opacity-40 font-btn">🗑 Удалить</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ PROFILE ============
function ProfileScreen({ user, myRank, onOpenSubs, onOpenBuyTries, onOpenHistory, onOpenOwn, onOpenMulti, onOpenAchievements, onOpenLeaderboard, onOpenFavorites, onOpenGift, onOpenAdmin, onToast }) {
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
      const r = await fetch(`${BACKEND}/api/redeem-promo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', code: promoCode.trim() }) });
      const d = await r.json();
      if (d.success) { onToast(d.unlimited ? '🎁 Безлимит!' : `🎁 +${d.tries}!`); setPromoOpen(false); setPromoCode(''); setTimeout(() => window.location.reload(), 1500); }
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Ошибка'); } finally { setPromoLoading(false); }
  };
  const sendIdea = async () => {
    if (!ideaText.trim()) return;
    setIdeaLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/idea`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', text: ideaText.trim() }) });
      const d = await r.json();
      if (d.success) { onToast('💡 Спасибо!'); setIdeaText(''); setIdeaOpen(false); }
      else onToast(d.error || 'Ошибка');
    } catch { onToast('Нет связи'); } finally { setIdeaLoading(false); }
  };

      return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <h1 className="text-2xl font-btn font-bold mb-6">Профиль</h1>

      {/* Карточка юзера */}
      <div className="bg-card border border-border1 rounded-3xl p-5 mb-4 flex items-center gap-4">
        <img src={user?.photo_url || 'https://placehold.co/80x80/1A1412/D4B595?text=U'} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border2" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium font-btn truncate">{user?.first_name || 'Гость'}</div>
          <div className="text-xs text-muted font-btn truncate">@{user?.username || 'user'}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {user?.streak_days > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40 font-btn">
                <span className="text-[10px]">🔥</span>
                <span className="text-[10px] text-orange-300 font-bold">{user.streak_days} дн.</span>
              </div>
            )}
            {myRank?.rank && (
              <button onClick={onOpenLeaderboard} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 active:scale-95 transition font-btn">
                <span className="text-[10px]">👑</span>
                <span className="text-[10px] text-accent font-bold">#{myRank.rank} из {myRank.total}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Сетка 2 кнопки: Из каталога и Своих (с замком) */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={onOpenBuyTries} className="bg-card border border-border1 rounded-2xl p-4 text-left active:scale-[0.98] transition">
          <div className="text-2xl mb-1">👗</div>
          <div className="text-2xl font-btn font-bold">{user?.balance ?? 0}</div>
          <div className="text-[10px] uppercase text-muted mt-2 font-btn">Из каталога</div>
        </button>
        <button onClick={onOpenOwn} className="relative bg-card border border-border1 rounded-2xl p-4 text-left active:scale-[0.98] transition overflow-hidden">
          <div className="text-2xl mb-1">📦</div>
          <div className="text-2xl font-btn font-bold">{user?.own_tries ?? 0}</div>
          <div className="text-[10px] uppercase text-muted mt-2 font-btn">Своих</div>
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center text-sm">🔒</div>
        </button>
      </div>

      {/* Список кнопок */}
      <div className="space-y-2 mb-4">
        <button onClick={onOpenHistory} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">🕓 Мои примерки</span><span className="text-muted">→</span></button>
        <button onClick={onOpenFavorites} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">❤️ Избранное</span><span className="text-muted">→</span></button>
        <button onClick={onOpenAchievements} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">🏆 Достижения</span><span className="text-muted">→</span></button>
        <button onClick={onOpenLeaderboard} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">👑 Лидеры</span><span className="text-muted">→</span></button>
        <button onClick={onOpenSubs} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">💎 Подписки</span><span className="text-muted">→</span></button>
        <button onClick={onOpenMulti} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">🎨 Мульти (2–3 вещи)</span><span className="text-[10px] text-accent">скоро</span></button>
        <button onClick={onOpenGift} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">🎁 Подарить подруге</span><span className="text-muted">→</span></button>
        <button onClick={() => setIdeaOpen(true)} className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn"><span className="text-xs">💡 Предложить идею</span><span className="text-muted">→</span></button>
        {user?.is_admin && (
          <button onClick={onOpenAdmin} className="w-full bg-gradient-to-r from-accent/20 to-accent/5 border border-accent rounded-2xl px-4 py-4 flex items-center justify-between active:scale-[0.99] font-btn">
            <span className="text-xs font-bold text-accent">👑 Админка</span>
            <span className="text-accent">→</span>
          </button>
        )}
      </div>

      {/* Промокод */}
      {!promoOpen ? (
        <button onClick={() => setPromoOpen(true)} className="w-full bg-bgSoft border border-accentSoft text-accent rounded-2xl px-4 py-4 font-btn text-xs">🎁 Ввести промокод</button>
      ) : (
        <div className="bg-card border border-accentSoft rounded-2xl p-4 animate-scale-in">
          <div className="flex gap-2">
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="ВВЕДИ КОД" disabled={promoLoading} className="flex-1 bg-bg border border-border1 rounded-xl px-3 py-3 text-sm uppercase outline-none font-btn" />
            <button onClick={redeemPromo} disabled={promoLoading || !promoCode.trim()} className="px-4 py-3 rounded-xl bg-accent text-bg text-xs font-bold disabled:opacity-40 font-btn">{promoLoading ? '…' : 'OK'}</button>
          </div>
          <button onClick={() => { setPromoOpen(false); setPromoCode(''); }} className="text-[10px] text-muted mt-3 font-btn">Отмена</button>
        </div>
      )}

      {/* Модалка идеи */}
      {ideaOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-5 animate-fade-in" onClick={() => setIdeaOpen(false)}>
          <div className="bg-card border border-border2 rounded-3xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-[10px] uppercase text-accent mb-2 font-btn">💡 Идея</div>
            <h3 className="text-lg font-btn font-bold mb-3">Что хочешь предложить?</h3>
            <textarea value={ideaText} onChange={(e) => setIdeaText(e.target.value)} placeholder="Опиши идею…" rows={5} maxLength={2000} className="w-full bg-bg border border-border1 rounded-2xl px-4 py-3 text-sm outline-none resize-none mb-3 font-btn" />
            <button onClick={sendIdea} disabled={ideaLoading || !ideaText.trim()} className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase disabled:opacity-40 mb-2 font-btn">{ideaLoading ? '…' : 'Отправить'}</button>
            <button onClick={() => setIdeaOpen(false)} className="w-full text-xs text-muted py-2 font-btn">Отмена</button>
          </div>
        </div>
      )}
    </main>
  );
}
// ============ SEARCH ============
function SearchScreen({ onPick, likedIds, onLike }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const hideKeyboard = () => { try { inputRef.current?.blur(); } catch {} haptic('light'); };

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);

    const t = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(`${BACKEND}/api/search?q=${encodeURIComponent(query)}&limit=60`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (d.success) setResults(d.items || []);
        else setError(d.error || 'Ошибка поиска');
      } catch (e) {
        if (e.name !== 'AbortError') { setError('Не удалось найти'); setResults([]); }
      } finally { setLoading(false); }
    }, 300);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in">
      <h1 className="text-2xl font-btn font-bold mb-5">Поиск</h1>

      <div className="relative mb-5">
        <input ref={inputRef} type="text" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hideKeyboard(); } }}
          placeholder="Пальто, костюм, платье…"
          className="w-full bg-card border border-border1 rounded-2xl pl-11 pr-12 py-3.5 text-sm outline-none focus:border-accentSoft font-btn" />
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
        {q && (
          <button type="button" onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-border2 text-muted flex items-center justify-center text-xs">✕</button>
        )}
      </div>

      {!q.trim() && <EmptyState emoji="🔍" title="Что ищем?" text="Введи название: пальто, костюм, джинсы…" />}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted text-sm font-btn">
          <span className="inline-block w-4 h-4 border-2 border-muted/30 border-t-accent rounded-full animate-spin" />
          Ищу…
        </div>
      )}

      {!loading && error && <EmptyState emoji="😕" title="Ошибка" text={error} />}

      {!loading && !error && q.trim().length >= 2 && results.length === 0 && (
        <EmptyState emoji="🤷‍♀️" title="Ничего не найдено" text={`По запросу «${q.trim()}» ничего нет.`} />
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="text-[10px] uppercase text-muted mb-3 font-btn">Найдено: <b className="text-title">{results.length}</b></div>
          <div className="grid grid-cols-2 gap-3">
            {results.map(item => <ProductCard key={item.id} item={item} onPick={onPick} liked={likedIds.has(item.id)} onLike={onLike} />)}
          </div>
        </>
      )}
    </main>
  );
}

// ============ STYLE TEST ============
function StyleTestScreen({ onBack, onPick }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const answer = (opt) => {
    haptic('medium');
    const newAnswers = [...answers, opt.cat];
    if (step < STYLE_QUESTIONS.length - 1) { setAnswers(newAnswers); setStep(step + 1); }
    else {
      const counts = {};
      newAnswers.forEach(c => counts[c] = (counts[c] || 0) + 1);
      const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      setLoading(true);
      fetch(`${BACKEND}/api/catalog?category=${encodeURIComponent(topCat)}&limit=12`)
        .then(r => r.json())
        .then(d => setProducts(d.success ? d.items : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  if (loading) return <LoadingAnimation />;

  if (products.length > 0) {
    return (
      <main className="px-5 pt-6 pb-24 animate-fade-in">
        <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
        <div className="text-center mb-6 animate-bounce-in">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-btn font-bold mb-2">Твой стиль найден!</h1>
          <p className="text-xs text-muted font-btn">Мы подобрали вещи для тебя</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {products.slice(0, 12).map(item => <ProductCard key={item.id} item={item} onPick={onPick} />)}
        </div>
      </main>
    );
  }

  const q = STYLE_QUESTIONS[step];
  return (
    <main className="px-5 pt-6 pb-24 animate-fade-in min-h-[80vh] flex flex-col">
      <button onClick={onBack} className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted mb-5">←</button>
      <div className="flex gap-1.5 mb-6">
        {STYLE_QUESTIONS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-border2'} transition-all`} />)}
      </div>
      <div className="text-[10px] uppercase tracking-wider2 text-accent mb-2 font-btn">Тест · {step + 1} из {STYLE_QUESTIONS.length}</div>
      <h1 className="text-2xl font-btn font-bold mb-8">{q.q}</h1>
      <div className="space-y-3 flex-1">
        {q.options.map((opt, i) => (
          <button key={i} onClick={() => answer(opt)}
            className="w-full bg-card border border-border1 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition hover:border-accent animate-slide-up"
            style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="text-4xl">{opt.emoji}</div>
            <div className="text-left flex-1 font-medium font-btn text-sm">{opt.text}</div>
            <div className="text-accent text-xl">→</div>
          </button>
        ))}
      </div>
    </main>
  );
}

// ============ КАТАЛОГ ============
function CatalogScreen({ catalog, loading, category, setCategory, onPick, likedIds, onLike, onOpenMulti, onOpenSearch, shareRef, onOpenSubs, banner }) {
  return (
        <main className="px-5 pt-6 animate-fade-in overflow-x-hidden">
      {/* БАННЕР ПОДПИСКИ */}
            {banner && banner.enabled && (
        <button
          onClick={() => { haptic('medium'); onOpenSubs(); }}
          className="w-full mb-5 rounded-2xl overflow-hidden relative animate-slide-up active:scale-[0.99] transition-transform"
          style={{
            background: `linear-gradient(135deg, ${banner.bg_from || '#E91E63'} 0%, ${banner.bg_to || '#880E4F'} 100%)`,
            boxShadow: `0 8px 30px ${(banner.bg_from || '#E91E63')}40`,
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="text-3xl animate-pulse">{banner.emoji || '🎁'}</div>
            <div className="flex-1 text-left">
              <div className="text-[10px] uppercase tracking-wider2 text-white/70 font-btn mb-0.5">
                {banner.title}
              </div>
              <div className="text-sm font-btn font-bold text-white">
                {banner.subtitle}
              </div>
            </div>
            <div className="text-white text-2xl">→</div>
          </div>
        </button>
      )}

            <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase text-muted mb-1 font-btn">Коллекция</div>
          <h1 className="text-2xl font-btn font-bold">Гардероб</h1>
        </div>
      </div>

      <div className="relative -mx-5 mb-6">
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {CATEGORIES.map(c => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => { haptic('light'); setCategory(c.key); }}
                className={`shrink-0 whitespace-nowrap text-xs px-3.5 py-2 rounded-full border flex items-center gap-1.5 transition-all font-btn ${active ? 'bg-accent text-bg border-accent font-bold shadow-soft' : 'border-border2 text-muted2'}`}
              >
                <span>{c.emoji}</span>{c.label}
              </button>
            );
          })}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({length: 6}).map((_,i)=><div key={i} className="aspect-[3/4] shimmer rounded-2xl" />)}</div>
      ) : catalog.length === 0 ? (
        <EmptyState emoji="🛍" title={category === 'personal' ? 'Пока нечего показать' : 'Каталог пуст'}
          text={category === 'personal' ? 'Посмотри несколько товаров — мы подберём похожие' : 'Заходи чуть позже'} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {catalog.map(item => <ProductCard key={item.id} item={item} onPick={onPick} liked={likedIds.has(item.id)} onLike={onLike} />)}
        </div>
      )}
      <button onClick={shareRef} className="w-full mt-8 bg-bgSoft border border-border2 text-accent py-4 rounded-2xl text-xs font-medium uppercase tracking-wider2 flex items-center justify-center gap-2 active:scale-[0.98] transition font-btn">
        <span>👥</span> Поделиться с подругой
      </button>
    </main>
  );
}

// ============ APP ============
export default function App() {
  const [user, setUser] = useState(null);
  const [maintenance, setMaintenance] = useState({ on: false, text: '' });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [oneTimeMsg, setOneTimeMsg] = useState(null);
  const [tab, setTab] = useState('catalog');
const [screen, setScreen] = useState(null);
const [previousTab, setPreviousTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('personal');
  const [selected, setSelected] = useState(null);
  const [humanImg, setHumanImg] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());
  const [toast, setToast] = useState('');
  const [welcomeBonus, setWelcomeBonus] = useState(null);
  const [showStreak, setShowStreak] = useState(false);
  const [myRank, setMyRank] = useState(null);
  const [streakSeconds, setStreakSeconds] = useState(0);
const [streakJustCompleted, setStreakJustCompleted] = useState(false);
  const [banner, setBanner] = useState(null);
const [subs, setSubs] = useState([]);
const [triesPrice, setTriesPrice] = useState(10);
const fileRef = useRef(null);

  const seed = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const openScreen = (name) => {
  setPreviousTab(tab);
  setScreen(name);
};

const closeScreen = () => {
  setScreen(null);
  setTab(previousTab);
};
  useEffect(() => {
    fetch(`${BACKEND}/api/settings`).then(r => r.json()).then(d => { if (d.maintenance) setMaintenance({ on: true, text: d.maintenance_text || '' }); }).catch(() => {});
    const t = setInterval(() => { fetch(`${BACKEND}/api/settings`).then(r => r.json()).then(d => setMaintenance({ on: d.maintenance, text: d.maintenance_text || '' })).catch(() => {}); }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor?.('#14100e'); tg.setBackgroundColor?.('#14100e'); tg.disableVerticalSwipes?.(); }
    const initData = tg?.initData || '';
    fetch(`${BACKEND}/api/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, refCode: tg?.initDataUnsafe?.start_param }),
    }).then(r => r.json()).then(d => {
      if (d.success) {
        setUser(d.user);
        fetch(`${BACKEND}/api/banner`).then(r => r.json()).then(b => { if (b.success && b.banner) setBanner(b.banner); }).catch(() => {});
        fetch(`${BACKEND}/api/subscriptions`).then(r => r.json()).then(s => { if (s.success && s.items) setSubs(s.items); }).catch(() => {});
        if (d.one_time_message) setOneTimeMsg(d.one_time_message);
        if (!d.user.onboarded && localStorage.getItem('gf_onboarded') !== '1') setShowOnboarding(true);
        else if (!d.user.personalized) setShowPersonalization(true);
        if (d.daily_bonus > 0) { setWelcomeBonus(`🎁 +${d.daily_bonus} попытка за вход!`); setTimeout(() => setWelcomeBonus(null), 4000); }
        if (d.streak_bonus > 0) { setTimeout(() => { setWelcomeBonus(`🔥 Серия 5 дней! +${d.streak_bonus}`); setTimeout(() => setWelcomeBonus(null), 5000); }, 5000); }
      } else setUser({ tg_id: 0, first_name: 'Гость', username: '—', photo_url: '', balance: 0, own_tries: 0, onboarded: true, personalized: true, streak_days: 0, is_admin: false });
    }).catch(() => setUser({ tg_id: 0, first_name: 'Гость', username: '—', photo_url: '', balance: 0, own_tries: 0, onboarded: true, personalized: true, streak_days: 0, is_admin: false }));
  }, []);

  useEffect(() => {
    if (!user?.tg_id) return;
    fetch(`${BACKEND}/api/favorites/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }) })
      .then(r => r.json()).then(d => { if (d.success && d.items) setLikedIds(new Set(d.items.map(x => x.id))); }).catch(() => {});
  }, [user?.tg_id]);

  useEffect(() => {
    if (!user?.tg_id) return;
    fetch(`${BACKEND}/api/my-rank`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }) })
      .then(r => r.json()).then(d => { if (d.success) setMyRank(d); }).catch(() => {});
  }, [user?.tg_id]);

    // Получаем данные подписки для анимации
    const subData = subs.find(s => s.id === subId);

    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.tg_id, productType: `sub_${subId}` })
      });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error);

      window.Telegram.WebApp.openInvoice(d.invoiceLink, async (s) => {
        if (s === 'paid') {
          haptic('medium');
          // Ждём пока бэк обработает вебхук (2-3 сек) — делаем ретраи
          let newSub = null;
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
              const mr = await fetch(`${BACKEND}/api/my-subscription`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
              });
              const md = await mr.json();
              if (md.success && md.subscription && md.subscription.id === subId) {
                newSub = md.subscription;
                break;
              }
            } catch {}
          }

          // Показываем анимацию
          setSuccessAnimation({
            sub: subData || { name: subId, emoji: '💎', accent: '#D4B595' },
            subscription: newSub,
            isRenew: newSub && user?.streak_days >= 0,
          });

          // Обновляем user если нужно
          if (newSub) {
            setUser(u => u ? { ...u, sub_active: true } : u);
          }
        }
      });
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
    } catch { showToast('Ошибка'); }
  };
  const buyOwnTries = async (count) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tgId: user.tg_id, productType: 'custom_own_tries', ownTries: count }) });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error);
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (s) => { if (s === 'paid') { showToast('Зачислено ✨'); setTimeout(() => window.location.reload(), 1500); } });
    } catch { showToast('Ошибка'); }
  };

  const runTryOn = async () => {
  if (!selected) return showToast('Выберите товар');
  if (!humanImg) return showToast('Загрузите фото');
  haptic('medium');
  setTab('loading');

  const attempt = async (tryNum) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 сек
    try {
      const r = await fetch(`${BACKEND}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '', humanImg, garmentUrl: selected.image_url, itemId: selected.id, category: selected.category }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const d = await r.json();
      return d;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') throw new Error('timeout');
      throw e;
    }
  };

  try {
    let d = await attempt(1);
    if (!d.success && /timeout/i.test(d.error || '')) {
      showToast('⏳ Генерация дольше обычного, пробую ещё раз…');
      d = await attempt(2);
    }
    if (d.success && d.resultUrl) {
      setResultImage(d.resultUrl);
      setUser(u => u ? { ...u, balance: Math.max(0, (u.balance || 0) - 1) } : u);
      setTab('result');
      playReadySound();
      haptic('medium');
    } else {
      showToast(d.error || 'Не получилось. Попробуй другое фото');
      setTab('catalog');
    }
  } catch (e) {
    if (e.message === 'timeout') {
      showToast('⏱ Генерация занимает слишком много времени. Попробуй позже');
    } else {
      showToast('Нет связи');
    }
    setTab('catalog');
  }
};

  const resetTryOn = () => { setTab('catalog'); setSelected(null); setResultImage(null); setHumanImg(''); };

  const shareRef = () => {
    haptic('medium');
    const refLink = `https://t.me/GFstyleroom_bot/app?startapp=ref_${user?.tg_id || 0}`;
    const text = 'Зацени — можно примерять одежду прямо на себя ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink?.(url) || window.open(url, '_blank');
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="spinner" /></div>;
  if (maintenance.on && !user.is_admin) return <MaintenanceScreen text={maintenance.text} />;
  if (showOnboarding) return <Onboarding onDone={finishOnboarding} />;
  if (showPersonalization) return <PersonalizationTest user={user} onDone={finishPersonalization} onToast={showToast} />;

  const isTryOn = tab === 'upload' || tab === 'loading' || tab === 'result';

  const nav = <BottomNav active={tab} onChange={(k) => {
  setScreen(null);
  setTab(k);
  if (k === 'subs') openScreen('subs');
}} />;

  if (screen === 'subs') return <><SubscriptionsScreen onBack={closeScreen} onBuy={buySubscription} subs={subs} user={user} triesPrice={triesPrice} />{nav}</>;
  if (screen === 'buyTries') return <><BuyTriesScreen onBack={() => setScreen(null)} onBuy={buyTries} user={user} />{nav}</>;
  if (screen === 'history') return <><HistoryScreen onBack={() => setScreen(null)} />{nav}</>;
  if (screen === 'own') return <><ComingSoonScreen onBack={() => setScreen(null)} title="Примерка своих товаров" description="Скоро ты сможешь загрузить любую вещь по ссылке с Wildberries и примерить её на себя. Мы уже работаем над этим ✨" />{nav}</>;
  if (screen === 'multi') return <><ComingSoonScreen onBack={() => setScreen(null)} title="Мульти-примерка в разработке" description="Скоро ты сможешь примерять сразу 2–3 вещи: топ + низ, платье + аксессуар и другие комбинации. Мы уже работаем над этим ✨" />{nav}</>;
  if (screen === 'favorites') return <><FavoritesScreen onBack={() => setScreen(null)} onPick={handleProductPick} onToast={showToast} />{nav}</>;
  if (screen === 'achievements') return <><AchievementsScreen onBack={() => setScreen(null)} />{nav}</>;
  if (screen === 'leaderboard') return <><LeaderboardScreen onBack={() => setScreen(null)} onPick={handleProductPick} user={user} myRank={myRank} />{nav}</>;
  if (screen === 'gift') return <><GiftScreen onBack={() => setScreen(null)} onToast={showToast} user={user} />{nav}</>;
  if (screen === 'test') return <><StyleTestScreen onBack={() => setScreen(null)} onPick={handleProductPick} />{nav}</>;
  if (screen === 'admin') return <><AdminScreen user={user} onBack={() => setScreen(null)} onToast={showToast} onCatalogRefreshed={() => loadCatalog(category)} />{nav}</>;

  return (
    <div className="min-h-screen bg-bg text-title pb-24">
      {maintenance.on && user.is_admin && (
        <div className="sticky top-0 z-50 bg-yellow-500/90 text-black text-[10px] font-bold uppercase tracking-wider2 text-center py-1.5 font-btn">
          🚧 ТЕХ РЕЖИМ
        </div>
      )}
      {!isTryOn && (
        <header className={`sticky ${maintenance.on ? 'top-6' : 'top-0'} z-40 bg-bg/85 backdrop-blur-md border-b border-border1 px-4 py-3 flex items-center justify-between gap-2`}>
          <button onClick={() => setTab('profile')} className="flex items-center gap-2 active:scale-95 transition min-w-0 max-w-[130px] shrink">
            <img src={user.photo_url || 'https://placehold.co/80x80/1A1412/D4B595?text=U'} alt="" className="w-9 h-9 rounded-full object-cover border border-border2 shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-[11px] font-medium font-btn truncate">{user.first_name || 'Гость'}</div>
              <div className="text-[10px] text-muted font-btn truncate">@{user.username || 'user'}</div>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
      {/* Кнопка серии: показывает ТАЙМЕР пока идёт, СЕРИЮ после */}
  {user.streak_days >= 0 && (
    <StreakTimer
      user={user}
      BACKEND={BACKEND}
      onOpenSheet={() => setShowStreak(true)}
      onComplete={(newStreak) => {
        setStreakJustCompleted(true);
        setUser(u => u ? { ...u, streak_days: newStreak } : u);
      }}
    />
  )}
  <button
    onClick={() => { setScreen('buyTries'); }}
    className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-border2 text-[11px] font-btn shrink-0"
  >
    <span className="text-accent">✨</span>
    <span>{user.balance ?? 0}</span>
    <span className="text-accent font-bold">+</span>
  </button>
  <button
  onClick={() => { setPreviousTab(tab); setScreen('subs'); setTab('subs'); }}
  className={`px-2 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition font-btn shrink-0 ${user.sub_active ? 'text-bg shadow-soft animate-pulse-glow' : 'text-bg'}`}
  style={{ background: 'linear-gradient(135deg, #E5CBAA 0%, #D4B595 50%, #B89876 100%)' }}
>
  💎
</button>
</div>
        </header>
      )}

      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border2 text-xs px-4 py-2.5 rounded-full shadow-soft animate-slide-up font-btn">{toast}</div>}
      {welcomeBonus && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-bg text-xs px-4 py-2.5 rounded-full font-bold shadow-soft animate-slide-up font-btn">{welcomeBonus}</div>}
      {successAnimation && (
        <SubscriptionSuccess
          sub={successAnimation.sub}
          subscription={successAnimation.subscription}
          onClose={() => {
            setSuccessAnimation(null);
            loadCatalog(category); // обновляем каталог
          }}
        />
      )}
      {showStreak && <StreakSheet streak={user.streak_days} onClose={() => setShowStreak(false)} />}

      {oneTimeMsg && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-5 animate-fade-in" onClick={() => setOneTimeMsg(null)}>
          <div className="bg-card border border-accent rounded-3xl p-7 max-w-sm w-full text-center animate-bounce-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-4">📣</div>
            <div className="text-sm text-title leading-relaxed mb-6 font-btn">{oneTimeMsg}</div>
            <button onClick={() => setOneTimeMsg(null)} className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-bold uppercase font-btn">Понятно</button>
          </div>
        </div>
      )}

      {tab === 'catalog' && (
  <CatalogScreen catalog={catalog} loading={loading} category={category} setCategory={setCategory}
    onPick={handleProductPick} likedIds={likedIds} onLike={toggleLike}
    onOpenMulti={() => setScreen('multi')}
    onOpenSearch={() => setTab('search')}
    onOpenSubs={() => { setPreviousTab('catalog'); setScreen('subs'); setTab('subs'); }}
    banner={banner}
    shareRef={shareRef} />
)}

      {tab === 'search' && <SearchScreen onPick={handleProductPick} likedIds={likedIds} onLike={toggleLike} />}

      {tab === 'profile' && <ProfileScreen user={user} myRank={myRank}
        onOpenSubs={() => { setPreviousTab('profile'); setScreen('subs'); setTab('subs'); }} onOpenBuyTries={() => setScreen('buyTries')}
        onOpenHistory={() => setScreen('history')} onOpenOwn={() => setScreen('own')}
        onOpenMulti={() => setScreen('multi')} onOpenAchievements={() => setScreen('achievements')}
        onOpenLeaderboard={() => setScreen('leaderboard')} onOpenFavorites={() => setScreen('favorites')}
        onOpenGift={() => setScreen('gift')} onOpenAdmin={() => setScreen('admin')} onToast={showToast} />}

      {tab === 'upload' && selected && (
        <main className="px-5 pt-5 animate-fade-in">
          <button onClick={() => setTab('catalog')} className="text-xs text-muted mb-5 font-btn">← Назад</button>
          <div className="bg-card border border-border1 rounded-2xl overflow-hidden mb-6">
            <div className="aspect-[4/3]"><ProductImage src={selected.image_url} fallback={selected.fallback_url} alt={selected.name} className="w-full h-full" /></div>
            <div className="p-4">
              <div className="text-[10px] uppercase text-accentSoft mb-1 font-btn">{CATEGORIES.find(x => x.key === selected.category)?.label}</div>
              <div className="font-sans font-medium text-sm leading-snug">{selected.description || selected.name}</div>
              {selected.price && <div className="text-xs text-muted mt-1.5 font-btn">≈ {selected.price.replace(/^≈\s*/, '')}</div>}
              <a href={wbUrl(selected.wb_id)} target="_blank" rel="noreferrer" className="block text-xs text-accent mt-3 font-btn">🛍 Открыть на WB →</a>
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()} className="w-full bg-card border border-dashed border-border2 rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2 active:scale-[0.99] transition font-btn">
            <span className="text-2xl">{humanImg ? '✓' : '📷'}</span>
            <span>{humanImg ? 'Фото загружено' : 'Загрузить фото'}</span>
            <span className="text-[10px] text-muted/70 mt-1 px-4 text-center">Хорошее освещение · полный рост · без фильтров</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          {humanImg && <img src={humanImg} alt="" className="w-full max-h-72 object-contain rounded-2xl mb-4 animate-fade-in" style={{ animationDuration: '0.6s' }} />}
          <button onClick={runTryOn} disabled={!humanImg} className="btn-shine w-full disabled:opacity-30 text-bg py-4 rounded-2xl text-xs font-bold uppercase mt-4 font-btn">
            Запустить примерку
          </button>
        </main>
      )}

      {tab === 'loading' && <LoadingAnimation />}

      {tab === 'result' && (
        <main className="px-5 pt-5 animate-fade-in">
          <div className="text-[10px] uppercase text-muted mb-3 font-btn">Результат</div>
          {resultImage && humanImg && <div className="mb-5 animate-scale-in"><BeforeAfter before={humanImg} after={resultImage} /></div>}
          {resultImage ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => downloadImage(resultImage, `style-room-${selected?.wb_id || 'result'}.jpg`)} className="w-full bg-accent text-bg py-4 rounded-2xl text-xs font-bold uppercase font-btn">📥 Скачать</button>
                <button onClick={() => tgShare(resultImage)} className="w-full border border-accentSoft text-accent py-4 rounded-2xl text-xs font-bold uppercase font-btn">📤 Поделиться</button>
              </div>
              <a href={wbUrl(selected?.wb_id)} target="_blank" rel="noreferrer" className="block w-full border border-border2 text-muted2 text-center py-3 rounded-2xl text-xs uppercase mb-3 font-btn">🛍 Открыть на WB</a>
            </>
          ) : <EmptyState emoji="😕" title="Не получилось" text="Попробуй другое фото или товар" />}
          <button onClick={resetTryOn} className="w-full border border-border2 text-muted2 py-4 rounded-2xl text-sm font-btn">Вернуться</button>
        </main>
      )}

      {!isTryOn && nav}
    </div>
  );
}
