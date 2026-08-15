import mongoose from 'mongoose';

const dailyRoutineRecordSchema = new mongoose.Schema({
  routineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  target: { type: Number, required: true, min: 1 },
  completedQuantity: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: false },
  skipped: { type: Boolean, default: false },
  skipReason: { type: String, trim: true, maxlength: 180, default: '' }
}, { timestamps: true });

dailyRoutineRecordSchema.index({ routineId: 1, date: 1 }, { unique: true });
dailyRoutineRecordSchema.index({ userId: 1, date: 1 });
export default mongoose.model('DailyRoutineRecord', dailyRoutineRecordSchema);
