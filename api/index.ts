import express from 'express';
import { createApiRouter } from '../src/server/apiApp';

const app = express();
app.disable('x-powered-by');

const apiRouter = createApiRouter();

// Mount on both /api and / so Vercel rewrites work regardless of whether the /api prefix is preserved or stripped
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
