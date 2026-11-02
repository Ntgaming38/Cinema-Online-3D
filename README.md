# TCG Cinema — Online 3D Theater

Starter project for a responsive online watch-together cinema.

## Stack

- Next.js 15 + React + TypeScript
- React Three Fiber / Three.js for the 3D auditorium
- Socket.IO for room presence, chat, reactions and playback synchronization
- Prisma + MySQL-compatible TiDB schema
- Docker Compose for local MySQL development

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm 10+
- Docker Desktop (for local database)

## Run locally

1. Copy `.env.example` to `.env` in the project root.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start local MySQL:

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client and create tables:

   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Start web + realtime services:

   ```bash
   npm run dev
   ```

6. Open:
   - Web: http://localhost:3000
   - Realtime health: http://localhost:4001/health

## TiDB Cloud

Create a TiDB Cloud cluster and replace `DATABASE_URL` with the MySQL connection string from the cluster. Keep credentials private and configure TLS/CA requirements exactly as specified by TiDB Cloud. Then run `npm run db:generate` and `npm run db:push`.

## Current implementation status

### Included in this starter
- Responsive Vietnamese landing page
- Room route `/rooms/[code]`
- Interactive 3D auditorium scene (orbit camera)
- Video element and direct HTTP(S) video URL input
- Socket.IO room presence
- Realtime chat and reactions
- Basic room-wide playback state broadcast
- Prisma data model for users, rooms, videos, members, seats, messages and playback

### Important MVP limitations (must be addressed before public launch)
- Demo landing-page rooms are static examples, not database-backed yet.
- Room codes currently identify ephemeral Socket.IO rooms; they are not yet checked against persisted rooms.
- Guest identity is temporary. Add real authentication and signed socket tokens.
- Playback state is currently held in realtime server memory. Persist it to TiDB and use Redis adapter / shared state for multiple realtime instances.
- The current playback command accepts commands from any room member. Add owner/moderator authorization before production.
- Direct video URLs are not guaranteed to be embeddable or CORS-enabled. Use approved sources and validate server-side; do not proxy arbitrary URLs.
- For YouTube, use the official embed/player API and comply with its terms. Do not download or redistribute copyrighted content without permission.
- Add rate limits, moderation, input validation, room password hashing, logging and monitoring before exposing publicly.

## Suggested build milestones

1. Foundation (this repository): app shell, 3D scene, Socket.IO MVP and database schema.
2. Persistence: room create/list/join APIs, users and playback persistence.
3. Security: authentication, signed socket tokens, owner/moderator permissions, room passwords and rate limits.
4. Media: supported provider adapters, HLS playback, synchronization drift correction.
5. 3D: seat selection, avatars, presence positions, optimized mobile rendering.
6. Production: Redis Socket.IO adapter, Dockerfiles, reverse proxy, HTTPS, backups and observability.
