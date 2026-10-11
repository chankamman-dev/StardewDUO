using System.Reflection;
using System.Text.Json.Nodes;
using HarmonyLib;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewValley.Menus;

namespace StardewThor.ReadOnly;

// Independent display/pointer-hit switch; never edit Game1.displayHUD or inventory.
// Other mods' custom toolbar classes/draw postfixes are outside this adaptation.
internal static class ToolbarDisplay
{
    private static string path="";
    private static bool configuredHidden;
    public static bool Enabled {get;private set;}
    public static bool Hidden=>Enabled&&configuredHidden;
    public static void Initialize(string directory,IMonitor monitor)
    {
        path=Path.Combine(directory,"config.json");
        try
        {
            configuredHidden=Read()["HideToolbar"]?.GetValue<bool>()??false;
            var target=typeof(Toolbar).GetMethod(nameof(Toolbar.draw),new[]{typeof(SpriteBatch)})??throw new MissingMethodException("Toolbar.draw(SpriteBatch)");
            var prefix=typeof(ToolbarDisplay).GetMethod(nameof(DrawPrefix),BindingFlags.Static|BindingFlags.NonPublic)!;
            var hit=typeof(Toolbar).GetMethod(nameof(Toolbar.isWithinBounds),new[]{typeof(int),typeof(int)})??throw new MissingMethodException("Toolbar.isWithinBounds(int,int)");
            var hitPrefix=typeof(ToolbarDisplay).GetMethod(nameof(HitPrefix),BindingFlags.Static|BindingFlags.NonPublic)!;
            var harmony=new Harmony("chankamman.StardewDS.ToolbarDisplay");
            harmony.Patch(target,prefix:new HarmonyMethod(prefix));
            harmony.Patch(hit,prefix:new HarmonyMethod(hitPrefix));
            Enabled=true;
        }
        catch(Exception e){Enabled=false;configuredHidden=false;monitor.Log("Toolbar display option unavailable: "+e.GetType().Name,LogLevel.Warn);}
    }
    private static bool DrawPrefix()=>!Hidden;
    // Original Game1 pointer dispatch calls isWithinBounds before hover/left/right click.
    // Returning false lets the world receive the pointer instead of an invisible toolbar.
    // Controller/keyboard tool selection and Farmer.shiftToolbar are left untouched.
    private static bool HitPrefix(ref bool __result){if(!Hidden)return true;__result=false;return false;}
    public static void Set(bool hidden)
    {
        if(!Enabled)throw new CommandRejected("toolbar-unavailable");
        // Serialize settings only after a real explicit request. Preserve unrelated mod
        // config keys, replace atomically, and apply memory state only after disk succeeds.
        var settings=Read();settings["HideToolbar"]=hidden;
        string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try
        {
            File.WriteAllText(temporary,settings.ToJsonString(new(){WriteIndented=true}));
            File.Move(temporary,path,true);
            configuredHidden=hidden;
        }
        finally {try{if(File.Exists(temporary))File.Delete(temporary);}catch{/* Configuration state stays unchanged on write failure. */}}
    }
    private static JsonObject Read()=>File.Exists(path)?JsonNode.Parse(File.ReadAllText(path)) as JsonObject??throw new InvalidDataException("Invalid toolbar configuration"):new JsonObject();
}
