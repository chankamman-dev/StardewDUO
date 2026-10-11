using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Locations;
using StardewValley.Menus;
using StardewValley.Objects;

namespace StardewThor.ReadOnly;

// The menu the player has open on the top screen, for the App's context page: an ordinary
// storage chest (take / put whole stacks) or a shop (read only). Game-thread reads only; the
// shop's own price/stock table is read as built by the game, never rebuilt here.
internal static class SceneControl {
    // Plain chests and big chests only; shipping bins, Junimo/auto-grabber style chests and
    // non-chest grab menus (fishing treasure, rewards) are excluded.
    public static Chest? OpenChest(){
        if(Game1.activeClickableMenu is ItemGrabMenu g&&g.source==ItemGrabMenu.source_chest&&g.context is Chest c
            &&c.SpecialChestType is Chest.SpecialChestTypes.None or Chest.SpecialChestTypes.BigChest)return c;
        return null;
    }
    public static string Gate(){
        if(!Context.IsWorldReady)return "no-world";
        if(Context.IsMultiplayer)return "multiplayer";
        if(Game1.eventUp)return "game-busy";
        if(OpenChest() is null)return "chest-closed";
        // Something picked up with the cursor belongs to the top-screen menu.
        if(Game1.activeClickableMenu is ItemGrabMenu g&&g.heldItem!=null)return "cursor-item";
        return "ready";
    }
    // Which context the player is in, cheaply and without reading items, published in every
    // snapshot so the App can follow it (per-context setting) even when the context page is closed.
    public static string? ActiveContext(){
        if(NightScene.Visible)return "night";
        if(OpenChest()!=null)return "chest";
        if(Game1.activeClickableMenu is ShopMenu)return "shop";
        if(SceneOutdoors.Fishing(out _))return "fishing";
        if(Game1.activeClickableMenu is DialogueBox&&Game1.currentSpeaker is NPC)return "dialogue";
        if(Game1.currentLocation is MineShaft or VolcanoDungeon)return "mine";
        return null;
    }
    public static SceneState? Collect(InventoryControl inventory,Func<Item,string?> icon){
        var chest=OpenChest();
        if(chest!=null){
            var items=chest.GetItemsForPlayer();int capacity=Math.Clamp(chest.GetActualCapacity(),0,144);
            var slots=new SceneItem?[Math.Clamp(Math.Max(capacity,items.Count),0,144)];
            for(int i=0;i<slots.Length&&i<items.Count;i++){var item=items[i];if(item==null)continue;
                slots[i]=new(i,Limit(item.QualifiedItemId,160),Limit(item.DisplayName,160),item.Stack,item.Quality,icon(item),inventory.Key(item),Math.Max(0,item.salePrice()));}
            return new("chest",inventory.Key(chest),Limit(chest.DisplayName,160),capacity,slots,items.Count>144);
        }
        if(Game1.activeClickableMenu is ShopMenu shop){
            var cc=Game1.locations.OfType<CommunityCenter>().FirstOrDefault();
            bool bundles=cc!=null&&!Game1.MasterPlayer.mailReceived.Contains("JojaMember")&&!cc.areAllAreasComplete();
            var list=new List<SceneItem?>();
            foreach(var salable in shop.forSale){
                if(list.Count>=120)break;
                if(salable is not Item item||!shop.itemPriceAndStock.TryGetValue(salable,out var info))continue;
                bool bundle=false;if(bundles&&item is StardewValley.Object o)try{bundle=cc!.couldThisIngredienteBeUsedInABundle(o);}catch{bundles=false;}
                list.Add(new(list.Count,Limit(item.QualifiedItemId,160),Limit(item.DisplayName,160),Math.Max(1,item.Stack),item.Quality,icon(item),inventory.Key(item),
                    Math.Max(0,info.Price),info.Stock==int.MaxValue?-1:Math.Clamp(info.Stock,0,99999),string.IsNullOrEmpty(info.TradeItem)?null:Limit(ItemRegistry.QualifyItemId(info.TradeItem)??info.TradeItem,160),Math.Max(0,info.TradeItemCount??0),bundle));
            }
            return new("shop",Limit(shop.ShopId??"",80),Limit(shop.ShopId??"",80),0,list.ToArray(),shop.forSale.Count>list.Count,shop.currency);
        }
        // Rod in use (casting, waiting, reeling, minigame), then the mines / volcano floor.
        if(SceneOutdoors.Fishing(out var rod))return SceneOutdoors.FishingScene(rod!,icon);
        return SceneOutdoors.MineScene();
    }
    public static void Execute(Command c,InventoryControl inventory){
        var chest=OpenChest()??throw new CommandRejected("chest-closed");
        if(inventory.Key(chest)!=c.TargetKey)throw new CommandRejected("chest-changed");
        var menu=(ItemGrabMenu)Game1.activeClickableMenu;var f=Game1.player;var items=chest.GetItemsForPlayer();
        if(c.Action=="chest-take"){
            var item=c.From<items.Count?items[c.From]:null;
            if(item==null||inventory.Key(item)!=c.SourceKey)throw new CommandRejected("source-changed");
            if(c.Amount!=item.Stack)throw new CommandRejected("amount");
            if(!f.couldInventoryAcceptThisItem(item))throw new CommandRejected("inventory-full");
            // The game's own stacking into the backpack; whatever does not fit stays in the chest.
            var rest=f.addItemToInventory(item);
            if(rest==null||rest.Stack<=0)items[c.From]=null;else items[c.From]=rest;
            chest.clearNulls();return;
        }
        if(c.Action=="chest-put"){
            int cap=Math.Min(f.MaxItems,f.Items.Count);var item=c.From<cap?f.Items[c.From]:null;
            if(item==null||inventory.Key(item)!=c.SourceKey)throw new CommandRejected("source-changed");
            if(c.Amount!=item.Stack)throw new CommandRejected("amount");
            // The open chest menu decides what may go in (fridges take food only, etc.).
            if(menu.inventory?.highlightMethod!=null&&!menu.inventory.highlightMethod(item))throw new CommandRejected("not-allowed");
            bool held=c.From==f.CurrentToolIndex;if(held)item.actionWhenStopBeingHeld(f);
            // Chest.addItem stacks onto matching items, then fills a free slot; returns what did not fit.
            var rest=chest.addItem(item);
            if(rest==null||rest.Stack<=0)f.Items[c.From]=null;else f.Items[c.From]=rest;
            if(held)f.CurrentItem?.actionWhenBeingHeld(f);
            if(rest!=null&&rest.Stack>0&&rest.Stack==c.Amount)throw new CommandRejected("chest-full");
            return;
        }
        throw new CommandRejected("unsupported");
    }
    private static string Limit(string? s,int n)=>s is null?"":s.Length>n?s[..n]:s;
}
