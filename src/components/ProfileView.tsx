import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileText,
  Mail,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Award,
  CheckCircle2,
  Copy,
  Check,
  Send,
  GraduationCap,
  Camera,
  Upload,
  Edit3,
  Save,
  X,
  Trash2,
  Plus,
  FileUp,
  FileCode,
  RotateCcw,
  Sparkles,
  Info,
  Lock,
  Unlock,
  Key,
  KeyRound,
  User,
  Briefcase,
  Globe,
  ExternalLink,
  Layers,
  FileCheck,
  Eye,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  RotateCw,
  Compass,
  Code,
  Wrench,
  Users,
  Database,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { PortfolioPart } from './Navbar';
import { generateAndDownloadResume } from '../utils/generateResumePdf';
import { SkillSelector } from './SkillSelector';
import { ResumeDownloadModal } from './ResumeDownloadModal';
import {
  categorizeSkills,
  SkillCategoryName,
  resolveSkillStatus,
  formatSkillStatusLabel,
  SKILL_STATUS_OPTIONS,
  type SkillStatus,
} from '../data/skillsData';
import {
  saveStoredAvatar,
  resetStoredAvatar,
  saveStoredBio,
  saveStoredDocuments,
  setOwnerAuthenticated,
  compressImage,
  notifyProfileUpdated,
  OWNER_EMAIL,
  useProfileSync,
  DEFAULT_AVATAR,
  DEFAULT_BIO_DATA,
  syncGlobalProfileWithServer,
  type ProfileBioData,
  type DocumentItem,
} from '../utils/profileState';
import { ProfilePictureRepositionModal } from './ProfilePictureRepositionModal';
import { loadAndValidateImageFile, type LoadedImageDetails } from '../utils/imagePipeline';
import { DocumentTopMedia } from './DocumentTopMedia';
import { renderPdfFirstPageToImage } from '../utils/pdfRenderer';
import { loadDocumentsPersistently, deleteDocumentPersistently } from '../utils/documentStorage';
import { SupabaseSettingsModal } from './SupabaseSettingsModal';
import {
  supabase,
  supabaseSignInOwner,
  supabaseSignOutOwner,
  getAuthenticatedOwnerUid,
  uploadAvatarToSupabaseBucket,
  uploadMaterialToSupabaseBucket,
  SUPABASE_RLS_SCHEMA_SQL,
  isSupabaseConfigured,
  getSupabaseProjectUrl,
  withRecordVersion,
  withCacheBuster,
  isRealOwnerUser,
} from '../utils/supabase';
import {
  fetchExperiencesFromSupabase,
  upsertExperienceToSupabase,
  deleteExperienceFromSupabase,
  fetchPublicationsFromSupabase,
  upsertPublicationToSupabase,
  deletePublicationFromSupabase,
  fetchAchievementsFromSupabase,
  upsertAchievementToSupabase,
  deleteAchievementFromSupabase,
  useWebsiteSettingsSync,
  type ProfileExperience,
  type ProfilePublication,
  type ProfileAchievement,
  type CustomProfileSection,
  type BuiltInProfileSectionId,
} from '../utils/portfolioSupabase';

interface ProfileViewProps {
  onResumeClick?: () => void;
  onNavigatePart?: (part: PortfolioPart) => void;
  resumeDownloadCount: number;
}

export const COUNTRIES_LIST = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'Nigeria',
  'Australia',
  'France',
  'Japan',
  'Switzerland',
  'Sweden',
  'Netherlands',
  'Singapore',
  'India',
  'Brazil',
  'South Africa',
  'Italy',
  'Spain',
  'Norway',
  'Ireland',
  'United Arab Emirates',
  'Saudi Arabia',
  'South Korea',
  'New Zealand',
  'Mexico',
  'Poland',
  'Austria',
  'Belgium',
  'Denmark',
  'Finland',
  'Ghana',
  'Kenya',
  'Egypt',
  'China',
  'Israel',
  'Taiwan',
  'Turkey',
  'Other / International'
];

export const ENGINEERING_DEGREES_LIST = [
  'B.S. in Mechanical Engineering (BSME)',
  'M.S. in Mechanical Engineering (MSME)',
  'Ph.D. in Mechanical Engineering',
  'B.Eng in Mechanical Engineering',
  'B.S. in Aerospace Engineering (BSAE)',
  'M.S. in Aerospace Engineering (MSAE)',
  'B.S. in Mechatronics & Robotics Engineering',
  'M.S. in Robotics & Autonomous Systems',
  'B.S. in Materials Science & Engineering',
  'B.S. in Manufacturing / Industrial Engineering',
  'B.S. in Electrical & Computer Engineering (BSEE)',
  'B.S. in Biomedical Engineering / Biomechanical Devices',
  'B.S. in Automotive & Mobility Engineering',
  'B.Tech in Mechanical Engineering',
  'Associate Degree in Mechanical Engineering / CAD Technology',
  'Other Engineering Course / Degree'
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  onResumeClick,
  resumeDownloadCount: initialResumeDownloadCount,
}) => {
  // 1. Profile State synchronized across all visitors and server
  const {
    avatar: profileAvatar,
    bio: bioData,
    documents,
    updatedAt: profileUpdatedAt,
    saveAvatar: syncSaveAvatar,
    resetAvatar: syncResetAvatar,
    saveBio: syncSaveBio,
    saveDocuments: saveSyncDocuments,
    isOwner: syncIsOwner,
    ownerUid: syncOwnerUid,
    setOwner: syncSetOwner
  } = useProfileSync();

  const websiteSettings = useWebsiteSettingsSync();
  const profileSectionManager = websiteSettings.appearanceConfig.profileSectionManager;
  const getBuiltInSection = (id: BuiltInProfileSectionId, fallbackLabel: string) => {
    const found = profileSectionManager.builtInSections.find((s) => s.id === id);
    return found || { id, label: fallbackLabel, visible: true };
  };

  const fileInputAvatarRef = useRef<HTMLInputElement>(null);

  // 2. Profile Bio Editing State
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBioForm, setEditBioForm] = useState<ProfileBioData>(bioData);
  const [editAvatar, setEditAvatar] = useState<string>(profileAvatar);
  const [optimisticAvatarUrl, setOptimisticAvatarUrl] = useState<string | null>(null);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [bioSaveNotice, setBioSaveNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Delete Profile Picture Modal State
  const [isDeleteAvatarModalOpen, setIsDeleteAvatarModalOpen] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

  // Profile Picture Interactive Positioning & Pipeline State
  const [repositionModalOpen, setRepositionModalOpen] = useState(false);
  const [loadedImageForReposition, setLoadedImageForReposition] = useState<LoadedImageDetails | null>(null);
  const [isDecodingImage, setIsDecodingImage] = useState(false);

  const handleConfirmDeleteAvatar = async () => {
    try {
      setIsDeletingAvatar(true);
      setOptimisticAvatarUrl(null);
      await syncResetAvatar();
      setEditAvatar('');
      setAvatarImgError(false);
      setIsDeleteAvatarModalOpen(false);
      setBioSaveNotice({ text: 'Profile picture removed successfully.' });
      setTimeout(() => setBioSaveNotice(null), 4000);
    } catch (err) {
      console.warn('Error deleting avatar:', err);
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  useEffect(() => {
    setAvatarImgError(false);
    if (!isEditingBio) {
      setEditBioForm(bioData);
      setEditAvatar(profileAvatar);
    }
  }, [bioData, profileAvatar, isEditingBio]);

  const setDocuments = (updater: DocumentItem[] | ((prev: DocumentItem[]) => DocumentItem[])) => {
    const current = typeof updater === 'function' ? updater(documents) : updater;
    saveSyncDocuments(current);
  };

  // Lightbox preview for full image/document view
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<DocumentItem | null>(null);

  // Modal / Form state for uploading/adding documents
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docIssuer, setDocIssuer] = useState('');
  const [docCredentialId, setDocCredentialId] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentItem['category']>('Certification');
  const [docCredentialGroup, setDocCredentialGroup] = useState<'Specialization' | 'Courses' | 'Document'>('Specialization');
  const [docParentSpecializationId, setDocParentSpecializationId] = useState<string>('');
  const [docFileType, setDocFileType] = useState<string>('PDF / Document');
  const [docDescription, setDocDescription] = useState('');
  const [docCompetenciesInput, setDocCompetenciesInput] = useState('');
  const [docVerifiedLink, setDocVerifiedLink] = useState('');
  const [docAttachmentName, setDocAttachmentName] = useState<string | undefined>();
  const [docAttachmentDataUrl, setDocAttachmentDataUrl] = useState<string | undefined>();
  const [docAttachmentSize, setDocAttachmentSize] = useState<string | undefined>();
  const [docPreviewImageDataUrl, setDocPreviewImageDataUrl] = useState<string | undefined>();
  const [docSelectedFile, setDocSelectedFile] = useState<File | null>(null);
  const [isRenderingPdfInForm, setIsRenderingPdfInForm] = useState(false);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const docAttachmentInputRef = useRef<HTMLInputElement>(null);

  // Credentials Grouping & Interactive Specialization Selection
  const [credentialFilterGroup, setCredentialFilterGroup] = useState<'All' | 'Specialization' | 'Courses'>('All');
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<string | null>(null);

  // Structured Profile Sections State (Experience, Publications, Achievements & Skills)
  const [experiences, setExperiences] = useState<ProfileExperience[]>([]);
  const [publications, setPublications] = useState<ProfilePublication[]>([]);
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [isEditingSkillsPanel, setIsEditingSkillsPanel] = useState(false);
  const [skillsDraft, setSkillsDraft] = useState('');
  const [certifiedSkillsDraft, setCertifiedSkillsDraft] = useState<string[]>([]);
  const [skillStatusesDraft, setSkillStatusesDraft] = useState<Record<string, SkillStatus>>({});

  useEffect(() => {
    setSkillsDraft(bioData.skills || '');
    setCertifiedSkillsDraft(bioData.certifiedSkills || []);
    setSkillStatusesDraft(bioData.skillStatuses || {});
  }, [bioData.skills, bioData.certifiedSkills, bioData.skillStatuses]);

  useEffect(() => {
    fetchExperiencesFromSupabase().then((ex) => {
      setExperiences(ex.length > 0 ? ex : (bioData.experiences as ProfileExperience[]) || []);
    });
    fetchPublicationsFromSupabase().then((pu) => {
      setPublications(pu.length > 0 ? pu : (bioData.publications as ProfilePublication[]) || []);
    });
    fetchAchievementsFromSupabase().then((ac) => {
      setAchievements(ac.length > 0 ? ac : (bioData.achievements as ProfileAchievement[]) || []);
    });
  }, [bioData.experiences, bioData.publications, bioData.achievements]);

  // Load persistent documents from IndexedDB on initial mount safely
  useEffect(() => {
    loadDocumentsPersistently()
      .then((savedDocs) => {
        if (savedDocs && savedDocs.length > 0) {
          saveSyncDocuments(savedDocs);
        }
      })
      .catch((e) => console.warn('Could not load persistent documents:', e));
  }, []);

  // Delete document confirmation modal state (Owner only)
  const [docToDelete, setDocToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // 4. OWNER ACCESS CONTROL (Restricting changes to Festus Johnson only)
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState<boolean>(syncIsOwner);
  const [authenticatedUid, setAuthenticatedUid] = useState<string>(() => syncOwnerUid || getAuthenticatedOwnerUid());
  const [copiedUid, setCopiedUid] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRlsModal, setShowRlsModal] = useState(false);
  const [showSupabaseSettingsModal, setShowSupabaseSettingsModal] = useState(false);
  // Email starts empty so nothing is displayed until the user types or clicks autofill
  const [authEmail, setAuthEmail] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAtsPreviewModalOpen, setIsAtsPreviewModalOpen] = useState(false);

  useEffect(() => {
    setIsOwnerAuthenticated(syncIsOwner);
    if (syncOwnerUid) setAuthenticatedUid(syncOwnerUid);
  }, [syncIsOwner, syncOwnerUid]);

  // Support direct URL access e.g. #admin or ?admin=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      if (urlParams.get('admin') === 'true' || hash === '#admin' || hash === '#owner-login') {
        setIsAuthModalOpen(true);
      }
    }
  }, []);

  // Listen for double-click event from the base footer on the profile page
  useEffect(() => {
    const handleOpenAuth = () => {
      setAuthError(null);
      setAuthPin('');
      setIsAuthModalOpen(true);
    };
    window.addEventListener('open-owner-auth-modal', handleOpenAuth);
    return () => window.removeEventListener('open-owner-auth-modal', handleOpenAuth);
  }, []);

  // Resume Download count tracker
  const [localDownloadCount, setLocalDownloadCount] = useState<number>(() => {
    const saved = localStorage.getItem('fesline_resume_download_count');
    return saved ? parseInt(saved, 10) : initialResumeDownloadCount || 0;
  });

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    const cleanEmail = authEmail.trim();
    const cleanPassword = authPin.trim();

    try {
      // Genuine Supabase Auth integration using supabase.auth.signInWithPassword
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setAuthError(error.message || 'Authentication failed. Please verify your credentials.');
        return;
      }

      if (data?.session && data.user && isRealOwnerUser(data.user)) {
        setAuthenticatedUid(data.user.id);
        syncSetOwner(true, data.user.id);
        setIsOwnerAuthenticated(true);
        setIsAuthModalOpen(false);
        setAuthPin('');
        setAuthError(null);
        showNotification(`Authenticated as ${data.user.email}.`);
      } else if (data?.session) {
        await supabaseSignOutOwner();
        setAuthError('This account is not authorized as the portfolio owner.');
      } else {
        setAuthError('Authentication succeeded but no active session was returned.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to authenticate owner with Supabase.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOwnerLogout = async () => {
    await supabaseSignOutOwner();
    syncSetOwner(false);
    setIsOwnerAuthenticated(false);
    setIsEditingBio(false);
    setIsDocumentModalOpen(false);
    showNotification('Logged out from Supabase Owner mode. Profile is in public visitor view.');
  };

  const [copiedAts, setCopiedAts] = useState(false);

  // Handle Profile Picture Selection (Owner Gated via Supabase Auth Session)
  // No premature compression or resize is performed before positioning
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate active session
    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;
    if (!activeSession || !activeSession.user) {
      setIsAuthModalOpen(true);
      showNotification('Active owner session required to change profile photo. Please log in.', 'error');
      e.target.value = '';
      return;
    }

    const isImageFile =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|tiff?|heic|heif)$/i.test(file.name);

    if (!isImageFile) {
      showNotification('Please select a valid image file (JPEG, PNG, HEIC, WebP).', 'error');
      e.target.value = '';
      return;
    }

    try {
      setIsDecodingImage(true);
      showNotification('Loading full-resolution image for positioning...');

      // Pipeline Step 1: Decode and validate image file integrity (JPEG, PNG, HEIC)
      // Preserves original picture size and dimensions for interactive framing
      const imageDetails = await loadAndValidateImageFile(file);

      // Open interactive positioning workspace
      setLoadedImageForReposition(imageDetails);
      setRepositionModalOpen(true);
    } catch (err: any) {
      console.error('[Avatar File Validation Error]:', err);
      showNotification(
        err?.message || 'Corrupted or unreadable image file. Please choose a valid JPEG, PNG, or HEIC image.',
        'error'
      );
    } finally {
      setIsDecodingImage(false);
      e.target.value = '';
    }
  };

  // Callback triggered after automated 500x500 WebP @ 80% pipeline and Supabase upload completes
  const handleRepositionSuccess = async (newAvatarUrl: string, previewDataUrl?: string) => {
    setAvatarImgError(false);
    const immediateDataUrl = previewDataUrl || newAvatarUrl;
    setOptimisticAvatarUrl(immediateDataUrl);
    setEditAvatar(newAvatarUrl);

    // Preload image in memory immediately to prevent any visual glance or delay of previous photo
    try {
      const preload = new Image();
      preload.src = immediateDataUrl;
    } catch {}

    try {
      await syncSaveAvatar(newAvatarUrl);
      showNotification('Profile photo cropped (500×500 WebP @ 80%) and saved to Supabase!');
    } catch (err: any) {
      console.error('[Avatar Sync Error]:', err);
      showNotification('Photo uploaded to storage, but profile sync failed: ' + (err?.message || 'Database error'), 'error');
    }
  };

  // Handle Bio Edit Save (Owner Gated via Supabase Session)
  const handleOpenEditBio = () => {
    if (!isOwnerAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    setEditBioForm({ ...bioData });
    setEditAvatar(profileAvatar || DEFAULT_AVATAR);
    setIsEditingBio(true);
  };

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;
    if (!activeSession || !activeSession.user) {
      setIsAuthModalOpen(true);
      showNotification('Active owner session required to update profile. Please log in.', 'error');
      return;
    }

    try {
      if (editAvatar === '' && profileAvatar) {
        await syncResetAvatar();
      } else if (editAvatar && editAvatar !== profileAvatar) {
        await syncSaveAvatar(editAvatar);
      }
      await syncSaveBio(editBioForm);
      setIsEditingBio(false);
      showNotification('Profile details updated and saved to Supabase successfully!');
    } catch (err: any) {
      console.error('[Save Bio Error]:', err);
      showNotification('Failed to save profile: ' + (err?.message || 'Database error'), 'error');
    }
  };

  // Helper notification toast with error support
  const showNotification = (msg: string, type: 'info' | 'error' = 'info') => {
    setBioSaveNotice({ text: msg, isError: type === 'error' });
    setTimeout(() => {
      setBioSaveNotice(null);
    }, 5000);
  };

  // --- 1-CLICK DYNAMIC RESUME DOWNLOAD GENERATION ---
  const handleDirectDownloadResume = () => {
    generateAndDownloadResume({
      fullName: bioData.fullName,
      header: bioData.header,
      email: bioData.email,
      country: bioData.country,
      discipline: bioData.discipline,
      badges: bioData.badges,
      degree: bioData.degree,
      academicHonors: bioData.academicHonors,
      leadership: bioData.leadership,
      skills: bioData.skills,
      certifiedSkills: bioData.certifiedSkills,
      skillStatuses: bioData.skillStatuses,
      description: bioData.description,
      experiences,
      publications,
      achievements,
      documents: documents.length > 0 ? documents.map((d) => ({
        title: d.title,
        issuer: d.issuer,
        id: d.credentialId,
        date: d.date,
        description: d.description,
        competencies: d.competencies,
        credentialGroup: d.credentialGroup,
        parentSpecializationTitle: d.parentSpecializationId
          ? documents.find((p) => p.id === d.parentSpecializationId)?.title
          : undefined,
      })) : undefined,
    });

    const newCount = localDownloadCount + 1;
    setLocalDownloadCount(newCount);
    localStorage.setItem('fesline_resume_download_count', newCount.toString());
    showNotification('Professional Resume generated & downloaded in one click!');
  };

  // --- DOCUMENT FORM HANDLING (ONE AFTER ANOTHER) ---
  const handleOpenAddDocument = () => {
    if (!isOwnerAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    setEditingDocId(null);
    setDocTitle('');
    setDocIssuer('');
    setDocCredentialId('');
    setDocDate('Verified ' + new Date().getFullYear());
    setDocCategory('Certification');
    setDocCredentialGroup('Specialization');
    setDocParentSpecializationId('');
    setDocFileType('PDF / Document');
    setDocDescription('');
    setDocCompetenciesInput('');
    setDocVerifiedLink('');
    setDocAttachmentName(undefined);
    setDocAttachmentDataUrl(undefined);
    setDocAttachmentSize(undefined);
    setDocPreviewImageDataUrl(undefined);
    setIsRenderingPdfInForm(false);
    setDocFormError(null);
    setIsDocumentModalOpen(true);
  };

  const handleOpenAddCourseForSpecialization = (specializationId: string) => {
    if (!isOwnerAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    handleOpenAddDocument();
    setDocCredentialGroup('Courses');
    setDocParentSpecializationId(specializationId);
  };

  const handleOpenEditDocument = (doc: DocumentItem) => {
    if (!isOwnerAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    setEditingDocId(doc.id);
    setDocTitle(doc.title);
    setDocIssuer(doc.issuer);
    setDocCredentialId(doc.credentialId);
    setDocDate(doc.date);
    setDocCategory(doc.category);
    setDocCredentialGroup(doc.credentialGroup || 'Specialization');
    setDocParentSpecializationId(doc.parentSpecializationId || '');
    setDocFileType(doc.fileType || 'PDF / Document');
    setDocDescription(doc.description);
    setDocCompetenciesInput(doc.competencies.join('\n'));
    setDocVerifiedLink(doc.verifiedLink || '');
    setDocAttachmentName(doc.attachmentName);
    setDocAttachmentDataUrl(doc.attachmentDataUrl);
    setDocAttachmentSize(doc.attachmentSize);
    setDocPreviewImageDataUrl(doc.previewImageDataUrl);
    setIsRenderingPdfInForm(false);
    setDocFormError(null);
    setIsDocumentModalOpen(true);
  };

  const handleDocumentAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocSelectedFile(file);

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    setDocAttachmentName(file.name);
    setDocAttachmentSize(formatSize(file.size));

    // Auto-populate default text fields for immediate one-click saving if empty
    if (!docTitle.trim()) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' ');
      setDocTitle(cleanTitle);
    }
    if (!docIssuer.trim()) {
      setDocIssuer('ASME / Mechanical Engineering');
    }
    if (!docDescription.trim()) {
      setDocDescription(`Technical document and engineering record: ${file.name}`);
    }

    // Auto-detect file type option based on uploaded extension and mime type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const isImg =
      ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext || '') ||
      file.type.startsWith('image/');

    if (isPdf) {
      setDocFileType('PDF / Document');
      setIsRenderingPdfInForm(true);

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        setDocAttachmentDataUrl(dataUrl);

        try {
          const previewImg = await renderPdfFirstPageToImage(dataUrl, 900);
          setDocPreviewImageDataUrl(previewImg || undefined);
        } catch (err) {
          console.warn('PDF preview render error:', err);
        } finally {
          setIsRenderingPdfInForm(false);
        }
      };
      reader.readAsDataURL(file);
    } else if (isImg) {
      setDocFileType('Image / Scan');
      setIsRenderingPdfInForm(false);

      compressImage(file, 1600, 0.88)
        .then((compressed) => {
          setDocAttachmentDataUrl(compressed);
          setDocPreviewImageDataUrl(compressed);
        })
        .catch(() => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setDocAttachmentDataUrl(dataUrl);
            setDocPreviewImageDataUrl(dataUrl);
          };
          reader.readAsDataURL(file);
        });
    } else {
      setIsRenderingPdfInForm(false);
      if (['step', 'stp', 'iges', 'igs', 'sldprt', 'dwg', 'dxf'].includes(ext || '')) {
        setDocFileType('CAD / STEP');
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDocAttachmentDataUrl(ev.target?.result as string);
        setDocPreviewImageDataUrl(undefined);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDirectAttachFile = async (docId: string, file: File) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;
    if (!activeSession || !activeSession.user) {
      setIsAuthModalOpen(true);
      showNotification('Active owner session required to attach files. Please log in.', 'error');
      return;
    }

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const isImg =
      ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext || '') ||
      file.type.startsWith('image/');
    const sizeStr = formatSize(file.size);

    try {
      showNotification(`Uploading "${file.name}" to Supabase "materials" storage bucket...`);
      // Direct upload strictly to Supabase Storage bucket materials with { contentType: file.type, upsert: true }
      const uploadRes = await uploadMaterialToSupabaseBucket(file, file.name, activeSession.user.id);
      if (!uploadRes?.publicUrl) {
        throw new Error('Supabase Storage: Failed to generate public URL for material');
      }

      const publicUrl = uploadRes.publicUrl;
      let previewImg: string | undefined;

      if (isPdf) {
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((res) => {
            reader.onload = (e) => res(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          const resImg = await renderPdfFirstPageToImage(dataUrl, 900);
          previewImg = resImg || undefined;
        } catch {}
      } else if (isImg) {
        previewImg = publicUrl;
      }

      const updated = documents.map((d) =>
        d.id === docId
          ? {
              ...d,
              fileType: isPdf ? 'PDF / Document' : isImg ? 'Image / Scan' : d.fileType,
              attachmentName: file.name,
              attachmentSize: sizeStr,
              attachmentDataUrl: publicUrl,
              previewImageDataUrl: previewImg || d.previewImageDataUrl,
            }
          : d
      );

      setDocuments(updated);
      await saveStoredDocuments(updated);
      showNotification(`File uploaded to Supabase materials bucket and attached to "${documents.find((d) => d.id === docId)?.title || 'document'}"!`);
    } catch (err: any) {
      console.error('[Direct Attach Error]:', err);
      // Explicit UI error logging - Halt state updates!
      showNotification('Failed to upload file to Supabase: ' + (err?.message || 'Storage error'), 'error');
    }
  };

  const handleUpdateDocPreview = (docId: string, previewUrl: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId && !d.previewImageDataUrl
          ? { ...d, previewImageDataUrl: previewUrl }
          : d
      )
    );
  };

  const handleSaveDocument = async (e: React.FormEvent, uploadAnother = false) => {
    e.preventDefault();
    setDocFormError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;
    if (!activeSession || !activeSession.user) {
      setIsAuthModalOpen(true);
      setDocFormError('Active owner session required to upload/update documents. Please sign in.');
      return;
    }

    const cleanFileName = docSelectedFile ? docSelectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' ') : '';
    const effectiveTitle = docTitle.trim() || cleanFileName || docAttachmentName || 'Uploaded Engineering Document';
    const effectiveIssuer = docIssuer.trim() || 'ASME / Mechanical Engineering';
    const effectiveDescription = docDescription.trim() || `Technical document and engineering record${docAttachmentName ? `: ${docAttachmentName}` : '.'}`;

    const compList = docCompetenciesInput
      .split(/[\n,;•]/)
      .map((c) => c.trim())
      .filter(Boolean);

    let finalAttachmentUrl = docAttachmentDataUrl;
    let finalPreviewUrl = docPreviewImageDataUrl;

    setIsSavingDoc(true);

    // If a new file was selected, upload strictly to Supabase Storage bucket "materials" under auth.uid()
    if (docSelectedFile) {
      try {
        const uploadRes = await uploadMaterialToSupabaseBucket(
          docSelectedFile,
          docSelectedFile.name,
          activeSession.user.id
        );

        if (uploadRes && uploadRes.publicUrl) {
          finalAttachmentUrl = uploadRes.publicUrl;
          if (!finalPreviewUrl && (docSelectedFile.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(docSelectedFile.name))) {
            finalPreviewUrl = uploadRes.publicUrl;
          }
        }
      } catch (err: any) {
        console.warn('[Document Upload Note]:', err);
      }
    }

    try {
      if (editingDocId) {
        // Update existing document
        const updated = documents.map((d) =>
          d.id === editingDocId
            ? {
                ...d,
                title: effectiveTitle,
                issuer: effectiveIssuer,
                credentialId: docCredentialId.trim() || 'VERIFIED-DOC',
                date: docDate.trim() || 'Verified ' + new Date().getFullYear(),
                category: docCategory,
                credentialGroup: docCredentialGroup,
                parentSpecializationId: docCredentialGroup === 'Courses' && docParentSpecializationId ? docParentSpecializationId : undefined,
                fileType: docFileType,
                description: effectiveDescription,
                competencies: compList.length > 0 ? compList : ['Technical competence verified'],
                attachmentName: docAttachmentName || docSelectedFile?.name,
                attachmentDataUrl: finalAttachmentUrl,
                attachmentSize: docAttachmentSize,
                previewImageDataUrl: finalPreviewUrl,
                verifiedLink: docVerifiedLink.trim() || undefined,
              }
            : d
        );
        setDocuments(updated);
        await saveStoredDocuments(updated);
        showNotification(`Document "${effectiveTitle}" updated successfully!`);
        setIsDocumentModalOpen(false);
      } else {
        // Create new document
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}`,
          title: effectiveTitle,
          issuer: effectiveIssuer,
          credentialId: docCredentialId.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
          date: docDate.trim() || 'Verified ' + new Date().getFullYear(),
          category: docCategory,
          credentialGroup: docCredentialGroup,
          parentSpecializationId: docCredentialGroup === 'Courses' && docParentSpecializationId ? docParentSpecializationId : undefined,
          fileType: docFileType,
          description: effectiveDescription,
          competencies: compList.length > 0 ? compList : ['Technical competence verified'],
          attachmentName: docAttachmentName || docSelectedFile?.name,
          attachmentDataUrl: finalAttachmentUrl,
          attachmentSize: docAttachmentSize,
          previewImageDataUrl: finalPreviewUrl,
          verifiedLink: docVerifiedLink.trim() || undefined,
        };

        const updated = [newDoc, ...documents];
        setDocuments(updated);
        await saveStoredDocuments(updated);
        showNotification(`Document "${newDoc.title}" uploaded and saved to Supabase!`);

        if (uploadAnother) {
          setDocSelectedFile(null);
          setEditingDocId(null);
          setDocTitle('');
          setDocIssuer('');
          setDocCredentialId('');
          setDocDate('Verified ' + new Date().getFullYear());
          setDocDescription('');
          setDocCompetenciesInput('');
          setDocVerifiedLink('');
          setDocAttachmentName(undefined);
          setDocAttachmentDataUrl(undefined);
          setDocAttachmentSize(undefined);
          setDocPreviewImageDataUrl(undefined);
        } else {
          setIsDocumentModalOpen(false);
        }
      }
    } catch (saveErr: any) {
      console.error('[Document Save Error]:', saveErr);
      setDocFormError('Failed to save document: ' + (saveErr?.message || 'Error saving'));
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleDeleteDocument = (id: string, title: string) => {
    if (!isOwnerAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    saveStoredDocuments(updated);
    deleteDocumentPersistently(id).catch(() => {});
    fetch(`/api/documents/${id}`, { method: 'DELETE' }).catch(() => {});
    fetch(`/api/profile/documents/${id}`, { method: 'DELETE' }).catch(() => {});
    if (selectedPreviewDoc?.id === id) {
      setSelectedPreviewDoc(null);
    }
    showNotification(`"${title}" deleted immediately.`);
  };

  const isImageAttachment = (doc: DocumentItem) => {
    if (doc.previewImageDataUrl && !isPdfAttachment(doc)) return true;
    if (doc.fileType?.toLowerCase().includes('image')) return true;
    if (doc.attachmentDataUrl?.startsWith('data:image/')) return true;
    if (doc.attachmentName && /\.(png|jpe?g|webp|svg|gif|bmp|heic|heif)$/i.test(doc.attachmentName)) return true;
    return false;
  };

  const isPdfAttachment = (doc: DocumentItem) => {
    if (doc.fileType?.toLowerCase().includes('pdf')) return true;
    if (doc.attachmentDataUrl?.startsWith('data:application/pdf')) return true;
    if (doc.attachmentName && /\.pdf$/i.test(doc.attachmentName)) return true;
    return false;
  };

  const handleDownloadAttachment = (doc: DocumentItem) => {
    try {
      if (doc.attachmentDataUrl) {
        const filename = doc.attachmentName || `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        if (doc.attachmentDataUrl.startsWith('data:')) {
          const parts = doc.attachmentDataUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const byteString = atob(parts[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mime });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const link = document.createElement('a');
          link.href = doc.attachmentDataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        showNotification(`Downloading "${filename}"...`);
      } else {
        // Create document text export
        const content = `DOCUMENT DOSSIER: ${doc.title}\nIssuer: ${doc.issuer}\nCategory: ${doc.category}\nCredential ID: ${doc.credentialId}\nDate: ${doc.date}\n\nDESCRIPTION:\n${doc.description}\n\nKEY COMPETENCIES:\n${doc.competencies.map((c) => `- ${c}`).join('\n')}\n\nCandidate: ${bioData.fullName}\nEmail: ${bioData.email}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const filename = `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}_Dossier.txt`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showNotification(`Downloading "${filename}"...`);
      }
    } catch (err) {
      console.warn('Download notice:', err);
      if (doc.attachmentDataUrl) {
        const link = document.createElement('a');
        link.href = doc.attachmentDataUrl;
        link.download = doc.attachmentName || 'document.png';
        link.target = '_blank';
        link.click();
      }
    }
  };

  const handleCopyAtsResume = () => {
    const emailToUse = bioData.email || 'festusjohnson028@gmail.com';
    const headerToUse = bioData.header || 'Lead Mechanical Design Engineer';
    const text = `
${bioData.fullName.toUpperCase()} — ${headerToUse}
Discipline: ${bioData.discipline}
Email: ${emailToUse} | Country: ${bioData.country}
Badges: ${bioData.badges}

ABOUT ME:
${bioData.description}

DEGREE & HONORS:
- ${bioData.degree}
- ${bioData.academicHonors}

LEADERSHIP:
- ${bioData.leadership}

TECHNICAL SKILLS:
- ${bioData.skills}

VERIFIED DOCUMENTS & CREDENTIALS:
${documents.map((d) => `- ${d.title} (${d.category} / ${d.issuer} / ID: ${d.credentialId} / ${d.date})`).join('\n')}
`.trim();
    navigator.clipboard.writeText(text);
    setCopiedAts(true);
    setTimeout(() => setCopiedAts(false), 2000);
  };

  return (
    <div className="flex-1 w-full space-y-6 sm:space-y-8 py-6 font-serif pb-16">
      {/* Hidden file input for uploading profile picture */}
      <input
        type="file"
        ref={fileInputAvatarRef}
        onChange={handleAvatarFileChange}
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp,.ico,.heic,.heif,.tiff"
        className="hidden"
      />

      {/* GLOBAL NOTIFICATION TOAST */}
      {bioSaveNotice && (
        <div className={`fixed top-16 right-3 sm:right-6 z-50 max-w-xs sm:max-w-sm backdrop-blur-md px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in font-sans text-[11px] sm:text-xs ${
          bioSaveNotice.isError
            ? 'bg-rose-950/95 text-rose-100 border border-rose-500/60'
            : 'bg-slate-950/95 text-slate-100 border border-cyan-500/30'
        }`}>
          {bioSaveNotice.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="flex-1 font-medium break-words">{bioSaveNotice.text}</span>
          <button
            onClick={() => setBioSaveNotice(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-1 transition-colors cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top details after owner login intentionally removed per specification */}

      {isEditingBio && isOwnerAuthenticated && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form
            onSubmit={handleSaveBio}
            className="w-full max-w-full overflow-hidden p-5 sm:p-7 rounded-2xl bg-white border-2 border-cyan-800 shadow-xl space-y-6 font-sans animate-fade-in"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3.5 border-b border-[#cbd5e1] gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 bg-cyan-100 px-2.5 py-0.5 rounded">
                  PROFILE &amp; BIO EDITOR
                </span>
                <h3 className="text-lg sm:text-xl font-serif font-bold text-slate-950 mt-1">
                  Customize Profile &amp; Bio Information
                </h3>
                <p className="text-xs text-slate-600">
                  Update your profile information and about me details. Changes persist to your verified profile.
                </p>
              </div>
            </div>

            {/* SECTION 0: Profile Picture Management */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-800" />
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 font-sans">
                    Profile Picture &amp; Avatar
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded font-semibold">
                  Supabase Storage · avatars bucket
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Live Preview Avatar */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-800/40 bg-slate-900 shrink-0 relative flex items-center justify-center shadow-md">
                  {(optimisticAvatarUrl || editAvatar) ? (
                    <img
                      key={optimisticAvatarUrl || editAvatar}
                      src={optimisticAvatarUrl || withRecordVersion(editAvatar, profileUpdatedAt)}
                      alt="Avatar preview"
                      loading="eager"
                      decoding="sync"
                      className="w-full h-full object-cover object-center"
                      onError={() => {
                        if (optimisticAvatarUrl) setOptimisticAvatarUrl(null);
                        setEditAvatar('');
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <User className="w-8 h-8 text-cyan-400" />
                      <span className="text-[9px] font-sans text-cyan-300 font-medium mt-1">No Picture</span>
                    </div>
                  )}
                </div>

                {/* Picture Controls */}
                <div className="flex-1 w-full space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputAvatarRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white font-sans font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{editAvatar ? 'Upload New Image' : 'Select Image File'}</span>
                    </button>

                    {editAvatar && (
                      <button
                        type="button"
                        onClick={() => setEditAvatar('')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-sans font-semibold text-xs cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value.trim())}
                        placeholder="Or paste direct image URL (https://...)"
                        className="w-full pl-3 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-700"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Accepts all image formats (PNG, JPG, WebP, GIF, SVG, AVIF, BMP, ICO). Uploads are permanently stored in your Supabase <strong>avatars</strong> bucket.
                  </p>
                </div>
              </div>
            </div>

            {/* LIST 1: Profile Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#e2e8f0]">
                <User className="w-4 h-4 text-cyan-800" />
                <h4 className="text-base sm:text-lg font-bold text-slate-900 font-sans">
                  Profile Information
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editBioForm.fullName}
                    onChange={(e) => setEditBioForm({ ...editBioForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-serif"
                    placeholder="Festus, Olorunsogo Johnson"
                  />
                </div>

                {/* 2. Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editBioForm.email}
                    onChange={(e) => setEditBioForm({ ...editBioForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="festusjohnson028@gmail.com"
                  />
                </div>

                {/* 3. Discipline */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Discipline *
                  </label>
                  <input
                    type="text"
                    required
                    value={editBioForm.discipline}
                    onChange={(e) => setEditBioForm({ ...editBioForm, discipline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="Mechanical & Optomechanical Design Engineering"
                  />
                </div>

                {/* 4. Badges */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Badges
                  </label>
                  <input
                    type="text"
                    value={editBioForm.badges}
                    onChange={(e) => setEditBioForm({ ...editBioForm, badges: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="Verified Engineer · CSWP · ASME GDTP Senior · FE EIT"
                  />
                </div>

                {/* 5. Country */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Country *
                  </label>
                  <select
                    value={editBioForm.country}
                    onChange={(e) => setEditBioForm({ ...editBioForm, country: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans cursor-pointer"
                  >
                    {COUNTRIES_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Header */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Header *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editBioForm.header}
                    onChange={(e) => setEditBioForm({ ...editBioForm, header: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans font-medium"
                    placeholder="Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology"
                  />
                </div>
              </div>
            </div>

            {/* LIST 2: About Me */}
            <div className="space-y-4 pt-4 border-t border-[#cbd5e1]">
              <div className="flex items-center gap-2 pb-2 border-b border-[#e2e8f0]">
                <FileText className="w-4 h-4 text-cyan-800" />
                <h4 className="text-base sm:text-lg font-bold text-slate-900 font-sans">
                  About Me &amp; Technical Qualifications
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Degree */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Degree (from standard list or customize) *
                  </label>
                  <select
                    value={
                      ENGINEERING_DEGREES_LIST.includes(editBioForm.degree)
                        ? editBioForm.degree
                        : 'Other Engineering Course / Degree'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'Other Engineering Course / Degree') {
                        setEditBioForm({ ...editBioForm, degree: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans cursor-pointer"
                  >
                    {ENGINEERING_DEGREES_LIST.map((deg) => (
                      <option key={deg} value={deg}>
                        {deg}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editBioForm.degree}
                    onChange={(e) => setEditBioForm({ ...editBioForm, degree: e.target.value })}
                    placeholder="Customize or enter specific engineering degree / university..."
                    className="mt-2 w-full px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-700"
                  />
                </div>

                {/* 2. Academic Accreditation & Honors */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Academic Accreditation &amp; Honors *
                  </label>
                  <input
                    type="text"
                    value={editBioForm.academicHonors}
                    onChange={(e) => setEditBioForm({ ...editBioForm, academicHonors: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="ABET Accredited · Honors (GPA 3.84 / 4.00)"
                  />
                </div>

                {/* 3. Leadership */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Leadership *
                  </label>
                  <textarea
                    rows={2}
                    value={editBioForm.leadership}
                    onChange={(e) => setEditBioForm({ ...editBioForm, leadership: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer"
                  />
                </div>

                {/* 4. Skills Selection (3 Parts: Core Engineering, Handful Skills, IT Skills) */}
                <div className="md:col-span-2 min-w-0">
                  <SkillSelector
                    value={editBioForm.skills}
                    onChange={(newSkills) => setEditBioForm({ ...editBioForm, skills: newSkills })}
                    skillStatuses={editBioForm.skillStatuses || {}}
                    onSkillStatusesChange={(nextStatuses) =>
                      setEditBioForm({ ...editBioForm, skillStatuses: nextStatuses })
                    }
                    certifiedSkills={editBioForm.certifiedSkills || []}
                    label="Skills & Core Competencies (Core Engineering, Handful Skills & IT Skills)"
                    required
                  />
                </div>

                {/* 5. Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    rows={5}
                    value={editBioForm.description}
                    onChange={(e) => setEditBioForm({ ...editBioForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 font-serif text-xs sm:text-sm leading-relaxed"
                    placeholder="Provide your complete biography, engineering philosophy, and high-impact accomplishments..."
                  />
                </div>
              </div>
            </div>

            {/* LIST 3: Follow Me Social & Profile Links */}
            <div className="space-y-4 pt-4 border-t border-[#cbd5e1]">
              <div className="flex items-center gap-2 pb-2 border-b border-[#e2e8f0]">
                <Globe className="w-4 h-4 text-cyan-800" />
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 font-sans">
                    "Follow Me" Social &amp; Profile Links
                  </h4>
                  <p className="text-xs text-slate-500 font-normal">
                    Enter the URLs for each platform. These links are connected to the icons in the "Follow Me" section at the bottom of your profile page.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. LinkedIn */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0077b5]" />
                    <span>LinkedIn Profile URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.linkedinUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, linkedinUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://linkedin.com/in/festus-johnson"
                  />
                </div>

                {/* 2. Facebook */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1877f2]" />
                    <span>Facebook Profile Page URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.facebookUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, facebookUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://facebook.com/festus.johnson"
                  />
                </div>

                {/* 3. Indeed */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2164f3]" />
                    <span>Indeed Profile URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.indeedUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, indeedUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://profile.indeed.com/p/..."
                  />
                </div>

                {/* 4. Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-700" />
                    <span>Email Link / Direct Mail URL</span>
                  </label>
                  <input
                    type="text"
                    value={editBioForm.emailUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, emailUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="mailto:festusjohnson028@gmail.com"
                  />
                </div>

                {/* 5. Twitter / X */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-black" />
                    <span>Twitter / X Profile URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.twitterUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, twitterUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://x.com/festus_mech"
                  />
                </div>

                {/* 6. TikTok */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>TikTok Profile URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.tiktokUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, tiktokUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://tiktok.com/@festus_eng"
                  />
                </div>

                {/* 7. Instagram */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />
                    <span>Instagram Profile URL</span>
                  </label>
                  <input
                    type="url"
                    value={editBioForm.instagramUrl || ''}
                    onChange={(e) => setEditBioForm({ ...editBioForm, instagramUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                    placeholder="https://instagram.com/festus_johnson"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#cbd5e1] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditingBio(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Bio &amp; Profile Updates</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ======================================================== */}
      {/* 1. PROFILE HEADER CARD (CLEAN VISITOR VIEW FIRST)        */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-5 sm:p-6 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs relative">
          
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">
            
            {/* Profile Picture Frame & Controls */}
            <div className="flex flex-col items-center shrink-0 gap-3">
              <div className="relative group">
                <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-full overflow-hidden border-2 border-white/90 shadow-lg bg-slate-900 relative flex items-center justify-center">
                  {(optimisticAvatarUrl || (profileAvatar && !avatarImgError)) ? (
                    <img
                      key={optimisticAvatarUrl || profileAvatar}
                      src={optimisticAvatarUrl || withRecordVersion(profileAvatar, profileUpdatedAt)}
                      alt="Festus, Olorunsogo Johnson - Profile Photo"
                      className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      loading="eager"
                      decoding="sync"
                      onError={() => {
                        if (optimisticAvatarUrl) setOptimisticAvatarUrl(null);
                        setAvatarImgError(true);
                      }}
                    />
                  ) : (
                    <div 
                      onClick={() => {
                        if (isOwnerAuthenticated) {
                          fileInputAvatarRef.current?.click();
                        } else {
                          setIsAuthModalOpen(true);
                        }
                      }}
                      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-850 to-cyan-950 text-slate-300 p-4 text-center cursor-pointer hover:brightness-110 transition-all group"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-2 border-cyan-500/40 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
                        <User className="w-9 h-9 sm:w-11 sm:h-11 text-cyan-400 stroke-[1.5]" />
                      </div>
                      <span className="text-xs sm:text-sm font-sans font-bold text-white leading-tight">
                        Festus, Olorunsogo Johnson
                      </span>
                      <span className="text-[10.5px] font-sans font-medium text-cyan-300 mt-1">
                        {isOwnerAuthenticated ? 'Click to Upload Photo' : 'Lead Mechanical Engineer'}
                      </span>
                    </div>
                  )}

                  {/* Hover overlay to change/delete picture (Owner Gated) */}
                  {isOwnerAuthenticated && (
                    <div className={`absolute inset-0 bg-slate-950/80 ${profileAvatar && !avatarImgError ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity flex flex-col items-center justify-center text-white p-3 text-center gap-2 z-10`}>
                      <button
                        type="button"
                        onClick={() => fileInputAvatarRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-sans font-bold text-xs shadow-md transition-colors cursor-pointer w-full justify-center"
                      >
                        <Camera className="w-3.5 h-3.5 text-cyan-200" />
                        <span>{profileAvatar && !avatarImgError ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>
                      {profileAvatar && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteAvatarModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-sans font-bold text-xs shadow-md transition-colors cursor-pointer w-full justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-100" />
                          <span>Delete Photo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Verified Badge Overlay */}
                <div
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-sans font-bold px-3 py-0.5 rounded-full border border-slate-700 shadow-sm flex items-center gap-1.5 select-none"
                  title="Verified Lead Mechanical Engineer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Engineer</span>
                </div>
              </div>

              {/* Quick Owner Photo Actions */}
              {isOwnerAuthenticated && (
                <div className="flex items-center justify-center gap-2 pt-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => fileInputAvatarRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-800 hover:bg-slate-50 text-xs font-sans font-bold shadow-2xs cursor-pointer transition-colors"
                    title="Upload / Change Profile Picture"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-800" />
                    <span>{profileAvatar && !avatarImgError ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                  {profileAvatar && !avatarImgError && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteAvatarModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-sans font-semibold shadow-2xs cursor-pointer transition-colors"
                      title="Permanently Delete Profile Picture"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Profile Identity & Direct Action */}
            <div className="flex-1 text-center lg:text-left space-y-3">
              {/* Badges List */}
              {bioData.badges && (
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5">
                  {bioData.badges
                    .split(/[·,|]/)
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((badge, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-[11px] font-sans font-bold text-cyan-900"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-700" />
                        <span>{badge}</span>
                      </span>
                    ))}
                </div>
              )}

              <div className="flex flex-col lg:flex-row items-center lg:items-baseline justify-between gap-1.5">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-950 font-serif leading-tight">
                  {bioData.fullName}
                </h1>
                {isOwnerAuthenticated && (
                  <button
                    onClick={handleOpenEditBio}
                    className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-cyan-900 hover:underline hover:text-cyan-950 p-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Profile &amp; Bio</span>
                  </button>
                )}
              </div>

              <p className="text-xs sm:text-sm font-sans font-medium text-cyan-900 leading-snug">
                {bioData.header}
              </p>

              {/* Modernized Meta Tags: Discipline, Country, Email */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-0.5 font-sans text-xs">
                {bioData.discipline && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-300 text-slate-800 font-medium text-[11px] shadow-2xs">
                    <Briefcase className="w-3 h-3 text-cyan-800 shrink-0" />
                    <span className="truncate">{bioData.discipline}</span>
                  </span>
                )}
                {bioData.country && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-300 text-slate-700 font-medium text-[11px] shadow-2xs">
                    <Globe className="w-3 h-3 text-cyan-800 shrink-0" />
                    <span>{bioData.country}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-300 text-slate-700 font-medium text-[11px] shadow-2xs">
                  <Mail className="w-3 h-3 text-cyan-800 shrink-0" />
                  <span>{bioData.email}</span>
                </span>
              </div>

              {/* Modernized & Reduced Action Buttons Cluster */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                {/* Primary Button */}
                <button
                  onClick={handleDirectDownloadResume}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer group"
                  title="Download dynamic, ATS-standard PDF resume in 1 click"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-200 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download Resume</span>
                  {localDownloadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono text-cyan-100 font-bold tabular-nums">
                      {localDownloadCount}
                    </span>
                  )}
                </button>

                {/* Converted completely from "Copy ATS Plaintext" to "ATS Preview" */}
                <button
                  type="button"
                  onClick={() => setIsAtsPreviewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                  title="Display full ATS Resume Preview with all credentials and downloadable PDF"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-800" />
                  <span>ATS Preview</span>
                </button>

                <a
                  href={`mailto:${bioData.email}?subject=Mechanical%20Engineering%20Opportunity%20%E2%80%94%20Technical%20Interview`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Send Direct Email</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. BIO & ABOUT SECTION                                   */}
      {/* ======================================================== */}
      {getBuiltInSection('bio', 'Bio & About').visible && (
        <section id="profile-bio" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
            <div className="border-b border-[#cbd5e1] pb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center flex-1">
                {getBuiltInSection('bio', 'Bio & About').label || 'Bio & About'} — {bioData.fullName}
              </h2>
              {isOwnerAuthenticated && (
                <button
                  onClick={handleOpenEditBio}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-serif font-semibold border border-[#cbd5e1] shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3 h-3 text-cyan-800" />
                  <span>Edit Bio</span>
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-800 leading-relaxed font-serif whitespace-pre-line text-justify">
              <p className="text-justify leading-relaxed">{bioData.description}</p>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2B. EXPERIENCE & CAREER SECTION                          */}
      {/* ======================================================== */}
      {getBuiltInSection('experience', 'Experience & Career').visible && (
        <section id="profile-experience" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
            <div className="border-b border-[#cbd5e1] pb-2.5 text-center">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center">
                {getBuiltInSection('experience', 'Experience & Career').label || 'Experience & Career'}
              </h2>
            </div>

            {experiences.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-600 space-y-1">
                {bioData.leadership && (
                  <p className="font-semibold text-slate-800">{bioData.leadership}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  Career history entries added from the Admin Dashboard appear here and in the Resume PDF.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {experiences.map((exp) => (
                  <div key={exp.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                    <h3 className="font-bold text-slate-950 text-center">{exp.roleTitle}</h3>
                    <div className="text-[11px] text-cyan-900 font-semibold text-center">
                      {exp.organization} {exp.location ? `· ${exp.location}` : ''}
                    </div>
                    {(exp.startDate || exp.endDate || exp.isCurrent) && (
                      <div className="text-[10px] text-slate-500 text-center">
                        {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                      </div>
                    )}
                    {exp.summary && <p className="text-[11px] text-slate-700 leading-relaxed text-justify">{exp.summary}</p>}
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
                        {exp.highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2C. RESEARCH & PUBLICATIONS SECTION                      */}
      {/* ======================================================== */}
      {getBuiltInSection('publications', 'Research & Publications').visible && (
        <section id="profile-publications" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
            <div className="border-b border-[#cbd5e1] pb-2.5 text-center">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center">
                {getBuiltInSection('publications', 'Research & Publications').label || 'Research & Publications'}
              </h2>
            </div>

            {publications.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  {bioData.degree} {bioData.academicHonors ? `· ${bioData.academicHonors}` : ''}
                </p>
                <p className="text-[11px] text-slate-500">
                  Research papers and technical publications managed in the Admin Dashboard appear here and in the Resume PDF.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publications.map((pub) => (
                  <div key={pub.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                    <h3 className="font-bold text-slate-950 text-center">{pub.title}</h3>
                    <div className="text-[11px] text-cyan-900 text-center">
                      {pub.venueOrJournal} {pub.year ? `(${pub.year})` : ''}
                    </div>
                    {pub.authors && <div className="text-[10px] text-slate-600 text-center">{pub.authors}</div>}
                    {pub.abstract && <p className="text-[11px] text-slate-700 leading-relaxed text-justify">{pub.abstract}</p>}
                    <div className="flex items-center justify-center gap-3 pt-1 text-[10px]">
                      {pub.doiOrUrl && (
                        <a href={pub.doiOrUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-800 hover:underline font-semibold">
                          View Publication
                        </a>
                      )}
                      {pub.attachmentUrl && (
                        <a href={pub.attachmentUrl} target="_blank" rel="noopener noreferrer" download className="text-cyan-800 hover:underline font-semibold">
                          Download Paper
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2D. ACHIEVEMENTS, AWARDS & ALL SKILLS SECTION (3 PARTS)  */}
      {/* ======================================================== */}
      {getBuiltInSection('achievements', 'Achievements, Awards & Skills').visible && (
        <section id="profile-achievements" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-4">
            <div className="border-b border-[#cbd5e1] pb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center flex-1">
                {getBuiltInSection('achievements', 'Achievements, Awards & Skills').label || 'Achievements, Awards & Skills'}
              </h2>
              {isOwnerAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsEditingSkillsPanel(!isEditingSkillsPanel)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-serif font-semibold border border-[#cbd5e1] cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3 h-3 text-cyan-800" />
                  <span>{isEditingSkillsPanel ? 'Close Skills Editor' : 'Manage Skills'}</span>
                </button>
              )}
            </div>

            {/* Academic & Leadership Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Academic Standing</span>
                <div className="font-bold text-slate-950">{bioData.degree}</div>
                {bioData.academicHonors && <div className="text-[11px] text-cyan-900">{bioData.academicHonors}</div>}
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Leadership &amp; Appointments</span>
                <div className="text-[11px] text-slate-800">{bioData.leadership}</div>
              </div>
            </div>

            {/* Achievements List */}
            {achievements.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.map((ach) => (
                  <div key={ach.id} className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="font-bold text-cyan-900">{ach.category}</span>
                      <span className={`font-semibold ${ach.verified ? 'text-emerald-800' : 'text-amber-700'}`}>
                        {ach.verified ? 'Verified Certificate' : 'In Progress'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-950 text-center">{ach.title}</h3>
                    <div className="text-[10px] text-slate-500 text-center">
                      {ach.issuer} {ach.dateStr ? `· ${ach.dateStr}` : ''}
                    </div>
                    {ach.description && <p className="text-[11px] text-slate-700 text-justify">{ach.description}</p>}
                    {ach.certificateUrl && (
                      <div className="text-center pt-1">
                        <a href={ach.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-800 hover:underline font-semibold">
                          View Certificate
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Owner Inline Skills & 4-Status Editor */}
            {isOwnerAuthenticated && isEditingSkillsPanel && (
              <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-white border border-cyan-700 space-y-3 text-xs">
                <SkillSelector
                  value={skillsDraft}
                  onChange={setSkillsDraft}
                  skillStatuses={skillStatusesDraft}
                  onSkillStatusesChange={setSkillStatusesDraft}
                  certifiedSkills={certifiedSkillsDraft}
                  label="Edit Portfolio Skills (Core Engineering, Handful Skills & IT Skills)"
                />
                <div className="space-y-1.5">
                  <span className="block font-bold text-slate-700 text-[11px]">
                    Set Status Per Skill (in progress / verified / licensed / completed):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {skillsDraft
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((skill) => {
                        const st = resolveSkillStatus(skill, skillStatusesDraft, certifiedSkillsDraft);
                        return (
                          <div
                            key={skill}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-300 text-[11px] min-w-0"
                          >
                            <span className="truncate font-semibold text-slate-800">{skill}</span>
                            <select
                              value={st}
                              onChange={(e) => {
                                const val = e.target.value as SkillStatus;
                                setSkillStatusesDraft((prev) => ({ ...prev, [skill]: val }));
                              }}
                              className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] font-semibold cursor-pointer shrink-0"
                            >
                              {SKILL_STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {formatSkillStatusLabel(opt)}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingSkillsPanel(false)}
                    className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await syncSaveBio({
                        ...bioData,
                        skills: skillsDraft,
                        skillStatuses: skillStatusesDraft,
                        certifiedSkills: certifiedSkillsDraft,
                      });
                      setIsEditingSkillsPanel(false);
                      showNotification('Skills and credential statuses saved.');
                    }}
                    className="px-3 py-1 rounded bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Skills
                  </button>
                </div>
              </div>
            )}

            {/* All Skills Matrix (3 Parts: Core Engineering Skills, Handful Skills, IT Skills) */}
            {bioData.skills && (
              <div className="space-y-2.5 pt-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-950 text-center">
                  Skills Matrix (Core Engineering Skills · Handful Skills · IT Skills)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(() => {
                    const categorized = categorizeSkills(bioData.skills);
                    const categories: SkillCategoryName[] = [
                      'Core Engineering Skills',
                      'Handful Skills',
                      'IT Skills',
                    ];
                    const statusBadgeColor: Record<SkillStatus, string> = {
                      'in progress': 'bg-amber-50 text-amber-800 border-amber-200',
                      verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      licensed: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                      completed: 'bg-cyan-50 text-cyan-800 border-cyan-200',
                    };
                    return categories.map((cat) => (
                      <div key={cat} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                        <h4 className="font-bold text-slate-950 text-center border-b border-slate-100 pb-1">
                          {cat}
                        </h4>
                        {categorized[cat].length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center italic py-2">
                            No {cat.toLowerCase()} added yet.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {categorized[cat].map((skill, idx) => {
                              const status = resolveSkillStatus(
                                skill,
                                bioData.skillStatuses,
                                bioData.certifiedSkills
                              );
                              return (
                                <div
                                  key={`${skill}-${idx}`}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[11px]"
                                >
                                  <span className="font-semibold text-slate-800 truncate">{skill}</span>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded border text-[9.5px] font-bold ${statusBadgeColor[status]}`}
                                  >
                                    {formatSkillStatusLabel(status)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. VERIFIED CREDENTIALS (SPECIALIZATION & COURSES)       */}
      {/* ======================================================== */}
      {getBuiltInSection('credentials', 'Verified Documents & Credentials').visible && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-4 w-full overflow-hidden">
          <div className="border-b border-[#cbd5e1] pb-3 flex flex-col items-center justify-center text-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center">
              {getBuiltInSection('credentials', 'Verified Documents & Credentials').label || 'Verified Documents & Credentials'}
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(['All', 'Specialization', 'Courses'] as const).map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    setCredentialFilterGroup(grp);
                    setSelectedSpecializationId(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                    credentialFilterGroup === grp
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {grp}
                </button>
              ))}

              {isOwnerAuthenticated && (
                <button
                  type="button"
                  onClick={handleOpenAddDocument}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="p-6 rounded-xl bg-white border border-dashed border-[#b8c6d4] text-center space-y-2.5">
              <p className="text-xs text-slate-600 text-center">No documents or credentials uploaded yet.</p>
              {isOwnerAuthenticated && (
                <button
                  type="button"
                  onClick={handleOpenAddDocument}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-semibold text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>
          ) : (() => {
            const specDocs = documents.filter((d) => d.credentialGroup === 'Specialization');
            const courseDocs = documents.filter((d) => d.credentialGroup === 'Courses');
            const otherDocs = documents.filter(
              (d) => !d.credentialGroup || d.credentialGroup === 'Document'
            );

            const renderDocCard = (doc: DocumentItem, isCompactSub = false) => (
              <div
                key={doc.id}
                className={`rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between ${
                  isCompactSub ? 'border-cyan-200/80' : ''
                }`}
              >
                <DocumentTopMedia
                  doc={doc}
                  isOwnerAuthenticated={isOwnerAuthenticated}
                  onOpenPreview={(d) => setSelectedPreviewDoc(d)}
                  onDownloadAttachment={handleDownloadAttachment}
                  onRequireAuth={() => setIsAuthModalOpen(true)}
                  onUpdatePreviewUrl={handleUpdateDocPreview}
                  onDirectAttachFile={handleDirectAttachFile}
                />
                <div className="p-3 space-y-1.5 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
                      <span className="font-bold text-cyan-900">
                        {doc.credentialGroup || doc.category}
                      </span>
                      {doc.date && <span>{doc.date}</span>}
                    </div>
                    <h3 className="text-xs font-bold text-slate-950 text-center">{doc.title}</h3>
                    <div className="text-[10.5px] text-slate-600 text-center">{doc.issuer}</div>
                    <p className="text-[11px] text-slate-700 leading-relaxed text-justify">
                      {doc.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(doc)}
                        className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-semibold cursor-pointer"
                      >
                        Preview
                      </button>
                      {isOwnerAuthenticated && doc.attachmentDataUrl && (
                        <a
                          href={doc.attachmentDataUrl}
                          download={doc.attachmentName || doc.title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-cyan-900 text-white font-semibold"
                        >
                          Download
                        </a>
                      )}
                      {doc.verifiedLink && (
                        <a
                          href={doc.verifiedLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-800 hover:underline font-semibold"
                        >
                          Verify
                        </a>
                      )}
                    </div>
                    {isOwnerAuthenticated && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDocument(doc)}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocToDelete({ id: doc.id, title: doc.title })}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div className="space-y-4">
                {/* SPECIALIZATION CERTIFICATES + LINKED SUB-COURSES */}
                {(credentialFilterGroup === 'All' || credentialFilterGroup === 'Specialization') &&
                  specDocs.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-950 text-center">
                        Specialization Certificates
                      </h3>
                      <div className="space-y-3">
                        {specDocs.map((spec) => {
                          const linkedCourses = courseDocs.filter(
                            (c) => c.parentSpecializationId === spec.id
                          );
                          const isExpanded = selectedSpecializationId === spec.id;
                          return (
                            <div
                              key={spec.id}
                              className="p-3 rounded-xl bg-white border border-[#b8c6d4] space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSpecializationId(isExpanded ? null : spec.id)
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 hover:text-cyan-900 cursor-pointer text-left"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-cyan-800 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-cyan-800 shrink-0" />
                                  )}
                                  <span>{spec.title}</span>
                                  <span className="text-[10px] font-normal text-slate-500">
                                    ({linkedCourses.length} Course{linkedCourses.length === 1 ? '' : 's'})
                                  </span>
                                </button>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSpecializationId(isExpanded ? null : spec.id)
                                    }
                                    className="px-2 py-0.5 rounded bg-[#edf2f8] border border-[#b8c6d4] text-[10px] font-semibold text-slate-800 cursor-pointer"
                                  >
                                    {isExpanded ? 'Hide Details' : 'View Certificate & Courses'}
                                  </button>
                                  {isOwnerAuthenticated && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddCourseForSpecialization(spec.id)}
                                      className="px-2 py-0.5 rounded bg-cyan-900 text-white text-[10px] font-semibold cursor-pointer"
                                    >
                                      + Add Course
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="space-y-3 pt-2 border-t border-slate-200">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderDocCard(spec)}
                                  </div>
                                  {linkedCourses.length > 0 && (
                                    <div className="space-y-2 pl-2 sm:pl-4 border-t border-slate-100 pt-2">
                                      <h4 className="text-xs font-bold text-slate-900 text-center">
                                        Courses Under This Specialization ({linkedCourses.length})
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {linkedCourses.map((course) => renderDocCard(course, true))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* COURSES CERTIFICATES */}
                {(credentialFilterGroup === 'All' || credentialFilterGroup === 'Courses') &&
                  courseDocs.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-950 text-center">
                        Course Certificates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {courseDocs.map((c) => renderDocCard(c))}
                      </div>
                    </div>
                  )}

                {/* STANDALONE OTHER DOCUMENTS */}
                {credentialFilterGroup === 'All' && otherDocs.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-950 text-center">
                      Additional Technical Documents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {otherDocs.map((d) => renderDocCard(d))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* 4. CUSTOM PROFILE SECTIONS (ADMIN PROFILE SECTION MANAGER)*/}
      {/* ======================================================== */}
      {profileSectionManager.customSections
        .filter((sec) => sec.visible !== false)
        .map((sec: CustomProfileSection) => (
          <section key={sec.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-serif">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
              <div className="border-b border-[#cbd5e1] pb-2 text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center">
                  {sec.title}
                </h2>
                {sec.subtitle && (
                  <p className="text-[11px] text-cyan-900 font-semibold text-center">{sec.subtitle}</p>
                )}
              </div>

              {sec.template === 'rich-essay' && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed text-justify whitespace-pre-line">
                  {sec.body}
                </div>
              )}

              {sec.template === 'two-col-cards' && (
                <div className="space-y-2.5">
                  {sec.body && <p className="text-xs text-slate-700 text-center">{sec.body}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(sec.items || []).map((it, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                        <h3 className="font-bold text-slate-950 text-center">{it.heading}</h3>
                        {it.subheading && <p className="text-[10.5px] text-cyan-900 font-semibold text-center">{it.subheading}</p>}
                        <p className="text-[11px] text-slate-700 leading-relaxed text-justify">{it.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sec.template === 'timeline' && (
                <div className="space-y-2.5">
                  {sec.body && <p className="text-xs text-slate-700 text-center">{sec.body}</p>}
                  <div className="space-y-2 border-l-2 border-cyan-800 pl-3 ml-2">
                    {(sec.items || []).map((it, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-950">{it.heading}</h3>
                          {it.subheading && (
                            <span className="text-[10px] font-bold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                              {it.subheading}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-700 text-justify">{it.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sec.template === 'metrics-grid' && (
                <div className="space-y-2.5">
                  {sec.body && <p className="text-xs text-slate-700 text-center">{sec.body}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-center">
                    {(sec.items || []).map((it, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <div className="text-base font-bold text-cyan-900">{it.heading}</div>
                        {it.subheading && <div className="text-[10px] font-bold text-slate-500 uppercase">{it.subheading}</div>}
                        <p className="text-[11px] text-slate-700">{it.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sec.template === 'media-showcase' && (
                <div className="space-y-3">
                  {sec.mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white flex justify-center">
                      <img src={sec.mediaUrl} alt={sec.title} className="max-h-64 object-contain" />
                    </div>
                  )}
                  {sec.body && <p className="text-xs text-slate-800 text-justify">{sec.body}</p>}
                  {(sec.items || []).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sec.items.map((it, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                          {it.mediaUrl && (
                            <img src={it.mediaUrl} alt={it.heading} className="w-full h-36 object-cover rounded border border-slate-100" />
                          )}
                          <h3 className="font-bold text-slate-950 text-center">{it.heading}</h3>
                          {it.subheading && <p className="text-[10px] text-cyan-900 text-center">{it.subheading}</p>}
                          <p className="text-[11px] text-slate-700 text-justify">{it.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ))}

      {/* ======================================================== */}
      {/* 5. FOLLOW ME                                             */}
      {/* ======================================================== */}
      {getBuiltInSection('followMe', 'Follow Me').visible && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs text-center space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-950 font-serif tracking-tight">
              {getBuiltInSection('followMe', 'Follow Me').label || 'Follow Me'}
            </h2>
          </div>

          {/* Social Icons Only: LinkedIn, Facebook, Indeed, Email, Twitter/X, TikTok, Instagram */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 pt-0.5">
            {/* 1. LinkedIn */}
            <a
              href={bioData.linkedinUrl || 'https://linkedin.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-[#0077b5] text-slate-700 hover:text-white hover:bg-[#0077b5] shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="LinkedIn"
              aria-label="LinkedIn"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.97 0 1.75-.79 1.75-1.76s-.78-1.75-1.75-1.75c-.97 0-1.76.78-1.76 1.75s.79 1.76 1.76 1.76m1.4 9.74v-8.37H5.06v8.37h2.8z" />
              </svg>
            </a>

            {/* 2. Facebook */}
            <a
              href={bioData.facebookUrl || 'https://facebook.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-[#1877f2] text-slate-700 hover:text-white hover:bg-[#1877f2] shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Facebook"
              aria-label="Facebook"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
              </svg>
            </a>

            {/* 3. Indeed */}
            <a
              href={bioData.indeedUrl || 'https://indeed.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-[#2164f3] text-slate-700 hover:text-white hover:bg-[#2164f3] shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Indeed"
              aria-label="Indeed"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M11.566 21.978h-3.79V9.852h3.79v12.126zm-1.895-13.88c-1.282 0-2.322-1.04-2.322-2.322 0-1.283 1.04-2.323 2.322-2.323 1.283 0 2.323 1.04 2.323 2.323 0 1.282-1.04 2.322-2.323 2.322zm10.539 7.794c0-3.41-1.748-5.992-4.996-5.992-2.28 0-3.64 1.233-4.22 2.352v-2.4h-3.79v12.126h3.79v-6.382c0-1.77 1.298-2.95 2.91-2.95 1.583 0 2.516 1.096 2.516 2.895v6.437h3.79V15.892z" />
              </svg>
            </a>

            {/* 4. Email */}
            <a
              href={bioData.emailUrl || `mailto:${bioData.email || 'festusjohnson028@gmail.com'}`}
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-cyan-800 text-slate-700 hover:text-white hover:bg-cyan-800 shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title={`Email: ${bioData.email || 'festusjohnson028@gmail.com'}`}
              aria-label="Email"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2 stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </a>

            {/* 5. Twitter / X */}
            <a
              href={bioData.twitterUrl || 'https://x.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-black text-slate-700 hover:text-white hover:bg-black shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Twitter / X"
              aria-label="Twitter / X"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* 6. TikTok */}
            <a
              href={bioData.tiktokUrl || 'https://tiktok.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-black text-slate-700 hover:text-white hover:bg-black shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="TikTok"
              aria-label="TikTok"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43c.09-.09.18-.18.26-.27a6.29 6.29 0 0 0 1.69-4.15V8.62a8.27 8.27 0 0 0 4.78 1.52V6.69z" />
              </svg>
            </a>

            {/* 7. Instagram */}
            <a
              href={bioData.instagramUrl || 'https://instagram.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white border border-[#b8c6d4] hover:border-[#e1306c] text-slate-700 hover:text-white hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Instagram"
              aria-label="Instagram"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2 stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* MODAL: FULL ATS RESUME PREVIEW & DOWNLOAD                */}
      {/* ======================================================== */}
      <ResumeDownloadModal
        isOpen={isAtsPreviewModalOpen}
        onClose={() => setIsAtsPreviewModalOpen(false)}
        onDownloaded={handleDirectDownloadResume}
      />

      {/* ======================================================== */}
      {/* MODAL: LIGHTBOX FULL PREVIEW OF DOCUMENT IMAGE           */}
      {/* ======================================================== */}
      {selectedPreviewDoc && (
        <div 
          onClick={() => setSelectedPreviewDoc(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl p-4 flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <div>
                <span className="text-xs text-cyan-400 font-bold block">Type: {selectedPreviewDoc.category}</span>
                <h3 className="text-base sm:text-lg font-bold font-serif">{selectedPreviewDoc.title}</h3>
              </div>
              <button
                onClick={() => setSelectedPreviewDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[75vh] flex items-center justify-center py-4 overflow-auto">
              {selectedPreviewDoc.previewImageDataUrl || selectedPreviewDoc.attachmentDataUrl ? (
                isPdfAttachment(selectedPreviewDoc) ? (
                  <div className="w-full flex flex-col items-center gap-3">
                    {selectedPreviewDoc.previewImageDataUrl ? (
                      <div className="max-h-[68vh] max-w-full overflow-auto rounded-lg shadow-2xl bg-white border border-slate-700 p-2">
                        <img
                          src={selectedPreviewDoc.previewImageDataUrl}
                          alt={selectedPreviewDoc.title}
                          loading="lazy"
                          decoding="async"
                          className="max-h-[64vh] max-w-full object-contain mx-auto"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={`${selectedPreviewDoc.attachmentDataUrl}#toolbar=1`}
                        title={selectedPreviewDoc.title}
                        className="w-full h-[70vh] rounded-xl border border-slate-700 bg-white"
                      />
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      PDF Document · {selectedPreviewDoc.attachmentName || selectedPreviewDoc.title}
                    </span>
                  </div>
                ) : (
                  <img
                    src={selectedPreviewDoc.previewImageDataUrl || selectedPreviewDoc.attachmentDataUrl}
                    alt={selectedPreviewDoc.title}
                    loading="lazy"
                    decoding="async"
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-md"
                  />
                )
              ) : (
                <div className="p-8 text-slate-400 text-sm">No preview available for this document.</div>
              )}
            </div>

            <div className="w-full pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span>{selectedPreviewDoc.issuer} · {selectedPreviewDoc.date}</span>
              {selectedPreviewDoc.attachmentDataUrl ? (
                <a
                  href={selectedPreviewDoc.attachmentDataUrl}
                  download={selectedPreviewDoc.attachmentName || selectedPreviewDoc.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(selectedPreviewDoc)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / UPLOAD DOCUMENT ONE AFTER ANOTHER           */}
      {/* ======================================================== */}
      {isDocumentModalOpen && isOwnerAuthenticated && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#cbd5e1] overflow-hidden my-8 animate-fade-in">
            
            {/* Header */}
            <div className="p-6 bg-[#edf2f8] border-b border-[#cbd5e1] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center shrink-0">
                  <FileUp className="w-5 h-5 text-cyan-800" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold font-serif text-slate-950">
                    Upload Document
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setIsDocumentModalOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={(e) => handleSaveDocument(e, false)} className="w-full max-w-full overflow-x-hidden p-5 sm:p-7 space-y-4 max-h-[75vh] overflow-y-auto">
              {docFormError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{docFormError}</span>
                </div>
              )}

              {/* 1. DOCUMENT (Upload PDF or Image) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase mb-1 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Document *</span>
                </label>
                <input
                  type="file"
                  ref={docAttachmentInputRef}
                  onChange={handleDocumentAttachmentChange}
                  accept="image/*,.pdf,.step,.stp,.iges,.zip"
                  className="hidden"
                />

                {docAttachmentDataUrl && isImageAttachment({ attachmentDataUrl: docAttachmentDataUrl, attachmentName: docAttachmentName } as any) ? (
                  <div className="p-3 rounded-2xl border-2 border-cyan-700 bg-cyan-50/40 flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 flex items-center justify-center">
                      <img
                        src={docAttachmentDataUrl}
                        alt="Document Preview"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded inline-block">
                        Image Attached
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {docAttachmentName || 'Document_Image.png'}
                      </p>
                      {docAttachmentSize && (
                        <p className="text-[11px] text-slate-500 font-mono">Size: {docAttachmentSize}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => docAttachmentInputRef.current?.click()}
                        className="text-xs text-cyan-800 hover:underline font-semibold block pt-1"
                      >
                        Change Document File
                      </button>
                    </div>
                  </div>
                ) : (docAttachmentDataUrl || docPreviewImageDataUrl) && isPdfAttachment({ attachmentDataUrl: docAttachmentDataUrl, attachmentName: docAttachmentName, fileType: docFileType } as any) ? (
                  <div className="p-3.5 rounded-2xl border-2 border-rose-700 bg-rose-50/50 flex flex-col sm:flex-row items-center gap-3">
                    {docPreviewImageDataUrl ? (
                      <div className="w-18 h-22 sm:w-20 sm:h-24 rounded-lg overflow-hidden bg-white border border-rose-300 shadow-sm shrink-0 flex items-center justify-center p-1">
                        <img
                          src={docPreviewImageDataUrl}
                          alt="PDF First Page"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-rose-900 border border-rose-700 flex flex-col items-center justify-center text-rose-200 shrink-0">
                        {isRenderingPdfInForm ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : (
                          <FileCode className="w-7 h-7 text-rose-300" />
                        )}
                        <span className="text-[9px] font-mono font-bold mt-1">PDF</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                      <span className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded inline-block">
                        PDF Document Attached
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {docAttachmentName || 'Document.pdf'}
                      </p>
                      {docAttachmentSize && (
                        <p className="text-[11px] text-slate-500 font-mono">Size: {docAttachmentSize}</p>
                      )}
                      {isRenderingPdfInForm && (
                        <p className="text-[11px] text-rose-600 font-medium animate-pulse">Rendering first page preview...</p>
                      )}
                      <button
                        type="button"
                        onClick={() => docAttachmentInputRef.current?.click()}
                        className="text-xs text-cyan-800 hover:underline font-semibold block pt-1"
                      >
                        Change Document File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => docAttachmentInputRef.current?.click()}
                    className="p-5 border-2 border-dashed border-cyan-800/40 hover:border-cyan-800 rounded-2xl bg-[#f8fafc] hover:bg-cyan-50/50 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      {docAttachmentName ? (
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">
                          Attached: {docAttachmentName} {docAttachmentSize && `(${docAttachmentSize})`}
                        </p>
                      ) : (
                        <>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            Click to select document file or image
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Supports PDF files (.pdf) or image files (PNG, JPG, WebP)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. FILE TYPE & TYPE OF DOCUMENT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    File type *
                  </label>
                  <select
                    value={docFileType}
                    onChange={(e) => setDocFileType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <option value="PDF / Document">PDF / Document (.pdf)</option>
                    <option value="Image / Scan">Image / Scan (.png, .jpg, .webp)</option>
                    <option value="CAD / STEP">CAD / STEP (.step, .sldprt, .dwg)</option>
                    <option value="Other Attachment">Other Attachment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Type of Document *
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentItem['category'])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <option value="Certification">Certification</option>
                    <option value="Technical Report">Technical Report</option>
                    <option value="CAD Specification">CAD Specification</option>
                    <option value="Technical Drawing">Technical Drawing</option>
                    <option value="Engineering License">Engineering License</option>
                    <option value="Accreditation">Accreditation</option>
                    <option value="Patent">Patent</option>
                    <option value="Other Document">Other Document</option>
                  </select>
                </div>
              </div>

              {/* 2B. CREDENTIAL GROUP (SPECIALIZATION vs COURSES) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Credential Group *
                  </label>
                  <select
                    value={docCredentialGroup}
                    onChange={(e) => {
                      const val = e.target.value as 'Specialization' | 'Courses' | 'Document';
                      setDocCredentialGroup(val);
                      if (val !== 'Courses') setDocParentSpecializationId('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <option value="Specialization">Specialization</option>
                    <option value="Courses">Courses</option>
                    <option value="Document">Document</option>
                  </select>
                </div>

                {docCredentialGroup === 'Courses' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Link Under Specialization (Optional)
                    </label>
                    <select
                      value={docParentSpecializationId}
                      onChange={(e) => setDocParentSpecializationId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      <option value="">Standalone Course Certificate</option>
                      {documents
                        .filter((d) => d.credentialGroup === 'Specialization' && d.id !== editingDocId)
                        .map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 3. DOCUMENT TITLE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Certified SolidWorks Professional"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-semibold"
                />
              </div>

              {/* 4. ISSUER / AUTHORITY & DATE / STANDARD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Issuer/Authority *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ASME / Dassault Systèmes"
                    value={docIssuer}
                    onChange={(e) => setDocIssuer(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date/Standard
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified Active / 2026"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* 5. DESCRIPTION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain what this document validates, mechanism principles, standards applied, or engineering achievements..."
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-serif leading-relaxed"
                />
              </div>

              {/* 6. KEY COMPETENCIES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Key competencies (Optional, one per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Advanced parametric modeling&#10;GD&T True Position under MMC&#10;5-Axis CNC Toolpath Programming"
                  value={docCompetenciesInput}
                  onChange={(e) => setDocCompetenciesInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs font-sans leading-relaxed"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#cbd5e1] flex items-center justify-between">
                {editingDocId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const id = editingDocId;
                      const title = docTitle;
                      setIsDocumentModalOpen(false);
                      handleDeleteDocument(id, title);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Document</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="submit"
                  disabled={isSavingDoc}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-800 hover:bg-cyan-900 text-white text-xs sm:text-sm font-bold shadow-md transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSavingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Document...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingDocId ? 'Update Document' : 'Save Document'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SUPABASE OWNER ADMIN LOGIN MODAL                       */}
      {/* ======================================================== */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full border-2 border-cyan-800 shadow-2xl overflow-hidden my-6">
            {/* Header */}
            <div className="px-5 py-4 bg-[#0f172a] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif text-white leading-tight">
                    Supabase Owner Authentication
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Sign in with your Supabase credentials (signInWithPassword)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError(null);
                  setAuthPin('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleOwnerLogin} className="p-5 sm:p-6 space-y-4">
              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Owner Email Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setAuthEmail(OWNER_EMAIL)}
                    className="text-[10px] text-cyan-800 hover:text-cyan-950 font-semibold underline cursor-pointer"
                  >
                    Use Owner Email
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. festusjohnson028@gmail.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-sans"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Password / Master Secret
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    {showPassword ? 'Hide Password' : 'Show Password'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                    placeholder="Enter owner password"
                    className="w-full pl-9 pr-10 py-2 rounded-xl border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-xs sm:text-sm font-mono tracking-wider"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRlsModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-800 font-medium cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>View RLS Policy SQL</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthModalOpen(false);
                      setAuthError(null);
                      setAuthPin('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-cyan-800 hover:bg-cyan-900 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-cyan-200" />
                        <span>Sign in</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. SUPABASE RLS & SCHEMA SQL POLICIES MODAL               */}
      {/* ======================================================== */}
      {showRlsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in font-sans">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-700 shadow-2xl overflow-hidden my-6 text-white flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-serif">
                    Supabase Row Level Security (RLS) &amp; Storage Policies
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Production SQL schema for avatars bucket, materials bucket, and owner profiles.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRlsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950/60 font-mono text-xs text-slate-300">
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {SUPABASE_RLS_SCHEMA_SQL}
              </pre>
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Execute in your Supabase SQL Editor if provisioning a fresh Supabase project.
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_RLS_SCHEMA_SQL);
                  showNotification('Supabase RLS Schema copied to clipboard!');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6b. SUPABASE DATABASE & STORAGE SETTINGS MODAL           */}
      {/* ======================================================== */}
      <SupabaseSettingsModal
        isOpen={showSupabaseSettingsModal}
        onClose={() => setShowSupabaseSettingsModal(false)}
        onSuccessNotice={showNotification}
        onSyncProfile={() => {
          syncGlobalProfileWithServer();
        }}
      />

      {/* ======================================================== */}
      {/* DELETE PROFILE PICTURE CONFIRMATION MODAL (OWNER ONLY)   */}
      {/* ======================================================== */}
      {isDeleteAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 relative">
            <button
              onClick={() => setIsDeleteAvatarModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Delete Profile Picture?
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {bioData.fullName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete this profile picture? It will be removed across all visitor views and web browsers.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingAvatar}
                onClick={() => setIsDeleteAvatarModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAvatar}
                onClick={handleConfirmDeleteAvatar}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isDeletingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Picture</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* DELETE DOCUMENT CONFIRMATION MODAL (OWNER ONLY)          */}
      {/* ======================================================== */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 relative">
            <button
              onClick={() => setDocToDelete(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Delete Document?
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate max-w-[220px]">
                  {docToDelete.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete this verified document? It will be removed from your profile dossier and persistent storage.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={async () => {
                  if (!docToDelete) return;
                  try {
                    setIsDeletingDoc(true);
                    handleDeleteDocument(docToDelete.id, docToDelete.title);
                    setDocToDelete(null);
                  } finally {
                    setIsDeletingDoc(false);
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isDeletingDoc ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PROFILE PICTURE POSITIONING & FRAMING WORKSPACE MODAL    */}
      {/* ======================================================== */}
      <ProfilePictureRepositionModal
        isOpen={repositionModalOpen}
        imageDetails={loadedImageForReposition}
        onClose={() => {
          setRepositionModalOpen(false);
          setLoadedImageForReposition(null);
        }}
        onSuccess={handleRepositionSuccess}
      />
    </div>
  );
};
