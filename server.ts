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
  res.json({
    ok: true,
    status: 'ok',
    port: Number(PORT),
    mediaPipeline: process.env.VERCEL !== '1',
    timestamp: new Date().toISOString(),
  });
});

// Enable Gzip and Brotli compression for fast loading and reduced bandwidth
app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (
      req.headers['x-no-compression'] ||
      req.path.startsWith('/api/media/video/chunk')
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
      discipline: row.discipline !== undefined && row.discipline !== null ? row.discipline : (custom.discipline !== undefined ? custom.discipline : 'Mechanical Hardware & Thermal Systems'),
      badges: row.badges !== undefined && row.badges !== null ? row.badges : (custom.badges !== undefined ? custom.badges : 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT'),
      country: row.country !== undefined && row.country !== null ? row.country : (custom.country !== undefined ? custom.country : 'United States'),
      header: resolvedHeader,
      degree: row.degree !== undefined && row.degree !== null ? row.degree : (custom.degree !== undefined ? custom.degree : 'B.S. in Mechanical Engineering (BSME)'),
      academicHonors: row.academicHonors !== undefined && row.academicHonors !== null ? row.academicHonors : (custom.academicHonors !== undefined ? custom.academicHonors : 'ABET Accredited · Honors (GPA 3.84 / 4.00)'),
      leadership: row.leadership !== undefined && row.leadership !== null ? row.leadership : (custom.leadership !== undefined ? custom.leadership : 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer'),
      skills: row.skills !== undefined && row.skills !== null ? row.skills : (custom.skills !== undefined ? custom.skills : 'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, CNC Machine, Laser Engraver/Cutter, 3D Animation, FEA Analysis'),
      ...(Array.isArray(custom.certifiedSkills) ? { certifiedSkills: custom.certifiedSkills } : {}),
      ...(custom.skillStatuses && typeof custom.skillStatuses === 'object' ? { skillStatuses: custom.skillStatuses } : {}),
      ...(Array.isArray(custom.experiences) ? { experiences: custom.experiences } : {}),
      ...(Array.isArray(custom.publications) ? { publications: custom.publications } : {}),
      ...(Array.isArray(custom.achievements) ? { achievements: custom.achievements } : {}),
      ...(Array.isArray(custom.deletedDocIds) ? { deletedDocIds: custom.deletedDocIds } : {}),
      description: resolvedDescription,
      shortSummary: row.shortSummary !== undefined && row.shortSummary !== null ? row.shortSummary : (custom.shortSummary || ''),
      availabilityStatus: row.availabilityStatus !== undefined && row.availabilityStatus !== null ? row.availabilityStatus : (custom.availabilityStatus || 'Active & Available for Q4 2026 Roles'),
      workClearance: row.workClearance !== undefined && row.workClearance !== null ? row.workClearance : (custom.workClearance || 'US Authorized · No Visa Sponsorship Required'),
      targetLocations: row.targetLocations !== undefined && row.targetLocations !== null ? row.targetLocations : (custom.targetLocations || 'San Francisco / Silicon Valley, Seattle, Austin, Boston'),
      linkedinUrl: row.linkedinUrl !== undefined && row.linkedinUrl !== null ? row.linkedinUrl : (custom.linkedinUrl !== undefined ? custom.linkedinUrl : 'https://linkedin.com'),
      facebookUrl: row.facebookUrl !== undefined && row.facebookUrl !== null ? row.facebookUrl : (custom.facebookUrl !== undefined ? custom.facebookUrl : 'https://facebook.com'),
      indeedUrl: row.indeedUrl !== undefined && row.indeedUrl !== null ? row.indeedUrl : (custom.indeedUrl !== undefined ? custom.indeedUrl : 'https://indeed.com'),
      emailUrl: custom.emailUrl !== undefined ? custom.emailUrl : (resolvedEmail ? `mailto:${resolvedEmail}` : 'mailto:festusjohnson028@gmail.com'),
      twitterUrl: row.twitterUrl !== undefined && row.twitterUrl !== null ? row.twitterUrl : (custom.twitterUrl !== undefined ? custom.twitterUrl : 'https://x.com'),
      tiktokUrl: custom.tiktokUrl !== undefined ? custom.tiktokUrl : (row.tiktokUrl !== undefined && row.tiktokUrl !== null ? row.tiktokUrl : 'https://tiktok.com'),
      instagramUrl: row.instagramUrl !== undefined && row.instagramUrl !== null ? row.instagramUrl : (custom.instagramUrl !== undefined ? custom.instagramUrl : 'https://instagram.com'),
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
// 9. UNIFIED MEDIA OPTIMIZATION PIPELINE (SHARP AVIF & FFMPEG H.264)
// =================================================================
const execFileAsync = promisify(execFile);

const DEFAULT_SUPABASE_URL = 'https://teszyojnwaedjvqaqake.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-XgRARzNT0COeyl9FE66Lw_-k6wMWex';

const MEDIA_TEMP_DIR = path.join(os.tmpdir(), 'fesline_media_v2');
try {
  fs.mkdirSync(MEDIA_TEMP_DIR, { recursive: true });
} catch {}

// Clean up any leftover legacy temp directory from earlier builds
try {
  const legacyDir = path.join(os.tmpdir(), 'fesline_media_jobs');
  if (fs.existsSync(legacyDir)) {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
} catch {}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const relayUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

export interface VideoOptimizationJob {
  jobId: string;
  bucket: 'projects' | 'articles';
  folderPrefix: string;
  originalName: string;
  storagePath?: string;
  status: 'queued' | 'processing' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  format: string;
  resolution?: string;
  width?: number;
  height?: number;
  publicUrl?: string;
  h264Urls?: { '720p'?: string; '1080p'?: string };
  rawRetryPath?: string;
  optimizedRetryPath?: string;
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

interface VideoUploadSession {
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

const videoJobs = new Map<string, VideoOptimizationJob>();
const videoSessions = new Map<string, VideoUploadSession>();

function getSessionMetaPath(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(MEDIA_TEMP_DIR, `sess_${safeId}.json`);
}

function getJobMetaPath(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(MEDIA_TEMP_DIR, `job_${safeId}.json`);
}

function persistSession(session: VideoUploadSession): void {
  try {
    fs.writeFileSync(getSessionMetaPath(session.jobId), JSON.stringify(session));
  } catch {}
}

function loadSession(jobId: string): VideoUploadSession | undefined {
  const cached = videoSessions.get(jobId);
  if (cached) return cached;
  try {
    const metaPath = getSessionMetaPath(jobId);
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as VideoUploadSession;
      if (parsed?.jobId) {
        videoSessions.set(parsed.jobId, parsed);
        return parsed;
      }
    }
  } catch {}
  return undefined;
}

function removeSessionMeta(jobId: string): void {
  videoSessions.delete(jobId);
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
      if (parsed?.jobId) {
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

// Prune completed/failed job metadata & temporary files automatically
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const retryCutoff = Date.now() - 30 * 60 * 1000;
  const sessionCutoff = Date.now() - 25 * 60 * 1000;

  for (const [id, job] of videoJobs.entries()) {
    if (job.rawRetryPath && (job.createdAt < retryCutoff || job.status !== 'failed')) {
      safeUnlink(job.rawRetryPath).catch(() => {});
      job.rawRetryPath = undefined;
    }
    if (job.optimizedRetryPath && (job.createdAt < retryCutoff || job.status !== 'failed')) {
      safeUnlink(job.optimizedRetryPath).catch(() => {});
      job.optimizedRetryPath = undefined;
    }
    if (job.createdAt < cutoff) {
      safeUnlink(job.rawRetryPath).catch(() => {});
      safeUnlink(job.optimizedRetryPath).catch(() => {});
      safeUnlink(getJobMetaPath(id)).catch(() => {});
      videoJobs.delete(id);
    }
  }

  for (const [id, session] of videoSessions.entries()) {
    if (session.createdAt < sessionCutoff) {
      safeUnlink(session.rawPath).catch(() => {});
      removeSessionMeta(id);
    }
  }
}, 5 * 60 * 1000).unref?.();

function formatMediaBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let cachedFfmpegInfo: {
  bin: string;
  ffprobeBin: string;
  hasX264: boolean;
  hasAac: boolean;
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
  let hasX264 = false;
  let hasAac = false;
  try {
    const { stdout } = await execFileAsync(ffmpegPath, ['-encoders'], { timeout: 10000 });
    hasX264 = /\blibx264\b/.test(stdout);
    hasAac = /\baac\b/.test(stdout);
  } catch {}
  cachedFfmpegInfo = { bin: ffmpegPath, ffprobeBin, hasX264, hasAac };
  return cachedFfmpegInfo;
}

async function safeUnlink(filePath?: string | null) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
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
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).replace(/\/+$/, '');

  const anonKey =
    (req.headers['x-supabase-anon-key'] as string) ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  const incomingAuth = req.headers.authorization;
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const authHeader =
    incomingAuth && incomingAuth.startsWith('Bearer ')
      ? incomingAuth
      : serviceRoleKey
      ? `Bearer ${serviceRoleKey}`
      : `Bearer ${anonKey}`;

  return { supabaseUrl, anonKey, authHeader, serviceRoleKey };
}

function encodeTusMetadata(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k} ${Buffer.from(v, 'utf8').toString('base64')}`)
    .join(',');
}

async function uploadBufferViaSupabaseTus(params: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  bucket: string;
  storagePath: string;
  data: Buffer;
  contentType: string;
}): Promise<void> {
  const tusEndpoint = `${params.supabaseUrl}/storage/v1/upload/resumable`;
  const createResp = await fetch(tusEndpoint, {
    method: 'POST',
    headers: {
      apikey: params.anonKey,
      Authorization: params.authorization,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(params.data.length),
      'Upload-Metadata': encodeTusMetadata({
        bucketName: params.bucket,
        objectName: params.storagePath,
        contentType: params.contentType || 'application/octet-stream',
        cacheControl: '3600',
      }),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!createResp.ok) {
    const errText = await createResp.text().catch(() => createResp.statusText);
    const err: any = new Error(`Supabase resumable init (${params.bucket}) failed (${createResp.status}): ${errText}`);
    err.statusCode = createResp.status;
    throw err;
  }

  const locationHeader = createResp.headers.get('location') || '';
  if (!locationHeader) {
    throw new Error('Supabase resumable upload did not return an upload Location.');
  }
  const uploadUrl = locationHeader.startsWith('http')
    ? locationHeader
    : `${params.supabaseUrl}${locationHeader.startsWith('/') ? '' : '/'}${locationHeader}`;

  const TUS_CHUNK = 5 * 1024 * 1024;
  let offset = 0;
  while (offset < params.data.length) {
    const end = Math.min(params.data.length, offset + TUS_CHUNK);
    const slice = params.data.subarray(offset, end);
    let patchOk = false;
    let lastPatchErr: any = null;

    for (let attempt = 0; attempt < 3 && !patchOk; attempt++) {
      try {
        const patchResp = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            apikey: params.anonKey,
            Authorization: params.authorization,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: new Uint8Array(slice),
          signal: AbortSignal.timeout(90_000),
        });
        if (patchResp.ok) {
          const nextOffset = Number(patchResp.headers.get('upload-offset'));
          offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : end;
          patchOk = true;
        } else {
          const msg = await patchResp.text().catch(() => patchResp.statusText);
          const err: any = new Error(`Supabase resumable chunk failed (${patchResp.status}): ${msg}`);
          err.statusCode = patchResp.status;
          if (patchResp.status >= 400 && patchResp.status < 500 && patchResp.status !== 408 && patchResp.status !== 429) {
            throw err;
          }
          lastPatchErr = err;
        }
      } catch (e: any) {
        if (e?.statusCode && e.statusCode >= 400 && e.statusCode < 500 && e.statusCode !== 408 && e.statusCode !== 429) {
          throw e;
        }
        lastPatchErr = e;
      }
      if (!patchOk && attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    if (!patchOk) {
      throw lastPatchErr || new Error('Supabase resumable upload chunk failed.');
    }
  }
}

async function uploadMediaToSupabaseStorage(params: {
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
  bucket: string;
  storagePath: string;
  data: Buffer;
  contentType: string;
  upsert?: boolean;
}): Promise<string> {
  const encodedPath = params.storagePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const uploadEndpoint = `${params.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodedPath}`;
  const publicUrl = `${params.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(params.bucket)}/${encodedPath}`;
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const tryStandardPost = async (authorization: string): Promise<Response> => {
    const headers: Record<string, string> = {
      apikey: params.anonKey,
      Authorization: authorization,
      'Content-Type': params.contentType || 'application/octet-stream',
    };
    if (params.upsert) {
      headers['x-upsert'] = 'true';
    }
    return fetch(uploadEndpoint, {
      method: 'POST',
      headers,
      body: new Uint8Array(params.data),
      signal: AbortSignal.timeout(150_000),
    });
  };

  let activeAuth = params.authHeader || `Bearer ${params.anonKey}`;
  const useTusFirst = params.data.length > 20 * 1024 * 1024;
  let lastErr: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (useTusFirst) {
        try {
          await uploadBufferViaSupabaseTus({
            supabaseUrl: params.supabaseUrl,
            anonKey: params.anonKey,
            authorization: activeAuth,
            bucket: params.bucket,
            storagePath: params.storagePath,
            data: params.data,
            contentType: params.contentType,
          });
          return publicUrl;
        } catch (tusErr: any) {
          if (
            (tusErr?.statusCode === 400 || tusErr?.statusCode === 401 || tusErr?.statusCode === 403) &&
            serviceRoleKey &&
            activeAuth !== `Bearer ${serviceRoleKey}`
          ) {
            activeAuth = `Bearer ${serviceRoleKey}`;
            await uploadBufferViaSupabaseTus({
              supabaseUrl: params.supabaseUrl,
              anonKey: params.anonKey,
              authorization: activeAuth,
              bucket: params.bucket,
              storagePath: params.storagePath,
              data: params.data,
              contentType: params.contentType,
            });
            return publicUrl;
          }
          if (
            (tusErr?.statusCode === 400 || tusErr?.statusCode === 401 || tusErr?.statusCode === 403) &&
            params.bucket === 'articles' &&
            activeAuth !== `Bearer ${params.anonKey}`
          ) {
            activeAuth = `Bearer ${params.anonKey}`;
            await uploadBufferViaSupabaseTus({
              supabaseUrl: params.supabaseUrl,
              anonKey: params.anonKey,
              authorization: activeAuth,
              bucket: params.bucket,
              storagePath: params.storagePath,
              data: params.data,
              contentType: params.contentType,
            });
            return publicUrl;
          }
          throw tusErr;
        }
      }

      let resp = await tryStandardPost(activeAuth);

      // If caller sent an expired/guest/non-owner token on public-upload 'articles', recover cleanly with anonKey (or service role)
      if (!resp.ok && (resp.status === 400 || resp.status === 401 || resp.status === 403)) {
        if (serviceRoleKey && activeAuth !== `Bearer ${serviceRoleKey}`) {
          activeAuth = `Bearer ${serviceRoleKey}`;
          resp = await tryStandardPost(activeAuth);
        } else if (params.bucket === 'articles' && activeAuth !== `Bearer ${params.anonKey}`) {
          activeAuth = `Bearer ${params.anonKey}`;
          resp = await tryStandardPost(activeAuth);
        }
      }

      if (resp.ok) {
        return publicUrl;
      }

      // If standard POST hits 413 (payload size cap), escalate automatically to TUS resumable upload
      if (resp.status === 413) {
        await uploadBufferViaSupabaseTus({
          supabaseUrl: params.supabaseUrl,
          anonKey: params.anonKey,
          authorization: activeAuth,
          bucket: params.bucket,
          storagePath: params.storagePath,
          data: params.data,
          contentType: params.contentType,
        });
        return publicUrl;
      }

      const errText = await resp.text().catch(() => resp.statusText);
      const isAuthRls =
        resp.status === 401 ||
        resp.status === 403 ||
        /row-level security|unauthorized|accessdenied/i.test(errText);
      const friendlyMsg =
        isAuthRls && params.bucket === 'projects'
          ? `Supabase Storage rejected upload to "projects" (${resp.status}). Ensure you are signed in as Admin and Supabase Storage policies for "projects" are active.`
          : `Supabase Storage upload (${params.bucket}) failed (${resp.status}): ${errText}`;

      const err: any = new Error(friendlyMsg);
      err.statusCode = resp.status;
      err.isRlsOrAuth = isAuthRls;
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
        throw err;
      }
      lastErr = err;
    } catch (err: any) {
      lastErr = err;
      if (
        err?.statusCode &&
        err.statusCode >= 400 &&
        err.statusCode < 500 &&
        err.statusCode !== 408 &&
        err.statusCode !== 429
      ) {
        throw err;
      }
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw lastErr || new Error(`Supabase Storage upload (${params.bucket}) failed.`);
}

// Same-origin storage relay for non-video assets (documents, CAD, small images)
app.post('/api/media/upload-to-bucket', async (req, res) => {
  const ok = await runMulterSingle(relayUpload.single('file'), req, res);
  if (!ok) return;

  const file = req.file;
  if (!file || !file.buffer?.length) {
    return res.status(400).json({ success: false, message: 'No file provided for storage relay.' });
  }

  const rawBucket = String(req.body?.bucket || 'articles');
  const bucket = (['projects', 'articles', 'materials', 'avatars'].includes(rawBucket)
    ? rawBucket
    : 'articles') as 'projects' | 'articles' | 'materials' | 'avatars';
  const explicitPath = String(req.body?.storagePath || '').replace(/^\/+/, '');
  const folderPrefix = String(req.body?.folderPrefix || 'uploads').replace(/[^a-zA-Z0-9_/-]/g, '_');
  const contentType = String(req.body?.contentType || file.mimetype || 'application/octet-stream');
  const cleanName = (file.originalname || `upload_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = explicitPath || `${folderPrefix}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${cleanName}`;
  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

  try {
    const publicUrl = await uploadMediaToSupabaseStorage({
      supabaseUrl,
      anonKey,
      authHeader,
      bucket,
      storagePath,
      data: file.buffer,
      contentType,
      upsert: Boolean(explicitPath),
    });
    return res.json({
      success: true,
      publicUrl,
      storagePath,
      fileName: cleanName,
      fileSize: formatMediaBytes(file.buffer.length),
    });
  } catch (err: any) {
    const status = err?.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502;
    return res.status(status).json({
      success: false,
      message: err?.message || `Storage upload to "${bucket}" failed.`,
    });
  }
});

function parseFfmpegTimeSeconds(line: string): number | null {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const h = Number(match[1]) || 0;
  const m = Number(match[2]) || 0;
  const s = Number(match[3]) || 0;
  return h * 3600 + m * 60 + s;
}

function runFfmpegProcess(
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
    rawRetryPath: _omitRaw,
    optimizedRetryPath: _omitOpt,
    activeChild: _omitChild,
    authHeader: _omitAuth,
    anonKey: _omitAnon,
    ...publicJob
  } = job;
  return publicJob;
}

async function runUnifiedVideoJobAsync(params: {
  jobId: string;
  rawPath?: string;
  optimizedPath?: string;
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
    await safeUnlink(params.optimizedPath);
    return;
  }

  const baseStem =
    params.originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 48) || 'video';
  const finalFileName = `${baseStem}.mp4`;
  const storagePath = `${params.folderPrefix || 'videos'}/${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${finalFileName}`;

  let activeRawPath = params.rawPath;
  let activeOptimizedPath = params.optimizedPath;
  let keepRawForRetry = false;
  let keepOptimizedForRetry = false;

  try {
    // 1. Transcode / optimize ONLY if we don't already have a completed optimized MP4 (retry upload case)
    if (!activeOptimizedPath || !fs.existsSync(activeOptimizedPath)) {
      if (!activeRawPath || !fs.existsSync(activeRawPath)) {
        throw new Error('Uploaded video source file missing on server.');
      }

      job.status = 'processing';
      job.progress = 44;
      job.stage = 'Inspecting video stream...';
      job.updatedAt = Date.now();
      persistVideoJob(job);

      const { bin, ffprobeBin } = await getFfmpegCapabilities();
      if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

      const meta = await probeVideoMetadata(ffprobeBin, bin, activeRawPath);
      const dur = meta.durationSec > 0 ? Math.round(meta.durationSec * 10) / 10 : 10;
      job.durationSec = dur;
      job.width = meta.width;
      job.height = meta.height;

      const rawStat = await fs.promises.stat(activeRawPath).catch(() => null);
      const inputBytes = rawStat?.size || params.originalSize || 0;
      if (inputBytes <= 0) {
        throw new Error('Uploaded video file is empty.');
      }

      const targetMaxW = 1280;
      const targetMaxH = 720;
      job.resolution = meta.height >= 720 || meta.width >= 1280 ? '720p' : `${meta.height || 480}p`;

      const isAlreadyCompactH264 =
        meta.videoCodec === 'h264' &&
        meta.width > 0 &&
        meta.width <= targetMaxW &&
        meta.height > 0 &&
        meta.height <= targetMaxH &&
        inputBytes <= 14 * 1024 * 1024;

      if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

      await fs.promises.mkdir(MEDIA_TEMP_DIR, { recursive: true });
      activeOptimizedPath = path.join(MEDIA_TEMP_DIR, `opt_${params.jobId}.mp4`);

      job.stage = isAlreadyCompactH264 ? 'Fast-optimizing MP4 container...' : 'Compressing video for fast playback...';
      job.updatedAt = Date.now();
      persistVideoJob(job);

      const ffmpegArgs = isAlreadyCompactH264
        ? [
            '-y',
            '-i', activeRawPath,
            '-map_metadata', '-1',
            '-c:v', 'copy',
            ...(meta.hasAudio
              ? meta.audioCodec === 'aac'
                ? ['-c:a', 'copy']
                : ['-c:a', 'aac', '-b:a', '96k', '-ac', '2']
              : ['-an']),
            '-movflags', '+faststart',
            activeOptimizedPath,
          ]
        : [
            '-y',
            '-threads', '0',
            '-i', activeRawPath,
            '-vf', [
              `scale='min(${targetMaxW},iw)':'min(${targetMaxH},ih)':force_original_aspect_ratio=decrease:flags=lanczos`,
              'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            ].join(','),
            '-map_metadata', '-1',
            '-c:v', 'libx264',
            '-profile:v', 'high',
            '-level:v', '4.1',
            '-crf', '25',
            '-maxrate', '1000k',
            '-bufsize', '2000k',
            '-preset', 'superfast',
            '-g', '60',
            '-pix_fmt', 'yuv420p',
            ...(meta.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']),
            '-movflags', '+faststart',
            activeOptimizedPath,
          ];

      await runFfmpegProcess(
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

      if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

      const outStat = await fs.promises.stat(activeOptimizedPath).catch(() => null);
      if (!outStat || outStat.size <= 0) {
        throw new Error('FFmpeg did not produce a valid optimized video.');
      }

      // Immediately discard raw source file once optimized output is verified on disk
      await safeUnlink(activeRawPath);
      activeRawPath = undefined;

      const effectiveOrig = params.originalSize || inputBytes;
      job.format = 'h264';
      job.bytes = outStat.size;
      job.originalBytes = effectiveOrig;
      job.fileSize = formatMediaBytes(outStat.size);
      job.fileName = finalFileName;
      job.storagePath = storagePath;
      job.compressionPct =
        effectiveOrig > 0
          ? Math.round(((effectiveOrig - outStat.size) / effectiveOrig) * 1000) / 10
          : 0;
    }

    if (job.cancelled) throw Object.assign(new Error('Cancelled'), { isCancelled: true });

    // 2. Upload ONLY the single final optimized MP4 directly from backend -> Supabase Storage
    job.status = 'uploading';
    job.progress = 92;
    job.stage = `Saving optimized video (${job.fileSize || ''}) to "${params.bucket}"...`;
    job.updatedAt = Date.now();
    persistVideoJob(job);

    const optBuffer = await fs.promises.readFile(activeOptimizedPath);
    const targetStoragePath = job.storagePath || storagePath;
    const uploadedUrl = await uploadMediaToSupabaseStorage({
      supabaseUrl: params.supabaseUrl,
      anonKey: params.anonKey,
      authHeader: params.authHeader,
      bucket: params.bucket,
      storagePath: targetStoragePath,
      data: optBuffer,
      contentType: 'video/mp4',
      upsert: false,
    });

    job.storagePath = targetStoragePath;
    job.fileName = job.fileName || finalFileName;
    job.h264Urls = { '720p': uploadedUrl };
    job.publicUrl = uploadedUrl;
    job.status = 'completed';
    job.progress = 100;
    job.stage = 'Completed';
    job.error = undefined;
    job.rawRetryPath = undefined;
    job.optimizedRetryPath = undefined;
    job.updatedAt = Date.now();
    persistVideoJob(job);
  } catch (err: any) {
    if (job.cancelled || err?.isCancelled) {
      job.status = 'cancelled';
      job.stage = 'Cancelled';
      job.error = 'Upload cancelled';
    } else {
      console.error(`[Video Pipeline Error Job ${params.jobId}]:`, err);
      job.status = 'failed';
      job.stage = 'Upload or optimization failed';
      job.error = err?.message || 'Video processing or storage upload failed.';
      job.supabaseUrl = params.supabaseUrl;
      job.anonKey = params.anonKey;
      job.authHeader = params.authHeader;

      if (activeOptimizedPath && fs.existsSync(activeOptimizedPath)) {
        keepOptimizedForRetry = true;
        job.optimizedRetryPath = activeOptimizedPath;
      } else if (activeRawPath && fs.existsSync(activeRawPath)) {
        keepRawForRetry = true;
        job.rawRetryPath = activeRawPath;
      }
    }
    job.updatedAt = Date.now();
    persistVideoJob(job);
  } finally {
    job.activeChild = undefined;
    if (!keepRawForRetry && activeRawPath) {
      await safeUnlink(activeRawPath);
    }
    if (!keepOptimizedForRetry && activeOptimizedPath) {
      await safeUnlink(activeOptimizedPath);
    }
  }
}

// Optimize images with Sharp: EXIF strip, noise reduction, sharpening, single clean AVIF saved to Supabase
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
    const rawBuffer = file.buffer || Buffer.alloc(0);
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
  }
});

// Unified Chunked Video Upload & Optimization Pipeline (/api/media/video/*)
app.post('/api/media/video/init', async (req, res) => {
  try {
    if (process.env.VERCEL === '1') {
      return res.json({
        success: true,
        serverlessDirectOnly: true,
      });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const bucket: 'projects' | 'articles' = body.bucket === 'articles' ? 'articles' : 'projects';
    const folderPrefix = String(body.folderPrefix || 'videos').replace(/[^a-zA-Z0-9_/-]/g, '_').slice(0, 64);
    const originalName = String(body.fileName || `video_${Date.now()}.mp4`);
    const originalSize = Number(body.fileSize) || 0;
    const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);

    await fs.promises.mkdir(MEDIA_TEMP_DIR, { recursive: true });
    const jobId = `vjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const rawExt = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.mp4';
    const rawStem = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48) || 'video';
    const safeName = `${rawStem}${rawExt}`;
    const rawPath = path.join(MEDIA_TEMP_DIR, `raw_${jobId}_${safeName}`);
    await fs.promises.writeFile(rawPath, Buffer.alloc(0));

    const session: VideoUploadSession = {
      jobId,
      rawPath,
      bucket,
      folderPrefix,
      originalName: safeName,
      originalSize,
      receivedBytes: 0,
      chunks: {},
      supabaseUrl,
      anonKey,
      authHeader,
      createdAt: Date.now(),
    };
    videoSessions.set(jobId, session);
    persistSession(session);

    return res.json({
      success: true,
      jobId,
      chunkSize: 1024 * 1024,
    });
  } catch (err: any) {
    console.error('[Video Pipeline Init Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unable to initialize video upload.',
    });
  }
});

app.post(
  '/api/media/video/chunk/:jobId',
  express.raw({ type: () => true, limit: '4mb' }),
  async (req, res) => {
    const session = loadSession(req.params.jobId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Video upload session expired or not found.' });
    }

    let chunkBuf: Buffer = Buffer.alloc(0);
    if (Buffer.isBuffer(req.body)) {
      chunkBuf = req.body;
    } else if (req.body && typeof req.body === 'object' && typeof req.body.base64 === 'string') {
      chunkBuf = Buffer.from(req.body.base64, 'base64');
    }

    if (!chunkBuf.length) {
      return res.status(400).json({ success: false, message: 'Empty video chunk received.' });
    }

    try {
      const offsetParam = Number(req.query?.offset ?? req.body?.offset);
      const chunkIdxParam = req.query?.index !== undefined
        ? String(req.query.index)
        : req.body?.index !== undefined
        ? String(req.body.index)
        : '';

      if (Number.isFinite(offsetParam) && offsetParam >= 0) {
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
      persistSession(session);
      return res.json({ success: true, receivedBytes: session.receivedBytes });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save video chunk.' });
    }
  }
);

app.post('/api/media/video/finish/:jobId', async (req, res) => {
  const session = loadSession(req.params.jobId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Video upload session expired or not found.' });
  }
  removeSessionMeta(req.params.jobId);

  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);
  const resolvedAuth = req.headers.authorization ? authHeader : session.authHeader;

  if (!fs.existsSync(session.rawPath)) {
    return res.status(400).json({ success: false, message: 'Uploaded video data missing on server.' });
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
    void runUnifiedVideoJobAsync({
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

  return res.status(202).json({
    success: true,
    jobId: session.jobId,
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

// Retry failed video job without re-uploading from device if temp artifact exists
app.post('/api/media/jobs/:jobId/retry', (req, res) => {
  const job = loadVideoJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Video job not found or expired.' });
  }
  if (job.status !== 'failed') {
    return res.status(400).json({ success: false, message: `Job cannot be retried in state "${job.status}".` });
  }

  const hasOptimized = Boolean(job.optimizedRetryPath && fs.existsSync(job.optimizedRetryPath));
  const hasRaw = Boolean(job.rawRetryPath && fs.existsSync(job.rawRetryPath));
  if (!hasOptimized && !hasRaw) {
    return res.status(410).json({ success: false, message: 'Source video temp file expired. Please re-select the file.' });
  }

  const retryOptimizedPath = hasOptimized ? job.optimizedRetryPath : undefined;
  const retryRawPath = !hasOptimized && hasRaw ? job.rawRetryPath : undefined;
  job.optimizedRetryPath = undefined;
  job.rawRetryPath = undefined;
  job.cancelled = false;
  job.error = undefined;
  job.status = 'queued';
  job.progress = hasOptimized ? 90 : 42;
  job.stage = hasOptimized ? 'Retrying storage upload...' : 'Retrying video optimization...';
  job.updatedAt = Date.now();
  persistVideoJob(job);

  const { supabaseUrl, anonKey, authHeader } = resolveSupabaseHeaders(req);
  setImmediate(() => {
    void runUnifiedVideoJobAsync({
      jobId: job.jobId,
      rawPath: retryRawPath,
      optimizedPath: retryOptimizedPath,
      originalName: job.originalName,
      originalSize: job.originalBytes || 0,
      bucket: job.bucket,
      folderPrefix: job.folderPrefix,
      supabaseUrl: supabaseUrl || job.supabaseUrl || DEFAULT_SUPABASE_URL,
      anonKey: anonKey || job.anonKey || DEFAULT_SUPABASE_ANON_KEY,
      authHeader: req.headers.authorization ? authHeader : (job.authHeader || authHeader),
    });
  });

  return res.status(202).json({ success: true, job: serializePublicJob(job) });
});

// Cancel active background video optimization job or upload session immediately
app.post('/api/media/jobs/:jobId/cancel', async (req, res) => {
  const session = loadSession(req.params.jobId);
  if (session) {
    removeSessionMeta(req.params.jobId);
    await safeUnlink(session.rawPath);
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
  await safeUnlink(job.rawRetryPath);
  await safeUnlink(job.optimizedRetryPath);
  job.rawRetryPath = undefined;
  job.optimizedRetryPath = undefined;
  persistVideoJob(job);
  return res.json({ success: true, status: 'cancelled' });
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
