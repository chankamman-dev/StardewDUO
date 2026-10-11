using System.Collections;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Monsters;
using StardewValley.Quests;

namespace StardewThor.ReadOnly;

// The daily Help Wanted board only. Never construct Billboard: its constructor marks
// the board read. Never read lazy Quest getters during collection or regenerate a quest.
internal static class QuestBoard
{
    private sealed class Identity { public readonly string Key=Guid.NewGuid().ToString("N"); }
    private static readonly ConditionalWeakTable<Quest,Identity> identities=new();
    public static QuestBoardState Collect()
    {
        var q=Game1.questOfTheDay;
        if(q==null)return Empty("empty","board-empty");
        try
        {
            if(!Native(q))return Empty("unavailable","board-unavailable");
            var data=Quest.GetRawQuestFields(q.id.Value);
            string Field(int i,string fallback)=>data?.Length>i&&!string.IsNullOrEmpty(data[i])?data[i]:fallback??"";
            string title=Field(1,q._questTitle),description=Field(2,q._questDescription),objective=Field(3,q._currentObjective);
            if(q.GetType().GetField("parts")?.GetValue(q) is IEnumerable fragments)
            {
                var parts=fragments.Cast<object>().OfType<DescriptionElement>().Take(33).ToArray();
                if(parts.Length>32)throw new InvalidOperationException("Board text limit");
                if(parts.Length>0)description=string.Concat(parts.Select(Text));
            }
            if(Net(q,"objective") is DescriptionElement nativeObjective)objective=Text(nativeObjective);
            string? target=Net(q,"target") as string;
            if(target is "null" or "")target=null;
            if(string.IsNullOrEmpty(title))title=Title(q,target);
            bool accepted=Game1.player.acceptedDailyQuest.Value||q.accepted.Value||Game1.player.questLog.Contains(q);
            // Game1.CanAcceptDailyQuest calls questDescription (which can initialize net
            // fields). The read-only equivalent uses the already prepared description.
            // The native RefreshQuestOfTheDay prepares these fields when posting a quest.
            bool ready=!q.destroy.Value&&!q.completed.Value&&!string.IsNullOrWhiteSpace(description)&&!string.IsNullOrWhiteSpace(objective)&&Initialized(q);
            string status=accepted?"accepted":ready?"available":"unavailable",reason=accepted?"board-accepted":ready?"ready":"board-unavailable";
            string reward=Limit(q.rewardDescription.Value,400);
            int gold=Net(q,"reward") is int offeredReward?Math.Max(q.moneyReward.Value,offeredReward):q.moneyReward.Value;
            var view=new QuestBoardState(status,null,Limit(title,180),Limit(description,2400),Limit(objective,400),target==null?null:Limit(target,160),Math.Clamp(gold,0,1000000000),reward,
                accepted?Math.Clamp(q.daysLeft.Value,0,9999):2,ready&&!accepted,reason);
            // Object identity prevents accepting a newly replaced but visually identical
            // offer. Day and the untruncated business fields prevent stale or edited offers.
            var identity=identities.GetOrCreateValue(q).Key;
            var payload=JsonSerializer.Serialize(new {identity,day=Game1.Date.TotalDays,type=q.GetType().FullName,id=q.id.Value,title,description,objective,target,
                money=q.moneyReward.Value,offered=Net(q,"reward"),reward=q.rewardDescription.Value,item=Net(q,"ItemId"),number=Net(q,"number"),fish=Net(q,"numberToFish"),monsters=Net(q,"numberToKill"),monster=Net(q,"monsterName"),ignoreFarmMonsters=Net(q,"ignoreFarmMonsters"),total=Net(q,"total"),people=q is SocializeQuest social?social.whoToGreet.Take(256).ToArray():null,ready},BridgeServer.Json);
            return view with{Key=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant()};
        }
        catch{return Empty("unavailable","board-unavailable");}
    }
    public static void Accept(Command command)
    {
        var q=Game1.questOfTheDay;var current=Collect();
        if(q==null)throw new CommandRejected("board-empty");
        if(current.Key==null||current.Key!=command.BoardKey)throw new CommandRejected("board-changed");
        if(!current.CanAccept)throw new CommandRejected(current.Reason);
        // This is the original acceptance predicate. It has no distance requirement.
        // It is only invoked for an explicit authenticated game-thread write command.
        if(!Game1.CanAcceptDailyQuest())throw new CommandRejected("board-unavailable");
        var checkedAgain=Collect();
        if(!ReferenceEquals(q,Game1.questOfTheDay)||checkedAgain.Key!=command.BoardKey)throw new CommandRejected("board-changed");
        if(!checkedAgain.CanAccept)throw new CommandRejected(checkedAgain.Reason);
        var farmer=Game1.player;
        bool daily=q.dailyQuest.Value,accepted=q.accepted.Value,cancel=q.canBeCancelled.Value,playerAccepted=farmer.acceptedDailyQuest.Value;
        int acceptedDay=q.dayQuestAccepted.Value,days=q.daysLeft.Value;
        try
        {
            // Mirrors Billboard.receiveLeftClick's original sequence on the SAME quest;
            // no generated copies, auto-completion, rewards, or automatic save calls.
            q.dailyQuest.Value=true;q.dayQuestAccepted.Value=Game1.Date.TotalDays;q.accepted.Value=true;q.canBeCancelled.Value=true;q.daysLeft.Value=2;
            farmer.questLog.Add(q);farmer.acceptedDailyQuest.Set(newValue:true);
        }
        catch
        {
            // Restore this operation's own fields/list after a native net callback failure.
            // External mod callbacks may have separate side effects and aren't transactional.
            farmer.questLog.Remove(q);q.dailyQuest.Value=daily;q.dayQuestAccepted.Value=acceptedDay;q.accepted.Value=accepted;q.canBeCancelled.Value=cancel;q.daysLeft.Value=days;farmer.acceptedDailyQuest.Set(playerAccepted);
            throw;
        }
    }
    private static bool Native(Quest q)=>q.GetType()==typeof(ItemDeliveryQuest)||q.GetType()==typeof(FishingQuest)||q.GetType()==typeof(ResourceCollectionQuest)||q.GetType()==typeof(SlayMonsterQuest)||q.GetType()==typeof(SocializeQuest);
    private static bool Initialized(Quest q)=>q switch {
        ItemDeliveryQuest d=>!string.IsNullOrEmpty(d.target.Value)&&!string.IsNullOrEmpty(d.ItemId.Value)&&d.number.Value>0,
        FishingQuest f=>!string.IsNullOrEmpty(f.target.Value)&&!string.IsNullOrEmpty(f.ItemId.Value)&&f.numberToFish.Value>0,
        ResourceCollectionQuest r=>!string.IsNullOrEmpty(r.target.Value)&&!string.IsNullOrEmpty(r.ItemId.Value)&&r.number.Value>0,
        SlayMonsterQuest s=>!string.IsNullOrEmpty(s.target.Value)&&!string.IsNullOrEmpty(s.monsterName.Value)&&s.numberToKill.Value>0,
        SocializeQuest s=>s.total.Value>0&&s.whoToGreet.Count is >0 and <=256,
        _=>false};
    private static string Title(Quest q,string? target)=>q switch {
        ItemDeliveryQuest=>Game1.content.LoadString("Strings\\1_6_Strings:ItemDeliveryQuestTitle",target==null?"???":NPC.GetDisplayName(target)),
        FishingQuest f=>Game1.content.LoadString("Strings\\1_6_Strings:FishingQuestTitle",ItemRegistry.GetDataOrErrorItem(f.ItemId.Value).DisplayName),
        ResourceCollectionQuest r=>Game1.content.LoadString("Strings\\1_6_Strings:ResourceQuestTitle",ItemRegistry.GetDataOrErrorItem(r.ItemId.Value).DisplayName),
        SlayMonsterQuest s=>Game1.content.LoadString("Strings\\1_6_Strings:MonsterQuestTitle",Monster.GetDisplayName(s.monsterName.Value)),
        SocializeQuest=>Game1.content.LoadString("Strings\\StringsFromCSFiles:SocializeQuest.cs.13785"),
        _=>""};
    private static object? Net(Quest q,string field){var v=q.GetType().GetField(field)?.GetValue(q);return v?.GetType().GetProperty("Value")?.GetValue(v);}
    private static string Text(DescriptionElement part)
    {
        int left=64;
        void Check(DescriptionElement e,int depth)
        {
            if(depth>4||--left<0||e.GetType()!=typeof(DescriptionElement)||e.translationKey?.Length>4000||e.substitutions.Count>16)throw new InvalidOperationException("Board text limit");
            foreach(var v in e.substitutions)
                if(v is DescriptionElement nested)Check(nested,depth+1);
                else if(v is not null and not string and not int and not float and not double and not long and not StardewValley.Object and not NPC and not Monster)throw new InvalidOperationException("Unknown board text token");
        }
        Check(part,0);return part.loadDescriptionElement();
    }
    private static string Limit(string? text,int count)=>text==null?"":text.Length<=count?text:text[..count];
    private static QuestBoardState Empty(string status,string reason)=>new(status,null,"","","",null,0,"",null,false,reason);
}
