using System.Text.Json.Serialization;
namespace StardewThor.Bridge;

public record CustomSkillEntry(string Id,string Name,int Level,int TotalLevel,int Experience,string? Icon,string[] Professions);
public record CollectionEntry(string Id,string Name,bool Found,bool? Donated=null,string[]? Seasons=null,string? Icon=null);
public record CollectionSet(string Id,string State,int? Found,int? Total,CollectionEntry[] Entries,string? Mod=null,int? Donated=null);
public record CollectionReport(string State,long Version,string Language,CollectionSet[] Sets,string[] Limited);

// Limits also applied by the game-thread builder and JavaScript validator.
public static class CollectionLimits {
 public const int Entries=1024,Scan=8192,Bytes=384*1024;
 public static readonly string[] States={"ready","building","absent","unsupported","unavailable"};
}
