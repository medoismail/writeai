const {
  app,
  BrowserWindow,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  clipboard,
  Menu,
  Notification,
  systemPreferences,
  dialog,
} = require("electron");
const path = require("path");
const { execSync } = require("child_process");
const Store = require("electron-store").default;

// Prevent crash on EPIPE or unhandled errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err.message);
});

const store = new Store({
  projectName: "writeai",
  defaults: {
    apiKey: "",
    shortcut: "CommandOrControl+Shift+Space",
    model: "gpt-4o-mini",
  },
});

function notify(title, body) {
  new Notification({ title, body, silent: true }).show();
}

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let previousApp = null;

// Hide dock icon on macOS — but KEEP it visible so shortcuts work
// (hidden dock apps sometimes lose global shortcut focus on macOS)
// if (process.platform === "darwin") {
//   app.dock.hide();
// }

// ── AppleScript helpers ──────────────────────────────────────────

function getActiveApp() {
  try {
    return execSync(
      `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
      { encoding: "utf-8" }
    ).trim();
  } catch {
    return null;
  }
}

function runAppleScript(script) {
  try {
    execSync(`osascript -e '${script}'`, { stdio: "pipe", timeout: 3000 });
    return true;
  } catch (e) {
    console.error("AppleScript error:", e.message);
    return false;
  }
}

function simulateCopy() {
  const ok = runAppleScript('tell application "System Events" to keystroke "c" using command down');
  if (ok) {
    try { execSync("sleep 0.15", { stdio: "pipe" }); } catch {}
  }
  return ok;
}

function simulatePaste() {
  return runAppleScript('tell application "System Events" to keystroke "v" using command down');
}

function simulateSelectAll() {
  const ok = runAppleScript('tell application "System Events" to keystroke "a" using command down');
  if (ok) {
    try { execSync("sleep 0.1", { stdio: "pipe" }); } catch {}
  }
  return ok;
}

function focusApp(appName) {
  if (!appName) return;
  try {
    execSync(
      `osascript -e 'tell application "${appName}" to activate'`
    );
  } catch {
    // ignore
  }
}

// ── Windows ──────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 540,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#16161a",
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.on("blur", () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 420,
    x: Math.round(sw / 2 - 240),
    y: Math.round(sh / 3),
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: "#16161a",
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, "src", "settings.html"));

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

// ── Smart fix: selected text → popup, text box → silent replace ───

async function smartFix(mode) {
  previousApp = getActiveApp();
  const savedClipboard = clipboard.readText();

  // Try to copy selected text
  clipboard.writeText("");
  simulateCopy();
  const selectedText = clipboard.readText();

  if (selectedText && selectedText.trim() !== "") {
    // USER HAS SELECTED TEXT → open popup to show result
    clipboard.writeText(savedClipboard);
    showMainWindow(selectedText, savedClipboard, mode);
    return;
  }

  // NO SELECTION → user is in a text box
  // Select all text in the field, copy it, process, paste back silently
  clipboard.writeText("");
  simulateSelectAll();
  simulateCopy();
  const fieldText = clipboard.readText();

  if (!fieldText || fieldText.trim() === "") {
    clipboard.writeText(savedClipboard);
    return; // empty field, nothing to do
  }

  clipboard.writeText(savedClipboard);

  const apiKey = store.get("apiKey", "");
  if (!apiKey) return;

  const result = await callOpenAI(apiKey, fieldText, mode);

  if (result.error || !result.result) return;

  // Text is still selected (from Cmd+A), so just paste to replace
  clipboard.writeText(result.result);
  focusApp(previousApp);
  await new Promise((r) => setTimeout(r, 200));
  simulatePaste();

  setTimeout(() => {
    clipboard.writeText(savedClipboard);
  }, 500);
}

// ── Silent grammar fix (always silent, no popup) ─────────────────

async function silentGrammarFix() {
  previousApp = getActiveApp();
  const savedClipboard = clipboard.readText();

  // Try selected text first
  clipboard.writeText("");
  simulateCopy();
  let text = clipboard.readText();

  // If no selection, select all in field
  if (!text || text.trim() === "") {
    clipboard.writeText("");
    simulateSelectAll();
    simulateCopy();
    text = clipboard.readText();
  }

  if (!text || text.trim() === "") {
    clipboard.writeText(savedClipboard);
    return;
  }

  clipboard.writeText(savedClipboard);

  const apiKey = store.get("apiKey", "");
  if (!apiKey) return;

  const result = await callOpenAI(apiKey, text, "grammar");
  if (result.error || !result.result) return;

  clipboard.writeText(result.result);
  focusApp(previousApp);
  await new Promise((r) => setTimeout(r, 200));
  simulatePaste();

  setTimeout(() => {
    clipboard.writeText(savedClipboard);
  }, 500);
}

// Shared OpenAI call (used by both IPC handler and silent translate)
async function callOpenAI(apiKey, text, mode) {
  const systemPrompts = {
    rephrase:
      "You are a writing assistant. Rephrase the following text to sound natural and fluent in English while preserving the original meaning. Only return the rephrased text, nothing else.",
    grammar:
      "You are a grammar expert. Fix all grammar, spelling, and punctuation errors in the following text. Keep the style and tone the same. Only return the corrected text, nothing else.",
    formal:
      "You are a professional writing assistant. Rewrite the following text in a formal, professional tone suitable for business emails or official communication. Only return the rewritten text, nothing else.",
    casual:
      "You are a friendly writing assistant. Rewrite the following text in a casual, conversational tone. Keep it natural and friendly. Only return the rewritten text, nothing else.",
    shorter:
      "You are a concise writing assistant. Rewrite the following text to be significantly shorter while keeping the key message. Only return the shortened text, nothing else.",
    translate_en:
      "You are a translator. Translate the following text into fluent, natural English. Detect the source language automatically. Preserve the original tone and meaning. Only return the translated text, nothing else.",
    translate_ar:
      "You are a translator. Translate the following text into fluent, natural Arabic. Detect the source language automatically. Preserve the original tone and meaning. Only return the translated text, nothing else.",
    translate_fr:
      "You are a translator. Translate the following text into fluent, natural French. Detect the source language automatically. Preserve the original tone and meaning. Only return the translated text, nothing else.",
    translate_es:
      "You are a translator. Translate the following text into fluent, natural Spanish. Detect the source language automatically. Preserve the original tone and meaning. Only return the translated text, nothing else.",
  };

  const model = store.get("model", "gpt-4o-mini");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompts[mode] || systemPrompts.rephrase },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { error: err.error?.message || `API error: ${response.status}` };
    }

    const data = await response.json();
    return { result: data.choices[0].message.content.trim() };
  } catch (err) {
    return { error: `Request failed: ${err.message}` };
  }
}

// ── Core flow: grab selected text → fix → paste back ─────────────

async function grabAndFix(mode = null) {
  // Remember which app was active
  previousApp = getActiveApp();

  // Save current clipboard
  const savedClipboard = clipboard.readText();

  // Simulate Cmd+C to copy selected text
  clipboard.writeText(""); // clear first
  simulateCopy();

  const selectedText = clipboard.readText();

  // Restore clipboard if nothing was selected
  if (!selectedText || selectedText.trim() === "") {
    clipboard.writeText(savedClipboard);
    showMainWindow("", savedClipboard, mode);
    return;
  }

  // Restore original clipboard for now
  clipboard.writeText(savedClipboard);

  // Show popup with the selected text and start processing
  showMainWindow(selectedText, savedClipboard, mode);
}

function showMainWindow(text, savedClipboard, mode = null) {
  if (!mainWindow) return;

  const mousePos = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(mousePos);
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

  let winX = Math.round(mousePos.x - 240);
  let winY = Math.round(mousePos.y + 20);

  winX = Math.max(dx + 10, Math.min(winX, dx + dw - 490));
  winY = Math.max(dy + 10, Math.min(winY, dy + dh - 350));

  mainWindow.setPosition(winX, winY);
  mainWindow.setSize(520, text ? 540 : 480);

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("selected-text", {
    text,
    savedClipboard,
    previousApp,
    mode, // pre-select this mode in the UI
  });
}

// ── Tray ─────────────────────────────────────────────────────────

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("WriteAI - Select text & press Cmd+Shift+Space");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open WriteAI",
      click: () => grabAndFix(),
    },
    { type: "separator" },
    {
      label: "Settings",
      click: createSettingsWindow,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        mainWindow?.destroy();
        settingsWindow?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => grabAndFix());
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, "assets", "iconTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  return icon;
}

function registerShortcut() {
  globalShortcut.unregisterAll();

  // Cmd+Shift+D → silent grammar fix
  const r1 = globalShortcut.register("CommandOrControl+Shift+D", () => {
    console.log("FIRED: ⌘⇧D grammar fix");
    notify("WriteAI", "Fixing grammar...");
    silentGrammarFix().catch(e => console.error("grammar error:", e));
  });
  console.log(r1 ? "[OK] ⌘⇧D" : "[FAIL] ⌘⇧D");

  // Cmd+Shift+E → translate English
  const r2 = globalShortcut.register("CommandOrControl+Shift+E", () => {
    console.log("FIRED: ⌘⇧E translate EN");
    notify("WriteAI", "Translating to English...");
    smartFix("translate_en").catch(e => console.error("translate error:", e));
  });
  console.log(r2 ? "[OK] ⌘⇧E" : "[FAIL] ⌘⇧E");

  // Cmd+Shift+A → translate Arabic
  const r3 = globalShortcut.register("CommandOrControl+Shift+A", () => {
    console.log("FIRED: ⌘⇧A translate AR");
    notify("WriteAI", "Translating to Arabic...");
    smartFix("translate_ar").catch(e => console.error("translate error:", e));
  });
  console.log(r3 ? "[OK] ⌘⇧A" : "[FAIL] ⌘⇧A");

  // Cmd+Shift+W → open popup
  const r4 = globalShortcut.register("CommandOrControl+Shift+W", () => {
    console.log("FIRED: ⌘⇧W popup");
    grabAndFix();
  });
  console.log(r4 ? "[OK] ⌘⇧W" : "[FAIL] ⌘⇧W");
}

// ── IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle("get-api-key", () => store.get("apiKey", ""));
ipcMain.handle("set-api-key", (_, key) => {
  store.set("apiKey", key);
  return true;
});
ipcMain.handle("get-model", () => store.get("model", "gpt-4o-mini"));
ipcMain.handle("set-model", (_, model) => {
  store.set("model", model);
  return true;
});

ipcMain.handle("call-openai", async (_, { text, mode }) => {
  const apiKey = store.get("apiKey", "");
  if (!apiKey) {
    return { error: "No API key set. Click the gear icon to add your OpenAI key." };
  }
  return callOpenAI(apiKey, text, mode);
});

ipcMain.handle("replace-text", (_, { text, savedClipboard }) => {
  // Put improved text in clipboard
  clipboard.writeText(text);

  // Hide our window
  mainWindow?.hide();

  // Focus back to the original app and paste
  setTimeout(() => {
    focusApp(previousApp);
    setTimeout(() => {
      simulatePaste();
      // Restore original clipboard after a delay
      setTimeout(() => {
        clipboard.writeText(savedClipboard || "");
      }, 500);
    }, 200);
  }, 100);

  return true;
});

ipcMain.handle("copy-to-clipboard", (_, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle("hide-window", () => {
  mainWindow?.hide();
  return true;
});

ipcMain.handle("close-settings", () => {
  settingsWindow?.close();
  return true;
});

ipcMain.handle("open-settings", () => {
  createSettingsWindow();
  return true;
});

// ── App lifecycle ────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log("WriteAI starting...");

  // Check Accessibility permission (needed for global shortcuts + key simulation)
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  console.log("Accessibility permission:", trusted ? "GRANTED" : "NOT GRANTED");

  if (!trusted) {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "WriteAI needs Accessibility",
      message: "Please grant Accessibility permission to WriteAI.",
      detail: "Go to System Settings → Privacy & Security → Accessibility → Enable WriteAI (or Electron).\n\nThen restart WriteAI.",
      buttons: ["OK"],
    });
  }

  // Auto-start on login
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });

  createMainWindow();
  createTray();
  registerShortcut();

  // Test: check if shortcuts actually registered
  const isRegistered = globalShortcut.isRegistered("CommandOrControl+Shift+D");
  console.log("⌘⇧D actually registered?", isRegistered);

  console.log("WriteAI ready!");

  // Show test notification
  notify("WriteAI is running", "Try ⌘⇧D to fix grammar, ⌘⇧W for popup");
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {});

app.on("activate", () => {
  if (!mainWindow) createMainWindow();
});
