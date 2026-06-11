const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const API_FOOTBALL_URL = "https://v3.football.api-sports.io/fixtures";
const FINISHED_STATUS = new Set(["FT", "AET", "PEN"]);

exports.closeExpiredPredictions = onSchedule("every 5 minutes", async () => {
  const now = Date.now();
  const snapshot = await db.collection("games").where("status", "==", "open").get();
  const batch = db.batch();
  let count = 0;

  snapshot.forEach((doc) => {
    const game = doc.data();
    const closeAt = Number(game.predictionCloseAtMs || 0);

    if (closeAt && now >= closeAt) {
      batch.update(doc.ref, {
        status: "closed",
        closedAutomatically: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count += 1;
    }
  });

  if (count > 0) await batch.commit();
  logger.info(`Palpites fechados automaticamente: ${count}`);
});

exports.updateResultsFromApiFootball = onSchedule("every 5 minutes", async () => {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    logger.warn("API_FOOTBALL_KEY não configurada. Resultado automático ignorado.");
    return;
  }

  const snapshot = await db.collection("games").get();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const game = doc.data();

    if (!game.externalFixtureId || game.status === "finished") continue;

    const response = await fetch(`${API_FOOTBALL_URL}?id=${encodeURIComponent(game.externalFixtureId)}`, {
      headers: { "x-apisports-key": apiKey }
    });

    if (!response.ok) {
      logger.warn(`Falha ao buscar fixture ${game.externalFixtureId}: ${response.status}`);
      continue;
    }

    const payload = await response.json();
    const fixture = payload?.response?.[0];
    if (!fixture) continue;

    const statusShort = fixture.fixture?.status?.short;
    if (!FINISHED_STATUS.has(statusShort)) continue;

    const homeGoals = fixture.goals?.home;
    const awayGoals = fixture.goals?.away;

    if (homeGoals === null || homeGoals === undefined || awayGoals === null || awayGoals === undefined) {
      continue;
    }

    const penHome = fixture.score?.penalty?.home;
    const penAway = fixture.score?.penalty?.away;
    let penaltyWinner = null;

    if (typeof penHome === "number" && typeof penAway === "number") {
      if (penHome > penAway) penaltyWinner = "A";
      if (penAway > penHome) penaltyWinner = "B";
    }

    await doc.ref.update({
      status: "finished",
      scoreA: Number(homeGoals),
      scoreB: Number(awayGoals),
      penaltyWinner,
      resultUpdatedAutomatically: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    updated += 1;
  }

  logger.info(`Resultados atualizados automaticamente: ${updated}`);
});
