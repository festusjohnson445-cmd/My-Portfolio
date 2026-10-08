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
  Loader2,
  AlertTriangle
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
  subscribeToSupabaseMessagesRealtime,
  generateDeterministicConversationId,
  getOrFetchOwnerId,
  ensureValidUuid,
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
  sender_id?: string;
  receiver_id?: string;
  conversation_id?: string;
  content?: string;
  text: string;
  timestamp: string;
  status: 'seen' | 'unseen';
  attachments?: ChatAttachment[];
  voiceNote?: VoiceNoteData;
  created_at?: string;
}

export interface Conversation {
  id: string;
  visitorId?: string;
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
    const savedName = localStorage.getItem('display_name');
    const saved = localStorage.getItem(STORAGE_KEY_VISITOR_PROFILE) || localStorage.getItem('visitor_profile');
    if (saved) {
      const p = JSON.parse(saved);
      if (p && typeof p === 'object') {
        return {
          name: savedName || (typeof p.name === 'string' ? p.name : 'Visitor'),
          roleOrCompany: p.roleOrCompany || 'Visitor Direct Chat',
          avatarUrl: p.avatarUrl || '',
          avatarColor: p.avatarColor || 'bg-slate-700',
        };
      }
    }
    if (savedName) {
      return {
        name: savedName,
        roleOrCompany: 'Visitor Direct Chat',
        avatarUrl: '',
        avatarColor: 'bg-slate-700',
      };
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

// Helper to get stored visitor_id from localStorage (lazy creation - never generates on page load)
const getStoredVisitorId = (): string => {
  try {
    return localStorage.getItem('visitor_id') || localStorage.getItem(STORAGE_KEY_VISITOR_ID) || '';
  } catch {
    return '';
  }
};

// Helper to get stored single-thread conversation_id ('conv_' + visitor_id)
const getStoredConversationId = (vId?: string): string => {
  try {
    const v = vId || getStoredVisitorId();
    if (v) return `conv_${v}`;
    return localStorage.getItem('conversation_id') || '';
  } catch {
    return '';
  }
};

// Helper to generate RFC4122 v4 compliant UUID for message IDs to satisfy Supabase uuid type constraint
const generateMessageId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return ensureValidUuid(`msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
};

interface MessagingSectionProps {
  onBack?: () => void;
}

export const MessagingSection: React.FC<MessagingSectionProps> = ({ onBack }) => {
  const { avatar: profileAvatar, bio, isOwner, setOwner, ownerUid } = useProfileSync();
  const profileName = bio.fullName || 'Festus, Olorunsogo Johnson';
  const profileEmail = bio.email || 'festusjohnson028@gmail.com';

  // Master persistent multi-chat database (strictly isolated between owner panel and visitor sessions)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      if (isOwner) {
        const saved = localStorage.getItem(STORAGE_KEY_CHATS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const deletedRaw = localStorage.getItem('fesline_deleted_conv_ids');
            const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
            return parsed.filter((c: any) => c && c.id && !deletedSet.has(c.id));
          }
        }
      } else {
        // Strict Session & Identity Isolation with Page Reload Preservation
        // For existing visitors who have a stored visitor_id on this device: preserve their active chat session
        // For new visitors with no stored visitor_id: initialize as clean, empty state
        const vId = getStoredVisitorId();
        if (vId) {
          const scopedChat = localStorage.getItem(`fesline_visitor_chat_${vId}`);
          if (scopedChat) {
            const parsed = JSON.parse(scopedChat);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      }
    } catch {}
    return DEFAULT_CONVERSATIONS;
  });

  // For visitor: messaging profile state (picture, name, role)
  const [visitorProfile, setVisitorProfile] = useState<VisitorMessagingProfile>(getInitialVisitorProfile);
  const [isVisitorProfileModalOpen, setIsVisitorProfileModalOpen] = useState(false);

  // Lazy Visitor ID & Conversation State (Only populated after visitor logs in via InChat)
  const [visitorId, setVisitorId] = useState<string>(() => getStoredVisitorId());
  const [conversationId, setConversationId] = useState<string>(() => getStoredConversationId());
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string>(() => ownerUid || localStorage.getItem('fesline_owner_supabase_uid') || 'f4c47b59-42b4-4b5a-8bdf-87f53945a6c1');
  const myDeterministicConvId = useMemo(() => conversationId || (visitorId ? `conv_${visitorId}` : generateDeterministicConversationId(visitorId || 'guest', resolvedOwnerId)), [conversationId, visitorId, resolvedOwnerId]);

  // Login tooltip on send button when unauthenticated visitor tries to send
  const [loginTooltipVisible, setLoginTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<any>(null);

  // Trigger visual tooltip alert directly from the Send button
  const triggerLoginPrompt = () => {
    setLoginTooltipVisible(true);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setLoginTooltipVisible(false);
    }, 4500);
  };

  // Check whether current visitor has logged in / set up profile via InChat
  const isVisitorLoggedIn = Boolean(
    visitorId && (
      (visitorProfile.name && visitorProfile.name.trim() !== '' && visitorProfile.name !== 'Visitor') ||
      (typeof localStorage !== 'undefined' && (localStorage.getItem('display_name') || localStorage.getItem('role_subject')))
    )
  );

  useEffect(() => {
    getOrFetchOwnerId().then((uid) => {
      if (uid) setResolvedOwnerId(uid);
    }).catch(err => console.error('[Supabase Owner Fetch Error]:', err));
  }, [ownerUid]);

  // Initial useEffect hook on component mount:
  // Requirement 4 & 5: Strict Session Isolation & Reliable State Synchronization
  // 3. TWO-WAY DELIVERY & PAGE RELOAD PRESERVATION:
  // On component mount (useEffect), automatically fetch the complete message history
  // directly from Supabase for the active conversation_id ordered by created_at ASC.
  useEffect(() => {
    if (isOwner) return;

    const savedVId = localStorage.getItem('visitor_id') || localStorage.getItem(STORAGE_KEY_VISITOR_ID) || localStorage.getItem('fesline_visitor_access_key') || '';
    const savedDisplayName = localStorage.getItem('display_name') || 'Visitor';

    // If no saved visitor_id in localStorage, visitor receives a clean initial state
    if (!savedVId) {
      setMessages([]);
      setConversations([]);
      return;
    }

    const initAndFetchVisitorSession = async () => {
      try {
        const savedCId = localStorage.getItem('conversation_id') || `conv_${savedVId}`;
        const ownerId = await getOrFetchOwnerId();

        if (savedVId !== visitorId) setVisitorId(savedVId);
        if (savedCId !== conversationId) setConversationId(savedCId);

        setVisitorProfile((prev) => ({ ...prev, name: savedDisplayName }));

        // Fetch remote visitor profile
        try {
          const p = await fetchVisitorProfileFromSupabase(savedVId);
          if (p) {
            const updatedProf = {
              name: p.name || savedDisplayName || 'Visitor',
              roleOrCompany: p.roleOrCompany || 'Visitor Direct Chat',
              avatarUrl: p.avatarUrl || '',
              avatarColor: p.avatarColor || 'bg-slate-700',
            };
            setVisitorProfile(updatedProf);
            try {
              localStorage.setItem(STORAGE_KEY_VISITOR_PROFILE, JSON.stringify(updatedProf));
              localStorage.setItem('display_name', updatedProf.name);
            } catch {}
          }
        } catch (profileErr) {
          console.error('[Supabase Initial Profile Fetch Error]:', profileErr);
        }

        // Direct fetch strictly matching active conversation_id with ORDER BY created_at ASC
        try {
          let { data: dbMessages, error: dbMsgError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', savedCId)
            .order('created_at', { ascending: true });

          // Fallback if messages were recorded with raw visitor_id as conversation_id
          if (!dbMsgError && (!dbMessages || dbMessages.length === 0)) {
            const { data: altMsgs } = await supabase
              .from('messages')
              .select('*')
              .or(`conversation_id.eq.${savedVId},sender_id.eq.${savedVId},receiver_id.eq.${savedVId}`)
              .order('created_at', { ascending: true });
            if (altMsgs && altMsgs.length > 0) {
              dbMessages = altMsgs;
            }
          }

          if (dbMsgError) {
            console.error('[Supabase Initial Messages Fetch Error]:', dbMsgError);
          } else if (dbMessages && Array.isArray(dbMessages)) {
            const mappedMessages: ChatMessage[] = dbMessages.map((m: any) => {
              const isOwnerMsg = m.sender === 'festus' || m.sender_id === 'festus' || m.sender_id === ownerId;
              return {
                id: m.id || generateMessageId(),
                sender: isOwnerMsg ? 'festus' : 'visitor',
                sender_id: m.sender_id || (isOwnerMsg ? ownerId : savedVId),
                receiver_id: m.receiver_id || (isOwnerMsg ? savedVId : ownerId),
                conversation_id: savedCId,
                text: m.content || m.text || '',
                timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                status: m.status || (isOwnerMsg ? 'seen' : 'unseen'),
                attachments: m.attachments || undefined,
                voiceNote: m.voice_note || m.voiceNote || undefined,
                created_at: m.created_at || new Date().toISOString(),
              };
            });

            // Strict Timestamp Sorting
            mappedMessages.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

            // Set single unified messages array strictly scoped to this visitor
            setMessages(mappedMessages);

            const lastMsg = mappedMessages[mappedMessages.length - 1];
            const updatedConv: Conversation = {
              id: savedCId,
              visitorId: savedVId,
              defaultLabel: savedDisplayName || visitorProfile.name || 'Direct Message',
              customName: savedDisplayName || visitorProfile.name || '',
              visitorName: savedDisplayName || visitorProfile.name || '',
              avatarUrl: visitorProfile.avatarUrl || '',
              roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
              avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
              unread: false,
              important: false,
              messages: mappedMessages,
              lastMessage: lastMsg?.text || (lastMsg?.voiceNote ? '🎤 Voice note' : (lastMsg?.attachments?.length ? `📎 ${lastMsg.attachments[0].name}` : 'Message')),
              lastTimestamp: lastMsg?.timestamp || '',
            };

            setConversations([updatedConv]);
            try {
              localStorage.setItem(`fesline_visitor_chat_${savedVId}`, JSON.stringify([updatedConv]));
            } catch {}
          }
        } catch (fetchMsgErr) {
          console.error('[Supabase Initial Message Query Exception]:', fetchMsgErr);
        }
      } catch (err) {
        console.error('[Visitor Session Setup Exception]:', err);
      }
    };

    initAndFetchVisitorSession();
  }, [isOwner]);

  // Visitor Resume / Continue Chat modal states
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [resumeInput, setResumeInput] = useState('');
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [copiedVisitorId, setCopiedVisitorId] = useState(false);
  const [dbWriteError, setDbWriteError] = useState<string | null>(null);

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

  // 1. Unified Single Array State:
  // Store all chat messages (both owner sent messages and visitor received messages) inside a single React state array (messages).
  // Never maintain separate arrays for sent vs. received messages or concatenate them manually.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const initialConv = conversations[0];
      if (initialConv?.messages && Array.isArray(initialConv.messages)) {
        return [...initialConv.messages].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      }
    } catch {}
    return [];
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

  // Active conversation thread reference anchors for Realtime subscription closures
  const activeOwnerConvIdRef = useRef(activeOwnerConvId);
  useEffect(() => { activeOwnerConvIdRef.current = activeOwnerConvId; }, [activeOwnerConvId]);
  const isOwnerRef = useRef(isOwner);
  useEffect(() => { isOwnerRef.current = isOwner; }, [isOwner]);
  const visitorIdRef = useRef(visitorId);
  useEffect(() => { visitorIdRef.current = visitorId; }, [visitorId]);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // Fetch chats from server (isolated: Owner sees all threads, Visitor only sees their own thread)
  const fetchChatsFromServer = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const inOwnerMode = isOwnerRef.current;

      // 4. Strict Session & Identity Isolation for Visitors:
      // For New Visitors: Initialize the chat view as a clean, empty state.
      // Do not automatically load or associate any existing conversation until InChat profile setup or valid token.
      if (!inOwnerMode) {
        const currVisId = visitorIdRef.current;
        const currCId = conversationIdRef.current || (currVisId ? `conv_${currVisId}` : '');
        const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('display_name') : null;

        if (!currVisId || !savedName || savedName === 'Visitor') {
          return;
        }

        try {
          const ownerId = await getOrFetchOwnerId();
          const safeCId = ensureValidUuid(currCId);

          // 2 & 5. Reliable State Synchronization & Strict Timestamp Sorting:
          // Query Supabase directly using ORDER BY created_at ASC
          const { data: dbMessages, error: dbMsgError } = await supabase
            .from('messages')
            .select('*')
            .or(`conversation_id.eq.${currCId},conversation_id.eq.${safeCId},conversation_id.eq.conv_${currVisId},conversation_id.eq.${currVisId},and(sender_id.eq.${currVisId},receiver_id.eq.${ownerId}),and(sender_id.eq.${ownerId},receiver_id.eq.${currVisId})`)
            .order('created_at', { ascending: true });

          if (!dbMsgError && dbMessages && Array.isArray(dbMessages)) {
            const mappedMessages: ChatMessage[] = dbMessages.map((m: any) => {
              const isOwnerMsg = m.sender === 'festus' || m.sender_id === 'festus' || m.sender_id === ownerId;
              return {
                id: m.id || generateMessageId(),
                sender: isOwnerMsg ? 'festus' : 'visitor',
                sender_id: m.sender_id || (isOwnerMsg ? ownerId : currVisId),
                receiver_id: m.receiver_id || (isOwnerMsg ? currVisId : ownerId),
                conversation_id: currCId,
                text: m.content || m.text || '',
                timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                status: m.status || (isOwnerMsg ? 'seen' : 'unseen'),
                attachments: m.attachments || undefined,
                voiceNote: m.voice_note || m.voiceNote || undefined,
                created_at: m.created_at || new Date().toISOString(),
              };
            });

            // Strict Timestamp Sorting
            mappedMessages.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

            // 1. Unified Single Array State
            setMessages((prevMsgs) => {
              const msgMap = new Map<string, ChatMessage>();
              for (const em of prevMsgs) if (em?.id) msgMap.set(em.id, em);
              for (const mm of mappedMessages) if (mm?.id) msgMap.set(mm.id, mm);
              const unified = Array.from(msgMap.values());
              unified.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
              return unified;
            });

            const lastMsg = mappedMessages[mappedMessages.length - 1];
            const updatedConv: Conversation = {
              id: currCId,
              visitorId: currVisId,
              defaultLabel: savedName || visitorProfile.name || 'Direct Message',
              customName: savedName || visitorProfile.name || '',
              visitorName: savedName || visitorProfile.name || '',
              avatarUrl: visitorProfile.avatarUrl || '',
              roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
              avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
              unread: false,
              important: false,
              messages: mappedMessages,
              lastMessage: lastMsg?.text || (lastMsg?.voiceNote ? '🎤 Voice note' : (lastMsg?.attachments?.length ? `📎 ${lastMsg.attachments[0].name}` : '')),
              lastTimestamp: lastMsg?.timestamp || '',
            };

            setConversations([updatedConv]);
            try {
              localStorage.setItem(`fesline_visitor_chat_${currVisId}`, JSON.stringify([updatedConv]));
            } catch {}
          }
        } catch (visSyncErr) {
          console.warn('[Visitor Chat Sync Warning]:', visSyncErr);
        }
        return;
      }

      // Owner Mode: Synchronize all conversation threads for the Owner inbox panel
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

          // Sync unified messages state for the active conversation thread
          const currOwnerId = activeOwnerConvIdRef.current;
          const activeConvTarget = finalConvs.find((c) => c.id === currOwnerId || c.visitorId === currOwnerId.replace(/^conv_/, ''));

          if (activeConvTarget?.messages && Array.isArray(activeConvTarget.messages)) {
            setMessages((prevMsgs) => {
              const msgMap = new Map<string, ChatMessage>();
              for (const m of prevMsgs) if (m?.id) msgMap.set(m.id, m);
              for (const m of activeConvTarget.messages) if (m?.id) msgMap.set(m.id, m);
              const unified = Array.from(msgMap.values());
              unified.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
              return unified;
            });
          }

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

    // 3-second live sync interval for Vercel and multi-tab sync
    const syncInterval = setInterval(() => {
      fetchChatsFromServer();
    }, 3000);

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', fetchChatsFromServer);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(syncInterval);
      unsubSupabaseDbStream();
      if (sseSource) sseSource.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', fetchChatsFromServer);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 3. Dedicated Realtime Messaging & Inbox Subscription Effect:
  // Re-subscribes whenever isOwner, conversationId, or visitorId changes to guarantee cross-browser delivery
  useEffect(() => {
    fetchChatsFromServer();

    // 3. Global Realtime Inbox Subscription:
    // In Owner Panel, subscribes globally to all row insertions on public.messages and public.conversations
    // using supabase.channel('global-owner-inbox') without scoping filter to a single active conversation ID
    const currentActiveConvId = isOwner ? undefined : (conversationId || `conv_${visitorId}`);

    const unsubMessagesStream = subscribeToSupabaseMessagesRealtime({
      conversationId: currentActiveConvId,
      isOwner,
      onNewConversation: (convRow) => {
        if (!isOwnerRef.current) return;
        const targetId = convRow.id;
        const vId = convRow.visitor_id || (targetId ? targetId.replace(/^conv_/, '') : '');
        if (!targetId || deletedConvIdsRef.current.has(targetId) || deletedConvIdsRef.current.has(vId)) return;

        setConversations((prev) => {
          if (prev.some((c) => c.id === targetId || c.visitorId === vId)) return prev;
          const newConv: Conversation = {
            id: targetId,
            visitorId: vId,
            defaultLabel: convRow.visitor_name || convRow.display_name || convRow.default_label || 'Visitor',
            customName: convRow.custom_name || '',
            visitorName: convRow.visitor_name || convRow.display_name || 'Visitor',
            avatarUrl: convRow.avatar_url || '',
            avatarColor: convRow.avatar_color || 'bg-slate-700',
            roleOrCompany: convRow.role_or_company || 'Visitor Inquiry',
            unread: true,
            important: false,
            messages: [],
            lastMessage: convRow.last_message || 'New inquiry',
            lastTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          const result = [newConv, ...prev];
          try {
            localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(result));
          } catch {}
          return result;
        });
      },
      onNewMessage: (msgRow, convId) => {
        const isOwnerMsg = msgRow.sender === 'festus' || msgRow.sender_id === 'festus' || msgRow.sender_id === resolvedOwnerId;
        const rawTargetId = convId || msgRow.conversation_id || msgRow.id;
        if (!rawTargetId) return;

        const targetId = rawTargetId.startsWith('conv_') ? rawTargetId : `conv_${rawTargetId}`;
        const vId = msgRow.visitor_id || targetId.replace(/^conv_/, '');
        if (deletedConvIdsRef.current.has(targetId) || deletedConvIdsRef.current.has(vId)) return;

        const lastMsgText = msgRow.content || msgRow.text || msgRow.last_message || (msgRow.voice_note || msgRow.voiceNote ? '🎤 Voice note' : 'New message');
        const lastTimeStr = msgRow.timestamp || (msgRow.created_at ? new Date(msgRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const newMsgObj: ChatMessage = {
          id: msgRow.id || generateMessageId(),
          sender: isOwnerMsg ? 'festus' : 'visitor',
          sender_id: msgRow.sender_id || (isOwnerMsg ? resolvedOwnerId : vId),
          receiver_id: msgRow.receiver_id || (isOwnerMsg ? vId : resolvedOwnerId),
          conversation_id: targetId,
          text: msgRow.content || msgRow.text || '',
          timestamp: lastTimeStr,
          status: msgRow.status || (isOwnerMsg ? 'seen' : 'unseen'),
          attachments: msgRow.attachments || undefined,
          voiceNote: msgRow.voice_note || msgRow.voiceNote || undefined,
          created_at: msgRow.created_at || new Date().toISOString(),
        };

        // 1. FIX REALTIME MESSAGE APPENDING & CHRONOLOGICAL INTERLEAVING:
        // Combine previous and new messages, deduplicate, and strictly re-sort chronologically:
        // messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const curOwnerConvId = activeOwnerConvIdRef.current;
        const curVisId = visitorIdRef.current;
        const curConvId = conversationIdRef.current;
        const isOwnerView = isOwnerRef.current;

        // Session Isolation: Strictly scope the active message stream to conversation_id === activeConversationId
        const isForActiveThread = isOwnerView
          ? (targetId === curOwnerConvId || vId === curOwnerConvId.replace(/^conv_/, '') || curOwnerConvId === `conv_${vId}` || curOwnerConvId === vId)
          : (targetId === curConvId || targetId === `conv_${curVisId}` || vId === curVisId);

        if (isForActiveThread) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsgObj.id)) return prev;
            const updated = [...prev, newMsgObj];
            return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          });
        }

        // 3. Dynamic Inbox Update:
        // When a message arrives from ANY visitor_id (new or existing), dynamically update
        // or insert that entry at the top of the Owner's "Visitor Inquiries" list in real time
        setConversations((prev) => {
          const existingIdx = prev.findIndex((c) => c.id === targetId || c.id === `conv_${vId}` || c.visitorId === vId || c.id === vId);

          if (existingIdx >= 0) {
            const existing = prev[existingIdx];
            let updatedMsgs = existing.messages || [];

            if (!updatedMsgs.some((m) => m.id === newMsgObj.id)) {
              updatedMsgs = [...updatedMsgs, newMsgObj];
              updatedMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            }

            const updatedConv: Conversation = {
              ...existing,
              id: targetId,
              visitorId: vId,
              lastMessage: lastMsgText,
              lastTimestamp: lastTimeStr,
              unread: isOwnerMsg ? existing.unread : true,
              messages: updatedMsgs,
            };

            // Move updated conversation to top of the inquiries list
            const remaining = prev.filter((_, idx) => idx !== existingIdx);
            const result = [updatedConv, ...remaining];

            try {
              if (isOwnerView) {
                localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(result));
              } else {
                localStorage.setItem(`fesline_visitor_chat_${vId}`, JSON.stringify([updatedConv]));
              }
            } catch {}
            return result;
          } else {
            // Add as a single new entry at top of inquiries list
            const newConv: Conversation = {
              id: targetId,
              visitorId: vId,
              defaultLabel: msgRow.display_name || msgRow.visitorName || msgRow.sender_name || 'Visitor',
              customName: msgRow.display_name || msgRow.visitorName || '',
              visitorName: msgRow.display_name || msgRow.visitorName || 'Visitor',
              avatarUrl: msgRow.avatar_url || '',
              avatarColor: msgRow.avatar_color || 'bg-slate-700',
              roleOrCompany: msgRow.role_subject || msgRow.role_or_company || 'Visitor Inquiry',
              unread: !isOwnerMsg,
              important: false,
              lastMessage: lastMsgText,
              lastTimestamp: lastTimeStr,
              messages: [newMsgObj],
            };

            const result = [newConv, ...prev];
            try {
              if (isOwnerView) {
                localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(result));
              } else {
                localStorage.setItem(`fesline_visitor_chat_${vId}`, JSON.stringify([newConv]));
              }
            } catch {}
            return result;
          }
        });
      },
    });

    // Supabase Realtime Channel Subscription for live broadcast messaging
    const unsubSupabaseRealtime = subscribeToSupabaseRealtimeChat((payload) => {
      fetchChatsFromServer();
      if (payload && payload.conversationId && payload.message) {
        const { conversationId: payloadCId, message } = payload;
        const vId = payloadCId.startsWith('conv_') ? payloadCId.replace(/^conv_/, '') : payloadCId;

        const isOwnerMsg = message.sender === 'festus' || message.sender_id === 'festus' || message.sender_id === resolvedOwnerId;
        const newRealtimeMsg: ChatMessage = {
          id: message.id || generateMessageId(),
          sender: isOwnerMsg ? 'festus' : 'visitor',
          sender_id: message.sender_id || (isOwnerMsg ? resolvedOwnerId : vId),
          receiver_id: message.receiver_id || (isOwnerMsg ? vId : resolvedOwnerId),
          conversation_id: payloadCId,
          text: message.text || '',
          timestamp: message.timestamp || (message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          status: message.status || (isOwnerMsg ? 'seen' : 'unseen'),
          attachments: message.attachments || undefined,
          voiceNote: message.voiceNote || undefined,
          created_at: message.created_at || new Date().toISOString(),
        };

        const curOwnerConvId = activeOwnerConvIdRef.current;
        const curVisId = visitorIdRef.current;
        const curConvId = conversationIdRef.current;
        const isOwnerView = isOwnerRef.current;

        const isForActiveThread = isOwnerView
          ? (payloadCId === curOwnerConvId || vId === curOwnerConvId.replace(/^conv_/, '') || curOwnerConvId === `conv_${vId}` || curOwnerConvId === vId)
          : (payloadCId === curConvId || payloadCId === `conv_${curVisId}` || vId === curVisId);

        if (isForActiveThread) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRealtimeMsg.id)) return prev;
            const updated = [...prev, newRealtimeMsg];
            return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          });
        }

        setConversations((prev) => {
          if (deletedConvIdsRef.current.has(payloadCId)) return prev;
          const idx = prev.findIndex((c) => c.id === payloadCId || c.id === `conv_${vId}` || c.visitorId === vId || c.id === vId);
          if (idx >= 0) {
            const existing = prev[idx];
            if (existing.messages.some((m) => m.id === message.id)) return prev;
            const updatedMsgs = [...existing.messages, newRealtimeMsg];
            updatedMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

            const updatedConv: Conversation = {
              ...existing,
              unread: message.sender === 'visitor',
              messages: updatedMsgs,
              lastMessage: message.text || (message.voiceNote ? '🎤 Voice note' : 'Attachment'),
              lastTimestamp: message.timestamp,
            };

            const remaining = prev.filter((_, i) => i !== idx);
            const updated = [updatedConv, ...remaining];
            try {
              if (isOwnerView) {
                localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
              } else {
                localStorage.setItem(`fesline_visitor_chat_${vId}`, JSON.stringify(updated));
              }
            } catch {}
            return updated;
          } else if (isOwnerView) {
            const newConv: Conversation = {
              id: payloadCId,
              visitorId: vId,
              defaultLabel: message.sender_name || 'Visitor',
              customName: '',
              visitorName: message.sender_name || 'Visitor',
              avatarUrl: '',
              avatarColor: 'bg-slate-700',
              roleOrCompany: 'Visitor Inquiry',
              unread: !isOwnerMsg,
              important: false,
              lastMessage: message.text || 'New message',
              lastTimestamp: message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              messages: [newRealtimeMsg],
            };
            const updated = [newConv, ...prev];
            try {
              localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated));
            } catch {}
            return updated;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubMessagesStream();
      unsubSupabaseRealtime();
    };
  }, [isOwner, conversationId, visitorId]);

  // Active conversation depending on whether user is Owner or Visitor
  const activeConversation: Conversation = useMemo(() => {
    const sortChronological = (msgs: ChatMessage[]) => {
      return [...msgs].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });
    };

    if (!isOwner) {
      // Find visitor's conversation in master list by conversationId or visitorId
      const targetId = conversationId || myDeterministicConvId;
      const found = conversations.find((c) => c.id === conversationId || c.id === visitorId || c.id === myDeterministicConvId);
      if (found) {
        return {
          ...found,
          id: targetId,
          visitorName: visitorProfile.name || found.visitorName || found.customName,
          customName: visitorProfile.name || found.customName,
          avatarUrl: visitorProfile.avatarUrl !== undefined ? visitorProfile.avatarUrl : found.avatarUrl,
          roleOrCompany: visitorProfile.roleOrCompany || found.roleOrCompany,
          messages: messages.length > 0 ? messages : sortChronological(found.messages || []),
        };
      }
      return {
        id: targetId,
        defaultLabel: visitorProfile.name || 'Direct Message',
        customName: visitorProfile.name || '',
        visitorName: visitorProfile.name || '',
        avatarUrl: visitorProfile.avatarUrl || '',
        roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
        avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
        unread: false,
        important: false,
        messages: messages
      };
    }

    const validOwnerConvs = conversations.filter((c) => c && ((c.messages && c.messages.length > 0) || Boolean(c.lastMessage)));
    const found = validOwnerConvs.find((c) => c.id === activeOwnerConvId);
    if (found) {
      return {
        ...found,
        messages: messages.length > 0 ? messages : sortChronological(found.messages || []),
      };
    }
    const fallback = validOwnerConvs[0];
    if (fallback) {
      return {
        ...fallback,
        messages: messages.length > 0 ? messages : sortChronological(fallback.messages || []),
      };
    }
    return {
      id: 'inbox-empty',
      defaultLabel: 'Inbox',
      roleOrCompany: 'Visitor Inquiries',
      unread: false,
      important: false,
      messages: messages
    };
  }, [isOwner, visitorId, conversationId, myDeterministicConvId, conversations, activeOwnerConvId, visitorProfile, messages]);

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

  // 2. VISITOR SESSION RECOVERY VIA UNIQUE ID:
  // Directly queries Supabase for messages matching restoredConvId ordered by created_at ASC,
  // sets active visitor_id and conversation_id in localStorage, loads fetched array into React state,
  // and subscribes the Realtime listener to that specific conversation_id
  const handleRestoreSessionById = async (targetId: string): Promise<boolean> => {
    setResumeError(null);
    const target = targetId.trim();
    if (!target) {
      setResumeError('Please enter your Visitor Identity Code or access key.');
      return false;
    }

    const cleanVId = target.replace(/^conv_/, '');
    const restoredConvId = `conv_${cleanVId}`;
    const ownerId = await getOrFetchOwnerId();

    try {
      // Direct query Supabase:
      // supabase.from('messages').select('*').eq('conversation_id', restoredConvId).order('created_at', { ascending: true })
      let { data: dbMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', restoredConvId)
        .order('created_at', { ascending: true });

      // Fallback if messages were recorded with clean visitor ID as conversation_id
      if (!msgError && (!dbMessages || dbMessages.length === 0)) {
        const { data: altMsgs } = await supabase
          .from('messages')
          .select('*')
          .or(`conversation_id.eq.${cleanVId},and(sender_id.eq.${cleanVId},receiver_id.eq.${ownerId}),and(sender_id.eq.${ownerId},receiver_id.eq.${cleanVId})`)
          .order('created_at', { ascending: true });
        if (altMsgs && altMsgs.length > 0) {
          dbMessages = altMsgs;
        }
      }

      // Check remote visitor_profiles for matching profile details
      let profileMatch: any = null;
      try {
        const { data: pData } = await supabase
          .from('visitor_profiles')
          .select('*')
          .or(`visitor_id.eq.${cleanVId},visitor_id.eq.${target}`)
          .maybeSingle();
        if (pData) profileMatch = pData;
      } catch {}

      const hasMessages = !msgError && dbMessages && Array.isArray(dbMessages) && dbMessages.length > 0;

      if (!profileMatch && !hasMessages) {
        setResumeError(`No session found matching "${target}". Check your Visitor ID or create a new profile.`);
        return false;
      }

      // Flush active chat state before loading restored messages
      setMessages([]);
      setConversations([]);

      const mappedMessages: ChatMessage[] = (dbMessages || []).map((m: any) => {
        const isOwnerMsg = m.sender === 'festus' || m.sender_id === 'festus' || m.sender_id === ownerId;
        return {
          id: m.id || generateMessageId(),
          sender: isOwnerMsg ? 'festus' : 'visitor',
          sender_id: m.sender_id || (isOwnerMsg ? ownerId : cleanVId),
          receiver_id: m.receiver_id || (isOwnerMsg ? cleanVId : ownerId),
          conversation_id: restoredConvId,
          text: m.content || m.text || '',
          timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          status: m.status || (isOwnerMsg ? 'seen' : 'unseen'),
          attachments: m.attachments || undefined,
          voiceNote: m.voice_note || m.voiceNote || undefined,
          created_at: m.created_at || new Date().toISOString(),
        };
      });

      // Strict Chronological Timestamp Sorting
      mappedMessages.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

      // Load fetched message array into React state
      setMessages(mappedMessages);

      const restoredName = profileMatch?.display_name || profileMatch?.name || 'Visitor';
      const restoredProfile: VisitorMessagingProfile = {
        name: restoredName,
        roleOrCompany: profileMatch?.role_subject || profileMatch?.role_or_company || 'Visitor Direct Chat',
        avatarUrl: profileMatch?.avatar_url || '',
        avatarColor: profileMatch?.avatar_color || 'bg-slate-700',
      };

      visitorIdRef.current = cleanVId;
      conversationIdRef.current = restoredConvId;
      setVisitorProfile(restoredProfile);
      setVisitorId(cleanVId);
      setConversationId(restoredConvId);

      const lastMsg = mappedMessages[mappedMessages.length - 1];
      const singleVisitorConv: Conversation = {
        id: restoredConvId,
        visitorId: cleanVId,
        defaultLabel: restoredName,
        customName: restoredName,
        visitorName: restoredName,
        avatarUrl: restoredProfile.avatarUrl,
        avatarColor: restoredProfile.avatarColor,
        roleOrCompany: restoredProfile.roleOrCompany,
        unread: false,
        important: false,
        messages: mappedMessages,
        lastMessage: lastMsg?.text || (lastMsg?.voiceNote ? '🎤 Voice note' : (lastMsg?.attachments?.length ? `📎 ${lastMsg.attachments[0].name}` : '')),
        lastTimestamp: lastMsg?.timestamp || '',
      };

      setConversations([singleVisitorConv]);

      // Save active visitor_id and conversation_id (conv_ + visitor_id) in localStorage
      try {
        localStorage.setItem('visitor_id', cleanVId);
        localStorage.setItem('conversation_id', restoredConvId);
        localStorage.setItem(STORAGE_KEY_VISITOR_ID, cleanVId);
        localStorage.setItem('fesline_visitor_access_key', cleanVId);
        localStorage.setItem('fesline_current_visitor_id', cleanVId);
        localStorage.setItem('fesline_current_conversation_id', restoredConvId);
        localStorage.setItem('display_name', restoredName);
        localStorage.setItem('role_subject', restoredProfile.roleOrCompany || '');
        localStorage.setItem(STORAGE_KEY_VISITOR_PROFILE, JSON.stringify(restoredProfile));
        localStorage.setItem(`fesline_visitor_chat_${cleanVId}`, JSON.stringify([singleVisitorConv]));
        sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, cleanVId);
        document.cookie = `fesline_visitor_id=${encodeURIComponent(cleanVId)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}

      setIsResumeModalOpen(false);
      setIsVisitorProfileModalOpen(false);
      setResumeInput('');
      setShowMailNotice(`Session restored! Loaded ${mappedMessages.length} message${mappedMessages.length === 1 ? '' : 's'}.`);
      return true;
    } catch (err: any) {
      console.error('[Session Restore Exception]:', err);
      setResumeError(err?.message || 'Error occurred while restoring session.');
      return false;
    }
  };

  const handleResumeConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleRestoreSessionById(resumeInput);
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
  }, [messages, activeOwnerConvId, isOwner]);

  // Unified Thread Message Loading: When owner selects a visitor thread or visitor opens chat,
  // load all chronological messages directly from Supabase to guarantee complete thread rendering
  useEffect(() => {
    const targetCId = isOwner ? activeOwnerConvId : (conversationId || `conv_${visitorId}`);
    if (!targetCId || targetCId === 'inbox-empty') {
      setMessages([]);
      return;
    }

    // Pre-populate unified single array state from local cache if available
    const localThread = conversations.find((c) => c.id === targetCId || c.id === `conv_${targetCId.replace(/^conv_/, '')}` || c.visitorId === targetCId);
    if (localThread?.messages && Array.isArray(localThread.messages) && localThread.messages.length > 0) {
      const localSorted = [...localThread.messages];
      localSorted.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      setMessages(localSorted);
    }

    const loadThreadMessages = async () => {
      try {
        const vId = targetCId.startsWith('conv_') ? targetCId.replace(/^conv_/, '') : targetCId;
        const ownerId = await getOrFetchOwnerId();
        const safeCId = ensureValidUuid(targetCId);

        // 2. Strict Timestamp Sorting:
        // Ensure the SQL query fetching messages also includes `ORDER BY created_at ASC`
        const { data: dbMessages, error } = await supabase
          .from('messages')
          .select('*')
          .or(`conversation_id.eq.${targetCId},conversation_id.eq.conv_${vId},conversation_id.eq.${vId},conversation_id.eq.${safeCId},and(sender_id.eq.${vId},receiver_id.eq.${ownerId}),and(sender_id.eq.${ownerId},receiver_id.eq.${vId})`)
          .order('created_at', { ascending: true });

        if (!error && dbMessages && Array.isArray(dbMessages)) {
          const mapped: ChatMessage[] = dbMessages.map((m: any) => {
            const isOwnerMsg = m.sender === 'festus' || m.sender_id === 'festus' || m.sender_id === ownerId;
            return {
              id: m.id || generateMessageId(),
              sender: isOwnerMsg ? 'festus' : 'visitor',
              sender_id: m.sender_id || (isOwnerMsg ? ownerId : vId),
              receiver_id: m.receiver_id || (isOwnerMsg ? vId : ownerId),
              conversation_id: m.conversation_id || targetCId,
              text: m.content || m.text || '',
              timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
              status: m.status || (isOwnerMsg ? 'seen' : 'unseen'),
              attachments: m.attachments || undefined,
              voiceNote: m.voice_note || m.voiceNote || undefined,
              created_at: m.created_at || new Date().toISOString(),
            };
          });

          // 2. Strict Timestamp Sorting:
          // Explicitly sort the unified array by parsing timestamps into JavaScript Date objects:
          // messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          mapped.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

          // 1. Unified Single Array State:
          // Store all chat messages (both owner sent messages and visitor received messages) inside a single React state array.
          // Never maintain separate arrays for sent vs. received messages or concatenate them manually.
          setMessages((prev) => {
            const currentThreadMsgs = prev.filter(m => m && (m.conversation_id === targetCId || m.conversation_id === `conv_${vId}` || m.conversation_id === vId || (!isOwner && (m.sender_id === vId || m.receiver_id === vId))));
            const msgMap = new Map<string, ChatMessage>();
            for (const em of currentThreadMsgs) if (em && em.id) msgMap.set(em.id, em);
            for (const mm of mapped) if (mm && mm.id) msgMap.set(mm.id, mm);
            const merged = Array.from(msgMap.values());
            merged.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            return merged;
          });

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === targetCId || c.id === `conv_${vId}` || c.id === vId);
            if (idx >= 0) {
              const existing = prev[idx];
              const msgMap = new Map<string, ChatMessage>();
              for (const em of existing.messages || []) if (em && em.id) msgMap.set(em.id, em);
              for (const mm of mapped) if (mm && mm.id) msgMap.set(mm.id, mm);
              const merged = Array.from(msgMap.values());
              merged.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
              const last = merged[merged.length - 1];

              const updatedConv: Conversation = {
                ...existing,
                messages: merged,
                lastMessage: last?.text || (last?.voiceNote ? '🎤 Voice note' : (last?.attachments?.length ? `📎 ${last.attachments[0].name}` : existing.lastMessage)),
                lastTimestamp: last?.timestamp || existing.lastTimestamp,
              };

              const nextList = prev.map((c, i) => (i === idx ? updatedConv : c));
              try {
                if (isOwner) {
                  localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(nextList));
                } else {
                  localStorage.setItem(`fesline_visitor_chat_${vId}`, JSON.stringify(nextList));
                }
              } catch {}
              return nextList;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[Load Thread Messages Error]:', err);
      }
    };

    loadThreadMessages();
  }, [activeOwnerConvId, isOwner, conversationId, visitorId]);

  // Owner selects a conversation from the sidebar
  const handleSelectConversation = (convId: string) => {
    setActiveOwnerConvId(convId);
    setIsMobileListOpen(false);

    // Immediately populate unified single array state from selected conversation
    const selected = conversations.find((c) => c.id === convId);
    if (selected?.messages && Array.isArray(selected.messages) && selected.messages.length > 0) {
      const sorted = [...selected.messages];
      sorted.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      setMessages(sorted);
    } else {
      setMessages([]);
    }

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
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
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
    const oldVisitorId = visitorId;
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const freshVisitorId = `visitor_${uuid}`;
    const freshConvId = `conv_${uuid}`;

    // 4. Strict Session & Identity Isolation:
    // Clearing sessions must completely flush the active chat state to prevent previous visitor messages from appearing
    setMessages([]);
    setConversations([]);

    try {
      if (oldVisitorId) {
        localStorage.removeItem(`fesline_visitor_chat_${oldVisitorId}`);
      }
      localStorage.setItem('visitor_id', freshVisitorId);
      localStorage.setItem('conversation_id', freshConvId);
      localStorage.setItem(STORAGE_KEY_VISITOR_ID, freshVisitorId);
      localStorage.setItem('fesline_current_conversation_id', freshConvId);
      sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, freshVisitorId);
      document.cookie = `fesline_visitor_id=${encodeURIComponent(freshVisitorId)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    setVisitorId(freshVisitorId);
    setConversationId(freshConvId);
    setIsVisitorClearModalOpen(false);
    setShowMailNotice('Chat cleared on your screen. Started a fresh conversation.');
  };

  const handleOwnerLogout = () => {
    setOwner(false);
    setShowMailNotice('Logged out of Owner Mode. Switched to public visitor view.');
  };

  // Visitor updates their messaging profile (photo and name)
  const handleSaveVisitorProfile = async (updated: VisitorMessagingProfile, accessKey: string) => {
    // 2. State & LocalStorage Flush:
    // Immediately wipe the active React chat state (setMessages([]))
    setMessages([]);
    setVisitorProfile(updated);
    setVisitorId(accessKey);
    const targetConvId = `conv_${accessKey}`;
    setConversationId(targetConvId);
    setLoginTooltipVisible(false);

    // Overwrite localStorage with the new visitor keys
    try {
      localStorage.setItem('visitor_id', accessKey);
      localStorage.setItem('conversation_id', targetConvId);
      localStorage.setItem('display_name', updated.name);
      localStorage.setItem('avatar_url', updated.avatarUrl || '');
      localStorage.setItem('role_subject', updated.roleOrCompany || 'Visitor Direct Chat');
      localStorage.setItem('visitor_profile', JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEY_VISITOR_PROFILE, JSON.stringify(updated));
      localStorage.setItem('fesline_visitor_access_key', accessKey);
      localStorage.setItem('fesline_current_visitor_id', accessKey);
      localStorage.setItem('fesline_current_conversation_id', targetConvId);
      localStorage.removeItem(`fesline_visitor_chat_${accessKey}`);
    } catch {}

    const updatedConvMetadata = {
      defaultLabel: updated.name || 'Direct Message',
      customName: updated.name || '',
      visitorName: updated.name || '',
      avatarUrl: updated.avatarUrl || '',
      roleOrCompany: updated.roleOrCompany || 'Visitor Direct Chat',
      avatarColor: updated.avatarColor || 'bg-slate-700',
    };

    // Clean, empty fresh chat environment for the visitor
    const freshConv: Conversation = {
      id: targetConvId,
      visitorId: accessKey,
      ...updatedConvMetadata,
      unread: false,
      important: false,
      messages: [],
      lastMessage: '',
      lastTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setConversations([freshConv]);
    try {
      localStorage.setItem(`fesline_visitor_chat_${accessKey}`, JSON.stringify([freshConv]));
    } catch {}

    // Create a new row in public.conversations for the Owner Panel
    try {
      const ownerId = await getOrFetchOwnerId();
      await supabase.from('conversations').upsert({
        id: targetConvId,
        visitor_id: accessKey,
        owner_id: ownerId,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }, { onConflict: 'id' });
    } catch (insertConvErr) {
      console.warn('[Supabase Insert Conversation Notice]:', insertConvErr);
    }

    // Save visitor profile to Supabase
    try {
      await saveVisitorProfileToSupabase({
        visitor_id: accessKey,
        display_name: updated.name,
        role_subject: updated.roleOrCompany,
        avatar_url: updated.avatarUrl || '',
        avatar_color: updated.avatarColor || 'bg-slate-700',
      });
    } catch (err) {
      console.error('[Supabase Save Visitor Profile Error]:', err);
    }

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
      console.error('Failed to sync visitor profile to backend:', err);
    }

    try {
      broadcastSupabaseChatMessage({ event: 'visitor_profile_updated', visitorId: accessKey, profile: updated });
    } catch (err) {
      console.error('Supabase broadcast error:', err);
    }
    setShowMailNotice(`Profile updated! Saved Visitor ID: ${accessKey}.`);
  };

  // Send voice note between owner and visitor
  const sendVoiceNoteMessage = async (audioUrl: string, duration: number) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const voiceData: VoiceNoteData = {
      url: audioUrl,
      duration,
    };

    if (isOwner) {
      const festusMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'festus',
        sender_id: resolvedOwnerId,
        receiver_id: activeConversation.visitorId || activeOwnerConvId.replace(/^conv_/, ''),
        conversation_id: activeOwnerConvId,
        text: '',
        timestamp: timeStr,
        status: 'seen',
        voiceNote: voiceData,
        created_at: new Date().toISOString(),
      };

      // 1. Live Message Appending & Chronological Interleaving:
      setMessages((prev) => {
        if (prev.some((m) => m.id === festusMsg.id)) return prev;
        const updated = [...prev, festusMsg];
        return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      });

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeOwnerConvId) {
            const nextMsgs = [...c.messages, festusMsg];
            nextMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            return {
              ...c,
              unread: false,
              messages: nextMsgs,
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
      }).catch((err) => console.error('Send error:', err));

      try {
        setDbWriteError(null);
        await saveMessageAndConversationToSupabase({
          conversationId: activeOwnerConvId,
          visitorId: activeOwnerConvId,
          message: festusMsg,
          conversationMetadata: {
            defaultLabel: activeConversation.defaultLabel,
            customName: activeConversation.customName,
            visitorName: activeConversation.visitorName,
            avatarUrl: activeConversation.avatarUrl,
            roleOrCompany: activeConversation.roleOrCompany,
          },
        });
        try {
          broadcastSupabaseChatMessage({ conversationId: activeOwnerConvId, message: festusMsg });
        } catch (err) {
          console.error('Supabase broadcast error:', err);
        }
      } catch (err: any) {
        console.error('[Supabase Owner Voice Note Save Error]:', err);
        setDbWriteError(`Owner Voice Note Error: ${err?.message || 'Failed to save to database.'}`);
      }
    } else {
      // 2. VISITOR SENDS VOICE NOTE
      let currentVisitorId = visitorId || getStoredVisitorId();
      if (!currentVisitorId) {
        const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        currentVisitorId = `visitor_${uuid}`;
        setVisitorId(currentVisitorId);
      }
      let currentConvId = conversationId || getStoredConversationId(currentVisitorId) || `conv_${currentVisitorId}`;
      if (currentConvId !== conversationId) {
        setConversationId(currentConvId);
      }
      try {
        localStorage.setItem('visitor_id', currentVisitorId);
        localStorage.setItem('conversation_id', currentConvId);
        localStorage.setItem(STORAGE_KEY_VISITOR_ID, currentVisitorId);
        localStorage.setItem('fesline_current_conversation_id', currentConvId);
        localStorage.setItem('fesline_visitor_access_key', currentVisitorId);
      } catch {}

      const visitorMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'visitor',
        sender_id: currentVisitorId,
        receiver_id: resolvedOwnerId,
        conversation_id: currentConvId,
        text: '',
        timestamp: timeStr,
        status: 'unseen',
        voiceNote: voiceData,
        created_at: new Date().toISOString(),
      };

      // 1. Live Message Appending & Chronological Interleaving:
      setMessages((prev) => {
        if (prev.some((m) => m.id === visitorMsg.id)) return prev;
        const updated = [...prev, visitorMsg];
        return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      });

      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === currentConvId || c.id === currentVisitorId);
        let updated: Conversation[];
        if (existingIdx >= 0) {
          updated = prev.map((c, idx) => {
            if (idx === existingIdx) {
              const nextMsgs = [...c.messages, visitorMsg];
              nextMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
              return {
                ...c,
                id: currentConvId,
                unread: true,
                messages: nextMsgs,
                lastMessage: `🎤 Voice note (${formatDuration(duration)})`,
                lastTimestamp: timeStr,
              };
            }
            return c;
          });
        } else {
          const nextIndex = prev.length + 1;
          const newVisitorRecord: Conversation = {
            id: currentConvId,
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
          localStorage.setItem(`fesline_visitor_chat_${currentVisitorId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: visitorMsg,
          conversationMetadata: {
            defaultLabel: visitorProfile.name || 'Direct Message',
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
          },
        }),
      }).catch((err) => console.error('Send voice note error:', err));

      // Supabase send operation: explicit sequential database pipeline
      try {
        setDbWriteError(null);
        await saveMessageAndConversationToSupabase({
          conversationId: currentConvId,
          visitorId: currentVisitorId,
          message: visitorMsg,
          conversationMetadata: {
            defaultLabel: visitorProfile.name || 'Direct Message',
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
          },
        });
        try {
          broadcastSupabaseChatMessage({ conversationId: currentConvId, message: visitorMsg });
        } catch (err) {
          console.error('Supabase broadcast error:', err);
        }
      } catch (err: any) {
        console.error('[Supabase Visitor Voice Note Save Error]:', err);
        const errDetail = err?.message || 'Database write failed. Check your network or RLS configuration.';
        setDbWriteError(`Voice Note Delivery Notice: ${errDetail}`);
      }
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
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentText = inputMessage.trim();
    const currentAttachments = [...attachedFiles];

    if (isOwner) {
      // 1. OWNER SENDS REAL REPLY (Reuses existing conversation_id, never creates duplicate conversations)
      const festusMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'festus',
        sender_id: resolvedOwnerId,
        receiver_id: activeConversation.visitorId || activeOwnerConvId.replace(/^conv_/, ''),
        conversation_id: activeOwnerConvId,
        text: currentText,
        timestamp: timeStr,
        status: 'seen',
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        created_at: new Date().toISOString(),
      };

      // 1. Live Message Appending & Chronological Interleaving:
      // Combine previous and new messages, deduplicate, and strictly re-sort chronologically
      setMessages((prev) => {
        if (prev.some((m) => m.id === festusMsg.id)) return prev;
        const updated = [...prev, festusMsg];
        return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      });

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeOwnerConvId) {
            const nextMsgs = [...c.messages, festusMsg];
            nextMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            return {
              ...c,
              unread: false,
              messages: nextMsgs,
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
      }).catch((err) => console.error('Send error:', err));

      try {
        setDbWriteError(null);
        await saveMessageAndConversationToSupabase({
          conversationId: activeOwnerConvId,
          visitorId: activeOwnerConvId,
          message: festusMsg,
          conversationMetadata: {
            defaultLabel: activeConversation.defaultLabel,
            customName: activeConversation.customName,
            visitorName: activeConversation.visitorName,
            avatarUrl: activeConversation.avatarUrl,
            roleOrCompany: activeConversation.roleOrCompany,
          },
        });

        try {
          broadcastSupabaseChatMessage({ conversationId: activeOwnerConvId, message: festusMsg });
        } catch (err) {
          console.error('Supabase broadcast error:', err);
        }
      } catch (err: any) {
        console.error('[Supabase Owner Message Save Error]:', err);
        setDbWriteError(`Owner Message Persistence Warning: ${err?.message || 'Failed to save to database.'}`);
      }
    } else {
      // 3. Unauthenticated Database Writes:
      // Ensure every message sent by an anonymous/new visitor in any browser (e.g. "Manager")
      // writes directly to Supabase with valid visitor_id, conversation_id, and sender_type: 'visitor'
      let currentVisitorId = visitorId || getStoredVisitorId();
      if (!currentVisitorId) {
        const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        currentVisitorId = `visitor_${uuid}`;
        setVisitorId(currentVisitorId);
      }
      let currentConvId = conversationId || getStoredConversationId(currentVisitorId) || `conv_${currentVisitorId}`;
      if (currentConvId !== conversationId) {
        setConversationId(currentConvId);
      }
      try {
        localStorage.setItem('visitor_id', currentVisitorId);
        localStorage.setItem('conversation_id', currentConvId);
        localStorage.setItem(STORAGE_KEY_VISITOR_ID, currentVisitorId);
        localStorage.setItem('fesline_current_conversation_id', currentConvId);
        localStorage.setItem('fesline_visitor_access_key', currentVisitorId);
      } catch {}

      const visitorMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'visitor',
        sender_id: currentVisitorId,
        receiver_id: resolvedOwnerId,
        conversation_id: currentConvId,
        text: currentText,
        timestamp: timeStr,
        status: 'unseen', // Unseen until owner logs in and opens it
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        created_at: new Date().toISOString(),
      };

      // 1. Live Message Appending & Chronological Interleaving:
      // Combine previous and new messages, deduplicate, and strictly re-sort chronologically
      setMessages((prev) => {
        if (prev.some((m) => m.id === visitorMsg.id)) return prev;
        const updated = [...prev, visitorMsg];
        return updated.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      });

      // Record this message into master conversations database
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === currentConvId || c.id === currentVisitorId);
        let updated: Conversation[];
        if (existingIdx >= 0) {
          updated = prev.map((c, idx) => {
            if (idx === existingIdx) {
              const nextMsgs = [...c.messages, visitorMsg];
              nextMsgs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
              const uConv = {
                ...c,
                id: currentConvId,
                unread: true,
                messages: nextMsgs,
                lastMessage: currentText || (currentAttachments.length > 0 ? `📎 ${currentAttachments[0].name}` : 'File sent'),
                lastTimestamp: timeStr
              };
              return uConv;
            }
            return c;
          });
        } else {
          const nextIndex = prev.length + 1;
          const newVisitorRecord: Conversation = {
            id: currentConvId,
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
          updated = [newVisitorRecord, ...prev];
        }
        try {
          localStorage.setItem(`fesline_visitor_chat_${currentVisitorId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 1. PERSISTENCE & DATABASE WRITE ENSURANCE (Fix Disappearing Visitor Messages):
      // Executes sequential database pipeline upon sending a message:
      // a. Check/Upsert public.visitor_profiles matching visitor_id
      // b. Check/Upsert public.conversations matching conversation_id
      // c. Execute supabase.from('messages').insert([...])
      // Add error handling (try/catch) to alert the UI if a network or RLS permission error blocks insert
      try {
        setDbWriteError(null);
        await saveMessageAndConversationToSupabase({
          conversationId: currentConvId,
          visitorId: currentVisitorId,
          message: visitorMsg,
          conversationMetadata: {
            defaultLabel: visitorProfile.name || 'Direct Message',
            customName: visitorProfile.name || '',
            visitorName: visitorProfile.name || '',
            avatarUrl: visitorProfile.avatarUrl || '',
            roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
            avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
          },
        });

        try {
          broadcastSupabaseChatMessage({ conversationId: currentConvId, message: visitorMsg });
        } catch (err) {
          console.error('Supabase broadcast error:', err);
        }

        // Dispatch to backend with SSE broadcast
        fetch('/api/chats/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: currentConvId,
            message: visitorMsg,
            conversationMetadata: {
              defaultLabel: visitorProfile.name || 'Direct Message',
              customName: visitorProfile.name || '',
              visitorName: visitorProfile.name || '',
              avatarUrl: visitorProfile.avatarUrl || '',
              roleOrCompany: visitorProfile.roleOrCompany || 'Visitor Direct Chat',
              avatarColor: visitorProfile.avatarColor || 'bg-slate-700',
            }
          }),
        }).catch((err) => console.error('Send error:', err));
      } catch (err: any) {
        console.error('[Supabase Send Message Error]:', err);
        const errDetail = err?.message || 'Database write blocked by network or RLS permission error.';
        setDbWriteError(`Message Delivery Warning: ${errDetail}. Check Supabase connectivity.`);
      }
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

  // Deduplicated & Filtered Conversations for Owner (each visitor e.g. Billy, DavidG appears exactly ONCE)
  const filteredConversations = useMemo(() => {
    const dedupedMap = new Map<string, Conversation>();

    for (const c of conversations) {
      if (!c || !c.id) continue;
      const hasContent = (c.messages && c.messages.length > 0) || Boolean(c.lastMessage);
      if (!hasContent) continue;
      if (sidebarFilter === 'important' && !c.important) continue;
      if (sidebarFilter === 'unread' && !c.unread) continue;

      // Unique deduplication key per visitor
      const normalizedKey = (c.visitorName && c.visitorName !== 'Visitor')
        ? c.visitorName.trim().toLowerCase()
        : (c.id.startsWith('conv_') ? c.id.replace(/^conv_/, '') : c.id);

      const existing = dedupedMap.get(normalizedKey);
      if (!existing) {
        dedupedMap.set(normalizedKey, c);
      } else {
        // Merge messages and preserve the most recent timestamp and details
        const msgMap = new Map<string, ChatMessage>();
        for (const m of existing.messages || []) if (m && m.id) msgMap.set(m.id, m);
        for (const m of c.messages || []) if (m && m.id) msgMap.set(m.id, m);
        const mergedMsgs = Array.from(msgMap.values());
        mergedMsgs.sort((a, b) => {
          const tA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
          const tB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
          return tA - tB;
        });

        const timeExisting = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const timeC = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        const isCNewer = timeC >= timeExisting;

        dedupedMap.set(normalizedKey, {
          ...(isCNewer ? c : existing),
          visitorName: c.visitorName || existing.visitorName || c.customName || existing.customName || 'Visitor',
          customName: c.customName || existing.customName || c.visitorName || existing.visitorName || '',
          avatarUrl: c.avatarUrl || existing.avatarUrl || '',
          roleOrCompany: c.roleOrCompany || existing.roleOrCompany || 'Visitor Inquiry',
          messages: mergedMsgs,
          unread: existing.unread || c.unread,
          important: existing.important || c.important,
        });
      }
    }

    const list = Array.from(dedupedMap.values());
    list.sort((a, b) => {
      const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
      const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    return list;
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

        {/* DATABASE WRITE ERROR / RLS ALERT */}
        {dbWriteError && (
          <div className="mx-4 mt-2 p-3 rounded-xl bg-rose-950 text-rose-100 shadow-xl border border-rose-500/60 flex items-center justify-between font-sans text-xs animate-fade-in shrink-0 z-30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{dbWriteError}</span>
            </div>
            <button
              onClick={() => setDbWriteError(null)}
              className="text-rose-300 hover:text-white p-1 cursor-pointer transition-colors"
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

                      <button
                        type="button"
                        onClick={() => {
                          setResumeError(null);
                          setIsResumeModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white text-[11px] font-bold transition-all cursor-pointer border border-cyan-400/40 shadow-xs mr-1 shrink-0 active:scale-95"
                        title="Restore Session / Recover History using Visitor ID"
                      >
                        <History className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Restore</span>
                      </button>

                      {visitorId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(visitorId);
                            setCopiedVisitorId(true);
                            setTimeout(() => setCopiedVisitorId(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold transition-colors cursor-pointer border border-cyan-500 shadow-xs max-w-[130px] truncate"
                          title="Copy your persistent Visitor ID to restore this chat on another device"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                          <span className="truncate">{copiedVisitorId ? 'Copied!' : `ID: ${visitorId}`}</span>
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

                {/* Empty State Welcome Card */}
                {messages.length === 0 && (
                  <div className="my-8 max-w-md mx-auto p-4 rounded-2xl bg-white/90 backdrop-blur-xs border border-slate-300 text-center space-y-2 shadow-xs">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center mx-auto">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {isOwner ? `Direct Channel with ${activeConversation.visitorName || activeConversation.customName || activeConversation.defaultLabel || 'Visitor'}` : 'Direct Messaging with Festus Johnson'}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isOwner
                        ? 'No messages in this inquiry thread yet. Reply to this visitor or initiate communication below.'
                        : "Send a message, design review request, voice note, or project specification below. Messages are delivered directly to Festus's private inbox."}
                    </p>
                  </div>
                )}

                {/* 3. Interleaved Rendering:
                    Render the unified messages array linearly in a single map loop:
                    - If sender_id is the owner, align the chat bubble to the right (green: #dcf8c6).
                    - If sender_id is the visitor, align the chat bubble to the left (white: bg-white).
                    Ensure messages interleave back-and-forth naturally by their exact creation time (01:45 PM -> 01:46 PM -> 01:47 PM)
                    rather than grouping sent messages together and received messages together. */}
                {messages.map((msg) => {
                  const isOwnerSender = msg.sender === 'festus' || (msg.sender_id && (msg.sender_id === resolvedOwnerId || msg.sender_id === 'festus'));
                  const isRight = isOwner ? isOwnerSender : !isOwnerSender;
                  const isLeft = !isRight;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isRight ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Left Avatar for received messages */}
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

                      {/* Message Bubble: Right is Green (#dcf8c6), Left is White (bg-white) */}
                      <div
                        className={`max-w-[85%] sm:max-w-md md:max-w-lg px-3 py-2 rounded-xl text-[11.5px] sm:text-[12.5px] leading-snug shadow-xs relative group/msg ${
                          isRight
                            ? 'bg-[#dcf8c6] text-slate-950 rounded-br-xs border border-[#c4e8aa]'
                            : 'bg-white text-slate-900 rounded-bl-xs border border-slate-200'
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

                      {/* Right Avatar for Visitor (in visitor view) */}
                      {isRight && !isOwner && (
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

                    {/* Compact Message Send Button with Visual InChat Login Prompt Tooltip */}
                    <div className="relative flex items-center">
                      {loginTooltipVisible && !isOwner && !isVisitorLoggedIn && (
                        <div
                          role="alert"
                          className="absolute bottom-full right-0 mb-3 z-50 flex items-center gap-2 bg-[#243346] text-white text-xs font-semibold py-2 px-3.5 rounded-xl shadow-2xl border border-white/20 whitespace-nowrap animate-bounce"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          <span>Click the InChat to Login First</span>
                          <button
                            type="button"
                            onClick={() => {
                              setLoginTooltipVisible(false);
                              setIsVisitorProfileModalOpen(true);
                            }}
                            className="ml-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer"
                          >
                            InChat
                          </button>
                          {/* Tooltip arrow pointing down to Send button */}
                          <div className="absolute top-full right-4 -mt-1 w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-[#243346]" />
                        </div>
                      )}

                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!isOwner && !isVisitorLoggedIn && (inputMessage.trim() || attachedFiles.length > 0)) {
                            e.preventDefault();
                            triggerLoginPrompt();
                          }
                        }}
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
                    </div>
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
          onRestoreSession={handleRestoreSessionById}
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
                <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Restore Session / Recover History</h3>
                  <p className="text-xs text-slate-500">Recover your complete message history from cloud database</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-3.5 leading-relaxed">
                Enter your unique <strong>Visitor ID</strong> to query Supabase directly, load your complete message history, and reconnect your live Realtime stream.
              </p>

              {/* Current Visitor Session Chip */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span>YOUR CURRENT VISITOR ID:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(visitorId);
                      setCopiedVisitorId(true);
                      setTimeout(() => setCopiedVisitorId(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-900 font-bold cursor-pointer"
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
                  {visitorId || 'No active Visitor ID yet'}
                </code>
              </div>

              <form onSubmit={handleResumeConversation} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Unique Visitor ID:
                  </label>
                  <input
                    type="text"
                    value={resumeInput}
                    onChange={(e) => setResumeInput(e.target.value)}
                    placeholder="e.g. visitor_7c3a0..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 font-mono"
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
                    className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Restore Session / Recover History</span>
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
