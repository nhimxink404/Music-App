import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true, unique: true },
  },
  { timestamps: true },
);

export const Favorite = mongoose.model('Favorite', favoriteSchema);
