import SpecialTask from '../models/SpecialTask.js';
import { measurement, normalizeRecurrence, validDate, validTime } from '../services/taskValidation.js';
import { closedTaskStatuses, markCompleted, refreshTaskStatuses, reopenTask, scheduledStatus } from '../services/taskLifecycle.js';
import { dateKey } from '../utils/date.js';


const addDays = (date, amount) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };
const addMonths = (date, amount) => {
  const value = new Date(`${date}T00:00:00.000Z`); const wantedDay = value.getUTCDate();
  value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(wantedDay, lastDay)); return value.toISOString().slice(0, 10);
};
const normalizeSubtasks = values => (Array.isArray(values) ? values : []).filter(Boolean).map(value => typeof value === 'string' ? { title: value } : value).map(value => ({ title: String(value.title || '').trim(), done: Boolean(value.done), completedAt: value.done ? value.completedAt || new Date() : null })).filter(value => value.title).slice(0, 30);
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

export async function listTasks(req, res, next) {
  try {
    await refreshTaskStatuses(req.user.id, dateKey());
    const filter = { userId: req.user.id, ...(req.query.includeDeleted === 'true' ? { deletedAt: { $exists: true } } : {}), ...(req.query.status ? { status: req.query.status } : {}) };
    if (req.query.from || req.query.to) filter.scheduledDate = { ...(req.query.from ? { $gte: req.query.from } : {}), ...(req.query.to ? { $lte: req.query.to } : {}) };
    res.json({ tasks: await SpecialTask.find(filter).sort({ scheduledDate: 1, allDay: -1, startTime: 1, createdAt: -1 }) });
  } catch (error) { next(error); }
}

export async function createTask(req, res, next) {
  try {
    const today = dateKey();
    const { title, description = '', itemType = 'TASK', scheduledDate = today, allDay = false, startTime = null, priority = 'MEDIUM', deadline = null, estimatedMinutes = 30, preferredTime = null, reminderMinutes = null } = req.body;
    if (!String(title || '').trim()) return res.status(400).json({ message: 'Give this task or event a title.' });
    if (!validDate(scheduledDate)) return res.status(400).json({ message: 'Choose a valid date.' });
    if (!validTime(startTime) || !validTime(deadline)) return res.status(400).json({ message: 'Use a valid time.' });
    const isAllDay = Boolean(allDay); const recurrence = normalizeRecurrence(req.body.recurrence); const dates = recurrenceDates(scheduledDate, recurrence);
    if (!dates.length) return res.status(400).json({ message: 'Repeat end date must be on or after the scheduled date.' });
    const shared = { ...measurement(req.body), userId: req.user.id, title, description, itemType: itemType === 'EVENT' ? 'EVENT' : 'TASK', allDay: isAllDay, startTime: isAllDay ? null : startTime || null, priority, deadline: isAllDay ? null : deadline || null, estimatedMinutes: Number(estimatedMinutes || 30), preferredTime: preferredTime || null, reminderMinutes: reminderMinutes === null || reminderMinutes === '' ? null : Number(reminderMinutes), recurrence, subtasks: normalizeSubtasks(req.body.subtasks) };
    const task = new SpecialTask({ ...shared, originalDate: dates[0], scheduledDate: dates[0], occurrenceDate: dates[0], status: scheduledStatus(dates[0], today) });
    if (task.taskType === 'MEASURABLE' && task.progress >= task.target) markCompleted(task);
    await task.save();
    task.seriesId = task._id; await task.save();
    if (dates.length > 1) await SpecialTask.insertMany(dates.slice(1).map(date => ({ ...shared, seriesId: task._id, originalDate: date, scheduledDate: date, occurrenceDate: date, progress: 0, subtasks: shared.subtasks.map(item => ({ ...item, done: false, completedAt: null })), status: scheduledStatus(date, today) })));
    res.status(201).json({ task, occurrences: dates.length });
  } catch (error) { next(error); }
}

export async function moveTasksToToday(req, res, next) {
  try { const ids = Array.isArray(req.body.ids) ? req.body.ids : []; const result = await SpecialTask.updateMany({ _id: { $in: ids }, userId: req.user.id, status: 'PENDING' }, { $set: { status: 'TODAY', scheduledDate: dateKey(), outcome: 'RESCHEDULED', resolvedAt: new Date() } }); res.json({ moved: result.modifiedCount }); } catch (error) { next(error); }
}

export async function completeTask(req, res, next) {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (req.body.completed !== false) {
      const previous = task.toObject();
      if (task.taskType === 'MEASURABLE') task.progress = task.target;
      markCompleted(task, previous);
    } else reopenTask(task, dateKey(), { restoreProgress: task.status === 'COMPLETED' });
    await task.save(); res.json({ task });
  } catch (error) { next(error); }
}

export async function updateSubtask(req, res, next) {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const subtask = task.subtasks.id(req.params.subtaskId); if (!subtask) return res.status(404).json({ message: 'Checklist item not found.' });
    subtask.done = req.body.done !== false; subtask.completedAt = subtask.done ? new Date() : null; await task.save(); res.json({ task });
  } catch (error) { next(error); }
}

export async function resolveTaskOutcome(req, res, next) {
  try {
    const outcome = String(req.body.outcome || '').toUpperCase();
    if (!['RESCHEDULED', 'SKIPPED', 'DROPPED', 'DELEGATED'].includes(outcome)) return res.status(400).json({ message: 'Choose rescheduled, skipped, dropped, or delegated.' });
    const today = dateKey(); const nextDate = req.body.scheduledDate || today;
    if (outcome === 'RESCHEDULED' && !validDate(nextDate)) return res.status(400).json({ message: 'Choose a valid reschedule date.' });
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.status === 'COMPLETED') reopenTask(task, today, { restoreProgress: true });
    Object.assign(task, { outcome, outcomeNote: String(req.body.note || '').slice(0, 400), skipReason: outcome === 'SKIPPED' ? String(req.body.reason || req.body.note || 'Intentional rest').slice(0, 180) : '', delegatedTo: outcome === 'DELEGATED' ? String(req.body.delegatedTo || '').slice(0, 120) : '', completedAt: null, resolvedAt: new Date(), status: outcome === 'RESCHEDULED' ? scheduledStatus(nextDate, today) : outcome, ...(outcome === 'RESCHEDULED' ? { scheduledDate: nextDate } : {}) });
    await task.save(); res.json({ task });
  } catch (error) { next(error); }
}

export async function updateTask(req, res, next) {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const allowed = ['title', 'description', 'itemType', 'priority', 'deadline', 'scheduledDate', 'allDay', 'startTime', 'estimatedMinutes', 'preferredTime', 'reminderMinutes'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if ('scheduledDate' in changes && !validDate(changes.scheduledDate)) return res.status(400).json({ message: 'Choose a valid date.' });
    if ('startTime' in changes && !validTime(changes.startTime)) return res.status(400).json({ message: 'Use a valid start time.' });
    if ('deadline' in changes && !validTime(changes.deadline)) return res.status(400).json({ message: 'Use a valid deadline.' });
    const previous = task.toObject();
    Object.assign(task, changes, measurement(req.body, task));
    if (!closedTaskStatuses.has(task.status)) {
      if (task.taskType === 'MEASURABLE' && task.progress >= task.target) markCompleted(task, previous);
      else if (task.taskType === 'MEASURABLE' && previous.status === 'COMPLETED') reopenTask(task, dateKey());
      else if (task.status === 'COMPLETED') markCompleted(task, previous);
      else task.status = scheduledStatus(task.scheduledDate, dateKey());
    }
    if ('subtasks' in req.body) task.subtasks = normalizeSubtasks(req.body.subtasks);
    task.itemType = task.itemType === 'EVENT' ? 'EVENT' : 'TASK';
    if (task.allDay) { task.startTime = null; task.deadline = null; }
    await task.save(); res.json({ task });
  } catch (error) { next(error); }
}

export async function deleteTask(req, res, next) {
  try {
    const task = await SpecialTask.findOne({ _id: req.params.id, userId: req.user.id }); if (!task) return res.status(404).json({ message: 'Task not found.' });
    const result = req.query.series === 'true' && task.seriesId ? await SpecialTask.updateMany({ userId: req.user.id, seriesId: task.seriesId }, { $set: { deletedAt: new Date() } }) : await SpecialTask.updateMany({ _id: task._id, userId: req.user.id }, { $set: { deletedAt: new Date() } }); res.json({ deleted: result.modifiedCount });
  } catch (error) { next(error); }
}
