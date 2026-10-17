import { Router } from 'express';
import Routine from '../models/Routine.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';
import { validDate, validTime } from '../services/taskValidation.js';

const router = Router();
router.use(requireAuth);

function validateSchedule(routine) {
  if (!validDate(routine.startDate) || (routine.endDate && (!validDate(routine.endDate) || routine.endDate < routine.startDate))
      || (routine.isTemporary && !routine.endDate) || (routine.pausedUntil && !validDate(routine.pausedUntil))) {
    throw Object.assign(new Error('Use valid dates, with the end date on or after the start date.'), { status: 400 });
  }
  if (!validTime(routine.preferredTime ?? null)) throw Object.assign(new Error('Choose a valid preferred time.'), { status: 400 });
  if (routine.frequency === 'CUSTOM' && (!Array.isArray(routine.scheduledDays) || !routine.scheduledDays.length || routine.scheduledDays.some(day => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6))) {
    throw Object.assign(new Error('Choose at least one valid day for this routine.'), { status: 400 });
  }
  if (!Number.isInteger(Number(routine.weeklyTarget)) || routine.weeklyTarget < 1 || routine.weeklyTarget > 7) throw Object.assign(new Error('Choose a weekly target from 1 to 7 days.'), { status: 400 });
}

function progressDate(body, routine) {
  const date = body.date === undefined ? dateKey() : body.date;
  if (!validDate(date) || date < routine.startDate || (routine.isTemporary && date > routine.endDate)) {
    throw Object.assign(new Error('Choose a real date within this routine’s active dates.'), { status: 400 });
  }
  return date;
}

router.get('/', async (req, res, next) => {
  try { res.json({ routines: await Routine.find({ userId: req.user.id }).sort({ createdAt: -1 }) }); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description = '', type, targetQuantity, unit, category = 'OTHER', frequency = 'DAILY', scheduledDays = [], weeklyTarget = 3, estimatedMinutes = 25, preferredTime = null, minimumTarget = 1, stretchTarget, startDate, endDate } = req.body;
    const clientId = req.body.clientId;
    if (clientId && !/^[0-9a-f-]{36}$/i.test(clientId)) return res.status(400).json({ message: 'Invalid routine identifier.' });
    if (clientId) {
      const existing = await Routine.findOne({ userId: req.user.id, clientId });
      if (existing) return res.status(201).json({ routine: existing });
    }
    const isTemporary = type === 'TEMPORARY' || req.body.isTemporary === true;
    if (!title || !['BINARY', 'QUANTIFIABLE', 'TEMPORARY'].includes(type)) return res.status(400).json({ message: 'A routine title and valid type are required.' });
    if (isTemporary && !endDate) return res.status(400).json({ message: 'Temporary routines need an end date.' });
    const target = type === 'QUANTIFIABLE' ? Number(targetQuantity || 1) : 1;
    const routine = new Routine({ ...(clientId ? { clientId } : {}), userId: req.user.id, title, description, type, targetQuantity: target, unit: unit || (type === 'QUANTIFIABLE' ? 'units' : 'times'), category, frequency, scheduledDays: frequency === 'CUSTOM' ? scheduledDays : [], weeklyTarget: Number(weeklyTarget || 3), estimatedMinutes: Number(estimatedMinutes || 25), preferredTime: preferredTime || null, minimumTarget: Math.min(Number(minimumTarget || 1), target), stretchTarget: Math.max(Number(stretchTarget || target), target), startDate: startDate === undefined ? dateKey() : startDate, endDate: endDate || null, isTemporary });
    validateSchedule(routine);
    routine.scheduledDays = [...new Set(routine.scheduledDays)];
    await routine.save();
    res.status(201).json({ routine });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'targetQuantity', 'unit', 'category', 'frequency', 'scheduledDays', 'weeklyTarget', 'estimatedMinutes', 'preferredTime', 'minimumTarget', 'stretchTarget', 'startDate', 'endDate', 'pausedUntil', 'status'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const routine = await Routine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    Object.assign(routine, changes);
    if (routine.type !== 'QUANTIFIABLE') routine.targetQuantity = 1;
    routine.minimumTarget = Math.min(routine.minimumTarget, routine.targetQuantity);
    routine.stretchTarget = Math.max(routine.stretchTarget, routine.targetQuantity);
    validateSchedule(routine);
    await routine.save();
    res.json({ routine });
  } catch (error) { next(error); }
});

router.patch('/:id/progress', async (req, res, next) => {
  try {
    const routine = await Routine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    const date = progressDate(req.body, routine);
    const quantity = routine.type !== 'QUANTIFIABLE' ? (req.body.completed ? routine.targetQuantity : 0) : Number(req.body.completedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ message: 'Progress must be a positive number.' });
    const completedQuantity = Math.min(quantity, routine.targetQuantity);
    const record = await DailyRoutineRecord.findOneAndUpdate(
      { routineId: routine._id, userId: req.user.id, date },
      { $set: { target: routine.targetQuantity, completedQuantity, completed: completedQuantity >= routine.targetQuantity, skipped: false, skipReason: '' } },
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

router.patch('/:id/skip', async (req, res, next) => {
  try {
    const routine = await Routine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    const date = progressDate(req.body, routine);
    const skipped = req.body.skipped !== false;
    const record = await DailyRoutineRecord.findOneAndUpdate(
      { routineId: routine._id, userId: req.user.id, date },
      { $set: { target: routine.targetQuantity, completedQuantity: 0, completed: false, skipped, skipReason: skipped ? String(req.body.reason || 'Intentional rest').slice(0, 180) : '' } },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );
    res.json({ record });
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
