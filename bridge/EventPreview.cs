using System.Text.RegularExpressions;

namespace StardewThor.Bridge;

public record EventDialogue(string? Npc, string Text);

// A bounded, display-only excerpt from an already loaded script. No event commands or
// translation/condition evaluators are called. Unresolved keys and control-only text stay unknown.
public static class EventPreview {
    public const int ScriptLimit=32768, CommandLimit=128, TextLimit=160;
    public static EventDialogue[] Read(string? script) {
        if(string.IsNullOrEmpty(script)||script.Length>ScriptLimit)return Array.Empty<EventDialogue>();
        var lines=new List<EventDialogue>();int start=0,commands=0;bool quoted=false,escaped=false;
        for(int i=0;i<=script.Length&&commands<CommandLimit;i++){
            if(i<script.Length){char c=script[i];if(escaped){escaped=false;continue;}if(c=='\\'){escaped=true;continue;}if(c=='"'){quoted=!quoted;continue;}if(c!='/'||quoted)continue;}
            if(quoted)break;
            var line=Dialogue(script[start..i]);start=i+1;commands++;
            if(line!=null&&!lines.Any(v=>v.Text==line.Text)){lines.Add(line);if(lines.Count==3)break;}
        }
        return lines.ToArray();
    }
    private static EventDialogue? Dialogue(string command){
        var m=Regex.Match(command.Trim(),"^(speak)\\s+([A-Za-z0-9_.?+-]{1,160})\\s+\"([^\"]*)\"\\s*$|^(message)\\s+\"([^\"]*)\"\\s*$",RegexOptions.CultureInvariant);
        if(!m.Success)return null;
        string? npc=m.Groups[1].Success?m.Groups[2].Value.TrimEnd('?'):null;
        string text=m.Groups[1].Success?m.Groups[3].Value:m.Groups[5].Value;
        if(text.Contains("{{")||text.Contains("}}")||text.Contains("Strings\\",StringComparison.OrdinalIgnoreCase)||text.Contains("Strings/",StringComparison.OrdinalIgnoreCase)||text.Contains('$')&&Regex.IsMatch(text,@"\$[qry]\b"))return null;
        text=Regex.Replace(text,@"\$[A-Za-z0-9]+","");
        text=Regex.Replace(text.Replace("#$b#"," ").Replace("#$e#"," "),@"[#\r\n\t]+"," ");
        text=Regex.Replace(text,@"\s+"," ").Trim();
        if(text.Length<4||Regex.IsMatch(text,@"^[A-Za-z0-9_.:/\\{}%-]+$"))return null;
        if(text.Length>TextLimit){int length=TextLimit-1;if(char.IsHighSurrogate(text[length-1]))length--;text=text[..length]+"…";}
        return new(npc,text);
    }
}
