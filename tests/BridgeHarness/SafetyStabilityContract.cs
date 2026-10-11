using System.Net;using System.Text.Json;using StardewThor.Bridge;
internal static class SafetyStabilityContract {
 public static async Task Run(){int count=0;void Check(bool b,string name){if(!b)throw new Exception(name);count++;}
 var hub=new ControlHub(new string('c',64));string Body(Command c)=>JsonSerializer.Serialize(c,BridgeServer.Json);
 var c=new Command(Guid.NewGuid().ToString("N"),1,"safe",1,"select",0);
 foreach(var bad in new[]{Body(c).Replace("\"order\":1","\"order\":2,\"order\":1"),Body(c).Replace("\"action\":\"select\"","\"action\":\"trash\",\"action\":\"select\""),Body(c).Replace("\"session\":\"safe\"","\"unknown\":true,\"session\":\"safe\""),"[]","null",Body(c).Replace("\"session\":\"safe\"","\"session\":\""+new string('中',700)+"\""),new string('[',100)+new string(']',100)}){Check(hub.Submit(bad).Code=="invalid","ambiguous or oversize JSON rejected");Check(!hub.TryTake(out _),"invalid payload never reaches game queue");}
 Check(!hub.Authorize(new string('c',100000))&&hub.Authorize(new string('c',64)),"key length bounded before encoding");
 for(int i=1;i<=8;i++)Check(hub.Submit(Body(c with{Id=Guid.NewGuid().ToString("N"),Order=i})).State=="queued","bounded valid queue");
 Check(hub.Submit(Body(c with{Id=Guid.NewGuid().ToString("N"),Order=9})).Code=="busy","ninth queued command refused");for(int i=0;i<8;i++)Check(hub.TryTake(out _),"queue drains in order");Check(!hub.TryTake(out _),"queue empty after drain");
 Check(!ContentDependencies.Classify("Portraits/Abigail").HasFlag(ContentDependency.Progress),"portrait does not reset progress");
 Check(ContentDependencies.Classify("Characters/Abigail").HasFlag(ContentDependency.CatalogPeople),"sprite refreshes people");
 Check(ContentDependencies.Classify("Data\\Events\\Town")==ContentDependency.Events,"event changes only event metadata");
 Check(ContentDependencies.Classify("Maps/Town").HasFlag(ContentDependency.LocalMaps),"map refreshes terrain");
 Check(ContentDependencies.Classify("Maps/springobjects").HasFlag(ContentDependency.Textures),"item sheet refreshes the icons cut from it");
 Check(ContentDependencies.Classify("Mods/CustomUnknown")==(ContentDependency.Textures|ContentDependency.LocalMaps),"an unknown texture refreshes icons by name, not every reader");
 Check(ContentDependencies.Classify("LooseSprites/font_bold")==ContentDependency.None,"a font (re-invalidated on every warp) refreshes nothing");
 Check(ContentDependencies.Classify("CustomCompanions/Companions/X")!=ContentDependency.All,"a companion pack does not reset the journal");
 Check(ContentDependencies.Classify("Data/Objects")==ContentDependency.All&&ContentDependencies.Classify("Strings/StringsFromCSFiles")==ContentDependency.All&&ContentDependencies.Classify("Mods/x/Strings/Misc")==ContentDependency.All,"game data and text still refresh everything");
 using var server=new BridgeServer(0){Control=new ControlHub(new string('d',64))};server.Start();server.Publish(new("safe",1,0,"title","en",null,0,"synthetic"));using var client=new HttpClient();string url=$"http://127.0.0.1:{server.Port}";
 foreach(var route in new[]{"/v1/events?page=-1","/v1/catalog/items?page=9999","/v1/asset/../config.json","/v2/receipt/nope"})Check(!(await client.GetAsync(url+route)).IsSuccessStatusCode,"invalid route rejected");
 Check((await client.PostAsync(url+"/v2/command",new StringContent(Body(c)))).StatusCode==HttpStatusCode.Forbidden,"unpaired writes denied after malformed reads");
 var replies=await Task.WhenAll(Enumerable.Range(0,40).Select(_=>client.GetStringAsync(url+"/v1/state")));Check(replies.All(r=>JsonDocument.Parse(r).RootElement.GetProperty("snapshot").GetProperty("session").GetString()=="safe"),"concurrent burst retains complete immutable DTO");
 Check(server.SerializedSnapshots==1,"burst reuses serialized snapshot");Console.WriteLine($"{count} safety and stability checks passed");
 }
}
