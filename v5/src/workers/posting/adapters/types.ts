/**
 * Platform adapter interfaces
 * Spec: 04-agent-design.md §4.7, 10-implementation-guide.md §6.5
 */
import type { Platform, PublicationMetadata } from '@/types/database';

/** Payload for a publish task from task_queue */
export interface PublishTaskPayload {
  task_id: number;
  content_id: string;
  account_id: string;
  platform: Platform;
  video_drive_id?: string;
  metadata: PublishMetadata;
}

/** Metadata specific to publishing */
export interface PublishMetadata {
  title?: string;
  description?: string;
  caption?: string;
  text?: string;
  tags?: string[];
  thumbnail_drive_id?: string;
}

/** Result of a successful publish operation */
export interface PublishResult {
  platform_post_id: string;
  post_url: string;
  posted_at: string;
}

/** Common interface for platform-specific publishing adapters */
export interface PlatformAdapter {
  /** The platform this adapter handles */
  platform: Platform;

  /**
   * Publish content to the platform.
   * @param payload - The publish task payload
   * @returns The result of the publish operation
   * @throws Error if the publish fails
   */
  publish(payload: PublishTaskPayload): Promise<PublishResult>;

  /**
   * Refresh OAuth token for an account.
   * @param accountId - The account whose token to refresh
   * @returns Whether the refresh was successful
   */
  refreshToken(accountId: string): Promise<boolean>;
}
