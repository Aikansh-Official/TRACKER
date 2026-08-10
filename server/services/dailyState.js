import Routine from '../models/Routine.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import SpecialTask from '../models/SpecialTask.js';
import { dateKey } from '../utils/date.js';

const addDays = (date, amount) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };
const startOfWeek = date => { const value = new Date(`${date}T00:00:00.000Z`); const weekday = value.getUTCDay(); return addDays(date, -(weekday === 0 ? 6 : weekday - 1)); };

export async function prepareDailyState(user) {
  const today = dateKey(new Date(), user.timezone);
  // A missed browser session cannot lose tasks: this runs on every protected dashboard request.
  await SpecialTask.updateMany({ userId: user._id, status: 'TODAY', scheduledDate: { $lt: today } }, { $set: { status: 'PENDING' } });
  await Routine.updateMany({ userId: user._id, status: 'ACTIVE', isTemporary: true, endDate: { $lt: today } }, { $set: { status: 'EXPIRED' } });
  const candidates = await Routine.find({ userId: user._id, status: 'ACTIVE', startDate: { $lte: today }, $and: [{ $or: [{ pausedUntil: null }, { pausedUntil: { $lt: today } }] }, { $or: [{ isTemporary: false }, { endDate: { $gte: today } }] }] }).sort({ createdAt: 1 });
  const weekStart = startOfWeek(today);
  const weeklyRecords = await DailyRoutineRecord.find({ userId: user._id, routineId: { $in: candidates.map(routine => routine._id) }, date: { $gte: weekStart, $lte: today }, completed: true }).lean();
  const weeklyCompletions = new Map();
  weeklyRecords.forEach(record => weeklyCompletions.set(String(record.routineId), (weeklyCompletions.get(String(record.routineId)) || 0) + 1));
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const routines = candidates.filter(routine => {
    if (routine.frequency === 'WEEKDAYS') return weekday >= 1 && weekday <= 5;
    if (routine.frequency === 'WEEKENDS') return weekday === 0 || weekday === 6;
    if (routine.frequency === 'CUSTOM') return routine.scheduledDays.includes(weekday);
    if (routine.frequency === 'WEEKLY_TARGET') return (weeklyCompletions.get(String(routine._id)) || 0) < routine.weeklyTarget;
    return true;
  });
  await Promise.all(routines.map(routine => DailyRoutineRecord.updateOne(
    { routineId: routine._id, date: today },
    { $setOnInsert: { userId: user._id, target: routine.targetQuantity, completedQuantity: 0, completed: false } },
    { upsert: true }
  )));
  const records = await DailyRoutineRecord.find({ userId: user._id, date: today }).populate('routineId').sort({ createdAt: 1 });
  const specialTasks = await SpecialTask.find({ userId: user._id, status: { $in: ['TODAY', 'COMPLETED'] }, scheduledDate: today }).sort({ priority: -1, createdAt: 1 });
  const pendingCount = await SpecialTask.countDocuments({ userId: user._id, status: 'PENDING' });
  const activeRoutineIds = new Set(routines.map(routine => String(routine._id)));
  return { today, records: records.filter(record => record.routineId && activeRoutineIds.has(String(record.routineId._id))), specialTasks, pendingCount };
}
