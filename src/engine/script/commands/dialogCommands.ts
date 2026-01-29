/**
 * Dialog Commands - Say, Talk, Choose, Message
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandHelpers, CommandRegistry } from "./types";
import type { SelectionOption } from "../../core/types";

/**
 * Say command - Show dialog with optional portrait
 */
const sayCommand: CommandHandler = (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  const portrait = params[1] ? helpers.resolveNumber(params[1]) : 0;
  console.log(`[ScriptExecutor] Say: "${text.substring(0, 50)}..." portrait=${portrait}`);
  helpers.context.showDialog(text, portrait);
  helpers.state.waitingForInput = true;
  return false;
};

/**
 * Talk command - Show sequential dialogs from TalkIndex.txt
 */
const talkCommand: CommandHandler = (params, _result, helpers) => {
  const startId = helpers.resolveNumber(params[0] || "0");
  const endId = helpers.resolveNumber(params[1] || "0");

  const talkTextList = helpers.context.talkTextList;
  const details = talkTextList.getTextDetails(startId, endId);

  if (details.length > 0) {
    helpers.state.isInTalk = true;
    helpers.state.talkQueue = details.map(d => ({
      text: d.text,
      portraitIndex: d.portraitIndex
    }));

    const first = helpers.state.talkQueue.shift()!;
    helpers.context.showDialog(first.text, first.portraitIndex);
    helpers.state.waitingForInput = true;
  } else {
    console.warn(`[ScriptExecutor] Talk: no dialog found for ${startId}-${endId}`);
    helpers.state.isInTalk = false;
  }
  return false;
};

/**
 * Choose command - Show selection options
 */
const chooseCommand: CommandHandler = (params, _result, helpers) => {
  const lastParam = params[params.length - 1] || "";
  const hasResultVar = lastParam.startsWith("$");

  if (hasResultVar && params.length >= 4) {
    const message = helpers.resolveString(params[0] || "");
    const selectA = helpers.resolveString(params[1] || "");
    const selectB = helpers.resolveString(params[2] || "");
    helpers.state.selectionResultVar = lastParam.slice(1);
    helpers.context.showDialogSelection(message, selectA, selectB);
  } else {
    const options: SelectionOption[] = [];
    for (let i = 0; i < params.length; i += 2) {
      if (params[i] && params[i + 1]) {
        options.push({
          text: helpers.resolveString(params[i]),
          label: params[i + 1],
        });
      }
    }
    helpers.context.showSelection(options, "");
  }

  helpers.state.waitingForInput = true;
  return false;
};

/**
 * Select command - Show selection using TalkTextList IDs
 * C# Reference: Select(parameters) - uses TalkTextList.GetTextDetail(int.Parse(parameters[n])).Text
 * Format: Select(messageId, optionAId, optionBId, $resultVar)
 * Note: C# uses GuiManager.Selection(message, selectA, selectB) via DialogInterface.Select()
 *       The result (0 or 1) is stored in parameters[3] (the variable name).
 */
const selectCommand: CommandHandler = (params, _result, helpers) => {
  const talkTextList = helpers.context.talkTextList;
  const lastParam = params[params.length - 1] || "";

  if (!lastParam.startsWith("$") || params.length < 4) {
    console.warn(`[ScriptExecutor] Select: invalid parameters, expected (messageId, optionAId, optionBId, $var)`);
    return true;
  }

  // C# Reference: GuiManager.Selection(message, selectA, selectB)
  const messageId = helpers.resolveNumber(params[0]);
  const optionAId = helpers.resolveNumber(params[1]);
  const optionBId = helpers.resolveNumber(params[2]);

  const messageDetail = talkTextList.getTextDetail(messageId);
  const optionADetail = talkTextList.getTextDetail(optionAId);
  const optionBDetail = talkTextList.getTextDetail(optionBId);

  const message = messageDetail?.text || `[Text ${messageId}]`;
  const selectA = optionADetail?.text || `[Text ${optionAId}]`;
  const selectB = optionBDetail?.text || `[Text ${optionBId}]`;

  helpers.state.selectionResultVar = lastParam.slice(1);
  helpers.context.showDialogSelection(message, selectA, selectB);

  helpers.state.waitingForInput = true;
  return false;
};

/**
 * Message command - Show system message (direct text)
 */
const messageCommand: CommandHandler = (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  helpers.context.showMessage(text);
  return true;
};

/**
 * DisplayMessage command - Show direct text message
 * C# Reference: GuiManager.ShowMessage(Utils.RemoveStringQuotes(parameters[0]))
 */
const displayMessageCommand: CommandHandler = (params, _result, helpers) => {
  const text = helpers.resolveString(params[0] || "");
  helpers.context.showMessage(text);
  return true;
};

/**
 * ShowMessage command - Show message from TalkTextList by ID
 * C# Reference: TalkTextList.GetTextDetail(int.Parse(parameters[0])).Text
 */
const showMessageCommand: CommandHandler = (params, _result, helpers) => {
  const textId = helpers.resolveNumber(params[0] || "0");
  const talkTextList = helpers.context.talkTextList;
  const detail = talkTextList.getTextDetail(textId);

  if (detail) {
    helpers.context.showMessage(detail.text);
  } else {
    console.warn(`[ScriptExecutor] ShowMessage: no text found for ID ${textId}`);
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
}
