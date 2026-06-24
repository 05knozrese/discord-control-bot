const { Client, GatewayIntentBits, Partials } = require("discord.js");

const panel = require("./modules/panel");
const nfl = require("./modules/nfl");
const youtube = require("./modules/youtube");
const reminders = require("./modules/reminders");
const users = require("./modules/users");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ Missing TOKEN in environment variables");
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

// ---------------- INIT MODULES ----------------
nfl.init(client);
youtube.init(client);
reminders.init(client);
users.init(client);

// ---------------- COMMAND ROUTER ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  try {
    panel.commands(client, m);
    nfl.commands(client, m);
    youtube.commands(client, m);
    reminders.commands(client, m);
    users.commands(client, m);

    // HELP MENU
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
!me`
      );
    }

  } catch (e) {
    console.log("Command error:", e);
  }
});

// ---------------- BUTTONS (FIXED DASHBOARD) ----------------
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {
    await i.deferReply({ ephemeral: true });

    if (i.customId === "nfl") {
      return i.editReply(
`🏈 NFL DASHBOARD

!nfl → live scores
!nfl on → auto updates
!nfl off → stop updates`
      );
    }

    if (i.customId === "yt") {
      return i.editReply(
`📺 YOUTUBE DASHBOARD

!ytadd <channel_id>
!ytlist

✔ auto notifications ON`
      );
    }

    if (i.customId === "settings") {
      return i.editReply(
`⚙️ SETTINGS

!ping on/off
!remind
!me`
      );
    }

  } catch (e) {
    console.log("Interaction error:", e);
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`✅ BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
