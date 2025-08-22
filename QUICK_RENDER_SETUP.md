# ⚡ Быстрый деплой SellTrade на Render

## 🎯 Настройки Render (5 минут)

### 1. Создайте Web Service
- Перейдите на [render.com](https://render.com)
- Нажмите "New +" → "Web Service"
- Подключите: `https://github.com/nikitakurlov1/SellTrade`

### 2. Ключевые настройки
```
Name: selltrade
Environment: Node
Branch: main
Root Directory: render-deploy  ← ВАЖНО!
Build Command: npm install
Start Command: npm start
```

### 3. Переменные окружения
```
PORT = 10000
JWT_SECRET = your-super-secret-key-here
NODE_ENV = production
```

### 4. Готово! 🚀
После деплоя получите URL: `https://selltrade.onrender.com`

---

## 📁 Структура деплоя

```
render-deploy/          ← Root Directory
├── package.json       # Зависимости
├── server.js          # Сервер
├── database.js        # База данных
├── public/            # Фронтенд
└── README.md          # Документация
```

## 🔄 Автообновление

- Изменения в `render-deploy/` → автоматический деплой
- Изменения в других папках → НЕ запускают деплой

---

**Подробная инструкция:** [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)
