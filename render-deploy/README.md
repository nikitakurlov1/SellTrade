# SellTrade - Render Deployment

Это папка для деплоя SellTrade на Render.com

## 🚀 Деплой на Render

### Настройки в Render:

1. **Build Command:**
   ```bash
   npm install
   ```

2. **Start Command:**
   ```bash
   npm start
   ```

3. **Root Directory:** `render-deploy`

4. **Environment Variables:**
   - `PORT` = 10000 (или любой другой порт)
   - `JWT_SECRET` = ваш-секретный-ключ

### Структура для деплоя:

```
render-deploy/
├── package.json          # Зависимости
├── server.js             # Основной сервер
├── database.js           # База данных
├── migrations.js         # Миграции
├── backup.js             # Резервное копирование
├── public/               # Статические файлы
│   ├── index.html
│   ├── birja/ro2rpj/    # Интерфейс биржи
│   ├── User.html         # CRM
│   └── coin.html         # Управление монетами
└── README.md            # Этот файл
```

### Автоматический деплой:

При изменении файлов в папке `render-deploy/` будет автоматически запускаться новый деплой.

### Локальное тестирование:

```bash
cd render-deploy
npm install
npm start
```

---

**SellTrade** - Криптобиржа на Render 🚀
