using System.Collections;
using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using StardewModdingAPI;
using StardewModdingAPI.Utilities;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Buildings;
using StardewValley.Characters;
using StardewValley.GameData;
using StardewValley.TokenizableStrings;

namespace StardewThor.ReadOnly;

// Demand is supplied by the farm HTTP lease. One bounded stage/iteration per scheduler turn.
// No menus, Item instances, JSON files, data initialization, reward calls or RNG predicates.
internal sealed class FarmExtrasCollector {
    internal const string JunimoId="hawkfalcon.BetterJunimos",KidsId="mushymato.HaveMoreKids",BirthdayId="Omegasis.HappyBirthday";
    private readonly IModRegistry registry;private readonly int owner=Environment.CurrentManagedThreadId;
    private readonly HashSet<string> notes=new(StringComparer.Ordinal);
    private string context="",fingerprint="";private long last;private int stage;
    private JunimoReport junimos=new("building");private FamilyReport family=new("building","vanilla","absent",null,Array.Empty<FamilyChild>());
    private PlayerBirthdayReport birthday=new("building");private readonly List<SlayerGoal> goals=new();
    private IEnumerator<KeyValuePair<string,MonsterSlayerQuestData>>? pendingGoals;
    private IEnumerator<Child>? pendingChildren;private readonly List<FamilyChild> children=new();private object? kidsApi;
    private IEnumerator<Building>? pendingBuildings;private int huts,scannedBuildings;private string familySource="vanilla",familyModState="absent";
    internal FarmExtras Current{get;private set;}=new(0,"building",new("building"),new("building","vanilla","absent",null,Array.Empty<FamilyChild>()),new("building"),Array.Empty<SlayerGoal>(),Array.Empty<string>());
    internal void Invalidate(){EnsureThread();DisposePending();fingerprint="";context="";last=0;stage=0;Current=Current with{Version=Current.Version+1,State="building",Junimos=new("building"),Family=new("building","vanilla","absent",null,Array.Empty<FamilyChild>()),PlayerBirthday=new("building"),Slayer=Array.Empty<SlayerGoal>(),Limited=Array.Empty<string>()};}
    internal FarmExtrasCollector(IModRegistry registry)=>this.registry=registry;
    internal void Tick(string language){
        EnsureThread();if(!Context.IsWorldReady){DisposePending();stage=0;context="";last=0;if(Current.State!="unavailable")Publish("unavailable",new("unavailable"),new("unavailable","vanilla","absent",null,Array.Empty<FamilyChild>()),new("unavailable"),Array.Empty<SlayerGoal>());return;}
        var key=$"{Game1.player.UniqueMultiplayerID}/{Game1.year}/{Game1.currentSeason}/{Game1.dayOfMonth}/{language}";
        if(context!=key){Invalidate();context=key;}
        if(stage==0&&last!=0&&BridgeServer.Age(last)<2000)return;
        var watch=Stopwatch.StartNew();
        try{
            switch(stage){
                case 0:notes.Clear();goals.Clear();children.Clear();junimos=ReadJunimos();pendingBuildings=Game1.getFarm()?.buildings.GetEnumerator();huts=scannedBuildings=0;stage=1;break;
                case 1:
                    for(int n=0;n<4&&watch.Elapsed.TotalMilliseconds<1.5&&pendingBuildings!=null;n++){
                        if(!pendingBuildings.MoveNext()){pendingBuildings.Dispose();pendingBuildings=null;break;}
                        if(++scannedBuildings>256){notes.Add("junimo-huts-limit");pendingBuildings.Dispose();pendingBuildings=null;break;}
                        if(pendingBuildings.Current is JunimoHut)huts++;
                    }
                    if(pendingBuildings==null){if(junimos.State=="ready")junimos=junimos with{Huts=huts};StartFamily();stage=2;}break;
                case 2:
                    for(int n=0;n<2&&watch.Elapsed.TotalMilliseconds<1.5&&pendingChildren!=null;n++){
                        if(!pendingChildren.MoveNext()){pendingChildren.Dispose();pendingChildren=null;break;}
                        if(children.Count>=16){notes.Add("family-children-limit");pendingChildren.Dispose();pendingChildren=null;break;}
                        children.Add(ReadChild(pendingChildren.Current));
                    }
                    if(pendingChildren==null){family=new("ready",familySource,familyModState,Text(Game1.player.spouse,160,true),children.ToArray());birthday=ReadBirthday();stage=3;}break;
                case 3:pendingGoals=DataLoader.MonsterSlayerQuests(Game1.content).GetEnumerator();stage=4;break;
                case 4:
                    for(int n=0;n<2&&watch.Elapsed.TotalMilliseconds<1.5&&pendingGoals!=null;n++){
                        if(!pendingGoals.MoveNext()){pendingGoals.Dispose();pendingGoals=null;break;}
                        if(goals.Count>=64){notes.Add("slayer-limit");pendingGoals.Dispose();pendingGoals=null;break;}
                        goals.Add(ReadGoal(pendingGoals.Current));
                    }
                    if(pendingGoals==null){Publish("ready",junimos,family,birthday,goals.ToArray());stage=0;last=Stopwatch.GetTimestamp();}break;
            }
        }catch{notes.Add("farm-extras-partial");DisposePending();Publish("unsupported",junimos,family,birthday,goals.ToArray());stage=0;last=Stopwatch.GetTimestamp();}
    }
    private void StartFamily(){
        kidsApi=null;familyModState=ReadOnlyModAdapter.State(registry,KidsId,"1.1.6");familySource="vanilla";
        // Both the vanilla getter and HMK's iterator search the loaded home's characters.
        // Preflight the inspected source lists so a single MoveNext cannot scan an unbounded map.
        if(Utility.getHomeOfFarmer(Game1.player).characters.Count>512||familyModState=="ready"&&(Game1.getFarm()?.characters.Count??0)>512){
            notes.Add("family-source-limit");pendingChildren=Enumerable.Empty<Child>().GetEnumerator();return;
        }
        if(familyModState=="ready")try{
            kidsApi=ReadOnlyModAdapter.Api(registry,KidsId,"HaveMoreKids.Framework.HaveMoreKidsAPI");
            var method=kidsApi.GetType().GetMethod("GetAllChildrenOfFarmer")!;var parameters=method.GetParameters();
            if(parameters.Length!=2||!parameters[1].ParameterType.IsEnum)throw new MissingMemberException();
            // ALL is an enum in the inspected API; use its named value rather than guessing an ordinal.
            var all=Enum.Parse(parameters[1].ParameterType,"ALL");
            pendingChildren=((IEnumerable<Child>)method.Invoke(kidsApi,new object[]{Game1.player,all})!).GetEnumerator();familySource="mod";return;
        }catch{familyModState="unsupported";kidsApi=null;}
        if(familyModState=="unsupported")notes.Add("family-mod-unsupported");
        pendingChildren=Game1.player.getChildren().GetEnumerator();
    }
    private FamilyChild ReadChild(Child child){
        string? birth=null;int? grow=null;
        if(kidsApi!=null)try{birth=(string)ReadOnlyModAdapter.Invoke(kidsApi,"GetChildBirthdayString",child)!;grow=(int)ReadOnlyModAdapter.Invoke(kidsApi,"GetDaysToNextChildGrowth",child)!;}catch{notes.Add("family-child-unsupported");}
        else{
            int age=Math.Max(0,child.daysOld.Value);int date=((Game1.Date.TotalDays-age)%112+112)%112;
            birth=new SDate(date%28+1,(Season)(date/28)).ToLocaleString(false);
            grow=child.Age switch{0=>13-age,1=>27-age,2=>55-age,_=>-1};
        }
        if(grow.HasValue)grow=Math.Clamp(grow.Value,-1,1000000);
        return new(Text(child.displayName,160)!,Text(birth,240,true),grow);
    }
    private JunimoReport ReadJunimos(){
        var state=ReadOnlyModAdapter.State(registry,JunimoId,"3.2.0");if(state!="ready")return new(state);
        try{
            var api=ReadOnlyModAdapter.Api(registry,JunimoId,"BetterJunimos.BetterJunimosApi");
            bool paid=(bool)ReadOnlyModAdapter.Invoke(api,"GetWereJunimosPaidToday")!;
            var values=(IDictionary)ReadOnlyModAdapter.Invoke(api,"GetJunimoAbilities")!;var enabled=new List<string>();int count=0;
            foreach(DictionaryEntry row in values){if(++count>32){notes.Add("junimo-abilities-limit");break;}if(row.Key is string key&&row.Value is true)enabled.Add(Text(key,160)!);}
            return new("ready",paid,null,enabled.ToArray());
        }catch{return new("unsupported");}
    }
    private PlayerBirthdayReport ReadBirthday(){
        var state=ReadOnlyModAdapter.State(registry,BirthdayId,"3.21.4");if(state!="ready")return new(state);
        try{
            var assembly=AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a=>a.GetName().Name=="HappyBirthday")??throw new MissingMemberException();
            var type=assembly.GetType("Omegasis.HappyBirthday.HappyBirthdayModCore",true)!;
            var instance=type.GetField("Instance",BindingFlags.Public|BindingFlags.Static)?.GetValue(null);if(instance==null){notes.Add("birthday-not-loaded");return new("building");}
            var manager=ReadOnlyModAdapter.Field(instance,"birthdayManager");if(manager==null){notes.Add("birthday-not-loaded");return new("building");}
            var data=ReadOnlyModAdapter.Field(manager,"playerBirthdayData");if(data==null){notes.Add("birthday-not-loaded");return new("building");}
            long player=(long)ReadOnlyModAdapter.Field(data,"PlayerUniqueMultiplayerId")!;
            if(player!=Game1.player.UniqueMultiplayerID){notes.Add("birthday-player-mismatch");return new("unsupported");}
            var season=(string)ReadOnlyModAdapter.Field(data,"BirthdaySeason")!;int day=(int)ReadOnlyModAdapter.Field(data,"BirthdayDay")!;
            if(day is <1 or >28||season is not("spring" or "summer" or "fall" or "winter")){notes.Add("birthday-unchosen");return new("ready");}
            return new("ready",season,day,season==Game1.currentSeason&&day==Game1.dayOfMonth);
        }catch{return new("unsupported");}
    }
    private SlayerGoal ReadGoal(KeyValuePair<string,MonsterSlayerQuestData> row){
        var d=row.Value;long killed=0;int count=0;
        foreach(var target in d.Targets??new List<string>()){if(++count>64){notes.Add("slayer-targets-limit");break;}killed+=Math.Max(0,Game1.stats.getMonstersKilled(target));}
        string? reward=d.RewardItemId;
        if(reward!=null){if(reward.Length>160||ItemRegistry.GetData(reward)==null){reward=null;notes.Add("slayer-reward-unknown");}else reward=ItemRegistry.QualifyItemId(reward);}
        return new(Text(row.Key,160)!,Text(TokenParser.ParseText(d.DisplayName),240)!, (int)Math.Clamp(killed,0,int.MaxValue),Math.Clamp(d.Count,0,int.MaxValue),reward,Game1.player.mailReceived.Contains("Gil_"+row.Key));
    }
    private string? Text(string? text,int max,bool nullable=false){if(text==null)return nullable?null:"";if(text.Length>max){notes.Add("farm-extras-text-limit");return text[..max];}return text;}
    private void Publish(string state,JunimoReport j,FamilyReport f,PlayerBirthdayReport b,SlayerGoal[] g){
        var value=new FarmExtras(0,state,j,f,b,g,notes.OrderBy(x=>x,StringComparer.Ordinal).Take(16).ToArray());
        var body=JsonSerializer.Serialize(value,BridgeServer.Json);if(Encoding.UTF8.GetByteCount(body)>32*1024){
            notes.Add("farm-extras-bytes");value=value with{Slayer=Array.Empty<SlayerGoal>(),Limited=notes.Take(16).ToArray()};body=JsonSerializer.Serialize(value,BridgeServer.Json);
            if(Encoding.UTF8.GetByteCount(body)>32*1024){value=value with{Family=f with{Children=Array.Empty<FamilyChild>()},Junimos=j with{Abilities=j.State=="ready"?Array.Empty<string>():null}};body=JsonSerializer.Serialize(value,BridgeServer.Json);}
        }
        if(body!=fingerprint){fingerprint=body;Current=value with{Version=Current.Version+1};}
    }
    private void DisposePending(){pendingGoals?.Dispose();pendingGoals=null;pendingChildren?.Dispose();pendingChildren=null;pendingBuildings?.Dispose();pendingBuildings=null;}
    private void EnsureThread(){if(Environment.CurrentManagedThreadId!=owner)throw new InvalidOperationException("Farm extras must run on the game thread");}
}
