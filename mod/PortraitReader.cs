using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;

namespace StardewThor.ReadOnly;

internal sealed class PortraitReader {
    private readonly BridgeServer server;
    private readonly PortraitureAdapter? adapter;
    private readonly int owner=Environment.CurrentManagedThreadId;
    private readonly Dictionary<(Texture2D,Rectangle),string?> frames=new();
    private readonly Dictionary<string,string> lastGood=new(StringComparer.Ordinal);
    private readonly Dictionary<string,Texture2D?> defaults=new(StringComparer.Ordinal);
    internal PortraitReader(IModRegistry registry,BridgeServer server){
        this.server=server;
        if(registry.Get(PortraitureAdapter.Id)?.Manifest.Version.ToString()==PortraitureAdapter.Version){
            var type=AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a=>a.GetName().Name=="Portraiture")?.GetType("Portraiture.TextureLoader");
            if(type!=null)adapter=new(type);
        }
    }
    internal void Invalidate(){frames.Clear();defaults.Clear();} // published URLs + last good remain valid
    // Only the portraits whose assets changed. A portrait mod that swaps one villager's picture on every
    // warp used to clear them all, and the people catalogue then read ~250 portraits back from the GPU
    // on the game thread. A texture without a name cannot be matched and is dropped to be safe.
    internal void Invalidate(ISet<string> changed){
        foreach(var key in frames.Keys.ToArray())if(string.IsNullOrEmpty(key.Item1.Name)||changed.Contains(ContentDependencies.Normal(key.Item1.Name)))frames.Remove(key);
        foreach(var (id,texture) in defaults.ToArray())if(texture==null?changed.Contains("portraits/"+id.ToLowerInvariant()):string.IsNullOrEmpty(texture.Name)||changed.Contains(ContentDependencies.Normal(texture.Name)))defaults.Remove(id);
    }
    internal void Reset(){Invalidate();lastGood.Clear();}
    internal string? Read(string id,NPC? npc,ISet<string>? limited=null){
        if(Environment.CurrentManagedThreadId!=owner)throw new InvalidOperationException("Game thread required");
        try{
            var selected=adapter?.Select(id,Game1.currentLocation?.Name,Game1.currentSeason??"spring") as Texture2D;
            if(selected!=null&&Frame(selected) is {} picked){Remember(id,picked);return picked;}
            // A valid selected portrait does not need the native placeholder getter.
            if(npc?.Portrait is {} native&&Frame(native) is {} drawn){Remember(id,drawn);return drawn;}
            // Data-only characters: load the authored default asset without spawning one.
            if(npc==null){
                if(!defaults.TryGetValue(id,out var texture)){if(defaults.Count>=512)return lastGood.GetValueOrDefault(id);texture=null;try{texture=Game1.content.Load<Texture2D>("Portraits/"+(Game1.characterData.TryGetValue(id,out var data)?data.TextureName??id:id));}catch{}if(defaults.Count<512)defaults[id]=texture;}
                if(texture!=null&&Frame(texture) is {} result){Remember(id,result);return result;}
            }
        }catch{limited?.Add("portrait-source-unavailable");}
        limited?.Add("portrait-unavailable");return lastGood.GetValueOrDefault(id);
    }
    private void Remember(string id,string url){if(lastGood.Count<512||lastGood.ContainsKey(id))lastGood[id]=url;}
    private string? Frame(Texture2D texture){
        if(!SheetPixels.Quiet){SheetPixels.Deferred++;return null;}
        var source=texture;var rect=new Rectangle(0,0,64,64);
        if(adapter?.Unwrap(texture) is {} wrapper&&wrapper.Texture is Texture2D actual){source=actual;int size=(int)Math.Round(64*wrapper.Scale);rect=wrapper.Rectangle is Rectangle forced?forced:new Rectangle(0,0,size,size);}
        var key=(source,rect);if(frames.TryGetValue(key,out var cached))return cached;
        if(frames.Count>=2048||rect.Width is <1 or >512||rect.Height is <1 or >512||rect.Left<0||rect.Top<0||rect.Right>source.Width||rect.Bottom>source.Height)return null;
        string? url=null;
        // Deferred until the game is quiet: not cached, so the next pass tries again.
        try{var colors=SheetPixels.Read(source,rect,live:true);var fitted=PortraitPixels.Resize(colors.Select(c=>c.PackedValue).ToArray(),rect.Width,rect.Height);
            if(fitted!=null)url=server.AddCatalogAsset(Png.Encode(64,64,fitted.Select(p=>new Color{PackedValue=p}).ToArray()));
        }catch(TextureDeferred){return null;}catch{}
        frames[key]=url;return url;
    }
}
