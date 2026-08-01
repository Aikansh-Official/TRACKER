import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import { prepareDailyState } from '../services/dailyState.js';

const router = Router();
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found.' });
    const state = await prepareDailyState(user);
    const routineProgress = state.records.reduce((sum, record) => sum + record.completedQuantity / record.target, 0);
    const taskDone = state.specialTasks.filter(task => task.status === 'COMPLETED').length;
    const items = state.records.length + state.specialTasks.length;
    const score = items ? Math.round(((routineProgress + taskDone) / items) * 100) : 0;
    res.json({ ...state, score, user: { id: user._id, name: user.name, timezone: user.timezone } });
  } catch (error) { next(error); }
});
export default router;
