import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateSuggestion, retrieveHistory } from '../services/suggestions.js';

const router = Router();
router.use(requireAuth);
router.post('/', async (req, res, next) => {
  try {
    if (req.body.consent !== true) return res.status(400).json({ message: 'Choose to share selected task history, focus notes, and weekly reflections with OpenAI first.' });
    const query = req.body.query;
    if (typeof query !== 'string' || !query.trim() || query.length > 500) return res.status(400).json({ message: 'Describe your planning question in 1–500 characters.' });
    const sources = await retrieveHistory(req.user.id, query);
    if (sources.length < 2) return res.json({ suggestion: null, sources, message: 'Not enough recent history yet. Add tasks or record focus sessions and reflections first.' });
    if (process.env.AI_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || !process.env.AI_MODEL) return res.status(503).json({ message: 'AI is disabled or not configured. Planning works normally without it.' });
    res.json({ suggestion: await generateSuggestion(query, sources), sources });
  } catch (error) { next(error); }
});
export default router;
