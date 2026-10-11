using StardewThor.Bridge;

static class EventPreviewContract {
    public static void Run(){
        int count=0;void Check(bool ok,string name){if(!ok)throw new Exception(name);count++;}
        var lines=EventPreview.Read("music/1 2/farmer 1 2 3/speak Alex \"我想成为职业运动员。$h#$b#那是我的梦想。\"/message \"你们聊了很久。\"/end");
        Check(lines.Length==2&&lines[0].Npc=="Alex"&&lines[0].Text=="我想成为职业运动员。 那是我的梦想。"&&lines[1].Npc==null,"localized literal dialogue and narration without control codes");
        Check(EventPreview.Read("speak Alex \"We could go north/south tomorrow.\"/end").Single().Text.Contains("north/south"),"slash within dialogue remains a single command");
        Check(EventPreview.Read("speak Alex \"{{i18n:event.1}}\"/speak Alex \"Strings\\Characters:Alex.1\"/end").Length==0,"unresolved localization stays unknown");
        Check(EventPreview.Read("speak Alex \"Question $q 1 2#choice\"/end").Length==0,"branch dialogue is not presented as a fixed excerpt");
        Check(EventPreview.Read("speak Alex \"unterminated/end").Length==0,"malformed quote ignored");
        Check(EventPreview.Read(new string('x',EventPreview.ScriptLimit+1)).Length==0,"script size bounded");
        Check(EventPreview.Read(string.Join('/',Enumerable.Repeat("pause 1",EventPreview.CommandLimit))+"/message \"Too far away.\"").Length==0,"command scan bounded");
        Check(EventPreview.Read(string.Join('/',Enumerable.Repeat("message \"Same dialogue.\"",5))).Length==1,"duplicate quotes ignored");
        Check(EventPreview.Read(string.Join('/',Enumerable.Range(0,8).Select(n=>$"message \"A different line {n}.\""))).Length==3,"three quote output bound");
        Check(EventPreview.Read("message \""+new string('中',300)+"\"").Single().Text.Length==EventPreview.TextLimit,"excerpt length bounded");
        Check(EventPreview.Read("removeItem 24/addQuest 1/changeLocation Town/end").Length==0,"commands produce no invented story and are never executed");
        Console.WriteLine($"{count} bounded display-only event preview checks passed");
    }
}
