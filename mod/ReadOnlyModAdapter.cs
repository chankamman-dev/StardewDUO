using System.Reflection;
using StardewModdingAPI;

namespace StardewThor.ReadOnly;

internal static class ReadOnlyModAdapter {
    internal static string State(IModRegistry registry,string id,string version) {
        var info=registry.Get(id);return info==null?"absent":info.Manifest.Version.ToString()==version?"ready":"unsupported";
    }
    internal static object Api(IModRegistry registry,string id,string type) {
        // Request the original API. Our version-gated reader reflects only inspected public getters.
        var api=registry.GetApi(id)??throw new MissingMemberException("API unavailable");
        if(api.GetType().FullName!=type)throw new MissingMemberException("API layout changed");
        return api;
    }
    internal static object? Field(object target,string name)=>(target.GetType().GetField(name,BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance)??throw new MissingFieldException(name)).GetValue(target);
    internal static object? Property(object target,string name)=>(target.GetType().GetProperty(name,BindingFlags.Public|BindingFlags.Instance)??throw new MissingMemberException(name)).GetValue(target);
    internal static object? Invoke(object target,string name,params object?[] args)=>target.GetType().GetMethod(name,BindingFlags.Public|BindingFlags.Instance)?.Invoke(target,args)??throw new MissingMemberException(name);
}
