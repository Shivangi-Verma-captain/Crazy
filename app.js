"use strict";

const RESULTS = {
  side_quest: { category: "SIDE QUEST", title: "SOMETHING NEW IS CALLING.", description: "Not everything needs a master plan. There may be something worth exploring just beyond your usual routine." },
  main_character: { category: "MAIN CHARACTER", title: "TAKE THE MOMENT.", description: "This could be your moment to step forward, make the decision or give yourself credit for how far you've come." },
  plot_twist: { category: "PLOT TWIST", title: "EXPECT THE UNEXPECTED.", description: "The story might be heading somewhere you didn't plan. Take a moment to look at the possibilities." },
  character_development: { category: "CHARACTER DEVELOPMENT", title: "THIS COUNTS AS GROWING.", description: "Progress doesn't always look dramatic. Sometimes the most important change is the one you make quietly." },
  intermission: { category: "INTERMISSION", title: "LET'S GET A LITTLE MORE CONTEXT.", description: "This one doesn't quite fit yet. Give us a little more detail and we'll try again." },
};
const ORDER = Object.keys(RESULTS);
const $ = (id) => document.getElementById(id);
const form = $("decisionForm"), situation = $("situation"), submit = $("submitButton");
const result = $("result"), resultCard = $("resultCard");
let isLoading = false;

function percent(value) { return `${Math.round(value * 100)}%`; }
function setStatus(mode, text) { $("statusDot").className = `status-dot ${mode}`; $("statusText").textContent = text; }
function showFormError(message) { $("formError").textContent = message; $("formError").hidden = false; }
function clearChoices() { $("uncertainChoices").replaceChildren(); $("manualChoices").replaceChildren(); $("uncertainBlock").hidden = true; $("manualBlock").hidden = true; }

situation.addEventListener("input", () => {
  $("currentCount").textContent = situation.value.length;
  if (situation.value.trim()) { $("formError").hidden = true; }
});

function renderOutcome(key, confidence) {
  const item = RESULTS[key];
  resultCard.dataset.outcome = key;
  $("resultCategory").textContent = item.category;
  $("resultTitle").textContent = item.title;
  $("resultDescription").textContent = item.description;
  $("confidenceValue").textContent = percent(confidence);
  $("confidenceBar").style.setProperty("--confidence", `${Math.round(confidence * 100)}%`);
  $("resultKicker").textContent = key === "intermission" ? "A MOMENT BETWEEN" : "YOUR OUTCOME";
}

function choiceButton(key, confidence, label = RESULTS[key].category) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice-button";
  button.textContent = `${label} · ${percent(confidence)}`;
  button.addEventListener("click", () => {
    renderOutcome(key, confidence);
    clearChoices();
  });
  return button;
}

function handleDecision(data) {
  const { choice, probabilities, confidence } = data || {};
  if (!RESULTS[choice] || !probabilities || typeof confidence !== "number" || !Number.isFinite(confidence)) throw new Error("The decision service returned an unexpected result. Please try again.");
  for (const key of ORDER) if (typeof probabilities[key] !== "number" || !Number.isFinite(probabilities[key]) || probabilities[key] < 0 || probabilities[key] > 1) throw new Error("The decision service returned incomplete probability data. Please try again.");
  clearChoices();
  result.hidden = false;
  if (choice === "intermission" || confidence >= 0.8) {
    renderOutcome(choice, confidence);
  } else if (confidence >= 0.55) {
    renderOutcome(choice, confidence);
    const runnerUp = ORDER.filter((key) => key !== choice).sort((a, b) => probabilities[b] - probabilities[a])[0];
    $("uncertainSummary").textContent = "A close call. Which outcome feels like a better fit?";
    $("uncertainChoices").append(choiceButton(choice, confidence), choiceButton(runnerUp, probabilities[runnerUp]));
    $("uncertainBlock").hidden = false;
  } else {
    resultCard.dataset.outcome = "uncertain";
    $("resultKicker").textContent = "TOO CLOSE TO CALL";
    $("resultCategory").textContent = "YOUR CALL";
    $("resultTitle").textContent = "LET'S LEAVE THIS ONE TO YOU.";
    $("resultDescription").textContent = "The signals are mixed. Choose the outcome that feels closest.";
    $("confidenceValue").textContent = percent(confidence);
    $("confidenceBar").style.setProperty("--confidence", `${Math.round(confidence * 100)}%`);
    for (const key of ORDER) $("manualChoices").append(choiceButton(key, probabilities[key]));
    $("manualBlock").hidden = false;
  }
  setStatus("ready", "OUTCOME FOUND");
  result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
}

function showError(message) {
  result.hidden = false;
  clearChoices();
  resultCard.dataset.outcome = "error";
  $("resultKicker").textContent = "A SMALL INTERRUPTION";
  $("resultCategory").textContent = "COULDN'T REVEAL";
  $("resultTitle").textContent = "THE SIGNAL WENT QUIET.";
  $("resultDescription").textContent = message;
  $("confidenceValue").textContent = "—";
  $("confidenceBar").style.setProperty("--confidence", "0%");
  setStatus("error", "TRY AGAIN WHEN READY");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isLoading) return;
  const text = situation.value;
  if (!text.trim()) { showFormError("Add a little detail before revealing your result."); situation.focus(); return; }
  if (text.length > 500) { showFormError("Keep your situation to 500 characters or fewer."); situation.focus(); return; }
  isLoading = true;
  submit.disabled = true;
  $("loadingState").hidden = false;
  $("formError").hidden = true;
  setStatus("busy", "FINDING YOUR OUTCOME");
  try {
    const response = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something interrupted the reveal. Please try again.");
    handleDecision(data);
  } catch (error) { showError(error.message || "Network error. Check your connection and try again."); }
  finally { isLoading = false; submit.disabled = false; $("loadingState").hidden = true; }
});

$("againButton").addEventListener("click", () => {
  result.hidden = true;
  clearChoices();
  setStatus("", "READY WHEN YOU ARE");
  situation.focus();
  situation.scrollIntoView({ behavior: "smooth", block: "center" });
});
$("editButton").addEventListener("click", () => { situation.focus(); situation.scrollIntoView({ behavior: "smooth", block: "center" }); });
