import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import routineRoutes from './routes/routines.js';
import taskRoutes from './routes/tasks.js';
import dashboardRoutes from './routes/dashboard.js';
import analyticsRoutes from './routes/analytics.js';
import moodRoutes from './routes/moods.js';
import productivityRoutes from './routes/productivity.js';
import syncRoutes from './routes/sync.js';

const app = express();
const localDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(cors({
  origin(origin, callback) {
    // Vite may choose 5174, 5175, etc. when another development tab is already running.
    if (!origin || localDevelopmentOrigin.test(origin) || origin === process.env.CLIENT_ORIGIN) return callback(null, true);
    return callback(new Error('This browser origin is not allowed to call the API.'));
  }
}));
app.use(express.json({ limit: '200kb' }));
app.get('/api/health', (_, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    ok: connected,
    database: connected ? 'connected' : 'disconnected',
    message: connected ? undefined : 'MongoDB is offline. Start MongoDB Community Server, then restart TRACKER.'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/sync', syncRoutes);
app.use((_, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((error, _, res, __) => {
  console.error(error);
  const databaseOffline = mongoose.connection.readyState !== 1
    || ['MongoServerSelectionError', 'MongooseServerSelectionError'].includes(error.name);
  const message = databaseOffline
    ? 'MongoDB is offline. Start MongoDB Community Server, then restart TRACKER.'
    : error.name === 'ValidationError'
      ? error.message
      : 'Something went wrong. Please try again.';
  res.status(databaseOffline ? 503 : error.status || 500).json({ message });
});

connectDatabase().then(() => app.listen(process.env.PORT || 5000, () => console.log(`API listening on http://localhost:${process.env.PORT || 5000}`))).catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
