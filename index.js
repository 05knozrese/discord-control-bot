const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- DASHBOARD PAGES ----------------
function mainPanel() {
  return new EmbedBuilder()
    .setTitle("🎛 V9 CONTROL DASHBOARD")
    .setDescription(
`🏈 NFL Center
📅 Eagles Schedule
📺 YouTube Alerts
🎮 Gaming Stats

Click a button below to navigate.`
    )
    .setColor("Blue");
}

function nflPage() {
  return new EmbedBuilder()
    .setTitle("🏈 NFL DASHBOARD")
    .setDescription(
`⭐ Favorite Team: Eagles

📊 Features:
- Live score tracking (coming)
- Standings view (coming)
- Game alerts (coming)

👉 Use Schedule button for games`
    )
    .setColor("Green");
}

function youtubePage() {
  return new EmbedBuilder()
    .setTitle("📺 YOUTUBE CENTER")
    .setDescription(
`🔔 Channel Alerts System

Commands:
!yt add <channel>
!yt list
!yt remove <channel>

⚠️ Notifications system ready for upgrade`
    )
    .setColor("Red");
}

function gamingPage() {
  return new EmbedBuilder()
    .setTitle("🎮 GAMING CENTER")
    .setDescription(
`📊 Game Tracking:
- Session logging active
- Playtime stats (WIP)
- Weekly breakdown (WIP)`
    )
    .setColor("Purple");
}

function schedulePage() {
  return new EmbedBuilder()
    .setTitle("📅 PHILADELPHIA EAGLES")
    .setDescription(
`🦅 Schedule:

https://www.espn.com/nfl/team/schedule/_/name/phi/philadelphia-eagles

🏟 Lincoln Financial Field`
    )
    .setColor("Green");
}

// ---------------- BUTTONS ----------------
function menuButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("home")
      .setLabel("🏠 Home")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("nfl")
      .setLabel("🏈 NFL")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("schedule")
      .setLabel("📅 Eagles")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("youtube")
      .setLabel("📺 YouTube")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("gaming")
      .setLabel("🎮 Gaming")
      .setStyle(ButtonStyle.Primary)
  );
}

// ---------------- COMMAND ----------------
client.on("messageCreate", async (m) => {
  if (m.content === "!panel") {
    return m.reply({
      embeds: [mainPanel()],
      components: [menuButtons()]
    });
  }

  if (m.content === "!eagles") {
    return m.reply({
      embeds: [schedulePage()]
    });
  }
});

// ---------------- INTERACTIONS ----------------
client.on("interactionCreate", async (i) => {
  try {
    if (!i.isButton()) return;

    await i.deferReply({ ephemeral: true });

    switch (i.customId) {
      case "home":
        return i.editReply({
          embeds: [mainPanel()],
          components: [menuButtons()]
        });

      case "nfl":
        return i.editReply({
          embeds: [nflPage()],
          components: [menuButtons()]
        });

      case "schedule":
        return i.editReply({
          embeds: [schedulePage()],
          components: [menuButtons()]
        });

      case "youtube":
        return i.editReply({
          embeds: [youtubePage()],
          components: [menuButtons()]
        });

      case "gaming":
        return i.editReply({
          embeds: [gamingPage()],
          components: [menuButtons()]
        });

      default:
        return i.editReply("⚠️ Unknown panel option");
    }

  } catch (err) {
    console.log("Interaction error:", err);

    if (i.deferred || i.replied) {
      return i.editReply("⚠️ Error occurred");
    }

    return i.reply({
      content: "⚠️ Interaction failed",
      ephemeral: true
    });
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`✅ V9 DASHBOARD ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);
