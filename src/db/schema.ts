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

// Projects Table (3D CAD, Hardware, Methodology, Technical Specs)
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug'),
  tagline: text('tagline'),
  description: text('description'),
  category: text('category').default('CAD'),
  status: text('status').default('Validated Prototype'),
  featured: boolean('featured').default(false),
  thumbnailUrl: text('thumbnail_url'),
  overview: text('overview'),
  objectives: text('objectives'),
  methodology: text('methodology'),
  technicalSpecifications: jsonb('technical_specifications').default({}),
  cadDrawings: jsonb('cad_drawings').default([]),
  images: jsonb('images').default([]),
  videos: jsonb('videos').default([]),
  toolsUsed: jsonb('tools_used').default([]),
  results: text('results'),
  demonstrationLinks: jsonb('demonstration_links').default([]),
  downloadableDocuments: jsonb('downloadable_documents').default([]),
  viewsCount: integer('views_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Media Gallery
export const projectMedia = pgTable('project_media', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  mediaType: text('media_type').default('image'),
  title: text('title'),
  fileName: text('file_name'),
  fileUrl: text('file_url').notNull(),
  fileSize: text('file_size'),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Article Categories
export const articleCategories = pgTable('article_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug'),
  description: text('description'),
  displayOrder: integer('display_order').default(0),
});

// Blog / Articles
export const articles = pgTable('articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug'),
  category: text('category').default('Mechanical Engineering'),
  authorName: text('author_name').default('Festus, Olorunsogo Johnson'),
  authorRole: text('author_role').default('Chief Admin'),
  isChiefAdmin: boolean('is_chief_admin').default(true),
  coverImage: text('cover_image'),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  readingTime: text('reading_time').default('5 min read'),
  tags: jsonb('tags').default([]),
  status: text('status').default('published'),
  submittedBy: text('submitted_by').default('owner'),
  visitorEmail: text('visitor_email'),
  likesCount: integer('likes_count').default(0),
  viewsCount: integer('views_count').default(0),
  commentsCount: integer('comments_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Article Comments
export const articleComments = pgTable('article_comments', {
  id: text('id').primaryKey(),
  articleId: text('article_id').notNull(),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email'),
  authorAvatar: text('author_avatar'),
  content: text('content').notNull(),
  status: text('status').default('approved'),
  parentCommentId: text('parent_comment_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Article Likes
export const articleLikes = pgTable('article_likes', {
  id: text('id').primaryKey(),
  articleId: text('article_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Career Experience
export const experience = pgTable('experience', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  period: text('period').notNull(),
  current: boolean('current').default(false),
  description: text('description'),
  responsibilities: jsonb('responsibilities').default([]),
  technologies: jsonb('technologies').default([]),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Research Publications
export const publications = pgTable('publications', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  authors: text('authors'),
  journalOrConference: text('journal_or_conference'),
  publicationDate: text('publication_date'),
  doiOrUrl: text('doi_or_url'),
  description: text('description'),
  pdfUrl: text('pdf_url'),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Achievements & Honors
export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  issuer: text('issuer'),
  date: text('date'),
  credentialId: text('credential_id'),
  category: text('category').default('Award'),
  description: text('description'),
  verificationUrl: text('verification_url'),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
