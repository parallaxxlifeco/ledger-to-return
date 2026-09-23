# Setup

Both one-time steps are done. This is the record of what was set up, so it can be
rebuilt or changed later.

---

## 1. Put the site on GitHub Pages

**Already done** — the repo is
[parallaxxlifeco/ledger-to-return](https://github.com/parallaxxlifeco/ledger-to-return),
public, serving from `main` at the root, live at
<https://parallaxxlifeco.github.io/ledger-to-return/>.

<details>
<summary>How it was set up, if you ever need to redo it</summary>

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

</details>

---

## 2. Let it save to Google Drive

**Already done** — Claude set this up on 1 September 2026. Recorded here so you
can rebuild or change it later.

| | |
|---|---|
| Google account | parallaxxlifeco@gmail.com |
| Cloud project | `ledger-to-return` |
| API enabled | Google Drive API |
| Consent screen | External, in Testing — **the test-user list must contain `parallaxxlifeco@gmail.com`** (see the warning below) |
| OAuth client | "Ledger to Return web", Web application |
| Authorised origins | `https://parallaxxlifeco.github.io` and `http://localhost:8899` |
| Client ID | `989893722816-oc12c1mvous3uvql355k81qn203lfsid.apps.googleusercontent.com` |

The client ID is baked into the page, so any browser you open it in already has
it. It is public by design — it identifies the app, and Google only honours it
from the two origins above. The client secret Google also issued is unused: the
browser token flow doesn't take one, and nothing here stores it.

> **If Google says “Access blocked … has not completed the Google verification
> process” (Error 403: access_denied)**, the consent screen is in Testing and
> your account is not on the test-user list. On 23 September 2026 the list was
> empty — it was never saved when the project was first set up, despite what
> this file used to claim. Fix it at
> [Google Auth Platform → Audience](https://console.cloud.google.com/auth/audience?project=ledger-to-return):
> **Test users → Add users → `parallaxxlifeco@gmail.com` → Save**.
>
> Two things that trip this up. The Cloud console opens with whichever Google
> account the browser defaults to, and this project lives under
> parallaxxlifeco@gmail.com — if the page says you need additional access,
> you are signed in as the wrong account; switch it with the avatar, top right.
> And test users don't survive being assumed: check the counter on that page
> reads 1 test user, not 0.
>
> The alternative is **Publish app** on the same page, which moves it out of
> Testing for good. `drive.file` is a non-sensitive scope, so Google does not
> require the verification review to publish. The button is greyed out until
> the Branding page is filled in.

To connect: open the app → **Import** → *Where your work is saved* → **Connect
Google Drive** → choose the account → **Allow**. Google will warn that the app
isn't verified, which is expected for an unpublished app you built for yourself:
*Advanced* → *Go to Ledger to Return (unsafe)*.

<details>
<summary>How it was set up, if you ever need to redo it</summary>

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

</details>

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
