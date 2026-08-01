import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import routineRoutes from './routes/routines.js';
import taskRoutes from './routes/tasks.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '200kb' }));
app.get('/api/health', (_, res) => res.json({ ok: true, database: 'connected' }));
app.use('/api/auth', authRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use((_, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((error, _, res, __) => { console.error(error); const message = error.name === 'ValidationError' ? error.message : 'Something went wrong. Please try again.'; res.status(error.status || 500).json({ message }); });

connectDatabase().then(() => app.listen(process.env.PORT || 5000, () => console.log(`API listening on http://localhost:${process.env.PORT || 5000}`))).catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
