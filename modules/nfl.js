const db = require("./db");

// ---------------- TEAM MAP ----------------
const TEAM_MAP = {
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

  chiefs: "KC",
  raiders: "LV",
  broncos: "DEN",
  chargers: "LAC",

  eagles: "PHI",
  cowboys: "DAL",
  giants: "NYG",
  commanders: "WAS",

  bears: "CHI",
  packers: "GB",
  lions: "DET",
  vikings: "MIN",

  saints: "NO",
  buccaneers: "TB",
  bucs: "TB",
  falcons: "ATL",
  panthers: "CAR",

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

// ---------------- GET LAST GAMES (FIXED) ----------------
async function getLastGames(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) {
    return "❌ Unknown team. Try: eagles, chiefs, 49ers, cowboys";
  }

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    if (!data?.events) return "⚠️ No NFL data available";

    const games = [];

    for (const game of data.events) {
      const comp = game?.competitions?.[0];
      if (!comp) continue;

      const c = comp.competitors;
      if (!c || c.length !== 2) continue;

      const a = c[0];
      const b = c[1];

      const aTeam = a.team?.abbreviation;
      const bTeam = b.team?.abbreviation;

      if (aTeam === team || bTeam === team) {
        games.push(
          `🏈 ${aTeam} ${a.score ?? "0"} - ${b.score ?? "0"} ${bTeam}`
        );
      }

      if (games.length >= 5) break;
    }

    return games.length
      ? games.join("\n")
      : "No recent games found.";
  } catch (err) {
    console.log("NFL ERROR:", err);
    return "⚠️ NFL API failed";
  }
}

// ---------------- STANDINGS ----------------
async function getStandings() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;

    if (!teams) return "⚠️ No standings available";

    return teams
      .slice(0, 10)
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

  // LAST GAMES (FIXED)
  if (args[0] === "!team" && args[1] === "last") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set. Use !team set eagles");

      const games = await getLastGames(row.team);

      return m.reply(
`🏈 LAST 5 GAMES (${row.team.toUpperCase()})

${games}`
      );
    });
  }

  // DASHBOARD
  if (args[0] === "!team" && args[1] === "dashboard") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set");

      const games = await getLastGames(row.team);

      return m.reply(
`🏈 NFL DASHBOARD

⭐ Team: ${row.team.toUpperCase()}

📊 Last Games:
${games}

Commands:
!team last
!team set eagles
!standings`
      );
    });
  }

  // QUICK VIEW
  if (args[0] === "!nfl") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("Set team first: !team set eagles");

      const games = await getLastGames(row.team);
      return m.reply(`🏈 ${row.team.toUpperCase()}\n\n${games}`);
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
