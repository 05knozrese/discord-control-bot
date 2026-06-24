const { Client, GatewayIntentBits, Partials } = require("discord.js");

const panel = require("./modules/panel");
const nfl = require("./modules/nfl");
const youtube = require("./modules/youtube");
const reminders = require("./modules/reminders");
const users = require("./modules/users");

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// INIT MODULES
nfl.init(client);
youtube.init(client);
reminders.init(client);
users.init(client);

// COMMAND ROUTER
client.on("messageCreate", (m) => {
  if (m.author.bot) return;

  panel.commands(client, m);
  nfl.commands(client, m);
  youtube.commands(client, m);
  reminders.commands(client, m);
  users.commands(client, m);
});

// BUTTONS (FIXED + CLEAN)
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {
    await i.deferReply({ ephemeral: true });

    if (i.customId === "nfl") return i.editReply("🏈 NFL dashboard active");
    if (i.customId === "yt") return i.editReply("📺 YouTube system active");
    if (i.customId === "settings") return i.editReply("⚙️ Use !settings");

  } catch (e) {
    console.log(e);
  }
});

client.once("ready", () => {
  console.log(`✅ V7.2 ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
