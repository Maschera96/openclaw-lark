/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Bot-to-Bot Relay 核心逻辑
 *
 * 功能：
 * - 解析消息中的 @mention
 * - 识别目标 Bot
 * - 创建合成事件并触发处理
 */

import type { ClawdbotConfig } from 'openclaw/plugin-sdk';
import { botRegistry } from './bot-registry';
import { createSyntheticMessageEvent } from './synthetic-event';
import { handleFeishuMessage } from '../inbound/handler';
import { larkLogger } from '../../core/lark-logger';
import { LarkClient } from '../../core/lark-client';

const log = larkLogger('relay/bot-relay');

/**
 * 解析出的 @mention 信息
 */
export interface ParsedMention {
  openId: string;
  name: string;
}

/**
 * Relay 配置
 */
export interface RelayConfig {
  enabled: boolean;          // 是否启用 relay
  maxRelayDepth: number;    // 最大 relay 深度（防止循环）
  currentDepth: number;       // 当前 relay 深度
}

/**
 * 从消息文本中解析 @mention
 *
 * 支持两种格式：
 * 1. <at user_id="ou_xxx">name</at>（文本消息）
 * 2. <at id=ou_xxx></at>（卡片消息）
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // 文本消息格式
  const textPattern = /<at\s+user_id="([^"]+)">([^<]*)<\/at>/g;
  let match;
  while ((match = textPattern.exec(text)) !== null) {
    mentions.push({
      openId: match[1],
      name: match[2].trim()
    });
  }

  // 卡片消息格式
  const cardPattern = /<at\s+id=([^>]+)><\/at>/g;
  while ((match = cardPattern.exec(text)) !== null) {
    mentions.push({
      openId: match[1],
      name: '' // 卡片格式没有名称
    });
  }

  return mentions;
}

/**
 * 执行 Bot Relay
 *
 * 流程：
 * 1. 解析消息中的 @mention
 * 2. 识别目标 Bot
 * 3. 创建合成事件
 * 4. 调用目标 Bot 的消息处理函数
 */
export async function relayToBot(params: {
  cfg: ClawdbotConfig;
  senderAccountId: string;    // 发送消息的 Bot 的 accountId
  targetOpenId: string;       // 目标 Bot 的 openId
  chatId: string;            // 聊天 ID
  messageId: string;          // 原始消息 ID（用于 reply）
  content: string;            // 消息内容
  chatType: 'p2p' | 'group';
  relayConfig: RelayConfig;
}): Promise<void> {
  const { cfg, senderAccountId, targetOpenId, chatId, content, chatType, relayConfig } = params;

  log.debug(`relayToBot: called from ${senderAccountId} to ${targetOpenId} in ${chatId}`);

  // 检查 relay 是否启用
  if (!relayConfig.enabled) {
    log.debug('relay is disabled, skipping');
    return;
  }

  // 检查 relay 深度
  if (relayConfig.currentDepth >= relayConfig.maxRelayDepth) {
    log.warn(`max relay depth reached (${relayConfig.maxRelayDepth}), stopping relay`);
    return;
  }

  // 查找目标 Bot
  const targetAccountId = botRegistry.findAccountIdByOpenId(targetOpenId);
  if (!targetAccountId) {
    log.debug(`target bot not found for openId=${targetOpenId}`);
    const allBots = botRegistry.getAllBots();
    const allOpenIds = allBots.map(b => b.botOpenId).filter(Boolean);
    log.debug(`available openIds: ${allOpenIds.join(', ')}`);
    return;
  }

  // 防止自 relay
  if (targetAccountId === senderAccountId) {
    log.debug('cannot relay to self');
    return;
  }

  // 获取发送者 Bot 信息
  const senderBot = botRegistry.getBotInfo(senderAccountId);
  if (!senderBot?.botOpenId) {
    log.error(`sender bot info not found for accountId=${senderAccountId}`);
    return;
  }

  // 创建合成事件
  const syntheticEvent = createSyntheticMessageEvent({
    senderBotOpenId: senderBot.botOpenId,
    chatId,
    content,
    replyToMessageId: params.messageId,
    chatType,
    originalAccountId: senderAccountId
  });

  // 获取目标 Bot 的 LarkClient
  const targetLark = LarkClient.get(targetAccountId);
  if (!targetLark) {
    log.error(`target bot client not found for accountId=${targetAccountId}`);
    return;
  }

  // 调用消息处理（使用 forceMention=true 跳过策略网关）
  try {
    await handleFeishuMessage({
      cfg,
      event: syntheticEvent,
      botOpenId: targetLark.botOpenId,
      runtime: undefined, // relay 场景不需要 runtime
      accountId: targetAccountId,
      forceMention: true,  // 关键：跳过策略网关
      replyToMessageId: undefined // 不作为回复，作为新消息处理
    });

    log.info(`relayed message from bot ${senderAccountId} to bot ${targetAccountId}`);
  } catch (err) {
    log.error(`relay failed from ${senderAccountId} to ${targetAccountId}: ${String(err)}`);
    // 不抛出错误，避免影响原始消息发送流程
  }
}
