using StardewModdingAPI;
namespace StardewThor.Tests;
// Development extraction helper. Runs at the title screen, never opens or saves a farm.
public sealed class ModEntry:Mod {
 public override void Entry(IModHelper helper){helper.Events.GameLoop.GameLaunched+=(_,_)=>{try{var root=Path.Combine(helper.DirectoryPath,"export");Exporter.Run(root,true);Exporter.Audio(root);Monitor.Log("Owned-game content exported to this helper's export folder. Close the game and run extract-local-assets.cjs.",LogLevel.Info);}catch(Exception e){Monitor.Log("Export failed: "+e.Message,LogLevel.Error);}};}
}
