using StardewThor.Bridge;
using StardewValley;
using StardewValley.GameData.Objects;
using StardewValley.ItemTypeDefinitions;

namespace StardewThor.ReadOnly;
internal static class ReadOnlyMetadata {
 // Recipe metadata only: never select a random output, construct an Item, or evaluate unlock queries.
 public static (string[] Outputs,CatalogRecipe Recipe)? Recipe(string raw,bool cooking,ISet<string> limited){
  if(raw.Length>12000){limited.Add("recipes-text-limit");return null;}var f=raw.Split('/');if(f.Length<3){limited.Add("recipes-unsupported");return null;}var output=f[2].Split(' ',StringSplitOptions.RemoveEmptyEntries);var input=f[0].Split(' ',StringSplitOptions.RemoveEmptyEntries);
  if(output.Length is <1 or >32||input.Length>24){limited.Add("recipes-unsupported");return null;}var ingredients=new List<CatalogIngredient>();for(int i=0;i<input.Length;i+=2){int count=1;if((i+1<input.Length&&!int.TryParse(input[i+1],out count))||count<1||count>999999||input[i].Length>160){limited.Add("recipes-unsupported");return null;}string? id=input[i].StartsWith('-')?input[i]:ItemRegistry.QualifyItemId(input[i]);if(id==null){limited.Add("recipes-unsupported");return null;}ingredients.Add(new(id,count));}
  // Native CraftingRecipe uses ArgUtility.GetInt(..., defaultValue:1) for an omitted
  // final quantity. In particular the native Fried Egg output is a single ID token.
  var outputs=new List<string>();for(int i=0;i<output.Length;i+=2){int quantity=1;if((i+1<output.Length&&!int.TryParse(output[i+1],out quantity))||quantity is <1 or >999999){limited.Add("recipes-unsupported");return null;}string? id=!cooking&&f.Length>3&&bool.TryParse(f[3],out bool big)&&big?ItemRegistry.ManuallyQualifyItemId(output[i],"(BC)"):ItemRegistry.QualifyItemId(output[i]);if(id==null||id.Length>160){limited.Add("recipes-unsupported");return null;}outputs.Add(id);}return(outputs.ToArray(),new(cooking?"cooking":"crafting",ingredients.ToArray()));
 }
 public static string Type(string prefix)=>prefix switch{"(O)"=>"object","(BC)"=>"bigCraftable","(W)"=>"weapon","(T)"=>"tool","(B)"=>"boots","(H)"=>"hat","(P)" or "(S)"=>"clothing","(TR)"=>"trinket","(F)"=>"furniture",_=>"other"};
 public static int? Price(ParsedItemData data,ISet<string> limited){if(data.RawData is ObjectData o)return Math.Max(0,o.Price);var f=data.RawData?.GetType().GetField("Price");if(f?.FieldType==typeof(int))return Math.Max(0,(int)f.GetValue(data.RawData)!);if(data.GetItemTypeId()=="(F)"&&data.RawData is string[] s&&s.Length>5&&int.TryParse(s[5],out int p))return Math.Max(0,p);limited.Add("catalog-price-unsupported");return null;}
 // 1.6 native gift-taste precedence on metadata, matching the base game's default item.
 // Context tags from the runtime data cover mod content; per-instance/Harmony taste overrides
 // cannot be established without constructing items and remain explicitly limited.
 public static int? GiftTaste(string npc,ParsedItemData data,ISet<string> limited){
  if(data.QualifiedItemId=="(O)StardropTea")return 7;if(data.RawData is not ObjectData raw){limited.Add("gifts-unsupported");return null;}
  string[] universalKeys={"Universal_Love","Universal_Hate","Universal_Like","Universal_Dislike","Universal_Neutral"};if(universalKeys.Any(k=>!Game1.NPCGiftTastes.TryGetValue(k,out var s)||s.Length>12000||s.Split(' ',StringSplitOptions.RemoveEmptyEntries).Length>256)){limited.Add("gifts-unsupported");return null;}
  string[] Tokens(string key)=>Game1.NPCGiftTastes.TryGetValue(key,out var s)&&s.Length<=12000?s.Split(' ',StringSplitOptions.RemoveEmptyEntries):Array.Empty<string>();
  bool Exact(string[] values)=>values.Any(x=>!x.StartsWith('-')&&ItemRegistry.GetData(x)?.QualifiedItemId==data.QualifiedItemId);
  var tags=new HashSet<string>(ItemContextTagManager.GetBaseContextTags(data.QualifiedItemId),StringComparer.OrdinalIgnoreCase){"quality_none"};
  bool Tagged(string[] values)=>values.Any(x=>x.Length>0&&!char.IsNumber(x[0])&&x[0]!='-'&&ItemContextTagManager.DoesTagMatch(x,tags));
  int[] order={0,6,2,4,8};var uni=new[]{Tokens("Universal_Love"),Tokens("Universal_Hate"),Tokens("Universal_Like"),Tokens("Universal_Dislike"),Tokens("Universal_Neutral")};string category=data.Category.ToString();int taste=8;for(int i=0;i<4;i++)if(uni[i].Contains(category)){taste=order[i];break;}for(int i=0;i<4;i++)if(Tagged(uni[i])){taste=order[i];break;}bool exact=false,neutral=false;for(int i=0;i<5;i++)if(Exact(uni[i])){taste=order[i];exact=true;neutral=i==4;break;}
  if(raw.Type=="Arch")taste=npc is "Penny" or "Dwarf"?2:4;if(taste==8&&!neutral){if(raw.Edibility!=-300&&raw.Edibility<0)taste=6;else if(raw.Price<20)taste=4;}
  if(Game1.NPCGiftTastes.TryGetValue(npc,out var personal)){if(personal.Length>12000){limited.Add("gifts-unsupported");return null;}var f=personal.Split('/');if(f.Length<10){limited.Add("gifts-unsupported");return null;}var lists=new[]{f[1],f[7],f[3],f[5],f[9]}.Select(s=>s.Split(' ',StringSplitOptions.RemoveEmptyEntries)).ToArray();if(lists.Any(l=>l.Length>256)){limited.Add("gifts-unsupported");return null;}for(int i=0;i<5;i++)if(Exact(lists[i]))return order[i];for(int i=0;i<5;i++)if(Tagged(lists[i]))return order[i];if(!exact&&data.Category!=0)for(int i=0;i<5;i++)if(lists[i].Contains(category))return order[i];}return taste;
 }
 public static string Limit(string? value,int max,ISet<string> limited){if(value==null)return "";if(value.Length<=max)return value;limited.Add("catalog-text-limit");return value[..max];}
}
