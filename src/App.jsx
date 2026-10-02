import React, { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gf-backend-uc51.onrender.com';
const CATEGORIES = ['Все', 'Платья', 'Верхняя одежда', 'Жакеты', 'Трикотаж', 'Брюки', 'Топы'];

const FALLBACK_CATALOG = [
  { id: 1, wb_id: 12345678, name: 'Платье миди бежевое', price: '3 490 ₽', category: 'Платья',
    image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
    fallback_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600' },
  { id: 2, wb_id: 87654321, name: 'Топ корсетный', price: '1 290 ₽', category: 'Топы',
    image_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600',
    fallback_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600' },
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

function ProductImage({ src, fallback, alt }) {
  const [url, setUrl] = useState(src);
  useEffect(() => { setUrl(src); }, [src]);
  return (
    <img src={url} alt={alt}
      onError={() => { if (url !== fallback && fallback) setUrl(fallback); }}
      className="w-full h-44 object-cover rounded-xl bg-card" loading="lazy" />
  );
}

export default function App() {
  const [user, setUser] = useState(null);
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
      tg.setHeaderColor?.('#14100e');
      tg.setBackgroundColor?.('#14100e');
    }
    const initData = tg?.initData || '';
    const startParam = tg?.initDataUnsafe?.start_param;

    fetch(`${BACKEND}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, refCode: startParam }),
    })
      .then(r => r.json())
      .then(d => d.success ? setUser(d.user) : setUser({
        tg_id: 0, first_name: 'Гость', username: 'guest', photo_url: '', balance: 3,
      }))
      .catch(() => setUser({
        tg_id: 0, first_name: 'Гость', username: 'guest', photo_url: '', balance: 3,
      }));
  }, []);

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
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const share = () => {
    haptic('medium');
    const refLink = `https://t.me/GFstyleroom_bot/app?startapp=ref_${user?.tg_id || 0}`;
    const text = 'Смотри, какое крутое мини-приложение с примеркой одежды ✨';
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setHumanImg(await compressImage(f, 1000)); showToast('Фото загружено ✓'); }
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
    } catch (e) { showToast('Ошибка оплаты: ' + e.message); }
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
      showToast('Ошибка соединения с сервером');
      setTab('upload');
    }
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center text-muted">
      Загрузка…
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-title pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur border-b border-border1 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={user.photo_url || 'https://via.placeholder.com/80'}
              alt="avatar"
              className="w-10 h-10 rounded-full object-cover border border-border2"
            />
            <div>
              <div className="text-sm font-medium">{user.first_name || 'Гость'}</div>
              <div className="text-xs text-muted">@{user.username || 'user'}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs px-3 py-1 rounded-full bg-accent text-bg font-semibold">
              ✨ {user.balance ?? 0}
            </div>
            <button
              onClick={() => buy('pack10')}
              className="text-xs mt-1 px-3 py-1 rounded-full border border-border2 text-accent"
            >
              ⭐ Купить
            </button>
          </div>
        </div>
      </header>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border2 text-title text-xs px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* CATALOG */}
      {tab === 'catalog' && (
        <main className="px-4 pt-4">
          <h1 className="text-xl font-semibold mb-1">Гардероб</h1>
          <p className="text-xs text-muted mb-4">Выберите образ и примерьте за секунды</p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по каталогу…"
            className="w-full bg-card border border-border1 rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:border-accent placeholder:text-muted"
          />

          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { haptic('light'); setCategory(c); }}
                className={`whitespace-nowrap text-xs px-3.5 py-1.5 rounded-full border transition ${
                  category === c
                    ? 'bg-accent text-bg border-accent font-semibold'
                    : 'border-border2 text-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {visible.map(item => (
              <div key={item.id} className="bg-card border border-border1 rounded-2xl p-2.5">
                <div className="relative">
                  <ProductImage src={item.image_url} fallback={item.fallback_url} alt={item.name} />
                  <a
                    href={`https://www.wildberries.ru/catalog/${item.wb_id}/detail.aspx`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bg/80 backdrop-blur flex items-center justify-center border border-border2"
                  >
                    🛍️
                  </a>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-medium line-clamp-2 h-8">{item.name}</div>
                  <div className="text-xs text-muted mt-1">{item.price || '—'}</div>
                  <button
                    onClick={() => { haptic('light'); setSelected(item); setTab('upload'); }}
                    className="w-full mt-2 bg-accent hover:bg-accentH text-bg text-xs font-semibold py-2 rounded-xl transition"
                  >
                    Примерить ✨
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={share}
            className="w-full mt-6 border border-accent text-accent py-3 rounded-2xl text-sm font-semibold"
          >
            👥 Поделиться с подругой (+3)
          </button>
        </main>
      )}

      {/* UPLOAD */}
      {tab === 'upload' && selected && (
        <main className="px-4 pt-4">
          <button onClick={() => setTab('catalog')} className="text-xs text-muted mb-3">← Назад</button>

          <div className="bg-card border border-border1 rounded-2xl p-3 mb-4">
            <ProductImage src={selected.image_url} fallback={selected.fallback_url} alt={selected.name} />
            <div className="text-sm mt-2">{selected.name}</div>
            <div className="text-xs text-muted">{selected.price}</div>
          </div>

          <h2 className="text-sm font-semibold mb-2">Ваше фото в полный рост</h2>

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-card border border-dashed border-border2 rounded-2xl py-6 text-sm text-muted mb-3"
          >
            {humanImg ? '✓ Фото загружено — заменить' : '📷 Загрузить фото'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />

          {humanImg && (
            <img src={humanImg} alt="preview" className="w-full max-h-64 object-contain rounded-xl mb-3 border border-border1" />
          )}

          <div className="text-xs text-muted text-center my-3">— или —</div>

          <input
            value={wbLink}
            onChange={(e) => setWbLink(e.target.value)}
            placeholder="Ссылка на фото или артикул WB"
            className="w-full bg-card border border-border1 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-accent placeholder:text-muted"
          />

          <button
            onClick={runTryOn}
            disabled={!humanImg && !wbLink}
            className="w-full bg-accent hover:bg-accentH disabled:opacity-40 disabled:cursor-not-allowed text-bg py-3.5 rounded-2xl font-semibold"
          >
            Запустить примерку 🪄
          </button>
        </main>
      )}

      {/* LOADING */}
      {tab === 'loading' && (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-border2 border-t-accent animate-spin mb-6"></div>
          <div className="text-title font-medium">Нейросеть примеряет наряд</div>
          <div className="text-xs text-muted mt-2">Обычно занимает 10–20 секунд</div>
        </div>
      )}

      {/* RESULT */}
      {tab === 'result' && resultImage && (
        <main className="px-4 pt-4">
          <img src={resultImage} alt="result" className="w-full rounded-2xl border border-border1 mb-4" />
          <a
            href={`https://www.wildberries.ru/catalog/${selected?.wb_id}/detail.aspx`}
            target="_blank"
            rel="noreferrer"
            className="block w-full bg-accent hover:bg-accentH text-bg text-center py-3.5 rounded-2xl font-semibold mb-2"
          >
            🛒 Купить на Wildberries
          </a>
          <button
            onClick={() => { setTab('catalog'); setSelected(null); setResultImage(null); setHumanImg(''); setWbLink(''); }}
            className="w-full border border-border2 text-muted py-3 rounded-2xl text-sm"
          >
            Вернуться в каталог
          </button>
        </main>
      )}

      {/* VIRAL MODAL */}
      {viral && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-card border border-border2 rounded-3xl p-6 max-w-xs w-full text-center">
            <div className="text-2xl mb-2">✨</div>
            <h3 className="font-semibold mb-2">Понравилось?</h3>
            <p className="text-xs text-muted mb-5">
              Поделись с подругой — как только она сделает первую примерку, вы обе получите +3 попытки
            </p>
            <button
              onClick={() => { setViral(false); share(); }}
              className="w-full bg-accent text-bg py-3 rounded-2xl text-sm font-semibold mb-2"
            >
              Поделиться
            </button>
            <button onClick={() => setViral(false)} className="text-xs text-muted">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
