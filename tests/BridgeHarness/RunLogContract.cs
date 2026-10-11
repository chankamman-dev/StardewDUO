using StardewThor.Bridge;
// Persistent run log: lines reach disk, files roll at 1 MB and at most five are kept, periodic reports
// run on the writer thread, and PerfStats hands over each long frame exactly once.
internal static class RunLogContract
{
    public static async Task Run()
    {
        int n=0;void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
        var dir=Path.Combine(Path.GetTempPath(),"stardewds-runlog-"+Guid.NewGuid().ToString("N"));
        try{
            using(var log=new RunLog(dir)){
                log.Write("start","fixture");log.Flush();
                var first=Directory.GetFiles(dir,"run-*.log");Check(first.Length==1&&File.ReadAllText(first[0]).Contains(" start fixture"),"a line reaches disk on flush");
                log.Write("crumb","two\nlines");log.Flush();Check(File.ReadAllText(first[0]).Contains("crumb two lines"),"one entry stays one line");
                int reports=0;log.Every(TimeSpan.FromMilliseconds(10),()=>{reports++;return "report "+reports;});
                await Task.Delay(2600);Check(reports>=1&&File.ReadAllText(Directory.GetFiles(dir,"run-*.log").OrderBy(f=>f).Last()).Contains(" perf report "),"reports run on the writer thread");
                var big=new string('x',200*1024);
                for(int i=0;i<40;i++){log.Write("fill",big);if(i%4==3){log.Flush();await Task.Delay(5);}}
                log.Flush();
                var files=Directory.GetFiles(dir,"run-*.log");
                Check(files.Length<=RunLog.KeepFiles&&files.Length>=3,"rolls at the size limit and keeps at most five files ("+files.Length+")");
                Check(files.All(f=>new FileInfo(f).Length<=RunLog.FileBytes+big.Length+200),"no file grows far past the limit");
            }
            var perf=new PerfStats();long cursor=0;
            perf.Frame();perf.Add("collect",9);Thread.Sleep(40);perf.Frame();perf.Frame();
            var slow=perf.LongFramesSince(ref cursor,33);Check(slow.Length==1&&slow[0].Bridge.ContainsKey("collect"),"a long frame is reported with the bridge's share");
            Check(perf.LongFramesSince(ref cursor,33).Length==0,"each long frame is reported once");
            Check(perf.Report().Contains("\"frame\""),"minute report is one JSON line");
        }finally{try{Directory.Delete(dir,true);}catch{}}
        Console.WriteLine(n+" run log checks passed");
    }
}
