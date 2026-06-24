const { Client, GatewayIntentBits, Partials } = require("discord.js");

const panel = require("./modules/panel");
const nfl = require("./modules/nfl");
const youtube = require("./modules/youtube");
const reminders = require("./modules/reminders");
const users = require("./modules/users");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("Missing TOKEN");
  process.exit(1);
}

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
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  panel.commands(client, m);
  nfl.commands(client, m);
  youtube.commands(client, m);
  reminders.commands(client, m);
  users.commands(client, m);

  // HELP COMMAND
  if (m.content === "!help") {
    return m.reply(
`📖 COMMANDS

🎛 PANEL
!panel

🏈 NFL
!nfl
!nfl on
!nfl off

📺 YOUTUBE
!ytadd <channel_id>
!ytlist

⏰ REMINDERS
!remind 10m text

🔔 SETTINGS
!ping on
!ping off
!me
`
    );
  }
});

// BUTTONS FIX
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {
    await i.deferReply({ ephemeral: true });

    if (i.customId === "nfl") {
      return i.editReply("🏈 NFL system active");
    }

    if (i.customId === "yt") {
      return i.editReply("📺 YouTube system active");
    }

    if (i.customId === "settings") {
      return i.editReply(
`⚙️ SETTINGS

🔔 !ping on/off
👤 !me
📺 !ytlist
⏰ !remind`
      );
    }

  } catch (e) {
    console.log(e);
  }
});

client.once("ready", () => {
  console.log(`✅ V7.2 FULL FIXED ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
