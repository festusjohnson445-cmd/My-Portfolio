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
  UserCheck
} from 'lucide-react';
import {
  useProfileSync
} from '../utils/profileState';

export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'cad' | 'doc';
  url?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'festus';
  text: string;
  timestamp: string;
  status: 'seen' | 'unseen';
  attachments?: ChatAttachment[];
}

export interface Conversation {
  id: string;
  defaultLabel: string; // e.g. "Messenger 1"
  customName?: string;  // e.g. "David Miller (Optomechanics Lead)"
  roleOrCompany?: string;
  avatarColor?: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unread: boolean;
  important?: boolean;  // Star / Important flag
  messages: ChatMessage[];
}

const STORAGE_KEY_CHATS = 'fesline_whatsapp_conversations';
const STORAGE_KEY_VISITOR_ID = 'fesline_current_visitor_id';

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

// Helper to get or create a visitor conversation with NO auto messages
const getOrCreateVisitorId = (): string => {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY_VISITOR_ID);
    if (existing && existing.trim()) return existing;
    const newId = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, newId);
    return newId;
  } catch {
    return `visitor-${Date.now()}`;
  }
};

export const MessagingSection: React.FC = () => {
  const { avatar: profileAvatar, bio, isOwner, setOwner } = useProfileSync();
  const profileName = bio.fullName || 'Festus, Olorunsogo Johnson';
  const profileEmail = bio.email || 'festusjohnson028@gmail.com';

  const [visitorId] = useState<string>(getOrCreateVisitorId);

  // Master persistent multi-chat database (shared between visitor submissions & owner replies)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_CONVERSATIONS;
  });

  // For visitor: clear chat confirmation modal state
  const [isVisitorClearModalOpen, setIsVisitorClearModalOpen] = useState(false);

  // For owner: active selected conversation in the sidebar
  const [activeOwnerConvId, setActiveOwnerConvId] = useState<string>(() => {
    return conversations[0]?.id || visitorId;
  });

  // Sidebar filter for Owner: 'all' | 'important' | 'unread'
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'important' | 'unread'>('all');

  // Delete chat confirmation modal state
  const [deletingConv, setDeletingConv] = useState<Conversation | null>(null);

  // Persist master conversations to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(conversations));
    } catch (e) {
      console.warn('LocalStorage save error for chats:', e);
    }
  }, [conversations]);

  // Sync across storage events (when Owner replies in another tab or Visitor sends message)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CHATS && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) {
            setConversations(updated);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Active conversation depending on whether user is Owner or Visitor
  const activeConversation: Conversation = useMemo(() => {
    if (!isOwner) {
      // Find visitor's conversation in master list, or return empty clean initial chat
      const found = conversations.find((c) => c.id === visitorId);
      if (found) return found;
      return {
        id: visitorId,
        defaultLabel: 'Direct Message',
        roleOrCompany: 'Visitor Inquiry',
        unread: false,
        important: false,
        messages: [] // NO automatic welcome message!
      };
    }

    const found = conversations.find((c) => c.id === activeOwnerConvId);
    if (found) return found;
    return conversations[0] || {
      id: 'inbox-empty',
      defaultLabel: 'Inbox',
      roleOrCompany: 'Visitor Inquiries',
      unread: false,
      important: false,
      messages: []
    };
  }, [isOwner, visitorId, conversations, activeOwnerConvId]);

  // Header Avatar Size Adjustment ('sm' | 'md' | 'lg')
  const [headerAvatarSize, setHeaderAvatarSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showHeaderSettings, setShowHeaderSettings] = useState(false);

  // Search Functionality State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterType, setSearchFilterType] = useState<'all' | 'messages' | 'files'>('all');

  // Input message state
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);

  // Rename contact modal state (Owner only)
  const [editingConv, setEditingConv] = useState<Conversation | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [editRoleInput, setEditRoleInput] = useState('');

  // Mobile drawer view state for Owner on small screens
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  // Direct mail notification toast
  const [showMailNotice, setShowMailNotice] = useState<string | null>(null);

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

  // Owner initiates chat deletion
  const handlePromptDelete = (conv: Conversation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingConv(conv);
  };

  // Owner confirms chat deletion
  const handleConfirmDelete = () => {
    if (!deletingConv) return;
    const targetId = deletingConv.id;
    const remaining = conversations.filter((c) => c.id !== targetId);

    setConversations(remaining);
    if (activeOwnerConvId === targetId) {
      setActiveOwnerConvId(remaining[0]?.id || '');
    }

    setDeletingConv(null);
    setShowMailNotice(`Conversation "${deletingConv.customName || deletingConv.defaultLabel}" deleted successfully.`);
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
      sessionStorage.setItem(STORAGE_KEY_VISITOR_ID, freshId);
    } catch {}
    setIsVisitorClearModalOpen(false);
    setShowMailNotice('Chat cleared on your screen. Any messages you previously sent remain securely in Festus’s inbox.');
    window.location.reload();
  };

  const handleOwnerLogout = () => {
    setOwner(false);
    setShowMailNotice('Logged out of Owner Mode. Switched to public visitor view.');
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
        id: `msg-${Date.now()}`,
        sender: 'festus',
        text: currentText,
        timestamp: timeStr,
        status: 'seen',
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeOwnerConvId) {
            return {
              ...c,
              unread: false,
              messages: [...c.messages, festusMsg],
              lastMessage: currentText || (currentAttachments.length > 0 ? `📎 ${currentAttachments[0].name}` : ''),
              lastTimestamp: timeStr
            };
          }
          return c;
        })
      );
    } else {
      // 2. VISITOR SENDS MESSAGE (NO AUTO-REPLY, NO BOT SIMULATION, NO TIMEOUT)
      const visitorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'visitor',
        text: currentText,
        timestamp: timeStr,
        status: 'unseen', // Unseen until owner logs in and opens it
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined
      };

      // Record this message into master conversations database
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === visitorId);
        if (existingIdx >= 0) {
          return prev.map((c, idx) => {
            if (idx === existingIdx) {
              return {
                ...c,
                unread: true,
                messages: [...c.messages, visitorMsg],
                lastMessage: currentText || (currentAttachments.length > 0 ? `📎 ${currentAttachments[0].name}` : ''),
                lastTimestamp: timeStr
              };
            }
            return c;
          });
        } else {
          const nextIndex = prev.length + 1;
          const newVisitorRecord: Conversation = {
            id: visitorId,
            defaultLabel: `Messenger ${nextIndex}`,
            customName: '',
            roleOrCompany: 'Visitor Direct Chat',
            avatarColor: 'bg-emerald-600',
            unread: true,
            important: false,
            messages: [visitorMsg],
            lastMessage: currentText || 'New visitor message',
            lastTimestamp: timeStr
          };
          return [newVisitorRecord, ...prev];
        }
      });
    }

    setInputMessage('');
    setAttachedFiles([]);
  };

  // File Upload Attachment
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = Array.from(files).map((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let type: 'image' | 'pdf' | 'cad' | 'doc' = 'doc';
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) type = 'image';
      else if (['pdf'].includes(extension)) type = 'pdf';
      else if (['step', 'stp', 'sldprt', 'iges', 'dwg', 'dxf'].includes(extension)) type = 'cad';

      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeFormatted = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

      let url: string | undefined = undefined;
      if (type === 'image') {
        url = URL.createObjectURL(file);
      }

      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: sizeFormatted,
        type,
        url
      };
    });

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleQuickTopicChip = (chip: string) => {
    setInputMessage(chip);
  };

  // Filtered Conversations for Owner
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
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
                    Unread ({conversations.filter((c) => c.unread).length})
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
                      const displayName = conv.customName || conv.defaultLabel;
                      const isRenamed = !!conv.customName;
                      const lastMsg = conv.messages[conv.messages.length - 1];

                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          className={`p-3 flex items-start gap-2.5 cursor-pointer transition-colors relative group select-none ${
                            isActive
                              ? 'bg-[#e3f2fd] border-l-4 border-[#1e88e5]'
                              : 'hover:bg-[#f1f5f9]'
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-8 h-8 rounded-full ${conv.avatarColor || 'bg-cyan-700'} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs uppercase`}
                          >
                            {displayName.charAt(0)}
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
                                  lastMsg.sender === 'festus' ? `You: ${lastMsg.text}` : lastMsg.text
                                ) : (
                                  'Awaiting initial message'
                                )}
                              </span>

                              {/* Seen / Unseen Status Marker */}
                              {lastMsg && (
                                <span className="shrink-0">
                                  {lastMsg.status === 'seen' ? (
                                    <span className="text-[#1e88e5] font-bold text-xs" title="Seen (marked twice blue)">
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
                              className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-opacity cursor-pointer"
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

              {/* 1. SLIM & COMPACT BLUE HEADER */}
              <div className="bg-[#1e88e5] px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs text-white select-none z-10 shrink-0">
                
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
                    className={`relative ${avatarSizeClass} rounded-full overflow-hidden border border-white/90 shadow-xs bg-slate-200 shrink-0 ${
                      isOwner ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (isOwner) setShowHeaderSettings(!showHeaderSettings);
                    }}
                    title={isOwner ? "Click to adjust avatar size" : profileName}
                  >
                    <img
                      src={profileAvatar}
                      alt={profileName}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#1e88e5]" />
                  </div>

                  {/* Contact Info & Title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                        {profileName}
                      </h2>
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white text-[#1e88e5] text-[9px] font-bold">
                        ✓
                      </span>

                      {/* Important Star Badge on Active Conversation (Owner) */}
                      {isOwner && activeConversation.important && (
                        <span className="text-amber-300 inline-flex items-center" title="Important Conversation">
                          <Star className="w-3.5 h-3.5 fill-amber-300" />
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-cyan-100 font-medium flex items-center gap-1.5 truncate">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span className="truncate">
                        online {isOwner ? `· In conversation with ${activeConversation.customName || activeConversation.defaultLabel}` : '· Direct Channel'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Header Group: Search, Visitor Clear, Owner Controls, Direct Mail */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-cyan-100">
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

                  {/* Visitor Controls: Clear Chat Option */}
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsVisitorClearModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors cursor-pointer border border-white/20 shadow-xs"
                      title="Clear your chat screen"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear Chat</span>
                    </button>
                  )}

                  {/* Owner Controls: Star Important, Rename, Delete */}
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

                      <button
                        onClick={() => handlePromptDelete(activeConversation)}
                        className="p-1.5 hover:bg-red-500/30 rounded-full text-white transition-colors cursor-pointer"
                        title={`Delete ${activeConversation.customName || activeConversation.defaultLabel} from inquiries`}
                      >
                        <Trash2 className="w-4 h-4" />
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
                <div className="bg-[#1565c0] px-4 py-1.5 text-white flex items-center justify-between text-[11px] font-medium border-b border-[#0d47a1] animate-fade-in">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-cyan-200" />
                    Adjust Profile Icon &amp; Header Density:
                  </span>
                  <div className="flex items-center gap-1.5 bg-black/20 p-0.5 rounded-md">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setHeaderAvatarSize(size)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                          headerAvatarSize === size
                            ? 'bg-white text-[#1565c0] shadow-xs'
                            : 'text-cyan-100 hover:bg-white/10'
                        }`}
                      >
                        {size === 'sm' ? 'Compact' : size === 'md' ? 'Default' : 'Large'}
                      </button>
                    ))}
                  </div>
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
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-[#1e88e5] hover:text-white text-slate-700 border border-[#b8c6d4] transition-colors whitespace-nowrap cursor-pointer shadow-xs font-medium"
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
                      Send a message, design review request, or project specification below. Messages are delivered directly to Festus's private inbox.
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
                        <div className="w-6.5 h-6.5 rounded-full overflow-hidden bg-slate-300 shrink-0 mb-0.5 shadow-xs border border-white flex items-center justify-center text-[10px] font-bold text-white">
                          {!isOwner ? (
                            <img
                              src={profileAvatar}
                              alt={profileName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="bg-cyan-700 w-full h-full flex items-center justify-center">
                              {(activeConversation.customName || activeConversation.defaultLabel).charAt(0)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-md md:max-w-lg px-3 py-2 rounded-xl text-[11.5px] sm:text-[12.5px] leading-snug shadow-xs relative ${
                          isLeft
                            ? 'bg-white text-slate-900 rounded-bl-xs border border-slate-200'
                            : 'bg-[#dcf8c6] text-slate-950 rounded-br-xs border border-[#c4e8aa]'
                        }`}
                      >
                        {/* Text Content */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                        )}

                        {/* Shared Files & Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-1.5 space-y-1 pt-1 border-t border-black/10">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="p-2 rounded-lg bg-black/5 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {att.type === 'pdf' ? (
                                    <FileText className="w-4 h-4 text-red-600 shrink-0" />
                                  ) : att.type === 'cad' ? (
                                    <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate text-[11px] text-slate-900">
                                      {att.name}
                                    </p>
                                    <span className="text-[10px] text-slate-500">{att.size}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-cyan-800 font-bold bg-white/80 px-1.5 py-0.5 rounded shadow-xs shrink-0">
                                  Shared File
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timestamp and Seen/Unseen Checkmark Indicators */}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500 font-mono">
                          <span>{msg.timestamp}</span>

                          {msg.status === 'seen' ? (
                            <span
                              className="text-[#1e88e5] font-bold text-xs"
                              title="Seen (marked twice blue)"
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
                        </div>
                      </div>
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
                      <FileText className="w-3 h-3 text-cyan-700" />
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

              {/* 3. COMPACT BOTTOM INPUT BAR & SEND BUTTON */}
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
                      className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
                      title="Attach documents, CAD files or images"
                    >
                      <Paperclip className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  {/* Message Input Box */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder={
                        isOwner
                          ? `Reply to ${activeConversation.customName || activeConversation.defaultLabel} as Festus...`
                          : `Type message to Festus Johnson...`
                      }
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e88e5] shadow-xs pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setInputMessage((prev) => prev + ' ⚙️ ')}
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
                        ? 'bg-[#1e88e5] hover:bg-[#1565c0] text-white'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs">Send</span>
                  </button>
                </form>
              </div>

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
                <div className="w-8 h-8 rounded-full bg-[#1e88e5]/15 text-[#1e88e5] flex items-center justify-center font-bold">
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
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
                    className="px-3.5 py-1.5 rounded-lg bg-[#1e88e5] hover:bg-[#1565c0] text-white font-bold cursor-pointer"
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
                <div className="w-9 h-9 rounded-full bg-cyan-50 text-[#1e88e5] flex items-center justify-center shrink-0">
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
                  🔒 <strong>Note:</strong> Clearing your chat only resets your personal screen. All messages you sent remain safely delivered to Festus in his inquiries inbox.
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
                  className="px-3.5 py-1.5 rounded-lg bg-[#1e88e5] hover:bg-[#1565c0] text-white font-bold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Screen</span>
                </button>
              </div>
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
                  <h3 className="text-sm font-bold text-slate-950">Delete Inquiry?</h3>
                  <p className="text-[11px] text-slate-500 truncate font-semibold">
                    {deletingConv.customName ? `${deletingConv.customName} (${deletingConv.defaultLabel})` : deletingConv.defaultLabel}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to permanently delete this inquiry (<strong>{deletingConv.defaultLabel}</strong>) and all its shared messages from your visitor inquiries?
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingConv(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Inquiry</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
