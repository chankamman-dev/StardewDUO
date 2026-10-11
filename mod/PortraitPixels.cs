namespace StardewThor.ReadOnly;

internal static class PortraitPixels {
    // Pixel work is bounded, performed once per source frame, and independent of GPU/UI.
    internal static uint[]? Resize(uint[] pixels,int width,int height){
        if(width is <1 or >512||height is <1 or >512||pixels.Length!=width*height)return null;
        bool visible=false,varied=false;uint first=pixels[0];
        foreach(var p in pixels){visible|=(p>>24)>0;varied|=p!=first;}
        if(!visible||!varied)return null; // transparent/solid placeholders are not portraits.
        var result=new uint[64*64];
        for(int y=0;y<64;y++)for(int x=0;x<64;x++)result[y*64+x]=pixels[Math.Min(height-1,(2*y+1)*height/128)*width+Math.Min(width-1,(2*x+1)*width/128)];
        return result;
    }
}
