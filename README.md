# Hamster Tower

A turn-based tower climb built on real data from Squeekchain. Every settled round in which the hamster did work is one floor. The round's work sets the floor type, its hash sets the enemies, map and weather, and long naps leave treasure chests.

The tower is built from the hamster's whole history, not from today onward. It has over 500 floors and grows on its own as new rounds settle. A round passes every 10 minutes, but the contract only keeps a record when the hamster ran, about 17% of rounds so far, so empty rounds make no floor.

## Run it locally

You need Node 22 or newer. Nothing else: the project runs its own real Postgres from the project folder.

```
npm install
npm run dev
```

Open http://localhost:3000 and choose **Play as guest** or **Sign in with wallet**. The first start creates the database and reads the full round history from the chain, which takes about 20 seconds.

Press Ctrl+C to stop. If you close the terminal instead, the database keeps running. The next `npm run dev` reuses it, or run `npm run db:stop`.

The **Test panel** button adds coins, chests and food, unlocks all pets, resets Sweep and jumps floors. `npm run dev` sets `ALLOW_TRIAL=1`, which gives it to everyone on your machine. On the live site only the wallets listed in `TEST_WALLETS` get it, and the server checks this on every call. Floors a test wallet jumps to count on the leaderboard until it erases its data.

## Economy

Coins are in-game only. There are no top-ups, tokens, NFTs or trading. All odds are public in the game.

Hamsters level up through food, not by paying coins directly:

1. Buy a food bag in the **Shop**. Each bag opens into one food, with the same spin and quick open as chests.
2. Feed a hamster until it is 100% full. Foods give different fullness, and a higher level means a bigger stomach.
3. A full hamster can run the wheel, with an animation you can skip. The run empties its stomach and gives random XP.
4. Enough XP gives a level, which adds 10% of base stats.

| Item | Price | Contents |
|---|---|---|
| Snack Bag | 20 coins | Mostly small foods, suits levels 1 to 12 |
| Picnic Basket | 150 coins | Mostly medium foods, suits levels 12 to 40 |
| Feast Crate | 900 coins | Large foods, suits level 40 and up |
| Blind Bag | 500 coins | Gear or a pet |

The 43 foods live in `shared/data.js`. Each one is named as safe in at least one care guide from PetMD, Chewy, Woodgreen or Burgess, checked on 2026-11-02. The guides do not fully agree: PetMD and Burgess advise against cooked human food such as egg, chicken and tofu, which Chewy and Woodgreen allow in small amounts, and Burgess warns that sunflower seeds are very fatty, which PetMD allows as a treat. Grapes, peanuts, walnuts, hazelnuts and pasta were left out because the guides clash on them. In real life these are tiny treats next to a complete pellet diet, and this is not veterinary advice.

Existing saves keep their levels. Pets saved before food existed start with an empty stomach and 0 XP.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Builds and runs everything locally |
| `npm run build` | Builds the site and API for Vercel |
| `npm run export` | Builds the static copy in `dist/` |
| `npm test` | API, anti-cheat and wallet tests against a running server |
| `npm run e2e` | Clicks through the real UI in headless Chrome against a running server |
| `npm run sim` | Balance bot that climbs the tower and reports battles per floor |
| `npm run loadtest` | Simulates many players, see the notes below |
| `npm run sync` | Reads new rounds from the chain once |
| `npm run bake-art` | Regenerates the WebP art from `tools/art-web.js`, needs Chrome |
| `npm run db:stop` | Stops the local database |

## How it stays fast with many players

The database does as little as possible.

- **Battles run on the player's device.** Entering a battle only returns a signed ticket and does not touch the database. When the battle ends, one request carries the player's choices. The server replays the battle with the same code and writes once.
- **Actions are batched.** Opening 50 bags, using all food or merging everything is one request and one write.
- **Hot and cold data are separate.** Coins, floor and chest counts sit in one small row written after each battle. Pets, gear and food are written only when they change, as one row per player and never one row per item. Inventories are capped at 500 items, and food is stored as a count per kind.
- **Reads avoid the database.** Art and code are static files on the CDN. The floor list is one cached response. One process reads the chain, however many people play. The leaderboard is cached for 30 seconds.
- **Connections are pooled.** On Vercel each function keeps one connection and must use a pooled `DATABASE_URL`.
- **Duplicates are harmless.** Every request has an id, so a retry cannot pay twice. A version number stops two tabs overwriting each other.

The leaderboard uses an indexed Postgres query behind the cache, so Redis is optional. It only shares request limits between functions.

## Fairness

The client never receives the random state, so chest, bag, food and wheel results cannot be predicted. The server replays each battle, so a modified client cannot claim a win it did not earn.

This does not stop bots. A script can play the game with valid moves, and one person can use many wallets. Rate limits and a minimum battle time slow this down but do not prevent it.

## Sound and fonts

Every sound is synthesized in `client/sound.js` with the Web Audio API, so there are no audio files and nothing to license. Browsers keep audio off until the first press, the speaker button or the M key mutes it, and the choice is remembered in the browser. `tests/flow.js` renders each sound without speakers and fails loudness checks if one goes silent or too loud.

The fonts are Baloo 2 and Be Vietnam Pro, served from `public/fonts` under the SIL Open Font License, whose text sits next to them. Nothing is loaded from another site.

## Project layout

```
shared/      Game content and rules, used by both browser and server
client/      Interface, skill effects, maps, styles
lib/         Server: routes, players, chain sync, limits
api/         The single Vercel function
sql/         Database schema
tools/       Art source
scripts/     Build, local server, sync, simulation, load test
tests/       API tests and browser flow
public/      Build output served as static files
```

`lib/engine.generated.cjs`, `public/app/` and `public/index.html` are generated by `npm run build`. Run it before `npm test`. Do not edit them by hand.

## Data source

Round history comes from `roundPage` on two SqueekCore contracts on Ethereum Sepolia, in this order:

| Floors | Contract | Status |
|---|---|---|
| 1 to 331 | `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f` | Stopped, pinned to round 1973 |
| 332 onward | `0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44` | Live |

The list lives in `lib/config.js`. Only append to it: floor numbers depend on its order. To use the live contract alone, set `SQUEEK_CORES` before the first sync and start from an empty database.

The sync checks that total work matches the chain and only reads rounds at least 12 Ethereum blocks old.

## Deploying to Vercel

1. Create a Postgres database and copy its **pooled** connection string.
2. Set `DATABASE_URL` and `SESSION_SECRET` in Vercel. See `.env.example`. Set `ALLOW_GUEST=1` if people should be able to play without a wallet. Never set `ALLOW_TRIAL` or `RATE_LIMIT_OFF` in production.
3. Run `DATABASE_URL=... npm run migrate` once, then `DATABASE_URL=... npm run sync` to load the history.
4. Deploy.
5. Run a load test against a preview deployment before opening to players.

## The static copy

`npm run export` writes `dist/`: the same game as a static site with relative paths, for hosting on IPFS through IMD. It holds no server code. It calls the API named in `site.config.json`, so the battle replay, random rolls and database stay on Vercel.

The API only accepts calls from the addresses in `CORS_ORIGINS`. Cookies do not cross between sites, so the copy keeps a signed session ticket in the browser and sends it as a header. Public data such as floors and the leaderboard can be read from anywhere and stays cached by the CDN.

Vercel Cron on the Hobby plan runs once a day. That is only a backup: requests to `/api/rounds` that reach the server also sync when the data is over a minute old.

## Load test notes

`scripts/loadtest.js` needs a server started with `RATE_LIMIT_OFF=1 MIN_MS_PER_ROUND=0 ALLOW_GUEST=1 ALLOW_TRIAL=1`, on a separate database because it creates thousands of players.

Results on one Windows desktop, with the load generator, one Node process and Postgres sharing the machine:

| Simulated load | Battles saved per second | Saving a battle, p99 | Errors |
|---|---|---|---|
| 10,000 players, one battle per 90 s | About 110 at the end of the run | 9 ms | None |
| 3,000 players, one battle per 3 s | About 670 | 1,251 ms, saturated | None |

These numbers do not describe Vercel or a hosted database. They show the design has room at the target load. Repeat the test against real infrastructure before launch.
