import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { favoritesRouter } from './routes/favorites.js';
import { playlistsRouter } from './routes/playlists.js';
import { tracksRouter } from './routes/tracks.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientOrigin.split(',').map((origin) => origin.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/tracks', tracksRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/playlists', playlistsRouter);

app.use(notFound);
app.use(errorHandler);
