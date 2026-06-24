const db = require("./db");

// ---------------- TEAM ALIASES (ALL TEAMS) ----------------
const TEAM_MAP = {
  // AFC EAST
  bills: "BUF",
  dolphins: "MIA",
  jets: "NYJ",
  patriots: "NE",

  // AFC NORTH
  ravens: "BAL",
  steelers: "PIT",
  browns: "CLE",
  bengals: "CIN",

  // AFC SOUTH
  colts: "IND",
  texans: "HOU",
  jaguars: "JAX",
  titans: "TEN",

  // AFC WEST
  chiefs: "KC",
  raiders: "LV",
  broncos: "DEN",
  chargers: "LAC",

  // NFC EAST
  eagles: "PHI",
  cowboys: "DAL",
  giants: "NYG",
  commanders: "WAS",

  // NFC NORTH
  bears: "CHI",
  packers: "GB",
  lions: "DET",
  vikings: "MIN",

  // NFC SOUTH
  saints: "NO",
  buccaneers: "TB",
  bucs: "TB",
  falcons: "ATL",
  panthers: "CAR",

  // NFC WEST
  "49ers": "SF",
  niners: "SF",
  seahawks: "SEA",
  rams: "LAR",
  cardinals: "ARI"
};

// ---------------- RESOLVE TEAM ----------------
function resolveTeam(input) {
  if (!input) return null;
  return TEAM_MAP[input.toLowerCase()] || null;
}

// ---------------- GET LAST 5 GAMES ----------------
async function getLastGames(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) {
    return "❌ Unknown team. Try: eagles, chiefs, cowboys, 49ers";
  }

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    const games = data.events
      .filter(game =>
        game.competitions[0].competitors.some(
          t => t.team.abbreviation === team
        )
      )
      .slice(0, 5)
      .map(game => {
        const c = game.competitions[0].competitors;
        const a = c[0];
        const b = c[1];

        return `🏈 ${a.team.abbreviation} ${a.score} - ${b.score} ${b.team.abbreviation}`;
      })
      .join("\n");

    return games || "No recent games found.";
  } catch (err) {
    console.log("NFL API error:", err);
    return "⚠️ Failed to load NFL data";
  }
}

// ---------------- STANDINGS ----------------
async function getStandings() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    return data.sports?.[0]?.leagues?.[0]?.teams
      ?.slice(0, 10)
      .map(t => `🏈 ${t.team.displayName}`)
      .join("\n") || "No standings available";
  } catch (e) {
    return "⚠️ Failed to load standings";
  }
}

// ---------------- COMMANDS ----------------
function commands(client, m) {
  const args = m.content.split(" ");

  // SET FAVORITE TEAM
  if (args[0] === "!team" && args[1] === "set") {
    const team = args[2];

    if (!resolveTeam(team)) {
      return m.reply("❌ Invalid team. Example: eagles, chiefs, 49ers");
    }

    db.run("INSERT OR REPLACE INTO nfl VALUES (?,?)", [
      m.author.id,
      team.toLowerCase()
    ]);

    return m.reply(`🏈 Favorite team set to **${team}**`);
  }

  // TEAM DASHBOARD
  if (args[0] === "!team" && args[1] === "dashboard") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set. Use !team set eagles");

      const games = await getLastGames(row.team);

      return m.reply(
`🏈 NFL DASHBOARD

⭐ Team: ${row.team.toUpperCase()}

📊 Last 5 Games:
${games}

⚡ Commands:
!team set eagles
!team dashboard
!standings`
      );
    });
  }

  // QUICK NFL VIEW
  if (args[0] === "!nfl") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("Set a team first: !team set eagles");

      const games = await getLastGames(row.team);

      return m.reply(`🏈 ${row.team.toUpperCase()} RECENT GAMES\n\n${games}`);
    });
  }

  // STANDINGS TAB
  if (args[0] === "!standings") {
    getStandings().then(data => {
      m.reply(`📊 NFL STANDINGS\n\n${data}`);
    });
  }
}

// ---------------- INIT ----------------
function init() {}

module.exports = { init, commands };
