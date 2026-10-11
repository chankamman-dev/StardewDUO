using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
namespace StardewThor.Bridge;
// Architecture v2, phase 1: push instead of poll. The game thread publishes a Snapshot as before;
// a background worker splits the latest one into topics, compares each topic's JSON with what it
// last sent and bumps that topic's version only when it really changed. /v3/stream connections
// receive the topics they asked for as newline-delimited JSON as soon as they change, plus a
// heartbeat every second carrying how old the game's last publish is. Nothing here runs on the
// game thread except Offer(), which only stores a reference and wakes the worker.
//
// Frame:     {"t":"bag","v":12,"session":"…","seq":345,"d":{…}}
// Hello:     {"t":"hello","id":"…"}   (first line; the id names this stream for /v3/demand)
// Document:  {"t":"doc","n":"events","r":7}   (phase 4: a demanded document changed; read it)
// Heartbeat: {"t":"hb","age":120,"seq":345,"mod":"0.10.1-dev.23","busy":"saving"}   (busy only while saving)
public sealed class StreamHub {
    public static readonly string[] Topics={"hud","bag","social","tracking","target","journal","reel"};
    // Phase 4: documents a stream can demand. While the stream is open the demand is renewed (the
    // same lease an HTTP read gives) and each change is announced; the page then reads the document.
    public static readonly string[] Docs={"progress","collections","mods","bundles","items","people","events","farm","target","tracking-map","tracking-profile"};
    public sealed record Demand(Func<long> Revision,Action Touch,Action? Release=null);
    /// Looks a demandable name up (set by BridgeServer); null when that document is not available.
    public Func<string,Demand?>? Resolve;
    private sealed class Link{public string[] Docs=Array.Empty<string>();public readonly SemaphoreSlim Signal=new(0);}
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,Link> links=new();
    /// Replace what documents stream `id` wants; false if no such stream is open.
    public bool SetDemand(string id,string[] docs){if(!links.TryGetValue(id,out var link))return false;var next=Docs.Where(docs.Contains).ToArray();var old=Interlocked.Exchange(ref link.Docs,next);
        // Added: lease at once (a page waiting on it must not wait for the next loop); removed: release.
        foreach(var n in next.Except(old))Resolve?.Invoke(n)?.Touch();foreach(var n in old.Except(next))Resolve?.Invoke(n)?.Release?.Invoke();
        if(link.Signal.CurrentCount==0)link.Signal.Release();return true;}
    public const int MaxStreams=4;
    // At: Unix ms when this topic content changed, so the App can tell how long a change took to arrive.
    private sealed record Part(long Version,string Json,string Session,long Seq,string Compare,long At=0);
    // Run log (every minute): topic changes and document notices since the last report.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,long> counts=new();
    private void Count(string key)=>counts.AddOrUpdate(key,1,(_,n)=>n+1);
    public string TakeCounts(){var keys=counts.Keys.OrderBy(k=>k,StringComparer.Ordinal).ToArray();var parts=new List<string>();foreach(var k in keys)if(counts.TryRemove(k,out var n)&&n>0)parts.Add(k+" "+n);return string.Join(", ",parts);}
    // Fields that move on every collection without anything shown changing: ignored when deciding
    // whether a topic changed (the journal stamps collectedAt on each pass, ~30 KB resent every 0.6 s).
    // Not news for the journal topic: its collection stamp, and the farm pass progress (a pass runs every
    // 5 s while the farm page is open; the Thor log showed the whole journal re-sent ~80 times a minute).
    private static readonly System.Text.RegularExpressions.Regex VolatileFields=new(@"""collectedAt"":-?\d+,?|""scan"":\{[^{}]*\},?",System.Text.RegularExpressions.RegexOptions.Compiled);
    private readonly Dictionary<string,Part> parts=new();
    private readonly object gate=new();
    private Snapshot? pending;
    private int queued;
    private readonly SemaphoreSlim work=new(0);
    private long changes;
    private int streams;
    private readonly List<SemaphoreSlim> listeners=new();
    public long Splits,Pushed;
    public int ActiveStreams=>Volatile.Read(ref streams);
    public StreamHub(CancellationToken stop){_=Task.Run(()=>Worker(stop));}
    /// Game thread: remember the latest snapshot and wake the worker. Superseded snapshots are never split.
    public void Offer(Snapshot snapshot){Volatile.Write(ref pending,snapshot);if(Interlocked.Exchange(ref queued,1)==0)work.Release();}
    private async Task Worker(CancellationToken stop){
        while(!stop.IsCancellationRequested){
            try{await work.WaitAsync(stop);}catch(OperationCanceledException){return;}
            Interlocked.Exchange(ref queued,0);var s=Interlocked.Exchange(ref pending,null);if(s==null)continue;
            try{Split(s);}catch{/* a bad snapshot must not stop the stream; the poll path reports it */}
        }
    }
    private static object Pick(Snapshot s,string topic)=>topic switch{
        "hud"=>new{s.State,s.Language,s.Source,s.World,s.Control,s.Night,s.Context},
        "bag"=>new{s.Revision,s.Bag},
        "social"=>new{s.Social},
        "tracking"=>new{s.Tracking},
        "target"=>new{s.Target,s.TargetState,s.Scene},
        _=>new{s.Journal}};
    internal void Split(Snapshot s){
        Interlocked.Increment(ref Splits);bool changed=false;
        foreach(var topic in Topics){if(topic=="reel")continue;
            var json=JsonSerializer.Serialize(Pick(s,topic),BridgeServer.Json);var compare=topic=="journal"?VolatileFields.Replace(json,""):json;
            lock(gate){
                // A new save session always resends everything, even when a part looks the same.
                if(parts.TryGetValue(topic,out var old)&&old.Compare==compare&&old.Session==s.Session){parts[topic]=old with{Seq=s.Seq};continue;}
                parts[topic]=new(Interlocked.Increment(ref changes),json,s.Session,s.Seq,compare,DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());changed=true;Count("topic "+topic);
            }
        }
        if(changed)lock(listeners)foreach(var l in listeners)if(l.CurrentCount==0)l.Release();
    }
    /// Game thread: a live part outside the snapshot ("reel": the fishing minigame, ~20 times a second while
    /// it is open). An unchanged value is not sent again; null ends it.
    public void Put(string topic,object? value,string session){var json=JsonSerializer.Serialize(value,BridgeServer.Json);
        lock(gate){if(parts.TryGetValue(topic,out var old)&&old.Compare==json&&old.Session==session)return;
            parts[topic]=new(Interlocked.Increment(ref changes),json,session,0,json,DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());Count("topic "+topic);}
        lock(listeners)foreach(var l in listeners)if(l.CurrentCount==0)l.Release();}
    /// Current version of a topic (0 when never published), for tests and diagnostics.
    public long Version(string topic){lock(gate)return parts.TryGetValue(topic,out var p)?p.Version:0;}
    public static string[] Parse(string path){
        var query=path.Contains('?')?path[(path.IndexOf('?')+1)..]:"";
        var wanted=query.Split('&').Where(q=>q.StartsWith("topics=")).SelectMany(q=>Uri.UnescapeDataString(q[7..]).Split(',')).ToHashSet(StringComparer.Ordinal);
        return Topics.Where(wanted.Contains).ToArray();
    }
    /// One /v3/stream connection. Writes headers, every subscribed topic once, then changes and
    /// heartbeats until the client goes away or the server stops.
    public async Task Serve(NetworkStream stream,string path,Func<(long AgeMs,bool Saving,long Seq,string Mod)> freshness,CancellationToken stop){var doc=Resolve;
        var topics=Parse(path);
        if(topics.Length==0||Interlocked.Increment(ref streams)>MaxStreams){
            if(topics.Length>0)Interlocked.Decrement(ref streams);
            var refusal=Encoding.ASCII.GetBytes((topics.Length==0?"HTTP/1.1 400 Bad Request":"HTTP/1.1 503 Service Unavailable")+"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            await stream.WriteAsync(refusal,stop);return;
        }
        var id=Guid.NewGuid().ToString("N");var link=new Link();links[id]=link;var signal=link.Signal;lock(listeners)listeners.Add(signal);
        var sent=topics.ToDictionary(t=>t,_=>0L);var docSent=new Dictionary<string,long>();var touched=Stopwatch.StartNew();
        try{
            await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"),stop);
            var beat=Stopwatch.StartNew();bool first=true;
            while(!stop.IsCancellationRequested){
                var text=new StringBuilder();if(first)text.Append("{\"t\":\"hello\",\"id\":\"").Append(id).Append("\"}\n");
                var wanted=Volatile.Read(ref link.Docs);bool renew=touched.ElapsedMilliseconds>=1000;if(renew)touched.Restart();
                if(doc!=null)foreach(var n in wanted)if(doc(n) is {} d){if(renew)d.Touch();long r=d.Revision();if(!docSent.TryGetValue(n,out var was)||was!=r){text.Append("{\"t\":\"doc\",\"n\":\"").Append(n).Append("\",\"r\":").Append(r).Append("}\n");Count("doc "+n);docSent[n]=r;d.Touch();}}
                foreach(var n in docSent.Keys.Where(k=>!wanted.Contains(k)).ToList())docSent.Remove(n);
                lock(gate)foreach(var t in topics)if(parts.TryGetValue(t,out var p)&&p.Version>sent[t]){
                    text.Append("{\"t\":\"").Append(t).Append("\",\"v\":").Append(p.Version).Append(",\"session\":").Append(JsonSerializer.Serialize(p.Session)).Append(",\"seq\":").Append(p.Seq).Append(",\"at\":").Append(p.At).Append(",\"d\":").Append(p.Json).Append("}\n");sent[t]=p.Version;}
                if(first||beat.ElapsedMilliseconds>=1000||text.Length>0){
                    // The latest seq and the mod version ride on the heartbeat: pages that wait for a newer
                    // snapshot (target demand) must not stall when nothing they show has changed.
                    var (age,saving,seq,mod)=freshness();text.Append("{\"t\":\"hb\",\"age\":").Append(age).Append(",\"seq\":").Append(seq).Append(",\"mod\":").Append(JsonSerializer.Serialize(mod)).Append(saving?",\"busy\":\"saving\"":"").Append("}\n");beat.Restart();first=false;
                }
                var bytes=Encoding.UTF8.GetBytes(text.ToString());
                using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(stop)){timeout.CancelAfter(3000);await stream.WriteAsync(bytes,timeout.Token);await stream.FlushAsync(timeout.Token);}
                Interlocked.Add(ref Pushed,bytes.Length);
                await signal.WaitAsync(Volatile.Read(ref link.Docs).Length>0?250:1000,stop);
            }
        }catch(OperationCanceledException){}catch(IOException){}catch(ObjectDisposedException){}
        finally{lock(listeners)listeners.Remove(signal);links.TryRemove(id,out _);foreach(var n in Volatile.Read(ref link.Docs))Resolve?.Invoke(n)?.Release?.Invoke();Interlocked.Decrement(ref streams);}
    }
}
