using System.Reflection;
using HarmonyLib;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Delegates;
using StardewValley.Locations;

namespace StardewThor.ReadOnly;

// Audited native 1.6.15 handlers only. Never execute MH predicates or a mod delegate.
// The direct delegate call preserves CheckPrecondition's args/negation semantics,
// but lets exceptions become unknown instead of being swallowed as a false result.
internal static class EventTriggerReader {
    private static readonly HashSet<string> Pure=new(StringComparer.Ordinal){
        "SawEvent","HostMail","NotHostMail","WorldState","HostOrLocalMail","NotHostOrLocalMail",
        "EarnedMoney","HasMoney","FreeInventorySlots","CommunityCenterOrWarehouseDone","NotCommunityCenterOrWarehouseDone",
        "Dating","DaysPlayed","JojaBundlesDone","Friendship","FestivalDay","NotFestivalDay","Shipped","SawSecretNote",
        "ChoseDialogueAnswers","LocalMail","GoldenWalnuts","NotLocalMail","InUpgradedHouse","Time","Weather",
        "DayOfWeek","NotDayOfWeek","Spouse","NotSpouse","NpcVisibleHere","Season","NotSeason","ReachedMineBottom",
        "Year","Gender","HasItem","NotSawEvent","Tile","ActiveDialogueEvent","NotActiveDialogueEvent","DayOfMonth","Skill"
    };
    // Finite, direct reads. Dynamic location lookup / NPC creation / recursive queries
    // are excluded. ANY is admitted only after auditing every nested query.
    private static readonly HashSet<string> QueryPure=new(StringComparer.Ordinal){
        "TRUE","FALSE","DATE_RANGE","SEASON_DAY","DAY_OF_MONTH","DAY_OF_WEEK","DAYS_PLAYED","SEASON","YEAR","TIME",
        "IS_EVENT","IS_HOST","IS_MULTIPLAYER","IS_CUSTOM_FARM_TYPE","FARM_NAME","FARM_TYPE","FARM_CAVE",
        "FOUND_ALL_LOST_BOOKS","HAS_TARGET_LOCATION","MINE_LOWEST_LEVEL_REACHED",
        "PLAYER_BASE_COMBAT_LEVEL","PLAYER_BASE_FARMING_LEVEL","PLAYER_BASE_FISHING_LEVEL","PLAYER_BASE_FORAGING_LEVEL","PLAYER_BASE_LUCK_LEVEL","PLAYER_BASE_MINING_LEVEL",
        "PLAYER_COMBAT_LEVEL","PLAYER_FARMING_LEVEL","PLAYER_FISHING_LEVEL","PLAYER_FORAGING_LEVEL","PLAYER_LUCK_LEVEL","PLAYER_MINING_LEVEL",
        "PLAYER_CURRENT_MONEY","PLAYER_GENDER","PLAYER_HAS_CAUGHT_FISH","PLAYER_HAS_CONVERSATION_TOPIC","PLAYER_HAS_CRAFTING_RECIPE","PLAYER_HAS_COOKING_RECIPE",
        "PLAYER_HAS_DIALOGUE_ANSWER","PLAYER_HAS_HEARD_SONG","PLAYER_HAS_MAIL","PLAYER_HAS_PROFESSION","PLAYER_HAS_RUN_TRIGGER_ACTION",
        "PLAYER_HAS_SECRET_NOTE","PLAYER_HAS_SEEN_EVENT","PLAYER_HAS_TOWN_KEY","PLAYER_HAS_TRASH_CAN_LEVEL","PLAYER_MOD_DATA",
        "PLAYER_MONEY_EARNED","PLAYER_SHIPPED_BASIC_ITEM","PLAYER_SPECIAL_ORDER_ACTIVE","PLAYER_SPECIAL_ORDER_RULE_ACTIVE","PLAYER_SPECIAL_ORDER_COMPLETE",
        "PLAYER_KILLED_MONSTERS","PLAYER_STAT","PLAYER_VISITED_LOCATION","PLAYER_HAS_MET","PLAYER_PREFERRED_PET"
    };
    internal sealed record Plan(string[][]? Conditions,bool Invalid=false,string? Unavailable=null);
    internal static Plan Compile(string? raw,bool invalid=false){
        if(invalid||raw?.Contains("{{")==true||raw?.Contains("}}")==true)return new(null,true);
        if(raw==null||raw.Length>4096)return new(null);
        try{var parts=ArgUtility.SplitQuoteAware(raw,'/',StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries,keepQuotesAndEscapes:true);
            if(parts.Length>128)return new(null);
            var args=parts.Select(ArgUtility.SplitBySpaceQuoteAware).ToArray();
            return new(args.Any(a=>a.Length is 0 or >128)?null:args);
        }catch{return new(null);}
    }
    internal static EventCheckedAt Now()=>new(Game1.dayOfMonth,Game1.currentSeason,Game1.year,Game1.timeOfDay,Limit(Game1.currentLocation?.NameOrUniqueName,160));
    internal static string? Gate()=>!Game1.IsMasterGame?"not-host":Game1.CurrentEvent!=null||Game1.eventUp?"event-active":null;
    // getLocationFromName can GENERATE mine/volcano maps. Do not look those up.
    // Ordinary locations are already loaded; lookup can only fill its name cache.
    internal static GameLocation? Location(string name){
        if(MineShaft.IsGeneratedLevel(name)||VolcanoDungeon.IsGeneratedLevel(name))return Game1.currentLocation?.NameOrUniqueName==name?Game1.currentLocation:null;
        return Game1.getLocationFromName(name);
    }
    private static bool Native(MethodInfo method,Type type)=>method.DeclaringType==type&&method.IsStatic&&
        (Harmony.GetPatchInfo(method) is not {} patches||patches.Owners.Count==0);
    private static readonly Dictionary<string,string> Dependencies=new(){
        ["NotHostOrLocalMail"]="HostOrLocalMail",["NotCommunityCenterOrWarehouseDone"]="CommunityCenterOrWarehouseDone",
        ["NotFestivalDay"]="FestivalDay",["NotLocalMail"]="LocalMail",["NotDayOfWeek"]="DayOfWeek",
        ["NotSpouse"]="Spouse",["NotSeason"]="Season",["NotSawEvent"]="SawEvent",["NotActiveDialogueEvent"]="ActiveDialogueEvent"
    };
    private static bool NativeHandler(MethodInfo method)=>Native(method,typeof(Preconditions))&&
        (!Dependencies.TryGetValue(method.Name,out var name)||Native(typeof(Preconditions).GetMethod(name)!,typeof(Preconditions)));
    private static bool WeatherReady(GameLocation location){
        // GetWeatherForLocation creates missing weather and consumes Game1.random.
        // Only enter the native weather handler when its existing context is known.
        var context=location.locationContextId;
        return context!=null&&Game1.netWorldState.Value.LocationWeather.ContainsKey(context);
    }
    private enum Safety {Pure,Chance,Unknown}
    private static readonly MethodInfo[] QueryEvaluators=typeof(GameStateQuery).GetMethods().Where(m=>m.Name=="CheckConditions").ToArray();
    private static readonly MethodInfo[] QueryParsers=typeof(GameStateQuery).GetMethods().Where(m=>m.Name=="Parse").ToArray();
    private static Safety QuerySafety(string query,int depth=0){
        if(depth>4||query.Length>4096)return Safety.Unknown;
        if(QueryEvaluators.Concat(QueryParsers).Any(m=>Harmony.GetPatchInfo(m)?.Owners.Any()==true))return Safety.Unknown;
        try{var parsed=GameStateQuery.Parse(query);if(parsed.Length>32)return Safety.Unknown;bool chance=false,unknown=false;
            foreach(var p in parsed){
                if(p.Error!=null||p.Resolver==null||!Native(p.Resolver.Method,typeof(GameStateQuery.DefaultResolvers))){unknown=true;continue;}
                string key=p.Resolver.Method.Name;
                if(key is "RANDOM" or "SYNCED_RANDOM" or "SYNCED_CHOICE" or "SYNCED_SUMMER_RAIN_RANDOM"){chance=true;continue;}
                if(key=="ANY"){
                    if(p.Query.Length>17){unknown=true;continue;}
                    foreach(var nested in p.Query.Skip(1)){var s=QuerySafety(nested,depth+1);chance|=s==Safety.Chance;unknown|=s==Safety.Unknown;}
                }else if(!QueryPure.Contains(key))unknown=true;
            }
            return unknown?Safety.Unknown:chance?Safety.Chance:Safety.Pure;
        }catch{return Safety.Unknown;}
    }
    // Passive calendar titles use the same read-only boundary as event triggers.
    // Unknown/custom/random predicates are never run.
    internal static bool? ReadQuery(string? query,GameLocation? location,ISet<string> limited,string prefix){
        if(string.IsNullOrWhiteSpace(query))return true;
        if(!Game1.version.StartsWith("1.6.15",StringComparison.Ordinal)){limited.Add(prefix+"-condition-unsupported");return null;}
        var safety=QuerySafety(query);if(safety!=Safety.Pure){limited.Add(prefix+(safety==Safety.Chance?"-condition-random":"-condition-unsupported"));return null;}
        try{return GameStateQuery.CheckConditions(query,location,Game1.player);}catch{limited.Add(prefix+"-condition-unavailable");return null;}
    }
    internal static EventTrigger Read(string id,string locationName,Plan plan,bool disabled=false,bool invalid=false){
        var at=Now();var failed=new List<EventConditionResult>();var chance=new List<EventConditionResult>();var unknown=new List<EventConditionResult>();var limited=new HashSet<string>();
        EventTrigger Result(string state,string? gate=null)=>new(state,at,failed.ToArray(),chance.ToArray(),unknown.ToArray(),gate,limited.OrderBy(x=>x).ToArray());
        void Add(List<EventConditionResult> list,int index,string kind,string label){if(list.Count<16)list.Add(new(index,Limit(kind,80)));else limited.Add(label);}
        if(Game1.player.eventsSeen.Contains(id)||Game1.eventsSeenSinceLastLocationChange.Contains(id))return Result("seen");
        if(Gate() is {} gate)return Result("gate",gate);
        if(disabled)return Result("gate","content-disabled");
        if(plan.Unavailable!=null){if(plan.Unavailable.EndsWith("-limit",StringComparison.Ordinal))limited.Add(plan.Unavailable);return Result("unknown",plan.Unavailable);}
        if(invalid||plan.Invalid)return Result("unknown","event-script-invalid");
        if(!Game1.version.StartsWith("1.6.15",StringComparison.Ordinal))return Result("unknown","game-version");
        if(plan.Conditions==null){limited.Add("trigger-conditions-limit");return Result("unknown","conditions-invalid");}
        GameLocation? location;try{location=Location(locationName);}catch{return Result("unknown","location-unavailable");}
        if(location==null)return Result("unknown","location-unavailable");
        for(int i=0;i<plan.Conditions.Length;i++){
            var args=plan.Conditions[i];string key=args[0];bool negated=key.StartsWith('!');if(negated)key=key[1..];string kind=key;
            try{
                if(!Event.TryGetPreconditionHandler(key,out var handler)){Add(unknown,i,kind,"trigger-unknown-limit");continue;}
                if(handler.Method.DeclaringType==typeof(Preconditions))kind=handler.Method.Name;
                if(!NativeHandler(handler.Method)){Add(unknown,i,kind,"trigger-unknown-limit");continue;}
                if(kind=="Random"){Add(chance,i,kind,"trigger-chance-limit");continue;}
                if(kind=="Weather"&&!WeatherReady(location)){Add(unknown,i,kind,"trigger-unknown-limit");continue;}
                if(kind=="NpcVisibleHere"&&location.characters.Count>1024){Add(unknown,i,kind,"trigger-unknown-limit");limited.Add("trigger-npc-limit");continue;}
                if(kind=="GameStateQuery"){
                    var safety=QuerySafety(ArgUtility.UnsplitQuoteAware(args,' ',1));
                    if(safety!=Safety.Pure){Add(safety==Safety.Chance?chance:unknown,i,kind,safety==Safety.Chance?"trigger-chance-limit":"trigger-unknown-limit");continue;}
                }else if(!Pure.Contains(kind)){Add(unknown,i,kind,"trigger-unknown-limit");continue;}
                if(handler(location,id,args)==negated)Add(failed,i,kind,"trigger-failed-limit");
            }catch{Add(unknown,i,kind,"trigger-unknown-limit");}
        }
        // Even after truncating explanatory arrays, at least one failure/unknown remains.
        return Result(failed.Count>0?"blocked":unknown.Count>0?"unknown":"ready");
    }
    private static string Limit(string? value,int max)=>value==null?"":value.Length>max?value[..max]:value;
}
