using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;

namespace StardewThor.ReadOnly;

internal static class ModSettingsCommand {
    internal static string Gate() {
        if (!Context.IsWorldReady) return "no-world";
        if (Context.IsMultiplayer) return "multiplayer";
        if (Game1.activeClickableMenu != null) return "close-menu";
        if (Game1.eventUp || Game1.CurrentEvent != null || Game1.currentLocation?.currentEvent != null || Game1.dialogueUp
            || Game1.player.UsingTool || Game1.player.isEating || !Game1.player.CanMove || NightScene.Active) return "game-busy";
        return "ready";
    }
    internal static void Execute(Command command, string session, long revision, ModManagementCollector collector) {
        if (command.Session != session) throw new CommandRejected("session-changed");
        var reason = Gate(); if (reason != "ready") throw new CommandRejected(reason);
        if (command.Revision != revision) throw new CommandRejected("inventory-changed");
        if (!ModManagementRules.ValidId(command.ModId)) throw new CommandRejected("invalid");
        collector.Open(command.ModId!);
    }
}
