/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Bot Relay 模块统一导出
 */

export { botRegistry, type BotInfo } from './bot-registry';
export { parseMentions, relayToBot, type RelayConfig, type ParsedMention } from './bot-relay';
export { createSyntheticMessageEvent } from './synthetic-event';
