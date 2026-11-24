# LAZIX VPS use and infrastructure plan

This document explains what LAZIX would run on a sponsored VPS, why the resources are requested, and how the machine would be operated. It describes the current project honestly; planned features are not presented as completed features.

## Project

LAZIX is an open-source, text-first AI workspace built with Next.js, React, and TypeScript. The public source code is available at:

- Repository: https://github.com/lazy7373/lazix-ai
- License: MIT

The current application includes streaming chat, configurable OpenAI-compatible model providers, provider fallback, optional Supabase sign-in and cloud conversation history, user memory, and bounded tools. Optional integrations include web search and owner-scoped read-only GitHub file access.

## What would run on the VPS

The VPS would host one Dockerized Next.js application:

1. The web interface and server-side API routes.
2. Streaming chat requests and provider routing.
3. Bounded tool execution for calculator, date/time, memory search, and any explicitly configured optional integrations.
4. A small health endpoint for uptime and container checks.

Model inference is handled by external model-provider APIs. **LAZIX does not run model weights on the VPS and does not need a GPU.** Supabase is used as an external managed service when cloud authentication, memory, and conversation sync are enabled.

The VPS is for hosting and development/testing of the open-source application. It is not intended for cryptocurrency mining, proxy resale, bulk email, or unrelated workloads.

## Requested starting resources

| Resource | Request | Reason |
| --- | --- | --- |
| CPU | 2 vCPU | Next.js server, API requests, streaming, and container operations |
| Memory | 4 GB RAM | Node.js runtime, operating system, Docker, and modest beta traffic |
| Storage | 50 GB NVMe/SSD | OS, application image, dependencies, logs, and safe update headroom |
| OS | Ubuntu 24.04 LTS | Familiar, maintained Linux server environment |
| Access | SSH | Deployment, updates, monitoring, and troubleshooting |
| Network | Public IPv4 preferred | Straightforward HTTPS access and testing |

These are initial requested resources, not measured performance claims or a guarantee of capacity. The deployment would begin as a small private beta. CPU, memory, disk, and application logs would be monitored, and concurrency would be kept modest until actual usage is measured.

## Operational plan

- Run the app with Docker Compose and restart it automatically after host reboots.
- Put Caddy or Nginx in front of the app and enable HTTPS before public access.
- Keep model-provider keys and integration credentials in a server-side environment file with restricted permissions; never commit them or bake them into the image.
- Use a non-root user inside the application container.
- Use the health endpoint at `/api/health` for basic liveness checks.
- Keep SSH restricted to trusted keys and expose only required network ports.
- Update the application and base image regularly after CI checks pass.
- Keep user data in the managed Supabase service where configured; do not rely on the container filesystem for durable user data.
- Review logs for errors and accidental sensitive data, and keep provider-side usage limits enabled where available.

## Why sponsorship matters

A stable VPS would let the project move beyond local development and be tested as a real, self-hostable service. It would provide a consistent environment for validating Docker deployment, HTTPS, uptime, provider fallback, and resource use. Those results can be documented publicly so other developers can reproduce the deployment.

LAZIX is still an active rebuild. The repository includes deployment and operations documentation, but a live VPS deployment and production load profile have not yet been demonstrated. The first milestone after approval would be to deploy the current version, verify health and core flows, record actual resource usage, and publish any fixes and operational notes back to the public repository.

## Scope and limitations

- Early beta, single application instance; no high-availability or autoscaling claim.
- External model APIs are subject to their own quotas, pricing, and availability.
- Optional Supabase and search integrations may have separate service limits.
- GitHub access is read-only and owner-scoped; repository write actions are not enabled.
- The application should not be treated as a production service for sensitive or business-critical workloads yet.
