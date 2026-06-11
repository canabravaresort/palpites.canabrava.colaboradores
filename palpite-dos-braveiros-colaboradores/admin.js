import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { firebaseConfig, ADMIN_EMAILS } from "./firebaseConfig.js";
import { fillTeamSelect, getTeam, teamDataFromGame } from "./teams.js";
import { GROUP_FIXTURES } from "./groupFixtures.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const loginArea = document.getElementById("loginArea");
const adminArea = document.getElementById("adminArea");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginMessage = document.getElementById("loginMessage");

const seedGroupBtn = document.getElementById("seedGroupBtn");
const seedMessage = document.getElementById("seedMessage");
const knockoutForm = document.getElementById("knockoutForm");
const gameMessage = document.getElementById("gameMessage");
const adminGamesList = document.getElementById("adminGamesList");
const adminGameSelect = document.getElementById("adminGameSelect");
const resetPredictionsBtn = document.getElementById("resetPredictionsBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const teamASelect = document.getElementById("teamA");
const teamBSelect = document.getElementById("teamB");

let games = [];
let predictions = [];
let users = [];
let selectedAdminGameId = "";
let unsubscribeGames = null;
let unsubscribePredictions = null;
let unsubscribeUsers = null;

const statusLabels = {
  open: "Aberto",
  closed: "Encerrado",
  finished: "Resultado lançado"
};

fillTeamSelect(teamASelect, "BRA");
fillTeamSelect(teamBSelect, "MAR");

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
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function gameKickoffMs(game) {
  return Number(game?.kickoffAtMs || timestampToMillis(game?.kickoffAt) || Date.parse(game?.date || ""));
}

function gameCloseMs(game) {
  return Number(game?.predictionCloseAtMs || timestampToMillis(game?.predictionCloseAt) || (gameKickoffMs(game) - 5 * 60 * 1000));
}

function formatDate(value) {
  if (!value) return "Data a definir";
  const ms = typeof value === "number" ? value : timestampToMillis(value) || Date.parse(value);
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
  return prediction.createdAtMs || timestampToMillis(prediction.createdAt) || timestampToMillis(prediction.updatedAt) || null;
}

function formatPredictionDate(prediction) {
  const ms = predictionCreatedAtMillis(prediction);
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isPredictionOpen(game) {
  if (!game || game.status !== "open") return false;
  const closeAt = gameCloseMs(game);
  if (!Number.isFinite(closeAt)) return false;
  return Date.now() < closeAt;
}

function getUserById(uid) {
  return users.find((user) => user.id === uid || user.uid === uid);
}

function showLoginMessage(text, isError = false) {
  loginMessage.textContent = text;
  loginMessage.classList.toggle("error", isError);
}

function showSeedMessage(text, isError = false) {
  seedMessage.textContent = text;
  seedMessage.classList.toggle("error", isError);
}

function showGameMessage(text, isError = false) {
  gameMessage.textContent = text;
  gameMessage.classList.toggle("error", isError);
}

function isAdminUser(user) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email));
}

function showAdmin() {
  loginArea.classList.add("hidden");
  adminArea.classList.remove("hidden");
}

function showLogin() {
  loginArea.classList.remove("hidden");
  adminArea.classList.add("hidden");
}

function fixtureToFirestoreData(fixture) {
  const kickoffAtMs = Date.parse(fixture.date);
  const predictionCloseAtMs = kickoffAtMs - 5 * 60 * 1000;

  return {
    ...fixture,
    kickoffAtMs,
    predictionCloseAtMs,
    kickoffAt: Timestamp.fromMillis(kickoffAtMs),
    predictionCloseAt: Timestamp.fromMillis(predictionCloseAtMs),
    updatedAt: serverTimestamp(),
    importedFromFixture: true
  };
}

async function loginAdmin() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();

  if (!email || !password) {
    showLoginMessage("Digite o e-mail e a senha do admin.", true);
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!isAdminUser(credential.user)) {
      await signOut(auth);
      showLoginMessage("Este e-mail não está liberado como admin no firebaseConfig.js.", true);
      return;
    }

    showLoginMessage("");
  } catch (error) {
    console.error(error);
    showLoginMessage("E-mail ou senha incorretos.", true);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
}

loginBtn.addEventListener("click", loginAdmin);
adminPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginAdmin();
});
adminEmail.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginAdmin();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

function startAdminListeners() {
  if (unsubscribeGames || unsubscribePredictions || unsubscribeUsers) return;

  unsubscribeGames = onSnapshot(collection(db, "games"), (snapshot) => {
    games = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    games.sort((a, b) => gameKickoffMs(a) - gameKickoffMs(b));
    renderAdminPanel();
  }, (error) => {
    console.error(error);
    adminGamesList.classList.add("empty-state");
    adminGamesList.innerHTML = "Não foi possível carregar os jogos. Confira as regras do Firestore.";
  });

  unsubscribePredictions = onSnapshot(collection(db, "predictions"), (snapshot) => {
    predictions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderAdminPanel();
  }, (error) => {
    console.error(error);
    adminGamesList.classList.add("empty-state");
    adminGamesList.innerHTML = "Não foi possível carregar os palpites. Confira as regras do Firestore.";
  });

  unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
    users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }, (error) => {
    console.error(error);
  });
}

function stopAdminListeners() {
  if (unsubscribeGames) unsubscribeGames();
  if (unsubscribePredictions) unsubscribePredictions();
  if (unsubscribeUsers) unsubscribeUsers();

  unsubscribeGames = null;
  unsubscribePredictions = null;
  unsubscribeUsers = null;
  games = [];
  predictions = [];
  users = [];
}

onAuthStateChanged(auth, (user) => {
  if (user && isAdminUser(user)) {
    showAdmin();
    startAdminListeners();
  } else {
    stopAdminListeners();
    showLogin();
  }
});

seedGroupBtn.addEventListener("click", async () => {
  if (!isAdminUser(auth.currentUser)) {
    showSeedMessage("Faça login como admin para importar os jogos.", true);
    return;
  }

  const confirmSeed = confirm("Importar/atualizar os 72 jogos da fase de grupos?");
  if (!confirmSeed) return;

  seedGroupBtn.disabled = true;
  seedGroupBtn.textContent = "Importando...";

  try {
    const batch = writeBatch(db);

    GROUP_FIXTURES.forEach((fixture) => {
      batch.set(doc(db, "games", fixture.id), fixtureToFirestoreData(fixture), { merge: true });
    });

    await batch.commit();
    showSeedMessage("Fase de grupos importada com sucesso!");
  } catch (error) {
    console.error(error);
    showSeedMessage("Erro ao importar fase de grupos. Confira as regras do Firestore.", true);
  } finally {
    seedGroupBtn.disabled = false;
    seedGroupBtn.textContent = "Importar fase de grupos";
  }
});

knockoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdminUser(auth.currentUser)) {
    showGameMessage("Faça login como admin para cadastrar jogos.", true);
    return;
  }

  const teamA = getTeam(teamASelect.value);
  const teamB = getTeam(teamBSelect.value);
  const dateInput = document.getElementById("gameDate").value;
  const phase = document.getElementById("gameGroup").value.trim() || "Mata-mata";

  if (!teamA || !teamB || !dateInput) {
    showGameMessage("Preencha time 1, time 2 e data do jogo.", true);
    return;
  }

  if (teamA.code === teamB.code) {
    showGameMessage("Escolha dois times diferentes para a partida.", true);
    return;
  }

  const kickoffAtMs = new Date(dateInput).getTime();
  const predictionCloseAtMs = kickoffAtMs - 5 * 60 * 1000;

  try {
    await addDoc(collection(db, "games"), {
      matchNumber: Number(games.length) + 1,
      phase,
      phaseType: "knockout",
      teamA: teamA.name,
      teamB: teamB.name,
      teamACode: teamA.code,
      teamBCode: teamB.code,
      date: new Date(kickoffAtMs).toISOString(),
      kickoffAtMs,
      predictionCloseAtMs,
      kickoffAt: Timestamp.fromMillis(kickoffAtMs),
      predictionCloseAt: Timestamp.fromMillis(predictionCloseAtMs),
      status: "open",
      scoreA: null,
      scoreB: null,
      allowPenalties: true,
      penaltyWinner: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    knockoutForm.reset();
    fillTeamSelect(teamASelect, "BRA");
    fillTeamSelect(teamBSelect, "MAR");
    showGameMessage("Jogo mata-mata cadastrado com sucesso!");
  } catch (error) {
    console.error(error);
    showGameMessage("Erro ao cadastrar jogo. Confira as permissões do Firestore.", true);
  }
});

function getGameLabel(game) {
  const teamA = teamDataFromGame(game, "A");
  const teamB = teamDataFromGame(game, "B");
  const number = game.matchNumber ? `${game.matchNumber} • ` : "";
  const phase = game.phase ? `${game.phase} • ` : "";

  return `${number}${teamA.name} x ${teamB.name} • ${phase}${formatDate(game.date)}`;
}

function renderAdminGameSelect() {
  if (!adminGameSelect) return;

  const previousValue = selectedAdminGameId || adminGameSelect.value;
  adminGameSelect.innerHTML = "";

  if (!games.length) {
    adminGameSelect.innerHTML = `<option value="">Nenhuma partida cadastrada</option>`;
    selectedAdminGameId = "";
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione uma partida";
  adminGameSelect.appendChild(placeholder);

  games.forEach((game) => {
    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = getGameLabel(game);
    adminGameSelect.appendChild(option);
  });

  const stillExists = games.some((game) => game.id === previousValue);

  if (stillExists) {
    selectedAdminGameId = previousValue;
    adminGameSelect.value = previousValue;
  } else {
    selectedAdminGameId = "";
    adminGameSelect.value = "";
  }
}

function renderSelectedAdminGame() {
  if (!adminGamesList) return;

  if (!games.length) {
    adminGamesList.classList.add("empty-state");
    adminGamesList.innerHTML = "Nenhum jogo cadastrado ainda. Importe a fase de grupos para começar.";
    return;
  }

  if (!selectedAdminGameId) {
    adminGamesList.classList.add("empty-state");
    adminGamesList.innerHTML = "Selecione uma partida acima para lançar resultado.";
    return;
  }

  const game = games.find((item) => item.id === selectedAdminGameId);

  if (!game) {
    adminGamesList.classList.add("empty-state");
    adminGamesList.innerHTML = "Partida não encontrada.";
    return;
  }

  adminGamesList.classList.remove("empty-state");

  const count = predictions.filter((prediction) => prediction.gameId === game.id).length;
  const teamA = teamDataFromGame(game, "A");
  const teamB = teamDataFromGame(game, "B");
  const closedByTime = game.status === "open" && !isPredictionOpen(game);
  const statusText = closedByTime ? "Fechado automático" : (statusLabels[game.status] || escapeHtml(game.status));
  const showPenalty = game.phaseType === "knockout" && game.allowPenalties;

  adminGamesList.innerHTML = `
    <article class="admin-game-item selected-game-card" data-game-id="${game.id}">
      <div class="admin-game-top">
        <div>
          <div class="admin-game-title">
            ${escapeHtml(String(game.matchNumber || ""))} • ${escapeHtml(teamA.name)} x ${escapeHtml(teamB.name)}
          </div>
          <div class="admin-game-info">
            ${escapeHtml(game.phase || "Partida")} • ${formatDate(game.date)} • Fecha: ${formatDate(gameCloseMs(game))} • ${count} palpite(s)
          </div>
        </div>
        <span class="status-pill">${statusText}</span>
      </div>

      <div class="admin-result-row ${showPenalty ? "has-penalties" : ""}">
        <label>
          Status
          <select class="game-status-select">
            <option value="open" ${game.status === "open" ? "selected" : ""}>Aberto</option>
            <option value="closed" ${game.status === "closed" ? "selected" : ""}>Encerrado</option>
            <option value="finished" ${game.status === "finished" ? "selected" : ""}>Resultado lançado</option>
          </select>
        </label>

        <label>
          ${escapeHtml(teamA.code)}
          <input class="score-a-input" type="number" min="0" max="30" value="${game.scoreA ?? ""}" placeholder="0" />
        </label>

        <label>
          ${escapeHtml(teamB.code)}
          <input class="score-b-input" type="number" min="0" max="30" value="${game.scoreB ?? ""}" placeholder="0" />
        </label>

        ${showPenalty ? `
          <label>
            Pênaltis/classificado
            <select class="penalty-winner-select">
              <option value="" ${!game.penaltyWinner ? "selected" : ""}>Não houve / selecione</option>
              <option value="A" ${game.penaltyWinner === "A" ? "selected" : ""}>${escapeHtml(teamA.name)}</option>
              <option value="B" ${game.penaltyWinner === "B" ? "selected" : ""}>${escapeHtml(teamB.name)}</option>
            </select>
          </label>
        ` : `<input class="penalty-winner-select hidden" value="" />`}

        <button class="secondary-btn save-game-btn" type="button">Salvar</button>
        <button class="primary-btn finish-game-btn" type="button">Finalizar</button>
        <button class="danger-btn delete-game-btn" type="button">Excluir</button>
      </div>
    </article>
  `;
}

function renderAdminPanel() {
  renderAdminGameSelect();
  renderSelectedAdminGame();
}

if (adminGameSelect) {
  adminGameSelect.addEventListener("change", () => {
    selectedAdminGameId = adminGameSelect.value;
    renderSelectedAdminGame();
  });
}

adminGamesList.addEventListener("click", async (event) => {
  if (!isAdminUser(auth.currentUser)) {
    alert("Faça login como admin para gerenciar os jogos.");
    return;
  }

  const gameItem = event.target.closest(".admin-game-item");
  if (!gameItem) return;

  const gameId = gameItem.dataset.gameId;
  const game = games.find((item) => item.id === gameId);
  if (!game) return;

  if (event.target.classList.contains("save-game-btn") || event.target.classList.contains("finish-game-btn")) {
    const status = event.target.classList.contains("finish-game-btn") ? "finished" : gameItem.querySelector(".game-status-select").value;
    const scoreAValue = gameItem.querySelector(".score-a-input").value;
    const scoreBValue = gameItem.querySelector(".score-b-input").value;
    const penaltyWinnerValue = gameItem.querySelector(".penalty-winner-select")?.value || null;

    if (status === "finished" && (scoreAValue === "" || scoreBValue === "")) {
      alert("Preencha o placar dos dois times antes de finalizar.");
      return;
    }

    if (status === "finished" && game.phaseType === "knockout" && game.allowPenalties && Number(scoreAValue) === Number(scoreBValue) && !penaltyWinnerValue) {
      alert("No mata-mata, se o placar terminar empatado, selecione quem passou nos pênaltis.");
      return;
    }

    try {
      await updateDoc(doc(db, "games", gameId), {
        status,
        scoreA: scoreAValue === "" ? null : Number(scoreAValue),
        scoreB: scoreBValue === "" ? null : Number(scoreBValue),
        penaltyWinner: game.phaseType === "knockout" && game.allowPenalties ? (penaltyWinnerValue || null) : null,
        updatedAt: serverTimestamp(),
        resultUpdatedAutomatically: false
      });

      if (event.target.classList.contains("finish-game-btn")) {
        alert("Resultado lançado! O ranking da partida foi atualizado.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o jogo.");
    }
  }

  if (event.target.classList.contains("delete-game-btn")) {
    const teamA = teamDataFromGame(game, "A");
    const teamB = teamDataFromGame(game, "B");
    const confirmDelete = confirm(`Excluir ${teamA.name} x ${teamB.name} e todos os palpites desse jogo?`);
    if (!confirmDelete) return;

    try {
      const batch = writeBatch(db);
      const predictionsSnapshot = await getDocs(collection(db, "predictions"));

      predictionsSnapshot.forEach((predictionDoc) => {
        if (predictionDoc.data().gameId === gameId) {
          batch.delete(predictionDoc.ref);
        }
      });

      batch.delete(doc(db, "games", gameId));
      await batch.commit();
      alert("Jogo e palpites da partida foram excluídos.");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir o jogo.");
    }
  }
});

resetPredictionsBtn.addEventListener("click", async () => {
  if (!isAdminUser(auth.currentUser)) {
    alert("Faça login como admin para apagar os palpites.");
    return;
  }

  const confirmReset = confirm("Tem certeza que deseja apagar TODOS os palpites? Essa ação não pode ser desfeita.");
  if (!confirmReset) return;

  try {
    const snapshot = await getDocs(collection(db, "predictions"));
    const batch = writeBatch(db);
    snapshot.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    alert("Todos os palpites foram apagados.");
  } catch (error) {
    console.error(error);
    alert("Erro ao apagar os palpites.");
  }
});

function downloadCsv(filename, rows) {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

exportCsvBtn.addEventListener("click", () => {
  const rows = [[
    "Nome",
    "Matrícula",
    "E-mail",
    "Jogo",
    "Fase",
    "Palpite",
    "Pênaltis palpite",
    "Status do jogo",
    "Resultado",
    "Pênaltis resultado",
    "Data do palpite"
  ]];

  predictions.forEach((prediction) => {
    const game = games.find((item) => item.id === prediction.gameId);
    const user = getUserById(prediction.userId);
    const teamA = game ? teamDataFromGame(game, "A") : { name: prediction.teamA || "Time A" };
    const teamB = game ? teamDataFromGame(game, "B") : { name: prediction.teamB || "Time B" };
    const penaltyGuess = prediction.penaltyWinner === "A" ? teamA.name : prediction.penaltyWinner === "B" ? teamB.name : "";
    const penaltyResult = game?.penaltyWinner === "A" ? teamA.name : game?.penaltyWinner === "B" ? teamB.name : "";

    rows.push([
      prediction.collaboratorName || prediction.name || user?.name || "Colaborador",
      prediction.employeeNumber || "",
      prediction.email || user?.email || "",
      `${teamA.name} x ${teamB.name}`,
      game?.phase || "",
      `${prediction.guessA} x ${prediction.guessB}`,
      penaltyGuess,
      game ? statusLabels[game.status] : "Jogo removido",
      game && game.status === "finished" ? `${game.scoreA} x ${game.scoreB}` : "",
      penaltyResult,
      formatPredictionDate(prediction)
    ]);
  });

  downloadCsv("palpites-cana-brava.csv", rows);
});

setInterval(renderAdminPanel, 60 * 1000);
