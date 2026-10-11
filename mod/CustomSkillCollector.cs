using System.Collections;
using System.Diagnostics;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
namespace StardewThor.ReadOnly;

// Numeric SpaceCore API getters call ValidateSkill and insert missing dictionaries.
// This exact-version adapter reads their existing state instead. Never obtains PerScreen.Value.
internal sealed class CustomSkillCollector {
 private readonly IModRegistry registry;
 private readonly Func<Texture2D,string?> icon;
 private readonly int owner=Environment.CurrentManagedThreadId;
 private IDictionaryEnumerator? pending;
 private Type? type;
 private object? state;
 private readonly List<CustomSkillEntry> rows=new();
 private readonly HashSet<string> limited=new(StringComparer.Ordinal);
 private readonly Dictionary<Texture2D,string?> images=new();
 private int scanned;
 private long refreshed;
 public CustomSkillEntry[]? Value {get;private set;}
 public string[] Limited {get;private set;}=Array.Empty<string>();
 internal CustomSkillCollector(IModRegistry registry,Func<Texture2D,string?>? icon=null){this.registry=registry;this.icon=icon??(_=>null);}
 public void Invalidate(){pending=null;type=null;state=null;rows.Clear();limited.Clear();images.Clear();Value=null;Limited=Array.Empty<string>();refreshed=0;}
 public void Tick(){
  if(Environment.CurrentManagedThreadId!=owner)throw new InvalidOperationException("Game thread required");
  if(!Context.IsWorldReady){Invalidate();return;}
  if(pending==null&&refreshed!=0&&BridgeServer.Age(refreshed)<2000)return;
  try{
   if(pending==null){
    rows.Clear();limited.Clear();scanned=0;type=ReadOnlyReflection.Type(registry,"spacechase0.SpaceCore","1.28.4","SpaceCore.Skills",out var status);
    if(type==null){Value=null;Limited=status=="absent"?Array.Empty<string>():new[]{"custom-skills-unsupported"};refreshed=Stopwatch.GetTimestamp();return;}
    var skills=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Static(type,"SkillsByName"));
    var perScreen=ReadOnlyReflection.Static(type,"_State")??throw new InvalidOperationException();
    var states=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Member(perScreen,"States"));
    state=states.Contains(Context.ScreenId)?states[Context.ScreenId]:null;
    if(state==null){Value=null;Limited=new[]{"custom-skills-state-unavailable"};refreshed=Stopwatch.GetTimestamp();return;}
    if(skills.Count>8)limited.Add("custom-skills-limit");pending=skills.GetEnumerator();
   }
   long begin=Stopwatch.GetTimestamp();int count=0;
   while(count++<2&&(Stopwatch.GetTimestamp()-begin)*1000d/Stopwatch.Frequency<1.5){
    if(scanned>=256)limited.Add("custom-skills-scan-limit");
    if(rows.Count>=8||scanned>=256||!pending.MoveNext()){Value=rows.ToArray();Limited=limited.OrderBy(x=>x,StringComparer.Ordinal).ToArray();pending=null;refreshed=Stopwatch.GetTimestamp();return;}scanned++;
    string id=pending.Key as string??throw new InvalidOperationException();if(id.Length is 0 or >160){limited.Add("custom-skills-id");continue;}
    var skill=pending.Value??throw new InvalidOperationException();
    var value=ReadSkill(skill,state,Game1.player.UniqueMultiplayerID,Game1.player.professions,limited);
    var name=(string?)skill.GetType().GetMethod("GetName",ReadOnlyReflection.Flags,Type.EmptyTypes)?.Invoke(skill,null)??id;
    string? image=null;var texture=ReadOnlyReflection.Member(skill,"Icon") as Texture2D;
    if(texture!=null){if(!images.TryGetValue(texture,out image)){try{if(images.Count<8){image=icon(texture);images[texture]=image;}}catch{limited.Add("custom-skills-icon");}}if(image==null)limited.Add("custom-skills-icon");}
    rows.Add(new(id,ReadOnlyReflection.Text(name,240,limited),value.Level,value.Total,value.Experience,image,value.Professions));
   }
  }catch{pending=null;Value=null;Limited=new[]{"custom-skills-unsupported"};refreshed=Stopwatch.GetTimestamp();}
 }
 internal static (int Level,int Total,int Experience,string[] Professions) ReadSkill(object skill,object? state,long player,IEnumerable<int> owned,HashSet<string> limited){
  string id=(string?)ReadOnlyReflection.Member(skill,"Id")??throw new InvalidOperationException();
  var curve=ReadOnlyReflection.Member(skill,"ExperienceCurve") as int[]??throw new InvalidOperationException();
  if(curve.Length>1000)throw new InvalidOperationException();
  IDictionary? xp=null,buffs=null;
  if(state!=null){xp=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Member(state,"Exp"));buffs=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Member(state,"Buffs"));}
  var playerXp=xp?.Contains(player)==true?ReadOnlyReflection.Dictionary(xp[player]):null;
  int experience=playerXp?.Contains(id)==true?(int)playerXp[id]!:0;
  if(experience<0){limited.Add("custom-skills-numeric");experience=0;}
  int level=0;for(int i=curve.Length-1;i>=0;i--)if(experience>=curve[i]){level=i+1;break;}
  long extra=0;var playerBuff=buffs?.Contains(player)==true?ReadOnlyReflection.Dictionary(buffs[player]):null;
  if(playerBuff?.Contains(id)==true){var list=ReadOnlyReflection.Dictionary(playerBuff[id]);if(list.Count>256)limited.Add("custom-skills-buffs-limit");int n=0;foreach(var v in list.Values){if(++n>256)break;extra+=(int)v;}}
  var professions=new List<string>();var all=ReadOnlyReflection.Member(skill,"Professions") as IList??throw new InvalidOperationException();
  if(all.Count>32)limited.Add("custom-skills-professions-limit");var ownedSet=owned.Take(256).ToHashSet();if(ownedSet.Count>=256)limited.Add("custom-skills-owned-professions-limit");
  for(int i=0;i<Math.Min(all.Count,32);i++){var p=all[i]!;int vanilla=(int)(p.GetType().GetMethod("GetVanillaId",ReadOnlyReflection.Flags,Type.EmptyTypes)?.Invoke(p,null)??throw new InvalidOperationException());if(ownedSet.Contains(vanilla)){string pid=(string?)ReadOnlyReflection.Member(p,"Id")??"";if(pid.Length is >0 and <=160)professions.Add(pid);else limited.Add("custom-skills-profession-id");}}
  if(extra+level is < -1000 or >1000)limited.Add("custom-skills-numeric");
  return(level,(int)Math.Clamp(level+extra,-1000,1000),experience,professions.Take(32).ToArray());
 }
}

