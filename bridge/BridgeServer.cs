using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace StardewThor.Bridge;

public record Slot(int SlotIndex, string Id, string Name, string Description, int Stack, int Quality, string? Icon, string? Error = null, string? Key = null, bool CanTrash = false, int MaxStack = 1, int Price = 0, int Energy = 0, int Health = 0, bool? CanDrop = null, ToolWater? Water = null, bool MenuShadow = false, string? CategoryName = null, string? CategoryColor = null, ItemStat[]? Stats = null);
public record ToolWater(int Current,int Capacity,bool Bottomless,bool ShowGauge);
// One tooltip line: Icon is a key for an original Cursors icon ("" = none), Text is the
// game's localized hover string, Tone mirrors its colour (enchanted/negative/enchantment/secondary).
public record ItemStat(string Icon,string Text,string? Tone=null);
public record Bag(int Capacity, Slot?[] Slots);
public record World(int Money, int Day, int Year, string Season, int Time, string Location, string Farmer,int? Health=null,int? MaxHealth=null,double? Stamina=null,int? MaxStamina=null,string? Weather=null);
public record SocialEntry(string Id, int Points, int Hearts, int MaxHearts, int GiftsThisWeek, int GiftsToday, bool TalkedToday, string Relationship);
public record MapPoint(string Region, double X, double Y);
public record ScheduleStop(int Time,string Location,int X,int Y);
// Tile coordinates inside one location for the local map; Location is the unique name.
public record LocalPoint(string Location,double X,double Y);
public record Resident(string Id,string Name,string Location,MapPoint? Position,string? Portrait,string? Season,int Day,bool Romance,ScheduleStop[]? Schedule=null,string? MapAvatar=null,LocalPoint? Local=null);
public record MapLayer(string Image,int X,int Y,int Width,int Height);
public record RegionMap(string Id,int Width,int Height,MapLayer[] Layers);
public record Tracking(MapPoint? Player,Resident[] Residents,RegionMap[] Maps,string? PlayerAvatar=null,LocalPoint? PlayerLocal=null,string? PlayerBody=null);
public record TargetField(string Key,string Value);
public record KnownGift(string Id,string Name,int Taste);
public record TargetCard(string Id,string Kind,string Name,string? Icon,string Location,int X,int Y,TargetField[] Fields,KnownGift[] Gifts,SocialEntry? Social=null,bool GiftsLimited=false,string? ItemId=null,string? OutputId=null,int? OutputStack=null);
// An open chest or shop menu, read only while the App's context page holds the target lease.
// Chest: Items are its slots (Key = our item identity). Shop: Items are its stock in shop order.
public record SceneItem(int Slot, string Id, string Name, int Stack, int Quality, string? Icon, string Key, int Price = 0, int Stock = -1, string? TradeId = null, int TradeCount = 0, bool Bundle = false, bool Known = true);
// Fishing: rod state, bait/tackle and the BobberBar minigame; Items = fish catchable here now.
public record SceneFishing(string Phase, string? BaitId, string? BaitName, int BaitCount, string? TackleId, string? TackleName, int TackleUses, int TackleMax, string? FishId, string? FishName, int Difficulty, double Progress, bool Treasure, bool TreasureCaught, bool Perfect, bool Boss, bool FishKnown);
// Mines / Skull Cavern / volcano floor; Items = resource nodes on the floor, by what they drop.
public record SceneMonster(string Id,string Name,int Count,string? Icon,int? Health,string? Slayer,string[] Drops,string? Mod);
// Monsters remains the legacy count; MonsterTypes is the additive detail list.
public record SceneMine(string Area, int Level, int Floor, int Monsters, bool Ladder, bool Shaft, bool MustKill, int Lowest, int Stones, double Luck,
    SceneMonster[]? MonsterTypes=null,string? FloorKind=null,string[]? Limited=null);
// Night (between DayEnding and DayStarted): what was shipped (captured before the bin empties), the
// end-of-day stage and tomorrow's weather. Items = shipped lines, Price = sale value per unit.
public record NightSkill(string Id,int Experience,int StartLevel,int Level,bool? PendingProfession);
public record NightFriends(int Talked,int Gifted);
public record SceneNight(string Phase, int Total, int Count, string? WeatherTomorrow,NightSkill[]? Skills=null,NightFriends? Friends=null,int? Money=null,string? Season=null,int? Day=null,int? Year=null);
// The fishing minigame, live (stream topic "reel", mod FishingLive): the game's track pixels at 4x - green
// bar top 0..568-height, fish 0..532ish, treasure likewise - and its sprites cut from the player's Cursors sheet.
public record ReelArt(string? Frame,string? BarTop,string? BarMid,string? BarBottom,string? Fish,string? Boss,string? Treasure);
public record ReelFrame(double Bar,int BarHeight,double Fish,double Progress,bool InBar,bool Treasure,double TreasurePos,double TreasureCatch,bool TreasureCaught,bool Boss,bool Perfect,ReelArt? Art);
public record SceneState(string Kind, string Key, string Name, int Capacity, SceneItem?[] Items, bool Truncated = false, int Currency = 0, SceneFishing? Fishing = null, SceneMine? Mine = null, SceneNight? Night = null);
public record Snapshot(string Session, long Seq, long Revision, string State, string Language, Bag? Bag, double CollectMs, string Source, World? World = null, SocialEntry[]? Social = null, ControlState? Control = null, Tracking? Tracking = null,TargetCard? Target=null,string? TargetState=null,JournalState? Journal=null,SceneState? Scene=null,bool Night=false,string? Context=null);

// No game objects cross this boundary. Published DTOs and their arrays transfer
// ownership to the server; producers must replace, never mutate them after Publish.
public sealed class BridgeServer : IDisposable
{
    public const int DefaultPort = 23871;
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly TcpListener listener;
    private readonly CancellationTokenSource stop = new();
    private sealed record Published(Lazy<string> Body,long At,long Seq=0);
    private Published current=new(new(()=>"null"),Stopwatch.GetTimestamp());
    private long serializedSnapshots;
    private int saving;
    public bool Saving {get=>Volatile.Read(ref saving)!=0;set=>Volatile.Write(ref saving,value?1:0);}
    public long SerializedSnapshots=>Interlocked.Read(ref serializedSnapshots);
    private long lastRequest;
    private long targetLease;
    private sealed record TrackingLease(string Mode,long At);
    private TrackingLease trackingLease=new("off",0);
    public string TrackingMode {get{var lease=Volatile.Read(ref trackingLease);return lease.At!=0&&Age(lease.At)<2500?lease.Mode:"off";}}
    public bool WantsMap=>TrackingMode=="map";
    public bool WantsTracking=>TrackingMode!="off";
    public bool WantsTarget => Interlocked.Read(ref targetLease) is var at && at!=0 && Age(at)<1500;
    private readonly Queue<string> logs = new();
    public ControlHub? Control {get;set;}
    // Reported in every snapshot envelope so the App can show which mod it talks to.
    private string modVersion="";
    public string ModVersion {get=>modVersion;set=>modVersion=new string((value??"").Where(c=>c is (>='0' and <='9') or (>='A' and <='Z') or (>='a' and <='z') or '.' or '-' or '+').Take(32).ToArray());}
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,byte[]> assets=new();
    public string AddAsset(byte[] png){var key=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png)).ToLowerInvariant();if(!assets.ContainsKey(key)){if(png.Length>1024*1024||assets.Count>=256||assets.Values.Sum(a=>(long)a.Length)+png.Length>16*1024*1024)throw new InvalidOperationException("Asset cache budget");assets[key]=png;}return "/bridge/asset/"+key;}
    public void ClearAssets()=>assets.Clear();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,byte[]> skillAssets=new();
    public string AddSkillAsset(byte[] png){var key=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png)).ToLowerInvariant();if(!skillAssets.ContainsKey(key)){if(png.Length>64*1024||skillAssets.Count>=8||skillAssets.Values.Sum(v=>(long)v.Length)+png.Length>512*1024)throw new InvalidOperationException("Skill asset budget");skillAssets[key]=png;}return "/bridge/asset/"+key;}
    public void ClearSkillAssets()=>skillAssets.Clear();
    // Local maps: immutable, content-addressed blobs in their own budget, so one large
    // location can never evict the inventory or world-map assets above.
    public Func<string,string?>? LocalMapManifest {get;set;}
    /// Game-thread timing for diagnosing long frames; read-only, never part of the snapshot.
    public PerfStats Perf {get;} = new();
    public DemandDocument? Mods {get;set;}
    public ModConfigMailbox? ModConfig {get;set;}
    public ModPreviewStore ModPreviews {get;} = new();
    public EventDirectory? Events {get;set;}
    public DemandDocument? Bundles {get;set;}
    public DemandDocument? Collections {get;set;}
    public CatalogDirectory? CatalogItems{get;set;}
    public CatalogDirectory? CatalogPeople{get;set;}
    public DemandDocument? Progress{get;set;}
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,byte[]> catalogAssets=new();private long catalogAssetBytes;
    public const int CatalogAssetMax=32*1024,CatalogAssetCount=9216,CatalogAssetBudget=24*1024*1024;
    public string? AddCatalogAsset(byte[] png){if(png.Length>CatalogAssetMax)return null;var key=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png)).ToLowerInvariant();lock(catalogAssets){if(catalogAssets.ContainsKey(key))return "/bridge/asset/"+key;if(catalogAssets.Count>=CatalogAssetCount||catalogAssetBytes+png.Length>CatalogAssetBudget)return null;catalogAssets[key]=png;catalogAssetBytes+=png.Length;return "/bridge/asset/"+key;}}
    public void ClearCatalogAssets(){lock(catalogAssets){catalogAssets.Clear();catalogAssetBytes=0;}}
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,(byte[] Data,string Mime,long Used)> localBlobs=new();
    private long localBlobBytes;
    public const long LocalBlobBudget=24L*1024*1024;public const int LocalBlobMax=4*1024*1024;
    public string? AddLocalBlob(byte[] data,string mime){
        if(data.Length>LocalBlobMax)return null;var key=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(data)).ToLowerInvariant();
        lock(localBlobs){
            if(localBlobs.TryGetValue(key,out var old)){localBlobs[key]=old with{Used=Stopwatch.GetTimestamp()};return key;}
            // Least recently served goes first.
            while(localBlobBytes+data.Length>LocalBlobBudget&&!localBlobs.IsEmpty){var oldest=localBlobs.MinBy(p=>p.Value.Used);if(localBlobs.TryRemove(oldest.Key,out var gone))localBlobBytes-=gone.Data.Length;}
            localBlobs[key]=(data,mime,Stopwatch.GetTimestamp());localBlobBytes+=data.Length;
        }
        return key;
    }
    public bool HasLocalBlob(string key)=>localBlobs.ContainsKey(key);
    public long LocalBlobBytes=>Interlocked.Read(ref localBlobBytes);
    public void ClearLocalBlobs(){lock(localBlobs){localBlobs.Clear();localBlobBytes=0;}}
    // Farm report: the game thread swaps in an immutable record once per completed scan;
    // JSON is produced lazily on this listener thread, only when the farm page asks.
    private FarmReport? farm,sourceFarm;private FarmExtras? farmExtras;private long farmVersion,farmRequest;private (FarmReport? Report,string Body) farmBody=(null,"");
    public const int FarmBudget=384*1024;
    public bool WantsFarm=>Interlocked.Read(ref farmRequest)!=0&&Age(Interlocked.Read(ref farmRequest))<5000;
    public long? ComposedFarmVersion=>Volatile.Read(ref farm)?.Version;
    // Only immutable DTOs are combined here. Calls are serialized on the game thread.
    public void PublishFarm(FarmReport? report){if(ReferenceEquals(sourceFarm,report))return;sourceFarm=report;ComposeFarm();}
    public void SetFarmExtras(FarmExtras? extras){if(ReferenceEquals(farmExtras,extras))return;farmExtras=extras;ComposeFarm();}
    private void ComposeFarm(){if(sourceFarm==null){Volatile.Write(ref farm,null);return;}farmVersion=Math.Max(farmVersion+1,sourceFarm.Version);Volatile.Write(ref farm,sourceFarm with{Version=farmVersion,Extras=farmExtras});}
    public string? FarmJson(){var r=Volatile.Read(ref farm);if(r==null)return null;var cached=farmBody;if(ReferenceEquals(cached.Report,r))return cached.Body;
        var body=JsonSerializer.Serialize(r,Json);if(Encoding.UTF8.GetByteCount(body)>FarmBudget)return null;farmBody=(r,body);return body;}
    public long Requests, Errors;
    public int Port => ((IPEndPoint)listener.LocalEndpoint).Port;
    public bool HasReader => Interlocked.Read(ref lastRequest) != 0 && Age(Interlocked.Read(ref lastRequest)) < 5000;
    public static double Age(long at) => (Stopwatch.GetTimestamp() - at) * 1000.0 / Stopwatch.Frequency;
    public BridgeServer(int port = DefaultPort) { listener = new TcpListener(IPAddress.Loopback, port); Streams=new StreamHub(stop.Token); Streams.Resolve=Doc; }
    // Architecture v2 phase 1: /v3/stream pushes changed topics (see StreamHub).
    public readonly StreamHub Streams;
    // Phase 5: the display leases join the stream demand. Touch renews them like the old HTTP renewals;
    // Release is what leaving the page used to send (target/off, tracking/off), now done by the stream.
    private StreamHub.Demand? Doc(string name)=>name switch{
        "farm"=>new(()=>Volatile.Read(ref farm)?.Version??0,()=>Interlocked.Exchange(ref farmRequest,Stopwatch.GetTimestamp()),()=>Interlocked.Exchange(ref farmRequest,0)),
        "target"=>new(()=>0,()=>Interlocked.Exchange(ref targetLease,Stopwatch.GetTimestamp()),()=>Interlocked.Exchange(ref targetLease,0)),
        "tracking-map"=>new(()=>0,()=>Volatile.Write(ref trackingLease,new("map",Stopwatch.GetTimestamp())),()=>{if(Volatile.Read(ref trackingLease).Mode=="map")Volatile.Write(ref trackingLease,new("off",0));}),
        "tracking-profile"=>new(()=>0,()=>{if(Volatile.Read(ref trackingLease) is var l&&(l.Mode!="map"||Age(l.At)>=2500))Volatile.Write(ref trackingLease,new("profile",Stopwatch.GetTimestamp()));},()=>{if(Volatile.Read(ref trackingLease).Mode=="profile")Volatile.Write(ref trackingLease,new("off",0));}),
        "events" when Events is {} d=>new(()=>d.Revision,d.Touch),"items" when CatalogItems is {} d=>new(()=>d.Revision,d.Touch),"people" when CatalogPeople is {} d=>new(()=>d.Revision,d.Touch),
        "bundles" when Bundles is {} d=>new(()=>d.Revision,d.Touch),"collections" when Collections is {} d=>new(()=>d.Revision,d.Touch),"mods" when Mods is {} d=>new(()=>d.Revision,d.Touch),"progress" when Progress is {} d=>new(()=>d.Revision,d.Touch),_=>null};
    // Existing routes keep their one-at-a-time behaviour (their caches are not thread-safe);
    // only the long-lived streams run beside them.
    private readonly SemaphoreSlim serial=new(1,1);
    private int clients;
    public void Start() { listener.Start(32); _ = Serve(); }
    public void Publish(Snapshot snapshot) {
        Streams.Offer(snapshot);
        // Latest-only mailbox, no worker queue. Superseded, unread snapshots cost
        // no serialization and cannot accumulate behind a slow/disconnected client.
        Volatile.Write(ref current,new Published(new Lazy<string>(()=>{
            Interlocked.Increment(ref serializedSnapshots);
            var body=JsonSerializer.Serialize(snapshot,Json);
            if(Encoding.UTF8.GetByteCount(body)>512*1024)throw new InvalidOperationException("Snapshot exceeds 512 KiB budget");
            return body;
        }),Stopwatch.GetTimestamp(),snapshot.Seq));
    }
    public void Log(string message) { lock(logs){ if(logs.Count==64)logs.Dequeue(); logs.Enqueue(message.Length>400?message[..400]:message); } RunLog?.Write("note",message.Length>400?message[..400]:message); }
    // Persistent run log (phase 0). Routes are logged when the lower screen starts reading them again
    // after 30 s, so the log shows what the player had open without a line per poll.
    public RunLog? RunLog;
    private readonly Dictionary<string,long> routeSeen=new();
    private void NoteRoute(string path){if(RunLog==null)return;var route=path.Split('?')[0];if(route.StartsWith("/v1/asset/")||route.StartsWith("/v1/localmap/blob/"))return;long now=Stopwatch.GetTimestamp();lock(routeSeen){if(routeSeen.TryGetValue(route,out var at)&&Age(at)<30000){routeSeen[route]=now;return;}routeSeen[route]=now;}RunLog.Write("reader",route);}
    public string[] Diagnostics() { lock(logs)return logs.ToArray(); }
    private async Task Serve() {
        while(!stop.IsCancellationRequested) {
            TcpClient client;
            try{client=await listener.AcceptTcpClientAsync(stop.Token);}
            catch(OperationCanceledException){break;} catch(ObjectDisposedException){break;} catch(SocketException) when(stop.IsCancellationRequested){break;}
            catch(Exception e){Interlocked.Increment(ref Errors);Log(e.GetType().Name);continue;}
            if(Interlocked.Increment(ref clients)>32){Interlocked.Decrement(ref clients);client.Dispose();continue;}
            _=Task.Run(async()=>{try{await Handle(client);}finally{Interlocked.Decrement(ref clients);client.Dispose();}});
        }
    }
    private async Task Handle(TcpClient client) {
        bool locked=false;
            try {
                using var timeout=CancellationTokenSource.CreateLinkedTokenSource(stop.Token);timeout.CancelAfter(1000);
                var stream=client.GetStream();var bytes=new byte[4096];var count=0;
                while(count<bytes.Length) {
                    int n=await stream.ReadAsync(bytes.AsMemory(count),timeout.Token);if(n==0)break;count+=n;
                    if(Encoding.ASCII.GetString(bytes,0,count).Contains("\r\n\r\n"))break;
                }
                var request=Encoding.ASCII.GetString(bytes,0,count);
                string status="400 Bad Request",body="{}",mime="application/json; charset=utf-8",cache="no-store";byte[]? binary=null;
                if(request.Contains("\r\n\r\n")) {
                    var first=request.Split('\r')[0];
                    var parts=first.Split(' ');var path=parts.Length==3?parts[1]:"";NoteRoute(path);
                    if(first.StartsWith("GET /v3/stream")){Interlocked.Exchange(ref lastRequest,Stopwatch.GetTimestamp());await Streams.Serve(stream,path,()=>{var p=Volatile.Read(ref current);Interlocked.Exchange(ref lastRequest,Stopwatch.GetTimestamp());return ((long)Age(p.At),Saving,p.Seq,modVersion);},stop.Token);return;}
                    if(first.StartsWith("GET /v3/demand?")){
                        // Phase 4: which documents stream `id` wants (replaces renewing each lease with a poll).
                        var query=path[(path.IndexOf('?')+1)..].Split('&').Select(q=>q.Split('=',2)).Where(q=>q.Length==2).ToDictionary(q=>q[0],q=>Uri.UnescapeDataString(q[1]));
                        bool ok=query.TryGetValue("id",out var sid)&&sid.Length==32&&Streams.SetDemand(sid,(query.GetValueOrDefault("docs")??"").Split(',',StringSplitOptions.RemoveEmptyEntries));
                        await stream.WriteAsync(Encoding.ASCII.GetBytes($"HTTP/1.1 {(ok?"200 OK":"404 Not Found")}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{{}}"),timeout.Token);return;
                    }
                    await serial.WaitAsync(stop.Token);locked=true;
                    if(path.StartsWith("/v2/")){
                        var key=request.Split("\r\n").FirstOrDefault(h=>h.StartsWith("X-Stardew-Key:",StringComparison.OrdinalIgnoreCase))?.Split(':',2)[1].Trim();
                        if(Control==null||!Control.Authorize(key))status="403 Forbidden";
                        else if(first.StartsWith("POST /v2/command ")){
                            var lengthText=request.Split("\r\n").FirstOrDefault(h=>h.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase))?.Split(':',2)[1].Trim();
                            if(int.TryParse(lengthText,out int length)&&length>0&&length<=2048){
                                int start=request.IndexOf("\r\n\r\n",StringComparison.Ordinal)+4,have=count-start;var payload=new byte[length];
                                if(have<=length){Array.Copy(bytes,start,payload,0,have);while(have<length){int n=await stream.ReadAsync(payload.AsMemory(have),timeout.Token);if(n==0)break;have+=n;}if(have==length){status="200 OK";body=JsonSerializer.Serialize(Control.Submit(Encoding.UTF8.GetString(payload)),Json);}}
                            }
                        }else if(first.StartsWith("GET /v2/receipt/")&&Guid.TryParseExact(path[12..],"N",out _)){
                            var result=Control.Get(path[12..]);status=result==null?"404 Not Found":"200 OK";body=JsonSerializer.Serialize(result,Json);
                        }else status="404 Not Found";
                    }
                    else if(first.StartsWith("GET /v1/asset/")&&(assets.TryGetValue(path[10..],out var png)||skillAssets.TryGetValue(path[10..],out png))){status="200 OK";binary=png;mime="image/png";}
                    else if(first.StartsWith("GET /v1/asset/")&&catalogAssets.TryGetValue(path[10..],out var catalogPng)){status="200 OK";binary=catalogPng;mime="image/png";cache="public, max-age=31536000, immutable";}
                    else if(first.StartsWith("GET /v1/localmap/blob/")){
                        var key=path["/v1/localmap/blob/".Length..];
                        if(key.Length==64&&localBlobs.TryGetValue(key,out var blob)){localBlobs[key]=blob with{Used=Stopwatch.GetTimestamp()};status="200 OK";binary=blob.Data;mime=blob.Mime;cache="public, max-age=31536000, immutable";}
                        else status="404 Not Found";
                    }
                    else if(first.StartsWith("GET /v1/localmap/")){
                        // Read-only: at most queues a sliced, rate-limited collection on the game thread.
                        var name=Uri.UnescapeDataString(path["/v1/localmap/".Length..]);
                        var manifest=name.Length is >0 and <=80&&name.All(c=>char.IsLetterOrDigit(c)||c is '_' or '-' or '.' or ' ')?LocalMapManifest?.Invoke(name):null;
                        if(manifest==null)status="404 Not Found";else{status="200 OK";body=manifest;}
                    }
                    else if(first.StartsWith("GET ")&&(path=="/v1/events"||path.StartsWith("/v1/events?"))){
                        if(!EventDirectory.TryPage(path,out int page)){status="400 Bad Request";body="{\"error\":\"invalid-page\"}";}
                        else{status="200 OK";body=Events?.Read(page)??"{\"state\":\"unsupported\",\"limited\":[\"events-unavailable\"]}";}
                    }
                    else if(first.StartsWith("GET ")&&path=="/v1/bundles"){
                        status="200 OK";body=Bundles?.Read()??"{\"state\":\"unsupported\",\"limited\":[\"bundles-unavailable\"]}";
                    }
                    else if(first.StartsWith("GET ")&&path=="/v1/collections"){
                        status="200 OK";body=Collections?.Read()??"{\"state\":\"unsupported\",\"version\":0,\"language\":\"\",\"sets\":[],\"limited\":[\"collections-unavailable\"]}";
                    }
                    else if(first.StartsWith("GET ")&&path=="/v1/mods"){
                        status="200 OK";body=Mods?.Read()??"{\"state\":\"unsupported\",\"limited\":[\"mods-unavailable\"]}";
                    }
                    else if(first.StartsWith("GET ")&&ModPreviewStore.TryRoute(path,out var previewId)){
                        status="200 OK";body=ModPreviews.Read(previewId);
                    }
                    else if(first.StartsWith("GET ")&&ModConfigMailbox.TryRoute(path,out var configId)){
                        status="200 OK";body=ModConfig?.Read(configId)??"{\"state\":\"unsupported\",\"limited\":[\"editor-unavailable\"]}";
                    }
                    else if(first.StartsWith("GET ")&&path.StartsWith("/v1/catalog/",StringComparison.Ordinal)){
                        if(!CatalogDirectory.TryRoute(path,out var kind,out int page)){status="400 Bad Request";body="{\"error\":\"invalid-page\"}";}
                        else{status="200 OK";body=(kind=="items"?CatalogItems:CatalogPeople)?.Read(page)??"{\"state\":\"unsupported\",\"limited\":[\"catalog-unavailable\"]}";}
                    }
                    else if(first.StartsWith("GET ")&&path=="/v1/progress"){status="200 OK";body=Progress?.Read()??"{\"state\":\"unsupported\",\"limited\":[\"progress-unavailable\"]}";}
                    else if(first=="GET /v1/perf HTTP/1.1"||first=="GET /v1/perf HTTP/1.0"){status="200 OK";var perfJson=Perf.Json();body=perfJson[..^1]+",\"transport\":{\"snapshotReads\":"+Interlocked.Read(ref Requests)+",\"streams\":"+Streams.ActiveStreams+",\"splits\":"+Interlocked.Read(ref Streams.Splits)+",\"pushedBytes\":"+Interlocked.Read(ref Streams.Pushed)+"}}";}
                    else if(first=="GET /v1/farm HTTP/1.1"||first=="GET /v1/farm HTTP/1.0"){
                        Interlocked.Exchange(ref farmRequest,Stopwatch.GetTimestamp());
                        var json=FarmJson();if(json==null)status="404 Not Found";else{status="200 OK";body=json;}
                    }
                    else if(first.StartsWith("GET ") && (path=="/v1/tracking/map"||path=="/v1/tracking/profile"||path=="/v1/tracking/off")){
                        var mode=path.Split('/').Last();Volatile.Write(ref trackingLease,new(mode,mode=="off"?0:Stopwatch.GetTimestamp()));
                        status="200 OK";body=JsonSerializer.Serialize(new{mode},Json);
                    }
                    else if(first.StartsWith("GET ") && (path=="/v1/target/on"||path=="/v1/target/off")){
                        bool enabled=path.EndsWith("/on");Interlocked.Exchange(ref targetLease,enabled?Stopwatch.GetTimestamp():0);
                        status="200 OK";body=enabled?"{\"enabled\":true}":"{\"enabled\":false}";
                    }
                    else if(!first.StartsWith("GET "))status="405 Method Not Allowed";
                    else if(first!="GET /v1/snapshot HTTP/1.1" && first!="GET /v1/snapshot HTTP/1.0" && first!="GET /v1/state HTTP/1.1" && first!="GET /v1/state HTTP/1.0")status="404 Not Found";
                    else {
                        Interlocked.Exchange(ref lastRequest,Stopwatch.GetTimestamp());Interlocked.Increment(ref Requests);
                        var p=Volatile.Read(ref current);status="200 OK";
                        try{var snapshotBody=p.Body.Value;body="{\"protocol\":\"stardew-thor.readonly.v1\",\"gameAgeMs\":"+(long)Age(p.At)+(modVersion.Length>0?",\"modVersion\":\""+modVersion+"\"":"")+(Saving?",\"busy\":\"saving\"":"")+",\"snapshot\":"+snapshotBody+"}";}
                        catch(InvalidOperationException){status="503 Service Unavailable";body="{\"error\":\"snapshot-budget\"}";Log("Snapshot exceeds 512 KiB budget");}
                    }
                }
                var content=binary??Encoding.UTF8.GetBytes(body);
                var header=Encoding.ASCII.GetBytes($"HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {content.Length}\r\nCache-Control: {cache}\r\nConnection: close\r\n\r\n");
                await stream.WriteAsync(header,timeout.Token);await stream.WriteAsync(content,timeout.Token);
            } catch(Exception e) when(!stop.IsCancellationRequested) { Interlocked.Increment(ref Errors);Log(e.GetType().Name); }
            catch(OperationCanceledException){} catch(ObjectDisposedException){} catch(SocketException){}
            finally{if(locked)serial.Release();}
    }
    public void Dispose(){stop.Cancel();listener.Stop();}
}
