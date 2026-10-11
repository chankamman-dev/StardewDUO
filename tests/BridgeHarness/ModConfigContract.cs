using System.Net;
using System.Text.Json;
using StardewThor.Bridge;

internal static class ModConfigContract {
 internal static async Task Run(){
  int checks=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);checks++;}
  using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
  var mailbox=new ModConfigMailbox();server.ModConfig=mailbox;
  Check(mailbox.WantedId==null,"no demand while closed");
  Check((await client.GetStringAsync(root+"/v1/mod-config/example.Mod")).Contains("building")&&mailbox.WantedId=="example.Mod","GET only queues requested mod");
  mailbox.Publish(new("ready","example.Mod","session","en",new('a',64),Array.Empty<ModConfigOption>(),Array.Empty<string>()));
  Check((await client.GetStringAsync(root+"/v1/mod-config/other.Mod")).Contains("building"),"other mod never receives previous mod options");
  foreach(var path in new[]{"/v1/mod-config/","/v1/mod-config/../bad","/v1/mod-config/a..b","/v1/mod-config/example.Mod?path=config.json"})Check((await client.GetAsync(root+path)).StatusCode==HttpStatusCode.NotFound,"invalid route rejects");
  Check((await client.PostAsync(root+"/v1/mod-config/example.Mod",new StringContent("{}"))).StatusCode==HttpStatusCode.MethodNotAllowed,"settings GET route refuses writes");
  mailbox.Clear();Check(mailbox.WantedId==null,"session clear removes demand and values");
  string previewRoot=Path.Combine(Path.GetTempPath(),"stardew-mod-preview-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(previewRoot);
  try {
   Directory.CreateDirectory(Path.Combine(previewRoot,"Portraits"));var png=Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=");
   File.WriteAllBytes(Path.Combine(previewRoot,"Portraits","Example.png"),png);server.ModPreviews.Register("example.Preview",previewRoot);
   using var image=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/mod-preview/example.Preview"));
   Check(image.RootElement.GetProperty("state").GetString()=="ready"&&image.RootElement.GetProperty("portrait").GetBoolean(),"local portrait preview uses registered root");
   File.Delete(Path.Combine(previewRoot,"Portraits","Example.png"));Check((await client.GetStringAsync(root+"/v1/mod-preview/example.Preview")).Contains("data:image/png;base64,"),"cached preview never rereads file");
   Check((await client.GetStringAsync(root+"/v1/mod-preview/unknown.Mod")).Contains("unavailable"),"unregistered roots are inaccessible");
   Check((await client.GetAsync(root+"/v1/mod-preview/example.Preview?path=config.json")).StatusCode==HttpStatusCode.NotFound,"preview cannot select arbitrary file");
   string bad=Path.Combine(previewRoot,"Bad");Directory.CreateDirectory(bad);File.WriteAllBytes(Path.Combine(bad,"logo.png"),new byte[300000]);server.ModPreviews.Register("example.Bad",bad);
   Check((await client.GetStringAsync(root+"/v1/mod-preview/example.Bad")).Contains("unavailable"),"oversize preview rejected");
  } finally {Directory.Delete(previewRoot,true);}
  var hub=new ControlHub(new('a',64));server.Control=hub;
  string Body(string changes="[{\"key\":\"0\",\"value\":true}]",string extra="")=>$"{{\"id\":\"{Guid.NewGuid():N}\",\"order\":1,\"session\":\"s\",\"revision\":0,\"action\":\"save-mod-config\",\"modId\":\"example.Mod\",\"configToken\":\"{new string('a',64)}\",\"configChanges\":{changes}{extra}}}";
  Check((await client.PostAsync(root+"/v2/command",new StringContent(Body()))).StatusCode==HttpStatusCode.Forbidden,"save requires pairing key");
  foreach(var changes in new[]{"[]","null","[null]","[{\"key\":\"128\",\"value\":1}]","[{\"key\":\"0\",\"value\":{}}]","[{\"key\":\"0\",\"value\":true},{\"key\":\"0\",\"value\":false}]","[{\"key\":\"0\",\"value\":true,\"x\":1}]"})Check(hub.Submit(Body(changes)).Code=="invalid","malformed changes reject");
  foreach(var extra in new[]{",\"from\":-1",",\"path\":\"config.json\"",",\"amount\":1",",\"configToken\":\"bad\""})Check(hub.Submit(Body(extra:extra)).Code=="invalid","mixed/duplicate fields reject");
  var body=Body();Check(hub.Submit(body).State=="queued"&&hub.TryTake(out var c)&&c!.ConfigChanges!.Length==1,"save queues only immutable typed changes");
  var command=JsonSerializer.Deserialize<Command>(body,BridgeServer.Json)!;hub.Complete(new(command.Id,"applied","ok"));Check(hub.Submit(body).State=="applied"&&!hub.TryTake(out _),"receipt retry never saves twice");
  Console.WriteLine($"{checks} mod config contract checks passed");
 }
}
