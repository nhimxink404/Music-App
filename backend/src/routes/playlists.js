import express from 'express';
import mongoose from 'mongoose';
import { Playlist } from '../models/Playlist.js';
import { Track } from '../models/Track.js';

export const playlistsRouter = express.Router();

function assertId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw Object.assign(new Error('ID khong hop le.'), { status: 400 });
  }
}

function playlistName(value) {
  const name = String(value || '').trim();
  if (!name) throw Object.assign(new Error('Ten playlist khong duoc de trong.'), { status: 400 });
  return name;
}

playlistsRouter.get('/', async (_request, response, next) => {
  try {
    const playlists = await Playlist.find().sort({ updatedAt: -1 }).populate('tracks');
    response.json({ playlists });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.post('/', async (request, response, next) => {
  try {
    const playlist = await Playlist.create({
      name: playlistName(request.body.name),
      description: String(request.body.description || '').trim(),
    });
    response.status(201).json({ playlist });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.patch('/:id', async (request, response, next) => {
  try {
    assertId(request.params.id);
    const update = {};
    if (request.body.name !== undefined) update.name = playlistName(request.body.name);
    if (request.body.description !== undefined) update.description = String(request.body.description || '').trim();
    const playlist = await Playlist.findByIdAndUpdate(request.params.id, update, { new: true, runValidators: true }).populate('tracks');
    if (!playlist) throw Object.assign(new Error('Khong tim thay playlist.'), { status: 404 });
    response.json({ playlist });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.post('/:id/tracks', async (request, response, next) => {
  try {
    assertId(request.params.id);
    assertId(request.body.trackId);
    const track = await Track.exists({ _id: request.body.trackId });
    if (!track) throw Object.assign(new Error('Khong tim thay bai hat.'), { status: 404 });
    const playlist = await Playlist.findByIdAndUpdate(
      request.params.id,
      { $addToSet: { tracks: request.body.trackId } },
      { new: true },
    ).populate('tracks');
    if (!playlist) throw Object.assign(new Error('Khong tim thay playlist.'), { status: 404 });
    response.json({ playlist });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.delete('/:id/tracks/:trackId', async (request, response, next) => {
  try {
    assertId(request.params.id);
    assertId(request.params.trackId);
    const playlist = await Playlist.findByIdAndUpdate(
      request.params.id,
      { $pull: { tracks: request.params.trackId } },
      { new: true },
    ).populate('tracks');
    if (!playlist) throw Object.assign(new Error('Khong tim thay playlist.'), { status: 404 });
    response.json({ playlist });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.delete('/:id', async (request, response, next) => {
  try {
    assertId(request.params.id);
    const playlist = await Playlist.findByIdAndDelete(request.params.id);
    if (!playlist) throw Object.assign(new Error('Khong tim thay playlist.'), { status: 404 });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
