using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewValley;

namespace StardewThor.ReadOnly;

internal static class MapAvatar {
    // Bounds are relative to the native mug shot, inclusive at the top/exclusive
    // at the bottom. Calibrated against the current PC 1.6.15 character sprites.
    // Other 16x24 mug shots take their top 13 rows (MapAvatarRaster.Head).
    private static readonly Dictionary<string,(int Top,int Bottom)> Heads=new() {
        ["Abigail"]=(5,18),["Caroline"]=(7,17),["Clint"]=(3,14),
        ["Demetrius"]=(1,13),["Willy"]=(2,13),["Elliott"]=(3,14),
        ["Emily"]=(4,18),["Evelyn"]=(8,19),["George"]=(7,18),
        ["Gus"]=(2,16),["Haley"]=(6,17),["Harvey"]=(1,13),
        ["Jas"]=(3,18),["Jodi"]=(6,18),["Alex"]=(3,14),
        ["Leah"]=(6,18),["Lewis"]=(3,16),["Linus"]=(7,21),
        ["Marnie"]=(6,19),["Maru"]=(6,19),["Pam"]=(7,19),
        ["Penny"]=(7,19),["Pierre"]=(3,15),["Robin"]=(1,17),
        ["Sam"]=(0,15),["Sebastian"]=(4,16),["Shane"]=(4,15),
        ["Vincent"]=(5,19),["Wizard"]=(1,20),["Dwarf"]=(4,16),["Krobus"]=(0,15)
    };
    internal static byte[]? Npc(string id,Texture2D texture,Rectangle mugshot) {
        if(mugshot.Width<1||mugshot.Height<1||mugshot.Width>128||mugshot.Height>128||mugshot.X<0||mugshot.Y<0||mugshot.Right>texture.Width||mugshot.Bottom>texture.Height)return null;
        var source=SheetPixels.Read(texture,mugshot,live:true);
        // Every standard 16x24 mug shot becomes a pixel head at native scale, so the map shows one style:
        // calibrated bounds for the original villagers, the top 13 rows for the rest.
        (int Top,int Bottom)? head=mugshot.Width==16&&mugshot.Height==24?(Heads.TryGetValue(id,out var known)?known:MapAvatarRaster.Head(source,16,24)):null;
        if(head is not {} crop) {
            var fitted=MapAvatarRaster.Fit(source,mugshot.Width,mugshot.Height);
            return fitted==null?null:Png.Encode(18,20,fitted);
        }
        var result=new Color[18*20];int height=crop.Bottom-crop.Top;
        for(int y=crop.Top;y<crop.Bottom;y++)for(int x=0;x<16;x++) {
            // Keep beard/chin silhouettes without the shirt pixels beside them.
            if(id=="George"&&y>=15&&(x<4||x>11))continue;
            if(id=="Haley"&&y==16&&(x<6||x>9))continue;
            if(id=="Linus"&&y>=19&&(x<3||x>11))continue;
            if(id=="Wizard"&&y>=17&&(x<5||x>10))continue;
            if(id=="Demetrius"&&y>=11&&(x<5||x>10))continue;
            // Round the final two hair/chin rows instead of ending in a flat
            // horizontal strip. Retain special beard and creature silhouettes.
            if(id is not ("Wizard" or "Linus" or "Dwarf" or "Krobus")) {
                if(y==crop.Bottom-1&&(x<5||x>10))continue;
                if(y==crop.Bottom-2&&(x<3||x>12))continue;
            }
            result[((20-height)/2+y-crop.Top)*18+x+1]=source[y*16+x];
        }
        return Png.Encode(18,20,result);
    }
    // Only called on the game thread when appearance changes, never per network request.
    internal static byte[] Player(Farmer farmer, bool fullBody=false) {
        // Draws into its own render target outside the draw phase, then reads it back: only while the game
        // is quiet (no dialogue, cutscene, fade, save) -- the riskiest graphics work the bridge does on GLES.
        if(!SheetPixels.Quiet){SheetPixels.Deferred++;SheetPixels.Thrown++;throw new TextureDeferred("busy");}
        SheetPixels.LiveReads++;
        var device=Game1.graphics.GraphicsDevice;
        int width=fullBody?128:18,height=fullBody?192:20;bool wasUi=FarmerRenderer.isDrawingForUI;
        var targets=device.GetRenderTargets();var viewport=device.Viewport;var scissor=device.ScissorRectangle;
        var blend=device.BlendState;var depth=device.DepthStencilState;var raster=device.RasterizerState;
        var sampler=device.SamplerStates[0];var texture=device.Textures[0];
        using var target=new RenderTarget2D(device,width,height,false,SurfaceFormat.Color,DepthFormat.None);
        using var batch=new SpriteBatch(device);
        try {
            device.SetRenderTarget(target);device.Clear(Color.Transparent);
            batch.Begin(SpriteSortMode.FrontToBack,BlendState.AlphaBlend,SamplerState.PointClamp,DepthStencilState.None,RasterizerState.CullNone);
            if(fullBody){
                batch.Draw(Game1.timeOfDay>=1900?Game1.nightbg:Game1.daybg,Vector2.Zero,Color.White);
                FarmerRenderer.isDrawingForUI=true;
                farmer.FarmerRenderer.draw(batch,new FarmerSprite.AnimationFrame(0,farmer.bathingClothes.Value?108:0,false,false),farmer.bathingClothes.Value?108:0,new Rectangle(0,farmer.bathingClothes.Value?576:0,16,32),new Vector2(32,32),Vector2.Zero,.8f,2,Color.White,0f,1f,farmer);
            }else farmer.FarmerRenderer.drawMiniPortrat(batch,new Vector2(1,2),0.5f,1f,2,farmer);
            batch.End();
        } finally {
            FarmerRenderer.isDrawingForUI=wasUi;device.SetRenderTargets(targets);device.Viewport=viewport;device.ScissorRectangle=scissor;
            device.BlendState=blend;device.DepthStencilState=depth;device.RasterizerState=raster;
            device.SamplerStates[0]=sampler;device.Textures[0]=texture;
        }
        var pixels=new Color[width*height];target.GetData(pixels);return Png.Encode(width,height,pixels);
    }
}
