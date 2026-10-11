using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Menus;

namespace StardewThor.ReadOnly;

// The fishing minigame as it moves, for the lower screen to draw live: about 20 frames a second while
// BobberBar is open (stream topic "reel", outside the snapshot, which is collected a few times a
// second), then one empty frame when it closes. Positions are the game's own track pixels at 4x.
// The sprites are cut from the player's Cursors sheet (texture mods included), once per sheet.
internal static class FishingLive {
    private static readonly Rectangle[] Parts={new(644,1999,37,150),new(682,2078,9,2),new(682,2081,9,1),new(682,2085,9,2),new(614,1840,20,20),new(634,1840,20,20),new(638,1865,20,24)};
    private static Texture2D? artFor;private static ReelArt? art;private static bool open;
    public static void Tick(BridgeServer server,string session){
        if(Game1.activeClickableMenu is not BobberBar bar){if(open){open=false;server.Streams.Put("reel",null,session);}return;}
        open=true;
        server.Streams.Put("reel",new ReelFrame(Math.Round(bar.bobberBarPos,1),bar.bobberBarHeight,Math.Round(bar.bobberPosition,1),Math.Round(bar.distanceFromCatching,3),bar.bobberInBar,
            bar.treasure,Math.Round(bar.treasurePosition,1),Math.Round(bar.treasureCatchLevel,3),bar.treasureCaught,bar.bossFish,bar.perfect,Art(server)),session);
    }
    private static ReelArt? Art(BridgeServer server){
        var sheet=Game1.mouseCursors;if(sheet==null)return null;if(ReferenceEquals(sheet,artFor))return art;
        try{var urls=Parts.Select(r=>server.AddCatalogAsset(Png.Encode(r.Width,r.Height,SheetPixels.Read(sheet,r,live:true)))).ToArray();
            art=new(urls[0],urls[1],urls[2],urls[3],urls[4],urls[5],urls[6]);artFor=sheet;}
        catch(TextureDeferred){return null;}catch{artFor=sheet;art=null;}
        return art;
    }
    // The Cursors sheet changed (a texture mod, a language switch): cut the sprites again.
    public static void Reset(){artFor=null;art=null;}
}
