using System.Text.Json;

namespace StardewThor.Bridge;

public record ModConfigChoice(string Value, string Label);
public record ModConfigOption(string Key, string Page, string Name, string Tooltip, string Kind,
    object? Value, bool Editable, string? Reason, double? Min = null, double? Max = null,
    double? Step = null, ModConfigChoice[]? Choices = null);
public record ModConfigDocument(string State, string ModId, string Session, string Language,
    string Token, ModConfigOption[] Options, string[] Limited);
public record ModConfigChange(string Key, JsonElement Value);

// A single on-demand editor. Listener threads request an ID, never run a mod callback.
public sealed class ModConfigMailbox {
    private sealed record Request(string Id, long At);
    private Request? request;
    private ModConfigDocument? current;
    public string? WantedId { get { var r = Volatile.Read(ref request); return r != null && BridgeServer.Age(r.At) < 5000 ? r.Id : null; } }
    public void Clear() { Volatile.Write(ref request, null); Volatile.Write(ref current, null); }
    public void Publish(ModConfigDocument document) => Volatile.Write(ref current, document);
    public string Read(string id) {
        Volatile.Write(ref request, new(id, System.Diagnostics.Stopwatch.GetTimestamp()));
        var d = Volatile.Read(ref current);
        return JsonSerializer.Serialize(d?.ModId == id ? d : new("building", id, "", "", "", Array.Empty<ModConfigOption>(), Array.Empty<string>()), BridgeServer.Json);
    }
    public static bool TryRoute(string path, out string id) {
        const string prefix = "/v1/mod-config/"; id = path.StartsWith(prefix, StringComparison.Ordinal) ? path[prefix.Length..] : "";
        return ModManagementRules.ValidId(id);
    }
}
