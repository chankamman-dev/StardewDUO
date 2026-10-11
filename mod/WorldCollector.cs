using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.WorldMaps;

namespace StardewThor.ReadOnly;

internal sealed class WorldCollector {
    private readonly BridgeServer server;private readonly PortraitReader? portraitReader;
    private readonly Dictionary<string,string> images=new();
    private readonly Dictionary<string,string?> portraits=new();
    private string? playerBody,bodyAppearance;
    private readonly Dictionary<string,string?> avatars=new();
    private string? playerAvatar,playerAppearance;
    private RegionMap[] maps=Array.Empty<RegionMap>();
    private long mapAt;
    private readonly Dictionary<string,Resident> residents=new();
    private readonly Dictionary<string,long> residentAt=new();
    private readonly Dictionary<string,(Resident Row,int Time,long At)> details=new();
    internal int LocalReads {get;private set;}
    internal int RemoteReads {get;private set;}
    private IEnumerator<Tracking?>? pending;
    private bool pendingPositions;
    public void InvalidatePositions(){Cancel();residentAt.Clear();}
    private readonly Dictionary<string,(object? Schedule,int Time,ScheduleStop[]? Stops)> schedules=new();
    internal int ScheduleBuilds {get;private set;}
    public bool IsCollecting=>pending!=null;
    public void Cancel(){pending?.Dispose();pending=null;}
    // At most eight resident records or two milliseconds per tick. An individual
    // native call is not preemptible; never move game objects onto a worker thread.
    public Tracking? Step(bool positions=true){
        if(pending!=null&&pendingPositions!=positions)Cancel();
        pendingPositions=positions;pending??=CollectSteps(positions:positions).GetEnumerator();var timer=System.Diagnostics.Stopwatch.StartNew();
        try{for(int i=0;i<8;i++){
            if(!pending.MoveNext()){Cancel();return null;}
            if(pending.Current is {} result)return result;
            if(timer.Elapsed.TotalMilliseconds>=2)break;
        }return null;}catch{Cancel();throw;}
    }
    private ScheduleStop[]? Schedule(string id,NPC npc){
        if(schedules.TryGetValue(id,out var cached)&&ReferenceEquals(cached.Schedule,npc.Schedule)&&cached.Time==Game1.timeOfDay)return cached.Stops;
        var stops=npc.Schedule?.OrderBy(p=>p.Key).Take(32).Select(p=>new ScheduleStop(p.Key,Game1.getLocationFromName(p.Value.targetLocationName)?.DisplayName??p.Value.targetLocationName,p.Value.targetTile.X,p.Value.targetTile.Y)).ToArray();
        schedules[id]=(npc.Schedule,Game1.timeOfDay,stops);ScheduleBuilds++;return stops;
    }
    public WorldCollector(BridgeServer server,PortraitReader? portraitReader=null){this.server=server;this.portraitReader=portraitReader;}
    public void Reset(){Cancel();residents.Clear();residentAt.Clear();details.Clear();schedules.Clear();images.Clear();portraits.Clear();avatars.Clear();playerAvatar=playerAppearance=playerBody=bodyAppearance=null;maps=Array.Empty<RegionMap>();mapAt=0;server.ClearAssets();}
    // Content refresh is not a new save. Retain immutable last-good URLs and blobs
    // while rebuilding derived records, so partially refreshed snapshots stay valid.
    public void Invalidate(){Cancel();schedules.Clear();details.Clear();residentAt.Clear();images.Clear();portraits.Clear();avatars.Clear();mapAt=0;playerAppearance=bodyAppearance=null;}
    private string Image(Texture2D texture,Rectangle rect,string key){
        if(images.TryGetValue(key,out var existing))return existing;
        if(rect.Width<1||rect.Height<1||rect.Width>1024||rect.Height>1024)throw new Exception("texture budget");
        var colors=SheetPixels.Read(texture,rect);
        return images[key]=server.AddAsset(Png.Encode(rect.Width,rect.Height,colors));
    }
    private MapPoint? Position(GameLocation? location,Point tile){
        if(location==null)return null;var context=WorldMapManager.GetPositionData(location,tile);if(context==null)return null;
        var p=context.Value.GetMapPixelPosition();return new(context.Value.Data.Region.Id,Math.Round(p.X/4,2),Math.Round(p.Y/4,2));
    }
    // Standing position in tiles inside its own location, for the local map.
    private static LocalPoint? Local(GameLocation? location,Vector2 standing)=>location==null?null:new(location.NameOrUniqueName,Math.Round(standing.X/64,2),Math.Round(standing.Y/64,2));
    public Tracking Collect(){Cancel();return CollectSteps(true).Last(r=>r!=null)!;}
    private IEnumerable<Tracking?> CollectSteps(bool force=false,bool positions=true){
        long mark=System.Diagnostics.Stopwatch.GetTimestamp();
        var characters=Game1.characterData.Where(p=>Game1.player.friendshipData.ContainsKey(p.Key)).Take(192).ToArray();
        var index=NativeNpcIndex.Read(characters.Select(p=>p.Key));
        server.Perf.Mark("tracking.index",mark);yield return null;
        // Remove disappeared NPCs. Previously local NPCs get an immediate departure
        // refresh so stale icons cannot linger on the current local map.
        foreach(var id in residents.Keys.Where(id=>!index.ContainsKey(id)).ToArray()){
            residents.Remove(id);residentAt.Remove(id);details.Remove(id);schedules.Remove(id);
        }
        var here=Game1.currentLocation;
        var priority=new HashSet<string>(index.Where(p=>positions&&(ReferenceEquals(p.Value.currentLocation,here)||residents.GetValueOrDefault(p.Key)?.Local?.Location==here.NameOrUniqueName)).Select(p=>p.Key));
        foreach(var entry in characters.Where(p=>priority.Contains(p.Key))){
            mark=System.Diagnostics.Stopwatch.GetTimestamp();ReadResident(entry.Key,index[entry.Key],true,force,positions);
            server.Perf.Mark("tracking.local",mark);yield return null;
        }
        // Publish the local positions before spending any budget on remote maps/NPCs.
        yield return PlayerSnapshot(positions);
        mark=System.Diagnostics.Stopwatch.GetTimestamp();
        // Resolve native condition/season/farm overlays; no large texture read every tick.
        if(positions&&(maps.Length==0||mapAt==0||BridgeServer.Age(mapAt)>30000)){
            var list=new List<RegionMap>();foreach(var region in WorldMapManager.GetMapRegions().Take(16)){
                try{
                    var source=new List<MapAreaTexture>{region.GetBaseTexture()};foreach(var area in region.GetAreas())source.AddRange(area.GetTextures());
                    var layers=new List<MapLayer>();foreach(var layer in source.Take(64)){
                        if(layer==null)continue;var rect=layer.SourceRect;var dest=layer.MapPixelArea;
                        string key=$"{Game1.currentSeason}/{layer.Texture.Name}/{layer.Texture.GetHashCode()}/{rect}";
                        layers.Add(new(Image(layer.Texture,rect,key),dest.X/4,dest.Y/4,dest.Width/4,dest.Height/4));
                    }
                    if(layers.Count>0)list.Add(new(region.Id,layers.Max(l=>l.X+l.Width),layers.Max(l=>l.Y+l.Height),layers.ToArray()));
                }catch(Exception e){server.Log("map "+region.Id+": "+e.GetType().Name);}
                server.Perf.Mark("tracking.maps",mark);yield return null;mark=System.Diagnostics.Stopwatch.GetTimestamp();
            }maps=list.ToArray();mapAt=System.Diagnostics.Stopwatch.GetTimestamp();
        }
        mark=server.Perf.Mark("tracking.maps",mark);
        foreach(var entry in characters.Where(p=>!priority.Contains(p.Key))){
            var npc=index.GetValueOrDefault(entry.Key);if(npc==null)continue;
            if(!force&&residentAt.TryGetValue(entry.Key,out var at)&&BridgeServer.Age(at)<30000)continue;
            mark=System.Diagnostics.Stopwatch.GetTimestamp();ReadResident(entry.Key,npc,false,force,positions);
            server.Perf.Mark("tracking.remote",mark);yield return null;
        }
        yield return PlayerSnapshot(positions);
    }
    private void ReadResident(string id,NPC npc,bool local,bool force,bool positions){
        if(local)LocalReads++;else RemoteReads++;
        if(!npc.CanSocialize){residents.Remove(id);details.Remove(id);residentAt[id]=System.Diagnostics.Stopwatch.GetTimestamp();return;}
        try{
            var now=System.Diagnostics.Stopwatch.GetTimestamp();
            if(force||!details.TryGetValue(id,out var cached)||cached.Time!=Game1.timeOfDay||BridgeServer.Age(cached.At)>=15000){
                var data=Game1.characterData[id];
                // One icon extraction per record. Missing icons warm progressively.
                bool extracted=false;
                extracted=!portraits.ContainsKey(id);portraits[id]=portraitReader?.Read(id,npc)??portraits.GetValueOrDefault(id);
                var head=npc.getMugShotSourceRect();var sprite=npc.Sprite.Texture;string avatarKey=$"head/{id}/{sprite.GetHashCode()}/{head}";
                if(!avatars.ContainsKey(avatarKey)&&!extracted&&SheetPixels.Quiet){try{var png=MapAvatar.Npc(id,sprite,head);avatars[avatarKey]=png==null?null:server.AddAsset(png);}catch(TextureDeferred){}catch(Exception e){avatars[avatarKey]=null;server.Log("map avatar "+id+": "+e.GetType().Name);}}
                var row=new Resident(id,npc.displayName,"",null,portraits.GetValueOrDefault(id)??residents.GetValueOrDefault(id)?.Portrait,data.BirthSeason?.ToString().ToLowerInvariant(),data.BirthDay,data.CanBeRomanced,Schedule(id,npc),avatars.GetValueOrDefault(avatarKey)??residents.GetValueOrDefault(id)?.MapAvatar);
                // If an icon still needs extraction, retry next collection, not every tick.
                details[id]=(row,Game1.timeOfDay,avatars.ContainsKey(avatarKey)?now:0);
            }
            residents[id]=details[id].Row with {Location=npc.currentLocation?.DisplayName??"",Position=positions?Position(npc.currentLocation,npc.TilePoint):null,Local=positions?Local(npc.currentLocation,npc.getStandingPosition()):null};
            residentAt[id]=now;
        }catch(Exception e){server.Log("resident "+id+": "+e.GetType().Name);}
    }
    private Tracking PlayerSnapshot(bool positions){
        long mark=System.Diagnostics.Stopwatch.GetTimestamp();
        var player=Game1.player;
        string appearance=$"{player.UniqueMultiplayerID}/{player.IsMale}/{player.hair.Value}/{player.skin.Value}/{player.hairstyleColor.Value.PackedValue}/{player.newEyeColor.Value.PackedValue}/{player.prismaticHair.Value}";
        // A deferred avatar keeps the old one and tries again next pass (the appearance is not marked as done).
        if(playerAppearance!=appearance&&SheetPixels.Quiet){try{playerAvatar=server.AddAsset(MapAvatar.Player(player));playerAppearance=appearance;}catch(TextureDeferred){}catch(Exception e){playerAppearance=appearance;playerAvatar=null;server.Log("player avatar: "+e.GetType().Name);}}
        string bodyKey=$"{appearance}/{player.hat.Value?.QualifiedItemId}/{player.shirtItem.Value?.QualifiedItemId}/{player.shirtItem.Value?.clothesColor.Value.PackedValue}/{player.pantsItem.Value?.QualifiedItemId}/{player.pantsItem.Value?.clothesColor.Value.PackedValue}/{player.boots.Value?.QualifiedItemId}/{player.accessory.Value}/{player.shoes.Value}/{player.bathingClothes.Value}/{Game1.timeOfDay>=1900}";
        if(bodyAppearance!=bodyKey&&SheetPixels.Quiet){try{playerBody=server.AddAsset(MapAvatar.Player(player,true));bodyAppearance=bodyKey;}catch(TextureDeferred){}catch(Exception e){bodyAppearance=bodyKey;playerBody=null;server.Log("player body: "+e.GetType().Name);}}
        var result=new Tracking(positions?Position(Game1.currentLocation,player.TilePoint):null,residents.Values.ToArray(),maps,playerAvatar,positions?Local(Game1.currentLocation,player.getStandingPosition()):null,playerBody);
        server.Perf.Mark("tracking.player",mark);return result;
    }
}
