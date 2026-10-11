using System.Diagnostics;
using Microsoft.Xna.Framework;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Buildings;
using StardewValley.GameData.FarmAnimals;
using StardewValley.Internal;
using StardewValley.Locations;
using StardewValley.Objects;
using StardewValley.TerrainFeatures;
using StardewValley.TokenizableStrings;

namespace StardewThor.ReadOnly;

// Game-thread reads only, driven by JournalCollector's sliced location scan. Nothing here
// calls TV.getWeeklyRecipe (teaches the recipe), GetWeatherForLocation (creates state with
// Game1.random) or opens a shop menu. Merchant stock uses the game's own day-seeded builder.
internal sealed class FarmTally
{
    public const int GroupTiles=600;
    private sealed class Group{public string Name="";public string? Icon;public int Count,Extra;public int? Minutes;public readonly List<int> Tiles=new();}
    private readonly Dictionary<(string,string),Group> groups=new();
    private readonly Dictionary<string,string> names;
    public FarmTally(Dictionary<string,string> names)=>this.names=names;
    public bool Any=>groups.Count>0;
    public void Item(string kind,string id,Vector2 tile,int extra=0,int? minutes=null)=>Add(kind,id,null,null,tile,extra,minutes);
    public void Add(string kind,string id,string? name,string? icon,Vector2 tile,int extra=0,int? minutes=null)
    {
        if(!groups.TryGetValue((kind,id),out var g))
        {
            if(groups.Count>=256)return;
            g=groups[(kind,id)]=new Group{Name=Limit(name??ItemName(id),160),Icon=icon};
        }
        g.Count++;g.Extra+=extra;
        if(minutes!=null)g.Minutes=g.Minutes==null?minutes:Math.Min(g.Minutes.Value,minutes.Value);
        if(g.Tiles.Count<GroupTiles*2&&Math.Abs(tile.X)<=10000&&Math.Abs(tile.Y)<=10000){g.Tiles.Add((int)tile.X);g.Tiles.Add((int)tile.Y);}
    }
    // Hay: the count is the shortfall for residents, while tiles list every empty trough.
    public void SetHay(int missing,int residents){if(groups.TryGetValue(("hay","(O)178"),out var g)){g.Count=missing;g.Extra=residents;}}
    public string ItemName(string id)
    {
        if(!names.TryGetValue(id,out var name)){name=ItemRegistry.GetDataOrErrorItem(id).DisplayName;if(names.Count<2048)names[id]=name;}
        return name;
    }
    public FarmTask[] Tasks()=>groups.Select(p=>new FarmTask(p.Key.Item1,Limit(p.Key.Item2,160),p.Value.Name,p.Value.Count,p.Value.Tiles.ToArray(),
        p.Value.Extra==0?null:p.Value.Extra,p.Value.Minutes,p.Value.Icon==null?null:Limit(p.Value.Icon,160))).ToArray();

    // Crop.newDay growth, assuming the crop is watered every night from now on.
    public static int DaysToRipe(Crop c)
    {
        var days=c.phaseDays;int n=days.Count,phase=c.currentPhase.Value,day=c.dayOfCurrentPhase.Value;
        if(n==0)return 999;
        if(c.fullyGrown.Value)return phase>=n-1?Math.Max(0,day):999;
        if(phase>=n-1)return 0;
        int total=Math.Max(1,days[phase]-day);
        for(int i=phase+1;i<n-1&&total<999;i++)if(days[i]>0)total+=days[i];
        return Math.Min(total,999);
    }
    // Trough tiles never change for a loaded map; cache by map instance.
    private static readonly Dictionary<string,(object Map,Vector2[] Tiles)> troughs=new(StringComparer.Ordinal);
    public static Vector2[] Troughs(AnimalHouse house)
    {
        var map=house.map;if(map==null)return Array.Empty<Vector2>();
        var key=house.NameOrUniqueName;if(troughs.TryGetValue(key,out var cached)&&ReferenceEquals(cached.Map,map))return cached.Tiles;
        var list=new List<Vector2>();var back=map.GetLayer("Back");
        if(back!=null&&back.LayerWidth*back.LayerHeight<=16384)
            for(int x=0;x<back.LayerWidth;x++)for(int y=0;y<back.LayerHeight;y++)
                if(house.doesTileHaveProperty(x,y,"Trough","Back")!=null)list.Add(new(x,y));
        if(troughs.Count>=128)troughs.Clear();
        return (troughs[key]=(map,list.ToArray())).Tiles;
    }
    public static string? AnimalIcon(FarmAnimal a)
    {
        var id=a.GetAnimalData()?.ProduceItemIds?.FirstOrDefault()?.ItemId;
        return id==null?null:ItemRegistry.QualifyItemId(id)??id;
    }
    private static string Limit(string? s,int n)=>s==null?"":s.Length>n?s[..n]:s;
}

internal sealed class FarmOutlookReader
{
    private MerchantItem[] merchantStock=Array.Empty<MerchantItem>();private bool merchantLimited;
    public void Reset(){merchantStock=Array.Empty<MerchantItem>();merchantLimited=false;}

    public FarmOutlook Read(HashSet<string> limited)
    {
        int daysLeft=Math.Max(0,28-Game1.dayOfMonth);
        string next=((Season)(((int)Game1.season+1)%4)).ToString().ToLowerInvariant();
        string weather="";string? island=null;
        try
        {
            var tomorrow=new WorldDate(Game1.Date);tomorrow.TotalDays++;
            weather=Game1.getWeatherModificationsForDate(tomorrow,Game1.IsMasterGame?Game1.weatherForTomorrow:Game1.netWorldState.Value.WeatherForTomorrow)??"";
            if(Game1.player.hasOrWillReceiveMail("Visited_Island")&&Game1.netWorldState.Value.LocationWeather.TryGetValue("Island",out var iw))island=iw.WeatherForTomorrow;
        }catch{limited.Add("farm-weather-unavailable");}
        double luck=Game1.player.DailyLuck;
        int level=luck< -0.07?-2:luck< -0.02?-1:luck>0.07?2:luck>0.02?1:0;
        return new(daysLeft,next,Limit(weather,40),island==null?null:Limit(island,40),Math.Round(luck,4),level,Limit(Fortune(luck),600),
            Guard("sauce",Sauce,limited),Merchant(limited),Math.Max(0,Game1.getFarm()?.piecesOfHay.Value??0),Math.Max(0,Game1.getFarm()?.GetHayCapacity()??0),Guard("tool",Tool,limited));
    }
    private static T? Guard<T>(string name,Func<T?> read,HashSet<string> limited) where T:class{try{return read();}catch{limited.Add("farm-"+name+"-unavailable");return null;}}

    // TV.getFortuneForecast without its Game1.random pick in the mildly-unlucky band.
    private static string Fortune(double luck)
    {
        string S(string key)=>Game1.content.LoadString("Strings\\StringsFromCSFiles:TV.cs."+key);
        double shared=Game1.player.team.sharedDailyLuck.Value;
        if(luck==0.0)return S("13201");
        if(shared==-0.12)return S("13191");
        if(luck< -0.07)return S("13192");
        if(luck< -0.02)return S("13193");
        if(shared==0.12)return S("13197");
        return luck>0.07?S("13198"):luck>0.02?S("13199"):S("13200");
    }

    // The Queen of Sauce: Sundays by DaysPlayed week; Wednesday reruns use the team's
    // stored pick, or the same deterministic TV.getRerunWeek choice before anyone watches.
    private static SauceRecipe? Sauce()
    {
        var data=DataLoader.Tv_CookingChannel(Game1.content);int dow=Game1.dayOfMonth%7;uint played=Game1.stats.DaysPlayed;
        static int Week(uint days)=>days%224==0?32:(int)(days%224/7);
        int week,inDays=0;bool rerun=false;
        if(dow==0)week=Week(played);
        else if(dow==3){rerun=true;var team=Game1.player.team;week=team.lastDayQueenOfSauceRerunUpdated.Value==Game1.Date.TotalDays?team.queenOfSauceRerunWeek.Value:RerunWeek(data);}
        else{inDays=7-dow;week=Week(played+(uint)inDays);}
        if(!data.TryGetValue(week.ToString(),out var raw)&&!data.TryGetValue("1",out raw))return null;
        var key=raw.Split('/')[0];if(!CraftingRecipe.cookingRecipes.ContainsKey(key))return null;
        var recipe=new CraftingRecipe(key,true);
        return new(Limit(key,160),Limit(recipe.DisplayName,160),Limit(recipe.GetItemData(useFirst:true)?.QualifiedItemId,160),Game1.player.cookingRecipes.ContainsKey(key),inDays==0,rerun,inDays);
    }
    private static int RerunWeek(Dictionary<string,string> data)
    {
        int weeks=Math.Min((int)(Game1.stats.DaysPlayed-3)/7,32);
        var map=new Dictionary<int,string>();foreach(var pair in data)if(int.TryParse(pair.Key,out int w))map[w]=pair.Value.Split('/')[0];
        var farmers=Game1.getAllFarmers().Where(f=>f.isCustomized.Value&&!f.IsDedicatedPlayer).ToList();
        var missing=new List<int>();
        for(int i=1;i<=weeks;i++)if(map.TryGetValue(i,out var key)&&farmers.Any(f=>!f.cookingRecipes.ContainsKey(key)))missing.Add(i);
        var random=Utility.CreateDaySaveRandom();
        return missing.Count==0?Math.Max(1,1+random.Next(weeks)):missing[random.Next(missing.Count)];
    }

    private MerchantInfo Merchant(HashSet<string> limited)
    {
        int nextIn=0;for(int d=1;d<=28;d++){int day=(Game1.dayOfMonth+d-1)%28+1;if(day%7%5==0){nextIn=d;break;}}
        if(!MerchantStock.CartToday()){Reset();return new(false,nextIn,Array.Empty<MerchantItem>());}
        // Stock is prepared only at day start / save load (see MerchantStock); here we just
        // re-apply sold-out counts and read names in the current language, which is cheap.
        var stock=MerchantStock.Current();if(stock==null)return new(true,nextIn,Array.Empty<MerchantItem>());
        try
        {
            var cc=Game1.locations.OfType<CommunityCenter>().FirstOrDefault();
            bool bundles=cc!=null&&!Game1.MasterPlayer.mailReceived.Contains("JojaMember")&&!cc.areAllAreasComplete();
            var list=new List<MerchantItem>();merchantLimited=stock.Count>48;
            foreach(var (salable,info) in stock)
            {
                if(list.Count>=48)break;
                if(salable is not Item item)continue;
                bool bundle=false;if(bundles&&item is StardewValley.Object o)try{bundle=cc!.couldThisIngredienteBeUsedInABundle(o);}catch{bundles=false;}
                list.Add(new(Limit(item.QualifiedItemId,160),Limit(item.DisplayName,160),Math.Max(0,info.Price),info.Stock==int.MaxValue?-1:Math.Clamp(info.Stock,0,9999),bundle));
            }
            merchantStock=list.ToArray();
        }catch{limited.Add("farm-merchant-unavailable");merchantStock=Array.Empty<MerchantItem>();}
        return new(true,nextIn,merchantStock,merchantLimited);
    }
    private static ToolUpgrade? Tool()
    {
        var tool=Game1.player.toolBeingUpgraded.Value;
        return tool==null?null:new(Limit(tool.QualifiedItemId,160),Limit(tool.DisplayName,160),Math.Clamp(Game1.player.daysLeftForToolUpgrade.Value,0,99));
    }
    private static string Limit(string? s,int n)=>s==null?"":s.Length>n?s[..n]:s;
}

// Building the cart's stock resolves RANDOM_ITEMS over every object (~27 ms on a desktop), so it
// runs only while the game is already on a loading/new-day screen, never during play.
internal static class MerchantStock
{
    private static Dictionary<ISalable,ItemStockInformation>? stock;private static int day=-1;
    public static double BuildMs{get;private set;}
    public static bool CartToday()=>Game1.dayOfMonth%7%5==0||Utility.TryGetPassiveFestivalDataForDay(Game1.dayOfMonth,Game1.season,null,out var id,out _)&&id=="NightMarket";
    public static void Prepare()
    {
        stock=null;day=-1;BuildMs=0;
        if(!Context.IsWorldReady||!CartToday())return;
        var watch=Stopwatch.StartNew();
        // Stock and prices come from the day-seeded shop RNG, but each Object constructor also
        // draws from Game1.random (measured: 22 draws). Lend the builder a throwaway RNG.
        var shared=Game1.random;
        try{Game1.random=new Random(0);stock=ShopBuilder.GetShopStock("Traveler");day=Game1.Date.TotalDays;}
        catch{stock=null;}
        finally{Game1.random=shared;BuildMs=watch.Elapsed.TotalMilliseconds;}
    }
    // Re-applies units already bought (the game's own synced counts) to the cached stock.
    public static Dictionary<ISalable,ItemStockInformation>? Current()
    {
        if(stock==null||day!=Game1.Date.TotalDays)return null;
        Game1.player.team.synchronizedShopStock.UpdateLocalStockWithSyncedQuanitities("Traveler",stock);
        return stock;
    }
}

// Crop planner data from Game1.cropData and object data only: no item instances (their
// constructors draw from Game1.random), no shop menus. Cached per language; farmer stats live.
internal static class CropCatalog
{
    private static string key="";private static CropInfo[] crops=Array.Empty<CropInfo>();
    public static CropPlanner Read()
    {
        var language=LocalizedContentManager.CurrentLanguageCode.ToString();
        if(language!=key){crops=Build();key=language;}
        var p=Game1.player;
        return new(crops,Math.Clamp(p.FarmingLevel,0,100),p.professions.Contains(5),p.professions.Contains(1),Math.Round(Game1.MasterPlayer.difficultyModifier,3));
    }
    // Seeds a shop actually lists for gold (Data/Shops), Pierre's price preferred. Price -1 is the
    // default sale price (data price x2), UseObjectDataPrice the plain data price. Trades skipped.
    private static Dictionary<string,(int Price,bool Pierre)> ShopSeeds()
    {
        var map=new Dictionary<string,(int Price,bool Pierre)>(StringComparer.Ordinal);
        foreach(var (shopId,shop) in DataLoader.Shops(Game1.content))
        {
            if(shop?.Items==null)continue;
            foreach(var item in shop.Items)
            {
                if(item==null||item.TradeItemId!=null||string.IsNullOrEmpty(item.ItemId)||item.ItemId.Contains(' '))continue;
                var id=ItemRegistry.QualifyItemId(item.ItemId);if(id==null||!id.StartsWith("(O)")||!Game1.objectData.TryGetValue(id[3..],out var d)||d.Category!=-74)continue;
                int price=item.Price>=0?item.Price:item.UseObjectDataPrice?d.Price:d.Price*2;bool pierre=shopId=="SeedShop";
                if(price<=0)continue;
                if(!map.TryGetValue(id,out var old)||(pierre&&!old.Pierre)||(pierre==old.Pierre&&price<old.Price))map[id]=(price,pierre);
            }
        }
        return map;
    }
    private static CropInfo[] Build()
    {
        var list=new List<CropInfo>();var shops=ShopSeeds();
        foreach(var (seedId,c) in Game1.cropData)
        {
            if(list.Count>=256)break;
            if(c==null||string.IsNullOrEmpty(c.HarvestItemId)||c.DaysInPhase==null||c.DaysInPhase.Count is 0 or >12||c.Seasons==null||c.Seasons.Count==0)continue;
            string harvest=ItemRegistry.QualifyItemId(c.HarvestItemId)??c.HarvestItemId,seed=ItemRegistry.QualifyItemId(seedId)??seedId;
            if(!harvest.StartsWith("(O)")||!seed.StartsWith("(O)"))continue;
            if(!Game1.objectData.TryGetValue(harvest[3..],out var h)||!Game1.objectData.TryGetValue(seed[3..],out var s))continue;
            list.Add(new(Limit(seed,160),Limit(ItemRegistry.GetDataOrErrorItem(seed).DisplayName,160),Limit(harvest,160),Limit(ItemRegistry.GetDataOrErrorItem(harvest).DisplayName,160),
                c.Seasons.Select(x=>x.ToString().ToLowerInvariant()).Distinct().Take(4).ToArray(),c.DaysInPhase.Select(d=>Math.Clamp(d,0,999)).ToArray(),Math.Clamp(c.RegrowDays,-1,999),
                Math.Clamp(c.HarvestMinStack,1,999),Math.Clamp(Math.Max(c.HarvestMinStack,c.HarvestMaxStack),1,999),Math.Clamp((double)c.HarvestMaxIncreasePerFarmingLevel,0,10),Math.Clamp(c.ExtraHarvestChance,0,1),
                shops.TryGetValue(seed,out var sold)?Math.Clamp(sold.Price,0,1000000):0,Math.Clamp(h.Price,0,1000000),h.Category,c.IsPaddyCrop,c.IsRaised,c.PlantableLocationRules?.Count>0));
        }
        return list.OrderBy(x=>x.SeedId,StringComparer.Ordinal).ToArray();
    }
    private static string Limit(string? s,int n)=>s==null?"":s.Length>n?s[..n]:s;
}
