const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const path = require('path');
const backupManager = require('./backup');
const migrationManager = require('./migrations');


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (в реальном проекте используйте базу данных)
let users = [];
let accounts = [];
let coins = [];

// Simulation management
let activeSimulations = new Map(); // coinId -> simulation data
let simulationIntervals = new Map(); // coinId -> interval reference

// Popular coins for CoinGecko API
const popularCoins = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB' },
  { id: 'solana', symbol: 'sol', name: 'Solana' },
  { id: 'cardano', symbol: 'ada', name: 'Cardano' },
  { id: 'ripple', symbol: 'xrp', name: 'XRP' },
  { id: 'polkadot', symbol: 'dot', name: 'Polkadot' },
  { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
  { id: 'avalanche-2', symbol: 'avax', name: 'Avalanche' },
  { id: 'chainlink', symbol: 'link', name: 'Chainlink' },
  { id: 'polygon', symbol: 'matic', name: 'Polygon' },
  { id: 'uniswap', symbol: 'uni', name: 'Uniswap' },
  { id: 'litecoin', symbol: 'ltc', name: 'Litecoin' },
  { id: 'stellar', symbol: 'xlm', name: 'Stellar' },
  { id: 'cosmos', symbol: 'atom', name: 'Cosmos' },
  { id: 'monero', symbol: 'xmr', name: 'Monero' },
  { id: 'algorand', symbol: 'algo', name: 'Algorand' },
  { id: 'vechain', symbol: 'vet', name: 'VeChain' },
  { id: 'filecoin', symbol: 'fil', name: 'Filecoin' },
  { id: 'internet-computer', symbol: 'icp', name: 'Internet Computer' }
];

// Инициализация системы
const initializeSystem = async () => {
  try {
    // Создаем таблицы для логирования
    await db.createLoggingTables();
    
    // Инициализируем систему миграций
    await migrationManager.initialize();
    
    // Создаем базовые миграции
    await migrationManager.createInitialMigrations();
    
    // Применяем миграции
    await migrationManager.migrate();
    
    // Создаем админский аккаунт
    await createAdminAccount();
    
    // Запускаем первое резервное копирование
    await backupManager.createDatabaseBackup();
    
    console.log('System initialized successfully');
  } catch (error) {
    console.error('Error initializing system:', error);
  }
};

// Create admin account on server start
const createAdminAccount = async () => {
  try {
    const adminExists = await db.getUserByUsername('AdminNKcoin');
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Zxcv1236', 12);
      const adminUser = {
        id: 'admin_' + Date.now().toString(),
        username: 'AdminNKcoin',
        email: 'admin@salebit.com',
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };
      
      await db.createUser(adminUser);
      
      const adminAccount = {
        id: 'admin_' + Date.now().toString() + '_acc',
        userId: adminUser.id,
        balance: {
          USD: 0,
          BTC: 0,
          ETH: 0
        },
        createdAt: new Date().toISOString()
      };
      
      await db.createAccount(adminAccount);
      
      console.log('Admin account created: AdminNKcoin');
    }
  } catch (error) {
    console.error('Error creating admin account:', error);
  }
};

// Fetch coin prices from CoinGecko and save to database
const fetchCoinPrices = async () => {
  try {
    const coinIds = popularCoins.map(coin => coin.id).join(',');
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch coin prices');
    }
    
    const data = await response.json();
    
    // Update coins array and save to database
    const updatedCoins = [];
    
    for (const coin of popularCoins) {
      const coinData = data[coin.id];
      if (coinData) {
        // Check if coin is in simulation
        const isInSimulation = activeSimulations.has(coin.id);
        
        const coinInfo = {
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          price: coinData.usd || 0,
          priceChange: coinData.usd_24h_change || 0,
          marketCap: coinData.usd_market_cap || 0,
          volume: coinData.usd_24h_vol || 0,
          category: getCategoryBySymbol(coin.symbol),
          status: 'active',
          description: getDescriptionBySymbol(coin.symbol),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Only save to database if not in simulation
        if (!isInSimulation) {
          await db.saveCoin(coinInfo);
          
          // Save price history
          await db.savePriceHistory(coin.id, {
            price: coinInfo.price,
            priceChange: coinInfo.priceChange,
            marketCap: coinInfo.marketCap,
            volume: coinInfo.volume
          });
        } else {
          console.log(`Skipping price update for ${coin.id} - simulation active`);
        }
        
        updatedCoins.push(coinInfo);
      }
    }
    
    // Update in-memory array
    coins = updatedCoins;
    
    console.log(`Updated prices for ${coins.length} coins and saved to database at ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('Error fetching coin prices:', error);
  }
};

// Helper function to get category by symbol
const getCategoryBySymbol = (symbol) => {
  const categories = {
    'btc': 'infrastructure',
    'eth': 'infrastructure',
    'bnb': 'infrastructure',
    'sol': 'infrastructure',
    'ada': 'infrastructure',
    'xrp': 'infrastructure',
    'dot': 'infrastructure',
    'doge': 'meme',
    'avax': 'infrastructure',
    'link': 'defi',
    'matic': 'infrastructure',
    'uni': 'defi',
    'ltc': 'infrastructure',
    'xlm': 'infrastructure',
    'atom': 'infrastructure',
    'xmr': 'infrastructure',
    'algo': 'infrastructure',
    'vet': 'infrastructure',
    'fil': 'infrastructure',
    'icp': 'infrastructure'
  };
  return categories[symbol] || 'infrastructure';
};

// Helper function to get description by symbol
const getDescriptionBySymbol = (symbol) => {
  const descriptions = {
    'btc': 'Первая и самая популярная криптовалюта',
    'eth': 'Платформа для смарт-контрактов и dApps',
    'bnb': 'Нативная монета Binance Smart Chain',
    'sol': 'Быстрая блокчейн-платформа',
    'ada': 'Блокчейн-платформа с научным подходом',
    'xrp': 'Платформа для быстрых международных платежей',
    'dot': 'Мультичейн экосистема',
    'doge': 'Популярная мем-криптовалюта',
    'avax': 'Высокопроизводительная блокчейн-платформа',
    'link': 'Оракул для смарт-контрактов',
    'matic': 'Масштабируемое решение для Ethereum',
    'uni': 'Децентрализованная биржа',
    'ltc': 'Быстрая альтернатива Bitcoin',
    'xlm': 'Платформа для международных платежей',
    'atom': 'Интероперабельная блокчейн-сеть',
    'xmr': 'Приватная криптовалюта',
    'algo': 'Блокчейн с доказательством участия',
    'vet': 'Блокчейн для цепочек поставок',
    'fil': 'Децентрализованное хранилище',
    'icp': 'Интернет-компьютер блокчейн'
  };
  return descriptions[symbol] || 'Криптовалюта';
};

// Simulation functions
const startSimulation = async (coinId, targetPrice, durationMinutes) => {
  try {
    console.log('startSimulation called with:', { coinId, targetPrice, durationMinutes });
    
    // Get current coin data
    const coin = await db.getCoinById(coinId);
    if (!coin) {
      console.log('Coin not found in database:', coinId);
      throw new Error('Coin not found');
    }

    console.log('Current coin data:', coin);

    const startPrice = coin.price;
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    
    // Calculate price change per minute
    const totalPriceChange = targetPrice - startPrice;
    const priceChangePerMinute = totalPriceChange / durationMinutes;
    
    console.log('Price calculations:', {
      startPrice,
      targetPrice,
      totalPriceChange,
      priceChangePerMinute,
      durationMinutes
    });
    
    // Store simulation data
    const simulationData = {
      coinId,
      startPrice,
      targetPrice,
      startTime,
      endTime,
      priceChangePerMinute,
      isActive: true,
      phase: 'rising' // rising, falling, completed
    };
    
    activeSimulations.set(coinId, simulationData);
    console.log('Simulation data stored:', simulationData);
    
    // Start simulation interval (every 5 minutes)
    const interval = setInterval(async () => {
      console.log('Simulation interval triggered for:', coinId);
      await updateSimulationPrice(coinId);
    }, 5 * 60 * 1000); // 5 minutes
    
    simulationIntervals.set(coinId, interval);
    console.log('Simulation interval set for:', coinId);
    
    // Initial price update
    console.log('Performing initial price update for:', coinId);
    await updateSimulationPrice(coinId);
    
    console.log(`Simulation started for ${coinId}: ${startPrice} -> ${targetPrice} over ${durationMinutes} minutes`);
    
    return true;
  } catch (error) {
    console.error('Error starting simulation:', error);
    return false;
  }
};

const updateSimulationPrice = async (coinId) => {
  try {
    console.log('updateSimulationPrice called for:', coinId);
    
    const simulation = activeSimulations.get(coinId);
    if (!simulation || !simulation.isActive) {
      console.log('No active simulation found for:', coinId);
      return;
    }
    
    console.log('Current simulation data:', simulation);
    
    const now = Date.now();
    const elapsedMinutes = (now - simulation.startTime) / (60 * 1000);
    
    console.log('Time calculations:', { now, elapsedMinutes, phase: simulation.phase });
    
    let newPrice;
    
    if (simulation.phase === 'rising') {
      // Calculate price during rising phase
      newPrice = simulation.startPrice + (simulation.priceChangePerMinute * elapsedMinutes);
      
      console.log('Rising phase calculation:', {
        startPrice: simulation.startPrice,
        priceChangePerMinute: simulation.priceChangePerMinute,
        elapsedMinutes,
        newPrice
      });
      
      // Check if target reached
      if ((simulation.priceChangePerMinute > 0 && newPrice >= simulation.targetPrice) ||
          (simulation.priceChangePerMinute < 0 && newPrice <= simulation.targetPrice)) {
        
        newPrice = simulation.targetPrice;
        simulation.phase = 'falling';
        simulation.fallStartTime = now;
        simulation.fallStartPrice = simulation.targetPrice;
        
        console.log(`Target price reached for ${coinId}, starting fallback phase`);
      }
    } else if (simulation.phase === 'falling') {
      // Calculate price during falling phase (return to real API price)
      const fallElapsedMinutes = (now - simulation.fallStartTime) / (60 * 1000);
      const fallDuration = 30; // 30 minutes to return to real price
      
      console.log('Falling phase calculation:', {
        fallElapsedMinutes,
        fallDuration,
        fallStartPrice: simulation.fallStartPrice
      });
      
      if (fallElapsedMinutes >= fallDuration) {
        // Simulation completed, return to real API price
        console.log('Simulation completed, stopping for:', coinId);
        await stopSimulation(coinId);
        return;
      }
      
      // Linear interpolation back to real price
      const realPrice = await getRealPriceFromAPI(coinId);
      const fallProgress = fallElapsedMinutes / fallDuration;
      newPrice = simulation.fallStartPrice + (realPrice - simulation.fallStartPrice) * fallProgress;
      
      console.log('Falling interpolation:', {
        realPrice,
        fallProgress,
        newPrice
      });
    }
    
    console.log('Final new price:', newPrice);
    
    // Update coin price in database
    console.log('Updating coin in database:', coinId, newPrice);
    await db.updateCoin(coinId, {
      price: newPrice,
      updatedAt: new Date().toISOString()
    });
    
    // Save to price history
    console.log('Saving to price history:', coinId, newPrice);
    await db.savePriceHistory(coinId, {
      price: newPrice,
      priceChange: ((newPrice - simulation.startPrice) / simulation.startPrice) * 100,
      marketCap: 0, // Will be calculated based on new price
      volume: 0
    });
    
    console.log(`Simulation update for ${coinId}: $${newPrice.toFixed(6)}`);
    
  } catch (error) {
    console.error('Error updating simulation price:', error);
  }
};

const getRealPriceFromAPI = async (coinId) => {
  try {
    const coin = popularCoins.find(c => c.id === coinId);
    if (!coin) {
      throw new Error('Coin not found in popular coins list');
    }
    
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    const data = await response.json();
    
    return data[coinId]?.usd || 0;
  } catch (error) {
    console.error('Error fetching real price from API:', error);
    return 0;
  }
};

const stopSimulation = async (coinId) => {
  try {
    // Clear interval
    const interval = simulationIntervals.get(coinId);
    if (interval) {
      clearInterval(interval);
      simulationIntervals.delete(coinId);
    }
    
    // Remove simulation data
    activeSimulations.delete(coinId);
    
    // Get real price from API and update
    const realPrice = await getRealPriceFromAPI(coinId);
    if (realPrice > 0) {
      await db.updateCoin(coinId, {
        price: realPrice,
        updatedAt: new Date().toISOString()
      });
      
      await db.savePriceHistory(coinId, {
        price: realPrice,
        priceChange: 0,
        marketCap: 0,
        volume: 0
      });
    }
    
    console.log(`Simulation stopped for ${coinId}, returned to real price: $${realPrice}`);
    
  } catch (error) {
    console.error('Error stopping simulation:', error);
  }
};

// Validation middleware
const validateRegistration = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Имя пользователя должно содержать от 3 до 30 символов'),
  body('email').isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('password').notEmpty().withMessage('Введите пароль')
];

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/coin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coin.html'));
});

app.get('/crmcoindetal.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'crmcoindetal.html'));
});

// Registration endpoint
app.post('/api/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => err.msg) 
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUserByEmail = await db.getUserByEmail(email);
    const existingUserByUsername = await db.getUserByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      return res.status(400).json({
        success: false,
        errors: ['Пользователь с таким email или именем пользователя уже существует']
      });
    }

    // Prevent registration of admin username
    if (username === 'AdminNKcoin') {
      return res.status(400).json({
        success: false,
        errors: ['Это имя пользователя зарезервировано для администратора']
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      status: 'pending', // New users start with pending status
      createdAt: new Date().toISOString()
    };

    await db.createUser(newUser);
    
    console.log(`New user registered: ${newUser.username} (${newUser.email}) with status: ${newUser.status}`);

    // Create account for user
    const newAccount = {
      id: Date.now().toString() + '_acc',
      userId: newUser.id,
      balance: {
        USD: 0, // Starting balance
        BTC: 0,
        ETH: 0
      },
      createdAt: new Date().toISOString()
    };

    await db.createAccount(newAccount);

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Аккаунт успешно создан',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при регистрации']
    });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Allow login by email or username
    let user;
    if (email.includes('@')) {
      // Login by email
      user = await db.getUserByEmail(email);
    } else {
      // Login by username
      user = await db.getUserByUsername(email);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        errors: ['Неверный email/username или пароль']
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        errors: ['Неверный email/username или пароль']
      });
    }

    // Update last login time
    await db.updateUserLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при входе']
    });
  }
});

// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user || user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const users = await db.getAllUsers();
    const usersWithAccounts = [];

    for (const userData of users) {
      const account = await db.getAccountByUserId(userData.id);
      usersWithAccounts.push({
        ...userData,
        balance: account ? account.balance : { USD: 0, BTC: 0, ETH: 0 }
      });
    }

    console.log(`Retrieved ${usersWithAccounts.length} users from database`);

    res.json({
      success: true,
      users: usersWithAccounts
    });

  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении пользователей']
    });
  }
});

// Create new user (admin only)
app.post('/api/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminUser = await db.getUserByEmail(decoded.email);
    
    if (!adminUser || adminUser.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { username, email, password, status, notes } = req.body;

    // Check if user already exists
    const existingUserByEmail = await db.getUserByEmail(email);
    const existingUserByUsername = await db.getUserByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      return res.status(400).json({
        success: false,
        errors: ['Пользователь с таким email или именем пользователя уже существует']
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      status: status || 'pending',
      notes: notes || null,
      createdAt: new Date().toISOString()
    };

    await db.createUser(newUser);

    // Create account for user
    const newAccount = {
      id: Date.now().toString() + '_acc',
      userId: newUser.id,
      balance: {
        USD: 0, // Starting balance
        
      },
      createdAt: new Date().toISOString()
    };

    await db.createAccount(newAccount);

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно создан',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при создании пользователя']
    });
  }
});

// Update user (admin only)
app.put('/api/users/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminUser = await db.getUserByEmail(decoded.email);
    
    if (!adminUser || adminUser.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const userId = req.params.id;
    const { username, email, status, balance, notes } = req.body;

    // Check if target user exists
    const targetUser = await db.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    // Update user data
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length > 0) {
      await db.updateUser(userId, updates);
      console.log(`Updated user ${userId} with:`, updates);
    }

    // Update account balance if provided
    if (balance !== undefined) {
      const account = await db.getAccountByUserId(userId);
      if (account) {
        account.balance.USD = parseFloat(balance) || 0;
        await db.createAccount(account); // This will update the existing account
        console.log(`Updated balance for user ${userId} to: $${account.balance.USD}`);
      } else {
        // Create account if it doesn't exist
        const newAccount = {
          id: Date.now().toString() + '_acc',
          userId: userId,
          balance: {
            USD: parseFloat(balance) || 0,
            BTC: 0,
            ETH: 0
          },
          createdAt: new Date().toISOString()
        };
        await db.createAccount(newAccount);
        console.log(`Created new account for user ${userId} with balance: $${newAccount.balance.USD}`);
      }
    }

    res.json({
      success: true,
      message: 'Пользователь успешно обновлен'
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при обновлении пользователя']
    });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminUser = await db.getUserByEmail(decoded.email);
    
    if (!adminUser || adminUser.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const userId = req.params.id;

    // Prevent admin deletion
    const userToDelete = await db.getUserByEmail(decoded.email);
    if (userToDelete && userToDelete.username === 'AdminNKcoin') {
      return res.status(400).json({
        success: false,
        errors: ['Нельзя удалить администратора']
      });
    }

    await db.deleteUser(userId);

    res.json({
      success: true,
      message: 'Пользователь успешно удален'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при удалении пользователя']
    });
  }
});

// Get user account data
app.get('/api/account', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    // Check if user is active (admin can access regardless of status)
    if (user.username !== 'AdminNKcoin' && user.status !== 'active') {
      return res.status(403).json({
        success: false,
        errors: ['Ваш аккаунт не активен. Обратитесь к администратору.']
      });
    }

    const account = await db.getAccountByUserId(user.id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        errors: ['Аккаунт не найден']
      });
    }

    res.json({
      success: true,
      account
    });

  } catch (error) {
    console.error('Account fetch error:', error);
    res.status(401).json({
      success: false,
      errors: ['Недействительный токен']
    });
  }
});

// Check username availability
app.get('/api/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Admin username is always unavailable
    if (username === 'AdminNKcoin') {
      res.json({
        success: true,
        available: false
      });
      return;
    }
    
    const user = await db.getUserByUsername(username);
    res.json({
      success: true,
      available: !user
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при проверке имени пользователя']
    });
  }
});

// Check email availability
app.get('/api/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Admin email is always unavailable
    if (email === 'admin@salebit.com') {
      res.json({
        success: true,
        available: false
      });
      return;
    }
    
    const user = await db.getUserByEmail(email);
    res.json({
      success: true,
      available: !user
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при проверке email']
    });
  }
});

// Coins API endpoints
const validateCoin = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Название должно содержать от 2 до 100 символов'),
  body('symbol').trim().isLength({ min: 1, max: 10 }).withMessage('Символ должен содержать от 1 до 10 символов'),
  body('price').isFloat({ min: 0 }).withMessage('Цена должна быть положительным числом'),
  body('marketCap').isFloat({ min: 0 }).withMessage('Рыночная капитализация должна быть положительным числом'),
  body('volume').isFloat({ min: 0 }).withMessage('Объем должен быть положительным числом'),
  body('category').isIn(['defi', 'gaming', 'infrastructure', 'meme']).withMessage('Неверная категория'),
  body('status').isIn(['active', 'inactive', 'pending']).withMessage('Неверный статус')
];

// Get all coins
app.get('/api/coins', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get coins from database
    const dbCoins = await db.getAllCoins();
    
    // Update in-memory array
    coins = dbCoins;
    
    res.json({
      success: true,
      coins: dbCoins
    });

  } catch (error) {
    console.error('Get coins error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении монет']
    });
  }
});

// Get specific coin
app.get('/api/coins/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    const coin = await db.getCoinById(id);
    if (!coin) {
      return res.status(404).json({
        success: false,
        errors: ['Монета не найдена']
      });
    }

    res.json({
      success: true,
      coin: coin
    });

  } catch (error) {
    console.error('Get coin error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении монеты']
    });
  }
});

// Add new coin
app.post('/api/coins', validateCoin, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => err.msg) 
      });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, symbol, price, marketCap, volume, category, description, status } = req.body;

    // Check if coin with same symbol already exists
    const existingCoin = coins.find(coin => coin.symbol.toLowerCase() === symbol.toLowerCase());
    if (existingCoin) {
      return res.status(400).json({
        success: false,
        errors: ['Монета с таким символом уже существует']
      });
    }

    // Create new coin
    const newCoin = {
      id: Date.now().toString(),
      name,
      symbol: symbol.toUpperCase(),
      price: parseFloat(price),
      marketCap: parseFloat(marketCap),
      volume: parseFloat(volume),
      category,
      description: description || '',
      status,
      priceChange: (Math.random() - 0.5) * 20, // Random price change for demo
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    coins.push(newCoin);

    res.status(201).json({
      success: true,
      message: 'Монета успешно добавлена',
      coin: newCoin
    });

  } catch (error) {
    console.error('Add coin error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при добавлении монеты']
    });
  }
});

// Update coin
app.put('/api/coins/:id', validateCoin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => err.msg) 
      });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { name, symbol, category, description, status } = req.body;

    const existingCoin = await db.getCoinById(id);
    if (!existingCoin) {
      return res.status(404).json({
        success: false,
        errors: ['Монета не найдена']
      });
    }

    // Update coin in database
    const updates = {
      name,
      symbol: symbol.toUpperCase(),
      category,
      description: description || '',
      status,
      updatedAt: new Date().toISOString()
    };

    await db.updateCoin(id, updates);

    // Get updated coin
    const updatedCoin = await db.getCoinById(id);

    res.json({
      success: true,
      message: 'Монета успешно обновлена',
      coin: updatedCoin
    });

  } catch (error) {
    console.error('Update coin error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при обновлении монеты']
    });
  }
});

// Delete coin
app.delete('/api/coins/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    const existingCoin = await db.getCoinById(id);
    if (!existingCoin) {
      return res.status(404).json({
        success: false,
        errors: ['Монета не найдена']
      });
    }

    await db.deleteCoin(id);

    res.json({
      success: true,
      message: 'Монета успешно удалена'
    });

  } catch (error) {
    console.error('Delete coin error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при удалении монеты']
    });
  }
});

// Force update coin prices
app.post('/api/coins/update-prices', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    await fetchCoinPrices();

    res.json({
      success: true,
      message: 'Цены монет обновлены',
      coinsCount: coins.length
    });

  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при обновлении цен']
    });
  }
});

// Start simulation for a coin
app.post('/api/coins/:id/simulation', async (req, res) => {
  try {
    console.log('Simulation request received:', req.params, req.body);
    
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verified for user:', decoded);
    
    const { id } = req.params;
    const { targetPrice, timeMinutes } = req.body;

    console.log('Simulation parameters:', { id, targetPrice, timeMinutes });

    // Validate input
    if (!targetPrice || targetPrice <= 0) {
      console.log('Invalid target price:', targetPrice);
      return res.status(400).json({
        success: false,
        errors: ['Целевая цена должна быть больше 0']
      });
    }

    if (!timeMinutes || timeMinutes <= 0 || timeMinutes > 10080) {
      console.log('Invalid time minutes:', timeMinutes);
      return res.status(400).json({
        success: false,
        errors: ['Время должно быть от 1 до 10080 минут']
      });
    }

    // Check if coin exists
    console.log('Checking if coin exists:', id);
    const coin = await db.getCoinById(id);
    if (!coin) {
      console.log('Coin not found:', id);
      return res.status(404).json({
        success: false,
        errors: ['Монета не найдена']
      });
    }

    console.log('Coin found:', coin);

    // Check if simulation is already active
    if (activeSimulations.has(id)) {
      console.log('Simulation already active for:', id);
      return res.status(400).json({
        success: false,
        errors: ['Симуляция уже активна для этой монеты']
      });
    }

    // Start simulation
    console.log('Starting simulation for:', id);
    const success = await startSimulation(id, targetPrice, timeMinutes);
    
    if (success) {
      console.log('Simulation started successfully for:', id);
      res.json({
        success: true,
        message: 'Симуляция запущена',
        simulation: {
          coinId: id,
          targetPrice,
          durationMinutes: timeMinutes,
          startPrice: coin.price
        }
      });
    } else {
      console.log('Failed to start simulation for:', id);
      res.status(500).json({
        success: false,
        errors: ['Ошибка при запуске симуляции']
      });
    }

  } catch (error) {
    console.error('Start simulation error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при запуске симуляции: ' + error.message]
    });
  }
});

// Stop simulation for a coin
app.post('/api/coins/:id/simulation/stop', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    // Check if simulation is active
    if (!activeSimulations.has(id)) {
      return res.status(400).json({
        success: false,
        errors: ['Симуляция не активна для этой монеты']
      });
    }

    // Stop simulation
    await stopSimulation(id);

    res.json({
      success: true,
      message: 'Симуляция остановлена'
    });

  } catch (error) {
    console.error('Stop simulation error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при остановке симуляции']
    });
  }
});

// Get simulation status for a coin
app.get('/api/coins/:id/simulation', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    const simulation = activeSimulations.get(id);
    
    if (simulation) {
      res.json({
        success: true,
        simulation: {
          coinId: id,
          isActive: simulation.isActive,
          phase: simulation.phase,
          startPrice: simulation.startPrice,
          targetPrice: simulation.targetPrice,
          startTime: simulation.startTime,
          priceChangePerMinute: simulation.priceChangePerMinute
        }
      });
    } else {
      res.json({
        success: true,
        simulation: null
      });
    }

  } catch (error) {
    console.error('Get simulation status error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении статуса симуляции']
    });
  }
});

// Get price history for a coin
app.get('/api/coins/:id/price-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    // Check if coin exists
    const coin = await db.getCoinById(id);
    if (!coin) {
      return res.status(404).json({
        success: false,
        errors: ['Монета не найдена']
      });
    }

    let priceHistory;
    if (startDate && endDate) {
      priceHistory = await db.getPriceHistoryByDateRange(id, startDate, endDate);
    } else {
      priceHistory = await db.getPriceHistory(id, parseInt(limit));
    }

    // Если нет данных в базе, генерируем тестовые данные
    if (!priceHistory || priceHistory.length === 0) {
      priceHistory = generateTestPriceHistory(coin, parseInt(limit), startDate, endDate);
    }

    res.json({
      success: true,
      coin: coin,
      priceHistory: priceHistory
    });

  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении истории цен']
    });
  }
});

// Функция для генерации тестовых данных истории цен
function generateTestPriceHistory(coin, limit, startDate, endDate) {
  const history = [];
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 часа назад
  const end = endDate ? new Date(endDate) : now;
  
  const timeStep = (end.getTime() - start.getTime()) / limit;
  let basePrice = coin.price;
  
  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(start.getTime() + i * timeStep);
    
    // Генерируем реалистичные изменения цены
    const changePercent = (Math.random() - 0.5) * 0.02; // ±1% изменение
    basePrice = basePrice * (1 + changePercent);
    
    // Добавляем тренд
    const trend = Math.sin(i / 10) * 0.005; // Синусоидальный тренд
    basePrice = basePrice * (1 + trend);
    
    const priceChange = (Math.random() - 0.5) * 0.1; // ±5% изменение за 24ч
    const volume = coin.volume * (0.8 + Math.random() * 0.4); // Объем с вариацией
    const marketCap = basePrice * (coin.marketCap / coin.price); // Пропорциональная капитализация
    
    history.push({
      id: `ph_${coin.id}_${i}`,
      coinId: coin.id,
      price: Math.max(0.01, basePrice), // Минимальная цена $0.01
      priceChange: priceChange,
      marketCap: marketCap,
      volume: volume,
      timestamp: timestamp.toISOString()
    });
  }
  
  return history;
}

// ===== EXCHANGE API ENDPOINTS =====

// Get user balance for exchange
app.get('/api/exchange/balance', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    let account = await db.getAccountByUserId(user.id);
    
    // Если аккаунт не существует, создаем его
    if (!account) {
      console.log(`Creating account for user: ${user.id}`);
      const newAccount = {
        id: Date.now().toString() + '_acc',
        userId: user.id,
        balance: {
          USD: 10000, // Начальный баланс для демонстрации
          BTC: 0,
          ETH: 0
        },
        createdAt: new Date().toISOString()
      };
      await db.createAccount(newAccount);
      account = newAccount;
    }

    res.json({
      success: true,
      balance: account.balance
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении баланса']
    });
  }
});

// Update user balance (for admin)
app.put('/api/exchange/balance/:userId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const adminUser = await db.getUserByEmail(decoded.email);
    
    if (!adminUser || adminUser.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const userId = req.params.userId;
    const { balance } = req.body;

    const account = await db.getAccountByUserId(userId);
    if (account) {
      account.balance = balance;
      await db.createAccount(account);
    } else {
      const newAccount = {
        id: Date.now().toString() + '_acc',
        userId: userId,
        balance: balance,
        createdAt: new Date().toISOString()
      };
      await db.createAccount(newAccount);
    }

    res.json({
      success: true,
      message: 'Баланс обновлен'
    });

  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при обновлении баланса']
    });
  }
});

// Sync portfolio with balance
app.post('/api/exchange/sync-portfolio', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    // Get user account
    const account = await db.getAccountByUserId(user.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        errors: ['Аккаунт не найден']
      });
    }

    // Get current portfolio
    let portfolio = await db.getUserPortfolio(user.id) || {
      assets: {},
      totalValue: 0,
      totalInvested: 0,
      totalProfit: 0,
      profitPercent: 0
    };

    // Sync portfolio with balance
    for (const [symbol, amount] of Object.entries(account.balance)) {
      if (symbol !== 'USD' && amount > 0) {
        if (!portfolio.assets[symbol]) {
          portfolio.assets[symbol] = {
            amount: amount,
            averagePrice: 0,
            totalInvested: 0
          };
        } else {
          portfolio.assets[symbol].amount = amount;
        }
      }
    }

    // Remove assets that are not in balance
    for (const [symbol, assetData] of Object.entries(portfolio.assets)) {
      const balanceAmount = account.balance[symbol] || 0;
      if (balanceAmount <= 0) {
        delete portfolio.assets[symbol];
      }
    }

    // Update portfolio with current prices
    portfolio = await calculateCurrentPortfolioValues(portfolio);

    // Save updated portfolio
    await db.saveUserPortfolio(user.id, portfolio);

    res.json({
      success: true,
      portfolio: portfolio,
      message: 'Портфель синхронизирован с балансом'
    });

  } catch (error) {
    console.error('Sync portfolio error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при синхронизации портфеля']
    });
  }
});

// Get user portfolio
app.get('/api/exchange/portfolio', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    // Get user's portfolio from database
    let portfolio = await db.getUserPortfolio(user.id) || {
      assets: {},
      totalValue: 0,
      totalInvested: 0,
      totalProfit: 0,
      profitPercent: 0
    };

    // Get user account to check balance
    const account = await db.getAccountByUserId(user.id);
    if (account && account.balance) {
      // Add balance assets to portfolio if they exist
      for (const [symbol, amount] of Object.entries(account.balance)) {
        if (symbol !== 'USD' && amount > 0) {
          if (!portfolio.assets[symbol]) {
            portfolio.assets[symbol] = {
              amount: amount,
              averagePrice: 0,
              totalInvested: 0
            };
          } else {
            portfolio.assets[symbol].amount = amount;
          }
        }
      }
    }

    // Update portfolio with current prices and calculate real-time values
    portfolio = await calculateCurrentPortfolioValues(portfolio);

    console.log('Portfolio for user:', user.id, 'Portfolio:', JSON.stringify(portfolio, null, 2));

    res.json({
      success: true,
      portfolio: portfolio
    });

  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении портфеля']
    });
  }
});

// Buy asset
app.post('/api/exchange/buy', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    const { assetId, usdAmount } = req.body;

    if (!assetId || !usdAmount || usdAmount < 1) {
      return res.status(400).json({
        success: false,
        errors: ['Неверные параметры транзакции']
      });
    }

    // Get current asset price
    const asset = await db.getCoinById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        errors: ['Актив не найден']
      });
    }

    // Get user account
    let account = await db.getAccountByUserId(user.id);
    if (!account) {
      // Создаем аккаунт, если его нет
      console.log(`Creating account for user: ${user.id}`);
      const newAccount = {
        id: Date.now().toString() + '_acc',
        userId: user.id,
        balance: {
          USD: 10000, // Начальный баланс для демонстрации
          BTC: 0,
          ETH: 0
        },
        createdAt: new Date().toISOString()
      };
      await db.createAccount(newAccount);
      account = newAccount;
    }

    const commission = usdAmount * 0.0025; // 0.25% commission
    const totalCost = usdAmount + commission;

    if (account.balance.USD < totalCost) {
      return res.status(400).json({
        success: false,
        errors: ['Недостаточно средств']
      });
    }

    const cryptoAmount = (usdAmount - commission) / asset.price;

    // Update balance
    account.balance.USD -= totalCost;
    account.balance[asset.symbol.toUpperCase()] = (account.balance[asset.symbol.toUpperCase()] || 0) + cryptoAmount;
    
    console.log(`Buy transaction: User ${user.id} bought ${cryptoAmount} ${asset.symbol} for $${usdAmount}`);
    console.log(`New balance: USD: $${account.balance.USD}, ${asset.symbol}: ${account.balance[asset.symbol.toUpperCase()]}`);
    
    await db.createAccount(account);

    // Create transaction record
    const transaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      type: 'buy',
      assetId: assetId,
      amount: cryptoAmount,
      price: asset.price,
      usdAmount: usdAmount,
      commission: commission,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };

    await db.createTransaction(transaction);
    console.log(`Transaction created: ${transaction.id}`);

    // Update portfolio with new purchase
    await updateUserPortfolio(user.id, assetId, cryptoAmount, asset.price, 'buy');
    console.log(`Portfolio updated for user: ${user.id}`);

    res.json({
      success: true,
      transaction: transaction,
      newBalance: account.balance
    });

  } catch (error) {
    console.error('Buy asset error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при покупке актива']
    });
  }
});

// Sell asset
app.post('/api/exchange/sell', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    const { assetId, cryptoAmount } = req.body;

    if (!assetId || !cryptoAmount || cryptoAmount <= 0) {
      return res.status(400).json({
        success: false,
        errors: ['Неверные параметры транзакции']
      });
    }

    // Get current asset price
    const asset = await db.getCoinById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        errors: ['Актив не найден']
      });
    }

    // Get user account
    let account = await db.getAccountByUserId(user.id);
    if (!account) {
      // Создаем аккаунт, если его нет
      console.log(`Creating account for user: ${user.id}`);
      const newAccount = {
        id: Date.now().toString() + '_acc',
        userId: user.id,
        balance: {
          USD: 10000, // Начальный баланс для демонстрации
          BTC: 0,
          ETH: 0
        },
        createdAt: new Date().toISOString()
      };
      await db.createAccount(newAccount);
      account = newAccount;
    }

    const currentBalance = account.balance[asset.symbol.toUpperCase()] || 0;
    if (currentBalance < cryptoAmount) {
      return res.status(400).json({
        success: false,
        errors: ['Недостаточно активов для продажи']
      });
    }

    const usdValue = cryptoAmount * asset.price;
    const commission = usdValue * 0.0025; // 0.25% commission
    const netUsdValue = usdValue - commission;

    // Update balance
    account.balance.USD += netUsdValue;
    account.balance[asset.symbol.toUpperCase()] = currentBalance - cryptoAmount;
    
    console.log(`Sell transaction: User ${user.id} sold ${cryptoAmount} ${asset.symbol} for $${netUsdValue}`);
    console.log(`New balance: USD: $${account.balance.USD}, ${asset.symbol}: ${account.balance[asset.symbol.toUpperCase()]}`);
    
    await db.createAccount(account);

    // Create transaction record
    const transaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      type: 'sell',
      assetId: assetId,
      amount: cryptoAmount,
      price: asset.price,
      usdAmount: usdValue,
      commission: commission,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };

    await db.createTransaction(transaction);
    console.log(`Transaction created: ${transaction.id}`);

    // Update portfolio with sale and calculate profit/loss
    await updateUserPortfolio(user.id, assetId, cryptoAmount, asset.price, 'sell');
    console.log(`Portfolio updated for user: ${user.id}`);

    res.json({
      success: true,
      transaction: transaction,
      newBalance: account.balance
    });

  } catch (error) {
    console.error('Sell asset error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при продаже актива']
    });
  }
});

// Test API to check if everything is working
app.get('/api/test/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    // Get user account
    const account = await db.getAccountByUserId(user.id);
    
    // Get user portfolio
    const portfolio = await db.getUserPortfolio(user.id);
    
    // Get user transactions
    const transactions = await db.getUserTransactions(user.id, 10);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      account: account,
      portfolio: portfolio,
      transactions: transactions
    });

  } catch (error) {
    console.error('Test status error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении статуса']
    });
  }
});

// Get user transactions
app.get('/api/exchange/transactions', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    const { limit = 50 } = req.query;
    const transactions = await db.getUserTransactions(user.id, parseInt(limit));

    res.json({
      success: true,
      transactions: transactions
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении транзакций']
    });
  }
});

// Get user profile
app.get('/api/users/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при получении профиля']
    });
  }
});

// Update user profile
app.put('/api/users/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        errors: ['Токен не предоставлен']
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        errors: ['Пользователь не найден']
      });
    }

    const { username, email } = req.body;
    const updates = {};
    
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;

    if (Object.keys(updates).length > 0) {
      await db.updateUser(user.id, updates);
    }

    res.json({
      success: true,
      message: 'Профиль обновлен'
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка сервера при обновлении профиля']
    });
  }
});

const server = app.listen(PORT, async () => {
  try {
    // Initialize database and system
    await db.initializeDatabase();
    await initializeSystem();
    console.log('Database and system initialized successfully');
    
    // Initial coin prices fetch
    await fetchCoinPrices();
    
    // Update prices every 5 minutes
    setInterval(fetchCoinPrices, 5 * 60 * 1000);
    
    // Cleanup old price history every day
    setInterval(async () => {
      try {
        await db.cleanupOldPriceHistory();
      } catch (error) {
        console.error('Error cleaning up old price history:', error);
      }
    }, 24 * 60 * 60 * 1000);
    
    // Start scheduled backups (every 6 hours)
    setInterval(() => backupManager.scheduleBackup(), 6 * 60 * 60 * 1000);
    
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
    console.log('Coin prices will be updated every 5 minutes');
    console.log('Price history will be cleaned up daily');
    console.log('Backups will be created every 6 hours');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});

// Function to calculate current portfolio values with real-time prices
async function calculateCurrentPortfolioValues(portfolio) {
  try {
    let totalValue = 0;
    let totalInvested = 0;
    
    // Get all coins to match with portfolio assets
    const allCoins = await db.getAllCoins();
    const coinsMap = {};
    allCoins.forEach(coin => {
      coinsMap[coin.symbol.toUpperCase()] = coin;
    });
    
    // Calculate current values for each asset
    for (const [symbol, assetData] of Object.entries(portfolio.assets)) {
      const coin = coinsMap[symbol];
      if (coin) {
        const currentValue = assetData.amount * coin.price;
        totalValue += currentValue;
        totalInvested += assetData.totalInvested;
        
        // Update asset data with current price info
        portfolio.assets[symbol] = {
          ...assetData,
          currentPrice: coin.price,
          currentValue: currentValue,
          profitLoss: currentValue - assetData.totalInvested,
          profitLossPercent: assetData.totalInvested > 0 ? 
            ((currentValue - assetData.totalInvested) / assetData.totalInvested) * 100 : 0
        };
      }
    }
    
    portfolio.totalValue = totalValue;
    portfolio.totalInvested = totalInvested;
    portfolio.totalProfit = totalValue - totalInvested;
    portfolio.profitPercent = totalInvested > 0 ? (portfolio.totalProfit / totalInvested) * 100 : 0;
    
    return portfolio;
  } catch (error) {
    console.error('Error calculating portfolio values:', error);
    return portfolio;
  }
}

// Function to update user portfolio
async function updateUserPortfolio(userId, assetId, amount, price, type) {
  try {
    // Get current portfolio
    let portfolio = await db.getUserPortfolio(userId);
    if (!portfolio) {
      portfolio = {
        assets: {},
        totalValue: 0,
        totalInvested: 0,
        totalProfit: 0,
        profitPercent: 0
      };
    }

    // Get asset info
    const asset = await db.getCoinById(assetId);
    if (!asset) return;

    const assetSymbol = asset.symbol.toUpperCase();
    
    if (type === 'buy') {
      // Add to portfolio
      if (!portfolio.assets[assetSymbol]) {
        portfolio.assets[assetSymbol] = {
          amount: 0,
          averagePrice: 0,
          totalInvested: 0
        };
      }
      
      const currentAmount = portfolio.assets[assetSymbol].amount;
      const currentInvested = portfolio.assets[assetSymbol].totalInvested;
      const newAmount = currentAmount + amount;
      const newInvested = currentInvested + (amount * price);
      
      portfolio.assets[assetSymbol] = {
        amount: newAmount,
        averagePrice: newInvested / newAmount,
        totalInvested: newInvested
      };
      
    } else if (type === 'sell') {
      // Remove from portfolio and calculate profit/loss
      if (portfolio.assets[assetSymbol]) {
        const currentAmount = portfolio.assets[assetSymbol].amount;
        const averagePrice = portfolio.assets[assetSymbol].averagePrice;
        const soldAmount = amount;
        const remainingAmount = currentAmount - soldAmount;
        
        // Calculate profit/loss for sold amount
        const profitPerUnit = price - averagePrice;
        const totalProfit = profitPerUnit * soldAmount;
        
        // Update portfolio
        if (remainingAmount > 0) {
          portfolio.assets[assetSymbol] = {
            amount: remainingAmount,
            averagePrice: averagePrice,
            totalInvested: remainingAmount * averagePrice
          };
        } else {
          delete portfolio.assets[assetSymbol];
        }
        
        // Update total profit
        portfolio.totalProfit += totalProfit;
      }
    }
    
    // Recalculate portfolio totals
    let totalValue = 0;
    let totalInvested = 0;
    
    // Get all coins to match with portfolio assets
    const allCoins = await db.getAllCoins();
    const coinsMap = {};
    allCoins.forEach(coin => {
      coinsMap[coin.symbol.toUpperCase()] = coin;
    });
    
    for (const [symbol, assetData] of Object.entries(portfolio.assets)) {
      const currentAsset = coinsMap[symbol];
      if (currentAsset) {
        const currentValue = assetData.amount * currentAsset.price;
        totalValue += currentValue;
        totalInvested += assetData.totalInvested;
      }
    }
    
    portfolio.totalValue = totalValue;
    portfolio.totalInvested = totalInvested;
    portfolio.profitPercent = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
    
    // Save updated portfolio
    await db.saveUserPortfolio(userId, portfolio);
    console.log(`Portfolio saved for user ${userId}: Total Value: $${portfolio.totalValue}, Total Invested: $${portfolio.totalInvested}, Profit: $${portfolio.totalProfit}`);
    
  } catch (error) {
    console.error('Error updating portfolio:', error);
  }
}

// ==================== LOGGING AND AUDIT API ====================

// Get operation logs (admin only)
app.get('/api/logs/operations', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { userId, limit = 100, offset = 0 } = req.query;
    const logs = await db.getOperationLogs(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error getting operation logs:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка получения логов операций']
    });
  }
});

// Get user audit logs (admin only)
app.get('/api/logs/audit', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { userId, limit = 100, offset = 0 } = req.query;
    const logs = await db.getUserAuditLogs(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка получения логов аудита']
    });
  }
});

// ==================== BACKUP API ====================

// Create backup (admin only)
app.post('/api/backup/create', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { type = 'database' } = req.body;
    let result;

    if (type === 'full') {
      result = await backupManager.createFullBackup();
    } else {
      result = await backupManager.createDatabaseBackup();
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'Резервная копия создана успешно',
        backup: result
      });
    } else {
      res.status(500).json({
        success: false,
        errors: [result.error]
      });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка создания резервной копии']
    });
  }
});

// Get backup list (admin only)
app.get('/api/backup/list', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const backups = await backupManager.getBackupList();
    
    res.json({
      success: true,
      backups
    });
  } catch (error) {
    console.error('Error getting backup list:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка получения списка резервных копий']
    });
  }
});

// Restore from backup (admin only)
app.post('/api/backup/restore', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { backupPath } = req.body;
    const result = await backupManager.restoreFromBackup(backupPath);

    if (result.success) {
      res.json({
        success: true,
        message: 'Восстановление выполнено успешно'
      });
    } else {
      res.status(500).json({
        success: false,
        errors: [result.error]
      });
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка восстановления из резервной копии']
    });
  }
});

// ==================== MIGRATIONS API ====================

// Get migration status (admin only)
app.get('/api/migrations/status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const status = await migrationManager.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка получения статуса миграций']
    });
  }
});

// Run migrations (admin only)
app.post('/api/migrations/run', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const result = await migrationManager.migrate();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Применено ${result.applied} миграций`,
        applied: result.applied
      });
    } else {
      res.status(500).json({
        success: false,
        errors: [result.error]
      });
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка выполнения миграций']
    });
  }
});

// ==================== DEPOSIT AND WITHDRAWAL API ====================

// Get requisites (admin only)
app.get('/api/admin/requisites', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    // Get requisites from database or use defaults
    const requisites = {
      card_number: '1234 5678 9012 3456',
      bank_details: 'Банк: Сбербанк\nСчет: 12345678901234567890\nБИК: 044525225\nИНН: 1234567890',
      crypto_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      qiwi_number: '+7 900 123-45-67'
    };

    res.json({
      success: true,
      requisites
    });
  } catch (error) {
    console.error('Error getting requisites:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка получения реквизитов']
    });
  }
});

// Update requisites (admin only)
app.post('/api/admin/requisites', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db.getUserById(req.user.id);
    if (user.username !== 'AdminNKcoin') {
      return res.status(403).json({
        success: false,
        errors: ['Доступ запрещен']
      });
    }

    const { requisites } = req.body;

    // Here you would save requisites to database
    // For now, we'll just log the operation
    await db.logOperation(req.user.id, 'requisites_updated', {
      requisites: requisites
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Реквизиты обновлены'
    });
  } catch (error) {
    console.error('Error updating requisites:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка обновления реквизитов']
    });
  }
});

// Create deposit request
app.post('/api/deposit/create', authenticateToken, async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        errors: ['Некорректная сумма']
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        errors: ['Не выбран способ оплаты']
      });
    }

    // Create deposit request in database
    const requestId = 'DEP_' + Date.now().toString();
    
    // Log the operation
    await db.logOperation(req.user.id, 'deposit_request_created', {
      amount: amount,
      paymentMethod: paymentMethod,
      requestId: requestId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Запрос на пополнение создан',
      requestId: requestId
    });
  } catch (error) {
    console.error('Error creating deposit request:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка создания запроса на пополнение']
    });
  }
});

// Create withdrawal request
app.post('/api/withdraw/create', authenticateToken, async (req, res) => {
  try {
    const { amount, method, ...withdrawalDetails } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        errors: ['Некорректная сумма']
      });
    }

    if (!method) {
      return res.status(400).json({
        success: false,
        errors: ['Не выбран способ вывода']
      });
    }

    // Check user balance
    const balance = await db.getUserBalance(req.user.id);
    if (amount > balance.USD) {
      return res.status(400).json({
        success: false,
        errors: ['Недостаточно средств']
      });
    }

    // Create withdrawal request in database
    const requestId = 'WIT_' + Date.now().toString();
    
    // Log the operation
    await db.logOperation(req.user.id, 'withdrawal_request_created', {
      amount: amount,
      method: method,
      withdrawalDetails: withdrawalDetails,
      requestId: requestId
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Запрос на вывод создан',
      requestId: requestId
    });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({
      success: false,
      errors: ['Ошибка создания запроса на вывод']
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  server.close(async () => {
    try {
      await db.closeDatabase();
      console.log('Server shut down gracefully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});
