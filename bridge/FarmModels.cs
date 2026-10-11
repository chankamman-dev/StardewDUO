namespace StardewThor.Bridge;

// Optional read-only farm report, served on demand at /v1/farm (never inside the 6 Hz
// snapshot). Built once per completed farm scan; arrays are never mutated after publish.
// Tiles are flattened [x0,y0,x1,y1,...] tile coordinates inside LocationId.
public record FarmReport(long Version, long CollectedAt, string State, FarmPlace[] Places, FarmOutlook? Outlook, string[] Limited, CropPlanner? Planner = null, HarvestCalendar? Harvest = null, FarmExtras? Extras = null);
public record HarvestCalendar(int Year, int Season, int Day, HarvestGroup[] Crops);
// Days: next harvest assuming daily watering; -1 cannot mature before a season change.
public record HarvestGroup(string Location, string Id, string Name, int Days, int Count, int Dry, int Regrow);
public record FarmPlace(string LocationId, string Location, FarmTask[] Tasks);
// Kind: cropReady, cropDry, machine, grabber, animalPet, animalHarvest, animalProduct, hay,
// petBowl, fruitTree (to do today); cropTomorrow, cropWither, machineSoon (forecast).
// Extra: cropTomorrow unwatered, cropWither won't ripen in time, fruitTree/grabber items, hay animals.
public record FarmTask(string Kind, string Id, string Name, int Count, int[] Tiles, int? Extra = null, int? Minutes = null, string? Icon = null);
public record FarmOutlook(int DaysLeft, string NextSeason, string WeatherTomorrow, string? IslandWeatherTomorrow,
    double Luck, int LuckLevel, string LuckText, SauceRecipe? Sauce, MerchantInfo Merchant, int Hay, int HayCapacity, ToolUpgrade? Tool);
// Today: airs today (Sunday, or the Wednesday rerun); otherwise the next Sunday InDays ahead.
public record SauceRecipe(string Key, string Name, string OutputId, bool Known, bool Today, bool Rerun, int InDays);
public record MerchantInfo(bool Today, int NextInDays, MerchantItem[] Stock, bool StockLimited = false);
// Stock -1 means unlimited. Bundle: an incomplete Community Center bundle can use it.
public record MerchantItem(string Id, string Name, int Price, int Stock, bool Bundle);
public record ToolUpgrade(string Id, string Name, int DaysLeft);
// Crop planner input, read from the live game (mod crops included). Growth, yield and price
// rules are applied in the App exactly as HoeDirt.applySpeedIncreases / Crop.harvest /
// Object.sellToStorePrice do. SeedPrice is a shop's listed gold price (Pierre preferred), 0 = no shop sells it.
public record CropInfo(string SeedId, string SeedName, string HarvestId, string HarvestName, string[] Seasons, int[] Phases, int Regrow,
    int MinStack, int MaxStack, double MaxPerLevel, double ExtraChance, int SeedPrice, int SellPrice, int Category, bool Paddy, bool Trellis, bool Restricted = false);
// Restricted: the crop has PlantableLocationRules (e.g. cactus: greenhouse / pots only).
public record CropPlanner(CropInfo[] Crops, int FarmingLevel, bool Agriculturist, bool Tiller, double ProfitMargin);
