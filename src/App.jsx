import React, { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gf-backend-uc51.onrender.com';

const CATEGORIES = [
  { key: 'all',       label: 'Все',            emoji: '✨' },
  { key: 'top',       label: 'Верх',           emoji: '👕' },
  { key: 'bottom',    label: 'Низ',            emoji: '👖' },
  { key: 'outerwear', label: 'Верхняя одежда', emoji: '🧥' },
  { key: 'suit',      label: 'Костюмы',        emoji: '🥼' },
  { key: 'dress',     label: 'Платья',         emoji: '👗' },
  { key: 'shoes',     label: 'Обувь',          emoji: '👟' },
  { key: 'accessory', label: 'Аксессуары',     emoji: '🕶' },
];

const SUBSCRIPTIONS = [
  {
    id: 'pro', emoji: '💎', name: 'PRО',
    subtitle: 'Максимальный доступ',
    priceOld: 999, priceNew: 599,
    accent: '#D4B595',
    features: [
      { icon: '👗', text: '50 обычных примерок' },
      { icon: '📦', text: '20 примерок своих товаров' },
      { icon: '🎨', text: '5 раз — примерка 2–4 вещей одновременно' },
      { icon: '💬', text: '3 консультации стилиста' },
    ],
  },
  {
    id: 'medium', emoji: '💥', name: 'MEDIUM',
    subtitle: 'Оптимальный выбор',
    priceOld: 499, priceNew: 299,
    accent: '#B89876',
    features: [
      { icon: '👗', text: '30 обычных примерок' },
      { icon: '📦', text: '10 примерок своих товаров' },
      { icon: '💬', text: '1 консультация стилиста' },
    ],
  },
  {
    id: 'start', emoji: '👌', name: 'START',
    subtitle: 'Для знакомства',
    priceOld: 119, priceNew: 65,
    accent: '#8A6E52',
    features: [
      { icon: '👗', text: '10 обычных примерок' },
      { icon: '💬', text: '1 консультация со стилистом' },
    ],
  },
];

const FALLBACK_CATALOG = [
  { id: 1, wb_id: 183581368, name: 'Платье миди трикотажное', price: '3 990 ₽', category: 'dress',
    image_url: 'https://basket-13.wbbasket.ru/vol1835/part183581/183581368/images/big/1.webp',
    fallback_url: 'https://basket-13.wbbasket.ru/vol1835/part183581/183581368/images/big/2.webp' },
];

function haptic(type = 'light') {
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type); } catch {}
}

function compressImage(file, maxSide = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fixDriveUrl(url) {
  if (!url) return url;
  const m = url.match(/drive\.google\.com\/(?:uc\?.*id=|file\/d\/)([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000`;
  return url;
}

function ProductImage({ src, fallback, alt, className = '' }) {
  const [attempt, setAttempt] = useState(0);
  const candidates = (() => {
    const list = [];
    const add = (u) => { if (u && !list.includes(u)) list.push(u); };
    const fixedSrc = fixDriveUrl(src);
    const fixedFallback = fixDriveUrl(fallback);
    if (fixedSrc) { add(fixedSrc); add(`${BACKEND}/api/img?url=${encodeURIComponent(fixedSrc)}`); }
    const dm = (src || '').match(/drive\.google\.com\/.*id=([a-zA-Z0-9_-]+)/);
    if (dm && dm[1]) {
      add(`https://lh3.googleusercontent.com/d/${dm[1]}=s800`);
      add(`https://lh3.googleusercontent.com/d/${dm[1]}`);
    }
    const base = src && src.replace(/\/images\/big\/\d+\.(webp|jpg|png).*$/, '');
    if (base && base.startsWith('http')) {
      for (let n = 1; n <= 3; n++) add(`${base}/images/big/${n}.webp`);
    }
    if (fixedFallback) add(fixedFallback);
    add('https://placehold.co/400x500/1A1412/D4B595?text=Style+Room');
    return list;
  })();
  const url = candidates[attempt] || candidates[candidates.length - 1];
  return (
    <img src={url} alt={alt}
      onError={() => { if (attempt < candidates.length - 1) setAttempt(attempt + 1); }}
      className={`object-cover bg-card ${className}`} loading="lazy" />
  );
}

// ============================================================
// МОДАЛКА ПОДПИСОК (с рабочим язычком закрытия)
// ============================================================
function SubscriptionsModal({ onClose, onBuy }) {
  const [expanded, setExpanded] = useState('pro');
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef(null);

  const onTouchStart = (e) => { dragStartRef.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (dragStartRef.current == null) return;
    const dy = e.touches[0].clientY - dragStartRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 100) { haptic('light'); onClose(); }
    setDragY(0);
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md bg-bg rounded-t-[28px] border-t border-x border-border2 shadow-soft pb-8 animate-slide-up"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : 'transform 0.2s' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Язычок — рабочая зона для свайпа и закрытия */}
        <div
          className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={onClose}
        >
          <div className="w-12 h-1.5 rounded-full bg-border2" />
        </div>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-border1">
          <div>
            <div className="text-[10px] uppercase tracking-wider2 text-muted mb-0.5">Style Room</div>
            <div className="font-serif text-2xl text-title">Подписки</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-muted text-sm">
            ✕
          </button>
        </div>

        <div className="px-5 pt-5 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">

          {SUBSCRIPTIONS.map((sub, idx) => {
            const isOpen = expanded === sub.id;
            return (
              <div key={sub.id}
                className={`relative bg-card rounded-3xl overflow-hidden transition-all ${
                  isOpen ? 'shadow-glow' : ''
                }`}
                style={{
                  border: `1px solid ${isOpen ? sub.accent : '#2a1f1a'}`,
                }}>

                {/* Верхняя часть — заголовок подписки */}
                <button onClick={() => { haptic('light'); setExpanded(isOpen ? null : sub.id); }}
                  className="w-full flex items-center justify-between px-5 py-5 text-left">

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ background: `${sub.accent}20`, border: `1px solid ${sub.accent}40` }}>
                      {sub.emoji}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider2 mb-0.5"
                        style={{ color: sub.accent }}>{sub.subtitle}</div>
                      <div className="font-serif text-lg text-title leading-tight">{sub.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted line-through">{sub.priceOld}⭐️</span>
                        <span className="text-base font-bold" style={{ color: sub.accent }}>{sub.priceNew}⭐️</span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-accent text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: sub.accent }}>⌄</span>
                </button>

                {/* Раскрывающееся содержимое */}
                {isOpen && (
                  <div className="border-t border-border1 px-5 py-4 bg-bgSoft/40 animate-slide-up">
                    <div className="text-[10px] uppercase tracking-wider2 text-accentSoft mb-3">
                      Что входит
                    </div>
                    <ul className="space-y-3 mb-5">
                      {sub.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-xs text-title leading-relaxed">
                          <span className="text-base shrink-0">{f.icon}</span>
                          <span className="pt-0.5">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => { haptic('medium'); onBuy(sub.id); }}
                      className="w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-wider2 text-bg"
                      style={{ background: sub.accent }}>
                      Оформить за {sub.priceNew}⭐️
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="text-center text-[10px] text-muted pt-2 pb-4 leading-relaxed">
            Оплата через Telegram Stars.<br />
            Попытки зачисляются автоматически.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ПРОФИЛЬ
// ============================================================
function ProfileScreen({ user, onOpenSubs }) {
  const balance = user?.balance || 0;
  const ownTries = user?.own_tries || 0;
  const isSubscribed = user?.sub_active === true || balance >= 10;

  return (
    <main className="px-5 pt-6 animate-fade-in">
      {/* Заголовок */}
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-wider2 text-muted mb-1">Аккаунт</div>
        <h1 className="font-serif text-3xl leading-tight">Профиль</h1>
      </div>

      {/* Карточка пользователя */}
      <div className="bg-card border border-border1 rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img src={user?.photo_url || 'https://placehold.co/120x120/1A1412/D4B595?text=U'} alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-border2" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent border-2 border-bg" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-medium leading-tight truncate">{user?.first_name || 'Гость'}</div>
            <div className="text-xs text-muted truncate">@{user?.username || 'user'}</div>
            {isSubscribed ? (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/40">
                <span className="text-[10px]">💎</span>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider2">Подписка активна</span>
              </div>
            ) : (
              <button onClick={onOpenSubs}
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-border2">
                <span className="text-[10px]">💎</span>
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider2">Оформить</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-card border border-border1 rounded-2xl p-4">
          <div className="text-2xl mb-1">👗</div>
          <div className="text-3xl font-serif text-title leading-none">{balance}</div>
          <div className="text-[10px] uppercase tracking-wider2 text-muted mt-2">Обычных примерок</div>
        </div>
        <div className="bg-card border border-border1 rounded-2xl p-4">
          <div className="text-2xl mb-1">📦</div>
          <div className="text-3xl font-serif text-title leading-none">{ownTries}</div>
          <div className="text-[10px] uppercase tracking-wider2 text-muted mt-2">Своих товаров</div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="space-y-2 mb-4">
        <button onClick={onOpenSubs}
          className="w-full bg-card border border-border1 hover:border-accentSoft rounded-2xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">💎</span>
            <div className="text-left">
              <div className="text-sm font-medium text-title">Подписки</div>
              <div className="text-[10px] text-muted">Больше попыток и возможностей</div>
            </div>
          </div>
          <span className="text-muted">→</span>
        </button>

        <div className="w-full bg-card border border-border1 rounded-2xl px-4 py-4 flex items-center justify-between opacity-60">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎁</span>
            <div className="text-left">
              <div className="text-sm font-medium text-title">Промокод</div>
              <div className="text-[10px] text-muted">Скоро</div>
            </div>
          </div>
          <span className="text-muted">→</span>
        </div>
      </div>

      <div className="text-center text-[10px] text-muted pt-4">
        Style Room · версия 1.0
      </div>
    </main>
  );
}

// ============================================================
// КАТАЛОГ
// ============================================================
function CatalogScreen({ user, catalog, loading, category, setCategory, search, setSearch, onPick, onOpenSubs, onShare }) {
  const visible = catalog.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="px-5 pt-6">
      {/* Заголовок + баланс */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider2 text-muted mb-1">Коллекция</div>
          <h1 className="font-serif text-3xl leading-tight">Гардероб</h1>
          <p className="text-xs text-muted2 mt-1.5">Примерьте образ за секунды</p>
        </div>
        <div className="px-3 py-2 rounded-2xl bg-card border border-border1 text-center">
          <div className="text-lg font-serif text-title leading-none">{user?.balance ?? 0}</div>
          <div className="text-[9px] uppercase tracking-wider2 text-muted mt-0.5">попыток</div>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по каталогу"
          className="w-full bg-card border border-border1 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-accentSoft placeholder:text-muted" />
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      {/* Категории */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-5 px-5">
        {CATEGORIES.map(c => {
          const active = category === c.key;
          return (
            <button key={c.key} onClick={() => { haptic('light'); setCategory(c.key); }}
              className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-full border flex items-center gap-1.5 transition ${
                active ? 'bg-accent text-bg border-accent font-medium' : 'border-border2 text-muted2 hover:border-accentSoft'
              }`}>
              <span>{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Сетка */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border1 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[3/4] bg-border1" />
              <div className="p-3 space-y-2">
                <div className="h-2 bg-border1 rounded w-1/2" />
                <div className="h-3 bg-border1 rounded w-full" />
                <div className="h-3 bg-border1 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">Ничего не найдено</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map(item => (
            <div key={item.id}
              className="bg-card border border-border1 rounded-2xl overflow-hidden shadow-card hover:border-border2 transition">
              <div className="relative aspect-[3/4]">
                <ProductImage src={item.image_url} fallback={item.fallback_url} alt={item.name}
                  className="w-full h-full" />
                <a href={`https://www.wildberries.ru/catalog/${item.wb_id}/detail.aspx`}
                  target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-bg/70 backdrop-blur flex items-center justify-center border border-border2 text-xs">
                  🛍️
                </a>
              </div>
              <div className="p-3">
                <div className="text-[9px] uppercase tracking-wider2 text-accentSoft mb-1">
                  {CATEGORIES.find(x => x.key === item.category)?.label || 'Одежда'}
                </div>
                <div className="font-serif text-[13px] leading-tight line-clamp-2 h-[34px] text-title">
                  {item.name}
                </div>
                <div className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
                  <span className="text-accent">≈</span>
                  <span>{item.price ? item.price.replace(/^≈\s*/, '') : 'цена на WB'}</span>
                </div>
                <button onClick={() => { haptic('light'); onPick(item); }}
                  className="w-full mt-3 bg-transparent border border-accentSoft text-accent hover:bg-accent hover:text-bg text-[11px] font-medium uppercase tracking-wider2 py-2.5 rounded-xl">
                  Примерить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onShare}
        className="w-full mt-8 bg-bgSoft border border-border2 text-accent py-4 rounded-2xl text-xs font-medium uppercase tracking-wider2 flex items-center justify-center gap-2">
        <span>👥</span> Поделиться с подругой · +3
      </button>
    </main>
  );
}

// ============================================================
// НИЖНЕЕ МЕНЮ
// ============================================================
function BottomNav({ active, onChange, onOpenSubs }) {
  const items = [
    { key: 'catalog', label: 'Разделы',  emoji: '🗂' },
    { key: 'search',  label: 'Поиск',    emoji: '🔍' },
    { key: 'subs',    label: 'Подписка', emoji: '💎' },
    { key: 'profile', label: 'Профиль',  emoji: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg/95 backdrop-blur-md border-t border-border1 px-3 pb-3 pt-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map(it => {
          const isActive = active === it.key;
          return (
            <button key={it.key}
              onClick={() => {
                haptic('light');
                if (it.key === 'subs') onOpenSubs();
                else onChange(it.key);
              }}
              className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl min-w-[60px]">
              <span className={`text-lg transition ${isActive ? 'opacity-100' : 'opacity-50'}`}>{it.emoji}</span>
              <span className={`text-[9px] uppercase tracking-wider2 transition ${
                isActive ? 'text-accent font-bold' : 'text-muted'
              }`}>
                {it.label}
              </span>
              {isActive && <div className="w-1 h-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================================
// ОНБОРДИНГ
// ============================================================
const ONBOARDING_SLIDES = [
  { emoji: '✨', title: 'Примерь любой образ', text: 'Загрузите фото в полный рост, выберите вещь — ИИ покажет, как она сидит именно на вас' },
  { emoji: '🛍️', title: 'Актуальные тренды WB', text: 'Каталог обновляется автоматически — свежие находки Wildberries всегда под рукой' },
  { emoji: '👥', title: 'Приглашай подруг', text: 'За каждую подругу, которая сделает первую примерку, вы обе получите +3 попытки' },
];

function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === ONBOARDING_SLIDES.length - 1;
  const s = ONBOARDING_SLIDES[slide];
  const next = () => { haptic('medium'); if (isLast) onDone(); else setSlide(i => i + 1); };
  return (
    <div className="min-h-screen flex flex-col px-8 pt-16 pb-10 bg-bg">
      <div className="flex justify-center gap-2 mb-12">
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i} className={`h-[3px] rounded-full transition-all ${i === slide ? 'w-8 bg-accent' : 'w-2 bg-border2'}`} />
        ))}
      </div>
      <div key={slide} className="flex-1 flex flex-col items-center justify-center text-center animate-slide-up">
        <div className="text-7xl mb-8">{s.emoji}</div>
        <h2 className="font-serif text-3xl mb-4 leading-tight">{s.title}</h2>
        <p className="text-sm text-muted2 leading-relaxed max-w-xs">{s.text}</p>
      </div>
      <button onClick={next} className="w-full bg-accent hover:bg-accentH text-bg py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2">
        {isLast ? 'Начать' : 'Продолжить'}
      </button>
      {!isLast && <button onClick={onDone} className="mt-4 text-xs text-muted tracking-wide">Пропустить</button>}
    </div>
  );
}

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const [tab, setTab] = useState('catalog');       // catalog | search | profile | upload | loading | result
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [humanImg, setHumanImg] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [viral, setViral] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready(); tg.expand();
      tg.setHeaderColor?.('#0C0A08');
      tg.setBackgroundColor?.('#0C0A08');
      tg.disableVerticalSwipes?.();
    }
    const initData = tg?.initData || '';
    const startParam = tg?.initDataUnsafe?.start_param;
    fetch(`${BACKEND}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, refCode: startParam }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUser(d.user);
          const localDone = localStorage.getItem('gf_onboarded') === '1';
          if (!d.user.onboarded && !localDone) setShowOnboarding(true);
        } else setUserGuest();
      })
      .catch(() => setUserGuest());
  }, []);

  const setUserGuest = () => setUser({
    tg_id: 0, first_name: 'Гость', username: 'guest', photo_url: '',
    balance: 3, own_tries: 0, onboarded: true,
  });

  const finishOnboarding = async () => {
    localStorage.setItem('gf_onboarded', '1');
    setShowOnboarding(false);
    try {
      await fetch(`${BACKEND}/api/onboarded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData || '' }),
      });
    } catch {}
  };

  // ===== Рекомендательная сортировка =====
  // Убираем аксессуары в самый конец, а платья/топы/трикотаж — в начало
  const sortRecommended = (items) => {
    const order = { dress: 1, top: 2, outerwear: 3, suit: 4, bottom: 5, shoes: 6, accessory: 99 };
    return [...items].sort((a, b) => {
      const oa = order[a.category] ?? 50;
      const ob = order[b.category] ?? 50;
      return oa - ob;
    });
  };

  const loadCatalog = useCallback(async (cat) => {
    setLoadingCatalog(true);
    try {
      const q = cat && cat !== 'all' ? `?category=${encodeURIComponent(cat)}` : '';
      const r = await fetch(`${BACKEND}/api/catalog${q}`);
      const d = await r.json();
      if (d.success && d.items.length) {
        setCatalog(sortRecommended(d.items));
      } else {
        setCatalog(FALLBACK_CATALOG);
      }
    } catch {
      setCatalog(FALLBACK_CATALOG);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => { loadCatalog(category); }, [category, loadCatalog]);

  const share = () => {
    haptic('medium');
    const refLink = `https://t.me/GFstyleroom_bot/app?startapp=ref_${user?.tg_id || 0}`;
    const text = 'Смотри, какое крутое мини-приложение с примеркой одежды ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setHumanImg(await compressImage(f, 1000)); showToast('Фото загружено'); }
    catch { showToast('Не удалось обработать фото'); }
  };

  const buySubscription = async (subId) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте приложение в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.tg_id, productType: `sub_${subId}` }),
      });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error || 'no invoice');
      setShowSubs(false);
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (status) => {
        if (status === 'paid') {
          showToast('Подписка активирована ✨');
          setTimeout(() => window.location.reload(), 1500);
        }
      });
    } catch (e) { showToast('Ошибка оплаты'); }
  };

  const runTryOn = async () => {
    if (!selected) return showToast('Выберите товар');
    if (!humanImg) return showToast('Загрузите фото');
    haptic('medium');
    setTab('loading');
    try {
      const r = await fetch(`${BACKEND}/api/tryon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || '',
          humanImg,
          garmentUrl: selected.image_url,
          itemId: selected.id,
          isAccessory: selected.category === 'accessory',
        }),
      });
      const d = await r.json();
      if (d.success) {
        setResultImage(d.resultUrl);
        setUser(u => u ? { ...u, balance: Math.max(0, (u.balance || 0) - 1) } : u);
        setTab('result');
        if (Math.random() < 0.3) setTimeout(() => setViral(true), 800);
      } else {
        showToast(d.error || 'Ошибка примерки');
        setTab('catalog');
      }
    } catch {
      showToast('Ошибка соединения');
      setTab('catalog');
    }
  };

  const resetTryOn = () => {
    setTab('catalog'); setSelected(null); setResultImage(null); setHumanImg('');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
        <div className="spinner mb-6" />
        <div className="text-xs text-muted tracking-wider2 uppercase">Загрузка</div>
      </div>
    );
  }

  if (showOnboarding) return <Onboarding onDone={finishOnboarding} />;

  const isTryOnFlow = tab === 'upload' || tab === 'loading' || tab === 'result';

  return (
    <div className="min-h-screen bg-bg text-title pb-24">

      {/* HEADER — только для каталога/поиска/профиля */}
      {!isTryOnFlow && (
        <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-md border-b border-border1 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={user.photo_url || 'https://placehold.co/80x80/1A1412/D4B595?text=U'} alt=""
                className="w-9 h-9 rounded-full object-cover border border-border2" />
              <div>
                <div className="text-sm font-medium leading-tight">{user.first_name || 'Гость'}</div>
                <div className="text-[11px] text-muted">@{user.username || 'user'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full border border-border2">
                <span className="text-[11px] text-muted mr-1.5">✨</span>
                <span className="text-xs font-medium">{user.balance ?? 0}</span>
              </div>
              <button onClick={() => { haptic('medium'); setShowSubs(true); }}
                className="px-3 py-1.5 rounded-full bg-accent text-bg text-xs font-bold">
                💎
              </button>
            </div>
          </div>
        </header>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border2 text-title text-xs px-4 py-2.5 rounded-full shadow-soft animate-fade-in">
          {toast}
        </div>
      )}

      {/* CATALOG / SEARCH */}
      {(tab === 'catalog' || tab === 'search') && (
        <CatalogScreen
          user={user}
          catalog={catalog}
          loading={loadingCatalog}
          category={category}
          setCategory={setCategory}
          search={search}
          setSearch={setSearch}
          onPick={(item) => { setSelected(item); setTab('upload'); }}
          onOpenSubs={() => setShowSubs(true)}
          onShare={share}
        />
      )}

      {/* PROFILE */}
      {tab === 'profile' && (
        <ProfileScreen user={user} onOpenSubs={() => setShowSubs(true)} />
      )}

      {/* UPLOAD */}
      {tab === 'upload' && selected && (
        <main className="px-5 pt-5 animate-fade-in">
          <button onClick={() => setTab('catalog')}
            className="text-xs text-muted mb-5 flex items-center gap-1">← Назад в каталог</button>

          <div className="bg-card border border-border1 rounded-2xl overflow-hidden mb-6">
            <div className="aspect-[4/3]">
              <ProductImage src={selected.image_url} fallback={selected.fallback_url}
                alt={selected.name} className="w-full h-full" />
            </div>
            <div className="p-4">
              <div className="text-[10px] uppercase tracking-wider2 text-accentSoft mb-1">
                {CATEGORIES.find(x => x.key === selected.category)?.label || 'Одежда'}
              </div>
              <div className="font-serif text-base leading-tight text-title">{selected.name}</div>
              <div className="text-xs text-muted mt-1.5 flex items-center gap-1">
                <span className="text-accent">≈</span>
                <span>{selected.price ? selected.price.replace(/^≈\s*/, '') : 'цена на WB'}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border2 rounded-2xl p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider2 text-accent mb-2">
              📸 {selected.category === 'accessory' ? 'Для аксессуаров' : 'Для одежды'}
            </div>
            <div className="text-xs text-title leading-relaxed">
              {selected.category === 'accessory'
                ? 'Загрузите фото лица — очки, повязки и ободки будут примерены прямо на него.'
                : 'Загрузите фото в полный рост — вещь будет примерена на вас.'}
            </div>
          </div>

          <div className="text-[10px] uppercase tracking-wider2 text-muted mb-3">
            {selected.category === 'accessory' ? 'Ваше фото лица' : 'Ваше фото в полный рост'}
          </div>

          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-card border border-dashed border-border2 hover:border-accentSoft rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2">
            <span className="text-2xl">{humanImg ? '✓' : '📷'}</span>
            <span>{humanImg ? 'Фото загружено' : 'Загрузить фото'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />

          {humanImg && (
            <img src={humanImg} alt="preview"
              className="w-full max-h-72 object-contain rounded-2xl mb-4 border border-border1" />
          )}

          <button onClick={runTryOn} disabled={!humanImg}
            className="w-full bg-accent hover:bg-accentH disabled:opacity-30 disabled:cursor-not-allowed text-bg py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2 mt-4">
            {selected.category === 'accessory' ? 'Примерить аксессуар' : 'Запустить примерку'}
          </button>
        </main>
      )}

      {/* LOADING */}
      {tab === 'loading' && (
        <div className="min-h-[75vh] flex flex-col items-center justify-center px-8 text-center">
          <div className="spinner mb-8" />
          <div className="font-serif text-xl mb-2">Подбираем образ</div>
          <div className="text-xs text-muted">Обычно занимает 10–20 секунд</div>
        </div>
      )}

      {/* RESULT */}
      {tab === 'result' && resultImage && (
        <main className="px-5 pt-5 animate-fade-in">
          <div className="text-[10px] uppercase tracking-wider2 text-muted mb-3">Результат</div>
          <img src={resultImage} alt="result"
            className="w-full rounded-2xl border border-border1 shadow-soft mb-5" />
          <a href={`https://www.wildberries.ru/catalog/${selected?.wb_id}/detail.aspx`}
            target="_blank" rel="noreferrer"
            className="block w-full bg-accent hover:bg-accentH text-bg text-center py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2 mb-3">
            Купить на Wildberries
          </a>
          <button onClick={resetTryOn}
            className="w-full border border-border2 text-muted2 py-4 rounded-2xl text-sm">
            Вернуться в каталог
          </button>
        </main>
      )}

      {/* VIRAL MODAL */}
      {viral && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-5 animate-fade-in">
          <div className="bg-card border border-border2 rounded-3xl p-7 max-w-sm w-full text-center shadow-soft">
            <div className="text-3xl mb-4">✨</div>
            <h3 className="font-serif text-2xl mb-3">Понравилось?</h3>
            <p className="text-xs text-muted2 leading-relaxed mb-6">
              Поделись с подругой — как только она сделает первую примерку, вы обе получите <span className="text-accent">+3 попытки</span>
            </p>
            <button onClick={() => { setViral(false); share(); }}
              className="w-full bg-accent text-bg py-3.5 rounded-2xl text-xs font-medium uppercase tracking-wider2 mb-3">
              Поделиться
            </button>
            <button onClick={() => setViral(false)}
              className="text-xs text-muted tracking-wide">Закрыть</button>
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS MODAL */}
      {showSubs && (
        <SubscriptionsModal onClose={() => setShowSubs(false)} onBuy={buySubscription} />
      )}

      {/* BOTTOM NAV — скрыто в процессе примерки */}
      {!isTryOnFlow && (
        <BottomNav
          active={tab}
          onChange={setTab}
          onOpenSubs={() => setShowSubs(true)}
        />
      )}
    </div>
  );
}
