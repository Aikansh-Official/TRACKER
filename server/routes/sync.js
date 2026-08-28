import { Router } from 'express';
import SpecialTask from '../models/SpecialTask.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

const taskValue = (task, key, fallback = null) => task[key] ?? task[key.replace(/[A-Z]/g, value => `_${value.toLowerCase()}`)] ?? fallback;
const taskPatch = task => ({
  title: String(taskValue(task, 'title', '')).trim().slice(0, 120),
  description: String(taskValue(task, 'description', '')).trim(),
  itemType: taskValue(task, 'itemType', 'TASK') === 'EVENT' ? 'EVENT' : 'TASK',
  originalDate: taskValue(task, 'originalDate', dateKey()),
  scheduledDate: taskValue(task, 'scheduledDate', dateKey()),
  allDay: Boolean(taskValue(task, 'allDay', true)),
  startTime: taskValue(task, 'startTime'),
  priority: taskValue(task, 'priority', 'MEDIUM'),
  deadline: taskValue(task, 'deadline'),
  estimatedMinutes: Number(taskValue(task, 'estimatedMinutes', 30)),
  preferredTime: taskValue(task, 'preferredTime'),
  recurrence: taskValue(task, 'recurrence', { frequency: 'NONE', interval: 1, weekdays: [], endDate: null }),
  seriesId: taskValue(task, 'seriesId'),
  occurrenceDate: taskValue(task, 'occurrenceDate'),
  subtasks: Array.isArray(taskValue(task, 'subtasks', [])) ? taskValue(task, 'subtasks', []).map(item => ({
    title: String(item.title || '').trim().slice(0, 160),
    done: Boolean(item.done),
    completedAt: item.completedAt || null
  })).filter(item => item.title) : [],
  reminderMinutes: taskValue(task, 'reminderMinutes'),
  status: taskValue(task, 'status', 'TODAY'),
  outcome: taskValue(task, 'outcome'),
  outcomeNote: String(taskValue(task, 'outcomeNote', '')),
  delegatedTo: String(taskValue(task, 'delegatedTo', '')),
  completedAt: taskValue(task, 'completedAt'),
  resolvedAt: taskValue(task, 'resolvedAt'),
  deletedAt: taskValue(task, 'deletedAt')
});

router.post('/push', async (req, res, next) => {
  try {
    const mutations = Array.isArray(req.body.mutations) ? req.body.mutations.slice(0, 100) : [];
    const accepted = [], conflicts = [];
    for (const mutation of mutations) {
      if (mutation?.entityType !== 'task' || mutation?.operation !== 'upsert') continue;
      const syncId = String(mutation.syncId || mutation.payload?.syncId || '');
      const revision = Number(mutation.revision || mutation.payload?.revision || 0);
      const payload = mutation.payload?.task;
      if (!/^[0-9a-f-]{36}$/i.test(syncId) || !Number.isInteger(revision) || revision < 1 || !payload) continue;
      const patch = taskPatch(payload);
      if (!patch.title || !/^\d{4}-\d{2}-\d{2}$/.test(patch.scheduledDate)) continue;
      const existing = await SpecialTask.findOne({ userId: req.user.id, syncId });
      if (existing && existing.revision >= revision) {
        if (existing.revision > revision) conflicts.push({ syncId, serverRevision: existing.revision });
        else accepted.push({ syncId, revision: existing.revision });
        continue;
      }
      const updatedAt = mutation.updatedAt || mutation.payload?.updatedAt || new Date().toISOString();
      if (existing) {
        Object.assign(existing, patch, { revision, syncUpdatedAt: updatedAt });
        await existing.save();
      } else {
        await SpecialTask.create({ ...patch, userId: req.user.id, syncId, revision, syncUpdatedAt: updatedAt });
      }
      accepted.push({ syncId, revision });
    }
    res.json({ accepted, conflicts });
  } catch (error) { next(error); }
});

router.post('/pull', async (req, res, next) => {
  try {
    const cursor = req.body.cursor ? new Date(req.body.cursor) : new Date(0);
    const changes = await SpecialTask.find({ userId: req.user.id, syncUpdatedAt: { $gt: cursor } })
      .sort({ syncUpdatedAt: 1 }).limit(200);
    const nextCursor = changes.length ? changes[changes.length - 1].syncUpdatedAt.toISOString() : cursor.toISOString();
    res.json({ changes, cursor: nextCursor });
  } catch (error) { next(error); }
});

export default router;
