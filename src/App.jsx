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
  
  const fileInputRef = useRef(null);

  // Каталог нарядов
  const ITEMS = [
    { 
      id: '1', 
      name: 'Розовое худи Coquette', 
      price: '2 490 ₽', 
      url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80', 
      wb: '12345678' 
    },
    { 
      id: '2', 
      name: 'Топ корсетный бежевый', 
      price: '1 290 ₽', 
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80', 
      wb: '87654321' 
    },
    { 
      id: '3', 
      name: 'Шёлковое вечернее платье', 
      price: '4 890 ₽', 
      url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80', 
      wb: '99887766' 
    },
    { 
      id: '4', 
      name: 'Оверсайз пиджак Charcoal', 
      price: '3 750 ₽', 
      url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80', 
      wb: '55443322' 
    }
  ];

  const BACKEND_URL = "https://girls-founds.onrender.com";
  const BOT_USERNAME = "GFstyleroom_bot";

  // Виброотклик Telegram
  const haptic = (type = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
    } catch (_) {}
  };

  // Авторизация и интеграция с Telegram WebApp
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();

      // Управление нативной кнопкой «Назад»
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

  // Обработка загрузки фото из галереи со сжатием
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setUserPhoto(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Запуск примерки
  const runTryOn = async () => {
    if (!userPhoto || !selectedItem) return;
    haptic('heavy');
    setErrorMessage('');
    setActiveTab('loading');

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

  // Покупка попыток
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

  // Приглашение подруги
  const handleShare = () => {
    haptic('light');
    const refLink = `https://t.me/${BOT_USERNAME}/app?startapp=ref_${user.tg_id}`;
    const text = "Примерь эти стильные образы на себе через нейросеть ✨:";
    window.Telegram?.WebApp?.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`
    );
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-zinc-100 font-sans selection:bg-pink-500 selection:text-white pb-10">
      {/* Верхняя плашка профиля */}
      <header className="sticky top-0 z-30 bg-[#0f0f11]/80 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {activeTab !== 'catalog' ? (
            <button
              onClick={() => {
                haptic('selection_change');
                setActiveTab('catalog');
              }}
              className="p-1.5 -ml-1 text-zinc-400 hover:text-white transition flex items-center gap-1 text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Назад</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                {user.first_name?.[0] || 'U'}
              </div>
              <span className="font-semibold text-sm tracking-tight">{user.first_name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-pink-400 flex items-center gap-1">
            <span>✨</span>
            <span>{user.balance ?? 0}</span>
          </div>
          <button
            onClick={handleBuy}
            className="px-2.5 py-1 rounded-full bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-xs font-medium transition"
          >
            + Пополнить
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Экран каталога */}
        {activeTab === 'catalog' && (
          <div>
            <div className="mb-4">
              <h1 className="text-xl font-bold tracking-tight">Гардероб</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Выберите вещь, чтобы примерить её на своё фото</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="group bg-zinc-900/60 rounded-2xl p-2.5 border border-zinc-800/70 flex flex-col justify-between hover:border-zinc-700 transition"
                >
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-zinc-800 mb-2.5">
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-semibold text-white">
                      {item.price}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-zinc-200 line-clamp-1">{item.name}</h3>
                    <button
                      onClick={() => {
                        haptic('selection_change');
                        setSelectedItem(item);
                        setUserPhoto(null);
                        setErrorMessage('');
                        setActiveTab('upload');
                      }}
                      className="w-full mt-2.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-[0.98] text-white text-xs font-semibold tracking-wide shadow-sm transition"
                    >
                      Примерить ✨
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Реферальный блок */}
            <div className="mt-5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-pink-500/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Нужно больше попыток?</div>
                <div className="text-[11px] text-zinc-400">Пригласи подругу и получи +3 примерки</div>
              </div>
              <button
                onClick={handleShare}
                className="px-3 py-1.5 bg-white text-zinc-950 rounded-xl text-xs font-semibold active:scale-95 transition"
              >
                Поделиться
              </button>
            </div>
          </div>
        )}

        {/* Экран загрузки фото пользователя */}
        {activeTab === 'upload' && (
          <div className="py-2">
            <h2 className="text-lg font-bold">Ваше фото</h2>
            <p className="text-xs text-zinc-400 mt-0.5 mb-4">
              Примеряем: <span className="text-pink-400 font-medium">{selectedItem?.name}</span>
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
                className="w-full aspect-[4/5] rounded-3xl border-2 border-dashed border-zinc-800 hover:border-pink-500/50 bg-zinc-900/40 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  📸
                </div>
                <div className="text-sm font-semibold text-zinc-200">Загрузить фото из галереи</div>
                <div className="text-xs text-zinc-500 mt-1 max-w-[200px]">
                  Лучше всего подойдёт фото в полный рост или по пояс с хорошим светом
                </div>
              </div>
            ) : (
              <div className="relative aspect-[4/5] w-full rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-lg">
                <img src={userPhoto} alt="Вы" className="w-full h-full object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/10 active:scale-95 transition"
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
                className="w-1/3 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
              >
                Отмена
              </button>
              <button
                onClick={runTryOn}
                disabled={!userPhoto}
                className="w-2/3 py-3 rounded-2xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:hover:bg-pink-600 text-xs font-semibold text-white tracking-wide shadow-md transition active:scale-[0.98]"
              >
                Создать образ 🪄
              </button>
            </div>
          </div>
        )}

        {/* Экран ожидания примерки */}
        {activeTab === 'loading' && (
          <div className="py-24 text-center flex flex-col items-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-pink-500/20 animate-ping"></div>
              <div className="w-16 h-16 rounded-full border-2 border-pink-500 border-t-transparent animate-spin"></div>
            </div>
            <h3 className="font-bold text-base text-zinc-100">ИИ примеряет наряд...</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-[220px]">
              Нейросеть подгоняет размер и ткань под вашу фигуру (около 15 секунд)
            </p>
          </div>
        )}

        {/* Экран готового результата */}
        {activeTab === 'result' && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">Ваш новый образ ✨</h2>
                <p className="text-xs text-zinc-400">Нейросеть завершила примерку</p>
              </div>
            </div>

            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-xl mb-4">
              <img src={resultImage} alt="Результат" className="w-full h-full object-cover" />
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`https://www.wildberries.ru/catalog/${selectedItem?.wb}/detail.aspx`}
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic('medium')}
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-center text-xs font-semibold tracking-wide shadow-md transition active:scale-[0.98]"
              >
                Заказать на Wildberries 🛍️
              </a>

              <button
                onClick={() => {
                  haptic('selection_change');
                  setActiveTab('catalog');
                }}
                className="w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition"
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

    

 
