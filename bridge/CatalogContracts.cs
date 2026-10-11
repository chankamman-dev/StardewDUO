using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace StardewThor.Bridge;
public record CatalogIngredient(string Id,int Count);
public record CatalogRecipe(string Kind,CatalogIngredient[] Ingredients);
public record CatalogItem(string Id,string Name,string Description,string Category,int CategoryId,int? Price,string? Icon,string Type,string? Mod,bool Edible,CatalogRecipe? Recipe);
public record CatalogBirthday(string Season,int Day);
public record CatalogGifts(string[] Love,string[] Like,string[] Neutral,string[] Dislike,string[] Hate);
public record CatalogRelation(string Id,string Kind);
public record CatalogPerson(string Id,string Name,CatalogBirthday? Birthday,string SocialTab,bool CanSocialize,bool Datable,string? Portrait,string HomeRegion,string? Mod,CatalogGifts Gifts,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] CatalogRelation[]? Relations=null);
public record CatalogBuildProgress(int Done,int Total);
public record CatalogIndex(string Kind,long Version,string Language,string State,object[] Entries,string[] Limited,CatalogBuildProgress? Progress=null);
public record CatalogPage(string Kind,long Version,string Language,int Page,int Pages,int Total,string State,object[] Entries,string[] Limited,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] CatalogBuildProgress? Progress=null,
    [property:JsonIgnore(Condition=JsonIgnoreCondition.WhenWritingNull)] string[]? Digests=null);
// All rows are immutable DTOs. Listener-only page serialization never reaches the game.
public sealed class CatalogDirectory {
 public const int PageSize=100,MaxItems=8192,MaxPeople=512,MaxPage=81,EntryBudget=3500,PageBudget=384*1024,MetadataBudget=16*1024*1024;
 private CatalogIndex current;private CatalogIndex? cached;
 private static string[] Digests(CatalogIndex data,int pages)=>Enumerable.Range(0,pages).Select(p=>Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(data.Entries.Skip(p*PageSize).Take(PageSize).ToArray(),BridgeServer.Json)))[..16]).ToArray();private readonly BoundedCache<int,string> bodies=new(8);private long requested;
 public CatalogDirectory(string kind){if(kind is not "items" and not "people")throw new ArgumentException(nameof(kind));current=new(kind,1,"","building",Array.Empty<object>(),Array.Empty<string>(),new(0,0));}
 public bool Wanted=>Interlocked.Read(ref requested) is var at&&at!=0&&BridgeServer.Age(at)<5000;
 public void Publish(CatalogIndex value){var old=Volatile.Read(ref current);
  // Never a placeholder over good data: a rebuild in the same language keeps the ready catalogue
  // published until it has finished (then its result replaces it, or nothing changes).
  if(value.State=="building"&&old.State=="ready"&&old.Language==value.Language)return;
  Volatile.Write(ref current,value);}
 // Revision moves only when the rows do: its key is the state, language, notes and the page digests
 // (each page serialized alone, never the whole multi-megabyte catalogue as one string). A rebuild
 // that yields the same rows, as an asset refresh usually does, is no change for readers; build
 // progress steps are not announced. An open stream that wants it renews the lease with Touch().
 private readonly object gate=new();private CatalogIndex? keyed;private string key="";private long revision;
 public long Revision{get{var v=Volatile.Read(ref current);if(ReferenceEquals(v,Volatile.Read(ref keyed)))return Interlocked.Read(ref revision);
  lock(gate){if(ReferenceEquals(v,keyed))return revision;var was=keyed;
   if(!(v.State=="building"&&was?.State=="building"&&was.Language==v.Language)){var next=v.State+"|"+v.Language+"|"+string.Join(",",v.Limited)+"|"+(v.State=="ready"?string.Concat(PageDigests(v)):"");if(next!=key){key=next;Interlocked.Increment(ref revision);}}
   Volatile.Write(ref keyed,v);return revision;}}}
 private CatalogIndex? digestFor;private string[] digestList=Array.Empty<string>();
 private string[] PageDigests(CatalogIndex data){lock(gate){if(!ReferenceEquals(digestFor,data)){digestList=Digests(data,(data.Entries.Length+PageSize-1)/PageSize);digestFor=data;}return digestList;}}
 public void Touch()=>Interlocked.Exchange(ref requested,Stopwatch.GetTimestamp());
 public static bool TryRoute(string path,out string kind,out int page){kind="";page=0;const string prefix="/v1/catalog/";if(!path.StartsWith(prefix,StringComparison.Ordinal))return false;var tail=path[prefix.Length..].Split('?');if(tail.Length>2||tail[0] is not "items" and not "people")return false;kind=tail[0];if(tail.Length==1)return true;var q=tail[1];if(!q.StartsWith("page=",StringComparison.Ordinal))return false;var n=q[5..];return n.Length is >0 and <=2&&(n.Length==1||n[0]!='0')&&n.All(c=>c is >= '0' and <= '9')&&int.TryParse(n,out page)&&page<=(kind=="people"?5:MaxPage);}
 public string Read(int page){if(page<0||page>(current.Kind=="people"?5:MaxPage))throw new ArgumentOutOfRangeException(nameof(page));Interlocked.Exchange(ref requested,Stopwatch.GetTimestamp());var data=Volatile.Read(ref current);if(!ReferenceEquals(cached,data)){cached=data;bodies.Clear();}if(bodies.TryGetValue(page,out var body))return body;var pages=(data.Entries.Length+99)/100;var state=data.State=="ready"&&page>=Math.Max(1,pages)?"out-of-range":data.State;var entries=state=="ready"?data.Entries.Skip(page*100).Take(100).ToArray():Array.Empty<object>();// Page 0 carries a short digest of every page: a reader with the previous version keeps the pages
  // whose rows did not change and reads only the others.
  var result=new CatalogPage(data.Kind,data.Version,data.Language,page,pages,data.Entries.Length,state,entries,data.Limited,data.Progress,page==0&&state=="ready"?PageDigests(data):null);body=JsonSerializer.Serialize(result,BridgeServer.Json);if(Encoding.UTF8.GetByteCount(body)>PageBudget)body=JsonSerializer.Serialize(result with{State="unsupported",Entries=Array.Empty<object>(),Limited=new[]{"response-bytes"}},BridgeServer.Json);return bodies[page]=body;}
}
