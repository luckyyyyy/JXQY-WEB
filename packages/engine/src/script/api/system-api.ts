/**
 * System APIs - Dialog, Variable, Input, Save, ScriptRunner implementations
 */

import { logger } from "../../core/logger";
import { resolveScriptPath } from "../../resource/resource-paths";
import { BlockingEvent, type BlockingResolver } from "../blocking-resolver";
import type { DialogAPI, InputAPI, SaveAPI, ScriptRunnerAPI, VariableAPI } from "./game-api";
import type { ScriptCommandContext } from "./types";

export function createDialogAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): DialogAPI {
  const { guiManager, talkTextList } = ctx;

  return {
    show: async (text, portraitIndex) => {
      // 按 <Enter>/<enter>（大小写不敏感）拆分为多页，逐页展示（同 TalkLabel.splitTalkString）
      const pages = text.split(/<enter>/i);
      for (const page of pages) {
        const trimmed = page.trim();
        if (!trimmed) continue;
        ctx.clearMouseInput?.();
        guiManager.showDialog(trimmed, portraitIndex);
        await resolver.waitForEvent(BlockingEvent.DIALOG_CLOSED);
      }
    },

    showTalk: async (startId, endId) => {
      const details = talkTextList.getTextDetails(startId, endId);
      for (const detail of details) {
        // 同 show()，按 <Enter> 拆分为多页
        const pages = detail.text.split(/<enter>/i);
        for (const page of pages) {
          const trimmed = page.trim();
          if (!trimmed) continue;
          ctx.clearMouseInput?.();
          guiManager.showDialog(trimmed, detail.portraitIndex);
          await resolver.waitForEvent(BlockingEvent.DIALOG_CLOSED);
        }
      }
    },

    showMessage: (text) => {
      guiManager.showMessage(text);
    },

    showSelection: async (message, selectA, selectB) => {
      ctx.clearMouseInput?.();
      guiManager.showDialogSelection(message, selectA, selectB);
      return resolver.waitForEvent<number>(BlockingEvent.SELECTION_MADE);
    },

    showSelectionList: async (options, message?) => {
      ctx.clearMouseInput?.();
      guiManager.showSelection(
        options.map((o) => ({ ...o, enabled: true })),
        message || ""
      );
      return resolver.waitForEvent<number>(BlockingEvent.SELECTION_MADE);
    },

    chooseEx: async (message, options, _resultVar) => {
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: true,
      }));
      guiManager.showSelection(selectionOptions, message);
      return resolver.waitForEvent<number>(BlockingEvent.SELECTION_MADE);
    },

    chooseMultiple: async (columns, rows, _varPrefix, message, options) => {
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: opt.condition !== "false",
      }));
      guiManager.showMultiSelection(columns, rows, message, selectionOptions);
      return resolver.waitForEvent<number[]>(BlockingEvent.CHOOSE_MULTIPLE_DONE);
    },

    showSystemMessage: (msg, stayTime?) => {
      guiManager.showMessage(msg, stayTime || 3000);
    },
    selectByIds: async (messageId, optionAId, optionBId) => {
      const messageDetail = talkTextList.getTextDetail(messageId);
      const optionADetail = talkTextList.getTextDetail(optionAId);
      const optionBDetail = talkTextList.getTextDetail(optionBId);
      const message = messageDetail?.text || `[Text ${messageId}]`;
      const selectA = optionADetail?.text || `[Text ${optionAId}]`;
      const selectB = optionBDetail?.text || `[Text ${optionBId}]`;
      ctx.clearMouseInput?.();
      guiManager.showDialogSelection(message, selectA, selectB);
      return resolver.waitForEvent<number>(BlockingEvent.SELECTION_MADE);
    },
    talkTextList,
  };
}

export function createVariableAPI(ctx: ScriptCommandContext): VariableAPI {
  const { npcManager, partnerList, getVariables, setVariable } = ctx;

  return {
    get: (name) => getVariables()[name] || 0,
    set: (name, value) => {
      setVariable(name, value);
    },
    clearAll: (keepsVars?) => {
      const variables = getVariables();
      const keeps: Record<string, number> = {};
      for (const key of keepsVars || []) {
        const normalizedKey = key.startsWith("$") ? key : `$${key}`;
        if (normalizedKey in variables) {
          keeps[normalizedKey] = variables[normalizedKey];
        }
      }
      for (const key of Object.keys(variables)) {
        delete variables[key];
      }
      for (const [key, value] of Object.entries(keeps)) {
        variables[key] = value;
      }
    },
    getPartnerIndex: () => {
      const partners = npcManager.getAllPartner();
      if (partners.length > 0) {
        const partnerName = partners[0].name;
        return partnerList.getIndex(partnerName);
      }
      return partnerList.getCount() + 1;
    },
    checkYear: (varName) => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const isNewYearsDay = month === 1 && day === 1;
      const isSpringFestival = (month === 1 && day >= 20) || (month === 2 && day <= 20);
      setVariable(varName, isNewYearsDay || isSpringFestival ? 1 : 0);
    },
  };
}

export function createInputAPI(ctx: ScriptCommandContext): InputAPI {
  return {
    setEnabled: (_enabled) => {
      // In TypeScript, script execution already blocks input
      // This is mainly for explicit cutscene control
    },
  };
}

export function createSaveAPI(ctx: ScriptCommandContext): SaveAPI {
  return {
    setEnabled: (enabled) => {
      if (enabled) ctx.enableSave();
      else ctx.disableSave();
    },
    clearAll: () => {
      /* cloud saves are managed by server */
    },
  };
}

export function createScriptRunnerAPI(
  ctx: ScriptCommandContext,
  resolver: BlockingResolver
): ScriptRunnerAPI {
  return {
    run: async (scriptFile) => {
      const basePath = ctx.getScriptBasePath();
      await ctx.runScript(resolveScriptPath(basePath, scriptFile));
    },
    runParallel: (scriptFile, delay?) => {
      if (ctx.runParallelScript) {
        ctx.runParallelScript(scriptFile, delay || 0);
      } else {
        logger.warn(`[GameAPI.script] runParallel not available: ${scriptFile}`);
      }
    },
    returnToTitle: () => {
      ctx.returnToTitle();
    },
    randRun: (_probability, _script1, _script2) => {
      // Handled by command handler directly
    },
    setShowMapPos: (show) => {
      ctx.setScriptShowMapPos(show);
    },
    sleep: async (ms) => {
      const start = performance.now();
      await resolver.waitForCondition(() => performance.now() - start >= ms);
    },
    loadGame: async (index) => {
      await ctx.loadGameSave(index);
    },
    setInterfaceVisible: (visible) => {
      ctx.guiManager.setInterfaceVisible(visible);
    },
    saveGame: () => {
      ctx.guiManager.showSaveLoad(true);
    },
    showGamble: async (cost: number, _npcType: number) => {
      // 让玩家选择游戏
      ctx.clearMouseInput?.();
      ctx.guiManager.showSelection([
        { text: `🎲 骰子赌坊（${cost} 两/次）`, label: "0", enabled: true },
        { text: "🎰 老虎机（1000 两/次）", label: "1", enabled: true },
        { text: `🃏 斗地主（${cost} 两/次）`, label: "2", enabled: true },
      ], "请选择要玩的游戏：");
      const choice = await resolver.waitForEvent<number>(BlockingEvent.SELECTION_MADE);

      const initialMoney = ctx.player.money;

      if (choice === 1) {
        // 老虎机
        const slotManager = ctx.slotManager;
        slotManager.startSlot(1000, ctx.player);
        ctx.guiManager.openSlotGui();
        await resolver.waitForCondition(() => !slotManager.isOpen());
      } else if (choice === 2) {
        // 斗地主
        const doudizhuManager = ctx.doudizhuManager;
        doudizhuManager.startGame(cost, ctx.player);
        ctx.guiManager.openDoudizhuGui();
        await resolver.waitForCondition(() => !doudizhuManager.isOpen());
      } else {
        // 骰子赌坊
        const gambleManager = ctx.gambleManager;
        gambleManager.startGamble(cost, ctx.player);
        ctx.guiManager.openGambleGui();
        await resolver.waitForCondition(() => !gambleManager.isOpen());
      }

      return ctx.player.money > initialMoney;
    },
    updateState: () => {
      // Force UI to refresh all player state
      ctx.guiManager.setInterfaceVisible(true);
      logger.log("[ScriptRunnerAPI] UpdateState: forced UI refresh");
    },
    showMouseCursor: () => {
      // Web browsers always show cursor; no-op but log for awareness
      if (typeof document !== "undefined") {
        document.body.style.cursor = "auto";
      }
      logger.log("[ScriptRunnerAPI] ShowMouseCursor");
    },
    hideMouseCursor: () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "none";
      }
      logger.log("[ScriptRunnerAPI] HideMouseCursor");
    },
  };
}
