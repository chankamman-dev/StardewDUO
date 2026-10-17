<h1 align="center">StardewDUO — Stardew Valley on two screens</h1>

<p align="center"><a href="README.md">中文</a> · <b>English</b></p>

<p align="center">
  An unofficial lower-screen companion for <i>Stardew Valley</i> on the AYN Thor: <b>keep playing on the top screen, glance down</b> for your inventory, map, villagers, quests and calendar, farm, guide and what's in front of you.
</p>

<p align="center">
  <img src="docs/images/thor-map.webp" width="460" alt="AYN Thor: the game on the top screen, the StardewDS map on the lower screen with every villager's live position">
</p>

<p align="center">
  <a href="docs/public/INSTALL.md">Install &amp; pair</a> · <a href="docs/public/BUILD.md">Build</a> · <a href="docs/public/RELEASE.md">Release status</a> · <a href="PRIVACY.md">Privacy</a> · <a href="CONTRIBUTING.md">Contributing</a> · <a href="THIRD_PARTY_NOTICES.md">Third-party notices</a>
</p>

## A look around

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/images/inventory.webp" alt="Inventory: the held item, its stats and actions"><br><b>Inventory</b><br><sub>The game's layout, stats, sell price, sorting</sub></td>
    <td align="center" width="33%"><img src="docs/images/villagers.webp" alt="Villagers: birthdays, hearts, today's talk and gifts"><br><b>Villagers</b><br><sub>Hearts, birthdays, talked and gifted today</sub></td>
    <td align="center" width="33%"><img src="docs/images/morning-briefing.webp" alt="Morning briefing: weather, luck, birthday reminder"><br><b>Morning briefing</b><br><sub>Tomorrow's weather, today's luck, birthdays, chores</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/images/dialogue.webp" alt="Dialogue: what a villager says, in the English original, with a word looked up"><br><b>Dialogue</b><br><sub>The English original, tap a word to look it up, read aloud</sub></td>
    <td align="center"><img src="docs/images/calendar.webp" alt="Quests and calendar: the season's birthdays and festivals"><br><b>Quests &amp; calendar</b><br><sub>Birthdays, festivals, notice board, quests</sub></td>
    <td align="center"><img src="docs/images/villager-profile.webp" alt="Villager profile: where they are now, today's schedule, family and friends"><br><b>Villager profile</b><br><sub>Where they are, today's schedule, family and friends</sub></td>
  </tr>
</table>

<sub>Screenshots are from development versions (App 0.11.1-dev.62 to dev.74; the top row in the new notebook style, the bottom row in the original game-menu style). The notebook style and the dialogue page are not in the current public source (App 0.11.1-dev.55) yet. Game imagery in the screenshots is © ConcernedApe.</sub>

## What it does

- **Inventory**: the game's layout, quality and stats, stack stepping, sorting, and item actions confirmed by the game's own receipt.
- **Map & villagers**: world and local maps, villager positions, gift and talk status, profiles, schedules and gift tastes.
- **Quests & farm**: take notice-board requests, claim rewards, completed history, birthdays and festivals, to-dos, a harvest calendar and a crop profit calculator.
- **Guide & character**: item collection, crafting, equipment, vanilla and mod skills, collections, story events, Community Center bundles and a Wiki reader.
- **Mod support**: runtime item and villager catalogues, hide what you haven't discovered yet, families and relationships, farm extras, plus a mod list and a way to open GMCM settings on the top screen. Each adapter is tied to the versions it was checked against and says so when it can't read something.
- **Context**: what you're facing, moving whole stacks between chests, shops, fishing, mine floors, the end-of-day summary and a morning briefing; switching to it automatically can be set per kind.

## What you need

- Your own PC copy of *Stardew Valley*, running on the Thor through Cinderbox with SMAPI. The Android mobile edition is not a target.
- The lower-screen App and its companion SMAPI mod; see [Install &amp; pair](docs/public/INSTALL.md).
- Public APKs ship none of the game's art, sound or offline text: you build a private asset ZIP from your own game and import it.
- Browsing works unpaired; inventory, crafting, reward and chest actions need pairing with a key on your machine. Writing in multiplayer is not supported. There are no endpoints for saving, loading or running arbitrary scripts.

This project is not affiliated with ConcernedApe, Nintendo or AYN.

## Status

The source here is App 0.11.1-dev.55 and mod 0.10.1-dev.42, not yet released as a set. An earlier beta.1 test build was installed on one AYN Thor and checked through asset import, pairing and a short session ([notes, Chinese](docs/public/THOR-BETA1-20260927.md)); that does not stand for the current source on a device. Play sessions over 60 minutes and writes on a real save are not yet verified. What host simulation, protocol checks and isolated PC game tests cover is in [Release status](docs/public/RELEASE.md).

App ID `io.github.chankamman_dev.stardewds` (development builds `….dev`); mod ID `chankamman.StardewDS`. Upgrading from beta.1 installs the new App as a separate app, so assets must be imported and pairing redone; the mod folder is still `StardewThor.ReadOnly`, so replacing its three files keeps the pairing key and completed-quest history.

## Development

Node.js 24, .NET SDK 8, JDK 17, PowerShell 7; Android builds need SDK 35.

~~~powershell
npm ci
npm run test:public
~~~

These tests are self-contained and need no game assets. Parameters for game-dependent builds and asset generation are in the [build](docs/public/BUILD.md) and [install](docs/public/INSTALL.md) docs (Chinese). The source is MIT; Fusion Pixel Font stays under OFL 1.1. The game and its assets are not covered by the MIT license.

The internal repository keeps the development history; this public source is exported from it by an allowlist into a clean directory, never by pushing the internal history. See [GitHub upload](docs/public/GITHUB.md).
