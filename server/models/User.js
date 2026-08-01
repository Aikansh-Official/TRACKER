import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 60 },
  email: { type: String, trim: true, lowercase: true, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  timezone: { type: String, default: 'Asia/Kolkata' }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
