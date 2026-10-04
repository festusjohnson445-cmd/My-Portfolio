import { pgTable, serial, text, timestamp, integer, boolean, jsonb, bigint } from 'drizzle-orm/pg-core';

// Users table for Firebase Auth & Access Control
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Global user profile table (Owner & Portfolio Bio, Avatar, Documents)
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(), // 'global' or user uid
  fullName: text('full_name'),
  title: text('title'),
  headline: text('headline'),
  bio: text('bio'),
  shortSummary: text('short_summary'),
  description: text('description'),
  discipline: text('discipline'),
  company: text('company'),
  location: text('location'),
  country: text('country'),
  experienceYears: text('experience_years'),
  email: text('email'),
  primaryEmail: text('primary_email'),
  phone: text('phone'),
  website: text('website'),
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  twitterUrl: text('twitter_url'),
  instagramUrl: text('instagram_url'),
  indeedUrl: text('indeed_url'),
  facebookUrl: text('facebook_url'),
  degree: text('degree'),
  academicHonors: text('academic_honors'),
  leadership: text('leadership'),
  shopCompetencies: text('shop_competencies'),
  badges: text('badges'),
  workClearance: text('work_clearance'),
  skills: text('skills'),
  avatar: text('avatar'), // base64 or storage url
  documents: jsonb('documents').default([]), // uploaded profile documents
  customFields: jsonb('custom_fields').default({}),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Dedicated Profile Pictures table (Separate persistent cloud database for profile photos)
export const profilePictures = pgTable('profile_pictures', {
  id: text('id').primaryKey(), // 'global' or user uid
  mimeType: text('mime_type').default('image/jpeg'),
  fileBinary: text('file_binary').notNull(), // optimized compressed image data
  fileSize: text('file_size'),
  dimensions: text('dimensions'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Engineering Hub Documents (CAD, PDFs, Technical Whitepapers, 3D Models)
export const documents = pgTable('documents', {
  id: text('id').primaryKey(), // e.g. doc-1790669863019
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: text('file_size').notNull(),
  fileType: text('file_type').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  author: text('author'),
  uploaderName: text('uploader_name'),
  uploaderType: text('uploader_type').default('visitor'),
  status: text('status').default('approved'),
  uploadDate: text('upload_date'),
  uploadTimestamp: bigint('upload_timestamp', { mode: 'number' }),
  downloadCount: integer('download_count').default(0),
  tags: jsonb('tags').default([]),
  previewUrl: text('preview_url'),
  downloadUrl: text('download_url'),
  dataUrl: text('data_url'),
  fileBinary: text('file_binary'), // persistent storage in database
  mimeType: text('mime_type'),
  hasServerFile: boolean('has_server_file').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Deleted Documents tracking for persistent sync
export const deletedDocuments = pgTable('deleted_documents', {
  id: text('id').primaryKey(),
  deletedAt: timestamp('deleted_at').defaultNow(),
});

// Inquiries & Chat Conversations
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(), // conversationId or visitorId
  defaultLabel: text('default_label').notNull(),
  customName: text('custom_name'),
  visitorName: text('visitor_name'),
  avatarUrl: text('avatar_url'),
  roleOrCompany: text('role_or_company'),
  avatarColor: text('avatar_color').default('bg-emerald-600'),
  unread: boolean('unread').default(false),
  important: boolean('important').default(false),
  lastMessage: text('last_message'),
  lastTimestamp: text('last_timestamp'),
  messages: jsonb('messages').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Deleted Inquiries tracking
export const deletedConversations = pgTable('deleted_conversations', {
  id: text('id').primaryKey(),
  deletedAt: timestamp('deleted_at').defaultNow(),
});

// Training & Learning Sessions
export const learningSessions = pgTable('learning_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'),
  duration: text('duration'),
  durationSeconds: integer('duration_seconds'),
  videoUrl: text('video_url'),
  videoData: text('video_data'),
  hasRecordedVideo: boolean('has_recorded_video').default(false),
  sessionData: jsonb('session_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
