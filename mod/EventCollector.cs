using System.Collections;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;

namespace StardewThor.ReadOnly;

internal sealed class EventCollector {
    internal const string Id="mahsouto.MHEventsList";
    internal EventDirectory Directory {get;}=new();
    private readonly IModRegistry registry;
    private readonly PerfStats? perf;
    private readonly int owner=Environment.CurrentManagedThreadId;
    private IList? source;
    private readonly List<EventEntry> entries=new();
    private readonly HashSet<string> limited=new(),ids=new(StringComparer.Ordinal);
    private IncrementalHash? hash;
    private int index,total,bytes;
    private long version=1,refreshed;
    private string language="",last="",publishedState="building";
    private ConditionalWeakTable<object,PreviewCache> previews=new();
    private sealed record PreviewCache(string? Script,EventDialogue[] Lines);
    private readonly List<EventTriggerReader.Plan> plans=new();
    private readonly CachedEventDefinitions definitions=new();
    private EventEntry[]? stable,pending;
    private int triggerIndex;
    private long triggerEpoch=1,computedEpoch,observedAt,startedEpoch;
    private string observed="";
    // What the last trigger publish said, minus CheckedAt. A pass runs every game ten minutes and on
    // every tile the player walks; republishing an identical verdict only makes clients refetch all pages.
    private string publishedVerdicts="";
    internal string WorkPhase=>stable==null?"metadata":definitions.Building?"definitions":"triggers";
    internal bool NeedsWork{get{CheckThread();if(!Directory.Wanted)return false;Observe();return source!=null||stable==null||pending!=null||computedEpoch!=triggerEpoch;}}
    internal EventCollector(IModRegistry registry,PerfStats? perf=null){this.registry=registry;this.perf=perf;}
    internal void Invalidate(string lang){CheckThread();source=null;stable=pending=null;plans.Clear();hash?.Dispose();hash=null;previews=new();language=lang;version++;refreshed=0;last="";publishedState="";InvalidateTriggers();Publish("building");}
    internal void InvalidateTriggers(){CheckThread();triggerEpoch++;observedAt=0;}
    internal void InvalidateDefinitions(){CheckThread();if(stable!=null){definitions.Begin(stable.Select(e=>e.Location));pending=null;}InvalidateTriggers();}
    private void Observe(){
        if(!Context.IsWorldReady)return;
        if(observedAt!=0&&BridgeServer.Age(observedAt)<1000)return;
        observedAt=Stopwatch.GetTimestamp();var p=Game1.player;var h=new HashCode();
        h.Add(Game1.timeOfDay);h.Add(Game1.dayOfMonth);h.Add(Game1.year);h.Add(Game1.currentSeason);h.Add(Game1.currentLocation);h.Add(p.TilePoint);h.Add(EventTriggerReader.Gate());h.Add(p.Money);h.Add(p.spouse);
        h.Add(p.friendshipData.Count());foreach(var pair in p.friendshipData.Pairs.Take(512)){h.Add(pair.Key);h.Add(pair.Value.Points);h.Add(pair.Value.Status);}
        h.Add(p.eventsSeen.Count);foreach(var id in p.eventsSeen.Take(8192))h.Add(id);
        h.Add(Game1.eventsSeenSinceLastLocationChange.Count);foreach(var id in Game1.eventsSeenSinceLastLocationChange.Take(8192))h.Add(id);
        h.Add(p.mailReceived.Count);foreach(var mail in p.mailReceived.Take(2048))h.Add(mail);
        string next=h.ToHashCode().ToString();if(next!=observed){observed=next;triggerEpoch++;}
    }
    private void CheckThread(){if(owner!=Environment.CurrentManagedThreadId)throw new InvalidOperationException("Game thread required");}
    // The game's own display name of each event location (Data/Locations, translated by the installed
    // content packs), so modded places read in the player's language. Read from data: no location is
    // loaded or created. Places without a display name are left to the App's own names.
    private Dictionary<string,string>? locationNames;
    private static Dictionary<string,string> LocationNames(IEnumerable<EventEntry> entries){
        var names=new Dictionary<string,string>(StringComparer.Ordinal);Dictionary<string,StardewValley.GameData.Locations.LocationData>? data=null;
        try{data=DataLoader.Locations(Game1.content);}catch{return names;}
        var wanted=entries.Select(e=>e.Location).Distinct(StringComparer.Ordinal).Take(1024).ToHashSet(StringComparer.Ordinal);
        foreach(var id in wanted){
            if(!data.TryGetValue(id,out var d)||string.IsNullOrWhiteSpace(d.DisplayName))continue;
            try{var text=StardewValley.TokenizableStrings.TokenParser.ParseText(d.DisplayName);if(!string.IsNullOrWhiteSpace(text)&&text.Length<=80&&text!=id)names[id]=text;}catch{}
        }
        // Second source: the world map, whose areas (with their translated tooltip) list the locations they
        // stand for, interiors included.
        try{foreach(var region in DataLoader.WorldMap(Game1.content).Values)foreach(var area in region.MapAreas??new()){
            string? text=null;foreach(var tip in area.Tooltips??new()){if(!string.IsNullOrWhiteSpace(tip.Text)){text=StardewValley.TokenizableStrings.TokenParser.ParseText(tip.Text);break;}}
            if(string.IsNullOrWhiteSpace(text)||text.Length>80)continue;
            foreach(var at in area.WorldPositions??new())foreach(var id in new[]{at.LocationName}.Concat(at.LocationNames??new()))if(id!=null&&!names.ContainsKey(id)&&wanted.Contains(id))names[id]=text.Split('\n')[0].Trim();
        }}catch{}
        return names;
    }
    private void Publish(string state){if(state==publishedState)return;publishedState=state;publishedVerdicts="";Directory.Publish(new(state,++version,language,0,Array.Empty<EventEntry>(),Array.Empty<string>()));}
    internal void Tick(string lang){
        CheckThread();if(language!=lang)Invalidate(lang);if(!Directory.Wanted)return;
        if(!Context.IsWorldReady){source=null;stable=pending=null;hash?.Dispose();hash=null;Publish("unavailable");refreshed=0;return;}
        Observe();if(stable!=null){long t=Stopwatch.GetTimestamp();if(definitions.Building){definitions.Tick();perf?.Mark("events.definitions",t);return;}TickTriggers();perf?.Mark("events.triggers",t);return;}
        if(source==null&&refreshed!=0&&BridgeServer.Age(refreshed)<5000)return;
        try {
            if(source==null){
                var mod=registry.Get(Id);if(mod==null){Publish("absent");refreshed=Stopwatch.GetTimestamp();return;}
                if(mod.Manifest.Version.ToString()!="1.2.0"){Publish("unsupported");refreshed=Stopwatch.GetTimestamp();return;}
                var type=AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a=>a.GetName().Name=="MHEventsList")?.GetType("MHEventsList.Core.EventRegistry");
                const BindingFlags all=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Static;
                if(type==null||type.GetField("isInitialized",all)?.GetValue(null) is not bool initialized){Publish("unsupported");refreshed=Stopwatch.GetTimestamp();return;}
                if(!initialized){Publish("building");refreshed=Stopwatch.GetTimestamp();return;}
                source=type.GetField("AllEvents",all)?.GetValue(null) as IList;
                if(source==null)throw new InvalidOperationException("Registry layout");
                total=source.Count;index=bytes=0;entries.Clear();plans.Clear();limited.Clear();ids.Clear();hash=IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            }
            if(source.Count!=total){Invalidate(lang);return;}
            long start=Stopwatch.GetTimestamp();int work=0;
            while(index<total&&work++<32&&BridgeServer.Age(start)<1.5){
                if(index>=8192){limited.Add("event-scan-limit");Finish();return;}
                if(entries.Count>=EventDirectory.MaxEntries){limited.Add("events-limit");Finish();return;}
                var value=source[index++];if(value==null){limited.Add("event-invalid");continue;}
                var row=Project(value);if(row.Id.Length==0||!ids.Add(row.Id)){limited.Add("event-id-invalid");continue;}
                var data=JsonSerializer.SerializeToUtf8Bytes(row,BridgeServer.Json);
                if(data.Length>EventDirectory.EntryBudget&&row.Dialogue!=null){row=row with{Dialogue=null};data=JsonSerializer.SerializeToUtf8Bytes(row,BridgeServer.Json);limited.Add("event-preview-bytes");}
                if(data.Length>EventDirectory.EntryBudget||bytes+data.Length>8*1024*1024){limited.Add("event-bytes");continue;}
                bytes+=data.Length;hash!.AppendData(data);entries.Add(row);
                plans.Add(EventTriggerReader.Compile(Get(value,"RawPreconditions") as string,Get(value,"HasInvalidScript") is true||Get(value,"HasUnresolvedTokens") is true));
            }
            if(index>=total)Finish();
        } catch {source=null;hash?.Dispose();hash=null;version++;Publish("unsupported");refreshed=Stopwatch.GetTimestamp();}
    }
    private static object? Get(object o,string name)=>(o.GetType().GetProperty(name,BindingFlags.Public|BindingFlags.Instance)??throw new MissingMemberException(name)).GetValue(o);
    private string Text(object? v,int max){string s=v as string??"";if(s.Length<=max)return s;limited.Add("event-text-limit");return s[..max];}
    private object[] List(object? v,int max){if(v is not IEnumerable items)return Array.Empty<object>();var list=new List<object>();foreach(var item in items){if(list.Count==max){limited.Add("event-metadata-limit");break;}if(item!=null)list.Add(item);}return list.ToArray();}
    private EventEntry Project(object o){
        string id=Text(Get(o,"Id"),160);
        // Read only metadata already parsed by MH; never execute conditions, scripts, refresh or translation methods.
        int? Time(string key)=>Get(o,key) is int n&&n>=0&&n<=2800?n:null;
        var hearts=List(Get(o,"HeartRequirements"),8).Select(h=>new EventHeart(Text(Get(h,"NpcName"),160),Get(h,"FriendshipPoints") is int p?p:0,Text(Get(h,"Type")?.ToString(),80))).ToArray();
        var whens=List(Get(o,"WhenConditionsVariants"),4).Select(w=>{
            var values=new List<EventWhen>();if(w is IDictionary map)foreach(DictionaryEntry pair in map){if(values.Count==8){limited.Add("event-metadata-limit");break;}values.Add(new(Text(pair.Key,80),Text(pair.Value,240)));}return values.ToArray();}).ToArray();
        var conditions=new EventConditions(Text(Get(o,"RawPreconditions"),512),Time("StartTime"),Time("EndTime"),Math.Clamp(Get(o,"RequiredFreeSlots") is int free?free:0,0,144),
            List(Get(o,"RequiredItems"),8).Select(v=>Text(v,160)).ToArray(),List(Get(o,"RequiredNpcsPresent"),8).Select(v=>Text(v,160)).ToArray(),hearts,whens);
        string? Optional(string key)=>Get(o,key) is string s?Text(s,160):null;
        return new(id,Text(Get(o,"DisplayName"),240),Text(Get(o,"LocationName"),160),Optional("ModUniqueId"),Optional("ModSource"),
            Game1.player.eventsSeen.Contains(id),Get(o,"IsDisabledByCP") is true,conditions,ReadPreview(o));
    }
    private EventDialogue[]? ReadPreview(object o){
        // Exact MH 1.2.0 EventData field, already populated/localized by its registry. Never
        // call GetEventScript, refresh, condition predicates, content loading or event commands.
        if(o.GetType().FullName!="MHEventsList.Core.EventData")return null;
        var script=o.GetType().GetField("eventScript",BindingFlags.NonPublic|BindingFlags.Instance)?.GetValue(o) as string;
        if(previews.TryGetValue(o,out var old)&&ReferenceEquals(old.Script,script))return old.Lines.Length==0?null:old.Lines;
        var lines=EventPreview.Read(script);previews.Remove(o);previews.Add(o,new(script,lines));
        return lines.Length==0?null:lines;
    }
    private void Finish(){
        string fingerprint=Convert.ToHexString(hash!.GetHashAndReset())+language+total+string.Join(',',limited.OrderBy(s=>s));hash.Dispose();hash=null;source=null;refreshed=Stopwatch.GetTimestamp();
        last=fingerprint;stable=entries.ToArray();pending=null;computedEpoch=0;definitions.Begin(stable.Select(e=>e.Location));
        locationNames=LocationNames(stable);
        publishedState="ready";publishedVerdicts="";Directory.Publish(new("ready",++version,language,total,stable,limited.OrderBy(s=>s).Take(16).ToArray(),locationNames));
    }
    // While a cutscene or event plays every entry would read "gate" and flip back afterwards: keep the last
    // verdicts, and judge again once it is over (the event just watched is now seen).
    private bool gated;
    private void TickTriggers(){
        if(EventTriggerReader.Gate()=="event-active"){gated=true;return;}if(gated){gated=false;triggerEpoch++;}
        if(pending==null){if(computedEpoch==triggerEpoch)return;pending=new EventEntry[stable!.Length];triggerIndex=0;startedEpoch=triggerEpoch;}
        long start=Stopwatch.GetTimestamp();int work=0;
        while(triggerIndex<stable!.Length&&work++<16&&BridgeServer.Age(start)<1.5){
            var row=stable[triggerIndex];var trigger=EventTriggerReader.Read(row.Id,row.Location,definitions.Resolve(row.Location,row.Id,plans[triggerIndex]),row.Disabled);
            pending[triggerIndex]=row with{Seen=trigger.State=="seen",Trigger=trigger};triggerIndex++;
        }
        if(triggerIndex<stable.Length)return;
        stable=pending;pending=null;computedEpoch=startedEpoch;
        var notes=limited.Concat(stable.SelectMany(e=>e.Trigger?.Limited??Array.Empty<string>())).Distinct().OrderBy(s=>s).Take(16).ToArray();
        string verdicts=Verdicts(stable,notes);if(verdicts==publishedVerdicts)return;publishedVerdicts=verdicts;
        Directory.Publish(new("ready",++version,language,total,stable,notes,locationNames));
    }
    internal static string Verdicts(EventEntry[] rows,string[] notes){
        var s=new System.Text.StringBuilder();static void Results(System.Text.StringBuilder s,EventConditionResult[] list){foreach(var r in list)s.Append(r.Index).Append(':').Append(r.Kind).Append(',');s.Append(';');}
        foreach(var e in rows){s.Append(e.Id).Append('|').Append(e.Seen?'1':'0');var t=e.Trigger;
            if(t!=null){s.Append('|').Append(t.State).Append('|').Append(t.Gate);Results(s,t.Failed);Results(s,t.Chance);Results(s,t.Unknown);s.Append(string.Join(',',t.Limited));}s.Append('\n');}
        return s.Append(string.Join(',',notes)).ToString();
    }
}
