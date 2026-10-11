using StardewThor.Bridge;
using StardewValley;
using StardewValley.Buffs;
using StardewValley.Enchantments;
using StardewValley.Objects;
using StardewValley.Tools;

namespace StardewThor.ReadOnly;

// The icon lines the game's own item tooltip draws (MeleeWeapon/Boots.drawTooltip and
// IClickableMenu.drawToolTip's food buffs), with the game's localized text. Read-only:
// buff data is built exactly as the hover tooltip builds it every frame.
internal static class ItemStats
{
    // Weapons and boots append text stats in getDescription(); their hover tooltip shows only the
    // raw description (the App reflows it) above the icon lines.
    public static string? Plain(Item item)=>item switch{
        MeleeWeapon w when !w.isScythe()=>w.description??"",
        Boots b=>b.description??"",
        _=>null};
    private static string S(string key,params object[] args)=>Game1.content.LoadString("Strings\\UI:"+key,args);
    public static ItemStat[]? Read(Item item)
    {
        var lines=new List<ItemStat>();
        if(item is MeleeWeapon w&&!w.isScythe())Weapon(w,lines);
        else if(item is Boots b)
        {
            if(b.defenseBonus.Value>0)lines.Add(new("defense",S("ItemHover_DefenseBonus",b.defenseBonus.Value)));
            if(b.immunityBonus.Value>0)lines.Add(new("immunity",S("ItemHover_ImmunityBonus",b.immunityBonus.Value)));
        }
        else if(item is StardewValley.Object o&&o.Edibility!=-300&&Game1.objectData.TryGetValue(o.ItemId,out var data))Food(o,data,lines);
        return lines.Count==0?null:lines.Take(16).Select(l=>l with{Text=l.Text.Length>200?l.Text[..200]:l.Text}).ToArray();
    }
    private static void Weapon(MeleeWeapon w,List<ItemStat> lines)
    {
        const string enchanted="enchanted";
        lines.Add(new("damage",S("ItemHover_Damage",w.minDamage.Value,w.maxDamage.Value),w.hasEnchantmentOfType<RubyEnchantment>()?enchanted:null));
        int club=w.type.Value==2?-8:0;
        if(w.speed.Value!=club)
        {
            int shown=w.speed.Value-club;bool slow=shown<0;
            lines.Add(new("speed",S("ItemHover_Speed",(shown>0?"+":"")+shown/2),slow?"negative":w.hasEnchantmentOfType<EmeraldEnchantment>()?enchanted:null));
        }
        if(w.addedDefense.Value>0)lines.Add(new("defense",S("ItemHover_DefenseBonus",w.addedDefense.Value),w.hasEnchantmentOfType<TopazEnchantment>()?enchanted:null));
        float crit=w.critChance.Value;if(w.type.Value==1){crit+=0.005f;crit*=1.12f;}
        if(crit/0.02>=1.100000023841858)lines.Add(new("critChance",S("ItemHover_CritChanceBonus",(int)Math.Round((crit-0.001f)/0.02)),w.hasEnchantmentOfType<AquamarineEnchantment>()?enchanted:null));
        if((w.critMultiplier.Value-3f)/0.02>=1.0)lines.Add(new("critPower",S("ItemHover_CritPowerBonus",(int)((w.critMultiplier.Value-3f)/0.02)),w.hasEnchantmentOfType<JadeEnchantment>()?enchanted:null));
        float knock=w.defaultKnockBackForThisType(w.type.Value);
        if(w.knockback.Value!=knock)
        {
            int weight=(int)Math.Ceiling(Math.Abs(w.knockback.Value-knock)*10f);
            lines.Add(new("weight",S("ItemHover_Weight",(weight>knock?"+":"")+weight),w.hasEnchantmentOfType<AmethystEnchantment>()?enchanted:null));
        }
        if(w.enchantments.Count>0&&w.enchantments[w.enchantments.Count-1] is DiamondEnchantment)
        {
            int left=w.GetMaxForges()-w.GetTotalForgeLevels();
            lines.Add(new("",S(left==1?"ItemHover_DiamondForge_Singular":"ItemHover_DiamondForge_Plural",left),enchanted));
        }
        foreach(var e in w.enchantments)
        {
            if(!e.ShouldBeDisplayed())continue;
            bool secondary=e.IsSecondaryEnchantment();
            bool hidden=(BaseEnchantment.hideEnchantmentName&&!secondary)||(BaseEnchantment.hideSecondaryEnchantName&&secondary);
            lines.Add(new(secondary?"enchantSecondary":"enchant",hidden?"???":e.GetDisplayName(),secondary?"secondary":"enchantment"));
        }
    }
    private static void Food(StardewValley.Object o,StardewValley.GameData.Objects.ObjectData data,List<ItemStat> lines)
    {
        var effects=new BuffEffects();int duration=int.MinValue;
        foreach(var buff in StardewValley.Object.TryCreateBuffsFromData(data,o.Name,o.DisplayName,1f,o.ModifyItemBuffs))
        {
            effects.Add(buff.effects);
            if(buff.millisecondsDuration==-2||(buff.millisecondsDuration>duration&&duration!=-2))duration=buff.millisecondsDuration;
        }
        if(!effects.HasAnyValue())return;
        var legacy=effects.ToLegacyAttributeFormat();
        for(int k=0;k<12&&k<legacy.Length;k++)
        {
            if(legacy[k]=="0"||legacy[k]=="")continue;
            string value=(Convert.ToDouble(legacy[k])>0.0?"+":"")+legacy[k];
            lines.Add(new("buff"+k,S("ItemHover_Buff"+k,value),Convert.ToDouble(legacy[k])<0?"negative":null));
        }
        if(duration!=-2&&duration>0)lines.Add(new("duration",Utility.getMinutesSecondsStringFromMilliseconds(duration)));
    }
}
