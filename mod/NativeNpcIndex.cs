using StardewValley;
using HarmonyLib;

namespace StardewThor.ReadOnly;

// Equivalent to repeated Game1.getCharacterFromName(name), but visits the loaded
// world once. In particular: first active villager wins, otherwise last fallback.
// Rebuilt for each collection, so warps, removals and duplicate names don't leave
// cached NPC references from another location or save.
internal static class NativeNpcIndex
{
    internal static readonly System.Reflection.MethodInfo Resolver=typeof(Game1).GetMethods().Single(m=>
        m.Name=="getCharacterFromName"&&!m.IsGenericMethod&&m.GetParameters().Select(p=>p.ParameterType).SequenceEqual(new[]{typeof(string),typeof(bool),typeof(bool)}));
    public static Dictionary<string,NPC> Read(IEnumerable<string> names)
    {
        var wanted=new HashSet<string>(names.Take(192),StringComparer.Ordinal);
        var result=new Dictionary<string,NPC>(StringComparer.Ordinal);
        // A mod may return virtual NPCs or alter selection through a Harmony patch.
        // Preserve that contract instead of silently bypassing its resolver.
        if(Harmony.GetPatchInfo(Resolver)?.Owners.Any()==true){
            // Reflection also avoids a previously JIT-inlined original call when
            // another mod attaches its patch after this collector first ran.
            foreach(var name in wanted){var npc=Resolver.Invoke(null,new object[]{name,true,false}) as NPC;if(npc!=null)result[name]=npc;}
            return result;
        }
        var active=new HashSet<string>(StringComparer.Ordinal);
        Utility.ForEachCharacter(npc=>{
            if(wanted.Contains(npc.Name)&&!active.Contains(npc.Name)&&npc.IsVillager){
                result[npc.Name]=npc;
                if(npc.currentLocation?.IsActiveLocation()??false)active.Add(npc.Name);
            }
            return true;
        },includeEventActors:false);
        return result;
    }
}
