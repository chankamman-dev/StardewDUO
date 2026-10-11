using System.Net;
using System.Text.Json;
using StardewThor.Bridge;

internal static class ModManagementContract {
    internal static async Task Run() {
        int n=0; void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
        using(var missing=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/mods")))Check(missing.RootElement.GetProperty("state").GetString()=="unsupported","missing cache is explicit");
        var cache=new DemandDocument(new ModManagement("building",1,"en",0,Array.Empty<ManagedMod>(),"absent",Array.Empty<string>()));server.Mods=cache;
        Check(!cache.Wanted,"idle never demands game collection");
        var initial=await client.GetStringAsync(root+"/v1/mods");Check(cache.Wanted&&initial.Contains("building"),"GET queues only a demand");
        var row=new ManagedMod("example.Mod","例子","1.0.0","author","description",null,null,Array.Empty<string>());
        cache.Publish(new ModManagement("ready",2,"zh",1,new[]{row},"unsupported",Array.Empty<string>()));
        using(var ready=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/mods")))Check(ready.RootElement.GetProperty("mods")[0].GetProperty("hasConfigMenu").ValueKind==JsonValueKind.Null&&ready.RootElement.GetProperty("version").GetInt64()==2,"unknown menu is null over socket");
        Check((await client.PostAsync(root+"/v1/mods",new StringContent("{}"))).StatusCode==HttpStatusCode.MethodNotAllowed,"mods rejects writes");
        Check((await client.GetAsync(root+"/v1/mods?path=config.json")).StatusCode==HttpStatusCode.NotFound,"unexpected query is not accepted");
        var tiny=new DemandDocument(new{value=new string('中',1000)},128);using(var capped=JsonDocument.Parse(tiny.Read()))Check(capped.RootElement.GetProperty("limited")[0].GetString()=="response-bytes","byte cap is explicit");
        string key=new('a',64);var hub=new ControlHub(key);server.Control=hub;
        string Body(long order,string? modId="example.Mod",string? extra=null,string? id=null)=>$"{{\"id\":\"{id??Guid.NewGuid().ToString("N")}\",\"order\":{order},\"session\":\"s\",\"revision\":1,\"action\":\"open-mod-config\",\"modId\":{JsonSerializer.Serialize(modId)}{extra}}}";
        var valid=Body(1);Check((await client.PostAsync(root+"/v2/command",new StringContent(valid))).StatusCode==HttpStatusCode.Forbidden,"open requires pairing key");
        client.DefaultRequestHeaders.Add("X-Stardew-Key",key);
        using(var queued=JsonDocument.Parse(await(await client.PostAsync(root+"/v2/command",new StringContent(valid))).Content.ReadAsStringAsync()))Check(queued.RootElement.GetProperty("state").GetString()=="queued","authorized menu only queues");
        Check(hub.TryTake(out var c)&&c!.ModId=="example.Mod","single game consumer receives mod ID");
        hub.Complete(new(c!.Id,"applied","ok",1));Check(hub.Submit(valid).State=="applied"&&!hub.TryTake(out _),"retry cannot open twice");
        Check(hub.Submit(Body(2,"other.Mod",id:c.Id)).Code=="id-conflict","duplicate ID with different target rejects");
        foreach(var id in new string?[]{null,""," ","../mod","bad/mod","bad\\mod","bad\nmod","坏.Mod",new('x',161),".","..","example..Mod",".Mod","Mod."})Check(hub.Submit(Body(2,id)).Code=="invalid","invalid mod ID rejects");
        foreach(var field in new[]{"\"from\":0","\"from\":-1","\"to\":0","\"amount\":1","\"sourceKey\":\"x\"","\"targetKey\":\"x\"","\"recipeId\":\"x\"","\"boardKey\":\"x\"","\"questKey\":\"x\"","\"toolbarHidden\":false","\"unknown\":true","\"modId\":\"second.Mod\""})Check(hub.Submit(Body(2,extra:","+field)).Code=="invalid","mixed or duplicate menu fields reject");
        Check(hub.Submit(JsonSerializer.Serialize(new Command(Guid.NewGuid().ToString("N"),2,"s",1,"sort",ModId:"example.Mod"),BridgeServer.Json)).Code=="invalid","mod ID cannot leak into inventory actions");
        Check(hub.Submit(Body(1)).Code=="replay","menu retains order guard");
        for(int i=2;i<=9;i++)Check(hub.Submit(Body(i)).State=="queued","bounded menu queue accepts eight");
        Check(hub.Submit(Body(10)).Code=="busy","ninth menu request rejected busy");
        Console.WriteLine($"{n} mod management contract checks passed");
    }
}
