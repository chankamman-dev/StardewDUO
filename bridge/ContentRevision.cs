using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StardewThor.Bridge;

// The rule every document follows, enforced here rather than by each collector: a reader is told about
// a new revision only when what it would show changed. A publish that only moved a version counter or a
// timestamp (collectors stamp both on every pass) is not a change. Computed on the bridge thread the
// first time a new value is looked at, never on the game thread.
public sealed class ContentRevision {
    private static readonly Regex Stamps=new(@"""(version|collectedAt|checkedAt|completedAt|startedAt)"":(-?\d+|null|\{[^{}]*\}),?",RegexOptions.Compiled);
    private object? seen;private string hash="";private long revision;
    // state: the document's own state. While it stays "building", progress steps are not announced:
    // a reader without data polls a building document anyway, one with data keeps it until "ready".
    private string? lastState;
    public long Of(object? value,string? state=null){
        if(ReferenceEquals(value,System.Threading.Volatile.Read(ref seen)))return Interlocked.Read(ref revision);
        lock(this){
            if(ReferenceEquals(value,seen))return revision;
            if(state=="building"&&lastState=="building"){System.Threading.Volatile.Write(ref seen,value);return revision;}
            lastState=state;
            var json=Stamps.Replace(JsonSerializer.Serialize(value,BridgeServer.Json),"");
            var next=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
            if(next!=hash){hash=next;Interlocked.Increment(ref revision);}
            System.Threading.Volatile.Write(ref seen,value);return revision;
        }
    }
}
