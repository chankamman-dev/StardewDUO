using System.Diagnostics;
using System.Reflection;
using Microsoft.Xna.Framework.Content;
using StardewValley;
namespace StardewThor.ReadOnly;
// Inspect already intercepted game assets. No Load(), CP token evaluation or MH
// refresh. Native SMAPI 4.5.2 ContentCache wraps MonoGame's LoadedAssets dictionary.
internal sealed class CachedEventDefinitions {
    private readonly Dictionary<(string Location,string Id),List<EventTriggerReader.Plan>> plans=new();
    private IEnumerator<string>? locations;
    private IEnumerator<KeyValuePair<string,string>>? keys;
    private string location="";
    private int scanned;
    private readonly HashSet<string> truncated=new(StringComparer.Ordinal);
    internal bool Building=>locations!=null;
    internal void Begin(IEnumerable<string> names){plans.Clear();truncated.Clear();locationCount=0;keys?.Dispose();locations?.Dispose();locations=names.Distinct(StringComparer.Ordinal).Take(257).GetEnumerator();keys=null;}
    private int locationCount;
    internal void Tick(){
        long started=Stopwatch.GetTimestamp();int work=0;
        while(locations!=null&&work++<32&&(Stopwatch.GetTimestamp()-started)*1000d/Stopwatch.Frequency<1.5){
            if(keys==null){
                if(!locations.MoveNext()){locations.Dispose();locations=null;return;}
                if(++locationCount>256){locations.Dispose();locations=null;truncated.Add("*");return;}
                location=locations.Current;scanned=0;var data=Cached(location);if(data==null)continue;keys=data.GetEnumerator();
            }
            try{
                if(++scanned>4096){truncated.Add(location);keys.Dispose();keys=null;continue;}
                if(!keys.MoveNext()){keys.Dispose();keys=null;continue;}
                var row=keys.Current;var parts=Event.SplitPreconditions(row.Key);if(parts.Length==0||parts[0].Length is 0 or >160)continue;
                var key=(location,parts[0]);if(!plans.TryGetValue(key,out var variants))plans[key]=variants=new();
                if(variants.Count>=8){variants.Clear();variants.Add(new(null,Unavailable:"definition-variants-limit"));continue;}
                variants.Add(EventTriggerReader.Compile(string.Join('/',parts.Skip(1)),string.IsNullOrWhiteSpace(row.Value)||row.Value.Trim()=="null"));
            }catch{keys?.Dispose();keys=null;}
        }
    }
    private static Dictionary<string,string>? Cached(string name){
        var contentType=Game1.content.GetType();var version=contentType.Assembly.GetName().Version;
        if(!Game1.version.StartsWith("1.6.15",StringComparison.Ordinal)||contentType.FullName!="StardewModdingAPI.Framework.ContentManagers.GameContentManager"||version is not {Major:4,Minor:5,Build:2})return null;
        // Field read only; invoking a virtual getter/Load could run external code.
        var loaded=typeof(ContentManager).GetField("loadedAssets",BindingFlags.Instance|BindingFlags.NonPublic)?.GetValue(Game1.content) as Dictionary<string,object>;
        if(loaded==null)return null;string key="Data/Events/"+name;
        var locale=LocalizedContentManager.LanguageCodeString(LocalizedContentManager.CurrentLanguageCode);
        if(LocalizedContentManager.CurrentLanguageCode!=LocalizedContentManager.LanguageCode.en&&loaded.TryGetValue(key+"."+locale,out var local))return local as Dictionary<string,string>;
        if(LocalizedContentManager.CurrentLanguageCode!=LocalizedContentManager.LanguageCode.en&&loaded.TryGetValue(key+"_international",out var international))return international as Dictionary<string,string>;
        return loaded.TryGetValue(key,out var value)?value as Dictionary<string,string>:null;
    }
    internal EventTriggerReader.Plan Resolve(string location,string id,EventTriggerReader.Plan reported){
        if(truncated.Contains("*")||truncated.Contains(location))return new(null,Unavailable:"definition-scan-limit");
        if(!plans.TryGetValue((location,id),out var variants))return new(null,Unavailable:"definition-unavailable");
        foreach(var plan in variants){
            if(plan.Unavailable!=null)return plan;
            if(plan.Conditions!=null&&reported.Conditions!=null&&plan.Conditions.Length==reported.Conditions.Length&&plan.Conditions.Zip(reported.Conditions).All(pair=>pair.First.SequenceEqual(pair.Second)))return plan;
        }
        // MH can merge event variants or retain a stale CP definition. Never report
        // ready using conditions which aren't in the active game's asset.
        return new(null,Unavailable:"definition-changed");
    }
}
