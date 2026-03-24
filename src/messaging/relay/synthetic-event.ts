/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * 合成事件创建工具
 *
 * 创建模拟的 FeishuMessageEvent 用于 Bot-to-Bot Relay
 */

import type { FeishuMessageEvent } from '../types';

/**
 * 创建合成消息事件
 *
 * 合成事件用于在应用层模拟 Bot 间的通信，
 * 因为飞书的 im.message.receive_v1 事件不会触发 Bot 发送的消息。
 */
export function createSyntheticMessageEvent(params: {
  senderBotOpenId: string;
  chatId: string;
  content: string;
  replyToMessageId?: string;
  chatType: 'p2p' | 'group';
  originalAccountId: string;
}): FeishuMessageEvent {
  const syntheticMessageId = `synthetic:${Date.now()}:${params.originalAccountId}`;

  return {
    sender: {
      sender_id: {
        open_id: params.senderBotOpenId,
      },
      sender_type: 'app', // Bot 发送
      tenant_key: '',
    },
    message: {
      message_id: syntheticMessageId,
      chat_id: params.chatId,
      chat_type: params.chatType,
      message_type: 'text',
      content: JSON.stringify({
        text: params.content,
      }),
      create_time: String(Math.floor(Date.now() / 1000)),
      update_time: String(Math.floor(Date.now() / 1000)),
      mentions: [], // 合成事件不包含 @mention 信息，由解析阶段补充
      user_agent: 'openclaw-lark/relay',
      // 如果是回复消息，设置 parent_id
      ...(params.replyToMessageId ? {
        parent_id: params.replyToMessageId,
        root_id: params.replyToMessageId,
      } : {}),
    },
  };
}
