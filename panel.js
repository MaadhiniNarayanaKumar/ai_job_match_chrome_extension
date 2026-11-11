const API = "http://127.0.0.1:8000";

const form = document.querySelector("#form");
const resumeInput = document.querySelector("#resume");
const fileInput = document.querySelector("#file");
const skillsInput = document.querySelector("#skills");
const jobInput = document.querySelector("#job");
const readTabButton = document.querySelector("#read-tab");
const scoreButton = document.querySelector("#score");
const analyzeButton = document.querySelector("#analyze");
const message = document.querySelector("#message");
const health = document.querySelector("#health");
const matchSection = document.querySelector("#match");
const analysisSection = document.querySelector("#analysis");

const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.scripting;

function storageGet(keys) {
  if (hasChrome) {
    return chrome.storage.local.get(keys);
  }
  const saved = {};
  keys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) saved[key] = value;
  });
  return Promise.resolve(saved);
}

function storageSet(values) {
  if (hasChrome) return chrome.storage.local.set(values);
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  return Promise.resolve();
}

function setMessage(text, isError) {
  message.textContent = text || "";
  message.classList.toggle("error", Boolean(isError));
}

function setBusy(isBusy) {
  scoreButton.disabled = isBusy;
  analyzeButton.disabled = isBusy;
  readTabButton.disabled = isBusy;
}

async function errorText(response) {
  const data = await response.json().catch(() => ({}));
  if (typeof data.detail === "string") return data.detail;
  return "Request failed.";
}

async function checkHealth() {
  try {
    const response = await fetch(`${API}/health`);
    if (!response.ok) throw new Error("down");
    health.textContent = "API on";
    health.className = "health ok";
  } catch {
    health.textContent = "API off";
    health.className = "health down";
  }
}

async function resumeText() {
  const pasted = resumeInput.value.trim();
  if (pasted || !fileInput.files.length) return pasted;
  const body = new FormData();
  body.append("file", fileInput.files[0]);
  const response = await fetch(`${API}/upload-resume`, { method: "POST", body });
  if (!response.ok) throw new Error(await errorText(response));
  const data = await response.json();
  resumeInput.value = data.resume_text || "";
  return resumeInput.value.trim();
}

function requireJob() {
  const job = jobInput.value.trim();
  if (!job) throw new Error("Paste a job posting or read the open tab.");
  return job;
}

function chips(skills, kind) {
  if (!skills.length) return "<p class='note'>None</p>";
  return `<div class="chips">${skills
    .map((skill) => `<span class="chip ${kind}">${escapeHtml(skill)}</span>`)
    .join("")}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showMatch(data) {
  matchSection.hidden = false;
  matchSection.innerHTML = `
    <p class="decision ${escapeHtml(data.decision_color)}">${escapeHtml(data.decision)} · ${escapeHtml(data.skill_match_score)}</p>
    <p class="meta">${escapeHtml(data.matched_count)} of ${escapeHtml(data.job_skills_count)} posting skills covered</p>
    ${data.note ? `<p class="note">${escapeHtml(data.note)}</p>` : ""}
    <h2>Matched</h2>
    ${chips(data.matched_skills || [], "matched")}
    <h2>Missing</h2>
    ${chips(data.missing_skills || [], "missing")}
  `;
}

function showAnalysis(data) {
  const skills = (data.skills || [])
    .map((item) => `<li>${escapeHtml(item.rank)}. ${escapeHtml(item.skill)} — ${escapeHtml(item.need)}</li>`)
    .join("");
  const expectations = (data.expectations || [])
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  analysisSection.hidden = false;
  analysisSection.innerHTML = `
    <h2>Skills by priority</h2>
    <ul>${skills || "<li>None found</li>"}</ul>
    <h2>Expectations</h2>
    <ul>${expectations || "<li>None found</li>"}</ul>
  `;
}

async function remember() {
  await storageSet({
    resume: resumeInput.value,
    skills: skillsInput.value,
    job: jobInput.value,
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage("Scoring");
  try {
    const resume = await resumeText();
    const job = requireJob();
    if (!resume) throw new Error("Paste a resume or choose a file.");
    await remember();
    const body = new FormData();
    body.append("resume_text", resume);
    body.append("page_text", job);
    body.append("user_skills", skillsInput.value.trim());
    const response = await fetch(`${API}/match-job`, { method: "POST", body });
    if (!response.ok) throw new Error(await errorText(response));
    showMatch(await response.json());
    setMessage("");
  } catch (error) {
    setMessage(error.message || "Score failed.", true);
  } finally {
    setBusy(false);
  }
});

analyzeButton.addEventListener("click", async () => {
  setBusy(true);
  setMessage("Analyzing");
  try {
    const job = requireJob();
    await remember();
    const body = new FormData();
    body.append("text", job);
    const response = await fetch(`${API}/analyze`, { method: "POST", body });
    if (!response.ok) throw new Error(await errorText(response));
    showAnalysis(await response.json());
    setMessage("");
  } catch (error) {
    setMessage(error.message || "Analyze failed.", true);
  } finally {
    setBusy(false);
  }
});

readTabButton.addEventListener("click", async () => {
  if (!hasChrome) {
    setMessage("Read open tab works after you load this folder as a Chrome extension.", true);
    return;
  }
  setBusy(true);
  setMessage("Reading the open tab");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No open tab to read.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (document.body ? document.body.innerText.slice(0, 12000) : ""),
    });
    jobInput.value = (result && result.result) || "";
    if (!jobInput.value.trim()) throw new Error("That tab had no readable text.");
    await remember();
    setMessage("");
  } catch (error) {
    setMessage(error.message || "Could not read the tab.", true);
  } finally {
    setBusy(false);
  }
});

fileInput.addEventListener("change", () => {
  if (!fileInput.files.length || !resumeInput.value.trim()) return;
  resumeInput.value = "";
  remember();
});

[resumeInput, skillsInput, jobInput].forEach((field) => {
  field.addEventListener("change", remember);
});

storageGet(["resume", "skills", "job"]).then((saved) => {
  if (saved.resume) resumeInput.value = saved.resume;
  if (saved.skills) skillsInput.value = saved.skills;
  if (saved.job) jobInput.value = saved.job;
});

if (!hasChrome) {
  readTabButton.title = "Available in the Chrome extension";
}

checkHealth();
