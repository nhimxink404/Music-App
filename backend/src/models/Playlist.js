import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    tracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Track' }],
  },
  { timestamps: true },
);

playlistSchema.set('toJSON', {
  virtuals: true,
  transform: (_document, value) => {
    value.id = value._id.toString();
    delete value._id;
    delete value.__v;
    return value;
  },
});

export const Playlist = mongoose.model('Playlist', playlistSchema);
