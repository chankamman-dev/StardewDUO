namespace StardewThor.Bridge;

// Immutable, independently refreshed game-thread cache; never carried by the snapshot.
public record FarmExtras(long Version, string State, JunimoReport Junimos, FamilyReport Family, PlayerBirthdayReport PlayerBirthday, SlayerGoal[] Slayer, string[] Limited);
public record JunimoReport(string State, bool? PaidToday = null, int? Huts = null, string[]? Abilities = null);
public record FamilyReport(string State, string Source, string ModState, string? Spouse, FamilyChild[] Children);
public record FamilyChild(string Name, string? Birthday, int? DaysToGrow);
public record PlayerBirthdayReport(string State, string? Season = null, int? Day = null, bool? Today = null);
public record SlayerGoal(string Id, string Name, int Killed, int Goal, string? Reward, bool Claimed);
