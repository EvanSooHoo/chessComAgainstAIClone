# Chess Corner

A local, no-login chess opponent inspired by the board-and-sidebar experience at Chess.com. Created in `chessComAgainstAIClone`.

## Play (The evan instructions lol)

Double-click **Start-Chess.cmd**, or run:

```powershell
cd C:\Users\evans\gitrepo\chessComAgainstAIClone
npm run dev
```

Open **http://127.0.0.1:5180**. Keep the local server running while playing. Use that same address and browser to access your saved games. This app needs a local HTTP server for its engine worker; opening index.html directly is not supported.

Dependencies are already installed. For a fresh checkout, install Node.js 22+ and run `npm install` first. Installation copies the Stockfish worker and WebAssembly binary into `public/engine`. Chess-piece SVGs are included. Runtime assets are all local: there are no API keys, accounts, paid services, remote fonts, or runtime CDN requests.

## Play for everyone else

Open the browser lol

## Features

- AI Slop README.md
- Stockfish 19 Lite runs in a Web Worker, keeping the interface responsive.
- Six relative difficulty settings, from one-ply beginner search to full Stockfish skill with a longer search. Names are presentation, not distinct learned personalities. The levels are not calibrated Elo ratings.
- White, Black, or random side; click-to-move, desktop drag-and-drop, keyboard-operable squares, board flipping, legal-move hints, optional move sounds.
- Legal moves and game outcomes handled by chess.js: castling, en passant, four promotion choices, checkmate, stalemate, and insufficient material.
- Threefold repetition and the fifty-move rule automatically end the game. This is a solo-practice convenience instead of the claim procedure used in formal play. No clock is used.
- Every move autosaves locally. My games resumes earlier games, including unfinished ones. These saves belong to this browser and URL; clearing browser data removes them. (TODO: Add actual backend if company pays me more $$$$$$)
- PGN download includes move history, player names, date, and result. PNG downloads a 1000 × 1110 image of the currently viewed position. FEN copy supports other chess software. (TODO: Determine if saving PGN files in local storage is a terrible idea)
- Move-history review, Stockfish hints, full-turn takebacks, resignation, and recovery if the engine fails to load.
- Responsive desktop and mobile layouts.

## Validation

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Unit tests cover illegal moves, castling, en passant, promotions, draw/checkmate detection, takebacks, resignation, persistence, and PGN round trips. Browser tests run the actual Stockfish WASM worker and exercise all six difficulties, both player colors, autosave/reload, history review, hints, exports, cancellation, promotion, and mobile layout. Screenshots are written to `test-results`.

For a production build, `npm run build` then `npm run preview`. The built `dist` directory can be served by a static HTTP server with JavaScript and WebAssembly MIME support.

## Structure

- `src/main.js`: board, dialogs, interaction, exports, and saved-game UI.
- `src/session.js`: game sessions, outcomes, PGN, persistence, and difficulty presets.
- `src/engine.js`: Stockfish UCI worker lifecycle and cancellable searches.
- `src/style.css`: responsive visual design.
- `public/pieces`: Cburnett chess pieces.
- `scripts/copy-engine.mjs`: local engine-asset setup.
- `tests`: rules/session tests and browser integration tests.

This is an independent local project, not affiliated with Chess.com. See `public/THIRD_PARTY_NOTICES.txt` for engine, rules library, and artwork credits and source links.
