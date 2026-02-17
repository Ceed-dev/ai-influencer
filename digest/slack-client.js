'use strict';

const { WebClient } = require('@slack/web-api');
const config = require('./config');

/** @type {WebClient|null} */
let client = null;

function getClient() {
  if (!client) {
    if (!config.slack.botToken) {
      throw new Error('SLACK_BOT_TOKEN is not set. Add it to .env or environment variables.');
    }
    client = new WebClient(config.slack.botToken);
  }
  return client;
}

/**
 * Find channel ID by name (paginated).
 * Searches both public and private channels the bot has access to.
 */
async function findChannelId(channelName) {
  const web = getClient();
  let cursor;
  const types = 'public_channel,private_channel';

  do {
    const res = await web.conversations.list({
      types,
      limit: 200,
      cursor,
      exclude_archived: true,
    });
    const found = res.channels.find((ch) => ch.name === channelName);
    if (found) return found.id;
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  return null;
}

/**
 * Fetch messages from a channel within a time range (paginated).
 * @param {string} channelId
 * @param {string} oldest - Unix timestamp (seconds, as string)
 * @param {string} latest - Unix timestamp (seconds, as string)
 * @returns {Promise<Array>}
 */
async function fetchMessages(channelId, oldest, latest) {
  const web = getClient();
  const messages = [];
  let cursor;

  do {
    const res = await web.conversations.history({
      channel: channelId,
      oldest,
      latest,
      inclusive: true,
      limit: 200,
      cursor,
    });
    if (res.messages) messages.push(...res.messages);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  // Slack returns newest first — reverse to chronological
  messages.reverse();
  return messages;
}

/**
 * Fetch thread replies for a parent message.
 */
async function fetchThreadReplies(channelId, threadTs) {
  const web = getClient();
  const replies = [];
  let cursor;

  do {
    const res = await web.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
      cursor,
    });
    // First message is the parent — skip it
    if (res.messages) {
      replies.push(...res.messages.slice(replies.length === 0 ? 1 : 0));
    }
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  return replies;
}

/**
 * Resolve user IDs to display names (cached).
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
async function resolveUserNames(userIds) {
  const web = getClient();
  const names = new Map();
  const unique = [...new Set(userIds)];

  for (const uid of unique) {
    try {
      const res = await web.users.info({ user: uid });
      const u = res.user;
      names.set(uid, u.profile?.display_name || u.real_name || u.name || uid);
    } catch {
      names.set(uid, uid);
    }
  }

  return names;
}

/**
 * Build Slack permalink from channel ID and message ts.
 * Format: https://{workspace}.slack.com/archives/{channelId}/p{ts without dot}
 */
function buildPermalink(channelId, messageTs) {
  const domain = config.slack.workspaceDomain;
  if (!domain) return null;
  const tsNoDot = messageTs.replace('.', '');
  return `https://${domain}.slack.com/archives/${channelId}/p${tsNoDot}`;
}

/**
 * High-level: fetch a full day's conversation from a channel.
 * Also looks back 30 days for old threads that received new replies on the target day.
 * @param {string} channelName
 * @param {string} oldest - Unix timestamp (seconds)
 * @param {string} latest - Unix timestamp (seconds)
 * @returns {Promise<{messages, threadReplies, continuedThreads, users, stats, channelId}>}
 */
async function fetchDayConversation(channelName, oldest, latest) {
  const channelId = await findChannelId(channelName);
  if (!channelId) {
    throw new Error(
      `Channel "${channelName}" not found. Make sure the bot is invited to the channel.`
    );
  }

  const messages = await fetchMessages(channelId, oldest, latest);

  // Collect thread replies for today's messages
  const threadReplies = new Map();
  const threaded = messages.filter((m) => m.reply_count && m.reply_count > 0);
  for (const m of threaded) {
    const replies = await fetchThreadReplies(channelId, m.ts);
    if (replies.length > 0) threadReplies.set(m.ts, replies);
  }

  // Look back 30 days for old threads with new replies today
  const continuedThreads = new Map();
  const lookbackOldest = String(parseFloat(oldest) - 30 * 86400);
  const olderMessages = await fetchMessages(channelId, lookbackOldest, oldest);

  for (const m of olderMessages) {
    if (m.reply_count > 0 && m.latest_reply &&
        parseFloat(m.latest_reply) >= parseFloat(oldest) &&
        parseFloat(m.latest_reply) < parseFloat(latest)) {
      const allReplies = await fetchThreadReplies(channelId, m.ts);
      const todayReplies = allReplies.filter(
        (r) => parseFloat(r.ts) >= parseFloat(oldest) && parseFloat(r.ts) < parseFloat(latest)
      );
      if (todayReplies.length > 0) {
        continuedThreads.set(m.ts, { parent: m, replies: todayReplies });
      }
    }
  }

  // Collect all user IDs
  const userIds = new Set();
  for (const m of messages) {
    if (m.user) userIds.add(m.user);
  }
  for (const replies of threadReplies.values()) {
    for (const r of replies) {
      if (r.user) userIds.add(r.user);
    }
  }
  for (const { parent, replies } of continuedThreads.values()) {
    if (parent.user) userIds.add(parent.user);
    for (const r of replies) {
      if (r.user) userIds.add(r.user);
    }
  }

  const users = await resolveUserNames([...userIds]);

  const continuedReplyCount = [...continuedThreads.values()]
    .reduce((sum, { replies }) => sum + replies.length, 0);
  const stats = {
    messageCount: messages.length,
    threadCount: threadReplies.size,
    participantCount: users.size,
    continuedThreadCount: continuedThreads.size,
    continuedReplyCount,
  };

  return { messages, threadReplies, continuedThreads, users, stats, channelId };
}

module.exports = {
  findChannelId,
  fetchMessages,
  fetchThreadReplies,
  resolveUserNames,
  buildPermalink,
  fetchDayConversation,
  // Exposed for testing
  _setClient: (c) => { client = c; },
};
