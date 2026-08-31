# Card Clash

A two-player card battle game. Place characters on your board, attack with cards, and use passives and specials to win.

**Play online:** https://mobkert.github.io/card-clash/

## Local development

```bash
npm install
npm run dev
```

## Multiplayer (local network)

Multiplayer uses a WebSocket server on your machine — it is not included in the GitHub Pages build.

```bash
npm run server   # terminal 1
npm run dev      # terminal 2
```

One player hosts and shares the room code; the other joins.
