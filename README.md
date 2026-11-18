# Online Chess — real-time multiplayer with accounts, Elo and an admin panel

A full-stack chess platform where two real players are matched and play live over WebSockets.
The server is the single source of truth for move legality; the browser only renders.

**Live:** <https://chess.agrtravel.com> · *(Arabic interface, RTL)*
**Arabic documentation:** [README.ar.md](README.ar.md) · [GUIDE.ar.md](GUIDE.ar.md)

---

## What it does

**Play without an account** — type a display name, pick a time control, press play. The server
puts you in a queue and starts a game as soon as an opponent picks the same time control.

**Play with an account** — register to get a permanent profile with an Elo rating, win/loss/draw
statistics, a history of every game you played, and a place on the leaderboard.

**Challenge a friend** — generate a link, send it, and the game starts the moment they open it.

**Admin panel** — a separate authentication realm for operators: overview counters, user list,
game list, and a move-by-move replay of any finished game.

---

## Architecture

```
server/   Express + Socket.IO + chess.js + MySQL   — authoritative game logic
client/   React + Vite + react-chessboard          — rendering only
```

### The server is authoritative

Every move arrives as a socket event and is replayed against a `chess.js` instance held on the
server. An illegal move — or a legal move played out of turn, or a move on someone else's
pieces — is rejected and never reaches the other player. The client holds a copy of the position
purely to draw it; nothing it sends is trusted.

Player identity comes from a server-side `sessionId`, not from a field in the socket payload, so
a player cannot claim to be their opponent by editing the request.

### Game state

Each match is a `GameSession` object (FEN, move history, clocks, status, pending draw offer)
owned by `games/gameManager.ts`. State lives in memory, but the storage layer is deliberately
isolated behind the manager so it can be moved into MySQL without touching the game logic.

### Clocks

Six time controls (1+0, 3+0, 3+2, 5+0, 10+0, 15+10) with increment applied after each move.
Flag-fall ends the game — except when the opponent has insufficient mating material, which is
scored as a draw, matching the official rule.

### Reconnection

A disconnect does not end the game. The player keeps a 30-second grace window to rejoin with
their session; only after it expires is the game awarded to the opponent.

### Rating

Standard Elo, K = 32, new accounts start at 1200. Ratings are recalculated after every rated game
in `services/elo.ts`.

---

## Security

The interesting part of this project is not the chess — it is everything around it.

| Concern | How it is handled |
|---|---|
| Move forgery | Server-side validation with `chess.js`; the client is never trusted |
| Identity spoofing | Identity derived from a server-held `sessionId`, not from client payloads |
| Password storage | `bcryptjs` hashes; plaintext passwords are never stored or logged |
| Session tokens | JWT, signed with a secret read from the environment and required at boot |
| Privilege separation | Admin tokens are a separate realm with a much shorter lifetime (2 days vs 30) |
| Brute force | Per-IP login throttling — 8 failed admin attempts / 15 min, 10 for players |
| Spam registration | 15 accounts per IP per hour (deliberately generous: a club shares one IP) |
| Event flooding | 15 socket events per second per connection |
| Attack surface | `ADMIN_PANEL_ENABLED=false` makes every `/api/admin` route return 404, as if absent |
| Input | Display names are sanitised and length-capped before they reach any other player |
| Secrets | No secret is committed; `.env.example` ships with empty values |

### Fail-safe degradation

If the database credentials are missing, the server does not crash and does not run with a
default password. It starts in guest-only mode: matchmaking and live play still work, accounts,
history and the admin panel simply do not exist.

---

## Running it

Requires Node.js 18+ (20+ preferred) and, optionally, MySQL 8.

```bash
npm run install:all          # root + server + client

cp server/.env.example server/.env
cp client/.env.example client/.env

npm run dev                  # server on :4000, client on :5173
```

Defaults work out of the box. Leave the `DB_*` variables empty to run in guest-only mode, or
point them at a MySQL instance and load `server/database/schema.sql` and
`server/database/admin-schema.sql` to enable accounts and the admin panel.

Create the first administrator:

```bash
npm run create-admin --prefix server
```

### Testing two players locally

Matchmaking keys on `sessionId`, which lives in `localStorage` — so two tabs in the same browser
profile are the same player. Use one normal window and one incognito window, or two browsers.

---

## Stack

TypeScript (both sides) · Node.js · Express · Socket.IO · chess.js · MySQL 8 · JWT · bcrypt ·
React 18 · Vite · React Router · react-chessboard

---

## Status

Running in production at the link above. Source published for review — all rights reserved.
