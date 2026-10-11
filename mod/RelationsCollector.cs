using System.Collections;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;

namespace StardewThor.ReadOnly;

// Version-gated metadata only. Never invokes CharacterInfo.IsUnlocked or relationship
// conditions: those may contain RANDOM and may reveal plot-dependent relationships.
internal sealed class RelationsCollector {
    internal const string Id="SpaceBaby.PartOfTheCommunity";
    private readonly IModRegistry registry;private readonly int owner=Environment.CurrentManagedThreadId;
    private Dictionary<string,ResidentRelation[]> current=new(StringComparer.OrdinalIgnoreCase),working=new(StringComparer.OrdinalIgnoreCase);
    private IEnumerator? characters;private readonly HashSet<string> notes=new(StringComparer.Ordinal);
    private IncrementalHash? contentHash;private int contentBytes;
    private const int ByteBudget=256*1024,MetadataReserve=4096;
    private long requested,last;private int seen;private string fingerprint="";
    internal long Version{get;private set;}
    internal string State{get;private set;}="building";
    internal string[] Limited{get;private set;}=Array.Empty<string>();
    internal bool Wanted=>requested!=0&&BridgeServer.Age(requested)<5000;
    internal RelationsCollector(IModRegistry registry)=>this.registry=registry;
    internal ResidentRelation[]? Read(string npcId){EnsureThread();requested=Stopwatch.GetTimestamp();return State=="ready"?current.TryGetValue(npcId,out var rows)?rows:Array.Empty<ResidentRelation>():null;}
    internal void Invalidate(){EnsureThread();(characters as IDisposable)?.Dispose();characters=null;contentHash?.Dispose();contentHash=null;notes.Clear();fingerprint="";current=new(StringComparer.OrdinalIgnoreCase);last=0;State="building";Limited=Array.Empty<string>();Version++;}
    internal void Tick(){
        EnsureThread();if(!Context.IsWorldReady){Finish("unavailable");return;}
        if(characters==null){
            if(last!=0&&BridgeServer.Age(last)<5000)return;
            notes.Clear();working=new(StringComparer.OrdinalIgnoreCase);seen=0;
            var state=ReadOnlyModAdapter.State(registry,Id,"2.0.1");if(state!="ready"){Finish(state);return;}
            try{
                var api=ReadOnlyModAdapter.Api(registry,Id,"SpaceBaby.PartOfTheCommunity.Framework.CharacterManager");
                // GetAllCharacters clones the dictionary. Preflight the inspected backing field first.
                if(ReadOnlyModAdapter.Field(api,"IsLoaded") is not true){Finish("building");return;}
                if(ReadOnlyModAdapter.Field(api,"Characters") is not IDictionary source)throw new MissingMemberException();
                if(source.Count>512){notes.Add("relations-source-limit");Finish("unsupported");return;}
                contentHash=IncrementalHash.CreateHash(HashAlgorithmName.SHA256);contentBytes=MetadataReserve;
                characters=((IEnumerable)ReadOnlyModAdapter.Invoke(api,"GetAllCharacters")!).GetEnumerator();
            }catch{Finish("unsupported");return;}
        }
        var watch=Stopwatch.StartNew();
        try{
            for(int n=0;n<2&&watch.Elapsed.TotalMilliseconds<1.5;n++){
                if(!characters.MoveNext()){Finish("ready");return;}
                if(++seen>512){notes.Add("relations-source-limit");Finish("ready");return;}
                var row=characters.Current??throw new MissingMemberException();
                var key=(string)ReadOnlyModAdapter.Property(row,"Key")!;var value=ReadOnlyModAdapter.Property(row,"Value")!;
                if(key.Length is 0 or >160){notes.Add("relations-id-limit");continue;}
                if(!string.IsNullOrWhiteSpace((string?)ReadOnlyModAdapter.Property(value,"UnlockCondition"))){notes.Add("relations-conditional");continue;}
                var list=(IEnumerable)ReadOnlyModAdapter.Property(value,"Relationships")!;var result=new List<ResidentRelation>();var unique=new HashSet<string>(StringComparer.Ordinal);int scanned=0;
                foreach(var relation in list){
                    if(++scanned>32||result.Count>=16){notes.Add("relations-entry-limit");break;}
                    var other=ReadOnlyModAdapter.Property(relation!,"Character")!;
                    if(!string.IsNullOrWhiteSpace((string?)ReadOnlyModAdapter.Property(relation!,"UnlockCondition"))||!string.IsNullOrWhiteSpace((string?)ReadOnlyModAdapter.Property(other,"UnlockCondition"))){notes.Add("relations-conditional");continue;}
                    var target=(string)ReadOnlyModAdapter.Property(other,"Name")!;
                    if(target.Length is 0 or >160){notes.Add("relations-id-limit");continue;}
                    var raw=ReadOnlyModAdapter.Property(relation!,"Relationship")!.ToString()!;
                    var kind=Kind(raw);if(kind==null){notes.Add("relations-kind-unsupported");continue;}
                    if(unique.Add(target+"/"+kind))result.Add(new(target,kind));
                }
                var projected=result.ToArray();
                // Serialize at most this one NPC's <=16 bounded relations. The wrapper is
                // conservatively larger than its dictionary member; reserve metadata up front.
                // No whole-table JSON or byte counting pass ever runs on the game thread.
                var rowBytes=JsonSerializer.SerializeToUtf8Bytes(new{key,relations=projected},BridgeServer.Json);
                if(rowBytes.Length>ByteBudget-contentBytes){notes.Add("relations-bytes");Finish("unsupported");return;}
                contentBytes+=rowBytes.Length;contentHash!.AppendData(rowBytes);working[key]=projected;
            }
        }catch{Finish("unsupported");}
    }
    internal static string? Kind(string value)=>value switch {
        "Father" or "Mother"=>"parent","Brother" or "Sister"=>"sibling","Husband" or "Wife"=>"spouse",
        "Son" or "Daughter"=>"child","Grandfather" or "Grandmother"=>"grandparent","Grandson" or "Granddaughter"=>"grandchild",
        "HalfBrother" or "HalfSister"=>"halfSibling","StepFather" or "StepMother"=>"stepParent","StepSon" or "StepDaughter"=>"stepChild",
        "GreatGrandfather" or "GreatGrandmother"=>"greatGrandparent","GreatGrandson" or "GreatGranddaughter"=>"greatGrandchild",
        "FatherInLaw" or "MotherInLaw"=>"parentInLaw","BrotherInLaw" or "SisterInLaw"=>"siblingInLaw","SonInLaw" or "DaughterInLaw"=>"childInLaw",
        "Aunt"=>"aunt","Uncle"=>"uncle","Niece"=>"niece","Nephew"=>"nephew","Godfather" or "Godmother"=>"godparent","Godson" or "Goddaughter"=>"godchild",
        "Cousin"=>"cousin","Friend"=>"friend","WarTorn"=>"warTorn",_=>null
    };
    private void Finish(string state){
        (characters as IDisposable)?.Dispose();characters=null;
        var result=state=="ready"?working:new Dictionary<string,ResidentRelation[]>(StringComparer.OrdinalIgnoreCase);
        var hash=state=="ready"&&contentHash!=null?Convert.ToHexString(contentHash.GetHashAndReset()):"";
        contentHash?.Dispose();contentHash=null;
        // Fixed-size digest plus <=16 short flags only; no relation dictionary serialization.
        var limited=notes.OrderBy(x=>x,StringComparer.Ordinal).Take(16).ToArray();var body=JsonSerializer.Serialize(new{state,hash,limited},BridgeServer.Json);
        if(body!=fingerprint){fingerprint=body;current=result;State=state;Limited=limited;Version++;}
        last=Stopwatch.GetTimestamp();
    }
    private void EnsureThread(){if(Environment.CurrentManagedThreadId!=owner)throw new InvalidOperationException("Relations must run on the game thread");}
}
