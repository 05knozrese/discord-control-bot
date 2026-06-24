const { Client, GatewayIntentBits, Partials } = require("discord.js");

const panel = require("./modules/panel");
const nfl = require("./modules/nfl");
const youtube = require("./modules/youtube");
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
users.init(client);

// COMMAND ROUTER
client.on("messageCreate", (m) => {
  if (m.author.bot) return;

  panel.commands(client, m);
  nfl.commands(client, m);
  youtube.commands(client, m);
  users.commands(client, m);

  if (m.content === "!help") {
    m.reply(
`📖 V8 COMMANDS

🏈 NFL
!team set <TEAM>
!team last

📺 YOUTUBE
!yt add <channel_id>
!yt remove <channel_id>
!yt list

⚙️ SETTINGS
!ping on/off`
    );
  }
});

// BUTTONS (FIXED - NO INTERACTION FAIL)
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {
    await i.deferReply({ ephemeral: true });

    if (i.customId === "nfl")
      return i.editReply("🏈 NFL: use !team set <TEAM>");

    if (i.customId === "yt")
      return i.editReply("📺 YouTube: !yt add/remove/list");

    if (i.customId === "settings")
      return i.editReply("⚙️ Settings: !ping on/off");

  } catch (e) {
    console.log(e);
  }
});

client.once("ready", () => {
  console.log(`✅ V8 ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
