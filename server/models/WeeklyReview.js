import mongoose from 'mongoose';

const weeklyReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekStart: { type: String, required: true, index: true },
  wins: { type: String, trim: true, maxlength: 1000, default: '' },
  lessons: { type: String, trim: true, maxlength: 1000, default: '' },
  nextWeekFocus: { type: String, trim: true, maxlength: 600, default: '' },
  rating: { type: Number, min: 1, max: 5, default: 3 },
  snapshot: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

weeklyReviewSchema.index({ userId: 1, weekStart: 1 }, { unique: true });
export default mongoose.model('WeeklyReview', weeklyReviewSchema);
