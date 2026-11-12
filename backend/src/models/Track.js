import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    filename: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true, index: true },
    mimeType: { type: String, default: 'audio/mpeg' },
    size: { type: Number, required: true, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    artist: { type: String, default: '' },
    album: { type: String, default: '' },
    source: { type: String, enum: ['telegram', 'upload', 'filesystem'], default: 'filesystem' },
    telegramFileId: { type: String, default: '' },
  },
  { timestamps: true },
);

trackSchema.set('toJSON', {
  virtuals: true,
  transform: (_document, value) => {
    value.id = value._id.toString();
    delete value._id;
    delete value.__v;
    delete value.storageKey;
    delete value.telegramFileId;
    return value;
  },
});

export const Track = mongoose.model('Track', trackSchema);
