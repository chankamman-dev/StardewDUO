# 按需后端数据与兼容字段

模组 0.10.1-dev.19 起增加以下只读字段；旧接口和旧字段继续兼容。下屏界面需接入这些字段才能显示新增内容。

## 剧情事件

`GET /v1/events?page=N` 仍每页 50 条。事件可选 `trigger`：

```json
{
  "state": "blocked",
  "checkedAt": {"day": 15, "season": "spring", "year": 1, "time": 1330, "location": "Town"},
  "failed": [{"index": 1, "kind": "Friendship"}],
  "chance": [{"index": 2, "kind": "Random"}],
  "unknown": [],
  "gate": null,
  "limited": []
}
```

`state` 为 ready、blocked、seen、gate 或 unknown。ready 表示已核实的原生条件均通过且没有未知条件；存在 chance 时仍可能受概率影响。blocked 的 failed 可用于显示缺少的条件。unknown 不应显示成“现在可以触发”。每种条件结果最多 16 条，index 是不含事件 ID 的条件位置，从 0 开始。checkedAt 是该事件实际判定时的游戏状态，分帧结果不保证全部事件在同一帧判定。重新判定的结果与上次发布相同（只有 checkedAt 不同）时不发布、version 不变，所以 checkedAt 是结果最近一次变化时的判定时间。

使用游戏自己的原生处理器，不执行事件脚本、MH 条件求值器、写邮件条件或随机条件。第三方/被修改的处理器、未缓存的实际事件定义、未知地点及未经审计的查询会明确返回 unknown。事件元数据只在存档、语言、相关资产失效时重读；动态判定按时间、地点、好感、已见事件等变化刷新。请求租约过期后停止采集。新加载的事件资产会更新缓存索引。

## 保存状态

`GET /v1/state` 与 `/v1/snapshot` 是同一个快照接口。保存期间最外层增加 `busy:"saving"`，不放在 snapshot 里面。该标志由 Saving/Saved 生命周期设置，HTTP 不依赖保存期间暂停的游戏线程。保存结束、读档或回标题时清除。Model.busy 提供该状态；仍要按 HTTP 接收时间判断真正断连。

## 当前矿层

`scene.mine.monsters` **保持原数字总数**，新增详情数组 `monsterTypes`，不将数字改成数组：

```json
{
  "monsters": 3,
  "monsterTypes": [{"id":"Green Slime","name":"绿色史莱姆","count":3,"icon":null,"health":24,"slayer":"Slimes","drops":["(O)766"],"mod":null}],
  "floorKind": "normal",
  "limited": []
}
```

最多 16 种、每种最多 16 个掉落 ID。health 是同类型怪物的最大生命上限；组内不同则 null。掉落来自 Data/Monsters，不代表本次击杀一定掉落，不掷骰。slayer 来自 Data/MonsterSlayerQuests，新增目标由同一数据资产自动包含；缺失为 null。mod 仍是有限的 UniqueID 前缀归属，不表示权威补丁来源。

图标使用实际怪物纹理第一帧，沿用 `/bridge/asset/<sha256>`。每次场景采集最多尝试一个未缓存图标，其他先为 null 并附 pending 标记；已缓存图标直接复用。floorKind 可为 normal、infested、treasure、dino、mushroom、quarry、skull、volcano。

## 晚安小结

`scene.night.skills`、friends、money 均可选：

```json
{
  "skills":[{"id":"0","experience":120,"startLevel":1,"level":2,"pendingProfession":false}],
  "friends":{"talked":3,"gifted":2},
  "money":null
}
```

原版技能 ID：0 耕种、1 钓鱼、2 采集、3 采矿、4 战斗。只在真实 DayStarted 获得基线后计算当日经验；中途读档不能还原整天，所以 skills 为 null。自定义技能没有可靠的每日基线时不下发。朋友人数读取原生日标志；超过界限时不给部分总数。money 暂为 null，避免把结算前钱包误称为结算后金额。

## 限制

所有游戏对象只在游戏线程读取，HTTP 返回不可变 DTO。事件每轮至多 16 个、元数据/缓存索引每轮至多 32 条，循环以 1.5 ms 为软预算。单个原生调用、首次 JIT 或序列化不能被抢占，冷加载仍可能超出这个时间。`/v1/perf` 的 events.slice、events.definitions、events.triggers、mine.monsters、night.summary 可用于区分阶段。电脑检查不代表设备持续帧率或交互验收。
