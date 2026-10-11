using System.Collections;
using System.Reflection;
using StardewModdingAPI;
namespace StardewThor.ReadOnly;

internal static class ReadOnlyReflection {
 internal const BindingFlags Flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static;
 internal static Type? Type(IModRegistry registry,string id,string version,string type,out string state){
  var info=registry.Get(id);state=info==null?"absent":"unsupported";
  if(info?.Manifest.Version.ToString()!=version)return null;
  var found=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType(type,false)).FirstOrDefault(t=>t!=null);
  return found;
 }
 internal static object? Member(object target,string name)=>target.GetType().GetField(name,Flags)?.GetValue(target)??target.GetType().GetProperty(name,Flags)?.GetValue(target);
 internal static object? Static(Type type,string name)=>type.GetField(name,Flags)?.GetValue(null)??type.GetProperty(name,Flags)?.GetValue(null);
 internal static IDictionary Dictionary(object? value)=>value as IDictionary??throw new InvalidOperationException("Unsupported dictionary layout");
 internal static string Text(string? value,int max,HashSet<string> limited){value??="";if(value.Length>max){limited.Add("text-limit");return value[..max];}return value;}
}
