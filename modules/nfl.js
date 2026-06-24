const db = require("./db");

// ---------------- FULL TEAM MAP ----------------
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
  49ers: "SF",
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

// ---------------- GET LAST GAMES ----------------
async function getLastGames(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) {
    return "❌ Unknown team. Try: eagles, chiefs, cowboys, 49ers...";
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

        const home = c[0];
        const away = c[1];

        return `🏈 ${home.team.abbreviation} ${home.score} - ${away.score} ${away.team.abbreviation}`;
      })
      .join("\n");

    return games || "No recent games found.";
  } catch (err) {
    console.log("NFL API error:", err);
    return "⚠️ Failed to load NFL data.";
  }
}

// ---------------- COMMANDS ----------------
function commands(client, m) {
  const args = m.content.split(" ");

  // SET FAVORITE TEAM
  if (args[0] === "!team" && args[1] === "set") {
    const team = args[2];

    if (!resolveTeam(team)) {
      return m.reply(
        "❌ Invalid team.\nTry: eagles, chiefs, cowboys, packers, 49ers..."
      );
    }

    db.run(
      "INSERT OR REPLACE INTO nfl VALUES (?,?)",
      [m.author.id, team.toLowerCase()]
    );

    return m.reply(`🏈 Favorite team set to **${team}**`);
  }

  // DASHBOARD (MAIN FEATURE YOU WANTED)
  if (args[0] === "!team" && args[1] === "dashboard") {
    db.get(
      "SELECT team FROM nfl WHERE user_id=?",
      [m.author.id],
      async (err, row) => {
        if (!row) {
          return m.reply("❌ No team set. Use `!team set eagles`");
        }

        const games = await getLastGames(row.team);

        return m.reply(
`🏈 NFL TEAM DASHBOARD

⭐ Favorite Team: ${row.team.toUpperCase()}

📊 Last 5 Games:
${games}

⚡ Commands:
!team set eagles
!team dashboard`
        );
      }
    );
  }

  // QUICK VIEW
  if (args[0] === "!nfl") {
    db.get(
      "SELECT team FROM nfl WHERE user_id=?",
      [m.author.id],
      async (err, row) => {
        if (!row) return m.reply("Set a team first: !team set eagles");

        const games = await getLastGames(row.team);

        return m.reply(`🏈 ${row.team.toUpperCase()} Recent Games:\n\n${games}`);
      }
    );
  }
}

// ---------------- INIT ----------------
function init() {}

module.exports = { init, commands };
