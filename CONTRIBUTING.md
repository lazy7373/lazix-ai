# Contributing to LAZIX

Thanks for taking an interest in LAZIX. The project is still being built, so small, focused contributions are especially useful.

## Before you start

- Read the main README and check the roadmap.
- For a significant change, open an issue first so the approach can be discussed.
- Keep pull requests focused on one problem or feature.

## Set up locally

Requirements: Node.js 20.9 or newer.

```bash
git clone https://github.com/lazy7373/lazix-ai.git
cd lazix-ai
npm install
cp .env.example .env.local
npm run dev
```

Add your own development credentials to `.env.local` when needed. Never commit real API keys, access tokens, or private user data.

For Supabase, create a separate development project and apply the SQL migrations in `supabase/migrations/` in filename order.

## Before opening a pull request

Run:

```bash
npm run lint
npm run build
```

Include a clear summary of the change, why it is needed, and how you tested it. Add screenshots for visible UI changes when practical. Mention any environment variables or migration steps that are required.

## Code and safety expectations

- Avoid adding secrets or hard-coded credentials.
- Keep provider keys and privileged integrations on the server.
- Treat model output, repository files, and tool results as untrusted input.
- Do not add repository write actions without an explicit approval flow.
- Update documentation when setup steps or behaviour change.

By contributing, you agree that your contributions will be distributed under the project's MIT License.
