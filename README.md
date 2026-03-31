<h1 align="center">WriteAI</h1>

<p align="center">
  A tiny macOS menubar app that fixes your grammar, rephrases your sentences, and translates your text — all with a keyboard shortcut.<br>
  No switching windows. No copy-pasting into ChatGPT. Just select, press, done.
</p>

<p align="center">
  <a href="https://writeai.medoismail.design">Website</a> &middot;
  <a href="https://github.com/medoismail/writeai/releases/latest">Download</a> &middot;
  <a href="#contributing">Contribute</a>
</p>

---

## Why this exists

I built this because I needed it.

English isn't my first language. Every day I write emails, Slack messages, docs, tweets — and every time I second-guess myself. *Is this sentence right? Does this sound weird? Should I rephrase this?*

I got tired of opening ChatGPT in a new tab, pasting my text, waiting, copying the result back. Over and over. For every single message.

So I built WriteAI. A small app that sits in your menubar and does one thing well: makes your writing better, instantly, wherever you type.

**This is for builders who ship things even when their English isn't perfect.** For developers pushing PRs with typos in the description. For founders writing pitch decks at 2am in their second language. For anyone who's ever deleted a tweet because they weren't sure about the grammar.

You're not alone. And your ideas deserve to be heard clearly.

---

## Features

- **Fix Grammar** — Silently corrects spelling, grammar, and punctuation in place
- **Rephrase** — Rewrites your text to sound more natural and polished
- **Translate** — Translate between English, Arabic, French, and Spanish
- **Works everywhere** — Slack, Gmail, WhatsApp, Notes, VS Code, any app
- **Menubar app** — Lives quietly in your menubar, always one shortcut away
- **Your API key** — Uses your own OpenAI key. No subscription, no data stored, fully private

## Shortcuts

| Action | Shortcut |
|--------|----------|
| Fix Grammar | `Cmd + Shift + Space` |
| To English | `Cmd + Shift + E` |
| To Arabic | `Cmd + Shift + A` |
| Open Popup | `Cmd + Shift + G` |

## Getting started

1. **Download** the [latest release](https://github.com/medoismail/writeai/releases/latest) for your Mac (Apple Silicon or Intel)
2. **Unzip** and move WriteAI to Applications
3. **Open** the app — right-click the menubar icon → Settings → paste your OpenAI API key
4. **Use** — select text anywhere, press a shortcut, done

> **macOS security note:** macOS may show a warning the first time you open it. This is normal for open-source apps. Control-click the app → Open → Open again. If blocked: System Settings → Privacy & Security → Open Anyway.

## Tech stack

- [Electron](https://www.electronjs.org/) — cross-platform desktop app
- [OpenAI API](https://platform.openai.com/) — language model (your own key)
- [electron-store](https://github.com/sindresorhus/electron-store) — local settings persistence
- Vanilla HTML/CSS/JS — no frameworks, no bloat

## Development

```bash
# Clone the repo
git clone https://github.com/medoismail/writeai.git
cd writeai

# Install dependencies
npm install

# Run in development
npm run dev

# Build for macOS
npm run build:app
```

## Contributing

This project is open source and built for the community.

Whether you want to add a new language, improve the UI, fix a bug, or just clean up a typo — you're welcome here. No contribution is too small.

If you've ever felt like your English held you back from contributing to open source, this is your sign. **Start here.** This project understands.

1. Fork the repo
2. Create your branch (`git checkout -b feature/your-idea`)
3. Commit your changes
4. Open a pull request

Ideas, feedback, and issues are just as valuable as code. [Open an issue](https://github.com/medoismail/writeai/issues) anytime.

## License

[MIT](LICENSE) — do whatever you want with it.

---

<p align="center">
  Built with care by <a href="https://medoismail.design">medoismail</a>
</p>
