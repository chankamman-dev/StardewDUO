using System.Text.Json;
using StardewThor.Bridge;

internal static class QuestBoardContract
{
    public static void Run()
    {
        int checks=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);checks++;}
        var hub=new ControlHub(new string('b',64));string Body(Command c)=>JsonSerializer.Serialize(c,BridgeServer.Json);
        var accept=new Command(Guid.NewGuid().ToString("N"),1,"board-session",5,"accept-quest",BoardKey:new string('a',64));
        Check(hub.Submit(Body(accept)).State=="queued"&&hub.TryTake(out var queued)&&queued==accept,"board accept reaches game-thread consumer");
        hub.Complete(new(accept.Id,"applied","ok",5));
        Check(hub.Submit(Body(accept)).State=="applied"&&!hub.TryTake(out _),"same request cannot accept twice");
        Check(hub.Submit(Body(accept with{BoardKey=new string('b',64)})).Code=="id-conflict","request cannot change daily offer");
        Command Next()=>accept with{Id=Guid.NewGuid().ToString("N"),Order=2};
        Check(hub.Submit(Body(Next() with{BoardKey=null})).Code=="board-changed"&&hub.Submit(Body(Next() with{BoardKey="short"})).Code=="board-changed","missing or malformed offer key rejected");
        Check(hub.Submit(Body(Next() with{BoardKey=new string('z',64)})).Code=="board-changed","nonhex offer key rejected");
        Check(hub.Submit(Body(Next() with{BoardKey=new string('a',65)})).Code=="invalid","key size bounded");
        Check(hub.Submit(Body(Next() with{RecipeId="Torch"})).Code=="invalid"&&hub.Submit(Body(Next() with{Amount=1})).Code=="invalid","accept cannot mix crafting parameters");
        Check(hub.Submit(Body(Next() with{From=0})).Code=="invalid"&&hub.Submit(Body(Next() with{SourceKey="item"})).Code=="invalid","accept cannot mix inventory identities");
        Check(hub.Submit(Body(Next() with{Action="sort"})).Code=="invalid"&&!hub.TryTake(out _),"other commands cannot smuggle board identity");
        Check(!new ControlState(true,"ready",0).QuestBoard,"legacy bridge defaults to board unavailable");
        var board=new QuestBoardState("available",new string('a',64),"Help Wanted","Bring quartz","Deliver quartz","Robin",150,"",2,true,"ready");
        using var json=JsonDocument.Parse(JsonSerializer.Serialize(board,BridgeServer.Json));
        Check(json.RootElement.GetProperty("canAccept").GetBoolean()&&json.RootElement.GetProperty("moneyReward").GetInt32()==150,"bounded board projection keeps acceptance separate from reward");
        var world=new World(500,1,1,"spring",600,"Farm","t",93,100,-3.5,270,"sun");
        using var hud=JsonDocument.Parse(JsonSerializer.Serialize(world,BridgeServer.Json));
        Check(hud.RootElement.GetProperty("stamina").GetDouble()==-3.5&&hud.RootElement.GetProperty("maxHealth").GetInt32()==100,"native negative exhaustion and vitals survive wire serialization");
        Console.WriteLine($"{checks} quest board contract tests passed");
    }
}
