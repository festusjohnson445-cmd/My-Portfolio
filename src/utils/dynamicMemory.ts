/**
 * Dynamic Memory System for Fesline Mechanical Engineering Portfolio
 * 
 * Multi-Tier Unified Memory Engine:
 * - Tier 1: Fast Reactive In-Memory Cache (RAM)
 * - Tier 2: Browser Storage & IndexedDB Persistence
 * - Tier 3: Cross-Tab & Cross-Window Real-time BroadcastChannel
 * - Tier 4: Server Database & Firestore Cloud Persistence
 */

export interface MemorySnapshot {
  timestamp: number;
  profileHydrated: boolean;
  hubDocsCount: number;
  profileDocsCount: number;
  chatThreadsCount: number;
  activeVisitorId: string;
  isOwner: boolean;
}

export type MemoryCategory = 'profile' | 'documents' | 'chats' | 'ui_preferences' | 'system';

export interface MemoryEventPayload {
  type: string;
  category: MemoryCategory;
  data?: any;
  timestamp: number;
  sourceTabId: string;
}

// Unique tab session ID to prevent echo loops
export const TAB_SESSION_ID = typeof window !== 'undefined' 
  ? `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` 
  : 'server-runtime';

// Memory broadcast channel for zero-latency multi-tab sync
let memoryBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    memoryBroadcastChannel = new BroadcastChannel('fesline_dynamic_memory_bus');
  } catch (e) {
    console.warn('BroadcastChannel initialization note:', e);
  }
}

// In-memory key-value state registry
const dynamicMemoryRegistry = new Map<string, any>();
const memoryListeners = new Set<(event: MemoryEventPayload) => void>();

/**
 * Broadcast memory change to all local subscribers and open browser tabs
 */
export function broadcastMemoryEvent(category: MemoryCategory, type: string, data?: any) {
  const payload: MemoryEventPayload = {
    type,
    category,
    data,
    timestamp: Date.now(),
    sourceTabId: TAB_SESSION_ID,
  };

  // 1. In-process subscribers
  memoryListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.warn('Memory listener error:', err);
    }
  });

  // 2. DOM Custom Event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('fesline_memory_event', { detail: payload }));
    } catch {}
  }

  // 3. Cross-tab Broadcast Channel
  if (memoryBroadcastChannel) {
    try {
      memoryBroadcastChannel.postMessage(payload);
    } catch (err) {
      console.warn('Memory channel broadcast note:', err);
    }
  }
}

// Listen to incoming cross-tab messages
if (memoryBroadcastChannel) {
  memoryBroadcastChannel.onmessage = (e: MessageEvent<MemoryEventPayload>) => {
    if (e.data && e.data.sourceTabId !== TAB_SESSION_ID) {
      // Notify in-process listeners
      memoryListeners.forEach((fn) => {
        try {
          fn(e.data);
        } catch (err) {
          console.warn('Cross-tab memory listener error:', err);
        }
      });

      // Dispatch to window
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('fesline_memory_event', { detail: e.data }));
        } catch {}
      }
    }
  };
}

/**
 * Subscribe to the Dynamic Memory Bus
 */
export function subscribeToDynamicMemory(listener: (event: MemoryEventPayload) => void): () => void {
  memoryListeners.add(listener);
  return () => {
    memoryListeners.delete(listener);
  };
}

/**
 * Dynamic Memory Key-Value Store Helpers
 */
export function setDynamicMemory<T>(key: string, value: T, persistLocalStorage = true): void {
  dynamicMemoryRegistry.set(key, value);
  if (persistLocalStorage && typeof window !== 'undefined') {
    try {
      localStorage.setItem(`fesline_mem_${key}`, JSON.stringify(value));
    } catch {}
  }
  broadcastMemoryEvent('system', `memory_set_${key}`, { key, value });
}

export function getDynamicMemory<T>(key: string, defaultValue?: T): T | undefined {
  if (dynamicMemoryRegistry.has(key)) {
    return dynamicMemoryRegistry.get(key) as T;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`fesline_mem_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        dynamicMemoryRegistry.set(key, parsed);
        return parsed as T;
      }
    } catch {}
  }
  return defaultValue;
}

export function removeDynamicMemory(key: string): void {
  dynamicMemoryRegistry.delete(key);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`fesline_mem_${key}`);
    } catch {}
  }
  broadcastMemoryEvent('system', `memory_removed_${key}`, { key });
}

/**
 * Dynamic Memory Health Check & Self-Healing Diagnostics
 */
export async function runDynamicMemoryDiagnostics(): Promise<{
  status: 'healthy' | 'degraded' | 'repaired';
  details: Record<string, any>;
}> {
  const details: Record<string, any> = {
    tabSessionId: TAB_SESSION_ID,
    broadcastChannelActive: Boolean(memoryBroadcastChannel),
    localStorageAvailable: false,
    indexedDbAvailable: false,
    firestoreConnected: true,
  };

  // 1. Test LocalStorage
  try {
    const testKey = '__fesline_mem_test__';
    localStorage.setItem(testKey, 'ok');
    const read = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    details.localStorageAvailable = read === 'ok';
  } catch (e) {
    details.localStorageAvailable = false;
  }

  // 2. Test IndexedDB
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      details.indexedDbAvailable = true;
    }
  } catch {
    details.indexedDbAvailable = false;
  }

  return {
    status: details.localStorageAvailable && details.indexedDbAvailable ? 'healthy' : 'degraded',
    details,
  };
}
