# Install and pair

[中文](INSTALL.md)

StardewDS is a lower-screen companion for the AYN Thor: the game runs on the top screen, the App on the bottom one. **Everything is set up on the Thor itself; no PC is needed.** It takes about five minutes.

```text
                                     AYN Thor
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ ① Install the App  →  ② the App installs the companion mod                      │
 │ → ③ open the game on the top screen, stay on the title screen                   │
 │ → ④ "From game" on the lower screen  →  ⑤ load a save, confirm pairing (optional) │
 └──────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> This is a test build. **Back up your saves** first. The verified combination is game 1.6.15 with SMAPI 4.5.2; others are unconfirmed.
> This page needs App 0.11.1-dev.77 or later (bundled mod 0.10.1-dev.59). For older versions, follow the [appendix](#appendix-make-the-asset-pack-on-a-pc-or-install-the-mod-by-hand).

## 0. What you need

| What | Notes |
| --- | --- |
| *Stardew Valley* for PC | Running on the Thor through Cinderbox with SMAPI, able to reach the title screen. The Android mobile edition is not supported |
| `StardewDS-<version>.apk` | The only file you need: the companion mod is built into the App |

Why the assets are made on the device: the App ships none of the game's art, sound or text. Your own game on the Thor generates them; they stay on that device and are never uploaded.

## ① Install the App

Install `StardewDS-<version>.apk` on the Thor and open it on the **lower screen**. The first run shows a setup page with three steps; follow them in order.

## ② Install the companion mod

1. Save and **quit the game completely**. The App will not write while the game is running; it says "Close the game first".
2. On the setup page, tap **Install** next to step 1, "Install the companion mod".
3. The system folder picker opens, usually already in `StardewValley`. Check that you are in `Internal storage › StardewValley`, tap **Use this folder**, then **Allow**.
   - Picking `desktop` or `Mods` inside it also works; the App finds the Mods folder either way.
4. The App writes the mod into `StardewValley/desktop/Mods/StardewThor.ReadOnly/` and checks every file.

**Done when:** step 1 reads "Installed 0.10.1-dev.59".

The App writes only its own three files (`manifest.json`, `StardewThor.ReadOnly.dll`, `StardewThor.Bridge.dll`). It does not touch other mods, nor this mod's `config.json`, `control-key.json` or data. The folder is granted once; later updates don't ask again, and you can revoke the grant in system settings at any time.

Don't install another dual-screen bridge mod that uses port 23871.

## ③ Open the game and stay on the title screen

Start the game on the top screen with Cinderbox (SMAPI) and **stay on the title screen; don't load a save yet**. On its first load the mod creates `config.json` and the pairing key `control-key.json`.

## ④ Import the assets from the game

1. On the lower screen, tap **From game**.
2. The status reads "The game is making the assets… N%": the game builds the asset pack at the title screen, which may pause the top screen for a second or two.
3. The App then downloads it, checks every file and opens the main screen.

**Done when:** you see the main screen with its side tabs. To make the assets again later, use **Settings → Local files → Game assets → From game**.

If the import fails, the reason is shown and your current assets stay as they are:

| Message | What to do |
| --- | --- |
| Game not reachable | The game isn't running, or the mod didn't load. Open the game and check the SMAPI log for `StardewDS Bridge` |
| Companion mod too old | The mod is older than 0.10.1-dev.59; do step ② first |
| Back to the title screen | Assets can only be made at the title screen. Go back to it and tap again |
| The game could not make them | Look for the `Asset pack failed` line in the SMAPI log and include it in your report |

> [!CAUTION]
> The assets are the game's original content, for your own device only. **Don't upload or share them.**

## ⑤ Load a save and pair (optional)

Without pairing you can still see everything. To **sort the inventory, craft, claim rewards and move stacks between chests** from the lower screen, pair once:

1. In the App, open **Settings → Local files → Control pairing** and tap **Pair**.
2. The row reads "Load a save; the game will ask". Load your save on the top screen.
3. As soon as your farmer is free to move, the top screen shows a confirmation, "The StardewDS lower screen asks to pair". Tap the green **✓**.
4. When the lower screen reads "Paired", you're done.

Tapping the red **✗**, closing the box or not answering within 90 seconds hands nothing over; you can tap **Pair** again at any time.

<details>
<summary>The other way: import the key from a file</summary>

In the same row tap **From file**, go to `Internal storage › StardewValley › desktop › Mods › StardewThor.ReadOnly` and pick `control-key.json`. If the picker doesn't show that folder, copy the file to Download with a file manager, pick it there, and **delete that copy** afterwards.

</details>

> [!WARNING]
> `control-key.json` is the key to controlling your game. Keep it out of bug reports, screenshots and public repositories.

## Using it

With a save loaded, the inventory page on the lower screen shows the live date, time and items.

The App and the game talk over a local port on the same Thor: **no Wi-Fi, account or server is involved**. Only the wiki reader goes online.

## Updating

| What | How |
| --- | --- |
| App | Install the new APK over the old one and **don't clear the App's data**: assets, favourites, pairing and the folder grant are kept. Updates must carry the same release signature |
| Mod | Each App carries its matching mod. Quit the game, then tap **Update** in **Settings → Local files → Companion mod** (the row says "Old … installed; update it"). `config.json` and `control-key.json` are kept |
| Assets | After big changes to the game or its mods, use **From game** again at the title screen |

Update the App and the mod together, or the App will say the mod is too old. The App never replaces a newer mod with an older one.

Upgrading from the old beta.1 (App ID `io.github.thordev.stardewcompanion.beta`): the new App (`io.github.chankamman_dev.stardewds`, development builds end in `.dev`) installs as a separate app, so import the assets and pair again. Uninstall the old one once the new one works.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Installing the mod says "Close the game first" | Quit the game completely (including Cinderbox) and tap again |
| "No Mods folder; pick StardewValley" | The wrong folder was picked. Tap again and pick `Internal storage › StardewValley` |
| "A newer mod is installed; left as is" | The installed mod is newer than the one in the App, and the App won't downgrade it. Update the App to the matching version |
| The picker won't let you choose a folder | Android doesn't allow granting the storage root or Download; pick `StardewValley` |
| The lower screen says it isn't connected | The game is running; the SMAPI log shows the bridge mod loaded; no other mod uses port 23871. Settings shows the mod version and the last sync time |
| The lower screen waits for a save | Normal: the game is still at the title screen; load a save |
| You can look but not move items | Pair (step ⑤). Some actions are limited in multiplayer, during cutscenes and while the cursor holds an item |
| A page asks you to update the companion mod | The mod is older than the App: tap **Update** in **Settings → Local files → Companion mod** |
| Farm and context pages briefly show "loading" | Normal: that data is read when the page opens |

Test status: the no-PC flow (the App installing the mod, assets made in the game, pairing confirmed on the top screen) has been checked step by step in an isolated PC test game and automated tests; acceptance on a Thor is under way. The first install of the old beta.1 is recorded [here (Chinese)](THOR-BETA1-20260927.md); what has been verified in real play and for writes is in [Release status](RELEASE.md). Use a backed-up save at first.

## Appendix: make the asset pack on a PC, or install the mod by hand

For Apps older than 0.11.1-dev.77, or if making the assets in the game keeps failing. Newer Apps can still pick a pack made on a PC with **From file**, on the setup page or in Settings.

<details>
<summary>Make the asset pack on a Windows PC</summary>

You need: a PC installation of the same game (with SMAPI), [Node.js](https://nodejs.org/) 24, PowerShell 7, this repository's source (**Code → Download ZIP** on GitHub, then unzip) and `StardewDS-AssetExporter-<version>.zip` from the release. Run these in PowerShell, with your own paths.

1. Install the dependencies in the source folder:

   ```powershell
   cd D:\StardewDUO
   npm ci
   ```

2. Unzip `StardewDS-AssetExporter-<version>.zip` to `D:\ExportMods\AssetExporter\` (it should contain `manifest.json` and `AssetExporter.dll`). Keep only this tool in that folder. To build it yourself, set `STARDEW_GAME_PATH` and `STARDEW_SMAPI_PATH`, then run `dotnet build tools/AssetExporter -c Release` (.NET SDK 8).
3. Start the game with only that folder, stay on the title screen, and quit once the SMAPI window shows `Owned-game content exported`:

   ```powershell
   & 'D:\Games\Stardew Valley\StardewModdingAPI.exe' --mods-path 'D:\ExportMods'
   ```

4. Pack it (the third argument must be a folder that doesn't exist yet):

   ```powershell
   node tools/extract-local-assets.cjs 'D:\Games\Stardew Valley' 'D:\ExportMods\AssetExporter\export' 'D:\ThorAssetsWork'
   ```

5. Copy `D:\ThorAssetsWork\StardewDS-private-assets.zip` to the Thor's Download folder and pick it in the App with **From file**.

</details>

<details>
<summary>Install the mod by hand</summary>

1. Quit the game completely.
2. Unzip `StardewDS-Mod-<version>.zip` from the release and put the `StardewThor.ReadOnly` folder in `Internal storage/StardewValley/desktop/Mods/`. Keep the folder name `StardewThor.ReadOnly`.
3. To upgrade, replace only `manifest.json`, `StardewThor.ReadOnly.dll` and `StardewThor.Bridge.dll`, keeping `config.json` and `control-key.json`. To roll back, restore your backup of those three files.

</details>
