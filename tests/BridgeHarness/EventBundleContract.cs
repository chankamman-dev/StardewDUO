using System.Net;
using System.Text.Json;
using StardewThor.Bridge;

internal static class EventBundleContract {
    internal static async Task Run(){
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
        Check((await client.GetStringAsync(root+"/v1/events")).Contains("unsupported"),"events absent cache explicit");
        Check((await client.GetStringAsync(root+"/v1/bundles")).Contains("unsupported"),"bundles absent cache explicit");
        var events=new EventDirectory();server.Events=events;Check(!events.Wanted,"events idle is not collected");
        using(var building=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/events?page=0")))Check(building.RootElement.GetProperty("state").GetString()=="building"&&events.Wanted,"initial event GET only requests collection");
        var conditions=new EventConditions("r 0.5",600,1200,2,new[]{"24"},new[]{"Abigail"},new[]{new EventHeart("Abigail",1000,"Friendship")},Array.Empty<EventWhen[]>());
        var entries=Enumerable.Range(0,51).Select(i=>new EventEntry(i.ToString(),"event","Town",null,null,i==0,false,conditions)).ToArray();
        entries[0]=entries[0] with{Dialogue=new[]{new EventDialogue("Alex","我想成为职业运动员。")}};
        events.Publish(new("ready",7,"en",51,entries,Array.Empty<string>()));
        using(var p=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/events")))Check(p.RootElement.GetProperty("entries")[0].GetProperty("dialogue")[0].GetProperty("text").GetString()=="我想成为职业运动员。","event preview survives paged transport");
        using(var p=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/events?page=1")))Check(p.RootElement.GetProperty("entries").GetArrayLength()==1&&p.RootElement.GetProperty("entries")[0].GetProperty("id").GetString()=="50"&&p.RootElement.GetProperty("pages").GetInt32()==2,"fifty rows per page with final remainder");
        using(var p=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/events?page=2")))Check(p.RootElement.GetProperty("state").GetString()=="out-of-range"&&p.RootElement.GetProperty("entries").GetArrayLength()==0,"legal but missing page is explicit");
        foreach(var query in new[]{"-1","82","999999999999999","1.5","","00","%31","1&path=secret","1&page=2","+1"}){
            Check(!EventDirectory.TryPage("/v1/events?page="+query,out _),"invalid page parser "+query);
            // HttpClient normalizes percent-encoded unreserved characters; use the raw request below for those.
            if(query!="%31")Check((await client.GetAsync(root+"/v1/events?page="+query)).StatusCode==HttpStatusCode.BadRequest,"invalid or mixed event page rejected "+query);
        }
        using(var raw=new System.Net.Sockets.TcpClient()){
            await raw.ConnectAsync("127.0.0.1",server.Port);var stream=raw.GetStream();await stream.WriteAsync(System.Text.Encoding.ASCII.GetBytes("GET /v1/events?page=%31 HTTP/1.1\r\nHost: localhost\r\n\r\n"));
            using var reader=new StreamReader(stream);Check((await reader.ReadLineAsync())!.Contains("400 Bad Request"),"raw encoded page rejected over socket");
        }
        Check((await client.GetAsync(root+"/v1/events?limit=500")).StatusCode==HttpStatusCode.BadRequest,"unknown query rejected");
        string firstPage=events.Read(0);for(int page=1;page<=EventDirectory.MaxPage;page++)events.Read(page);
        var cache=(System.Collections.IDictionary)typeof(EventDirectory).GetField("bodies",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance)!.GetValue(events)!;
        Check(cache.Count==EventDirectory.MaxCachedPages,"browsing every event page retains at most eight serialized pages");
        Check(events.Read(0)==firstPage&&cache.Count==EventDirectory.MaxCachedPages,"evicted event page regenerates identically within its cache bound");
        events.Publish(new("absent",8,"en",0,Array.Empty<EventEntry>(),Array.Empty<string>()));Check((await client.GetStringAsync(root+"/v1/events?page=0")).Contains("absent"),"state reset drops prior page cache");
        events.Publish(new("ready",9,"en",1,new[]{entries[0] with{Name=new string('中',128*1024)}},Array.Empty<string>()));
        using(var capped=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/events")))Check(capped.RootElement.GetProperty("limited")[0].GetString()=="response-bytes","event response bytes remain bounded");
        foreach(var route in new[]{"/v1/events","/v1/bundles"})Check((await client.PostAsync(root+route,new StringContent("{}"))).StatusCode==HttpStatusCode.MethodNotAllowed,"document route rejects writes");
        var limited=new HashSet<string>();
        BundleEntry? Parse(string key,string data,bool[]? state=null){limited.Clear();return BundleDataParser.Parse(key,data,state,limited);}
        var b=Parse("Pantry/999","Test/O 495 30/24 1 0 188 5 2/0/1//测试收集包",new[]{true,false})!;
        Check(b.Name=="测试收集包"&&b.Required==1&&b.Complete==true&&b.Items[0].Id=="(O)24"&&b.Items[1].Quality==2&&b.Items[1].Count==5&&b.Items[1].Donated==false,"custom runtime seven-field definition and subset completion parsed");
        Check(b.Reward.Items[0].Id=="(O)495"&&b.Reward.Items[0].Count==30,"reward metadata parsed without native item construction");
        b=Parse("Vault/998","Money//-1 2500 2500/0/1//Money",new[]{false})!;Check(b.Items[0].Currency=="money"&&b.Items[0].Id==null&&b.Items[0].Category==null,"money requirement is not an item ID");
        b=Parse("Custom/997","Category//-75 5 0/0/1//Category")!;Check(b.Items[0].Category==-75&&b.Items[0].Donated==null&&b.Complete==null&&limited.Contains("bundle-status-unknown"),"category and missing completion state retain uncertainty");
        b=Parse("Pantry/996","Unknown/QUERY RANDOM/24 1 0/0/1//Unknown",new[]{false})!;Check(b.Reward.State=="unsupported"&&b.Reward.Raw=="QUERY RANDOM"&&limited.Contains("bundle-reward-unsupported"),"unsupported rewards never run an item query");
        foreach(var (key,data) in new[]{("bad","x"),("Pantry/-1","x//24 1 0/0/1"),("Pantry/1","x//24 1/0/1"),("Pantry/1","x//24 0 0/0/1"),("Pantry/1","x//24 1 -1/0/1"),("Pantry/1","x//24 1 0/0/2"),("Pantry/1","x//"+string.Join(' ',Enumerable.Repeat("24 1 0",33))+"/0/1")})Check(Parse(key,data)==null&&limited.Count>0,"invalid bundle format or limits explicit");
        server.Bundles=new DemandDocument(new BundleReport("joja",2,"en",Array.Empty<BundleRoom>(),Array.Empty<string>()));
        Check((await client.GetStringAsync(root+"/v1/bundles")).Contains("joja"),"Joja state serializes without bundle rows");
        Console.WriteLine($"{n} event and bundle contract checks passed");
    }
}
