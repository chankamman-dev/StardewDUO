using System.Collections;
using System.Reflection;
using StardewModdingAPI;

namespace StardewThor.ReadOnly;

public interface IGmcmOpenApi { void OpenModMenu(IManifest mod); }

// Exact 1.16.0 layout, verified against the installed assembly. No config-file inference.
internal sealed class GmcmAdapter {
    internal const string Id = "spacechase0.GenericModConfigMenu";
    private readonly IModRegistry registry;
    private readonly int owner = Environment.CurrentManagedThreadId;
    internal GmcmAdapter(IModRegistry registry) { this.registry = registry; }
    private void GameThread() { if (owner != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Game thread required"); }
    internal (string State, IDictionary? Configs) Read() {
        GameThread();
        try {
            var gmcm = registry.Get(Id);
            if (gmcm == null) return ("absent", null);
            if (gmcm.Manifest.Version.ToString() != "1.16.0") return ("unsupported", null);
            var type = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "GenericModConfigMenu")?.GetType("GenericModConfigMenu.Mod");
            const BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static;
            var instance = type?.GetField("instance", all)?.GetValue(null);
            var manager = type?.GetField("ConfigManager", all)?.GetValue(instance);
            var configs = manager?.GetType().GetField("Configs", all)?.GetValue(manager) as IDictionary;
            return configs == null ? ("unsupported", null) : ("ready", configs);
        } catch { return ("unsupported", null); }
    }
    internal bool? HasMenu(string id) { var (state, configs) = Read(); return state == "ready" ? configs!.Contains(id) : null; }
    internal void Open(string id) {
        GameThread();
        var (state, configs) = Read();
        if (state != "ready") throw new CommandRejected("gmcm-" + state);
        var target = registry.Get(id);
        if (target == null) throw new CommandRejected("mod-absent");
        if (!configs!.Contains(target.Manifest.UniqueID)) throw new CommandRejected("config-unregistered");
        var api = registry.GetApi<IGmcmOpenApi>(Id);
        if (api == null) throw new CommandRejected("gmcm-unsupported");
        api.OpenModMenu(target.Manifest);
    }
}
