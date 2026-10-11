namespace StardewThor.Bridge;

[Flags] public enum ContentDependency {
 None=0,Events=1,Calendar=2,Portraits=4,World=8,LocalMaps=16,CatalogPeople=32,Progress=64,Relations=128,Textures=256,All=511
}
// Known display-only asset changes do not discard unrelated gameplay caches. Content Patcher packs
// re-invalidate assets on every warp or clock tick (fonts, tile sheets, companions), so only game data
// and text take the complete path; any other asset is a texture whose icons are refreshed by name.
public static class ContentDependencies {
 public static ContentDependency Classify(string name){
  var n=name.Replace('\\','/');bool Is(string p)=>n.StartsWith(p,StringComparison.OrdinalIgnoreCase);
  if(Is("Portraits/")||Is("Characters/")||Is("Mods/HDPortraits"))return ContentDependency.Portraits|ContentDependency.World|ContentDependency.CatalogPeople;
  if(n.Equals("Data/Characters",StringComparison.OrdinalIgnoreCase))return ContentDependency.Calendar|ContentDependency.Portraits|ContentDependency.World|ContentDependency.CatalogPeople|ContentDependency.Relations;
  if(Is("Data/Events/"))return ContentDependency.Events;
  // Glyphs only: nothing here reads a font.
  if(Is("Fonts/")||Is("LooseSprites/font_"))return ContentDependency.None;
  // Maps/ is terrain, or an item sheet (Maps/springobjects): icons drawn from it are refreshed by name.
  if(Is("Maps/"))return ContentDependency.World|ContentDependency.LocalMaps|ContentDependency.Textures;
  if(n.Equals("Data/WorldMap",StringComparison.OrdinalIgnoreCase)||n.Equals("LooseSprites/map",StringComparison.OrdinalIgnoreCase))return ContentDependency.World|ContentDependency.LocalMaps|ContentDependency.Progress;
  // Game data and text (a mod's own Strings too: item names may quote them) can change anything.
  if(Is("Data/")||Is("Strings/")||n.Contains("/Strings",StringComparison.OrdinalIgnoreCase))return ContentDependency.All;
  return ContentDependency.Textures|ContentDependency.LocalMaps;
 }
 // Asset names as SMAPI reports them and as textures carry them: forward slashes, no case.
 public static string Normal(string name)=>name.Replace('\\','/').ToLowerInvariant();
}
