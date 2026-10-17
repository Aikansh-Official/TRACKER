export const closedTaskStatuses = new Set(['SKIPPED', 'DROPPED', 'DELEGATED', 'ARCHIVED']);

export const scheduledStatus = (scheduledDate, today) => scheduledDate < today ? 'PENDING' : scheduledDate > today ? 'SCHEDULED' : 'TODAY';

export async function refreshTaskStatuses(userId, today) {
  await SpecialTask.updateMany({ userId, status: { $in: ['TODAY', 'SCHEDULED'] }, scheduledDate: { $lt: today } }, { $set: { status: 'PENDING' } });
  await SpecialTask.updateMany({ userId, status: { $in: ['SCHEDULED', 'PENDING'] }, scheduledDate: today }, { $set: { status: 'TODAY' } });
}

// All completion paths must record the same history. Editing a completed task
// must not make it look as if it was completed again today.
export function markCompleted(task, previous = {}, now = new Date()) {
  const alreadyCompleted = previous.status === 'COMPLETED';
  if (!alreadyCompleted && task.taskType === 'MEASURABLE') task.progressBeforeCompletion = Math.min(previous.progress || 0, task.target - 1);
  task.status = 'COMPLETED';
  task.outcome = 'COMPLETED';
  task.completedAt = alreadyCompleted ? previous.completedAt || now : now;
  task.resolvedAt = alreadyCompleted ? previous.resolvedAt || task.completedAt : task.completedAt;
  task.skipReason = '';
  task.delegatedTo = '';
}

export function reopenTask(task, today, { restoreProgress = false } = {}) {
  if (restoreProgress && task.taskType === 'MEASURABLE') task.progress = Math.max(0, Math.min(task.progressBeforeCompletion || 0, task.target - 1));
  task.status = scheduledStatus(task.scheduledDate, today);
  task.outcome = null;
  task.completedAt = null;
  task.resolvedAt = null;
  task.progressBeforeCompletion = null;
  task.skipReason = '';
  task.delegatedTo = '';
}
import SpecialTask from '../models/SpecialTask.js';

