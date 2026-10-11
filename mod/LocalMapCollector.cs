using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Text.Json;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.TerrainFeatures;
using xTile.Layers;
using xTile.Tiles;

namespace StardewThor.ReadOnly;

// Local map (docs/LOCAL-MAP-PLAN.md). Sends *what to draw*, not pixels: on the game
// thread it only reads tile indices and sprite rectangles, sliced to a per-tick budget.
// Each texture is read once (one GPU readback per tick at most) and PNG-encoded off the
// game thread; the WebView composites. It never touches GameLocation.Map (whose getter
// can reload a map), never draws, warps, saves or changes game state.
internal sealed partial class LocalMapCollector {
    private const double TickBudgetMs=1.0;          // game-thread time per update tick
    private const int MaxTexturePixels=2048*2048;   // skip anything larger than this
    private const int MaxTiles=256*256;             // per location
    private const int JobsPerMinute=12;
    private static readonly string[] Groups={"Back","Buildings","Front","AlwaysFront"};
    private static readonly FieldInfo?[] GrassFields=new[]{"whichWeed","offset1","offset2","offset3","offset4"}.Select(n=>typeof(Grass).GetField(n,BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.Public)).ToArray();
    private static readonly FieldInfo? FurnitureOffset=typeof(StardewValley.Objects.Furniture).GetField("sourceIndexOffset",BindingFlags.Instance|BindingFlags.NonPublic);
    private static readonly FieldInfo? BushYOffset=typeof(Bush).GetField("yDrawOffset",BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.Public);

    private sealed class Tex { public string Key=""; public Texture2D? Source; public Rectangle? Crop; public volatile string? Blob; public Task? Encode; public volatile bool Failed; public string? StaticUrl; }
    private readonly record struct Sprite(int Tex,Rectangle Src,int Dx4,int Dy4,byte Flags,int Sort, uint Tint);
    private sealed class Ready { public string Json=""; public string[] Blobs=Array.Empty<string>(); public long At; }
    private sealed class Job {
        public string Name=""; public GameLocation Loc=null!; public xTile.Map Map=null!; public int W,H,Row,Phase;
        public readonly List<(Layer Layer,int Group)> Layers=new(); public ushort[][] Sheets=Array.Empty<ushort[]>(), Indices=Array.Empty<ushort[]>();
        public readonly List<Tex> TexList=new(); public readonly Dictionary<string,int> TexIndex=new(); public readonly Dictionary<Texture2D,int> Whole=new(ReferenceEqualityComparer.Instance); public readonly Dictionary<TileSheet,int> SheetIndex=new();
        public byte[]? Water; public Color WaterColor; public int WaterTex=-1;
        public readonly int[]?[] GrassOffsets=new int[5][];
        public readonly List<Sprite> Sprites=new(); public IEnumerator<bool>? Walk; public Task? Finish;
        public readonly Stopwatch Clock=Stopwatch.StartNew(); public double GameMs,MaxTickMs,MaxReadMs; public int Ticks,Reads,Tiles; public readonly double[] PhaseMax=new double[6]; public int GcTicks,Gc2Ticks;
    }

    private readonly BridgeServer server;
    private readonly ConcurrentQueue<string> requests=new();
    private readonly ConcurrentDictionary<string,Ready> ready=new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string,string> unavailable=new(StringComparer.Ordinal);
    private readonly Dictionary<string,Tex> textures=new();   // game thread; shared by all locations
    private readonly Queue<long> starts=new();
    private readonly HashSet<string> namesSeen=new();         // item texture names already touched
    private Job? job;
    private volatile string progress="";                      // read by the HTTP thread
    private volatile int encoding;                            // background encodes in flight

    public LocalMapCollector(BridgeServer server){this.server=server;server.LocalMapManifest=Manifest;Warm();}
    // Compile this class, its iterator and closures while the mod loads, so the first
    // local map a player opens does not pay JIT cost inside a game frame.
    private static void Warm(){
        foreach(var type in typeof(LocalMapCollector).GetNestedTypes(BindingFlags.Public|BindingFlags.NonPublic).Append(typeof(LocalMapCollector)))
            foreach(var m in type.GetMethods(BindingFlags.Instance|BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.DeclaredOnly))
                if(!m.IsAbstract&&!m.ContainsGenericParameters&&!m.DeclaringType!.ContainsGenericParameters)try{System.Runtime.CompilerServices.RuntimeHelpers.PrepareMethod(m.MethodHandle);}catch{}
    }

    // HTTP thread. Returns the last finished map, or a pending/unavailable state.
    private string Manifest(string name){
        requests.Enqueue(name);
        if(ready.TryGetValue(name,out var r)&&r.Blobs.All(server.HasLocalBlob))return r.Json;
        if(unavailable.TryGetValue(name,out var u))return u;
        var p=progress;return JsonSerializer.Serialize(new{state="pending",location=name,progress=p.StartsWith(name+"|")?p[(name.Length+1)..]:""},BridgeServer.Json);
    }

    // First GPU readback of a session initialises the driver path (~9 ms on PC GL). Do it
    // during the save-load screen instead of inside a gameplay frame.
    public void WarmGpu(){try{var c=new Color[1];Game1.staminaRect?.GetData(c);}catch{}}
    public void Reset(){job=null;namesSeen.Clear();ready.Clear();unavailable.Clear();textures.Clear();starts.Clear();while(requests.TryDequeue(out _)){}server.ClearLocalBlobs();progress="";}
    // Textures may have been replaced (season change, content packs); maps redrawn next request.
    public void InvalidateTextures(){textures.Clear();ready.Clear();job=null;}
    public void InvalidateMaps(){ready.Clear();unavailable.Clear();}

    // Game thread, every update tick. Costs one queue check when nobody is looking.
    public void Tick(){
        if(!server.WantsMap){job?.Walk?.Dispose();job=null;progress="";while(requests.TryDequeue(out _)){}return;}
        if(job==null&&requests.IsEmpty)return;
        var watch=Stopwatch.StartNew();int gc0=GC.CollectionCount(0),gc2=GC.CollectionCount(2);
        try{
            string? wanted=null;while(requests.TryDequeue(out var n))wanted=n;
            if(wanted!=null&&job?.Name!=wanted&&Wants(wanted)){Start(wanted);if(job!=null)job.PhaseMax[5]=watch.Elapsed.TotalMilliseconds;}
            if(job==null&&wanted!=null&&!ready.ContainsKey(wanted)&&!unavailable.ContainsKey(wanted))Classify(wanted);
            if(job==null)return;
            var phase=job.Phase+1;var before=watch.Elapsed.TotalMilliseconds;Step(job,watch);var jj=job;if(jj!=null&&phase<5)jj.PhaseMax[phase]=Math.Max(jj.PhaseMax[phase],watch.Elapsed.TotalMilliseconds-before);
        }catch(Exception e){if(job!=null){unavailable[job.Name]=State("error",job.Name,e.GetType().Name);job=null;}server.Log("localmap: "+e.GetType().Name+" "+e.Message);}
        finally{if(job!=null){var ms=watch.Elapsed.TotalMilliseconds;if(GC.CollectionCount(0)!=gc0)job.GcTicks++;if(GC.CollectionCount(2)!=gc2)job.Gc2Ticks++;job.GameMs+=ms;job.Ticks++;job.MaxTickMs=Math.Max(job.MaxTickMs,ms);}}
    }

    private bool Wants(string name){
        if(!Context.IsWorldReady)return false;
        if(ready.TryGetValue(name,out var r)&&r.Blobs.All(server.HasLocalBlob)&&BridgeServer.Age(r.At)<15000)return false;
        // Only real collections count against the limit; unknown or unloaded names are answered at once.
        if(Find(name)?.map==null)return true;
        var now=Stopwatch.GetTimestamp();while(starts.Count>0&&BridgeServer.Age(starts.Peek())>60000)starts.Dequeue();
        if(starts.Count>=JobsPerMinute)return false;starts.Enqueue(now);return true;
    }

    // A rate-limited request still gets an immediate answer when the location cannot be drawn.
    private void Classify(string name){var loc=Find(name);if(loc==null)unavailable[name]=State("unknown",name,null);else if(loc.map==null)unavailable[name]=State("unloaded",name,null);}
    private void Start(string name){
        unavailable.TryRemove(name,out _);job=null;
        var loc=Find(name);
        if(loc==null){unavailable[name]=State("unknown",name,null);return;}
        // location.map only: the Map getter may reload a map, which a preview must never do.
        var map=loc.map;var back=map?.GetLayer("Back");
        if(map==null||back==null){unavailable[name]=State("unloaded",name,null);return;}
        if(back.LayerWidth*back.LayerHeight>MaxTiles){unavailable[name]=State("too-large",name,null);return;}
        var j=new Job{Name=name,Loc=loc,Map=map,W=back.LayerWidth,H=back.LayerHeight,Phase=-1};
        // 1.6 draw order: Back, Buildings, Front, AlwaysFront; numeric suffixes sort within a group.
        for(int g=0;g<Groups.Length;g++){
            var group=new List<KeyValuePair<int,Layer>>();foreach(var l in map.Layers){var n=Suffix(l.Id,Groups[g]);if(n.HasValue)group.Add(new(n.Value,l));}
            group.Sort((a,b)=>a.Key.CompareTo(b.Key));foreach(var p in group)j.Layers.Add((p.Value,g));
        }
        j.Sheets=new ushort[j.Layers.Count][];j.Indices=new ushort[j.Layers.Count][];for(int i=0;i<j.Layers.Count;i++){j.Sheets[i]=new ushort[j.W*j.H];j.Indices[i]=new ushort[j.W*j.H];}
        job=j;
    }

    private void Step(Job j,Stopwatch watch){
        bool Over()=>watch.Elapsed.TotalMilliseconds>=TickBudgetMs;
        if(j.Phase==-1){ // tile sheets: the map renderer's cache first; a real load is one per tick
            foreach(var sheet in j.Map.TileSheets){
                if(j.SheetIndex.ContainsKey(sheet))continue;
                var tex=RendererTexture(sheet);
                if(tex==null){if(watch.Elapsed.TotalMilliseconds>0.3)return;try{tex=Game1.content.Load<Texture2D>(sheet.ImageSource);}catch{j.SheetIndex[sheet]=0xFFF;continue;}j.SheetIndex[sheet]=TexId(j,tex,null);return;}
                j.SheetIndex[sheet]=TexId(j,tex,null);
            }
            j.Phase=0;if(Over())return;
        }
        if(j.Phase==0){ // tiles, row by row
            while(j.Row<j.H){
                int y=j.Row++;
                for(int l=0;l<j.Layers.Count;l++){var layer=j.Layers[l].Layer;if(y>=layer.LayerHeight)continue;var sheets=j.Sheets[l];var idx=j.Indices[l];
                    for(int x=0;x<j.W&&x<layer.LayerWidth;x++){var tile=layer.Tiles[x,y];if(tile==null)continue;j.Tiles++;
                        if(!j.SheetIndex.TryGetValue(tile.TileSheet,out int sheet))continue;
                        if(sheet>=0xFFF)continue;
                        int flip=0,rot=0;var props=tile.Properties;
                        if(props.Count>0){if(props.TryGetValue("@Flip",out var f)&&int.TryParse(f.ToString(),out var fi))flip=fi&3;if(props.TryGetValue("@Rotation",out var r)&&int.TryParse(r.ToString(),out var ri))rot=((ri%360+360)%360)/90&3;}
                        sheets[y*j.W+x]=(ushort)((sheet+1)|(flip<<12)|(rot<<14));idx[y*j.W+x]=(ushort)Math.Clamp(tile.TileIndex,0,65535);
                    }
                }
                progress=$"{j.Name}|tiles {j.Row}/{j.H}";
                if(Over())return;
            }
            // Water is drawn over Back by drawWater: Cursors (0,2064), tinted by waterColor.
            var water=j.Loc.waterTiles;
            if(water!=null){var mask=new byte[j.W*j.H];bool any=false;for(int y=0;y<j.H;y++)for(int x=0;x<j.W;x++){if(x>=water.waterTiles.GetLength(0)||y>=water.waterTiles.GetLength(1))continue;var d=water.waterTiles[x,y];if(d.isWater&&d.isVisible){mask[y*j.W+x]=1;any=true;}}
                if(any){j.Water=mask;j.WaterColor=j.Loc.waterColor.Value;j.WaterTex=TexId(j,Game1.mouseCursors,new Rectangle(0,2064,64,192));}}
            j.Walk=WalkSprites(j).GetEnumerator();j.Phase=1;if(Over())return;
        }
        if(j.Phase==1){ // sprites
            // false = the next item may load a texture from disk: give that its own tick.
            while(j.Walk!.MoveNext()){if(!j.Walk.Current&&watch.Elapsed.TotalMilliseconds>0.05||Over()){progress=$"{j.Name}|objects {j.Sprites.Count}";return;}}
            j.Phase=2;
        }
        if(j.Phase==2){ // textures: at most one GPU readback per tick, only at the start of it
            foreach(var t in j.TexList){
                if(t.Blob!=null||t.Failed||t.Encode!=null)continue;
                if(watch.Elapsed.TotalMilliseconds>0.3)return;
                Read(j,t);return;
            }
            if(j.TexList.Any(t=>t.Blob==null&&!t.Failed)){progress=$"{j.Name}|textures {j.TexList.Count(t=>t.Blob!=null)}/{j.TexList.Count}";return;}
            j.Phase=3;j.Finish=Task.Run(()=>Finish(j));return;
        }
        if(j.Phase==3&&j.Finish!.IsCompleted){if(j.Finish.IsFaulted)unavailable[j.Name]=State("error",j.Name,j.Finish.Exception?.GetBaseException().GetType().Name);job=null;}
    }

    // One whole-texture readback per tick. Not striped: MonoGame's GL backend cannot read a
    // sub-rectangle, so every partial GetData reads (and allocates) the entire texture.
    private void Read(Job j,Tex t){
        // Bound overlapping large buffers/PNG allocations across consecutive ticks.
        if(encoding>=2)return;
        var tex=t.Source!;var rect=t.Crop??tex.Bounds;
        if(rect.Width<1||rect.Height<1||rect.Width*rect.Height>MaxTexturePixels||tex.IsDisposed){t.Failed=true;return;}
        int count=rect.Width*rect.Height;var px=System.Buffers.ArrayPool<Color>.Shared.Rent(count);
        var sw=Stopwatch.StartNew();try{tex.GetData(0,rect,px,0,count);}catch{System.Buffers.ArrayPool<Color>.Shared.Return(px);throw;}
        var ms=sw.Elapsed.TotalMilliseconds;j.Reads++;j.MaxReadMs=Math.Max(j.MaxReadMs,ms);
        Interlocked.Increment(ref encoding);
        t.Encode=Task.Run(()=>{try{var key=server.AddLocalBlob(Png.Encode(rect.Width,rect.Height,px),"image/png");if(key==null)t.Failed=true;else t.Blob=key;}catch{t.Failed=true;}finally{System.Buffers.ArrayPool<Color>.Shared.Return(px);Interlocked.Decrement(ref encoding);}});
    }

    // Background thread: pack everything the WebView needs into one gzip blob.
    private void Finish(Job j){
        var sw=Stopwatch.StartNew();
        var sprites=j.Sprites.OrderBy(s=>s.Sort).ToList();
        using var raw=new MemoryStream();using(var w=new BinaryWriter(raw,System.Text.Encoding.UTF8,leaveOpen:true)){
            w.Write(new byte[]{(byte)'S',(byte)'T',(byte)'L',(byte)'M'});w.Write((byte)1);w.Write((ushort)j.W);w.Write((ushort)j.H);w.Write((byte)j.Layers.Count);
            for(int l=0;l<j.Layers.Count;l++){w.Write((byte)j.Layers[l].Group);foreach(var v in j.Sheets[l])w.Write(v);foreach(var v in j.Indices[l])w.Write(v);}
            if(j.Water!=null&&j.WaterTex>=0){w.Write((byte)1);w.Write((ushort)j.WaterTex);var c=j.WaterColor;w.Write(c.R);w.Write(c.G);w.Write(c.B);w.Write(c.A);w.Write(j.Water);}else w.Write((byte)0);
            w.Write(sprites.Count);
            foreach(var s in sprites){w.Write((ushort)s.Tex);w.Write((ushort)s.Src.X);w.Write((ushort)s.Src.Y);w.Write((ushort)s.Src.Width);w.Write((ushort)s.Src.Height);w.Write(s.Dx4);w.Write(s.Dy4);w.Write(s.Flags);w.Write(s.Sort);}
        }
        using var packed=new MemoryStream();using(var z=new GZipStream(packed,CompressionLevel.Fastest,true))z.Write(raw.GetBuffer(),0,(int)raw.Length);
        var data=server.AddLocalBlob(packed.ToArray(),"application/octet-stream")??throw new InvalidOperationException("local map too large");
        var texBlobs=j.TexList.Select(t=>t.Failed||t.Blob==null||t.StaticUrl!=null?null:t.Blob).ToArray();
        var json=JsonSerializer.Serialize(new{
            state="ready",location=j.Name,name=j.Loc.DisplayName,width=j.W,height=j.H,tile=16,
            data="/bridge/localmap/blob/"+data,textures=j.TexList.Select((t,i)=>t.StaticUrl??(texBlobs[i]==null?null:"/bridge/localmap/blob/"+texBlobs[i])),
            spriteTints=sprites.Select((s,i)=>(s,i)).Where(p=>p.s.Tint!=uint.MaxValue).ToDictionary(p=>p.i.ToString(),p=>p.s.Tint),
            // Diagnostics for the device gate (7.4): game-thread cost is what matters.
            stats=new{phaseMaxMs=new{start=Math.Round(j.PhaseMax[5],2),sheets=Math.Round(j.PhaseMax[0],2),tiles=Math.Round(j.PhaseMax[1],2),objects=Math.Round(j.PhaseMax[2],2),textures=Math.Round(j.PhaseMax[3],2)},gameMs=Math.Round(j.GameMs,2),gcTicks=j.GcTicks,gc2Ticks=j.Gc2Ticks,maxTickMs=Math.Round(j.MaxTickMs,3),ticks=j.Ticks,textureReads=j.Reads,maxReadMs=Math.Round(j.MaxReadMs,3),tiles=j.Tiles,sprites=j.Sprites.Count,rawKB=raw.Length/1024,dataKB=packed.Length/1024,packMs=Math.Round(sw.Elapsed.TotalMilliseconds,1),elapsedMs=Math.Round(j.Clock.Elapsed.TotalMilliseconds),blobMB=Math.Round(server.LocalBlobBytes/1048576.0,1)}
        },BridgeServer.Json);
        ready[j.Name]=new Ready{Json=json,Blobs=texBlobs.Where(b=>b!=null).Append(data).ToArray()!,At=Stopwatch.GetTimestamp()};
        progress="";
    }

    // Original Cursors pieces (water, tree shadow) ship in the APK: reading them would mean
    // a full readback of the 704x2256 Cursors sheet.
    private static readonly Dictionary<Rectangle,string> StaticCursors=new(){[new Rectangle(0,2064,64,192)]="art/localmap-water.png",[new Rectangle(663,1011,41,30)]="art/localmap-tree-shadow.png"};
    private int TexId(Job j,Texture2D tex,Rectangle? crop){
        if(crop==null&&j.Whole.TryGetValue(tex,out int known))return known;
        var key=$"{tex.Name}#{System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(tex)}{(crop is {} c?$"@{c.X},{c.Y},{c.Width},{c.Height}":"")}";
        if(j.TexIndex.TryGetValue(key,out int id))return id;
        if(!textures.TryGetValue(key,out var t))textures[key]=t=crop is {} sc&&tex==Game1.mouseCursors&&StaticCursors.TryGetValue(sc,out var url)?new Tex{Key=key,StaticUrl=url,Blob="static"}:new Tex{Key=key,Source=tex,Crop=crop};
        id=j.TexList.Count;j.TexList.Add(t);j.TexIndex[key]=id;if(crop==null)j.Whole[tex]=id;return id;
    }
    // Positions are in game units (64 per tile, 4 per texture pixel), matching the draw code.
    private void Add(Job j,Texture2D? tex,Rectangle src,float x,float y,bool flip,float sort,Rectangle? crop=null,Color? tint=null){
        if(tex==null||src.Width<=0||src.Height<=0)return;
        int id=TexId(j,tex,crop);if(crop is {} c)src.Offset(-c.X,-c.Y);
        j.Sprites.Add(new Sprite(id,src,(int)MathF.Round(x),(int)MathF.Round(y),(byte)(flip?1:0),(int)MathF.Round(sort),(tint??Color.White).PackedValue));
    }

    private IEnumerable<bool> WalkSprites(Job j){
        var loc=j.Loc;int n=0;
        foreach(var building in loc.buildings.ToList()){
            if(building.daysOfConstructionLeft.Value>0||building.isMoving)continue;
            if(!building.texture.IsValueCreated)yield return false;
            var tex=building.texture.Value;var data=building.GetData();var src=building.getSourceRect();
            float x=building.tileX.Value*64+(data?.DrawOffset.X??0)*4,bottom=(building.tileY.Value+building.tilesHigh.Value)*64;
            Add(j,tex,src,x,bottom+(data?.DrawOffset.Y??0)*4-src.Height*4,false,bottom-(data?.SortTileOffset??0)*64);
            ++n;yield return true;
        }
        foreach(var pair in loc.terrainFeatures.Pairs.ToList()){
            var tile=pair.Key;float X=tile.X*64,Y=tile.Y*64;
            switch(pair.Value){
                case Flooring floor:
                    if(namesSeen.Add("floor:"+floor.whichFloor.Value+":"+loc.GetSeason()))yield return false;
                    AddFloor(j,floor,X,Y);
                    break;
                case HoeDirt dirt:
                    if(dirt.crop is {} dc&&namesSeen.Add("crop:"+(dc.overrideTexturePath.Value??dc.netSeedIndex.Value)))yield return false;
                    AddDirt(j,dirt,X,Y);
                    break;
                case Tree t when !t.isTemporarilyInvisible:{
                    if(!t.texture.IsValueCreated)yield return false;if(t.texture.Value==null)break;
                    float bottom=t.getBoundingBox().Bottom;int stage=t.growthStage.Value;
                    if(stage<5){var r=stage switch{0=>new Rectangle(32,128,16,16),1=>new Rectangle(0,128,16,16),2=>new Rectangle(16,128,16,16),_=>new Rectangle(0,96,16,32)};
                        Add(j,t.texture.Value,r,X+32-32,Y-(r.Height*4-64)+(stage>=3?128:64)-(stage>=3?128:64),t.flipped.Value,bottom);}
                    else{
                        if(!t.stump.Value){
                            if(t.IsLeafy())Add(j,Game1.mouseCursors,Tree.shadowSourceRect,X-51,Y-16,false,-1,Tree.shadowSourceRect);
                            var top=Tree.treeTopSourceRect;var d=t.GetData();top.X=t.hasMoss.Value?96:(d!=null&&((d.UseAlternateSpriteWhenSeedReady&&t.hasSeed.Value)||(d.UseAlternateSpriteWhenNotShaken&&!t.wasShakenToday.Value)))?48:0;
                            Add(j,t.texture.Value,top,X+32-96,Y+64-384,t.flipped.Value,bottom+2);
                        }
                        var stump=Tree.stumpSourceRect;if(t.hasMoss.Value)stump.X+=96;
                        Add(j,t.texture.Value,stump,X,Y-64,t.flipped.Value,bottom);
                    }
                    break;}
                case FruitTree f when f.texture!=null:{
                    float bottom=f.getBoundingBox().Bottom;int row=f.GetSpriteRowNumber(),stage=f.growthStage.Value;
                    if(stage<4)Add(j,f.texture,new Rectangle(Math.Min(stage,3)*48,row*80,48,80),X+32-96,Y+48-320,f.flipped.Value,bottom);
                    else{if(!f.stump.Value)Add(j,f.texture,new Rectangle((12+(int)f.GetCosmeticSeason()*3)*16,row*80,48,64),X+32-96,Y+64-320,f.flipped.Value,bottom);
                        Add(j,f.texture,new Rectangle(384,row*80+48,48,32),X+32-96,Y+64-128,f.flipped.Value,bottom);}
                    break;}
                case Grass g:{
                    if(!g.texture.IsValueCreated)yield return false;if(g.texture.Value==null)break;
                    var arr=j.GrassOffsets;for(int a=0;a<GrassFields.Length;a++)arr[a]=GrassFields[a]?.GetValue(g) as int[];int count=Math.Min(g.numberOfWeeds.Value,5);
                    for(int i=0;i<count;i++){int W(int a)=>arr[a] is {} v&&i<v.Length?v[i]:0;
                        float gx=i!=4?X+i%2*32+W(3)*4-4+30:X+16+W(1)*4-4+30,gy=i!=4?Y+i/2*32+W(4)*4+40:Y+16+W(2)*4+40;
                        Add(j,g.texture.Value,new Rectangle(W(0)*15,g.grassSourceOffset.Value,15,20),gx-30,gy-70,false,gy);}
                    break;}
            }
            ++n;yield return true;
        }
        foreach(var feature in loc.largeTerrainFeatures.ToList()){
            // Bush.getEffectiveSize() is private; same mapping inlined.
            if(feature is Bush b){
                if(!Bush.texture.IsValueCreated)yield return false;
                int size=b.size.Value switch{3=>0,4=>1,var v=>v};float X=b.Tile.X*64,Y=b.Tile.Y*64,off=size>0&&(!b.townBush.Value||size!=1)&&b.size.Value!=4?64:0,yo=BushYOffset?.GetValue(b) is float f?f:0;
                Add(j,Bush.texture.Value,b.sourceRect.Value,X,Y+64-off+yo-128,b.flipped.Value,b.getBoundingBox().Center.Y+48);
            }
            ++n;yield return true;
        }
        // Furniture (rooms look empty without it): Furniture.draw and BedFurniture.draw.
        foreach(var fu in loc.furniture.ToList()){
            if(fu.isTemporarilyInvisible)continue;
            var data=ItemRegistry.GetDataOrErrorItem(fu.QualifiedItemId);if(data.IsErrorItem)continue;
            if(namesSeen.Add(data.TextureName))yield return false;
            var tex=data.GetTexture();var box=fu.boundingBox.Value;bool flip=fu.flipped.Value;
            // Furniture.updateDrawPosition: the sprite bottom sits on the bounding box bottom.
            var pos=new Vector2(box.X,box.Y-(fu.sourceRect.Value.Height*4-box.Height));
            if(fu is StardewValley.Objects.BedFurniture){var r=data.GetSourceRect();Add(j,tex,r,pos.X,pos.Y,flip,box.Top+1);r.X+=r.Width;Add(j,tex,r,pos.X,pos.Y,flip,box.Bottom-1);}
            else{var r=fu.sourceRect.Value;r.X+=r.Width*NetIntValue(FurnitureOffset?.GetValue(fu));int type=fu.furniture_type.Value;
                // Rugs (type 12) lie under everything else.
                Add(j,tex,r,pos.X,pos.Y,flip,type==12?-100000+fu.TileLocation.Y:box.Bottom-(type is 6 or 17 or 13?48:8));}
            ++n;yield return true;
        }
        foreach(var pair in loc.objects.Pairs.ToList()){
            var o=pair.Value;if(o.isTemporarilyInvisible)continue;
            if(o is Fence fence){if(!fence.fenceTexture.IsValueCreated)yield return false;AddFence(j,fence,pair.Key.X*64,pair.Key.Y*64);++n;yield return true;continue;}
            var data=ItemRegistry.GetDataOrErrorItem(o.QualifiedItemId);if(data.IsErrorItem)continue;if(namesSeen.Add(data.TextureName))yield return false;float X=pair.Key.X*64,Y=pair.Key.Y*64;
            if(o.bigCraftable.Value)Add(j,data.GetTexture(),data.GetSourceRect(o.showNextIndex.Value?1:0,o.ParentSheetIndex),X,Y-64,false,Y+64);
            else Add(j,data.GetTexture(),data.GetSourceRect(0,o.ParentSheetIndex),X,Y,false,Y+64);
            ++n;yield return true;
        }
    }

    // Plain loops over existing locations only. Game1.getLocationFromName is not used: for
    // names like UndergroundMine it creates the level, which a read-only preview must not do.
    private static GameLocation? Find(string name){
        foreach(var l in Game1.locations)if(l.NameOrUniqueName==name)return l;
        foreach(var l in Game1.locations)foreach(var b in l.buildings){var i=b.GetIndoors();if(i!=null&&i.NameOrUniqueName==name)return i;}
        return null;
    }
    private static readonly FieldInfo? RendererSheets=Game1.mapDisplayDevice?.GetType().GetField("m_tileSheetTextures",BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.Public)??typeof(xTile.Display.XnaDisplayDevice).GetField("m_tileSheetTextures",BindingFlags.Instance|BindingFlags.NonPublic);
    // Texture the game's map renderer already holds for this sheet: no load, no copy.
    private static Texture2D? RendererTexture(TileSheet sheet){try{return RendererSheets?.GetValue(Game1.mapDisplayDevice) is Dictionary<TileSheet,Texture2D> d&&d.TryGetValue(sheet,out var t)&&!t.IsDisposed?t:null;}catch{return null;}}
    private static int NetIntValue(object? net)=>net?.GetType().GetProperty("Value")?.GetValue(net) is int v?v:0;
    private static int? Suffix(string id,string group){if(!id.StartsWith(group,StringComparison.Ordinal))return null;var rest=id[group.Length..];return rest.Length==0?0:int.TryParse(rest,out var n)?n:null;}
    private static string State(string state,string name,string? detail)=>JsonSerializer.Serialize(new{state,location=name,detail},BridgeServer.Json);
}
