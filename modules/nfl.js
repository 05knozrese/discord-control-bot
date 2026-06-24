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

// ---------------- GET LAST GAMES (FIXED PROPERLY) ----------------
async function getLastGames(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) return "❌ Unknown team";

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    if (!data?.events?.length) {
      return "⚠️ No NFL games available";
    }

    const results = [];

    for (const event of data.events) {
      const comp = event?.competitions?.[0];
      if (!comp) continue;

      const c = comp.competitors;
      if (!c || c.length !== 2) continue;

      const a = c[0];
      const b = c[1];

      const aTeam = a.team?.abbreviation;
      const bTeam = b.team?.abbreviation;

      // ONLY include real completed or valid scored games
      const hasScore =
        a.score !== undefined &&
        b.score !== undefined &&
        a.score !== "" &&
        b.score !== "";

      if ((aTeam === team || bTeam === team) && hasScore) {
        results.push(
          `🏈 ${aTeam} ${a.score} - ${b.score} ${bTeam}`
        );
      }

      if (results.length >= 5) break;
    }

    return results.length
      ? results.join("\n")
      : "No recent games found.";

  } catch (err) {
    console.log("NFL ERROR:", err);
    return "⚠️ Failed to load NFL data";
  }
}

// ---------------- GET TEAM INFO ----------------
async function getTeamInfo(teamInput) {
  const team = resolveTeam(teamInput);

  if (!team) return "❌ Unknown team";

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );

    const data = await res.json();

    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
    if (!teams) return "⚠️ No team data";

    const match = teams.find(t => t.team.abbreviation === team);
    if (!match) return "❌ Team not found";

    const info = match.team;

    return (
`🏈 ${info.displayName}

📊 Record: ${match.record?.items?.[0]?.summary || "N/A"}

🏟 Stadium: ${info.venue?.fullName || "N/A"}

⭐ Conference: ${info.conference?.name || "N/A"}

🔗 https://www.espn.com/nfl/team/_/name/${team}/${info.slug}`
    );

  } catch (err) {
    return "⚠️ Failed to load team info";
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

    if (!teams) return "⚠️ No standings data";

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

  // LAST GAMES
  if (args[0] === "!team" && args[1] === "last") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("❌ No team set");

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

      const info = await getTeamInfo(row.team);
      const games = await getLastGames(row.team);

      return m.reply(
`🏈 NFL DASHBOARD

⭐ TEAM INFO:
${info}

📊 LAST GAMES:
${games}

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
