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
    if (
      req.headers['x-no-compression'] ||
      req.path.startsWith('/api/media/optimize-video/chunk') ||
      req.path.startsWith('/api/media/job-artifact') ||
      req.path.startsWith('/api/media/job-file')
    ) {
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
      ...(Array.isArray(custom.certifiedSkills) ? { certifiedSkills: custom.certifiedSkills } : {}),
      ...(custom.skillStatuses && typeof custom.skillStatuses === 'object' ? { skillStatuses: custom.skillStatuses } : {}),
      ...(Array.isArray(custom.experiences) ? { experiences: custom.experiences } : {}),
      ...(Array.isArray(custom.publications) ? { publications: custom.publications } : {}),
      ...(Array.isArray(custom.achievements) ? { achievements: custom.achievements } : {}),
      ...(Array.isArray(custom.deletedDocIds) ? { deletedDocIds: custom.deletedDocIds } : {}),
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
      success: cloudSqlStatus === 'ok',
      timestamp: new Date().toISOString(),
      database: {
        cloudSql: {
          status: cloudSqlStatus,
          error: cloudSqlError,
          profilesCount,
          hasDedicatedAvatar,
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
// 9. PRODUCTION MEDIA OPTIMIZATION PIPELINE (SHARP AVIF & FFMPEG AV1/H.264)
// =================================================================
const execFileAsync = promisify(execFile);

const DEFAULT_SUPABASE_URL = 'https://teszyojnwaedjvqaqake.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-XgRARzNT0COeyl9FE66Lw_-k6wMWex';

const MEDIA_TEMP_DIR = path.join(os.tmpdir(), 'fesline_media_jobs');
try {
  fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true });
} catch {}

const imageUpload = multer({
  storage: multer.memoryStorage(),
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

export interface JobArtifactDescriptor {
  key: string;
  localPath: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  bytes: number;
  publicUrl?: string;
}

export interface VideoOptimizationJob {
  jobId: string;
  bucket: 'projects' | 'articles';
  folderPrefix: string;
  originalName: string;
  storagePath?: string;
  status: 'queued' | 'processing' | 'uploading' | 'ready_for_client_upload' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  format: string;
  resolution?: string;
  width?: number;
  height?: number;
  publicUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  spriteUrl?: string;
  directUploadUrl?: string;
  handoffArtifacts?: Array<{
    key: string;
    downloadUrl: string;
    storagePath: string;
    fileName: string;
    contentType: string;
    bytes: number;
  }>;
  artifactPaths?: Record<string, JobArtifactDescriptor>;
  vttContent?: string;
  rawRetryPath?: string;
  supabaseUrl?: string;
  anonKey?: string;
  authHeader?: string;
  fileName?: string;
  fileSize?: string;
  bytes?: number;
  originalBytes?: number;
  compressionPct?: number;
  durationSec?: number;
  error?: string;
  cancelled?: boolean;
  activeChild?: ReturnType<typeof spawn>;
  createdAt: number;
  updatedAt: number;
}

const videoJobs = new Map<string, VideoOptimizationJob>();

interface ChunkedVideoSession {
  jobId: string;
  rawPath: string;
  bucket: 'projects' | 'articles';
  folderPrefix: string;
  originalName: string;
  originalSize: number;
  receivedBytes: number;
  chunks: Record<string, number>;
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
  createdAt: number;
}

const chunkedVideoSessions = new Map<string, ChunkedVideoSession>();

function getSessionMetaPath(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(MEDIA_TEMP_DIR, `sess_${safeId}.json`);
}

function getJobMetaPath(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(MEDIA_TEMP_DIR, `job_${safeId}.json`);
}

function persistChunkSession(session: ChunkedVideoSession): void {
  try {
    fs.writeFileSync(getSessionMetaPath(session.jobId), JSON.stringify(session));
  } catch {}
}

function loadChunkSession(jobId: string): ChunkedVideoSession | undefined {
  const cached = chunkedVideoSessions.get(jobId);
  if (cached) return cached;
  try {
    const metaPath = getSessionMetaPath(jobId);
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChunkedVideoSession;
      if (parsed && parsed.jobId) {
        chunkedVideoSessions.set(parsed.jobId, parsed);
        return parsed;
      }
    }
  } catch {}
  return undefined;
}

function removeChunkSession(jobId: string): void {
  chunkedVideoSessions.delete(jobId);
  try {
    const metaPath = getSessionMetaPath(jobId);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {}
}

function persistVideoJob(job: VideoOptimizationJob): void {
  try {
    const { activeChild: _omitChild, authHeader: _omitAuth, anonKey: _omitAnon, ...serializable } = job;
    fs.writeFileSync(getJobMetaPath(job.jobId), JSON.stringify(serializable));
  } catch {}
}

function loadVideoJob(jobId: string): VideoOptimizationJob | undefined {
  const cached = videoJobs.get(jobId);
  if (cached) return cached;
  try {
    const metaPath = getJobMetaPath(jobId);
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as VideoOptimizationJob;
      if (parsed && parsed.jobId) {
        videoJobs.set(parsed.jobId, parsed);
        return parsed;
      }
    }
  } catch {}
  return undefined;
}

// Rehydrate recent job manifests on server startup
try {
  if (fs.existsSync(MEDIA_TEMP_DIR)) {
    for (const file of fs.readdirSync(MEDIA_TEMP_DIR)) {
      if (file.startsWith('job_') && file.endsWith('.json')) {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(MEDIA_TEMP_DIR, file), 'utf-8')) as VideoOptimizationJob;
          if (parsed?.jobId) {
            if (parsed.status === 'queued' || parsed.status === 'processing' || parsed.status === 'uploading') {
              parsed.status = 'failed';
              parsed.stage = 'Server restarted during processing';
              parsed.error = 'Server restarted while processing. Click Retry to continue.';
            }
            videoJobs.set(parsed.jobId, parsed);
          }
        } catch {}
      }
    }
  }
} catch {}

// Prune completed/failed job metadata & stale temp files periodically
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const failedRetryCutoff = Date.now() - 45 * 60 * 1000;
  const chunkSessionCutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of videoJobs.entries()) {
    if (job.rawRetryPath && (job.createdAt < failedRetryCutoff || job.status !== 'failed')) {
      safeUnlink(job.rawRetryPath).catch(() => {});
      job.rawRetryPath = undefined;
    }
    if (job.createdAt < cutoff) {
      if (job.artifactPaths) {
        for (const art of Object.values(job.artifactPaths)) {
          safeUnlink(art.localPath).catch(() => {});
        }
      }
      safeUnlink(job.rawRetryPath).catch(() => {});
      safeUnlink(getJobMetaPath(id)).catch(() => {});
      videoJobs.delete(id);
    }
  }
  for (const [id, session] of chunkedVideoSessions.entries()) {
    if (session.createdAt < chunkSessionCutoff) {
      safeUnlink(session.rawPath).catch(() => {});
      removeChunkSession(id);
    }
  }
}, 10 * 60 * 1000).unref?.();

function formatMediaBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let cachedFfmpegInfo: {
  bin: string;
  ffprobeBin: string;
  hasSvtAv1: boolean;
  hasAomAv1: boolean;
  hasX264: boolean;
  hasAac: boolean;
  hasOpus: boolean;
} | null = null;

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

  const ffprobeBin = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : 'ffprobe';
  let hasSvtAv1 = false;
  let hasAomAv1 = false;
  let hasX264 = false;
  let hasAac = false;
  let hasOpus = false;
  try {
    const { stdout } = await execFileAsync(ffmpegPath, ['-encoders'], { timeout: 10000 });
    hasSvtAv1 = /\blibsvtav1\b/.test(stdout);
    hasAomAv1 = /\blibaom-av1\b/.test(stdout);
    hasX264 = /\blibx264\b/.test(stdout);
    hasAac = /\baac\b/.test(stdout);
    hasOpus = /\blibopus\b/.test(stdout);
  } catch {}
  cachedFfmpegInfo = { bin: ffmpegPath, ffprobeBin, hasSvtAv1, hasAomAv1, hasX264, hasAac, hasOpus };
  return cachedFfmpegInfo;
}

async function safeUnlink(filePath?: string | null) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

async function cleanupJobTempArtifacts(job: VideoOptimizationJob, keepForFailedRetry = false) {
  if (!keepForFailedRetry && job.rawRetryPath) {
    await safeUnlink(job.rawRetryPath);
    job.rawRetryPath = undefined;
  }
  if (job.artifactPaths) {
    await Promise.all(
      Object.values(job.artifactPaths).map((art) => safeUnlink(art.localPath))
    );
    job.artifactPaths = undefined;
  }
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
    signal: AbortSignal.timeout(120_000),
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

function parseFfmpegTimeSeconds(line: string): number | null {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const h = Number(match[1]) || 0;
  const m = Number(match[2]) || 0;
  const s = Number(match[3]) || 0;
  return h * 3600 + m * 60 + s;
}

function runProcess(
  bin: string,
  args: string[],
  durationSec?: number,
  onProgressPct?: (pct: number) => void,
  onSpawn?: (proc: ReturnType<typeof spawn>) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    onSpawn?.(proc);
    let stderrTail = '';
    proc.stderr?.on('data', (chunk) => {
      const txt = chunk.toString();
      stderrTail = (stderrTail + txt).slice(-3000);
      if (durationSec && durationSec > 0 && onProgressPct) {
        const cur = parseFfmpegTimeSeconds(txt);
        if (cur !== null) {
          const pct = Math.min(99, Math.max(0, (cur / durationSec) * 100));
          onProgressPct(pct);
        }
      }
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code, signal) => {
      if (code === 0) resolve();
      else if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        const cancelErr: any = new Error('Video optimization cancelled.');
        cancelErr.isCancelled = true;
        reject(cancelErr);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail.slice(-600)}`));
      }
    });
  });
}

async function probeVideoMetadata(
  ffprobeBin: string,
  ffmpegBin: string,
  inputPath: string
): Promise<{ width: number; height: number; durationSec: number; hasAudio: boolean; videoCodec: string; audioCodec: string }> {
  try {
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      inputPath,
    ], { timeout: 15000 });
    const parsed = JSON.parse(stdout || '{}');
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');
    return {
      width: Number(videoStream?.width) || 1280,
      height: Number(videoStream?.height) || 720,
      durationSec: Number(parsed?.format?.duration) || Number(videoStream?.duration) || 0,
      hasAudio: Boolean(audioStream),
      videoCodec: String(videoStream?.codec_name || '').toLowerCase(),
      audioCodec: String(audioStream?.codec_name || '').toLowerCase(),
    };
  } catch {
    // Fallback to parsing `ffmpeg -i` stderr when ffprobe is unavailable
    try {
      const stderrOut: string = await new Promise((resolve) => {
        const p = spawn(ffmpegBin, ['-i', inputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
        let buf = '';
        p.stderr?.on('data', (c) => {
          buf += c.toString();
        });
        p.on('close', () => resolve(buf));
        p.on('error', () => resolve(''));
      });
      const durMatch = stderrOut.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      const durationSec = durMatch
        ? (Number(durMatch[1]) || 0) * 3600 + (Number(durMatch[2]) || 0) * 60 + (Number(durMatch[3]) || 0)
        : 0;
      const vidMatch = stderrOut.match(/Video:\s*([a-zA-Z0-9_]+)[^\n]*?,\s*(\d{2,5})x(\d{2,5})/);
      const audMatch = stderrOut.match(/Audio:\s*([a-zA-Z0-9_]+)/);
      return {
        width: vidMatch ? Number(vidMatch[2]) || 1280 : 1280,
        height: vidMatch ? Number(vidMatch[3]) || 720 : 720,
        durationSec,
        hasAudio: Boolean(audMatch),
        videoCodec: vidMatch ? vidMatch[1].toLowerCase() : '',
        audioCodec: audMatch ? audMatch[1].toLowerCase() : '',
      };
    } catch {
      return { width: 1280, height: 720, durationSec: 0, hasAudio: false, videoCodec: '', audioCodec: '' };
    }
  }
}

function serializePublicJob(job: VideoOptimizationJob) {
  const {
    artifactPaths: _omitPaths,
    rawRetryPath: _omitRaw,
    activeChild: _omitChild,
    authHeader: _omitAuth,
    anonKey: _omitAnon,
    vttContent: _omitVtt,
    ...publicJob
  } = job;
  return publicJob;
}

async function processVideoJobAsync(params: {
  jobId: string;
  rawPath: string;
  originalName: string;
  originalSize: number;
  bucket: 'projects' | 'articles';
  folderPrefix: string;
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
}) {
  const job = loadVideoJob(params.jobId);
  if (!job) {
    await safeUnlink(params.rawPath);
    return;
  }

  const baseStem = params.originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${params.folderPrefix || 'videos'}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const passLogPrefix = path.join(MEDIA_TEMP_DIR, `passlog_${params.jobId}`);
  const artifacts: Record<string, JobArtifactDescriptor> = {};
  let keepRawForRetry = false;
  let keepArtifactsForClient = false;

  const registerArtifact = async (
    key: string,
    localPath: string,
    fileName: string,
    contentType: string
  ) => {
    const stat = await fs.promises.stat(localPath);
    artifacts[key] = {
      key,
      localPath,
      storagePath: `${uniquePrefix}_${fileName}`,
      fileName,
      contentType,
      bytes: stat.size,
    };
  };

  try {
    job.status = 'processing';
    job.progress = 42;
    job.stage = 'Inspecting video metadata...';
    job.updatedAt = Date.now();
    persistVideoJob(job);

    const { bin, ffprobeBin } = await getFfmpegCapabilities();
    if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

    const meta = await probeVideoMetadata(ffprobeBin, bin, params.rawPath);
    const dur = meta.durationSec > 0 ? Math.round(meta.durationSec * 10) / 10 : 10;
    job.durationSec = dur;
    job.width = meta.width;
    job.height = meta.height;

    const rawStat = await fs.promises.stat(params.rawPath).catch(() => null);
    const inputBytes = rawStat?.size || params.originalSize || 0;
    if (inputBytes <= 0) {
      throw new Error('Uploaded video file is empty.');
    }

    const targetMaxW = 1280;
    const targetMaxH = 720;
    const resLabel = meta.height >= 720 || meta.width >= 1280 ? '720p' : `${meta.height || 480}p`;
    job.resolution = resLabel;

    const isAlreadyCompactH264 =
      meta.videoCodec === 'h264' &&
      meta.width > 0 &&
      meta.width <= targetMaxW &&
      meta.height > 0 &&
      meta.height <= targetMaxH &&
      inputBytes <= 3.5 * 1024 * 1024;

    if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

    const outMp4 = path.join(MEDIA_TEMP_DIR, `opt_${params.jobId}.mp4`);
    job.stage = isAlreadyCompactH264 ? 'Fast-optimizing MP4 stream...' : 'Compressing video...';
    job.updatedAt = Date.now();
    persistVideoJob(job);

    const ffmpegArgs = isAlreadyCompactH264
      ? [
          '-y',
          '-i', params.rawPath,
          '-map_metadata', '-1',
          '-c:v', 'copy',
          ...(meta.hasAudio
            ? meta.audioCodec === 'aac'
              ? ['-c:a', 'copy']
              : ['-c:a', 'aac', '-b:a', '96k', '-ac', '2']
            : ['-an']),
          '-movflags', '+faststart',
          outMp4,
        ]
      : [
          '-y',
          '-threads', '0',
          '-i', params.rawPath,
          '-vf', [
            `scale='min(${targetMaxW},iw)':'min(${targetMaxH},ih)':force_original_aspect_ratio=decrease:flags=lanczos`,
            'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          ].join(','),
          '-map_metadata', '-1',
          '-c:v', 'libx264',
          '-profile:v', 'high',
          '-level:v', '4.1',
          '-crf', '24',
          '-maxrate', '1200k',
          '-bufsize', '2400k',
          '-preset', 'superfast',
          '-g', '60',
          '-pix_fmt', 'yuv420p',
          ...(meta.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']),
          '-movflags', '+faststart',
          outMp4,
        ];

    await runProcess(
      bin,
      ffmpegArgs,
      dur,
      (pct) => {
        if (!job.cancelled) {
          job.progress = Math.min(89, Math.round(45 + (pct / 100) * 44));
          job.updatedAt = Date.now();
        }
      },
      (child) => {
        job.activeChild = child;
        if (job.cancelled) try { child.kill('SIGKILL'); } catch {}
      }
    );
    job.activeChild = undefined;

    await registerArtifact('video', outMp4, `${baseStem}.mp4`, 'video/mp4');

    if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

    const primaryArtifact = artifacts.video;
    if (!primaryArtifact || primaryArtifact.bytes <= 0) {
      throw new Error('FFmpeg did not produce a valid output video stream.');
    }

    job.format = 'h264';
    job.bytes = primaryArtifact.bytes;
    job.originalBytes = params.originalSize || inputBytes;
    job.fileSize = formatMediaBytes(primaryArtifact.bytes);
    job.fileName = primaryArtifact.fileName;
    job.storagePath = primaryArtifact.storagePath;
    job.compressionPct =
      (params.originalSize || inputBytes) > 0
        ? Math.round((((params.originalSize || inputBytes) - primaryArtifact.bytes) / (params.originalSize || inputBytes)) * 1000) / 10
        : 0;

    job.status = 'uploading';
    job.progress = 92;
    job.stage = `Saving optimized video to "${params.bucket}"...`;
    job.updatedAt = Date.now();
    persistVideoJob(job);

    try {
      const buf = await fs.promises.readFile(primaryArtifact.localPath);
      const uploadedUrl = await uploadMediaToSupabaseStorage({
        supabaseUrl: params.supabaseUrl,
        anonKey: params.anonKey,
        authHeader: params.authHeader,
        bucket: params.bucket,
        storagePath: primaryArtifact.storagePath,
        data: buf,
        contentType: 'video/mp4',
      });
      primaryArtifact.publicUrl = uploadedUrl;

      job.h264Urls = { '720p': uploadedUrl };
      job.av1Urls = undefined;
      job.posterUrl = undefined;
      job.spriteUrl = undefined;
      job.vttThumbnailsUrl = undefined;
      job.publicUrl = uploadedUrl;
      job.status = 'completed';
      job.progress = 100;
      job.stage = 'Completed';
      job.updatedAt = Date.now();
      persistVideoJob(job);
    } catch (storageErr: any) {
      if (job.cancelled || storageErr?.isCancelled) throw storageErr;

      // Keep ONLY the single optimized MP4 temporarily for authenticated browser handoff; purge raw immediately!
      keepArtifactsForClient = true;
      job.artifactPaths = artifacts;
      job.handoffArtifacts = [
        {
          key: primaryArtifact.key,
          downloadUrl: `/api/media/job-artifact/${encodeURIComponent(params.jobId)}/${encodeURIComponent(primaryArtifact.key)}`,
          storagePath: primaryArtifact.storagePath,
          fileName: primaryArtifact.fileName,
          contentType: primaryArtifact.contentType,
          bytes: primaryArtifact.bytes,
        },
      ];
      job.directUploadUrl = `/api/media/job-artifact/${encodeURIComponent(params.jobId)}/${encodeURIComponent(primaryArtifact.key)}`;
      job.status = 'ready_for_client_upload';
      job.progress = 95;
      job.stage = `Finalizing storage upload (${job.fileSize})...`;
      job.updatedAt = Date.now();
      persistVideoJob(job);
      console.info(`[Video Job ${params.jobId}] Single-file handoff ready:`, storageErr?.message);
    }
  } catch (err: any) {
    if (job.cancelled || err?.isCancelled) {
      job.status = 'cancelled';
      job.stage = 'Cancelled';
      job.error = 'Upload cancelled';
    } else {
      console.error(`[Video Pipeline Error Job ${params.jobId}]:`, err);
      job.status = 'failed';
      job.stage = 'Optimization failed';
      job.error = err?.message || 'Video transcoding or upload failed.';
      // Retain original raw input temporarily so Retry endpoint can re-run without re-uploading
      if (fs.existsSync(params.rawPath)) {
        keepRawForRetry = true;
        job.rawRetryPath = params.rawPath;
        job.supabaseUrl = params.supabaseUrl;
        job.anonKey = params.anonKey;
        job.authHeader = params.authHeader;
      }
    }
    job.updatedAt = Date.now();
    persistVideoJob(job);
  } finally {
    job.activeChild = undefined;
    if (!keepRawForRetry) {
      await safeUnlink(params.rawPath);
    }
    if (!keepArtifactsForClient || job.cancelled || job.status === 'failed') {
      await Promise.all(Object.values(artifacts).map((art) => safeUnlink(art.localPath)));
      if (!keepArtifactsForClient) {
        job.artifactPaths = undefined;
      }
    }
    await cleanupPassLogs(passLogPrefix);
  }
}

// Optimize images with Sharp: EXIF strip, noise reduction, sharpening, responsive AVIF + WebP + JPEG fallbacks + mobile AVIF
app.post('/api/media/optimize-image', async (req, res) => {
  const ok = await runMulterSingle(imageUpload.single('file'), req, res);
  if (!ok) return;

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }

  const bucket: 'projects' | 'articles' = req.body?.bucket === 'articles' ? 'articles' : 'projects';
  const folderPrefix = String(req.body?.folderPrefix || 'images').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const isSvg = file.mimetype === 'image/svg+xml' || ext === '.svg';
    const rawBuffer = file.buffer || (file.path ? await fs.promises.readFile(file.path) : Buffer.alloc(0));
    if (!rawBuffer.length) {
      return res.status(400).json({ success: false, message: 'Uploaded image buffer is empty.' });
    }
    const baseStem = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueId = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    if (isSvg) {
      const finalFileName = `${baseStem}.svg`;
      const storagePath = `${folderPrefix}/${uniqueId}_${finalFileName}`;
      try {
        const publicUrl = await uploadMediaToSupabaseStorage({
          supabaseUrl,
          anonKey,
          authHeader,
          bucket,
          storagePath,
          data: rawBuffer,
          contentType: 'image/svg+xml',
        });
        return res.json({
          success: true,
          publicUrl,
          avifUrl: publicUrl,
          storagePath,
          fileName: finalFileName,
          fileSize: formatMediaBytes(rawBuffer.length),
          mimeType: 'image/svg+xml',
          format: 'svg',
          originalBytes: file.size,
          optimizedBytes: rawBuffer.length,
          compressionPct: 0,
        });
      } catch (storageErr: any) {
        return res.json({
          success: true,
          directUploadRequired: true,
          optimizedBase64: rawBuffer.toString('base64'),
          variants: [
            {
              key: 'avif',
              storagePath,
              fileName: finalFileName,
              mimeType: 'image/svg+xml',
              base64: rawBuffer.toString('base64'),
              bytes: rawBuffer.length,
            },
          ],
          mimeType: 'image/svg+xml',
          format: 'svg',
          storagePath,
          fileName: finalFileName,
          fileSize: formatMediaBytes(rawBuffer.length),
          originalBytes: file.size,
          optimizedBytes: rawBuffer.length,
          compressionPct: 0,
          serverNotice: storageErr?.message || 'Client storage upload handoff',
        });
      }
    }

    const sharpMod = await import('sharp');
    const sharpFn = sharpMod.default || (sharpMod as any);
    const rotated = sharpFn(rawBuffer, { failOn: 'none' }).rotate();
    const meta = await rotated.metadata().catch(() => ({ width: 1600, height: 900 }));

    // Store ONLY the single optimized AVIF image in Supabase Storage (no duplicate variant clutter)
    const buildBasePipeline = (targetWidth: number) => {
      let pipe = sharpFn(rawBuffer, { failOn: 'none' }).rotate();
      if ((meta.width || 0) >= 1200) {
        pipe = pipe.median(3);
      }
      return pipe
        .resize({ width: targetWidth, withoutEnlargement: true, kernel: 'lanczos3' })
        .sharpen({ sigma: 0.72, m1: 0.65, m2: 2.1 });
    };

    const avifResult = await buildBasePipeline(1600)
      .avif({ quality: 72, effort: 3, chromaSubsampling: '4:2:0' })
      .toBuffer({ resolveWithObject: true });

    const outAvif = avifResult.data;
    const outW = avifResult.info?.width || Math.min(1600, meta.width || 1600);
    const outH = avifResult.info?.height || meta.height || 900;
    const compressionPct =
      file.size > 0 ? Math.round(((file.size - outAvif.length) / file.size) * 1000) / 10 : 0;

    const storagePath = `${folderPrefix}/${uniqueId}_${baseStem}.avif`;
    const finalFileName = `${baseStem}.avif`;

    try {
      const publicUrl = await uploadMediaToSupabaseStorage({
        supabaseUrl,
        anonKey,
        authHeader,
        bucket,
        storagePath,
        data: outAvif,
        contentType: 'image/avif',
      });

      return res.json({
        success: true,
        publicUrl,
        avifUrl: publicUrl,
        storagePath,
        fileName: finalFileName,
        fileSize: formatMediaBytes(outAvif.length),
        mimeType: 'image/avif',
        format: 'avif',
        width: outW,
        height: outH,
        resolution: `${outW}x${outH}`,
        originalBytes: file.size,
        optimizedBytes: outAvif.length,
        compressionPct,
      });
    } catch (storageErr: any) {
      return res.json({
        success: true,
        directUploadRequired: true,
        optimizedBase64: outAvif.toString('base64'),
        variants: [
          {
            key: 'avif',
            storagePath,
            fileName: finalFileName,
            mimeType: 'image/avif',
            base64: outAvif.toString('base64'),
            bytes: outAvif.length,
          },
        ],
        mimeType: 'image/avif',
        format: 'avif',
        width: outW,
        height: outH,
        resolution: `${outW}x${outH}`,
        storagePath,
        fileName: finalFileName,
        fileSize: formatMediaBytes(outAvif.length),
        originalBytes: file.size,
        optimizedBytes: outAvif.length,
        compressionPct,
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
    if (file.path) await safeUnlink(file.path);
  }
});

// Chunked binary video upload endpoints (bypasses proxy 32MB request limits & avoids multipart overhead)

app.post('/api/media/optimize-video/init', async (req, res) => {
  try {
    const bucket: 'projects' | 'articles' = req.body?.bucket === 'articles' ? 'articles' : 'projects';
    const folderPrefix = String(req.body?.folderPrefix || 'videos').replace(/[^a-zA-Z0-9_/-]/g, '_');
    const originalName = String(req.body?.fileName || `video_${Date.now()}.mp4`);
    const originalSize = Number(req.body?.fileSize) || 0;
    const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

    try { fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true }); } catch {}
    const jobId = `vjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const rawPath = path.join(MEDIA_TEMP_DIR, `chunk_${jobId}_${safeName}`);
    await fs.promises.writeFile(rawPath, Buffer.alloc(0));

    const session: ChunkedVideoSession = {
      jobId,
      rawPath,
      bucket,
      folderPrefix,
      originalName,
      originalSize,
      receivedBytes: 0,
      chunks: {},
      supabaseUrl,
      anonKey,
      authHeader,
      createdAt: Date.now(),
    };
    chunkedVideoSessions.set(jobId, session);
    persistChunkSession(session);

    res.json({ success: true, jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Unable to initialize video upload.' });
  }
});

app.post(
  '/api/media/optimize-video/chunk/:jobId',
  express.raw({ type: ['application/octet-stream', 'application/binary'], limit: '8mb' }),
  async (req, res) => {
    const session = loadChunkSession(req.params.jobId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Video upload session not found or expired.' });
    }
    const chunkBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!chunkBuf.length) {
      return res.status(400).json({ success: false, message: 'Empty video chunk received.' });
    }
    try {
      const offsetParam = Number(req.query?.offset);
      const chunkIdxParam = req.query?.index !== undefined ? String(req.query.index) : '';
      if (Number.isFinite(offsetParam) && offsetParam >= 0) {
        // Idempotent offset write so retrying a timed-out chunk never duplicates bytes
        const fh = await fs.promises.open(session.rawPath, fs.existsSync(session.rawPath) ? 'r+' : 'w+');
        try {
          await fh.write(chunkBuf, 0, chunkBuf.length, offsetParam);
        } finally {
          await fh.close();
        }
        const key = chunkIdxParam || String(offsetParam);
        session.chunks[key] = chunkBuf.length;
        session.receivedBytes = Object.values(session.chunks).reduce((a, b) => a + b, 0);
      } else {
        await fs.promises.appendFile(session.rawPath, chunkBuf);
        session.receivedBytes += chunkBuf.length;
      }
      persistChunkSession(session);
      res.json({ success: true, receivedBytes: session.receivedBytes });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to write video chunk.' });
    }
  }
);

app.post('/api/media/optimize-video/finish/:jobId', async (req, res) => {
  const session = loadChunkSession(req.params.jobId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Video upload session not found or expired.' });
  }
  removeChunkSession(req.params.jobId);

  // Refresh Supabase auth headers if supplied on finish
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);
  const resolvedAuth = req.headers.authorization ? authHeader : session.authHeader;

  if (!fs.existsSync(session.rawPath)) {
    return res.status(400).json({ success: false, message: 'Uploaded video chunks missing on server.' });
  }
  const diskStat = await fs.promises.stat(session.rawPath).catch(() => null);
  if (!diskStat || diskStat.size <= 0) {
    await safeUnlink(session.rawPath);
    return res.status(400).json({ success: false, message: 'Uploaded video payload is empty.' });
  }

  const now = Date.now();
  const effectiveSize = session.originalSize || diskStat.size;
  const job: VideoOptimizationJob = {
    jobId: session.jobId,
    bucket: session.bucket,
    folderPrefix: session.folderPrefix,
    originalName: session.originalName,
    status: 'queued',
    progress: 42,
    stage: 'Optimizing video...',
    format: 'h264',
    originalBytes: effectiveSize,
    createdAt: now,
    updatedAt: now,
  };
  videoJobs.set(session.jobId, job);
  persistVideoJob(job);

  setImmediate(() => {
    void processVideoJobAsync({
      jobId: session.jobId,
      rawPath: session.rawPath,
      originalName: session.originalName,
      originalSize: effectiveSize,
      bucket: session.bucket,
      folderPrefix: session.folderPrefix,
      supabaseUrl: supabaseUrl || session.supabaseUrl,
      anonKey: anonKey || session.anonKey,
      authHeader: resolvedAuth,
    });
  });

  res.status(202).json({
    success: true,
    jobId: session.jobId,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
  });
});

// Enqueue background video optimization job (single fast optimized MP4)
app.post('/api/media/optimize-video', async (req, res) => {
  const ok = await runMulterSingle(videoUpload.single('file'), req, res);
  if (!ok) return;

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No video file provided.' });
  }

  const bucket: 'projects' | 'articles' = req.body?.bucket === 'articles' ? 'articles' : 'projects';
  const folderPrefix = String(req.body?.folderPrefix || 'videos').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

  const jobId = `vjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();
  const job: VideoOptimizationJob = {
    jobId,
    bucket,
    folderPrefix,
    originalName: file.originalname,
    status: 'queued',
    progress: 42,
    stage: 'Optimizing video...',
    format: 'h264',
    originalBytes: file.size,
    createdAt: now,
    updatedAt: now,
  };
  videoJobs.set(jobId, job);
  persistVideoJob(job);

  setImmediate(() => {
    void processVideoJobAsync({
      jobId,
      rawPath: file.path,
      originalName: file.originalname,
      originalSize: file.size,
      bucket,
      folderPrefix,
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

// List recent optimization jobs for Media Management Dashboard monitoring
app.get('/api/media/jobs', (_req, res) => {
  const jobs = Array.from(videoJobs.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 60)
    .map(serializePublicJob);
  res.json({ success: true, jobs });
});

// Poll background video optimization job status
app.get('/api/media/jobs/:jobId', (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Video processing job not found or expired.' });
  }
  res.json({ success: true, job: serializePublicJob(job) });
});

// Retry failed video optimization job if retained raw temp source exists
app.post('/api/media/jobs/:jobId/retry', (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Video job not found or expired.' });
  }
  if (job.status !== 'failed') {
    return res.status(400).json({ success: false, message: `Job cannot be retried in state "${job.status}".` });
  }
  if (!job.rawRetryPath || !fs.existsSync(job.rawRetryPath)) {
    return res.status(410).json({ success: false, message: 'Source video temp file expired. Please re-select the file.' });
  }

  const retryRawPath = job.rawRetryPath;
  job.rawRetryPath = undefined;
  job.cancelled = false;
  job.error = undefined;
  job.status = 'queued';
  job.progress = 42;
  job.stage = 'Retrying video optimization...';
  job.updatedAt = Date.now();
  persistVideoJob(job);

  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);
  setImmediate(() => {
    void processVideoJobAsync({
      jobId: job.jobId,
      rawPath: retryRawPath,
      originalName: job.originalName,
      originalSize: job.originalBytes || 0,
      bucket: job.bucket,
      folderPrefix: job.folderPrefix,
      supabaseUrl: supabaseUrl || job.supabaseUrl || DEFAULT_SUPABASE_URL,
      anonKey: anonKey || job.anonKey || DEFAULT_SUPABASE_ANON_KEY,
      authHeader: req.headers.authorization ? authHeader : (job.authHeader || authHeader),
    });
  });

  res.status(202).json({ success: true, job: serializePublicJob(job) });
});

// Cancel active background video optimization job or chunked upload session immediately
app.post('/api/media/jobs/:jobId/cancel', async (req, res) => {
  const chunkSession = loadChunkSession(req.params.jobId);
  if (chunkSession) {
    removeChunkSession(req.params.jobId);
    await safeUnlink(chunkSession.rawPath);
    return res.json({ success: true, status: 'cancelled' });
  }
  const job = loadVideoJob(req.params.jobId);
  if (!job) {
    return res.json({ success: true, status: 'not_found' });
  }
  job.cancelled = true;
  job.status = 'cancelled';
  job.stage = 'Cancelled';
  job.updatedAt = Date.now();
  if (job.activeChild) {
    try {
      job.activeChild.kill('SIGKILL');
    } catch {}
  }
  await cleanupJobTempArtifacts(job, false);
  persistVideoJob(job);
  res.json({ success: true, status: 'cancelled' });
});

// Complete client storage handoff -> wipe temp optimized artifacts immediately & mark job completed
app.post('/api/media/jobs/:jobId/complete-handoff', async (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  if (!job) {
    return res.json({ success: true, status: 'not_found' });
  }
  const { publicUrl, av1Urls, h264Urls, posterUrl, vttThumbnailsUrl, spriteUrl } = req.body || {};
  if (publicUrl) job.publicUrl = publicUrl;
  if (av1Urls) job.av1Urls = av1Urls;
  if (h264Urls) job.h264Urls = h264Urls;
  if (posterUrl) job.posterUrl = posterUrl;
  if (vttThumbnailsUrl) job.vttThumbnailsUrl = vttThumbnailsUrl;
  if (spriteUrl) job.spriteUrl = spriteUrl;
  job.status = 'completed';
  job.progress = 100;
  job.stage = 'Completed';
  job.updatedAt = Date.now();
  await cleanupJobTempArtifacts(job, false);
  persistVideoJob(job);
  res.json({ success: true, job: serializePublicJob(job) });
});

// Stream an optimized video artifact to authenticated client for storage handoff
app.get('/api/media/job-artifact/:jobId/:variantKey', async (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  const art = job?.artifactPaths?.[req.params.variantKey];
  if (!job || !art || !fs.existsSync(art.localPath)) {
    return res.status(404).json({ success: false, message: 'Optimized media artifact not found.' });
  }
  try {
    const stat = await fs.promises.stat(art.localPath);
    res.setHeader('Content-Length', String(stat.size));
  } catch {}
  res.setHeader('Content-Type', art.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(art.fileName)}"`);
  fs.createReadStream(art.localPath).pipe(res);
});

// Single-file artifact fallback route
app.get('/api/media/job-file/:jobId', async (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  const art =
    job?.artifactPaths?.video ||
    job?.artifactPaths?.av1_1080p ||
    job?.artifactPaths?.av1_720p ||
    job?.artifactPaths?.h264_1080p ||
    job?.artifactPaths?.h264_720p;
  if (!job || !art || !fs.existsSync(art.localPath)) {
    return res.status(404).json({ success: false, message: 'Optimized video file not found.' });
  }
  try {
    const stat = await fs.promises.stat(art.localPath);
    res.setHeader('Content-Length', String(stat.size));
  } catch {}
  res.setHeader('Content-Type', art.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(art.fileName)}"`);
  fs.createReadStream(art.localPath).pipe(res);
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
