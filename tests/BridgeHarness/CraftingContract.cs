using System.Text.Json;
using StardewThor.Bridge;

internal static class CraftingContract
{
    public static void Run()
    {
        int checks=0;
        void Check(bool ok,string label){if(!ok)throw new Exception(label);checks++;}
        var hub=new ControlHub(new string('c',64));
        var craft=new Command(Guid.NewGuid().ToString("N"),1,"craft-session",5,"craft",Amount:3,RecipeId:"Torch");
        string Body(Command c)=>JsonSerializer.Serialize(c,BridgeServer.Json);
        Check(hub.Submit(Body(craft)).State=="queued"&&hub.TryTake(out var taken)&&taken==craft,"craft reaches only the game-thread consumer");
        hub.Complete(new(craft.Id,"applied","ok",6));
        Check(hub.Submit(Body(craft)).State=="applied"&&!hub.TryTake(out _),"craft receipt retry cannot duplicate production");
        Check(hub.Submit(Body(craft with{Amount=4})).Code=="id-conflict","craft ID cannot be reused with another batch size");
        Command Next()=>craft with{Id=Guid.NewGuid().ToString("N"),Order=2};
        Check(hub.Submit(Body(Next() with{Amount=0})).Code=="amount"&&hub.Submit(Body(Next() with{Amount=100})).Code=="amount","craft amount is bounded before enqueue");
        Check(hub.Submit(Body(Next() with{RecipeId=null})).Code=="recipe-unknown"&&hub.Submit(Body(Next() with{RecipeId=" "})).Code=="recipe-unknown","missing recipe cannot enter the game queue");
        Check(hub.Submit(Body(Next() with{RecipeId=new string('x',161)})).Code=="invalid","recipe keys have a wire-size bound");
        Check(hub.Submit(Body(Next() with{Action="sort"})).Code=="invalid","inventory command cannot smuggle a recipe");
        Check(hub.Submit(Body(Next() with{From=0})).Code=="invalid"&&hub.Submit(Body(Next() with{SourceKey="item"})).Code=="invalid","craft does not accept mixed slot identities");
        Check(!hub.TryTake(out _),"rejected craft payloads have no queued work");
        Check(hub.Submit(Body(Next() with{Amount=99})).State=="queued","bounded maximum batch remains available after invalid requests");
        var legacy=new ControlState(true,"ready",0);
        Check(!legacy.Crafting,"older controls default to no crafting permission");
        var recipe=new JournalRecipe("Torch","crafting","火把","(O)93",1,Array.Empty<RecipeIngredient>(),4,3,"ready");
        using var json=JsonDocument.Parse(JsonSerializer.Serialize(recipe,BridgeServer.Json));
        Check(json.RootElement.GetProperty("maxCrafts").GetInt32()==3&&json.RootElement.GetProperty("craftable").GetInt32()==4,"inventory-limited maximum remains distinct from material count");
        Console.WriteLine($"{checks} crafting contract tests passed");
    }
}
