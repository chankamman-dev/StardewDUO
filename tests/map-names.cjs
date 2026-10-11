const assert=require('node:assert/strict'),names=require('../android/assets/map-names.js');
// Actual region IDs in Thor's read-only tracking snapshot, with display-only aliases.
const known={Valley:'星露谷',GingerIsland:'姜岛',Custom_CrimsonBadlands:'绯红荒地',Custom_FableReef:'寓言礁',Custom_GrampletonSuburbs:'格兰普顿郊区',Custom_Highlands:'高地','Rafseazz.RSVCP_RidgesideVillage':'山脊村',EastScarp:'东斯卡普'};
for(const [id,zh] of Object.entries(known)){assert.equal(names.region(id,'zh'),zh);assert.equal(names.region(id,'zh','作者译名'),'作者译名');assert.notEqual(names.region(id,'en'),zh);}
assert.equal(names.region('Custom_UnknownMap','zh'),'Unknown Map');
assert.equal(names.region('Custom_UnknownMap','en','Author region'),'Author region');
assert.equal(names.region('constructor','zh'),'constructor');
assert.equal(names.location('Town','zh'),'鹈鹕镇');
assert.equal(names.location('Farm','zh','来财农场'),'来财农场');
assert.equal(names.location('Forest','en','Cindersap Forest'),'Cindersap Forest');
console.log('PASS display aliases: eight verified region IDs, translated-author precedence, language and unknown fallback');
