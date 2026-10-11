namespace StardewThor.Bridge;

public record ManagedMod(string Id, string Name, string Version, string Author, string Description,
    string? ContentPackFor, bool? HasConfigMenu, string[] Integrated);
public record ModManagement(string State, long Version, string Language, int Total, ManagedMod[] Mods,
    string Gmcm, string[] Limited);

public static class ModManagementRules {
    public const int MaxMods = 256, MaxId = 160, MaxText = 240, MaxDescription = 1000;
    public static bool ValidId(string? id) => id is { Length: > 0 and <= MaxId } && !id.StartsWith('.') && !id.EndsWith('.') && !id.Contains("..")
        && id.All(c => c is (>= 'a' and <= 'z') or (>= 'A' and <= 'Z') or (>= '0' and <= '9') or '_' or '-' or '.');
    // Only explicitly implemented adapters. Availability/version support is reported by each
    // adapter's own state; content additions alone do not imply a dedicated integration.
    public static string[] Integrated(string id) => id.ToLowerInvariant() switch {
        "spacechase0.genericmodconfigmenu" => new[] { "config-menu" },
        "mahsouto.mheventslist" => new[] { "events" },
        "spacechase0.spacecore" => new[] { "skills" },
        "ivy.ornithologistsguild" or "nature.natureinthevalley" or "cherry.stardewaquarium" => new[] { "collections" },
        "hawkfalcon.betterjunimos" => new[] { "junimos" },
        "mushymato.havemorekids" => new[] { "family" },
        "omegasis.happybirthday" => new[] { "player-birthday" },
        "spacebaby.partofthecommunity" => new[] { "relations" },
        "chankamman.stardewds" => new[] { "bridge" },
        _ => Array.Empty<string>()
    };
}
