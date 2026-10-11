using Microsoft.Xna.Framework;

namespace StardewThor.ReadOnly;

// CPU-only helpers for mod NPCs, reading nothing beyond the game's mug-shot rectangle: the head
// of a standard mug shot, and a scaled fit for any other size.
internal static class MapAvatarRaster
{
    // The head of a 16x24 mug shot: 13 rows from its first opaque row. Measured against the 31
    // calibrated villagers this is off by 1.5 rows on average and errs toward keeping the chin; outline
    // widths (looking for a neck) did worse, since hair, beards and arms hide it.
    internal static (int Top,int Bottom)? Head(Color[] source,int width,int height)
    {
        if(source.Length!=width*height)return null;
        for(int y=0;y<height;y++)for(int x=0;x<width;x++)if(source[y*width+x].A!=0)return (y,Math.Min(height,y+13));
        return null;
    }
    internal static Color[]? Fit(Color[] source,int width,int height)
    {
        if(width<1||height<1||width>128||height>128||source.Length!=width*height)return null;
        int left=width,top=height,right=-1,bottom=-1;
        for(int y=0;y<height;y++)for(int x=0;x<width;x++)if(source[y*width+x].A!=0) {
            left=Math.Min(left,x);right=Math.Max(right,x);top=Math.Min(top,y);bottom=Math.Max(bottom,y);
        }
        if(right<left)return null;
        int w=right-left+1,h=bottom-top+1;
        double scale=Math.Min(16.0/w,18.0/h);
        int dw=Math.Max(1,(int)Math.Round(w*scale)),dh=Math.Max(1,(int)Math.Round(h*scale));
        int ox=(18-dw)/2,oy=(20-dh)/2;
        var result=new Color[18*20];
        for(int y=0;y<dh;y++)for(int x=0;x<dw;x++)
            result[(oy+y)*18+ox+x]=source[(top+Math.Min(h-1,(int)((y+.5)*h/dh)))*width+left+Math.Min(w-1,(int)((x+.5)*w/dw))];
        return result;
    }
}
