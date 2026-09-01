# Setup

Two things to do by hand, once. Everything else is built.

Roughly 20 minutes. Do part 1 first — part 2 needs the site to exist.

---

## 1. Put the site on GitHub Pages

**Create the repo.** At [github.com/new](https://github.com/new), under the
`parallaxxlifeco` account:

- Name: `ledger-to-return`
- Public (Pages is free on public repos; the code is public, your data never is)
- Do **not** add a README, .gitignore or licence — there's already a commit here

**Push what's already committed.** In Terminal on your Mac:

```bash
cd ~/Documents/"Claude Code"/"Ledger to Return"
git remote add origin https://github.com/parallaxxlifeco/ledger-to-return.git
git push -u origin main
```

If it asks for a password, that's a token, not your account password — the `gh`
CLI (`brew install gh && gh auth login`) handles this properly and is worth doing
once. Do not paste a token into the remote URL; see the note at the bottom.

**Turn on Pages.** Repo → Settings → Pages → Source: *Deploy from a branch* →
Branch `main`, folder `/ (root)` → Save. A minute later the app is at:

```
https://parallaxxlifeco.github.io/ledger-to-return/
```

Open it. It works immediately, saving to that browser. Drive comes next.

---

## 2. Let it save to Google Drive

The app needs its own OAuth client so Google will let it write a file on your
behalf. The client ID this produces is **not a secret** — it only works from the
site it's registered to, which is why the site has to exist first.

**Create a project.** [console.cloud.google.com](https://console.cloud.google.com) →
project dropdown, top left → *New Project* → name it `Ledger to Return` → Create,
then make sure it's the selected project.

**Enable the API.** *APIs & Services* → *Library* → search **Google Drive API** →
Enable.

**Set up the consent screen.** *APIs & Services* → *OAuth consent screen*:

- User type: **External** → Create
- App name `Ledger to Return`, support email and developer email: your own
- Scopes: skip, the app asks for what it needs at sign-in
- Test users: **add your own Google address** — this matters, only listed users
  can sign in while the app is unverified
- Back to dashboard. Leave it in *Testing*; publishing would mean Google review
  for a tool only you use

**Create the client ID.** *APIs & Services* → *Credentials* → *Create
Credentials* → *OAuth client ID*:

- Application type: **Web application**
- Name: `Ledger to Return web`
- **Authorised JavaScript origins** → Add URI:
  ```
  https://parallaxxlifeco.github.io
  ```
  The origin only — no path, no trailing slash. Add `http://localhost:8899` too
  if you ever want to run it locally.
- Leave *Authorised redirect URIs* empty. This app uses the token flow, which
  doesn't redirect.
- Create → copy the client ID (ends `.apps.googleusercontent.com`)

**Connect it.** Open the app → **Import** → *Where your work is saved* → paste the
client ID → **Connect Google Drive** → choose your account → Allow.

You'll see "Google hasn't verified this app". That's expected for an unpublished
app you built for yourself: *Advanced* → *Go to Ledger to Return (unsafe)*.

It writes one file, `ledger-to-return-data.json`, at the top of your Drive. The
permission it asks for (`drive.file`) only lets it touch files it created itself —
it cannot see the rest of your Drive, including your sheets.

---

## Moving your data across

Your FY 2025–26 work lives in the Claude artifact. To bring it over:

1. Open the artifact → **Backup** (top right) → save the JSON
2. Open the Pages site → **Import** → *Restore a backup* → pick that file
3. Check the transaction count and a few categories match
4. Connect Drive — it pushes the restored data up on first connect

Keep the artifact until you've done this and used the hosted version for a real
statement.

---

## Day to day

- Work is written to your browser instantly, then to Drive a moment later. The
  chip at the top right says which.
- Drive keeps version history: right-click the file → *Manage versions*.
- *Save a dated snapshot* writes a separate timestamped copy, for before anything
  drastic.
- Sign-in lasts about an hour, then renews silently. If the chip says *Drive not
  connected*, click it and reconnect — nothing is lost, it's all still local.

---

## One security note

`Claude Code/GHL-Dashboard/.git/config` currently has a GitHub personal access
token written into the remote URL in plaintext. Anything that reads that folder
can push to your GitHub. Revoke it at
[github.com/settings/tokens](https://github.com/settings/tokens), then:

```bash
cd ~/Documents/"Claude Code"/GHL-Dashboard
git remote set-url origin https://github.com/parallaxxlifeco/event-dashboard.git
```

and authenticate with `gh auth login` or the macOS keychain instead. Unrelated to
this project, but worth doing today.
