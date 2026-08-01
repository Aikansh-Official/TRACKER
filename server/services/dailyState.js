import Routine from '../models/Routine.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import SpecialTask from '../models/SpecialTask.js';
import { dateKey } from '../utils/date.js';

export async function prepareDailyState(user) {
  const today = dateKey(new Date(), user.timezone);
  // A missed browser session cannot lose tasks: this runs on every protected dashboard request.
  await SpecialTask.updateMany({ userId: user._id, status: 'TODAY', scheduledDate: { $lt: today } }, { $set: { status: 'PENDING' } });
  await Routine.updateMany({ userId: user._id, status: 'ACTIVE', isTemporary: true, endDate: { $lt: today } }, { $set: { status: 'EXPIRED' } });
  const routines = await Routine.find({ userId: user._id, status: 'ACTIVE', startDate: { $lte: today }, $or: [{ isTemporary: false }, { endDate: { $gte: today } }] }).sort({ createdAt: 1 });
  await Promise.all(routines.map(routine => DailyRoutineRecord.updateOne(
    { routineId: routine._id, date: today },
    { $setOnInsert: { userId: user._id, target: routine.targetQuantity, completedQuantity: 0, completed: false } },
    { upsert: true }
  )));
  const records = await DailyRoutineRecord.find({ userId: user._id, date: today }).populate('routineId').sort({ createdAt: 1 });
  const specialTasks = await SpecialTask.find({ userId: user._id, status: { $in: ['TODAY', 'COMPLETED'] }, scheduledDate: today }).sort({ priority: -1, createdAt: 1 });
  const pendingCount = await SpecialTask.countDocuments({ userId: user._id, status: 'PENDING' });
  return { today, records: records.filter(record => record.routineId), specialTasks, pendingCount };
}
