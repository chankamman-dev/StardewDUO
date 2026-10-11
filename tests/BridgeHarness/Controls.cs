using System.Net;
using System.Text.Json;
using StardewThor.Bridge;
internal static class Controls {
 public static async Task Run(){
  string key=new('a',64);var hub=new ControlHub(key);using var server=new BridgeServer(0){Control=hub};server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
  int checks=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);checks++;}
  var c=new Command(Guid.NewGuid().ToString("N"),1,"test",1,"move",0,1,2,"item",null);string body=JsonSerializer.Serialize(c,BridgeServer.Json);
  Check((await client.PostAsync(root+"/v2/command",new StringContent(body))).StatusCode==HttpStatusCode.Forbidden,"no key denied");
  client.DefaultRequestHeaders.Add("X-Stardew-Key",key);
  async Task<Receipt> Send(string b)=>JsonSerializer.Deserialize<Receipt>(await (await client.PostAsync(root+"/v2/command",new StringContent(b))).Content.ReadAsStringAsync(),BridgeServer.Json)!;
  Check((await Send(body)).State=="queued","authenticated enqueue");Check(hub.TryTake(out var taken)&&taken==c,"only game consumer takes command");
  hub.Complete(new(c.Id,"applied","ok",2));Check((await Send(body)).State=="applied","retry returns original receipt");Check(!hub.TryTake(out _),"retry cannot execute twice");
  Check((await Send(JsonSerializer.Serialize(c with{Amount=9},BridgeServer.Json))).Code=="id-conflict","id reuse cannot change payload");
  Check((await Send(JsonSerializer.Serialize(c with{Id=Guid.NewGuid().ToString("N")},BridgeServer.Json))).Code=="replay","old order rejected");
  Check((await client.GetStringAsync(root+"/v2/receipt/"+c.Id)).Contains("applied"),"receipt over socket");
  Check((await Send("{}")).Code=="invalid","malformed request does not crash server");
  for(int i=2;i<270;i++){var n=c with{Id=Guid.NewGuid().ToString("N"),Order=i};hub.Submit(JsonSerializer.Serialize(n,BridgeServer.Json));hub.TryTake(out _);hub.Complete(new(n.Id,"applied","ok"));}
  Check(hub.Get(c.Id)==null&&(await Send(body)).Code=="replay","replay rejected after bounded history eviction");
  var expired=c with{Id=Guid.NewGuid().ToString("N"),Order=999};hub.Submit(JsonSerializer.Serialize(expired,BridgeServer.Json));await Task.Delay(2050);Check(!hub.TryTake(out _)&&hub.Get(expired.Id)?.Code=="expired","expired queue never executes");
  string asset=server.AddAsset(new byte[]{137,80,78,71});Check((await client.GetByteArrayAsync(root+asset.Replace("/bridge/","/v1/"))).Length==4,"bounded immutable assets served separately");
  Console.WriteLine($"{checks} authenticated control and asset tests passed");
 }
}
