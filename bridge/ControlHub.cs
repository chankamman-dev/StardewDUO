using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace StardewThor.Bridge;

public record Command(string Id, long Order, string Session, long Revision, string Action, int From = -1, int To = -1, int Amount = 0, string? SourceKey = null, string? TargetKey = null, string? RecipeId = null, string? BoardKey = null, bool? ToolbarHidden = null, string? QuestKey = null, [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? ModId = null,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? ConfigToken = null,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] ModConfigChange[]? ConfigChanges = null);
public record Receipt(string Id, string State, string Code, long Revision = -1);
public record ControlState(bool Enabled, string Reason, int ActiveSlot,bool EmptySelection=false,bool Crafting=false,bool QuestBoard=false,bool Toolbar=false,bool ToolbarHidden=false,bool QuestRewards=false,bool Chest=false,bool ModConfig=false);
// Network enqueue only; a single game-thread consumer owns all item operations.
public sealed class ControlHub {
    private readonly string secret;
    private readonly object gate = new();
    private readonly Queue<(Command Command,long At)> pending = new();
    private readonly Dictionary<string,(string Body,Receipt Result)> receipts = new();
    private readonly Queue<string> history = new();
    private long highestOrder;
    public ControlHub(string secret) { if(secret.Length!=64)throw new ArgumentException("256-bit key required");this.secret=secret; }
    public bool Authorize(string? value) => value is {Length:64} && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(secret),Encoding.UTF8.GetBytes(value));
    public Receipt Submit(string body) {
        // Reject ambiguous schemas and byte oversize before deserializing arbitrary
        // values. The same rules apply to every action, not only the mod editor.
        if(body==null||Encoding.UTF8.GetByteCount(body)>2048)return new("","rejected","invalid");
        try{using var document=JsonDocument.Parse(body);if(document.RootElement.ValueKind!=JsonValueKind.Object)return new("","rejected","invalid");
            var allowed=new HashSet<string>{"id","order","session","revision","action","from","to","amount","sourceKey","targetKey","recipeId","boardKey","toolbarHidden","questKey","modId","configToken","configChanges"};var seen=new HashSet<string>();
            if(document.RootElement.EnumerateObject().Any(p=>!allowed.Contains(p.Name)||!seen.Add(p.Name))||!new[]{"id","order","session","revision","action"}.All(seen.Contains))return new("","rejected","invalid");
        }catch{return new("","rejected","invalid");}
        Command? c;try{c=JsonSerializer.Deserialize<Command>(body,BridgeServer.Json);}catch{return new("","rejected","invalid");}
        if(c==null||body.Length>2048||!Guid.TryParseExact(c.Id,"N",out _)||c.Session is null||c.Session.Length>64||c.Order<1||c.Revision<0||c.RecipeId?.Length>160||c.BoardKey?.Length>64||c.QuestKey?.Length>64||c.Action is not ("select" or "move" or "sort" or "trash" or "drop" or "craft" or "accept-quest" or "set-toolbar" or "claim-quest" or "chest-take" or "chest-put" or "open-mod-config" or "save-mod-config"))return new(c?.Id??"","rejected","invalid");
        if(c.Action=="open-mod-config") {
            if(!ModManagementRules.ValidId(c.ModId))return new(c.Id,"rejected","invalid");
            using var document=JsonDocument.Parse(body);
            var allowed=new HashSet<string>{"id","order","session","revision","action","modId"};
            var seen=new HashSet<string>();
            if(document.RootElement.EnumerateObject().Any(p=>!allowed.Contains(p.Name)||!seen.Add(p.Name)))return new(c.Id,"rejected","invalid");
        }else if(c.Action=="save-mod-config") {
            if(!ModManagementRules.ValidId(c.ModId)||c.ConfigToken is not {Length:64}||c.ConfigToken.Any(ch=>!Uri.IsHexDigit(ch))||c.ConfigChanges is not {Length:>0 and <=12})return new(c.Id,"rejected","invalid");
            using var document=JsonDocument.Parse(body);
            var allowed=new HashSet<string>{"id","order","session","revision","action","modId","configToken","configChanges"};var seen=new HashSet<string>();
            if(document.RootElement.EnumerateObject().Any(p=>!allowed.Contains(p.Name)||!seen.Add(p.Name)))return new(c.Id,"rejected","invalid");
            var keys=new HashSet<string>();
            foreach(var change in document.RootElement.GetProperty("configChanges").EnumerateArray()) {
                if(change.ValueKind!=JsonValueKind.Object)return new(c.Id,"rejected","invalid");
                var fields=change.EnumerateObject().ToArray();
                if(fields.Length!=2||!fields.Any(p=>p.Name=="key")||!fields.Any(p=>p.Name=="value"))return new(c.Id,"rejected","invalid");
            }
            if(c.ConfigChanges.Any(ch=>ch==null||ch.Key==null||ch.Key.Length>3||!int.TryParse(ch.Key,out int n)||n<0||n>=128||!keys.Add(ch.Key)||ch.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)))return new(c.Id,"rejected","invalid");
        }else if(c.ModId!=null)return new(c.Id,"rejected","invalid");
        if(c.Action!="save-mod-config"&&(c.ConfigToken!=null||c.ConfigChanges!=null))return new(c.Id,"rejected","invalid");
        // Chest transfers: one whole stack between the open chest (TargetKey = chest identity) and the backpack.
        if(c.Action is "chest-take" or "chest-put"){
            if(c.From<0||c.From>=200||c.To!=-1||c.Amount<1||c.Amount>999999||c.SourceKey is null||c.SourceKey.Length>64||c.TargetKey is null||c.TargetKey.Length>64||c.RecipeId!=null||c.BoardKey!=null||c.QuestKey!=null||c.ToolbarHidden!=null)return new(c.Id,"rejected","invalid");
        }
        if(c.Action=="claim-quest"){
            if(c.QuestKey is null||c.QuestKey.Length!=64||c.QuestKey.Any(ch=>!Uri.IsHexDigit(ch)))return new(c.Id,"rejected","quest-changed");
            if(c.From!=-1||c.To!=-1||c.Amount!=0||c.SourceKey!=null||c.TargetKey!=null||c.RecipeId!=null||c.BoardKey!=null||c.ToolbarHidden!=null)return new(c.Id,"rejected","invalid");
        }else if(c.QuestKey!=null)return new(c.Id,"rejected","invalid");
        if(c.Action=="set-toolbar"){
            if(c.ToolbarHidden==null||c.From!=-1||c.To!=-1||c.Amount!=0||c.SourceKey!=null||c.TargetKey!=null||c.RecipeId!=null||c.BoardKey!=null)return new(c.Id,"rejected","invalid");
        }else if(c.ToolbarHidden!=null)return new(c.Id,"rejected","invalid");
        if(c.Action=="accept-quest"){
            if(c.BoardKey is null||c.BoardKey.Length!=64||c.BoardKey.Any(ch=>!Uri.IsHexDigit(ch)))return new(c.Id,"rejected","board-changed");
            if(c.From!=-1||c.To!=-1||c.Amount!=0||c.SourceKey!=null||c.TargetKey!=null||c.RecipeId!=null)return new(c.Id,"rejected","invalid");
        }else if(c.BoardKey!=null)return new(c.Id,"rejected","invalid");
        if(c.Action=="craft"){
            if(c.Amount<1||c.Amount>99)return new(c.Id,"rejected","amount");
            if(string.IsNullOrWhiteSpace(c.RecipeId))return new(c.Id,"rejected","recipe-unknown");
            if(c.From!=-1||c.To!=-1||c.SourceKey!=null||c.TargetKey!=null)return new(c.Id,"rejected","invalid");
        }else if(c.RecipeId!=null)return new(c.Id,"rejected","invalid");
        lock(gate){
            if(receipts.TryGetValue(c.Id,out var old))return old.Body==body?old.Result:new(c.Id,"rejected","id-conflict");
            if(c.Order<=highestOrder)return new(c.Id,"rejected","replay");
            if(pending.Count>=8)return new(c.Id,"rejected","busy");
            highestOrder=c.Order;var result=new Receipt(c.Id,"queued","queued");
            receipts.Add(c.Id,(body,result));history.Enqueue(c.Id);pending.Enqueue((c,Stopwatch.GetTimestamp()));
            while(history.Count>256)receipts.Remove(history.Dequeue());return result;
        }
    }
    public Receipt? Get(string id){lock(gate)return receipts.TryGetValue(id,out var r)?r.Result:null;}
    public bool TryTake(out Command? command){
        lock(gate){while(pending.Count>0){var (c,at)=pending.Dequeue();if(BridgeServer.Age(at)>2000){Complete(new(c.Id,"rejected","expired"));continue;}command=c;return true;}}
        command=null;return false;
    }
    public void Complete(Receipt result){lock(gate){if(receipts.TryGetValue(result.Id,out var r))receipts[result.Id]=(r.Body,result);}}
}
