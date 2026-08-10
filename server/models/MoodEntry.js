import mongoose from 'mongoose';

const emotionValues = ['CALM', 'MOTIVATED', 'HAPPY', 'GRATEFUL', 'ANXIOUS', 'TIRED', 'OVERWHELMED', 'SAD', 'ANGRY', 'LONELY'];
const factorValues = ['STUDY', 'WORK', 'HEALTH', 'RELATIONSHIPS', 'FINANCES', 'WEATHER', 'SLEEP', 'EXERCISE', 'SOCIAL', 'OTHER'];

const moodEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  mood: { type: Number, required: true, min: 1, max: 5 },
  energy: { type: Number, required: true, min: 1, max: 5 },
  stress: { type: Number, required: true, min: 1, max: 5 },
  focus: { type: Number, required: true, min: 1, max: 5 },
  sleepHours: { type: Number, min: 0, max: 24, default: 0 },
  emotions: [{ type: String, enum: emotionValues }],
  factors: [{ type: String, enum: factorValues }],
  note: { type: String, trim: true, maxlength: 600, default: '' }
}, { timestamps: true });

moodEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export { emotionValues, factorValues };
export default mongoose.model('MoodEntry', moodEntrySchema);
