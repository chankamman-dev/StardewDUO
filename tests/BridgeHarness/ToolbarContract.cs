using System.Text.Json;
using StardewThor.Bridge;
internal static class ToolbarContract
{
    public static void Run()
    {
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        var hub=new ControlHub(new string('t',64));string Body(Command c)=>JsonSerializer.Serialize(c,BridgeServer.Json);
        var c=new Command(Guid.NewGuid().ToString("N"),1,"title-session",0,"set-toolbar",ToolbarHidden:true);
        Check(hub.Submit(Body(c)).State=="queued"&&hub.TryTake(out var taken)&&taken==c,"toolbar command queues without inventory arguments");
        hub.Complete(new(c.Id,"applied","ok",0));
        Check(hub.Submit(Body(c)).State=="applied"&&!hub.TryTake(out _),"repeated toolbar setting only returns receipt");
        Check(hub.Submit(Body(c with{ToolbarHidden=false})).Code=="id-conflict","same ID cannot change toolbar intent");
        Command Next()=>c with{Id=Guid.NewGuid().ToString("N"),Order=2};
        Check(hub.Submit(Body(Next() with{ToolbarHidden=null})).Code=="invalid","toolbar requires explicit boolean");
        Check(hub.Submit(Body(Next() with{Action="sort"})).Code=="invalid","inventory command cannot smuggle toolbar option");
        Check(hub.Submit(Body(Next() with{From=0})).Code=="invalid"&&hub.Submit(Body(Next() with{Amount=1})).Code=="invalid","toolbar cannot mix inventory fields");
        Check(hub.Submit(Body(Next() with{RecipeId="Torch"})).Code=="invalid"&&hub.Submit(Body(Next() with{BoardKey=new string('a',64)})).Code=="invalid","toolbar cannot mix craft or quest fields");
        Check(!hub.TryTake(out _)&&!new ControlState(false,"no-world",-1).Toolbar,"invalid requests do not enqueue and legacy disables option");
        Check(hub.Submit(Body(Next() with{ToolbarHidden=false})).State=="queued","explicit restore remains available after invalid requests");
        Console.WriteLine($"{n} toolbar contract tests passed");
    }
}
