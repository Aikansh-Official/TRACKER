import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { jwtSecret } from '../config/security.js';

const router = Router();
const tokenFor = user => jwt.sign({ id: user._id, email: user.email }, jwtSecret, { expiresIn: '7d' });
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, timezone: user.timezone });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, timezone } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account already exists for this email.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), timezone: timezone || 'Asia/Kolkata' });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ message: 'Incorrect email or password.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
router.get('/me', requireAuth, async (req, res, next) => { try { const user = await User.findById(req.user.id); res.json({ user: publicUser(user) }); } catch (error) { next(error); } });
export default router;
