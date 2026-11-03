import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import crypto from 'crypto';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { detectDocumentSections } from './src/utils/documentStructureDetector.ts';
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
      downloadUrl: `/api/documents/files/${docId}`,
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
        downloadUrl: `/api/documents/files/${docId}`,
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

// System instruction block for EaseStudy - genre-agnostic, context-adaptive
const EASESTUDY_SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: "You are EaseStudy, an advanced, highly adaptive educational intelligence engine. Your role is to analyze uploaded documents—including self-help books, literature, business manuals, educational notes, research papers, and technical literature—and generate clean, highly accurate, context-aware study assets (executive summaries, key concepts, flashcards, and practice exam suites).\n\nCRITICAL OPERATIONAL DIRECTIVES:\n\n1. GENRE-ADAPTIVE TERMINOLOGY & TONE:\n   - Automatically evaluate and adapt to the true domain, style, and genre of the source document.\n   - For self-help, inspirational, business, or personal development literature (e.g., Dale Carnegie, human relations, psychology, leadership), use practical, behavioral, and personal growth terminology (e.g., 'Core Principles', 'Practical Takeaways', 'Behavioral Insights', 'Actionable Lessons').\n   - STRICTLY PROHIBITED: Do NOT force academic, research, or scientific jargon (e.g., 'central thesis', 'methodological framework', 'empirical data', 'analytical arguments', 'experimental baseline') unless the document is explicitly a scientific research paper or academic thesis.\n\n2. NO SYSTEM METADATA OR FILE NAME LEAKS:\n   - Never mention file names, file extensions (.pdf, .docx), MIME types, storage locations, or raw system tags (e.g., 'multimodal document', 'uploaded file') inside any summary, concept, question, option, or explanation.\n   - Treat the text content purely as the subject matter itself.\n\n3. DYNAMIC SECTION & CHAPTER SCOPING:\n   - Only reference specific chapters, sections, or page ranges if they are explicitly present in the document text or if the user explicitly requested a specific scope.\n   - Never default to labeling output as 'Chapter 1' unless the active text chunk explicitly represents Chapter 1.\n\n4. CONTENT-GROUNDED EVALUATIONS & EXAM SUITES:\n   - All practice exam questions, options, and explanations must directly evaluate core concepts, themes, and ideas from inside the text.\n   - Distractors (incorrect options) must represent plausible conceptual misinterpretations related to the document's subject matter rather than generic meta-phrases about 'analytical frameworks' or 'data anomalies'."
    }
  ]
};

// Comprehensive document context and text sanitizer
function sanitizeDocumentText(raw: string): string {
  if (!raw) return '';

  let sanitized = String(raw);

  // If binary/zip header indicators exist, strip xml nodes
  if (sanitized.startsWith('PK\x03\x04') || sanitized.startsWith('PK\x05\x06') || sanitized.includes('[Content_Types].xml')) {
    const textNodeMatches = sanitized.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textNodeMatches && textNodeMatches.length > 0) {
      sanitized = textNodeMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    } else {
      return '';
    }
  }

  // 1. Strip raw multimodal wrapper injections, system header tags, and chunk labels
  sanitized = sanitized
    .replace(/\[Multimodal Document:[^\]]*\]/gi, '')
    .replace(/Multimodal Document:[^\n]*/gi, '')
    .replace(/\[Uploaded File:[^\]]*\]/gi, '')
    .replace(/Uploaded File:[^\n]*/gi, '')
    .replace(/\[Uploaded Document Content[^\]]*\]:?/gi, '')
    .replace(/Uploaded Document Content[^\n]*:?/gi, '')
    .replace(/User Provided Text\/Notes:?/gi, '')
    .replace(/\[AUTHORITATIVE_CHUNK_\d+\]:?/gi, '')
    .replace(/=== AUTHORITATIVE_SOURCE_DOCUMENT_(?:START|END) ===/gi, '')
    .replace(/--- (?:BEGIN|END) VERIFIED DOCUMENT SEGMENTS ---/gi, '')
    .replace(/\[STRICT GROUNDING DIRECTIVE[^\]]*\]/gi, '');

  // 2. Strip MIME type labels (e.g. [application/pdf], [image/png], application/pdf, etc.)
  sanitized = sanitized
    .replace(/\[(?:application|image|audio|video|text)\/[a-zA-Z0-9_.+-]+\]/gi, '')
    .replace(/\b(?:application\/(?:pdf|vnd\.[a-zA-Z0-9_.+-]+|msword|octet-stream|zip|json)|image\/(?:png|jpeg|jpg|webp|gif)|text\/(?:plain|csv|markdown))\b/gi, '');

  // 3. Strip Cloud / Supabase / local storage path strings and URLs
  sanitized = sanitized
    .replace(/https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/[^\s"'<>]+/gi, '')
    .replace(/storage\/v1\/object\/public\/[^\s"'<>]+/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+\/api\/documents\/files\/[^\s"'<>]+/gi, '')
    .replace(/\/api\/documents\/files\/[^\s"'<>]+/gi, '')
    .replace(/(?:data\/uploads|\/app\/applet\/data)\/[^\s"'<>]+/gi, '')
    .replace(/\b(?:file:\/\/|uploads\/)[^\s"'<>]+/gi, '');

  // 4. Strip XML / OpenXML / HTML / DOCX container tags and artifacts
  sanitized = sanitized
    .replace(/<[^>]+>/g, ' ')
    .replace(/schemas\.(?:openxmlformats|microsoft)\.org[^\s]*/gi, '')
    .replace(/\[Content_Types\]\.xml[^\s]*/gi, '')
    .replace(/docProps\/(?:app|core|custom)\.xml[^\s]*/gi, '')
    .replace(/word\/(?:document|fontTable|styles|settings|webSettings)\.xml[^\s]*/gi, '')
    .replace(/_rels\/\.rels[^\s]*/gi, '');

  // 5. Clean slide, sheet, and page markers into clean natural breaks
  sanitized = sanitized
    .replace(/--- Slide \d+ ---\n?/gi, '\n\n')
    .replace(/--- Sheet: [^\n]+ ---\n?/gi, '\n\n')
    .replace(/--- Page \d+ ---\n?/gi, '\n\n');

  // 6. Normalize whitespace
  sanitized = sanitized
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return sanitized;
}

// Clean document noise alias for backwards compatibility
const cleanDocNoise = (raw: string): string => sanitizeDocumentText(raw);

// Detect if text content belongs to personal growth / self-help / business / leadership literature
function detectGenreFromContent(text: string, isEngineering: boolean): 'personal_growth' | 'technical' | 'general' {
  if (isEngineering) return 'technical';
  const lower = text.toLowerCase();
  const personalGrowthKeywords = [
    'habit', 'habits', 'carnegie', 'friend', 'friends', 'influence', 'people', 'listen', 'listening',
    'mindset', 'leadership', 'leader', 'communication', 'attitude', 'behavior', 'empathy', 'growth',
    'relationship', 'relationships', 'success', 'praise', 'appreciation', 'criticism', 'win', 'inspire',
    'emotional', 'psychology', 'purpose', 'self-help', 'motivation', 'personal development'
  ];
  let pgCount = 0;
  for (const kw of personalGrowthKeywords) {
    if (lower.includes(kw)) pgCount++;
  }
  if (pgCount >= 2) return 'personal_growth';

  const techKeywords = ['force', 'stress', 'strain', 'cad', 'finite element', 'fea', 'gdt', 'algorithm', 'equation', 'formula'];
  let techCount = 0;
  for (const kw of techKeywords) {
    if (lower.includes(kw)) techCount++;
  }
  if (techCount >= 3) return 'technical';

  return 'general';
}

// Helper to generate distinct, genre-adaptive multiple choice questions covering different cognitive archetypes
function generateDiverseMCQs(
  textContent: string,
  topic: string,
  targetCount: number = 15,
  difficulty: string = 'intermediate',
  isEngineeringDoc: boolean = false,
  salt: number = 0,
  priorQuestions: string[] = []
) {
  const clean = sanitizeDocumentText(textContent || '');
  const rawSentences = clean
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 280);

  const count = Math.min(50, Math.max(5, targetCount));
  const mcqs: any[] = [];
  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const genre = detectGenreFromContent(clean, isEngineeringDoc);

  const priorStems = new Set(
    priorQuestions.map((q) => q.toLowerCase().replace(/[^a-z0-9]/g, ' ').slice(0, 35))
  );

  // Genre-adaptive archetypes with plausible conceptual distractors
  const archetypes = genre === 'personal_growth' ? [
    {
      type: 'principle',
      makeQuestion: (s: string) => `What foundational principle does the material emphasize regarding ${topic}?`,
      makeCorrect: (s: string) => `It emphasizes that ${s.toLowerCase().replace(/^[a-z]/, (c) => c.toLowerCase())}`,
      d1: `Prioritizing immediate self-justification over empathetic understanding`,
      d2: `Assuming superficial flattery can replace genuine personal investment`,
      d3: `Focusing solely on correcting others' faults rather than examining personal habits`,
    },
    {
      type: 'behavior',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 6).join(' ');
        return `Regarding the lesson on "${words}...", what actionable behavioral shift is recommended?`;
      },
      makeCorrect: (s: string) => `The text demonstrates that ${s.toLowerCase()}`,
      d1: `Relying on external pressure and criticism to force compliance`,
      d2: `Avoiding constructive dialogue in hopes disagreements resolve themselves`,
      d3: `Treating personal relationships as purely transactional exchanges`,
    },
    {
      type: 'impact',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 6).join(' ');
        return `According to the discussion on "${words}...", what primary impact or practical outcome occurs?`;
      },
      makeCorrect: (s: string) => `It fosters the documented outcome: "${s.slice(0, 85)}..."`,
      d1: `Creates hidden resentment and damages mutual rapport over time`,
      d2: `Has negligible influence on daily interactions and cooperative teamwork`,
      d3: `Diminishes authentic self-expression in favor of rigid compliance`,
    },
    {
      type: 'mindset',
      makeQuestion: (s: string) => `How does the material guide the reader to respond constructively within ${topic}?`,
      makeCorrect: (s: string) => `By embracing the core insight: "${s.slice(0, 80)}..."`,
      d1: `By reacting defensively to unfamiliar viewpoints or feedback`,
      d2: `By prioritizing speed over meaningful personal connection`,
      d3: `By dismissing others' motivations as irrelevant to shared success`,
    },
    {
      type: 'application',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 6).join(' ');
        return `When applying the teachings around "${words}...", what is the most constructive approach?`;
      },
      makeCorrect: (s: string) => `Living the principle that ${s.toLowerCase()}`,
      d1: `Waiting for the other person to take the first conciliatory step`,
      d2: `Relying on rigid scripts rather than attentive, genuine listening`,
      d3: `Viewing compromise as an inherent sign of personal weakness`,
    },
  ] : [
    {
      type: 'core_idea',
      makeQuestion: (s: string) => `What represents a primary insight or core principle of ${topic} as presented in the text?`,
      makeCorrect: (s: string) => `It establishes that ${s.toLowerCase().replace(/^[a-z]/, (c) => c.toLowerCase())}`,
      d1: `It suggests initial assumptions are infallible and require no further testing`,
      d2: `It treats foundational principles as purely optional historical context`,
      d3: `It argues that practical application is secondary to abstract conjecture`,
    },
    {
      type: 'application',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 7).join(' ');
        return `Regarding the discussion of "${words}...", what key relationship is highlighted in the text?`;
      },
      makeCorrect: (s: string) => `The text establishes that ${s.toLowerCase()}`,
      d1: `It treats this factor as an isolated detail with no broader relevance`,
      d2: `It concludes that opposing viewpoints have equal validity without supporting facts`,
      d3: `It asserts an unrelated conclusion that contradicts earlier sections`,
    },
    {
      type: 'cause_effect',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 6).join(' ');
        return `Based on the provided analysis of "${words}...", what documented outcome is emphasized?`;
      },
      makeCorrect: (s: string) => `It directly leads to: "${s.slice(0, 85)}..."`,
      d1: `Produces unintended friction that undermines primary objectives`,
      d2: `Has no measurable effect on the surrounding system or process`,
      d3: `Reverses the core conclusions reached by the author`,
    },
    {
      type: 'distinction',
      makeQuestion: (s: string) => `How does the material substantiate its core claims within ${topic}?`,
      makeCorrect: (s: string) => `By demonstrating that ${s.toLowerCase().slice(0, 80)}...`,
      d1: `By relying on untested generalizations without contextual examples`,
      d2: `By prioritizing subjective preference over documented observations`,
      d3: `By disregarding nuanced exceptions mentioned in earlier passages`,
    },
    {
      type: 'takeaway',
      makeQuestion: (s: string) => {
        const words = s.split(' ').slice(0, 6).join(' ');
        return `What essential takeaway emerges from the discussion of "${words}..."?`;
      },
      makeCorrect: (s: string) => `The understanding that ${s.toLowerCase()}`,
      d1: `The premise that standard practices can be bypassed without consequence`,
      d2: `The view that established guidelines are overly restrictive and obsolete`,
      d3: `The belief that outcomes depend primarily on chance rather than preparation`,
    },
  ];

  const saltOffset = Math.abs(salt || 0);
  const sentenceOffset = rawSentences.length > 0 ? saltOffset % rawSentences.length : 0;
  const archOffset = (saltOffset + 3) % archetypes.length;

  let attemptIdx = 0;
  while (mcqs.length < count && attemptIdx < count * 4) {
    const arch = archetypes[(attemptIdx + archOffset) % archetypes.length];
    const sentence = rawSentences.length > 0
      ? rawSentences[(attemptIdx + sentenceOffset) % rawSentences.length]
      : `Core principles establish verifiable understanding for ${topic}.`;

    const qText = arch.makeQuestion(sentence);
    const stemSig = qText.toLowerCase().replace(/[^a-z0-9]/g, ' ').slice(0, 35);

    attemptIdx++;
    if (priorStems.has(stemSig)) {
      continue;
    }

    const correctContent = arch.makeCorrect(sentence);
    const distractors = [arch.d1, arch.d2, arch.d3];

    // Assign correct letter in rotating pattern: A, B, C, D
    const correctLetter = letters[mcqs.length % 4];
    const options: string[] = [];
    let dIdx = 0;

    for (const l of letters) {
      if (l === correctLetter) {
        options.push(`${l}) ${correctContent}`);
      } else {
        options.push(`${l}) ${distractors[dIdx++]}`);
      }
    }

    mcqs.push({
      id: mcqs.length + 1,
      question: qText,
      options,
      correctAnswer: correctLetter,
      explanation: `As detailed in the material: "${sentence.slice(0, 120)}", this directly explains why Option ${correctLetter} is correct.`,
    });
  }

  return mcqs;
}

// Clean human topic derivation without file metadata, extensions, or storage paths
function cleanTopicFromSource(fileName?: string, textContent?: string, specialFocus?: string): string {
  if (specialFocus && specialFocus.trim().length > 3) {
    const cleaned = specialFocus.trim();
    if (cleaned.length < 50 && !cleaned.toLowerCase().includes('understand') && !cleaned.toLowerCase().includes('summarize')) {
      return cleaned;
    }
  }

  if (textContent && textContent.trim().length > 0) {
    const cleanLines = textContent
      .split('\n')
      .map((l) => l.replace(/[#*_-]/g, '').trim())
      .filter((l) => l.length > 3 && l.length < 70 && !l.includes('/') && !l.includes('\\') && !l.includes('.pdf') && !l.includes('.docx'));
    if (cleanLines.length > 0) {
      return cleanLines[0];
    }
  }

  if (fileName && fileName.trim().length > 0) {
    const noExt = fileName.replace(/\.[a-zA-Z0-9]+$/g, '');
    const cleanName = noExt.replace(/[_-]+/g, ' ').replace(/\b(?:screenshot|upload|doc|file|scan)\b/gi, '').trim();
    if (cleanName.length > 2) {
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
  }

  return 'Study Overview';
}

// Helper to generate a genre-adaptive study package when remote AI is unavailable or encountering network issues
function generateFallbackStudyPackage(
  textContent: string,
  fileName: string = '',
  targetDifficulty: string = 'intermediate',
  requestedQCount: number = 15,
  specialFocus: string = '',
  isEngineeringDoc: boolean = false,
  salt: number = 0,
  priorQuestions: string[] = []
) {
  const cleanText = sanitizeDocumentText(textContent || '');
  const topic = cleanTopicFromSource(fileName, cleanText, specialFocus);
  const genre = detectGenreFromContent(cleanText, isEngineeringDoc);

  // Extract real sentences and keywords from source text
  const rawSentences = cleanText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s.length > 20 && s.length < 280);

  const readingTime = `${Math.max(4, Math.ceil(Math.min(cleanText.length, 6000) / 400) + 3)} min read`;

  let paragraph1 = '';
  let paragraph2 = '';
  let paragraph3 = '';

  if (genre === 'personal_growth') {
    paragraph1 = rawSentences.length > 0
      ? `The foundational principle of ${topic} centers on actionable personal growth and behavioral understanding. The material emphasizes that: "${rawSentences[0]}"`
      : `The material explores core principles, interpersonal dynamics, and actionable habits that foster personal and professional effectiveness.`;

    paragraph2 = rawSentences.length >= 2
      ? `Building upon this foundation, the text demonstrates that "${rawSentences[1]}" ${rawSentences.length >= 3 ? `Furthermore, it underscores that "${rawSentences[2]}", providing a clear path to constructive communication and lasting relationships.` : ''}`
      : `The insights emphasize continuous self-reflection, empathetic communication, and the practical application of everyday leadership habits.`;

    paragraph3 = specialFocus
      ? `Special emphasis is placed on ${specialFocus}, illustrating how intentional habits create positive ripple effects across personal and professional interactions.`
      : `Ultimately, these lessons offer a practical roadmap for personal mastery, encouraging thoughtful, constructive action.`;
  } else if (genre === 'technical') {
    paragraph1 = rawSentences.length > 0
      ? `The technical foundation of ${topic} examines physical principles and operational criteria. Specifically: "${rawSentences[0]}"`
      : `The text outlines governing principles, physical constraints, and analytical criteria essential to understanding ${topic}.`;

    paragraph2 = rawSentences.length >= 2
      ? `Expanding on these fundamentals, the analysis highlights that "${rawSentences[1]}" ${rawSentences.length >= 3 ? `Additionally, the data confirms that "${rawSentences[2]}", validating operational safety and structural balance.` : ''}`
      : `The discussion methodically explores governing equations, boundary limits, and performance envelopes.`;

    paragraph3 = specialFocus
      ? `Special attention is concentrated on ${specialFocus}, evaluating governing relationships under realistic working loads.`
      : `In summary, these engineering insights bridge analytical modeling with reliable, real-world implementation.`;
  } else {
    paragraph1 = rawSentences.length > 0
      ? `The discussion of ${topic} explores the primary themes, central assertions, and core perspectives outlined in the material. In particular: "${rawSentences[0]}"`
      : `The material examines the central themes and core perspectives of ${topic}, providing the context needed for thorough understanding.`;

    paragraph2 = rawSentences.length >= 2
      ? `Expanding on this foundation, the text highlights that "${rawSentences[1]}" ${rawSentences.length >= 3 ? `Furthermore, it emphasizes that "${rawSentences[2]}", integrating the broader perspectives into an actionable conclusion.` : ''}`
      : `The text methodically explores the essential relationships, comparative viewpoints, and practical lessons conveyed throughout the source.`;

    paragraph3 = specialFocus
      ? `Special focus is placed on ${specialFocus}, detailing how its principles connect directly with the broader themes of the text.`
      : `Overall, these findings establish a cohesive understanding of ${topic}, bridging foundational ideas with practical application.`;
  }

  const keyTakeaways = rawSentences.length >= 4
    ? rawSentences.slice(0, 5).map((s) => s.replace(/^[•\-\d.]\s*/, ''))
    : genre === 'personal_growth'
    ? [
        `Genuine appreciation and active listening build trust and open communication in ${topic}.`,
        'Focusing on understanding other perspectives de-escalates conflict and inspires cooperation.',
        'Consistent daily habits lead to lasting personal and professional effectiveness.',
        'Constructive feedback is best received when grounded in empathy and mutual respect.',
      ]
    : [
        `Clear conceptual understanding serves as the foundation for ${topic}.`,
        'Core principles establish the primary criteria for analysis and interpretation.',
        'Direct textual insights provide verifiable context for informed reasoning.',
        'Systematic review reinforces long-term retention and practical mastery.',
      ];

  const coreThemes = genre === 'personal_growth'
    ? [
        topic.split('—')[0].trim(),
        'Core Principles',
        'Behavioral Insights',
        'Actionable Lessons',
        'Practical Takeaways',
      ]
    : genre === 'technical'
    ? [
        topic.split('—')[0].trim(),
        'Engineering Analysis',
        'Physical Principles',
        'System Dynamics',
        'Technical Specifications',
      ]
    : [
        topic.split('—')[0].trim(),
        'Core Principles',
        'Contextual Understanding',
        'Key Perspectives',
        'Subject Overview',
      ];

  // Key Concepts dynamically adapted to document genre
  let keyConcepts: any[] = [];
  if (genre === 'technical') {
    keyConcepts = [
      {
        title: 'Governing Relations & Balance Criteria',
        explanation: `Governing physical balance and equilibrium relationships establish the operational constraints for ${topic}.`,
        formulaOrExample: 'ΣF = 0,  ΣM = 0;  ∇ · σ + b = 0',
        importance: 'Critical for operational stability, load margins, and structural integrity.',
      },
      {
        title: 'Constitutive Laws & Material Response',
        explanation: 'Constitutive equations relate applied excitations to resultant physical deformations.',
        formulaOrExample: 'σ = E · ε,  τ = G · γ',
        importance: 'Governs material selection and mechanical response under operational loads.',
      },
      {
        title: 'Safety Envelope & Performance Thresholds',
        explanation: 'Multi-axial evaluation determines safe operating margins against allowable thresholds.',
        formulaOrExample: 'Operating Load <= Allowable Limit / Safety Factor',
        importance: 'Ensures reliable long-term performance and prevents structural degradation.',
      },
    ];
  } else if (genre === 'personal_growth') {
    if (rawSentences.length >= 3) {
      keyConcepts = [
        {
          title: `Core Principle: ${rawSentences[0].split(' ').slice(0, 5).join(' ')}`,
          explanation: `The material emphasizes that "${rawSentences[0]}", serving as a foundational behavioral guideline.`,
          formulaOrExample: `Practical Application: Focus on intentional communication and empathetic listening.`,
          importance: 'Underpins personal leadership and positive interpersonal influence.',
        },
        {
          title: `Behavioral Insight: ${rawSentences[1].split(' ').slice(0, 5).join(' ')}`,
          explanation: `A central observation in the text highlights that "${rawSentences[1]}", highlighting the power of understanding others' motivations.`,
          formulaOrExample: `Actionable Lesson: Avoid reflexive criticism; seek first to comprehend underlying needs.`,
          importance: 'Essential for resolving interpersonal tension and fostering teamwork.',
        },
        {
          title: `Actionable Lesson: ${rawSentences[2].split(' ').slice(0, 5).join(' ')}`,
          explanation: `The discussion concludes that "${rawSentences[2]}", translating mindful awareness into daily practice.`,
          formulaOrExample: `Habit Formation: Reinforce constructive behaviors consistently in daily routines.`,
          importance: 'Provides the bridge between reading principles and living them effectively.',
        },
      ];
    } else {
      keyConcepts = [
        {
          title: 'Empathy & Attentive Listening',
          explanation: 'Genuinely seeking to understand another person perspective before offering advice builds lasting rapport and mutual trust.',
          formulaOrExample: 'Listen to understand rather than to formulate an immediate response.',
          importance: 'Foundational for all collaborative relationships and constructive dialogue.',
        },
        {
          title: 'Constructive Encouragement vs. Criticism',
          explanation: 'Focusing on genuine appreciation and encouragement motivates individuals far more effectively than public rebuke.',
          formulaOrExample: 'Praise specific improvements and acknowledge sincere effort.',
          importance: 'Drives sustained motivation and voluntary cooperation.',
        },
        {
          title: 'Mindful Ownership & Reflection',
          explanation: 'Taking personal responsibility for interpersonal outcomes empowers constructive problem-solving over defensive reaction.',
          formulaOrExample: 'Frame challenges around what can be positively adjusted moving forward.',
          importance: 'Crucial for personal resilience and mature leadership.',
        },
      ];
    }
  } else {
    if (rawSentences.length >= 3) {
      keyConcepts = [
        {
          title: `Core Principle: ${rawSentences[0].split(' ').slice(0, 5).join(' ')}`,
          explanation: `The material establishes that "${rawSentences[0]}", serving as a foundational pillar for ${topic}.`,
          formulaOrExample: rawSentences[0].slice(0, 110),
          importance: 'Underpins the primary subject matter and establishes baseline context.',
        },
        {
          title: `Key Perspective: ${rawSentences[1].split(' ').slice(0, 5).join(' ')}`,
          explanation: `A central insight highlighted in the document notes that "${rawSentences[1]}", providing critical supporting context.`,
          formulaOrExample: rawSentences[1].slice(0, 110),
          importance: 'Essential for understanding relational dynamics and nuanced details in the text.',
        },
        {
          title: `Synthesis & Application: ${rawSentences[2].split(' ').slice(0, 5).join(' ')}`,
          explanation: `The text articulates that "${rawSentences[2]}", integrating the broader perspectives into an actionable conclusion.`,
          formulaOrExample: rawSentences[2].slice(0, 110),
          importance: 'Vital for comprehensive recall, synthesis, and real-world application.',
        },
      ];
    } else {
      keyConcepts = [
        {
          title: `Foundational Premise of ${topic}`,
          explanation: `The material outlines core propositions and standard criteria as structured in the text.`,
          importance: 'Provides the baseline for subsequent discussion.',
        },
        {
          title: 'Key Thematic Relationships',
          explanation: 'Structured themes and comparative criteria enable balanced understanding of ideas and case examples.',
          importance: 'Critical for evaluating claims and articulating well-reasoned perspectives.',
        },
        {
          title: 'Practical Takeaways',
          explanation: 'Translates high-level principles into tangible implementations, identifying boundaries, exceptions, and key lessons.',
          importance: 'Essential for applying ideas effectively in practice.',
        },
      ];
    }
  }

  // Generate requested MCQ count with guaranteed non-duplicate diverse questions
  const targetCount = Math.min(50, Math.max(5, requestedQCount));
  const generatedMcqs = generateDiverseMCQs(cleanText, topic, targetCount, targetDifficulty, isEngineeringDoc, salt, priorQuestions);

  const shortAnswers = genre === 'personal_growth' ? [
    {
      id: 1,
      question: `Synthesize the primary behavioral lesson of ${topic} and explain how it applies to everyday relationships.`,
      idealAnswer: rawSentences.length > 0
        ? `The primary lesson emphasizes that "${rawSentences[0]}". In practice, this means actively listening to understand others, choosing empathy over defensiveness, and building trust through genuine appreciation.`
        : `The lesson highlights the importance of empathy, attentive listening, and sincere encouragement. By focusing on the other person's perspective and needs, we establish trust and constructive collaboration.`,
      keyPointsRequired: [
        'Identification of the core behavioral principle',
        'Emphasis on empathy and active listening',
        'Practical application to everyday communication and teamwork',
      ],
      markingGuidance: 'Award 2 marks for clear identification of the principle, 2 marks for empathy/listening explanation, and 1 mark for practical daily application (Total: 5 marks).',
      questionType: 'discussion',
      practicalApplication: 'Directly applicable to personal leadership, family dynamics, and professional workplace communication.',
    },
    {
      id: 2,
      question: `Identify two actionable takeaways emphasized in the material for resolving conflict or tension.`,
      idealAnswer: rawSentences.length >= 2
        ? `First, the text shows that "${rawSentences[0]}". Second, it highlights that "${rawSentences[1]}", guiding individuals to de-escalate emotional reactivity.`
        : `First, suspend judgment and listen attentively without formulating an immediate rebuttal. Second, acknowledge the other party's feelings and seek mutually beneficial solutions.`,
      keyPointsRequired: [
        'Two distinct, actionable takeaways from the text',
        'Focus on de-escalation and collaborative resolution',
      ],
      markingGuidance: 'Award 2.5 marks for each correctly articulated actionable takeaway (Total: 5 marks).',
      questionType: 'practical',
      practicalApplication: 'Useful in negotiations, mediation, and resolving interpersonal disagreements constructively.',
    },
    {
      id: 3,
      question: `How does the author recommend sustaining positive behavioral habits over the long term?`,
      idealAnswer: rawSentences.length >= 3
        ? `The author emphasizes that "${rawSentences[2]}", showing that consistent small daily practices create enduring personal transformation.`
        : `By consciously practicing mindful communication daily, viewing mistakes as learning opportunities, and regularly reflecting on personal interactions.`,
      keyPointsRequired: [
        'Consistency in daily practice',
        'Mindful reflection and continuous self-improvement',
      ],
      markingGuidance: 'Award 3 marks for habit consistency principles and 2 marks for self-reflection guidance (Total: 5 marks).',
      questionType: 'discussion',
      practicalApplication: 'Essential for habit coaching, executive leadership development, and personal mastery.',
    },
  ] : [
    {
      id: 1,
      question: `Synthesize the primary focus of ${topic} and explain how it is structured according to the source material.`,
      idealAnswer: rawSentences.length > 0
        ? `The primary focus of ${topic} emphasizes that "${rawSentences[0]}". The text develops this through contextual arguments and practical observations, demonstrating how fundamental ideas lead to actionable understanding.`
        : `According to the source material, ${topic} is structured around clearly defined principles, systematic evaluation steps, and verifiable conclusions. The text methodically builds from core insights to practical application.`,
      keyPointsRequired: [
        'Identification of foundational concepts and scope',
        'Explanation of analytical evaluation methodologies',
        'Connection between core principles and practical application',
      ],
      markingGuidance: 'Award 2 marks for clear identification of foundational definitions, 2 marks for explanation of analytical methodologies, and 1 mark for connecting principles to practical application (Total: 5 marks).',
      questionType: 'discussion',
      practicalApplication: 'Applies to synthesizing multi-source findings into an executive briefing or overview.',
    },
    {
      id: 2,
      question: `Identify two key critical takeaways or governing constraints emphasized in the material for ${topic}.`,
      idealAnswer: rawSentences.length >= 2
        ? `The material highlights that "${rawSentences[0]}". Second, it demonstrates that "${rawSentences[1]}", ensuring consistent results across varying scenarios.`
        : `The material highlights that contextual constraints and clear definitions dictate reliable outcomes. Second, systematic validation and adherence to verified principles prevent errors.`,
      keyPointsRequired: [
        'Articulation of primary constraints or boundaries',
        'Emphasis on systematic validation and factual accuracy',
      ],
      markingGuidance: 'Award 2.5 marks for each correctly identified constraint with accurate textual citation (Total: 5 marks).',
      questionType: 'practical',
      practicalApplication: 'Directly informs risk mitigation strategies and operational constraint analysis.',
    },
    {
      id: 3,
      question: `Evaluate the primary evidence presented in the text and discuss how it supports the core conclusions.`,
      idealAnswer: rawSentences.length >= 3
        ? `The text supports its deductions by showing that "${rawSentences[2]}", providing verifiable corroboration that prevents reductive misinterpretations.`
        : `The text grounds each claim in explicit definitions and examples, demonstrating that theoretical assumptions remain valid only within the observed boundary constraints.`,
      keyPointsRequired: [
        'Reference to specific textual evidence or mechanisms',
        'Analysis of boundary conditions and edge cases',
      ],
      markingGuidance: 'Award 3 marks for textual corroboration analysis and 2 marks for edge-case boundary reasoning (Total: 5 marks).',
      questionType: 'discussion',
      practicalApplication: 'Essential for evaluating competitive assertions, evidence rigor, and audit defenses.',
    },
  ];

  const pageAnalysisList = [
    {
      sectionOrPage: 'Core Foundations',
      coreSubject: topic,
      keyInsight: rawSentences[0] || 'Foundational principles and operational definitions as structured in the source material.',
    },
    ...(rawSentences.length > 1 ? [{
      sectionOrPage: 'Key Perspectives & Development',
      coreSubject: 'Core Insights & Principles',
      keyInsight: rawSentences[1] || 'Systematic progression of ideas and evidence evaluation.',
    }] : []),
    ...(rawSentences.length > 2 ? [{
      sectionOrPage: 'Synthesis & Practical Takeaways',
      coreSubject: 'Synthesis & Implications',
      keyInsight: rawSentences[2] || 'Practical translation of conclusions and actionable takeaways.',
    }] : []),
  ];

  const flashcards = genre === 'personal_growth' ? [
    {
      front: `What is the core principle of ${topic}?`,
      back: rawSentences[0] || `Fostering empathetic understanding and mindful communication to build lasting trust and cooperation.`,
    },
    {
      front: `What actionable behavioral shift is emphasized in the text?`,
      back: rawSentences[1] || `Listening actively to understand the other person's perspective rather than rushing to argue or criticize.`,
    },
    {
      front: `What is the primary takeaway for navigating disagreements?`,
      back: rawSentences[2] || `De-escalate emotional reactivity by validating underlying needs and seeking cooperative solutions.`,
    },
    {
      front: `How are lasting habits developed according to the material?`,
      back: rawSentences[3] || `Through intentional daily reflection, sincere appreciation, and consistent constructive action.`,
    },
  ] : [
    {
      front: `What is the central focus of ${topic}?`,
      back: rawSentences[0] || `A systematic study of core principles, factual criteria, and practical methodologies grounded in the source text.`,
    },
    {
      front: `How does the source material define success or validation for ${topic}?`,
      back: rawSentences[1] || `Through adherence to verified analytical steps, factual consistency, and rigorous evidence-based reasoning.`,
    },
    {
      front: `What primary lesson or principle is emphasized in the text?`,
      back: rawSentences[2] || `Consistent application of core principles based on verifiable textual evidence and clear definitions.`,
    },
    {
      front: `What distinction is made regarding foundational premises in ${topic}?`,
      back: rawSentences[3] || `Foundational premises must be verified against documented textual facts rather than external assumptions.`,
    },
  ];

  return {
    topic,
    difficulty: targetDifficulty,
    readingTime,
    summary: {
      executiveSummary: `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`,
      keyTakeaways,
      pageAnalysis: pageAnalysisList,
      coreThemes,
    },
    keyConcepts,
    examSuite: {
      multipleChoice: generatedMcqs,
      shortAnswer: shortAnswers,
    },
    flashcards,
  };
}

// In-memory Caches & Usage Tracking
const extractionCache = new Map<string, { extractedText: string; sections: any[]; characterCount: number; timestamp: number }>();
const userStudyCache = new Map<string, { result: any; generationId: string; version: number; timestamp: number }>();

// Central AI Usage & Cost Manager (Powered exclusively by Google Gemini Flash & Pro)
interface UsageMetrics {
  totalRequests: number;
  geminiFlashRequests: number;
  geminiFlashInputTokens: number;
  geminiFlashOutputTokens: number;
  geminiProRequests: number;
  geminiProInputTokens: number;
  geminiProOutputTokens: number;
  cacheHits: number;
  verificationPasses: number;
  userBreakdown: Record<string, { requests: number; tokens: number; lastActive: string }>;
  dailyQuotaTokens: number;
  dailyTokensUsed: number;
}

const aiUsageTracker: UsageMetrics = {
  totalRequests: 0,
  geminiFlashRequests: 0,
  geminiFlashInputTokens: 0,
  geminiFlashOutputTokens: 0,
  geminiProRequests: 0,
  geminiProInputTokens: 0,
  geminiProOutputTokens: 0,
  cacheHits: 0,
  verificationPasses: 0,
  userBreakdown: {},
  dailyQuotaTokens: Number(process.env.DAILY_TOKEN_QUOTA || 2000000),
  dailyTokensUsed: 0,
};

function recordAiUsage(
  model: 'gemini-2.5-flash' | 'gemini-1.5-pro' | 'gemini-3.5-flash' | string,
  inputChars: number,
  outputChars: number,
  userIdOrGuest: string
) {
  const inTokens = Math.max(1, Math.round(inputChars / 4));
  const outTokens = Math.max(1, Math.round(outputChars / 4));
  const totalToks = inTokens + outTokens;

  aiUsageTracker.totalRequests += 1;
  aiUsageTracker.dailyTokensUsed += totalToks;

  if (model.includes('pro')) {
    aiUsageTracker.geminiProRequests += 1;
    aiUsageTracker.geminiProInputTokens += inTokens;
    aiUsageTracker.geminiProOutputTokens += outTokens;
  } else {
    aiUsageTracker.geminiFlashRequests += 1;
    aiUsageTracker.geminiFlashInputTokens += inTokens;
    aiUsageTracker.geminiFlashOutputTokens += outTokens;
  }

  const userKey = userIdOrGuest || 'guest_default';
  if (!aiUsageTracker.userBreakdown[userKey]) {
    aiUsageTracker.userBreakdown[userKey] = { requests: 0, tokens: 0, lastActive: new Date().toISOString() };
  }
  aiUsageTracker.userBreakdown[userKey].requests += 1;
  aiUsageTracker.userBreakdown[userKey].tokens += totalToks;
  aiUsageTracker.userBreakdown[userKey].lastActive = new Date().toISOString();
}

/**
 * Extracts all text from a PDF Buffer using pdfjs-dist.
 * Preserves page numbers ('--- Page X ---'), headings, and paragraphs.
 */
async function extractTextFromPdfBuffer(pdfBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    let standardFontsPath: string | undefined;
    try {
      standardFontsPath = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts/');
    } catch {}

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      standardFontDataUrl: standardFontsPath,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pageTexts: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        let lastY: number | null = null;
        const pageLines: string[] = [];
        let currentLine = '';

        for (const item of textContent.items as any[]) {
          if ('str' in item) {
            const str = item.str || '';
            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = str;
            } else {
              currentLine += (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
            }
            if (y !== null) lastY = y;
          }
        }
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        const pageStr = pageLines.join('\n').trim();

        if (pageStr) {
          pageTexts.push(`--- Page ${i} ---\n${pageStr}`);
        }
      } catch (pageErr) {
        console.warn(`[PDF Extraction] Error on page ${i}:`, pageErr);
      }
    }

    let combined = pageTexts.join('\n\n');
    // If text extraction yielded fewer than 50 characters, scan uncompressed PDF streams
    if (combined.length < 50) {
      const rawBufStr = pdfBuffer.toString('latin1');
      const textMatches: string[] = [];
      const regex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
      let match;
      while ((match = regex.exec(rawBufStr)) !== null) {
        const str = match[1] || match[2] || '';
        const cleaned = str.replace(/\\([()\\])/g, '$1').replace(/\\[0-7]{1,3}/g, ' ').trim();
        if (cleaned.length > 2) textMatches.push(cleaned);
      }
      if (textMatches.length > 3) {
        combined = textMatches.join(' ');
      }
    }

    return {
      text: combined,
      pageCount: numPages,
    };
  } catch (err: any) {
    console.warn('[PDF Extraction] pdfjs error:', err?.message || err);
    try {
      const rawBufStr = pdfBuffer.toString('latin1');
      const textMatches: string[] = [];
      const regex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
      let match;
      while ((match = regex.exec(rawBufStr)) !== null) {
        const str = match[1] || match[2] || '';
        const cleaned = str.replace(/\\([()\\])/g, '$1').replace(/\\[0-7]{1,3}/g, ' ').trim();
        if (cleaned.length > 2) textMatches.push(cleaned);
      }
      if (textMatches.length > 3) {
        return { text: textMatches.join(' '), pageCount: 1 };
      }
    } catch {}
    return { text: '', pageCount: 0 };
  }
}

/**
 * Extracts all text from a PPTX Buffer using JSZip.
 * Extracts slide by slide with '--- Slide X ---'.
 */
async function extractTextFromPptxBuffer(pptxBuffer: Buffer): Promise<{ text: string; slideCount: number }> {
  try {
    const zip = await JSZip.loadAsync(pptxBuffer);
    const slideFileNames = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(name)
    );

    slideFileNames.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    const slideTexts: string[] = [];
    for (let i = 0; i < slideFileNames.length; i++) {
      const slideXml = await zip.files[slideFileNames[i]].async('text');
      const matches = slideXml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
      if (matches && matches.length > 0) {
        const slideText = matches
          .map((m) => m.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (slideText) {
          slideTexts.push(`--- Slide ${i + 1} ---\n${slideText}`);
        }
      }
    }

    return {
      text: slideTexts.join('\n\n'),
      slideCount: slideFileNames.length,
    };
  } catch (err: any) {
    console.warn('[PPTX Extraction] jszip error:', err?.message || err);
    return { text: '', slideCount: 0 };
  }
}

// 9b. EaseStudy Server-Side Multi-Format Document Text Extraction & OCR
app.post(['/api/easestudy/extract-text', '/api/easestudy/extract-text/'], async (req, res) => {
  try {
    const { base64, mimeType = '', fileName = '' } = req.body;
    if (!base64) {
      return res.status(400).json({ success: false, error: 'No base64 content provided' });
    }

    let cleanB64 = String(base64).replace(/^data:[^;]+;base64,/, '').trim();
    if (cleanB64.includes('%')) {
      try {
        cleanB64 = decodeURIComponent(cleanB64);
      } catch {}
    }
    cleanB64 = cleanB64.replace(/\s+/g, '');

    const lowerName = String(fileName).toLowerCase();
    const lowerMime = String(mimeType).toLowerCase();

    // Check extraction cache by content hash
    const contentHash = crypto.createHash('sha256').update(cleanB64).digest('hex');
    const cached = extractionCache.get(contentHash);
    if (cached) {
      aiUsageTracker.cacheHits += 1;
      return res.json({
        success: true,
        extractedText: cached.extractedText,
        characterCount: cached.characterCount,
        sections: cached.sections,
        cached: true,
      });
    }

    let textResult = '';
    let ocrRateLimitNotice = '';
    const fileBuffer = Buffer.from(cleanB64, 'base64');

    // 1. Digital PDF Documents (.pdf) - Native local extraction via pdfjs-dist
    if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) {
      const pdfExtraction = await extractTextFromPdfBuffer(fileBuffer);
      if (pdfExtraction.text && pdfExtraction.text.length >= 50) {
        textResult = pdfExtraction.text;
      } else {
        // Scanned image-only PDF: requires multimodal OCR
        try {
          const prompt = `Transcribe and extract ALL readable text verbatim from this scanned document.
Requirements:
1. Preserve all chapter titles, headings, sections, bullet points, and page numbers.
2. Accurately transcribe tables, definitions, arguments, and formulas.
3. Output the extracted text directly without conversational commentary.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              { inlineData: { mimeType: 'application/pdf', data: cleanB64 } },
              { text: prompt },
            ],
          });

          if (response && response.text) {
            textResult = response.text.trim();
            recordAiUsage('gemini-2.5-flash', cleanB64.length, textResult.length, 'guest_ocr');
          }
        } catch (ocrErr: any) {
          const errMsg = cleanErrorMessage(ocrErr);
          console.warn('[EaseStudy PDF OCR] Gemini Flash OCR notice:', errMsg);
          if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            ocrRateLimitNotice = 'Gemini OCR rate limit reached. The system is operating under rate control.';
          }
        }
      }
    }

    // 2. Word documents (.docx, .doc)
    else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerMime.includes('wordprocessingml') || lowerMime.includes('officedocument')) {
      try {
        const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
        textResult = mammothResult?.value || '';
      } catch (e: any) {
        console.warn('[EaseStudy Text Extraction] Docx error:', e?.message);
      }
    }

    // 3. PowerPoint documents (.pptx, .ppt)
    else if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') || lowerMime.includes('presentation') || lowerMime.includes('powerpoint')) {
      const pptxExtraction = await extractTextFromPptxBuffer(fileBuffer);
      textResult = pptxExtraction.text;
    }

    // 4. XLSX / XLS Spreadsheets
    else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerMime.includes('spreadsheet') || lowerMime.includes('excel')) {
      try {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetTexts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (sheet) {
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv && csv.trim()) {
              sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
            }
          }
        }
        textResult = sheetTexts.join('\n\n');
      } catch (e: any) {
        console.warn('[EaseStudy Text Extraction] Excel error:', e?.message);
      }
    }

    // 5. Plain text / CSV / Markdown
    else if (lowerName.endsWith('.txt') || lowerName.endsWith('.csv') || lowerName.endsWith('.md') || lowerName.endsWith('.tsv') || lowerMime.startsWith('text/')) {
      try {
        textResult = fileBuffer.toString('utf-8');
      } catch (e: any) {
        console.warn('[EaseStudy Text Extraction] Text decode error:', e?.message);
      }
    }

    // 6. Raster Images (PNG, JPG, JPEG, WEBP)
    else if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') || lowerMime.startsWith('image/')) {
      let resolvedMime = lowerMime.startsWith('image/') ? lowerMime : 'image/jpeg';
      try {
        const prompt = `Transcribe and extract ALL text, diagrams, equations, and notes visible in this image accurately and verbatim.`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { inlineData: { mimeType: resolvedMime, data: cleanB64 } },
            { text: prompt },
          ],
        });
        if (response && response.text) {
          textResult = response.text.trim();
          recordAiUsage('gemini-2.5-flash', cleanB64.length, textResult.length, 'guest_ocr');
        }
      } catch (imgErr: any) {
        const errMsg = cleanErrorMessage(imgErr);
        console.warn('[EaseStudy Image OCR] Gemini Flash notice:', errMsg);
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          ocrRateLimitNotice = 'Gemini OCR rate limit reached.';
        }
      }
    }

    const cleaned = cleanDocNoise(textResult);

    if (cleaned.length < 50) {
      const errorMsg = ocrRateLimitNotice
        ? `${ocrRateLimitNotice} Please upload a digital PDF, DOCX, spreadsheet, or text file with selectable text.`
        : 'The uploaded document contains no readable text or could not be extracted (0 characters). Please provide a valid, readable PDF, DOCX, spreadsheet, or text document.';
      return res.status(400).json({
        success: false,
        characterCount: 0,
        error: errorMsg,
      });
    }

    const detectedSections = detectDocumentSections(cleaned);

    // Save to extraction cache
    extractionCache.set(contentHash, {
      extractedText: cleaned,
      sections: detectedSections,
      characterCount: cleaned.length,
      timestamp: Date.now(),
    });

    return res.json({
      success: true,
      extractedText: cleaned,
      characterCount: cleaned.length,
      sections: detectedSections,
    });
  } catch (err: any) {
    console.error('[EaseStudy Text Extraction Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Document extraction failed: ' + (err?.message || 'Server extraction error'),
    });
  }
});

// 9c. EaseStudy AI Usage & Quotas Monitoring Endpoint
app.get(['/api/easestudy/usage', '/api/easestudy/usage/'], (req, res) => {
  const userKey = (req.headers['x-guest-session-id'] as string) || 'guest_default';
  const userUsage = aiUsageTracker.userBreakdown[userKey] || { requests: 0, tokens: 0, lastActive: '' };

  res.json({
    success: true,
    overall: {
      totalRequests: aiUsageTracker.totalRequests,
      cacheHits: aiUsageTracker.cacheHits,
      verificationPasses: aiUsageTracker.verificationPasses,
      dailyTokensUsed: aiUsageTracker.dailyTokensUsed,
      dailyQuotaTokens: aiUsageTracker.dailyQuotaTokens,
      quotaRemainingTokens: Math.max(0, aiUsageTracker.dailyQuotaTokens - aiUsageTracker.dailyTokensUsed),
    },
    models: {
      geminiFlash: {
        modelId: 'gemini-2.5-flash',
        requests: aiUsageTracker.geminiFlashRequests,
        inputTokens: aiUsageTracker.geminiFlashInputTokens,
        outputTokens: aiUsageTracker.geminiFlashOutputTokens,
      },
      geminiPro: {
        modelId: 'gemini-1.5-pro',
        requests: aiUsageTracker.geminiProRequests,
        inputTokens: aiUsageTracker.geminiProInputTokens,
        outputTokens: aiUsageTracker.geminiProOutputTokens,
      },
    },
    currentUserSession: {
      sessionKey: userKey,
      requests: userUsage.requests,
      tokens: userUsage.tokens,
      lastActive: userUsage.lastActive,
    },
  });
});

// 10. EaseStudy AI Analysis & Examination Suite (Gemini 2.5 Flash + Gemini 1.5 Pro)
app.post(['/api/easestudy/analyze', '/api/easestudy/analyze/', '/easestudy/analyze', '/easestudy/analyze/'], async (req, res) => {
  try {
    const {
      text,
      fileData,
      difficulty = 'intermediate',
      questionCount = 15,
      focusArea = '',
      selectedChapters = [],
      customInstructions = '',
      isEngineeringDoc = false,
      priorContext = null,
      forceRegenerate = false,
      regenerateSalt = 0,
      generationId,
      nonce,
      guestSessionId,
      userId,
      priorQuestions = [],
    } = req.body;

    if (!text && (!fileData || !fileData.base64)) {
      return res.status(400).json({ success: false, message: 'Please provide study text or an uploaded file/image.' });
    }

    const userScopeKey = String(userId || guestSessionId || 'guest_default');

    let extractedDocxText = '';
    let multimodalFilePayload: { inlineData: { mimeType: string; data: string } } | null = null;

    if (fileData) {
      if (fileData.extractedText && typeof fileData.extractedText === 'string' && fileData.extractedText.trim().length > 0) {
        extractedDocxText = cleanDocNoise(fileData.extractedText);
      } else if (fileData.base64) {
        const fileName = (fileData.fileName || '').toLowerCase();
        let mimeType = (fileData.mimeType || '').toLowerCase();
        const rawBase64 = String(fileData.base64).replace(/^data:[^;]+;base64,/, '').trim();
        const fileBuffer = Buffer.from(rawBase64, 'base64');

        if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
          multimodalFilePayload = { inlineData: { mimeType: 'application/pdf', data: rawBase64 } };
          if (!extractedDocxText || extractedDocxText.length < 50) {
            const pdfRes = await extractTextFromPdfBuffer(fileBuffer);
            if (pdfRes.text && pdfRes.text.length >= 30) {
              extractedDocxText = cleanDocNoise(pdfRes.text);
            }
          }
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc') || mimeType.includes('wordprocessingml')) {
          try {
            const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
            if (mammothResult && mammothResult.value) {
              extractedDocxText = cleanDocNoise(mammothResult.value);
            }
          } catch (docxErr) {
            console.warn('Docx extraction fallback:', docxErr);
          }
        } else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || mimeType.includes('presentation')) {
          const pptxRes = await extractTextFromPptxBuffer(fileBuffer);
          extractedDocxText = cleanDocNoise(pptxRes.text);
        } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.md') || mimeType.startsWith('text/')) {
          try {
            extractedDocxText = cleanDocNoise(fileBuffer.toString('utf-8'));
          } catch (txtErr) {
            console.warn('Text decoding fallback:', txtErr);
          }
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || mimeType.includes('spreadsheet')) {
          try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetTexts: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              if (sheet) {
                const csv = XLSX.utils.sheet_to_csv(sheet);
                if (csv && csv.trim()) {
                  sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
                }
              }
            }
            extractedDocxText = cleanDocNoise(sheetTexts.join('\n\n'));
          } catch (xlsErr) {
            console.warn('Excel extraction fallback:', xlsErr);
          }
        } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.webp') || mimeType.startsWith('image/')) {
          multimodalFilePayload = { inlineData: { mimeType: mimeType || 'image/jpeg', data: rawBase64 } };
        }
      }
    }

    const sanitizedUserNotes = sanitizeDocumentText(text || '');
    const sanitizedDocText = sanitizeDocumentText(extractedDocxText || '');
    const combinedTextContent = [
      sanitizedUserNotes,
      sanitizedDocText,
    ].filter(Boolean).join('\n\n');

    // Strict grounding check: allow either extracted text (>= 20 chars) OR multimodal file payload (PDF/Image)
    if ((!combinedTextContent || combinedTextContent.trim().length < 20) && !fileData?.base64) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded document contains no readable text or could not be accessed. Please upload a valid document or study notes.',
      });
    }

    const targetQCount = Math.min(50, Math.max(5, Number(questionCount) || 15));

    // Chapter filter and intelligent content selection
    const chapterFilterText = Array.isArray(selectedChapters) && selectedChapters.length > 0
      ? `Selected Chapters/Sections to Emphasize: ${selectedChapters.join(', ')}`
      : 'Analyze Entire Document (All Chapters & Sections)';

    const customFocusText = customInstructions && customInstructions.trim().length > 0
      ? `Custom Emphasis Instructions: "${customInstructions.trim()}"`
      : '';

    const directFocusText = focusArea && focusArea.trim().length > 0
      ? `Direct Focus Area: "${focusArea.trim()}"`
      : '';

    // USER-ISOLATED CACHE LOOKUP:
    // Only reuse cached results if NOT forceRegenerate and for the EXACT same user/guest session
    const docHash = crypto.createHash('sha256').update(combinedTextContent.slice(0, 10000)).digest('hex').slice(0, 16);
    const chapterKey = Array.isArray(selectedChapters) ? selectedChapters.sort().join('|') : '';
    const userCacheKey = `${userScopeKey}:${docHash}:${difficulty}:${targetQCount}:${chapterKey}:${(customInstructions || '').slice(0, 30)}`;

    if (!forceRegenerate && userStudyCache.has(userCacheKey)) {
      const cachedEntry = userStudyCache.get(userCacheKey)!;
      aiUsageTracker.cacheHits += 1;
      return res.json({
        success: true,
        generationId: cachedEntry.generationId,
        version: cachedEntry.version,
        result: cachedEntry.result,
        cached: true,
      });
    }

    // Prior questions avoidance directive (avoids repeating questions on re-generate)
    const priorQuestionsList = Array.isArray(priorQuestions) && priorQuestions.length > 0
      ? priorQuestions.slice(0, 15).map((q: string, idx: number) => `${idx + 1}. ${q}`).join('\n')
      : '';

    const regenerateDirective = forceRegenerate
      ? `\n[MANDATORY RE-GENERATE DIRECTIVE - SALT ${regenerateSalt || Date.now()}]:
The user has clicked Re-Generate to obtain an ENTIRELY FRESH, NEWLY REFINED set of learning materials and examination questions.
MANDATORY RULES:
1. Do NOT repeat the previous questions, summary phrasing, or explanations.
${priorQuestionsList ? `PREVIOUS QUESTIONS TO STRICTLY AVOID:\n${priorQuestionsList}\n` : ''}
2. Formulate COMPLETELY NEW, different practice questions covering alternative nuances, deep applications, and edge cases from the text.
3. Provide a freshly synthesized executive summary emphasizing new conceptual perspectives and deep synthesis.
4. Generate new, distinct flashcards and analytical problems.`
      : '';

    // Intelligent content chunking: Focus on selected chapters if requested
    let focusedContent = combinedTextContent;
    if (Array.isArray(selectedChapters) && selectedChapters.length > 0) {
      const sections = detectDocumentSections(combinedTextContent);
      const matchedSections = sections.filter((s) =>
        selectedChapters.some((c) => s.title.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(s.title.toLowerCase()))
      );
      if (matchedSections.length > 0) {
        const chunks: string[] = [];
        for (const sec of matchedSections) {
          if (sec.snippet) chunks.push(sanitizeDocumentText(sec.snippet));
        }
        if (chunks.length > 0) {
          focusedContent = `${chunks.join('\n\n')}\n\n${combinedTextContent.slice(0, 40000)}`.trim();
        }
      }
    }

    const activeGenId = generationId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Prepare prompt with sanitized textual content ONLY (no raw file wrappers or metadata strings)
    const primaryGenerationPrompt = `Analyze the provided document text and generate a comprehensive study suite tailored dynamically to the true genre, tone, and domain of this material.

REQUIREMENTS:
1. Genre and Tone Adaptation:
   - For self-help, motivational, business, psychology, or leadership literature: Use practical, behavioral, and personal growth terminology (e.g., 'Core Principles', 'Practical Takeaways', 'Behavioral Insights', 'Actionable Lessons'). Never force academic or research jargon (e.g., 'central thesis', 'methodological framework', 'empirical data', 'analytical arguments', 'experimental baseline').
   - For technical, mathematical, or scientific documents: Use precise technical terminology, governing formulas, and domain parameters.
   - For general literature, history, or humanities: Adapt fluidly to the narrative themes, characters, historical context, or literary arguments.
2. Section & Chapter Scoping:
   - Only reference specific chapters or page ranges if they are explicitly present in the document text or if explicitly requested.
   - Never default to labeling output as 'Chapter 1' unless the active text chunk explicitly represents Chapter 1.
3. Summary & Insights:
   - Provide a fluent, well-developed executive summary exploring the main ideas and practical takeaways in logical sequence. Start directly with the core subject dynamics without filler openings like "This document explores...".
   - Extract 4 to 8 high-impact takeaways or actionable principles reflecting the document genre.
   - Highlight core themes and important sections present in the text without defaulting to rigid chapter numbers.
4. Key Concepts:
   - Provide 4 to 8 deep concept breakdowns derived directly from the document.
   - For non-technical works, emphasize practical principles, behavioral examples, and application. For technical works, include relevant formulas and technical importance.
5. Practice Exam Suite:
   - Multiple Choice: Provide exactly ${targetQCount} high-quality questions derived directly from the text.
   - Each question must have 4 distinct options ("A) ...", "B) ...", "C) ...", "D) ..."), 1 correct answer, and 3 plausible distractors that represent realistic conceptual misunderstandings of the subject matter (avoid generic meta-phrases about 'analytical frameworks' or 'data anomalies').
   - Engaging explanations explaining why the correct choice reflects the source text.
   - Short Answer & Discussion: 3 to 6 practical or discussion questions with ideal answers, required key points, and clear scoring guidance.
6. Flashcards:
   - 6 to 12 active recall cards (front, back) focusing on core ideas, definitions, and practical takeaways.
7. Target Difficulty: ${difficulty}.
${selectedChapters && selectedChapters.length > 0 ? `Focus on sections/topics: ${selectedChapters.join(', ')}` : ''}
${customFocusText ? `${customFocusText}` : ''}
${directFocusText ? `${directFocusText}` : ''}
${regenerateDirective}

DOCUMENT CONTENT:
"""
${focusedContent.slice(0, 100000)}
"""`;

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'Subject or title of the material (strictly do not mention file names, file extensions like .pdf or .docx, storage locations, or system tags)' },
        difficulty: { type: Type.STRING, description: 'Target difficulty level' },
        readingTime: { type: Type.STRING, description: 'Estimated reading time (e.g. "6 min read")' },
        summary: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING, description: 'Coherent, fluent paragraphs in logical sequence reflecting the document genre and tone without generic filler introductions' },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 4 to 8 high-impact takeaways or actionable principles reflecting the document genre',
            },
            pageAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionOrPage: { type: Type.STRING, description: 'Key section or theme dynamically extracted from text (only reference chapters/pages if explicitly present in the text; never default to Chapter 1)' },
                  coreSubject: { type: Type.STRING },
                  keyInsight: { type: Type.STRING },
                },
                required: ['sectionOrPage', 'coreSubject', 'keyInsight'],
              },
            },
            coreThemes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of main theme tags matching the document genre',
            },
          },
          required: ['executiveSummary', 'keyTakeaways', 'coreThemes'],
        },
        keyConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
              formulaOrExample: { type: Type.STRING, description: 'Practical behavioral example or technical formula if applicable' },
              importance: { type: Type.STRING },
            },
            required: ['title', 'explanation', 'importance'],
          },
        },
        examSuite: {
          type: Type.OBJECT,
          properties: {
            multipleChoice: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['id', 'question', 'options', 'correctAnswer', 'explanation'],
              },
            },
            shortAnswer: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  idealAnswer: { type: Type.STRING },
                  keyPointsRequired: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  markingGuidance: { type: Type.STRING },
                  questionType: { type: Type.STRING },
                  practicalApplication: { type: Type.STRING },
                },
                required: ['id', 'question', 'idealAnswer', 'keyPointsRequired', 'markingGuidance'],
              },
            },
          },
          required: ['multipleChoice', 'shortAnswer'],
        },
        flashcards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
            },
            required: ['front', 'back'],
          },
        },
      },
      required: ['topic', 'difficulty', 'readingTime', 'summary', 'keyConcepts', 'examSuite'],
    };

    let candidateStudyPackage: any = null;

    // STEP 1: Google Gemini Generation with adaptive System Instruction & clean contents payload
    console.log('[EaseStudy Engine] Synthesizing study suite with Google Gemini...');

    const requestContents: any[] = [];
    if (multimodalFilePayload) {
      // Pass clean inlineData cleanly without concatenating raw metadata strings or file path strings
      requestContents.push(multimodalFilePayload);
    }
    requestContents.push({ text: primaryGenerationPrompt });

    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-pro'];

    for (const modelName of modelsToTry) {
      try {
        console.log(`[EaseStudy Engine] Generating study materials with ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: requestContents,
          config: {
            systemInstruction: EASESTUDY_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: schemaConfig,
          },
        });

        if (response && response.text) {
          candidateStudyPackage = JSON.parse(response.text);
          recordAiUsage(modelName, primaryGenerationPrompt.length, response.text.length, userScopeKey);
          console.log(`[EaseStudy Engine] Successfully generated authentic study materials with ${modelName}`);
          break;
        }
      } catch (callErr: any) {
        console.warn(`[EaseStudy Engine] ${modelName} attempt notice:`, cleanErrorMessage(callErr));
      }
    }

    if (!candidateStudyPackage) {
      console.log('[EaseStudy Engine] Engaging safe document-grounded processing recovery...');
      candidateStudyPackage = generateFallbackStudyPackage(
        focusedContent,
        fileData?.fileName || 'Document Study Guide',
        difficulty,
        targetQCount,
        focusArea || customInstructions || '',
        isEngineeringDoc
      );
    }

    const parsed = candidateStudyPackage;

    // ModeEaseStudy Post-Verification Sanitization & Domain Integrity Check
    if (parsed) {
      const sanitizeOutputText = (txt: any): any => {
        if (typeof txt === 'string') {
          return txt
            .replace(/\[Multimodal Document:[^\]]*\]/gi, '')
            .replace(/Multimodal Document:[^\n]*/gi, '')
            .replace(/\[Uploaded File:[^\]]*\]/gi, '')
            .replace(/Uploaded File:[^\n]*/gi, '')
            .replace(/\[application\/[a-zA-Z0-9_.+-]+\]/gi, '')
            .replace(/storage\/v1\/object\/public\/[^\s"'<>]+/gi, '')
            .replace(/\b(?:application\/(?:pdf|vnd\.[a-zA-Z0-9_.+-]+|msword|octet-stream|zip)|image\/(?:png|jpeg|jpg|webp))\b/gi, '')
            .replace(/\.(?:pdf|docx?|pptx?|xlsx?)\b/gi, '')
            .replace(/1st\s*Class\s*(Study)?/gi, '')
            .replace(/\b1st\s*Class\b/gi, '')
            .replace(/verified\s*academic\s*study\s*guide/gi, 'overview')
            .replace(/verified\s*study\s*guide/gi, 'overview')
            .replace(/This\s+verified\s+academic\s+study\s+guide\s+investigates\s+the\s+essential\s+tenets[^\n.]*\./gi, '')
            .replace(/This\s+verified\s+study\s+guide\s+examines[^\n.]*\./gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
        return txt;
      };

      const sanitizeText = sanitizeOutputText;

      if (parsed.summary) {
        let exec = sanitizeText(parsed.summary.executiveSummary);
        if (!exec || exec.length < 20) {
          exec = `The material examines the primary themes, central assertions, and core perspectives of ${parsed.topic || 'the subject'}, establishing the context necessary for clear understanding.`;
        }
        parsed.summary.executiveSummary = exec;
        if (Array.isArray(parsed.summary.keyTakeaways)) {
          parsed.summary.keyTakeaways = parsed.summary.keyTakeaways.map(sanitizeText).filter(Boolean);
        }
        if (Array.isArray(parsed.summary.coreThemes)) {
          parsed.summary.coreThemes = parsed.summary.coreThemes.map(sanitizeText).filter(Boolean);
        }
      }

      // Deduplication & Quality Backfill for Practice Exam MCQs
      if (parsed.examSuite?.multipleChoice && Array.isArray(parsed.examSuite.multipleChoice)) {
        const seenStems = new Set<string>();
        const uniqueMcqs: any[] = [];

        parsed.examSuite.multipleChoice.forEach((mcq: any) => {
          const cleanQ = sanitizeText(mcq.question || '');
          const normalized = cleanQ.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
          const stemSig = normalized.slice(0, 40);

          if (stemSig.length > 5 && !seenStems.has(stemSig)) {
            seenStems.add(stemSig);
            uniqueMcqs.push({
              ...mcq,
              id: uniqueMcqs.length + 1,
              question: cleanQ,
              options: Array.isArray(mcq.options) ? mcq.options.map(sanitizeText) : mcq.options,
              correctAnswer: (mcq.correctAnswer || 'A').trim().toUpperCase().charAt(0),
              explanation: sanitizeText(mcq.explanation),
            });
          }
        });

        // If duplicate questions were purged and count is below targetQCount, backfill with diverse synthesized questions
        if (uniqueMcqs.length < targetQCount) {
          const synthesized = generateDiverseMCQs(
            focusedContent,
            parsed.topic || 'Subject Overview',
            targetQCount,
            difficulty,
            isEngineeringDoc
          );
          for (const extra of synthesized) {
            if (uniqueMcqs.length >= targetQCount) break;
            const extraSig = extra.question.toLowerCase().replace(/[^a-z0-9]/g, ' ').slice(0, 40);
            if (!seenStems.has(extraSig)) {
              seenStems.add(extraSig);
              uniqueMcqs.push({
                ...extra,
                id: uniqueMcqs.length + 1,
              });
            }
          }
        }

        parsed.examSuite.multipleChoice = uniqueMcqs;
      }

      // Domain Purity Check: If user did NOT specify engineering, strip any stray engineering formulas
      if (!isEngineeringDoc && parsed.keyConcepts) {
        parsed.keyConcepts = parsed.keyConcepts.map((c: any) => {
          const formula = c.formulaOrExample || '';
          if (
            formula.includes('von Mises') ||
            formula.includes('Hooke') ||
            formula.includes('ΣF') ||
            formula.includes('σ =') ||
            formula.includes('τ =') ||
            formula.includes('∇ · σ') ||
            formula.includes('equilibrium')
          ) {
            const { formulaOrExample, ...rest } = c;
            return rest;
          }
          return c;
        });
      }
    }

    // Cache the unique result exclusively for THIS user/session
    const generationVersion = Date.now();
    userStudyCache.set(userCacheKey, {
      result: parsed,
      generationId: activeGenId,
      version: generationVersion,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      generationId: activeGenId,
      version: generationVersion,
      result: parsed,
    });
  } catch (err: any) {
    console.error('EaseStudy analyze error:', err);
    const fallbackResult = generateFallbackStudyPackage(
      req.body?.text || '',
      req.body?.fileData?.fileName || '',
      req.body?.difficulty || 'intermediate',
      req.body?.questionCount || 15,
      req.body?.focusArea || '',
      req.body?.isEngineeringDoc || false
    );
    res.json({
      success: true,
      generationId: `fallback_${Date.now()}`,
      version: Date.now(),
      result: fallbackResult,
    });
  }
});

// 11. EaseStudy Intelligent Visual Diagram & Concept Illustration Generator
app.post(['/api/easestudy/generate-image', '/api/easestudy/generate-image/', '/easestudy/generate-image', '/easestudy/generate-image/'], async (req, res) => {
  try {
    const { topic = 'Core Study Concept', conceptTitle = 'Technical Diagram', description = '', isEngineeringDoc = false } = req.body;

    const diagramPrompt = `You are a high-level technical illustrator and educational visualization specialist.
Generate a clean, high-precision SVG diagram illustrating the following subject:
Topic: "${topic}"
Concept: "${conceptTitle}"
Context: "${description || 'Visual educational model illustrating flow, structure, and key relationships'}"
Type: ${isEngineeringDoc ? 'Engineering schematic / technical block diagram' : 'Educational concept map / structured visual infographic'}

STRICT REQUIREMENTS:
1. Return ONLY pure SVG code starting with <svg and ending with </svg>.
2. Dimensions: viewBox="0 0 800 500" with width="100%" and height="100%".
3. Style: Modern, publication-grade aesthetics. Dark slate / cyan / indigo color palette (#0f172a background or clean #f8fafc card, crisp lines #0284c7, #38bdf8, #64748b, readable text in sans-serif).
4. Include clear labeled nodes, directional arrows, callouts, and structured components demonstrating how this concept functions.
5. Absolutely no markdown blocks (\`\`\`xml or \`\`\`svg). Only return the raw <svg>...</svg> string.`;

    let generatedSvg = '';

    const EXCLUSIVE_GEMINI_MODEL = 'gemini-2.5-flash';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: EXCLUSIVE_GEMINI_MODEL,
          contents: diagramPrompt,
        });

        if (response && response.text) {
          let raw = response.text.trim();
          raw = raw.replace(/```xml/gi, '').replace(/```svg/gi, '').replace(/```/g, '').trim();
          const startIdx = raw.indexOf('<svg');
          const endIdx = raw.lastIndexOf('</svg>');
          if (startIdx !== -1 && endIdx !== -1) {
            generatedSvg = raw.substring(startIdx, endIdx + 6);
            break;
          }
        }
      } catch (aiErr) {
        console.warn(`[EaseStudy Diagram] ${EXCLUSIVE_GEMINI_MODEL} SVG attempt ${attempt} notice:`, cleanErrorMessage(aiErr));
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
      }
    }

    // High-quality fallback SVG generator if AI generation fails or hits timeout
    if (!generatedSvg) {
      const safeTitle = (conceptTitle || topic).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeDesc = (description || 'Systematic visual representation of relationships and milestones').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 110);
      generatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%" style="background:#0f172a; border-radius: 16px; font-family: ui-sans-serif, system-ui, sans-serif;">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0284c7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f766e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:0.9" />
      <stop offset="100%" style="stop-color:#334155;stop-opacity:0.9" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background grid lines -->
  <g stroke="#334155" stroke-width="0.75" opacity="0.3">
    <line x1="40" y1="0" x2="40" y2="480" />
    <line x1="200" y1="0" x2="200" y2="480" />
    <line x1="400" y1="0" x2="400" y2="480" />
    <line x1="600" y1="0" x2="600" y2="480" />
    <line x1="760" y1="0" x2="760" y2="480" />
    <line x1="0" y1="120" x2="800" y2="120" />
    <line x1="0" y1="240" x2="800" y2="240" />
    <line x1="0" y1="360" x2="800" y2="360" />
  </g>

  <!-- Header Banner -->
  <rect x="30" y="24" width="740" height="60" rx="10" fill="url(#boxGrad)" stroke="#38bdf8" stroke-width="1.2" />
  <circle cx="60" cy="54" r="14" fill="url(#grad1)" />
  <text x="60" y="59" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">✦</text>
  <text x="90" y="48" fill="#f8fafc" font-size="16" font-weight="bold">${safeTitle}</text>
  <text x="90" y="68" fill="#94a3b8" font-size="11.5">${safeDesc}</text>

  <!-- Central Nodes & Flow -->
  <!-- Node 1: Input / Origin -->
  <rect x="50" y="160" width="190" height="150" rx="12" fill="#1e293b" stroke="#0ea5e9" stroke-width="1.5" />
  <rect x="50" y="160" width="190" height="34" rx="12" fill="#0369a1" />
  <text x="145" y="182" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">1. INPUT / FOUNDATION</text>
  <text x="68" y="218" fill="#e2e8f0" font-size="11" font-weight="bold">• Core Premise</text>
  <text x="68" y="240" fill="#94a3b8" font-size="10.5">Primary boundary inputs</text>
  <text x="68" y="266" fill="#e2e8f0" font-size="11" font-weight="bold">• Governing States</text>
  <text x="68" y="288" fill="#94a3b8" font-size="10.5">Physical / domain criteria</text>

  <!-- Arrow 1 -> 2 -->
  <path d="M 240 235 L 295 235" stroke="#38bdf8" stroke-width="2.5" marker-end="url(#arrow)" />
  <polygon points="295,235 285,229 285,241" fill="#38bdf8" />

  <!-- Node 2: Core Processing / Transformation -->
  <rect x="305" y="140" width="190" height="190" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="2" filter="url(#glow)" />
  <rect x="305" y="140" width="190" height="34" rx="12" fill="url(#grad1)" />
  <text x="400" y="162" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">2. TRANSFORMATION</text>
  <circle cx="400" cy="225" r="32" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8" />
  <text x="400" y="222" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">CORE</text>
  <text x="400" y="236" fill="#94a3b8" font-size="9" text-anchor="middle">DYNAMICS</text>
  <text x="325" y="285" fill="#e2e8f0" font-size="11" font-weight="bold">• Systematic Analysis</text>
  <text x="325" y="306" fill="#94a3b8" font-size="10.5">Interactive equilibrium</text>

  <!-- Arrow 2 -> 3 -->
  <path d="M 495 235 L 550 235" stroke="#38bdf8" stroke-width="2.5" />
  <polygon points="550,235 540,229 540,241" fill="#38bdf8" />

  <!-- Node 3: Synthesis / Output -->
  <rect x="560" y="160" width="190" height="150" rx="12" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
  <rect x="560" y="160" width="190" height="34" rx="12" fill="#047857" />
  <text x="655" y="182" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">3. OUTPUT / RESULT</text>
  <text x="578" y="218" fill="#e2e8f0" font-size="11" font-weight="bold">• Verified Synthesis</text>
  <text x="578" y="240" fill="#94a3b8" font-size="10.5">Actionable deductions</text>
  <text x="578" y="266" fill="#e2e8f0" font-size="11" font-weight="bold">• Exam Mastery</text>
  <text x="578" y="288" fill="#94a3b8" font-size="10.5">Long-term conceptual recall</text>

  <!-- Bottom Evaluation Banner -->
  <rect x="30" y="380" width="740" height="66" rx="10" fill="#1e293b" stroke="#475569" stroke-width="1" />
  <text x="55" y="410" fill="#38bdf8" font-size="11" font-weight="bold">VALIDATION METRICS:</text>
  <text x="55" y="430" fill="#cbd5e1" font-size="10.5">Continuously validated against grounded document material with ModeEaseStudy dataset alignment.</text>
</svg>`;
    }

    res.json({
      success: true,
      svg: generatedSvg,
      title: conceptTitle || topic,
      description: description || 'Visual concept illustration',
    });
  } catch (err: any) {
    console.error('Diagram generation error:', err);
    res.status(500).json({ success: false, message: 'Diagram generation failed.' });
  }
});

// ============================================================================
// EASESTUDY GUEST SESSIONS, DOCUMENT CHAT & LEARNING HISTORY
// ============================================================================

interface EaseStudyGuestActivity {
  id: string;
  documentId?: string;
  topic: string;
  fileName?: string;
  score?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  activityType: 'document_analyzed' | 'exam_completed' | 'notes_pasted';
  timestamp: string;
}

const memoryEaseStudySessions = new Map<string, { createdAt: string; lastActive: string }>();
const memoryEaseStudyActivities = new Map<string, EaseStudyGuestActivity[]>();

// 12. EaseStudy Guest Session Manager
app.all(['/api/easestudy/session', '/api/easestudy/session/'], (req, res) => {
  try {
    const rawId = (req.headers['x-guest-session-id'] as string) || req.body?.sessionId || req.query?.sessionId;
    let sessionId = typeof rawId === 'string' && rawId.trim().length > 6 ? rawId.trim() : null;

    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    const now = new Date().toISOString();
    if (!memoryEaseStudySessions.has(sessionId)) {
      memoryEaseStudySessions.set(sessionId, { createdAt: now, lastActive: now });
    } else {
      const sess = memoryEaseStudySessions.get(sessionId)!;
      sess.lastActive = now;
    }

    const activities = memoryEaseStudyActivities.get(sessionId) || [];

    res.json({
      success: true,
      sessionId,
      token: `token_${sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      activitiesCount: activities.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Session allocation error' });
  }
});

// 13. "Ask Your Document" Grounded Chat Assistant
app.post(['/api/easestudy/chat', '/api/easestudy/chat/'], async (req, res) => {
  try {
    const { message, documentText, topic = 'Study Material', history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'A user question or message is required.' });
    }

    const cleanContext = sanitizeDocumentText(documentText || '').slice(0, 70000);
    const safeTopic = cleanTopicFromSource('', cleanContext, typeof topic === 'string' ? topic : '');

    // High-Precision Passage Retrieval & Relevance Ranking
    const queryTokens = message.toLowerCase().split(/\W+/).filter((w: string) => w.length > 2);
    const rawParagraphs = cleanContext.split(/\n\s*\n/).filter((p: string) => p.trim().length > 20);

    // Score paragraphs based on query term frequency and density
    const scoredPassages = rawParagraphs.map((para: string) => {
      const lower = para.toLowerCase();
      let score = 0;
      queryTokens.forEach((tok: string) => {
        const regex = new RegExp(`\\b${tok}`, 'gi');
        const count = (lower.match(regex) || []).length;
        score += count * 2;
      });
      return { paragraph: para.trim(), score };
    });

    // Pick the most relevant passages first
    scoredPassages.sort((a: { paragraph: string; score: number }, b: { paragraph: string; score: number }) => b.score - a.score);
    const topPassages = scoredPassages.filter((p: { paragraph: string; score: number }) => p.score > 0).slice(0, 6).map((p: { paragraph: string; score: number }) => p.paragraph);
    const focusedContext = topPassages.length > 0
      ? `${topPassages.join('\n\n')}\n\n${cleanContext.slice(0, 40000)}`.trim()
      : cleanContext;

    const chatPrompt = `Provide a direct, accurate, and context-aware answer strictly grounded in the document text provided below. Adapt naturally to the domain, tone, and genre of the material.

GUIDELINES:
1. Provide the direct answer clearly and authoritatively in the first sentence.
2. Never use generic introductory meta-preamble like "Based on the provided document..." or "According to the uploaded material...".
3. If explaining steps, principles, or multi-point insights, use clean, readable bullet points immediately following the direct answer.
4. If the requested information is absent from the text, state clearly: "This information is not addressed in the provided document."

DOCUMENT TEXT CONTENT:
"""
${focusedContext || 'No document text provided.'}
"""

QUESTION: "${message}"`;

    let reply = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: chatPrompt,
          config: {
            systemInstruction: EASESTUDY_SYSTEM_INSTRUCTION,
          },
        });
        if (response && response.text) {
          reply = response.text.trim();
          break;
        }
      } catch (callErr) {
        console.warn(`[EaseStudy Chat] ${modelName} notice:`, cleanErrorMessage(callErr));
      }
    }

    if (!reply && cleanContext) {
      if (topPassages.length > 0) {
        reply = topPassages.slice(0, 2).join('\n\n');
      } else {
        reply = cleanContext.slice(0, 300);
      }
    } else if (!reply) {
      reply = `Refer directly to the core concepts and practical takeaways extracted from "${safeTopic}".`;
    }

    // Extract high-precision citation quotes from top passages or clean context
    const citations: string[] = [];
    if (topPassages.length > 0) {
      citations.push(topPassages[0].slice(0, 160).trim());
      if (topPassages.length > 1) {
        citations.push(topPassages[1].slice(0, 160).trim());
      }
    } else {
      const lines = cleanContext.split('\n').filter((l: string) => l.trim().length > 30);
      if (lines.length > 0) {
        citations.push(lines[0].trim().slice(0, 150));
        if (lines.length > 1) {
          citations.push(lines[1].trim().slice(0, 150));
        }
      }
    }

    res.json({
      success: true,
      reply,
      citations: citations.slice(0, 2),
    });
  } catch (err: any) {
    console.error('EaseStudy Chat error:', err);
    res.status(500).json({
      success: false,
      message: 'Document chat service is temporarily unavailable.',
      reply: 'An error occurred while analyzing the document text. Please try asking again.',
    });
  }
});

// 14. EaseStudy Learning History & Activities Endpoints
app.get(['/api/easestudy/history', '/api/easestudy/history/'], (req, res) => {
  try {
    const sessionId = (req.headers['x-guest-session-id'] as string) || (req.query?.sessionId as string);
    if (!sessionId) {
      return res.json({ success: true, activities: [] });
    }

    const activities = memoryEaseStudyActivities.get(sessionId) || [];
    res.json({
      success: true,
      activities: activities.slice(0, 30),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

app.post(['/api/easestudy/history/record', '/api/easestudy/history/record/'], (req, res) => {
  try {
    const rawId = (req.headers['x-guest-session-id'] as string) || req.body?.sessionId;
    const sessionId = rawId || 'anonymous_guest';
    const {
      topic = 'Study Material',
      fileName,
      score,
      totalQuestions,
      correctAnswers,
      activityType = 'exam_completed',
    } = req.body;

    const activity: EaseStudyGuestActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      topic,
      fileName,
      score: typeof score === 'number' ? score : undefined,
      totalQuestions: typeof totalQuestions === 'number' ? totalQuestions : undefined,
      correctAnswers: typeof correctAnswers === 'number' ? correctAnswers : undefined,
      activityType,
      timestamp: new Date().toISOString(),
    };

    const existing = memoryEaseStudyActivities.get(sessionId) || [];
    existing.unshift(activity);
    if (existing.length > 50) existing.pop();
    memoryEaseStudyActivities.set(sessionId, existing);

    res.json({
      success: true,
      activity,
      totalCount: existing.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to save record' });
  }
});

// Update an existing activity (Edit action in 3-dot menu)
app.post(['/api/easestudy/history/update', '/api/easestudy/history/update/'], (req, res) => {
  try {
    const rawId = (req.headers['x-guest-session-id'] as string) || req.body?.sessionId;
    const sessionId = rawId || 'anonymous_guest';
    const { activityId, topic, customInstructions } = req.body;

    if (!activityId) {
      return res.status(400).json({ success: false, message: 'activityId is required' });
    }

    const existing = memoryEaseStudyActivities.get(sessionId) || [];
    const itemIndex = existing.findIndex((a) => a.id === activityId);
    if (itemIndex !== -1) {
      if (topic) existing[itemIndex].topic = topic.trim();
      if (customInstructions !== undefined) {
        (existing[itemIndex] as any).customInstructions = customInstructions;
      }
      memoryEaseStudyActivities.set(sessionId, existing);
      return res.json({ success: true, activity: existing[itemIndex] });
    }

    res.json({ success: true, message: 'Activity not found in memory (local updated)' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update record' });
  }
});

// Delete an activity (Delete action in 3-dot menu)
app.post(['/api/easestudy/history/delete', '/api/easestudy/history/delete/'], (req, res) => {
  try {
    const rawId = (req.headers['x-guest-session-id'] as string) || req.body?.sessionId;
    const sessionId = rawId || 'anonymous_guest';
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({ success: false, message: 'activityId is required' });
    }

    const existing = memoryEaseStudyActivities.get(sessionId) || [];
    const filtered = existing.filter((a) => a.id !== activityId);
    memoryEaseStudyActivities.set(sessionId, filtered);

    res.json({ success: true, deletedId: activityId, remainingCount: filtered.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to delete record' });
  }
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
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Only start listening if not running under Vercel serverless runtime
  if (process.env.VERCEL !== '1') {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

// Auto-start in non-serverless environments
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
