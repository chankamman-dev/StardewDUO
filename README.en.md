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

The lower screen has eight tabs, top to bottom:

**🎒 Inventory**
- The game's 6 × 2 pages, expandable to every slot; held slot, quality stars, stacks and watering-can water just as in game.
- Item description, category, sell price, and stats for weapons, food and equipment.
- Drag to swap, split and merge stacks, sort, drop or trash a chosen amount. Every action is confirmed by the game's own receipt; nothing is faked from a tap.
- Jump to the item in the guide.

**🗺️ Map**
- World map and a local map of where you are; drag, zoom, follow the player.
- Every villager's live position as a pixel head, grouped when they overlap.

**❤️ Villagers**
- List or portrait grid; search, filter by region, sort and pin.
- Hearts, birthdays, whether you've talked today, gifts this week.
- Profiles: where they are now, today's schedule, family and friends, gift tastes and their story events.

**❗ Quests & calendar**
- Active quests and special orders; take today's notice-board request from the lower screen, claim rewards, keep a completed history.
- The season's calendar: birthdays, festivals, the bookseller and more.
- Story events, filtered by villager and place, with their trigger conditions and whether you've seen them.

**🌱 Farm**
- Today's chores: unwatered crops, ready crops and machines, animals.
- Tomorrow and news: weather, luck, the traveling cart, birthdays, family.
- Harvest calendar: when what you've planted will be ready.
- Crop profit planner: compare what's worth planting by season and days left.

**📘 Guide**
- Item catalogue: search, categories, favourites and recently viewed.
- Crafting: known recipes with material and space checks, craft 1–99 times or the most you can (cooking is read-only).
- Character: equipment, vanilla and mod skills with XP.
- Collections, Community Center bundles (Joja route too) and a built-in Wiki reader.

**🔍 Context**: follows the game on its own (each kind can be switched off)
- What you're facing: villagers, crops, machines, animals, placed objects.
- An open chest: move whole stacks from the lower screen.
- Shops, fishing, mine floors.
- At night the day's shipment; in the morning a briefing with weather, luck, birthdays and chores.
- Dialogue (**dev builds**): what a villager is saying in the English original; tap a word for its meaning, save it, have it read aloud. A way to learn English as you play.
- Fishing log (**dev builds**): an old angler's notebook with the fish worth catching here, what's on the line and what you caught.

**🎮 Settings**
- 中文 / English, text size, sounds, dim when idle (**dev builds**), hide the game's toolbar.
- Hide what you haven't discovered: unmet villagers, unknown items and gift tastes, locked map areas, unseen story events and uncollected collection entries, each on its own.
- Mod manager: the loaded mods with notes; mods with GMCM settings can be configured from the lower screen.
- Pairing, asset import and connection diagnostics.

**Mod support**: items, villagers, skills and farm content added by mods are read at run time, limited to versions that were checked; when something can't be read, it says so.

**Notebook style** (**dev builds**): a leather cover, stacked pages and fabric tabs, with a page turn when you switch tabs; Settings can switch back to the original game-menu look.

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
