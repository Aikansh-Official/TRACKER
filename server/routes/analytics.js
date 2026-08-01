import { Router } from 'express';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import SpecialTask from '../models/SpecialTask.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

const addDays = (date, amount) => { const next = new Date(`${date}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + amount); return next.toISOString().slice(0, 10); };
const daysBetween = (start, end) => { const dates = []; for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date); return dates; };

router.get('/overview', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const today = dateKey(new Date(), user?.timezone);
    const [records, tasks] = await Promise.all([
      DailyRoutineRecord.find({ userId: req.user.id }).populate('routineId').sort({ date: 1 }),
      SpecialTask.find({ userId: req.user.id, status: { $ne: 'ARCHIVED' } }).sort({ scheduledDate: 1 })
    ]);
    const validRecords = records.filter(record => record.routineId);
    const allDates = [...validRecords.map(record => record.date), ...tasks.map(task => task.status === 'COMPLETED' ? task.scheduledDate : task.originalDate)].filter(Boolean).sort();
    if (!allDates.length) return res.json({ empty: true, summary: { currentStreak: 0, bestStreak: 0, activeDays: 0, average: 0 }, daily: [], categories: [], routines: [], heatmap: [] });

    const start = allDates[0]; const dates = daysBetween(start, today);
    const byDate = new Map(dates.map(date => [date, { date, achieved: 0, planned: 0, routines: 0, tasks: 0 }]));
    const categoryTotals = new Map(); const categoryByDate = new Map(); const routineTotals = new Map();
    for (const record of validRecords) {
      const day = byDate.get(record.date) || { date: record.date, achieved: 0, planned: 0, routines: 0, tasks: 0 };
      day.planned += 1; day.achieved += Math.min(record.completedQuantity / record.target, 1); day.routines += 1; byDate.set(record.date, day);
      const category = record.routineId.category || 'OTHER'; const categoryValue = categoryTotals.get(category) || { category, achieved: 0, planned: 0, routines: new Set() };
      categoryValue.achieved += Math.min(record.completedQuantity / record.target, 1); categoryValue.planned += 1; categoryValue.routines.add(String(record.routineId._id)); categoryTotals.set(category, categoryValue);
      const categoryDates = categoryByDate.get(category) || new Map(); const categoryDay = categoryDates.get(record.date) || { achieved: 0, planned: 0 }; categoryDay.achieved += Math.min(record.completedQuantity / record.target, 1); categoryDay.planned += 1; categoryDates.set(record.date, categoryDay); categoryByDate.set(category, categoryDates);
      const routineId = String(record.routineId._id); const routineValue = routineTotals.get(routineId) || { id: routineId, title: record.routineId.title, category, achieved: 0, planned: 0, days: 0 };
      routineValue.achieved += Math.min(record.completedQuantity / record.target, 1); routineValue.planned += 1; routineValue.days += 1; routineTotals.set(routineId, routineValue);
    }
    for (const task of tasks) { const date = task.status === 'COMPLETED' ? task.scheduledDate : task.originalDate; const day = byDate.get(date) || { date, achieved: 0, planned: 0, routines: 0, tasks: 0 }; day.planned += 1; day.achieved += task.status === 'COMPLETED' ? 1 : 0; day.tasks += 1; byDate.set(date, day); }
    const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(day => ({ ...day, score: day.planned ? Math.round(day.achieved / day.planned * 100) : 0 }));
    const finishedDays = daily.filter(day => day.planned > 0); const average = finishedDays.length ? Math.round(finishedDays.reduce((sum, day) => sum + day.score, 0) / finishedDays.length) : 0;
    const monthlyMap = new Map(); for (const day of daily) { if (!day.planned) continue; const month = day.date.slice(0, 7); const value = monthlyMap.get(month) || { month, achieved: 0, planned: 0, days: 0 }; value.achieved += day.achieved; value.planned += day.planned; value.days += 1; monthlyMap.set(month, value); }
    let currentStreak = 0; let bestStreak = 0; let running = 0;
    for (const day of daily) { if (day.planned > 0 && day.score === 100) { running += 1; bestStreak = Math.max(bestStreak, running); } else if (day.date !== today || day.planned > 0) running = 0; }
    for (let index = daily.length - (daily.at(-1)?.date === today && daily.at(-1)?.score < 100 ? 2 : 1); index >= 0; index -= 1) { const day = daily[index]; if (day?.planned > 0 && day.score === 100) currentStreak += 1; else break; }
    res.json({
      empty: false,
      summary: { currentStreak, bestStreak, activeDays: finishedDays.length, average },
      daily,
      monthly: [...monthlyMap.values()].map(value => ({ ...value, completed: Math.round(value.achieved * 10) / 10, score: Math.round(value.achieved / value.planned * 100) })),
      categories: [...categoryTotals.values()].map(value => ({ category: value.category, score: Math.round(value.achieved / value.planned * 100), routines: value.routines.size })).sort((a, b) => b.score - a.score),
      categorySeries: [...categoryByDate.entries()].map(([category, dates]) => ({ category, points: daily.map(day => { const value = dates.get(day.date); return { date: day.date, score: value ? Math.round(value.achieved / value.planned * 100) : null }; }) })),
      variance: finishedDays.slice(-42).map(day => ({ date: day.date, value: day.score - average })),
      routines: [...routineTotals.values()].map(value => ({ ...value, score: Math.round(value.achieved / value.planned * 100) })).sort((a, b) => b.score - a.score),
      heatmap: daily.slice(-84).map(day => ({ date: day.date, score: day.score, active: day.planned > 0 }))
    });
  } catch (error) { next(error); }
});

export default router;
