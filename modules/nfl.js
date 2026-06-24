const db = require("./db");

// ---------------- TEAM MAP ----------------
const TEAM_MAP = {
  eagles: "PHI",
  chiefs: "KC",
  cowboys: "DAL",
  giants: "NYG",
  commanders: "WAS",

  bills: "BUF",
  dolphins: "MIA",
  jets: "NYJ",
  patriots: "NE",

  ravens: "BAL",
  steelers: "PIT",
  browns: "CLE",
  bengals: "CIN",

  colts: "IND",
  texans: "HOU",
  jaguars: "JAX",
  titans: "TEN",

  bears: "CHI",
  packers: "GB",
  lions: "DET",
  vikings: "MIN",

  saints: "NO",
  buccaneers: "TB",
  falcons: "ATL",
  panthers: "CAR",

  "49ers": "SF",
  niners: "SF",
  seahawks: "SEA",
  rams: "LAR",
  cardinals: "ARI"
};

// ---------------- RESOLVE ----------------
function resolveTeam(input) {
  if (!input) return null;
  return TEAM_MAP[input.toLowerCase()] || null;
}

// ---------------- GET REAL TEAM INFO ----------------
async function getTeamInfo(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) {
    return "❌ Unknown team. Try: eagles, chiefs, 49ers";
  }

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;

    if (!teams) return "⚠️ No team data available";

    const match = teams.find(t => t.team.abbreviation === team);

    if (!match) return "❌ Team not found in API";

    const info = match.team;

    return (
`🏈 ${info.displayName}

📊 Record: ${match.record?.items?.[0]?.summary || "N/A"}

🏟 Stadium: ${info.venue?.fullName || "N/A"}

⭐ Conference: ${info.conference?.name || "N/A"}

🔗 https://www.espn.com/nfl/team/_/name/${team}/${info.slug}`
    );

  } catch (err) {
    console.log("NFL ERROR:", err);
    return "⚠️ Failed to load NFL data";
  }
}

// ---------------- COMMANDS ----------------
function commands(client, m) {
  const args = m.content.split(" ");

  // SET TEAM
  if (args[0] === "!team" && args[1] === "set") {
    const team = args[2];

    if (!resolveTeam(team)) {
      return m.reply("❌ Invalid team (try eagles, chiefs, 49ers)");
    }

    db.run("INSERT OR REPLACE INTO nfl VALUES (?,?)", [
      m.author.id,
      team.toLowerCase()
    ]);

    return m.reply(`🏈 Favorite team set to **${team}**`);
  }

  // DASHBOARD (REAL DATA NOW)
  if (args[0] === "!team" && args[1] === "dashboard") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set");

      const info = await getTeamInfo(row.team);

      return m.reply(
`🏈 NFL DASHBOARD

${info}

⚡ Commands:
!team set eagles
!team dashboard`
      );
    });
  }

  // QUICK VIEW
  if (args[0] === "!nfl") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("Set team first: !team set eagles");

      const info = await getTeamInfo(row.team);

      return m.reply(info);
    });
  }
}

// ---------------- INIT ----------------
function init() {}

module.exports = { init, commands };
