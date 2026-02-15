/**
 * Dialog Commands - Say, Talk, Choose, Message
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */

import type { SelectionOptionData } from "../../core/gui-state-types";
import { logger } from "../../core/logger";
import { evaluateCondition } from "./condition-helper";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * Say command - Show dialog with optional portrait
 * Also calls PlayerKindCharacter.ToNonFightingState()
 */
const sayCommand: CommandHandler = async (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  const portrait = params[1] ? helpers.resolveNumber(params[1]) : 0;
  logger.log(`[ScriptExecutor] Say: "${text.substring(0, 50)}..." portrait=${portrait}`);
  helpers.api.player.toNonFightingState();
  await helpers.api.dialog.show(text, portrait);
  return true;
};

/**
 * Talk command - Show sequential dialogs from TalkIndex.txt
 * Also calls PlayerKindCharacter.ToNonFightingState()
 */
const talkCommand: CommandHandler = async (params, _result, helpers) => {
  const startId = helpers.resolveNumber(params[0] || "0");
  const endId = helpers.resolveNumber(params[1] || "0");
  helpers.api.player.toNonFightingState();
  await helpers.api.dialog.showTalk(startId, endId);
  return true;
};

/**
 * Choose command - Show selection options
 */
const chooseCommand: CommandHandler = async (params, _result, helpers) => {
  const lastParam = params[params.length - 1] || "";
  const hasResultVar = lastParam.startsWith("$");

  if (hasResultVar && params.length >= 4) {
    const message = helpers.resolveString(params[0] || "");
    const selectA = helpers.resolveString(params[1] || "");
    const selectB = helpers.resolveString(params[2] || "");
    const varName = lastParam.slice(1);
    const result = await helpers.api.dialog.showSelection(message, selectA, selectB);
    helpers.api.variables.set(varName, result);
  } else {
    const options: SelectionOptionData[] = [];
    for (let i = 0; i < params.length; i += 2) {
      if (params[i] && params[i + 1]) {
        options.push({
          text: helpers.resolveString(params[i]),
          label: params[i + 1],
          enabled: true,
        });
      }
    }
    const selectedIndex = await helpers.api.dialog.showSelectionList(options, "");
    // For label-based selection, jump to the selected label
    if (options[selectedIndex]) {
      helpers.gotoLabel(options[selectedIndex].label);
    }
  }

  return true;
};

/**
 * Select command - Show selection using TalkTextList IDs
 * Format: Select(messageId, optionAId, optionBId, $resultVar)
 */
const selectCommand: CommandHandler = async (params, _result, helpers) => {
  const talkTextList = helpers.api.dialog.talkTextList;
  const lastParam = params[params.length - 1] || "";

  if (!lastParam.startsWith("$") || params.length < 4) {
    logger.warn(
      `[ScriptExecutor] Select: invalid parameters, expected (messageId, optionAId, optionBId, $var)`
    );
    return true;
  }

  const messageId = helpers.resolveNumber(params[0]);
  const optionAId = helpers.resolveNumber(params[1]);
  const optionBId = helpers.resolveNumber(params[2]);

  const messageDetail = talkTextList.getTextDetail(messageId);
  const optionADetail = talkTextList.getTextDetail(optionAId);
  const optionBDetail = talkTextList.getTextDetail(optionBId);

  const message = messageDetail?.text || `[Text ${messageId}]`;
  const selectA = optionADetail?.text || `[Text ${optionAId}]`;
  const selectB = optionBDetail?.text || `[Text ${optionBId}]`;

  const varName = lastParam.slice(1);
  const result = await helpers.api.dialog.showSelection(message, selectA, selectB);
  helpers.api.variables.set(varName, result);
  return true;
};

/**
 * Message command - Show system message (direct text)
 */
const messageCommand: CommandHandler = (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  helpers.api.dialog.showMessage(text);
  return true;
};

/**
 * DisplayMessage command - Show direct text message
 * Reference: GuiManager.ShowMessage(Utils.RemoveStringQuotes(parameters[0]))
 */
const displayMessageCommand: CommandHandler = (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  helpers.api.dialog.showMessage(text);
  return true;
};

/**
 * ShowMessage command - Show message from TalkTextList by ID
 * Reference: TalkTextList.GetTextDetail(int.Parse(parameters[0])).Text
 */
const showMessageCommand: CommandHandler = (params, _result, helpers) => {
  const textId = helpers.resolveNumber(params[0] || "0");
  const talkTextList = helpers.api.dialog.talkTextList;
  const detail = talkTextList.getTextDetail(textId);

  if (detail) {
    helpers.api.dialog.showMessage(detail.text);
  } else {
    logger.warn(`[ScriptExecutor] ShowMessage: no text found for ID ${textId}`);
  }
  return true;
};

// ============= Extended Dialog Commands =============

/**
 * Helper to parse conditions from option text
 * extracts {condition} from strings
 */
function parseConditions(text: string): { text: string; conditions: string[] } {
  const conditions: string[] = [];
  let outText = "";
  let curCondition = "";
  let inCondition = false;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      inCondition = true;
      curCondition = "";
    } else if (inCondition) {
      if (text[i] === "}") {
        inCondition = false;
        conditions.push(curCondition);
      } else {
        curCondition += text[i];
      }
    } else {
      outText += text[i];
    }
  }

  return { text: outText, conditions };
}

/**
 * ChooseEx - Extended selection with conditional options
 * ChooseEx(message, option1, option2, ..., $resultVar)
 * Options can have {condition} syntax
 */
const chooseExCommand: CommandHandler = async (params, _result, helpers) => {
  if (params.length < 3) {
    logger.warn("[ScriptExecutor] ChooseEx: insufficient parameters");
    return true;
  }

  const message = helpers.resolveString(params[0] || "");
  const resultVar = params[params.length - 1] || "";

  if (!resultVar.startsWith("$")) {
    logger.warn("[ScriptExecutor] ChooseEx: last parameter must be a variable");
    return true;
  }

  const options: Array<{ text: string; condition?: string }> = [];

  for (let i = 1; i < params.length - 1; i++) {
    const rawText = helpers.resolveString(params[i] || "");
    const parsed = parseConditions(rawText);

    let isVisible = true;
    for (const cond of parsed.conditions) {
      if (!evaluateCondition(cond, helpers.api.variables.get)) {
        isVisible = false;
        break;
      }
    }

    if (isVisible) {
      options.push({ text: parsed.text });
    }
  }

  const result = await helpers.api.dialog.chooseEx(message, options, resultVar.slice(1));
  helpers.api.variables.set(resultVar.slice(1), result);
  return true;
};

/**
 * ChooseMultiple - Multi-selection dialog
 * ChooseMultiple(columns, rows, varPrefix, message, option1, option2, ...)
 */
const chooseMultipleCommand: CommandHandler = async (params, _result, helpers) => {
  if (params.length < 5) {
    logger.warn("[ScriptExecutor] ChooseMultiple: insufficient parameters");
    return true;
  }

  const columns = helpers.resolveNumber(params[0] || "1");
  const rows = helpers.resolveNumber(params[1] || "1");
  const varPrefix = helpers.resolveString(params[2] || "");
  const message = helpers.resolveString(params[3] || "");

  const options: Array<{ text: string; condition?: string }> = [];

  for (let i = 4; i < params.length; i++) {
    const rawText = helpers.resolveString(params[i] || "");
    const parsed = parseConditions(rawText);

    let isVisible = true;
    for (const cond of parsed.conditions) {
      if (!evaluateCondition(cond, helpers.api.variables.get)) {
        isVisible = false;
        break;
      }
    }

    if (isVisible) {
      options.push({ text: parsed.text });
    }
  }

  const results = await helpers.api.dialog.chooseMultiple(
    columns,
    rows,
    varPrefix,
    message,
    options
  );
  for (let i = 0; i < results.length; i++) {
    helpers.api.variables.set(`${varPrefix}${i}`, results[i]);
  }
  return true;
};

/**
 * Register all dialog commands
 */
export function registerDialogCommands(registry: CommandRegistry): void {
  registry.set("say", sayCommand);
  registry.set("talk", talkCommand);
  registry.set("choose", chooseCommand);
  registry.set("select", selectCommand);
  registry.set("message", messageCommand);
  registry.set("displaymessage", displayMessageCommand);
  registry.set("showmessage", showMessageCommand);

  // Extended dialog
  registry.set("chooseex", chooseExCommand);
  registry.set("choosemultiple", chooseMultipleCommand);
}
