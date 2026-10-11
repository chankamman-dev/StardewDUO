using Microsoft.Xna.Framework;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.ItemTypeDefinitions;
using StardewValley.Objects;
using StardewValley.Quests;

namespace StardewThor.ReadOnly;

// The game thread is the only caller. Preview never creates or clones an Item:
// even Object.getOne advances Game1.random. Matching is based on the vanilla
// 1.6 Item.canStackWith/Object.maximumStackSize/ItemDataDefinition rules.
internal static class CraftingControl
{
    private sealed record Output(string Id,string Name,int Category,Type Type,int MaxStack,Color? Color);
    private sealed class SlotState
    {
        public Item? Item;
        public int Count;
        public bool Produced;
    }

    public static (int MaxCrafts,string Reason) Preview(CraftingRecipe recipe)
    {
        try
        {
            var output=Describe(recipe);
            var result=Simulate(recipe,output,99);
            return (result.Maximum,result.Maximum>0?"ready":result.Reason);
        }
        catch(CommandRejected e){return (0,e.Message);}
        catch{return (0,"recipe-unsupported");}
    }

    public static void Execute(Command command)
    {
        if(command.Amount<1||command.Amount>99)throw new CommandRejected("amount");
        if(string.IsNullOrEmpty(command.RecipeId)||!Game1.player.craftingRecipes.ContainsKey(command.RecipeId)
            ||!CraftingRecipe.craftingRecipes.ContainsKey(command.RecipeId))throw new CommandRejected("recipe-unknown");
        var recipe=new CraftingRecipe(command.RecipeId,false);
        var output=Describe(recipe);
        var (maximum,reason)=Simulate(recipe,output,command.Amount);
        if(maximum<command.Amount)throw new CommandRejected(reason);
        // No expected rejection can occur after here. Unexpected third-party
        // callback failures are failed/game-error, never an unapplied rejection.
        // ProcessCommands refreshes the authoritative state even on that path.
        for(int n=0;n<command.Amount;n++)
        {
            Item crafted=recipe.createItem();
            if(crafted.QualifiedItemId!=output.Id||crafted.GetType()!=output.Type||crafted.Stack!=recipe.numberProducedPerCraft
                ||crafted.Quality!=0||crafted.maximumStackSize()!=output.MaxStack)
                throw new InvalidOperationException("Recipe output changed after preflight");
            var farmer=Game1.player;
            Item?[] before=farmer.Items.ToArray();
            int[] stacks=before.Select(i=>i?.Stack??0).ToArray();
            bool[] seen=before.Select(i=>i?.HasBeenInInventory??false).ToArray();
            bool[] spawned=before.Select(i=>i is StardewValley.Object obj&&obj.IsSpawnedObject).ToArray();
            string?[] pickupFlags=before.Select(i=>i?.SetFlagOnPickup).ToArray();
            int priorCount=farmer.craftingRecipes[recipe.name];
            try
            {
                recipe.consumeIngredients(null);
                // Same production callbacks and item-count increment as CraftingPage.
                farmer.NotifyQuests((Quest quest)=>quest.OnRecipeCrafted(recipe,crafted));
                farmer.craftingRecipes[recipe.name]+=recipe.numberProducedPerCraft;
                Game1.stats.checkForCraftingAchievements();
                // Original inventory insertion handles stacking, received-item hooks,
                // ownership and HUD. Do not call the UI acceptance helper, which can
                // emit a red warning during a supposedly read-only preview.
                Item? remainder=farmer.addItemToInventory(crafted);
                if(remainder!=null)throw new InvalidOperationException("Inventory insertion contradicted preflight");
            }
            catch(Exception error)
            {
                // Unlike CraftingPage there is no heldItem owner to retain the
                // crafted output if a quest/achievement/receive callback throws.
                // Recover this craft's original items and counts on EVERY failure,
                // including an exception after partial merging into existing stacks.
                // Earlier successful crafts remain committed. This cannot undo
                // arbitrary quest/achievement or other third-party callback state.
                while(farmer.Items.Count>before.Length)farmer.Items.RemoveAt(farmer.Items.Count-1);
                while(farmer.Items.Count<before.Length)farmer.Items.Add(null);
                for(int i=0;i<before.Length;i++)
                {
                    farmer.Items[i]=before[i];
                    if(before[i] is not Item original)continue;
                    original.Stack=stacks[i];original.HasBeenInInventory=seen[i];original.SetFlagOnPickup=pickupFlags[i];
                    if(original is StardewValley.Object obj)obj.IsSpawnedObject=spawned[i];
                }
                farmer.craftingRecipes[recipe.name]=priorCount;
                throw new InvalidOperationException("Craft callback failed; current craft inventory restored",error);
            }
        }
    }

    private static Output Describe(CraftingRecipe recipe)
    {
        if(recipe.isCookingRecipe||recipe.itemToProduce.Count!=1||recipe.recipeList.Count is <1 or >12
            ||recipe.recipeList.Any(p=>p.Value<=0||p.Value>999999)||recipe.numberProducedPerCraft<1)
            throw new CommandRejected("recipe-unsupported");
        var data=recipe.GetItemData(useFirst:true);
        if(data.IsErrorItem)throw new CommandRejected("recipe-unsupported");
        Type type;int max;Color? color=null;
        if(data.ItemType.GetType()==typeof(BigCraftableDataDefinition))
        {
            if(data.ItemId=="221")throw new CommandRejected("recipe-unsupported");
            type=typeof(StardewValley.Object);max=999;
        }
        else if(data.ItemType.GetType()==typeof(ObjectDataDefinition))
        {
            // These enter wallets/collections, not ordinary inventory slots.
            if(data.ItemId is "73" or "102" or "858" or "930" or "GoldCoin" or "880")throw new CommandRejected("recipe-unsupported");
            var tags=ItemContextTagManager.GetBaseContextTags(data.ItemId);
            if(tags.Contains("torch_item")){type=typeof(Torch);max=999;}
            else if(data.ItemId=="812"){type=typeof(ColoredObject);color=Color.Orange;max=999;}
            else if(tags.Contains("item_type_ring")||data.ItemId=="801"){type=typeof(Ring);max=1;}
            else{type=typeof(StardewValley.Object);max=data.Category==-22||data.ItemId is "79" or "842" or "911"?1:999;}
        }
        else throw new CommandRejected("recipe-unsupported");
        if(recipe.numberProducedPerCraft>max)throw new CommandRejected("recipe-unsupported");
        var result=new Output(data.QualifiedItemId,data.InternalName,data.Category,type,max,color);
        // Outputs must not become their own ingredients within a batch. Such
        // nonstandard data needs a separate recipe adapter instead of looping.
        if(recipe.recipeList.Keys.Any(key=>key==data.Category.ToString()||ItemRegistry.QualifyItemId(key)==data.QualifiedItemId
            ||key=="-777"&&data.QualifiedItemId is "(O)495" or "(O)496" or "(O)497" or "(O)498"))
            throw new CommandRejected("recipe-unsupported");
        return result;
    }

    private static (int Maximum,string Reason) Simulate(CraftingRecipe recipe,Output output,int count)
    {
        var farmer=Game1.player;
        if(farmer.Items.Count>144||farmer.MaxItems<1||farmer.MaxItems>144)throw new CommandRejected("recipe-unsupported");
        var slots=farmer.Items.Select(i=>new SlotState{Item=i,Count=i?.Stack??0}).ToArray();
        int capacity=Math.Min(farmer.MaxItems,slots.Length);
        var ingredients=recipe.recipeList.ToArray();
        // Match each real item once. No getOne/createItem/consumeIngredients.
        var matches=ingredients.Select(p=>slots.Select(s=>CraftingRecipe.ItemMatchesForCrafting(s.Item,p.Key)).ToArray()).ToArray();
        bool[] canMerge=slots.Select(s=>CanMerge(output,s.Item)).ToArray();
        for(int crafted=0;crafted<count;crafted++)
        {
            for(int ingredient=0;ingredient<ingredients.Length;ingredient++)
            {
                int remaining=ingredients[ingredient].Value;
                for(int i=slots.Length-1;i>=0&&remaining>0;i--)
                {
                    var slot=slots[i];
                    if(slot.Produced||slot.Count<=0||!matches[ingredient][i])continue;
                    int used=Math.Min(slot.Count,remaining);slot.Count-=used;remaining-=used;
                }
                if(remaining>0)return (crafted,"materials");
            }
            int quantity=recipe.numberProducedPerCraft;
            for(int i=0;i<slots.Length&&quantity>0;i++)
            {
                var slot=slots[i];
                if(slot.Count<=0||output.MaxStack<=1||!(slot.Produced||canMerge[i]))continue;
                int put=Math.Min(quantity,Math.Max(0,output.MaxStack-slot.Count));slot.Count+=put;quantity-=put;
            }
            if(quantity>0)
            {
                var empty=slots.Take(capacity).FirstOrDefault(s=>s.Count<=0);
                if(empty==null)return (crafted,"inventory-full");
                empty.Count=quantity;empty.Produced=true;
            }
        }
        return (count,"ready");
    }

    private static bool CanMerge(Output output,Item? item)
    {
        if(item==null||output.MaxStack<=1||item.GetType()!=output.Type||item.QualifiedItemId!=output.Id
            ||item.Quality!=0||item.Name!=output.Name||item.IsRecipe||item.maximumStackSize()!=output.MaxStack)return false;
        if(item is StardewValley.Object obj&&obj.orderData.Value!=null)return false;
        if(item is ColoredObject colored&&colored.color.Value!=output.Color)return false;
        return true;
    }
}
