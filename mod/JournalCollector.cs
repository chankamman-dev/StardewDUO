using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Collections;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.Xna.Framework;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.GameData.Characters;
using StardewValley.Buildings;
using StardewValley.Objects;
using StardewValley.TerrainFeatures;
using StardewValley.TokenizableStrings;
using StardewValley.Tools;
using StardewValley.Quests;
using StardewValley.SpecialOrders;

namespace StardewThor.ReadOnly;

// Game-thread reads only. Do not instantiate menus (Billboard marks the board as read),
// call recipe.createItem (advances game RNG), or invoke quest completion/interaction APIs.
internal sealed class JournalCollector
{
    private CalendarEvent[] calendar=Array.Empty<CalendarEvent>();
    private CalendarEvent[]? calendarBase;
    private readonly List<(CalendarEvent Event,string? Condition,string Name)> passiveCalendar=new();
    private string calendarFriends="";
    internal int CalendarBuilds {get;private set;}
    private JournalQuest[] quests=Array.Empty<JournalQuest>();
    private JournalRecipe[] recipes=Array.Empty<JournalRecipe>();
    private EquipmentEntry[] equipment=Array.Empty<EquipmentEntry>();
    private QuestBoardState? board;
    private CharacterState? character;
    internal CustomSkillEntry[]? CustomSkills {get;set;}
    internal string[] CustomSkillsLimited {get;set;}=Array.Empty<string>();
    private readonly HashSet<string> limited=new(StringComparer.Ordinal);
    // The core's notes as of its last complete refresh. `limited` is refilled section by section, so
    // publishing it directly made marks appear and vanish mid-cycle (and the pushed journal change).
    private string[] coreLimited=Array.Empty<string>();
    private readonly Dictionary<string,ChoreSummary> chores=new(StringComparer.Ordinal);
    private readonly Dictionary<string,ChoreSummary> workingChores=new(StringComparer.Ordinal);
    private readonly Queue<GameLocation> pending=new();
    private LocationScan? locationScan;
    private readonly FarmOutlookReader outlook=new();
    private readonly Dictionary<string,string> itemNames=new(StringComparer.Ordinal);
    private readonly List<FarmPlace> workingPlaces=new();
    private readonly List<HarvestGroup> harvest=new();
    // Latest completed farm report; the bridge serializes it only on request.
    public FarmReport? Farm{get;private set;}
    private long lastCore,coreAt,scanStart,scanEnd;
    private int coreStage=-1;
    private CalendarEvent[] nextCalendar=Array.Empty<CalendarEvent>();private JournalQuest[] nextQuests=Array.Empty<JournalQuest>();
    private JournalRecipe[] nextRecipes=Array.Empty<JournalRecipe>();private EquipmentEntry[] nextEquipment=Array.Empty<EquipmentEntry>();private CharacterState? nextCharacter;private QuestBoardState? nextBoard;
    private readonly BoundedCache<string,(string Raw,bool Trapper,CraftingRecipe Recipe)> recipeTemplates=new(256);
    internal int RecipeBuilds{get;private set;}
    private int total,completed;
    private string context="";
    private bool scanLimited;

    public void Reset()
    {
        calendarBase=null;passiveCalendar.Clear();calendarFriends="";
        calendar=Array.Empty<CalendarEvent>();quests=Array.Empty<JournalQuest>();recipes=Array.Empty<JournalRecipe>();
        equipment=Array.Empty<EquipmentEntry>();limited.Clear();coreLimited=Array.Empty<string>();chores.Clear();workingChores.Clear();pending.Clear();locationScan=null;
        lastCore=coreAt=scanStart=scanEnd=0;coreStage=-1;recipeTemplates.Clear();total=completed=0;context="";scanLimited=false;board=null;character=null;
        nextCalendar=Array.Empty<CalendarEvent>();nextQuests=Array.Empty<JournalQuest>();nextRecipes=Array.Empty<JournalRecipe>();nextEquipment=Array.Empty<EquipmentEntry>();nextCharacter=null;nextBoard=null;
        workingPlaces.Clear();harvest.Clear();itemNames.Clear();outlook.Reset();Farm=null;
        passed.Clear();passOrder.Clear();workingPass.Clear();workingOrder.Clear();hotScan=null;hotWanted=0;lastLook=null;lastPlanner=null;lastOutlookNotes=Array.Empty<string>();
    }
    // Inventory commands invalidate just the cheap core, keeping the bounded
    // farm scan and its last completed results intact.
    public void InvalidateCore(){lastCore=0;coreStage=-1;}
    public void InvalidateCalendar(){calendarBase=null;InvalidateCore();}
    // Game data changed: recompute everything, but keep publishing the last complete journal and farm
    // report until the new pass is done (Reset would publish empty lists and drop the report first).
    public void Refresh(){calendarBase=null;passiveCalendar.Clear();calendarFriends="";recipeTemplates.Clear();itemNames.Clear();InvalidateCore();if(scanEnd!=0)scanEnd=1;}
    // A farm-only HTTP reader does not need calendar, quests, character or recipe scans.
    // Where the farm scan spends its time (phase 3 measurement): opening a location, building the report.
    private PerfStats? scanPerf;
    public FarmReport? CollectFarm(PerfStats? perf=null){scanPerf=perf;
        if(!Context.IsWorldReady){Reset();return null;}
        string current=$"{Game1.player.UniqueMultiplayerID}/{Game1.year}/{Game1.currentSeason}/{Game1.dayOfMonth}/{LocalizedContentManager.CurrentLanguageCode}";
        if(current!=context){Reset();context=current;}
        long mark=Stopwatch.GetTimestamp();ScanFarm();perf?.Mark("farm.scan",mark);return Farm;
    }
    public JournalState? Collect(PerfStats? perf=null,bool farm=true,bool force=false)
    {
        scanPerf=perf;
        if(!Context.IsWorldReady){Reset();return null;}
        string current=$"{Game1.player.UniqueMultiplayerID}/{Game1.year}/{Game1.currentSeason}/{Game1.dayOfMonth}/{LocalizedContentManager.CurrentLanguageCode}";
        if(current!=context){Reset();context=current;}
        if(force)coreStage=-1;
        if(coreStage<0&&(force||lastCore==0||BridgeServer.Age(lastCore)>=2000))
        {
            limited.RemoveWhere(s=>!s.StartsWith("farm-",StringComparison.Ordinal));
            coreStage=0;
        }
        // Readers keep the last complete core; never expose half a refresh. Commands
        // explicitly force the complete read before checking current game identities.
        for(int work=0;coreStage>=0&&work<(force?7:1);work++){
            long mark=Stopwatch.GetTimestamp();string section;
            switch(coreStage++){
                case 0:section="calendar";nextCalendar=Read(section,ReadCalendar,Array.Empty<CalendarEvent>());break;
                case 1:section="quests";nextQuests=Read(section,ReadQuests,Array.Empty<JournalQuest>());break;
                case 2:section="recipes";nextRecipes=Read(section,ReadRecipes,Array.Empty<JournalRecipe>());break;
                case 3:section="equipment";nextEquipment=Read(section,ReadEquipment,Array.Empty<EquipmentEntry>());break;
                case 4:section="character";nextCharacter=Read<CharacterState?>(section,ReadCharacter,null);break;
                case 5:section="board";nextBoard=Read<QuestBoardState?>(section,QuestBoard.Collect,null);break;
                default:section="budget";calendar=nextCalendar;quests=nextQuests;recipes=nextRecipes;equipment=nextEquipment;character=nextCharacter;board=nextBoard;
                    FitCoreBudget();coreAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();lastCore=Stopwatch.GetTimestamp();coreStage=-1;
                    coreLimited=limited.Where(x=>!x.StartsWith("farm-",StringComparison.Ordinal)).ToArray();break;
            }
            perf?.Mark("journal."+section,mark);
        }
        if(farm){long farmMark=Stopwatch.GetTimestamp();ScanFarm();perf?.Mark("journal.farm",farmMark);}
        if(character!=null)character=character with{CustomSkills=CustomSkills};
        foreach(var flag in CustomSkillsLimited)limited.Add(flag);
        return new(coreAt,calendar,quests,recipes,equipment,BoundedChores(),
            new(scanEnd==0?"scanning":scanLimited?"limited":"ready",completed,total,scanStart,scanEnd==0?null:scanEnd),coreLimited.Concat(limited.Where(x=>x.StartsWith("farm-",StringComparison.Ordinal))).Concat(CustomSkillsLimited).Distinct(StringComparer.Ordinal).OrderBy(s=>s,StringComparer.Ordinal).Take(16).ToArray(),board,character,QuestRewards.History(),Farm?.Version);
    }
    private CharacterState ReadCharacter()
    {
        var p=Game1.player;
        var skills=new[]{0,3,2,1,4}.Select(id=>{
            int level=Math.Clamp(p.GetUnmodifiedSkillLevel(id),0,10);
            var professions=new[]{5,10}.Select(tier=>{
                int profession=p.getProfessionForSkill(id,tier);
                if(profession<0||profession>=30)return null;
                var description=StardewValley.Menus.LevelUpMenu.getProfessionDescription(profession);
                string name=description.FirstOrDefault()??"", detail=string.Join("\n",description.Skip(1)).Trim();
                return new ProfessionEntry(profession,tier,name[..Math.Min(240,name.Length)],detail[..Math.Min(1200,detail.Length)]);
            }).Where(v=>v!=null).Cast<ProfessionEntry>().ToArray();
            int effective=Math.Clamp(p.GetSkillLevel(id),0,1000);
            string Effect(int suffix,int value)=>Game1.content.LoadString("Strings\\StringsFromCSFiles:SkillsPage.cs."+suffix,value);
            string effect=effective==0?"":id switch {0=>Effect(11592,effective)+"\n"+Effect(11594,effective),1=>Effect(11598,effective),2=>Effect(11596,effective),3=>Effect(11600,effective),_=>Effect(11602,effective*5)};
            return new SkillEntry(id,level,effective,Math.Max(0,p.experiencePoints[id]),Farmer.getBaseExperienceForLevel(level),level<10?Farmer.getBaseExperienceForLevel(level+1):null,professions,effect[..Math.Min(1200,effect.Length)]);
        }).ToArray();
        return new(skills,StardewValley.Menus.MasteryTrackerMenu.getCurrentMasteryLevel(),Game1.stats.Get("MasteryExp"));
    }
    // Architecture v2 phase 2: crafting availability follows the backpack and chests at once. Re-read
    // only the recipe section instead of waiting for the next 2 s core rotation.
    internal JournalRecipe[] RefreshRecipes(){var fresh=Read("recipes",ReadRecipes,recipes);recipes=fresh;nextRecipes=fresh;return fresh;}
    private T Read<T>(string section,Func<T> read,T fallback)
    {
        try{return read();}catch{limited.Add(section+"-unavailable");return fallback;}
    }
    private void FitCoreBudget()
    {
        // One bounded sizing pass per core refresh, never per 10-tick target update.
        // Reserve room in the 512 KiB envelope for the existing inventory/icons and tracking.
        int Size()=>Encoding.UTF8.GetByteCount(JsonSerializer.Serialize(new {calendar,quests,recipes,equipment},BridgeServer.Json));
        while(Size()>144*1024)
        {
            if(recipes.Length>0){recipes=recipes.Take(Math.Max(0,recipes.Length-16)).ToArray();limited.Add("recipes-budget");}
            else if(quests.Length>0){quests=quests.Take(quests.Length-1).ToArray();limited.Add("quests-budget");}
            else{limited.Add("journal-budget");break;}
        }
    }
    private ChoreSummary[] BoundedChores()
    {
        // Summaries remain complete even when only a small set of map details can be shown.
        int remaining=48;
        return chores.Values.OrderBy(c=>c.LocationId,StringComparer.Ordinal).Take(64).Select(c=>{
            int count=Math.Min(remaining,c.Details.Length);remaining-=count;
            return count==c.Details.Length?c:c with {Details=c.Details.Take(count).ToArray()};
        }).ToArray();
    }
    private CalendarEvent[] ReadCalendar()
    {
        // Dates/birthdays rebuild on context/content changes or a newly met resident.
        // Only dynamic passive-festival conditions retain the two-second cadence.
        string friends=string.Join("\n",Game1.player.friendshipData.Keys.OrderBy(s=>s,StringComparer.Ordinal));
        if(calendarBase==null||friends!=calendarFriends){
            passiveCalendar.Clear();calendarBase=BuildCalendar();calendarFriends=friends;CalendarBuilds++;
        }
        if(calendarBase.Length+passiveCalendar.Count>256)limited.Add("calendar-limit");
        return calendarBase.Concat(passiveCalendar.Select(p=>p.Event with {Name=EventTriggerReader.ReadQuery(p.Condition,Game1.currentLocation,limited,"calendar")==true?Limit(TokenParser.ParseText(p.Name),160):"???"}))
            .OrderBy(e=>Array.IndexOf(Seasons,e.Season)).ThenBy(e=>e.Day).ThenBy(e=>e.Id,StringComparer.Ordinal).Take(256).ToArray();
    }
    private CalendarEvent[] BuildCalendar()
    {
        var result=new List<CalendarEvent>();var seen=new HashSet<string>(StringComparer.Ordinal);int checkedNpcs=0;
        Utility.ForEachVillager(npc=>{
            if(++checkedNpcs>256){limited.Add("calendar-limit");return false;}
            var behavior=npc.GetData()?.Calendar;
            if(behavior==CalendarBehavior.HiddenAlways||behavior==CalendarBehavior.HiddenUntilMet&&!Game1.player.friendshipData.ContainsKey(npc.Name))return true;
            if(npc.Birthday_Day is >=1 and <=28&&Seasons.Contains(npc.Birthday_Season)&&seen.Add(npc.Name))
                result.Add(new(Limit("birthday/"+npc.Name,160),"birthday",npc.Birthday_Season,npc.Birthday_Day,Limit(TokenParser.ParseText(npc.GetData()?.DisplayName??npc.displayName),160),Limit(npc.Name,160)));
            return true;
        });
        for(int s=0;s<4;s++)for(int day=1;day<=28;day++)
        {
            var season=(Season)s;var key=Seasons[s]+day;
            if(Utility.isFestivalDay(day,season))
            {
                var data=Game1.content.Load<Dictionary<string,string>>("Data\\Festivals\\"+key);
                if(data.TryGetValue("name",out var title))result.Add(new(key,"festival",Seasons[s],day,Limit(title,160)));
            }
            if(Utility.TryGetPassiveFestivalDataForDay(day,season,null,out var id,out var passive,ignoreConditionsCheck:true)&&passive.ShowOnCalendar)
                passiveCalendar.Add((new(Limit(id+"/"+day,160),"festival",Seasons[s],day,"???"),passive.Condition,passive.DisplayName));
            if(s==1&&day is 20 or 21)result.Add(new("trout/"+day,"festival",Seasons[s],day,Limit(Game1.content.LoadString("Strings\\1_6_Strings:TroutDerby"),160)));
            if(s==3&&day is 12 or 13)result.Add(new("squid/"+day,"festival",Seasons[s],day,Limit(Game1.content.LoadString("Strings\\1_6_Strings:SquidFest"),160)));
        }
        // These native dates use a private seeded RNG; do not extrapolate to other seasons.
        foreach(int day in Utility.getDaysOfBooksellerThisSeason().Take(4))
            result.Add(new("bookseller/"+day,"bookseller",Game1.currentSeason,day,Limit(Game1.content.LoadString("Strings\\1_6_Strings:Bookseller"),160)));
        if(result.Count>256)limited.Add("calendar-limit");
        return result.OrderBy(e=>Array.IndexOf(Seasons,e.Season)).ThenBy(e=>e.Day).ThenBy(e=>e.Id,StringComparer.Ordinal).Take(256).ToArray();
    }
    private JournalQuest[] ReadQuests()
    {
        var result=new List<JournalQuest>();int seen=0;
        foreach(var q in Game1.player.questLog.Take(65))
        {
            if(++seen>64){limited.Add("quests-limit");break;}
            if(q==null||q.destroy.Value||q.IsHidden())continue;
            try{result.Add(ProjectQuest(q,seen));}
            catch{limited.Add("quests-partial");}
        }
        foreach(var order in Game1.player.team.specialOrders.Take(65))
        {
            if(result.Count>=64){limited.Add("quests-limit");break;}
            if(order.IsHidden()||order.readyForRemoval.Value||order.questState.Value==SpecialOrderStatus.Failed)continue;
            try{result.Add(ProjectOrder(order));}
            catch{limited.Add("quests-partial");}
        }
        return result.ToArray();
    }
    internal JournalQuest ProjectOrder(SpecialOrder order)=>new("order/"+QuestRewards.Identity(order),"order",Limit(OrderText(order,order.questName.Value),180),Limit(OrderText(order,order.questDescription.Value),1200),
        order.objectives.Take(12).Select(o=>new QuestObjective(Limit(OrderText(order,o.description.Value),400),Math.Max(0,o.GetCount()),Math.Max(0,o.GetMaxCount()))).ToArray(),
        Math.Clamp(order.GetDaysLeft(),0,9999),order.questState.Value==SpecialOrderStatus.Complete,QuestRewards.OrderMoney(order),ClaimKey:QuestRewards.Key(order));
    internal JournalQuest ProjectQuest(Quest q,int index)
    {
        // Normal quest description/objective getters can initialize net state and create items.
        // Read existing native text fragments instead; never call reloadDescription/reloadObjective.
        var data=Quest.GetRawQuestFields(q.id.Value);string Field(int at,string fallback)=>data?.Length>at&&!string.IsNullOrEmpty(data[at])?data[at]:fallback;
        string title=Field(1,q._questTitle),description=Field(2,q._questDescription),objective=Field(3,q._currentObjective);
        var fragments=q.GetType().GetField("parts")?.GetValue(q) as IEnumerable;
        if(fragments!=null){var parts=fragments.Cast<object>().OfType<DescriptionElement>().Take(32).Select(p=>p.loadDescriptionElement()).ToArray();if(parts.Length>0)description=string.Concat(parts);}
        var nativeObjective=ReadNet(q,"objective") as DescriptionElement;
        if(nativeObjective!=null)objective=nativeObjective.loadDescriptionElement();
        int? current=null,required=null;
        if(q is SocializeQuest social && social.total.Value>0){current=Math.Max(0,social.total.Value-social.whoToGreet.Count);required=social.total.Value;}
        else if(q is FishingQuest fish){current=fish.numberFished.Value;required=fish.numberToFish.Value;if(string.IsNullOrEmpty(objective))objective=ItemRegistry.GetDataOrErrorItem(fish.ItemId.Value).DisplayName;}
        else foreach(var pair in new[]{("numberKilled","numberToKill"),("numberCollected","number"),("numberHarvested","number")})
            if(ReadNet(q,pair.Item1) is int have&&ReadNet(q,pair.Item2) is int need){current=have;required=need;break;}
        if(string.IsNullOrEmpty(title)){title=LocalizedContentManager.CurrentLanguageCode==LocalizedContentManager.LanguageCode.zh?"任务":"Quest";limited.Add("quests-text-pending");}
        var objectives=string.IsNullOrEmpty(objective)&&current==null?Array.Empty<QuestObjective>():new[]{new QuestObjective(Limit(objective,400),current==null?null:Math.Max(0,current.Value),required==null?null:Math.Max(0,required.Value))};
        return new("quest/"+QuestRewards.Identity(q),"quest",Limit(title,180),Limit(description,1200),objectives,
            q.dailyQuest.Value||q.daysLeft.Value>0?Math.Clamp(q.daysLeft.Value,0,9999):null,q.completed.Value,Math.Max(0,q.moneyReward.Value),Limit(q.rewardDescription.Value?.Trim() is { } reward && reward!="-1"?reward:"",400),
            ReadNet(q,"target") is string npc && npc!="null"?Limit(npc,120):null,QuestRewards.Key(q));
    }
    private static object? ReadNet(object owner,string field)
    {
        var net=owner.GetType().GetField(field,BindingFlags.Public|BindingFlags.Instance)?.GetValue(owner);
        return net?.GetType().GetProperty("Value")?.GetValue(net);
    }
    private string OrderText(SpecialOrder order,string raw)
    {
        // Resolve the already-selected order tokens using item data, never ItemRegistry.Create.
        string text=SpecialOrder.MakeLocalizationReplacements(raw??"");var data=order.GetData();int tokens=0;
        return Regex.Replace(text,@"\{([^{}]+)\}",m=>{
            if(++tokens>32){limited.Add("quests-text-limit");return "???";}
            var parts=m.Groups[1].Value.Split(':',2);var key=parts[0];string? choice=parts.Length>1?parts[1]:null;
            if(order.preSelectedItems.TryGetValue(key,out var itemId))
            {
                string name=ItemRegistry.GetDataOrErrorItem(itemId).DisplayName;
                if(choice=="Text")return name;
                if(choice=="TextPlural")return StardewValley.BellsAndWhistles.Lexicon.makePlural(name);
                if(choice=="TextPluralCapitalized")return Utility.capitalizeFirstLetter(StardewValley.BellsAndWhistles.Lexicon.makePlural(name));
            }
            if(order.selectedRandomElements.TryGetValue(key,out var selected))
            {
                var values=data?.RandomizedElements?.FirstOrDefault(e=>e.Name==key)?.Values;
                if(values!=null&&selected>=0&&selected<values.Count)
                {
                    string value=SpecialOrder.MakeLocalizationReplacements(values[selected].Value);
                    if(choice==null)return value;var options=value.Split('|');for(int i=0;i+1<options.Length;i+=2)if(options[i]==choice)return options[i+1];
                }
            }
            limited.Add("quests-token-unavailable");return "???";
        },RegexOptions.None,TimeSpan.FromMilliseconds(20));
    }
    private JournalRecipe[] ReadRecipes()
    {
        var result=new List<JournalRecipe>();
        bool cacheable=typeof(CraftingRecipe).GetConstructors().All(c=>HarmonyLib.Harmony.GetPatchInfo(c)?.Owners.Any()!=true);
        foreach(bool cooking in new[]{false,true})
        {
            var known=cooking?Game1.player.cookingRecipes:Game1.player.craftingRecipes;
            var data=cooking?CraftingRecipe.cookingRecipes:CraftingRecipe.craftingRecipes;
            foreach(var key in known.Keys.OrderBy(k=>k,StringComparer.Ordinal).Take(257))
            {
                if(result.Count>=256){limited.Add("recipes-limit");break;}
                if(!data.ContainsKey(key)){limited.Add("recipes-unknown");continue;}
                try
                {
                    var templateKey=(cooking?"cooking/":"crafting/")+key;bool trapper=Game1.player.professions.Contains(7);
                    // A patched constructor can depend on arbitrary mod state: bypass
                    // reuse in that case. Native templates depend on raw data and Trapper.
                    CraftingRecipe r;
                    bool stable=cacheable&&!data[key].Contains('[')&&!data[key].Contains("{{",StringComparison.Ordinal);
                    if(stable&&recipeTemplates.TryGetValue(templateKey,out var cached)&&cached.Raw==data[key]&&cached.Trapper==trapper)r=cached.Recipe;
                    else{r=new CraftingRecipe(key,cooking);RecipeBuilds++;if(stable)recipeTemplates[templateKey]=(data[key],trapper,r);}
                    if(r.recipeList.Count>12||r.itemToProduce.Count!=1){limited.Add("recipes-unsupported");continue;}
                    var ingredients=r.recipeList.Select(p=>new RecipeIngredient(Limit(p.Key.StartsWith('-')?p.Key:ItemRegistry.QualifyItemId(p.Key)??p.Key,160),
                        Limit(r.getNameFromIndex(p.Key),160),Math.Clamp(p.Value,1,999999),Owned(p.Key))).ToArray();
                    var availability=cooking?((int MaxCrafts,string Reason)?)null:CraftingControl.Preview(r);
                    result.Add(new(Limit(key,160),cooking?"cooking":"crafting",Limit(r.DisplayName,180),Limit(r.GetItemData(useFirst:true).QualifiedItemId,160),
                        Math.Clamp(r.numberProducedPerCraft,1,9999),ingredients,Math.Clamp(r.getCraftableCount((IList<Item>)Array.Empty<Item>()),0,999999),availability?.MaxCrafts,availability?.Reason,Limit(r.GetItemData(useFirst:true).Description,1200)));
                }catch{limited.Add("recipes-partial");}
            }
        }
        return result.ToArray();
    }
    private EquipmentEntry[] ReadEquipment()
    {
        var p=Game1.player;var result=new List<EquipmentEntry>();
        if(p.trinketItems.Count>1)limited.Add("equipment-trinket-limit");
        var items=new (string,Item?)[]{("hat",p.hat.Value),("shirt",p.shirtItem.Value),("pants",p.pantsItem.Value),("boots",p.boots.Value),("leftRing",p.leftRing.Value),("rightRing",p.rightRing.Value),("tool",p.CurrentTool),("trinket",p.trinketItems.FirstOrDefault())};
        foreach(var (slot,item) in items)
        {
            if(item==null)continue;
            try
            {
                var fields=new List<TargetField>();
                if(item is Boots b){fields.Add(new("defense",b.defenseBonus.Value.ToString()));fields.Add(new("immunity",b.immunityBonus.Value.ToString()));}
                if(item is Tool tool)fields.Add(new("upgrade",tool.UpgradeLevel.ToString()));
                if(item is MeleeWeapon w){fields.Add(new("damage",$"{w.minDamage.Value}–{w.maxDamage.Value}"));fields.Add(new("speed",w.speed.Value.ToString()));fields.Add(new("defense",w.addedDefense.Value.ToString()));}
                result.Add(new(slot,Limit(item.QualifiedItemId,160),Limit(item.DisplayName,180),Limit(item.getDescription(),1200),fields.ToArray()));
            }catch{limited.Add("equipment-partial");}
        }
        return result.ToArray();
    }
    private void StartScan()
    {
        workingChores.Clear();workingPlaces.Clear();harvest.Clear();workingPass.Clear();workingOrder.Clear();pending.Clear();locationScan=null;completed=0;scanEnd=0;scanStart=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();scanLimited=false;
        limited.RemoveWhere(s=>s.StartsWith("farm-",StringComparison.Ordinal));
        var locations=new List<GameLocation>();var seen=new HashSet<string>(StringComparer.Ordinal);
        Utility.ForEachLocation(l=>{if(!seen.Add(l.NameOrUniqueName)||!Known(l))return true;if(locations.Count>=256){scanLimited=true;limited.Add("farm-location-limit");return false;}locations.Add(l);return true;},includeInteriors:true,includeGenerated:false);
        foreach(var l in locations.OrderByDescending(l=>l==Game1.currentLocation).ThenByDescending(l=>l.IsFarm))pending.Enqueue(l);
        total=pending.Count;
    }
    // Only places this player knows: the farm and its buildings and greenhouse, plus anywhere they
    // have actually entered (Game1.OnLocationChanged records locationsVisited by Name). Mod areas
    // with pre-placed wild trees (e.g. an unvisited Custom_Highlands) stay out of the chores.
    private static bool Known(GameLocation l)=>l.IsFarm||l.IsGreenhouse||l is StardewValley.Locations.FarmHouse||l.ParentBuilding!=null||Game1.player.locationsVisited.Contains(l.Name);
    // Each location's part of the last complete pass. After the player acts (a tool swing, a harvest, an
    // item placed or picked up) the location they stand in is read again on its own and swapped in, so
    // the farm page follows within a second instead of waiting for the next full pass of every place.
    // A full pass that read that location before the action does not overwrite the newer reading.
    private sealed record PassEntry(FarmPlace? Place,HarvestGroup[] Harvest,ChoreSummary? Chore,long At);
    private readonly Dictionary<string,PassEntry> passed=new(StringComparer.Ordinal),workingPass=new(StringComparer.Ordinal);
    private readonly List<string> passOrder=new(),workingOrder=new();
    private LocationScan? hotScan;private long hotWanted;private FarmOutlook? lastLook;private CropPlanner? lastPlanner;private string[] lastOutlookNotes=Array.Empty<string>();
    /// The player just acted: read the location they are in again (after the action has applied).
    public void Touch()=>hotWanted=Stopwatch.GetTimestamp();
    private static PassEntry Entry(LocationScan scan,ChoreSummary s)=>new(scan.Tally.Any?new(s.LocationId,s.Location,scan.Tally.Tasks()):null,scan.Harvest.Values.Take(256).ToArray(),s.CropsReady+s.CropsDry+s.MachinesReady+s.AnimalsUnpetted>0?s:null,Stopwatch.GetTimestamp());
    private FarmReport Publishable(long version,bool reuse){
        var places=passOrder.Select(id=>passed[id].Place).Where(p=>p!=null).Select(p=>p!).ToList();if(places.Count>128){places=places.Take(128).ToList();limited.Add("farm-summary-limit");}
        var crops=passOrder.SelectMany(id=>passed[id].Harvest).ToList();if(crops.Count>256){crops=crops.Take(256).ToList();limited.Add("farm-harvest-limit");}
        chores.Clear();foreach(var id in passOrder)if(passed[id].Chore is {} c&&chores.Count<64)chores[id]=c;
        return BuildFarm(places,crops,version,reuse);}
    private void ScanHere(){
        if(hotWanted!=0&&hotScan==null&&passed.Count>0&&BridgeServer.Age(hotWanted)>=60){hotWanted=0;var here=Game1.currentLocation;
            if(here!=null&&passed.ContainsKey(here.NameOrUniqueName))try{hotScan=new(here,new FarmTally(itemNames));}catch{hotScan=null;}}
        if(hotScan==null)return;
        try{var watch=Stopwatch.StartNew();bool more=true;while(watch.Elapsed.TotalMilliseconds<2.5&&(more=hotScan.ReadNext())){}
            if(more)return;
            hotScan.Finish();var s=hotScan.Summary();passed[s.LocationId]=Entry(hotScan,s);hotScan=null;
            long built=Stopwatch.GetTimestamp();var next=Publishable(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),true);if(!SameFarm(Farm,next))Farm=next;scanPerf?.Mark("farm.here",built);
        }catch{hotScan=null;}
    }
    private void ScanFarm()
    {
        ScanHere();
        if(scanStart==0||scanEnd!=0&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()-scanEnd>=5000)StartScan();
        if(scanEnd!=0)return;
        // At most 256 entity reads and 8 locations per tick; cap any one map at 8192 entries/type.
        // Snapshot dictionaries before yielding so player actions cannot invalidate enumerators.
        int reads=0,locations=0;var watch=Stopwatch.StartNew();
        while(reads<256&&locations<8&&watch.Elapsed.TotalMilliseconds<3)
        {
            if(locationScan==null)
            {
                if(pending.Count==0)
                {
                    // Publish the completed pass atomically: never flash empty or half a farm
                    // during a refresh. A completed empty pass also removes prior chores.
                    foreach(var id in workingOrder)if(passed.TryGetValue(id,out var newer)&&newer.At>workingPass[id].At)workingPass[id]=newer;
                    passed.Clear();passOrder.Clear();foreach(var id in workingOrder){passed[id]=workingPass[id];passOrder.Add(id);}
                    scanEnd=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    long built=Stopwatch.GetTimestamp();try{var next=Publishable(scanEnd,false);if(!SameFarm(Farm,next))Farm=next;}catch{limited.Add("farm-report-unavailable");}scanPerf?.Mark("farm.build",built);
                    return;
                }
                long opened=Stopwatch.GetTimestamp();var nextLocation=pending.Dequeue();try{locationScan=new(nextLocation,new FarmTally(itemNames));scanPerf?.Mark("farm.open",opened);if(locationScan.Limited){scanLimited=true;limited.Add("farm-entity-limit");}}
                catch{scanLimited=true;limited.Add("farm-unavailable");completed++;locations++;continue;}
            }
            try
            {
                if(locationScan.ReadNext()){reads++;continue;}
                locationScan.Finish();
                foreach(var g in locationScan.Harvest.Values){if(harvest.Count<256)harvest.Add(g);else limited.Add("farm-harvest-limit");}
                var summary=locationScan.Summary();
                if(!workingPass.ContainsKey(summary.LocationId))workingOrder.Add(summary.LocationId);workingPass[summary.LocationId]=Entry(locationScan,summary);
                if(summary.CropsReady+summary.CropsDry+summary.MachinesReady+summary.AnimalsUnpetted>0)
                {
                    if(workingChores.Count<64)workingChores[summary.LocationId]=summary;
                    else{scanLimited=true;limited.Add("farm-summary-limit");}
                }
                if(locationScan.Tally.Any)
                {
                    if(workingPlaces.Count<128)workingPlaces.Add(new(summary.LocationId,summary.Location,locationScan.Tally.Tasks()));
                    else{scanLimited=true;limited.Add("farm-summary-limit");}
                }
            }
            catch{scanLimited=true;limited.Add("farm-partial");}
            locationScan=null;completed++;locations++;
        }
    }
    // Tiles are what makes a report large: keep today's chores first, then forecasts.
    // A rescan every 5 s stamps a new Version/CollectedAt even when nothing on the farm changed; keep the
    // previous report then, so the lower screen is not told to download an identical report again.
    private static bool SameFarm(FarmReport? a,FarmReport b)=>a!=null&&System.Text.Json.JsonSerializer.Serialize(a with{Version=0,CollectedAt=0},BridgeServer.Json)==System.Text.Json.JsonSerializer.Serialize(b with{Version=0,CollectedAt=0},BridgeServer.Json);
    private FarmReport BuildFarm(List<FarmPlace> source,List<HarvestGroup> crops,long version,bool reuse)
    {
        string[] order={"cropReady","cropDry","machine","grabber","animalPet","animalHarvest","animalProduct","hay","petBowl","fruitTree","cropTomorrow","machineSoon","cropWither"};
        int budget=8000;bool trimmed=false;
        var tasks=source.SelectMany((p,i)=>p.Tasks.Select(t=>(Place:i,Task:t))).OrderBy(x=>Array.IndexOf(order,x.Task.Kind) is var k&&k<0?99:k).ThenByDescending(x=>x.Task.Count).ToList();
        var kept=new Dictionary<FarmTask,FarmTask>(ReferenceEqualityComparer.Instance);
        foreach(var (_,task) in tasks)
        {
            int pairs=Math.Min(budget,task.Tiles.Length/2);budget-=pairs;
            if(pairs*2<task.Tiles.Length)trimmed=true;
            kept[task]=pairs*2==task.Tiles.Length?task:task with{Tiles=task.Tiles.Take(pairs*2).ToArray()};
        }
        var places=source.Select(p=>p with{Tasks=p.Tasks.Select(t=>kept[t]).ToArray()}).ToArray();
        var notes=new HashSet<string>(StringComparer.Ordinal);if(trimmed)notes.Add("farm-tiles-limit");
        if(source.Any(p=>p.Tasks.Any(t=>t.Tiles.Length/2<t.Count)))notes.Add("farm-group-tiles-limit");
        // Weather, luck, the cart and the planner do not change with a tool swing: a single-location
        // refresh reuses them (reading them is most of what made a report take 115 ms on the Thor).
        FarmOutlook? look;if(reuse&&lastLook!=null){look=lastLook;foreach(var n in lastOutlookNotes)notes.Add(n);}
        else{var own=new HashSet<string>(StringComparer.Ordinal);look=null;try{look=outlook.Read(own);}catch{own.Add("farm-outlook-unavailable");}lastLook=look;lastOutlookNotes=own.ToArray();foreach(var n in own)notes.Add(n);}
        foreach(var n in limited.Where(s=>s.StartsWith("farm-",StringComparison.Ordinal)))notes.Add(n);
        CropPlanner? planner=reuse?lastPlanner:null;if(planner==null){try{planner=CropCatalog.Read();}catch{notes.Add("farm-planner-unavailable");}lastPlanner=planner;}
        return new(version,version,scanLimited?"limited":"ready",places,look,notes.OrderBy(s=>s,StringComparer.Ordinal).Take(16).ToArray(),planner,new HarvestCalendar(Game1.year,(int)Game1.season,Game1.dayOfMonth,crops.ToArray()));
    }
    private sealed class LocationScan
    {
        private readonly GameLocation location;
        private readonly KeyValuePair<Vector2,TerrainFeature>[] terrain;
        private readonly KeyValuePair<Vector2,StardewValley.Object>[] objects;
        private readonly FarmAnimal[] animals;
        private readonly Building[] buildings;
        private readonly List<ChoreEntry> details=new();
        private readonly Vector2[] troughs;
        private readonly Season? witherAfter;
        private readonly int daysLeft;
        private int index,ready,dry,machines,unpatted,hay;
        public bool Limited{get;}
        public FarmTally Tally{get;}
        public Dictionary<(string,int,int),HarvestGroup> Harvest{get;}=new();
        public LocationScan(GameLocation l,FarmTally tally)
        {
            location=l;Tally=tally;terrain=l.terrainFeatures.Pairs.Take(8192).ToArray();objects=l.Objects.Pairs.Take(8192).ToArray();animals=l.animals.Values.Take(8192).ToArray();
            buildings=l.buildings.Take(512).ToArray();
            Limited=l.terrainFeatures.Count()>8192||l.Objects.Length>8192||l.animals.Length>8192;
            troughs=l is AnimalHouse house&&house.animalsThatLiveHere.Count>0?FarmTally.Troughs(house):Array.Empty<Vector2>();
            // Crop.newDay kills outdoor crops out of season; context season overrides never roll over.
            daysLeft=Math.Max(0,28-Game1.dayOfMonth);
            if(l.isOutdoors.Value&&!l.SeedsIgnoreSeasonsHere()&&l.GetSeason()==Game1.season)witherAfter=(Season)(((int)Game1.season+1)%4);
        }
        public bool ReadNext()
        {
            int i=index++;
            if(i<terrain.Length)
            {
                var p=terrain[i];if(!location.terrainFeatures.TryGetValue(p.Key,out var live)||!ReferenceEquals(live,p.Value))return true;
                if(live is HoeDirt dirt)Plant(dirt,p.Key);
                else if(live is FruitTree tree&&tree.fruit.Count>0&&tree.fruit[0] is {} fruit)Tally.Item("fruitTree",fruit.QualifiedItemId,p.Key,tree.fruit.Count);
                return true;
            }
            i-=terrain.Length;
            if(i<objects.Length)
            {
                var p=objects[i];if(!location.Objects.TryGetValue(p.Key,out var live)||!ReferenceEquals(live,p.Value))return true;
                if(live is IndoorPot pot&&pot.hoeDirt.Value is {} dirt)Plant(dirt,p.Key);
                if(live.QualifiedItemId=="(BC)165")
                {
                    if(live.heldObject.Value is Chest chest){int n=0;foreach(var item in chest.Items)if(item!=null)n+=Math.Max(1,item.Stack);if(n>0)Tally.Add("grabber",live.QualifiedItemId,live.DisplayName,null,p.Key,n);}
                    return true;
                }
                bool machine=live.GetMachineData()!=null||live is CrabPot;
                if(machine&&live.readyForHarvest.Value){machines++;Detail("machine",live.QualifiedItemId,live.DisplayName,p.Key);Tally.Add("machine",live.QualifiedItemId,live.DisplayName,null,p.Key);}
                else if(machine&&live.heldObject.Value!=null&&live.MinutesUntilReady is >0 and <100000)Tally.Add("machineSoon",live.QualifiedItemId,live.DisplayName,null,p.Key,0,live.MinutesUntilReady);
                if(live.IsSpawnedObject&&(location is AnimalHouse||live.QualifiedItemId=="(O)430"))Tally.Add("animalProduct",live.QualifiedItemId,live.DisplayName,null,p.Key);
                if(live.QualifiedItemId=="(O)178"&&Array.IndexOf(troughs,p.Key)>=0)hay++;
                return true;
            }
            i-=objects.Length;
            if(i<animals.Length)
            {
                var a=animals[i];if(!location.animals.ContainsKey(a.myID.Value))return true;
                if(!a.wasPet.Value){unpatted++;Detail("animal",a.myID.Value.ToString(),a.displayName,a.Tile);Tally.Add("animalPet",a.type.Value??"",a.displayType,FarmTally.AnimalIcon(a),a.Tile);}
                if(a.currentProduce.Value is {} produce&&a.isAdult()&&a.GetHarvestType()==StardewValley.GameData.FarmAnimals.FarmAnimalHarvestType.HarvestWithTool)
                    Tally.Item("animalHarvest",ItemRegistry.QualifyItemId(produce)??produce,a.Tile);
                return true;
            }
            i-=animals.Length;
            if(i<buildings.Length)
            {
                if(buildings[i] is StardewValley.Buildings.PetBowl bowl&&bowl.HasPet()&&!bowl.watered.Value&&bowl.daysOfConstructionLeft.Value<=0)
                    Tally.Add("petBowl","petBowl",TokenParser.ParseText(bowl.GetData()?.Name??"")is {Length:>0} n?n:"Pet Bowl",null,new(bowl.tileX.Value+bowl.tilesWide.Value/2,bowl.tileY.Value+Math.Max(0,bowl.tilesHigh.Value-1)));
                return true;
            }
            return false;
        }
        private void Plant(HoeDirt dirt,Vector2 tile)
        {
            var c=dirt.crop;if(c==null||c.forageCrop.Value||c.dead.Value||!c.IsInSeason(location))return;
            bool ripe=c.currentPhase.Value>=c.phaseDays.Count-1&&(!c.fullyGrown.Value||c.dayOfCurrentPhase.Value<=0);
            bool needsWater=!c.forageCrop.Value&&c.GetData()?.NeedsWatering!=false&&dirt.state.Value!=1&&!ripe;
            string id=ItemRegistry.QualifyItemId(c.indexOfHarvest.Value)??c.indexOfHarvest.Value;
            int grow=ripe?0:FarmTally.DaysToRipe(c);
            int estimate=grow;
            if(witherAfter!=null){for(int d=29-Game1.dayOfMonth;d<=grow;d+=28){var season=(Season)(((int)Game1.season+(Game1.dayOfMonth-1+d)/28)%4);if(c.GetData()?.Seasons?.Contains(season)!=true){estimate=-1;break;}}}
            int regrow=Math.Clamp(c.GetData()?.RegrowDays??0,0,999);
            var key=(id,estimate,regrow);
            if(Harvest.TryGetValue(key,out var group))Harvest[key]=group with{Count=group.Count+1,Dry=group.Dry+(needsWater?1:0)};
            else if(Harvest.Count<256)Harvest[key]=new(Limit(location.DisplayName,180),Limit(id,160),Limit(Tally.ItemName(id),160),estimate,1,needsWater?1:0,regrow);
            if(!ripe&&grow==1)Tally.Item("cropTomorrow",id,tile,needsWater?1:0);
            if(witherAfter is {} next&&c.GetData()?.Seasons?.Contains(next)!=true)Tally.Item("cropWither",id,tile,!ripe&&grow>daysLeft?1:0);
            if(!ripe&&!needsWater)return;
            if(ripe){ready++;Detail("cropReady",id,Tally.ItemName(id),tile);Tally.Item("cropReady",id,tile);}
            if(needsWater){dry++;Detail("cropDry",id,Tally.ItemName(id),tile);Tally.Item("cropDry",id,tile);}
        }
        // Empty troughs only matter while hay is short of this building's residents.
        public void Finish()
        {
            if(location is not AnimalHouse house||troughs.Length==0)return;
            int residents=house.animalsThatLiveHere.Count,missing=Math.Min(troughs.Length,residents)-hay;if(missing<=0)return;
            foreach(var tile in troughs)if(!location.Objects.ContainsKey(tile))Tally.Add("hay","(O)178",null,null,tile,0);
            Tally.SetHay(missing,residents);
        }
        private void Detail(string kind,string id,string name,Vector2 tile){if(details.Count<12&&Math.Abs(tile.X)<=10000&&Math.Abs(tile.Y)<=10000)details.Add(new(kind,Limit(id,160),Limit(name,160),(int)tile.X,(int)tile.Y));}
        public ChoreSummary Summary()=>new(Limit(location.NameOrUniqueName,160),Limit(location.DisplayName,180),ready,dry,machines,unpatted,details.ToArray());
    }
    private static readonly string[] Seasons={"spring","summer","fall","winter"};
    // Same category/wild-seed matching as the crafting UI, inventory only (no chest or wallet).
    private static int Owned(string id)=>(int)Math.Min(999999,Game1.player.Items.OfType<StardewValley.Object>().Where(i=>CraftingRecipe.ItemMatchesForCrafting(i,id)).Sum(i=>(long)Math.Max(0,i.Stack)));
    private static string Limit(string? s,int n)=>s==null?"":s.Length>n?s[..n]:s;
}
