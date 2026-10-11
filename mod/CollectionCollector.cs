using System.Collections;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Extensions;
using StardewValley.GameData.Objects;
using StardewValley.ItemTypeDefinitions;
using StardewValley.Locations;
namespace StardewThor.ReadOnly;

internal sealed class CollectionCollector {
 private readonly IModRegistry registry;
 private readonly int owner=Environment.CurrentManagedThreadId;
 private readonly HashSet<string> limited=new(StringComparer.Ordinal);
 private readonly List<CollectionSet> sets=new();
 private readonly List<CollectionEntry> rows=new();
 private IEnumerator<CollectionEntry?>? pending;
 private IncrementalHash? digest;
 private readonly HashSet<string> seen=new(StringComparer.Ordinal);
 private int stage,scanned,bytes;
 private long refreshed,version;
 private bool unavailable;
 private string fingerprint="",language="",setState="ready";
 private int? setTotal,donationCount;
 private readonly List<ParsedItemData>[] originals=Enumerable.Range(0,4).Select(_=>new List<ParsedItemData>()).ToArray();
 private bool originalsReady,originalsLimited;
 internal int ObjectScans{get;private set;}
 internal int ReportsBuilt{get;private set;}
 internal bool NeedsWork=>Document.Wanted&&(pending!=null||stage!=0||refreshed==0||BridgeServer.Age(refreshed)>=5000);
 private static readonly string[] Ids={"museum","fish","shipped","cooking","birds","nature","aquarium"};
 private static readonly string?[] Mods={null,null,null,null,"Ivy.OrnithologistsGuild","Nature.NatureInTheValley","Cherry.StardewAquarium"};
 public DemandDocument Document {get;}
 internal CollectionCollector(IModRegistry registry){this.registry=registry;Document=new(new CollectionReport("building",0,"",Array.Empty<CollectionSet>(),Array.Empty<string>()),CollectionLimits.Bytes);}
 public void Invalidate(string lang){pending?.Dispose();pending=null;digest?.Dispose();digest=null;stage=0;rows.Clear();sets.Clear();limited.Clear();foreach(var list in originals)list.Clear();originalsReady=false;refreshed=0;language=lang;fingerprint="";unavailable=false;Document.Publish(new CollectionReport("building",++version,lang,Array.Empty<CollectionSet>(),Array.Empty<string>()));}
 public void Tick(string lang){
  if(Environment.CurrentManagedThreadId!=owner)throw new InvalidOperationException("Game thread required");
  if(!Document.Wanted)return;
  if(language!=lang)Invalidate(lang);
  if(!Context.IsWorldReady){if(!unavailable){Invalidate(lang);unavailable=true;Document.Publish(new CollectionReport("unavailable",++version,lang,Array.Empty<CollectionSet>(),Array.Empty<string>()));}return;}
  if(unavailable)Invalidate(lang);
  if(pending==null&&stage==0&&refreshed!=0&&BridgeServer.Age(refreshed)<5000)return;
  long start=Stopwatch.GetTimestamp();int work=0;
  try{
   while(work++<64&&(Stopwatch.GetTimestamp()-start)*1000d/Stopwatch.Frequency<1.5){
    if(pending==null){
     if(stage==0){sets.Clear();limited.Clear();bytes=0;digest?.Dispose();digest=IncrementalHash.CreateHash(HashAlgorithmName.SHA256);}
     rows.Clear();seen.Clear();scanned=0;setState="ready";setTotal=null;donationCount=null;
     pending=Source(stage).GetEnumerator();
    }
    if(scanned>=CollectionLimits.Scan+(stage==0?CollectionLimits.Entries+1:0)){limited.Add(Ids[stage]+"-scan-limit");if(FinishSet())return;continue;}
    if(!pending.MoveNext()){if(FinishSet())return;continue;}
    scanned++;var entry=pending.Current;if(entry==null)continue;
    if(entry.Id.Length is 0 or >160){limited.Add(Ids[stage]+"-id-limit");continue;}
    if(!seen.Add(entry.Id)){limited.Add(Ids[stage]+"-duplicate-id");continue;}
    entry=entry with{Name=ReadOnlyReflection.Text(entry.Name,240,limited)};
    var encoded=JsonSerializer.SerializeToUtf8Bytes(entry,BridgeServer.Json);int size=encoded.Length;
    if(rows.Count>=CollectionLimits.Entries||bytes+size>CollectionLimits.Bytes-24*1024){limited.Add(rows.Count>=CollectionLimits.Entries?Ids[stage]+"-entry-limit":"response-bytes");if(FinishSet())return;continue;}
    rows.Add(entry);bytes+=size;digest!.AppendData(encoded);
   }
  }catch{setState="unsupported";limited.Add(Ids[stage]+"-unsupported");rows.Clear();FinishSet();}
 }
 private bool FinishSet(){
  pending?.Dispose();pending=null;
  bool usable=setState=="ready";
  int found=rows.Count(e=>e.Found),donated=rows.Count(e=>e.Donated==true);
  sets.Add(new(Ids[stage],setState,usable&&stage!=6?found:null,usable?setTotal:null,usable?rows.ToArray():Array.Empty<CollectionEntry>(),Mods[stage],usable&&(stage is 0 or 5 or 6)?donationCount??donated:null));
  if(++stage<Ids.Length)return false;
  stage=0;refreshed=Stopwatch.GetTimestamp();ReportsBuilt++;var result=new CollectionReport("ready",0,language,sets.ToArray(),limited.OrderBy(x=>x,StringComparer.Ordinal).Take(32).ToArray());
  digest!.AppendData(JsonSerializer.SerializeToUtf8Bytes(new{language,sets=sets.Select(s=>new{s.Id,s.State,s.Found,s.Total,s.Mod,s.Donated}),result.Limited},BridgeServer.Json));
  string hash=Convert.ToHexString(digest.GetHashAndReset());digest.Dispose();digest=null;
  if(hash!=fingerprint){fingerprint=hash;version++;Document.Publish(result with{Version=version});}return true;
 }
 private IEnumerable<CollectionEntry?> Source(int kind){
  if(kind<4)return Original(kind);
  return kind switch{4=>Birds(),5=>Nature(),_=>Aquarium()};
 }
 private IEnumerable<CollectionEntry?> Original(int kind){
  // Membership and localized metadata are static until content/language/save invalidation.
  // Walk the registry once, sliced as before; subsequent progress reads visit eligible rows only.
  if(!originalsReady){int inspected=0;originalsLimited=false;foreach(var list in originals)list.Clear();ObjectScans++;
   foreach(var item in ItemRegistry.GetObjectTypeDefinition().GetAllData()){
    if(++inspected>CollectionLimits.Scan){originalsLimited=true;break;}
    if(item.RawData is ObjectData data){string id=item.ItemId;
     if(item.ObjectType is "Arch" or "Minerals"||item.Category==-2)originals[0].Add(item);
     if(item.ObjectType=="Fish"&&!data.ExcludeFromFishingCollection)originals[1].Add(item);
     if(StardewValley.Object.isPotentialBasicShipped(id,item.Category,item.ObjectType))originals[2].Add(item);
     if((item.ObjectType=="Cooking"||item.Category==-7)&&id is not("217" or "772" or "773" or "279" or "873"))originals[3].Add(item);
    }yield return null;
   }originalsReady=true;scanned=0;
  }
  if(originalsLimited)limited.Add(Ids[kind]+"-source-limit");
  setTotal=originals[kind].Count;
  foreach(var item in originals[kind]){
   string id=item.ItemId;
   bool found=kind switch{0=>item.ObjectType=="Arch"?Game1.player.archaeologyFound.ContainsKey(id):Game1.player.mineralsFound.ContainsKey(id),1=>Game1.player.fishCaught.ContainsKey(item.QualifiedItemId),2=>Game1.player.basicShipped.ContainsKey(id),_=>Game1.player.recipesCooked.ContainsKey(id)};
   yield return new(item.QualifiedItemId,item.DisplayName,found,kind==0?LibraryMuseum.HasDonatedArtifact(id):null);
  }
 }
 internal static IDictionary? ExistingBirdLifeList(Type manager,long player){
  var save=ReadOnlyReflection.Static(manager,"SaveData");if(save==null)return null;
  var players=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Member(save,"Players"));
  return players.Contains(player)?ReadOnlyReflection.Dictionary(ReadOnlyReflection.Member(players[player]!,"LifeList")):null;
 }
 private IEnumerable<CollectionEntry?> Birds(){
  var manager=ReadOnlyReflection.Type(registry,Mods[4]!,"1.9.8","OrnithologistsGuild.SaveDataManager",out setState);if(manager==null)yield break;
  if(ReadOnlyReflection.Static(manager,"SaveData")==null){setState="building";yield break;}
  var definitions=manager.Assembly.GetType("OrnithologistsGuild.Content.ContentPackManager",true)!;
  var birds=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Static(definitions,"BirdieDefs"));
  var life=ExistingBirdLifeList(manager,Game1.player.UniqueMultiplayerID);setTotal=birds.Count;setState="ready";
  int n=0;foreach(DictionaryEntry pair in birds){
   if(++n>CollectionLimits.Scan){limited.Add("birds-source-limit");yield break;}
   string id=pair.Key as string??throw new InvalidOperationException();var bird=pair.Value!;
   bool found=life?.Contains(id)==true&&(bool)(ReadOnlyReflection.Member(life[id]!,"Identified")??throw new InvalidOperationException());
   string local=(string?)ReadOnlyReflection.Member(bird,"ID")??throw new InvalidOperationException();
   var packDef=ReadOnlyReflection.Member(bird,"ContentPackDef");var pack=packDef==null?null:ReadOnlyReflection.Member(packDef,"ContentPack") as IContentPack;
   var translation=pack?.Translation.Get("birdie."+local+".commonName");string name=translation?.HasValue()==true?translation.ToString():local;if(translation?.HasValue()!=true)limited.Add("birds-name-unavailable");
   string[]? seasons=null;var conditions=ReadOnlyReflection.Member(bird,"Conditions") as IList;
   if(conditions!=null){
    var values=new HashSet<string>(StringComparer.Ordinal);bool unknown=false;int c=0;
    foreach(var condition in conditions){
     if(++c>16){unknown=true;break;}
     var when=ReadOnlyReflection.Member(condition!,"When") as IDictionary;if(when==null){unknown=true;continue;}
     int w=0;bool hasSeason=false;
     foreach(DictionaryEntry q in when){
      if(++w>16){unknown=true;break;}
      if(q.Key is not string k||!k.Equals("Season",StringComparison.OrdinalIgnoreCase)||q.Value is not string v)continue;
      hasSeason=true;if(v.Length>256){unknown=true;continue;}
      foreach(var s in v.Split(',')){var clean=s.Trim().ToLowerInvariant();if(new[]{"spring","summer","fall","winter"}.Contains(clean))values.Add(clean);else unknown=true;}
     }
     // A variant without a plain Season condition may be available in any season.
     if(!hasSeason)unknown=true;
    }
    if(!unknown&&values.Count>0)seasons=values.OrderBy(x=>x,StringComparer.Ordinal).ToArray();
   }
   if(seasons==null)limited.Add("birds-seasons-unavailable");
   yield return new(id,name,found,Seasons:seasons);
  }
 }
 private IEnumerable<CollectionEntry?> Nature(){
  var type=ReadOnlyReflection.Type(registry,Mods[5]!,"1.3.4","NatureInTheValley.NatureInTheValleyEntry",out setState);if(type==null)yield break;
  var creatures=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Static(type,"staticCreatureData"));setState="ready";setTotal=creatures.Count;
  // CheckDonated(item) means eligible AND not donated, and uses currentLocation.
  // The mod's collection/query methods use this original persistent donation location.
  var location=Game1.getLocationFromName("NIVInnerInsec");if(location==null)limited.Add("nature-donation-unavailable");
  int n=0;foreach(DictionaryEntry pair in creatures){
   if(++n>CollectionLimits.Scan){limited.Add("nature-source-limit");yield break;}
   string key=pair.Key as string??throw new InvalidOperationException();var fields=pair.Value as IList??throw new InvalidOperationException();
   if(fields.Count<26)throw new InvalidOperationException();
   string id="(O)NatInValley.Creature."+key;bool found=Game1.player.modData.ContainsKey("NIVCaught"+key);
   bool? donated=location==null?null:location.modData.ContainsKey("NatureInTheValley/Donated/"+key);
   string name=ItemRegistry.GetData(id)?.DisplayName??fields[25] as string??key;
   string[]? seasons=null;if(fields[9] is string s&&s.Length is >0 and <=256){var values=s.Split(',').Select(v=>v.Trim().ToLowerInvariant()).Distinct().ToArray();if(values.Length<=4&&values.All(v=>new[]{"spring","summer","fall","winter"}.Contains(v)))seasons=values;}
   if(seasons==null)limited.Add("nature-seasons-unavailable");
   yield return new(id,name,found,donated,seasons);
  }
 }
 private IEnumerable<CollectionEntry?> Aquarium(){
  var type=ReadOnlyReflection.Type(registry,Mods[6]!,"2.3.0","StardewAquarium.Framework.Utils",out setState);if(type==null)yield break;
  var map=ReadOnlyReflection.Dictionary(ReadOnlyReflection.Static(type,"InternalNameToDonationName"));setState="ready";
  // FishIDs appends on every SaveLoaded in 2.3.0; never use its potentially duplicate count.
  setTotal=null;limited.Add("aquarium-total-unknown");
  donationCount=0;int n=0;foreach(var flag in Game1.MasterPlayer.mailReceived){if(++n>CollectionLimits.Scan){limited.Add("aquarium-mail-limit");break;}if(flag.StartsWith("AquariumDonated:",StringComparison.Ordinal))donationCount++;yield return null;}
  int matched=0;n=0;foreach(var pair in Game1.objectData){
   if(++n>CollectionLimits.Scan){limited.Add("aquarium-source-limit");break;}
   if(pair.Value.Category!=-4||!map.Contains(pair.Value.Name)){yield return null;continue;}
   string donation=map[pair.Value.Name] as string??throw new InvalidOperationException();bool donated=Game1.MasterPlayer.mailReceived.Contains("AquariumDonated:"+donation);if(donated)matched++;
   string qid="(O)"+pair.Key;yield return new(qid,ItemRegistry.GetData(qid)?.DisplayName??pair.Value.Name,Game1.player.fishCaught.ContainsKey(qid),donated);
  }
  if(matched<donationCount)limited.Add("aquarium-donation-unmatched");
 }
}

