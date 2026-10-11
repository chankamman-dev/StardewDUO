namespace StardewThor.Bridge;

// Game-thread cache: a full cache must evict old entries, not reject every new asset.
public sealed class BoundedCache<TKey,TValue> where TKey:notnull {
    private readonly int capacity;
    private readonly Dictionary<TKey,(TValue Value,LinkedListNode<TKey> Node)> values=new();
    private readonly LinkedList<TKey> order=new();
    public BoundedCache(int capacity){this.capacity=Math.Max(1,capacity);}
    public int Count=>values.Count;
    public bool ContainsKey(TKey key)=>values.ContainsKey(key);
    public void Clear(){values.Clear();order.Clear();}
    public bool TryGetValue(TKey key,out TValue value){if(values.TryGetValue(key,out var entry)){order.Remove(entry.Node);order.AddLast(entry.Node);value=entry.Value;return true;}value=default!;return false;}
    public TValue this[TKey key]{set{if(values.TryGetValue(key,out var old))order.Remove(old.Node);else if(values.Count>=capacity){var first=order.First!;values.Remove(first.Value);order.RemoveFirst();}var node=order.AddLast(key);values[key]=(value,node);}}
}
