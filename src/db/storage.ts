import { db, withDbRetry } from './index.ts';
import {
  profiles,
  profilePictures,
  documents,
  deletedDocuments,
  conversations,
  deletedConversations,
  learningSessions,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';

// ----------------------------------------------------
// IN-MEMORY / ZERO-CRASH PERSISTENT CACHE
// ----------------------------------------------------
let memoryProfile: any = {
  id: 'global',
  fullName: 'Festus, Olorunsogo Johnson',
  title: 'Lead Mechanical Design Engineer',
  headline: 'Lead Mechanical Design Engineer · Precision Mechanisms',
  header: 'Lead Mechanical Design Engineer · Precision Mechanisms',
  bio: 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
  shortSummary: '',
  description: 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
  discipline: 'Mechanical Hardware & Thermal Systems',
  company: 'Fesline Engineering',
  location: 'United States',
  country: 'United States',
  experienceYears: '6+',
  email: 'festusjohnson028@gmail.com',
  primaryEmail: 'festusjohnson028@gmail.com',
  phone: '',
  website: '',
  linkedinUrl: 'https://linkedin.com',
  githubUrl: '',
  twitterUrl: 'https://x.com',
  instagramUrl: 'https://instagram.com',
  indeedUrl: 'https://indeed.com',
  facebookUrl: 'https://facebook.com',
  tiktokUrl: 'https://tiktok.com',
  emailUrl: 'mailto:festusjohnson028@gmail.com',
  degree: 'B.S. in Mechanical Engineering (BSME)',
  academicHonors: 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
  leadership: 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer',
  shopCompetencies: '',
  badges: 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
  workClearance: 'US Authorized · No Visa Sponsorship Required',
  availabilityStatus: 'Active & Available for Q4 2026 Roles',
  targetLocations: 'San Francisco / Silicon Valley, Seattle, Austin, Boston',
  skills: 'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, CNC Machine, Laser Engraver/Cutter, 3D Animation, FEA Analysis',
  avatar: '',
  documents: [],
  customFields: {},
  updatedAt: new Date().toISOString(),
};

const memoryProfilePictures = new Map<string, any>();
const memoryDocuments = new Map<string, any>();
const memoryDeletedDocs = new Set<string>();
const memoryConversations = new Map<string, any>();
const memoryDeletedConvs = new Set<string>();
const memoryLearningSessions = new Map<string, any>();

// ----------------------------------------------------
// DEDICATED PROFILE PICTURE CLOUD DATABASE STORAGE
// ----------------------------------------------------
export async function getProfilePictureFromDb(id = 'global') {
  try {
    const fromDb = await withDbRetry(async () => {
      const rows = await db.select().from(profilePictures).where(eq(profilePictures.id, id)).limit(1);
      return rows[0] || null;
    }, 2);
    if (fromDb) {
      memoryProfilePictures.set(id, fromDb);
      return fromDb;
    }
  } catch (error: any) {
    // Non-blocking fallback
  }
  return memoryProfilePictures.get(id) || null;
}

export async function saveProfilePictureToDb(pictureData: {
  id?: string;
  fileBinary: string;
  mimeType?: string;
  fileSize?: string;
  dimensions?: string;
  updatedAt?: Date | string;
}) {
  const id = pictureData.id || 'global';
  const updatedDate = pictureData.updatedAt ? new Date(pictureData.updatedAt) : new Date();
  const versionedUrl = `/api/profile/picture?v=${updatedDate.getTime()}`;
  const record = {
    id,
    fileBinary: pictureData.fileBinary,
    mimeType: pictureData.mimeType || 'image/webp',
    fileSize: pictureData.fileSize || 'Standard',
    dimensions: pictureData.dimensions || '400 x 400 px',
    updatedAt: updatedDate,
    avatarUrl: versionedUrl,
  };

  memoryProfilePictures.set(id, record);
  if (memoryProfile) {
    memoryProfile.avatar = versionedUrl;
  }

  try {
    const inserted = await withDbRetry(async () => {
      const rows = await db
        .insert(profilePictures)
        .values({
          id: record.id,
          fileBinary: record.fileBinary,
          mimeType: record.mimeType,
          fileSize: record.fileSize,
          dimensions: record.dimensions,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: profilePictures.id,
          set: {
            fileBinary: record.fileBinary,
            mimeType: record.mimeType,
            fileSize: record.fileSize,
            dimensions: record.dimensions,
            updatedAt: record.updatedAt,
          },
        })
        .returning();

      await db
        .update(profiles)
        .set({ avatar: versionedUrl, updatedAt: new Date() })
        .where(eq(profiles.id, id))
        .catch(() => {});

      return rows[0];
    }, 2);
    return { ...(inserted || record), avatarUrl: versionedUrl };
  } catch (err) {
    return record;
  }
}

export async function deleteProfilePictureFromDb(id = 'global') {
  memoryProfilePictures.delete(id);
  if (memoryProfile) {
    memoryProfile.avatar = '';
  }
  try {
    await withDbRetry(async () => {
      await db.delete(profilePictures).where(eq(profilePictures.id, id)).catch(() => {});
      await db
        .update(profiles)
        .set({ avatar: '', updatedAt: new Date() })
        .where(eq(profiles.id, id))
        .catch(() => {});
    }, 2);
  } catch {}
  return true;
}

// ----------------------------------------------------
// PROFILES
// ----------------------------------------------------
export async function getGlobalProfileFromDb() {
  try {
    const fromDb = await withDbRetry(async () => {
      const rows = await db.select().from(profiles).where(eq(profiles.id, 'global')).limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        const custom = (row.customFields && typeof row.customFields === 'object') ? row.customFields : {};
        const resolvedHeader = row.headline || (custom as any).header || (custom as any).headline || '';
        const resolvedDescription = row.description || row.bio || (custom as any).description || '';

        return {
          id: row.id,
          fullName: row.fullName || (custom as any).fullName || '',
          title: row.title || (custom as any).title || '',
          headline: resolvedHeader,
          header: resolvedHeader,
          bio: row.bio || resolvedDescription,
          shortSummary: row.shortSummary || (custom as any).shortSummary || '',
          description: resolvedDescription,
          discipline: row.discipline || (custom as any).discipline || '',
          company: row.company || (custom as any).company || '',
          location: row.location || (custom as any).location || '',
          country: row.country || (custom as any).country || '',
          experienceYears: row.experienceYears || (custom as any).experienceYears || '',
          email: row.email || row.primaryEmail || (custom as any).email || '',
          primaryEmail: row.primaryEmail || row.email || (custom as any).primaryEmail || '',
          phone: row.phone || (custom as any).phone || '',
          website: row.website || (custom as any).website || '',
          linkedinUrl: row.linkedinUrl || (custom as any).linkedinUrl || '',
          githubUrl: row.githubUrl || (custom as any).githubUrl || '',
          twitterUrl: row.twitterUrl || (custom as any).twitterUrl || '',
          instagramUrl: row.instagramUrl || (custom as any).instagramUrl || '',
          indeedUrl: row.indeedUrl || (custom as any).indeedUrl || '',
          facebookUrl: row.facebookUrl || (custom as any).facebookUrl || '',
          tiktokUrl: (custom as any).tiktokUrl || '',
          emailUrl: (custom as any).emailUrl || (row.email ? `mailto:${row.email}` : ''),
          degree: row.degree || (custom as any).degree || '',
          academicHonors: row.academicHonors || (custom as any).academicHonors || '',
          leadership: row.leadership || (custom as any).leadership || '',
          shopCompetencies: row.shopCompetencies || (custom as any).shopCompetencies || '',
          badges: row.badges || (custom as any).badges || '',
          workClearance: row.workClearance || (custom as any).workClearance || '',
          availabilityStatus: (custom as any).availabilityStatus || 'Active & Available for Q4 2026 Roles',
          targetLocations: (custom as any).targetLocations || 'San Francisco / Silicon Valley, Seattle, Austin, Boston',
          skills: row.skills || (custom as any).skills || '',
          avatar: row.avatar || (custom as any).avatar || '',
          documents: Array.isArray(row.documents) ? row.documents : (Array.isArray((custom as any).documents) ? (custom as any).documents : []),
          customFields: custom,
          updatedAt: row.updatedAt?.toISOString(),
        };
      }
      return null;
    }, 2);

    if (fromDb) {
      memoryProfile = { ...memoryProfile, ...fromDb };
      return fromDb;
    }
  } catch (err) {
    // Graceful fallback to memoryProfile
  }
  return memoryProfile;
}

export async function saveGlobalProfileToDb(profileData: any) {
  const existing = memoryProfile;
  const incomingBio = profileData.bio || (profileData.fullName ? profileData : {});
  const existingCustom = (existing?.customFields && typeof existing.customFields === 'object') ? existing.customFields : {};
  const incomingCustom = (profileData.customFields && typeof profileData.customFields === 'object') ? profileData.customFields : {};

  const mergedCustom: Record<string, any> = {
    ...existingCustom,
    ...(existing || {}),
    ...incomingCustom,
    ...incomingBio,
  };

  let resolvedAvatar = existing?.avatar || '';
  if (profileData.avatar !== undefined) {
    if (typeof profileData.avatar === 'string' && profileData.avatar.startsWith('data:image/')) {
      try {
        const picRes = await saveProfilePictureToDb({
          id: 'global',
          fileBinary: profileData.avatar,
        });
        resolvedAvatar = picRes.avatarUrl;
      } catch {
        resolvedAvatar = '/api/profile/picture';
      }
    } else if (profileData.avatar === '') {
      await deleteProfilePictureFromDb('global').catch(() => {});
      resolvedAvatar = '';
    } else {
      resolvedAvatar = profileData.avatar;
    }
  }

  mergedCustom.avatar = resolvedAvatar;
  if (profileData.documents !== undefined) mergedCustom.documents = profileData.documents;

  const resolvedHeader = incomingBio.header !== undefined ? incomingBio.header : (incomingBio.headline !== undefined ? incomingBio.headline : (profileData.header !== undefined ? profileData.header : (existing?.header || 'Lead Mechanical Design Engineer')));
  const resolvedDescription = incomingBio.description !== undefined ? incomingBio.description : (incomingBio.bio !== undefined ? incomingBio.bio : (profileData.description !== undefined ? profileData.description : (existing?.description || '')));
  const resolvedFullName = incomingBio.fullName !== undefined ? incomingBio.fullName : (profileData.fullName !== undefined ? profileData.fullName : (existing?.fullName || 'Festus, Olorunsogo Johnson'));
  const resolvedEmail = incomingBio.email !== undefined ? incomingBio.email : (profileData.email !== undefined ? profileData.email : (existing?.email || 'festusjohnson028@gmail.com'));
  const resolvedDiscipline = incomingBio.discipline !== undefined ? incomingBio.discipline : (profileData.discipline !== undefined ? profileData.discipline : (existing?.discipline || ''));
  const resolvedCountry = incomingBio.country !== undefined ? incomingBio.country : (profileData.country !== undefined ? profileData.country : (existing?.country || ''));
  const resolvedDegree = incomingBio.degree !== undefined ? incomingBio.degree : (profileData.degree !== undefined ? profileData.degree : (existing?.degree || ''));
  const resolvedAcademicHonors = incomingBio.academicHonors !== undefined ? incomingBio.academicHonors : (profileData.academicHonors !== undefined ? profileData.academicHonors : (existing?.academicHonors || ''));
  const resolvedLeadership = incomingBio.leadership !== undefined ? incomingBio.leadership : (profileData.leadership !== undefined ? profileData.leadership : (existing?.leadership || ''));
  const resolvedBadges = incomingBio.badges !== undefined ? incomingBio.badges : (profileData.badges !== undefined ? profileData.badges : (existing?.badges || ''));
  const resolvedSkills = incomingBio.skills !== undefined ? incomingBio.skills : (profileData.skills !== undefined ? profileData.skills : (existing?.skills || ''));
  const resolvedWorkClearance = incomingBio.workClearance !== undefined ? incomingBio.workClearance : (profileData.workClearance !== undefined ? profileData.workClearance : (existing?.workClearance || ''));
  const resolvedAvailabilityStatus = incomingBio.availabilityStatus !== undefined ? incomingBio.availabilityStatus : (profileData.availabilityStatus !== undefined ? profileData.availabilityStatus : (existing?.availabilityStatus || 'Active & Available for Q4 2026 Roles'));
  const resolvedTargetLocations = incomingBio.targetLocations !== undefined ? incomingBio.targetLocations : (profileData.targetLocations !== undefined ? profileData.targetLocations : (existing?.targetLocations || 'San Francisco / Silicon Valley, Seattle, Austin, Boston'));
  const resolvedLinkedinUrl = incomingBio.linkedinUrl !== undefined ? incomingBio.linkedinUrl : (profileData.linkedinUrl !== undefined ? profileData.linkedinUrl : (existing?.linkedinUrl || ''));
  const resolvedFacebookUrl = incomingBio.facebookUrl !== undefined ? incomingBio.facebookUrl : (profileData.facebookUrl !== undefined ? profileData.facebookUrl : (existing?.facebookUrl || ''));
  const resolvedIndeedUrl = incomingBio.indeedUrl !== undefined ? incomingBio.indeedUrl : (profileData.indeedUrl !== undefined ? profileData.indeedUrl : (existing?.indeedUrl || ''));
  const resolvedTwitterUrl = incomingBio.twitterUrl !== undefined ? incomingBio.twitterUrl : (profileData.twitterUrl !== undefined ? profileData.twitterUrl : (existing?.twitterUrl || ''));
  const resolvedTiktokUrl = incomingBio.tiktokUrl !== undefined ? incomingBio.tiktokUrl : (profileData.tiktokUrl !== undefined ? profileData.tiktokUrl : ((existing as any)?.tiktokUrl || ''));
  const resolvedInstagramUrl = incomingBio.instagramUrl !== undefined ? incomingBio.instagramUrl : (profileData.instagramUrl !== undefined ? profileData.instagramUrl : (existing?.instagramUrl || ''));
  const resolvedEmailUrl = incomingBio.emailUrl !== undefined ? incomingBio.emailUrl : (profileData.emailUrl !== undefined ? profileData.emailUrl : ((existing as any)?.emailUrl || (resolvedEmail ? `mailto:${resolvedEmail}` : '')));

  const record = {
    id: 'global',
    fullName: resolvedFullName,
    title: incomingBio.title || profileData.title || existing?.title || '',
    headline: resolvedHeader,
    header: resolvedHeader,
    bio: resolvedDescription,
    shortSummary: incomingBio.shortSummary || profileData.shortSummary || existing?.shortSummary || '',
    description: resolvedDescription,
    discipline: resolvedDiscipline,
    company: incomingBio.company || profileData.company || existing?.company || '',
    location: incomingBio.location || profileData.location || existing?.location || '',
    country: resolvedCountry,
    experienceYears: String(incomingBio.experienceYears || profileData.experienceYears || existing?.experienceYears || ''),
    email: resolvedEmail,
    primaryEmail: resolvedEmail,
    phone: incomingBio.phone || profileData.phone || existing?.phone || '',
    website: incomingBio.website || profileData.website || existing?.website || '',
    linkedinUrl: resolvedLinkedinUrl,
    githubUrl: incomingBio.githubUrl || profileData.githubUrl || existing?.githubUrl || '',
    twitterUrl: resolvedTwitterUrl,
    instagramUrl: resolvedInstagramUrl,
    indeedUrl: resolvedIndeedUrl,
    facebookUrl: resolvedFacebookUrl,
    degree: resolvedDegree,
    academicHonors: resolvedAcademicHonors,
    leadership: resolvedLeadership,
    shopCompetencies: incomingBio.shopCompetencies || profileData.shopCompetencies || existing?.shopCompetencies || '',
    badges: resolvedBadges,
    workClearance: resolvedWorkClearance,
    skills: resolvedSkills,
    avatar: resolvedAvatar,
    documents: Array.isArray(profileData.documents) ? profileData.documents : (existing?.documents || []),
    customFields: mergedCustom,
    updatedAt: new Date(),
  };

  memoryProfile = { ...record, updatedAt: record.updatedAt.toISOString() };

  try {
    await withDbRetry(async () => {
      await db
        .insert(profiles)
        .values(record)
        .onConflictDoUpdate({
          target: profiles.id,
          set: record,
        });
    }, 2);
  } catch {}

  return memoryProfile;
}

// ----------------------------------------------------
// DOCUMENTS (ENGINEERING HUB)
// ----------------------------------------------------
export async function getDeletedDocumentIdsFromDb(): Promise<Set<string>> {
  try {
    const fromDb = await withDbRetry(async () => {
      const rows = await db.select().from(deletedDocuments);
      return new Set(rows.map((r) => r.id));
    }, 2);
    if (fromDb) {
      for (const id of fromDb) memoryDeletedDocs.add(id);
    }
  } catch {}
  return memoryDeletedDocs;
}

export async function recordDeletedDocumentIdInDb(id: string): Promise<void> {
  memoryDeletedDocs.add(id);
  try {
    await withDbRetry(async () => {
      await db
        .insert(deletedDocuments)
        .values({ id, deletedAt: new Date() })
        .onConflictDoNothing();
    }, 2);
  } catch {}
}

export async function getDocumentsFromDb(includePending = false) {
  try {
    const deletedIds = await getDeletedDocumentIdsFromDb();
    const rows = await withDbRetry(async () => {
      return await db.select().from(documents).orderBy(desc(documents.uploadTimestamp), desc(documents.createdAt));
    }, 2);

    if (rows && rows.length > 0) {
      for (const d of rows) {
        memoryDocuments.set(d.id, d);
      }
      const activeDocs = rows.filter((d) => !deletedIds.has(d.id));
      const filtered = includePending
        ? activeDocs
        : activeDocs.filter((d) => d.status === 'approved' || !d.status);

      return filtered.map((d) => ({
        ...d,
        uploadTimestamp: d.uploadTimestamp ? Number(d.uploadTimestamp) : undefined,
        downloadUrl: `/api/documents/files/${d.id}`,
        dataUrl: d.dataUrl && d.dataUrl.length > 300000 ? undefined : d.dataUrl,
      }));
    }
  } catch {}

  // Fallback to memory
  const allInMemory = Array.from(memoryDocuments.values()).filter((d) => !memoryDeletedDocs.has(d.id));
  const filtered = includePending
    ? allInMemory
    : allInMemory.filter((d) => d.status === 'approved' || !d.status);

  return filtered.map((d) => ({
    ...d,
    uploadTimestamp: d.uploadTimestamp ? Number(d.uploadTimestamp) : undefined,
    downloadUrl: `/api/documents/files/${d.id}`,
    dataUrl: d.dataUrl && d.dataUrl.length > 300000 ? undefined : d.dataUrl,
  }));
}

export async function getDocumentByIdFromDb(id: string) {
  try {
    const doc = await withDbRetry(async () => {
      const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      return rows[0] || null;
    }, 2);
    if (doc) {
      memoryDocuments.set(doc.id, doc);
      return {
        ...doc,
        uploadTimestamp: doc.uploadTimestamp ? Number(doc.uploadTimestamp) : undefined,
      };
    }
  } catch {}

  const memDoc = memoryDocuments.get(id);
  if (memDoc) {
    return {
      ...memDoc,
      uploadTimestamp: memDoc.uploadTimestamp ? Number(memDoc.uploadTimestamp) : undefined,
    };
  }
  return null;
}

export async function saveDocumentToDb(doc: any) {
  const docId = doc.id || `doc-${Date.now()}`;
  const uploadTimestamp = doc.uploadTimestamp || Date.now();
  const fileContent = doc.fileBinary || doc.dataUrl || '';

  const record = {
    id: docId,
    title: doc.title || 'Untitled Document',
    fileName: doc.fileName || `${docId}.bin`,
    fileSize: doc.fileSize || '0 KB',
    fileType: doc.fileType || 'Document',
    category: doc.category || 'General',
    description: doc.description || '',
    author: doc.author || 'Author',
    uploaderName: doc.uploaderName || doc.author || 'User',
    uploaderType: doc.uploaderType || 'visitor',
    status: doc.status || 'approved',
    uploadDate: doc.uploadDate || new Date().toISOString().split('T')[0],
    uploadTimestamp: uploadTimestamp,
    downloadCount: doc.downloadCount || 0,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    previewUrl: doc.previewUrl || '',
    downloadUrl: `/api/documents/files/${docId}`,
    dataUrl: doc.dataUrl && doc.dataUrl.length > 500000 ? undefined : doc.dataUrl,
    fileBinary: fileContent,
    mimeType: doc.mimeType || 'application/octet-stream',
    hasServerFile: true,
    updatedAt: new Date(),
  };

  memoryDocuments.set(docId, record);

  try {
    const inserted = await withDbRetry(async () => {
      const rows = await db
        .insert(documents)
        .values(record)
        .onConflictDoUpdate({
          target: documents.id,
          set: record,
        })
        .returning();
      return rows[0];
    }, 2);
    return inserted || record;
  } catch {
    return record;
  }
}

export async function deleteDocumentFromDb(id: string) {
  await recordDeletedDocumentIdInDb(id);
  memoryDocuments.delete(id);

  if (memoryProfile && Array.isArray(memoryProfile.documents)) {
    memoryProfile.documents = memoryProfile.documents.filter((d: any) => d.id !== id);
  }

  try {
    await withDbRetry(async () => {
      await db.delete(documents).where(eq(documents.id, id));
    }, 2);
  } catch {}

  return true;
}

export async function incrementDocumentDownloadCountInDb(id: string) {
  const doc = memoryDocuments.get(id);
  if (doc) {
    doc.downloadCount = (doc.downloadCount || 0) + 1;
  }
  try {
    await withDbRetry(async () => {
      const docDb = await getDocumentByIdFromDb(id);
      if (docDb) {
        await db
          .update(documents)
          .set({ downloadCount: (docDb.downloadCount || 0) + 1 })
          .where(eq(documents.id, id));
      }
    }, 2);
  } catch {}
  return true;
}

// ----------------------------------------------------
// CHAT CONVERSATIONS & INQUIRIES
// ----------------------------------------------------
export async function getDeletedConversationIdsFromDb(): Promise<Set<string>> {
  try {
    const fromDb = await withDbRetry(async () => {
      const rows = await db.select().from(deletedConversations);
      return new Set(rows.map((r) => r.id));
    }, 2);
    if (fromDb) {
      for (const id of fromDb) memoryDeletedConvs.add(id);
    }
  } catch {}
  return memoryDeletedConvs;
}

export async function recordDeletedConversationIdInDb(id: string): Promise<void> {
  memoryDeletedConvs.add(id);
  try {
    await withDbRetry(async () => {
      await db
        .insert(deletedConversations)
        .values({ id, deletedAt: new Date() })
        .onConflictDoNothing();
    }, 2);
  } catch {}
}

export async function unrecordDeletedConversationIdInDb(id: string): Promise<void> {
  memoryDeletedConvs.delete(id);
  try {
    await withDbRetry(async () => {
      await db.delete(deletedConversations).where(eq(deletedConversations.id, id));
    }, 2);
  } catch {}
}

export async function getConversationsFromDb() {
  try {
    const deletedIds = await getDeletedConversationIdsFromDb();
    const rows = await withDbRetry(async () => {
      return await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    }, 2);

    if (rows && rows.length > 0) {
      for (const c of rows) memoryConversations.set(c.id, c);
      return rows.filter((c) => !deletedIds.has(c.id));
    }
  } catch {}

  return Array.from(memoryConversations.values()).filter((c) => !memoryDeletedConvs.has(c.id));
}

export async function saveConversationToDb(conv: any) {
  if (!conv || !conv.id) return null;
  await unrecordDeletedConversationIdInDb(conv.id);

  const record = {
    id: conv.id,
    defaultLabel: conv.defaultLabel || 'Direct Message',
    customName: conv.customName || '',
    visitorName: conv.visitorName || '',
    avatarUrl: conv.avatarUrl || '',
    roleOrCompany: conv.roleOrCompany || 'Visitor Inquiry',
    avatarColor: conv.avatarColor || 'bg-emerald-600',
    unread: Boolean(conv.unread),
    important: Boolean(conv.important),
    lastMessage: conv.lastMessage || '',
    lastTimestamp: conv.lastTimestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    messages: Array.isArray(conv.messages) ? conv.messages : [],
    updatedAt: new Date(),
  };

  memoryConversations.set(conv.id, record);

  try {
    const inserted = await withDbRetry(async () => {
      const rows = await db
        .insert(conversations)
        .values(record)
        .onConflictDoUpdate({
          target: conversations.id,
          set: record,
        })
        .returning();
      return rows[0];
    }, 2);
    return inserted || record;
  } catch {
    return record;
  }
}

export async function saveConversationsBatchToDb(incoming: any[], overwrite = false) {
  const deletedIds = await getDeletedConversationIdsFromDb();
  const filtered = incoming.filter((c) => c && c.id && !deletedIds.has(c.id));

  if (overwrite) {
    memoryConversations.clear();
    for (const conv of filtered) {
      await saveConversationToDb(conv);
    }
    return await getConversationsFromDb();
  }

  for (const conv of filtered) {
    await saveConversationToDb(conv);
  }
  return await getConversationsFromDb();
}

export async function deleteConversationFromDb(id: string) {
  await recordDeletedConversationIdInDb(id);
  memoryConversations.delete(id);
  try {
    await withDbRetry(async () => {
      await db.delete(conversations).where(eq(conversations.id, id));
    }, 2);
  } catch {}
  return true;
}

export async function deleteMessageFromDb(convId: string, msgId: string) {
  const memConv = memoryConversations.get(convId);
  if (memConv) {
    const existingMsgs = Array.isArray(memConv.messages) ? memConv.messages : [];
    const updatedMsgs = existingMsgs.filter((m: any) => m.id !== msgId);
    memConv.messages = updatedMsgs;
    const lastMsg = updatedMsgs[updatedMsgs.length - 1];
    memConv.lastMessage = lastMsg ? (lastMsg.text || 'Message sent') : '';
    memConv.updatedAt = new Date();
  }

  try {
    await withDbRetry(async () => {
      const rows = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
      if (rows.length > 0) {
        const conv = rows[0];
        const existingMsgs = Array.isArray(conv.messages) ? (conv.messages as any[]) : [];
        const updatedMsgs = existingMsgs.filter((m) => m.id !== msgId);
        const lastMsg = updatedMsgs[updatedMsgs.length - 1];
        const lastSnippet = lastMsg
          ? (lastMsg.text || (lastMsg.voiceNote ? '🎤 Voice note' : 'File sent'))
          : '';

        await db
          .update(conversations)
          .set({
            messages: updatedMsgs,
            lastMessage: lastSnippet,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, convId));
      }
    }, 2);
  } catch {}
  return true;
}

// ----------------------------------------------------
// LEARNING SESSIONS
// ----------------------------------------------------
export async function getLearningSessionsFromDb() {
  try {
    const rows = await withDbRetry(async () => {
      return await db.select().from(learningSessions).orderBy(desc(learningSessions.createdAt));
    }, 2);
    if (rows && rows.length > 0) {
      for (const s of rows) memoryLearningSessions.set(s.id, s);
      return rows;
    }
  } catch {}
  return Array.from(memoryLearningSessions.values());
}

export async function getLearningSessionByIdFromDb(id: string) {
  try {
    const fromDb = await withDbRetry(async () => {
      const rows = await db.select().from(learningSessions).where(eq(learningSessions.id, id)).limit(1);
      return rows[0] || null;
    }, 2);
    if (fromDb) {
      memoryLearningSessions.set(id, fromDb);
      return fromDb;
    }
  } catch {}
  return memoryLearningSessions.get(id) || null;
}

export async function saveLearningSessionToDb(sessionData: any, videoBase64?: string, mimeType = 'video/webm') {
  const sessionId = sessionData.id || `session-${Date.now()}`;
  let videoUrl = sessionData.videoUrl || '';
  let hasRecordedVideo = Boolean(sessionData.hasRecordedVideo);

  if (videoBase64) {
    videoUrl = `/api/learning/videos/${sessionId}`;
    hasRecordedVideo = true;
  }

  const record = {
    id: sessionId,
    title: sessionData.title || 'Untitled Session',
    description: sessionData.description || '',
    category: sessionData.category || 'General',
    duration: sessionData.duration || '00:00',
    durationSeconds: sessionData.durationSeconds || 0,
    videoUrl: videoUrl,
    videoData: videoBase64 || '',
    hasRecordedVideo: hasRecordedVideo,
    sessionData: sessionData,
    updatedAt: new Date(),
  };

  memoryLearningSessions.set(sessionId, record);

  try {
    const inserted = await withDbRetry(async () => {
      const rows = await db
        .insert(learningSessions)
        .values(record)
        .onConflictDoUpdate({
          target: learningSessions.id,
          set: record,
        })
        .returning();
      return rows[0];
    }, 2);
    return inserted || record;
  } catch {
    return record;
  }
}

export async function deleteLearningSessionFromDb(id: string) {
  memoryLearningSessions.delete(id);
  try {
    await withDbRetry(async () => {
      await db.delete(learningSessions).where(eq(learningSessions.id, id));
    }, 2);
  } catch {}
  return true;
}
