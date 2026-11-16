import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import compression from 'compression';
import crypto from 'crypto';
import multer from 'multer';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  getGlobalProfileFromDb,
  saveGlobalProfileToDb,
  getProfilePictureFromDb,
  saveProfilePictureToDb,
  deleteProfilePictureFromDb,
  getDocumentsFromDb,
  getDocumentByIdFromDb,
  saveDocumentToDb,
  deleteDocumentFromDb,
  incrementDocumentDownloadCountInDb,
  getDeletedDocumentIdsFromDb,
  getConversationsFromDb,
  saveConversationToDb,
  saveConversationsBatchToDb,
  deleteConversationFromDb,
  deleteMessageFromDb,
  updateMessageInDb,
  getDeletedConversationIdsFromDb,
  getLearningSessionsFromDb,
  getLearningSessionByIdFromDb,
  saveLearningSessionToDb,
  deleteLearningSessionFromDb,
} from './src/db/storage.ts';

const app = express();
const PORT = process.env.PORT || 3000;

// Instant health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'ok', port: Number(PORT), timestamp: new Date().toISOString() });
});

// Enable Gzip and Brotli compression for fast loading and reduced bandwidth
app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Initialize Google Gen AI with server-side API Key & 120s timeout
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
    timeout: 120000,
  },
});

// Set 300MB payload limit to handle large PDF books, complex technical drawings, and 3D CAD models
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ extended: true, limit: '300mb' }));

const DATA_DIR = path.resolve(process.cwd(), 'data');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure local cache directories exist (guarded for read-only serverless environments like Vercel)
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // Silent fallback on read-only serverless filesystems
}

// Clean error message helper to parse stringified JSON error objects from Gemini SDK
function cleanErrorMessage(err: any): string {
  let msg = err?.message || 'An error occurred';
  if (typeof msg === 'string' && msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {}
  }
  return msg;
}

// Helper to determine mime type by extension
function getMimeTypeByExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    step: 'application/octet-stream',
    stp: 'application/octet-stream',
    iges: 'application/octet-stream',
    igs: 'application/octet-stream',
    sldprt: 'application/octet-stream',
    sldasm: 'application/octet-stream',
    dwg: 'application/acad',
    dxf: 'application/dxf',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

// Standardized profile format for frontend
function formatProfileResponse(row: any) {
  if (!row) return null;
  const custom = (row.customFields && typeof row.customFields === 'object') ? row.customFields : {};
  const resolvedHeader = row.header || row.headline || custom.header || custom.headline || 'Lead Mechanical Design Engineer · Precision Mechanisms';
  const resolvedDescription = row.description !== undefined && row.description !== null ? row.description : (row.bio || custom.description || custom.bio || '');
  const resolvedEmail = row.email || row.primaryEmail || custom.email || 'festusjohnson028@gmail.com';

  return {
    ...row,
    avatar: row.avatar || custom.avatar || '',
    header: resolvedHeader,
    bio: {
      fullName: row.fullName || custom.fullName || 'Festus, Olorunsogo Johnson',
      email: resolvedEmail,
      discipline: row.discipline !== undefined && row.discipline !== '' ? row.discipline : (custom.discipline || 'Mechanical Hardware & Thermal Systems'),
      badges: row.badges !== undefined && row.badges !== '' ? row.badges : (custom.badges || 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT'),
      country: row.country !== undefined && row.country !== '' ? row.country : (custom.country || 'United States'),
      header: resolvedHeader,
      degree: row.degree !== undefined && row.degree !== '' ? row.degree : (custom.degree || 'B.S. in Mechanical Engineering (BSME)'),
      academicHonors: row.academicHonors !== undefined && row.academicHonors !== '' ? row.academicHonors : (custom.academicHonors || 'ABET Accredited · Honors (GPA 3.84 / 4.00)'),
      leadership: row.leadership !== undefined && row.leadership !== '' ? row.leadership : (custom.leadership || 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer'),
      skills: row.skills !== undefined && row.skills !== '' ? row.skills : (custom.skills || 'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, CNC Machine, Laser Engraver/Cutter, 3D Animation, FEA Analysis'),
      description: resolvedDescription,
      shortSummary: row.shortSummary || custom.shortSummary || '',
      availabilityStatus: row.availabilityStatus || custom.availabilityStatus || 'Active & Available for Q4 2026 Roles',
      workClearance: row.workClearance || custom.workClearance || 'US Authorized · No Visa Sponsorship Required',
      targetLocations: row.targetLocations || custom.targetLocations || 'San Francisco / Silicon Valley, Seattle, Austin, Boston',
      linkedinUrl: row.linkedinUrl !== undefined ? row.linkedinUrl : (custom.linkedinUrl || 'https://linkedin.com'),
      facebookUrl: row.facebookUrl !== undefined ? row.facebookUrl : (custom.facebookUrl || 'https://facebook.com'),
      indeedUrl: row.indeedUrl !== undefined ? row.indeedUrl : (custom.indeedUrl || 'https://indeed.com'),
      emailUrl: custom.emailUrl || (resolvedEmail ? `mailto:${resolvedEmail}` : 'mailto:festusjohnson028@gmail.com'),
      twitterUrl: row.twitterUrl !== undefined ? row.twitterUrl : (custom.twitterUrl || 'https://x.com'),
      tiktokUrl: custom.tiktokUrl || row.tiktokUrl || 'https://tiktok.com',
      instagramUrl: row.instagramUrl !== undefined ? row.instagramUrl : (custom.instagramUrl || 'https://instagram.com'),
    },
    documents: Array.isArray(row.documents) ? row.documents : (Array.isArray(custom.documents) ? custom.documents : []),
  };
}

// Active SSE clients for instant sub-millisecond message and chat delivery
const chatSseClients = new Set<express.Response>();

function broadcastChats(conversationsList: any[], deletedId?: string): void {
  const data = `data: ${JSON.stringify({ type: 'update', conversations: conversationsList, deletedId })}\n\n`;
  for (const client of chatSseClients) {
    try {
      client.write(data);
    } catch {
      chatSseClients.delete(client);
    }
  }
}

// =================================================================
// 1. REAL-TIME CHAT & INQUIRY STREAM (SSE)
// =================================================================
app.get('/api/chats/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const currentChats = await getConversationsFromDb();
    res.write(`data: ${JSON.stringify({ type: 'init', conversations: currentChats })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'init', conversations: [] })}\n\n`);
  }

  chatSseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      chatSseClients.delete(res);
    }
  }, 12000);

  req.on('close', () => {
    clearInterval(heartbeat);
    chatSseClients.delete(res);
  });
});

// =================================================================
// 2. CHATS & INQUIRIES API (CLOUDSQL PERSISTED)
// =================================================================

// Get all chats & inquiries for real-time sync between visitors and owner
app.get(['/api/chats', '/api/conversations'], async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const chats = await getConversationsFromDb();
    const deletedIds = await getDeletedConversationIdsFromDb();
    res.json({
      success: true,
      conversations: chats,
      deletedIds: Array.from(deletedIds),
    });
  } catch (err: any) {
    console.error('Error fetching chats from db:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chats' });
  }
});

// Send a single message with instant database persistence & SSE broadcast
app.post('/api/chats/send', async (req, res) => {
  try {
    const { conversationId, message, conversationMetadata } = req.body;
    if (!conversationId || !message) {
      return res.status(400).json({ success: false, message: 'Missing conversationId or message' });
    }

    const chats = await getConversationsFromDb();
    const existing = chats.find((c: any) => c.id === conversationId);
    const lastSnippet = message.text || (message.voiceNote ? '🎤 Voice note' : (message.attachments?.length ? `📎 ${message.attachments[0].name}` : 'File sent'));
    const lastTimestamp = message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let convToSave: any;
    if (existing) {
      const existingMsgs = Array.isArray(existing.messages) ? (existing.messages as any[]) : [];
      const newMsgs = [...existingMsgs.filter((m: any) => m.id !== message.id), message];
      convToSave = {
        ...existing,
        ...(conversationMetadata || {}),
        messages: newMsgs,
        lastMessage: lastSnippet,
        lastTimestamp,
        unread: message.sender === 'visitor',
      };
    } else {
      convToSave = {
        id: conversationId,
        defaultLabel: conversationMetadata?.defaultLabel || 'Direct Message',
        customName: conversationMetadata?.customName || '',
        visitorName: conversationMetadata?.visitorName || '',
        avatarUrl: conversationMetadata?.avatarUrl || '',
        roleOrCompany: conversationMetadata?.roleOrCompany || 'Visitor Inquiry',
        avatarColor: conversationMetadata?.avatarColor || 'bg-emerald-600',
        unread: message.sender === 'visitor',
        important: false,
        messages: [message],
        lastMessage: lastSnippet,
        lastTimestamp,
      };
    }

    await saveConversationToDb(convToSave);
    const updatedChats = await getConversationsFromDb();
    broadcastChats(updatedChats);
    res.json({ success: true, conversations: updatedChats });
  } catch (err: any) {
    console.error('Error saving chat message to database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to send message' });
  }
});

// Update visitor messaging profile (custom name, avatar picture, role)
app.post('/api/chats/visitor-profile', async (req, res) => {
  try {
    const { visitorId, name, avatarUrl, roleOrCompany } = req.body;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'Missing visitorId' });
    }
    const chats = await getConversationsFromDb();
    const existing = chats.find((c: any) => c.id === visitorId);
    let convToSave: any;
    if (existing) {
      convToSave = {
        ...existing,
        customName: name !== undefined ? name : existing.customName,
        visitorName: name !== undefined ? name : existing.visitorName,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl,
        roleOrCompany: roleOrCompany !== undefined ? roleOrCompany : existing.roleOrCompany,
      };
    } else {
      convToSave = {
        id: visitorId,
        defaultLabel: name || 'Visitor',
        customName: name || '',
        visitorName: name || '',
        avatarUrl: avatarUrl || '',
        roleOrCompany: roleOrCompany || 'Visitor Direct Chat',
        avatarColor: 'bg-emerald-600',
        unread: false,
        important: false,
        messages: [],
        lastMessage: '',
        lastTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }

    await saveConversationToDb(convToSave);
    const updated = await getConversationsFromDb();
    broadcastChats(updated);
    res.json({ success: true, conversations: updated });
  } catch (err: any) {
    console.error('Error updating visitor profile:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to update visitor profile' });
  }
});

// Update or save chats batch (messages, attachments)
app.post('/api/chats', async (req, res) => {
  try {
    const { conversations: incoming, overwrite } = req.body;
    if (Array.isArray(incoming)) {
      const finalChats = await saveConversationsBatchToDb(incoming, Boolean(overwrite));
      broadcastChats(finalChats);
      return res.json({ success: true, conversations: finalChats });
    }
    res.status(400).json({ success: false, message: 'Invalid conversations array' });
  } catch (err: any) {
    console.error('Error saving chats batch:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save chats' });
  }
});

// Delete a full conversation thread / inquiry by id
app.delete('/api/chats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteConversationFromDb(id);
    const updated = await getConversationsFromDb();
    broadcastChats(updated, id);
    res.json({ success: true, conversations: updated, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting chat from database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete chat' });
  }
});

// Update or edit a specific message within a conversation
app.patch('/api/chats/:convId/messages/:msgId', async (req, res) => {
  try {
    const { convId, msgId } = req.params;
    const { text, content } = req.body;
    await updateMessageInDb(convId, msgId, text || content || '');
    const updated = await getConversationsFromDb();
    broadcastChats(updated);
    res.json({ success: true, conversations: updated, updatedMessageId: msgId });
  } catch (err: any) {
    console.error('Error updating message in database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to update message' });
  }
});

// Delete a specific message within a conversation
app.delete('/api/chats/:convId/messages/:msgId', async (req, res) => {
  try {
    const { convId, msgId } = req.params;
    await deleteMessageFromDb(convId, msgId);
    const updated = await getConversationsFromDb();
    broadcastChats(updated);
    res.json({ success: true, conversations: updated, deletedMessageId: msgId });
  } catch (err: any) {
    console.error('Error deleting message from database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete message' });
  }
});

// =================================================================
// 3. GLOBAL PROFILE (CLOUDSQL PERSISTED)
// =================================================================

// Get global profile (avatar picture, bio, and custom profile documents)
app.get('/api/profile', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const profile = await getGlobalProfileFromDb().catch(() => null);
    res.json({ success: true, profile: formatProfileResponse(profile) });
  } catch (err: any) {
    console.warn('Note loading global profile from db:', err?.message || err);
    res.json({ success: true, profile: null });
  }
});

// Dedicated profile picture image fetch/stream endpoint (Separate persistent cloud database)
app.get(['/api/profile/picture', '/api/profile/avatar'], async (_req, res) => {
  try {
    // 1. Try dedicated profile_pictures table
    const picRecord = await getProfilePictureFromDb('global').catch(() => null);
    if (picRecord && picRecord.fileBinary) {
      const raw = picRecord.fileBinary;
      let mimeType = picRecord.mimeType || 'image/jpeg';
      let buffer: Buffer | null = null;

      if (raw.startsWith('data:')) {
        const match = raw.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          buffer = Buffer.from(match[2], 'base64');
        }
      } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return res.redirect(raw);
      } else {
        buffer = Buffer.from(raw, 'base64');
      }

      if (buffer && buffer.length > 0) {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        if (picRecord.updatedAt) {
          res.setHeader('ETag', `"${new Date(picRecord.updatedAt).getTime()}"`);
        }
        return res.send(buffer);
      }
    }

    // 2. Fallback to profiles table if present
    const profile = await getGlobalProfileFromDb();
    const avatar = profile?.avatar;
    if (avatar && avatar.startsWith('data:image/')) {
      const match = avatar.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        return res.send(buffer);
      }
    } else if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://')) && !avatar.includes('/api/profile/picture')) {
      return res.redirect(avatar);
    }

    // 3. Clean fallback avatar SVG (returns valid 200 image so endpoint never errors)
    const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="11" fill="#f1f5f9" stroke="#cbd5e1"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.send(defaultAvatarSvg);
  } catch (err) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b"><circle cx="12" cy="12" r="10"/></svg>');
  }
});

// Dedicated profile picture upload & update endpoint
app.post(['/api/profile/picture', '/api/profile/avatar'], async (req, res) => {
  try {
    const avatarData = req.body.avatar || req.body.picture || req.body.image || req.body.fileBinary || req.body.dataUrl;
    if (avatarData === undefined) {
      return res.status(400).json({ success: false, message: 'Missing avatar image data' });
    }

    if (avatarData === '') {
      await deleteProfilePictureFromDb('global');
      return res.json({ success: true, url: '', avatar: '' });
    }

    const saved = await saveProfilePictureToDb({
      id: 'global',
      fileBinary: avatarData,
      mimeType: req.body.mimeType || 'image/jpeg',
      fileSize: req.body.fileSize || 'Standard',
      dimensions: req.body.dimensions || '640 x 640 px',
    });

    res.json({
      success: true,
      url: saved.avatarUrl,
      avatar: saved.avatarUrl,
      updatedAt: saved.updatedAt,
    });
  } catch (err: any) {
    console.error('Error saving profile picture to separate database:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save profile picture' });
  }
});

// Remove profile picture endpoint
app.delete(['/api/profile/picture', '/api/profile/avatar'], async (_req, res) => {
  try {
    await deleteProfilePictureFromDb('global');
    res.json({ success: true, message: 'Profile picture removed successfully', url: '', avatar: '' });
  } catch (err: any) {
    console.error('Error removing profile picture from db:', err);
    res.status(500).json({ success: false, message: 'Failed to remove profile picture' });
  }
});

// Delete an inquiry by id (Dedicated endpoint for inquiries deletion)
app.delete('/api/inquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteConversationFromDb(id);
    const updated = await getConversationsFromDb();
    broadcastChats(updated, id);
    res.json({ success: true, message: 'Inquiry deleted successfully', deletedId: id });
  } catch (err: any) {
    console.error('Error deleting inquiry:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete inquiry' });
  }
});

// Diagnostic System Health Check Endpoint
app.get('/api/diagnostics', async (_req, res) => {
  try {
    let cloudSqlStatus = 'ok';
    let cloudSqlError = null;
    let profilesCount = 0;
    let hasDedicatedAvatar = false;

    try {
      const profile = await getGlobalProfileFromDb();
      profilesCount = profile ? 1 : 0;
      const pic = await getProfilePictureFromDb('global');
      hasDedicatedAvatar = Boolean(pic && pic.fileBinary);
    } catch (sqlErr: any) {
      cloudSqlStatus = 'error';
      cloudSqlError = sqlErr.message;
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        cloudSql: {
          status: cloudSqlStatus,
          error: cloudSqlError,
          profilesCount,
          hasDedicatedAvatar,
        },
        firestore: {
          status: 'ok',
          databaseId: 'ai-studio-feslinemechanica-42e2df6f-07f3-451a-8be5-0d901fd6aa68',
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Update global profile (admin/owner uploads, bio changes, avatar)
app.post('/api/profile', async (req, res) => {
  try {
    const updated = await saveGlobalProfileToDb(req.body);
    const formatted = formatProfileResponse(updated);
    res.json({ success: true, profile: formatted });
  } catch (err: any) {
    console.error('Error saving global profile to db:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save global profile' });
  }
});

// Delete a document from global profile
app.delete('/api/profile/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await getGlobalProfileFromDb();
    if (profile && Array.isArray(profile.documents)) {
      const remainingDocs = profile.documents.filter((d: any) => d.id !== id);
      const updated = await saveGlobalProfileToDb({ ...profile, documents: remainingDocs });
      return res.json({ success: true, profile: formatProfileResponse(updated) });
    }
    res.json({ success: true, profile: formatProfileResponse(profile) });
  } catch (err: any) {
    console.warn('Note deleting profile document:', err?.message || err);
    res.json({ success: true, message: 'Profile document deleted' });
  }
});

// =================================================================
// 4. ENGINEERING HUB DOCUMENTS & CLOUD STORAGE (CLOUDSQL PERSISTED)
// =================================================================

// Get all documents (visitors get approved documents, owners get all)
app.get('/api/documents', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const includePending = req.query.all === 'true';
    const docs = await getDocumentsFromDb(includePending);
    const deletedIds = await getDeletedDocumentIdsFromDb();

    res.json({ 
      success: true, 
      documents: docs,
      deletedIds: Array.from(deletedIds),
    });
  } catch (err: any) {
    console.error('Error loading documents from db:', err);
    res.status(500).json({ success: false, message: 'Failed to load documents' });
  }
});

// Download / stream binary document file directly from persistent cloud database
app.get('/api/documents/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await getDocumentByIdFromDb(id);

    if (!doc) {
      return res.status(404).send('Document not found');
    }

    const ext = (doc.fileName || '').split('.').pop() || 'bin';
    const mimeType = (doc as any).mimeType || getMimeTypeByExt(ext);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName || 'document')}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    // 1. Serve binary data from database (fileBinary or dataUrl) with streaming support
    const rawData = (doc as any).fileBinary || doc.dataUrl;
    if (rawData && typeof rawData === 'string') {
      if (rawData.startsWith('data:')) {
        const parts = rawData.split(',');
        if (parts.length > 1) {
          const buffer = Buffer.from(parts[1], 'base64');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      } else if (rawData.length > 50) {
        const buffer = Buffer.from(rawData, 'base64');
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }
    }

    // 2. Fallback: stream from uploads disk cache if present
    const filePath = path.join(UPLOADS_DIR, `${id}.${ext}`);
    const binPath = path.join(UPLOADS_DIR, `${id}.bin`);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Length', stat.size);
      return fs.createReadStream(filePath).pipe(res);
    }
    if (fs.existsSync(binPath)) {
      const stat = fs.statSync(binPath);
      res.setHeader('Content-Length', stat.size);
      return fs.createReadStream(binPath).pipe(res);
    }

    res.status(404).send('Document file content not found on server');
  } catch (err: any) {
    console.error('File download error:', err);
    res.status(500).send('Error downloading file');
  }
});

// Publish or submit a single document with permanent database storage
app.post('/api/documents', async (req, res) => {
  try {
    const newDoc = req.body;
    if (!newDoc || !newDoc.title) {
      return res.status(400).json({ success: false, message: 'Invalid document data' });
    }

    const docId = newDoc.id || `doc-${Date.now()}`;
    const ext = (newDoc.fileName || '').split('.').pop() || 'bin';
    const uploadTimestamp = newDoc.uploadTimestamp || Date.now();
    const mimeType = newDoc.mimeType || getMimeTypeByExt(ext);

    let fileBinary = newDoc.fileBinary || newDoc.dataUrl || '';
    if (newDoc.dataUrl && typeof newDoc.dataUrl === 'string' && newDoc.dataUrl.startsWith('data:')) {
      fileBinary = newDoc.dataUrl;
      try {
        const parts = newDoc.dataUrl.split(',');
        if (parts.length > 1) {
          const buffer = Buffer.from(parts[1], 'base64');
          fs.writeFileSync(path.join(UPLOADS_DIR, `${docId}.${ext}`), buffer);
        }
      } catch {}
    }

    const docToSave = {
      ...newDoc,
      id: docId,
      uploadTimestamp,
      fileBinary,
      mimeType,
      downloadUrl:
        newDoc.downloadUrl && String(newDoc.downloadUrl).startsWith('http')
          ? newDoc.downloadUrl
          : `/api/documents/files/${docId}`,
      hasServerFile: true,
      dataUrl: newDoc.dataUrl && newDoc.dataUrl.length > 500000 ? undefined : newDoc.dataUrl,
    };

    const saved = await saveDocumentToDb(docToSave);
    const allDocs = await getDocumentsFromDb(true);
    res.json({ success: true, document: saved, documents: allDocs });
  } catch (err: any) {
    console.error('Document save error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save document' });
  }
});

// Batch publish multiple documents at once with persistent storage
app.post('/api/documents/batch', async (req, res) => {
  try {
    const { documents: incomingDocs } = req.body;
    if (!Array.isArray(incomingDocs) || incomingDocs.length === 0) {
      return res.status(400).json({ success: false, message: 'No documents provided for batch upload' });
    }

    const savedBatch: any[] = [];
    for (let i = 0; i < incomingDocs.length; i++) {
      const newDoc = incomingDocs[i];
      if (!newDoc || !newDoc.title) continue;

      const docId = newDoc.id || `doc-${Date.now()}-${i}`;
      const ext = (newDoc.fileName || '').split('.').pop() || 'bin';
      const uploadTimestamp = newDoc.uploadTimestamp || (Date.now() + i);
      const mimeType = newDoc.mimeType || getMimeTypeByExt(ext);

      let fileBinary = newDoc.fileBinary || newDoc.dataUrl || '';
      if (newDoc.dataUrl && typeof newDoc.dataUrl === 'string' && newDoc.dataUrl.startsWith('data:')) {
        fileBinary = newDoc.dataUrl;
        try {
          const parts = newDoc.dataUrl.split(',');
          if (parts.length > 1) {
            fs.writeFileSync(path.join(UPLOADS_DIR, `${docId}.${ext}`), Buffer.from(parts[1], 'base64'));
          }
        } catch {}
      }

      const docToSave = {
        ...newDoc,
        id: docId,
        uploadTimestamp,
        fileBinary,
        mimeType,
        downloadUrl:
          newDoc.downloadUrl && String(newDoc.downloadUrl).startsWith('http')
            ? newDoc.downloadUrl
            : `/api/documents/files/${docId}`,
        hasServerFile: true,
        dataUrl: newDoc.dataUrl && newDoc.dataUrl.length > 500000 ? undefined : newDoc.dataUrl,
      };

      const saved = await saveDocumentToDb(docToSave);
      savedBatch.push(saved);
    }

    const allDocs = await getDocumentsFromDb(true);
    res.json({ success: true, count: savedBatch.length, savedDocuments: savedBatch, documents: allDocs });
  } catch (err: any) {
    console.error('Batch document save error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save batch documents' });
  }
});

// Approve a pending visitor document
app.patch('/api/documents/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await getDocumentByIdFromDb(id);
    if (doc) {
      await saveDocumentToDb({ ...doc, status: 'approved' });
    }
    const allDocs = await getDocumentsFromDb(true);
    res.json({ success: true, documents: allDocs });
  } catch (err: any) {
    console.error('Error approving document:', err);
    res.status(500).json({ success: false, message: 'Failed to approve document' });
  }
});

// Delete an uploaded document permanently
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDocumentFromDb(id);
    const allDocs = await getDocumentsFromDb(true);

    // Clean up disk cache if present
    try {
      const ext = 'pdf';
      const filePath = path.join(UPLOADS_DIR, `${id}.${ext}`);
      const binPath = path.join(UPLOADS_DIR, `${id}.bin`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
    } catch {}

    res.json({ success: true, documents: allDocs, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting document:', err);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

// Increment download count
app.post('/api/documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    await incrementDocumentDownloadCountInDb(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to increment download count' });
  }
});

// =================================================================
// 5. TRAINING & LEARNING SESSIONS (CLOUDSQL PERSISTED)
// =================================================================

// Learning: Get all teaching / training sessions
app.get('/api/learning/sessions', async (_req, res) => {
  try {
    const sessions = await getLearningSessionsFromDb();
    res.json({ success: true, sessions });
  } catch (err: any) {
    console.error('Error fetching learning sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// Learning: Save & upload a teaching session (with optional video base64)
app.post('/api/learning/sessions', async (req, res) => {
  try {
    const { sessionData, videoBase64, mimeType = 'video/webm' } = req.body;
    if (!sessionData || !sessionData.title) {
      return res.status(400).json({ success: false, message: 'Session title and metadata are required.' });
    }

    const saved = await saveLearningSessionToDb(sessionData, videoBase64, mimeType);
    res.json({ success: true, session: saved });
  } catch (err: any) {
    console.error('Error saving learning session:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to save training session.' });
  }
});

// Learning: Stream / serve recorded video with HTTP 206 Partial Content
app.get('/api/learning/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await getLearningSessionByIdFromDb(id);

    if (session && session.videoData && session.videoData.length > 50) {
      const buffer = Buffer.from(session.videoData, 'base64');
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    const webmPath = path.join(RECORDINGS_DIR, `${id}.webm`);
    const mp4Path = path.join(RECORDINGS_DIR, `${id}.mp4`);
    let videoPath = '';
    let contentType = 'video/webm';

    if (fs.existsSync(webmPath)) {
      videoPath = webmPath;
      contentType = 'video/webm';
    } else if (fs.existsSync(mp4Path)) {
      videoPath = mp4Path;
      contentType = 'video/mp4';
    } else {
      return res.status(404).send('Video recording not found');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming video:', err);
    res.status(500).send('Error streaming video');
  }
});

// Learning: Delete a recorded session
app.delete('/api/learning/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteLearningSessionFromDb(id);
    const updated = await getLearningSessionsFromDb();

    const webmPath = path.join(RECORDINGS_DIR, `${id}.webm`);
    const mp4Path = path.join(RECORDINGS_DIR, `${id}.mp4`);
    if (fs.existsSync(webmPath)) {
      try { fs.unlinkSync(webmPath); } catch {}
    }
    if (fs.existsSync(mp4Path)) {
      try { fs.unlinkSync(mp4Path); } catch {}
    }

    res.json({ success: true, sessions: updated });
  } catch (err: any) {
    console.error('Error deleting session:', err);
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete session' });
  }
});

// Helper to generate a structured storyboard when remote AI is unavailable or timing out
function generateFallbackStoryboard(prompt: string, category: string = 'Mechanical Engineering') {
  const cleanPrompt = (prompt || 'Mechanical Engineering Fundamentals').trim();
  const title = cleanPrompt.length > 50 ? `${cleanPrompt.slice(0, 48)}...` : cleanPrompt;
  return {
    title: `Masterclass: ${title.charAt(0).toUpperCase() + title.slice(1)}`,
    description: `A comprehensive masterclass on ${cleanPrompt}, breaking down foundational mechanics, real-world constraints, and practical design solutions.`,
    category: category || 'Mechanical Engineering',
    duration: '03:45',
    durationSeconds: 225,
    scenes: [
      {
        sceneNumber: 1,
        title: 'Core Principles & Problem Definition',
        durationSeconds: 45,
        narration: `Welcome to this technical session. Today we are exploring ${cleanPrompt}. We start from first principles to understand the core physics, boundary conditions, and design objectives.`,
        visualType: 'blueprint',
        visualElements: [
          'First-Principles Problem Formulation',
          'Free-Body Diagram & Force Vectors',
          'Boundary Conditions & Constraints',
          'Key Governing Equations',
        ],
        keyTakeaway: 'Always establish clear boundary conditions and governing physics before beginning CAD geometry.',
      },
      {
        sceneNumber: 2,
        title: '3D Geometry & Parametric Modeling',
        durationSeconds: 50,
        narration: `Next, we translate these requirements into 3D CAD parametric features. We pay close attention to stress concentrations, fillet radii, and draft angles for manufacturability.`,
        visualType: '3d-cad',
        visualElements: [
          'Parametric Sketch Relations',
          'Feature Tree & Datum Planes',
          'Fillet Stress Relief (r/d >= 0.15)',
          'DFM Draft Angles & Wall Uniformity',
        ],
        keyTakeaway: 'Parametric modeling ensures rapid iteration when load cases or tolerances update.',
      },
      {
        sceneNumber: 3,
        title: 'Stress Analysis & FEA Simulation',
        durationSeconds: 55,
        narration: `Now we validate the structure using Finite Element Analysis. We inspect von Mises stress contours, factor of safety distribution, and deflection limits under maximum working loads.`,
        visualType: 'simulation',
        visualElements: [
          'Tetrahedral & Hex Mesh Refinement',
          'von Mises Stress Distribution',
          'Factor of Safety (FoS >= 2.0)',
          'Deflection & Elastic Strain Plots',
        ],
        keyTakeaway: 'FEA mesh convergence is required to verify stress results and avoid false singularities.',
      },
      {
        sceneNumber: 4,
        title: 'GD&T & Tolerance Stack-up',
        durationSeconds: 45,
        narration: `With structural integrity confirmed, we apply ASME Y14.5 Geometric Dimensioning and Tolerancing to control datum references, true position, and perpendicularity.`,
        visualType: 'diagram',
        visualElements: [
          'Datum Reference Frame [A|B|C]',
          'True Position (MMC / RFS)',
          'Profile of a Surface Tolerance',
          'Worst-Case Stack-up Calculation',
        ],
        keyTakeaway: 'GD&T protects functional assembly while giving manufacturing maximum allowable tolerance.',
      },
      {
        sceneNumber: 5,
        title: 'Production Verification & Quality Inspection',
        durationSeconds: 30,
        narration: `In closing, we establish CMM inspection protocols and First Article Inspection criteria to ensure production parts match the digital twin.`,
        visualType: 'formula',
        visualElements: [
          'CMM Touch Probe Verification',
          'First Article Inspection (FAI)',
          'Statistical Process Control (Cpk >= 1.33)',
          'Design Sign-off & Revision Release',
        ],
        keyTakeaway: 'A robust design bridges digital engineering with repeatable factory production.',
      },
    ],
    keyTakeaways: [
      `Grounded in first-principles physics and clear boundary conditions for ${cleanPrompt}.`,
      'Parametric CAD models linked with FEA verification ensure structural reliability.',
      'ASME Y14.5 GD&T controls ensure seamless interchangeability and high yield.',
    ],
    tags: [category, 'CAD Modeling', 'FEA Simulation', 'GD&T'],
  };
}

// 10. Learning: Generate Animated Video from Prompts/Descriptions
app.post('/api/learning/generate-animation', async (req, res) => {
  try {
    const { prompt, category = 'Mechanical Engineering', instructor = 'Festus, Olorunsogo Johnson' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide prompt descriptions for the animated video.' });
    }

    const systemPrompt = `You are an expert AI animated educational video producer and engineering instructor.
Generate a structured storyboard and script for an animated learning video based on the user's prompt/descriptions.
The output must be a valid JSON object matching the requested schema with:
1. title: Catchy, professional title.
2. description: Summary of the animated learning video.
3. category: Engineering category (e.g. Mechanical Engineering, CAD & 3D Modeling, GD&T & Tolerance, FEA Simulation, Manufacturing & CNC).
4. duration: Estimated duration string e.g. "03:30".
5. durationSeconds: Total seconds integer e.g. 210.
6. scenes: Array of 4 to 6 scenes. Each scene must contain:
   - sceneNumber: integer
   - title: scene title
   - durationSeconds: integer
   - narration: exact voiceover / narration script for this scene
   - visualType: one of ['blueprint', '3d-cad', 'formula', 'diagram', 'simulation']
   - visualElements: array of 3 to 4 key visual text bullets or formula highlights to display in the animated canvas
   - keyTakeaway: single sentence core takeaway
7. keyTakeaways: array of 3 major takeaways for the video.
8. tags: array of 4 relevant keyword tags.`;

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        duration: { type: Type.STRING },
        durationSeconds: { type: Type.INTEGER },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              title: { type: Type.STRING },
              durationSeconds: { type: Type.INTEGER },
              narration: { type: Type.STRING },
              visualType: { type: Type.STRING },
              visualElements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              keyTakeaway: { type: Type.STRING },
            },
            required: ['sceneNumber', 'title', 'durationSeconds', 'narration', 'visualType', 'visualElements', 'keyTakeaway'],
          },
        },
        keyTakeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['title', 'description', 'category', 'duration', 'durationSeconds', 'scenes', 'keyTakeaways', 'tags'],
    };

    const candidateModels = ['gemini-flash-latest'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const configObj: any = {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: schemaConfig,
          };
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `User Prompt / Description: ${prompt}`,
            config: configObj,
          });

          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (callErr: any) {
          lastError = callErr;
          console.warn(`[Learning Generator] Model ${modelName} attempt ${attempt} notice:`, cleanErrorMessage(callErr));
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      console.info('[Learning Generator] Model fetch notice: using synthesized animation storyboard.');
      const fallbackStoryboard = generateFallbackStoryboard(prompt, category);
      return res.json({ success: true, animation: fallbackStoryboard });
    }

    const animatedData = JSON.parse(responseText);
    res.json({ success: true, animation: animatedData });
  } catch (err: any) {
    console.error('Animated video generation error:', err);
    const fallbackStoryboard = generateFallbackStoryboard(req.body?.prompt || 'Engineering Masterclass', req.body?.category);
    res.json({ success: true, animation: fallbackStoryboard });
  }
});

// =================================================================
// 9. PRODUCTION MEDIA OPTIMIZATION PIPELINE (SHARP AVIF & FFMPEG AV1)
// =================================================================
const execFileAsync = promisify(execFile);

const DEFAULT_SUPABASE_URL = 'https://teszyojnwaedjvqaqake.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-XgRARzNT0COeyl9FE66Lw_-k6wMWex';

const MEDIA_TEMP_DIR = path.join(os.tmpdir(), 'fesline_media_jobs');
try {
  fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true });
} catch {}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try { fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true }); } catch {}
      cb(null, MEDIA_TEMP_DIR);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safe}`);
    },
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
});

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try { fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true }); } catch {}
      cb(null, MEDIA_TEMP_DIR);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safe}`);
    },
  }),
  limits: { fileSize: 550 * 1024 * 1024 },
});

interface VideoOptimizationJob {
  jobId: string;
  bucket: string;
  storagePath?: string;
  status: 'queued' | 'processing' | 'uploading' | 'ready_for_client_upload' | 'completed' | 'failed';
  progress: number;
  stage: string;
  publicUrl?: string;
  directUploadUrl?: string;
  localOutPath?: string;
  fileName?: string;
  fileSize?: string;
  bytes?: number;
  originalBytes?: number;
  error?: string;
  createdAt: number;
}

const videoJobs = new Map<string, VideoOptimizationJob>();

// Prune completed/failed job metadata older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of videoJobs.entries()) {
    if (job.createdAt < cutoff) {
      if (job.localOutPath) {
        safeUnlink(job.localOutPath).catch(() => {});
      }
      videoJobs.delete(id);
    }
  }
}, 15 * 60 * 1000).unref?.();

function formatMediaBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let cachedFfmpegInfo: { bin: string; ffprobeBin: string; hasSvtAv1: boolean; hasAomAv1: boolean } | null = null;
async function getFfmpegCapabilities() {
  if (cachedFfmpegInfo) return cachedFfmpegInfo;
  let ffmpegPath = 'ffmpeg';
  try {
    const mod = await import('ffmpeg-static');
    const candidate = mod.default || (mod as any);
    if (typeof candidate === 'string' && fs.existsSync(candidate)) {
      ffmpegPath = candidate;
    }
  } catch {}

  const ffprobeBin = 'ffprobe';
  let hasSvtAv1 = false;
  let hasAomAv1 = false;
  try {
    const { stdout } = await execFileAsync(ffmpegPath, ['-encoders'], { timeout: 10000 });
    hasSvtAv1 = /\blibsvtav1\b/.test(stdout);
    hasAomAv1 = /\blibaom-av1\b/.test(stdout);
  } catch {}
  cachedFfmpegInfo = { bin: ffmpegPath, ffprobeBin, hasSvtAv1, hasAomAv1 };
  return cachedFfmpegInfo;
}

async function safeUnlink(filePath?: string | null) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

async function cleanupPassLogs(prefix: string) {
  try {
    const dir = path.dirname(prefix);
    const base = path.basename(prefix);
    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries
        .filter((f) => f.startsWith(base))
        .map((f) => safeUnlink(path.join(dir, f)))
    );
  } catch {}
}

function runMulterSingle(
  uploadMw: express.RequestHandler,
  req: express.Request,
  res: express.Response
): Promise<boolean> {
  return new Promise((resolve) => {
    uploadMw(req, res, (err: any) => {
      if (err) {
        console.error('[Media Multer Upload Error]:', err);
        const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        if (!res.headersSent) {
          res.status(status).json({
            success: false,
            message: err?.message || 'Multipart upload failed.',
          });
        }
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function resolveSupabaseHeaders(req: express.Request) {
  const supabaseUrl = (
    (req.headers['x-supabase-url'] as string) ||
    process.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).replace(/\/+$/, '');

  const anonKey =
    (req.headers['x-supabase-anon-key'] as string) ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  const incomingAuth = req.headers.authorization;
  const authHeader =
    incomingAuth && incomingAuth.startsWith('Bearer ')
      ? incomingAuth
      : `Bearer ${anonKey}`;

  return { supabaseUrl, anonKey, authHeader };
}

async function uploadMediaToSupabaseStorage(params: {
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
  bucket: string;
  storagePath: string;
  data: Buffer;
  contentType: string;
}): Promise<string> {
  const encodedPath = params.storagePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const uploadEndpoint = `${params.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodedPath}`;
  const resp = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      apikey: params.anonKey,
      Authorization: params.authHeader,
      'Content-Type': params.contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(params.data),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    const err: any = new Error(`Supabase storage upload (${params.bucket}) failed (${resp.status}): ${errText}`);
    err.statusCode = resp.status;
    err.isRlsOrAuth = resp.status === 400 || resp.status === 401 || resp.status === 403 || /row-level security|unauthorized|accessdenied/i.test(errText);
    throw err;
  }

  return `${params.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(params.bucket)}/${encodedPath}`;
}

function runProcess(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrTail = '';
    proc.stderr?.on('data', (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-3000);
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail.slice(-600)}`));
    });
  });
}

async function probeVideoMetadata(
  ffprobeBin: string,
  inputPath: string
): Promise<{ width: number; height: number; durationSec: number; hasAudio: boolean }> {
  try {
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      inputPath,
    ]);
    const parsed = JSON.parse(stdout || '{}');
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');
    return {
      width: Number(videoStream?.width) || 1280,
      height: Number(videoStream?.height) || 720,
      durationSec: Number(parsed?.format?.duration) || 0,
      hasAudio: Boolean(audioStream),
    };
  } catch {
    return { width: 1280, height: 720, durationSec: 0, hasAudio: false };
  }
}

async function processVideoJobAsync(params: {
  jobId: string;
  rawPath: string;
  originalName: string;
  originalSize: number;
  bucket: 'projects' | 'articles';
  folderPrefix: string;
  maxHeight: 720 | 1080;
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
}) {
  const job = videoJobs.get(params.jobId);
  if (!job) {
    await safeUnlink(params.rawPath);
    return;
  }

  const baseStem = params.originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(MEDIA_TEMP_DIR, `out_${params.jobId}.mp4`);
  const passLogPrefix = path.join(MEDIA_TEMP_DIR, `passlog_${params.jobId}`);
  let keepOutFileForClient = false;

  try {
    job.status = 'processing';
    job.progress = 12;
    job.stage = 'Inspecting video stream geometry...';

    const { bin, ffprobeBin, hasSvtAv1, hasAomAv1 } = await getFfmpegCapabilities();
    const meta = await probeVideoMetadata(ffprobeBin, params.rawPath);

    const maxW = params.maxHeight === 720 ? 1280 : 1920;
    const maxH = params.maxHeight === 720 ? 720 : 1080;
    // Scale down to max 720p/1080p without upscaling, keeping even pixel dimensions, + light perceptual denoising & subtle sharpening
    const vfChain = [
      `scale='min(${maxW},iw)':'min(${maxH},ih)':force_original_aspect_ratio=decrease`,
      `scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      'hqdn3d=1.5:1.5:6:6',
      'unsharp=5:5:0.35:5:5:0.0',
    ].join(',');

    const audioArgs = meta.hasAudio ? ['-c:a', 'libopus', '-b:a', '80k'] : ['-an'];

    const primaryEncoderArgs = hasSvtAv1
      ? ['-c:v', 'libsvtav1', '-crf', '34', '-preset', '5', '-pix_fmt', 'yuv420p']
      : hasAomAv1
      ? ['-c:v', 'libaom-av1', '-crf', '34', '-b:v', '0', '-cpu-used', '8', '-row-mt', '1', '-tiles', '2x2', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-pix_fmt', 'yuv420p'];

    job.progress = 28;
    job.stage = hasSvtAv1
      ? 'Encoding Pass 1/2 (SVT-AV1 perceptual analysis)...'
      : hasAomAv1
      ? 'Encoding Pass 1/2 (AV1 perceptual analysis)...'
      : 'Encoding Pass 1/2 (video perceptual analysis)...';

    let encodedOk = false;
    try {
      // 2-Pass Encoding — Pass 1
      await runProcess(bin, [
        '-y',
        '-i', params.rawPath,
        '-vf', vfChain,
        ...primaryEncoderArgs,
        '-pass', '1',
        '-passlogfile', passLogPrefix,
        '-an',
        '-f', 'mp4',
        process.platform === 'win32' ? 'NUL' : '/dev/null',
      ]);

      job.progress = 62;
      job.stage = 'Encoding Pass 2/2 (AV1 + 80kbps Opus audio)...';

      // 2-Pass Encoding — Pass 2
      await runProcess(bin, [
        '-y',
        '-i', params.rawPath,
        '-vf', vfChain,
        ...primaryEncoderArgs,
        '-pass', '2',
        '-passlogfile', passLogPrefix,
        ...audioArgs,
        '-movflags', '+faststart',
        outPath,
      ]);
      encodedOk = true;
    } catch (twoPassErr: any) {
      console.warn(`[Video Pipeline] 2-pass retry note for job ${params.jobId}:`, twoPassErr?.message);
    }

    if (!encodedOk) {
      job.progress = 48;
      job.stage = 'Optimizing video stream (adaptive fallback)...';
      await runProcess(bin, [
        '-y',
        '-i', params.rawPath,
        '-vf', vfChain,
        '-c:v', 'libx264',
        '-crf', '28',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        ...(meta.hasAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
        '-movflags', '+faststart',
        outPath,
      ]);
    }

    job.status = 'uploading';
    job.progress = 88;
    job.stage = `Uploading compressed AV1 MP4 to "${params.bucket}" bucket...`;

    const finalBuffer = await fs.promises.readFile(outPath);
    const finalFileName = `${baseStem}.mp4`;
    const storagePath = `${params.folderPrefix || 'videos'}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${finalFileName}`;

    try {
      const publicUrl = await uploadMediaToSupabaseStorage({
        supabaseUrl: params.supabaseUrl,
        anonKey: params.anonKey,
        authHeader: params.authHeader,
        bucket: params.bucket,
        storagePath,
        data: finalBuffer,
        contentType: 'video/mp4',
      });

      job.status = 'completed';
      job.progress = 100;
      job.stage = 'Completed';
      job.publicUrl = publicUrl;
      job.storagePath = storagePath;
      job.fileName = finalFileName;
      job.bytes = finalBuffer.length;
      job.originalBytes = params.originalSize;
      job.fileSize = formatMediaBytes(finalBuffer.length);
    } catch (storageErr: any) {
      // Hand off compressed MP4 to authenticated client session if server-side storage upload hit RLS
      keepOutFileForClient = true;
      job.localOutPath = outPath;
      job.storagePath = storagePath;
      job.fileName = finalFileName;
      job.bytes = finalBuffer.length;
      job.originalBytes = params.originalSize;
      job.fileSize = formatMediaBytes(finalBuffer.length);
      job.directUploadUrl = `/api/media/job-file/${encodeURIComponent(params.jobId)}`;
      job.status = 'ready_for_client_upload';
      job.progress = 94;
      job.stage = `Optimized (${job.fileSize}). Finalizing storage upload...`;
      console.info(`[Video Pipeline Job ${params.jobId}] Handing off compressed video to authenticated client:`, storageErr?.message);
    }
  } catch (err: any) {
    console.error(`[Video Pipeline Error Job ${params.jobId}]:`, err);
    job.status = 'failed';
    job.stage = 'Optimization failed';
    job.error = err?.message || 'Video transcoding or upload failed.';
  } finally {
    await safeUnlink(params.rawPath);
    if (!keepOutFileForClient) {
      await safeUnlink(outPath);
    }
    await cleanupPassLogs(passLogPrefix);
  }
}

// Optimize JPEG / PNG / WebP images with Sharp -> auto-rotate, strip EXIF, max 1920px, AVIF q=75 -> upload to Supabase bucket
app.post('/api/media/optimize-image', async (req, res) => {
  const ok = await runMulterSingle(imageUpload.single('file'), req, res);
  if (!ok) return;

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }

  const bucket = req.body?.bucket === 'articles' ? 'articles' : 'projects';
  const folderPrefix = String(req.body?.folderPrefix || 'images').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const isSvg = file.mimetype === 'image/svg+xml' || ext === '.svg';
    const rawBuffer = await fs.promises.readFile(file.path);

    let outBuffer: Buffer;
    let outMime = 'image/avif';
    let outExt = '.avif';

    if (isSvg) {
      outBuffer = rawBuffer;
      outMime = 'image/svg+xml';
      outExt = '.svg';
    } else {
      const sharpMod = await import('sharp');
      const sharpFn = sharpMod.default || (sharpMod as any);
      // Auto-rotate per EXIF, strip EXIF metadata (default when withMetadata() is not called), resize max 1920w without upscaling, convert to AVIF q75
      outBuffer = await sharpFn(rawBuffer)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .avif({ quality: 75 })
        .toBuffer();
    }

    const baseStem = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalFileName = `${baseStem}${outExt}`;
    const storagePath = `${folderPrefix}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${finalFileName}`;

    try {
      const publicUrl = await uploadMediaToSupabaseStorage({
        supabaseUrl,
        anonKey,
        authHeader,
        bucket,
        storagePath,
        data: outBuffer,
        contentType: outMime,
      });

      return res.json({
        success: true,
        publicUrl,
        storagePath,
        fileName: finalFileName,
        fileSize: formatMediaBytes(outBuffer.length),
        mimeType: outMime,
        originalBytes: file.size,
        optimizedBytes: outBuffer.length,
      });
    } catch (storageErr: any) {
      // Return optimized AVIF bytes so authenticated frontend client completes Supabase bucket upload directly
      return res.json({
        success: true,
        directUploadRequired: true,
        optimizedBase64: outBuffer.toString('base64'),
        mimeType: outMime,
        storagePath,
        fileName: finalFileName,
        fileSize: formatMediaBytes(outBuffer.length),
        originalBytes: file.size,
        optimizedBytes: outBuffer.length,
        serverNotice: storageErr?.message || 'Client storage upload handoff',
      });
    }
  } catch (err: any) {
    console.error('[Image Optimization Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Image optimization failed.',
    });
  } finally {
    await safeUnlink(file.path);
  }
});

// Enqueue background AV1 + Opus video optimization job so request never times out
app.post('/api/media/optimize-video', async (req, res) => {
  const ok = await runMulterSingle(videoUpload.single('file'), req, res);
  if (!ok) return;

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No video file provided.' });
  }

  const bucket: 'projects' | 'articles' = req.body?.bucket === 'articles' ? 'articles' : 'projects';
  const folderPrefix = String(req.body?.folderPrefix || 'videos').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const maxHeight: 720 | 1080 = req.body?.maxHeight === '720' ? 720 : 1080;
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

  const jobId = `vjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const job: VideoOptimizationJob = {
    jobId,
    bucket,
    status: 'queued',
    progress: 5,
    stage: 'Queued for background AV1 optimization...',
    originalBytes: file.size,
    createdAt: Date.now(),
  };
  videoJobs.set(jobId, job);

  // Run asynchronously in background without awaiting completion in HTTP handler
  setImmediate(() => {
    void processVideoJobAsync({
      jobId,
      rawPath: file.path,
      originalName: file.originalname,
      originalSize: file.size,
      bucket,
      folderPrefix,
      maxHeight,
      supabaseUrl,
      anonKey,
      authHeader,
    });
  });

  res.status(202).json({
    success: true,
    jobId,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
  });
});

// Poll background video optimization job status
app.get('/api/media/jobs/:jobId', (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Video processing job not found or expired.' });
  }
  const { localOutPath: _omit, ...publicJob } = job;
  res.json({ success: true, job: publicJob });
});

// Stream optimized AV1 video to authenticated client when server-side storage handoff is needed
app.get('/api/media/job-file/:jobId', async (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job || !job.localOutPath || !fs.existsSync(job.localOutPath)) {
    return res.status(404).json({ success: false, message: 'Optimized video file not found.' });
  }
  const filePath = job.localOutPath;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(job.fileName || 'video.mp4')}"`);
  const stream = fs.createReadStream(filePath);
  stream.on('close', () => {
    safeUnlink(filePath).catch(() => {});
    job.localOutPath = undefined;
  });
  stream.pipe(res);
});

// Global JSON error handler for all /api/* routes so Express never emits HTML 500 pages
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error Handler]:', err);
  if (res.headersSent) return;
  const status = err?.statusCode || err?.status || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: err?.message || 'Internal server error.',
  });
});

async function startServer() {
  // Serve public assets with browser caching and ETag support
  app.use(express.static(path.resolve('public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist'), {
      maxAge: '1y',
      immutable: true,
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Only start listening if not running under Vercel serverless runtime
  if (process.env.VERCEL !== '1') {
    const httpServer = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
    httpServer.on('error', (err: any) => {
      console.error(`[HTTP Server Error on port ${PORT}]:`, err?.message || err);
    });
  }
}

// Auto-start in non-serverless environments
if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('[Failed to start server]:', err);
    process.exit(1);
  });
}

export default app;
