import express from 'express';
import mongoose from 'mongoose';
import { Favorite } from '../models/Favorite.js';
import { Track } from '../models/Track.js';

export const favoritesRouter = express.Router();

favoritesRouter.get('/', async (_request, response, next) => {
  try {
    const favorites = await Favorite.find().sort({ createdAt: -1 }).populate('track');
    response.json({ tracks: favorites.map((favorite) => favorite.track).filter(Boolean) });
  } catch (error) {
    next(error);
  }
});

favoritesRouter.post('/:trackId', async (request, response, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(request.params.trackId)) {
      throw Object.assign(new Error('ID bai hat khong hop le.'), { status: 400 });
    }
    const track = await Track.findById(request.params.trackId);
    if (!track) throw Object.assign(new Error('Khong tim thay bai hat.'), { status: 404 });
    await Favorite.updateOne({ track: track._id }, { $setOnInsert: { track: track._id } }, { upsert: true });
    response.status(201).json({ track });
  } catch (error) {
    next(error);
  }
});

favoritesRouter.delete('/:trackId', async (request, response, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(request.params.trackId)) {
      throw Object.assign(new Error('ID bai hat khong hop le.'), { status: 400 });
    }
    await Favorite.deleteOne({ track: request.params.trackId });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
