// @ts-ignore
import telegramBot from "node-telegram-bot-api";
import { convert } from "telegram-markdown-v2";
import { KineticOrchestrator } from "./agents/agentOrchestrator";

const token = "8431288849:AAFFuSm3WeACAWQ-UeDkQcsANnmLEVmo194";
const bot = new telegramBot(token, { polling: true });
const ALLOWLIST = [1684016585];

const kineticOrchestrator = new KineticOrchestrator();

const isAuthorized = (msg: any) => {
  if (ALLOWLIST.includes(msg.from.id)) return true;

  bot.sendMessage(
    msg.chat.id,
    "🚫 You do not have permission to use this bot.",
  );
  return false;
};

bot.on("message", async (msg: any) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(msg)) return;
  const query = msg.text;
  try {
    switch (query) {
      case "/start":
        await bot.sendMessage(
          chatId,
          "Welcome to K.I.N.E.T.I.C. Security Analyst Bot! Ask me anything about cybersecurity, and I'll do my best to assist you. How can I help you today?",
        );
        break;
      case "/help":
        await bot.sendMessage(
          chatId,
          "You can ask me anything related to cybersecurity, such as:\n- How to secure a network\n- What is phishing\n- Best practices for password management\n- And much more! Just type your question and I'll provide an answer.",
        );
        break;
      default:
        bot.sendChatAction(chatId, "typing");
        const typingInterval = setInterval(() => {
          bot.sendChatAction(chatId, "typing").catch(() => {});
        }, 4000);

        try {
          const res = await kineticOrchestrator.process(query);
          clearInterval(typingInterval);
          const safeText = convert(res);
          await bot.sendMessage(chatId, safeText, { parse_mode: "MarkdownV2" });
        } catch (error) {
          clearInterval(typingInterval);
          console.error("Orchestrator failed:", error);
        }
        break;
    }
  } catch (error) {
    console.error("Failed to send message:", error);
  }
});

// model: "llama-3.1-8b-instant",
