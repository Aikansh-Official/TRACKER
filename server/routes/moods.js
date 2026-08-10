import { Router } from 'express';
import MoodEntry, { emotionValues, factorValues } from '../models/MoodEntry.js';
import DailyRoutineRecord from '../models/DailyRoutineRecord.js';
import { requireAuth } from '../middleware/auth.js';
import { dateKey } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const pearson = pairs => {
  if (pairs.length < 3) return null;
  const xMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const yMean = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let numerator = 0; let xSquare = 0; let ySquare = 0;
  for (const [x, y] of pairs) { const dx = x - xMean; const dy = y - yMean; numerator += dx * dy; xSquare += dx * dx; ySquare += dy * dy; }
  if (!xSquare || !ySquare) return 0;
  return Math.round((numerator / Math.sqrt(xSquare * ySquare)) * 100) / 100;
};

router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: req.query.from } : {}), ...(req.query.to ? { $lte: req.query.to } : {}) };
    const limit = Math.min(Math.max(Number(req.query.limit) || 120, 1), 366);
    res.json({ entries: await MoodEntry.find(filter).sort({ date: -1 }).limit(limit) });
  } catch (error) { next(error); }
});

router.put('/:date', async (req, res, next) => {
  try {
    const date = req.params.date === 'today' ? dateKey() : req.params.date;
    if (!validDate(date)) return res.status(400).json({ message: 'Use a valid date in YYYY-MM-DD format.' });
    const allowed = ['mood', 'energy', 'stress', 'focus', 'sleepHours', 'emotions', 'factors', 'note'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    for (const field of ['mood', 'energy', 'stress', 'focus']) {
      changes[field] = Number(changes[field]);
      if (!Number.isInteger(changes[field]) || changes[field] < 1 || changes[field] > 5) return res.status(400).json({ message: `${field} must be a whole number from 1 to 5.` });
    }
    changes.sleepHours = Number(changes.sleepHours || 0);
    changes.emotions = [...new Set(Array.isArray(changes.emotions) ? changes.emotions : [])].filter(value => emotionValues.includes(value)).slice(0, 5);
    changes.factors = [...new Set(Array.isArray(changes.factors) ? changes.factors : [])].filter(value => factorValues.includes(value)).slice(0, 5);
    const entry = await MoodEntry.findOneAndUpdate(
      { userId: req.user.id, date },
      { $set: changes, $setOnInsert: { userId: req.user.id, date } },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );
    res.json({ entry });
  } catch (error) { next(error); }
});

router.get('/analytics/overview', async (req, res, next) => {
  try {
    const entries = await MoodEntry.find({ userId: req.user.id }).sort({ date: 1 }).limit(366).lean();
    if (!entries.length) return res.json({ empty: true, entries: [], summary: null, distribution: [], emotions: [], weekdays: [], correlations: null });
    const records = await DailyRoutineRecord.find({ userId: req.user.id, date: { $in: entries.map(entry => entry.date) } }).lean();
    const completionByDate = new Map();
    for (const record of records) {
      const value = completionByDate.get(record.date) || { achieved: 0, planned: 0 };
      value.achieved += Math.min(record.completedQuantity / record.target, 1); value.planned += 1; completionByDate.set(record.date, value);
    }
    const enriched = entries.map(entry => { const progress = completionByDate.get(entry.date); return { ...entry, completionScore: progress?.planned ? Math.round(progress.achieved / progress.planned * 100) : null }; });
    const average = field => Math.round(enriched.reduce((sum, entry) => sum + entry[field], 0) / enriched.length * 10) / 10;
    const distribution = [1, 2, 3, 4, 5].map(value => ({ value, count: enriched.filter(entry => entry.mood === value).length }));
    const emotionCounts = new Map(); enriched.forEach(entry => entry.emotions.forEach(value => emotionCounts.set(value, (emotionCounts.get(value) || 0) + 1)));
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, weekday) => { const values = enriched.filter(entry => new Date(`${entry.date}T00:00:00Z`).getUTCDay() === weekday); return { label, count: values.length, mood: values.length ? Math.round(values.reduce((sum, entry) => sum + entry.mood, 0) / values.length * 10) / 10 : null }; });
    const comparable = enriched.filter(entry => entry.completionScore !== null);
    res.json({
      empty: false,
      entries: enriched,
      summary: { days: enriched.length, mood: average('mood'), energy: average('energy'), stress: average('stress'), focus: average('focus'), sleepHours: average('sleepHours') },
      distribution,
      emotions: [...emotionCounts.entries()].map(([emotion, count]) => ({ emotion, count })).sort((a, b) => b.count - a.count),
      weekdays,
      correlations: { sampleSize: comparable.length, moodCompletion: pearson(comparable.map(entry => [entry.mood, entry.completionScore])), energyCompletion: pearson(comparable.map(entry => [entry.energy, entry.completionScore])), stressCompletion: pearson(comparable.map(entry => [entry.stress, entry.completionScore])) }
    });
  } catch (error) { next(error); }
});

export default router;
