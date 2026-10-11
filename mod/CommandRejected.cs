namespace StardewThor.ReadOnly;
internal sealed class CommandRejected : Exception { public CommandRejected(string code) : base(code) { } }
