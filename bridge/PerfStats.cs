using System.Diagnostics;
using System.Text.Json;
namespace StardewThor.Bridge;
// Read-only timing for finding long frames: how long each part of the bridge takes on the game
// thread, how long whole game frames take (everything: game, other mods, drawing), and what the
// bridge did during the slow ones. Fixed-size rings. Never inspect the managed heap
// from the game thread: Mono's GetTotalMemory(false) can walk it even without a GC.
public sealed class PerfStats {
    public const int Window=1200,SpikeLimit=40;
    public const double SpikeMs=50;
    public const double HitchMs=25;
    public const int HitchLimit=80;
    private sealed class Ring{public readonly double[] V=new double[Window];public int Next,Count;public long Total;public double Max;
        public void Add(double ms){V[Next]=ms;Next=(Next+1)%Window;if(Count<Window)Count++;Total++;if(ms>Max)Max=ms;}}
    public sealed record Spike(long AtMs,double FrameMs,Dictionary<string,double> Bridge,int Gen0,int Gen1,int Gen2,long? ManagedMb);
    private readonly object gate=new();
    private readonly Dictionary<string,Ring> segments=new();
    private readonly Ring frames=new();
    private readonly Queue<Spike> spikes=new();
    private readonly Queue<Spike> hitches=new();
    private readonly Dictionary<string,double> tick=new();
    private readonly Stopwatch clock=Stopwatch.StartNew();
    private long lastFrame;private int gen0,gen1,gen2;
    public long Frames{get;private set;}
    /// Time spent in one named part of the bridge during the current game tick.
    public void Add(string segment,double ms){
        if(!(ms>=0)||double.IsInfinity(ms))return;
        lock(gate){if(!segments.TryGetValue(segment,out var r))segments[segment]=r=new Ring();r.Add(ms);tick[segment]=tick.GetValueOrDefault(segment)+ms;}
    }
    /// Milliseconds since `started` (a Stopwatch timestamp) recorded under `segment`; returns now.
    public long Mark(string segment,long started){long now=Stopwatch.GetTimestamp();Add(segment,(now-started)*1000.0/Stopwatch.Frequency);return now;}
    /// Called once per game tick. The interval since the previous tick is the whole frame.
    public void Frame(){
        long now=Stopwatch.GetTimestamp();int g0=GC.CollectionCount(0),g1=GC.CollectionCount(1),g2=GC.CollectionCount(2);
        lock(gate){
            if(lastFrame!=0){
                double ms=(now-lastFrame)*1000.0/Stopwatch.Frequency;frames.Add(ms);Frames++;
                if(ms>=HitchMs){
                    var row=new Spike(clock.ElapsedMilliseconds,Math.Round(ms,2),tick.ToDictionary(p=>p.Key,p=>Math.Round(p.Value,3)),g0-gen0,g1-gen1,g2-gen2,null);
                    if(hitches.Count==HitchLimit)hitches.Dequeue();hitches.Enqueue(row);
                    if(ms>=SpikeMs){if(spikes.Count==SpikeLimit)spikes.Dequeue();spikes.Enqueue(row);}
                }
            }
            lastFrame=now;gen0=g0;gen1=g1;gen2=g2;tick.Clear();
        }
        // Attribute the recorder to the frame it actually runs in, just like the
        // collection segments. Previously this cost was invisible in every spike.
        Mark("perf.frame",now);
    }
    /// For the run log (called on its writer thread): frame percentiles over the current window and
    /// the six parts of the bridge with the largest recent maximum. One short JSON line.
    public string Report(){
        Samples frame;List<(string Key,Samples S)> parts;long count;
        lock(gate){frame=Copy(frames);parts=segments.Select(p=>(p.Key,Copy(p.Value))).ToList();count=Frames;}
        double Max(Samples s)=>s.Values.Length==0?0:s.Values.Max();
        var top=parts.Select(p=>(p.Key,Summary:Summary(p.S),Max:Max(p.S))).Where(p=>p.Max>=1).OrderByDescending(p=>p.Max).Take(6).ToDictionary(p=>p.Key,p=>p.Summary);
        return JsonSerializer.Serialize(new{frames=count,frame=Summary(frame),top},BridgeServer.Json);
    }
    /// Long frames recorded after `cursor` (clock ms), at least `minMs`; advances the cursor.
    public Spike[] LongFramesSince(ref long cursor,double minMs){
        Spike[] rows;lock(gate)rows=hitches.ToArray();long from=cursor;
        var fresh=rows.Where(r=>r.AtMs>from&&r.FrameMs>=minMs).ToArray();if(rows.Length>0)cursor=Math.Max(cursor,rows.Max(r=>r.AtMs));return fresh;
    }
    private sealed record Samples(double[] Values,double Max,long Total);
    private static Samples Copy(Ring r){var v=new double[r.Count];Array.Copy(r.V,v,r.Count);return new(v,r.Max,r.Total);}
    private static object Summary(Samples r){
        var v=r.Values;if(v.Length==0)return new{count=0,total=r.Total};Array.Sort(v);
        double P(double q)=>Math.Round(v[Math.Min(v.Length-1,(int)Math.Floor(q*(v.Length-1)))],3);
        return new{count=v.Length,total=r.Total,p50=P(.5),p95=P(.95),p99=P(.99),max=Math.Round(r.Max,3),windowMax=Math.Round(v[^1],3),overSpike=v.Count(x=>x>=SpikeMs)};
    }
    public string Json(){
        Samples frame;Dictionary<string,Samples> parts;Spike[] recent,shortStalls;long count,uptime;
        lock(gate){
            frame=Copy(frames);parts=segments.ToDictionary(p=>p.Key,p=>Copy(p.Value));recent=spikes.ToArray();shortStalls=hitches.ToArray();count=Frames;uptime=clock.ElapsedMilliseconds;
        }
        // Sorting and UTF-8/JSON work run on the HTTP thread without blocking ticks.
        return JsonSerializer.Serialize(new{window=Window,spikeMs=SpikeMs,frames=count,uptimeMs=uptime,
            heapMeasurement="disabled",maxScope="lifetime",frame=Summary(frame),bridge=parts.OrderBy(p=>p.Key).ToDictionary(p=>p.Key,p=>Summary(p.Value)),spikes=recent,hitchMs=HitchMs,hitches=shortStalls},BridgeServer.Json);
    }
}
