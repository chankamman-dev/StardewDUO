using System.Net;
using System.Text.Json;
using StardewThor.Bridge;

internal static class FarmExtrasContract {
    internal static async Task Run(){
        int count=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);count++;Console.WriteLine("PASS "+label);}
        using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string uri=$"http://127.0.0.1:{server.Port}/v1/farm";
        Check(!server.WantsFarm,"farm-only collector idle without reader");
        Check((await client.GetAsync(uri)).StatusCode==HttpStatusCode.NotFound,"no world report is not fabricated");Check(server.WantsFarm,"farm lease activates even before report ready");
        var farm=new FarmReport(4,1,"ready",Array.Empty<FarmPlace>(),null,Array.Empty<string>());server.PublishFarm(farm);
        var first=JsonSerializer.Deserialize<FarmReport>(await client.GetStringAsync(uri),BridgeServer.Json)!;
        Check(first.Extras==null,"old farm contract retains optional absent extras");
        var extras=new FarmExtras(1,"ready",new("absent"),new("ready","vanilla","absent",null,Array.Empty<FamilyChild>()),new("absent"),new[]{new SlayerGoal("Slimes","史莱姆",0,1000,"(O)520",false)},Array.Empty<string>());
        server.SetFarmExtras(extras);var combined=JsonSerializer.Deserialize<FarmReport>(await client.GetStringAsync(uri),BridgeServer.Json)!;
        Check(combined.Extras?.Slayer[0].Name=="史莱姆","UTF8 extras survive actual socket");Check(combined.Version>first.Version,"extras completion advances farm version");
        Check(server.ComposedFarmVersion==combined.Version,"snapshot version source equals composed HTTP farm version");
        server.PublishFarm(farm);Check(JsonSerializer.Deserialize<FarmReport>(await client.GetStringAsync(uri),BridgeServer.Json)!.Version==combined.Version,"unchanged source keeps composed version stable");
        server.PublishFarm(farm with{Version=2});var renewed=JsonSerializer.Deserialize<FarmReport>(await client.GetStringAsync(uri),BridgeServer.Json)!;
        Check(renewed.Version>combined.Version,"old source version cannot roll composed version backward");
        server.SetFarmExtras(null);Check(JsonSerializer.Deserialize<FarmReport>(await client.GetStringAsync(uri),BridgeServer.Json)!.Extras==null,"save/language invalidation clears extras");
        server.PublishFarm(null);Check((await client.GetAsync(uri)).StatusCode==HttpStatusCode.NotFound,"title clears full farm composite");
        Check(server.ComposedFarmVersion==null,"title clears composed snapshot version source");
        Console.WriteLine($"PASS farm extras contract {count} checks");
    }
}
