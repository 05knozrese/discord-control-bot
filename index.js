const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ Missing TOKEN in Railway Variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- SAFE START ----------------
client.once("ready", () => {
  console.log(`✅ V7 ONLINE: ${client.user.tag}`);
});

// ---------------- PANEL ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  if (m.content === "!panel") {
    return m.reply(
      "🎛 CONTROL HUB V7\n\n" +
      "🎮 Gaming Tracking\n" +
      "🏈 NFL Live (coming)\n" +
      "📺 YouTube Tracking (coming)\n" +
      "⏰ Reminders\n"
    );
  }
});

// ---------------- SAFE LOGIN ----------------
client.login(TOKEN);
