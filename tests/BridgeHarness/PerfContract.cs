using System.Text.Json;
using StardewThor.Bridge;
// Long-frame diagnostics: bounded, read-only, attributes slow frames to bridge parts.
internal static class PerfContract
{
    public static async Task Run()
    {
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        var perf=new PerfStats();
        using(var empty=JsonDocument.Parse(perf.Json()))Check(empty.RootElement.GetProperty("frame").GetProperty("count").GetInt32()==0&&empty.RootElement.GetProperty("spikes").GetArrayLength()==0,"empty before any frame");
        perf.Frame();for(int i=0;i<3;i++){perf.Add("collect",2);perf.Frame();}
        perf.Add("collect",7);perf.Add("localmap",1.5);perf.Add("collect",1);Thread.Sleep((int)PerfStats.SpikeMs+15);perf.Frame();
        perf.Add("commands",double.NaN);perf.Add("commands",-1);perf.Add("commands",double.PositiveInfinity);
        using(var doc=JsonDocument.Parse(perf.Json())){var r=doc.RootElement;
            Check(r.GetProperty("frames").GetInt64()==4&&r.GetProperty("frame").GetProperty("count").GetInt32()==4,"first tick has no interval; later ticks are frames");
            var spikes=r.GetProperty("spikes");Check(spikes.GetArrayLength()==1&&spikes[0].GetProperty("frameMs").GetDouble()>=PerfStats.SpikeMs,"slow frame becomes a spike");
            Check(r.GetProperty("hitchMs").GetDouble()==25&&r.GetProperty("spikeMs").GetDouble()==50,"short stalls supplement the unchanged long-frame threshold");
            Check(r.GetProperty("hitches").EnumerateArray().Any(h=>h.GetProperty("atMs").GetInt64()==spikes[0].GetProperty("atMs").GetInt64()),"long frame is also available in short-stall diagnostics");
            Check(r.GetProperty("hitches").GetArrayLength()<=PerfStats.HitchLimit,"short-stall diagnostics bounded");
            var bridge=spikes[0].GetProperty("bridge");Check(bridge.GetProperty("collect").GetDouble()==8&&bridge.GetProperty("localmap").GetDouble()==1.5,"spike keeps what the bridge did in that frame");
            Check(spikes[0].TryGetProperty("gen0",out _)&&spikes[0].GetProperty("managedMb").ValueKind==JsonValueKind.Null&&r.GetProperty("heapMeasurement").GetString()=="disabled","GC counters retained; heap measurement explicitly unavailable");
            Check(r.GetProperty("bridge").GetProperty("perf.frame").GetProperty("count").GetInt32()==5,"recorder overhead is visible, including first tick");
            var c=r.GetProperty("bridge").GetProperty("collect");Check(c.GetProperty("count").GetInt32()==5&&c.GetProperty("max").GetDouble()==7&&c.GetProperty("p50").GetDouble()==2,"per-part percentiles");
            Check(!r.GetProperty("bridge").TryGetProperty("commands",out _),"invalid durations ignored");}
        for(int i=0;i<PerfStats.Window*2;i++)perf.Add("bulk",i);
        using(var doc=JsonDocument.Parse(perf.Json()))Check(doc.RootElement.GetProperty("bridge").GetProperty("bulk").GetProperty("count").GetInt32()==PerfStats.Window,"ring stays bounded");
        using(var doc=JsonDocument.Parse(perf.Json()))Check(doc.RootElement.GetProperty("bridge").GetProperty("bulk").GetProperty("total").GetInt64()==PerfStats.Window*2,"lifetime count still detects work after ring fills");
        // A stale outlier must not masquerade as the latest window's maximum.
        perf.Add("rolling",500);for(int i=0;i<PerfStats.Window;i++)perf.Add("rolling",1);
        using(var doc=JsonDocument.Parse(perf.Json())){var r=doc.RootElement.GetProperty("bridge").GetProperty("rolling");Check(r.GetProperty("max").GetDouble()==500&&r.GetProperty("windowMax").GetDouble()==1,"lifetime and current-window maxima distinguished");}
        var writer=Task.Run(()=>{for(int i=0;i<4000;i++){perf.Add("concurrent",1);perf.Frame();}});
        for(int i=0;i<30;i++){using var concurrent=JsonDocument.Parse(perf.Json());Check(concurrent.RootElement.GetProperty("frame").GetProperty("count").GetInt32()<=PerfStats.Window,"concurrent reads stay bounded");}
        await writer;
        using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();
        server.Perf.Frame();server.Perf.Add("collect",3);server.Perf.Frame();
        using(var doc=JsonDocument.Parse(await client.GetStringAsync($"http://127.0.0.1:{server.Port}/v1/perf")))Check(doc.RootElement.GetProperty("bridge").GetProperty("collect").GetProperty("count").GetInt32()==1,"served over the loopback endpoint");
        Check(!server.HasReader,"reading timings does not start snapshot collection");
        Console.WriteLine(n+" perf contract checks passed");
    }
}
