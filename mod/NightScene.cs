using System.Diagnostics;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Menus;

namespace StardewThor.ReadOnly;

// From DayEnding to DayStarted: the player is asleep and the game runs the shipping summary,
// level-ups and the save. The shipping bin is read once at DayEnding, before the game empties it;
// prices come from the game's own sale-price rule (professions included). Read only.
// The game moves the date forward early in the night, so the day being ended is kept from DayEnding.
// After DayStarted the scene stays up as "waking" until the top screen has faded back in, so the
// lower screen can turn its night into the morning instead of losing the page mid-animation.
internal static class NightScene {
    public static bool Active{get;private set;}
    public static bool Waking{get;private set;}
    public static bool Visible=>Active||Waking;
    // SMAPI's Saving/Saved: the shipping menu saves inside itself, so the menu type alone misses it.
    public static bool Saving{get;set;}
    private static string? season;private static int day,year;private static long wakeAt;
    private static SceneItem?[] shipped=Array.Empty<SceneItem?>();private static int total,count;
    private static int[]? startXp,startLevels;
    private static NightSkill[]? skills;
    private static NightFriends? friends;
    internal static void StartDay(){
        startXp=Enumerable.Range(0,5).Select(i=>Game1.player.experiencePoints[i]).ToArray();
        startLevels=Enumerable.Range(0,5).Select(i=>Game1.player.GetUnmodifiedSkillLevel(i)).ToArray();
    }
    public static void DayEnding(){
        Active=true;Waking=false;Saving=false;season=Game1.currentSeason;day=Game1.dayOfMonth;year=Game1.year;var lines=new Dictionary<(string,int),(Item Item,int Stack,int Value)>();total=0;count=0;
        skills=null;friends=null;
        if(startXp!=null&&startLevels!=null)skills=Enumerable.Range(0,5).Select(i=>new NightSkill(i.ToString(),Math.Max(0,Game1.player.experiencePoints[i]-startXp[i]),startLevels[i],Game1.player.GetUnmodifiedSkillLevel(i),null)).ToArray();
        // A bound exceeded means omit the count; never silently report a partial total.
        if(Game1.player.friendshipData.Count()<=512)friends=new(Game1.player.friendshipData.Values.Count(f=>f.TalkedToToday),Game1.player.friendshipData.Values.Count(f=>f.GiftsToday>0));
        try{
            foreach(var item in Game1.getFarm().getShippingBin(Game1.player)){
                if(item==null)continue;int value=Utility.getSellToStorePriceOfItem(item,true);total+=value;count+=item.Stack;
                var key=(item.QualifiedItemId,item.Quality);lines[key]=lines.TryGetValue(key,out var l)?(l.Item,l.Stack+item.Stack,l.Value+value):(item,item.Stack,value);
            }
            shipped=lines.Values.OrderByDescending(l=>l.Value).Take(60).Select((l,i)=>(SceneItem?)new SceneItem(i,Limit(l.Item.QualifiedItemId,160),Limit(l.Item.DisplayName,160),Math.Max(1,l.Stack),l.Item.Quality,null,Limit(l.Item.QualifiedItemId,64),l.Stack>0?l.Value/l.Stack:0)).ToArray();
        }catch{shipped=Array.Empty<SceneItem?>();}
    }
    public static void DayStarted(){if(!Active){Clear();return;}Active=false;Saving=false;Waking=true;wakeAt=Stopwatch.GetTimestamp();}
    // Waking ends once the last night menu is gone and the fade is over (at least 0.3 s, at most 5 s).
    public static void Tick(){if(!Waking)return;double age=BridgeServer.Age(wakeAt);if(age>=5000||age>=300&&!Game1.globalFade&&Game1.activeClickableMenu==null&&Game1.fadeToBlackAlpha<=0.01f)Clear();}
    public static void Clear(){Active=false;Waking=false;Saving=false;season=null;shipped=Array.Empty<SceneItem?>();total=0;count=0;skills=null;friends=null;}
    public static SceneState Scene(){
        string phase=Waking?"waking":Saving?"saving":Game1.activeClickableMenu switch{ShippingMenu=>"shipping",LevelUpMenu=>"levelup",SaveGameMenu=>"saving",_=>"sleeping"};
        var summary=skills?.Select(s=>s with{PendingProfession=Game1.player.newLevels.Any(p=>p.X.ToString()==s.Id&&p.Y is 5 or 10)}).ToArray();
        return new("night","night",Limit(Game1.player.Name,120),0,shipped,false,0,null,null,new SceneNight(phase,Math.Max(0,total),Math.Max(0,count),string.IsNullOrEmpty(Game1.weatherForTomorrow)?null:Limit(Game1.weatherForTomorrow,40),summary,friends,Season:season==null?null:Limit(season,16),Day:season==null?null:day,Year:season==null?null:year));
    }
    private static string Limit(string? s,int n)=>s is null?"":s.Length>n?s[..n]:s;
}
