# Pocket POS

An offline-first point-of-sale for phones. It runs as a web app / PWA and packages into an Android APK with
[Capacitor](https://capacitorjs.com). **Standalone first:** there is no server and no account — everything lives on the
device (IndexedDB), and backup files are the safety net.

## What it does

| Area | Included |
|---|---|
| **Selling** | Item grid with **photos**, categories & search, size/option variants, barcode scan (camera or hardware scanner), cart with per-item price/discount/note, **custom item total** (charge a customer a different amount for one item), order discount (% or amount), tax (added on top or included, per-item exempt), **pending orders**, customer attach (their **remark** is shown on the order), split payments (cash / card / e-wallet / other / loyalty points), quick-cash buttons, change calculation, receipt share (image / PDF / text) and print (Bluetooth thermal printer, or the browser's print dialog) |
| **Quick edit on the grid** | An item that is in the order shows a **− count +** strip on its own tile: tap − to take one off (or + to add one) without opening the order. Tap the count for the full editor — quantity, price, discount, note, remove. An item sold in several variants opens a short list so you pick which one |
| **Pending orders** | Run several orders at once, **paid or not**. *Hold* sets an order aside unpaid (a table, a customer still shopping). In the payment screen you can instead **take a deposit** — cash, card or transfer, with the slip photo — and *save as pending*. The pause button lists every pending order with its total, what is paid and what is **still to collect**; *Pay* opens it straight to the balance. Items can be added or removed in between, and the finished receipt lists the deposit (“Cash (deposit)”) beside the final payment. Cash deposits go into the open shift's drawer when taken; deleting a part-paid order records the cash going back. Stock and loyalty points move when the order is **finished**, not when it is set aside |
| **Receipts & shop profile** | Store profile holds your **logo**, address, phone, email, website/social handle and tax ID; they print on every receipt (header/footer messages too). **Preview receipt** shows the template as you edit it. Share any receipt as an **image (PNG)**, a **PDF** or plain text from the receipt screen — works on Android through the system share sheet (WhatsApp, LINE, email, Drive…) |
| **Item names in other languages** | Keep each item's name in the languages your customers read (pick up to 12 besides the one you type in). On Android they can be **translated for you, on the phone** (Google ML Kit — nothing is sent to a website; each language downloads a ~30 MB pack the first time, then works offline), automatically for new/renamed items or all at once. Every translation is an ordinary text box: **correct it and your version is kept** (automatic ones are tagged "Automatic"). The app shows names in its own language and search finds an item by any of its names. Receipts can print item names in **up to two languages** (e.g. 中文 on top, English underneath) |
| **Bluetooth printing** | Print receipts on a **Bluetooth thermal printer** (58 / 80 mm, ESC/POS): pair it in Android's Bluetooth settings, pick it once, then tap Print — or switch on automatic printing after every sale. Optional paper cut and a test page. The receipt is sent as a picture, so every language and your logo print exactly as on screen |
| **Photos** | Every picture you add — item photo, payment proof, shop logo — opens a **crop / rotate / brightness-contrast editor** first: drag the corners or edges, square-locked for item photos, free-form or fixed ratios for proofs and logos |
| **Payment proof** | Attach one or more photos (bank slip, transfer screenshot) to any sale — at checkout, right after, or later from the order. Camera or gallery; view full size, share, delete (owner). Stored separately from orders so lists stay fast |
| **Orders** | History with search, receipts, partial/full **refunds** (restock optional), **void** for mistakes, status badges, paperclip marker when a proof is attached |
| **Items & stock** | Add/edit items with photo, price & cost (margin), SKU, barcode, emoji + colour, stock tracking with low-stock alerts, receive / count / waste adjustments, CSV import & export. **Select several items and change their category in one step** |
| **Categories** | A built-in **library of ~80 ready-made categories** in 9 groups (cafe & drinks, meals, bakery, groceries, fashion, beauty & health, electronics, home & gifts, services) — switch each on or off, or a whole group at once. Or make your own with an **expandable icon picker** (300+ icons, or paste any emoji). Turned-off categories are hidden from the Sell screen and item forms without touching your items |
| **Ingredients & costing** | Define ingredients by pack price (e.g. 1 kg flour = 2.50); build an item's recipe (grams/ml/pcs, unit conversion) with batch yield and extra cost (packaging, labour). Cost per item and profit/margin are calculated live and kept up to date when ingredient prices change; past sales keep the cost they were made with |
| **Customers** | Contacts with a multi-line **remark** (allergies, preferences, special price), import from the **phone's contacts** (no contacts permission needed), purchase history, optional loyalty points |
| **Cash drawer** | Open/close shifts, cash in/out, expected vs counted cash, end-of-shift report |
| **Reports** | Net sales, orders, average order, gross profit, tax, discounts, refunds; sales by hour/day; top items; by category; by payment method; low stock; CSV export |
| **Staff** | Owner / cashier roles, PIN lock screen, auto-lock, cashier permissions |
| **Languages** | English, 简体中文, 繁體中文, Bahasa Melayu, Bahasa Indonesia, Español, 日本語, 한국어, ไทย, Tiếng Việt, Français, Deutsch, Português. **Phones follow the system language; PCs start in English.** Changeable any time in Settings |
| **Easier to read** | Display size (Standard / Large / Extra large / Huge) scales text, buttons and spacing together and the layout reflows; high-contrast mode. Offered on the first-run screen |
| **Backup & restore** | See below |
| **Phone UX** | Bottom tabs, large touch targets, safe-area aware, dark mode, back-button closes sheets, two-pane layout on tablets |

## Backup and restore (local)

Settings → **Data & backup** (also offered on the first-run screen for moving to a new phone):

- **Back up now** — one `pocketpos-backup-YYYYMMDD-HHMM.json` file with all sales, items, ingredients, customers, staff
  and settings. Payment-proof photos are included by default (a switch shows their size and lets you leave them out).
  Optional **password protection** (AES-256-GCM, PBKDF2-SHA256 250k iterations). On Android the file goes through the
  system share sheet (Drive, Files, email…); in a browser it downloads.
- **Restore from file** — validates the file (format, version, SHA-256 integrity), shows what's inside versus what's on
  the device, then either **Replace** (make the device match the backup) or **Merge** (add what's missing, keep the
  newest edit, never delete). Restores are all-or-nothing. Backups from older app versions are upgraded automatically;
  a backup made without photos never deletes the photos already on the phone.
- **Safety copies** — the app automatically keeps recent snapshots (daily, end of shift, before any restore/reset) so
  a mistake can be undone. These live inside the app, so they don't protect against losing the phone.
- **Automatic backup (Android app)** — pick a folder once and the app saves a dated `pocketpos-auto-….json` file into it by
  itself: the first time you open the app each day (or each week), when you return to it, every 30 minutes while it is
  open, and when you close a shift. It keeps the newest 7 copies and never touches other files in the folder. Choose a
  folder that a sync app (Drive, Dropbox, OneDrive, Syncthing…) uploads and a copy survives losing the phone. Optional
  password and "include payment proofs" switches; if the folder disappears the screen says so. No storage permission is
  needed (Android's folder picker grants access to that one folder only).
- **Reminders** when no backup file has been saved recently; **delete old payment proofs** to free space.
- **Forgot the owner PIN?** Erase the device from the lock screen, then restore a backup with
  "Remove staff PINs after restoring".

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (use a phone-sized viewport)
npm test           # unit tests: money math, recipes, backup/restore, checkout/refund/void, reports, translations
npm run build      # typecheck + production build into dist/
```

## Build the Android APK

Needs the Android SDK (`~/Library/Android/sdk`, platform 36) and a **JDK 17–24** — JDK 25 does not work with Capacitor 8's
Gradle. JDK 21 is recommended; if you only have 25, unpack a Temurin 21 into `.tools/` (the script finds it).

```bash
npm run apk        # → releases/pocket-pos-debug.apk
```

Install it by copying the file to the phone (or `adb install -r releases/pocket-pos-debug.apk`) and allowing installs
from your file manager. The debug APK is signed with a debug key — fine for your own devices. For Google Play you need a
**release** build signed with your own keystore (`cd android && ./gradlew bundleRelease` after configuring signing); keep
that keystore safe, losing it means you can't update the app.

Verified on an Android 16 (API 36) emulator (including automatic backup into a folder chosen with the system picker, kept to
7 copies, written on launch and on resume after a day passes, and recovering after the folder was deleted): install, setup, system-language detection, data persistence across
restarts, backup via the share sheet, restore via the system file picker, contact picker, photo from gallery and camera,
payment proof stored with the sale, largest display size, hardware back button and back gesture (through nested sheets, tab by tab to the home screen, and through the
setup wizard), logo from the gallery, receipt shared as PNG and PDF through the share sheet, the crop editor with real finger drags,
on-device item-name translation (Chinese / Malay / French), two-language receipts, and the Bluetooth permission prompt and
printer list.

Permissions: **camera** (barcode scanning and "Take photo"; asked only when used). No contacts, storage or location
permissions.

## Notes & limits

- **Translations** were produced with AI assistance and have not been reviewed by native speakers — treat them as a
  strong first draft. A missing string always falls back to English. Right-to-left languages (Arabic, Hebrew) are not
  supported yet.
- **Printing:** Android prints to a paired **Bluetooth (classic SPP) thermal printer** — most budget 58/80 mm ESC/POS
  printers. **Not verified on real printer hardware** (the emulator only exercises the permission prompt and the paired-device
  list), so try "Print test page" with your printer first; if one misbehaves, tell me the model. Printers that are
  Bluetooth-LE only, USB or Wi-Fi are not supported yet. Desktop browsers use the normal print dialog; you can also share
  the PDF and print from the Android share sheet.
- **Receipt image / PDF:** the PDF is a single page as wide as the paper roll (58 / 80 mm) containing the rendered
  receipt as a picture — it looks identical in every language, but its text can't be selected or searched. There is no
  A4 invoice layout yet. Changing the shop profile also changes how *past* receipts look when re-shared.
- **Automatic translation** needs the Android app and an internet connection the first time each language is used. It is
  machine translation — short item names are often a little off (e.g. "Espresso" came out as plain "咖啡"), which is why
  every name stays editable. Traditional Chinese can't be produced automatically (the on-device translator writes only
  Simplified), so type it in. Variant names (sizes) and category names are not translated.
- **App size:** about 43 MB (the on-device translator adds ~16 MB). Builds include only phone CPUs (arm64, 32-bit arm); pass
  `-PallAbis` to Gradle to build for an x86 emulator.
- **Barcode scanning:** the Android app uses Google's ML Kit scanner (needs Google Play services; the module downloads on
  first use). In a browser it uses the camera `BarcodeDetector` API where supported, and always allows typing the code.
  USB/Bluetooth keyboard-style scanners work anywhere.
- **Contacts in a browser:** the contact picker works in the Android app and in Chrome on Android (https); elsewhere type the details.
- **Automatic backup limits:** it needs the Android app (a browser can't write to a folder by itself) and runs when the
  app is open or opened — there is no background service, so a phone that is never opened makes no copies. Android won't
  let the picker choose the top-level storage folder; pick or create a sub-folder (e.g. Documents/PocketPOS). Google
  Drive itself usually can't be chosen as the folder — use a folder your sync app watches. If you set a password it is
  stored on the phone (so backups can run unattended); keep a copy somewhere else, you need it to restore.
- **Single device:** Merge restore combines two backups but is not live sync. Two phones selling at once will both number
  receipts from their own counters.
- **Money** is stored in integer minor units; set the currency before your first sale.
- Photos are stored inside the app's database. Heavy use of payment proofs grows storage (about 20–80 KB each); use
  "Delete old payment proofs" or leave them out of backups to keep files small.

## Roadmap ideas

cloud sync for multi-device · USB / Wi-Fi / BLE printers · A4 invoice layout · ingredient stock deduction · customer price lists ·
tables / kitchen tickets · purchase orders & suppliers · multiple tax rates · right-to-left languages · e-invoicing ·
card terminal integration.

## Layout

```
src/lib      pure logic: money, cart math, recipes, db, backup, store (signals + actions), reports, receipts (one model → text / screen / PNG / PDF), images, contacts
src/i18n     language files (English text → translation) and the tiny t()/tn() runtime
src/screens  Sell, Orders, Products, Ingredients, Customers, Proofs, Reports, Shift, Settings, DataBackup, Setup, Lock
src/ui       shared components, barcode scanner
android/     Capacitor Android project (generated, plus our local ContactPickerPlugin); `npx cap sync android` after web changes
scripts/     icon generation, APK build, translation-key extractor
```
