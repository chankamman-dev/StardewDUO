using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using HarmonyLib;
using StardewModdingAPI;
using StardewThor.Bridge;
using StardewValley;
using StardewValley.Quests;
using StardewValley.SpecialOrders;
using StardewValley.SpecialOrders.Rewards;

namespace StardewThor.ReadOnly;

// Native QuestLog payment semantics, executed only by the authenticated game-thread consumer.
// History is an observation log, never a source of authority for a payment.
internal static class QuestRewards
{
    private sealed class Token {public readonly string Value=Guid.NewGuid().ToString("N"); public bool PaymentAttempted;}
    private static readonly ConditionalWeakTable<object,Token> identities=new();
    private static readonly List<JournalQuest> history=new();
    private static JournalCollector? collector;
    private static IModHelper? helper;
    private static IMonitor? monitor;
    public static string Identity(object quest)=>identities.GetOrCreateValue(quest).Value;
    private static bool Native(object quest)=>quest.GetType().Assembly==typeof(Quest).Assembly;
    public static int OrderMoney(SpecialOrder q)=>Math.Max(0,q.rewards.OfType<MoneyReward>().Sum(r=>r.GetRewardMoneyAmount()));
    public static string? Key(IQuest q)
    {
        if(!Context.IsWorldReady||identities.GetOrCreateValue(q).PaymentAttempted||!Native(q)||q.IsHidden()||!q.ShouldDisplayAsComplete())return null;
        int money=q is Quest quest?quest.moneyReward.Value:q is SpecialOrder order?OrderMoney(order):0;
        if(money<=0||q is Quest dead&&dead.destroy.Value)return null;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{Game1.uniqueIDForThisGame}/{Game1.player.UniqueMultiplayerID}/{Identity(q)}/{money}"))).ToLowerInvariant();
    }
    public static void Claim(Command command)
    {
        var candidates=Game1.player.questLog.Cast<IQuest>().Concat(Game1.player.team.specialOrders.Cast<IQuest>());
        var q=candidates.FirstOrDefault(q=>q!=null&&Key(q)==command.QuestKey);
        if(q==null)throw new CommandRejected("quest-changed");
        // Match the exact QuestLog predicate and mutation order, without completing objectives.
        if(!q.ShouldDisplayAsComplete()||!q.HasMoneyReward())throw new CommandRejected("quest-not-ready");
        int money=q.GetMoneyReward();
        if(money<=0||money>int.MaxValue-Game1.player.Money)throw new CommandRejected("quest-reward-invalid");
        var completed=Project(q);
        identities.GetOrCreateValue(q).PaymentAttempted=true; // Fail closed if another mod throws inside the native callback.
        Game1.player.Money+=money;
        q.OnMoneyRewardClaimed();
        Remember(completed);
        Game1.dayTimeMoneyBox.questsDirty=true;
    }
    private static JournalQuest Project(IQuest q)=>q is Quest normal?collector!.ProjectQuest(normal,0):collector!.ProjectOrder((SpecialOrder)q);
    private static void Remember(JournalQuest entry)
    {
        history.RemoveAll(q=>q.Id==entry.Id);
        history.Insert(0,entry with{Ready=true,Archived=true,ClaimKey=null,DaysLeft=null,Description=entry.Description[..Math.Min(800,entry.Description.Length)],Objectives=entry.Objectives.Take(4).Select(o=>o with{Text=o.Text[..Math.Min(160,o.Text.Length)]}).ToArray()});
        TrimHistory();
        collector?.InvalidateCore();
    }
    private static void TrimHistory(){if(history.Count>48)history.RemoveRange(48,history.Count-48);while(history.Count>0&&Encoding.UTF8.GetByteCount(System.Text.Json.JsonSerializer.Serialize(history,BridgeServer.Json))>32768)history.RemoveAt(history.Count-1);}
    public static JournalQuest[] History()=>history.ToArray();
    // Before 0.10.0-beta.2 the mod ID was ThorDev.StardewThor.ReadOnly, and SMAPI keys save data by
    // mod ID. Carry the saved history over once, in memory; it reaches the save file only with the
    // game's own next save. The old entry is left untouched.
    private const string LegacyHistoryKey="smapi/mod-data/thordev.stardewthor.readonly/quest-history-v1";
    private static void AdoptLegacyHistory(){
        if(!Context.IsMainPlayer||Game1.CustomData is not IDictionary<string,string> data)return;
        var current=("smapi/mod-data/"+helper!.ModRegistry.ModID+"/quest-history-v1").ToLowerInvariant();
        if(!data.ContainsKey(current)&&data.TryGetValue(LegacyHistoryKey,out var legacy)&&!string.IsNullOrEmpty(legacy)){data[current]=legacy;monitor?.Log("Quest history carried over from the previous mod ID",LogLevel.Info);}
    }
    public static void Initialize(IModHelper modHelper,IMonitor log,JournalCollector journal)
    {
        helper=modHelper;monitor=log;collector=journal;
        modHelper.Events.GameLoop.SaveLoaded+=(_,_)=>{history.Clear();try{AdoptLegacyHistory();var saved=helper.Data.ReadSaveData<JournalQuest[]>("quest-history-v1");if(saved!=null)history.AddRange(saved.Where(q=>q.Archived&&q.Ready&&q.ClaimKey==null).Take(48));TrimHistory();}catch(Exception e){log.Log("Quest history load: "+e.GetType().Name,LogLevel.Warn);}};
        // Persist alongside a normal game save only. Never force saving or retain an unsaved timeline.
        modHelper.Events.GameLoop.Saving+=(_,_)=>{if(Context.IsMainPlayer)try{helper.Data.WriteSaveData("quest-history-v1",history.ToArray());}catch(Exception e){log.Log("Quest history save: "+e.GetType().Name,LogLevel.Warn);}};
        modHelper.Events.GameLoop.ReturnedToTitle+=(_,_)=>history.Clear();
        var harmony=new Harmony("chankamman.StardewDS.QuestHistory");
        harmony.Patch(AccessTools.Method(typeof(Quest),nameof(Quest.questComplete)),postfix:new HarmonyMethod(typeof(QuestRewards),nameof(Completed)));
        foreach(var type in new[]{typeof(Quest),typeof(SpecialOrder)})
            harmony.Patch(AccessTools.Method(type,"OnMoneyRewardClaimed"),prefix:new HarmonyMethod(typeof(QuestRewards),nameof(BeforeClaim)),postfix:new HarmonyMethod(typeof(QuestRewards),nameof(AfterClaim)));
        harmony.Patch(AccessTools.Method(typeof(SpecialOrder),nameof(SpecialOrder.CheckCompletion)),prefix:new HarmonyMethod(typeof(QuestRewards),nameof(BeforeOrderCompleted)),postfix:new HarmonyMethod(typeof(QuestRewards),nameof(OrderCompleted)));
    }
    private static void Completed(Quest __instance)
    {
        try{if(Context.IsWorldReady&&Native(__instance)&&__instance.completed.Value&&!__instance.IsHidden()&&__instance.moneyReward.Value<=0)Remember(Project(__instance));collector?.InvalidateCore();}catch(Exception e){monitor?.Log("Quest history capture: "+e.GetType().Name,LogLevel.Trace);}
    }
    private static void BeforeOrderCompleted(SpecialOrder __instance,out bool __state)=>__state=Context.IsWorldReady&&__instance.questState.Value==SpecialOrderStatus.InProgress;
    private static void OrderCompleted(SpecialOrder __instance,bool __state)
    {
        try{if(!__state||__instance.questState.Value!=SpecialOrderStatus.Complete)return;if(Native(__instance)&&!__instance.IsHidden()&&OrderMoney(__instance)==0)Remember(Project(__instance));collector?.InvalidateCore();}catch(Exception e){monitor?.Log("Order history capture: "+e.GetType().Name,LogLevel.Trace);}
    }
    private static void BeforeClaim(object __instance,out JournalQuest? __state)
    {
        __state=null;try{if(Context.IsWorldReady&&__instance is IQuest q&&Key(q)!=null)__state=Project(q);}catch(Exception e){monitor?.Log("Quest claim observation: "+e.GetType().Name,LogLevel.Trace);}
    }
    private static void AfterClaim(object __instance,JournalQuest? __state)
    {
        try{if(__state!=null&&__instance is IQuest q&&Key(q)==null)Remember(__state);}catch(Exception e){monitor?.Log("Quest claim archive: "+e.GetType().Name,LogLevel.Trace);}
    }
}
