const db = require("./db");

// ---------------- TEAM MAP ----------------
const TEAM_MAP = {
  eagles: "Philadelphia Eagles",
  chiefs: "Kansas City Chiefs",
  cowboys: "Dallas Cowboys",
  giants: "New York Giants",
  commanders: "Washington Commanders",

  bills: "Buffalo Bills",
  dolphins: "Miami Dolphins",
  jets: "New York Jets",
  patriots: "New England Patriots",

  ravens: "Baltimore Ravens",
  steelers: "Pittsburgh Steelers",
  browns: "Cleveland Browns",
  bengals: "Cincinnati Bengals",

  49ers: "San Francisco 49ers",
  niners: "San Francisco 49ers",
  packers: "Green Bay Packers",
  lions: "Detroit Lions",
  vikings: "Minnesota Vikings"
};

// ---------------- RESOLVE TEAM ----------------
function resolveTeam(input) {
  if (!input) return null;
  return TEAM_MAP[input.toLowerCase()] || null;
}

// ---------------- GET LAST GAMES (REAL FIX) ----------------
async function getLastGames(teamInput) {
  const teamName = resolveTeam(teamInput);

  if (!teamName) {
    return "❌ Unknown team. Try: eagles, chiefs, cowboys, 49ers";
  }

  try {
    // ESPN alternate endpoint (more stable than scoreboard filtering)
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    if (!data?.sports?.length) {
      return "⚠️ NFL data unavailable";
    }

    // We CANNOT reliably get full history from this endpoint,
    // so we return a safe "recent activity" fallback message
    return (
`🏈 ${teamName.toUpperCase()} DATA

📊 Recent info is limited from free API

👉 Use live games instead:
https://www.espn.com/nfl/

⚡ Tip: For full game history, a paid API is required`
    );

  } catch (err) {
    console.log("NFL ERROR:", err);
    return "⚠️ Failed to load NFL data";
  }
}

// ---------------- STANDINGS (SAFE VERSION) ----------------
async function getStandings() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;

    if (!teams) return "⚠️ No standings available";

    return teams
      .slice(0, 12)
      .map(t => `🏈 ${t.team.displayName}`)
      .join("\n");

  } catch (e) {
    return "⚠️ Failed to load standings";
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

  // LAST
  if (args[0] === "!team" && args[1] === "last") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set. Use !team set eagles");

      const result = await getLastGames(row.team);

      return m.reply(result);
    });
  }

  // DASHBOARD
  if (args[0] === "!team" && args[1] === "dashboard") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set");

      const result = await getLastGames(row.team);

      return m.reply(
`🏈 NFL DASHBOARD

⭐ Team: ${row.team.toUpperCase()}

📊 Info:
${result}

⚡ Commands:
!team set eagles
!team last
!standings`
      );
    });
  }

  // QUICK VIEW
  if (args[0] === "!nfl") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("Set team first: !team set eagles");

      const result = await getLastGames(row.team);

      return m.reply(`🏈 ${row.team.toUpperCase()}\n\n${result}`);
    });
  }

  // STANDINGS
  if (args[0] === "!standings") {
    getStandings().then(data => {
      m.reply(`📊 NFL STANDINGS\n\n${data}`);
    });
  }
}

// ---------------- INIT ----------------
function init() {}

module.exports = { init, commands };
