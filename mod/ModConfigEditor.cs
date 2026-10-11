using System.Collections;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using StardewThor.Bridge;
using StardewModdingAPI;
using StardewValley;
using StardewValley.Menus;

namespace StardewThor.ReadOnly;

// Version-pinned standard GMCM options. Custom drawing/keybind widgets stay on the original menu.
// Reading calls only GMCM's registered getters; only an authenticated save calls setters/Save.
internal sealed class ModConfigEditor {
    private const BindingFlags Flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
    private sealed record Binding(object Option, ModConfigOption Data);
    private readonly GmcmAdapter adapter;
    private readonly int owner = Environment.CurrentManagedThreadId;
    internal ModConfigMailbox Mailbox { get; } = new();
    private string id = "", session = "", language = "", token = "";
    private long refreshed;
    private int bytes;
    private object? config;
    private IEnumerator<(string Page, object Option)>? cursor;
    private readonly List<ModConfigOption> options = new();
    private readonly Dictionary<string, Binding> bindings = new();
    private readonly HashSet<string> limited = new();
    internal ModConfigEditor(GmcmAdapter adapter) { this.adapter = adapter; }
    private void Thread() { if (owner != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Game thread required"); }
    internal void Invalidate() { Thread(); cursor?.Dispose(); cursor = null; config = null; token = ""; id = ""; bindings.Clear(); Mailbox.Clear(); }
    private static object? Get(object obj, string name) => obj.GetType().GetProperty(name, Flags)?.GetValue(obj);
    private static Delegate? Getter(object option) {
        for (var type = option.GetType(); type != null; type = type.BaseType)
            if (type.GetField("GetValue", Flags)?.GetValue(option) is Delegate getter) return getter;
        return null;
    }
    private static string Text(object obj, string name, int max = 240) {
        var value = Get(obj, name); var text = value is Func<string> f ? f() : value as string;
        return text is null ? "" : text[..Math.Min(max, text.Length)];
    }
    private static IEnumerable<(string Page, object Option)> Enumerate(object cfg) {
        if (Get(cfg, "Pages") is not IDictionary pages) yield break;
        int count = 0;
        foreach (DictionaryEntry entry in pages) {
            if (++count > 64) yield break;
            var p = entry.Value!; var name = Text(p, "PageTitle");
            if (Get(p, "Options") is not IEnumerable values) continue;
            foreach (var option in values) if (option != null) yield return (name, option);
        }
    }
    private object Resolve(string modId) {
        var (state, configs) = adapter.Read();
        if (state != "ready") throw new CommandRejected("gmcm-" + state);
        if (!configs!.Contains(modId)) throw new CommandRejected("config-unregistered");
        return configs[modId]!;
    }
    internal bool Wanted => Mailbox.WantedId != null;
    internal void Tick(string currentSession, string lang) {
        Thread(); var wanted = Mailbox.WantedId; if (wanted == null) { cursor?.Dispose(); cursor = null; return; }
        if (wanted != id || session != currentSession || language != lang) { cursor?.Dispose(); cursor = null; refreshed = 0; token = ""; }
        id = wanted; session = currentSession; language = lang;
        if (cursor == null && refreshed != 0 && BridgeServer.Age(refreshed) < 5000) return;
        try {
            if (cursor == null) { config = Resolve(id); token = ""; options.Clear(); bindings.Clear(); limited.Clear(); bytes = 0; Mailbox.Publish(new("building", id, session, language, "", Array.Empty<ModConfigOption>(), Array.Empty<string>())); cursor = Enumerate(config).GetEnumerator(); }
            var start = Stopwatch.GetTimestamp(); int processed = 0;
            while (processed++ < 4 && BridgeServer.Age(start) < 1.5) {
                if (options.Count == 128) { limited.Add("option-limit"); Finish(); return; }
                if (!cursor.MoveNext()) { Finish(); return; }
                var (page, option) = cursor.Current; var key = options.Count.ToString();
                ModConfigOption data;
                try { data = Project(option, key, page); }
                catch { data = new(key, page, "", "", "unsupported", null, false, "getter-failed"); limited.Add("getter-failed"); }
                bytes += JsonSerializer.SerializeToUtf8Bytes(data, BridgeServer.Json).Length;
                if (bytes > 192 * 1024) { limited.Add("response-bytes"); Finish(); return; }
                options.Add(data); if (data.Kind is "bool" or "int" or "float" or "text" or "choice") bindings[key] = new(option, data);
            }
        } catch (CommandRejected e) { Fail(e.Message); } catch { Fail("gmcm-unsupported"); }
    }
    private void Finish() {
        cursor?.Dispose(); cursor = null; refreshed = Stopwatch.GetTimestamp();
        var array = options.ToArray(); token = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { session, language, id, options = array }, BridgeServer.Json))).ToLowerInvariant();
        Mailbox.Publish(new("ready", id, session, language, token, array, limited.OrderBy(x => x).ToArray()));
    }
    private void Fail(string reason) { cursor?.Dispose(); cursor = null; refreshed = Stopwatch.GetTimestamp(); token = ""; bindings.Clear(); Mailbox.Publish(new("unsupported", id, session, language, "", Array.Empty<ModConfigOption>(), new[] { reason })); }
    private static ModConfigOption Project(object option, string key, string page) {
        var type = option.GetType(); var name = Text(option, "Name"); var tip = Text(option, "Tooltip", 1000);
        var definition = type.IsGenericType ? type.GetGenericTypeDefinition().FullName : type.FullName;
        bool title = Get(option, "IsTitleScreenOnly") is true;
        bool editable = !title || !Context.IsWorldReady;
        var reason = editable ? null : "title-only";
        if (definition is "GenericModConfigMenu.Framework.ModOption.SectionTitleModOption" or "GenericModConfigMenu.Framework.ModOption.SectionSubHeaderModOption" or "GenericModConfigMenu.Framework.ModOption.ParagraphModOption")
            return new(key, page, name, tip, "section", null, false, null);
        if (definition is not ("GenericModConfigMenu.Framework.ModOption.SimpleModOption`1" or "GenericModConfigMenu.Framework.ModOption.NumericModOption`1" or "GenericModConfigMenu.Framework.ModOption.ChoiceModOption`1"))
            return new(key, page, name, tip, "unsupported", null, false, "custom-widget");
        var valueType = Get(option, "Type") as Type;
        string kind = valueType == typeof(bool) ? "bool" : valueType == typeof(int) ? "int" : valueType == typeof(float) ? "float" : valueType == typeof(string) ? "text" : "unsupported";
        if (kind == "unsupported") return new(key, page, name, tip, kind, null, false, "keybind-widget");
        object? value = Getter(option)?.DynamicInvoke();
        if (value == null) return new(key, page, name, tip, "unsupported", null, false, "getter-empty");
        if (value is string text && text.Length > 512) return new(key, page, name, tip, "unsupported", null, false, "text-limit");
        if (value is float number && !float.IsFinite(number)) throw new InvalidOperationException();
        ModConfigChoice[]? choices = null;
        if (Get(option, "Choices") is string[] allowed) {
            if (allowed.Length > 64 || allowed.Any(c => c == null || c.Length > 512)) return new(key, page, name, tip, "unsupported", null, false, "choice-limit");
            var formatter = Get(option, "FormatChoice") as Func<string, string>;
            choices = allowed.Select(c => { var label = formatter?.Invoke(c) ?? c; return new ModConfigChoice(c, label[..Math.Min(240, label.Length)]); }).ToArray(); kind = "choice";
        }
        double? Number(string property) { var n = Get(option, property); return n == null ? null : Convert.ToDouble(n); }
        return new(key, page, name, tip, kind, value, editable, reason, Number("Minimum"), Number("Maximum"), Number("Interval"), choices);
    }
    internal static string Gate() {
        if (!Context.IsWorldReady) return Game1.activeClickableMenu is TitleMenu ? "ready" : "no-world";
        if (Context.IsMultiplayer) return "multiplayer";
        if (Game1.activeClickableMenu != null && Game1.activeClickableMenu is not GameMenu) return "close-menu";
        if (Game1.eventUp || Game1.CurrentEvent != null || Game1.currentLocation?.currentEvent != null || Game1.dialogueUp || Game1.player.UsingTool || Game1.player.isEating || !Game1.player.CanMove || NightScene.Active) return "game-busy";
        return "ready";
    }
    internal void Save(Command command, string currentSession) {
        Thread(); if (command.Session != currentSession || session != currentSession) throw new CommandRejected("session-changed");
        var gate = Gate(); if (gate != "ready") throw new CommandRejected(gate);
        if (cursor != null || command.ModId != id || command.ConfigToken != token || config == null || !ReferenceEquals(Resolve(id), config)) throw new CommandRejected("config-changed");
        var changes = new List<(Binding Binding, object? Value)>();
        var currentOptions = Enumerate(config).Take(128).Select(p => p.Option).ToArray();
        foreach (var change in command.ConfigChanges!) {
            if (!bindings.TryGetValue(change.Key, out var binding) || !binding.Data.Editable || Get(binding.Option, "IsTitleScreenOnly") is true && Context.IsWorldReady) throw new CommandRejected("config-readonly");
            if (!int.TryParse(change.Key, out int index) || index >= currentOptions.Length || !ReferenceEquals(currentOptions[index], binding.Option)) throw new CommandRejected("config-changed");
            var latest = Getter(binding.Option)!.DynamicInvoke();
            if (!Equals(latest, binding.Data.Value)) throw new CommandRejected("config-changed");
            var v = ConvertValue(change.Value, binding.Data); changes.Add((binding, v));
        }
        try {
            // Exactly the changed standard options: refresh GMCM's cache, dispatch its change
            // handlers, write via its setter, then the mod's registered Save callback once.
            foreach (var (binding, value) in changes) {
                binding.Option.GetType().GetMethod("BeforeMenuOpened", Flags)!.Invoke(binding.Option, null);
                binding.Option.GetType().GetProperty("Value", Flags)!.SetValue(binding.Option, value);
                binding.Option.GetType().GetMethod("BeforeSave", Flags)!.Invoke(binding.Option, null);
            }
            ((Action)Get(config, "Save")!)();
            foreach (var (binding, _) in changes) binding.Option.GetType().GetMethod("AfterSave", Flags)!.Invoke(binding.Option, null);
        } catch { throw new CommandRejected("config-save-failed"); }
        finally { refreshed = 0; token = ""; Mailbox.Publish(new("building", id, session, language, "", Array.Empty<ModConfigOption>(), Array.Empty<string>())); }
    }
    private static object? ConvertValue(JsonElement json, ModConfigOption data) {
        object? value;
        if (data.Kind == "bool" && json.ValueKind is JsonValueKind.True or JsonValueKind.False) value = json.GetBoolean();
        else if (data.Kind is "text" or "choice" && json.ValueKind == JsonValueKind.String) {
            value = json.GetString()!; if (((string)value).Length > 512 || data.Kind == "choice" && !data.Choices!.Any(c => c.Value == (string)value)) throw new CommandRejected("config-value");
        } else if (data.Kind is "int" or "float" && json.ValueKind == JsonValueKind.Number && json.TryGetDouble(out double n) && double.IsFinite(n)) {
            if (data.Min is double min && n < min || data.Max is double max && n > max || n < int.MinValue || n > int.MaxValue || data.Kind == "int" && n != Math.Truncate(n)) throw new CommandRejected("config-value");
            if (data.Step is double step && step > 0 && Math.Abs(n / step - Math.Round(n / step)) > 0.0001) throw new CommandRejected("config-value");
            value = data.Kind == "int" ? (object)(int)n : (float)n;
        } else throw new CommandRejected("config-value");
        return value;
    }
}
