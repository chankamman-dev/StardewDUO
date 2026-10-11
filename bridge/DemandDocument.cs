using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace StardewThor.Bridge;

// HTTP only requests work and reads a published immutable value. Game objects never enter here.
public sealed class DemandDocument {
    private sealed record Published(object Value);
    private Published current;
    private Published? serialized;
    private string body = "";
    private long requested;
    public int Budget { get; }
    public DemandDocument(object initial, int budget = 384 * 1024) { current = new(initial); Budget = budget; }
    public bool Wanted => Interlocked.Read(ref requested) is var at && at != 0 && BridgeServer.Age(at) < 5000;
    public void Publish(object value) {
        // Never a placeholder over good data: a "building" value in the same language does not replace a
        // "ready" one; the rebuild's result will (ContentRevision then decides whether that is news).
        var old=Volatile.Read(ref current).Value;
        if(Field(value,"State") as string=="building"&&Field(old,"State") as string=="ready"&&Equals(Field(old,"Language"),Field(value,"Language")))return;
        Volatile.Write(ref current, new Published(value)); }
    private static object? Field(object value,string name)=>value.GetType().GetProperty(name)?.GetValue(value);
    // A stream tells the page about a new Revision, which moves only when the content does
    // (ContentRevision); an open stream that wants this document renews the demand lease with Touch().
    private readonly ContentRevision content=new();public long Revision{get{var v=Volatile.Read(ref current).Value;return content.Of(v,Field(v,"State") as string);}}
    public void Touch()=>Interlocked.Exchange(ref requested,Stopwatch.GetTimestamp());
    public string Read() {
        Interlocked.Exchange(ref requested, Stopwatch.GetTimestamp());
        var value = Volatile.Read(ref current);
        if (ReferenceEquals(value, serialized)) return body;
        var json = JsonSerializer.Serialize(value.Value, BridgeServer.Json);
        if (Encoding.UTF8.GetByteCount(json) > Budget)
            json = "{\"state\":\"unsupported\",\"limited\":[\"response-bytes\"]}";
        body = json; serialized = value; return json;
    }
}
