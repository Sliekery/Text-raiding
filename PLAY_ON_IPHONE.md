# 📱 Playing Text Raiding on your iPhone

The game is a single self-contained file, **`index.html`** — no app, no install,
no dependencies. You just need to open it in Safari. Pick whichever option is
easiest for you.

---

## Option A — GitHub Pages (best: a permanent link + home-screen app)

This gives you a real URL like `https://sliekery.github.io/text-raiding/` that you
can bookmark and add to your home screen.

1. On a computer, go to your repo on GitHub: **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set **Branch** to `claude/ps1-lowpoly-character-generator-z0s8lu` (that branch
   has both the game and PolyMe) and folder **`/ (root)`**, then **Save**.
4. Wait ~1 minute, refresh the Pages settings — it shows your live URL.
5. Open that URL in **Safari on your iPhone**.
6. Tap the **Share** button → **Add to Home Screen**. Now it launches full-screen
   like an app, and your progress is saved on the phone.

> Tip: if you merge `index.html` to your `main` branch, just point Pages at
> `main` and the link stays stable.

---

## Option B — Instant link, no setup (works if the repo is public)

Open this URL directly on your iPhone (it renders the file straight from GitHub):

```
https://raw.githack.com/sliekery/text-raiding/claude/text-raid-game-o1qbew/index.html
```

Then **Share → Add to Home Screen** to keep it handy. (If the repo is private,
use Option A or C instead.)

---

## Option C — AirDrop / email the file (fully offline)

1. Download `index.html` from the repo to a Mac/PC.
2. AirDrop it to your iPhone (or email it to yourself and open the attachment).
3. Open it in Safari/Files — it runs entirely offline.

---

## Bonus: PolyMe

The same repo has **[`polyme/`](polyme/)** — take a selfie, get a low-poly PS1
character, and fight waves of grunts in a Madness-style ragdoll shootout.
**Turn the phone sideways to play it.**

**Instant, no setup** (the repo is public, so this works right now):

```
https://raw.githack.com/Sliekery/Text-raiding/claude/ps1-lowpoly-character-generator-z0s8lu/polyme/index.html
```

Note: use **githack**, not `raw.githubusercontent.com` — GitHub serves raw files
as `text/plain`, so Safari shows you the source code instead of running the app.

**Permanent link:** once Pages is set up (Option A above), it lives at
`https://sliekery.github.io/text-raiding/polyme/`. Add that to your home screen
too. It also runs fully offline from the file, same as the game.

---

## Notes

- Everything runs **on your phone**; there is no server and no data leaves the device.
- Progress (character, gear, cleared bosses) is stored in the browser, so use the
  same browser/app each time. "New Character" resets it.
- Works great in portrait mode; rotate-lock recommended.
