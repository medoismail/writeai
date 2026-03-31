// WriteAI — Settings page

const apiKeyInput = document.getElementById("apiKeyInput");
const modelSelect = document.getElementById("modelSelect");
const settingsForm = document.getElementById("settingsForm");
const saveStatus = document.getElementById("saveStatus");
const closeBtn = document.getElementById("closeBtn");

// Load current settings on open
(async function loadSettings() {
  const apiKey = await window.writeai.getApiKey();
  const model = await window.writeai.getModel();
  if (apiKey) apiKeyInput.value = apiKey;
  if (model) modelSelect.value = model;
})();

// Submit via form (Enter key works naturally)
settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    showStatus("Please enter an API key", "error");
    apiKeyInput.focus();
    return;
  }

  if (!apiKey.startsWith("sk-")) {
    showStatus("API key should start with sk-", "error");
    apiKeyInput.focus();
    return;
  }

  await window.writeai.setApiKey(apiKey);
  await window.writeai.setModel(model);
  showStatus("Settings saved!", "success");

  setTimeout(() => {
    window.writeai.closeSettings();
  }, 600);
});

function showStatus(message, type) {
  saveStatus.textContent = message;
  saveStatus.className = `save-status show ${type}`;

  if (type === "error") {
    setTimeout(() => {
      saveStatus.className = "save-status";
    }, 3000);
  }
}

// Close
closeBtn.addEventListener("click", () => window.writeai.closeSettings());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.writeai.closeSettings();
});
