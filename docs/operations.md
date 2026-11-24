# Operating LAZIX

This guide covers a small single-server deployment. It is intended for an early private beta, not a high-availability production service.

## Resource profile

LAZIX runs as a Node.js / Next.js web application. Model inference is sent to configured external OpenAI-compatible providers; LAZIX does not run an LLM locally and does not require a GPU.

A VPS with **2 vCPU and 4 GB RAM** is a reasonable starting point for the application and a small number of users. Actual capacity depends on traffic, provider latency, response streaming, and any other services sharing the machine. Monitor memory and CPU before increasing concurrency.

Supabase is an external managed database/auth service when configured. The application does not need a local PostgreSQL server for that setup.

## Start with Docker Compose

1. Install Docker Engine and the Docker Compose plugin.
2. Clone the repository and enter its directory.
3. Create the environment file:

   ```bash
   cp .env.example .env.local
   nano .env.local
   ```

4. Configure at least one AI provider. Add Supabase values if cloud sign-in, conversation sync, and persistent memory are needed.
5. Build and start LAZIX:

   ```bash
   docker compose up -d --build
   ```

6. Check the container and application health:

   ```bash
   docker compose ps
   curl http://127.0.0.1:3000/api/health
   docker compose logs --tail=100 lazix
   ```

The health endpoint reports only whether optional services are configured. It never returns API keys, tokens, or database credentials.

## Updates and recovery

Pull the latest reviewed commit, rebuild, and restart:

```bash
git pull --ff-only
docker compose up -d --build
docker image prune -f
```

Keep a copy of `.env.local` somewhere secure and outside the Git repository. Do not put secrets in issue reports, screenshots, or logs.

If Supabase is enabled, use the Supabase project's backup/export facilities and retain backups according to the data-retention needs of the deployment. The VPS image is replaceable; user data should not depend on the container filesystem.

## Network and security

- Put a reverse proxy such as Caddy or Nginx in front of the app and enable HTTPS before exposing it publicly.
- Keep SSH restricted to trusted keys and limit administrative access.
- Allow inbound traffic only for SSH and the HTTPS reverse proxy. Do not expose database ports.
- Keep `.env.local` readable only by the deployment administrator.
- Update the base image and npm dependencies regularly, then review CI results before deploying.
- Configure provider-side spending limits where available. Free model availability and quotas are controlled by each provider, not LAZIX.

## Current limitations

- The Compose setup runs one application instance; it is not a clustered or highly available deployment.
- The in-memory request limiter is per application process and is not shared across multiple instances.
- Background memory extraction is best-effort and depends on the configured model provider.
- GitHub integration is read-only and owner-scoped. Repository write operations are not enabled.
