// Creziax Portal Backend - v9.0-ABSOLUTE-PRIVACY (GROUP/DM Strict Routing)
// Environment variables MUST be loaded before any other imports that depend on them
require('dotenv').config();

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
global.io = io;

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
const financeRoutes = require('./routes/financeRoutes');
const activityRoutes = require('./routes/activityRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const contractRoutes = require('./routes/contractRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const publishScheduleRoutes = require('./routes/publishScheduleRoutes');
const leadRoutes = require('./routes/leadRoutes');
const { runRetentionPolicy, cleanExpiredMedia } = require('./services/retentionService');

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
app.use('/api/finance', financeRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/publish-schedules', publishScheduleRoutes);
app.use('/api/leads', leadRoutes);

// Data Retention Cron Job (Run daily at midnight)
cron.schedule('0 0 * * *', () => {
  runRetentionPolicy();
});

// Auto-delete chat media files older than 48 hours (Run every hour)
cron.schedule('0 * * * *', () => {
  cleanExpiredMedia(48);
});

// Contract Renewal Check (Run daily at 9:00 AM)
const { checkContractRenewals } = require('./services/contractService');
cron.schedule('0 9 * * *', () => {
  checkContractRenewals();
});

// Active User Socket Presence Tracking
const onlineUserSockets = new Map(); // userId -> Set<socketId>

// Socket.io events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_rooms', async (data) => {
    if (data && data.userId) {
      const userId = data.userId;
      socket.data.userId = userId;
      socket.join(`user_${userId}`);
      
      // Realtime Presence Tracking
      if (!onlineUserSockets.has(userId)) {
        onlineUserSockets.set(userId, new Set());
      }
      onlineUserSockets.get(userId).add(socket.id);

      // Broadcast user is online
      io.emit('user_presence_change', {
        userId,
        isOnline: true,
        lastActiveAt: new Date()
      });

      // Update User DB record asynchronously
      prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastActiveAt: new Date() }
      }).catch(err => console.error('[Presence DB Update Error]', err.message));
      
      if (data.role === 'ADMIN' || data.role === 'OWNER') {
        socket.join('admins');
      }
      
      try {
        // v21.5 Elite Sync: Automated Multi-Role Room Strategy
        const isAdmin = data.role === 'ADMIN' || data.role === 'OWNER';
        
        let projects = [];
        let teamGroups = [];

        if (isAdmin) {
          // Admins join EVERYTHING for live oversight
          [projects, teamGroups] = await Promise.all([
            prisma.project.findMany({ select: { id: true } }),
            prisma.teamGroup.findMany({ select: { id: true } })
          ]);
        } else {
          // Team members based on assignments, Clients based on ownership
          [projects, teamGroups] = await Promise.all([
            prisma.project.findMany({
              where: {
                OR: [
                  { teamMembers: { some: { userId } } },
                  { phases: { some: { tasks: { some: { assignedTo: { userId } } } } } },
                  { client: { userId: userId } }
                ]
              },
              select: { id: true }
            }),
            prisma.teamGroup.findMany({
              where: { members: { some: { id: userId } } },
              select: { id: true }
            })
          ]);
        }

        // Execute Joins
        projects.forEach(p => socket.join(`project_${p.id}`));
        teamGroups.forEach(g => socket.join(`project_${g.id}`)); 
        
        console.log(`[Socket] Role: ${data.role} | User: ${userId} joined ${projects.length} projects and ${teamGroups.length} groups.`);
      } catch (err) {
        console.error('[Socket Join Error]', err);
      }
    }
  });

  socket.on('send_message', async (data) => {
    if (!data.type || !['GROUP', 'PRIVATE'].includes(data.type)) return;

    // 1. تحديد الهدف (Target Room)
    const targetRoom = data.type === 'GROUP' 
      ? `project_${data.threadId}` 
      : `user_${data.receiverId}`;

    // 2. الإرسال للهدف فقط (No Leakage)
    // v21.5 Elite: Use socket.to instead of io.to to avoid 'echo-back' to sender
    if (targetRoom !== 'project_null' && targetRoom !== 'user_null') {
      socket.to(targetRoom).emit('receive_message', data);
    }

    // 3. لو هي Private، نبعت نسخة للمرسل (فقط لو محتاجين تزامن الـ Tabs)
    // بس في الـ Project Chat مش بنحتاجها عشان الـ API بيقوم بالواجب
    if (data.type === 'PRIVATE' && data.senderId !== data.receiverId) {
       // لباقي الـ Tabs المفتوحة للشخص (لو فاتح اكتر من Tab)
       socket.to(`user_${data.senderId}`).emit('receive_message', data);
    }
  });

  socket.on('force_delete_chat', (data) => {
    if (!data.threadId) return;
    
    // V17.6-SUPREME: Use io.to(roomId).emit for full global broadcast
    if (data.type === 'GROUP') {
      io.to(`project_${data.threadId}`).emit('chat_deleted', { threadId: data.threadId });
    } else {
      // Private DM: broadcast to both the target user AND the sender
      // data.senderId is passed from the frontend; socket.data.userId is a fallback
      const senderId = data.senderId || socket.data.userId;
      io.to(`user_${data.threadId}`).emit('chat_deleted', { threadId: data.threadId });
      if (senderId) {
        io.to(`user_${senderId}`).emit('chat_deleted', { threadId: data.threadId });
      }
      // Also notify all admins
      io.to('admins').emit('chat_deleted', { threadId: data.threadId });
    }
    
    console.log(`[V17.6-SUPREME] Universal Wipe: Chat ${data.threadId} broadcasted to all rooms.`);
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    if (userId && onlineUserSockets.has(userId)) {
      const userSockets = onlineUserSockets.get(userId);
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUserSockets.delete(userId);
        const now = new Date();
        io.emit('user_presence_change', {
          userId,
          isOnline: false,
          lastActiveAt: now
        });
        prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastActiveAt: now }
        }).catch(err => console.error('[Presence DB Disconnect Error]', err.message));
      }
    }
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
