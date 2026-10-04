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
import { eq, desc, inArray } from 'drizzle-orm';

// ----------------------------------------------------
// DEDICATED PROFILE PICTURE CLOUD DATABASE STORAGE
// ----------------------------------------------------
export async function getProfilePictureFromDb(id = 'global') {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(profilePictures).where(eq(profilePictures.id, id)).limit(1);
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching profile picture from DB:', error);
      return null;
    }
  });
}

export async function saveProfilePictureToDb(pictureData: {
  id?: string;
  fileBinary: string;
  mimeType?: string;
  fileSize?: string;
  dimensions?: string;
}) {
  return await withDbRetry(async () => {
    const id = pictureData.id || 'global';
    const record = {
      id,
      fileBinary: pictureData.fileBinary,
      mimeType: pictureData.mimeType || 'image/jpeg',
      fileSize: pictureData.fileSize || 'Standard',
      dimensions: pictureData.dimensions || '640 x 640 px',
      updatedAt: new Date(),
    };

    const inserted = await db
      .insert(profilePictures)
      .values(record)
      .onConflictDoUpdate({
        target: profilePictures.id,
        set: record,
      })
      .returning();

    // Also update the avatar link in the main profiles record so it cleanly references the dedicated picture endpoint
    const versionedUrl = `/api/profile/picture?v=${Date.now()}`;
    await db
      .update(profiles)
      .set({ avatar: versionedUrl, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .catch(() => {});

    return { ...inserted[0], avatarUrl: versionedUrl };
  });
}

export async function deleteProfilePictureFromDb(id = 'global') {
  return await withDbRetry(async () => {
    await db.delete(profilePictures).where(eq(profilePictures.id, id)).catch(() => {});
    await db
      .update(profiles)
      .set({ avatar: '', updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .catch(() => {});
    return true;
  });
}

// ----------------------------------------------------
// PROFILES
// ----------------------------------------------------
export async function getGlobalProfileFromDb() {
  return await withDbRetry(async () => {
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
        documents: row.documents || (custom as any).documents || [],
        customFields: custom,
        updatedAt: row.updatedAt?.toISOString(),
      };
    }
    return null;
  });
}

export async function saveGlobalProfileToDb(profileData: any) {
  return await withDbRetry(async () => {
    const existing = await getGlobalProfileFromDb().catch(() => null);
    const incomingBio = profileData.bio || (profileData.fullName ? profileData : {});
    const existingCustom = (existing?.customFields && typeof existing.customFields === 'object') ? existing.customFields : {};
    const incomingCustom = (profileData.customFields && typeof profileData.customFields === 'object') ? profileData.customFields : {};

    // Merge custom fields and bio so nothing is lost
    const mergedCustom: Record<string, any> = {
      ...existingCustom,
      ...(existing || {}),
      ...incomingCustom,
      ...incomingBio,
    };

    let resolvedAvatar = existing?.avatar || '/api/profile/picture';
    if (profileData.avatar !== undefined) {
      if (typeof profileData.avatar === 'string' && profileData.avatar.startsWith('data:image/')) {
        // Offload large base64 image data to the separate profile_pictures cloud table
        try {
          const picRes = await saveProfilePictureToDb({
            id: 'global',
            fileBinary: profileData.avatar,
          });
          resolvedAvatar = picRes.avatarUrl;
        } catch (picErr) {
          console.error('Failed offloading avatar to profile_pictures table:', picErr);
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

    const resolvedHeader = incomingBio.header !== undefined ? incomingBio.header : (incomingBio.headline !== undefined ? incomingBio.headline : (profileData.header !== undefined ? profileData.header : (existing?.header || existing?.headline || '')));
    const resolvedDescription = incomingBio.description !== undefined ? incomingBio.description : (incomingBio.bio !== undefined ? incomingBio.bio : (profileData.description !== undefined ? profileData.description : (existing?.description || existing?.bio || '')));
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
    const resolvedAvailabilityStatus = incomingBio.availabilityStatus !== undefined ? incomingBio.availabilityStatus : (profileData.availabilityStatus !== undefined ? profileData.availabilityStatus : (existing?.availabilityStatus || ''));
    const resolvedTargetLocations = incomingBio.targetLocations !== undefined ? incomingBio.targetLocations : (profileData.targetLocations !== undefined ? profileData.targetLocations : (existing?.targetLocations || ''));
    const resolvedLinkedinUrl = incomingBio.linkedinUrl !== undefined ? incomingBio.linkedinUrl : (profileData.linkedinUrl !== undefined ? profileData.linkedinUrl : (existing?.linkedinUrl || ''));
    const resolvedFacebookUrl = incomingBio.facebookUrl !== undefined ? incomingBio.facebookUrl : (profileData.facebookUrl !== undefined ? profileData.facebookUrl : (existing?.facebookUrl || ''));
    const resolvedIndeedUrl = incomingBio.indeedUrl !== undefined ? incomingBio.indeedUrl : (profileData.indeedUrl !== undefined ? profileData.indeedUrl : (existing?.indeedUrl || ''));
    const resolvedTwitterUrl = incomingBio.twitterUrl !== undefined ? incomingBio.twitterUrl : (profileData.twitterUrl !== undefined ? profileData.twitterUrl : (existing?.twitterUrl || ''));
    const resolvedTiktokUrl = incomingBio.tiktokUrl !== undefined ? incomingBio.tiktokUrl : (profileData.tiktokUrl !== undefined ? profileData.tiktokUrl : ((existing as any)?.tiktokUrl || ''));
    const resolvedInstagramUrl = incomingBio.instagramUrl !== undefined ? incomingBio.instagramUrl : (profileData.instagramUrl !== undefined ? profileData.instagramUrl : (existing?.instagramUrl || ''));
    const resolvedEmailUrl = incomingBio.emailUrl !== undefined ? incomingBio.emailUrl : (profileData.emailUrl !== undefined ? profileData.emailUrl : ((existing as any)?.emailUrl || (resolvedEmail ? `mailto:${resolvedEmail}` : '')));

    mergedCustom.header = resolvedHeader;
    mergedCustom.headline = resolvedHeader;
    mergedCustom.description = resolvedDescription;
    mergedCustom.availabilityStatus = resolvedAvailabilityStatus;
    mergedCustom.targetLocations = resolvedTargetLocations;
    mergedCustom.tiktokUrl = resolvedTiktokUrl;
    mergedCustom.emailUrl = resolvedEmailUrl;

    const record = {
      id: 'global',
      fullName: resolvedFullName,
      title: incomingBio.title || profileData.title || existing?.title || '',
      headline: resolvedHeader,
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

    const inserted = await db
      .insert(profiles)
      .values(record)
      .onConflictDoUpdate({
        target: profiles.id,
        set: record,
      })
      .returning();

    return inserted[0];
  });
}

// ----------------------------------------------------
// DOCUMENTS (ENGINEERING HUB)
// ----------------------------------------------------
export async function getDeletedDocumentIdsFromDb(): Promise<Set<string>> {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(deletedDocuments);
      return new Set(rows.map((r) => r.id));
    } catch (error) {
      console.error('Database query failed for deleted documents:', error);
      return new Set();
    }
  });
}

export async function recordDeletedDocumentIdInDb(id: string): Promise<void> {
  return await withDbRetry(async () => {
    try {
      await db
        .insert(deletedDocuments)
        .values({ id, deletedAt: new Date() })
        .onConflictDoNothing();
    } catch (error) {
      console.error('Database query failed recording deleted doc id:', error);
    }
  });
}

export async function getDocumentsFromDb(includePending = false) {
  return await withDbRetry(async () => {
    try {
      const deletedIds = await getDeletedDocumentIdsFromDb();
      const rows = await db.select().from(documents).orderBy(desc(documents.uploadTimestamp), desc(documents.createdAt));

      const activeDocs = rows.filter((d) => !deletedIds.has(d.id));
      const filtered = includePending
        ? activeDocs
        : activeDocs.filter((d) => d.status === 'approved' || !d.status);

      return filtered.map((d) => ({
        ...d,
        uploadTimestamp: d.uploadTimestamp ? Number(d.uploadTimestamp) : undefined,
        downloadUrl: `/api/documents/files/${d.id}`,
        // Return lightweight metadata for fast loading
        dataUrl: d.dataUrl && d.dataUrl.length > 300000 ? undefined : d.dataUrl,
      }));
    } catch (error) {
      console.error('Database query failed fetching documents:', error);
      throw error;
    }
  });
}

export async function getDocumentByIdFromDb(id: string) {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (rows.length === 0) return null;
      const doc = rows[0];
      return {
        ...doc,
        uploadTimestamp: doc.uploadTimestamp ? Number(doc.uploadTimestamp) : undefined,
      };
    } catch (error) {
      console.error('Database query failed getting document by id:', error);
      throw error;
    }
  });
}

export async function saveDocumentToDb(doc: any) {
  return await withDbRetry(async () => {
    try {
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

      const inserted = await db
        .insert(documents)
        .values(record)
        .onConflictDoUpdate({
          target: documents.id,
          set: record,
        })
        .returning();

      return inserted[0];
    } catch (error) {
      console.error('Database query failed saving document:', error);
      throw error;
    }
  });
}

export async function deleteDocumentFromDb(id: string) {
  return await withDbRetry(async () => {
    try {
      await recordDeletedDocumentIdInDb(id);
      await db.delete(documents).where(eq(documents.id, id));
      
      // Also remove from profile documents if present
      try {
        const profile = await getGlobalProfileFromDb();
        if (profile && Array.isArray(profile.documents)) {
          const remainingDocs = profile.documents.filter((d: any) => d.id !== id);
          await saveGlobalProfileToDb({ ...profile, documents: remainingDocs });
        }
      } catch (profileErr) {
        console.warn('Note updating profile documents after deletion:', profileErr);
      }
    } catch (error) {
      console.error('Database query failed deleting document:', error);
      throw error;
    }
  });
}

export async function incrementDocumentDownloadCountInDb(id: string) {
  return await withDbRetry(async () => {
    try {
      const doc = await getDocumentByIdFromDb(id);
      if (doc) {
        await db
          .update(documents)
          .set({ downloadCount: (doc.downloadCount || 0) + 1 })
          .where(eq(documents.id, id));
      }
    } catch (error) {
      console.error('Database query failed incrementing download count:', error);
    }
  });
}

// ----------------------------------------------------
// CHAT CONVERSATIONS & INQUIRIES
// ----------------------------------------------------
export async function getDeletedConversationIdsFromDb(): Promise<Set<string>> {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(deletedConversations);
      return new Set(rows.map((r) => r.id));
    } catch (error) {
      console.error('Database query failed fetching deleted conversations:', error);
      return new Set();
    }
  });
}

export async function recordDeletedConversationIdInDb(id: string): Promise<void> {
  return await withDbRetry(async () => {
    try {
      await db
        .insert(deletedConversations)
        .values({ id, deletedAt: new Date() })
        .onConflictDoNothing();
    } catch (error) {
      console.error('Database query failed recording deleted conversation:', error);
    }
  });
}

export async function unrecordDeletedConversationIdInDb(id: string): Promise<void> {
  return await withDbRetry(async () => {
    try {
      await db.delete(deletedConversations).where(eq(deletedConversations.id, id));
    } catch (error) {
      console.error('Database query failed unrecording deleted conversation:', error);
    }
  });
}

export async function getConversationsFromDb() {
  return await withDbRetry(async () => {
    try {
      const deletedIds = await getDeletedConversationIdsFromDb();
      const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
      return rows.filter((c) => !deletedIds.has(c.id));
    } catch (error) {
      console.error('Database query failed fetching conversations:', error);
      throw error;
    }
  });
}

export async function saveConversationToDb(conv: any) {
  return await withDbRetry(async () => {
    try {
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

      const inserted = await db
        .insert(conversations)
        .values(record)
        .onConflictDoUpdate({
          target: conversations.id,
          set: record,
        })
        .returning();

      return inserted[0];
    } catch (error) {
      console.error('Database query failed saving conversation:', error);
      throw error;
    }
  });
}

export async function saveConversationsBatchToDb(incoming: any[], overwrite = false) {
  return await withDbRetry(async () => {
    try {
      const deletedIds = await getDeletedConversationIdsFromDb();
      const filtered = incoming.filter((c) => c && c.id && !deletedIds.has(c.id));

      if (overwrite) {
        // Overwrite: clear and replace
        for (const conv of filtered) {
          await saveConversationToDb(conv);
        }
        return await getConversationsFromDb();
      }

      // Merge logic
      const existing = await getConversationsFromDb();
      const map = new Map<string, any>();
      for (const c of existing) {
        map.set(c.id, c);
      }

      for (const inc of filtered) {
        if (map.has(inc.id)) {
          const cur = map.get(inc.id);
          const msgMap = new Map<string, any>();
          for (const m of (cur.messages as any[]) || []) {
            if (m && m.id) msgMap.set(m.id, m);
          }
          for (const m of (inc.messages as any[]) || []) {
            if (m && m.id) msgMap.set(m.id, m);
          }
          const mergedMessages = Array.from(msgMap.values());
          map.set(inc.id, {
            ...cur,
            ...inc,
            messages: mergedMessages,
          });
        } else {
          map.set(inc.id, inc);
        }
      }

      for (const conv of map.values()) {
        await saveConversationToDb(conv);
      }

      return await getConversationsFromDb();
    } catch (error) {
      console.error('Database query failed saving conversations batch:', error);
      throw error;
    }
  });
}

export async function deleteConversationFromDb(id: string) {
  return await withDbRetry(async () => {
    try {
      await recordDeletedConversationIdInDb(id);
      await db.delete(conversations).where(eq(conversations.id, id));
    } catch (error) {
      console.error('Database query failed deleting conversation:', error);
      throw error;
    }
  });
}

export async function deleteMessageFromDb(convId: string, msgId: string) {
  return await withDbRetry(async () => {
    try {
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
    } catch (error) {
      console.error('Database query failed deleting message:', error);
      throw error;
    }
  });
}

// ----------------------------------------------------
// LEARNING SESSIONS
// ----------------------------------------------------
export async function getLearningSessionsFromDb() {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(learningSessions).orderBy(desc(learningSessions.createdAt));
      return rows;
    } catch (error) {
      console.error('Database query failed fetching learning sessions:', error);
      throw error;
    }
  });
}

export async function getLearningSessionByIdFromDb(id: string) {
  return await withDbRetry(async () => {
    try {
      const rows = await db.select().from(learningSessions).where(eq(learningSessions.id, id)).limit(1);
      return rows[0] || null;
    } catch (error) {
      console.error('Database query failed fetching learning session by id:', error);
      return null;
    }
  });
}

export async function saveLearningSessionToDb(sessionData: any, videoBase64?: string, mimeType = 'video/webm') {
  return await withDbRetry(async () => {
    try {
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

      const inserted = await db
        .insert(learningSessions)
        .values(record)
        .onConflictDoUpdate({
          target: learningSessions.id,
          set: record,
        })
        .returning();

      return inserted[0];
    } catch (error) {
      console.error('Database query failed saving learning session:', error);
      throw error;
    }
  });
}

export async function deleteLearningSessionFromDb(id: string) {
  return await withDbRetry(async () => {
    try {
      await db.delete(learningSessions).where(eq(learningSessions.id, id));
    } catch (error) {
      console.error('Database query failed deleting learning session:', error);
      throw error;
    }
  });
}
