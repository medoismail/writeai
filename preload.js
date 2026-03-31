const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("writeai", {
  getApiKey: () => ipcRenderer.invoke("get-api-key"),
  setApiKey: (key) => ipcRenderer.invoke("set-api-key", key),
  getModel: () => ipcRenderer.invoke("get-model"),
  setModel: (model) => ipcRenderer.invoke("set-model", model),
  callOpenAI: (text, mode) => ipcRenderer.invoke("call-openai", { text, mode }),
  replaceText: (text, savedClipboard) =>
    ipcRenderer.invoke("replace-text", { text, savedClipboard }),
  copyToClipboard: (text) => ipcRenderer.invoke("copy-to-clipboard", text),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  closeSettings: () => ipcRenderer.invoke("close-settings"),
  openSettings: () => ipcRenderer.invoke("open-settings"),
  onSelectedText: (callback) =>
    ipcRenderer.on("selected-text", (_, data) => callback(data)),
});
