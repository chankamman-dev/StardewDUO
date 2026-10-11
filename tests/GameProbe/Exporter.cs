using Microsoft.Xna.Framework;
using StardewValley;
using System.Text.Json;
namespace StardewThor.Tests;
internal static class Exporter {
    public static void Audio(string root){
        var output=new Dictionary<string,object>();
        foreach(string name in new[]{"smallSelect","bigSelect","dwop","Ship","trashcan","cancel"}){
            if(!Game1.soundBank.Exists(name))continue;var cue=Game1.soundBank.GetCueDefinition(name);var waves=new List<object>();
            foreach(var sound in cue.sounds){
                var banks=(string[])typeof(Microsoft.Xna.Framework.Audio.SoundBank).GetField("_waveBankNames",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance)!.GetValue(sound.soundBank)!;
                if(!sound.complexSound)waves.Add(new{bank=banks[sound.waveBankIndex],track=sound.trackIndex,volume=sound.volume});
                else foreach(var clip in sound.soundClips)foreach(var e in clip.clipEvents)if(e is Microsoft.Xna.Framework.Audio.PlayWaveEvent wave)foreach(var variant in wave.GetVariants())if(variant.waveBank>=0)waves.Add(new{bank=banks[variant.waveBank],track=variant.track,volume=sound.volume});
            }output[name]=waves;
        }
        File.WriteAllText(Path.Combine(root,"audio-cues.json"),JsonSerializer.Serialize(output));
    }
    public static void Run(string root,bool titleOnly=false){
        if(titleOnly?StardewModdingAPI.Context.IsWorldReady:Game1.player.Name!="t")throw new Exception("Export requires title screen or isolated farmer t");
        Directory.CreateDirectory(root);Directory.CreateDirectory(Path.Combine(root,"items"));
        var original=LocalizedContentManager.CurrentLanguageCode;
        var output=new Dictionary<string,object>{{"version","1.6.15.24356"}};
        var objectIds=Game1.objectData.Keys.Select(id=>"(O)"+id).ToArray();
        // Use the current game's registry, including equipment, furniture and 1.6 trinkets.
        var ids=ItemRegistry.ItemTypes.SelectMany(type=>type.GetAllIds().Select(id=>type.Identifier+id)).Distinct().ToArray();
        var errors=new List<string>();
        try{foreach(var lang in new[]{LocalizedContentManager.LanguageCode.en,LocalizedContentManager.LanguageCode.zh}){
            LocalizedContentManager.CurrentLanguageCode=lang;var items=new List<object>();var people=new List<object>();
            foreach(var id in ids){
              try{
                var item=ItemRegistry.Create(id);var data=ItemRegistry.GetDataOrErrorItem(id);var rect=data.GetSourceRect();
                if(data.IsErrorItem)throw new Exception("Invalid registry item");
                string name=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(id)))[..16].ToLowerInvariant()+".png";
                var file=Path.Combine(root,"items",name);
                if(!File.Exists(file)){var pixels=new Color[rect.Width*rect.Height];data.GetTexture().GetData(0,rect,pixels,0,pixels.Length);File.WriteAllBytes(file,StardewThor.ReadOnly.Png.Encode(rect.Width,rect.Height,pixels));}
                var obj=item as StardewValley.Object;
                var category=item.getCategoryName();if(string.IsNullOrWhiteSpace(category))category=lang==LocalizedContentManager.LanguageCode.zh?"其他":"Other";
                items.Add(new{id,name=item.DisplayName,description=item.getDescription(),category,price=id.StartsWith("(O)")?Game1.objectData[item.ItemId].Price:Math.Max(0,item.salePrice(true)),energy=obj?.Edibility>=0?obj.staminaRecoveredOnConsumption():0,health=obj?.Edibility>=0?obj.healthRecoveredOnConsumption():0,icon="art/items/"+name});
              }catch(Exception e){errors.Add(lang+"/"+id+": "+e.GetType().Name+" "+e.Message);}
            }
            foreach(var p in Game1.characterData.Where(p=>p.Value.BirthSeason!=null)){
                // Locked-away Kent/Leo still need original offline tastes. This detached
                // name-only native NPC is never inserted into the world or friendship data.
                var npc=Game1.getCharacterFromName(p.Key)??new NPC {Name=p.Key};var tastes=new Dictionary<string,int>();
                if(npc!=null)foreach(var id in objectIds){var item=ItemRegistry.Create(id);if(item.canBeGivenAsGift())tastes[id]=npc.getGiftTasteForThisItem(item);}
                people.Add(new{id=p.Key,name=StardewValley.TokenizableStrings.TokenParser.ParseText(p.Value.DisplayName),season=p.Value.BirthSeason.ToString()!.ToLowerInvariant(),day=p.Value.BirthDay,romance=p.Value.CanBeRomanced,region=p.Value.HomeRegion,tastes});
            }
            output[lang.ToString()]=new{people,items};
        }}finally{LocalizedContentManager.CurrentLanguageCode=original;}
        File.WriteAllText(Path.Combine(root,"offline.json"),JsonSerializer.Serialize(output));
        File.WriteAllText(Path.Combine(root,"export-report.json"),JsonSerializer.Serialize(new{registryIds=ids.Length,errors}));
    }
}
