using System.Diagnostics;
using System.Text.Json;
using StardewModdingAPI;
using StardewValley;
using StardewThor.Bridge;

namespace StardewThor.ReadOnly;

public sealed class ModEntry : Mod
{
    private BridgeServer? server;
    private string session=Guid.NewGuid().ToString("N"), lastBag="", language="";
    private long seq, revision, lastScan,lastTracking;
    // Persistent run log (architecture v2, phase 0): see bridge/RunLog.cs.
    private bool wasSwinging;
    private RunLog? runLog;private long slowCursor;private string lastScene="";
    // Architecture v2 phase 2: a slot is rebuilt only when its item changed; the periodic scan only
    // compares references. Changes are collected on the next tick instead of the 10-tick cadence.
    private readonly Dictionary<int,(Item Item,int Stack,int Quality,string Name,int Upgrade,int Enchantments,Slot Slot)> slotCache=new();
    private bool recipesDirty,sceneDirty;private long slotCacheAt;
    private bool dirty=true;
    private Bag? bag;
    private SocialEntry[]? social;
    private readonly BoundedCache<string,string?> icons=new(144);
    // The sheets the backpack icons were cut from (normalized asset names), to refresh only on those.
    private readonly HashSet<string> iconSheets=new();
    private int iconBudget;
    private int failures;
    private readonly InventoryControl inventory=new();
    private WorldCollector? worldCollector;
    private LocalMapCollector? localMap;
    private Tracking? tracking;
    private string trackingMode="off";
    private readonly TargetCollector targetCollector=new();
    private readonly JournalCollector journalCollector=new();
    private JournalState? journal;
    private TargetCard? target;
    private string targetState="unavailable";
    private SceneState? scene;
    private ModManagementCollector? modManagement;
    private ModConfigEditor? modConfigEditor;
    private EventCollector? events;
    private MineMonsterReader? mineMonsters;
    private BundleCollector? bundles;
    private FarmExtrasCollector? farmExtras;
    private CollectionCollector? collections;
    private CustomSkillCollector? customSkills;
    private readonly BoundedCache<Microsoft.Xna.Framework.Graphics.Texture2D,string?> skillIcons=new(8);
    private CatalogCollector? catalog;
    private PortraitReader? portraitReader;
    private ProgressCollector? progress;
    private RelationsCollector? relations;
    private long relationsVersion;
    private string backendLanguage="";
    private int backendTurn;
    // Our own manifest.json, read once (no SMAPI toolkit reference needed).
    private static string ManifestVersion(string dir){try{using var doc=JsonDocument.Parse(File.ReadAllText(Path.Combine(dir,"manifest.json")));return doc.RootElement.GetProperty("Version").GetString()??"";}catch{return "";}}
    public override void Entry(IModHelper helper) {
        try {
            var keyFile=Path.Combine(helper.DirectoryPath,"control-key.json");
            var key=File.Exists(keyFile)?JsonSerializer.Deserialize<string>(File.ReadAllText(keyFile)):null;
            if(key is null||key.Length!=64){key=Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();File.WriteAllText(keyFile,JsonSerializer.Serialize(key));}
            server=new BridgeServer(){Control=new ControlHub(key),ModVersion=ManifestVersion(helper.DirectoryPath)};modManagement=new ModManagementCollector(helper.ModRegistry,server.ModPreviews);server.Mods=modManagement.Document;modConfigEditor=new(new GmcmAdapter(helper.ModRegistry));server.ModConfig=modConfigEditor.Mailbox;events=new(helper.ModRegistry,server.Perf);server.Events=events.Directory;bundles=new();server.Bundles=bundles.Document;farmExtras=new(helper.ModRegistry);relations=new(helper.ModRegistry);portraitReader=new(helper.ModRegistry,server);targetCollector.Portraits=portraitReader;catalog=new(helper.ModRegistry,server,ReadRelations,RelationNotes){Portraits=portraitReader};server.CatalogItems=catalog.Items;server.CatalogPeople=catalog.People;progress=new();server.Progress=progress.Document;server.Start();worldCollector=new WorldCollector(server,portraitReader);localMap=new LocalMapCollector(server);
            collections=new(helper.ModRegistry);server.Collections=collections.Document;customSkills=new(helper.ModRegistry,SkillIcon);mineMonsters=new(helper.ModRegistry,server);SceneOutdoors.Monsters=mineMonsters;
        }
        catch(Exception e){Monitor.Log("Read-only bridge disabled: "+e.Message,LogLevel.Error);return;}
        try{StartRunLog(helper);}catch(Exception e){Monitor.Log("Run log unavailable: "+e.GetType().Name,LogLevel.Warn);}
        // Keep the bridge usable even if a loader lacks the Harmony dependency before
        // ToolbarDisplay.Initialize itself can enter its patch-failure handler.
        try{ToolbarDisplay.Initialize(helper.DirectoryPath,Monitor);}
        catch(Exception e){Monitor.Log("Toolbar display option unavailable: "+e.GetType().Name,LogLevel.Warn);}
        try{QuestRewards.Initialize(helper,Monitor,journalCollector);}catch(Exception e){Monitor.Log("Quest history hooks unavailable: "+e.GetType().Name,LogLevel.Warn);}
        // Phase 4: the first full bag, calendar and recipe reads are the slowest (first-time work); do them
        // while the load screen is still up, where a few more milliseconds are invisible, not in play.
        helper.Events.GameLoop.SaveLoaded+=(_,_)=>{Reset();localMap?.WarmGpu();PrepareMerchant();long warm=Stopwatch.GetTimestamp();try{Collect(true);}catch(Exception e){server?.Log("warm-up: "+e.GetType().Name);}server?.Perf.Mark("load.warm",warm);runLog?.Write("crumb",$"warm-up {BridgeServer.Age(warm):F0} ms");};
        helper.Events.GameLoop.ReturnedToTitle+=(_,_)=>Reset();
        helper.Events.GameLoop.Saving+=(_,_)=>{server.Saving=true;NightScene.Saving=true;dirty=true;};
        helper.Events.GameLoop.Saved+=(_,_)=>{server.Saving=false;NightScene.Saving=false;dirty=true;};
        helper.Events.Player.Warped+=(_,e)=>{if(e.IsLocalPlayer){worldCollector?.Cancel();lastTracking=0;events?.InvalidateTriggers();}};
        // A chest (or fridge) change updates the open chest page and what can be crafted, next tick.
        helper.Events.World.ChestInventoryChanged+=(_,_)=>{sceneDirty=true;recipesDirty=true;};
        // The farm page follows what the player does where they stand: re-read that location once the
        // action has applied (a tool swing applies when the swing ends).
        helper.Events.Input.ButtonPressed+=(_,e)=>{if(Context.IsWorldReady&&e.Button.IsActionButton())journalCollector.Touch();};
        helper.Events.World.ObjectListChanged+=(_,e)=>{if(e.Location==Game1.currentLocation)journalCollector.Touch();};
        helper.Events.World.TerrainFeatureListChanged+=(_,e)=>{if(e.Location==Game1.currentLocation)journalCollector.Touch();};
        helper.Events.Player.InventoryChanged+=(_,_)=>{journalCollector.Touch();dirty=true;recipesDirty=true;SceneOutdoors.Invalidate();progress?.Refresh();events?.InvalidateTriggers();};
        helper.Events.Content.AssetReady+=(_,e)=>{if(e.NameWithoutLocale.BaseName.StartsWith("Data/Events/",StringComparison.OrdinalIgnoreCase))events?.InvalidateDefinitions();};
        helper.Events.Content.AssetsInvalidated+=(_,e)=>InvalidateContent(e.NamesWithoutLocale.Select(n=>n.BaseName));
        helper.Events.GameLoop.DayEnding+=(_,_)=>{long start=Stopwatch.GetTimestamp();NightScene.DayEnding();server.Perf.Mark("night.summary",start);dirty=true;};
        helper.Events.GameLoop.DayStarted+=(_,_)=>{SceneOutdoors.Invalidate();farmExtras?.Invalidate();server?.SetFarmExtras(null);modManagement?.Invalidate(language);events?.InvalidateTriggers();bundles?.Invalidate(language);InvalidateCollections(language);relations?.Invalidate();catalog?.Invalidate(language);progress?.Invalidate(language);NightScene.DayStarted();NightScene.StartDay();PrepareMerchant();localMap?.InvalidateMaps();worldCollector?.Invalidate();targetCollector.Reset();journalCollector.Reset();journal=null;dirty=true;};
        helper.Events.GameLoop.UpdateTicked+=(_,e)=>{var perf=server.Perf;perf.Frame();if(Context.IsWorldReady){bool swinging=Game1.player.UsingTool;if(wasSwinging&&!swinging)journalCollector.Touch();wasSwinging=swinging;}long t=Stopwatch.GetTimestamp();ProcessCommands();t=perf.Mark("commands",t);if(e.IsMultipleOf(3)){FishingLive.Tick(server,session);t=perf.Mark("reel",t);}if(e.IsMultipleOf(10)||dirty||sceneDirty||recipesDirty){Collect();t=perf.Mark("collect",t);}if(!e.IsMultipleOf(10)&&(e.Ticks%2==1||e.Ticks%10==6)){CollectBackground(e.Ticks%2==1);t=perf.Mark("background",t);}localMap?.Tick();perf.Mark("localmap",t);CollectBackend();};
        helper.ConsoleCommands.Add("stardewthor_status","Read-only bridge diagnostic counters",(_,_)=>Monitor.Log($"requests={server.Requests}; networkErrors={server.Errors}; collectionErrors={failures}; revision={revision}; {string.Join(';',server.Diagnostics())}",LogLevel.Info));
        AppDomain.CurrentDomain.ProcessExit+=(_,_)=>{runLog?.Write("exit","process exit");runLog?.Dispose();server.Dispose();};
        Publish("title",0);
        Monitor.Log($"StardewDS bridge {server.ModVersion}: local snapshots and authenticated commands; no remote listener",LogLevel.Info);
    }
    // What the log records: start, frame summary each minute, every frame over 33 ms with the bridge's
    // share, and breadcrumbs (map, menu, cutscene/dialogue, day, save, title) so a stall or a crash
    // can be placed. Reports run on the log's own thread; the game thread only enqueues short lines.
    private void StartRunLog(IModHelper helper){
        runLog=new RunLog(Path.Combine(helper.DirectoryPath,"logs"));server!.RunLog=runLog;var log=runLog;var perf=server.Perf;
        log.Write("start",$"StardewDS {server.ModVersion}; game {Game1.version}; SMAPI {Constants.ApiVersion}; mods {helper.ModRegistry.GetAll().Count()}; os {Environment.OSVersion}; cpus {Environment.ProcessorCount}");
        log.Every(TimeSpan.FromSeconds(60),perf.Report);
        // What reached the lower screen in the last minute: topic changes pushed and document notices.
        log.Every(TimeSpan.FromSeconds(60),()=>{var c=server.Streams.TakeCounts();log.Write("stream",$"streams {server.Streams.ActiveStreams}; {(c.Length>0?c:"nothing changed")}");return null;});
        log.Every(TimeSpan.FromSeconds(30),()=>{log.Write("textures",$"live reads {SheetPixels.LiveReads}; deferred while busy {SheetPixels.Deferred} (as exceptions {SheetPixels.Thrown}); render targets refused {SheetPixels.RenderTargets}; icons read {SheetPixels.Reads}; GPU read-backs sheets {SheetPixels.SheetReadbacks} rects {SheetPixels.RectReadbacks}");return null;});
        log.Every(TimeSpan.FromSeconds(1),()=>{foreach(var f in perf.LongFramesSince(ref slowCursor,33)){var top=string.Join(", ",f.Bridge.Where(p=>p.Value>=0.5).OrderByDescending(p=>p.Value).Take(4).Select(p=>p.Key+" "+p.Value));log.Write("slow",$"frame {f.FrameMs} ms; bridge {(top.Length>0?top:"<0.5 ms")}; gc {f.Gen0}/{f.Gen1}/{f.Gen2}");}return null;});
        helper.Events.GameLoop.SaveLoaded+=(_,_)=>log.Write("crumb","save loaded");
        helper.Events.GameLoop.ReturnedToTitle+=(_,_)=>log.Write("crumb","returned to title");
        helper.Events.GameLoop.DayStarted+=(_,_)=>log.Write("crumb",$"day started {Game1.year}-{Game1.currentSeason}-{Game1.dayOfMonth}");
        helper.Events.GameLoop.DayEnding+=(_,_)=>log.Write("crumb","day ending");
        helper.Events.GameLoop.Saving+=(_,_)=>log.Write("crumb","saving");
        helper.Events.GameLoop.Saved+=(_,_)=>log.Write("crumb","saved");
        helper.Events.Player.Warped+=(_,e)=>{if(e.IsLocalPlayer)log.Write("crumb","warp "+e.NewLocation?.NameOrUniqueName);};
        helper.Events.Display.MenuChanged+=(_,e)=>log.Write("crumb","menu "+(e.OldMenu?.GetType().Name??"-")+" -> "+(e.NewMenu?.GetType().Name??"-"));
        // Cutscenes and dialogue boxes, which have no SMAPI event of their own: compare once a second.
        helper.Events.GameLoop.OneSecondUpdateTicked+=(_,_)=>{var scene=Game1.eventUp?"event "+(Game1.CurrentEvent?.id??"?"):Game1.dialogueUp?"dialogue":"";if(scene!=lastScene){log.Write("crumb",scene.Length>0?scene+" start":lastScene+" end");lastScene=scene;}};
        AppDomain.CurrentDomain.UnhandledException+=(_,e)=>{log.Write("crash",(e.ExceptionObject as Exception)?.ToString()??"unknown");log.Flush();};
    }
    private void InvalidateContent(IEnumerable<string> names){
        var dependency=names.Aggregate(ContentDependency.None,(mask,n)=>mask|ContentDependencies.Classify(n));
        // Which assets other mods refresh, and what that costs here (Content Patcher packs refresh on warps and clock ticks).
        {var list=names as ICollection<string>??names.ToList();runLog?.Write("assets",$"{dependency} {list.Count}: {string.Join(", ",list.Take(8))}{(list.Count>8?", …":"")}");names=list;}
        if(dependency==ContentDependency.None)return;
        var changed=names.Select(ContentDependencies.Normal).ToHashSet();
        if(dependency==ContentDependency.All)SheetPixels.Release();else SheetPixels.Release(changed);
        if(dependency==ContentDependency.All||changed.Contains("loosesprites/cursors"))FishingLive.Reset();
        SceneOutdoors.Invalidate();
        // A texture: only icons cut from it (backpack, catalogue, the target card) are drawn again.
        if(dependency!=ContentDependency.All&&dependency.HasFlag(ContentDependency.Textures)){
            if(iconSheets.Overlaps(changed)){icons.Clear();iconSheets.Clear();slotCache.Clear();dirty=true;}
            if(catalog?.UsesTextures(changed)==true)catalog.Invalidate(language,changed);
            targetCollector.Reset();
        }
        // Content Patcher refreshes data and a few textures on warps and clock ticks. The catalogue rebuilds
        // but keeps the icons whose textures did not change: it used to clear them all and read every item
        // icon back from the GPU (5007 icons, 436 sheets in 9 PC moves; thousands of read-backs an hour on the
        // Thor before a low-memory kill).
        if(dependency==ContentDependency.All){farmExtras?.Invalidate();server?.SetFarmExtras(null);modConfigEditor?.Invalidate();modManagement?.Invalidate(language);events?.Invalidate(language);mineMonsters?.Invalidate();bundles?.Invalidate(language);InvalidateCollections(language);relations?.Invalidate();portraitReader?.Invalidate();catalog?.Invalidate(language,changed);progress?.Invalidate(language);localMap?.InvalidateTextures();icons.Clear();worldCollector?.Invalidate();targetCollector.Reset();iconSheets.Clear();slotCache.Clear();journalCollector.Refresh();dirty=true;return;}
        if(dependency.HasFlag(ContentDependency.Events))events?.Invalidate(language);
        if(dependency.HasFlag(ContentDependency.Calendar))journalCollector.InvalidateCalendar();
        if(dependency.HasFlag(ContentDependency.Portraits)){portraitReader?.Invalidate(changed);targetCollector.Reset();}
        if(dependency.HasFlag(ContentDependency.World))worldCollector?.Invalidate();
        if(dependency.HasFlag(ContentDependency.LocalMaps))localMap?.InvalidateTextures();
        if(dependency.HasFlag(ContentDependency.CatalogPeople))catalog?.InvalidatePeople(language);
        if(dependency.HasFlag(ContentDependency.Progress))progress?.Invalidate(language);
        if(dependency.HasFlag(ContentDependency.Relations))relations?.Invalidate();
    }
    private void CollectBackend(){
        var lang=LocalizedContentManager.CurrentLanguageCode.ToString();
        if(backendLanguage!=lang){backendLanguage=lang;modManagement?.Invalidate(lang);events?.Invalidate(lang);mineMonsters?.Invalidate();bundles?.Invalidate(lang);InvalidateCollections(lang);relations?.Invalidate();catalog?.Invalidate(lang,true);progress?.Invalidate(lang);farmExtras?.Invalidate();server?.SetFarmExtras(null);}
        // One new collector per game tick, with fair rotation when several pages are polling.
        // Each collector has a 1.5ms soft budget; an individual native getter cannot be preempted.
        for(int i=0;i<11;i++){
            int turn=backendTurn;backendTurn=(backendTurn+1)%11;
            if(Stopwatch.GetTimestamp()<pausedUntil[turn])continue;
            long start=Stopwatch.GetTimestamp();bool ran;
            try{ran=RunTurn(turn,lang,start);}catch(Exception e){ran=true;Strike(turn,"error "+e.GetType().Name);server!.Log(TurnNames[turn]+": "+e.GetType().Name);return;}
            if(!ran)continue;
            double ms=BridgeServer.Age(start);if(ms>TurnLimitMs)Strike(turn,$"slice {ms:F0} ms");else strikes[turn]=0;
            return;
        }
    }
    // Phase 3 (stability): a collector whose slices keep blowing far past their budget, or keep throwing,
    // is paused for a minute and logged, instead of stalling every frame it gets. 100 ms is a real stall
    // on any device; the soft budget per slice is 1.5 ms.
    private const double TurnLimitMs=100;
    private static readonly string[] TurnNames={"mods","events","bundles","farm.extras","farm.only","collections","skills","catalog","progress","relations","mod-config"};
    private readonly int[] strikes=new int[11];private readonly long[] pausedUntil=new long[11];
    private void Strike(int turn,string why){if(++strikes[turn]<3)return;strikes[turn]=0;pausedUntil[turn]=Stopwatch.GetTimestamp()+60*Stopwatch.Frequency;runLog?.Write("breaker",$"{TurnNames[turn]} paused 60 s after 3 bad slices ({why})");server?.Log("breaker "+TurnNames[turn]+": "+why);}
    private bool RunTurn(int turn,string lang,long start){
        if(turn==10&&modConfigEditor?.Wanted==true){modConfigEditor.Tick(session,lang);server!.Perf.Mark("mod-config.slice",start);return true;}
        if(turn==0&&modManagement?.Document.Wanted==true){modManagement.Tick(lang);server!.Perf.Mark("mods.slice",start);return true;}
        if(turn==1&&events?.NeedsWork==true){events.Tick(lang);server!.Perf.Mark("events.slice",start);return true;}
        if(turn==2&&bundles?.NeedsWork==true){bundles.Tick(lang);server!.Perf.Mark("bundles.slice",start);return true;}
        if(turn==3&&server?.WantsFarm==true&&farmExtras!=null){farmExtras.Tick(lang);server.SetFarmExtras(farmExtras.Current);server.Perf.Mark("farm.extras",start);return true;}
        if(turn==4&&server?.WantsFarm==true&&!server.HasReader){server.PublishFarm(journalCollector.CollectFarm(server.Perf));server.Perf.Mark("farm.only",start);return true;}
        if(turn==5&&collections?.NeedsWork==true){collections.Tick(lang);server!.Perf.Mark("collections.slice",start);return true;}
        if(turn==6&&server?.HasReader==true&&customSkills!=null){customSkills.Tick();journalCollector.CustomSkills=customSkills.Value;journalCollector.CustomSkillsLimited=customSkills.Limited;server.Perf.Mark("skills.slice",start);return true;}
        if(turn==7&&catalog?.Wanted==true){catalog.Tick(lang);server!.Perf.Mark("catalog.slice",start);return true;}
        if(turn==8&&progress?.Document.Wanted==true){progress.Tick(lang);server!.Perf.Mark("progress.slice",start);return true;}
        if(turn==9&&catalog?.People.Wanted==true&&relations?.Wanted==true){relations.Tick();if(relationsVersion!=relations.Version){relationsVersion=relations.Version;catalog?.InvalidatePeople(lang);}server!.Perf.Mark("relations.slice",start);return true;}
        return false;
    }
    private CatalogRelation[]? ReadRelations(string id)=>relations?.Read(id)?.Select(r=>new CatalogRelation(r.Id,r.Kind)).ToArray();
    private string[] RelationNotes()=>relations is null||relations.State=="absent"?Array.Empty<string>():relations.Limited.Concat(relations.State=="ready"?Array.Empty<string>():new[]{"relations-"+relations.State}).ToArray();
    private string? SkillIcon(Microsoft.Xna.Framework.Graphics.Texture2D texture){
        if(skillIcons.TryGetValue(texture,out var cached))return cached;
        string? result=null;
        try{if(texture.Width is >=1 and <=128&&texture.Height is >=1 and <=128){
            var pixels=new Microsoft.Xna.Framework.Color[texture.Width*texture.Height];texture.GetData(pixels);
            result=server!.AddSkillAsset(Png.Encode(texture.Width,texture.Height,pixels));
        }}catch{ /* The collector marks the missing icon explicitly; don't retry GPU reads every refresh. */ }
        skillIcons[texture]=result;return result;
    }
    private void InvalidateCollections(string lang){collections?.Invalidate(lang);customSkills?.Invalidate();journalCollector.CustomSkills=null;journalCollector.CustomSkillsLimited=Array.Empty<string>();skillIcons.Clear();server?.ClearSkillAssets();}
    // Loading/new-day screens only: the cart's stock build is too heavy for a gameplay tick.
    private void PrepareMerchant(){try{MerchantStock.Prepare();if(MerchantStock.BuildMs>0)server?.Log($"merchant stock {MerchantStock.BuildMs:F1}ms");}catch(Exception e){server?.Log("merchant: "+e.GetType().Name);}}
    private void Reset(){SceneOutdoors.Invalidate();if(server!=null)server.Saving=false;mineMonsters?.Invalidate();farmExtras?.Invalidate();server?.SetFarmExtras(null);modManagement?.Invalidate(language);events?.Invalidate(language);bundles?.Invalidate(language);InvalidateCollections(language);relations?.Invalidate();portraitReader?.Reset();catalog?.Reset(language);progress?.Invalidate(language);NightScene.Clear();session=Guid.NewGuid().ToString("N");seq=revision=0;bag=null;social=null;tracking=null;target=null;targetState="unavailable";scene=null;targetCollector.Reset();journalCollector.Reset();journal=null;lastBag="";icons.Clear();slotCache.Clear();worldCollector?.Reset();localMap?.Reset();server?.PublishFarm(null);dirty=true;Publish("transition",0);}
    // Run independent read-only sections on different game ticks. A snapshot uses
    // the latest completed sections; authenticated commands still refresh them
    // synchronously refresh inventory/journal before validating/executing an action.
    private void CollectBackground(bool residents){
        if(server is null||!server.HasReader||!Context.IsWorldReady){worldCollector?.Cancel();return;}
        if(residents){
            var mode=server.TrackingMode;
            if(mode!=trackingMode){trackingMode=mode;worldCollector!.InvalidatePositions();lastTracking=0;}
            if(mode=="off"){worldCollector!.Cancel();return;}
            if(worldCollector!.IsCollecting||tracking==null||lastTracking==0||BridgeServer.Age(lastTracking)>=(mode=="map"?500:1000)){
            long started=Stopwatch.GetTimestamp();
            try{if(worldCollector.Step(mode=="map") is {} completed){tracking=completed;lastTracking=Stopwatch.GetTimestamp();}}
            catch(Exception e){server.Log("tracking: "+e.GetType().Name);}
            server.Perf.Mark("background.tracking",started);
        }}
        else CollectJournal("background.journal");
    }
    private void CollectJournal(string segment,bool force=false){
        long started=Stopwatch.GetTimestamp();
        try{journal=journalCollector.Collect(server!.Perf,server.WantsFarm,force);}catch(Exception e){journal=null;server!.Log("journal: "+e.GetType().Name);}
        server!.PublishFarm(journal==null?null:journalCollector.Farm);server.Perf.Mark(segment,started);
    }
    private void Publish(string state,double ms) {
        if(journal!=null&&journal.FarmVersion!=server?.ComposedFarmVersion)journal=journal with{FarmVersion=server?.ComposedFarmVersion};
        World? world=state is "ready" or "multiplayer-unverified" ? new World(Game1.player.Money,Game1.dayOfMonth,Game1.year,Game1.currentSeason,Game1.timeOfDay,Limit(Game1.currentLocation?.DisplayName,240),Limit(Game1.player.Name,120),Game1.player.health,Game1.player.maxHealth,Game1.player.Stamina,Game1.player.MaxStamina,Game1.weatherIcon switch{0=>"wedding",1=>"festival",2=>"sun",3 or 6=>"wind",4=>"rain",5=>"storm",7=>"snow",999=>"green-rain",_=>null}) : null;
        string gate=inventory.Gate();server!.Publish(new Snapshot(session,++seq,revision,state,language,bag,ms,"game",world,world is null?null:social,new ControlState(gate=="ready",gate,world==null?-1:Game1.player.CurrentToolIndex,true,true,true,ToolbarDisplay.Enabled,ToolbarDisplay.Hidden,true,world!=null&&SceneControl.Gate()=="ready",modManagement!=null),world==null?null:tracking,world==null?null:target,world==null?"unavailable":targetState,world==null?null:journal,world==null?null:scene,world!=null&&NightScene.Visible,world==null?null:SceneControl.ActiveContext()));
    }
    private void Collect(bool force=false) {
        if(server is null || (!force&&!server.HasReader))return;
        var watch=Stopwatch.StartNew();var perf=server.Perf;long mark=Stopwatch.GetTimestamp();
        try {
            if(!Context.IsWorldReady){bag=null;social=null;Publish("title",watch.Elapsed.TotalMilliseconds);return;}
            var lang=LocalizedContentManager.CurrentLanguageCode.ToString();
            if(language!=lang){language=lang;dirty=true;icons.Clear();slotCache.Clear();worldCollector?.Invalidate();targetCollector.Reset();journalCollector.Reset();journal=null;}
            // Full scan catches swaps/quality/other mods which do not emit InventoryChanged.
            if(dirty || BridgeServer.Age(lastScan)>=2000) {
                iconBudget=2;
                int capacity=Math.Clamp(Game1.player.MaxItems,0,144);
                var slots=new Slot?[capacity];
                // Belt and braces: every 30 s rebuild everything, for changes no identity field shows.
                if(slotCacheAt==0||BridgeServer.Age(slotCacheAt)>=30000){slotCache.Clear();slotCacheAt=Stopwatch.GetTimestamp();}
                for(int i=0;i<capacity && i<Game1.player.Items.Count;i++){
                    var item=Game1.player.Items[i];if(item is null){slotCache.Remove(i);continue;}
                    var tool=item as StardewValley.Tool;int upgrade=tool?.UpgradeLevel??0,enchantments=tool?.enchantments.Count??0;string name=item.DisplayName;
                    if(slotCache.TryGetValue(i,out var hit)&&ReferenceEquals(hit.Item,item)&&hit.Stack==item.Stack&&hit.Quality==item.Quality&&hit.Name==name&&hit.Upgrade==upgrade&&hit.Enchantments==enchantments&&!(hit.Slot.Icon==null&&(!icons.TryGetValue(hit.Slot.Id,out var late)||late!=null))){slots[i]=hit.Slot;continue;}
                    try {var obj=item as StardewValley.Object;var description=item.getDescription();var stats=Guard(()=>ItemStats.Read(item));if(stats!=null)description=Guard(()=>ItemStats.Plain(item))??description;slots[i]=new Slot(i,Limit(item.QualifiedItemId,160),Limit(item.DisplayName,240),Limit(description,4000),item.Stack,item.Quality,Icon(item),Key:inventory.Key(item),CanTrash:item.canBeTrashed(),MaxStack:Math.Max(1,item.maximumStackSize()),Price:Math.Max(0,item.salePrice()),Energy:obj?.Edibility>=0?obj.staminaRecoveredOnConsumption():0,Health:obj?.Edibility>=0?obj.healthRecoveredOnConsumption():0,CanDrop:item.canBeTrashed()&&item.canBeDropped(),CategoryName:Limit(item.getCategoryName(),120),CategoryColor:$"#{item.getCategoryColor().R:X2}{item.getCategoryColor().G:X2}{item.getCategoryColor().B:X2}",Stats:stats);slotCache[i]=(item,item.Stack,item.Quality,name,upgrade,enchantments,slots[i]!); }
                    catch(Exception e){slots[i]=new Slot(i,"unknown","?","",0,0,null,"unavailable");server.Log("slot "+i+": "+e.GetType().Name);}
                }
                for(int i=capacity;i<144;i++)slotCache.Remove(i);
                // Unchanged slots are the very same objects, so a reference comparison replaces serializing the bag.
                bool same=bag!=null&&bag.Capacity==capacity&&bag.Slots.Length==slots.Length;
                if(same)for(int i=0;i<slots.Length;i++){var old=bag!.Slots[i];var now=slots[i];if(ReferenceEquals(old,now))continue;if(old!=null&&now!=null&&old with{Water=null,MenuShadow=false}==now with{Water=null,MenuShadow=false})continue;same=false;break;}
                if(!same){bag=new Bag(capacity,slots);revision++;}
                // Read only. Friendship fields are independent of the inventory revision.
                // Never create a missing relationship entry or normalize player data.
                try {
                    var relationships=new List<SocialEntry>();
                    var friends=Game1.player.friendshipData.Pairs.Take(192).ToArray();
                    var npcIndex=NativeNpcIndex.Read(friends.Select(p=>p.Key));
                    foreach(var pair in friends) {
                        var f=pair.Value;var npc=npcIndex.GetValueOrDefault(pair.Key);
                        if(f is null||npc is null)continue;
                        relationships.Add(new SocialEntry(Limit(pair.Key,160),f.Points,Math.Clamp(f.Points/250,0,20),Math.Clamp(Utility.GetMaximumHeartsForCharacter(npc),1,20),f.GiftsThisWeek,f.GiftsToday,f.TalkedToToday,f.Status.ToString()));
                    }
                    social=relationships.ToArray();
                }catch(Exception e){social=null;server.Log("social: "+e.GetType().Name);}
                dirty=false;lastScan=Stopwatch.GetTimestamp();mark=perf.Mark("collect.scan",mark);
                if(slots.Any(s=>s is not null && s.Icon is null && !icons.ContainsKey(s.Id)))dirty=true;
            }
            // Cheap live overlays: water changes don't require icon extraction or a
            // new inventory revision, and must not wait for the 2-second full scan.
            if(bag!=null){Slot?[]? overlay=null;for(int i=0;i<bag.Slots.Length&&i<Game1.player.Items.Count;i++){var slot=bag.Slots[i];var item=Game1.player.Items[i];if(slot==null||item==null||slot.Key!=inventory.Key(item))continue;
                ToolWater? water=item is StardewValley.Tools.WateringCan can&&can.waterCanMax>0?new(Math.Clamp(can.WaterLeft,0,can.waterCanMax),can.waterCanMax,can.IsBottomless,!Game1.player.hasWateringCanEnchantment):null;
                bool shadow=item is StardewValley.Object o&&!o.bigCraftable.Value&&o.QualifiedItemId is not "(O)590" and not "(O)SeedSpot";
                if(slot.Water!=water||slot.MenuShadow!=shadow){overlay??=(Slot?[])bag.Slots.Clone();overlay[i]=slot with{Water=water,MenuShadow=shadow};}
            }if(overlay!=null)bag=bag with{Slots=overlay};}
            mark=perf.Mark("collect.overlay",mark);
            // Tracking is display-only: commands validate inventory/journal, never force a world scan.
            try{if(server.WantsTarget)(target,targetState)=targetCollector.Collect();else{target=null;targetState="unavailable";}}catch(Exception e){target=null;targetState="error";server.Log("target: "+e.GetType().Name);}
            mark=perf.Mark("collect.target",mark);
            // Open chest / shop for the context page, under the same on-demand lease as the target. The
            // night is always sent (it is cheap, read once at DayEnding): the App switches to it on sleep.
            NightScene.Tick();
            try{scene=NightScene.Visible?NightScene.Scene():!server.WantsTarget?null:SceneControl.Collect(inventory,Icon);}catch(Exception e){scene=null;server.Log("scene: "+e.GetType().Name);}
            mark=perf.Mark("collect.scene",mark);sceneDirty=false;
            if(recipesDirty){recipesDirty=false;if(journal!=null){try{journal=journal with{Recipes=journalCollector.RefreshRecipes()};}catch(Exception e){server.Log("recipes: "+e.GetType().Name);}mark=perf.Mark("collect.recipes",mark);}}
            if(force){CollectJournal("collect.journal",true);mark=Stopwatch.GetTimestamp();}
            Publish(Context.IsMultiplayer?"multiplayer-unverified":"ready",watch.Elapsed.TotalMilliseconds);
            perf.Mark("collect.publish",mark);
            if(watch.ElapsedMilliseconds>8)server.Log($"collect={watch.Elapsed.TotalMilliseconds:F1}ms slots={bag?.Capacity} icons={icons.Count}");
        } catch(Exception e){failures++;bag=null;social=null;dirty=true;Publish("error",watch.Elapsed.TotalMilliseconds);server.Log("collection: "+e.GetType().Name);if(failures<=3)Monitor.Log(e.ToString(),LogLevel.Warn);}
    }
    private void ProcessCommands(){
        if(server?.Control==null)return;
        // One authenticated action per game tick; queued bursts cannot force many
        // synchronous inventory/core refreshes in one frame. TTL/order remain unchanged.
        for(int processed=0;processed<1&&server.Control.TryTake(out var c);processed++){
            if(c==null)continue;
            try{
                if(c.Session!=session)throw new CommandRejected("session-changed");
                if(c.Action=="save-mod-config"){
                    modConfigEditor!.Save(c,session);server.Control.Complete(new(c.Id,"applied","ok",revision));continue;
                }
                if(c.Action=="open-mod-config"){
                    ModSettingsCommand.Execute(c,session,revision,modManagement!);server.Control.Complete(new(c.Id,"applied","ok",revision));continue;
                }
                if(c.Action=="set-toolbar"){
                    ToolbarDisplay.Set(c.ToolbarHidden!.Value);Collect(true);server.Control.Complete(new(c.Id,"applied","ok",revision));continue;
                }
                bool chestAction=c.Action is "chest-take" or "chest-put";
                var reason=chestAction?SceneControl.Gate():inventory.Gate();if(reason!="ready")throw new CommandRejected(reason);
                // Refresh from the real inventory immediately before checking revision and identities.
                dirty=true;Collect(true);if(bag==null)throw new CommandRejected("snapshot-unavailable");if(c.Revision!=revision)throw new CommandRejected("inventory-changed");
                if(c.Action=="craft")CraftingControl.Execute(c);else if(c.Action=="accept-quest")QuestBoard.Accept(c);else if(c.Action=="claim-quest")QuestRewards.Claim(c);else if(chestAction)SceneControl.Execute(c,inventory);else inventory.Execute(c);
                journalCollector.InvalidateCore();dirty=true;Collect(true);server.Control.Complete(new(c.Id,"applied","ok",revision));
            }catch(CommandRejected e){server.Control.Complete(new(c.Id,"rejected",e.Message,revision));}
            catch(Exception e){journalCollector.InvalidateCore();dirty=true;Collect(true);server.Control.Complete(new(c.Id,"failed","game-error",revision));server.Log("command "+c.Action+": "+e.GetType().Name);}
        }
    }
    // Tooltip stat lines are optional: a failure only drops the icons, never the slot.
    private T? Guard<T>(Func<T?> read) where T:class{try{return read();}catch(Exception e){server?.Log("stats: "+e.GetType().Name);return null;}}
    private string? Icon(Item item) {
        var key=item.QualifiedItemId;
        if(icons.TryGetValue(key,out var cached))return cached;
        if(iconBudget<=0)return null;
        iconBudget--;
        try {
            var data=ItemRegistry.GetDataOrErrorItem(key);var texture=data.GetTexture();var rect=data.GetSourceRect();
            if(data.TextureName!=null)iconSheets.Add(ContentDependencies.Normal(data.TextureName));
            if(rect.Width>64||rect.Height>64||rect.Width<=0||rect.Height<=0)return icons[key]=null;
            var colors=SheetPixels.Read(texture,rect);
            return icons[key]="data:image/png;base64,"+Convert.ToBase64String(Png.Encode(rect.Width,rect.Height,colors));
        }catch(Exception e){server!.Log("icon "+key+": "+e.GetType().Name);return icons[key]=null;}
    }
    private static string Limit(string? s,int n)=>s is null?"":s.Length>n?s[..n]:s;
}
