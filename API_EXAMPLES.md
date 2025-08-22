# API Examples - SaleBit

Примеры использования API для интеграции с криптобиржей.

## 🔐 Аутентификация

### Регистрация пользователя

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ivan_petrov",
    "email": "ivan@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "message": "Аккаунт успешно создан",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1755800935210",
    "username": "ivan_petrov",
    "email": "ivan@example.com"
  }
}
```

### Вход пользователя

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "password123"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "message": "Вход выполнен успешно",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1755800935210",
    "username": "ivan_petrov",
    "email": "ivan@example.com"
  }
}
```

## 📊 Данные аккаунта

### Получение баланса

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/account
```

**Ответ:**
```json
{
  "success": true,
  "account": {
    "id": "1755800935210_acc",
    "userId": "1755800935210",
    "balance": {
      "USD": 0,
      "BTC": 0,
      "ETH": 0
    },
    "createdAt": "2025-08-21T18:28:55.210Z"
  }
}
```

## ✅ Валидация

### Проверка доступности username

```bash
curl http://localhost:3000/api/check-username/ivan_petrov
```

**Ответ:**
```json
{
  "success": true,
  "available": false
}
```

### Проверка доступности email

```bash
curl http://localhost:3000/api/check-email/ivan@example.com
```

**Ответ:**
```json
{
  "success": true,
  "available": false
}
```

## 🚨 Ошибки

### Ошибка валидации

```json
{
  "success": false,
  "errors": [
    "Имя должно содержать от 2 до 50 символов",
    "Email уже используется"
  ]
}
```

### Ошибка аутентификации

```json
{
  "success": false,
  "errors": [
    "Неверный email или пароль"
  ]
}
```

### Ошибка токена

```json
{
  "success": false,
  "errors": [
    "Недействительный токен"
  ]
}
```

## 📱 JavaScript Примеры

### Регистрация с fetch

```javascript
const registerUser = async (userData) => {
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Сохранить токен
      localStorage.setItem('authToken', result.token);
      return result.user;
    } else {
      throw new Error(result.errors.join(', '));
    }
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Использование
const userData = {
  username: 'ivan_petrov',
  email: 'ivan@example.com',
  password: 'password123',
  confirmPassword: 'password123'
};

registerUser(userData)
  .then(user => console.log('User registered:', user))
  .catch(error => console.error('Error:', error));
```

### Вход с fetch

```javascript
const loginUser = async (credentials) => {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('authToken', result.token);
      return result.user;
    } else {
      throw new Error(result.errors.join(', '));
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Использование
const credentials = {
  email: 'ivan@example.com',
  password: 'password123'
};

loginUser(credentials)
  .then(user => console.log('User logged in:', user))
  .catch(error => console.error('Error:', error));
```

### Получение данных аккаунта

```javascript
const getAccountData = async () => {
  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('No auth token');
    }
    
    const response = await fetch('/api/account', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      return result.account;
    } else {
      throw new Error(result.errors.join(', '));
    }
  } catch (error) {
    console.error('Account fetch error:', error);
    throw error;
  }
};

// Использование
getAccountData()
  .then(account => console.log('Account data:', account))
  .catch(error => console.error('Error:', error));
```

## 🔧 Настройки

### Переменные окружения

```env
PORT=3000
JWT_SECRET=your-secret-key-here
```

### Заголовки запросов

Все запросы должны содержать:
- `Content-Type: application/json` для POST запросов
- `Authorization: Bearer <token>` для защищенных endpoints

### Коды ответов

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Ошибка валидации
- `401` - Не авторизован
- `404` - Ресурс не найден
- `500` - Ошибка сервера

## 📝 Примечания

1. **Токены JWT** действительны 24 часа
2. **Пароли** хешируются с помощью bcrypt
3. **Валидация** происходит на клиенте и сервере
4. **Баланс** создается автоматически при регистрации
5. **Username и email** должны быть уникальными
