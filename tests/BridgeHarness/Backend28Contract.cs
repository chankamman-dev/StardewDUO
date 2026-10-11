using System.Diagnostics;
using System.Text.Json;
using StardewThor.Bridge;
internal static class Backend28Contract {
    internal static async Task Run(){
        int n=0;void Check(bool ok,string name){if(!ok)throw new Exception(name);n++;}
        using var server=new BridgeServer(0);server.Start();using var http=new HttpClient();string root=$"http://127.0.0.1:{server.Port}";
        server.Publish(new Snapshot("busy-test",1,0,"ready","en",null,0,"synthetic"));
        // The publisher is deliberately stopped, as if the game thread were blocked.
        server.Saving=true;await Task.Delay(50);var watch=Stopwatch.StartNew();
        foreach(string route in new[]{"/v1/state","/v1/snapshot"})using(var response=JsonDocument.Parse(await http.GetStringAsync(root+route))){
            Check(response.RootElement.GetProperty("busy").GetString()=="saving","busy outer envelope on "+route);
            Check(response.RootElement.GetProperty("snapshot").GetProperty("seq").GetInt32()==1&&response.RootElement.GetProperty("gameAgeMs").GetInt64()>=50,"no game-thread publish required");
        }
        Check(watch.Elapsed.TotalSeconds<2,"network independent of stalled game thread");
        server.Saving=false;using(var response=JsonDocument.Parse(await http.GetStringAsync(root+"/v1/state")))Check(!response.RootElement.TryGetProperty("busy",out _),"clear saving removes envelope marker");
        var at=new EventCheckedAt(15,"spring",1,1330,"Town");var cases=new[]{"ready","blocked","seen","gate","unknown"};
        server.Events=new EventDirectory();var c=new EventConditions("f Abigail 1000/t 1800 2200",1800,2200,0,Array.Empty<string>(),Array.Empty<string>(),Array.Empty<EventHeart>(),Array.Empty<EventWhen[]>());
        var rows=cases.Select((state,i)=>new EventEntry(i.ToString(),"event","Town",null,null,state=="seen",false,c,Trigger:new(state,at,state=="blocked"?new[]{new EventConditionResult(0,"Friendship")}:Array.Empty<EventConditionResult>(),new[]{new EventConditionResult(1,"Random")},state=="unknown"?new[]{new EventConditionResult(0,"mod-condition")}:Array.Empty<EventConditionResult>(),state=="gate"?"event-active":null,Array.Empty<string>()))).ToArray();
        server.Events.Publish(new("ready",2,"en",rows.Length,rows,Array.Empty<string>()));
        using(var response=JsonDocument.Parse(await http.GetStringAsync(root+"/v1/events"))){Check(response.RootElement.GetProperty("entries").GetArrayLength()==5,"all trigger states traverse paged HTTP");Check(response.RootElement.GetProperty("verdicts")[1].GetProperty("trigger").GetProperty("failed")[0].GetProperty("index").GetInt32()==0,"zero-based condition positions");Check(response.RootElement.GetProperty("verdicts").GetArrayLength()==5&&response.RootElement.GetProperty("entries")[1].GetProperty("trigger").ValueKind==JsonValueKind.Null,"verdicts travel on page 0 apart from the rows");Check(response.RootElement.GetProperty("verdicts").EnumerateArray().All(v=>!v.GetProperty("trigger").TryGetProperty("checkedAt",out _)&&(!v.GetProperty("trigger").TryGetProperty("chance",out var c)||c.GetArrayLength()>0)),"page 0 verdicts are brief: no judgement time, no empty lists");}
        // A save-sized list (1300 events, two failed conditions each) keeps its verdicts on page 0.
        {var many=Enumerable.Range(0,1300).Select(i=>rows[1] with{Id="bulk/"+i}).ToArray();server.Events.Publish(new("ready",4,"en",1300,many,Array.Empty<string>()));using var big=JsonDocument.Parse(await http.GetStringAsync(root+"/v1/events"));Check(big.RootElement.GetProperty("state").GetString()=="ready"&&big.RootElement.TryGetProperty("verdicts",out var vs)&&vs.GetArrayLength()==1300&&big.RootElement.GetProperty("entries")[0].GetProperty("trigger").ValueKind==JsonValueKind.Null,"1300 verdicts fit page 0");}
        server.Events.Publish(new("ready",3,"en",1,new[]{rows[0] with{Trigger=null}},Array.Empty<string>()));
        using(var response=JsonDocument.Parse(await http.GetStringAsync(root+"/v1/events")))Check(response.RootElement.GetProperty("entries")[0].GetProperty("trigger").ValueKind==JsonValueKind.Null,"old provider has optional null trigger");
        var full=Enumerable.Range(0,16).Select(i=>new EventConditionResult(i,new string('x',80))).ToArray();
        var huge=new EventConditions(new string('r',512),null,null,144,Enumerable.Repeat(new string('i',160),8).ToArray(),Enumerable.Repeat(new string('n',160),8).ToArray(),Enumerable.Repeat(new EventHeart(new string('n',160),1000,new string('k',80)),8).ToArray(),Array.Empty<EventWhen[]>());
        var bulky=Enumerable.Range(0,50).Select(i=>rows[0] with{Id=i.ToString(),Conditions=huge,Trigger=new("blocked",at,full,full,full,null,Array.Empty<string>())}).ToArray();
        server.Events.Publish(new("ready",4,"en",50,bulky,Array.Empty<string>()));
        string capped=await http.GetStringAsync(root+"/v1/events");using(var response=JsonDocument.Parse(capped)){
            Check(response.RootElement.GetProperty("state").GetString()=="unsupported","oversized combined metadata and triggers fail explicitly");
            Check(response.RootElement.GetProperty("limited")[0].GetString()=="response-bytes","page byte limit identified");
            Check(System.Text.Encoding.UTF8.GetByteCount(capped)<=EventDirectory.PageBudget,"overlimit response stays bounded");
        }
        var monster=new SceneMonster("Green Slime","绿色史莱姆",3,"/bridge/asset/"+new string('a',64),24,"Slimes",new[]{"(O)766","(O)92"},null);
        var mine=new SceneMine("mines",5,5,3,true,false,false,5,10,0,new[]{monster},"infested",Array.Empty<string>());
        var night=new SceneNight("shipping",80,2,"Rain",new[]{new NightSkill("0",120,0,1,false)},new(3,2));
        string json=JsonSerializer.Serialize(new{mine,night},BridgeServer.Json);using(var d=JsonDocument.Parse(json)){
            Check(d.RootElement.GetProperty("mine").GetProperty("monsters").GetInt32()==3,"legacy numeric count preserved");
            Check(d.RootElement.GetProperty("mine").GetProperty("monsterTypes")[0].GetProperty("drops")[0].GetString()=="(O)766","monster metadata and qualified drops");
            Check(d.RootElement.GetProperty("night").GetProperty("money").ValueKind==JsonValueKind.Null,"uncertain settlement money remains absent");
        }
        Console.WriteLine($"{n} backend 20260928 contract checks passed");
    }
}
