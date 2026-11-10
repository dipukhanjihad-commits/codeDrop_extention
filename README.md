# 📦 CodeDrop

A Chrome side-panel extension that lets you **browse a local project folder**, **copy file contents**, and **download multiple files at once** — without ever touching a terminal.

Perfect for:
- Grabbing code from a browser and saving it as real files
- Sending generated code into a project folder
- Feeding a "watch folder" that routes downloads into the right place

---

## ✨ What it does

CodeDrop adds a panel to the right side of Chrome with three tabs:

| Tab | What it's for |
|---|---|
| 📄 **Files** | Browse and search a folder on your computer. Copy or view any file's content. |
| 👁 **Detail** | Read the file you picked, and copy it (filename + content) in one click. |
| ⬇ **Paste** | Add one or many files with a filename and content, then download them all at once. |

---

## 🚀 Install (2 minutes, no coding)

You don't need to install anything from a store — you just point Chrome at the folder that holds CodeDrop.

1. **Download the extension folder**  
   On this GitHub page, click the green **Code** button → **Download ZIP** → extract it somewhere safe (e.g. your Desktop).  
   You should end up with a folder containing these 5 files:
manifest.json
background.js
theme-init.js
sidepanel.html
sidepanel.js

2. **Open Chrome's extension page**  
Type `chrome://extensions` in the address bar and press Enter.

3. **Turn on Developer mode**  
Toggle **Developer mode** in the top-right corner — it turns blue.

4. **Load CodeDrop**  
Click **Load unpacked** → pick the folder from step 1.  
CodeDrop appears in the list. 🎉

5. **Pin it (optional, recommended)**  
Click the puzzle-piece icon 🧩 in Chrome's toolbar → click the 📌 pin next to **CodeDrop**.  
Now you can open it with one click.

---

## 🖱 How to open the panel

Click the **CodeDrop icon** in your Chrome toolbar.  
The panel slides out on the right side of your browser — it stays there while you browse.

---

## 🧭 Using it

### 📄 Files tab — browse and copy a project

1. Click **📁 Connect** in the top bar.  
A folder picker opens — choose the project folder you want to browse.  
*(Chrome remembers it, so you only pick it once.)*
2. Type in the search box to filter by **file or folder name**.
3. For any file you can click:
- **View** → opens it in the **Detail** tab
- **Copy** → puts the file's content on your clipboard

> **Tip:** Check **skip node_modules / .git** to hide the big, noisy folders.  
> **Tip:** Click **⟳ Refresh** to rescan the folder if files changed outside Chrome.

### 👁 Detail tab — read and copy with the filename

Clicking **View** on a file in the Files tab jumps you here.

- Shows the **full file path**, the number of **lines**, and the file **size**.
- **📋 Copy** copies the filename on the first line, followed by the full content — handy for pasting into ChatGPT, a chat, or another tool.
- **← Back** returns to the Files list.

### ⬇ Paste tab — save one or many files

This is where you turn text into real files on your disk.

**Choose where files go**
- **Single Files** mode → downloads go to `Downloads/<Base folder>/<path>`  
- **Project** mode → downloads go to `Downloads/<Base folder>/<Project name>/<path>`
- **Base folder** → change it to anything you like (default `CodeDrop`).  
You can even use slashes, e.g. `Projects/Codegen`.

**Add files to download** — three ways:

1. **Click ➕ Add File**  
A small card appears with:
- a **filename** box (e.g. `src/App.jsx`)
- a **content** box — paste the file's content here

Repeat as many times as you want — each click adds another card.

2. **📋 Paste button** (global)  
Reads your clipboard and drops it into the right place:
- If you're typing in a content box → pastes there
- If a card has empty content → fills that card
- Otherwise → creates a new card with the content

3. **Drag & drop**  
Drag files or whole folders from your file manager directly onto the panel.  
Each file becomes its own card with the filename and content already filled in.

**Managing cards**
- **▾ / ▸** → collapse or expand a card (hides the content box — great for scanning many files)
- **📋** (on a card) → paste from clipboard just into that card
- **✕** → remove that card
- **🔍 Filter box** → type a filename to hide cards you're not looking at
- **🗑 Clear All** → wipes every card (asks first)

**Download**
- Click **⬇ Download Files** at the bottom.
- All cards with a filename are saved to the destination shown above the button.
- Files with an empty filename are skipped (and counted in the status message).
- The path structure you typed is preserved — `src/api/users.js` becomes a real `src/api/` folder inside Downloads.

---

## 🌙 Light / dark mode

Click the **🌙 / ☀️** icon in the top-right of the panel to switch themes.  
Your choice is remembered forever. If you've never toggled it, CodeDrop follows your system preference.

---

## ❓ Frequently asked questions

**Does it send any of my data anywhere?**  
No. Everything runs locally in your browser. Nothing is uploaded.

**Can I use it on more than one project?**  
Yes. Click **📁 Connect** again to switch folders. Your base folder setting is remembered separately.

**My downloaded file has the wrong extension (e.g. `.txt` instead of `.html`).**  
This is a Windows/antivirus setting on your machine, not a CodeDrop bug. Check your antivirus or Safe Browsing settings — it sometimes "corrects" file extensions during download.

**Can I change where files are saved outside of Downloads?**  
Chrome extensions can only write inside your Downloads folder by design. If you want files to land elsewhere, point a small script (e.g. Python **watchdog**) at `Downloads/<Base folder>/` and move them wherever you want.

**A download failed / nothing happens when I click Download.**  
1. Right-click inside the CodeDrop panel → **Inspect** → **Console** tab.  
2. Look for a red error line. Share it in a GitHub issue and I'll help.

**I updated the files but changes don't show up.**  
Go to `chrome://extensions` → find CodeDrop → click the **⟳ reload** icon, then close and reopen the panel.

---

## 🧩 Built with

- Chrome Manifest V3
- File System Access API (for browsing folders)
- Side Panel API
- Downloads API

---

## 📝 License

MIT — free to use, modify, and share.