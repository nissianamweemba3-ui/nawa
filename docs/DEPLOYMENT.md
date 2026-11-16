# Deploying to production

The platform is one Node.js process that keeps its SQLite database and encrypted evidence files on disk.
It needs a host that runs a long-lived container with a **persistent volume**. Serverless platforms such as
Vercel cannot run it as-is (see "Vercel" below).

The repository includes:

- `Dockerfile`: production image (Node 22.23.4, runtime dependencies only, runs as the unprivileged `node` user,
  data at `/data`, built-in health check on `/api/health`).
- `render.yaml`: a Render Blueprint with a 1 GB persistent disk.

The image was built and tested: it refuses to start without the required settings, serves every route, and
keeps the database, encrypted evidence and sessions across a container restart.

## Before you deploy

### 1. Decide where the data may be stored

Render, Fly.io and Railway have no data centres in Zambia. The nearest Render region is Frankfurt, Germany.
Hosting there stores personal data outside Zambia. The Data Protection Act No. 3 of 2021 restricts transfers
of personal data outside Zambia, and the platform's own legal library flags cross-border storage as a
high-priority control. Confirm with your legal adviser that this arrangement is acceptable, or choose a host
in Zambia (the same Docker image runs on any server with Docker and a persistent volume).

Whatever you choose, set `HOSTING_LOCATION` to the real location. The privacy policy discloses it, and states
automatically when the data is held outside Zambia.

### 2. Prepare the settings

| Setting | Value |
|---|---|
| `DATA_KEY` | 64 hex characters. Generate once and store it in a password manager: losing it makes evidence files and authenticator secrets unreadable. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SITE_URL` | The public https address, for example `https://compliance.example.zm` (no trailing slash or path) |
| `OPERATOR_NAME` | The legal name of the organisation running the service |
| `CONTACT_EMAIL` | A monitored privacy and support address |
| `HOSTING_LOCATION` | Country and region of the server, for example `Germany (Frankfurt)` |
| `ANTHROPIC_API_KEY` | Optional. Enables model-generated answers; without it the AI features quote the approved sources |

`NODE_ENV=production`, `SECURE_COOKIES=true` and `TRUST_PROXY=true` are already set in `render.yaml`.

### 3. Merge the pull request

`render.yaml` deploys the `main` branch. Merge the pull request first, or change `branch:` to deploy another branch.

## Deploy on Render

1. Sign in at render.com and connect the GitHub repository.
2. Choose **New > Blueprint**, select the repository and confirm the `dpa-zambia-compliance` service.
3. Enter `DATA_KEY`, `SITE_URL`, `OPERATOR_NAME` and `CONTACT_EMAIL` when prompted. Adjust `HOSTING_LOCATION` if you change the region.
   If your domain is not ready yet, set `SITE_URL` to the service's `https://<name>.onrender.com` address for now
   and change it after connecting the domain. Every host name other than `SITE_URL` is redirected to it.
4. Create the service. Persistent disks need a paid instance type (the Blueprint uses `starter`).
5. When the deploy is live, `https://<name>.onrender.com/api/health` should return `{"ok":true}` (the health check
   is never redirected). Pages load on the address in `SITE_URL`.

If start-up settings are missing, the deploy log lists exactly which ones, and the service will not start.

## Connect your domain

1. In the Render service, open **Settings > Custom Domains** and add your domain (for example `compliance.example.zm`).
2. At your DNS provider, create the record Render shows (a CNAME for a subdomain, or the A record for an apex domain).
3. Wait for Render to verify the domain and issue the HTTPS certificate.
4. Make sure `SITE_URL` exactly matches the domain. Requests that arrive on any other host name (including the
   `onrender.com` address and `www.` variants) are redirected permanently to `SITE_URL`, and plain HTTP is
   redirected to HTTPS.

## After the first deploy

- **Check:** `/`, `/privacy`, `/terms`, `/app`, `/robots.txt` and `/sitemap.xml` all load on the custom domain, and
  `/sitemap.xml` lists your domain.
- **Create the platform staff accounts:** the legal reviewer and platform administrator register normal accounts,
  then you assign their roles from the service's shell (Render: **Shell** tab). Roles cannot be self-assigned in the app.

  ```bash
  node server/admin-cli.js set-platform-role reviewer@example.com legal_reviewer
  ```

  ```bash
  node server/admin-cli.js set-platform-role admin@example.com platform_admin
  ```

  The reviewer and the administrator must be different people: the platform requires a different person to approve
  what another captured.
- **Submit the sitemap** in Google Search Console and run the home page through Google's Rich Results Test.
- **Backups:** the database and evidence are on the persistent disk only. Enable your host's disk snapshots
  and keep `DATA_KEY` safe separately; a backup cannot be decrypted without it.
- **Single instance:** SQLite runs on one instance. Do not scale to more than one instance; move to the
  PostgreSQL schema in `db/postgres/` first if you need that.

## Other hosts

The same image runs on Fly.io (attach a volume at `/data`), Railway (add a volume mounted at `/data`) or a
server with Docker:

```bash
docker build -t dpa-zambia .
```

```bash
docker run -d --name dpa-zambia -p 3000:3000 -v dpa-data:/data --env-file production.env dpa-zambia
```

Put the server behind an HTTPS reverse proxy that sets `X-Forwarded-Proto`.

## Vercel

The repository is currently connected to a Vercel project that deploys every push as static files. Those
deployments show "Ready" but return 404 for every page, because Vercel cannot run this server. Once the
platform is live on its real host, disconnect the repository from that Vercel project (Project Settings > Git),
so previews no longer publish empty sites.
