const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ Missing TOKEN");
  process.exit(1);
}

console.log("BOOTING DISCORD BOT...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ ONLINE AS ${client.user.tag}`);
});

client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  if (m.content === "!panel") {
    m.reply(
      "🎛 CONTROL HUB\n" +
      "🎮 Gaming\n" +
      "🏈 NFL\n" +
      "📺 YouTube"
    );
  }
});

client.login(TOKEN);
