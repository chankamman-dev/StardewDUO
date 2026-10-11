using System.Collections;
using System.Reflection;

namespace StardewThor.ReadOnly;

// Portraiture 1.12.1-alpha.20240304, inspected against the installed assembly.
// Its getPortrait mutates activeFolder; read the already loaded selection instead.
// Never load packs, advance animation, write config, or create an NPC.
internal sealed class PortraitureAdapter {
    internal const string Id="Platonymous.Portraiture", Version="1.12.1-alpha.20240304";
    private readonly Type loader;
    private const BindingFlags Fields=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Static|BindingFlags.Instance;
    internal PortraitureAdapter(Type loader){this.loader=loader;}
    private static object? Field(object value,string name)=>value.GetType().GetField(name,Fields)?.GetValue(value)??value.GetType().GetProperty(name,Fields)?.GetValue(value);
    private object? Static(string name)=>loader.GetField(name,Fields)?.GetValue(null);
    internal object? Select(string name,string? location,string season){
        if(Static("folders") is not IList folders||folders.Count is <1 or >512||Static("activeFolder") is not int active||Static("pTextures") is not IDictionary textures)return null;
        active=Math.Max(active,0);
        if(Static("presets") is {} collection&&Field(collection,"Presets") is IList presets){
            for(int i=0;i<Math.Min(presets.Count,512);i++)if(presets[i] is {} preset&&Field(preset,"Character") as string==name){active=Math.Max(folders.IndexOf(Field(preset,"Portraits")),0);break;}
        }
        if(active>=folders.Count||active==0||folders[active] is not string folder||folder is "none" or "HDP")return null;
        string prefix=folder+">"+name;
        foreach(var key in new[]{location==null?null:prefix+"_"+location+"_"+season,location==null?null:prefix+"_"+location,prefix+"_"+season,prefix})if(key!=null&&textures.Contains(key))return textures[key];
        return null;
    }
    internal (object Texture,float Scale,object? Rectangle)? Unwrap(object texture){
        var type=texture.GetType();
        if(type.Assembly!=loader.Assembly)return null;
        // A stable first frame, not the mutable dialogue animation frame.
        object? source=type.FullName=="Portraiture.AnimatedTexture2D"?Field(texture,"Frames") is IList frames&&frames.Count>0?frames[0]:null:
            type.FullName=="Portraiture.ScaledTexture2D"?type.GetProperty("STexture")?.GetValue(texture):null;
        if(source==null||ReferenceEquals(source,texture)||type.GetProperty("Scale")?.GetValue(texture) is not float scale||!float.IsFinite(scale)||scale<=0||scale>16)return null;
        return (source,scale,type.GetProperty("ForcedSourceRectangle")?.GetValue(texture));
    }
}
