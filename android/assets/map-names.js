// Display aliases only. Route requests, resident positions and spoiler gates use
// the original IDs. SVE/East Scarp names follow their installed zh translations.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MapNames=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const regions={Valley:'星露谷',GingerIsland:'姜岛',Custom_CrimsonBadlands:'绯红荒地',Custom_FableReef:'寓言礁',Custom_GrampletonSuburbs:'格兰普顿郊区',Custom_Highlands:'高地','Rafseazz.RSVCP_RidgesideVillage':'山脊村',EastScarp:'东斯卡普'};
 const locations={Town:'鹈鹕镇',Farm:'农场',FarmHouse:'农舍',Forest:'煤矿森林',Mountain:'深山',Beach:'沙滩',Desert:'沙漠',BusStop:'巴士站',Railroad:'铁路',Mine:'矿井',Sewer:'下水道',Woods:'秘密森林',IslandSouth:'姜岛南部',IslandNorth:'姜岛北部',IslandWest:'姜岛西部',IslandEast:'姜岛东部',
  // Interiors, as players know them (event locations are mostly indoors).
  Saloon:'星之果实酒吧',SeedShop:'皮埃尔的杂货店',ScienceHouse:'罗宾的木匠店',SebastianRoom:'塞巴斯蒂安的房间',Hospital:'哈维的诊所',HarveyRoom:'哈维的房间',HaleyHouse:'艾米丽和海莉的家',SamHouse:'乔迪的家',JoshHouse:'乔治的家',
  Trailer:'潘姆的拖车',Trailer_Big:'潘姆的房子',ElliottHouse:'艾利欧特的小屋',LeahHouse:'莉亚的小屋',AnimalShop:'玛妮的牧场',Blacksmith:'铁匠铺',ManorHouse:'镇长的庄园',WizardHouse:'法师塔',WizardHouseBasement:'法师塔地下室',
  ArchaeologyHouse:'博物馆',CommunityCenter:'社区中心',JojaMart:'Joja 超市',FishShop:'威利的鱼店',Tent:'莱纳斯的帐篷',AdventureGuild:'冒险家公会',BathHouse_Pool:'温泉',BathHouse_Entry:'温泉入口',Sunroom:'卡洛琳的阳光房',
  Greenhouse:'温室',Backwoods:'边远森林',Tunnel:'隧道',WitchSwamp:'女巫沼泽',WitchHut:'女巫小屋',Summit:'山顶',MovieTheater:'电影院',Club:'赌场',SkullCave:'骷髅洞穴',Cellar:'地窖',SandyHouse:'绿洲',
  // Modded places whose packs ship no Chinese name (none in Data/Locations or the world map): our own.
  Custom_GrandpasShedRuins:'爷爷的棚屋废墟',Custom_MarnieShed:'玛妮的棚屋',Custom_AndyHouse:'安迪的家',Custom_SusanHouse:'苏珊的家',Custom_JenkinsHouse:'詹金斯家',Custom_SophiaHouse:'索菲亚的家',Custom_AuroraVineyard:'极光葡萄园',
  Custom_FirstSlashGuestRoom:'初斩公会客房',Custom_HighlandsCavernPrison:'高地洞穴监狱',Custom_TreasureCave:'宝藏洞穴',Custom_HighlandsOutpost:'高地前哨站',Custom_WizardBasement:'法师的地下室',Custom_HenchmanHouse:'打手的房子',
  Custom_Baldur_Village:'博德村',Custom_Astarion_House:'阿斯代伦的家',Custom_Elfsong_Tavern:'精灵之歌酒馆',Custom_Enya_Place:'恩雅的住处',Custom_Enya_House:'恩雅的家',Custom_HecateGor:'赫卡忒峡谷',Custom_Covenstead:'女巫集会所',Custom_memory:'回忆',
  Custom_GE_MonsterHouse:'怪物之家',Custom_GE_MonsterResearchWing:'怪物研究所',Custom_GE_FlowerParadise:'花之乐园',EastScarp_LionsMane:'狮鬃',MagicStardew_AsharaHouse:'阿莎拉的家',MagicStardew_AsharaHouse_Cellar:'阿莎拉的地窖',MagicStardew_AsharaHouse_Outside:'阿莎拉家门外',
  'Gervig91.StardewAquariumCP_MNFKoiRoom':'水族馆锦鲤室','Gervig91.StardewAquariumCP_MNFRoom':'水族馆展厅','Gervig91.StardewAquariumCP_FishMuseum':'鱼类博物馆',
  BoatTunnel:'威利的船坞',IslandSouthEast:'姜岛东南部',IslandHut:'里奥的小屋',Caldera:'火山口',...regions};
 function words(id){return String(id||'').replace(/^Custom_/i,'').replace(/[_-]+/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').trim();}
 // Display names the game itself reported (event list: Data/Locations, translated by content packs),
 // used when the caller has no name of its own and they are in the language shown.
 let learned={language:null,names:{}};
 function learn(language,names){if(names&&typeof names==='object')learned={language,names};}
 function label(id,language,original,aliases){if(!original&&learned.language&&String(learned.language).toLowerCase().startsWith(language)&&typeof learned.names[id]==='string')original=learned.names[id];if(language==='zh'){
  // Prefer an actual translated display name supplied by the game.
  if(original&&/[\u3400-\u9fff]/u.test(original))return original;
  if(Object.hasOwn(aliases,id))return aliases[id];
 }return original||words(id)||String(id||'');}
 return {region:(id,language,original)=>label(id,language,original,regions),location:(id,language,original)=>label(id,language,original,locations),learn};
});
