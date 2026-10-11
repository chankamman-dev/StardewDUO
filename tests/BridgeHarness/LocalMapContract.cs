using System.Net;
using System.Text.Json;
using StardewThor.Bridge;
// Local map routes: read-only, name-validated, content-addressed blobs with their own
// budget (never evicting inventory/world assets), and optional tracking positions.
internal static class LocalMapContract
{
    public static async Task Run()
    {
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
        var asked=new List<string>();server.LocalMapManifest=name=>{asked.Add(name);return name=="Town"?"{\"state\":\"pending\",\"location\":\"Town\"}":null;};
        var town=await client.GetAsync(root+"/v1/localmap/Town");
        Check(town.StatusCode==HttpStatusCode.OK&&(await town.Content.ReadAsStringAsync()).Contains("pending")&&town.Headers.CacheControl?.NoStore==true,"manifest is served uncached from the collector");
        Check((await client.GetAsync(root+"/v1/localmap/Nowhere")).StatusCode==HttpStatusCode.NotFound,"unknown manifest is 404");
        Check((await client.GetAsync(root+"/v1/localmap/..%2Fsnapshot")).StatusCode==HttpStatusCode.NotFound&&(await client.GetAsync(root+"/v1/localmap/"+new string('a',81))).StatusCode==HttpStatusCode.NotFound&&!asked.Any(a=>a.Contains('/')||a.Length>80),"unsafe or long names never reach the collector");
        Check((await client.GetAsync(root+"/v1/localmap/Farm%20House")).StatusCode==HttpStatusCode.NotFound&&asked.Contains("Farm House"),"escaped names are decoded once");
        Check((await client.PostAsync(root+"/v1/localmap/Town",new StringContent("x"))).StatusCode==HttpStatusCode.MethodNotAllowed,"local map is read-only");
        var png=new byte[]{1,2,3,4};var key=server.AddLocalBlob(png,"image/png")!;
        var blob=await client.GetAsync(root+"/v1/localmap/blob/"+key);
        Check(blob.StatusCode==HttpStatusCode.OK&&(await blob.Content.ReadAsByteArrayAsync()).SequenceEqual(png)&&blob.Content.Headers.ContentType?.MediaType=="image/png","blob round-trips with its type");
        Check(blob.Headers.CacheControl?.MaxAge>=TimeSpan.FromDays(300)&&blob.Headers.CacheControl.ToString().Contains("immutable"),"content-addressed blobs are immutable");
        Check((await client.GetAsync(root+"/v1/localmap/blob/"+new string('0',64))).StatusCode==HttpStatusCode.NotFound,"missing blob is 404");
        Check(server.AddLocalBlob(new byte[BridgeServer.LocalBlobMax+1],"x")==null,"oversized blob refused");
        var asset=server.AddAsset(new byte[]{9});
        // Fill well past the budget: oldest local blobs go, the inventory asset stays.
        var keys=new List<string>();for(int i=0;i<8;i++)keys.Add(server.AddLocalBlob(Enumerable.Repeat((byte)i,4*1024*1024-16).ToArray(),"application/octet-stream")!);
        Check(server.LocalBlobBytes<=BridgeServer.LocalBlobBudget&&!server.HasLocalBlob(keys[0])&&server.HasLocalBlob(keys[^1]),"local blobs stay within budget, oldest evicted");
        Check((await client.GetAsync(root+asset.Replace("/bridge/asset/","/v1/asset/"))).StatusCode==HttpStatusCode.OK,"local maps never evict inventory or world assets");
        server.ClearLocalBlobs();Check(server.LocalBlobBytes==0&&!server.HasLocalBlob(keys[^1]),"clear releases the budget");
        // Tracking stays compatible: local positions are optional trailing fields.
        var t=new Tracking(null,new[]{new Resident("Abigail","阿比盖尔","",null,null,"fall",13,true,Local:new("SeedShop",1.5,9.5))},Array.Empty<RegionMap>(),PlayerLocal:new("Farm",64,15));
        using var doc=JsonDocument.Parse(JsonSerializer.Serialize(t,BridgeServer.Json));
        Check(doc.RootElement.GetProperty("playerLocal").GetProperty("location").GetString()=="Farm"&&doc.RootElement.GetProperty("residents")[0].GetProperty("local").GetProperty("x").GetDouble()==1.5,"local positions serialise camelCase");
        using var old=JsonDocument.Parse(JsonSerializer.Serialize(new Tracking(null,Array.Empty<Resident>(),Array.Empty<RegionMap>()),BridgeServer.Json));
        Check(old.RootElement.GetProperty("playerLocal").ValueKind==JsonValueKind.Null,"absent local position is null, not invented");
        Console.WriteLine($"{n} local map contract tests passed");
    }
}
