import app from '../server';

export default async function handler(req: any, res: any) {
  try {
    // Restore original incoming path when Vercel rewrites non-API or /api/* requests to /api/index
    const forwardedUri =
      req.headers['x-vercel-original-url'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-rewrite-url'] ||
      req.headers['x-matched-path'] ||
      req.headers['x-vercel-matched-path'];

    if (
      forwardedUri &&
      typeof forwardedUri === 'string' &&
      !forwardedUri.startsWith('/api/index') &&
      !forwardedUri.startsWith('/api/[...all]')
    ) {
      req.url = forwardedUri;
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
