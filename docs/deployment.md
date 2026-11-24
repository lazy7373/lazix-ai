# Deployment notes

LAZIX is a Next.js application. It needs a Node.js runtime; it is not a static-only site because chat and integration routes run on the server.

## Runtime

- Node.js 20.9 or newer
- Install dependencies with `npm install`
- Build with `npm run build`
- Start with `npm run start`
- The default Next.js port is 3000.

## Environment variables

Start with `.env.example` and configure only the integrations you intend to use.

At minimum, configure a model provider if you want AI responses. Configure Supabase if you want sign-in, cloud conversations, and synced memory. Tavily and GitHub integration variables are optional.

Set production values in your hosting provider's secret/environment-variable settings. Do not put real credentials in source files, Docker images, screenshots, issue reports, or commits. Never expose privileged GitHub tokens or model-provider keys through `NEXT_PUBLIC_*` variables.

## Database

For a new Supabase project, apply the SQL migrations in `supabase/migrations/` in filename order. Back up production data before applying schema changes to an existing project.

## Before exposing a deployment

- Use HTTPS.
- Set strong authentication and restrict privileged integrations.
- Review provider quotas and rate limits.
- Check logs for accidental secret or personal-data exposure.
- Test sign-in, chat, memory, and provider failure handling.
- Keep dependencies and the host operating system updated.

These notes describe the current deployment approach. A production Docker setup and automated deployment pipeline have not been added yet.
