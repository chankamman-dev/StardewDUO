using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.TerrainFeatures;
using StardewValley.Objects;

namespace StardewThor.ReadOnly;

// Game-thread reads only. No interactions, gift reveals, harvests or machine updates.
internal sealed class TargetCollector {
    internal PortraitReader? Portraits {get;set;}
    private readonly Dictionary<string,string?> images=new();
    private readonly BoundedCache<string,KnownGift[]> giftCache=new(16);
    public void Reset(){images.Clear();giftCache.Clear();}
    public (TargetCard? Card,string State) Collect(){
        if(!Context.IsWorldReady)return (null,"unavailable");
        // While talking, keep showing whoever is speaking (the dialogue box is a menu too).
        // Other menus and cutscenes stay "busy"; the App keeps the card it showed before.
        bool dialogue=Game1.activeClickableMenu is StardewValley.Menus.DialogueBox;
        // A festival runs as an event, but the player walks around and talks freely: not busy.
        // Its villagers are the event's actors (copies placed on the temporary festival map).
        var festival=Game1.eventUp&&Game1.CurrentEvent is {isFestival:true} fest?fest:null;
        if((Game1.eventUp&&festival==null)||(Game1.activeClickableMenu!=null&&!dialogue)||(Game1.dialogueUp&&!dialogue))return (null,"busy");
        var location=Game1.currentLocation;
        if(dialogue&&Game1.currentSpeaker is NPC speaker&&speaker.CanSocialize&&(festival!=null||speaker.currentLocation==location))return (Npc(speaker,location,speaker.Tile),"ready");var tile=Game1.player.Tile+(Game1.player.FacingDirection switch {
            0=>new Vector2(0,-1),1=>new Vector2(1,0),2=>new Vector2(0,1),_=>new Vector2(-1,0)
        });
        var area=new Rectangle((int)tile.X*64,(int)tile.Y*64,64,64);
        // Stable nearest centre wins if bounding boxes overlap the facing cell.
        // Bounded to current location only; never enumerate all locations or object data.
        NPC? npc=null;float nearest=float.MaxValue;int examined=0;
        foreach(var candidate in festival!=null?location.characters.Concat(festival.actors):location.characters){
            if(examined++>=256)break;if(!candidate.CanSocialize||!candidate.GetBoundingBox().Intersects(area))continue;
            float distance=Vector2.DistanceSquared(candidate.Tile,tile);
            if(distance<nearest||(distance==nearest&&string.CompareOrdinal(candidate.Name,npc?.Name)<0)){npc=candidate;nearest=distance;}
        }
        if(npc!=null)return (Npc(npc,location,tile),"ready");
        FarmAnimal? animal=null;nearest=float.MaxValue;examined=0;
        foreach(var candidate in location.animals.Values){
            if(examined++>=256)break;if(!candidate.GetBoundingBox().Intersects(area))continue;
            float distance=Vector2.DistanceSquared(candidate.Tile,tile);
            if(distance<nearest||(distance==nearest&&(animal==null||candidate.myID.Value<animal.myID.Value))){animal=candidate;nearest=distance;}
        }
        if(animal!=null)return (Animal(animal,location,tile),"ready");
        if(location.Objects.TryGetValue(tile,out var obj)){
            if(obj is IndoorPot pot&&pot.hoeDirt.Value?.crop is Crop crop)return (Plant(crop,pot.hoeDirt.Value,location,tile),"ready");
            if(obj.GetMachineData()!=null)return (Machine(obj,location,tile),"ready");
            return (Card("object",obj.QualifiedItemId,obj.DisplayName,ItemImage(obj.QualifiedItemId),location,tile,
                new[]{new TargetField("description",Limit(obj.getDescription(),1000))}) with {ItemId=obj.QualifiedItemId},"ready");
        }
        if(location.terrainFeatures.TryGetValue(tile,out var terrain)&&terrain is HoeDirt dirt&&dirt.crop!=null)
            return (Plant(dirt.crop,dirt,location,tile),"ready");
        return (null,"empty");
    }
    private TargetCard Npc(NPC npc,GameLocation location,Vector2 tile){
        SocialEntry? social=null;
        if(Game1.player.friendshipData.TryGetValue(npc.Name,out var f))social=new(Limit(npc.Name,160),f.Points,
            Math.Clamp(f.Points/250,0,20),Math.Clamp(Utility.GetMaximumHeartsForCharacter(npc),1,20),f.GiftsThisWeek,f.GiftsToday,f.TalkedToToday,f.Status.ToString());
        KnownGift[] gifts=Array.Empty<KnownGift>();bool limited=false;
        if(Game1.player.giftedItems.TryGetValue(npc.Name,out var revealed)){
            limited=revealed.Count>64;
            var ids=revealed.Keys.Take(64).ToArray();
            var cacheKey=npc.Name+"/"+LocalizedContentManager.CurrentLanguageCode+"/"+string.Join('|',ids.Select(id=>id+":"+Game1.player.hasGiftTasteBeenRevealed(npc,id)));
            if(giftCache.TryGetValue(cacheKey,out var cached))gifts=cached;
            else {var collected=new List<KnownGift>();foreach(var id in ids){
                if(!Game1.player.hasGiftTasteBeenRevealed(npc,id))continue;
                var item=ItemRegistry.Create(id);collected.Add(new(Limit(item.QualifiedItemId,160),Limit(item.DisplayName,240),npc.getGiftTasteForThisItem(item)));
            }gifts=collected.OrderBy(g=>g.Taste).ThenBy(g=>g.Id,StringComparer.Ordinal).ToArray();giftCache[cacheKey]=gifts;}
        }
        string? icon=Portraits?.Read(npc.Name,npc);
        return Card("npc",npc.Name,npc.displayName,icon,location,tile,Array.Empty<TargetField>()) with {Social=social,Gifts=gifts,GiftsLimited=limited};
    }
    private TargetCard Plant(Crop crop,HoeDirt dirt,GameLocation location,Vector2 tile){
        var data=crop.GetData();var id=ItemRegistry.QualifyItemId(crop.indexOfHarvest.Value)??"(O)0";
        var item=ItemRegistry.GetDataOrErrorItem(id);var fields=new List<TargetField>();
        bool ready=crop.currentPhase.Value>=crop.phaseDays.Count-1&&(!crop.fullyGrown.Value||crop.dayOfCurrentPhase.Value<=0);
        string state=crop.dead.Value?"dead":!crop.IsInSeason(location)?"outOfSeason":ready?"harvest":"growing";
        fields.Add(new("cropState",state));
        if(!crop.dead.Value&&crop.IsInSeason(location)&&!crop.forageCrop.Value&&crop.phaseDays.Count>0){
            int days=crop.fullyGrown.Value?Math.Max(0,crop.dayOfCurrentPhase.Value):
                Math.Max(0,crop.phaseDays.Take(crop.phaseDays.Count-1).Skip(Math.Max(0,crop.currentPhase.Value)).Sum()-crop.dayOfCurrentPhase.Value);
            fields.Add(new("growthDays",Math.Clamp(days,0,9999).ToString()));
            // Total days to grow as planted (speed boosts are already applied to phaseDays).
            if(!crop.fullyGrown.Value)fields.Add(new("growthTotal",Math.Clamp(crop.phaseDays.Take(crop.phaseDays.Count-1).Sum(),0,9999).ToString()));
            if(days>0){
                fields.Add(new("water",data?.NeedsWatering==false?"notNeeded":dirt.state.Value==1?"watered":"dry"));
                // A duration in growing days, not an unconditional harvest date.
                if(location.IsOutdoors&&!location.SeedsIgnoreSeasonsHere()&&data?.Seasons!=null&&days>28-Game1.dayOfMonth&&!data.Seasons.Contains((Season)(((int)location.GetSeason()+1)%4)))fields.Add(new("seasonRisk","seasonEnds"));
            }
            if(data?.RegrowDays>0)fields.Add(new("regrowDays",data.RegrowDays.ToString()));
        }
        if(!string.IsNullOrEmpty(dirt.fertilizer.Value)){var f=ItemRegistry.GetDataOrErrorItem(dirt.fertilizer.Value);fields.Add(new("fertilizer",Limit(f.DisplayName,160)));fields.Add(new("fertilizerId",Limit(f.QualifiedItemId,160)));}
        // Base-quality price from object data; never creates an item.
        if(id.StartsWith("(O)")&&Game1.objectData.TryGetValue(id[3..],out var od)&&od.Price>0)fields.Add(new("price",od.Price.ToString()));
        return Card("crop",id,item.DisplayName,ItemImage(id),location,tile,fields.ToArray()) with {ItemId=id};
    }
    private TargetCard Machine(StardewValley.Object obj,GameLocation location,Vector2 tile){
        var fields=new List<TargetField>{new("machineState",obj.readyForHarvest.Value?"harvest":obj.MinutesUntilReady>0?"working":"idle")};
        if(obj.MinutesUntilReady>0)fields.Add(new("minutes",obj.MinutesUntilReady.ToString()));
        if(obj.heldObject.Value is { } output)fields.Add(new("output",Limit(output.DisplayName,240)+" × "+output.Stack));
        return Card("machine",obj.QualifiedItemId,obj.DisplayName,ItemImage(obj.QualifiedItemId),location,tile,fields.ToArray()) with {ItemId=obj.QualifiedItemId,OutputId=obj.heldObject.Value?.QualifiedItemId,OutputStack=obj.heldObject.Value?.Stack};
    }
    private TargetCard Animal(FarmAnimal a,GameLocation location,Vector2 tile){
        var data=a.GetAnimalData();var fields=new List<TargetField>{new("friendship",$"{a.friendshipTowardFarmer.Value} / 1000"),new("pet",a.wasPet.Value?"done":"notYet"),
            new("fullness",$"{a.fullness.Value} / 255"),new("happiness",$"{a.happiness.Value} / 255"),new("age",a.age.Value.ToString())};
        if(data!=null&&a.age.Value<data.DaysToMature)fields.Add(new("adultDays",(data.DaysToMature-a.age.Value).ToString()));
        if(!string.IsNullOrEmpty(a.currentProduce.Value))fields.Add(new("produce",ItemRegistry.GetDataOrErrorItem(a.currentProduce.Value).DisplayName));
        // Static first sprite frame; not a moving, arbitrarily cropped screenshot.
        var icon=Image(a.Sprite.Texture,new Rectangle(0,0,a.Sprite.SpriteWidth,a.Sprite.SpriteHeight));
        return Card("animal",a.myID.Value.ToString(),a.displayName,icon,location,tile,fields.ToArray()) with {OutputId=string.IsNullOrEmpty(a.currentProduce.Value)?null:ItemRegistry.QualifyItemId(a.currentProduce.Value),OutputStack=string.IsNullOrEmpty(a.currentProduce.Value)?null:1};
    }
    private static TargetCard Card(string kind,string id,string name,string? icon,GameLocation location,Vector2 tile,TargetField[] fields)
        =>new(Limit(kind is "npc" or "animal"?$"{location.NameOrUniqueName}/{kind}/{id}":$"{location.NameOrUniqueName}/{kind}/{tile.X},{tile.Y}/{id}",240),kind,Limit(name,240),icon,Limit(location.DisplayName,240),(int)tile.X,(int)tile.Y,fields,Array.Empty<KnownGift>());
    private string? ItemImage(string id){var data=ItemRegistry.GetDataOrErrorItem(id);return Image(data.GetTexture(),data.GetSourceRect());}
    private string? Image(Texture2D texture,Rectangle rect){
        var key=$"{texture.GetHashCode()}/{rect}";if(images.TryGetValue(key,out var cached))return cached;if(!SheetPixels.Quiet){SheetPixels.Deferred++;return null;}
        if(rect.Width<1||rect.Height<1||rect.Width>64||rect.Height>64)return null;
        if(images.Count>=64)images.Remove(images.Keys.First());
        try{var pixels=SheetPixels.Read(texture,rect,live:true);
            var encoded="data:image/png;base64,"+Convert.ToBase64String(Png.Encode(rect.Width,rect.Height,pixels));return images[key]=encoded.Length<=32768?encoded:null;}
        catch(TextureDeferred){return null;}
        catch{return images[key]=null;}
    }
    private static string Limit(string? s,int max)=>s==null?"":s.Length>max?s[..max]:s;
}
