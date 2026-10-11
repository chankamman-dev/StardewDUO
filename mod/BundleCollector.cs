using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Locations;

namespace StardewThor.ReadOnly;
internal sealed class BundleCollector {
    internal DemandDocument Document{get;}=new(new BundleReport("building",1,"",Array.Empty<BundleRoom>(),Array.Empty<string>()));
    private readonly int owner=Environment.CurrentManagedThreadId;
    private IEnumerator<KeyValuePair<string,string>>? source;
    private CommunityCenter? center;
    private readonly Dictionary<string,List<BundleEntry>> rooms=new(StringComparer.Ordinal);
    private readonly HashSet<string> limited=new();
    private readonly HashSet<int> ids=new();
    private IncrementalHash? hash;
    private long version=1,refreshed;
    private string language="",last="",publishedState="building";
    private int count,bytes,scanned;
    private IEnumerator<KeyValuePair<string,string>>? nameSource;
    private readonly Dictionary<string,string> names=new(StringComparer.Ordinal);
    private bool namesReady,namesLimited;
    private int namesScanned;
    internal bool NeedsWork=>Document.Wanted&&(source!=null||refreshed==0||BridgeServer.Age(refreshed)>=2000);
    private void CheckThread(){if(owner!=Environment.CurrentManagedThreadId)throw new InvalidOperationException("Game thread required");}
    internal void Invalidate(string lang){CheckThread();source?.Dispose();source=null;hash?.Dispose();hash=null;nameSource?.Dispose();nameSource=null;names.Clear();namesReady=namesLimited=false;namesScanned=0;version++;refreshed=0;last="";language=lang;publishedState="";Publish("building");}
    private void Publish(string state){if(state==publishedState)return;publishedState=state;Document.Publish(new BundleReport(state,++version,language,Array.Empty<BundleRoom>(),Array.Empty<string>()));}
    internal void Tick(string lang){
        CheckThread();if(language!=lang)Invalidate(lang);if(!Document.Wanted)return;
        if(!Context.IsWorldReady){Close();Publish("unavailable");refreshed=0;return;}
        if(Game1.MasterPlayer.mailReceived.Contains("JojaMember")){Close();Publish("joja");refreshed=0;return;}
        if(source==null&&refreshed!=0&&BridgeServer.Age(refreshed)<2000)return;
        try {
            if(source==null){
                center=Game1.locations.OfType<CommunityCenter>().FirstOrDefault();if(center==null){Publish("unavailable");refreshed=Stopwatch.GetTimestamp();return;}
                var world=Game1.netWorldState.Value;
                var raw=world.GetType().GetField("netBundleData",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic)?.GetValue(world);
                if(raw?.GetType().GetProperty("Length")?.GetValue(raw) is not int length)throw new InvalidOperationException("Bundle state layout");
                // BundleData initializes net state when empty. Don't trigger that setter from a reader.
                if(length==0){Publish("building");refreshed=Stopwatch.GetTimestamp();return;}
                if(!namesReady){ReadNames();return;}
                source=world.BundleData.GetEnumerator();rooms.Clear();limited.Clear();if(namesLimited)limited.Add("bundle-name-source-limit");ids.Clear();count=bytes=scanned=0;hash=IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            }
            long start=Stopwatch.GetTimestamp();int work=0;
            while(work++<16&&BridgeServer.Age(start)<1.5){
                if(!source.MoveNext()){Finish();return;}
                if(++scanned>512){limited.Add("bundle-scan-limit");Finish();return;}
                if(count>=BundleDataParser.MaxBundles){limited.Add("bundles-limit");Finish();return;}
                var pair=source.Current;if(pair.Key.Length>240){limited.Add("bundle-text-limit");continue;}
                string room=pair.Key.Split('/')[0];if(room.Length==0||room.Length>160){limited.Add("bundle-room-invalid");continue;}
                if(!rooms.ContainsKey(room)&&rooms.Count>=BundleDataParser.MaxRooms){limited.Add("bundle-rooms-limit");continue;}
                var key=pair.Key.Split('/');bool[]? donated=null;
                if(key.Length==2&&int.TryParse(key[1],out int id))center!.bundles.TryGetValue(id,out donated);
                var bundle=BundleDataParser.Parse(pair.Key,pair.Value,donated,limited);if(bundle==null)continue;
                var fields=pair.Value.Split('/');string name=names.TryGetValue(fields[0],out var localized)?localized:Game1.content.LoadStringReturnNullIfNotFound("Strings\\BundleNames:"+fields[0])??fields[0];
                if(name.Length>240){name=name[..240];limited.Add("bundle-text-limit");}names[fields[0]]=name;bundle=bundle with{Name=name};
                var data=JsonSerializer.SerializeToUtf8Bytes(bundle,BridgeServer.Json);
                if(bytes+data.Length>Document.Budget-65536){limited.Add("response-bytes");continue;}
                if(!rooms.TryGetValue(room,out var rows))rooms[room]=rows=new();
                if(!ids.Add(bundle.Id)){limited.Add("bundle-id-duplicate");continue;}
                rows.Add(bundle);bytes+=data.Length;count++;hash!.AppendData(System.Text.Encoding.UTF8.GetBytes(room));hash.AppendData(data);
            }
        } catch {Close();version++;Publish("unsupported");refreshed=Stopwatch.GetTimestamp();}
    }
    // Match the game's display-name algorithm, sliced and cached by language/assets. This asset
    // supplies names only; room/ingredients/rewards still come exclusively from runtime BundleData.
    private void ReadNames(){
        nameSource??=DataLoader.Bundles(Game1.content).GetEnumerator();long start=Stopwatch.GetTimestamp();int work=0;
        while(work++<8&&BridgeServer.Age(start)<1.5){
            if(!nameSource.MoveNext()){nameSource.Dispose();nameSource=null;namesReady=true;return;}
            if(++namesScanned>512){namesLimited=true;nameSource.Dispose();nameSource=null;namesReady=true;return;}
            string value=nameSource.Current.Value;if(value.Length>12000){namesLimited=true;continue;}var fields=value.Split('/');
            if(fields.Length>6&&fields[0].Length<=240&&!names.ContainsKey(fields[0]))names[fields[0]]=fields[6];
        }
    }
    private void Close(){source?.Dispose();source=null;hash?.Dispose();hash=null;}
    private void Finish(){
        var result=new List<BundleRoom>();
        foreach(var room in rooms){string name=room.Key;int number=CommunityCenter.getAreaNumberFromName(room.Key);if(number>=0)try{name=CommunityCenter.getAreaDisplayNameFromNumber(number);}catch{limited.Add("bundle-room-name-unknown");}
            if(name.Length>240){name=name[..240];limited.Add("bundle-text-limit");}result.Add(new(room.Key,name,room.Value.ToArray()));}
        string fingerprint=Convert.ToHexString(hash!.GetHashAndReset())+language+string.Join(',',limited.OrderBy(s=>s));Close();refreshed=Stopwatch.GetTimestamp();
        if(last==fingerprint&&publishedState=="ready")return;last=fingerprint;publishedState="ready";Document.Publish(new BundleReport("ready",++version,language,result.ToArray(),limited.OrderBy(s=>s).ToArray()));
    }
}
