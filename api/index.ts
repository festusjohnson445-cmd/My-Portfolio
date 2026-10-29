import app from '../server';

export default async function handler(req: any, res: any) {
  try {
    // If Vercel rewrote the URL to /api/index, restore the original incoming path
    const matchedPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
    if (matchedPath && typeof matchedPath === 'string') {
      req.url = matchedPath;
    }

    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[Vercel Serverless Function Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error?.message || 'Serverless function encountered an error.',
      });
    }
  }
}
