// Creziax Portal Backend - v9.0-ABSOLUTE-PRIVACY (GROUP/DM Strict Routing)
// Environment variables MUST be loaded before any other imports that depend on them
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const cron = require('node-cron');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const prisma = require('./prismaClient');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'https://creziax-portal.vercel.app',
  'https://portal.creziax.cloud',
  'http://portal.creziax.cloud',
  'https://api.creziax.cloud',
  'http://api.creziax.cloud',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://localhost:5000',
  'http://72.62.35.136:5173',
  'http://72.62.35.136:5000',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- PRIORITIZED STATIC ASSET SERVING ---
// Add /api/storage alias for robustness with some frontend constructions
const storagePath = path.join(__dirname, 'storage');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}
app.use('/storage', express.static(storagePath));
app.use('/api/storage', express.static(storagePath));

app.use('/assets', (req, res, next) => {
  console.log(`[ASSET REQUEST] ${req.path}`);
  next();
}, express.static(path.join(__dirname, 'public', 'assets'), {
  maxAge: '1y',
  immutable: true,
  fallthrough: true
}));

// Fallbacks for unusual server structures
app.use('/assets', express.static(path.join(__dirname, '../frontend/dist/assets')));
app.use('/assets', express.static(path.join(__dirname, '../dist/assets')));

// Static public folder (index.html, logo, icons)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false // We handle index.html manually at the bottom for SPA
}));
// --- END STATIC SERVING ---

// Uploads are now handled in the prioritized section above

// Health check (kept for verification with diagnostics)
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Diagnostics
    const publicPath = path.join(__dirname, 'public');
    const assetsPath = path.join(__dirname, 'public', 'assets');
    const hasPublic = fs.existsSync(publicPath);
    const hasAssets = fs.existsSync(assetsPath);
    const assetsFiles = hasAssets ? fs.readdirSync(assetsPath).slice(0, 10) : [];

    res.json({ 
      status: 'fixed', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: 'v1.3.5-FIX-PDF',
      node_env: process.env.NODE_ENV,
      diagnostics: {
        dirname: __dirname,
        publicPath,
        assetsPath,
        hasPublic,
        hasAssets,
        assetsFiles
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected', 
      error: error.message 
    });
  }
});

app.get('/api/debug-assets', (req, res) => {
  const p = path.join(__dirname, 'public', 'assets');
  try {
    const files = fs.readdirSync(p);
    res.json({ path: p, files });
  } catch (err) {
    res.json({ path: p, error: err.message });
  }
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const fileRoutes = require('./routes/fileRoutes');
const messageRoutes = require('./routes/messageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const statsRoutes = require('./routes/statsRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const bonusRoutes = require('./routes/bonusRoutes');
const activityRoutes = require('./routes/activityRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const contractRoutes = require('./routes/contractRoutes');
const { runRetentionPolicy } = require('./services/retentionService');

app.get('/api/test-contracts', async (req, res) => {
  try {
    const count = await prisma.contract.count();
    res.json({ success: true, count, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/contracts', contractRoutes);

// Data Retention Cron Job (Run daily at midnight)
cron.schedule('0 0 * * *', () => {
  runRetentionPolicy();
});

// Contract Renewal Check (Run daily at 9:00 AM)
const { checkContractRenewals } = require('./services/contractService');
cron.schedule('0 9 * * *', () => {
  checkContractRenewals();
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (data) => {
    if (data && data.userId) {
      socket.join(`user_${data.userId}`);
      if (data.role === 'ADMIN' || data.role === 'OWNER') {
        socket.join('admins');
      }
      console.log(`User ${data.userId} authenticated for Smart Routing on socket ${socket.id}`);
    }
  });

  socket.on('join_thread', (threadId) => {
    socket.join(threadId);
    console.log(`User ${socket.id} joined thread ${threadId}`);
  });

  socket.on('send_message', (data) => {
    // ╔══ ABSOLUTE PRIVACY v9.0 - STRICT ROUTING ══╗
    // threadId = GROUP message → goes ONLY to the room, NEVER to a user room.
    // receiverId only = DM → goes to receiver's user room.
    // This prevents ANY group message from leaking into a DM.
    // ╚════════════════════════════════════════════╝

    const notificationPayload = {
      type: 'message',
      threadId: data.threadId || null,
      senderId: data.senderId,
      senderName: data.senderName || null,
      message: 'رسالة جديدة'
    };

    if (data.threadId) {
      // --- GROUP MESSAGE PATH ---
      // 1. Deliver to the thread room (all members who joined it get the full message)
      io.to(data.threadId).emit('receive_message', data);

      // 2. Notify ADMINS globally so they see the badge (without the message content appearing in DM)
      socket.to('admins').emit('smart_notification', notificationPayload);

      // 3. Notify thread members (non-admin) who may NOT be in the room right now
      //    We do this by sending to each member's user room IF the group has memberIds
      if (Array.isArray(data.memberIds)) {
        data.memberIds.forEach(memberId => {
          if (memberId !== data.senderId) {
            socket.to(`user_${memberId}`).emit('smart_notification', notificationPayload);
          }
        });
      }
    } else {
      // --- PRIVATE DM PATH ---
      // 1. Only deliver receive_message to the sender and the exact receiver's user rooms
      if (data.receiverId && data.receiverId !== data.senderId) {
        io.to(`user_${data.receiverId}`).emit('receive_message', data);
        io.to(`user_${data.senderId}`).emit('receive_message', data);

        // 2. Notify the receiver personally (for badge/sound)
        socket.to(`user_${data.receiverId}`).emit('smart_notification', notificationPayload);

        // 3. Notify admins (so they see the badge too)
        socket.to('admins').emit('smart_notification', notificationPayload);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});


// Replaced by prioritized serving at the top

// Catch-all route for SPA support
app.use((req, res, next) => {
  // If request is for /api, let it fall through to 404 handler
  if (req.path.startsWith('/api')) {
    return next();
  }

  // Prevent serving index.html for missing assets/files
  const ext = path.extname(req.path).toLowerCase();
  const assetExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.mp3'];
  
  if (assetExtensions.includes(ext)) {
    return res.status(404).send('Not Found');
  }

  // Otherwise serve the frontend index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
