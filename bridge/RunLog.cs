using System.Collections.Concurrent;
using System.Text;
namespace StardewThor.Bridge;
// Persistent run log (architecture v2, phase 0). SMAPI-latest.txt is replaced on every launch, so a
// stall or crash is usually gone by the time anyone looks. This keeps rolling files in the mod's
// logs/ folder across launches. Callers (including the game thread) only enqueue a string; one
// background thread writes about once a second, and also pulls periodic reports (frame timing).
// Never write the pairing key, save contents or anything from the player's files here.
public sealed class RunLog : IDisposable {
    public const long FileBytes=1<<20;
    public const int KeepFiles=5,QueueLimit=4000;
    private readonly string dir;
    private readonly ConcurrentQueue<string> queue=new();
    private readonly List<(TimeSpan Every,Func<string?> Report,DateTime Next)> reports=new();
    private readonly Thread writer;
    private readonly ManualResetEventSlim wake=new(false);
    private volatile bool stopping;
    private string? current;
    private int dropped;
    public RunLog(string dir){
        this.dir=dir;Directory.CreateDirectory(dir);
        writer=new Thread(Run){IsBackground=true,Name="StardewDS run log",Priority=ThreadPriority.BelowNormal};writer.Start();
    }
    /// One line: "yyyy-MM-dd HH:mm:ss.fff kind text". Cheap enough for the game thread.
    public void Write(string kind,string text){
        if(queue.Count>=QueueLimit){Interlocked.Increment(ref dropped);return;}
        queue.Enqueue(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff")+" "+kind+" "+text.Replace('\n',' ').Replace('\r',' '));
    }
    /// A report the writer thread asks for on its own schedule (never on the game thread).
    public void Every(TimeSpan every,Func<string?> report){lock(reports)reports.Add((every,report,DateTime.Now+every));}
    /// Write everything queued now (process exit / unhandled exception); safe from any thread.
    public void Flush(){lock(queue)Drain();}
    private void Run(){
        while(!stopping){
            wake.Wait(1000);wake.Reset();
            try{
                lock(reports)for(int i=0;i<reports.Count;i++){var r=reports[i];if(DateTime.Now<r.Next)continue;reports[i]=(r.Every,r.Report,DateTime.Now+r.Every);
                    try{var line=r.Report();if(!string.IsNullOrEmpty(line))Write("perf",line);}catch(Exception e){Write("error","report "+e.GetType().Name);}}
                lock(queue)Drain();
            }catch{/* a failing disk must never reach the game */}
        }
    }
    private void Drain(){
        if(queue.IsEmpty&&dropped==0)return;
        var text=new StringBuilder();int lost=Interlocked.Exchange(ref dropped,0);
        if(current==null||!File.Exists(current))Rotate();else size=new FileInfo(current).Length;
        void Add(string line){int bytes=Encoding.UTF8.GetByteCount(line)+1;
            // Roll before a line that would take the file past the limit, not after the batch.
            if(size>0&&size+text.Length+bytes>FileBytes){File.AppendAllText(current!,text.ToString(),Encoding.UTF8);text.Clear();Rotate();}
            text.Append(line).Append('\n');}
        if(lost>0)Add(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff")+" log dropped "+lost+" lines (queue full)");
        while(queue.TryDequeue(out var line))Add(line);
        File.AppendAllText(current!,text.ToString(),Encoding.UTF8);size+=Encoding.UTF8.GetByteCount(text.ToString());
    }
    private long size;
    private void Rotate(){
        size=0;current=Path.Combine(dir,"run-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+".log");
        var old=Directory.GetFiles(dir,"run-*.log").OrderByDescending(f=>f,StringComparer.Ordinal).Skip(KeepFiles-1);
        foreach(var f in old)try{File.Delete(f);}catch{}
    }
    public void Dispose(){stopping=true;wake.Set();try{writer.Join(2000);}catch{}Flush();}
}
