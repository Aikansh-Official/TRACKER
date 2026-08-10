import { Router } from 'express';
import SpecialTask from '../models/SpecialTask.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);
router.get('/', async (req, res, next) => { try { const filter = { userId: req.user.id, ...(req.query.status ? { status: req.query.status } : {}) }; res.json({ tasks: await SpecialTask.find(filter).sort({ scheduledDate: 1, createdAt: -1 }) }); } catch (error) { next(error); } });
router.post('/', async (req, res, next) => {
  try {
    const today = dateKey(); const { title, description = '', scheduledDate = today, priority = 'MEDIUM', deadline = null, estimatedMinutes = 30, preferredTime = null } = req.body;
    if (!title) return res.status(400).json({ message: 'Task title is required.' });
    const task = await SpecialTask.create({ userId: req.user.id, title, description, originalDate: today, scheduledDate, priority, deadline, estimatedMinutes: Number(estimatedMinutes || 30), preferredTime: preferredTime || null, status: scheduledDate === today ? 'TODAY' : 'PENDING' });
    res.status(201).json({ task });
  } catch (error) { next(error); }
});
router.patch('/:id/complete', async (req, res, next) => { try { const completed = req.body.completed !== false; const task = await SpecialTask.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { status: completed ? 'COMPLETED' : 'TODAY', outcome: completed ? 'COMPLETED' : null, completedAt: completed ? new Date() : null, resolvedAt: completed ? new Date() : null }, { returnDocument: 'after' }); if (!task) return res.status(404).json({ message: 'Task not found.' }); res.json({ task }); } catch (error) { next(error); } });
router.patch('/move-to-today', async (req, res, next) => { try { const ids = Array.isArray(req.body.ids) ? req.body.ids : []; const result = await SpecialTask.updateMany({ _id: { $in: ids }, userId: req.user.id, status: 'PENDING' }, { $set: { status: 'TODAY', scheduledDate: dateKey() } }); res.json({ moved: result.modifiedCount }); } catch (error) { next(error); } });
router.patch('/:id/outcome', async (req, res, next) => {
  try {
    const outcome = String(req.body.outcome || '').toUpperCase();
    if (!['RESCHEDULED', 'DROPPED', 'DELEGATED'].includes(outcome)) return res.status(400).json({ message: 'Choose rescheduled, dropped, or delegated.' });
    const today = dateKey();
    const nextDate = req.body.scheduledDate || today;
    const changes = {
      outcome,
      outcomeNote: String(req.body.note || '').slice(0, 400),
      delegatedTo: outcome === 'DELEGATED' ? String(req.body.delegatedTo || '').slice(0, 120) : '',
      resolvedAt: new Date(),
      status: outcome === 'RESCHEDULED' ? (nextDate === today ? 'TODAY' : 'PENDING') : outcome,
      ...(outcome === 'RESCHEDULED' ? { scheduledDate: nextDate } : {})
    };
    const task = await SpecialTask.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, changes, { returnDocument: 'after', runValidators: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    res.json({ task });
  } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => { try { const allowed = ['title', 'description', 'priority', 'deadline', 'scheduledDate', 'estimatedMinutes', 'preferredTime']; const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key))); const task = await SpecialTask.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, changes, { returnDocument: 'after', runValidators: true }); if (!task) return res.status(404).json({ message: 'Task not found.' }); res.json({ task }); } catch (error) { next(error); } });
router.delete('/:id', async (req, res, next) => { try { const task = await SpecialTask.findOneAndDelete({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' }); res.status(204).end(); } catch (error) { next(error); } });
export default router;
