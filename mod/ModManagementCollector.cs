using System.Diagnostics;
using System.Text;
using System.Text.Json;
using StardewModdingAPI;
using StardewThor.Bridge;

namespace StardewThor.ReadOnly;

internal sealed class ModManagementCollector {
    private readonly IModRegistry registry;
    private readonly GmcmAdapter gmcm;
    private readonly ModPreviewStore? previews;
    internal DemandDocument Document { get; }
    private IEnumerator<IModInfo>? cursor;
    private readonly List<ManagedMod> entries = new();
    private readonly HashSet<string> limited = new();
    private string language = "", last = "", gmcmState = "unsupported";
    private long version = 1, refreshed;
    private int total, bytes;
    private System.Collections.IDictionary? configs;
    private System.Security.Cryptography.IncrementalHash? hash;
    private readonly int owner = Environment.CurrentManagedThreadId;
    internal ModManagementCollector(IModRegistry registry, ModPreviewStore? previews = null) {
        this.previews=previews;
        this.registry = registry; gmcm = new(registry);
        Document = new(new ModManagement("building", version, language, 0, Array.Empty<ManagedMod>(), "unsupported", Array.Empty<string>()));
    }
    internal void Invalidate(string lang) {
        if (owner != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Game thread required");
        cursor?.Dispose(); cursor = null; hash?.Dispose(); hash=null; language = lang; refreshed = 0; last = ""; version++;
        Document.Publish(new ModManagement("building", version, language, 0, Array.Empty<ManagedMod>(), "unsupported", Array.Empty<string>()));
    }
    internal void Tick(string lang) {
        if (owner != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Game thread required");
        if (lang != language) Invalidate(lang);
        if (!Document.Wanted) return;
        if (cursor == null && refreshed != 0 && BridgeServer.Age(refreshed) < 30000) return;
        try {
            if (cursor == null) {
                cursor = registry.GetAll().GetEnumerator(); entries.Clear(); limited.Clear(); total = bytes = 0;
                (gmcmState, configs) = gmcm.Read();
                hash=System.Security.Cryptography.IncrementalHash.CreateHash(System.Security.Cryptography.HashAlgorithmName.SHA256);
            }
            var started = Stopwatch.GetTimestamp(); int count = 0;
            while (count++ < 8 && BridgeServer.Age(started) < 1.5) {
                if (!cursor.MoveNext()) { Finish(); return; }
                var m = cursor.Current.Manifest; total++;
                if (total > 4096) { limited.Add("registry-scan-limit"); Finish(); return; }
                if (entries.Count >= ModManagementRules.MaxMods) { limited.Add("mods-limit"); continue; }
                if (!ModManagementRules.ValidId(m.UniqueID)) { limited.Add("invalid-mod-id"); continue; }
                if(previews!=null && cursor.Current.GetType().GetProperty("DirectoryPath")?.GetValue(cursor.Current) is string directory) previews.Register(m.UniqueID,directory);
                var entry = new ManagedMod(m.UniqueID, Text(m.Name,240), Text(m.Version.ToString(),80), Text(m.Author,240),
                    Text(m.Description,1000), m.ContentPackFor == null ? null : Text(m.ContentPackFor.UniqueID,160),
                    gmcmState=="ready" ? configs!.Contains(m.UniqueID) : null, ModManagementRules.Integrated(m.UniqueID));
                var jsonBytes=JsonSerializer.SerializeToUtf8Bytes(entry, BridgeServer.Json);
                int size = jsonBytes.Length + 1;
                if (bytes + size > Document.Budget - 4096) { limited.Add("response-bytes"); continue; }
                bytes += size; entries.Add(entry); hash!.AppendData(jsonBytes);
            }
        } catch { cursor?.Dispose(); cursor = null; hash?.Dispose(); hash=null; refreshed = Stopwatch.GetTimestamp();
            Document.Publish(new ModManagement("unsupported", ++version, language, 0, Array.Empty<ManagedMod>(), "unsupported", new[] { "registry-unavailable" })); }
    }
    private string Text(string? s, int max) { if (s == null) return ""; if (s.Length <= max) return s; limited.Add("text-limit"); return s[..max]; }
    private void Finish() {
        cursor?.Dispose(); cursor = null; refreshed = Stopwatch.GetTimestamp();
        var data = new ModManagement("ready", version, language, total, entries.ToArray(), gmcmState, limited.OrderBy(s=>s).ToArray());
        string fingerprint = Convert.ToHexString(hash!.GetHashAndReset())+total+gmcmState+language+string.Join(',',data.Limited);
        hash.Dispose(); hash=null;
        if (fingerprint == last) return;
        last = fingerprint; Document.Publish(data with { Version = ++version });
    }
    internal void Open(string id) => gmcm.Open(id);
}
