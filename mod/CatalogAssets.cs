using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewThor.Bridge;
using StardewValley.ItemTypeDefinitions;

namespace StardewThor.ReadOnly;
// Independent immutable blob budget: never consumes/evicts the live 256-asset cache.
internal sealed class CatalogAssets {
 private readonly BridgeServer server;private readonly BoundedCache<string,string?> known=new(8192);private readonly Dictionary<(Texture2D,Rectangle),string?> images=new();private bool full;
 public CatalogAssets(BridgeServer server){this.server=server;}
 // Same-save content refresh can replace a texture, but published hash URLs remain
 // valid until the save session ends. Clear only the derived texture/alias lookups.
 public void Invalidate(){known.Clear();images.Clear();full=false;textures.Clear();}
 // Only the icons cut from these textures (normalized asset names; a texture without a name cannot be
 // matched and is dropped). Content Patcher refreshes a few textures on warps and clock ticks; clearing
 // every icon made each catalogue rebuild read ~5000 icons back from the GPU.
 public void Invalidate(ISet<string> names){foreach(var k in images.Keys.ToArray())if(string.IsNullOrEmpty(k.Item1.Name)||names.Contains(ContentDependencies.Normal(k.Item1.Name)))images.Remove(k);known.Clear();full=false;}
 private readonly HashSet<string> textures=new();
 // Whether a catalog icon was drawn from one of these assets (normalized names).
 public bool Uses(ISet<string> names)=>textures.Any(names.Contains);
 public bool TryReadCached(Texture2D texture,Rectangle rect,out string? value)=>images.TryGetValue((texture,rect),out value);
 public void Reset(){Invalidate();server.ClearCatalogAssets();}
 public string? Item(ParsedItemData data,ISet<string> limited){if(data.TextureName!=null&&textures.Count<4096)textures.Add(ContentDependencies.Normal(data.TextureName));var key=$"item/{data.QualifiedItemId}/{data.SpriteIndex}/{data.TextureName}/{(data.RawData==null?0:System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(data.RawData))}";if(known.TryGetValue(key,out var result)){if(result==null)limited.Add("catalog-icon-unavailable");return result;}if(full){limited.Add("catalog-assets-limit");return null;}try{return known[key]=Read(data.GetTexture(),data.GetSourceRect(),limited);}catch{limited.Add("catalog-icon-unavailable");return known[key]=null;}}
 public string? Read(Texture2D texture,Rectangle rect,ISet<string> limited){var cacheKey=(texture,rect);if(images.TryGetValue(cacheKey,out var cached)){if(cached==null)limited.Add("catalog-icon-unavailable");return cached;}if(full||images.Count>=BridgeServer.CatalogAssetCount){full=true;limited.Add("catalog-assets-limit");return null;}if(rect.Width is <1 or >128||rect.Height is <1 or >128||rect.Left<0||rect.Top<0||rect.Right>texture.Width||rect.Bottom>texture.Height){limited.Add("catalog-icon-size");return null;}Color[] colors;try{colors=SheetPixels.Read(texture,rect);}catch(TextureDeferred){limited.Add("catalog-icon-unavailable");return images[cacheKey]=null;}var png=Png.Encode(rect.Width,rect.Height,colors);if(png.Length>BridgeServer.CatalogAssetMax){limited.Add("catalog-icon-bytes");return images[cacheKey]=null;}var key=server.AddCatalogAsset(png);if(key==null){full=true;limited.Add("catalog-assets-limit");}return images[cacheKey]=key;}
}
