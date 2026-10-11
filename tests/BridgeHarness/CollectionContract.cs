using System.Net;
using System.Text.Json;
using StardewThor.Bridge;
internal static class CollectionContract {
 internal static async Task Run(){
  int checks=0;void Check(bool value,string label){if(!value)throw new Exception(label);checks++;}
  using var server=new BridgeServer(0);server.Start();using var client=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
  using(var missing=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/collections")))Check(missing.RootElement.GetProperty("state").GetString()=="unsupported"&&missing.RootElement.GetProperty("sets").GetArrayLength()==0,"missing collector explicit");
  var initial=new CollectionReport("building",0,"en",Array.Empty<CollectionSet>(),Array.Empty<string>());var doc=new DemandDocument(initial,CollectionLimits.Bytes);server.Collections=doc;
  Check(!doc.Wanted,"collection idle lease");Check((await client.GetStringAsync(root+"/v1/collections")).Contains("building")&&doc.Wanted,"GET requests bounded cache generation");
  var entry=new CollectionEntry("(O)96","Dwarf Scroll",true,true);var set=new CollectionSet("museum","ready",1,95,new[]{entry},Donated:1);
  doc.Publish(new CollectionReport("ready",3,"en",new[]{set,new CollectionSet("birds","absent",null,null,Array.Empty<CollectionEntry>(),"Ivy.OrnithologistsGuild")},Array.Empty<string>()));
  using(var ready=JsonDocument.Parse(await client.GetStringAsync(root+"/v1/collections"))){Check(ready.RootElement.GetProperty("sets")[0].GetProperty("entries")[0].GetProperty("donated").GetBoolean(),"museum donation independent from personal found");Check(ready.RootElement.GetProperty("sets")[1].GetProperty("total").ValueKind==JsonValueKind.Null,"absent collection does not fabricate total");}
  doc.Publish(new CollectionReport("ready",4,"en",new[]{set with{Entries=new[]{entry with{Name=new string('中',CollectionLimits.Bytes)}}}},Array.Empty<string>()));Check((await client.GetStringAsync(root+"/v1/collections")).Contains("response-bytes"),"oversized serialized response rejected");
  Check((await client.PostAsync(root+"/v1/collections",new StringContent("{}"))).StatusCode==HttpStatusCode.MethodNotAllowed,"collection rejects writes");
  Check((await client.GetAsync(root+"/v1/collections?page=1")).StatusCode==HttpStatusCode.NotFound,"unrecognized query is not forwarded");
  var vanilla=new[]{0,1,2,3,4}.Select(i=>new SkillEntry(i,0,0,0,0,100,Array.Empty<ProfessionEntry>())).ToArray();
  var character=new CharacterState(vanilla,0,0);Check(!JsonSerializer.Serialize(character,BridgeServer.Json).Contains("customSkills"),"absent customSkills omitted, vanilla unchanged");
  character=character with{CustomSkills=new[]{new CustomSkillEntry("example.Skill","Skill",4,5,2310,null,Array.Empty<string>())}};using(var json=JsonDocument.Parse(JsonSerializer.Serialize(character,BridgeServer.Json)))Check(json.RootElement.GetProperty("customSkills")[0].GetProperty("totalLevel").GetInt32()==5,"separate effective custom skill field");
  string live=server.AddAsset(new byte[]{1,2,3});var hashes=new List<string>();for(byte i=0;i<8;i++)hashes.Add(server.AddSkillAsset(new[]{i}));
  Check(hashes.Count==hashes.Distinct().Count(),"eight independent skill assets");try{server.AddSkillAsset(new byte[]{99});throw new Exception("unbounded skills assets");}catch(InvalidOperationException){Check(true,"skill asset count budget");}
  Check((await client.GetByteArrayAsync(root+hashes[0].Replace("/bridge/","/v1/")))[0]==0,"skill icons use original hash transport");server.ClearSkillAssets();Check((await client.GetByteArrayAsync(root+live.Replace("/bridge/","/v1/"))).Length==3,"skill invalidation preserves live assets");
  Console.WriteLine($"{checks} collection and custom skill contract checks passed");
 }
}
