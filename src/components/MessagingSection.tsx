import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Mail,
  CheckCircle2,
  Smile,
  Paperclip,
  Search,
  Edit2,
  Plus,
  ArrowLeft,
  X,
  FileText,
  Image as ImageIcon,
  Sliders,
  Star,
  Trash2,
  ShieldCheck,
  RotateCcw,
  Clock,
  UserCheck,
  Download,
  Eye,
  Mic,
  MicOff,
  User,
  Volume2,
  History,
  Copy,
  Check,
  MessageSquare,
  Loader2
} from 'lucide-react';
import {
  useProfileSync,
  compressImage
} from '../utils/profileState';
import {
  deleteConversationFromFirestore,
  deleteDirectInquiryFromFirestore,
} from '../utils/firebase';
import {
  subscribeToSupabaseRealtimeChat,
  broadcastSupabaseChatMessage,
  saveConversationToSupabaseTable,
  saveMessageAndConversationToSupabase,
  fetchConversationsJoinedFromSupabase,
  fetchVisitorProfileFromSupabase,
  saveVisitorProfileToSupabase,
  subscribeToSupabaseMessagingRealtime,
  generateDeterministicConversationId,
  getOrFetchOwnerId,
  supabase,
} from '../utils/supabase';
import { VoiceNotePlayer, VoiceNoteData } from './VoiceNotePlayer';
import { VisitorProfileModal, VisitorMessagingProfile } from './VisitorProfileModal';
import { generateDemoVoiceNote, formatDuration } from '../utils/audioUtils';

export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'cad' | 'doc' | 'audio' | 'voice';
  url?: string;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'festus';
  text: string;
  timestamp: string;
  status: 'seen' | 'unseen';
  attachments?: ChatAttachment[];
  voiceNote?: VoiceNoteData;
}

export interface Conversation {
  id: string;
  defaultLabel: string; // e.g. "Messenger 1"
  customName?: string;  // e.g. "David Miller (Optomechanics Lead)"
  visitorName?: string; // Visitor's custom display name
  roleOrCompany?: string;
  avatarColor?: string;
  avatarUrl?: string;   // Visitor's custom uploaded picture
  lastMessage?: string;
  lastTimestamp?: string;
  unread: boolean;
  important?: boolean;  // Star / Important flag
  messages: ChatMessage[];
}

const STORAGE_KEY_CHATS = 'fesline_whatsapp_conversations';
const STORAGE_KEY_VISITOR_ID = 'fesline_current_visitor_id';
const STORAGE_KEY_VISITOR_PROFILE = 'fesline_visitor_messaging_profile';

const getInitialVisitorProfile = (): VisitorMessagingProfile => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_VISITOR_PROFILE);
    if (saved) {
      const p = JSON.parse(saved);
      if (p && typeof p.name === 'string') return p;
    }
  } catch {}
  return {
    name: 'Visitor',
    roleOrCompany: 'Visitor Direct Chat',
    avatarUrl: '',
    avatarColor: 'bg-slate-700',
  };
};

// Topic suggestions requested
const TOPIC_SUGGESTIONS = [
  'Full-time Role',
  'CAD design',
  'Web Dev',
  'Analysis',
  'Training',
  'Enquiry',
  'Schedule Interview',
  'FEA consulting',
  'CAD tolerance review',
  'Animation',
  'Graphics'
];

const DEFAULT_CONVERSATIONS: Conversation[] = [];

// Helper to fetch chats from server (joins Express backend and Supabase database)
async function fetchChatsFromServerHelper(deletedSet?: Set<string>): Promise<Conversation[] | null> {
  let apiConvs: Conversation[] = [];
  try {
    const res = await fetch('/api/chats');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.conversations)) {
        if (Array.isArray(json.deletedIds) && deletedSet) {
          json.deletedIds.forEach((id: string) => deletedSet.add(id));
          try {
            localStorage.setItem('fesline_deleted_conv_ids', JSON.stringify(Array.from(deletedSet)));
          } catch {}
        }
        apiConvs = json.conversations;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch chats from server:', err);
  }

  let supabaseConvs: Conversation[] = [];
  try {
    supabaseConvs = await fetchConversationsJoinedFromSupabase();
  } catch (err) {
    console.warn('Failed to fetch joined chats from Supabase:', err);
  }

  if (apiConvs.length === 0 && supabaseConvs.length === 0) {
    return null;
  }

  const map = new Map<string, Conversation>();

  for (const c of apiConvs) {
    if (c && c.id && (!deletedSet || !deletedSet.has(c.id))) {
      map.set(c.id, c);
    }
  }

  for (const sc of supabaseConvs) {
    if (sc && sc.id && (!deletedSet || !deletedSet.has(sc.id))) {
      const existing = map.get(sc.id);
      if (!existing) {
        map.set(sc.id, sc);
      } else {
        const existingMsgs = existing.messages || [];
        const scMsgs = sc.messages || [];
        const msgMap = new Map<string, ChatMessage>();
        for (const m of existingMsgs) {
          if (m && m.id) msgMap.set(m.id, m);
        }
        for (const m of scMsgs) {
          if (m && m.id) msgMap.set(m.id, m);
        }
        const mergedMsgs = Array.from(msgMap.values());

        map.set(sc.id, {
          ...existing,
          ...sc,
          visitorName: sc.visitorName || existing.visitorName || existing.customName || 'Visitor',
          customName: sc.customName || existing.customName || sc.visitorName || 'Visitor',
          avatarUrl: sc.avatarUrl || existing.avatarUrl || '',
          avatarColor: sc.avatarColor || existing.avatarColor || 'bg-slate-700',
          roleOrCompany: sc.roleOrCompany || existing.roleOrCompany || 'Visitor Direct Chat',
          unread: sc.unread || existing.unread,
          lastMessage: sc.lastMessage || existing.lastMessage,
          lastTimestamp: sc.lastTimestamp || existing.lastTimestamp,
          messages: mergedMsgs,
        });
      }
    }
  }

  return Array.from(map.values());
}

// Helper to push chats to server
async function pushChatsToServer(conversations: Conversation[], overwrite = false) {
  try {
    await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversations, overwrite }),
    });
  } catch (err) {
    console.warn('Failed to push chats to server:', err);
  }
}

// Helper to get or create a visitor conversation with NO auto messages
const getOrCreateVisitorId = (): string => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_VISITOR_ID) || sessionStorage.getItem(STORAGE_KEY_VISITOR_ID);
    if (existing && existing.trim()) {
      localStorage.setItem(STORAGE_KEY_VISITOR_ID, existing);
      sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, existing);
      return existing;
    }
    const newId = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem(STORAGE_KEY_VISITOR_ID, newId);
    sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, newId);
    return newId;
  } catch {
    return `visitor-${Date.now()}`;
  }
};

interface MessagingSectionProps {
  onBack?: () => void;
}

export const MessagingSection: React.FC<MessagingSectionProps> = ({ onBack }) => {
  const { avatar: profileAvatar, bio, isOwner, setOwner, ownerUid } = useProfileSync();
  const profileName = bio.fullName || 'Festus, Olorunsogo Johnson';
  const profileEmail = bio.email || 'festusjohnson028@gmail.com';

  const [visitorId, setVisitorId] = useState<string>(() => localStorage.getItem('fesline_visitor_access_key') || '');
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string>(() => ownerUid || localStorage.getItem('fesline_owner_supabase_uid') || 'f4c47b59-42b4-4b5a-8bdf-87f53945a6c1');
  const myDeterministicConvId = useMemo(() => generateDeterministicConversationId(visitorId, resolvedOwnerId), [visitorId, resolvedOwnerId]);

  useEffect(() => {
    getOrFetchOwnerId().then((uid) => {
      if (uid) setResolvedOwnerId(uid);
    });
  }, [ownerUid]);

  // Handle Visitor Access Key System on mount
  useEffect(() => {
    if (isOwner) return;

    const setupVisitorSession = async () => {
      // Check for persistent Visitor Access Key (Never automatically open popup)
      const savedKey = localStorage.getItem('fesline_visitor_access_key');
      if (savedKey) {
        setVisitorId(savedKey);
        // Fetch existing profile to populate state
        const p = await fetchVisitorProfileFromSupabase(savedKey);
        if (p) {
          const updatedProf = {
            name: p.name,
            roleOrCompany: p.roleOrCompany,
            avatarUrl: p.avatarUrl,
            avatarColor: p.avatarColor,
          };
          setVisitorProfile(updatedProf);
          try {
            localStorage.setItem(STORAGE_KEY_VISITOR_PROFILE, JSON.stringify(updatedProf));
          } catch {}
        }
      }
    };

    setupVisitorSession().catch(err => console.warn('Visitor session setup error:', err));
  }, [isOwner]);

  // Visitor Resume / Continue Chat modal states
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [resumeInput, setResumeInput] = useState('');
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [copiedVisitorId, setCopiedVisitorId] = useState(false);

  // Master persistent multi-chat database (shared between visitor submissions & owner replies)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const deletedRaw = localStorage.getItem('fesline_deleted_conv_ids');
          const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
          return parsed.filter((c: any) => c && c.id && !deletedSet.has(c.id));
        }
      }
    } catch {}
    return DEFAULT_CONVERSATIONS;
  });

  // For visitor: messaging profile state (picture, name, role)
  const [visitorProfile, setVisitorProfile] = useState<VisitorMessagingProfile>(getInitialVisitorProfile);
  const [isVisitorProfileModalOpen, setIsVisitorProfileModalOpen] = useState(false);

  // For visitor: clear chat confirmation modal state
  const [isVisitorClearModalOpen, setIsVisitorClearModalOpen] = useState(false);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // For owner: active selected conversation in the sidebar
  const [activeOwnerConvId, setActiveOwnerConvId] = useState<string>(() => {
    return conversations[0]?.id || visitorId;
  });

  // Sidebar filter for Owner: 'all' | 'important' | 'unread'
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'important' | 'unread'>('all');

  // Delete chat confirmation modal state
  const [deletingConv, setDeletingConv] = useState<Conversation | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  // Track deleted conversation IDs to permanently prevent any resurrection glimpse
  const deletedConvIdsRef = useRef<Set<string>>((() => {
    try {
      const savedLocal = localStorage.getItem('fesline_deleted_conv_ids');
      if (savedLocal) return new Set<string>(JSON.parse(savedLocal));
      const saved = sessionStorage.getItem('fesline_deleted_conv_ids');
      if (saved) return new Set<string>(JSON.parse(saved));
    } catch {}
    return new Set<string>();
  })());

  const isFetchingRef = useRef(false);

  // Fetch chats from server
  const fetchChatsFromServer = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const fetched = await fetchChatsFromServerHelper(deletedConvIdsRef.current);
      if (fetched && Array.isArray(fetched)) {
        const cleaned = fetched.filter((c: any) => c && c.id && !deletedConvIdsRef.current.has(c.id));
        setConversations(prev => {
          const mergedMap = new Map<string, Conversation>();

          // 1. Add cleaned server conversations
          for (const c of cleaned) {
            if (c && c.id) mergedMap.set(c.id, c);
          }

          // 2. Preserve any active local conversation messages in prev that haven't synced yet
          for (const localC of prev) {
            if (localC && localC.id && localC.messages && localC.messages.length > 0 && !deletedConvIdsRef.current.has(localC.id)) {
              const serverC = mergedMap.get(localC.id);
              if (!serverC) {
                mergedMap.set(localC.id, localC);
              } else {
                const msgMap = new Map<string, ChatMessage>();
                for (const m of serverC.messages || []) if (m && m.id) msgMap.set(m.id, m);
                for (const m of localC.messages || []) if (m && m.id) msgMap.set(m.id, m);
                const mergedMsgs = Array.from(msgMap.values());

                mergedMap.set(localC.id, {
                  ...serverC,
                  messages: mergedMsgs,
                  lastMessage: mergedMsgs[mergedMsgs.length - 1]?.text || serverC.lastMessage || localC.lastMessage || 'New message',
                  lastTimestamp: mergedMsgs[mergedMsgs.length - 1]?.timestamp || serverC.lastTimestamp || localC.lastTimestamp || '',
                });
              }
            }
          }

          const finalConvs = Array.from(mergedMap.values());
          const currentStr = JSON.stringify(prev);
          const finalStr = JSON.stringify(finalConvs);
          if (currentStr !== finalStr) {
            try {
              localStorage.setItem(STORAGE_KEY_CHATS, finalStr);
            } catch {}
            return finalConvs;
          }
          return prev;
        });
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Real-time synchronization between visitor and owner
  useEffect(() => {
    fetchChatsFromServer();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CHATS && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) {
            const cleaned = updated.filter((c: any) => !deletedConvIdsRef.current.has(c.id));
            setConversations(cleaned);
          }
        } catch {}
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchChatsFromServer();
      }
    };

    // Supabase Realtime Channel Subscription for live multi-user messaging
    const unsubSupabaseRealtime = subscribeToSupabaseRealtimeChat((payload) => {
      fetchChatsFromServer();
      if (payload && payload.conversationId && payload.message) {
        const { conversationId, message } = payload;
        setConversations((prev) => {
          if (deletedConvIdsRef.current.has(conversationId)) return prev;
          const idx = prev.findIndex((c) => c.id === conversationId);
          if (idx >= 0) {
            const existing = prev[idx];
            if (existing.messages.some((m) => m.id === message.id)) return prev;
            const updated = prev.map((c, i) =>
              i === idx
                ? {
                    ...c,
                    unread: message.sender === 'visitor',
                    messages: [...c.messages, message],
                    lastMessage: message.text || (message.voiceNote ? '🎤 Voice note' : 'Attachment'),
                    lastTimestamp: message.timestamp,
                  }
                : c
            );
            try {
              localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
            } catch {}
            return updated;
          }
          return prev;
        });
      }
    });

    // Supabase Database Table Changes Subscription (messages, conversations, visitor_profiles)
    const unsubSupabaseDbStream = subscribeToSupabaseMessagingRealtime(() => {
      fetchChatsFromServer();
    });

    // SSE Stream Subscription for instant server push
    let sseSource: EventSource | null = null;
    try {
      sseSource = new EventSource('/api/chats/stream');
      sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.conversations && Array.isArray(data.conversations)) {
            const cleaned = data.conversations.filter((c: any) => c && c.id && !deletedConvIdsRef.current.has(c.id));
            setConversations((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(cleaned)) {
                try {
                  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(cleaned));
                } catch {}
                return cleaned;
              }
              return prev;
            });
          }
        } catch {}
      };
    } catch {}

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', fetchChatsFromServer);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubSupabaseRealtime();
      unsubSupabaseDbStream();
      if (sseSource) sseSource.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', fetchChatsFromServer);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Active conversation depending on whether user is Owner or Visitor
  const activeConversation: Conversation = useMemo(() => {
    if (!isOwner) {
      // Find visitor's conversation in master list, or return empty clean initial chat
      const found = conversations.find((c) => c.id === visitorId || c.id === myDeterministicConvId);
      if (found) {
        return {
          ...found,
          id: myDeterministicConvId, // Expose the deterministic ID!
          visitorName: visitorProfile.name || found.visitorName || found.customName,
          customName: visitorProfile.name || found.customName,
          avatarUrl: visitorProfile.avatarUrl !== undefined ? visitorProfile.avatarUrl : found.avatarUrl,
          roleOrCompany: visitorProfile.roleOrCompany || found.roleOrCompany,
        };
      }
      return {
        id: myDeterministicConvId, // Use deterministic ID!
        defaultLabel: visitorProfile.name || 'Direct Message',
        customName: visitorProfile.name || '',
        visitorName: visitorProfile.name || '',
        avatarUrl: visitorProfile.avatarUrl || '',
        roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Inquiry',
        avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
        unread: false,
        important: false,
        messages: [] // NO automatic welcome message!
      };
    }

    const validOwnerConvs = conversations.filter((c) => c && c.messages && c.messages.length > 0);
    const found = validOwnerConvs.find((c) => c.id === activeOwnerConvId);
    if (found) return found;
    return validOwnerConvs[0] || {
      id: 'inbox-empty',
      defaultLabel: 'Inbox',
      roleOrCompany: 'Visitor Inquiries',
      unread: false,
      important: false,
      messages: []
    };
  }, [isOwner, visitorId, myDeterministicConvId, conversations, activeOwnerConvId, visitorProfile]);

  // Header Avatar Size Adjustment ('sm' | 'md' | 'lg')
  const [headerAvatarSize, setHeaderAvatarSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showHeaderSettings, setShowHeaderSettings] = useState(false);

  // Search Functionality State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterType, setSearchFilterType] = useState<'all' | 'messages' | 'files'>('all');

  // Input message state with auto-draft restore across page visits
  const [inputMessage, setInputMessage] = useState<string>(() => {
    try {
      return localStorage.getItem('fesline_chat_draft') || '';
    } catch {
      return '';
    }
  });

  const updateInputMessage = (val: string) => {
    setInputMessage(val);
    try {
      if (val.trim()) {
        localStorage.setItem('fesline_chat_draft', val);
      } else {
        localStorage.removeItem('fesline_chat_draft');
      }
    } catch {}
  };

  const handleResumeConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResumeError(null);
    const target = resumeInput.trim();
    if (!target) {
      setResumeError('Please enter your Visitor Session ID, Name, or Email.');
      return;
    }

    const cleanTarget = target.toLowerCase();
    // 1. Search existing conversations
    let match = conversations.find(
      (c) =>
        c.id.toLowerCase() === cleanTarget ||
        (c.visitorName && c.visitorName.toLowerCase() === cleanTarget) ||
        (c.customName && c.customName.toLowerCase() === cleanTarget) ||
        (c.defaultLabel && c.defaultLabel.toLowerCase() === cleanTarget)
    );

    // 2. Query server if not found in memory
    if (!match) {
      try {
        const fresh = await fetchChatsFromServerHelper();
        if (fresh && Array.isArray(fresh)) {
          match = fresh.find(
            (c) =>
              c.id.toLowerCase() === cleanTarget ||
              (c.visitorName && c.visitorName.toLowerCase() === cleanTarget) ||
              (c.customName && c.customName.toLowerCase() === cleanTarget) ||
              (c.defaultLabel && c.defaultLabel.toLowerCase() === cleanTarget)
          );
          if (match) {
            setConversations(fresh);
          }
        }
      } catch {}
    }

    if (match) {
      setVisitorId(match.id);
      try {
        localStorage.setItem(STORAGE_KEY_VISITOR_ID, match.id);
        sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, match.id);
        document.cookie = `fesline_visitor_id=${encodeURIComponent(match.id)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      setIsResumeModalOpen(false);
      setResumeInput('');
      setShowMailNotice(`Welcome back ${match.visitorName || match.customName || 'Visitor'}! Continued conversation from where you left off.`);
    } else {
      setResumeError(`No prior conversation found matching "${target}". Please check and try again, or continue with your current chat.`);
    }
  };

  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);

  // Rename contact modal state (Owner only)
  const [editingConv, setEditingConv] = useState<Conversation | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [editRoleInput, setEditRoleInput] = useState('');

  // Mobile drawer view state for Owner on small screens
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  // Direct mail notification toast
  const [showMailNotice, setShowMailNotice] = useState<string | null>(null);

  // Full-screen image preview modal state
  const [selectedChatImage, setSelectedChatImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of active conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, activeOwnerConvId, isOwner]);

  // Owner selects a conversation from the sidebar
  const handleSelectConversation = (convId: string) => {
    setActiveOwnerConvId(convId);
    setIsMobileListOpen(false);
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            unread: false,
            messages: c.messages.map((m) => ({ ...m, status: 'seen' }))
          };
        }
        return c;
      })
    );
  };

  // Owner toggles important (Star) status on a conversation
  const handleToggleImportant = (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            important: !c.important
          };
        }
        return c;
      })
    );
  };

  // Owner or visitor initiates inquiry deletion
  const handlePromptDelete = (conv: Conversation | null | undefined, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!conv || conv.id === 'inbox-empty' || (isOwner && conversations.length === 0)) {
      setShowMailNotice('No active inquiry available to delete.');
      return;
    }
    setDeletingConv(conv);
  };

  // Confirms chat / inquiry deletion (supports both owner and visitor)
  const handleConfirmDelete = async () => {
    if (!deletingConv || isDeletingChat) return;
    setIsDeletingChat(true);
    const targetId = deletingConv.id;
    const displayName = deletingConv.visitorName || deletingConv.customName || deletingConv.defaultLabel || 'Inquiry';

    try {
      // 1. Permanently record tombstone in sets & storage
      deletedConvIdsRef.current.add(targetId);
      try {
        localStorage.setItem('fesline_deleted_conv_ids', JSON.stringify(Array.from(deletedConvIdsRef.current)));
        sessionStorage.setItem('fesline_deleted_conv_ids', JSON.stringify(Array.from(deletedConvIdsRef.current)));
      } catch {}

      // 2. Clear input drafts and attachments
      updateInputMessage('');
      setAttachedFiles([]);

      // 3. Immediately remove from React state & local storage
      const remaining = conversations.filter((c) => c.id !== targetId);
      setConversations(remaining);
      try {
        localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(remaining));
      } catch {}

      if (activeOwnerConvId === targetId) {
        setActiveOwnerConvId(remaining[0]?.id || '');
      }

      // 4. If visitor deleted their active inquiry, reset session with a clean new visitorId
      if (visitorId === targetId) {
        const freshId = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        try {
          localStorage.setItem(STORAGE_KEY_VISITOR_ID, freshId);
          sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, freshId);
          document.cookie = `fesline_visitor_id=${encodeURIComponent(freshId)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}
        setVisitorId(freshId);
      }

      // 5. Clean up from Firestore if active
      deleteConversationFromFirestore(targetId).catch(() => {});
      deleteDirectInquiryFromFirestore(targetId).catch(() => {});

      // 6. Delete from backend database (Cloud SQL / PostgreSQL) with SSE broadcast
      const res = await fetch(`/api/chats/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      if (!res.ok) {
        console.warn('Backend delete returned status:', res.status);
      }

      setShowMailNotice(`Inquiry "${displayName}" deleted permanently.`);
      window.dispatchEvent(new CustomEvent('fesline_chats_updated'));
      broadcastSupabaseChatMessage({ event: 'inquiry_deleted', targetId });
    } catch (err) {
      console.warn('Delete error:', err);
      setShowMailNotice(`Inquiry "${displayName}" deleted.`);
    } finally {
      setIsDeletingChat(false);
      setDeletingConv(null);
    }
  };

  // Delete a specific message within the active conversation
  const handleDeleteMessage = (convId: string, msgId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === convId) {
          const remainingMsgs = c.messages.filter((m) => m.id !== msgId);
          return {
            ...c,
            messages: remainingMsgs,
            lastMessage: remainingMsgs[remainingMsgs.length - 1]?.text || (remainingMsgs.length > 0 ? 'Message sent' : ''),
          };
        }
        return c;
      });
      try {
        localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    fetch(`/api/chats/${convId}/messages/${msgId}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Failed to delete message on backend:', err);
    });
    window.dispatchEvent(new CustomEvent('fesline_chats_updated'));
    setShowMailNotice('Message deleted.');
  };

  // Owner creates a new conversation manually
  const handleCreateNewConversation = () => {
    const nextIndex = conversations.length + 1;
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      defaultLabel: `Messenger ${nextIndex}`,
      customName: '',
      roleOrCompany: 'Engineering Inquiry',
      avatarColor: [
        'bg-teal-600',
        'bg-purple-600',
        'bg-rose-600',
        'bg-sky-600',
        'bg-amber-600'
      ][nextIndex % 5],
      unread: false,
      important: false,
      messages: []
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveOwnerConvId(newConv.id);
    setIsMobileListOpen(false);
  };

  // Open Rename Modal (Owner only)
  const handleOpenRenameModal = (conv: Conversation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingConv(conv);
    setEditNameInput(conv.customName || conv.defaultLabel);
    setEditRoleInput(conv.roleOrCompany || '');
  };

  // Save Renamed Contact
  const handleSaveContactName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConv) return;
    const trimmed = editNameInput.trim();
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === editingConv.id) {
          return {
            ...c,
            customName: trimmed.length > 0 ? trimmed : undefined,
            roleOrCompany: editRoleInput.trim()
          };
        }
        return c;
      })
    );
    setEditingConv(null);
  };

  // Visitor clears their chat screen
  const handleVisitorClearChat = () => {
    const freshId = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    try {
      localStorage.setItem(STORAGE_KEY_VISITOR_ID, freshId);
      sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, freshId);
      document.cookie = `fesline_visitor_id=${encodeURIComponent(freshId)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    setVisitorId(freshId);
    setIsVisitorClearModalOpen(false);
    setShowMailNotice('Chat cleared on your screen. Started a fresh conversation.');
  };

  const handleOwnerLogout = () => {
    setOwner(false);
    setShowMailNotice('Logged out of Owner Mode. Switched to public visitor view.');
  };

  // Visitor updates their messaging profile (photo and name)
  const handleSaveVisitorProfile = async (updated: VisitorMessagingProfile, accessKey: string) => {
    const isFirstTime = !visitorId;
    setVisitorProfile(updated);
    setVisitorId(accessKey);
    try {
      localStorage.setItem(STORAGE_KEY_VISITOR_PROFILE, JSON.stringify(updated));
      localStorage.setItem('fesline_visitor_access_key', accessKey);
    } catch {}

    const updatedConvMetadata = {
      defaultLabel: updated.name || 'Direct Message',
      customName: updated.name || '',
      visitorName: updated.name || '',
      avatarUrl: updated.avatarUrl || '',
      roleOrCompany: updated.roleOrCompany || 'Visitor Direct Chat',
      avatarColor: updated.avatarColor || 'bg-slate-700',
    };

    const targetConvId = myDeterministicConvId || generateDeterministicConversationId(accessKey, resolvedOwnerId);

    // Update or insert conversation record in local state and Supabase
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === accessKey || c.id === targetConvId);
      
      const accessKeyMsg: ChatMessage = {
        id: `key-msg-${Date.now()}`,
        sender: 'festus', // Render as secure automated notice from Festus/System
        text: `🔑 SECURE VISITOR ACCESS KEY: ${accessKey}\n\nThis is your private key to restore your complete profile and message history across different phones or browsers. Please copy and save it!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'seen',
      };

      if (idx >= 0) {
        let updatedMessages = [...prev[idx].messages];
        let lastMsg = prev[idx].lastMessage;
        
        if (isFirstTime && !updatedMessages.some(m => m.text.includes('SECURE VISITOR ACCESS KEY'))) {
          updatedMessages.push(accessKeyMsg);
          lastMsg = `🔑 Secure Access Key: ${accessKey}`;
          
          saveMessageAndConversationToSupabase({
            conversationId: targetConvId,
            visitorId: accessKey,
            message: accessKeyMsg,
            conversationMetadata: updatedConvMetadata,
          });
          broadcastSupabaseChatMessage({ conversationId: targetConvId, message: accessKeyMsg });
        }

        const u = {
          ...prev[idx],
          id: targetConvId,
          ...updatedConvMetadata,
          messages: updatedMessages,
          lastMessage: lastMsg || 'New message',
        };
        saveConversationToSupabaseTable(u);
        return prev.map((c, i) => (i === idx ? u : c));
      } else {
        const initialMsgs = isFirstTime ? [accessKeyMsg] : [];
        const newC: Conversation = {
          id: targetConvId,
          ...updatedConvMetadata,
          unread: false,
          important: false,
          messages: initialMsgs,
          lastMessage: isFirstTime ? `🔑 Secure Access Key: ${accessKey}` : '',
          lastTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        saveConversationToSupabaseTable(newC);

        if (isFirstTime) {
          saveMessageAndConversationToSupabase({
            conversationId: targetConvId,
            visitorId: accessKey,
            message: accessKeyMsg,
            conversationMetadata: updatedConvMetadata,
          });
          broadcastSupabaseChatMessage({ conversationId: targetConvId, message: accessKeyMsg });
        }

        return [newC, ...prev];
      }
    });

    // Sync to backend
    try {
      await fetch('/api/chats/visitor-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: accessKey,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
          roleOrCompany: updated.roleOrCompany,
        }),
      });
    } catch (err) {
      console.warn('Failed to sync visitor profile:', err);
    }

    broadcastSupabaseChatMessage({ event: 'visitor_profile_updated', visitorId: accessKey, profile: updated });
    setShowMailNotice(`Profile initialized! Saved secure Access Key: ${accessKey}. Copy it from the top right to restore anywhere!`);
  };

  // Send voice note between owner and visitor
  const sendVoiceNoteMessage = (audioUrl: string, duration: number) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const voiceData: VoiceNoteData = {
      url: audioUrl,
      duration,
    };

    if (isOwner) {
      const festusMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: 'festus',
        text: '',
        timestamp: timeStr,
        status: 'seen',
        voiceNote: voiceData,
      };

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeOwnerConvId) {
            return {
              ...c,
              unread: false,
              messages: [...c.messages, festusMsg],
              lastMessage: `🎤 Voice note (${formatDuration(duration)})`,
              lastTimestamp: timeStr,
            };
          }
          return c;
        });
        try {
          localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeOwnerConvId,
          message: festusMsg,
          conversationMetadata: {
            defaultLabel: activeConversation.defaultLabel,
            customName: activeConversation.customName,
            visitorName: activeConversation.visitorName,
            avatarUrl: activeConversation.avatarUrl,
            roleOrCompany: activeConversation.roleOrCompany,
          },
        }),
      }).catch((err) => console.warn('Send error:', err));

      saveMessageAndConversationToSupabase({
        conversationId: activeOwnerConvId,
        message: festusMsg,
        conversationMetadata: {
          defaultLabel: activeConversation.defaultLabel,
          customName: activeConversation.customName,
          visitorName: activeConversation.visitorName,
          avatarUrl: activeConversation.avatarUrl,
          roleOrCompany: activeConversation.roleOrCompany,
        },
      });

      broadcastSupabaseChatMessage({ conversationId: activeOwnerConvId, message: festusMsg });
    } else {
      // Block sending if visitor is yet to login
      if (!visitorId || visitorId.trim() === '') {
        setShowMailNotice("Login first, click InChat");
        setIsVisitorProfileModalOpen(true);
        return;
      }
      const visitorMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: 'visitor',
        text: '',
        timestamp: timeStr,
        status: 'unseen',
        voiceNote: voiceData,
      };

      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === visitorId || c.id === myDeterministicConvId);
        let updated: Conversation[];
        if (existingIdx >= 0) {
          updated = prev.map((c, idx) => {
            if (idx === existingIdx) {
              return {
                ...c,
                id: myDeterministicConvId,
                unread: true,
                messages: [...c.messages, visitorMsg],
                lastMessage: `🎤 Voice note (${formatDuration(duration)})`,
                lastTimestamp: timeStr,
              };
            }
            return c;
          });
        } else {
          const nextIndex = prev.length + 1;
          const newVisitorRecord: Conversation = {
            id: myDeterministicConvId,
            defaultLabel: visitorProfile.name || `Messenger ${nextIndex}`,
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
            unread: true,
            important: false,
            messages: [visitorMsg],
            lastMessage: `🎤 Voice note (${formatDuration(duration)})`,
            lastTimestamp: timeStr,
          };
          updated = [newVisitorRecord, ...prev];
        }
        try {
          localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: myDeterministicConvId,
          message: visitorMsg,
          conversationMetadata: {
            defaultLabel: visitorProfile.name || 'Direct Message',
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Inquiry',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
          },
        }),
      }).catch((err) => console.warn('Send error:', err));

      saveMessageAndConversationToSupabase({
        conversationId: myDeterministicConvId,
        visitorId,
        message: visitorMsg,
        conversationMetadata: {
          defaultLabel: visitorProfile.name || 'Direct Message',
          customName: visitorProfile.name || '',
          visitorName: visitorProfile.name || '',
          avatarUrl: visitorProfile.avatarUrl || '',
          roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Inquiry',
          avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
        },
      });

      broadcastSupabaseChatMessage({ conversationId: myDeterministicConvId, message: visitorMsg });
    }
  };

  // Start physical microphone recording
  const startVoiceRecording = async () => {
    if (isRecording) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setShowMailNotice('Microphone access is not supported by this browser environment. You can use the Demo Audio button.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendVoiceNoteMessage(base64Audio, durationSeconds);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone recording error:', err);
      setShowMailNotice(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied in browser. Click "Audio Memo" to test voice notes.'
          : `Microphone unavailable: ${err?.message || 'Permission denied'}`
      );
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {};
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const handleSendDemoAudio = async () => {
    try {
      setShowMailNotice('Generating engineering voice memo...');
      const demo = await generateDemoVoiceNote(5, 'Voice Note');
      sendVoiceNoteMessage(demo.url, demo.duration);
      setShowMailNotice('Voice note sent!');
    } catch (err) {
      console.warn(err);
    }
  };

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentText = inputMessage.trim();
    const currentAttachments = [...attachedFiles];

    if (isOwner) {
      // 1. OWNER SENDS REAL REPLY
      const festusMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: 'festus',
        text: currentText,
        timestamp: timeStr,
        status: 'seen',
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined
      };

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeOwnerConvId) {
            return {
              ...c,
              unread: false,
              messages: [...c.messages, festusMsg],
              lastMessage: currentText || (currentAttachments.length > 0 ? `📎 ${currentAttachments[0].name}` : 'File sent'),
              lastTimestamp: timeStr
            };
          }
          return c;
        });
        try {
          localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Dispatch immediately to backend with SSE broadcast
      fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeOwnerConvId,
          message: festusMsg,
          conversationMetadata: {
            defaultLabel: activeConversation.defaultLabel,
            customName: activeConversation.customName,
            visitorName: activeConversation.visitorName,
            avatarUrl: activeConversation.avatarUrl,
            roleOrCompany: activeConversation.roleOrCompany,
          }
        }),
      }).catch((err) => console.warn('Send error:', err));

      saveConversationToSupabaseTable({
        id: activeOwnerConvId,
        defaultLabel: activeConversation.defaultLabel,
        customName: activeConversation.customName,
        visitorName: activeConversation.visitorName,
        avatarUrl: activeConversation.avatarUrl,
        roleOrCompany: activeConversation.roleOrCompany,
        unread: false,
        important: activeConversation.important,
        lastMessage: currentText || 'File sent',
        lastTimestamp: timeStr,
        messages: [...activeConversation.messages, festusMsg],
      });

      broadcastSupabaseChatMessage({ conversationId: activeOwnerConvId, message: festusMsg });
    } else {
      // Block sending if visitor is yet to login
      if (!visitorId || visitorId.trim() === '') {
        setShowMailNotice("Login first, click InChat");
        setIsVisitorProfileModalOpen(true);
        return;
      }
      // 2. VISITOR SENDS MESSAGE (NO AUTO-REPLY, NO BOT SIMULATION, NO TIMEOUT)
      const visitorMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: 'visitor',
        text: currentText,
        timestamp: timeStr,
        status: 'unseen', // Unseen until owner logs in and opens it
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined
      };

      let targetConv: Conversation | null = null;

      // Record this message into master conversations database
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === visitorId || c.id === myDeterministicConvId);
        let updated: Conversation[];
        if (existingIdx >= 0) {
          updated = prev.map((c, idx) => {
            if (idx === existingIdx) {
              const uConv = {
                ...c,
                id: myDeterministicConvId,
                unread: true,
                messages: [...c.messages, visitorMsg],
                lastMessage: currentText || (currentAttachments.length > 0 ? `📎 ${currentAttachments[0].name}` : 'File sent'),
                lastTimestamp: timeStr
              };
              targetConv = uConv;
              return uConv;
            }
            return c;
          });
        } else {
          const nextIndex = prev.length + 1;
          const newVisitorRecord: Conversation = {
            id: myDeterministicConvId,
            defaultLabel: visitorProfile.name || `Messenger ${nextIndex}`,
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
            unread: true,
            important: false,
            messages: [visitorMsg],
            lastMessage: currentText || 'New visitor message',
            lastTimestamp: timeStr
          };
          targetConv = newVisitorRecord;
          updated = [newVisitorRecord, ...prev];
        }
        try {
          localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Dispatch immediately to backend with SSE broadcast
      fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: myDeterministicConvId,
          message: visitorMsg,
          conversationMetadata: {
            defaultLabel: visitorProfile.name || 'Direct Message',
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Inquiry',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
          }
        }),
      }).catch((err) => console.warn('Send error:', err));

      saveMessageAndConversationToSupabase({
        conversationId: myDeterministicConvId,
        visitorId,
        message: visitorMsg,
        conversationMetadata: {
          defaultLabel: visitorProfile.name || 'Direct Message',
          customName: visitorProfile.name || '',
          visitorName: visitorProfile.name || '',
          avatarUrl: visitorProfile.avatarUrl || '',
          roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Inquiry',
          avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
        },
      });

      broadcastSupabaseChatMessage({ conversationId: myDeterministicConvId, message: visitorMsg });
    }

    updateInputMessage('');
    setAttachedFiles([]);
  };

  // File Upload Attachment (Base64 encoded for cross-visitor persistence)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newAttachments: ChatAttachment[] = [];

    for (const file of fileList) {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let type: 'image' | 'pdf' | 'cad' | 'doc' = 'doc';
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(extension)) type = 'image';
      else if (['pdf'].includes(extension)) type = 'pdf';
      else if (['step', 'stp', 'sldprt', 'iges', 'dwg', 'dxf'].includes(extension)) type = 'cad';

      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeFormatted = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

      let url = '';
      try {
        if (type === 'image' && file.size > 600000) {
          url = await compressImage(file, 1200, 0.85);
        } else {
          url = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve((ev.target?.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          });
        }
      } catch {
        url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      }

      newAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: sizeFormatted,
        type,
        url: url || undefined,
      });
    }

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleQuickTopicChip = (chip: string) => {
    setInputMessage(chip);
  };

  // Filtered Conversations for Owner (only conversations with at least 1 message)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (!c || !c.messages || c.messages.length === 0) return false;
      if (sidebarFilter === 'important') return c.important;
      if (sidebarFilter === 'unread') return c.unread;
      return true;
    });
  }, [conversations, sidebarFilter]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: {
      convId: string;
      convName: string;
      message: ChatMessage;
      matchedAttachment?: ChatAttachment;
    }[] = [];

    const scopeConversations = isOwner ? conversations : [activeConversation];

    scopeConversations.forEach((c) => {
      const displayName = c.customName || c.defaultLabel;
      c.messages.forEach((m) => {
        const textMatches = m.text.toLowerCase().includes(q);
        const attachmentMatches = m.attachments?.find((att) => att.name.toLowerCase().includes(q));

        if (searchFilterType === 'all') {
          if (textMatches) results.push({ convId: c.id, convName: displayName, message: m });
          else if (attachmentMatches) results.push({ convId: c.id, convName: displayName, message: m, matchedAttachment: attachmentMatches });
        } else if (searchFilterType === 'messages' && textMatches) {
          results.push({ convId: c.id, convName: displayName, message: m });
        } else if (searchFilterType === 'files' && attachmentMatches) {
          results.push({ convId: c.id, convName: displayName, message: m, matchedAttachment: attachmentMatches });
        }
      });
    });

    return results;
  }, [conversations, activeConversation, isOwner, searchQuery, searchFilterType]);

  // Avatar Size style map
  const avatarSizeClass = {
    sm: 'w-7 h-7',
    md: 'w-8.5 h-8.5',
    lg: 'w-10 h-10'
  }[headerAvatarSize];

  return (
    <div id="messaging" className="w-full h-full flex flex-col bg-[#dce1e8] p-0 font-sans selection:bg-cyan-200 overflow-hidden">
      <div className="w-full flex-1 flex flex-col h-full bg-[#dce1e8] overflow-hidden">

        {/* TOP NOTICE TOAST */}
        {showMailNotice && (
          <div className="mx-4 mt-2 p-3 rounded-xl bg-slate-900 text-white shadow-lg border border-cyan-500/50 flex items-center justify-between font-sans text-xs animate-fade-in shrink-0 z-30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{showMailNotice}</span>
            </div>
            <button
              onClick={() => setShowMailNotice(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* MESSAGING CONTAINER                                      */}
        {/* ======================================================== */}
        <div className="bg-[#dce1e8] flex flex-col flex-1 h-full overflow-hidden relative">
          
          <div className="flex-1 flex overflow-hidden relative h-full">

            {/* ==================================================== */}
            {/* LEFT SIDEBAR: VISIBLE ONLY TO OWNER (FESTUS)         */}
            {/* Shows all who messaged: Messenger 1, Messenger 2...  */}
            {/* With Delete, Rename, Star Important, Search & Filter */}
            {/* ==================================================== */}
            {isOwner && (
              <div
                className={`w-full md:w-80 lg:w-88 bg-white border-r border-[#cbd5e1] flex flex-col shrink-0 z-20 transition-all duration-200 ${
                  isMobileListOpen ? 'absolute inset-0 md:relative md:flex' : 'hidden md:flex'
                }`}
              >
                {/* Sidebar Top Bar */}
                <div className="bg-[#1e88e5] text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide">Visitor Inquiries</span>
                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                      {conversations.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCreateNewConversation}
                      className="p-1.5 hover:bg-white/15 rounded-lg text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      title="Start new conversation thread"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New</span>
                    </button>
                    {isMobileListOpen && (
                      <button
                        onClick={() => setIsMobileListOpen(false)}
                        className="md:hidden p-1.5 hover:bg-white/15 rounded-lg text-white"
                        title="Close drawer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sidebar Filter Tabs: All | Important ⭐ | Unread */}
                <div className="flex items-center border-b border-slate-200 bg-[#f1f5f9] px-2 py-1 text-xs font-medium text-slate-600 gap-1">
                  <button
                    onClick={() => setSidebarFilter('all')}
                    className={`flex-1 py-1 px-2 rounded text-center transition-colors cursor-pointer ${
                      sidebarFilter === 'all'
                        ? 'bg-white text-[#1e88e5] font-bold shadow-xs'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    All ({conversations.length})
                  </button>
                  <button
                    onClick={() => setSidebarFilter('important')}
                    className={`flex-1 py-1 px-2 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      sidebarFilter === 'important'
                        ? 'bg-amber-100 text-amber-900 font-bold shadow-xs'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>Starred ({conversations.filter((c) => c.important).length})</span>
                  </button>
                  <button
                    onClick={() => setSidebarFilter('unread')}
                    className={`flex-1 py-1 px-2 rounded text-center transition-colors cursor-pointer ${
                      sidebarFilter === 'unread'
                        ? 'bg-cyan-100 text-cyan-900 font-bold shadow-xs'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Unread ({conversations.filter((c) => c.unread && c.messages && c.messages.length > 0).length})
                  </button>
                </div>

                {/* Sidebar Search Filter */}
                <div className="p-2 border-b border-slate-200 bg-[#f8fafc]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search senders, keywords, files..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value) setIsSearchOpen(true);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1e88e5]"
                    />
                  </div>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredConversations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No visitor inquiries recorded yet.
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isActive = conv.id === activeOwnerConvId;
                      const displayName = conv.visitorName || conv.customName || conv.defaultLabel;
                      const isRenamed = !!(conv.visitorName || conv.customName);
                      const lastMsg = conv.messages[conv.messages.length - 1];

                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          className={`p-3 flex items-start gap-2.5 cursor-pointer transition-colors relative group select-none ${
                            isActive
                              ? 'bg-[#e2e8f0] border-l-4 border-[#243346]'
                              : 'hover:bg-[#f1f5f9]'
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`relative w-8 h-8 rounded-full overflow-hidden ${conv.avatarColor || 'bg-slate-700'} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs uppercase`}
                          >
                            <span>{displayName.charAt(0)}</span>
                            {conv.avatarUrl && (
                              <img
                                src={conv.avatarUrl}
                                alt={displayName}
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-xs text-slate-900 truncate">
                                  {displayName}
                                </span>
                                {!isRenamed && (
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    ({conv.defaultLabel})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {lastMsg?.timestamp || 'New'}
                              </span>
                            </div>

                            {/* Last Message Snippet */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="truncate pr-2">
                                {lastMsg ? (
                                  lastMsg.sender === 'festus' ? `You: ${lastMsg.text || (lastMsg.voiceNote ? '🎤 Voice note' : 'File')}` : (lastMsg.text || (lastMsg.voiceNote ? '🎤 Voice note' : 'File'))
                                ) : (
                                  'Awaiting initial message'
                                )}
                              </span>

                              {/* Seen / Unseen Status Marker */}
                              {lastMsg && (
                                <span className="shrink-0">
                                  {lastMsg.status === 'seen' ? (
                                    <span className="text-[#243346] font-bold text-xs" title="Seen (marked twice)">
                                      ✓✓
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-bold text-xs" title="Unseen / Delivered (marked once)">
                                      ✓
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Star Important, Rename, Delete */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Star Important Button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleImportant(conv.id, e)}
                              className={`p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer ${
                                conv.important ? 'text-amber-500' : 'text-slate-300 opacity-60 group-hover:opacity-100 hover:text-amber-500'
                              }`}
                              title={conv.important ? "Starred as Important (Click to unstar)" : "Mark as Important"}
                            >
                              <Star className={`w-3.5 h-3.5 ${conv.important ? 'fill-amber-400' : ''}`} />
                            </button>

                            {/* Quick Rename Button */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenRenameModal(conv, e)}
                              className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 text-slate-600 rounded transition-opacity cursor-pointer"
                              title={`Rename ${conv.defaultLabel}`}
                            >
                              <Edit2 className="w-3 h-3 text-cyan-700" />
                            </button>

                            {/* Quick Delete Button */}
                            <button
                              type="button"
                              onClick={(e) => handlePromptDelete(conv, e)}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title={`Delete ${conv.customName || conv.defaultLabel} from inquiries`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sidebar Footer */}
                <div className="p-2.5 bg-[#f8fafc] border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Owner Inbox (Festus)</span>
                  <button
                    onClick={handleOwnerLogout}
                    className="text-xs text-red-600 hover:underline cursor-pointer font-bold"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* MAIN CHAT AREA                                       */}
            {/* ==================================================== */}
            <div className="flex-1 flex flex-col bg-[#efeae2] relative min-w-0 h-full overflow-hidden">

              {/* 1. SLIM & COMPACT SLATE HEADER (MATCHES NAVBAR THEME) */}
              <div className="bg-[#243346] border-b border-[#1b2634] px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-xs text-white select-none z-10 shrink-0">
                
                {/* Left Header Group: Drawer Toggle (Owner mobile) & Profile Avatar */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Drawer Button (Owner Only on Small Screens) */}
                  {isOwner && (
                    <button
                      onClick={() => setIsMobileListOpen(true)}
                      className="md:hidden p-1 hover:bg-white/15 rounded-lg text-white cursor-pointer mr-0.5"
                      title="Show visitor chats list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}

                  {/* Profile Avatar */}
                  <div
                    className={`relative ${avatarSizeClass} rounded-full overflow-hidden border border-white/90 shadow-xs bg-slate-200 shrink-0 flex items-center justify-center ${
                      isOwner ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (isOwner) setShowHeaderSettings(!showHeaderSettings);
                    }}
                    title={isOwner ? "Click to adjust avatar size" : profileName}
                  >
                    {profileAvatar ? (
                      <img
                        src={profileAvatar}
                        alt={profileName}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-1/2 h-1/2 text-slate-500" />
                    )}
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#243346]" />
                  </div>

                  {/* Contact Info & Title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                        {profileName}
                      </h2>
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white text-[#243346] text-[9px] font-bold">
                        ✓
                      </span>

                      {/* Important Star Badge on Active Conversation (Owner) */}
                      {isOwner && activeConversation.important && (
                        <span className="text-amber-300 inline-flex items-center" title="Important Conversation">
                          <Star className="w-3.5 h-3.5 fill-amber-300" />
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-slate-300 font-medium flex items-center gap-1.5 truncate">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="truncate">
                        online {isOwner ? `· In conversation with ${activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel}` : '· Direct Channel'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Header Group: Search, Visitor Edit Profile, Visitor Clear, Owner Controls, Direct Mail */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-slate-200">
                  {/* Search Button */}
                  <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      isSearchOpen ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-white'
                    }`}
                    title="Search messages and shared files"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  {/* Visitor Controls: InChat, Copy Access Key & Clear Chat */}
                  {!isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsVisitorProfileModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all cursor-pointer border border-cyan-400/50 shadow-md mr-1 shrink-0 animate-pulse-slow active:scale-95"
                        title="Configure visitor profile or restore session (InChat)"
                      >
                        <User className="w-3.5 h-3.5 text-cyan-100" />
                        <span>InChat</span>
                      </button>

                      {visitorId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(visitorId);
                            setCopiedVisitorId(true);
                            setTimeout(() => setCopiedVisitorId(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold transition-colors cursor-pointer border border-cyan-500 shadow-xs"
                          title="Copy your persistent Access Key to restore this chat on another device"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-200" />
                          <span>{copiedVisitorId ? 'Copied!' : `Key: ${visitorId}`}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsVisitorClearModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors cursor-pointer border border-white/15 shadow-xs"
                        title="Clear your chat screen"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Clear Chat</span>
                      </button>
                    </>
                  )}

                  {/* Owner Controls: Star Important, Rename */}
                  {isOwner && (
                    <>
                      <button
                        onClick={() => handleToggleImportant(activeConversation.id)}
                        className={`p-1.5 rounded-full hover:bg-white/15 transition-colors cursor-pointer ${
                          activeConversation.important ? 'text-amber-300' : 'text-white'
                        }`}
                        title={activeConversation.important ? "Remove Important star" : "Mark as Important"}
                      >
                        <Star className={`w-4 h-4 ${activeConversation.important ? 'fill-amber-300' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleOpenRenameModal(activeConversation)}
                        className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Rename contact identity"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Rename</span>
                      </button>
                    </>
                  )}

                  {/* Direct Mail Alert Button */}
                  <a
                    href={`mailto:${profileEmail}?subject=Direct%20Portfolio%20Inquiry`}
                    className="p-1.5 hover:bg-white/15 rounded-full text-white transition-colors cursor-pointer"
                    title={`Email ${profileEmail}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>

                  {/* Delete Inquiry Action Button */}
                  <button
                    type="button"
                    disabled={isOwner && (conversations.length === 0 || activeConversation.id === 'inbox-empty')}
                    onClick={(e) => {
                      if (isOwner && (conversations.length === 0 || activeConversation.id === 'inbox-empty')) {
                        setShowMailNotice('No active inquiries in inbox to delete.');
                        return;
                      }
                      handlePromptDelete(activeConversation, e);
                    }}
                    className={`p-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer ${
                      isOwner && (conversations.length === 0 || activeConversation.id === 'inbox-empty')
                        ? 'opacity-40 cursor-not-allowed hover:bg-transparent text-slate-400'
                        : 'hover:bg-red-500/25 text-red-200 hover:text-white'
                    }`}
                    title={
                      isOwner && (conversations.length === 0 || activeConversation.id === 'inbox-empty')
                        ? 'No inquiries to delete'
                        : 'Delete this inquiry thread'
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span className="hidden md:inline text-[11px] font-semibold text-red-100">Delete</span>
                  </button>

                  {/* Header Size / Density Settings (Owner Only) */}
                  {isOwner && (
                    <button
                      onClick={() => setShowHeaderSettings(!showHeaderSettings)}
                      className="p-1.5 hover:bg-white/15 rounded-full text-white transition-colors cursor-pointer"
                      title="Adjust header density"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Density Bar (Owner Only) */}
              {isOwner && showHeaderSettings && (
                <div className="bg-[#1a2533] px-4 py-1.5 text-white flex items-center justify-between text-[11px] font-medium border-b border-slate-700 animate-fade-in">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-cyan-200" />
                    Adjust Profile Icon &amp; Header Density:
                  </span>
                  <div className="flex items-center gap-1.5 bg-black/30 p-0.5 rounded-md">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setHeaderAvatarSize(size)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                          headerAvatarSize === size
                            ? 'bg-white text-[#243346] shadow-xs'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {size === 'sm' ? 'Compact' : size === 'md' ? 'Default' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* VISITOR PERSONA STATUS BANNER */}
              {!isOwner && (
                <div className="bg-[#e4ebf3] border-b border-[#b8c6d4] px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs text-slate-700 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-300 border border-slate-400 shrink-0 flex items-center justify-center font-bold text-[10px] text-white shadow-2xs">
                      <div className={`w-full h-full ${visitorProfile.avatarColor || 'bg-slate-700'} flex items-center justify-center`}>
                        {(visitorProfile.name || 'V').charAt(0).toUpperCase()}
                      </div>
                      {visitorProfile.avatarUrl && (
                        <img
                          src={visitorProfile.avatarUrl}
                          alt={visitorProfile.name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="truncate text-[11px]">
                      <span className="text-slate-500 font-medium">Messaging as: </span>
                      <span className="font-bold text-slate-900">{visitorProfile.name || 'Visitor'}</span>
                      {visitorProfile.roleOrCompany && (
                        <span className="text-slate-500 ml-1">· {visitorProfile.roleOrCompany}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVisitorProfileModalOpen(true)}
                    className="text-[11px] text-[#243346] hover:text-black font-bold hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Name &amp; Photo</span>
                  </button>
                </div>
              )}

              {/* SEARCH INTERFACE PANEL */}
              {isSearchOpen && (
                <div className="bg-white border-b border-slate-300 shadow-md p-3 z-15 animate-fade-in font-sans">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search text messages, files, or keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1e88e5]"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                      {(['all', 'messages', 'files'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSearchFilterType(type)}
                          className={`px-2 py-1 rounded capitalize font-medium cursor-pointer ${
                            searchFilterType === type
                              ? 'bg-[#1e88e5] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                      title="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Results */}
                  {searchQuery.trim() && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs mt-1 border-t border-slate-100 pt-1">
                      {searchResults.length === 0 ? (
                        <div className="py-3 text-center text-slate-400 text-xs">
                          No messages or shared files matching "{searchQuery}"
                        </div>
                      ) : (
                        searchResults.map((res, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              if (isOwner) handleSelectConversation(res.convId);
                              setIsSearchOpen(false);
                            }}
                            className="p-2 hover:bg-slate-50 rounded flex items-start justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-cyan-800 text-[11px] block">
                                {isOwner ? `In ${res.convName} (${res.message.timestamp}):` : `Message (${res.message.timestamp}):`}
                              </span>
                              {res.matchedAttachment ? (
                                <div className="flex items-center gap-1.5 text-slate-800 font-medium mt-0.5">
                                  <FileText className="w-3.5 h-3.5 text-cyan-600" />
                                  <span>{res.matchedAttachment.name}</span>
                                  <span className="text-[10px] text-slate-400">({res.matchedAttachment.size})</span>
                                </div>
                              ) : (
                                <p className="text-slate-700 truncate mt-0.5">{res.message.text}</p>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded shrink-0">
                              View
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TOPIC SUGGESTIONS CHIPS BAR */}
              <div className="bg-[#f0f4f2] px-3 py-1.5 border-b border-[#d0ded7] flex items-center gap-1.5 overflow-x-auto text-[11px] font-sans shrink-0">
                <span className="text-slate-500 font-bold uppercase tracking-wider shrink-0 text-[10px]">
                  Topics:
                </span>
                {TOPIC_SUGGESTIONS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickTopicChip(chip)}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-[#243346] hover:text-white text-slate-700 border border-[#b8c6d4] transition-colors whitespace-nowrap cursor-pointer shadow-xs font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* 2. CHAT FEED BODY */}
              <div
                className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 font-sans relative text-[0.95em]"
                style={{
                  backgroundColor: '#dce1e8',
                  backgroundImage: `radial-gradient(#c5ccd6 1px, transparent 1px)`,
                  backgroundSize: '18px 18px'
                }}
              >
                {/* Date Badge */}
                <div className="flex justify-center my-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-900/15 backdrop-blur-xs text-slate-700 text-[10px] font-bold shadow-xs">
                    DIRECT CHANNEL
                  </span>
                </div>

                {/* Empty State Welcome Card for Visitor (when no messages sent yet) */}
                {activeConversation.messages.length === 0 && (
                  <div className="my-8 max-w-md mx-auto p-4 rounded-2xl bg-white/90 backdrop-blur-xs border border-slate-300 text-center space-y-2 shadow-xs">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center mx-auto">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Direct Messaging with Festus Johnson
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Send a message, design review request, voice note, or project specification below. Messages are delivered directly to Festus's private inbox.
                    </p>
                  </div>
                )}

                {activeConversation.messages.map((msg) => {
                  // For public visitor: 'festus' is incoming (left side), 'visitor' is outgoing (right side)
                  // For owner Festus: 'festus' is outgoing (right side), 'visitor' is incoming (left side)
                  const isLeft = isOwner ? msg.sender === 'visitor' : msg.sender === 'festus';

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isLeft ? 'justify-start' : 'justify-end'}`}
                    >
                      {/* Left Avatar */}
                      {isLeft && (
                        <div className="relative w-6.5 h-6.5 rounded-full overflow-hidden bg-slate-300 shrink-0 mb-0.5 shadow-xs border border-white flex items-center justify-center text-[10px] font-bold text-white">
                          <span className={`${activeConversation.avatarColor || 'bg-slate-700'} w-full h-full flex items-center justify-center`}>
                            {(activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel || 'V').charAt(0).toUpperCase()}
                          </span>
                          {!isOwner ? (
                            <img
                              src={profileAvatar}
                              alt={profileName}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : activeConversation.avatarUrl ? (
                            <img
                              src={activeConversation.avatarUrl}
                              alt={activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : null}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-md md:max-w-lg px-3 py-2 rounded-xl text-[11.5px] sm:text-[12.5px] leading-snug shadow-xs relative group/msg ${
                          isLeft
                            ? 'bg-white text-slate-900 rounded-bl-xs border border-slate-200'
                            : 'bg-[#dcf8c6] text-slate-950 rounded-br-xs border border-[#c4e8aa]'
                        }`}
                      >
                        {/* Text Content */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                        )}

                        {/* Voice Note Player */}
                        {msg.voiceNote && (
                          <div className="my-1">
                            <VoiceNotePlayer
                              voiceNote={msg.voiceNote}
                              isSender={!isLeft}
                              senderName={isLeft ? (isOwner ? (activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel) : profileName) : undefined}
                            />
                          </div>
                        )}

                        {/* Shared Files & Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2 pt-1.5 border-t border-black/10">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="p-2 rounded-xl bg-black/5 flex flex-col gap-2 text-xs border border-black/10 overflow-hidden"
                              >
                                {/* Image Preview Card */}
                                {att.type === 'image' && att.url && (
                                  <div className="w-full max-h-56 overflow-hidden rounded-lg bg-slate-900/10 flex items-center justify-center relative group/img">
                                    <img
                                      src={att.url}
                                      alt={att.name}
                                      className="max-h-56 w-full object-contain cursor-pointer hover:scale-102 transition-transform"
                                      onClick={() => setSelectedChatImage(att.url!)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setSelectedChatImage(att.url!)}
                                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover/img:opacity-100 transition-opacity text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Expand</span>
                                    </button>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {att.type === 'pdf' ? (
                                      <FileText className="w-4 h-4 text-red-600 shrink-0" />
                                    ) : att.type === 'cad' ? (
                                      <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
                                    ) : (
                                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-semibold truncate text-[11px] text-slate-900" title={att.name}>
                                        {att.name}
                                      </p>
                                      <span className="text-[10px] text-slate-500">{att.size}</span>
                                    </div>
                                  </div>

                                  {/* Download / View Button */}
                                  {att.url ? (
                                    <a
                                      href={att.url}
                                      download={att.name}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] bg-[#243346] hover:bg-[#1a2533] text-white font-bold px-2.5 py-1 rounded-lg shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                                      title={`Download ${att.name}`}
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Download</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-[#243346] font-bold bg-white/80 px-1.5 py-0.5 rounded shadow-xs shrink-0">
                                      Shared File
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timestamp, Seen/Unseen Checkmark Indicators, and Delete Message action */}
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500 font-mono">
                          <span>{msg.timestamp}</span>

                          {msg.status === 'seen' ? (
                            <span
                              className="text-[#243346] font-bold text-xs"
                              title="Seen (marked twice)"
                            >
                              ✓✓
                            </span>
                          ) : (
                            <span
                              className="text-slate-400 font-bold text-xs"
                              title="Delivered (marked once)"
                            >
                              ✓
                            </span>
                          )}

                          {/* Quick Message Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(activeConversation.id, msg.id)}
                            className="opacity-0 group-hover/msg:opacity-100 p-0.5 hover:bg-black/10 rounded text-slate-400 hover:text-red-600 transition-opacity cursor-pointer"
                            title="Delete this message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Right Avatar for Visitor */}
                      {!isLeft && !isOwner && (
                        <div className="relative w-6.5 h-6.5 rounded-full overflow-hidden bg-slate-300 shrink-0 mb-0.5 shadow-xs border border-white flex items-center justify-center text-[10px] font-bold text-white">
                          <span className={`${visitorProfile.avatarColor || 'bg-slate-700'} w-full h-full flex items-center justify-center`}>
                            {(visitorProfile.name || 'V').charAt(0).toUpperCase()}
                          </span>
                          {visitorProfile.avatarUrl && (
                            <img
                              src={visitorProfile.avatarUrl}
                              alt={visitorProfile.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Scroll Anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* ATTACHMENTS PREVIEW QUEUE */}
              {attachedFiles.length > 0 && (
                <div className="px-3 py-1.5 bg-[#e2e8f0] border-t border-slate-300 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-slate-600 font-semibold text-[11px] shrink-0">
                    Ready to send:
                  </span>
                  {attachedFiles.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-300 shadow-xs"
                    >
                      <FileText className="w-3 h-3 text-[#243346]" />
                      <span className="text-[11px] max-w-[120px] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. COMPACT BOTTOM INPUT BAR & SEND / VOICE RECORDING BUTTONS */}
              {isRecording ? (
                /* LIVE VOICE RECORDING BAR */
                <div className="bg-[#fdedeb] p-2 sm:p-2.5 border-t border-red-200 shrink-0 animate-fade-in flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse shrink-0" />
                    <span className="text-xs font-mono font-bold text-red-700 whitespace-nowrap">
                      REC {formatDuration(recordingSeconds)}
                    </span>
                    {/* Animated sound wave bars */}
                    <div className="hidden sm:flex items-center gap-1 h-5">
                      {[10, 18, 12, 22, 16, 20, 14, 24, 12, 16].map((h, i) => (
                        <span
                          key={i}
                          style={{
                            height: `${h}px`,
                            animationDelay: `${i * 120}ms`
                          }}
                          className="w-1 bg-red-500 rounded-full animate-bounce"
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-red-600 truncate hidden md:inline">
                      Recording voice note...
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="px-3 py-1.5 rounded-lg border border-red-300 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Discard recording"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopAndSendVoiceRecording}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Send voice note"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Note</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* STANDARD MESSAGE & ATTACHMENT INPUT BAR */
                <div className="bg-[#f0f2f5] p-2 sm:p-2.5 border-t border-[#d0ded7] shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
                    
                    {/* File Attachment Button */}
                    <div className="relative">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        multiple
                        className="hidden"
                        id="chat-file-input"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full hover:bg-slate-200 text-[#243346] transition-colors cursor-pointer shrink-0"
                        title="Attach documents, CAD files or images"
                      >
                        <Paperclip className="w-4 h-4 text-[#243346]" />
                      </button>
                    </div>

                    {/* Microphone Voice Note Button */}
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="p-2 rounded-full hover:bg-slate-200 text-[#243346] transition-colors cursor-pointer shrink-0"
                      title="Record Voice Note"
                    >
                      <Mic className="w-4 h-4 text-[#243346]" />
                    </button>

                    {/* Quick Demo Audio Button for quick testing */}
                    <button
                      type="button"
                      onClick={handleSendDemoAudio}
                      className="hidden md:inline-flex p-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[10px] font-bold items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      title="Send sample voice memo"
                    >
                      <Volume2 className="w-3 h-3 text-[#243346]" />
                      <span>Audio Memo</span>
                    </button>

                    {/* Message Input Box */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={
                          isOwner
                            ? `Reply to ${activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel} as Festus...`
                            : `Type message to Festus Johnson...`
                        }
                        value={inputMessage}
                        onChange={(e) => updateInputMessage(e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#243346] shadow-xs pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => updateInputMessage(inputMessage + ' ⚙️ ')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Engineering symbol"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Compact Message Send Button */}
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() && attachedFiles.length === 0}
                      className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs ${
                        inputMessage.trim() || attachedFiles.length > 0
                          ? 'bg-[#243346] hover:bg-[#1a2533] text-white'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                      title="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-xs">Send</span>
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* ======================================================== */}
        {/* RENAME CONTACT IDENTITY MODAL (OWNER ONLY)               */}
        {/* ======================================================== */}
        {editingConv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 relative">
              <button
                onClick={() => setEditingConv(null)}
                className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#243346]/15 text-[#243346] flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Rename Identity</h3>
                  <p className="text-[11px] text-slate-500">Currently: {editingConv.defaultLabel}</p>
                </div>
              </div>

              <form onSubmit={handleSaveContactName} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Name / Company
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins (Tesla Robotics)"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#243346]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Inquiry Topic / Role (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Hardware Engineer Consultation"
                    value={editRoleInput}
                    onChange={(e) => setEditRoleInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#243346]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingConv(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-[#243346] hover:bg-[#1a2533] text-white font-bold cursor-pointer"
                  >
                    Save Name
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VISITOR CLEAR CHAT CONFIRMATION MODAL                   */}
        {/* ======================================================== */}
        {isVisitorClearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 relative">
              <button
                onClick={() => setIsVisitorClearModalOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-cyan-50 text-[#243346] flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Clear Chat Screen?</h3>
                  <p className="text-[11px] text-slate-500">Restart with a fresh conversation</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 mb-4 leading-relaxed space-y-2">
                <p>
                  You can choose to <strong>remain in this conversation</strong> or <strong>clear your screen</strong> for a fresh start.
                </p>
                <div className="text-slate-600 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-normal">
                  🔒 <strong>Note:</strong> Clearing your chat only resets your personal screen. All messages and voice notes you sent remain safely delivered to Festus in his inquiries inbox.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVisitorClearModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs"
                >
                  Remain in Chat
                </button>
                <button
                  type="button"
                  onClick={handleVisitorClearChat}
                  className="px-3.5 py-1.5 rounded-lg bg-[#243346] hover:bg-[#1a2533] text-white font-bold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Screen</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VISITOR MESSAGING PROFILE MODAL (PICTURE & NAME EDIT)    */}
        {/* ======================================================== */}
        <VisitorProfileModal
          isOpen={isVisitorProfileModalOpen}
          onClose={() => setIsVisitorProfileModalOpen(false)}
          currentProfile={visitorProfile}
          onSave={handleSaveVisitorProfile}
          visitorId={visitorId}
          isMandatory={!isOwner && !visitorId}
        />

        {/* ======================================================== */}
        {/* RESUME / CONTINUE CONVERSATION MODAL (VISITOR RECONNECT)  */}
        {/* Enables visitor to continue chat even after leaving group */}
        {/* ======================================================== */}
        {isResumeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full p-5 relative">
              <button
                type="button"
                onClick={() => {
                  setIsResumeModalOpen(false);
                  setResumeError(null);
                }}
                className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Continue Conversation</h3>
                  <p className="text-xs text-slate-500">Pick up where you left off with Festus</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-3.5 leading-relaxed">
                Leaving the group or changing pages never erases your messages. All messages are securely saved. Reconnect using your <strong>Visitor Session ID</strong>, your <strong>Name</strong>, or <strong>Email</strong>.
              </p>

              {/* Current Visitor Session Chip */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span>YOUR CURRENT SESSION ID:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(visitorId);
                      setCopiedVisitorId(true);
                      setTimeout(() => setCopiedVisitorId(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                  >
                    {copiedVisitorId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
                <code className="block text-xs font-mono font-bold text-slate-800 select-all bg-white px-2 py-1 rounded border border-slate-200 truncate">
                  {visitorId}
                </code>
              </div>

              <form onSubmit={handleResumeConversation} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Previous Session ID or Name:
                  </label>
                  <input
                    type="text"
                    value={resumeInput}
                    onChange={(e) => setResumeInput(e.target.value)}
                    placeholder="e.g. visitor-172... or John Smith"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    autoFocus
                  />
                </div>

                {resumeError && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {resumeError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResumeModalOpen(false);
                      setResumeError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Reconnect &amp; Continue</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* DELETE CONVERSATION CONFIRMATION MODAL (OWNER ONLY)       */}
        {/* ======================================================== */}
        {deletingConv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 relative">
              <button
                onClick={() => setDeletingConv(null)}
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
                    {deletingConv.messages && deletingConv.messages.length > 0 ? 'Delete Inquiry Thread?' : 'Reset Inquiry Channel?'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate font-semibold">
                    {deletingConv.visitorName ? `${deletingConv.visitorName} (${deletingConv.defaultLabel})` : (deletingConv.customName ? `${deletingConv.customName} (${deletingConv.defaultLabel})` : deletingConv.defaultLabel)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                {deletingConv.messages && deletingConv.messages.length > 0 ? (
                  <>
                    Are you sure you want to permanently delete this inquiry (<strong>{deletingConv.visitorName || deletingConv.customName || deletingConv.defaultLabel}</strong>) and all its {deletingConv.messages.length} message{deletingConv.messages.length === 1 ? '' : 's'}? This cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to reset this inquiry session and clear all unsent message drafts and attachments?
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingChat}
                  onClick={() => setDeletingConv(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingChat}
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isDeletingChat ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingConv.messages && deletingConv.messages.length > 0 ? 'Delete Permanently' : 'Reset & Clear'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FULL-SCREEN CHAT IMAGE LIGHTBOX MODAL                     */}
        {/* ======================================================== */}
        {selectedChatImage && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
              <button
                onClick={() => setSelectedChatImage(null)}
                className="absolute -top-10 right-0 p-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Close Lightbox"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedChatImage}
                alt="Shared Image Full Resolution"
                className="max-h-[80vh] max-w-full object-contain rounded-2xl border border-slate-700 shadow-2xl"
              />
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={selectedChatImage}
                  download="shared_image.png"
                  className="px-4 py-2 rounded-xl bg-[#243346] hover:bg-[#1a2533] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image</span>
                </a>
                <button
                  onClick={() => setSelectedChatImage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
