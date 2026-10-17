export const visiblePlanningTask = task => !task.deletedAt && !['ARCHIVED', 'DROPPED', 'DELEGATED', 'SKIPPED'].includes(task.status);

export function shiftPlanningDate(date, amount, unit = 'day') {
  const value = new Date(`${date}T12:00:00`);
  if (unit === 'month') {
    const day = value.getDate();
    value.setDate(1);
    value.setMonth(value.getMonth() + amount);
    value.setDate(Math.min(day, new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()));
  } else value.setDate(value.getDate() + amount);
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function routineScheduledOn(routine, date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (routine.status !== 'ACTIVE' || (routine.startDate && date < routine.startDate) || (routine.endDate && date > routine.endDate) || (routine.pausedUntil && date <= routine.pausedUntil)) return false;
  if (routine.frequency === 'WEEKDAYS') return day > 0 && day < 6;
  if (routine.frequency === 'WEEKENDS') return day === 0 || day === 6;
  if (routine.frequency === 'CUSTOM') return (routine.scheduledDays || []).includes(day);
  return routine.frequency === 'DAILY';
}

export function planningTaskPayload(form, { creating = true } = {}) {
  const title = form.title.trim();
  if (!title) throw new Error('Give this task or event a title.');
  if (!form.scheduledDate) throw new Error('Choose a date.');
  if (!form.allDay && !form.startTime && !form.deadline) throw new Error('Add a start time or deadline, or choose All day.');
  if (!form.allDay && form.startTime && form.deadline && form.deadline < form.startTime) throw new Error('The end time or deadline must be after the start time on this date.');
  if (creating && form.recurrence?.frequency !== 'NONE' && form.recurrence?.endDate && form.recurrence.endDate < form.scheduledDate) throw new Error('Repeat until must be on or after the first date.');
  const target = Number(form.target), progress = Number(form.progress);
  if (form.taskType === 'MEASURABLE' && (!Number.isInteger(target) || target < 1 || target > 1000000 || !Number.isInteger(progress) || progress < 0 || progress > target || !form.unit.trim())) throw new Error('Set a positive whole-number target, a unit, and progress between zero and the target.');
  return {
    title, description: form.description, itemType: form.itemType || 'TASK', scheduledDate: form.scheduledDate,
    taskType: form.taskType, target: form.taskType === 'MEASURABLE' ? target : 1,
    progress: form.taskType === 'MEASURABLE' ? progress : 0, unit: form.taskType === 'MEASURABLE' ? form.unit.trim() : 'times',
    allDay: form.allDay, startTime: form.allDay ? null : form.startTime || null, deadline: form.allDay ? null : form.deadline || null,
    priority: form.priority || 'MEDIUM', estimatedMinutes: Number(form.estimatedMinutes || 30),
    reminderMinutes: form.reminderMinutes ?? null, recurrence: form.recurrence,
    subtasks: (form.subtasks || []).filter(step => step.title.trim()),
  };
}
