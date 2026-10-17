import test from 'node:test';
import assert from 'node:assert/strict';
import { planningTaskPayload, routineScheduledOn, shiftPlanningDate, visiblePlanningTask } from '../src/planningModel.js';

const taskForm = overrides => ({
  title: '  Review graphs  ', description: 'Practice traversal', scheduledDate: '2026-10-16', itemType: 'TASK',
  taskType: 'ONE_TIME', target: 1, progress: 0, unit: 'times', allDay: true, startTime: '', deadline: '',
  recurrence: { frequency: 'NONE' }, subtasks: [], ...overrides,
});

test('planning date navigation crosses month/year and leap-day boundaries without spilling months', () => {
  assert.equal(shiftPlanningDate('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(shiftPlanningDate('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(shiftPlanningDate('2026-03-31', -1, 'month'), '2026-02-28');
  assert.equal(shiftPlanningDate('2026-12-31', 1, 'month'), '2027-01-31');
  assert.equal(shiftPlanningDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftPlanningDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftPlanningDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftPlanningDate('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftPlanningDate('2026-10-16', 7), '2026-10-23');
});

test('planning shows actionable and completed tasks while excluding resolved or deleted records', () => {
  for (const status of ['TODAY', 'PENDING', 'SCHEDULED', 'COMPLETED']) assert.equal(visiblePlanningTask({ status }), true, status);
  for (const status of ['ARCHIVED', 'DROPPED', 'DELEGATED', 'SKIPPED']) assert.equal(visiblePlanningTask({ status }), false, status);
  assert.equal(visiblePlanningTask({ status: 'TODAY', deletedAt: '2026-10-16T10:00:00Z' }), false);
});

test('routine schedules respect inclusive active dates and pause dates', () => {
  const routine = { status: 'ACTIVE', frequency: 'DAILY', startDate: '2026-10-16', endDate: '2026-10-20' };
  assert.equal(routineScheduledOn(routine, '2026-10-15'), false);
  assert.equal(routineScheduledOn(routine, '2026-10-16'), true);
  assert.equal(routineScheduledOn(routine, '2026-10-20'), true);
  assert.equal(routineScheduledOn(routine, '2026-10-21'), false);
  assert.equal(routineScheduledOn({ ...routine, pausedUntil: '2026-10-17' }, '2026-10-17'), false);
  assert.equal(routineScheduledOn({ ...routine, pausedUntil: '2026-10-17' }, '2026-10-18'), true);
  for (const status of ['PAUSED', 'ARCHIVED', 'EXPIRED']) assert.equal(routineScheduledOn({ ...routine, status }, '2026-10-16'), false, status);
});

test('calendar distinguishes fixed weekdays from flexible weekly targets', () => {
  const routine = { status: 'ACTIVE', startDate: '2026-10-01' };
  assert.equal(routineScheduledOn({ ...routine, frequency: 'WEEKDAYS' }, '2026-10-16'), true);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'WEEKDAYS' }, '2026-10-17'), false);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'WEEKENDS' }, '2026-10-18'), true);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'WEEKENDS' }, '2026-10-19'), false);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'CUSTOM', scheduledDays: [1, 5] }, '2026-10-16'), true);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'CUSTOM', scheduledDays: [1, 5] }, '2026-10-17'), false);
  assert.equal(routineScheduledOn({ ...routine, frequency: 'WEEKLY_TARGET', weeklyTarget: 3 }, '2026-10-16'), false, 'A flexible weekly goal cannot be assigned to every calendar day without completion history');
});

test('editing timed events preserves their times and all-day tasks clear obsolete times', () => {
  const timed = taskForm({ itemType: 'EVENT', allDay: false, startTime: '09:30', deadline: '10:15', reminderMinutes: 15 });
  const payload = planningTaskPayload(timed, { creating: false });
  assert.equal(payload.itemType, 'EVENT');
  assert.equal(payload.startTime, '09:30');
  assert.equal(payload.deadline, '10:15');
  assert.equal(payload.reminderMinutes, 15);
  assert.equal(payload.scheduledDate, timed.scheduledDate);
  assert.equal(payload.title, 'Review graphs');
  assert.equal(timed.title, '  Review graphs  ', 'Preparing a save does not mutate the form');
  const allDay = planningTaskPayload({ ...timed, allDay: true });
  assert.equal(allDay.startTime, null);
  assert.equal(allDay.deadline, null);
  const deadlineOnly = planningTaskPayload(taskForm({ allDay: false, deadline: '18:00' }));
  assert.equal(deadlineOnly.startTime, null);
  assert.equal(deadlineOnly.deadline, '18:00');
});

test('task saves reject missing times, reversed time ranges, and invalid measurable progress', () => {
  assert.throws(() => planningTaskPayload(taskForm({ allDay: false })), /start time or deadline/);
  assert.throws(() => planningTaskPayload(taskForm({ allDay: false, startTime: '14:00', deadline: '13:00' })), /after the start time/);
  assert.throws(() => planningTaskPayload(taskForm({ title: '   ' })), /title/);
  assert.throws(() => planningTaskPayload(taskForm({ scheduledDate: '' })), /date/);
  const measured = taskForm({ taskType: 'MEASURABLE', target: '5', progress: '2', unit: ' questions ' });
  assert.deepEqual(Object.fromEntries(Object.entries(planningTaskPayload(measured)).filter(([key]) => ['target', 'progress', 'unit'].includes(key))), { target: 5, progress: 2, unit: 'questions' });
  for (const change of [{ target: 0 }, { target: 1.5 }, { progress: -1 }, { progress: 6 }, { unit: ' ' }]) assert.throws(() => planningTaskPayload({ ...measured, ...change }), /target/);
});

test('repeat validation applies to new series without blocking edits to individual occurrences', () => {
  const form = taskForm({ recurrence: { frequency: 'DAILY', endDate: '2026-10-15' } });
  assert.throws(() => planningTaskPayload(form), /Repeat until/);
  assert.doesNotThrow(() => planningTaskPayload(form, { creating: false }));
  assert.doesNotThrow(() => planningTaskPayload({ ...form, recurrence: { frequency: 'DAILY', endDate: '2026-10-16' } }));
});
