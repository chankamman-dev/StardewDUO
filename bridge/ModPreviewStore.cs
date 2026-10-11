using System.Buffers.Binary;
using System.Text.Json;

namespace StardewThor.Bridge;

// Local files from registered mod directories only. Read on the HTTP worker, never the game thread.
// No texture loading, callbacks, network downloads or ongoing collection. One bounded cached lookup.
public sealed class ModPreviewStore {
    private readonly object gate = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,string> roots = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string,string> cache = new(StringComparer.OrdinalIgnoreCase);
    private int bytes;
    public void Register(string id, string directory) {
        if (!ModManagementRules.ValidId(id) || string.IsNullOrWhiteSpace(directory)) return;
        if(roots.Count<1024) roots.TryAdd(id,directory);
    }
    public static bool TryRoute(string path,out string id) {
        const string prefix="/v1/mod-preview/";
        id=path.StartsWith(prefix,StringComparison.Ordinal)?path[prefix.Length..]:"";
        return ModManagementRules.ValidId(id);
    }
    public string Read(string id) {
        lock(gate) {
            if(cache.TryGetValue(id,out var saved)) return saved;
            if(!roots.TryGetValue(id,out var root)) return "{\"state\":\"unavailable\"}";
            string result="{\"state\":\"unavailable\"}";
            try {
                if((File.GetAttributes(root)&FileAttributes.ReparsePoint)!=0) return result;
                string full=Path.GetFullPath(root)+Path.DirectorySeparatorChar;
                var queue=new Queue<(string Path,int Depth,bool Portrait)>();queue.Enqueue((root,0,Path.GetFileName(root).Contains("portrait",StringComparison.OrdinalIgnoreCase)));
                int count=0; string? portrait=null;
                while(queue.Count>0 && count<256) {
                    var dir=queue.Dequeue();
                    foreach(var file in Directory.EnumerateFileSystemEntries(dir.Path)) {
                        if(++count>256) break;
                        if(!Path.GetFullPath(file).StartsWith(full,StringComparison.Ordinal) || (File.GetAttributes(file)&FileAttributes.ReparsePoint)!=0) continue;
                        var name=Path.GetFileName(file).ToLowerInvariant();
                        if(Directory.Exists(file)) {
                            bool isPortrait=name is "portrait" or "portraits";
                            if(dir.Depth<3 && (isPortrait || name is "assets" or "images" or "guidebook")) queue.Enqueue((file,dir.Depth+1,dir.Portrait||isPortrait));
                        } else if(name.EndsWith(".png") && name is "preview.png" or "thumbnail.png" or "logo.png") {
                            var image=Load(file);if(image!=null){result=Document(image,false);queue.Clear();portrait=null;goto Finished;}
                        } else if(name.EndsWith(".png") && (dir.Portrait || name.Contains("portrait"))) portrait??=file;
                    }
                }
                if(portrait!=null && Load(portrait) is { } face) result=Document(face,true);
            } catch { /* Explicit fallback; no filesystem details or configuration values are exposed. */ }
            Finished:
            if(cache.Count<1024 && bytes+result.Length<=8*1024*1024){cache[id]=result;bytes+=result.Length;}
            return result;
        }
    }
    private static string Document(byte[] png,bool portrait) => JsonSerializer.Serialize(new {state="ready",image="data:image/png;base64,"+Convert.ToBase64String(png),portrait},BridgeServer.Json);
    private static byte[]? Load(string path) {
        using var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite);
        if(file.Length<33 || file.Length>256*1024)return null;
        byte[] png=new byte[(int)file.Length];int offset=0,n;while(offset<png.Length && (n=file.Read(png,offset,png.Length-offset))>0)offset+=n;if(offset!=png.Length)return null;
        if(!png.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) || !png.AsSpan(12,4).SequenceEqual(new byte[]{73,72,68,82}))return null;
        uint w=BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(16,4)),h=BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(20,4));
        return w>0 && h>0 && w<=4096 && h<=4096 && (long)w*h<=4*1024*1024 ? png : null;
    }
}
