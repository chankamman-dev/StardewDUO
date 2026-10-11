namespace StardewThor.Bridge;

// Optional read-only journal extension. Arrays and text are bounded by JournalCollector.
// collectedAt/scan timestamps are UTC Unix milliseconds; inventory counts exclude chests.
public record JournalState(long CollectedAt, CalendarEvent[] Calendar, JournalQuest[] Quests,
    JournalRecipe[] Recipes, EquipmentEntry[] Equipment, ChoreSummary[] Chores, FarmScan Scan, string[] Limited, QuestBoardState? Board = null, CharacterState? Character = null, JournalQuest[]? CompletedQuests = null, long? FarmVersion = null);
public record CharacterState(SkillEntry[] Skills, int MasteryLevel, long MasteryExperience,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition=System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] CustomSkillEntry[]? CustomSkills=null);
public record SkillEntry(int Id, int Level, int EffectiveLevel, int Experience, int LevelStart, int? NextLevel, ProfessionEntry[] Professions, string Effect = "");
public record ProfessionEntry(int Id, int Level, string Name, string Description);
public record QuestBoardState(string Status, string? Key, string Title, string Description, string Objective,
    string? TargetNpc, int MoneyReward, string RewardText, int? DaysLeft, bool CanAccept, string Reason);
public record CalendarEvent(string Id, string Kind, string Season, int Day, string Name, string? NpcId = null);
public record JournalQuest(string Id, string Kind, string Title, string Description, QuestObjective[] Objectives, int? DaysLeft, bool Ready, int? MoneyReward = null, string? RewardText = null, string? TargetNpc = null, string? ClaimKey = null, bool Archived = false);
public record QuestObjective(string Text, int? Current = null, int? Required = null);
public record JournalRecipe(string Id, string Kind, string Name, string OutputId, int Quantity, RecipeIngredient[] Ingredients, int Craftable, int? MaxCrafts = null, string? CraftReason = null, string? Description = null);
public record RecipeIngredient(string Id, string Name, int Needed, int Owned);
public record EquipmentEntry(string Slot, string Id, string Name, string Description, TargetField[] Fields);
public record ChoreSummary(string LocationId, string Location, int CropsReady, int CropsDry, int MachinesReady, int AnimalsUnpetted, ChoreEntry[] Details);
public record ChoreEntry(string Kind, string Id, string Name, int X, int Y);
public record FarmScan(string State, int Completed, int Total, long StartedAt, long? CompletedAt);
