/**
 * Platform adapter registry
 * Spec: 04-agent-design.md §4.7, §5.3
 *
 * Provides getAdapter() to route publish tasks to the correct platform adapter.
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter } from './types';
import { YouTubeAdapter } from './youtube';
import { TikTokAdapter } from './tiktok';
import { InstagramAdapter } from './instagram';
import { XAdapter } from './x';

export type { PlatformAdapter, PublishTaskPayload, PublishResult, PublishMetadata } from './types';

/** Singleton adapter instances */
const adapters: Record<Platform, PlatformAdapter> = {
  youtube: new YouTubeAdapter(),
  tiktok: new TikTokAdapter(),
  instagram: new InstagramAdapter(),
  x: new XAdapter(),
};

/**
 * Get the platform adapter for a given platform.
 *
 * @param platform - The target platform
 * @returns The corresponding PlatformAdapter instance
 * @throws Error if the platform is unknown
 */
export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`No adapter registered for platform: ${platform}`);
  }
  return adapter;
}

/**
 * Get all registered platform adapters.
 */
export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(adapters);
}
