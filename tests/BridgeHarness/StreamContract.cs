using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using StardewThor.Bridge;
// Architecture v2 phase 1: /v3/stream sends each subscribed topic once, then only real changes (a new
// seq alone is not a change), heartbeats every second, and does not block the ordinary routes.
internal static class StreamContract
{
    private sealed class Reader:IDisposable{
        private readonly TcpClient client=new();private NetworkStream? stream;private readonly StringBuilder pending=new();
        public readonly List<JsonElement> Frames=new();
        public async Task Open(int port,string topics){await client.ConnectAsync("127.0.0.1",port);stream=client.GetStream();
            await stream.WriteAsync(Encoding.ASCII.GetBytes($"GET /v3/stream?topics={topics} HTTP/1.1\r\nHost: x\r\n\r\n"));}
        /// Read until `until` holds or the timeout passes; returns elapsed ms.
        public async Task<long> Until(Func<List<JsonElement>,bool> until,int timeoutMs){var clock=Stopwatch.StartNew();var buffer=new byte[65536];
            while(!until(Frames)&&clock.ElapsedMilliseconds<timeoutMs){
                using var cts=new CancellationTokenSource(Math.Max(1,timeoutMs-(int)clock.ElapsedMilliseconds));int n;
                try{n=await stream!.ReadAsync(buffer,cts.Token);}catch(OperationCanceledException){break;}if(n==0)break;
                pending.Append(Encoding.UTF8.GetString(buffer,0,n));var text=pending.ToString();int cut=text.IndexOf("\r\n\r\n");
                if(cut>=0&&text.StartsWith("HTTP/")){text=text[(cut+4)..];}
                var lines=text.Split('\n');pending.Clear().Append(lines[^1]);
                foreach(var line in lines[..^1])if(line.StartsWith("{"))Frames.Add(JsonDocument.Parse(line).RootElement.Clone());}
            return clock.ElapsedMilliseconds;}
        public void Dispose()=>client.Dispose();
    }
    public static async Task Run()
    {
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        using var server=new BridgeServer(0);server.Start();
        Snapshot Snap(long seq,int stack)=>new("s1",seq,1,"ready","zh",new Bag(2,new Slot?[]{new(0,"(O)24","防风草","fixture",stack,0,null),null}),0.2,"synthetic",new World(12345,1,1,"spring",600,"Farm","t"));
        server.Publish(Snap(1,5));await Task.Delay(100);
        using var reader=new Reader();await reader.Open(server.Port,"hud,bag");
        await reader.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="hb"),2000);
        var topics=reader.Frames.Select(x=>x.GetProperty("t").GetString()).ToList();
        Check(topics.Count(t=>t=="hud")==1&&topics.Count(t=>t=="bag")==1,"each subscribed topic is sent once on connect");
        Check(!topics.Contains("journal"),"only subscribed topics are sent");
        var bag=reader.Frames.First(x=>x.GetProperty("t").GetString()=="bag");
        Check(bag.GetProperty("d").GetProperty("bag").GetProperty("slots")[0].GetProperty("stack").GetInt32()==5&&bag.GetProperty("session").GetString()=="s1","topic frame carries data and session");
        // Only seq moves (the backend publishes every few ticks): heartbeats, no topic frames.
        reader.Frames.Clear();for(int i=2;i<8;i++){server.Publish(Snap(i,5));await Task.Delay(150);}
        await reader.Until(_=>false,1300);
        Check(reader.Frames.All(x=>x.GetProperty("t").GetString()=="hb")&&reader.Frames.Count>=1,"an unchanged snapshot sends only heartbeats");
        Check(reader.Frames.Last().GetProperty("age").GetInt64()<2000,"heartbeat carries the age of the last publish");
        // A real change arrives right away.
        reader.Frames.Clear();server.Publish(Snap(9,6));
        var ms=await reader.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="bag"),2000);
        Check(reader.Frames.Any(x=>x.GetProperty("t").GetString()=="bag")&&ms<300,"a changed bag is pushed within 300 ms ("+ms+" ms)");
        Check(!reader.Frames.Any(x=>x.GetProperty("t").GetString()=="hud"),"an unchanged topic is not resent with a changed one");
        // Ordinary routes are not blocked by an open stream.
        using(var http=new HttpClient{Timeout=TimeSpan.FromSeconds(2)}){var clock=Stopwatch.StartNew();var raw=await http.GetStringAsync($"http://127.0.0.1:{server.Port}/v1/snapshot");
            Check(raw.Contains("\"seq\":9")&&clock.ElapsedMilliseconds<1000,"/v1/snapshot answers while a stream is open");}
        // Bounded number of streams; a bad request is refused.
        var extra=new List<Reader>();for(int i=0;i<StreamHub.MaxStreams;i++){var r=new Reader();await r.Open(server.Port,"hud");extra.Add(r);}
        await Task.Delay(300);
        using(var tcp=new TcpClient()){await tcp.ConnectAsync("127.0.0.1",server.Port);var s=tcp.GetStream();await s.WriteAsync(Encoding.ASCII.GetBytes("GET /v3/stream?topics=hud HTTP/1.1\r\n\r\n"));var buf=new byte[256];var got=await s.ReadAsync(buf);Check(Encoding.ASCII.GetString(buf,0,got).StartsWith("HTTP/1.1 503"),"streams beyond the limit are refused");}
        foreach(var r in extra)r.Dispose();
        Check(StreamHub.Parse("/v3/stream?topics=bag,nope,hud").SequenceEqual(new[]{"hud","bag"}),"unknown topics are ignored");
        // Phase 4: documents are demanded over the stream (the lease is renewed while it is open) and
        // each publish is announced with a small notice.

        using(var docStream=new Reader()){
            await Task.Delay(1500);// closed streams are noticed on their next write (<= 1 s)
            server.Progress=new DemandDocument(new{version=1,state="ready"});
            await docStream.Open(server.Port,"hud");await docStream.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="hello"),2000);
            var id=docStream.Frames.First(x=>x.GetProperty("t").GetString()=="hello").GetProperty("id").GetString()!;
            Check(!server.Progress.Wanted,"nothing is demanded before the page asks");
            using var http=new HttpClient{Timeout=TimeSpan.FromSeconds(2)};
            var ok=await http.GetAsync($"http://127.0.0.1:{server.Port}/v3/demand?id={id}&docs=progress,nope");Check(ok.IsSuccessStatusCode,"demand accepted for an open stream");
            docStream.Frames.Clear();await docStream.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="doc"),1000);
            var notice=docStream.Frames.FirstOrDefault(x=>x.GetProperty("t").GetString()=="doc");
            Check(notice.ValueKind==JsonValueKind.Object&&notice.GetProperty("n").GetString()=="progress","a demanded document is announced at once");
            Check(server.Progress.Wanted,"an open stream holds the document's lease");
            long before=notice.GetProperty("r").GetInt64();docStream.Frames.Clear();server.Progress.Publish(new{version=2,state="ready",met=new[]{"Abigail"}});
            var docMs=await docStream.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="doc"),1500);
            var next=docStream.Frames.FirstOrDefault(x=>x.GetProperty("t").GetString()=="doc");
            Check(next.ValueKind==JsonValueKind.Object&&next.GetProperty("r").GetInt64()>before&&docMs<400,"a new publish is announced within 400 ms ("+docMs+" ms)");
            // Content revision: a republish that only moves the version counter is not announced.
            docStream.Frames.Clear();server.Progress.Publish(new{version=3,state="ready",met=new[]{"Abigail"}});await Task.Delay(700);
            Check(!docStream.Frames.Any(x=>x.GetProperty("t").GetString()=="doc"),"a version-only republish is not announced");
            Check((await http.GetAsync($"http://127.0.0.1:{server.Port}/v3/demand?id={new string('0',32)}&docs=progress")).StatusCode==System.Net.HttpStatusCode.NotFound,"demand for an unknown stream is refused");
            // Phase 5: the display leases are demanded the same way; leaving releases them at once.
            await http.GetAsync($"http://127.0.0.1:{server.Port}/v3/demand?id={id}&docs=target,tracking-map");
            Check(server.WantsTarget&&server.WantsMap,"target and map leases start with the demand");
            await Task.Delay(2600);Check(server.WantsTarget&&server.WantsMap,"an open stream keeps renewing them past their 1.5/2.5 s leases");
            await http.GetAsync($"http://127.0.0.1:{server.Port}/v3/demand?id={id}&docs=tracking-profile");
            Check(!server.WantsTarget&&server.TrackingMode=="profile","dropping a lease releases it at once; profile replaces map");
            await http.GetAsync($"http://127.0.0.1:{server.Port}/v3/demand?id={id}&docs=farm");Check(server.WantsFarm&&!server.WantsTracking,"farm lease through the stream");
        }
        await Task.Delay(1300);Check(!server.WantsFarm,"a closed stream releases what it held");
        // The fishing minigame frames: outside the snapshot, unchanged ones not resent, null ends them.
        {using var reel=new Reader();await reel.Open(server.Port,"reel");await reel.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="hb"),2000);reel.Frames.Clear();
            var frame=new ReelFrame(120.5,140,300,0.42,true,false,0,0,false,false,true,null);server.Streams.Put("reel",frame,"s1");server.Streams.Put("reel",frame,"s1");
            await reel.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="reel"),2000);await Task.Delay(300);
            var got=reel.Frames.Where(x=>x.GetProperty("t").GetString()=="reel").ToList();Check(got.Count==1&&got[0].GetProperty("d").GetProperty("bar").GetDouble()==120.5&&got[0].GetProperty("d").GetProperty("progress").GetDouble()==0.42,"a reel frame arrives once with its positions");
            var before=server.Streams.Version("reel");server.Publish(Snap(40,9));await Task.Delay(200);Check(server.Streams.Version("reel")==before,"a snapshot does not touch the reel topic");
            reel.Frames.Clear();server.Streams.Put("reel",null,"s1");await reel.Until(f=>f.Any(x=>x.GetProperty("t").GetString()=="reel"),2000);Check(reel.Frames.First(x=>x.GetProperty("t").GetString()=="reel").GetProperty("d").ValueKind==JsonValueKind.Null,"an empty frame ends the minigame");}
        Console.WriteLine(n+" stream contract checks passed");
    }
}
