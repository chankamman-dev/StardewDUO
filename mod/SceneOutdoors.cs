using Microsoft.Xna.Framework;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Locations;
using StardewValley.Menus;
using StardewValley.Monsters;
using StardewValley.Objects;
using StardewValley.Tools;

namespace StardewThor.ReadOnly;

// Fishing and mine floors for the context page. Game-thread reads only: no items are created,
// no fish are rolled and no random draws are made (conditions that use randomness are skipped).
internal static class SceneOutdoors {
    internal static MineMonsterReader? Monsters {get;set;}
    // ---------- Fishing ----------
    public static bool Fishing(out FishingRod? rod){
        rod=Game1.player.CurrentTool as FishingRod;
        return rod!=null&&(rod.isFishing||rod.isCasting||rod.isTimingCast||rod.castedButBobberStillInAir||rod.isNibbling||rod.isReeling||rod.fishCaught||rod.showingTreasure||Game1.activeClickableMenu is BobberBar);
    }
    private static string? fishKey;private static SceneItem?[] fishHere=Array.Empty<SceneItem?>();private static bool fishLimited;
    internal static void Invalidate(){fishKey=null;fishHere=Array.Empty<SceneItem?>();fishLimited=false;}
    public static SceneState FishingScene(FishingRod rod,Func<Item,string?> icon){
        var f=Game1.player;var location=Game1.currentLocation;var bar=Game1.activeClickableMenu as BobberBar;
        string phase=rod.fishCaught||rod.showingTreasure?"caught":bar!=null||rod.isReeling?"reel":rod.isNibbling?"bite":rod.isFishing?"wait":"cast";
        var bait=rod.GetBait();var tackle=rod.GetTackle().FirstOrDefault(t=>t!=null);
        string? fishId=bar!=null?ItemRegistry.QualifyItemId(bar.whichFish):rod.fishCaught?rod.whichFish?.QualifiedItemId:null;
        string? fishName=fishId==null?null:ItemRegistry.GetDataOrErrorItem(fishId).DisplayName;
        // Fish area under the bobber (Forest river vs lake, etc.), when the bobber is in the water.
        string? area=null;if(rod.isFishing&&location.TryGetFishAreaForTile(rod.bobber.Value/64f,out var id,out _))area=id;
        var key=$"{location.NameOrUniqueName}|{area}|{Game1.timeOfDay/100}|{location.IsRainingHere()}|{f.FishingLevel}|{location.GetSeason()}|{LocalizedContentManager.CurrentLanguageCode}";
        if(key!=fishKey){fishKey=key;fishHere=FishHere(location,area,icon,out fishLimited);}
        var info=new SceneFishing(phase,bait?.QualifiedItemId,bait==null?null:Limit(bait.DisplayName,160),bait?.Stack??0,tackle?.QualifiedItemId,tackle==null?null:Limit(tackle.DisplayName,160),
            tackle==null?0:Math.Max(0,FishingRod.maxTackleUses-tackle.uses.Value),FishingRod.maxTackleUses,fishId,fishName==null?null:Limit(fishName,160),bar==null?0:(int)Math.Round(bar.difficulty),
            bar==null?(rod.fishCaught?1:0):Math.Clamp(bar.distanceFromCatching,0f,1f),bar?.treasure??false,bar?.treasureCaught??rod.treasureCaught,bar?.perfect??false,bar?.bossFish??rod.bossFish,
            fishId!=null&&f.fishCaught.ContainsKey(fishId));
        return new("fishing",Limit(location.NameOrUniqueName,80),Limit(location.DisplayName,160),0,fishHere,fishLimited,0,info);
    }
    // Fish this location (and the game's Default list) can give right now. The data's season,
    // min level, conditions, time window and weather are checked; conditions that draw random
    // numbers are not evaluated and remain possible candidates. Unknown/custom
    // predicates are not executed; omitted candidates make the report explicitly partial.
    private static SceneItem?[] FishHere(GameLocation location,string? area,Func<Item,string?> icon,out bool partial){
        partial=false;
        var f=Game1.player;var list=new List<SceneItem?>();var seen=new HashSet<string>();
        var fishData=DataLoader.Fish(Game1.content);
        var spawns=(location.GetData()?.Fish??new()).Concat(Game1.locationData.TryGetValue("Default",out var def)?def.Fish??new():new());
        bool rain=location.IsRainingHere();int time=Game1.timeOfDay;
        int inspected=0;foreach(var s in spawns){
            if(list.Count>=40||++inspected>4096){partial=true;break;}
            var id=ItemRegistry.QualifyItemId(s.ItemId);if(id==null||!id.StartsWith("(O)")||seen.Contains(id))continue;
            if(s.Season!=null&&s.Season!=location.GetSeason())continue;
            if(s.FishAreaId!=null&&area!=null&&s.FishAreaId!=area)continue;
            if(s.MinFishingLevel>f.FishingLevel||s.RequireMagicBait)continue;
            if(!Game1.objectData.TryGetValue(id[3..],out var od)||od.Category!=StardewValley.Object.FishCategory)continue;
            if(!string.IsNullOrWhiteSpace(s.Condition)){
                var flags=new HashSet<string>();var matches=EventTriggerReader.ReadQuery(s.Condition,location,flags,"fish");
                if(matches==false)continue;
                if(matches==null){partial=true;if(!flags.SetEquals(new[]{"fish-condition-random"}))continue;}
            }
            if(!s.IgnoreFishDataRequirements&&fishData.TryGetValue(id[3..],out var raw)){
                var p=raw.Split('/');
                if(p.Length>1&&p[1]=="trap")continue;
                if(p.Length>5){var t=p[5].Split(' ');bool open=false;for(int i=0;i+1<t.Length;i+=2)if(int.TryParse(t[i],out var a)&&int.TryParse(t[i+1],out var b)&&time>=a&&time<b)open=true;if(!open)continue;}
                if(p.Length>7&&((p[7]=="sunny"&&rain)||(p[7]=="rainy"&&!rain)))continue;
                if(p.Length>12&&int.TryParse(p[12],out var lvl)&&lvl>f.FishingLevel)continue;
            }
            seen.Add(id);var data=ItemRegistry.GetDataOrErrorItem(id);
            list.Add(new(list.Count,Limit(id,160),Limit(data.DisplayName,160),1,0,null,Limit(id,64),Math.Max(0,od.Price),-1,null,0,false,f.fishCaught.ContainsKey(id)));
        }
        return list.ToArray();
    }
    // ---------- Mines ----------
    // Node object -> the item it drops, for a floor summary (gems, ores, geodes).
    private static readonly Dictionary<string,string> Nodes=new(){
        ["(O)751"]="(O)378",["(O)849"]="(O)378",["(O)290"]="(O)380",["(O)850"]="(O)380",["(O)764"]="(O)384",["(O)765"]="(O)386",["(O)95"]="(O)909",
        ["(O)843"]="(O)848",["(O)844"]="(O)848",["(O)2"]="(O)72",["(O)4"]="(O)64",["(O)6"]="(O)70",["(O)8"]="(O)66",["(O)10"]="(O)68",["(O)12"]="(O)60",["(O)14"]="(O)62",
        ["(O)75"]="(O)535",["(O)76"]="(O)536",["(O)77"]="(O)537",["(O)819"]="(O)749",["(O)46"]="(O)46"};
    public static SceneState? MineScene(){
        var location=Game1.currentLocation;string area;int level,floor,lowest;bool ladder=false,shaft=false,mustKill=false;int stones=0;
        if(location is MineShaft mine){
            level=mine.mineLevel;area=level>MineShaft.bottomOfMineLevel?"skull":mine.isQuarryArea?"quarry":"mines";floor=area=="skull"?level-MineShaft.bottomOfMineLevel:level;
            lowest=MineShaft.lowestLevelReached;mustKill=mine.mustKillAllMonstersToAdvance();stones=Math.Max(0,mine.stonesLeftOnThisLevel);
            // Ladder (173) / shaft (174) tiles on the Buildings layer, as the game places them.
            var layer=mine.map?.GetLayer("Buildings");
            if(layer!=null)for(int y=0;y<layer.LayerHeight&&y<200;y++)for(int x=0;x<layer.LayerWidth&&x<200;x++){int t=layer.Tiles[x,y]?.TileIndex??-1;if(t==173)ladder=true;else if(t==174)shaft=true;}
        }else if(location is VolcanoDungeon volcano){level=volcano.level.Value;floor=level;area="volcano";lowest=level;}
        else return null;
        int monsters=location.characters.Count(c=>c is Monster m&&m.Health>0);
        var counts=new Dictionary<string,int>();
        foreach(var o in location.Objects.Values){
            string? drop=o is BreakableContainer?"(BC)118":o is Chest?"(BC)130":Nodes.TryGetValue(o.QualifiedItemId,out var d)?d:null;
            if(drop!=null)counts[drop]=counts.GetValueOrDefault(drop)+1;
        }
        var items=counts.OrderByDescending(p=>p.Value).Take(24).Select((p,i)=>(SceneItem?)new SceneItem(i,p.Key,Limit(ItemRegistry.GetDataOrErrorItem(p.Key).DisplayName,160),p.Value,0,null,Limit(p.Key,64))).ToArray();
        var detail=Monsters?.Read(location);
        var info=new SceneMine(area,level,floor,monsters,ladder,shaft,mustKill,lowest,stones,Math.Round(Game1.player.DailyLuck,3),detail?.Monsters,MineMonsterReader.FloorKind(location),detail?.Limited);
        return new("mine",Limit(location.NameOrUniqueName,80),Limit(location.DisplayName,160),0,items,false,0,null,info);
    }
    private static string Limit(string? s,int n)=>s is null?"":s.Length>n?s[..n]:s;
}
