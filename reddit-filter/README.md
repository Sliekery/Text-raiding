# Reddit Subreddit Filter

A userscript that hides posts from a list of subreddits on reddit.com: Home, Popular, All and search results. It works on new, old and mobile-web Reddit.

It blocks two ways:

- **Exact names** in `BLOCKED_SUBS`, about 90 national, city, state, meme, finance, entertainment and diaspora subs.
- **Name patterns** in `BLOCKED_PATTERNS`. Any sub with `india`, `bharat`, `hindi` or `bollywood` in its name is hidden, so new or unlisted subs are caught too. Names like Indiana, Indianapolis and IndianaJones are skipped.

If a sub you want is hidden by mistake, add its name to `ALLOWED_SUBS`. To keep a small "hidden r/xyz (tap to show)" bar in place of each hidden post, set `HIDE_COMPLETELY = false`.

If you open a blocked sub on purpose (for example `reddit.com/r/india`), the script does nothing on that page.

## Install on iPhone or iPad (Safari)

The Reddit **app** cannot run scripts. Browse reddit.com in Safari instead.

1. Install the free **Userscripts** app from the App Store (by Justin Wasack).
2. Open the app and choose a folder for scripts, such as `On My iPhone › Userscripts`.
3. Go to Settings › Apps › Safari › Extensions › Userscripts, turn it on and set **reddit.com** to *Allow*.
4. Save `reddit-sub-filter.user.js` into that folder. You can download it from GitHub and move it there with the Files app. You can also tap the Userscripts icon in Safari's address bar, choose **+ › New JS**, paste the file's contents and save.
5. Reload reddit.com.

## Install on desktop (Chrome, Firefox, Edge, Safari)

Install **Tampermonkey** or **Violentmonkey**, create a new script, paste the file's contents and save.

## Editing the lists

Open the script and edit the arrays at the top. Names are case-insensitive and written without `r/`.
