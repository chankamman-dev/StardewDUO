using StardewThor.ReadOnly;
using Portraiture;

int checks=0;
void Check(bool ok,string label){if(!ok)throw new Exception(label);checks++;}
TextureLoader.folders=new(){"Vanilla","BV","Other"};TextureLoader.activeFolder=1;
var neutral=new object();var season=new object();var location=new object();var both=new object();
TextureLoader.pTextures=new(){["BV>Halsin"]=neutral,["BV>Halsin_spring"]=season,["BV>Halsin_Town"]=location,["BV>Halsin_Town_spring"]=both,["Other>Halsin"]=neutral};
var adapter=new PortraitureAdapter(typeof(TextureLoader));
Check(ReferenceEquals(adapter.Select("Halsin","Town","spring"),both),"location + season selection");
Check(ReferenceEquals(adapter.Select("Halsin","Town","winter"),location),"location selection");
Check(ReferenceEquals(adapter.Select("Halsin",null,"spring"),season),"season selection");
Check(ReferenceEquals(adapter.Select("Halsin",null,"winter"),neutral),"neutral selection");
TextureLoader.presets.Presets.Add(new(){Character="Halsin",Portraits="Other"});
Check(ReferenceEquals(adapter.Select("Halsin","Town","spring"),neutral),"per-character preset");
Check(TextureLoader.activeFolder==1,"selection never changes global folder");
TextureLoader.presets.Presets.Clear();TextureLoader.activeFolder=0;
Check(adapter.Select("Halsin",null,"spring")==null,"disabled pack stays disabled");
TextureLoader.activeFolder=999;Check(adapter.Select("Halsin",null,"spring")==null,"invalid folder fails closed");
TextureLoader.activeFolder=1;Check(adapter.Select("Missing",null,"spring")==null,"missing portrait stays unavailable");
var scaled=new ScaledTexture2D{STexture=neutral,Scale=3.71875f};
Check(ReferenceEquals(adapter.Unwrap(scaled)?.Texture,neutral)&&adapter.Unwrap(scaled)?.Scale==3.71875f,"unwrap actual texture and fractional scale");
var anim=new AnimatedTexture2D{Frames=new(){neutral,season},CurrentFrame=1,Scale=2};
Check(ReferenceEquals(adapter.Unwrap(anim)?.Texture,neutral)&&anim.CurrentFrame==1,"stable first frame without animation mutation");
scaled.Scale=float.NaN;Check(adapter.Unwrap(scaled)==null,"invalid scale rejected");
Check(PortraitPixels.Resize(Enumerable.Repeat(uint.MaxValue,4096).ToArray(),64,64)==null,"opaque white dummy rejected");
Check(PortraitPixels.Resize(new uint[4096],64,64)==null,"transparent dummy rejected");
Check(PortraitPixels.Resize(Enumerable.Repeat(0xff000000u,4096).ToArray(),64,64)==null,"solid black dummy rejected");
var pixels=Enumerable.Range(0,238*238).Select(i=>0xff000000u|(uint)i).ToArray();var small=PortraitPixels.Resize(pixels,238,238)!;
Check(small.Length==4096&&small[0]==pixels[239]&&small[4095]==pixels[236*238+236],"fractional-scale HD frame resized, not upper-left cropped");
Check(PortraitPixels.Resize(new uint[513*513],513,513)==null,"cold GPU-frame size capped");
Check(PortraitPixels.Resize(new uint[5],64,64)==null,"pixel bounds checked");
Console.WriteLine($"PASS {checks} portrait selection, read-only adapter, placeholder and HD raster checks");

namespace Portraiture {
 public static class TextureLoader {public static int activeFolder;public static List<string> folders=new();public static Dictionary<string,object> pTextures=new();public static PresetCollection presets=new();}
 public sealed class PresetCollection {public List<Preset> Presets{get;set;}=new();}
 public sealed class Preset {public string Character{get;set;}="";public string Portraits{get;set;}="";}
 public class ScaledTexture2D {public virtual object? STexture{get;set;}public float Scale{get;set;}=1;public object? ForcedSourceRectangle{get;set;}}
 public sealed class AnimatedTexture2D:ScaledTexture2D {public List<object> Frames=new();public int CurrentFrame;public override object? STexture{get=>Frames[CurrentFrame];set=>base.STexture=value;}}
}
