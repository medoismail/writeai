// WriteAI — Renderer with polished transitions
// Uses CSS class toggles for animations (interruptible transitions)
// instead of inline style.display manipulation

let currentMode = "grammar";
let savedClipboard = "";
let originalText = "";
let improvedText = "";

const $ = (id) => document.getElementById(id);

const originalPanel = $("originalPanel");
const originalTextEl = $("originalText");
const typeSection = $("typeSection");
const inputText = $("inputText");
const fixBtn = $("fixBtn");
const fixBtnText = $("fixBtnText");
const fixBtnLoading = $("fixBtnLoading");
const loadingSection = $("loadingSection");
const resultPanel = $("resultPanel");
const resultText = $("resultText");
const actions = $("actions");
const replaceBtn = $("replaceBtn");
const copyBtn = $("copyBtn");
const retryBtn = $("retryBtn");
const errorSection = $("errorSection");
const errorText = $("errorText");
const closeBtn = $("closeBtn");
const settingsBtn = $("settingsBtn");
const statusBadge = $("statusBadge");
const hint = $("hint");

// ── Helpers ─────────────────────────────────────────

function show(el) { el.style.display = el.dataset.display || "block"; }
function hide(el) { el.style.display = "none"; }
function showFlex(el) { el.style.display = "flex"; }

// ── Tab switching ───────────────────────────────────

const writeModes = $("writeModes");
const translateModes = $("translateModes");

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelector(".tab.active")?.classList.remove("active");
    tab.classList.add("active");

    const target = tab.dataset.tab;
    if (target === "write") {
      writeModes.style.display = "block";
      translateModes.style.display = "none";
      // Select first write mode if current is translate
      if (currentMode.startsWith("translate_")) {
        selectMode("grammar");
      }
    } else {
      writeModes.style.display = "none";
      translateModes.style.display = "block";
      // Select first translate mode if current is write
      if (!currentMode.startsWith("translate_")) {
        selectMode("translate_en");
      }
    }
  });
});

// ── Mode selector ───────────────────────────────────

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prev = document.querySelector(".mode-btn.active");
    if (prev) {
      prev.classList.remove("active");
      prev.setAttribute("aria-checked", "false");
    }
    btn.classList.add("active");
    btn.setAttribute("aria-checked", "true");
    currentMode = btn.dataset.mode;

    if (originalText && improvedText) {
      processText(originalText);
    }
  });
});

// ── Listen for selected text from main process ──────

window.writeai.onSelectedText((data) => {
  savedClipboard = data.savedClipboard || "";
  resetUI();

  // Pre-select mode if specified (e.g. translate_en from Cmd+Shift+E)
  if (data.mode) {
    selectMode(data.mode);
  }

  if (data.text && data.text.trim()) {
    originalText = data.text;
    show(originalPanel);
    originalTextEl.textContent = originalText;
    hide(typeSection);
    hide(hint);
    processText(originalText);
  } else {
    originalText = "";
    hide(originalPanel);
    show(typeSection);
    show(hint);
    inputText.value = "";
    inputText.focus();
  }
});

function selectMode(mode) {
  const targetBtn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
  if (!targetBtn) return;

  // Switch tab if needed
  const isTranslate = mode.startsWith("translate_");
  const writeTab = document.querySelector('.tab[data-tab="write"]');
  const translateTab = document.querySelector('.tab[data-tab="translate"]');

  if (isTranslate) {
    writeTab.classList.remove("active");
    translateTab.classList.add("active");
    writeModes.style.display = "none";
    translateModes.style.display = "block";
  } else {
    translateTab.classList.remove("active");
    writeTab.classList.add("active");
    translateModes.style.display = "none";
    writeModes.style.display = "block";
  }

  // Select the mode button
  const prev = document.querySelector(".mode-btn.active");
  if (prev) {
    prev.classList.remove("active");
    prev.setAttribute("aria-checked", "false");
  }
  targetBtn.classList.add("active");
  targetBtn.setAttribute("aria-checked", "true");
  currentMode = mode;
}

// ── Process text with OpenAI ────────────────────────

async function processText(text) {
  showFlex(loadingSection);
  hide(resultPanel);
  hide(actions);
  hide(errorSection);
  hideStatus();

  const result = await window.writeai.callOpenAI(text, currentMode);

  hide(loadingSection);

  if (result.error) {
    errorText.textContent = result.error;
    show(errorSection);
    return;
  }

  improvedText = result.result;
  resultText.textContent = improvedText;

  // Staggered reveal: panel first, then actions
  show(resultPanel);
  showFlex(actions);
  hide(hint);
}

// ── Fix button (manual input mode) ──────────────────

fixBtn.addEventListener("click", () => {
  const text = inputText.value.trim();
  if (!text) {
    // Subtle shake feedback
    inputText.style.animation = "none";
    inputText.offsetHeight; // force reflow
    inputText.style.animation = "";
    inputText.focus();
    return;
  }
  originalText = text;
  show(originalPanel);
  originalTextEl.textContent = originalText;
  hide(typeSection);
  processText(text);
});

// Cmd+Enter / Ctrl+Enter to submit
inputText.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    fixBtn.click();
  }
});

// ── Replace → paste back into original app ──────────

replaceBtn.addEventListener("click", async () => {
  if (!improvedText) return;
  showStatus("Replaced!", "success");
  await window.writeai.replaceText(improvedText, savedClipboard);
});

// ── Copy to clipboard ───────────────────────────────

const copySvg = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
  <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
  <path d="M10 4V2.5C10 1.67 9.33 1 8.5 1H2.5C1.67 1 1 1.67 1 2.5V8.5C1 9.33 1.67 10 2.5 10H4" stroke="currentColor" stroke-width="1.2"/>
</svg>`;

const checkSvg = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
  <path d="M2 7L5.5 10.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

copyBtn.addEventListener("click", async () => {
  if (!improvedText) return;
  await window.writeai.copyToClipboard(improvedText);

  copyBtn.innerHTML = `${checkSvg} Copied!`;
  copyBtn.classList.add("copied");

  setTimeout(() => {
    copyBtn.innerHTML = `${copySvg} Copy`;
    copyBtn.classList.remove("copied");
  }, 1800);
});

// ── Retry ───────────────────────────────────────────

retryBtn.addEventListener("click", () => {
  if (originalText) processText(originalText);
});

// ── Close / Escape ──────────────────────────────────

closeBtn.addEventListener("click", () => window.writeai.hideWindow());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.writeai.hideWindow();
});

// ── Settings ────────────────────────────────────────

settingsBtn.addEventListener("click", () => window.writeai.openSettings());

// ── Status badge helpers ────────────────────────────

function showStatus(text, type) {
  statusBadge.textContent = text;
  statusBadge.className = `status-badge ${type} show`;
}

function hideStatus() {
  statusBadge.textContent = "";
  statusBadge.className = "status-badge";
}

// ── Reset ───────────────────────────────────────────

function resetUI() {
  hide(loadingSection);
  hide(resultPanel);
  hide(actions);
  hide(errorSection);
  hideStatus();
  improvedText = "";
}
