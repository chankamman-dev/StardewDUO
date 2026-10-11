using System.Reflection;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewValley;
using StardewValley.TerrainFeatures;
using StardewValley.GameData.FloorsAndPaths;

namespace StardewThor.ReadOnly;

// Read existing draw state only. Never invoke draw/updateDrawMath/paddyWaterCheck:
// those helpers can write network fields or depend on the player's current location.
internal sealed partial class LocalMapCollector {
    private static FieldInfo? Field<T>(string name)=>typeof(T).GetField(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);
    private static readonly FieldInfo? FloorMask=Field<Flooring>("neighborMask"), DirtSource=Field<HoeDirt>("sourceRectPosition"), DirtWater=Field<HoeDirt>("wateredRectPosition"), DirtTexture=Field<HoeDirt>("texture"), DirtColor=Field<HoeDirt>("c"), CropTexture=Field<Crop>("_drawnTexture");

    private void AddFloor(Job j,Flooring floor,float x,float y){
        var data=floor.GetData();if(data==null||FloorMask?.GetValue(floor) is not byte mask)return;
        bool winter=floor.ShouldDrawWinterVersion();
        var tex=(winter?floor.floorTextureWinter:floor.floorTexture)??Game1.content.Load<Texture2D>(winter?data.WinterTexture:data.Texture);
        var corner=winter?data.WinterCorner:data.Corner;
        int index=Flooring.drawGuide[ (byte)(mask&15) ];
        if(data.ConnectType==FloorPathConnectType.Random)index=Flooring.drawGuideList[floor.whichView.Value];
        // Ground precedes all standing objects. Corner decorations sit over the base.
        Add(j,tex,new Rectangle(corner.X+index*16%256,corner.Y+index/16*16,16,16),x,y,false,-200000);
        if(data.ConnectType is not (FloorPathConnectType.Default or FloorPathConnectType.CornerDecorated))return;
        int c=data.CornerSize;
        void Piece(int sx,int sy,float dx,float dy)=>Add(j,tex,new Rectangle(corner.X+sx,corner.Y+sy,c,c),x+dx,y+dy,false,-199999);
        if((mask&9)==9&&(mask&32)==0)Piece(64-c,48-c,0,0);
        if((mask&3)==3&&(mask&16)==0)Piece(16,48-c,64-c*4,0);
        if((mask&6)==6&&(mask&64)==0)Piece(16,0,64-c*4,data.ConnectType==FloorPathConnectType.Default?48:64-c*4);
        if((mask&12)==12&&(mask&128)==0)Piece(64-c,0,0,64-c*4);
    }

    private void AddDirt(Job j,HoeDirt dirt,float x,float y){
        if(dirt.state.Value!=2&&DirtSource?.GetValue(dirt) is int source&&DirtWater?.GetValue(dirt) is int water){
            // Prefer the texture already selected by the game, including custom locations.
            var tex=DirtTexture?.GetValue(dirt) as Texture2D;
            if(tex==null){
                var mine=j.Loc as StardewValley.Locations.MineShaft;
                tex=j.Loc.Name is "Mountain" or "Mine"||mine?.shouldShowDarkHoeDirt()==true||j.Loc is StardewValley.Locations.VolcanoDungeon?HoeDirt.darkTexture:HoeDirt.lightTexture;
                if((j.Loc.GetSeason()==Season.Winter&&!j.Loc.SeedsIgnoreSeasonsHere()&&mine==null)||mine?.shouldUseSnowTextureHoeDirt()==true)tex=HoeDirt.snowTexture;
            }
            var color=DirtColor?.GetValue(dirt) is Netcode.NetColor nc?nc.Value:Color.White;
            Add(j,tex,new Rectangle(source%4*16,source/4*16,16,16),x,y,false,-190000,tint:color);
            if(dirt.state.Value==1)Add(j,tex,new Rectangle(water%4*16+(dirt.nearWaterForPaddy.Value==1?128:64),water/4*16,16,16),x,y,false,-189999,tint:color);
        }
        var crop=dirt.crop;if(crop==null)return;
        // Use the stored crop rectangle and position, including dead and regrowing crops.
        // Forage Cursors and fertilizer overlays remain excluded to avoid a giant GPU readback.
        if(crop.forageCrop.Value)return;
        Texture2D? texture=CropTexture?.GetValue(crop) as Texture2D;
        if(crop.dead.Value)texture=Game1.cropSpriteSheet;
        if(texture==null){
            var asset=crop.overrideTexturePath.Value??crop.GetData()?.GetCustomTextureName("TileSheets\\crops");
            texture=asset==null?Game1.cropSpriteSheet:Game1.content.Load<Texture2D>(asset);
        }
        var tint=dirt.state.Value==1&&crop.currentPhase.Value==0&&crop.shouldDrawDarkWhenWatered()?new Color(180,100,200):Color.White;
        Add(j,texture,crop.sourceRect,crop.drawPosition.X-32,crop.drawPosition.Y-96,crop.flip.Value,crop.layerDepth*10000,tint:tint);
        if(crop.tintColor.Value!=Color.White&&crop.currentPhase.Value==crop.phaseDays.Count-1&&!crop.dead.Value)
            Add(j,texture,crop.coloredSourceRect,crop.drawPosition.X-32,crop.drawPosition.Y-96,crop.flip.Value,crop.coloredLayerDepth*10000,tint:crop.tintColor.Value);
    }

    private void AddFence(Job j,Fence fence,float x,float y){
        if(fence.GetData()==null)return;
        var tex=fence.fenceTexture.Value;int index=1;
        if(fence.health.Value>1||fence.repairQueued.Value){
            int sum=fence.getDrawSum();index=Fence.fenceDrawGuide[sum];
            if(fence.isGate.Value){
                int open=fence.gatePosition.Value==88?1:0;
                void Gate(int sx,int sy,int w,int h,float dx,float dy,float sort)=>Add(j,tex,new Rectangle(sx,sy,w,h),x+dx,y+dy,false,y+sort);
                switch(sum){
                    case 10:Gate(open*24,192,24,48,-16,-128,33);return;
                    case 100:Gate(open*24,240,24,48,-16,-128,33);return;
                    case 1000:Gate(open*24,288,24,32,20,-84,-30);return;
                    case 500:Gate(open*24,320,24,32,20,-84,95);return;
                    case 110:Gate(open*24,128,24,32,-16,-64,33);return;
                    case 1500:Gate(open*16,160,16,16,20,-84,-30);Gate(open*16,176,16,16,20,-20,95);return;
                    default:index=17;break;
                }
            }
        }
        int w=Fence.fencePieceWidth,h=Fence.fencePieceHeight;
        Add(j,tex,new Rectangle(index*w%tex.Width,index*w/tex.Width*h,w,h),x,y-64,false,y+32);
    }
}
