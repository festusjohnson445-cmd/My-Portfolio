import fs from 'fs';
import path from 'path';
import app from '../server';

function readFallbackHtml(): string {
  const candidates = [
    path.resolve('dist/index.html'),
    path.resolve(process.cwd(), 'dist/index.html'),
    path.resolve('index.html'),
    path.resolve(process.cwd(), 'index.html'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
      }
    } catch {
      // Ignore unreadable path
    }
  }
  return '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Fesline</title></head><body><div id="root"></div></body></html>';
}

function getHeaderString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

export default async function handler(req: any, res: any) {
  try {
    // Restore original incoming path when Vercel rewrites non-API or /api/* requests to /api/index
    const candidates = [
      getHeaderString(req.headers?.['x-vercel-original-url']),
      getHeaderString(req.headers?.['x-forwarded-uri']),
      getHeaderString(req.headers?.['x-rewrite-url']),
      getHeaderString(req.headers?.['x-matched-path']),
      getHeaderString(req.headers?.['x-vercel-matched-path']),
    ];

    const restored = candidates.find(
      (uri) =>
        uri &&
        !uri.startsWith('/api/index') &&
        !uri.startsWith('/api/[...all]')
    );

    if (restored) {
      req.url = restored;
      req.originalUrl = restored;
    } else if (
      typeof req.url === 'string' &&
      (req.url === '/api/index' ||
        req.url.startsWith('/api/index?') ||
        req.url === '/api/[...all]' ||
        req.url.startsWith('/api/[...all]?'))
    ) {
      const qIdx = req.url.indexOf('?');
      const rootUrl = qIdx >= 0 ? `/${req.url.slice(qIdx)}` : '/';
      req.url = rootUrl;
      req.originalUrl = rootUrl;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      res.once?.('finish', done);
      res.once?.('close', done);

      try {
        (app as any)(req, res, (err: any) => {
          if (err && !res.headersSent) {
            console.error('[Vercel Express Dispatch Error]:', err);
            const isApiReq = String(req.url || '').startsWith('/api/');
            if (isApiReq) {
              res.status(500).json({
                success: false,
                message: err?.message || 'Serverless API request failed.',
              });
            } else {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.status(200).send(readFallbackHtml());
            }
          }
          done();
        });
      } catch (innerErr: any) {
        console.error('[Vercel App Invocation Error]:', innerErr);
        if (!res.headersSent) {
          const isApiReq = String(req.url || '').startsWith('/api/');
          if (isApiReq) {
            res.status(500).json({
              success: false,
              message: innerErr?.message || 'Serverless function encountered an error.',
            });
          } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(readFallbackHtml());
          }
        }
        done();
      }
    });
  } catch (error: any) {
    console.error('[Vercel Serverless Function Error]:', error);
    if (!res.headersSent) {
      const isApiReq = String(req?.url || '').startsWith('/api/');
      if (isApiReq) {
        res.status(500).json({
          success: false,
          message: error?.message || 'Serverless function encountered an error.',
        });
      } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(readFallbackHtml());
      }
    }
  }
}

