import { Router } from 'express';
import SpecialTask from '../models/SpecialTask.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const validTime = value => value === null || value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const scheduledStatus = (scheduledDate, today) => scheduledDate < today ? 'PENDING' : scheduledDate > today ? 'SCHEDULED' : 'TODAY';
const addDays = (date, amount) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };
const addMonths = (date, amount) => {
  const value = new Date(`${date}T00:00:00.000Z`); const wantedDay = value.getUTCDate();
  value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(wantedDay, lastDay)); return value.toISOString().slice(0, 10);
};
const normalizeSubtasks = values => (Array.isArray(values) ? values : []).map(value => typeof value === 'string' ? { title: value } : value).map(value => ({ title: String(value.title || '').trim(), done: Boolean(value.done), completedAt: value.done ? value.completedAt || new Date() : null })).filter(value => value.title).slice(0, 30);
const normalizeRecurrence = (value = {}) => {
  const frequency = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(value.frequency) ? value.frequency : 'NONE';
  return { frequency, interval: Math.min(30, Math.max(1, Number(value.interval || 1))), weekdays: [...new Set(Array.isArray(value.weekdays) ? value.weekdays.map(Number).filter(day => day >= 0 && day <= 6) : [])], endDate: validDate(value.endDate) ? value.endDate : null };
};
const recurrenceDates = (start, recurrence) => {
  if (recurrence.frequency === 'NONE') return [start];
  const horizon = recurrence.endDate || addDays(start, 365); const result = [];
  if (recurrence.frequency === 'MONTHLY') {
    for (let index = 0; result.length < 120; index += 1) { const next = addMonths(start, index * recurrence.interval); if (next > horizon) break; result.push(next); }
    return result;
  }
  const startDate = new Date(`${start}T00:00:00.000Z`); const weekdays = recurrence.weekdays.length ? recurrence.weekdays : [startDate.getUTCDay()];
  for (let cursor = start, offset = 0; cursor <= horizon && result.length < 120; cursor = addDays(cursor, 1), offset += 1) {
    const current = new Date(`${cursor}T00:00:00.000Z`);
    const matches = recurrence.frequency === 'DAILY' ? offset % recurrence.interval === 0 : Math.floor(offset / 7) % recurrence.interval === 0 && weekdays.includes(current.getUTCDay());
    if (matches) result.push(cursor);
  }
  return result;
};

router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user.id, ...(req.query.status ? { status: req.query.status } : {}) };
    if (req.query.from || req.query.to) filter.scheduledDate = { ...(req.query.from ? { $gte: req.query.from } : {}), ...(req.query.to ? { $lte: req.query.to } : {}) };
    res.json({ tasks: await SpecialTask.find(filter).sort({ scheduledDate: 1, allDay: -1, startTime: 1, createdAt: -1 }) });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const today = dateKey();
    const { title, description = '', itemType = 'TASK', scheduledDate = today, allDay = false, startTime = null, priority = 'MEDIUM', deadline = null, estimatedMinutes = 30, preferredTime = null, reminderMinutes = null } = req.body;
    if (!String(title || '').trim()) return res.status(400).json({ message: 'Give this task or event a title.' });
    if (!validDate(scheduledDate)) return res.status(400).json({ message: 'Choose a valid date.' });
    if (!validTime(startTime) || !validTime(deadline)) return res.status(400).json({ message: 'Use a valid time.' });
    const isAllDay = Boolean(allDay); const recurrence = normalizeRecurrence(req.body.recurrence); const dates = recurrenceDates(scheduledDate, recurrence);
    const shared = { userId: req.user.id, title, description, itemType: itemType === 'EVENT' ? 'EVENT' : 'TASK', originalDate: today, allDay: isAllDay, startTime: isAllDay ? null : startTime || null, priority, deadline: isAllDay ? null : deadline || null, estimatedMinutes: Number(estimatedMinutes || 30), preferredTime: preferredTime || null, reminderMinutes: reminderMinutes === null || reminderMinutes === '' ? null : Number(reminderMinutes), recurrence, subtasks: normalizeSubtasks(req.body.subtasks) };
    const task = await SpecialTask.create({ ...shared, scheduledDate: dates[0], occurrenceDate: dates[0], status: scheduledStatus(dates[0], today) });
    task.seriesId = task._id; await task.save();
    if (dates.length > 1) await SpecialTask.insertMany(dates.slice(1).map(date => ({ ...shared, seriesId: task._id, scheduledDate: date, occurrenceDate: date, status: scheduledStatus(date, today) })));
    res.status(201).json({ task, occurrences: dates.length });
  } catch (error) { next(error); }
});

router.patch('/move-to-today', async (req, res, next) => {
  try { const ids = Array.isArray(req.body.ids) ? req.body.ids : []; const result = await SpecialTask.updateMany({ _id: { $in: ids }, userId: req.user.id, status: 'PENDING' }, { $set: { status: 'TODAY', scheduledDate: dateKey(), outcome: 'RESCHEDULED', resolvedAt: new Date() } }); res.json({ moved: result.modifiedCount }); } catch (error) { next(error); }
});

router.patch('/:id/complete', async (req, res, next) => {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const completed = req.body.completed !== false; task.status = completed ? 'COMPLETED' : scheduledStatus(task.scheduledDate, dateKey()); task.outcome = completed ? 'COMPLETED' : null; task.completedAt = completed ? new Date() : null; task.resolvedAt = completed ? new Date() : null; await task.save(); res.json({ task });
  } catch (error) { next(error); }
});

router.patch('/:id/subtasks/:subtaskId', async (req, res, next) => {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const subtask = task.subtasks.id(req.params.subtaskId); if (!subtask) return res.status(404).json({ message: 'Checklist item not found.' });
    subtask.done = req.body.done !== false; subtask.completedAt = subtask.done ? new Date() : null; await task.save(); res.json({ task });
  } catch (error) { next(error); }
});

router.patch('/:id/outcome', async (req, res, next) => {
  try {
    const outcome = String(req.body.outcome || '').toUpperCase();
    if (!['RESCHEDULED', 'SKIPPED', 'DROPPED', 'DELEGATED'].includes(outcome)) return res.status(400).json({ message: 'Choose rescheduled, skipped, dropped, or delegated.' });
    const today = dateKey(); const nextDate = req.body.scheduledDate || today;
    if (outcome === 'RESCHEDULED' && !validDate(nextDate)) return res.status(400).json({ message: 'Choose a valid reschedule date.' });
    const changes = { outcome, outcomeNote: String(req.body.note || '').slice(0, 400), skipReason: outcome === 'SKIPPED' ? String(req.body.reason || req.body.note || 'Intentional rest').slice(0, 180) : '', delegatedTo: outcome === 'DELEGATED' ? String(req.body.delegatedTo || '').slice(0, 120) : '', resolvedAt: new Date(), status: outcome === 'RESCHEDULED' ? scheduledStatus(nextDate, today) : outcome, ...(outcome === 'RESCHEDULED' ? { scheduledDate: nextDate } : {}) };
    const task = await SpecialTask.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, changes, { returnDocument: 'after', runValidators: true }); if (!task) return res.status(404).json({ message: 'Task not found.' }); res.json({ task });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const allowed = ['title', 'description', 'itemType', 'priority', 'deadline', 'scheduledDate', 'allDay', 'startTime', 'estimatedMinutes', 'preferredTime', 'reminderMinutes'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (changes.scheduledDate && !validDate(changes.scheduledDate)) return res.status(400).json({ message: 'Choose a valid date.' });
    if ('startTime' in changes && !validTime(changes.startTime)) return res.status(400).json({ message: 'Use a valid start time.' });
    if ('deadline' in changes && !validTime(changes.deadline)) return res.status(400).json({ message: 'Use a valid deadline.' });
    Object.assign(task, changes); if ('subtasks' in req.body) task.subtasks = normalizeSubtasks(req.body.subtasks); task.itemType = task.itemType === 'EVENT' ? 'EVENT' : 'TASK'; if (task.allDay) { task.startTime = null; task.deadline = null; }
    if (!['COMPLETED', 'SKIPPED', 'DROPPED', 'DELEGATED', 'ARCHIVED'].includes(task.status)) task.status = scheduledStatus(task.scheduledDate, dateKey()); await task.save(); res.json({ task });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const result = req.query.series === 'true' && task.seriesId ? await SpecialTask.deleteMany({ userId: req.user.id, seriesId: task.seriesId }) : await SpecialTask.deleteOne({ _id: task._id, userId: req.user.id }); res.json({ deleted: result.deletedCount });
  } catch (error) { next(error); }
});

export default router;
