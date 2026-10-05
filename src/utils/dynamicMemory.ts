/**
 * Real-time Supabase Event Relay for Fesline Portfolio
 * (LocalStorage and Dynamic Memory Multi-tier engine removed completely in favor of Supabase Database & Realtime)
 */
import { broadcastSupabaseMemoryEvent, subscribeToSupabaseRealtimeChat } from './supabase';

export type MemoryCategory = 'profile' | 'documents' | 'chats' | 'ui_preferences' | 'system';

export interface MemoryEventPayload {
  type: string;
  category: MemoryCategory;
  data?: any;
  timestamp: number;
}

const listeners = new Set<(event: MemoryEventPayload) => void>();

// Subscribe to Supabase Realtime channel
if (typeof window !== 'undefined') {
  subscribeToSupabaseRealtimeChat((payload) => {
    if (payload && payload.category && payload.type) {
      listeners.forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.warn('Supabase event listener error:', e);
        }
      });
    }
  });
}

/**
 * Broadcast event directly over Supabase Realtime channel & local in-memory listeners (Zero LocalStorage)
 */
export function broadcastMemoryEvent(category: MemoryCategory, type: string, data?: any) {
  const payload: MemoryEventPayload = {
    type,
    category,
    data,
    timestamp: Date.now(),
  };

  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('Local event listener error:', e);
    }
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('fesline_memory_event', { detail: payload }));
    } catch {}
  }

  // Broadcast through Supabase Realtime
  broadcastSupabaseMemoryEvent(category, type, data).catch(() => {});
}

/**
 * Subscribe to Supabase Realtime Events
 */
export function subscribeToDynamicMemory(listener: (event: MemoryEventPayload) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// In-memory runtime state only (no localStorage)
const inMemoryCache = new Map<string, any>();

export function setDynamicMemory<T>(key: string, value: T): void {
  inMemoryCache.set(key, value);
  broadcastMemoryEvent('system', `memory_set_${key}`, { key, value });
}

export function getDynamicMemory<T>(key: string, defaultValue?: T): T | undefined {
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key) as T;
  }
  return defaultValue;
}

export function removeDynamicMemory(key: string): void {
  inMemoryCache.delete(key);
  broadcastMemoryEvent('system', `memory_removed_${key}`, { key });
}
