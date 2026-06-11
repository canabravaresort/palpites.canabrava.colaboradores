export const TEAMS = [
  { code: "MEX", name: "México", flagCode: "mx", group: "Grupo A" },
  { code: "RSA", name: "África do Sul", flagCode: "za", group: "Grupo A" },
  { code: "KOR", name: "Coreia do Sul", flagCode: "kr", group: "Grupo A" },
  { code: "CZE", name: "Tchéquia", flagCode: "cz", group: "Grupo A" },

  { code: "CAN", name: "Canadá", flagCode: "ca", group: "Grupo B" },
  { code: "BIH", name: "Bósnia e Herzegovina", flagCode: "ba", group: "Grupo B" },
  { code: "QAT", name: "Catar", flagCode: "qa", group: "Grupo B" },
  { code: "SUI", name: "Suíça", flagCode: "ch", group: "Grupo B" },

  { code: "BRA", name: "Brasil", flagCode: "br", group: "Grupo C" },
  { code: "MAR", name: "Marrocos", flagCode: "ma", group: "Grupo C" },
  { code: "HAI", name: "Haiti", flagCode: "ht", group: "Grupo C" },
  { code: "SCO", name: "Escócia", flagCode: "gb-sct", group: "Grupo C" },

  { code: "USA", name: "Estados Unidos", flagCode: "us", group: "Grupo D" },
  { code: "PAR", name: "Paraguai", flagCode: "py", group: "Grupo D" },
  { code: "AUS", name: "Austrália", flagCode: "au", group: "Grupo D" },
  { code: "TUR", name: "Turquia", flagCode: "tr", group: "Grupo D" },

  { code: "GER", name: "Alemanha", flagCode: "de", group: "Grupo E" },
  { code: "CUW", name: "Curaçao", flagCode: "cw", group: "Grupo E" },
  { code: "CIV", name: "Costa do Marfim", flagCode: "ci", group: "Grupo E" },
  { code: "ECU", name: "Equador", flagCode: "ec", group: "Grupo E" },

  { code: "NED", name: "Holanda", flagCode: "nl", group: "Grupo F" },
  { code: "JPN", name: "Japão", flagCode: "jp", group: "Grupo F" },
  { code: "SWE", name: "Suécia", flagCode: "se", group: "Grupo F" },
  { code: "TUN", name: "Tunísia", flagCode: "tn", group: "Grupo F" },

  { code: "BEL", name: "Bélgica", flagCode: "be", group: "Grupo G" },
  { code: "EGY", name: "Egito", flagCode: "eg", group: "Grupo G" },
  { code: "IRN", name: "Irã", flagCode: "ir", group: "Grupo G" },
  { code: "NZL", name: "Nova Zelândia", flagCode: "nz", group: "Grupo G" },

  { code: "ESP", name: "Espanha", flagCode: "es", group: "Grupo H" },
  { code: "CPV", name: "Cabo Verde", flagCode: "cv", group: "Grupo H" },
  { code: "KSA", name: "Arábia Saudita", flagCode: "sa", group: "Grupo H" },
  { code: "URU", name: "Uruguai", flagCode: "uy", group: "Grupo H" },

  { code: "FRA", name: "França", flagCode: "fr", group: "Grupo I" },
  { code: "SEN", name: "Senegal", flagCode: "sn", group: "Grupo I" },
  { code: "IRQ", name: "Iraque", flagCode: "iq", group: "Grupo I" },
  { code: "NOR", name: "Noruega", flagCode: "no", group: "Grupo I" },

  { code: "ARG", name: "Argentina", flagCode: "ar", group: "Grupo J" },
  { code: "ALG", name: "Argélia", flagCode: "dz", group: "Grupo J" },
  { code: "AUT", name: "Áustria", flagCode: "at", group: "Grupo J" },
  { code: "JOR", name: "Jordânia", flagCode: "jo", group: "Grupo J" },

  { code: "POR", name: "Portugal", flagCode: "pt", group: "Grupo K" },
  { code: "COD", name: "RD Congo", flagCode: "cd", group: "Grupo K" },
  { code: "UZB", name: "Uzbequistão", flagCode: "uz", group: "Grupo K" },
  { code: "COL", name: "Colômbia", flagCode: "co", group: "Grupo K" },

  { code: "ENG", name: "Inglaterra", flagCode: "gb-eng", group: "Grupo L" },
  { code: "CRO", name: "Croácia", flagCode: "hr", group: "Grupo L" },
  { code: "GHA", name: "Gana", flagCode: "gh", group: "Grupo L" },
  { code: "PAN", name: "Panamá", flagCode: "pa", group: "Grupo L" }
];

export const TEAM_BY_CODE = Object.fromEntries(
  TEAMS.map((team) => [team.code, team])
);

export function getTeam(codeOrName) {
  if (!codeOrName) return null;

  const normalized = String(codeOrName).trim().toUpperCase();

  return (
    TEAM_BY_CODE[normalized] ||
    TEAMS.find((team) => team.name.toUpperCase() === normalized) ||
    null
  );
}

export function flagUrl(team) {
  if (!team?.flagCode) return "";
  return `https://flagcdn.com/${team.flagCode.toLowerCase()}.svg`;
}

export function fillTeamSelect(selectElement, selectedCode = "") {
  if (!selectElement) return;

  selectElement.innerHTML = `<option value="">Selecione</option>`;

  TEAMS.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.code;
    option.textContent = `${team.name} (${team.code}) • ${team.group}`;
    option.selected = team.code === selectedCode;
    selectElement.appendChild(option);
  });
}

export function teamDataFromGame(game, side) {
  const codeKey = side === "A" ? "teamACode" : "teamBCode";
  const nameKey = side === "A" ? "teamA" : "teamB";
  const fallbackCode = side === "A" ? "A" : "B";

  const savedTeam = getTeam(game?.[codeKey]) || getTeam(game?.[nameKey]);

  if (savedTeam) {
    return {
      ...savedTeam,
      emoji: ""
    };
  }

  return {
    code: game?.[codeKey] || fallbackCode,
    name: game?.[nameKey] || `Time ${fallbackCode}`,
    flagCode: "",
    group: "",
    emoji: "⚽"
  };
}
