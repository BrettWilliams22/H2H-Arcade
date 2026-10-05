# H2H Arcade (working name)

Original retro arcade games where two players play the exact same short game
and the higher score wins the stake. This is the test version: one game, a
test network, and worthless test tokens.

## Where we are

| Milestone | Status |
|---|---|
| 1. Game logic: deterministic, recorded, replayable without a screen | Done |
| 2. Playable game in the browser, with practice mode | **Done, ready for you to test** |
| 3. Server: replay checks, anti-cheat, skill ratings, matchmaking, challenge links | Next |
| 4. Contract and tests on a local test chain | |
| 5. Deploy to Polygon Amoy and connect everything | |
| 6. Friend test | |

The first game is **Brickstorm**, a brick-breaker. The name is a placeholder,
so check it for trademarks before any public launch. Rules are in
[docs/game-design.md](docs/game-design.md).

## Setup (Windows 10)

I recommend WSL (Windows Subsystem for Linux), which runs Linux inside
Windows. Milestones 1–3 also work in plain Windows, but the contract tools in
Milestone 4 (Foundry) work best in WSL, so it's easier to start there.

1. Open PowerShell as Administrator and run `wsl --install`. Restart when it
   asks. This installs Ubuntu. (Windows 10 needs version 2004 or newer.)
2. Open "Ubuntu" from the Start menu and create a user name and password.
3. Install Node.js 22 in Ubuntu:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   source ~/.bashrc
   nvm install 22
   ```
4. Get the code and install its tools:
   ```bash
   git clone https://github.com/brettwilliams22/h2h-arcade.git
   cd h2h-arcade
   npm install
   ```

To edit in VS Code, install its "WSL" extension, then run `code .` from the
project folder in Ubuntu.

## How to test Milestone 2 (the browser game)

**1. Start the game on your computer.**

```bash
npm run dev
```

Open http://localhost:5173 in Chrome or Edge on Windows. (WSL shares
`localhost` with Windows, so this works even though the game runs in Ubuntu.)
Press `Ctrl+C` in the terminal to stop it.

**2. Play it on your phone.** Your phone must be on the same Wi-Fi as your PC.
Because the game runs inside WSL, Windows has to pass the phone's connection
through to it:

1. In Ubuntu, run `npm run dev:phone` instead of `npm run dev`.
2. On Windows, open PowerShell **as Administrator** and run these. The first
   line finds WSL's address. The `netsh` lines forward port 5173 to WSL; run
   them again after each Windows restart, because WSL's address can change.
   The firewall rule only needs adding once.
   ```powershell
   $wsl = (wsl hostname -I).Trim().Split(" ")[0]
   netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0
   netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=$wsl
   New-NetFirewallRule -DisplayName "Brickstorm dev" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
   ```
   (The `delete` line prints an error the first time, which is fine.)
3. Run `ipconfig` in PowerShell and find the "IPv4 Address" of your Wi-Fi
   adapter, for example `192.168.1.23`.
4. On your phone, open `http://192.168.1.23:5173` (with your address).

**3. Things to try.**

- **Practice** gives a new random layout each time. **Daily layout** is the
  same for everyone on the same day (by UTC date). **Play a seed** lets two
  people type the same number and play the exact same layout, which is a
  quick way to try head-to-head with a friend before the server exists.
- **Controls.** On a phone, drag anywhere to move. The paddle follows your
  finger, and your finger can stay below the game so it doesn't hide the ball.
  Tap to launch, or touch with a second finger while steering. On a computer,
  use the arrow keys and Space, or the mouse and a click. Esc or P pauses.
- **After a game**, watch the replay (pause, 1×/2×/4× speed, and drag to jump
  around), or press **Download recording**. Then check the anti-cheat idea
  yourself: the computer recomputes the score from the inputs alone, and it
  should match the score the browser showed.
  ```bash
  npm run score -- /mnt/c/Users/YOUR-WINDOWS-NAME/Downloads/brickstorm-123456-2400.json
  ```
  (From WSL, your Windows Downloads folder is under `/mnt/c/Users/`.)
- **Device check** (on the home screen) replays 15 saved games and checks that
  this device computes exactly the same scores as the development computer.
  **Run it on your iPhone if you have one.** iPhones use a different
  JavaScript engine (Safari's), so this is the real test that scores match on
  every device. It should say PASS.
- **Back button.** During a game, the phone's Back button pauses instead of
  leaving the site.

**4. Run the automated browser tests (optional).** These play a full game in
a real browser, then check that the downloaded recording replays to exactly
the score and final state the browser showed. They also test touch controls,
pausing, the Back button, phone and desktop layouts, and the device check.
The first time, install the test browser (it asks for your Ubuntu password,
to install some system libraries):

```bash
npx playwright install --with-deps chromium
npm run test:browser
```

To also run the device check in Safari's engine and Firefox:
`npx playwright install --with-deps webkit firefox`, then `npm run test:engines`.

## Milestone 1 checks (game logic, no screen)

Run these from the project folder.

**1. Run all automated tests.** This includes the milestone test: 1,000 games
are played by a simulated player, recorded, sent through JSON (like they will
be sent to the server), and replayed twice each. Every replay must match the
live game's score exactly.

```bash
npm test
```

You should see every test pass. It takes about 10 seconds.

**2. Do the 1,000-game check yourself, with files you can look at.**

```bash
npm run simulate     # plays 1,000 games and saves each recording in replays/
npm run verify       # replays every file 3 times and checks every score
```

`verify` should print `PASSED`. Try breaking it on purpose: open any file in
`replays/`, change one number in the `inputs` list, save, and run `verify`
again. That game will almost always fail, either because the recording is
rejected or because its result no longer matches. (Rarely, a change makes no
difference, such as a move pressed while the paddle is already against the wall.)

**3. Watch a game as text.** You can also watch a rough text version in the terminal:

```bash
npm run watch                                # simulated player, new layout each time
npm run watch -- --seed 42 --skill 30        # pick the layout (seed) and skill (0-100)
npm run watch -- replays/game-0001.json      # watch a saved recording
npm run watch -- --speed 4                   # 4 times faster
```

In the text view, `[===]` is a 1-hit brick, `[###]` takes 2 more hits,
`[@@@]` takes 3, `[$$$]` is gold, `[***]` is a bomb, `O` is the ball, and
`==========` is the paddle. Run the same seed twice with different skills to
see that the brick layout is identical, which is what makes a head-to-head match fair.

## How the code is organized

```
packages/game/          The game rules. Shared by the browser and the server.
  src/constants.ts      Every tuning number (speeds, sizes, points, match length)
  src/game.ts           The rules: paddle, ball, bricks, scoring. One frame at a time.
  src/layout.ts         Brick layouts, generated from the match seed
  src/rng.ts            Seeded random numbers
  src/replay.ts         Recording format, checking recordings, replaying them
  src/session.ts        A live match: plays and records together (the browser uses this)
  test/                 Automated tests (and the saved "golden" games)
  tools/                Simulated player and the simulate/verify/score/watch commands
apps/web/               The website (React + Vite)
  src/game/             Drawing, controls, game loop, sound, effects
  src/screens/          Home, Play, Results, Replay, How to play, Device check
  e2e/                  Browser tests (Playwright)
  test/                 Unit tests for the controls and seeds
docs/game-design.md     Brickstorm rules and scoring
```

Later milestones will add `apps/server` and `contracts`.

## How scores are protected

- **The browser never sends a score.** It sends a recording: the match seed
  and every change in the player's input with the frame it happened on. The
  server will play that recording through this same code and compute the
  score itself.
- **Same seed plus same inputs gives the same score on every device.** To make
  that true, the game logic only uses whole-number math (positions are
  measured in 1/256ths of a pixel), moves forward in fixed steps of 1/60 of a
  second, and never uses `Math.random`, the clock, or functions like `Math.sin`
  whose last digits can differ between browsers. A test scans the code for
  these and fails if any appear.
- **Both players face the same game.** The only randomness is the brick
  layout, and each wave's layout comes from the match seed plus the wave
  number. Nothing random happens during play.
- **Bad recordings are rejected.** The checker refuses anything our own
  recorder would never produce: wrong length, wrong seed format, moves faster
  than the paddle's speed limit, out-of-order frames, extra fields (such as a
  "score" someone added), and so on. Checks for suspicious *play* (inhuman
  reactions, near-perfect games, unusual win rates) come in Milestone 3.
- **A recording only counts for its own match.** The checker takes the match's
  seed and rejects a recording made on any other layout, so a great game on an
  easy layout can't be passed off as a match result. (Milestone 3 adds match
  IDs so the same recording can't be submitted twice.)
- **Rules changes can't silently change scores.** `RULES_VERSION` is stored in
  every recording. The "golden" tests replay 15 saved games and fail if their
  scores change. If you change the rules on purpose, raise `RULES_VERSION` in
  `constants.ts` and run `npm run golden:update`.

## Recording format

```json
{
  "format": 1,
  "game": "brickstorm",
  "rules": 1,
  "seed": 3141592653,
  "frames": 5400,
  "inputs": [[12, 8, 0], [30, 8, 1], [31, 0, 0]]
}
```

Each entry in `inputs` is `[frame, move, action]`: starting at that frame, the
paddle moves `move` pixels per frame (−8 to 8) and the launch button is held if
`action` is 1. Only changes are stored. A typical game is 4–18 KB.

## Decisions made so far (tell me if you want any changed)

- **Match length: 90 seconds** (5,400 frames), in the middle of the 60–120 range.
- **No lives.** Losing the ball costs time and resets your multiplier, but the
  game always lasts exactly 90 seconds, so both players play the same length.
- **Touch controls: drag to move, tap to launch.** Dragging never launches, so
  phone players can line up a serve just like keyboard players can, which keeps
  head-to-head matches fair across devices.
- **Tuning is a first guess.** Weak simulated players average about 500 points
  and strong ones about 2,800, so skill clearly matters. Now that you can play
  it, tell me if it feels too slow, too fast, too easy, or too hard.
- **Practice best scores are saved on the device only.** Real records and
  history come with the server in Milestone 3.
- **Art and sound are made in code**, so there's nothing to license. The
  pixel font is Press Start 2P, which is free for commercial use under the
  SIL Open Font License.
- The network, currency, stakes, and fee defaults in the spec don't affect
  anything yet. I'll confirm them with you before Milestone 4.
