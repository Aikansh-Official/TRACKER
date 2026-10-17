import SpecialTask from '../models/SpecialTask.js';
import { measurement, normalizeRecurrence, validDate, validTime } from '../services/taskValidation.js';
import { closedTaskStatuses, markCompleted, reopenTask, scheduledStatus } from '../services/taskLifecycle.js';
import { dateKey } from '../utils/date.js';


const taskValue = (task, key, fallback = null) => task[key] ?? task[key.replace(/[A-Z]/g, value => `_${value.toLowerCase()}`)] ?? fallback;
const taskPatch = task => ({
  ...measurement(task),
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
  skipReason: String(taskValue(task, 'skipReason', '')),
  completedAt: taskValue(task, 'completedAt'),
  resolvedAt: taskValue(task, 'resolvedAt'),
  deletedAt: taskValue(task, 'deletedAt')
});

export async function pushChanges(req, res, next) {
  try {
    if (!Array.isArray(req.body.mutations) || req.body.mutations.length > 100) return res.status(400).json({ message: 'Send at most 100 task changes.' });
    const accepted = [], conflicts = [];
    for (const mutation of req.body.mutations) {
      const { syncId, baseRevision, mutationId } = mutation;
      const payload = mutation.payload?.task;
      if (mutation.entityType !== 'task' || mutation.operation !== 'upsert' || !/^[0-9a-f-]{36}$/i.test(syncId || '') ||
          !Number.isInteger(baseRevision) || baseRevision < 0 || !/^[0-9a-f-]{36}$/i.test(mutationId || '') || !payload) {
        return res.status(400).json({ message: 'This sync request needs a stable mutation ID and base revision. Update the app.' });
      }
      const owner = { userId: req.user.id, syncId, deletedAt: { $exists: true } };
      const existing = await SpecialTask.findOne(owner);
      if (existing?.lastMutationId === mutationId) {
        accepted.push({ syncId, revision: existing.revision }); continue;
      }
      if ((existing?.revision || 0) !== baseRevision) {
        conflicts.push({ syncId, serverRevision: existing?.revision || 0, task: existing }); continue;
      }
      const normalized = taskPatch(payload);
      const patch = Object.fromEntries(Object.entries(normalized).filter(([key]) => key in payload || key.replace(/[A-Z]/g, value => `_${value.toLowerCase()}`) in payload || ['taskType','target','progress','unit'].includes(key)));
      if (!patch.title || !validDate(patch.scheduledDate)) return res.status(400).json({ message: 'A title and real calendar date are required.' });
      const stamp = new Date();
      const candidate = new SpecialTask({ ...(existing?.toObject() || {}), ...patch, userId: req.user.id, syncId, revision: baseRevision + 1, syncUpdatedAt: stamp, lastMutationId: mutationId });
      if (!validDate(candidate.originalDate)) candidate.originalDate = candidate.scheduledDate;
      if (candidate.allDay) { candidate.startTime = null; candidate.deadline = null; }
      if (!validTime(candidate.startTime) || !validTime(candidate.deadline)) return res.status(400).json({ message: 'Use a valid time.' });
      candidate.recurrence = normalizeRecurrence(candidate.recurrence);
      // Keep explicit skipped/delegated decisions; progress alone must not
      // resurrect them when another device sends its snapshot.
      if (closedTaskStatuses.has(candidate.status)) candidate.completedAt = null;
      else if (candidate.taskType === 'MEASURABLE' && candidate.progress >= candidate.target) markCompleted(candidate, existing?.toObject(), candidate.completedAt || stamp);
      else if (candidate.taskType !== 'MEASURABLE' && candidate.status === 'COMPLETED') markCompleted(candidate, existing?.toObject(), candidate.completedAt || stamp);
      else if (existing?.status === 'COMPLETED' || candidate.outcome === 'COMPLETED') reopenTask(candidate, dateKey());
      else candidate.status = scheduledStatus(candidate.scheduledDate, dateKey());
      for (const key of ['originalDate', 'startTime', 'deadline', 'status', 'outcome', 'completedAt', 'resolvedAt', 'progressBeforeCompletion', 'skipReason', 'delegatedTo']) patch[key] = candidate[key];
      await candidate.validate();
      if (existing) {
        // Compare and swap: a simultaneous website write cannot slip between checking and saving.
        const result = await SpecialTask.collection.updateOne({ _id: existing._id, revision: baseRevision }, { $set: { ...patch, revision: baseRevision + 1, syncUpdatedAt: stamp, updatedAt: stamp, lastMutationId: mutationId }, $inc: { __v: 1 } });
        if (!result.modifiedCount) { conflicts.push({ syncId, serverRevision: baseRevision + 1 }); continue; }
      } else {
        try { await candidate.save(); }
        catch (error) { if (error.code === 11000) { conflicts.push({ syncId }); continue; } throw error; }
      }
      accepted.push({ syncId, revision: baseRevision + 1 });
    }
    res.json({ accepted, conflicts });
  } catch (error) { next(error); }
}

export async function pullChanges(req, res, next) {
  try {
    const cursor = req.body.cursor;
    if (cursor && (!Number.isFinite(Date.parse(cursor.time)) || !/^[0-9a-f]{24}$/i.test(cursor.id || ''))) return res.status(400).json({ message: 'Invalid sync cursor.' });
    const filter = { userId: req.user.id, deletedAt: { $exists: true } };
    if (cursor) filter.$or = [{ syncUpdatedAt: { $gt: new Date(cursor.time) } }, { syncUpdatedAt: new Date(cursor.time), _id: { $gt: cursor.id } }];
    const changes = await SpecialTask.find(filter).sort({ syncUpdatedAt: 1, _id: 1 }).limit(200);
    const last = changes.at(-1);
    res.json({ changes, cursor: last ? { time: last.syncUpdatedAt.toISOString(), id: String(last._id) } : cursor || null, hasMore: changes.length === 200 });
  } catch (error) { next(error); }
}
