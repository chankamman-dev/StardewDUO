using System.Runtime.CompilerServices;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Menus;

namespace StardewThor.ReadOnly;

internal sealed class InventoryControl {
    private readonly ConditionalWeakTable<Item,Identity> identities=new();
    private sealed class Identity {public readonly string Value=Guid.NewGuid().ToString("N");}
    public string Key(Item item)=>identities.GetOrCreateValue(item).Value;
    public string Gate(){
        if(!Context.IsWorldReady)return "no-world";
        if(Context.IsMultiplayer)return "multiplayer";
        if(Game1.eventUp||Game1.currentLocation?.currentEvent!=null||Game1.dialogueUp||Game1.player.UsingTool||Game1.player.isEating||!Game1.player.CanMove)return "game-busy";
        // Any held cursor item, chest, shop, crafting, or other modal owns its inventory.
        if(Game1.activeClickableMenu!=null)return "close-menu";
        return "ready";
    }
    public void Execute(Command c){
        var f=Game1.player;var items=f.Items;int cap=Math.Min(f.MaxItems,items.Count);
        Item? from=c.From>=0&&c.From<cap?items[c.From]:null;
        Item? to=c.To>=0&&c.To<cap?items[c.To]:null;
        if(c.Action=="select"){
            if(c.From<0||c.From>=cap||(from==null?c.SourceKey!=null:Key(from)!=c.SourceKey))throw new CommandRejected("source-changed");
        }else if(c.Action!="sort"&&(from==null||Key(from)!=c.SourceKey))throw new CommandRejected("source-changed");
        if(c.Action=="move"&&(c.To<0||c.To>=cap||c.To==c.From||(to==null?c.TargetKey!=null:Key(to)!=c.TargetKey)))throw new CommandRejected("target-changed");
        if(c.Action is "trash" or "drop" && !from!.canBeTrashed())throw new CommandRejected("protected-item");
        if(c.Action=="drop"&&!from!.canBeDropped())throw new CommandRejected("protected-item");
        if(c.Action is "move" or "trash" or "drop" && (c.Amount<1||c.Amount>from!.Stack))throw new CommandRejected("amount");
        if(c.Action=="move"&&to!=null&&!from!.canStackWith(to)&&c.Amount!=from.Stack)throw new CommandRejected("split-needs-empty");
        if(c.Action=="move"&&to!=null&&from!.canStackWith(to)&&to.getRemainingStackSpace()<=0)throw new CommandRejected("stack-full");
        var active=f.CurrentItem;
        // Original held-item callbacks, stack rules, sort, reclamation and debris rules.
        switch(c.Action){
            case "select":active?.actionWhenStopBeingHeld(f);f.CurrentToolIndex=c.From;f.CurrentItem?.actionWhenBeingHeld(f);return;
            case "sort":active?.actionWhenStopBeingHeld(f);ItemGrabMenu.organizeItemsInList(items);f.CurrentItem?.actionWhenBeingHeld(f);return;
            case "move":
                if(c.From==f.CurrentToolIndex||c.To==f.CurrentToolIndex)active?.actionWhenStopBeingHeld(f);
                if(to!=null&&from!.canStackWith(to)){
                    int count=Math.Min(c.Amount,to.getRemainingStackSpace());var part=from.getOne();part.Stack=count;int rest=to.addToStack(part);items[c.From]=from.ConsumeStack(count-rest);
                }else if(c.Amount==from!.Stack){items[c.To]=from;items[c.From]=to;}
                else{var split=from.getOne();split.Stack=c.Amount;items[c.To]=split;from.Stack-=c.Amount;}
                if(c.From==f.CurrentToolIndex||c.To==f.CurrentToolIndex)f.CurrentItem?.actionWhenBeingHeld(f);
                return;
            case "trash":case "drop":
                Item removed;if(c.Amount==from!.Stack){removed=Utility.removeItemFromInventory(c.From,items);}else{removed=from.getOne();removed.Stack=c.Amount;from.Stack-=c.Amount;}
                if(c.Action=="trash")Utility.trashItem(removed);
                else Game1.createItemDebris(removed,f.getStandingPosition(),f.FacingDirection).DroppedByPlayerID.Value=f.UniqueMultiplayerID;
                return;
            default:throw new CommandRejected("unsupported");
        }
    }
}
