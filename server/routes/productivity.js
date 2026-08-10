import { Router } from 'express';
import DailyPlan from '../models/DailyPlan.js';
import FocusSession from '../models/FocusSession.js';
import Goal from '../models/Goal.js';
import WeeklyReview from '../models/WeeklyReview.js';
import MoodEntry from '../models/MoodEntry.js';
import Routine from '../models/Routine.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import SpecialTask from '../models/SpecialTask.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { prepareDailyState } from '../services/dailyState.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

const addDays = (date, amount) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };
const startOfWeek = date => { const value = new Date(`${date}T00:00:00.000Z`); const weekday = value.getUTCDay(); return addDays(date, -(weekday === 0 ? 6 : weekday - 1)); };
const goalView = goal => { const done = goal.milestones.filter(item => item.done).length; const total = goal.milestones.length; return { ...goal.toObject(), progress: total ? Math.round(done / total * 100) : goal.status === 'COMPLETED' ? 100 : 0 }; };

async function weeklySnapshot(userId, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const [records, tasks, focus, moods] = await Promise.all([
    DailyRoutineRecord.find({ userId, date: { $gte: weekStart, $lte: weekEnd } }).lean(),
    SpecialTask.find({ userId, originalDate: { $gte: weekStart, $lte: weekEnd } }).lean(),
    FocusSession.find({ userId, status: 'COMPLETED', startedAt: { $gte: new Date(`${weekStart}T00:00:00.000Z`), $lt: new Date(`${addDays(weekEnd, 1)}T00:00:00.000Z`) } }).lean(),
    MoodEntry.find({ userId, date: { $gte: weekStart, $lte: weekEnd } }).lean()
  ]);
  const achieved = records.reduce((sum, record) => sum + Math.min(record.completedQuantity / record.target, 1), 0) + tasks.filter(task => task.status === 'COMPLETED').length;
  const planned = records.length + tasks.filter(task => !['DROPPED', 'DELEGATED'].includes(task.status)).length;
  const focusMinutes = focus.reduce((sum, session) => sum + session.durationMinutes, 0);
  const moodAverage = moods.length ? Math.round(moods.reduce((sum, mood) => sum + mood.mood, 0) / moods.length * 10) / 10 : null;
  return {
    weekStart,
    weekEnd,
    completionScore: planned ? Math.round(achieved / planned * 100) : 0,
    planned,
    completed: Math.round(achieved * 10) / 10,
    focusMinutes,
    focusSessions: focus.length,
    averageMood: moodAverage,
    checkIns: moods.length,
    dropped: tasks.filter(task => task.status === 'DROPPED').length,
    delegated: tasks.filter(task => task.status === 'DELEGATED').length
  };
}

router.get('/overview', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'User not found.' });
    const today = dateKey(new Date(), user.timezone);
    const state = await prepareDailyState(user);
    const [plan, focusSessions, goals, mood, recentRecords, routineSettings] = await Promise.all([
      DailyPlan.findOne({ userId: req.user.id, date: today }).lean(),
      FocusSession.find({ userId: req.user.id }).sort({ startedAt: -1 }).limit(30).lean(),
      Goal.find({ userId: req.user.id, status: { $in: ['ACTIVE', 'PAUSED'] } }).sort({ createdAt: -1 }),
      MoodEntry.findOne({ userId: req.user.id, date: today }).lean(),
      DailyRoutineRecord.find({ userId: req.user.id, date: { $gte: addDays(today, -29), $lte: today } }).populate('routineId').lean(),
      Routine.find({ userId: req.user.id, status: { $in: ['ACTIVE', 'PAUSED'] } }).sort({ createdAt: -1 }).lean()
    ]);
    const routineItems = state.records.map(record => ({ id: String(record.routineId._id), type: 'ROUTINE', title: record.routineId.title, estimate: record.routineId.estimatedMinutes || 25, preferredTime: record.routineId.preferredTime, done: record.completed }));
    const taskItems = state.specialTasks.map(task => ({ id: String(task._id), type: 'TASK', title: task.title, estimate: task.estimatedMinutes || 30, preferredTime: task.preferredTime || task.deadline, done: task.status === 'COMPLETED' }));
    const items = [...routineItems, ...taskItems];
    const validPriorityIds = new Set(items.map(item => `${item.type}:${item.id}`));
    const resolvedPlan = plan || { date: today, intention: '', capacity: 'NORMAL', priorityIds: [], shutdownNote: '' };
    const cleanedPriorityIds = (resolvedPlan.priorityIds || []).filter(id => validPriorityIds.has(id));
    if (plan && cleanedPriorityIds.length !== (plan.priorityIds || []).length) {
      await DailyPlan.updateOne({ _id: plan._id }, { $set: { priorityIds: cleanedPriorityIds } });
      resolvedPlan.priorityIds = cleanedPriorityIds;
    }
    const workloadMinutes = items.filter(item => !item.done).reduce((sum, item) => sum + item.estimate, 0);
    const todayFocus = focusSessions.filter(session => dateKey(session.startedAt, user.timezone) === today && session.status === 'COMPLETED');
    const activeFocus = focusSessions.find(session => session.status === 'ACTIVE') || null;
    const suggestions = [];
    if (!resolvedPlan.priorityIds.length) suggestions.push({ id: 'priorities', tone: 'gold', title: 'Choose the day before it chooses you.', evidence: `${items.filter(item => !item.done).length} open item${items.filter(item => !item.done).length === 1 ? '' : 's'} need an order.`, action: 'Select up to three must-win priorities.' });
    if (workloadMinutes > 360) suggestions.push({ id: 'overload', tone: 'warm', title: 'The plan is carrying too much.', evidence: `${Math.round(workloadMinutes / 60 * 10) / 10} estimated hours remain.`, action: 'Drop, delegate, or reschedule a low-value task.' });
    if (mood?.sleepHours < 6) suggestions.push({ id: 'sleep', tone: 'calm', title: 'Protect energy before ambition.', evidence: `Last night’s sleep was ${mood.sleepHours} hours.`, action: 'Use shorter focus sessions and keep one essential priority.' });
    if (!todayFocus.length) suggestions.push({ id: 'focus', tone: 'violet', title: 'Attention has not been protected yet.', evidence: 'No completed focus session is saved today.', action: 'Begin with a 25-minute session.' });
    const routineStats = new Map();
    recentRecords.forEach(record => { if (!record.routineId) return; const id = String(record.routineId._id); const value = routineStats.get(id) || { title: record.routineId.title, planned: 0, achieved: 0 }; value.planned += 1; value.achieved += Math.min(record.completedQuantity / record.target, 1); routineStats.set(id, value); });
    const atRisk = [...routineStats.values()].filter(value => value.planned >= 3).map(value => ({ ...value, score: Math.round(value.achieved / value.planned * 100) })).sort((a, b) => a.score - b.score)[0];
    if (atRisk?.score < 40) suggestions.push({ id: 'routine', tone: 'slate', title: 'One routine may need redesigning.', evidence: `${atRisk.title} is at ${atRisk.score}% across ${atRisk.planned} recorded days.`, action: 'Reduce its frequency, target, or friction.' });
    res.json({
      today,
      plan: resolvedPlan,
      items,
      workloadMinutes,
      focus: { active: activeFocus, todayMinutes: todayFocus.reduce((sum, session) => sum + session.durationMinutes, 0), todaySessions: todayFocus.length, recent: focusSessions.filter(session => session.status !== 'ACTIVE').slice(0, 7) },
      goals: goals.map(goalView),
      routines: routineSettings,
      mood,
      energyGuidance: !mood ? 'Check in with your mood to unlock energy-aware planning.' : mood.stress >= 4 ? 'High stress: choose one essential win and reduce switching.' : mood.energy >= 4 && mood.focus >= 4 ? 'Strong energy and focus: protect a deep-work block for the hardest priority.' : mood.energy <= 2 ? 'Low energy: shorten sessions and choose lighter, clearly bounded work.' : 'Steady capacity: use one focused block, then reassess.',
      suggestions
    });
  } catch (error) { next(error); }
});

router.put('/plan/:date', async (req, res, next) => {
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Use a valid plan date.' });
    const priorityIds = [...new Set(Array.isArray(req.body.priorityIds) ? req.body.priorityIds.map(String) : [])].slice(0, 3);
    const plan = await DailyPlan.findOneAndUpdate(
      { userId: req.user.id, date },
      { $set: { intention: String(req.body.intention || '').slice(0, 300), capacity: ['LOW', 'NORMAL', 'HIGH'].includes(req.body.capacity) ? req.body.capacity : 'NORMAL', priorityIds, shutdownNote: String(req.body.shutdownNote || '').slice(0, 600) } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    res.json({ plan });
  } catch (error) { next(error); }
});

router.post('/focus/start', async (req, res, next) => {
  try {
    const active = await FocusSession.findOne({ userId: req.user.id, status: 'ACTIVE' });
    if (active) return res.status(409).json({ message: 'Finish or abandon the active focus session first.', session: active });
    const session = await FocusSession.create({ userId: req.user.id, taskType: req.body.taskType || 'GENERAL', taskId: req.body.taskId || null, title: String(req.body.title || 'Focus session').slice(0, 120), plannedMinutes: Number(req.body.plannedMinutes || 25) });
    res.status(201).json({ session });
  } catch (error) { next(error); }
});

router.patch('/focus/:id', async (req, res, next) => {
  try {
    const session = await FocusSession.findOne({ _id: req.params.id, userId: req.user.id, status: 'ACTIVE' });
    if (!session) return res.status(404).json({ message: 'Active focus session not found.' });
    if (req.body.status === 'ACTIVE') {
      session.distractions = Math.max(0, Number(req.body.distractions || 0));
      session.note = String(req.body.note || '').slice(0, 500);
      await session.save();
      return res.json({ session });
    }
    const status = req.body.status === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED';
    const endedAt = new Date();
    const elapsed = Math.max(1, Math.round((endedAt - session.startedAt) / 60000));
    session.status = status;
    session.endedAt = endedAt;
    session.durationMinutes = Math.min(Number(req.body.durationMinutes || elapsed), 480);
    session.distractions = Math.max(0, Number(req.body.distractions || 0));
    session.note = String(req.body.note || '').slice(0, 500);
    await session.save();
    res.json({ session });
  } catch (error) { next(error); }
});

router.get('/goals', async (req, res, next) => { try { const goals = await Goal.find({ userId: req.user.id }).sort({ createdAt: -1 }); res.json({ goals: goals.map(goalView) }); } catch (error) { next(error); } });

router.post('/goals', async (req, res, next) => {
  try {
    if (!String(req.body.title || '').trim()) return res.status(400).json({ message: 'Give the goal a clear title.' });
    const milestones = (Array.isArray(req.body.milestones) ? req.body.milestones : []).map(title => ({ title: String(title).trim() })).filter(item => item.title).slice(0, 20);
    const goal = await Goal.create({ userId: req.user.id, title: req.body.title, description: req.body.description || '', lifeArea: req.body.lifeArea || 'PERSONAL', targetDate: req.body.targetDate || null, milestones });
    res.status(201).json({ goal: goalView(goal) });
  } catch (error) { next(error); }
});

router.patch('/goals/:id', async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'lifeArea', 'targetDate', 'status'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, changes, { returnDocument: 'after', runValidators: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ goal: goalView(goal) });
  } catch (error) { next(error); }
});

router.patch('/goals/:id/milestones/:milestoneId', async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found.' });
    milestone.done = req.body.done !== false;
    milestone.completedAt = milestone.done ? new Date() : null;
    if (goal.milestones.length && goal.milestones.every(item => item.done)) goal.status = 'COMPLETED';
    else if (goal.status === 'COMPLETED') goal.status = 'ACTIVE';
    await goal.save();
    res.json({ goal: goalView(goal) });
  } catch (error) { next(error); }
});

router.get('/weekly-review', async (req, res, next) => {
  try {
    const today = dateKey();
    const weekStart = req.query.weekStart || startOfWeek(today);
    const [review, snapshot] = await Promise.all([WeeklyReview.findOne({ userId: req.user.id, weekStart }).lean(), weeklySnapshot(req.user.id, weekStart)]);
    res.json({ review: review || { weekStart, wins: '', lessons: '', nextWeekFocus: '', rating: 3 }, snapshot });
  } catch (error) { next(error); }
});

router.put('/weekly-review/:weekStart', async (req, res, next) => {
  try {
    const weekStart = req.params.weekStart;
    const snapshot = await weeklySnapshot(req.user.id, weekStart);
    const review = await WeeklyReview.findOneAndUpdate(
      { userId: req.user.id, weekStart },
      { $set: { wins: String(req.body.wins || '').slice(0, 1000), lessons: String(req.body.lessons || '').slice(0, 1000), nextWeekFocus: String(req.body.nextWeekFocus || '').slice(0, 600), rating: Math.min(5, Math.max(1, Number(req.body.rating || 3))), snapshot } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    res.json({ review, snapshot });
  } catch (error) { next(error); }
});

router.get('/export', async (req, res, next) => {
  try {
    const [user, plans, routines, records, tasks, moods, focusSessions, goals, weeklyReviews] = await Promise.all([
      User.findById(req.user.id).select('name email timezone createdAt').lean(),
      DailyPlan.find({ userId: req.user.id }).lean(),
      Routine.find({ userId: req.user.id }).lean(),
      DailyRoutineRecord.find({ userId: req.user.id }).lean(),
      SpecialTask.find({ userId: req.user.id }).lean(),
      MoodEntry.find({ userId: req.user.id }).lean(),
      FocusSession.find({ userId: req.user.id }).lean(),
      Goal.find({ userId: req.user.id }).lean(),
      WeeklyReview.find({ userId: req.user.id }).lean()
    ]);
    res.json({ exportedAt: new Date().toISOString(), user, plans, routines, records, tasks, moods, focusSessions, goals, weeklyReviews });
  } catch (error) { next(error); }
});

export default router;
