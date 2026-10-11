using System.Reflection;
using Microsoft.Xna.Framework;
using Netcode;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Locations;
using StardewValley.Monsters;

namespace StardewThor.ReadOnly;
// Metadata is cached by language/content epoch, not rebuilt on every scene poll.
internal sealed class MineMonsterReader {
    private readonly CatalogAssets assets;
    private readonly string[] origins;
    private readonly Dictionary<string,(string Name,string[] Drops,string? Slayer,string? Mod)> metadata=new(StringComparer.Ordinal);
    private readonly Dictionary<string,string[]> metadataNotes=new(StringComparer.Ordinal);
    private string[] goalNotes=Array.Empty<string>();
    private Dictionary<string,string>? data;
    private Dictionary<string,string>? goals;
    private readonly int owner=Environment.CurrentManagedThreadId;
    private readonly PerfStats perf;
    internal MineMonsterReader(IModRegistry registry,BridgeServer server){assets=new(server);perf=server.Perf;origins=registry.GetAll().Select(m=>m.Manifest.UniqueID).Where(id=>id.Length<=160).OrderByDescending(id=>id.Length).Take(512).ToArray();}
    internal void Invalidate(){metadata.Clear();metadataNotes.Clear();goalNotes=Array.Empty<string>();data=null;goals=null;assets.Invalidate();}
    internal static string FloorKind(GameLocation location){
        if(location is VolcanoDungeon)return "volcano";
        if(location is not MineShaft mine)return "normal";
        if(mine.isQuarryArea)return "quarry";
        if(mine.isDinoArea)return "dino";
        if(mine.isMonsterArea||mine.isSlimeArea)return "infested";
        if(Game1.version.StartsWith("1.6.15",StringComparison.Ordinal)&&typeof(MineShaft).GetField("netIsTreasureRoom",BindingFlags.NonPublic|BindingFlags.Instance)?.GetValue(mine) is NetBool treasure&&treasure.Value)return "treasure";
        if(MineShaft.mushroomLevelsGeneratedToday.Contains(mine.mineLevel))return "mushroom";
        return mine.mineLevel>MineShaft.bottomOfMineLevel?"skull":"normal";
    }
    internal (SceneMonster[] Monsters,string[] Limited) Read(GameLocation location){
        if(owner!=Environment.CurrentManagedThreadId)throw new InvalidOperationException("Game thread required");
        long begin=System.Diagnostics.Stopwatch.GetTimestamp();
        var limited=new HashSet<string>();var groups=new Dictionary<string,(Monster First,int Count,int? Health)>(StringComparer.Ordinal);int scanned=0;
        foreach(var npc in location.characters){
            if(++scanned>1024){limited.Add("monster-scan-limit");break;}
            if(npc is not Monster monster||monster.Health<=0)continue;
            string id=monster.Name;if(string.IsNullOrEmpty(id)||id.Length>160){limited.Add("monster-id-limit");continue;}
            int health=Math.Max(0,monster.MaxHealth);
            if(groups.TryGetValue(id,out var old))groups[id]=(old.First,old.Count+1,old.Health==health?health:null);
            else if(groups.Count<16)groups[id]=(monster,1,health);
            else limited.Add("monster-types-limit");
        }
        var result=new List<SceneMonster>();bool imageRead=false;
        foreach(var pair in groups){
            var m=Metadata(pair.Key,limited);string? icon=null;
            // Only one sprite extraction attempt in a scene poll. CatalogAssets deduplicates
            // actual texture + first-frame rectangle, retaining modded skin changes.
            try{var sprite=pair.Value.First.Sprite;if(sprite?.Texture!=null){var rect=new Rectangle(0,0,sprite.SpriteWidth,sprite.SpriteHeight);
                if(!assets.TryReadCached(sprite.Texture,rect,out icon)){
                    if(!imageRead){imageRead=true;icon=assets.Read(sprite.Texture,rect,limited);}else limited.Add("monster-icons-pending");
                }
            }else limited.Add("monster-icon-unavailable");}catch{limited.Add("monster-icon-unavailable");}
            result.Add(new(pair.Key,m.Name,pair.Value.Count,icon,pair.Value.Health,m.Slayer,m.Drops,m.Mod));
        }
        perf.Mark("mine.monsters",begin);return(result.ToArray(),limited.OrderBy(x=>x).Take(16).ToArray());
    }
    private (string Name,string[] Drops,string? Slayer,string? Mod) Metadata(string id,ISet<string> limited){
        if(metadata.TryGetValue(id,out var cached)){foreach(var note in metadataNotes[id])limited.Add(note);return cached;}
        var notes=new HashSet<string>();var requestNotes=limited;limited=notes;
        var drops=new List<string>();string name=id;
        try{
            data??=DataLoader.Monsters(Game1.content);
            if(data.TryGetValue(id,out string? raw)){
                var parts=raw.Split('/');if(parts.Length>14&&!string.IsNullOrEmpty(parts[14]))name=parts[14];
                if(parts.Length>6){var tokens=ArgUtility.SplitBySpace(parts[6]);
                    for(int i=0;i+1<tokens.Length;i+=2){
                        if(drops.Count==16){limited.Add("monster-drops-limit");break;}
                        var qid=ItemRegistry.QualifyItemId(tokens[i]);
                        if(qid is {Length:>0 and <=160}&&ItemRegistry.GetData(qid)!=null&&!drops.Contains(qid))drops.Add(qid);
                        else limited.Add("monster-drop-unavailable");
                    }
                }
            }else limited.Add("monster-data-unavailable");
            if(goals==null){goals=new(StringComparer.Ordinal);int scanned=0;
                foreach(var goal in DataLoader.MonsterSlayerQuests(Game1.content)){
                    if(++scanned>64){limited.Add("monster-goals-limit");break;}
                    if(goal.Value.Targets.Count>64)limited.Add("monster-goal-targets-limit");
                    foreach(var target in goal.Value.Targets.Take(64))if(target.Length<=160&&goal.Key.Length<=160)goals.TryAdd(target,goal.Key);
                }
                goalNotes=notes.Where(n=>n.StartsWith("monster-goal",StringComparison.Ordinal)).ToArray();
            }
        }catch{limited.Add("monster-data-unavailable");}
        foreach(var note in goalNotes)limited.Add(note);
        var value=(name.Length>240?name[..240]:name,drops.ToArray(),goals?.GetValueOrDefault(id),origins.FirstOrDefault(m=>id.StartsWith(m+"_",StringComparison.OrdinalIgnoreCase)||id.StartsWith(m+".",StringComparison.OrdinalIgnoreCase)));
        // Bounded independently of how many custom creatures a save eventually visits.
        if(metadata.Count>=256){metadata.Clear();metadataNotes.Clear();}metadata[id]=value;metadataNotes[id]=notes.Take(16).ToArray();foreach(var note in metadataNotes[id])requestNotes.Add(note);return value;
    }
}
