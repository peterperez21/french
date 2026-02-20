let globalData = {};
let currentQ = null;
let deck = [];
let initialDeckSize = 0;
let isCorrectionMode = false;
let isMastered = false;

// Load config and generate tiers
async function loadConfig() {
  try {
    const response = await fetch("verbs.json");
    globalData = await response.json();

    const tierContainer = document.getElementById("tier-checkboxes");
    if (tierContainer) {
      tierContainer.innerHTML = "";
      for (let tierKey in globalData.tiers) {
        const label = document.createElement("label");
        label.style.display = "block";
        label.innerHTML = `<input type="checkbox" class="tier-opt" value="${tierKey}" checked> ${globalData.tiers[tierKey].label}`;
        tierContainer.appendChild(label);
      }
    }
  } catch (e) {
    console.error("Critical Error: verbs.json not found or invalid.", e);
  }
}

window.onload = loadConfig;
const isDarkSaved = localStorage.getItem("dark-mode-enabled") === "true";
if (isDarkSaved) {
  document.body.classList.add("dark-mode");
  document.getElementById("toggle").checked = true;
}

// Toggle dark mode on and off
function toggleDarkMode() {
  const body = document.body;
  body.classList.toggle("dark-mode");

  const isDark = body.classList.contains("dark-mode");
  localStorage.setItem("dark-mode-enabled", isDark);

  // Sync the checkbox state if triggered by other means
  document.getElementById("toggle").checked = isDark;
}

// Load the first question
function startDrill() {
  const tenses = Array.from(
    document.querySelectorAll(".tense-opt:checked"),
  ).map((cb) => cb.value);
  const groups = Array.from(
    document.querySelectorAll(".group-opt:checked"),
  ).map((cb) => cb.value);
  const tiers = Array.from(document.querySelectorAll(".tier-opt:checked")).map(
    (cb) => cb.value,
  );

  // Filter the pool
  const pool = globalData.questions.filter(
    (q) =>
      tenses.includes(q.t) && groups.includes(q.g) && tiers.includes(q.tier),
  );

  if (pool.length === 0)
    return alert("Aucune question trouvée pour cette sélection.");

  deck = pool.sort(() => Math.random() - 0.5);
  initialDeckSize = deck.length;

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("drill").classList.remove("hidden");

  updateProgressBar();
  nextQuestion();
}

function resetCurrentMastery() {
  if (!currentQ) return;

  // Confirm with the user so they don't click it by accident
  const confirmReset = confirm(
    `Voulez-vous réinitialiser la maîtrise pour "${currentQ.v}" (${currentQ.p}) ?`,
  );

  if (confirmReset) {
    const storageKey = `mastery_${currentQ.v}_${currentQ.t}_${currentQ.p}`;
    localStorage.removeItem(storageKey);

    // Update the UI immediately so the dots disappear
    updateMasteryUI();

    // Visual feedback
    document.getElementById("feedback").innerText = "Maîtrise réinitialisée.";
    document.getElementById("feedback").style.color = "gray";
  }
}

function nextQuestion() {
  if (deck.length === 0) {
    alert("Session terminée !");
    return location.reload();
  }

  // Reset flags and button text
  isCorrectionMode = false;
  document.getElementById("check-btn").innerText = "Vérifier";

  currentQ = deck.pop();

  // Check Mastery
  const storageKey = `mastery_${currentQ.v}_${currentQ.t}_${currentQ.p}`;
  const score = parseInt(localStorage.getItem(storageKey)) || 0;
  const inputField = document.getElementById("answer-input");

  // Clear the text
  inputField.value = "";

  // Reset the styles to match the current theme
  inputField.style.backgroundColor = "var(--bg-container)";
  inputField.style.color = "var(--text-main)";
  inputField.style.borderColor = "var(--border)";

  isMastered = score >= 5;

  // Standard UI Reset
  document.getElementById("sentence").innerText = currentQ.s;
  document.getElementById("verb-info").innerText =
    `${currentQ.v} (${currentQ.t}, ${currentQ.p})`;
  document.getElementById("feedback").innerText = "";
  document.getElementById("table-container").classList.add("hidden");

  if (isMastered) {
    // SPEED MODE: Auto-fill and prep for immediate next
    const lookupPronoun = currentQ.p === "j'" ? "je" : currentQ.p;
    const correct =
      globalData.tiers[currentQ.tier].verbs[currentQ.v][currentQ.t][
        lookupPronoun
      ];

    inputField.value = correct;
    document.getElementById("feedback").innerText =
      "Maîtrisé ! (Entrée pour continuer)";
    document.getElementById("feedback").style.color = "var(--success)";

    document.getElementById("check-btn").classList.add("hidden");
    document.getElementById("next-btn").classList.remove("hidden");
  } else {
    // STANDARD MODE: Empty input and show verify button
    inputField.value = "";
    document.getElementById("check-btn").classList.remove("hidden");
    document.getElementById("next-btn").classList.add("hidden");
  }

  updateProgressBar();
  updateMasteryUI();
  inputField.focus();
}

function checkAnswer() {
  try {
    const inputField = document.getElementById("answer-input");
    const input = inputField.value.trim().toLowerCase();

    // Handle j' vs je lookup
    const lookupPronoun = currentQ.p === "j'" ? "je" : currentQ.p;
    const correct =
      globalData.tiers[currentQ.tier].verbs[currentQ.v][currentQ.t][
        lookupPronoun
      ].toLowerCase();
    const storageKey = `mastery_${currentQ.v}_${currentQ.t}_${currentQ.p}`;
    const feedback = document.getElementById("feedback");

    if (input === correct) {
      feedback.innerText = isCorrectionMode ? "Bien corrigé !" : "Correct !";
      feedback.style.color = "var(--success)";
      // reset the input box style after a success
      inputField.style.backgroundColor = "var(--bg-container)";
      inputField.style.color = "var(--text-main)";

      // Only reward if not in correction mode
      if (!isCorrectionMode) {
        let score = parseInt(localStorage.getItem(storageKey)) || 0;
        if (score < 5) localStorage.setItem(storageKey, score + 1);
      }

      document.getElementById("check-btn").classList.add("hidden");
      document.getElementById("next-btn").classList.remove("hidden");
      isCorrectionMode = false;
    } else {
      feedback.innerText = `Incorrect. C'était : ${correct}. Tapez la réponse pour continuer.`;
      feedback.style.color = "var(--error)";

      // PENALTY: Reset to zero
      localStorage.setItem(storageKey, 0);

      inputField.value = "";
      inputField.focus();
      isCorrectionMode = true;
      document.getElementById("check-btn").innerText = "Corriger";
    }

    updateMasteryUI();
    showTable();
  } catch (err) {
    console.error("Check Answer failed:", err);
  }
}

function updateMasteryUI() {
  const container = document.getElementById("mastery-container");
  if (!container || !currentQ) return;
  container.innerHTML = "";
  const storageKey = `mastery_${currentQ.v}_${currentQ.t}_${currentQ.p}`;
  const score = parseInt(localStorage.getItem(storageKey)) || 0;

  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement("div");
    dot.className = i <= score ? "dot filled" : "dot";
    container.appendChild(dot);
  }
}

function updateProgressBar() {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  const progress = ((initialDeckSize - deck.length) / initialDeckSize) * 100;
  bar.style.width = progress + "%";
}

function showTable() {
  const body = document.getElementById("table-body");
  const container = document.getElementById("table-container");
  if (!body || !container) return;

  body.innerHTML = "";
  const conjSet = globalData.tiers[currentQ.tier].verbs[currentQ.v][currentQ.t];

  // Define the grouped rows we want to display
  const displayGroups = [
    { label: "je / j'", keys: ["je", "j'"] },
    { label: "tu", keys: ["tu"] },
    { label: "il / elle / on", keys: ["il", "elle", "on"] },
    { label: "nous", keys: ["nous"] },
    { label: "vous", keys: ["vous"] },
    { label: "ils / elles", keys: ["ils", "elles"] },
  ];

  displayGroups.forEach((group) => {
    // Find which key exists in JSON, specifically checking for je if j' is requested
    const activeKey = group.keys.find(
      (k) => conjSet[k] || (k === "j'" && conjSet["je"]),
    );

    if (activeKey) {
      const row = document.createElement("tr");

      // Highlight row if the current question's pronoun is in this group
      if (group.keys.includes(currentQ.p)) {
        row.className = "current-row";
      }

      // Use 'je' value for 'j'' if necessary
      const displayValue =
        activeKey === "j'" && !conjSet["j'"]
          ? conjSet["je"]
          : conjSet[activeKey];

      row.innerHTML = `<td>${group.label}</td><td>${displayValue}</td>`;
      body.appendChild(row);
    }
  });

  container.classList.remove("hidden");
}

document.getElementById("answer-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const checkBtnHidden = document
      .getElementById("check-btn")
      .classList.contains("hidden");

    // If mastered OR we've already successfully checked, move to next
    if (isMastered || checkBtnHidden) {
      nextQuestion();
    } else {
      checkAnswer();
    }
  }
});
