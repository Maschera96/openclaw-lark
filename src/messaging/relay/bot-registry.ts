/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Bot 注册表 - 管理所有已启用的 Bot 信息
 *
 * 功能：
 * - 维护 openId → accountId 的映射
 * - 维护 accountId → botInfo 的映射
 * - 提供查询接口
 */

import type { ClawdbotConfig } from 'openclaw/plugin-sdk';
import { getEnabledLarkAccounts } from '../../core/accounts';
import { LarkClient } from '../../core/lark-client';
import { larkLogger } from '../../core/lark-logger';

const log = larkLogger('relay/bot-registry');

export interface BotInfo {
  accountId: string;
  botName: string;
  botOpenId: string;
  enabled: boolean;
}

class BotRegistry {
  private openIdToAccount = new Map<string, string>();
  private accountToBot = new Map<string, BotInfo>();
  private initialized = false;

  /**
   * 初始化注册表 - 从配置加载所有启用的 Bot
   */
  async initialize(cfg: ClawdbotConfig): Promise<void> {
    if (this.initialized) return;

    const accounts = getEnabledLarkAccounts(cfg);
    log.info(`botRegistry: initializing with ${accounts.length} accounts`);

    for (const account of accounts) {
      const lark = LarkClient.fromAccount(account);
      const botOpenId = lark.botOpenId;

      log.debug(`botRegistry: accountId=${account.accountId}, botOpenId=${botOpenId ?? 'null'}`);

      if (botOpenId) {
        this.openIdToAccount.set(botOpenId, account.accountId);
        this.accountToBot.set(account.accountId, {
          accountId: account.accountId,
          botName: account.name || account.accountId,
          botOpenId,
          enabled: account.enabled,
        });
        log.info(`botRegistry: registered bot ${account.accountId} with open_id ${botOpenId}`);
      }
    }

    this.initialized = true;
    log.info(`botRegistry: initialized with ${this.openIdToAccount.size} bots`);
  }

  /**
   * 根据 openId 查找 Bot 的 accountId
   */
  findAccountIdByOpenId(openId: string): string | undefined {
    return this.openIdToAccount.get(openId);
  }

  /**
   * 根据 accountId 获取 Bot 信息
   */
  getBotInfo(accountId: string): BotInfo | undefined {
    return this.accountToBot.get(accountId);
  }

  /**
   * 检查给定的 openId 是否属于已注册的 Bot
   */
  isBotOpenId(openId: string): boolean {
    return this.openIdToAccount.has(openId);
  }

  /**
   * 获取所有已注册的 Bot 列表
   */
  getAllBots(): BotInfo[] {
    return Array.from(this.accountToBot.values());
  }

  /**
   * 重置注册表（用于配置重新加载）
   */
  reset(): void {
    this.openIdToAccount.clear();
    this.accountToBot.clear();
    this.initialized = false;
  }
}

// 单例导出
export const botRegistry = new BotRegistry();
