import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { firebaseConfig } from "./firebaseConfig.js";
import { flagUrl, teamDataFromGame } from "./teams.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/* Coleções separadas para colaboradores */
const COLLECTIONS = {
  games: "games",
  users: "users_colaboradores",
  predictions: "predictions_colaboradores"
};

/* Helpers de DOM */
function byId(id) {
  return document.getElementById(id);
}

/* Auth / áreas */
const authArea =
  byId("authArea") ||
  byId("loginArea") ||
  byId("participantAuthArea");

const appArea =
  byId("appArea") ||
  byId("mainArea") ||
  byId("participantArea");

const googleLoginBtn =
  byId("googleLoginBtn") ||
  byId("loginGoogleBtn") ||
  byId("signInGoogleBtn") ||
  byId("googleSignInBtn");

const logoutBtn = byId("logoutBtn");

const loggedUserName =
  byId("loggedUserName") ||
  byId("currentUserName") ||
  byId("userName");

const loggedUserEmail =
  byId("loggedUserEmail") ||
  byId("currentUserEmail") ||
  byId("userEmail");

/* Formulário */
const predictionForm = byId("predictionForm");
const formMessage = byId("formMessage");

const collaboratorNameInput =
  byId("collaboratorName") ||
  byId("employeeName") ||
  byId("name");

const registrationNumberInput =
  byId("registrationNumber") ||
  byId("employeeRegistration") ||
  byId("matricula");

const gameSelect = byId("gameSelect");
const matchArea = byId("matchArea");
const guessAInput = byId("guessA");
const guessBInput = byId("guessB");

/* Visual da partida */
const teamAName = byId("teamAName");
const teamBName = byId("teamBName");
const teamAFlag = byId("teamAFlag");
const teamBFlag = byId("teamBFlag");
const teamAEmoji = byId("teamAEmoji");
const teamBEmoji = byId("teamBEmoji");
const teamACode = byId("teamACode");
const teamBCode = byId("teamBCode");
const teamAVisualName = byId("teamAVisualName");
const teamBVisualName = byId("teamBVisualName");

/* Pênaltis */
const penaltyArea = byId("penaltyArea");
const penaltyWinnerSelect = byId("penaltyWinner");
const penaltyTeamAOption = byId("penaltyTeamAOption");
const penaltyTeamBOption = byId("penaltyTeamBOption");

/* Listas / rankings */
const gamesList = byId("gamesList");
const publicGameSelect = byId("publicGameSelect");

const rankingList = byId("rankingList");
const gameRankingSelect = byId("gameRankingSelect");
const gameRankingList = byId("gameRankingList");

let games = [];
let predictions = [];
let users = [];
let selectedGameRankingId = "";
let selectedPublicGameId = "";
let currentUserProfile = null;

const statusLabels = {
  open: "Palpites abertos",
  closed: "Palpites encerrados",
  finished: "Resultado lançado"
};

/* Utilitários */
function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeRegistrationNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.-]/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timestampToMillis(value) {
  if (!value) return null;

  if (typeof value === "number") return value;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function gameKickoffMs(game) {
  return Number(
    game?.kickoffAtMs ||
    timestampToMillis(game?.kickoffAt) ||
    Date.parse(game?.date || "")
  );
}

function gameCloseMs(game) {
  return Number(
    game?.predictionCloseAtMs ||
    timestampToMillis(game?.predictionCloseAt) ||
    (gameKickoffMs(game) - 5 * 60 * 1000)
  );
}

function formatDate(value) {
  if (!value) return "Data a definir";

  const ms = typeof value === "number"
    ? value
    : timestampToMillis(value) || Date.parse(value);

  const date = new Date(ms);

  if (Number.isNaN(date.getTime())) return "Data a definir";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function predictionCreatedAtMillis(prediction) {
  return (
    prediction.createdAtMs ||
    timestampToMillis(prediction.createdAt) ||
    timestampToMillis(prediction.updatedAt) ||
    Number.MAX_SAFE_INTEGER
  );
}

function formatShortDateTime(ms) {
  if (!ms || ms === Number.MAX_SAFE_INTEGER) return "horário não registrado";

  const date = new Date(ms);

  if (Number.isNaN(date.getTime())) return "horário não registrado";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getGameById(id) {
  return games.find((game) => game.id === id);
}

function getUserById(uid) {
  return users.find((user) => user.id === uid || user.uid === uid);
}

function isPredictionOpen(game) {
  if (!game || game.status !== "open") return false;

  const closeAt = gameCloseMs(game);

  if (!Number.isFinite(closeAt)) return false;

  return Date.now() < closeAt;
}

function showMessage(text, type = "success") {
  if (!formMessage) return;

  formMessage.textContent = text;
  formMessage.classList.toggle("error", type === "error");
}

function clearMessage() {
  if (!formMessage) return;

  formMessage.textContent = "";
  formMessage.classList.remove("error");
}

/* Auth */
async function saveUserProfile(user) {
  if (!user) return null;

  const userRef = doc(db, COLLECTIONS.users, user.uid);
  const userSnap = await getDoc(userRef);

  const baseProfile = {
    uid: user.uid,
    name: user.displayName || "Colaborador",
    email: user.email || "",
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp()
  };

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      createdAt: serverTimestamp()
    });
  } else {
    await setDoc(userRef, baseProfile, { merge: true });
  }

  const updatedSnap = await getDoc(userRef);

  return {
    id: user.uid,
    ...updatedSnap.data()
  };
}

function showLoggedOut() {
  if (authArea) authArea.classList.remove("hidden");
  if (appArea) appArea.classList.add("hidden");

  if (predictionForm) {
    predictionForm.classList.add("hidden");
  }

  hideMatchArea();
}

function showLoggedIn(user) {
  if (authArea) authArea.classList.add("hidden");
  if (appArea) appArea.classList.remove("hidden");

  if (predictionForm) {
    predictionForm.classList.remove("hidden");
  }

  if (loggedUserName) {
    loggedUserName.textContent = user?.displayName || "Colaborador";
  }

  if (loggedUserEmail) {
    loggedUserEmail.textContent = user?.email || "";
  }
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert("Não foi possível entrar com Google. Confira se o domínio está autorizado no Firebase.");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserProfile = null;
    showLoggedOut();
    return;
  }

  try {
    currentUserProfile = await saveUserProfile(user);
    showLoggedIn(user);
  } catch (error) {
    console.error(error);
    alert("Login feito, mas não foi possível salvar seu perfil. Confira as regras do Firestore.");
  }
});

/* Visual da partida */
function showMatchArea() {
  if (!matchArea) return;

  matchArea.classList.remove("hidden");

  if (guessAInput) {
    guessAInput.disabled = false;
    guessAInput.required = true;
  }

  if (guessBInput) {
    guessBInput.disabled = false;
    guessBInput.required = true;
  }
}

function hideMatchArea() {
  if (!matchArea) return;

  matchArea.classList.add("hidden");

  if (guessAInput) {
    guessAInput.value = "";
    guessAInput.disabled = true;
    guessAInput.required = false;
  }

  if (guessBInput) {
    guessBInput.value = "";
    guessBInput.disabled = true;
    guessBInput.required = false;
  }

  hidePenaltyArea();
}

function hidePenaltyArea() {
  if (!penaltyArea) return;

  penaltyArea.classList.add("hidden");

  if (penaltyWinnerSelect) {
    penaltyWinnerSelect.value = "";
    penaltyWinnerSelect.required = false;
  }
}

function updatePenaltyArea(game) {
  if (!penaltyArea || !penaltyWinnerSelect) return;

  if (!game || game.phaseType !== "knockout" || !game.allowPenalties) {
    hidePenaltyArea();
    return;
  }

  const teamA = teamDataFromGame(game, "A");
  const teamB = teamDataFromGame(game, "B");

  if (penaltyTeamAOption) {
    penaltyTeamAOption.value = "A";
    penaltyTeamAOption.textContent = teamA.name;
  }

  if (penaltyTeamBOption) {
    penaltyTeamBOption.value = "B";
    penaltyTeamBOption.textContent = teamB.name;
  }

  penaltyArea.classList.remove("hidden");
  penaltyWinnerSelect.required = false;
}

function setFlagVisual(imgElement, emojiElement, team) {
  if (!imgElement || !emojiElement) return;

  const frame = imgElement.closest(".flag-frame");
  const src = flagUrl(team);

  if (frame) frame.classList.remove("fallback");

  imgElement.classList.remove("is-hidden");
  emojiElement.textContent = team.emoji || "⚽";

  if (!src) {
    if (frame) frame.classList.add("fallback");

    imgElement.classList.add("is-hidden");
    imgElement.removeAttribute("src");
    return;
  }

  imgElement.onerror = () => {
    if (frame) frame.classList.add("fallback");
    imgElement.classList.add("is-hidden");
  };

  imgElement.src = src;
  imgElement.alt = `Bandeira ${team.name}`;
}

function updateMatchVisual(game) {
  const teamA = game
    ? teamDataFromGame(game, "A")
    : { code: "BRA", name: "Brasil", flagCode: "br", emoji: "🇧🇷" };

  const teamB = game
    ? teamDataFromGame(game, "B")
    : { code: "MAR", name: "Marrocos", flagCode: "ma", emoji: "🇲🇦" };

  if (teamAName) teamAName.textContent = teamA.name;
  if (teamBName) teamBName.textContent = teamB.name;
  if (teamACode) teamACode.textContent = teamA.code;
  if (teamBCode) teamBCode.textContent = teamB.code;
  if (teamAVisualName) teamAVisualName.textContent = teamA.name;
  if (teamBVisualName) teamBVisualName.textContent = teamB.name;

  setFlagVisual(teamAFlag, teamAEmoji, teamA);
  setFlagVisual(teamBFlag, teamBEmoji, teamB);
  updatePenaltyArea(game);
}

/* Select de jogo para enviar palpite */
function renderGameSelect() {
  if (!gameSelect || !predictionForm) return;

  const openGames = games.filter((game) => isPredictionOpen(game));
  const previousSelectedGameId = gameSelect.value;

  gameSelect.innerHTML = "";

  if (!openGames.length) {
    gameSelect.innerHTML = `<option value="">Nenhum jogo aberto no momento</option>`;

    const submitBtn = predictionForm.querySelector("button[type='submit'], button");
    if (submitBtn) submitBtn.disabled = true;

    hideMatchArea();
    return;
  }

  const submitBtn = predictionForm.querySelector("button[type='submit'], button");
  if (submitBtn) submitBtn.disabled = false;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione uma partida";
  gameSelect.appendChild(placeholder);

  openGames.forEach((game) => {
    const teamA = teamDataFromGame(game, "A");
    const teamB = teamDataFromGame(game, "B");

    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = `${teamA.name} x ${teamB.name} • ${game.phase || "Partida"} • ${formatDate(game.date)}`;

    gameSelect.appendChild(option);
  });

  const selectedStillExists = openGames.some((game) => game.id === previousSelectedGameId);

  if (selectedStillExists) {
    gameSelect.value = previousSelectedGameId;
  } else {
    gameSelect.value = "";
  }

  updateSelectedTeams();
}

function updateSelectedTeams() {
  if (!gameSelect) return;

  const selectedGameId = gameSelect.value;
  const selectedGame = getGameById(selectedGameId);

  if (!selectedGameId || !selectedGame) {
    hideMatchArea();
    return;
  }

  updateMatchVisual(selectedGame);
  showMatchArea();
}

if (gameSelect) {
  gameSelect.addEventListener("change", updateSelectedTeams);
}

/* Visualizar jogo por dropdown */
function miniFlagMarkup(team) {
  const src = flagUrl(team);

  if (!src) return escapeHtml(team.emoji || "⚽");

  return `
    <img
      src="${src}"
      alt="Bandeira ${escapeHtml(team.name)}"
      loading="lazy"
      onerror="this.style.display='none'; this.parentElement.textContent='${escapeHtml(team.emoji || "⚽")}';"
    />
  `;
}

function renderPublicGameSelect() {
  if (!publicGameSelect) return;

  const previousValue = selectedPublicGameId || publicGameSelect.value;

  publicGameSelect.innerHTML = "";

  if (!games.length) {
    publicGameSelect.innerHTML = `<option value="">Nenhuma partida cadastrada</option>`;
    selectedPublicGameId = "";
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione uma partida";
  publicGameSelect.appendChild(placeholder);

  games.forEach((game) => {
    const teamA = teamDataFromGame(game, "A");
    const teamB = teamDataFromGame(game, "B");

    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = `${teamA.name} x ${teamB.name} • ${game.phase || "Partida"} • ${formatDate(game.date)}`;

    publicGameSelect.appendChild(option);
  });

  const stillExists = games.some((game) => game.id === previousValue);

  if (stillExists) {
    selectedPublicGameId = previousValue;
    publicGameSelect.value = previousValue;
  } else {
    selectedPublicGameId = "";
    publicGameSelect.value = "";
  }
}

function renderGamesList() {
  if (!gamesList) return;

  if (!games.length) {
    gamesList.innerHTML = `<div class="empty-state">Nenhum jogo cadastrado ainda.</div>`;
    return;
  }

  if (!selectedPublicGameId) {
    gamesList.innerHTML = `<div class="empty-state">Selecione uma partida acima para visualizar.</div>`;
    return;
  }

  const game = games.find((item) => item.id === selectedPublicGameId);

  if (!game) {
    gamesList.innerHTML = `<div class="empty-state">Partida não encontrada.</div>`;
    return;
  }

  const teamA = teamDataFromGame(game, "A");
  const teamB = teamDataFromGame(game, "B");

  const result = game.status === "finished"
    ? `<span>${game.scoreA} x ${game.scoreB}</span>`
    : `<span>${formatDate(game.date)}</span>`;

  const closedByTime = game.status === "open" && !isPredictionOpen(game);

  const statusText = closedByTime
    ? "Palpites encerrados"
    : (statusLabels[game.status] || escapeHtml(game.status));

  const penaltyResult = game.penaltyWinner === "A"
    ? `<small>Classificado nos pênaltis: ${escapeHtml(teamA.name)}</small>`
    : game.penaltyWinner === "B"
      ? `<small>Classificado nos pênaltis: ${escapeHtml(teamB.name)}</small>`
      : "";

  gamesList.innerHTML = `
    <article class="game-card selected-game-card">
      <div class="game-meta">
        <span>${escapeHtml(game.phase || "Partida")}</span>
        ${result}
      </div>

      <div class="game-teams-visual">
        <div class="game-mini-team">
          <div class="mini-flag">${miniFlagMarkup(teamA)}</div>
          <strong>${escapeHtml(teamA.code)}</strong>
          <span>${escapeHtml(teamA.name)}</span>
        </div>

        <div class="game-x">x</div>

        <div class="game-mini-team">
          <div class="mini-flag">${miniFlagMarkup(teamB)}</div>
          <strong>${escapeHtml(teamB.code)}</strong>
          <span>${escapeHtml(teamB.name)}</span>
        </div>
      </div>

      ${penaltyResult}

      <span class="game-status">${statusText}</span>
    </article>
  `;
}

if (publicGameSelect) {
  publicGameSelect.addEventListener("change", () => {
    selectedPublicGameId = publicGameSelect.value;
    renderGamesList();
  });
}

/* Pontuação */
function getResultSign(a, b) {
  if (a > b) return "A";
  if (a < b) return "B";
  return "E";
}

function getQualifiedSide(scoreA, scoreB, penaltyWinner = null) {
  if (scoreA > scoreB) return "A";
  if (scoreA < scoreB) return "B";
  return penaltyWinner || "E";
}

function calculatePredictionScore(prediction, game) {
  if (!game || game.status !== "finished") {
    return { points: 0, exact: false };
  }

  const realA = Number(game.scoreA);
  const realB = Number(game.scoreB);
  const guessA = Number(prediction.guessA);
  const guessB = Number(prediction.guessB);

  if ([realA, realB, guessA, guessB].some(Number.isNaN)) {
    return { points: 0, exact: false };
  }

  const isKnockout = game.phaseType === "knockout" && game.allowPenalties;

  const realQualified = isKnockout
    ? getQualifiedSide(realA, realB, game.penaltyWinner)
    : getResultSign(realA, realB);

  const guessedQualified = isKnockout
    ? getQualifiedSide(guessA, guessB, prediction.penaltyWinner)
    : getResultSign(guessA, guessB);

  let points = 0;
  let exact = false;

  if (realA === guessA && realB === guessB) {
    points += 10;
    exact = true;
  } else {
    if (realQualified === guessedQualified) points += 5;
    if (realA === guessA) points += 2;
    if (realB === guessB) points += 2;
  }

  if (
    isKnockout &&
    realA === realB &&
    game.penaltyWinner &&
    prediction.penaltyWinner &&
    game.penaltyWinner === prediction.penaltyWinner
  ) {
    points += 3;
  }

  return { points, exact };
}

function sortRankingItems(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exacts !== a.exacts) return b.exacts - a.exacts;

  if (a.firstPredictionAtMs !== b.firstPredictionAtMs) {
    return a.firstPredictionAtMs - b.firstPredictionAtMs;
  }

  return a.name.localeCompare(b.name);
}

function buildRanking() {
  const rankingMap = new Map();

  predictions.forEach((prediction) => {
    const game = getGameById(prediction.gameId);
    const score = calculatePredictionScore(prediction, game);

    const registrationNumber = prediction.registrationNumber || "Sem matrícula";
    const key = prediction.registrationKey || normalizeRegistrationNumber(registrationNumber) || prediction.userId;

    const createdAtMs = predictionCreatedAtMillis(prediction);

    if (!rankingMap.has(key)) {
      rankingMap.set(key, {
        name: prediction.name || "Colaborador",
        registrationNumber,
        points: 0,
        exacts: 0,
        guesses: 0,
        firstPredictionAtMs: createdAtMs
      });
    }

    const item = rankingMap.get(key);

    item.points += score.points;
    item.exacts += score.exact ? 1 : 0;
    item.guesses += 1;
    item.firstPredictionAtMs = Math.min(item.firstPredictionAtMs, createdAtMs);
  });

  return Array.from(rankingMap.values()).sort(sortRankingItems);
}

function buildGameRanking(gameId) {
  const game = getGameById(gameId);

  if (!game) return [];

  return predictions
    .filter((prediction) => prediction.gameId === gameId)
    .map((prediction) => {
      const score = calculatePredictionScore(prediction, game);

      return {
        name: prediction.name || "Colaborador",
        registrationNumber: prediction.registrationNumber || "Sem matrícula",
        guessA: prediction.guessA,
        guessB: prediction.guessB,
        penaltyWinner: prediction.penaltyWinner || null,
        points: score.points,
        exacts: score.exact ? 1 : 0,
        guesses: 1,
        firstPredictionAtMs: predictionCreatedAtMillis(prediction)
      };
    })
    .sort(sortRankingItems);
}

/* Ranking geral */
function renderRanking() {
  if (!rankingList) return;

  const ranking = buildRanking();

  if (!ranking.length) {
    rankingList.classList.add("empty-state");
    rankingList.innerHTML = "O ranking geral aparece assim que os primeiros palpites entrarem.";
    return;
  }

  rankingList.classList.remove("empty-state");

  rankingList.innerHTML = ranking
    .slice(0, 50)
    .map((item, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1;
      const medalClass = index < 3 ? "medal" : "";

      return `
        <div class="rank-item">
          <div class="rank-pos ${medalClass}">${medal}</div>

          <div class="rank-name">
            <strong>${escapeHtml(item.name)}</strong>
            <span>Matrícula ${escapeHtml(item.registrationNumber)} • ${item.guesses} palpite(s) • ${item.exacts} placar(es) exato(s)</span>
            <small>Desempate: primeiro palpite em ${formatShortDateTime(item.firstPredictionAtMs)}</small>
          </div>

          <div class="rank-points">${item.points}</div>
        </div>
      `;
    })
    .join("");
}

/* Ranking por partida */
function renderGameRankingSelect() {
  if (!gameRankingSelect) return;

  const previousValue = selectedGameRankingId || gameRankingSelect.value;

  gameRankingSelect.innerHTML = "";

  if (!games.length) {
    gameRankingSelect.innerHTML = `<option value="">Nenhuma partida cadastrada</option>`;
    selectedGameRankingId = "";
    return;
  }

  games.forEach((game) => {
    const teamA = teamDataFromGame(game, "A");
    const teamB = teamDataFromGame(game, "B");

    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = `${teamA.code} x ${teamB.code} • ${game.phase || "Partida"} • ${formatDate(game.date)}`;

    gameRankingSelect.appendChild(option);
  });

  const hasPrevious = games.some((game) => game.id === previousValue);
  const finishedGames = games.filter((game) => game.status === "finished");
  const defaultGame = finishedGames[finishedGames.length - 1] || games[0];

  selectedGameRankingId = hasPrevious ? previousValue : defaultGame.id;
  gameRankingSelect.value = selectedGameRankingId;
}

function renderGameRanking() {
  if (!gameRankingList || !gameRankingSelect) return;

  selectedGameRankingId = gameRankingSelect.value || selectedGameRankingId;

  const game = getGameById(selectedGameRankingId);

  if (!game) {
    gameRankingList.classList.add("empty-state");
    gameRankingList.innerHTML = "Cadastre uma partida para ver o ranking por jogo.";
    return;
  }

  const ranking = buildGameRanking(game.id);
  const teamA = teamDataFromGame(game, "A");
  const teamB = teamDataFromGame(game, "B");

  if (!ranking.length) {
    gameRankingList.classList.add("empty-state");
    gameRankingList.innerHTML = `Ainda não entrou nenhum palpite para ${escapeHtml(teamA.name)} x ${escapeHtml(teamB.name)}.`;
    return;
  }

  const resultNote = game.status === "finished"
    ? `Resultado: ${game.scoreA} x ${game.scoreB}`
    : "Ranking parcial: os pontos entram depois que o resultado for lançado.";

  gameRankingList.classList.remove("empty-state");

  gameRankingList.innerHTML = `
    <p class="rank-note">${escapeHtml(resultNote)}</p>

    ${ranking
      .slice(0, 50)
      .map((item, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1;
        const medalClass = index < 3 ? "medal" : "";

        const penaltyText = item.penaltyWinner === "A"
          ? ` • pênaltis: ${escapeHtml(teamA.name)}`
          : item.penaltyWinner === "B"
            ? ` • pênaltis: ${escapeHtml(teamB.name)}`
            : "";

        return `
          <div class="rank-item">
            <div class="rank-pos ${medalClass}">${medal}</div>

            <div class="rank-name">
              <strong>${escapeHtml(item.name)}</strong>
              <span>Matrícula ${escapeHtml(item.registrationNumber)} • palpite ${item.guessA} x ${item.guessB}${penaltyText}</span>
              <small>Enviado em ${formatShortDateTime(item.firstPredictionAtMs)}</small>
            </div>

            <div class="rank-points">${item.points}</div>
          </div>
        `;
      })
      .join("")}
  `;
}

if (gameRankingSelect) {
  gameRankingSelect.addEventListener("change", () => {
    selectedGameRankingId = gameRankingSelect.value;
    renderGameRanking();
  });
}

/* Enviar palpite */
if (predictionForm) {
  predictionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage();

    const user = auth.currentUser;

    if (!user) {
      showMessage("Entre com Google para enviar seu palpite.", "error");
      return;
    }

    const game = getGameById(gameSelect?.value);
    const teamA = game ? teamDataFromGame(game, "A") : null;
    const teamB = game ? teamDataFromGame(game, "B") : null;

    const collaboratorName = collaboratorNameInput?.value.trim();
    const registrationNumberRaw = registrationNumberInput?.value.trim();
    const registrationKey = normalizeRegistrationNumber(registrationNumberRaw);

    const guessA = Number(guessAInput?.value);
    const guessB = Number(guessBInput?.value);

    const penaltyWinner = game?.phaseType === "knockout" && game?.allowPenalties && penaltyWinnerSelect
      ? penaltyWinnerSelect.value || null
      : null;

    if (!game || !isPredictionOpen(game)) {
      showMessage("Escolha uma partida aberta para enviar seu palpite.", "error");
      hideMatchArea();
      return;
    }

    if (!collaboratorName || !registrationKey) {
      showMessage("Preencha seu nome e número de matrícula.", "error");
      return;
    }

    if (
      Number.isNaN(guessA) ||
      Number.isNaN(guessB) ||
      guessA < 0 ||
      guessB < 0
    ) {
      showMessage("Preencha o placar corretamente.", "error");
      return;
    }

    if (
      game.phaseType === "knockout" &&
      game.allowPenalties &&
      guessA === guessB &&
      !penaltyWinner
    ) {
      showMessage("Em caso de empate no mata-mata, selecione quem passa nos pênaltis.", "error");
      return;
    }

    const predictionId = `${game.id}_${registrationKey}`;
    const predictionRef = doc(db, COLLECTIONS.predictions, predictionId);
    const previousPrediction = await getDoc(predictionRef);

    if (previousPrediction.exists()) {
      const previousData = previousPrediction.data();

      if (previousData.userId && previousData.userId !== user.uid) {
        showMessage("Essa matrícula já foi usada por outro login para essa partida.", "error");
        return;
      }
    }

    const previousData = previousPrediction.exists()
      ? previousPrediction.data()
      : null;

    const firstCreatedAtMs = previousData
      ? previousData.createdAtMs || predictionCreatedAtMillis(previousData) || Date.now()
      : Date.now();

    try {
      await setDoc(
        predictionRef,
        {
          gameId: game.id,
          userId: user.uid,
          name: collaboratorName,
          registrationNumber: registrationNumberRaw,
          registrationKey,
          email: user.email || "",
          googleName: user.displayName || "",
          guessA,
          guessB,
          penaltyWinner,
          teamA: teamA.name,
          teamB: teamB.name,
          teamACode: teamA.code,
          teamBCode: teamB.code,
          updatedAt: serverTimestamp(),
          updatedAtMs: Date.now(),
          createdAtMs: firstCreatedAtMs,
          createdAt: previousData?.createdAt || serverTimestamp()
        },
        { merge: true }
      );

      localStorage.setItem(`palpite_colaborador_${predictionId}`, "1");

      predictionForm.reset();

      if (gameSelect) gameSelect.value = "";

      hideMatchArea();

      showMessage(
        previousPrediction.exists()
          ? "Palpite atualizado! Você mudou o placar antes do apito final."
          : "Palpite enviado! Agora é torcer e acompanhar o ranking geral."
      );
    } catch (error) {
      console.error(error);
      showMessage("Não foi possível enviar o palpite. Confira as regras do Firestore.", "error");
    }
  });
}

/* Renderização geral */
function renderAll() {
  renderGameSelect();
  renderPublicGameSelect();
  renderGamesList();
  renderRanking();
  renderGameRankingSelect();
  renderGameRanking();
}

/* Listeners Firebase */
onSnapshot(
  collection(db, COLLECTIONS.games),
  (snapshot) => {
    games = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    games.sort((a, b) => gameKickoffMs(a) - gameKickoffMs(b));

    renderAll();
  },
  (error) => {
    console.error(error);

    if (gamesList) {
      gamesList.innerHTML = `<div class="empty-state">Não foi possível carregar os jogos. Confira o Firebase.</div>`;
    }

    hideMatchArea();
  }
);

onSnapshot(
  collection(db, COLLECTIONS.predictions),
  (snapshot) => {
    predictions = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderAll();
  },
  (error) => {
    console.error(error);

    if (rankingList) {
      rankingList.innerHTML = "Não foi possível carregar o ranking. Confira o Firebase.";
    }
  }
);

onSnapshot(
  collection(db, COLLECTIONS.users),
  (snapshot) => {
    users = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
  },
  (error) => {
    console.error(error);
  }
);

setInterval(renderAll, 60 * 1000);