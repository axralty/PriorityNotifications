# 🔔 PriorityNotifications

> Bypass **Do Not Disturb** for selected users on Discord.
> Get **instant sound alerts + notifications** when they DM you — even in DND mode.

---

## ✨ Features

* 🔕 **Bypass DND**
  Receive alerts from selected users even when your status is **Do Not Disturb**

* 🎯 **Priority Contacts**
  Choose exactly who can break through your silence

* 🔔 **Smart Notifications**

  * In-app toast when Discord is focused
  * Native desktop notification when minimized or unfocused

* 🎵 **Custom Sounds**

  * Synth Ding (classic)
  * Chime (soft triple tone)
  * Blip (punchy alert)

* 🔊 **Adjustable Volume**

  * Supports amplification beyond 100% (Web Audio)

* 📍 **Custom Toast Position**

  * Top-left / Top-right / Bottom-left / Bottom-right

* ⏱️ **Toast Duration Control**

  * 1–15 seconds

* 🖱️ **Click to Navigate**

  * Clicking a notification **restores Discord and opens the DM**

* 🧠 **Context Menu Integration**

  * Right-click any user → toggle **Priority Notifications**

---

## 🚀 Installation

1. Install **BetterDiscord**
2. Download `PriorityNotifications.plugin.js`
3. Move it to your plugins folder:

   ```
   %appdata%\BetterDiscord\plugins
   ```
4. Enable the plugin in Discord settings

---

## 📖 How It Works

The plugin triggers only when **ALL conditions are met**:

1. Your status is **Do Not Disturb**
2. The sender is in your **Priority List**
3. The message is a **Direct Message**

---

## ➕ Adding Priority Contacts

### Method 1 (Recommended)

* Right-click a user or DM
* Toggle **🔔 Priority Notifications**

### Method 2 (Manual)

1. Enable **Developer Mode** in Discord
2. Copy User ID
3. Paste into plugin settings

---

## 🖥️ Notification Behavior

| Situation                   | Result               |
| --------------------------- | -------------------- |
| Discord focused             | In-app toast         |
| Discord minimized/unfocused | Desktop notification |

Optional:

* Enable **"Show toast when viewing DM"** to always show popups

---

## 🎵 Sounds Preview

You can preview sounds directly in settings:

* 🔔 Synth Ding – classic notification
* 🎵 Chime – soft and clean
* ⚡ Blip – fast and sharp

---

## ⚠️ Notes

* Volume above 100% may distort audio
* Only works for **DMs (not servers)**

---
