import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [user, setUser] = useState({
    tg_id: 12345678,
    first_name: 'Гость',
    username: 'user',
    balance: 3,
    photo_url: ''
  });
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'upload' | 'loading' | 'result'
  const [selectedItem, setSelectedItem] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [wbInput, setWbInput] = useState('');
  
  const fileInputRef = useRef(null);

  // Пул эстетичных трендовых вещей
  const ALL_ITEMS = [
    { id: '1', name: 'Оверсайз тренч Sand', price: '4 890 ₽', url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80', wb: '12345678' },
    { id: '2', name: 'Шёлковая комбинация Midi', price: '3 290 ₽', url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80', wb: '23456789' },
    { id: '3', name: 'Кардиган крупной вязки Cashmere', price: '2 890 ₽', url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80', wb: '34567890' },
    { id: '4', name: 'Кожаный блейзер Vintage', price: '5 400 ₽', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80', wb: '45678901' },
    { id: '5', name: 'Кашемировое худи Latte', price: '2 490 ₽', url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80', wb: '56789012' },
    { id: '6', name: 'Корсетный топ Cream', price: '1 690 ₽', url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80', wb: '67890123' },
    { id: '7', name: 'Брюки Wide Leg Tailored', price: '3 150 ₽', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80', wb: '78901234' },
    { id: '8', name: 'Платье Chocolate Velvet', price: '4 200 ₽', url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80', wb: '89012345' }
  ];

  // Смена подборки каждые 24 часа
  const getDailyItems = () => {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const startIndex = (dayIndex * 4) % ALL_ITEMS.length;
    const rotated = [];
    for (let i = 0; i < 4; i++) {
      rotated.push(ALL_ITEMS[(startIndex + i) % ALL_ITEMS.length]);
    }
    return rotated;
  };

  const ITEMS = getDailyItems();

  const BACKEND_URL = "https://girls-founds.onrender.com";
  const BOT_USERNAME = "GFstyleroom_bot";

  const haptic = (type = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
    } catch (_) {}
  };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();

      if (tg.BackButton) {
        if (activeTab === 'catalog') {
          tg.BackButton.hide();
        } else {
          tg.BackButton.show();
          tg.BackButton.onClick(() => {
            haptic('selection_change');
            setActiveTab('catalog');
          });
        }
      }

      const initData = tg.initData;
      const startParam = tg.initDataUnsafe?.start_param;

      if (initData) {
        fetch(`${BACKEND_URL}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, refCode: startParam })
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.user) {
              setUser(data.user);
            }
          })
          .catch(() => {});
      }
    }
  }, [activeTab]);

  const handleWbSubmit = (e) => {
    e.preventDefault();
    if (!wbInput.trim()) return;
    haptic('medium');

    const match = wbInput.match(/(\d{6,})/);
    const articul = match ? match[1] : wbInput.trim();
    if (!articul) return;

    const vol = Math.floor(parseInt(articul) / 100000);
    const part = Math.floor(parseInt(articul) / 1000);
    const wbImageUrl = `https://basket-01.wbbasket.ru/vol${vol}/part${part}/${articul}/images/big/1.webp`;

    const customItem = {
      id: `custom_${articul}`,
      name: `Товар WB #${articul}`,
      price: 'По ссылке',
      url: wbImageUrl,
      wb: articul
    };

    setSelectedItem(customItem);
    setUserPhoto(null);
    setErrorMessage('');
    setWbInput('');
    setActiveTab('upload');
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptic('medium');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        setUserPhoto(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Тестовый режим примерки (без обращения к платному fal.ai)
  const runTryOn = async () => {
    if (!userPhoto || !selectedItem) return;
    haptic('heavy');
    setErrorMessage('');
    setActiveTab('loading');

    // Имитируем работу нейросети (3 секунды)
    setTimeout(() => {
      // Списываем 1 попытку для проверки баланса
      setUser((prev) => ({ ...prev, balance: Math.max(0, (prev.balance || 1) - 1) }));
      // Показываем красивый результат
      setResultImage(selectedItem.url);
      setActiveTab('result');
    }, 3000);
  };

    try {
      const res = await fetch(`${BACKEND_URL}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.Telegram?.WebApp?.initData || '',
          humanImg: userPhoto,
          garmentUrl: selectedItem.url,
          itemId: selectedItem.id
        })
      });

      const data = await res.json();
      if (data.success && data.resultUrl) {
        setResultImage(data.resultUrl);
        setActiveTab('result');
      } else {
        setErrorMessage(data.error || 'Ошибка генерации примерки');
        setActiveTab('upload');
      }
    } catch (e) {
      setErrorMessage('Не удалось связаться с сервером. Попробуйте еще раз.');
      setActiveTab('upload');
    }
  };

  const handleBuy = async () => {
    haptic('light');
    const tg = window.Telegram?.WebApp;
    try {
      const res = await fetch(`${BACKEND_URL}/api/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: user.tg_id, productType: 'pack10' })
      });
      const data = await res.json();
      if (data.invoiceLink && tg?.openInvoice) {
        tg.openInvoice(data.invoiceLink, (status) => {
          if (status === 'paid') window.location.reload();
        });
      }
    } catch (_) {}
  };

  const handleShare = () => {
    haptic('light');
    const refLink = `https://t.me/${BOT_USERNAME}/app?startapp=ref_${user.tg_id}`;
    const text = "Примерь эти стильные образы на себе через нейросеть ✨:";
    window.Telegram?.WebApp?.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`
    );
  };

  return (
    <div className="min-h-screen bg-[#14100e] text-[#f5f0eb] font-sans selection:bg-[#d4b595] selection:text-[#14100e] pb-10">
      {/* Шапка профиля */}
      <header className="sticky top-0 z-30 bg-[#14100e]/85 backdrop-blur-md border-b border-[#261e1a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {activeTab !== 'catalog' ? (
            <button
              onClick={() => {
                haptic('selection_change');
                setActiveTab('catalog');
              }}
              className="p-1.5 -ml-1 text-[#b5a49c] hover:text-[#f5f0eb] transition flex items-center gap-1 text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Назад</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3a2d27] to-[#59443c] flex items-center justify-center font-bold text-xs uppercase text-[#d4b595] shadow-inner border border-[#4d3a33]">
                {user.first_name?.[0] || 'U'}
              </div>
              <span className="font-medium text-sm tracking-tight text-[#f5f0eb]">{user.first_name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-[#1c1512] border border-[#2e231e] text-xs font-medium text-[#d4b595] flex items-center gap-1.5 shadow-sm">
            <span>✨</span>
            <span>{user.balance ?? 0}</span>
          </div>
          <button
            onClick={handleBuy}
            className="px-3 py-1 rounded-full bg-[#d4b595]/10 hover:bg-[#d4b595]/20 text-[#d4b595] border border-[#d4b595]/20 text-xs font-medium transition"
          >
            + Пополнить
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Каталог */}
        {activeTab === 'catalog' && (
          <div>
            <div className="mb-4">
              <h1 className="text-xl font-semibold tracking-tight text-[#f5f0eb]">Капсула дня</h1>
              <p className="text-xs text-[#a89f98] mt-0.5">Эстетичные образы с обновлением каждые 24 часа</p>
            </div>

            {/* Ввод ссылки или артикула WB */}
            <form onSubmit={handleWbSubmit} className="mb-4 bg-[#1c1512] p-2.5 rounded-2xl border border-[#2e231e] flex gap-2 shadow-inner">
              <input
                type="text"
                value={wbInput}
                onChange={(e) => setWbInput(e.target.value)}
                placeholder="Ссылка или артикул WB..."
                className="flex-1 bg-transparent px-3 text-xs text-[#f5f0eb] placeholder-[#7d6f68] focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#d4b595] hover:bg-[#e0c4a4] text-[#14100e] text-xs font-semibold transition active:scale-95 shadow-sm"
              >
                Найти 🔍
              </button>
            </form>

            <div className="grid grid-cols-2 gap-3">
              {ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="group bg-[#1c1512] rounded-2xl p-2.5 border border-[#2e231e] flex flex-col justify-between hover:border-[#42332c] transition shadow-sm"
                >
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#14100e] mb-2.5">
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-95 group-hover:opacity-100"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1.5 left-1.5 bg-[#14100e]/75 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-medium text-[#f5f0eb] border border-[#2e231e]">
                      {item.price}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-[#dcd6d0] line-clamp-1">{item.name}</h3>
                    <button
                      onClick={() => {
                        haptic('selection_change');
                        setSelectedItem(item);
                        setUserPhoto(null);
                        setErrorMessage('');
                        setActiveTab('upload');
                      }}
                      className="w-full mt-2.5 py-2 rounded-xl bg-[#d4b595] hover:bg-[#e0c4a4] active:scale-[0.98] text-[#14100e] text-xs font-semibold tracking-wide shadow-sm transition"
                    >
                      Примерить ✨
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Блок приглашения */}
            <div className="mt-5 p-3.5 rounded-2xl bg-[#1c1512] border border-[#2e231e] flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-medium text-[#f5f0eb]">Нужно больше попыток?</div>
                <div className="text-[11px] text-[#a89f98]">Пригласите подругу и получите +3 примерки</div>
              </div>
              <button
                onClick={handleShare}
                className="px-3.5 py-2 bg-[#d4b595] hover:bg-[#e0c4a4] text-[#14100e] rounded-xl text-xs font-semibold active:scale-95 transition shadow-sm"
              >
                Поделиться
              </button>
            </div>
          </div>
        )}

        {/* Экран загрузки фото */}
        {activeTab === 'upload' && (
          <div className="py-2">
            <h2 className="text-lg font-semibold text-[#f5f0eb]">Ваше фото</h2>
            <p className="text-xs text-[#a89f98] mt-0.5 mb-4">
              Примеряем: <span className="text-[#d4b595] font-medium">{selectedItem?.name}</span>
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/*"
              className="hidden"
            />

            {!userPhoto ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[4/5] rounded-3xl border border-dashed border-[#3d2f28] hover:border-[#d4b595]/50 bg-[#1c1512]/60 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-full bg-[#241c18] flex items-center justify-center text-2xl mb-3 shadow-inner border border-[#332722]">
                  📸
                </div>
                <div className="text-sm font-semibold text-[#f5f0eb]">Загрузить фото из галереи</div>
                <div className="text-xs text-[#8c7f78] mt-1 max-w-[210px]">
                  Полноростовое или по пояс с хорошим освещением
                </div>
              </div>
            ) : (
              <div className="relative aspect-[4/5] w-full rounded-3xl overflow-hidden bg-[#1c1512] border border-[#2e231e] shadow-xl">
                <img src={userPhoto} alt="Вы" className="w-full h-full object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-[#14100e]/80 backdrop-blur-md text-[#f5f0eb] text-xs px-3 py-1.5 rounded-full border border-[#332722] active:scale-95 transition"
                >
                  Заменить фото
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
                {errorMessage}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  haptic('selection_change');
                  setActiveTab('catalog');
                }}
                className="w-1/3 py-3 rounded-2xl bg-[#1c1512] border border-[#2e231e] text-xs font-medium text-[#b5a49c] hover:bg-[#241c18] transition"
              >
                Отмена
              </button>
              <button
                onClick={runTryOn}
                disabled={!userPhoto}
                className="w-2/3 py-3 rounded-2xl bg-[#d4b595] hover:bg-[#e0c4a4] disabled:opacity-40 disabled:hover:bg-[#d4b595] text-xs font-semibold text-[#14100e] tracking-wide shadow-md transition active:scale-[0.98]"
              >
                Создать образ ✨
              </button>
            </div>
          </div>
        )}

        {/* Экран загрузки / ожидания */}
        {activeTab === 'loading' && (
          <div className="py-24 text-center flex flex-col items-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border border-[#d4b595]/20 animate-ping"></div>
              <div className="w-16 h-16 rounded-full border-2 border-[#d4b595] border-t-transparent animate-spin"></div>
            </div>
            <h3 className="font-semibold text-base text-[#f5f0eb]">ИИ создаёт образ...</h3>
            <p className="text-xs text-[#a89f98] mt-1 max-w-[220px]">
              Аккуратная посадка одежды по вашей фигуре (около 15 секунд)
            </p>
          </div>
        )}

        {/* Экран результата */}
        {activeTab === 'result' && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-[#f5f0eb]">Ваш новый образ ✨</h2>
                <p className="text-xs text-[#a89f98]">Примерка завершена успешно</p>
              </div>
            </div>

            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden bg-[#1c1512] border border-[#2e231e] shadow-xl mb-4">
              <img src={resultImage} alt="Результат" className="w-full h-full object-cover" />
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`https://www.wildberries.ru/catalog/${selectedItem?.wb}/detail.aspx`}
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic('medium')}
                className="w-full py-3.5 rounded-2xl bg-[#d4b595] hover:bg-[#e0c4a4] text-[#14100e] text-center text-xs font-semibold tracking-wide shadow-md transition active:scale-[0.98]"
              >
                Заказать на Wildberries 🛍️
              </a>

              <button
                onClick={() => {
                  haptic('selection_change');
                  setActiveTab('catalog');
                }}
                className="w-full py-3 rounded-2xl bg-[#1c1512] hover:bg-[#241c18] text-[#b5a49c] text-xs font-medium border border-[#2e231e] transition"
              >
                Примерить другой наряд
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
 
