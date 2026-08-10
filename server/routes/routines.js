import { Router } from 'express';
import Routine from '../models/Routine.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json({ routines: await Routine.find({ userId: req.user.id }).sort({ createdAt: -1 }) }); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description = '', type, targetQuantity, unit, category = 'OTHER', frequency = 'DAILY', scheduledDays = [], weeklyTarget = 3, estimatedMinutes = 25, preferredTime = null, minimumTarget = 1, stretchTarget, startDate, endDate } = req.body;
    const isTemporary = type === 'TEMPORARY';
    if (!title || !['BINARY', 'QUANTIFIABLE', 'TEMPORARY'].includes(type)) return res.status(400).json({ message: 'A routine title and valid type are required.' });
    if (isTemporary && !endDate) return res.status(400).json({ message: 'Temporary routines need an end date.' });
    const target = type === 'BINARY' ? 1 : Number(targetQuantity || 1);
    const routine = await Routine.create({ userId: req.user.id, title, description, type, targetQuantity: target, unit: unit || (type === 'BINARY' ? 'times' : 'units'), category, frequency, scheduledDays: frequency === 'CUSTOM' ? [...new Set(scheduledDays.map(Number))].filter(day => day >= 0 && day <= 6) : [], weeklyTarget: Number(weeklyTarget || 3), estimatedMinutes: Number(estimatedMinutes || 25), preferredTime: preferredTime || null, minimumTarget: Math.min(Number(minimumTarget || 1), target), stretchTarget: Math.max(Number(stretchTarget || target), target), startDate: startDate || dateKey(), endDate: endDate || null, isTemporary });
    res.status(201).json({ routine });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'targetQuantity', 'unit', 'category', 'frequency', 'scheduledDays', 'weeklyTarget', 'estimatedMinutes', 'preferredTime', 'minimumTarget', 'stretchTarget', 'startDate', 'endDate', 'pausedUntil', 'status'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const routine = await Routine.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, changes, { returnDocument: 'after', runValidators: true });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    res.json({ routine });
  } catch (error) { next(error); }
});

router.patch('/:id/progress', async (req, res, next) => {
  try {
    const routine = await Routine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    const date = req.body.date || dateKey();
    const quantity = routine.type === 'BINARY' ? (req.body.completed ? 1 : 0) : Number(req.body.completedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ message: 'Progress must be a positive number.' });
    const completedQuantity = Math.min(quantity, routine.targetQuantity);
    const record = await DailyRoutineRecord.findOneAndUpdate(
      { routineId: routine._id, userId: req.user.id, date },
      { $set: { target: routine.targetQuantity, completedQuantity, completed: completedQuantity >= routine.targetQuantity } },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );
    res.json({ record });
  } catch (error) { next(error); }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const routine = await Routine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    const records = await DailyRoutineRecord.find({ routineId: routine._id, userId: req.user.id }).sort({ date: -1 }).limit(120);
    res.json({ routine, records });
  } catch (error) { next(error); }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    const routine = await Routine.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { status: 'ARCHIVED' }, { returnDocument: 'after' });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    res.json({ routine });
  } catch (error) { next(error); }
});
router.post('/:id/restore', async (req, res, next) => {
  try {
    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'ARCHIVED' },
      { status: 'ACTIVE' },
      { returnDocument: 'after' }
    );
    if (!routine) return res.status(404).json({ message: 'Archived routine not found.' });
    res.json({ routine });
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const routine = await Routine.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    await DailyRoutineRecord.deleteMany({ routineId: routine._id, userId: req.user.id });
    res.status(204).end();
  } catch (error) { next(error); }
});
export default router;
