using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace StardewThor.Bridge;
public record EventHeart(string Npc, int Points, string Kind);
public record EventWhen(string Key, string Value);
public record EventConditions(string Raw, int? StartTime, int? EndTime, int FreeSlots, string[] RequiredItems,
    string[] NpcsPresent, EventHeart[] Hearts, EventWhen[][] When);
public record EventEntry(string Id, string Name, string Location, string? Mod, string? Source, bool Seen,
    bool Disabled, EventConditions Conditions, EventDialogue[]? Dialogue=null, EventTrigger? Trigger=null);
public record EventCheckedAt(int Day,string Season,int Year,int Time,string Location);
public record EventConditionResult(int Index,string Kind);
public record EventTrigger(string State,EventCheckedAt? CheckedAt,EventConditionResult[] Failed,
    EventConditionResult[] Chance,EventConditionResult[] Unknown,string? Gate,string[] Limited);
public record EventIndex(string State, long Version, string Language, int SourceTotal, EventEntry[] Entries, string[] Limited, Dictionary<string,string>? LocationNames=null);
public record EventPage(string State, long Version, string Language, int Page, int Pages, int Total, int SourceTotal,
    EventEntry[] Entries, string[] Limited, string[]? Digests=null, EventVerdict[]? Verdicts=null, Dictionary<string,string>? LocationNames=null);
// One event's trigger verdict, all of them on page 0 (see EventDirectory.Read). Brief: no judgement
// time, and empty lists and a null gate left out (the reader puts the defaults back). 1281 PC events
// came to 263 KB in full and 178 KB brief, so they now fit page 0 instead of falling back inline.
public record EventVerdict(string Id, EventVerdictTrigger Trigger);
public record EventVerdictTrigger(string State,
    [property:System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] EventConditionResult[]? Failed,
    [property:System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] EventConditionResult[]? Chance,
    [property:System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] EventConditionResult[]? Unknown,
    [property:System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Gate,
    [property:System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string[]? Limited){
    public static EventVerdictTrigger Of(EventTrigger t)=>new(t.State,t.Failed.Length>0?t.Failed:null,t.Chance.Length>0?t.Chance:null,t.Unknown.Length>0?t.Unknown:null,t.Gate,t.Limited.Length>0?t.Limited:null);}

public sealed class EventDirectory {
    public const int PageSize=50, MaxEntries=4096, MaxPage=(MaxEntries-1)/PageSize, PageBudget=384*1024, EntryBudget=6144;
    public const int MaxCachedPages=8;
    private EventIndex current=new("building",1,"",0,Array.Empty<EventEntry>(),Array.Empty<string>());
    private EventIndex? cached;
    private readonly Dictionary<int,string> bodies=new();
    private readonly LinkedList<int> recent=new();
    private long requested;
    public bool Wanted => Interlocked.Read(ref requested) is var at && at!=0 && BridgeServer.Age(at)<5000;
    public void Publish(EventIndex value){Volatile.Write(ref current,value);}
    // Revision moves only when the content does (ContentRevision; judgement times excluded).
    private readonly ContentRevision content=new();public long Revision{get{var v=Volatile.Read(ref current);return content.Of(v,v.State);}}
    public void Touch()=>Interlocked.Exchange(ref requested,Stopwatch.GetTimestamp());
    public static bool TryPage(string path,out int page) {
        page=0;if(path=="/v1/events")return true;
        const string prefix="/v1/events?page=";
        if(!path.StartsWith(prefix,StringComparison.Ordinal))return false;
        string value=path[prefix.Length..];
        return value.Length is >0 and <=2&&(value.Length==1||value[0]!='0')&&value.All(c=>c is >= '0' and <= '9')&&int.TryParse(value,out page)&&page<=MaxPage;
    }
    // Trigger verdicts change with the clock and with villagers moving, across every page; the rows
    // themselves almost never do. So the verdicts of all events travel on page 0 (brief, without the
    // judgement time; up to the page budget less 96 KB for its own rows) and the other pages carry the rows alone: a re-judgement changes page 0 only, and a reader
    // with the previous version keeps every other page by its digest. When the verdicts would not fit
    // page 0 they stay inline in the rows, as before.
    private bool split;
    private static EventEntry Bare(EventEntry e)=>e.Trigger==null?e:e with{Trigger=null};
    private static EventVerdict[] Verdicts(EventIndex data)=>data.Entries.Where(e=>e.Trigger!=null).Select(e=>new EventVerdict(e.Id,EventVerdictTrigger.Of(e.Trigger!))).ToArray();
    private string[] Digests(EventIndex data,int pages)=>Enumerable.Range(0,pages).Select(p=>Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(data.Entries.Skip(p*PageSize).Take(PageSize).Select(e=>split?Bare(e):e.Trigger==null?e:e with{Trigger=e.Trigger with{CheckedAt=null}}).ToArray(),BridgeServer.Json)))[..16]).ToArray();
    public string Read(int page) {
        if(page<0||page>MaxPage)throw new ArgumentOutOfRangeException(nameof(page));
        Interlocked.Exchange(ref requested,Stopwatch.GetTimestamp());var data=Volatile.Read(ref current);
        if(!ReferenceEquals(data,cached)){bodies.Clear();recent.Clear();cached=data;split=data.State=="ready"&&Encoding.UTF8.GetByteCount(JsonSerializer.Serialize(Verdicts(data),BridgeServer.Json))<=PageBudget-96*1024;}
        if(bodies.TryGetValue(page,out var body)){recent.Remove(page);recent.AddLast(page);return body;}
        int pages=(data.Entries.Length+PageSize-1)/PageSize;
        string state=data.State=="ready"&&page>=Math.Max(1,pages)?"out-of-range":data.State;
        var entries=state=="ready"?data.Entries.Skip(page*PageSize).Take(PageSize).Select(e=>split?Bare(e):e).ToArray():Array.Empty<EventEntry>();
        // Page 0 carries a short digest of every page, so a reader that has the previous version keeps the
        // pages whose rows did not change (a re-judged trigger usually touches one or two of 26 pages).
        var result=new EventPage(state,data.Version,data.Language,page,pages,data.Entries.Length,data.SourceTotal,entries,data.Limited,page==0&&state=="ready"?Digests(data,pages):null,page==0&&state=="ready"&&split?Verdicts(data):null,page==0&&state=="ready"?data.LocationNames:null);
        body=JsonSerializer.Serialize(result,BridgeServer.Json);
        if(Encoding.UTF8.GetByteCount(body)>PageBudget)body=JsonSerializer.Serialize(result with{State="unsupported",Entries=Array.Empty<EventEntry>(),Limited=new[]{"response-bytes"}},BridgeServer.Json);
        if(bodies.Count>=MaxCachedPages){bodies.Remove(recent.First!.Value);recent.RemoveFirst();}
        bodies[page]=body;recent.AddLast(page);return body;
    }
}
