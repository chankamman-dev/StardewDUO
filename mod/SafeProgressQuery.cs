using StardewValley;
namespace StardewThor.ReadOnly;
// Deliberately avoids GameStateQuery: third-party predicates can run arbitrary code or RNG.
internal static class SafeProgressQuery {
 public static bool Check(string? condition,ISet<string> limited){
  if(string.IsNullOrWhiteSpace(condition))return true;if(condition.Length>2000){limited.Add("map-condition-limit");return true;}
  bool result=true;foreach(var part in condition.Split(',')){
   var tokens=part.Trim().Split(' ',StringSplitOptions.RemoveEmptyEntries);if(tokens.Length==0){limited.Add("map-condition-unsupported");return true;}bool invert=tokens[0].StartsWith('!');string query=tokens[0].TrimStart('!');bool? value=null;
   if(tokens.Length==1&&query is "TRUE" or "FALSE")value=query=="TRUE";
   if(tokens.Length>=3&&tokens[1] is "Current" or "Host"&&StardewModdingAPI.Context.IsWorldReady){
    var p=tokens[1]=="Host"?Game1.MasterPlayer:Game1.player;
    if(query=="PLAYER_HAS_MAIL"&&tokens.Length<=4)value=(tokens.Length==4?tokens[3].ToLowerInvariant():"any") switch{"received"=>p.mailReceived.Contains(tokens[2]),"mailbox"=>p.mailbox.Contains(tokens[2]),"tomorrow"=>p.mailForTomorrow.Contains(tokens[2]),"any"=>p.mailReceived.Contains(tokens[2])||p.mailbox.Contains(tokens[2])||p.mailForTomorrow.Contains(tokens[2])||p.mailForTomorrow.Contains(tokens[2]+"%&NL&%"),_=>null};
    else value=query switch{"PLAYER_HAS_SEEN_EVENT"=>tokens.Skip(2).Any(id=>p.eventsSeen.Contains(id)),"PLAYER_HAS_MET"=>tokens.Skip(2).Any(id=>p.friendshipData.ContainsKey(id)),_=>null};
   }
   if(value==null){limited.Add(query.Contains("RANDOM",StringComparison.OrdinalIgnoreCase)?"map-condition-random":"map-condition-unsupported");return true;}result&=invert?!value.Value:value.Value;
  }return result;
 }
}
