namespace StardewThor.Bridge;
public record ProgressSources(int Shipped,int Fish,int Minerals,int Artifacts,int Cooked,int Recipes,int Owned);
public record PlayerProgress(long Version,string[] MetNpcs,string[] KnownItems,ProgressSources ItemSources,Dictionary<string,bool> MapAreas,int EventsSeen,string[] Limited,string State="ready",string Language="");
