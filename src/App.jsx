import React, { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gf-backend-uc51.onrender.com';
const CATEGORIES = ['Все', 'Платья', 'Верхняя одежда', 'Жакеты', 'Трикотаж', 'Брюки', 'Топы'];

const FALLBACK_CATALOG = [
  { id: 1, wb_id: 183581368, name: 'Платье миди трикотажное', price: '3 990 ₽', category: 'Платья',
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

// ========== PRODUCT IMAGE с многоуровневым fallback + прокси ==========
function ProductImage({ src, fallback, alt, className = '' }) {
  const [attempt, setAttempt] = useState(0);

  const candidates = (() => {
    const list = [];
    const add = (u) => { if (u && !list.includes(u)) list.push(u); };

    if (src) {
      add(src);
      add(`${BACKEND}/api/img?url=${encodeURIComponent(src)}`);
    }

    const base = src && src.replace(/\/images\/big\/\d+\.(webp|jpg|png).*$/, '');
    if (base) {
      for (let n = 2; n <= 3; n++) {
        const uWebp = `${base}/images/big/${n}.webp`;
        add(uWebp);
        add(`${BACKEND}/api/img?url=${encodeURIComponent(uWebp)}`);
        const uJpg = `${base}/images/big/${n}.jpg`;
        add(uJpg);
        add(`${BACKEND}/api/img?url=${encodeURIComponent(uJpg)}`);
      }
      const uSm = `${base}/images/small/1.webp`;
      add(uSm);
      add(`${BACKEND}/api/img?url=${encodeURIComponent(uSm)}`);
    }

    if (fallback) {
      add(fallback);
      add(`${BACKEND}/api/img?url=${encodeURIComponent(fallback)}`);
    }

    add('https://via.placeholder.com/400x500/1A1412/D4B595?text=Style+Room');
    return list;
  })();

  const url = candidates[attempt] || candidates[candidates.length - 1];

  return (
    <img
      src={url}
      alt={alt}
      onError={() => {
        if (attempt < candidates.length - 1) setAttempt(attempt + 1);
      }}
      className={`object-cover bg-card ${className}`}
      loading="lazy"
    />
  );
}

const ONBOARDING_SLIDES = [
  { emoji: '✨', title: 'Примерь любой образ',
    text: 'Загрузите фото в полный рост, выберите вещь — ИИ покажет, как она сидит именно на вас' },
  { emoji: '🛍️', title: 'Актуальные тренды WB',
    text: 'Каталог обновляется автоматически — свежие находки Wildberries всегда под рукой' },
  { emoji: '👥', title: 'Приглашай подруг',
    text: 'За каждую подругу, которая сделает первую примерку, вы обе получите +3 попытки' },
];

function Onboarding({ onDone }) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === ONBOARDING_SLIDES.length - 1;
  const s = ONBOARDING_SLIDES[slide];

  const next = () => {
    haptic('medium');
    if (isLast) onDone();
    else setSlide(i => i + 1);
  };

  return (
    <div className="min-h-screen flex flex-col px-8 pt-16 pb-10 bg-bg">
      <div className="flex justify-center gap-2 mb-12">
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i}
            className={`h-[3px] rounded-full transition-all ${i === slide ? 'w-8 bg-accent' : 'w-2 bg-border2'}`}
          />
        ))}
      </div>

      <div key={slide} className="flex-1 flex flex-col items-center justify-center text-center animate-slide-up">
        <div className="text-7xl mb-8">{s.emoji}</div>
        <h2 className="font-serif text-3xl mb-4 leading-tight">{s.title}</h2>
        <p className="text-sm text-muted2 leading-relaxed max-w-xs">{s.text}</p>
      </div>

      <button onClick={next}
        className="w-full bg-accent hover:bg-accentH text-bg py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2">
        {isLast ? 'Начать' : 'Продолжить'}
      </button>

      {!isLast && (
        <button onClick={onDone} className="mt-4 text-xs text-muted tracking-wide">
          Пропустить
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [category, setCategory] = useState('Все');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [humanImg, setHumanImg] = useState('');
  const [wbLink, setWbLink] = useState('');
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
    tg_id: 0, first_name: 'Гость', username: 'guest', photo_url: '', balance: 3, onboarded: true,
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

  const loadCatalog = useCallback(async (cat) => {
    try {
      const q = cat && cat !== 'Все' ? `?category=${encodeURIComponent(cat)}` : '';
      const r = await fetch(`${BACKEND}/api/catalog${q}`);
      const d = await r.json();
      setCatalog(d.success && d.items.length ? d.items : FALLBACK_CATALOG);
    } catch { setCatalog(FALLBACK_CATALOG); }
  }, []);

  useEffect(() => { loadCatalog(category); }, [category, loadCatalog]);

  const visible = catalog.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const buy = async (productType) => {
    haptic('medium');
    if (!user?.tg_id) return showToast('Откройте приложение в Telegram');
    try {
      const r = await fetch(`${BACKEND}/api/create-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.tg_id, productType }),
      });
      const d = await r.json();
      if (!d.invoiceLink) throw new Error(d.error || 'no invoice');
      window.Telegram.WebApp.openInvoice(d.invoiceLink, (status) => {
        if (status === 'paid') window.location.reload();
      });
    } catch (e) { showToast('Ошибка оплаты'); }
  };

  const runTryOn = async () => {
    if (!selected) return showToast('Выберите товар');
    if (!humanImg && !wbLink) return showToast('Загрузите фото или ссылку');
    haptic('medium');
    setTab('loading');
    try {
      const r = await fetch(`${BACKEND}/api/tryon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || '',
          humanImg: humanImg || wbLink,
          garmentUrl: selected.image_url,
          itemId: selected.id,
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
        setTab('upload');
      }
    } catch {
      showToast('Ошибка соединения');
      setTab('upload');
    }
  };

  const resetTryOn = () => {
    setTab('catalog'); setSelected(null); setResultImage(null);
    setHumanImg(''); setWbLink('');
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

  return (
    <div className="min-h-screen bg-bg text-title pb-24">
      <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-md border-b border-border1 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={user.photo_url || 'https://via.placeholder.com/80'} alt=""
                className="w-10 h-10 rounded-full object-cover border border-border2" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-bg" />
            </div>
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
            <button onClick={() => buy('pack10')}
              className="px-3 py-1.5 rounded-full bg-accent text-bg text-xs font-medium">
              Купить
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border2 text-title text-xs px-4 py-2.5 rounded-full shadow-soft animate-fade-in">
          {toast}
        </div>
      )}

      {tab === 'catalog' && (
        <main className="px-5 pt-6">
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-wider2 text-muted mb-1">Коллекция</div>
            <h1 className="font-serif text-3xl leading-tight">Гардероб</h1>
            <p className="text-xs text-muted2 mt-1.5">Примерьте образ за несколько секунд</p>
          </div>

          <div className="relative mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по каталогу"
              className="w-full bg-card border border-border1 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-accentSoft placeholder:text-muted" />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-5 px-5">
            {CATEGORIES.map(c => {
              const active = category === c;
              return (
                <button key={c} onClick={() => { haptic('light'); setCategory(c); }}
                  className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-full border flex items-center gap-1.5 ${
                    active ? 'bg-accent text-bg border-accent' : 'border-border2 text-muted2 hover:border-accentSoft'
                  }`}>
                  {active && <span className="w-1 h-1 rounded-full bg-bg" />}
                  {c}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
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
                    <div className="text-xs font-medium leading-snug line-clamp-2 h-[34px]">{item.name}</div>
                    <div className="text-[11px] text-muted mt-1.5">{item.price || '—'}</div>
                    <button onClick={() => { haptic('light'); setSelected(item); setTab('upload'); }}
                      className="w-full mt-3 bg-transparent border border-accentSoft text-accent hover:bg-accent hover:text-bg text-[11px] font-medium uppercase tracking-wider2 py-2.5 rounded-xl">
                      Примерить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={share}
            className="w-full mt-8 bg-bgSoft border border-border2 text-accent py-4 rounded-2xl text-xs font-medium uppercase tracking-wider2 flex items-center justify-center gap-2">
            <span>👥</span> Поделиться с подругой · +3
          </button>
        </main>
      )}

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
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-xs text-muted mt-1">{selected.price}</div>
            </div>
          </div>

          <div className="text-[10px] uppercase tracking-wider2 text-muted mb-3">Ваше фото</div>

          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-card border border-dashed border-border2 hover:border-accentSoft rounded-2xl py-8 text-sm text-muted2 mb-3 flex flex-col items-center gap-2">
            <span className="text-2xl">{humanImg ? '✓' : '📷'}</span>
            <span>{humanImg ? 'Фото загружено' : 'Загрузить фото в полный рост'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />

          {humanImg && (
            <img src={humanImg} alt="preview"
              className="w-full max-h-72 object-contain rounded-2xl mb-4 border border-border1" />
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border1" />
            <span className="text-[10px] text-muted uppercase tracking-wider2">или</span>
            <div className="flex-1 h-px bg-border1" />
          </div>

          <input value={wbLink} onChange={(e) => setWbLink(e.target.value)}
            placeholder="Ссылка на фото"
            className="w-full bg-card border border-border1 rounded-2xl px-4 py-3 text-sm mb-5 outline-none focus:border-accentSoft placeholder:text-muted" />

          <button onClick={runTryOn} disabled={!humanImg && !wbLink}
            className="w-full bg-accent hover:bg-accentH disabled:opacity-30 disabled:cursor-not-allowed text-bg py-4 rounded-2xl text-sm font-medium uppercase tracking-wider2">
            Запустить примерку
          </button>
        </main>
      )}

      {tab === 'loading' && (
        <div className="min-h-[75vh] flex flex-col items-center justify-center px-8 text-center">
          <div className="spinner mb-8" />
          <div className="font-serif text-xl mb-2">Подбираем образ</div>
          <div className="text-xs text-muted">Обычно занимает 10–20 секунд</div>
        </div>
      )}

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
    </div>
  );
}
