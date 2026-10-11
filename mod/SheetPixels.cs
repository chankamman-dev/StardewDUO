using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewThor.Bridge;
using StardewValley;
using System.Linq;

namespace StardewThor.ReadOnly;
// Reading a sub-rectangle with Texture2D.GetData reads back the whole texture on the GL backends, so one
// icon per call cost a full-sheet copy: building the item catalogue allocated enough to force a Gen2 GC
// (a 600 ms frame on PC). Read each sheet once, cut icons from memory, and let go of the sheets after 5 s
// unused or when a caller finishes a batch. Only plain Color textures up to 2048x2048, 32 MB in total.
// Game thread only (the callers already are).
// Phase 3 (stability): reading a texture back is the riskiest native call the bridge makes. On the GLES
// backend it goes through a render target, and a texture another mod is drawing into (a RenderTarget2D,
// e.g. a generated HD portrait) can bring the whole process down. Render targets are never read, and
// `live` reads (portraits, map avatars, context icons: character textures other mods swap during
// dialogue) wait until no dialogue, cutscene, fade, minigame or save is under way.
internal sealed class TextureDeferred:Exception{public TextureDeferred(string why):base(why){}}
internal static class SheetPixels {
    public static bool Quiet=>!(Game1.eventUp||Game1.dialogueUp||Game1.activeClickableMenu is StardewValley.Menus.DialogueBox||Game1.globalFade||Game1.fadeToBlack||Game1.currentMinigame!=null||Game1.newDay||Game1.isWarping);
    // Counters for the run log: character reads done / deferred while the game was busy, render targets
    // refused, and actual GPU read-backs (whole sheets, or single rectangles for textures not cached).
    public static long LiveReads,Deferred,Thrown,RenderTargets,SheetReadbacks,RectReadbacks,Reads;
    private static readonly Dictionary<Texture2D,Color[]> sheets=new();private static readonly Dictionary<Texture2D,long> lastUse=new();
    private static long bytes,used,clock;
    public static void Release(){sheets.Clear();lastUse.Clear();bytes=0;}
    // Only sheets read from these assets (or with no asset name to compare): an unrelated asset leaves the rest.
    public static void Release(ISet<string> names){foreach(var t in sheets.Keys.ToArray())if(string.IsNullOrEmpty(t.Name)||names.Contains(ContentDependencies.Normal(t.Name))){bytes-=(long)t.Width*t.Height*4;sheets.Remove(t);lastUse.Remove(t);}if(bytes<0)bytes=0;}
    public static Color[] Read(Texture2D texture,Rectangle rect,bool live=false){
        if(texture is RenderTarget2D){RenderTargets++;throw new TextureDeferred("render-target");}
        if(texture.IsDisposed)throw new TextureDeferred("disposed");
        if(live&&!Quiet){Deferred++;Thrown++;throw new TextureDeferred("busy");}
        if(live)LiveReads++;
        if(used!=0&&BridgeServer.Age(used)>5000)Release();used=System.Diagnostics.Stopwatch.GetTimestamp();
        Reads++;var colors=new Color[rect.Width*rect.Height];
        if(texture.Format!=SurfaceFormat.Color||texture.Width>2048||texture.Height>2048){RectReadbacks++;texture.GetData(0,rect,colors,0,colors.Length);return colors;}
        if(!sheets.TryGetValue(texture,out var all)){
            // Over 32 MB: let go of the sheets used longest ago, not all of them (with a hundred mods
            // alternating sheets, clearing everything re-read nearly every sheet for every icon).
            long size=(long)texture.Width*texture.Height*4;
            while(bytes+size>32L<<20&&lastUse.Count>0){var old=lastUse.MinBy(p=>p.Value).Key;bytes-=(long)old.Width*old.Height*4;sheets.Remove(old);lastUse.Remove(old);}
            all=new Color[texture.Width*texture.Height];SheetReadbacks++;texture.GetData(all);sheets[texture]=all;bytes+=size;
        }
        lastUse[texture]=++clock;
        for(int y=0;y<rect.Height;y++)Array.Copy(all,(rect.Top+y)*texture.Width+rect.Left,colors,y*rect.Width,rect.Width);
        return colors;
    }
}
