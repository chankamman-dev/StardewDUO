using System.Globalization;

namespace StardewThor.Bridge;
public record BundleItem(string? Id,int? Category,string? Currency,int Count,int Quality,bool? Donated);
public record BundleReward(string Raw,string State,BundleItem[] Items);
public record BundleEntry(int Id,string Name,int Required,bool? Complete,BundleItem[] Items,BundleReward Reward);
public record BundleRoom(string Id,string Name,BundleEntry[] Bundles);
public record BundleReport(string State,long Version,string Language,BundleRoom[] Rooms,string[] Limited);

// Pure parsing of the runtime BundleData. Never constructs native menus, items or reward queries.
public static class BundleDataParser {
    public const int MaxBundles=128,MaxRooms=16,MaxItems=32;
    private static string[] Tokens(string raw)=>raw.Split(' ',StringSplitOptions.RemoveEmptyEntries);
    private static bool Number(string text,out int n)=>int.TryParse(text,NumberStyles.Integer,CultureInfo.InvariantCulture,out n);
    public static BundleEntry? Parse(string key,string raw,bool[]? donated,ISet<string> limited) {
        if(key.Length>240||raw.Length>12000){limited.Add("bundle-text-limit");return null;}
        var parts=key.Split('/');var data=raw.Split('/');
        if(parts.Length!=2||!Number(parts[1],out int id)||id<0||data.Length<5){limited.Add("bundle-format");return null;}
        var tokens=Tokens(data[2]);if(tokens.Length%3!=0||tokens.Length==0){limited.Add("bundle-items-format");return null;}
        int count=tokens.Length/3;if(count>MaxItems){limited.Add("bundle-items-limit");return null;}
        var items=new List<BundleItem>();
        for(int i=0;i<count;i++) {
            var itemId=tokens[i*3];
            if(itemId.Length>160||!Number(tokens[i*3+1],out int stack)||stack<1||stack>1000000||!Number(tokens[i*3+2],out int quality)||quality<0||quality>1000000){limited.Add("bundle-item-invalid");return null;}
            bool? done=donated!=null&&i<donated.Length?donated[i]:null;if(done==null)limited.Add("bundle-status-unknown");
            int? category=Number(itemId,out int categoryId)&&categoryId<0?categoryId:null;
            string? qualified=category==null?Qualify(itemId,"O"):null;
            if(category==null&&qualified==null){limited.Add("bundle-item-unsupported");return null;}
            items.Add(new(qualified,category==-1?null:category,category==-1?"money":null,stack,quality,done));
        }
        int required=count;if(data[4].Length>0&&(!Number(data[4],out required)||required<1||required>count)){limited.Add("bundle-required-invalid");return null;}
        string name=data.Length>6&&!string.IsNullOrWhiteSpace(data[6])?data[6]:data[0];
        if(data.Length<=6)limited.Add("bundle-name-unknown");
        if(name.Length>240){name=name[..240];limited.Add("bundle-text-limit");}
        int doneCount=items.Count(i=>i.Donated==true);bool? complete=doneCount>=required?true:items.Any(i=>i.Donated==null)?null:false;
        return new(id,name,required,complete,items.ToArray(),Reward(data[1],limited));
    }
    private static string? Qualify(string id,string type) {
        if(id.Length==0||id.Length>160||id.Any(c=>char.IsControl(c)||char.IsWhiteSpace(c)))return null;
        if(id[0]=='(')return id.IndexOf(')') is var end&&end>1&&end<8&&end<id.Length-1?id:null;
        return $"({type}){id}";
    }
    private static BundleReward Reward(string raw,ISet<string> limited) {
        if(raw.Length>1000){limited.Add("bundle-reward-limit");return new(raw[..1000],"unsupported",Array.Empty<BundleItem>());}
        if(string.IsNullOrWhiteSpace(raw))return new(raw,"ready",Array.Empty<BundleItem>());
        var t=Tokens(raw);var list=new List<BundleItem>();
        if(t.Length%3==0&&t.Length<=48)for(int i=0;i<t.Length;i+=3){
            string type=t[i] switch{"O"=>"O","BO"=>"BC","W"=>"W","H"=>"H","F"=>"F",_=>""};
            string? id=type.Length>0?Qualify(t[i+1],type):null;
            if(id==null||!Number(t[i+2],out int count)||count<1||count>1000000)break;
            list.Add(new(id,null,null,count,0,null));
        }
        if(list.Count*3!=t.Length){limited.Add("bundle-reward-unsupported");return new(raw,"unsupported",Array.Empty<BundleItem>());}
        return new(raw,"ready",list.ToArray());
    }
}
