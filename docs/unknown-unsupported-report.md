# Effect Parse Unknown / Unsupported Report

Generated from public/item-index.json and public/skill-index.json.

## Summary

- Structured unknown effects: 11
- Semantic unsupported cards: 633

## Unsupported Reason Summary

| reason | count |
| --- | --- |
| scaling/formula/reference values | 307 |
| status/stat modifiers | 130 |
| card state/create/transform/destroy | 100 |
| positional/slot/size targeting | 63 |
| economy/value/shop | 26 |
| other | 4 |
| conditions/triggers | 3 |

## Structured Unknown Effects

| type | name | rawText | triggerType | sourceEvent | actionType | sourceAction | targetType |
| --- | --- | --- | --- | --- | --- | --- | --- |
| item | 幸运饼干 |  | TTriggerUnknown | unknown | TActionUnknown | unknown | TTargetUnknown |
| skill | 不择手段 | The first time you use a non-Burn or non-Poison item each fight, Charge your Burn | TTriggerOnItemUsed | tag_item_used | TActionCardCharge | charge | TTargetUnknown |
| skill | 增强军火 | this gains 1 bonus | TTriggerOnCardFired | cooldown_ready | TActionUnknown | unknown | TTargetCardSelf |
| skill | 增强防御 | this gains 1 bonus | TTriggerOnCardFired | cooldown_ready | TActionUnknown | unknown | TTargetCardSelf |
| skill | 快乐露营者 | The first time you fall below half Health each fight, Haste your Burn | TTriggerOnFightStarted | combat_start | TActionCardHaste | haste | TTargetUnknown |
| skill | 持久怒火 | You are Enraged for 1 second longer |  |  | TActionUnknown | unknown | TTargetUnknown |
| skill | 教团成员 | You have joined the Cult |  |  | TActionUnknown | unknown | TTargetUnknown |
| skill | 朱尔斯点拨：冷藏箱 | One of your slots becomes a Cooler (The item here is Chilled) | TTriggerUnknown | unknown | TActionCardFreeze | freeze | TTargetCardSection |
| skill | 朱尔斯点拨：炉灶 | One of your slots becomes a Stove (The item here is Heated) | TTriggerUnknown | unknown | TActionPlayerBurnApply | burn | TTargetPlayerRelative |
| skill | 缩短暴怒 | You are Enraged for 1 second shorter |  |  | TActionUnknown | unknown | TTargetUnknown |
| skill | 限速器 | All Charge effects are reduced by half | TTriggerUnknown | unknown | TActionCardCharge | charge | TTargetUnknown |

## Semantic Unsupported Cards

| type | name | reason | unknownAtomicActions | rawText |
| --- | --- | --- | --- | --- |
| item | “已打烊”标牌 | scaling/formula/reference values | 1 | When you use a Property or Tool, gain Max Health equal to 1 times its value |
| item | “营业中”标牌 | scaling/formula/reference values | 1 | When you use a Property, increase its value by 2 times this item's value |
| item | 3D 打印机 | card state/create/transform/destroy | 1 | Transform into 3 copies of the Small item to the left |
| item | VIP 通行证 | scaling/formula/reference values | 1 | Haste adjacent Properties for 2 Haste second(s) When you use an adjacent Property, increase its value by 4 |
| item | Z-剑 | scaling/formula/reference values | 2 | Deal 50 Damage Damage Burn 10 Burn Adjacent items' Cooldowns are reduced by 10% This has +1 Multicast if you have a Large item |
| item | Z-护盾 | scaling/formula/reference values | 2 | Shield 75 Shield Freeze an item for 1 Freeze second(s) Adjacent items' Cooldowns are reduced by 10% This has +1 Multicast if you have a Large item |
| item | 万剑之王 | scaling/formula/reference values | 1 | Deal 150 Damage Damage This has +1 Multicast for each other item you have from another Hero |
| item | 万能酱料 | scaling/formula/reference values | 1 | A Food gains +4 Crit% Crit Chance |
| item | 三叉网 | status/stat modifiers | 1 | Deal 3 Damage Damage Slow 1 item for 1 Slow second(s) When you Slow, this gains 3 Damage Multicast: 3 |
| item | 三德刀 | scaling/formula/reference values | 1 | Deal 5 Damage Damage This gains 5 Crit% Crit Chance The item to the left has +Crit Chance equal to this item's Crit Chance |
| item | 三花 | scaling/formula/reference values | 1 | Deal 15 Damage Damage When you use another Weapon, this gains 5 Crit% Crit Chance |
| item | 不稳定重力井 | card state/create/transform/destroy | 2 | All your items start Flying Destroy this and an enemy item with no Cooldown |
| item | 乌瓦希瓦利鸟 | scaling/formula/reference values | 2 | Heal 20 Heal At the start of each fight, this starts Flying This has +1 Multicast for each Property or Vehicle you have |
| item | 云精灵 | card state/create/transform/destroy | 1 | Haste the item to the left for 1 Haste second(s) When this is transformed, Enchant it with Turbo if able |
| item | 亚罕典籍 | scaling/formula/reference values | 1 | When you transform a Reagent, permanently gain Regen 3 Heal At the start of each day, get a Small Reagent |
| item | 产药药水 | card state/create/transform/destroy | 2 | Transform into 2 Small Potions from any Hero When you buy this, get a Catalyst |
| item | 仙女雕像 | card state/create/transform/destroy | 1 | When you defeat a Monster with this, transform this into an Enchanted Friend from any Hero |
| item | 仪式匕首 | scaling/formula/reference values | 1 | Deal 2 Damage Damage Regen equal to this item's Damage If you are a Cult Member, reduce this item's cooldown by 1 second |
| item | 仿生手臂 | scaling/formula/reference values | 1 | Deal 50 Damage Damage for each item to the left For each Tech item to the right, reduce this item's Cooldown by 1 second |
| item | 企鹅占卜机 | economy/value/shop | 1 | Your items gain 3 value |
| item | 优惠券 | scaling/formula/reference values | 1 | When you sell this at a Merchant, discount its items by 50% |
| item | 传家宝 | scaling/formula/reference values | 1 | Shield equal to double this item's value This has +10 value in combat |
| item | 伪装 | card state/create/transform/destroy | 1 | When you use an item from another Hero, Charge 1 item(s) from your Hero 1 Charge second When you buy this, get a Small or Medium item from another Hero |
| item | 作战无人机 | scaling/formula/reference values | 1 | Deal 35 Damage Damage If you have another Tool, Tech, Drone or Vehicle, this has +1 Multicast for each |
| item | 作战气球 | status/stat modifiers | 1 | An item starts Flying Shield 25 Shield When you Burn, Charge this 2 Charge second(s) |
| item | 侦察望远镜 | scaling/formula/reference values | 1 | When you Slow, an item gains 10 Crit% Crit Chance At the start of each fight, increase an enemy item's Cooldown by 3 seconds |
| item | 保险箱 | economy/value/shop | 1 | When you sell this, get 3 Spare Change |
| item | 信号枪 | status/stat modifiers | 2 | A Vehicle starts Flying Burn 10 Burn While your enemy is Burned, the Cooldown of your Vehicles is reduced by 1 second |
| item | 倒刺利爪 | scaling/formula/reference values | 1 | Deal 5 Damage Damage This has +1 Multicast for each Poisoned Player |
| item | 储粮柜 | card state/create/transform/destroy | 1 | When you use a Food, charge another Food 2 Charge seconds At the start of each day, get a Small or Medium Food from any Hero |
| item | 催化剂 | card state/create/transform/destroy | 1 | When you sell this, transform your leftmost item |
| item | 元素深水炸弹 | scaling/formula/reference values | 1 | Poison 4 Poison, Burn 4 Burn, and Freeze an item for 1 Freeze second(s) This has +1 Multicast for each other Aquatic item you have |
| item | 先祖墓 | scaling/formula/reference values | 1 | Regen 5 Regen This has +1 Multicast for each other Relic you have |
| item | 全息投影仪 | card state/create/transform/destroy | 1 | At the start of each fight, transform into a copy of another Small, non-Legendary item you have |
| item | 公文包 | conditions/triggers | 1 | Deal 30 Damage Damage When you win a fight with this, get 2 Spare Change |
| item | 共振水晶 | card state/create/transform/destroy | 1 | When you sell this, upgrade 1 of your items from other Heroes |
| item | 兽牙 | positional/slot/size targeting | 1 | When you use an adjacent Weapon, gain 4 Rage Rage When you Enrage, adjacent Weapons gain 30 Damage |
| item | 兽皮 | economy/value/shop | 1 | Sells for Gold |
| item | 内存卡 | scaling/formula/reference values | 2 | This permanently gains 1 Value When you sell this, your Core permanently gains +Crit Chance equal to this item's value |
| item | 农贸集市 | scaling/formula/reference values | 2 | Adjacent Regen items have +Regen equal to 1% of your Max Health When you sell a Food, gain Max Health equal to 3 times that Food's Value Your Food have +1 sell value |
| item | 冰块 | status/stat modifiers | 1 | Freeze an item for 1 Freeze second(s) Chilled: This has +3 Ammo Max Ammo |
| item | 冰天鹅 | positional/slot/size targeting | 1 | Freeze your Chilled items for 3 Freeze second(s) Chilled: Your Small Chilled items have +1 Multicast and adjacent items are Chilled |
| item | 冰沙 | status/stat modifiers | 1 | Shield 20 Shield Freeze an item for 0.5 Freeze second(s) Chilled: This has +1 Multicast |
| item | 冰箱 | positional/slot/size targeting | 1 | When you Freeze, Shield 30 Shield and Regen 3 Regen Chilled: Adjacent items are Chilled |
| item | 冰霜之怖 | card state/create/transform/destroy | 1 | Freeze 2 items for 1 Freeze second(s) When this runs out of Ammo, Poison both Players 100 Poison When this is transformed, Enchant it with Icy if able |
| item | 冻酸奶车 | card state/create/transform/destroy | 2 | Adjacent items are Chilled When you use a Chilled item, Freeze an item for 0.5 Freeze second(s) At the start of each day, get a Sorbet |
| item | 凡躯之缚 | positional/slot/size targeting | 2 | Deal 50 Damage Damage The Weapon to the left has lifesteal Lifesteal |
| item | 刃甲 | status/stat modifiers | 1 | Deal 10 Damage Damage Shield 10 Shield Multicast: 4 |
| item | 分解射线 | card state/create/transform/destroy | 1 | Deal 100 Damage Damage When this runs out of Ammo, destroy an enemy item |
| item | 刨丝器 | scaling/formula/reference values | 1 | Deal 1 Damage Damage Slow an item for 1 Slow second(s) For each adjacent Food, this has +1 Multicast |
| item | 制图桌 | scaling/formula/reference values | 1 | Charge your non-Tool items 1 second for each Tool you have At the start of each day, if you have 3 or more Tools, upgrade a lower tier Vehicle or Drone |
| item | 制面机 | card state/create/transform/destroy | 1 | Haste adjacent Food for 2 Haste second(s) At the start of each day, get a Pasta |
| item | 加密货币 | economy/value/shop | 1 | At the start of each hour, set this item's value to a number between 0 and 5 |
| item | 加特林机枪 | scaling/formula/reference values | 1 | Deal 25 Damage Damage This gains +5 Crit% Crit Chance The first time you use this, this item's Cooldown is halved Multicast: 2 |
| item | 劳雷尔堡垒 | scaling/formula/reference values | 1 | Shield 50 Shield Regen 5 Regen This has +1 Multicast for each unique Type on other items you have |
| item | 升级锤 | card state/create/transform/destroy | 1 | When you sell this, upgrade your leftmost item of a lower tier |
| item | 午餐盒 | card state/create/transform/destroy | 1 | At the start of each day, get a Small Food from any Hero When you sell a Food, Regen 1 Heal |
| item | 华丽巫师帽 | scaling/formula/reference values | 1 | Your items gain 6 Damage, 6 Heal and 6 Shield If you have another Tool, Weapon, Property or Apparel this has +1 Multicast for each |
| item | 卡拉飞艇 | positional/slot/size targeting | 1 | This and an adjacent item starts Flying Deal 5 Damage Damage Your Flying items have +15 Damage |
| item | 原始核心 | positional/slot/size targeting | 1 | Deal 30 Damage Damage Your Dinosaur and Relic Weapons gain 10 Damage Adjacent items are Relics When you use another Dinosaur or Relic, Charge this 1 Charge second |
| item | 原子钟 | status/stat modifiers | 1 | Increase an enemy item's Cooldown by 1 second(s) |
| item | 原木陷阱 | status/stat modifiers | 1 | The first time your enemy uses an item each fight, deal 500 Damage Damage and Slow all their items for 1 Slow second(s) When you Enrage, this item can trigger an additional time this fight |
| item | 厨师帽 | scaling/formula/reference values | 1 | Shield 10 for each Food you have When you buy this, get a small Food from any hero |
| item | 厨师机 | scaling/formula/reference values | 1 | Haste a Food for 2 Haste seconds When you Haste a Food, it gains 5 Crit% Crit Chance Multicast: 2 |
| item | 厨房秤 | positional/slot/size targeting | 1 | Haste adjacent items for 2 Haste seconds If adjacent items are the same size, this item's Cooldown is halved |
| item | 双刃匕首 | scaling/formula/reference values | 1 | Deal 5 Damage Damage This has +100% Crit Chance while you are not Enraged |
| item | 双头刀 | status/stat modifiers | 1 | Deal 5 Damage Damage Multicast: 2 |
| item | 双头巨锤 | scaling/formula/reference values | 1 | Deal Damage equal to 20% of your Max Health Multicast: 2 |
| item | 双峰驼兽 | scaling/formula/reference values | 2 | Deal 80 Damage Damage This has the Types of items you have in your Stash This has +1 Multicast for each of its Types |
| item | 双管霰弹枪 | status/stat modifiers | 1 | Deal 20 Damage Damage Multicast: 2 |
| item | 反物质舱 | card state/create/transform/destroy | 2 | Destroy this When this is Destroyed, destroy 3 enemy items When you use another Tech, Charge this 2 Charge second(s) |
| item | 发射台 | status/stat modifiers | 1 | An item starts Flying When you use a Friend or Flying item, Burn 6 Burn |
| item | 发射塔 | status/stat modifiers | 1 | Charge your other Vehicles and Drones 1 Charge seconds The first time you use an item each fight, all your Vehicles and Drones start Flying Your Flying items have +50 Damage |
| item | 发射核心 | status/stat modifiers | 1 | 2 other items start Flying Charge your other Flying items 1 Charge second When you use another Friend or Flying item, Charge this 1 Charge second |
| item | 发条刀 | scaling/formula/reference values | 1 | Deal 20 Damage Damage When you sell this, reduce your items' Cooldowns by 1% |
| item | 发条圆盘 | status/stat modifiers | 1 | This starts or stops Flying Deal 10 Damage Damage |
| item | 口香糖球贩售机 | scaling/formula/reference values | 1 | Shield 10 for each Small item you have in your Stash At the start of each hour, spend 1 Gold to get a Gumball |
| item | 吊床 | scaling/formula/reference values | 1 | Gain Max Health equal to the value of adjacent items When you gain Max Health, your items gain 5 Heal and 5 Shield |
| item | 名片 | scaling/formula/reference values | 2 | When you visit a Merchant, this permanently gains 1 value For every 5 Merchants you visit, upgrade this |
| item | 吐司机 | positional/slot/size targeting | 1 | Burn 1 Burn When you use an adjacent Food, this gains 1 Burn Multicast: 2 |
| item | 吸血章鱼 | scaling/formula/reference values | 1 | Deal 15 Damage Damage This has +damage equal to its Crit Chance Lifesteal |
| item | 和平铸箱 | card state/create/transform/destroy | 1 | Regen 4 Regen When you visit a Merchant, destroy the item to the left to increase this item's Regen by its Value When you destroy an item, gain 2 Gold |
| item | 喀斯特 | scaling/formula/reference values | 1 | When you use a Friend or non-Weapon item, gain 6 Rage Rage and Shield 15 Shield Your Enrage lasts half as long |
| item | 喷射摩托 | positional/slot/size targeting | 1 | Deal 200 Damage Damage When you use an adjacent item, it and this start Flying When you use another Flying item, Charge this 1 Charge second |
| item | 回声水晶 | card state/create/transform/destroy | 1 | When you sell this, transform your leftmost item into an item from another Hero and upgrade it |
| item | 回收机器人 | positional/slot/size targeting | 1 | Shield 20 Shield Repair 1 Small items |
| item | 回收桶 | card state/create/transform/destroy | 2 | When you use a Potion, transform it into another Potion from any Hero Your Potions' Cooldowns are reduced by 0.5 seconds |
| item | 回旋镖 | card state/create/transform/destroy | 2 | This starts Flying Deal 20 Damage Damage When you win a fight against a Monster with this, get a Loot item |
| item | 回馈卡 | scaling/formula/reference values | 1 | When you visit a Merchant, this and the item to the left permanently gain 1 value |
| item | 图书馆 | status/stat modifiers | 2 | All Weapon Cooldowns are increased by 1 second(s) Your non-Weapon item Cooldowns are decreased by 1 second(s) |
| item | 地下商街 | scaling/formula/reference values | 1 | Heal equal to 4 Heal times the value of your items Your other Properties have +Value equal to this item's Value during combat |
| item | 地窖 | card state/create/transform/destroy | 2 | Reload 1 item(s) Regen 1 Regen At the start of each day, get a Catalyst |
| item | 坠落地点探险券 | other | 1 | On Day 6, allows you to embark on the Crash Site Expedition |
| item | 坦提乌斯运输舰 | positional/slot/size targeting | 2 | Deal 100 Damage Damage When you use a Drone, this gains 50 Damage Your other Vehicles are Drones Adjacent Drones have +1 Multicast |
| item | 坩埚 | scaling/formula/reference values | 1 | Burn 2 Burn for each type this has Poison 2 Poison for each type this has This has the Types of items you have |
| item | 塔兹迪亚匕首 | positional/slot/size targeting | 1 | Deal 10 Damage Damage The Potion to the left has +1 Ammo Ammo |
| item | 填弹杆 | scaling/formula/reference values | 2 | Reload adjacent items When you Reload an item, it gains +5 Crit% Crit Chance |
| item | 复仇符印 | status/stat modifiers | 2 | When your enemy uses an item, gain 4 Rage Rage While you are Enraged, your Weapons have Lifesteal |
| item | 复制器 | card state/create/transform/destroy | 1 | Charge adjacent items from another Hero 2 Charge second(s) At the start of each day, get an item from another Hero |
| item | 多尔王主机 | positional/slot/size targeting | 1 | When you use a Friend, Charge a Core 1 Charge second(s) and Haste a Large item 1 Haste second(s) Your Dooltron has the Core type |
| item | 大块头 | scaling/formula/reference values | 1 | Destroy this When this is destroyed, deal Damage equal to 25% of your enemy's Max Health |
| item | 大坝 | card state/create/transform/destroy | 1 | Destroy this and all Smaller items When you use another Aquatic item, Charge this 1 Charge second(s) |
| item | 大师之作 | scaling/formula/reference values | 1 | At the start of each hour, this permanently gains 2 value |
| item | 大红灯笼 | scaling/formula/reference values | 1 | Adjacent items have +20 Crit% Crit Chance While this is Flying, this has double Crit Chance bonus |
| item | 天气机 | status/stat modifiers | 1 | 2 items start Flying Freeze an item on each Player's board for 1 Freeze second(s) Slow all items for 1 Slow second(s) |
| item | 天空之锚 | positional/slot/size targeting | 1 | Deal 75 Damage Damage Adjacent items stop Flying When you Slow, Charge this 2 Charge seconds |
| item | 天际舰 | scaling/formula/reference values | 1 | Deal 150 Damage Damage Burn 25 Burn This has +1 Multicast for each Flying item you have |
| item | 太阳能无人机 | status/stat modifiers | 1 | This starts Flying Shield 10 Shield When you Burn, this gains 5 Shield |
| item | 失落之刃 | scaling/formula/reference values | 1 | Deal Damage equal to 20% of your Max Health If this is your only item with a Cooldown, its Cooldown is reduced by 5 seconds |
| item | 奇点 | card state/create/transform/destroy | 1 | Destroy an enemy item |
| item | 奇美拉之卵 | scaling/formula/reference values | 3 | At the start of each day, this permanently gains +4 value When you sell this, get an Enchanted Small Friend from any hero When this item's value reaches 10 out of combat, upgrade it |
| item | 套娃 | scaling/formula/reference values | 1 | Shield equal to this item's Ammo At the start of each day, this permanently gains 1 Ammo Max Ammo |
| item | 奥秘之书 | card state/create/transform/destroy | 1 | At the start of each day, get a random Skill from any Hero |
| item | 妈妈暴龙 | scaling/formula/reference values | 1 | Deal 200 Damage Damage The first time you use this each fight, destroy a Small or Medium enemy item When you destroy an item, double this item's Damage |
| item | 姜饼小屋 | scaling/formula/reference values | 1 | Heated: Burn equal to 10% of your Shield At the start of each day, get a Gingerbread Man When you use a Food or Tool, gain 40 Shield |
| item | 学习水晶 | economy/value/shop | 1 | When you sell this, learn a Skill from another Hero |
| item | 宇宙护符 | status/stat modifiers | 2 | Haste an item for 1 Haste second(s) When you Crit, this starts Flying While this is Flying, it has +1 Multicast |
| item | 宇宙炫羽 | scaling/formula/reference values | 1 | An item starts Flying and your Flying items gain +5 Crit% Crit Chance When you Crit or use a Flying item, Charge this 1 Charge second(s) |
| item | 安保无人机 | status/stat modifiers | 1 | Shield 20 Shield When an enemy uses an item, Charge this 1 Charge second While this is Flying, reduce its cooldown by 2 seconds |
| item | 安心毯 | card state/create/transform/destroy | 1 | Heal 25 Heal Shield 25 Shield When this is Slowed, Frozen or Destroyed, gain 10 Rage Rage |
| item | 定制准镜 | scaling/formula/reference values | 1 | The Weapon to the right has +20 Crit% Crit Chance If you have exactly one Weapon, when you Crit with it Charge a non-Weapon item 1 Charge second(s) |
| item | 实验室 | card state/create/transform/destroy | 2 | Enchant another non-Enchanted item Charge your other Relics and Enchanted items 1 Charge second(s) At the start of each day, get a Catalyst |
| item | 实验车库 | scaling/formula/reference values | 2 | At the start of each fight, enchant all enemy items and your non-Enchanted items Your items have their cooldowns reduced by 10% |
| item | 寒冰滑道 | positional/slot/size targeting | 1 | Freeze adjacent items for 1 Freeze second(s) Reduce the Cooldown of adjacent items by 1 second(s) |
| item | 寒冰炸弹 | card state/create/transform/destroy | 1 | Freeze 1 item(s) for 1 Freeze second(s) Destroy this |
| item | 小圆猪 | card state/create/transform/destroy | 2 | Charge adjacent Small items 1 Charge second(s) When you win a fight, get a Piggle At the start of each day, upgrade a Piggle |
| item | 小圆猪发射器 | positional/slot/size targeting | 1 | A Small item starts Flying Deal 10 Damage Damage<br><br>Shield 10 Shield<br><br>Heal 10 Heal<br><br>Burn 2 Burn When you use a Small item, Charge this 1 Charge second(s) |
| item | 小黛暴龙 | card state/create/transform/destroy | 1 | Deal 50 Damage Damage The first time you use this each fight, destroy a Small enemy item When you destroy an item, your Dinosaurs and Relics gain 20 Damage Damage |
| item | 尖刺臂缠 | status/stat modifiers | 1 | Deal 10 Damage Damage When you Enrage, this item's Cooldown is reduced by 2 seconds |
| item | 展示柜 | scaling/formula/reference values | 1 | At the start of each fight, all items on your board permanently gain +1 value When you use an item with value over 10, Shield 10 Shield |
| item | 岛弹小姐 | status/stat modifiers | 1 | Deal 20 Damage Damage When you use a Core, this gains 5 Damage and Reload it Multicast: 2 |
| item | 工具箱 | card state/create/transform/destroy | 1 | Repair and Haste the item to the right for 2 Haste seconds At the start of each day, get a Small Tool from any Hero |
| item | 工具腰带 | positional/slot/size targeting | 1 | When you use a Tool, gain 10 Rage Rage When you Slow an adjacent item, Shield 10 Shield When an adjacent item Crits, Haste it 1 Haste second(s) and Reload another item |
| item | 工蜂 | status/stat modifiers | 1 | This starts Flying Deal 5 Damage Damage |
| item | 工装短裤 | scaling/formula/reference values | 2 | Heal 10 Heal Shield 10 Shield This has +1 Multicast for each Type this has This has the Types of items you have |
| item | 巨像之眼 | card state/create/transform/destroy | 1 | Destroy an enemy item When you use an adjacent item, Charge this 1 Charge second(s) |
| item | 巨型冰棒 | economy/value/shop | 1 | Deal 50 Damage Damage Freeze 2 items for 1 Freeze second(s) When you sell this, gain 2 Icicles |
| item | 巨蟒 | scaling/formula/reference values | 2 | Deal damage equal to double the Rage you have gained this fight When you Enrage, this gains +3 Multicast Multicast: 2 |
| item | 巨魔龙 | scaling/formula/reference values | 1 | Deal 50 Damage Damage Burn equal to 10% of this item's Damage The first time ANY Player falls below half Health, Destroy a Small item When you destroy an item, use this |
| item | 巨鹰 | scaling/formula/reference values | 1 | Deal 300 Damage Damage Your Flying items have +50% Damage and Shield When you Enrage, 3 of your items start Flying |
| item | 巨龙崽崽 | scaling/formula/reference values | 1 | This starts Flying Deal 5 Damage Damage Burn equal to this item's Damage |
| item | 巨龙翼 | status/stat modifiers | 1 | An item starts Flying Shield 40 Shield When you Burn, Charge this 2 Charge second(s) |
| item | 干扰箔 | card state/create/transform/destroy | 1 | When an adjacent item Burns, Shield 10 Shield When an enemy would destroy your items, this is destroyed instead |
| item | 平衡车 | scaling/formula/reference values | 1 | Haste 1 item(s) for 1 Haste second(s) This has +1 Multicast for each adjacent Tool |
| item | 幸运三叶草 | scaling/formula/reference values | 1 | Merchant items have a 10% chance to upgrade to a higher tier |
| item | 广告牌 | scaling/formula/reference values | 2 | Shield equal to 2 times this item's value When you use an item, it gains +20% value Your lowest value item has +1 Multicast |
| item | 废品场维修机器人 | scaling/formula/reference values | 1 | Repair an item Heal 30 Heal When you sell this, your leftmost Heal item permanently gains 5 Heal |
| item | 开瓶器 | positional/slot/size targeting | 1 | Deal 20 Damage damage The first time you use this each fight, use the Medium Food to the left |
| item | 引导灯 | status/stat modifiers | 1 | 1 items stop Flying |
| item | 弩炮 | status/stat modifiers | 1 | Deal 200 Damage Damage When you use another Ammo item, this gains 1 Multicast |
| item | 弹力裤 | status/stat modifiers | 2 | Heal 10 Heal Shield 10 Shield When you Enrage, this gains +1 Multicast Multicast: 2 |
| item | 弹弓 | scaling/formula/reference values | 2 | Another Small item starts Flying Deal 20 Damage Damage This has +2 Max Ammo for each Toy you have |
| item | 弹药带 | status/stat modifiers | 2 | When you use an ammo item, gain 10 Rage Rage When you Enrage and stop being Enraged, Reload all your items |
| item | 弹跳棒 | positional/slot/size targeting | 1 | This starts or stops Flying When this starts Flying, Shield 75 Shield When this stops Flying, Charge adjacent items 1 Charge second |
| item | 强化飞碟 | card state/create/transform/destroy | 1 | Deal 150 Damage Damage Repair an item When you Repair or Transform in combat, this gains 150 Damage When you Destroy an item, Charge this 4 Charge second(s) |
| item | 当铺 | scaling/formula/reference values | 2 | When you sell an item, this permanently gains 1 value You have increased Max Health equal to 10 times this item's value |
| item | 彩绘玻璃窗 | scaling/formula/reference values | 3 | When you win a fight with this, your Properties permanently gain 5 value (including Stash) When you lose a fight with this, permanently destroy it If you have 5 or fewer items, their Cooldowns are reduced by 5% |
| item | 彩虹法杖 | card state/create/transform/destroy | 1 | Burn 6 Burn<br> <br>Poison 6 Poison Freeze an item for 1 Freeze second(s)<br> <br>Slow an item for 2 Slow second(s) When you buy this and at the start of each day, enchant this |
| item | 微波炉 | status/stat modifiers | 1 | Haste your Food for 2 Haste seconds Heated: This item's cooldown is reduced by 2 seconds |
| item | 徽印戒指 | scaling/formula/reference values | 1 | At the start of each hour, permanently gain 5 Heal Max Health You have +1 Income |
| item | 恐龙伪装 | scaling/formula/reference values | 2 | Shield 20 Shield Adjacent items are Dinosaurs This has +1 Multicast for each other Relic or Dinosaur you have |
| item | 恐龙小锯 | status/stat modifiers | 1 | Deal 10 Damage Damage This item's Cooldown is reduced by 3 seconds if you have at least 3 other Dinosaurs, Tools or Relics |
| item | 恐龙鞍 | status/stat modifiers | 2 | Shield 50 Shield Your Vehicles have +1 Multicast If you have a Dinosaur, this is a Vehicle |
| item | 恶臭蘑菇 | status/stat modifiers | 1 | When any item is used, increase its cooldown by 0.5 second(s) |
| item | 悬挂滑翔翼 | status/stat modifiers | 1 | Your other items start Flying Your Flying Weapons and this gain 35 Damage When your items stop Flying, deal 100 Damage Damage |
| item | 悬浮科技 | scaling/formula/reference values | 3 | 3 other items start Flying When you Crit with a Flying item, it stops Flying Your Flying items have +50 Crit% Crit Chance |
| item | 战斧 | status/stat modifiers | 1 | Deal 60 Damage Damage When you Enrage, this gains 60 Damage While you are Enraged, this has its Cooldown reduced by 4 seconds |
| item | 战纹涂料 | positional/slot/size targeting | 1 | When you use the item to the left, gain 8 Rage Rage |
| item | 手里剑 | scaling/formula/reference values | 2 | Deal 5 Damage Damage This has Multicast equal to its current ammo When you use this, spend all its Ammo |
| item | 手锯 | card state/create/transform/destroy | 1 | Deal 50 Damage Damage Transform an enemy Medium item into 2 Small items |
| item | 扑翼机 | positional/slot/size targeting | 1 | An adjacent item starts Flying Your Flying items have +5 Damage |
| item | 打蛋器 | status/stat modifiers | 1 | Deal 15 Damage Damage Reduce this item's Cooldown by 1 second |
| item | 扳手 | scaling/formula/reference values | 1 | Deal 10 Damage Damage At the start of each day, upgrade a Tool of a lower tier While this is Flying, this has double Damage |
| item | 技能兑换券 | economy/value/shop | 1 | When you sell this, learn a skill from any Hero |
| item | 抓取工具 | card state/create/transform/destroy | 1 | Destroy the leftmost enemy Medium item and transform this into it |
| item | 投掷捕兽网 | scaling/formula/reference values | 1 | Slow an item for 1 Slow second(s) This has +1 Multicast for each Weapon or Friend an enemy has |
| item | 投送无人机 | card state/create/transform/destroy | 1 | Charge another Flying item 1 Charge seconds At the start of each day, get a Loot item |
| item | 披萨 | status/stat modifiers | 1 | Regen 2 Regen Heated: Burn 2 Burn Multicast: 6 |
| item | 抽奖券 | economy/value/shop | 1 | When you sell this, gain 0 to 5 Gold |
| item | 拆信刀 | scaling/formula/reference values | 1 | Deal 10 Damage Damage This loses 25 Crit% Crit Chance |
| item | 拆卸场 | card state/create/transform/destroy | 2 | Repair all your items When you Destroy an item, Shield 120 Shield At the end of each fight, get a Scrap |
| item | 拳台之王臂铠 | scaling/formula/reference values | 2 | Deal Damage equal to 1 Damage times your Income While in play, you have +1 Income Multicast: 2 |
| item | 挎包 | scaling/formula/reference values | 1 | Reload 2 items When you reload, Regen 2 Regen When you buy a Potion, permanently increase this item's Regen by +2 Regen |
| item | 掠夺双刃 | scaling/formula/reference values | 1 | Deal 25 Damage Damage When you Haste, this gains 5 Crit% Crit Chance This has +Damage equal to its Crit Chance Multicast: 2 |
| item | 探寻探测器 | scaling/formula/reference values | 2 | Deal 5 Damage Damage When an enemy uses an item, this gains 5 Crit% Crit Chance When you Crit with this, destroy this and a Small enemy item |
| item | 推土比尔 | scaling/formula/reference values | 1 | Deal 10 Damage Damage When you use another Friend, this gains 40 Damage Damage Your other Friends' Cooldowns are reduced by 15% |
| item | 推进器 | scaling/formula/reference values | 2 | At the start of each fight, the item to the left starts Flying The item to the left is a Vehicle and its Cooldown is reduced by 3% |
| item | 提纯阳光 | scaling/formula/reference values | 2 | The Cooldown of the item to the left is reduced by 5% When this is transformed, Enchant it with Shiny if able |
| item | 搅拌机 | card state/create/transform/destroy | 2 | Transform an adjacent non-Legendary Small item into a Slushee When you Freeze, Haste an item for 1 Haste second(s) Chilled: Your Slushees are Chilled |
| item | 摇钱树 | scaling/formula/reference values | 2 | Heal equal to triple this item's Value When you Level Up and at the start of each day, get a Spare Change When you sell a Spare Change, this permanently gains +2 Value |
| item | 摩天大楼 | scaling/formula/reference values | 2 | Deal Damage equal to 2 times the value of your items This has double value in combat If you have 5 or fewer items, this has +1 Multicast |
| item | 摩空大楼 | scaling/formula/reference values | 1 | Shield equal to 2 times the value of your items This has triple value during combat |
| item | 收银机 | conditions/triggers | 1 | At the start of each day, get 3 Spare Change |
| item | 断路器 DJ | economy/value/shop | 1 | Haste your Friends for 2 Haste second(s) When you buy this, get 1 Nanobots When you use another Friend, Charge this 1 Charge second |
| item | 斯黛尔的工坊 | status/stat modifiers | 1 | Your Tools' Cooldowns are reduced by 1 second(s) When you use a Tool, Charge 1 Vehicle(s) or Drone(s) 1 Charge second |
| item | 方便面 | positional/slot/size targeting | 1 | Heated: Burn 2 Burn Chilled: Regen 2 Regen If you have a Medium Tool, this item's cooldown is reduced by 2 seconds |
| item | 旗舰 | scaling/formula/reference values | 1 | Deal 50 Damage Damage If you have another Tool, Property, Friend, Ammo or Relic item this has +1 Multicast for each |
| item | 无限药水 | status/stat modifiers | 1 | Regen 3 Regen Reload this |
| item | 日蚀号 | scaling/formula/reference values | 1 | Use all your other items When you use an item, deal 100 Damage Damage The first time you fall below half Health each fight, use this |
| item | 时光指针 | status/stat modifiers | 1 | Reduce another Tool's Cooldown by 1 second |
| item | 时流屏障 | status/stat modifiers | 1 | Shield 75 Shield Non-Tech item Cooldowns are increased by 1 second(s) |
| item | 时空穿梭机 | card state/create/transform/destroy | 2 | Haste adjacent items for 2 Haste seconds If this is your only Tech item, its Cooldown is halved At the start of each day, get a Relic from any hero |
| item | 星图 | scaling/formula/reference values | 1 | Adjacent items have +10 Crit% Crit Chance Adjacent items' Cooldowns are reduced by 5% |
| item | 景观楼 | scaling/formula/reference values | 1 | Shield 200 Shield This gains +15 value Your items have +Shield equal to this item's value |
| item | 暗黑秘石引擎 | scaling/formula/reference values | 3 | Deal 100 Damage Damage At the start of each fight, Enchant a non-Enchanted item with Obsidian This has +1 Multicast for each Obsidian-Enchanted item you have Lifesteal |
| item | 暗黑秘石聚能器 | scaling/formula/reference values | 3 | Deal 50 Damage Damage for each Weapon you have This item's Cooldown is reduced by 1 second for each other Relic you have When you sell this, Enchant your leftmost item with Obsidian Lifesteal |
| item | 曲速引擎 | scaling/formula/reference values | 3 | Destroy this Adjacent items are Vehicles Your Vehicles have their cooldowns reduced by 10% When this is Destroyed, Charge your items 2 Charge seconds |
| item | 曲颈甑 | scaling/formula/reference values | 1 | Poison 6 Poison This has +3 Poison for each Reagent you have transformed this run At the start of each day, spend 2 Gold to get a Chunk of Lead |
| item | 曳光手枪 | status/stat modifiers | 1 | Deal Damage Damage When you Crit, Reload this 1 Ammo |
| item | 望远镜 | scaling/formula/reference values | 1 | When you use a Flying item, an item gains 5 Crit% Crit Chance |
| item | 木桨 | status/stat modifiers | 1 | Deal 10 Damage Damage Your items gain 5 Damage Multicast: 2 |
| item | 机上餐点 | scaling/formula/reference values | 1 | Heal 50 Heal When your items start Flying, this gains 50 Heal When you sell this, gain 5% Max Health |
| item | 机器人工厂 | status/stat modifiers | 1 | Your Friends have +1 Multicast |
| item | 机库 | status/stat modifiers | 1 | Your items have +10 Damage and 10 Shield When you use a Flying item, Vehicle or Drone, increase this by 8 |
| item | 机甲暴龙 | scaling/formula/reference values | 2 | Deal 25 Damage Damage If your opponent has more items than you, destroy an item For each adjacent Dinosaur or Relic, this item's Cooldown is reduced by 1 second. When you use another Friend, or Relic, this gains 80 Damage. |
| item | 松露 | scaling/formula/reference values | 1 | When you sell this, your leftmost item permanently gains +1 value |
| item | 松饼 | status/stat modifiers | 1 | Shield 5 Shield Heated: This has +1 Multicast |
| item | 树木大棒 | positional/slot/size targeting | 2 | Deal 1000 Damage Damage When you use adjacent item, gain 10 Rage Rage This only charges itself while you are Enraged and its Cooldown is reduced by 7 seconds |
| item | 森林斗篷 | scaling/formula/reference values | 1 | You have +20% Max Health While you are Enraged, you take half Damage |
| item | 榨汁机 | scaling/formula/reference values | 1 | Destroy your leftmost Food Deal 10 Damage Damage When you Destroy one of your Food, double this item's Damage When you use a Food, this gains 5 Damage |
| item | 模型船 | scaling/formula/reference values | 1 | Shield equal to this item's value Adjacent Toys have +1 Multicast |
| item | 毒伞菇 | card state/create/transform/destroy | 1 | Poison 5 Poison When you use a Weapon, your items gain 1 Poison and 1 Regen When this is transformed, Enchant it with Toxic if able |
| item | 毒刺 | status/stat modifiers | 1 | Deal 5 Damage Damage Slow 1 item(s) for 1 Slow second(s) Lifesteal |
| item | 毒芹 | card state/create/transform/destroy | 1 | Poison 2 Poison When this is transformed, Enchant it with Toxic if able |
| item | 毛坯房 | scaling/formula/reference values | 1 | Shield equal to 1 Shield times this item's value At the start of each day, upgrade this |
| item | 气压步枪 | status/stat modifiers | 1 | Deal 50 Damage Damage When your items start Flying, this gains 25 Damage Damage When your items stop Flying, reload this |
| item | 气球引擎 | status/stat modifiers | 1 | An item starts Flying When your items start Flying, Burn 3 Burn |
| item | 气球机器人 | positional/slot/size targeting | 2 | Shield 20 Shield A Small item starts Flying While you are Shielded, this item's Cooldown is reduced by 2 seconds |
| item | 水晶盆景 | scaling/formula/reference values | 2 | Heal equal to 2 times this item's value At the start of each fight with this, it permanently gains 6 value When you lose a fight with this, permanently destroy it |
| item | 水蛭 | status/stat modifiers | 1 | Deal 20 Damage Damage When you Poison, this gains 10 Damage Damage Lifesteal |
| item | 水银 | card state/create/transform/destroy | 2 | Transform into a copy of another Small, non-Legendary item you have When you buy this, get a Catalyst |
| item | 沉眠元初体 | status/stat modifiers | 1 | Deal 15 Damage Damage When you Poison, Freeze, or Burn, Charge this 2 Charge second(s) and this gains 15 Damage Multicast: 4 |
| item | 沙漏 | scaling/formula/reference values | 1 | Adjacent items' Cooldowns are reduced by 6% |
| item | 沙袋 | card state/create/transform/destroy | 1 | 2 Vehicles start Flying When one of your Vehicles starts Flying, Charge it 1 Charge second When this is destroyed, Slow 2 items for 2 Slow seconds |
| item | 没药 | card state/create/transform/destroy | 1 | Regen 1 Regen When this is transformed, Enchant it with Restorative if able |
| item | 沸腾烧瓶 | positional/slot/size targeting | 2 | Reload adjacent Potions Adjacent Potions have +1 Multicast |
| item | 治疗药剂 | scaling/formula/reference values | 1 | Heal equal to 25% of your Max Health When you Enrage, Reload this |
| item | 注能护腕 | scaling/formula/reference values | 1 | Poison both Players 8 Poison When you Poison yourself, your Weapons gain + Damage equal to the amount Poisoned The Weapon to the left has Lifesteal |
| item | 泰迪熊 | status/stat modifiers | 1 | Deal 100 Damage Damage When you use another Toy, Friend or Ammo item, Charge this 1 Charge second(s) Multicast: 2 |
| item | 洗碗机 | scaling/formula/reference values | 1 | Heat your other Tools and Weapons for 3 seconds Haste your other Tools and Weapons for 3 Haste seconds Your Heated items have +50 Damage% Damage |
| item | 派对浮艇 | scaling/formula/reference values | 2 | An item starts Flying When you use a Flying item, Shield 50 Shield Your Flying items' Cooldowns are reduced by 10% |
| item | 浮筒滑翔艇 | status/stat modifiers | 2 | This and another item start Flying When you use another Flying item, this and it stop Flying When an item starts Flying, Shield 25 Shield and Charge it 1 Charge second(s) |
| item | 海底热泉 | status/stat modifiers | 1 | Burn 3 Burn Multicast: 3 |
| item | 海影宝驹 | scaling/formula/reference values | 2 | Reduce the Cooldown of your other items by 8% Increase this item's Cooldown by 4 second(s) |
| item | 海拔计 | scaling/formula/reference values | 1 | Charge adjacent items 1 Charge second(s) For each adjacent Flying item, this item's Cooldown is reduced by 2 seconds |
| item | 海狗沙龙 | scaling/formula/reference values | 1 | Haste an item for 2 Haste second(s) Slow an item for 2 Slow second(s) This has +1 Multicast for each Friend you have |
| item | 消音器 | scaling/formula/reference values | 1 | The item to the left has +25 Damage If you have exactly one Weapon, its Cooldown is reduced by 5% |
| item | 液压机 | scaling/formula/reference values | 1 | Deal 100 Damage Damage for each type this has At the end of each fight, permanently destroy the item to the left, gain 2 Gold, and this permanently gains that item's Types |
| item | 深潜器 | positional/slot/size targeting | 1 | Your leftmost and rightmost Aquatic Weapons gains 10 Damage Your leftmost and rightmost Aquatic Shield items gains 10 Shield If you have another Vehicle or Large item, this item's Cooldown is reduced by 2 seconds |
| item | 渔网 | card state/create/transform/destroy | 1 | Slow 1 item(s) for 2 Slow second(s) At the start of each day, get a Small Aquatic or Loot item from any Hero |
| item | 温馨海湾 | scaling/formula/reference values | 1 | Shield equal to this 1 times this item's value When you sell an item, this permanently gains 1 value |
| item | 港口 | card state/create/transform/destroy | 1 | Reload all your items 2 Ammo Ammo and Charge them 1 Charge second(s) At the start of each day, get a Small Ammo item from any hero |
| item | 湮灭核心 | card state/create/transform/destroy | 1 | Destroy an enemy item When you Destroy an item, Charge this 1 Charge second(s) |
| item | 湮灭漩涡 | scaling/formula/reference values | 1 | Destroy your leftmost item Charge your other items equal to half that item's cooldown |
| item | 湮灭火炮 | card state/create/transform/destroy | 1 | Destroy the smallest enemy item Deal 200 Damage Damage When an item is destroyed, this gains 200 Damage |
| item | 漩涡加农炮 | status/stat modifiers | 1 | Deal 50 Damage Damage ALL items start Flying When ANY Player uses a Flying item, this gains 30 Damage |
| item | 潜水头盔 | positional/slot/size targeting | 1 | When you use an Aquatic item, Shield 50 Shield Adjacent items are Aquatic in combat |
| item | 潜水配重 | scaling/formula/reference values | 2 | Haste an item for 1 Haste second(s) For each adjacent Aquatic item, this item's Cooldown is reduced by 1 second This has + Multicast equal to its ammo |
| item | 潜行滑翔机 | scaling/formula/reference values | 1 | An item starts Flying You take 10% less damage for each non-Glider Flying item you have |
| item | 火炮阵列 | status/stat modifiers | 1 | Deal 200 Damage Damage When you use another Weapon, Charge this 2 Charge second(s) Multicast: 3 |
| item | 火焰辣椒 | positional/slot/size targeting | 1 | Burn 2 Burn The item to the left is Heated |
| item | 火箭发射器 | status/stat modifiers | 1 | Deal 8 Damage Damage Burn 2 Burn Multicast: 3 |
| item | 火箭无人机 | status/stat modifiers | 2 | Deal 15 Damage Damage Burn 3 Burn This stops Flying When this item starts Flying, reload it |
| item | 火药 | scaling/formula/reference values | 1 | When you sell this, your leftmost Ammo item permanently gains 1 Ammo Max Ammo |
| item | 火药角 | positional/slot/size targeting | 1 | Reload the item to the right 1 Ammo Ammo |
| item | 火龙瓜 | scaling/formula/reference values | 1 | Shield equal to 15 Shield% of your Max Health Chilled: You have +25% Max Health |
| item | 灯泡 | card state/create/transform/destroy | 1 | Charge the Tech item to the right 1 Charge second(s) When you buy this, get a Small Tech item from any Hero |
| item | 灵能扩散器 | card state/create/transform/destroy | 1 | At the start of each fight, Enchant a non-Enchanted item on each Player's board When an enemy uses an Enchanted item, Charge an Enchanted item 2 Charge seconds |
| item | 炎蜷宝石 | scaling/formula/reference values | 2 | Burn 5 Burn for each Burn item you have This item's Cooldown is reduced by 1 second for each other Relic you have When you sell this, Enchant your leftmost item with Fiery |
| item | 炮弹 | status/stat modifiers | 1 | Your items have +1 Ammo Max Ammo |
| item | 炸裂旅程 | scaling/formula/reference values | 1 | Deal 50 Damage Damage Burn 5 Burn When this stops Flying, destroy it When this is destroyed, deal 10 times this item's Damage and Burn |
| item | 炼金梨缶 | scaling/formula/reference values | 2 | Poison 4 Poison This has +1 Multicast for each adjacent Potion or Reagent At the start of each day, get a Catalyst |
| item | 炼金炉 | card state/create/transform/destroy | 2 | Reload adjacent items When you use a Potion, Burn 8 Burn At the start of each day, upgrade a Potion of a lower tier and get a Catalyst |
| item | 烤串 | scaling/formula/reference values | 1 | Deal 10 Damage Damage Regen 1 Regen Heated: This has +100% Crit Chance |
| item | 烤土豆 | status/stat modifiers | 1 | Regen 1 Regen Heated: This has +1 Multicast |
| item | 烤箱 | status/stat modifiers | 2 | Your Food gain Heated for 4 seconds Your other Heated items have +1 Multicast |
| item | 烧烤架 | positional/slot/size targeting | 1 | When you use a Food, Burn 4 Burn When you use a Heated Food, this gains 1 Burn The item to the left is Heated |
| item | 烧钱炉 | scaling/formula/reference values | 2 | Burn equal to this item's value When you sell a Spare Change, this permanently gains +2 Value Spare Change have 0 Value |
| item | 热带岛屿 | card state/create/transform/destroy | 1 | When you Slow, Regen 5 Regen At the end of each fight, get a Coconut and a Citrus |
| item | 焊接枪 | positional/slot/size targeting | 2 | Burn 1 Burn This has +1 Multicast if it is adjacent to a Friend This has +1 Multicast if it is adjacent to a Tool |
| item | 煮蛋器 | status/stat modifiers | 1 | Charge all your Food 1 Charge second Multicast: 4 |
| item | 煅烧釜 | scaling/formula/reference values | 1 | Burn 6 Burn This has +3 Burn for each Reagent you have transformed this run At the start of each day, spend 2 Gold to get a Chunk of Lead |
| item | 煎锅 | scaling/formula/reference values | 1 | Burn 3 Burn For each adjacent Food, this has +1 Multicast |
| item | 熊爪 | status/stat modifiers | 1 | Deal 10 Damage Damage Gain 10 Rage Rage |
| item | 熊面具 | scaling/formula/reference values | 2 | The first time any item is used each fight, gain 30 Rage Rage When you Enrage, gain +10% Max Health |
| item | 熔岩压路机 | card state/create/transform/destroy | 1 | Destroy an adjacent item Burn 50 Burn When you destroy an item, this gains 50 Burn |
| item | 蒸馏器 | card state/create/transform/destroy | 2 | At the start of each day, get a Catalyst and transform the Small item to the left into a Potion When you buy this, get a Small Reagent |
| item | 燃烧炸弹 | card state/create/transform/destroy | 1 | Burn 6 Burn Destroy this |
| item | 爆炸机器人 | card state/create/transform/destroy | 1 | If this is Flying, destroy this When this is destroyed, deal 40 Damage damage When you Burn, this gains 20 Damage |
| item | 爆竹 | scaling/formula/reference values | 1 | Deal 20 Damage Damage When this runs out of ammo, destroy it When this is destroyed, deal 3 times this item's Damage |
| item | 牌桌 | status/stat modifiers | 1 | A Friend gains +1 Multicast |
| item | 特里翼龙 | status/stat modifiers | 1 | This starts or stops Flying When this stops Flying, deal 800 Damage Damage When you use a Dinosaur or Flying item, Charge this 2 Charge second(s) |
| item | 狼面具 | scaling/formula/reference values | 2 | The first time any item is used each fight, gain 30 Rage Rage Adjacent items have +15 Crit% Crit Chance When you Enrage, double the Crit Chance of adjacent items |
| item | 猎人之斧 | positional/slot/size targeting | 1 | Deal 10 Damage Damage When you use an adjacent Tool or Friend, gain 4 Rage Rage |
| item | 猎人之靴 | scaling/formula/reference values | 1 | Slow adjacent items 1 second(s) and Charge them 1 second When you Slow one of your items, it gains 10 Crit% Crit Chance While you are Enraged, this has +1 Multicast |
| item | 猎人日志 | scaling/formula/reference values | 2 | Your items have +Crit Chance equal to this item's Value When you win a fight against a monster, this permanently gains +2 Value |
| item | 猎人背包 | scaling/formula/reference values | 3 | You have +3% Max Health for each Type this has Your items have +2% Crit Chance for each Type this has This has the Types of items you have in your Stash |
| item | 猎人雪橇 | scaling/formula/reference values | 2 | Haste an item for 1 Haste second(s) This has +1 Multicast for each Type this has This has the Types of items you have |
| item | 猎刀 | card state/create/transform/destroy | 1 | Deal 10 Damage Damage Haste a Friend 1 Haste second(s) When you defeat a Monster with this, get a Pelt |
| item | 猎鹰 | scaling/formula/reference values | 1 | Deal 20 Damage Damage Haste a non-Flying item 2 Haste seconds When you Haste an item, it starts Flying Your Flying items have +10 Crit% Crit Chance |
| item | 猪猪存钱罐 | scaling/formula/reference values | 2 | When you sell this, get Spare Change equal to its value At the start of each hour, spend 2 Gold to permanently gain 1 value |
| item | 猫头鹰奥利 | scaling/formula/reference values | 2 | When you Crit, an item starts Flying Your Flying items have +20 Crit% Crit Chance |
| item | 獠牙头盔 | status/stat modifiers | 1 | Deal 5 Damage Damage Shield 5 Shield Multicast: 2 |
| item | 玛伊托恩祭坛 | scaling/formula/reference values | 2 | Poison 5 Poison for each Poison item you have This item's Cooldown is reduced by 1 second for each other Relic you have When you sell this, Enchant your leftmost item with Toxic |
| item | 珠宝袋 | economy/value/shop | 1 | Sells for Gold |
| item | 瓶装龙卷风 | status/stat modifiers | 1 | The Sandstorm begins! Slow 1 item for 3 Slow second(s) |
| item | 生体融合臂 | scaling/formula/reference values | 1 | When your items run out of Ammo, deal 100 Damage Damage The Ammo item to the left has +100 Crit% Crit Chance and +1 Ammo Max Ammo |
| item | 留声机 | scaling/formula/reference values | 1 | The Cooldown of the item to the left is reduced by 20% |
| item | 病毒 | scaling/formula/reference values | 1 | Poison yourself 2 Poison for each Virus on your board Transform another non-Legendary Small item on each Player's board into Virus for the rest of the fight |
| item | 瘟疫长柄刀 | scaling/formula/reference values | 1 | Deal 100 Damage Damage Your items have +10 Poison For every 20 Poison on an enemy, this has +1 Multicast Lifesteal |
| item | 皮夹克 | scaling/formula/reference values | 1 | You take 30% less damage When you Enrage or the Sandstorm starts, Destroy this |
| item | 皮纳塔 | card state/create/transform/destroy | 1 | When you sell this, get a Chocolate Bar, a Gumball and a Small Toy from any Hero |
| item | 盗龙轿辇 | scaling/formula/reference values | 1 | Your items have +15 Crit% Crit Chance When you Crit with an item, reduce its Cooldown by 4% |
| item | 直播设备 | scaling/formula/reference values | 1 | Your Toys and Friends have +Damage, Heal and Shield equal to their Value When you use a Toy or Friend, it gains 2 Value |
| item | 短柄斧 | card state/create/transform/destroy | 1 | Deal 6 Damage Damage When you buy this, get a Truffle |
| item | 砍刀 | status/stat modifiers | 1 | Deal 10 Damage Damage If this is your only item with a Cooldown, gain 50 Rage |
| item | 研钵与研杵 | card state/create/transform/destroy | 2 | Your Lifesteal Weapons gain 10 Damage The Weapon to the right has Lifesteal At the start of each day, get a Catalyst |
| item | 破坏铁球 | scaling/formula/reference values | 1 | Deal Damage equal to 20% of an enemy's Max Health Destroy an enemy item When this starts Flying, Charge this 5 Charge seconds |
| item | 硫磺 | card state/create/transform/destroy | 1 | Burn 2 Burn When this is transformed, Enchant it with Fiery if able |
| item | 磁力护盾 | status/stat modifiers | 1 | Your other items start or stop Flying When your items start Flying, Shield 100 Shield |
| item | 磨刀砂轮 | positional/slot/size targeting | 1 | The Weapon to the left gains 10 Damage If the item to the left has a Cooldown over 5 seconds, this has +1 Multicast |
| item | 神庙探险券 | other | 1 | On Day 9, allows you to embark on the Temple Expedition |
| item | 神秘水晶 | economy/value/shop | 1 | When you sell this, your leftmost item gains 1 random type(s) |
| item | 离子闪电 | scaling/formula/reference values | 1 | Adjacent items have +10 Crit% Crit Chance When this is transformed, Enchant it with Deadly if able |
| item | 私人喷气机 | scaling/formula/reference values | 2 | This and an item start Flying Adjacent items have +Damage, +Shield and +Heal equal to their Value When you use a Flying item, adjacent items gain +5 Value |
| item | 私人喷气机 | scaling/formula/reference values | 2 | Deal 100 Damage Damage This item's Cooldown is reduced by 1 second for each Flying item you have Multicast: 2 |
| item | 空中炮塔 | status/stat modifiers | 2 | Deal 15 Damage Damage Reduce this item's Cooldown by 1 second While this is Flying, this has +1 Multicast |
| item | 空惧巨龙 | status/stat modifiers | 1 | This starts or stops Flying When this starts Flying, Burn 15 Burn and this gains 175 Damage When this stops Flying, deal 175 Damage Damage and this gains 15 Burn |
| item | 空灵灰烬 | card state/create/transform/destroy | 2 | At the start of each fight, Enchant 2 other Non-Enchanted items When this is transformed, Enchant it |
| item | 突击符印 | scaling/formula/reference values | 1 | When you use a Weapon, gain 5 Rage Rage When you Enrage, deal Damage equal to 10% of your Max Health |
| item | 竞技场 | status/stat modifiers | 1 | Your Toys have +1 Multicast |
| item | 笔与墨 | status/stat modifiers | 1 | Poison 1 Poison Regen 1 Regen If you have no other Weapons, this has +1 Multicast |
| item | 符文之刃 | scaling/formula/reference values | 1 | Deal 20 Damage Damage When you Crit, double this item's Damage Lifesteal |
| item | 符文匕首 | status/stat modifiers | 2 | Deal 10 Damage Damage When you Crit with another item, Charge this 1 Charge second(s) Lifesteal Multicast: 2 |
| item | 符文双射弓 | status/stat modifiers | 2 | Deal 20 Damage Damage When you Crit with another item, this gains 20 Damage Lifesteal Multicast: 2 |
| item | 符文巨斧 | scaling/formula/reference values | 2 | Deal 50 Damage Damage Your Lifesteal Weapons have +50 Crit% Crit Chance Lifesteal |
| item | 符文手斧 | economy/value/shop | 1 | Deal 15 Damage Damage When you sell this, your Weapons gain +1 Damage Damage. Lifesteal |
| item | 符文护符 | status/stat modifiers | 1 | Your items gain 10 Damage When you Enrage, reduce this item's cooldown by 1 second |
| item | 符文药水 | status/stat modifiers | 1 | Haste your Lifesteal Weapons for 1 Haste second(s) A Weapon gains Lifesteal |
| item | 筛盘 | card state/create/transform/destroy | 2 | At the start of each day, get a Catalyst Your Catalysts have +1 Value |
| item | 筷子 | status/stat modifiers | 1 | Deal 5 Damage Damage Multicast: 2 |
| item | 算盘 | scaling/formula/reference values | 2 | Adjacent items gain value equal to this item's value This has +15 value in combat |
| item | 粗陋工具 | status/stat modifiers | 1 | Charge your Tech items 1 Charge second If you have only 1 Tech item this item's Cooldown is reduced by 3 seconds |
| item | 精密卡尺 | positional/slot/size targeting | 1 | Repair a Small item Haste all your other Small items for 1 Haste seconds |
| item | 糖果锁甲 | scaling/formula/reference values | 2 | Adjacent Shield items permanently gain 2 Shield This permanently loses 1 Ammo Max Ammo At the end of each fight, if this has no Ammo, permanently destroy it |
| item | 系绳 | status/stat modifiers | 1 | 1 of your items stop Flying When you use a Flying item, Charge this 1 Charge second When your items stop Flying, Shield 30 Shield |
| item | 紧急弹射按钮 | scaling/formula/reference values | 1 | Your Vehicles and Drones stop Flying When your items stop Flying, Shield 10 Shield The first time you fall below half Health each fight, use this |
| item | 纳米机器人 | scaling/formula/reference values | 1 | Deal 15 Damage for each Friend you have This item's Cooldown is reduced by 1 second for each adjacent Friend |
| item | 纸风车 | positional/slot/size targeting | 1 | A small item starts flying Haste 1 item(s) for 1 Haste second(s) When your items start Flying, Charge this 2 Charge second(s) |
| item | 纸飞机 | status/stat modifiers | 1 | This starts or stops Flying |
| item | 结构蓝图 | card state/create/transform/destroy | 1 | When you Level Up, get a Small Tech item from any Hero |
| item | 绯红兰花 | scaling/formula/reference values | 1 | When you sell this, your leftmost Weapon permanently gains Lifesteal |
| item | 维修无人机 | other | 1 | Repair 1 item(s) |
| item | 缩小药水 | scaling/formula/reference values | 1 | Reduce an enemy's Max Health by 10% |
| item | 美食家巧克力 | scaling/formula/reference values | 2 | Adjacent Weapons permanently gain 2 Damage This permanently loses 1 Ammo Max Ammo At the end of each fight, if this has no Ammo, permanently destroy it |
| item | 羽毛 | scaling/formula/reference values | 1 | When you sell this, reduce your items' Cooldowns by 3% |
| item | 羽翼符印 | scaling/formula/reference values | 2 | When you Haste, gain 5 Rage Rage When you Enrage, 2 items start Flying Your Flying items' Cooldowns are reduced by 10% |
| item | 翻译水晶 | scaling/formula/reference values | 1 | When you sell this, reduce the Cooldowns of items from other Heroes by 5% |
| item | 老鼠夹 | scaling/formula/reference values | 1 | Deal Damage equal to double this item's Max Ammo This has +2 Ammo Ammo for each Small Food you have |
| item | 肉干 | scaling/formula/reference values | 1 | Heal 40 Heal When you win a fight against a monster, this permanently gains +1 Ammo Max Ammo |
| item | 肉锤 | scaling/formula/reference values | 1 | Deal 10 Damage Damage Reduce the Cooldown of adjacent Food by 10% |
| item | 肾上腺素注射 | status/stat modifiers | 2 | Gain 20 Rage Rage When you Crit, reload this |
| item | 脉冲步枪 | scaling/formula/reference values | 1 | Deal 15 Damage Damage This has +1 Multicast if it is adjacent to a Friend. Double this if it is your only Friend |
| item | 腕刃 | scaling/formula/reference values | 2 | Deal 30 Damage damage When you Crit, Gain 20 Rage Rage When you gain Rage, this gets +5 Crit% Crit Chance |
| item | 腰带 | scaling/formula/reference values | 1 | You have +40% Max Health |
| item | 自力更升靴 | card state/create/transform/destroy | 1 | Every 50 you spend, upgrade an item of a lower tier |
| item | 自动取款机 | scaling/formula/reference values | 1 | Shield equal to 2 times your Income When you buy this, gain +1 Income |
| item | 自动售货机 | card state/create/transform/destroy | 1 | At the start of each day, get a Chocolate Bar, Spare Change and Truffle |
| item | 自由落体模拟器 | positional/slot/size targeting | 1 | Adjacent items start or stop Flying |
| item | 航空胶水 | positional/slot/size targeting | 1 | Adjacent items stop Flying When one of your items stops Flying, it gains 10 Damage and 10 Shield |
| item | 舱底蠕虫 | positional/slot/size targeting | 1 | When your enemy uses their leftmost item, deal 10 Damage Damage Lifesteal |
| item | 船舵 | positional/slot/size targeting | 1 | Haste adjacent items for 1 Haste second(s) If you have a Vehicle or Large item, this item's Cooldown is halved |
| item | 船长舱 | status/stat modifiers | 1 | Haste your Tools and Vehicles for 1 Haste second(s) Reload your items 1 Ammo Ammo Your items gain 20 Damage |
| item | 船首像 | scaling/formula/reference values | 1 | The Cooldowns of Aquatic items to the left are reduced by 10% Items to the right have +25 Damage |
| item | 船骸 | status/stat modifiers | 1 | Your Aquatic items have +1 Multicast |
| item | 苔藓 | scaling/formula/reference values | 1 | You need twice as much Rage to Enrage When you Enrage, Heal 500 Heal and remove half your Poison and Burn |
| item | 草叉 | scaling/formula/reference values | 1 | Deal 20 Damage Damage At the start of each day, get a Truffle for each Property and Tool you have |
| item | 荒原恐兽 | scaling/formula/reference values | 2 | Deal 300 Damage Damage While you are Enraged, this has Lifesteal and its Cooldown reduced by 3 seconds You have double Rage gain |
| item | 药房 | card state/create/transform/destroy | 1 | Regen 10 Regen When you Haste, Slow, Poison, or Burn, Charge this 1 Charge second(s) At the start of each day, get a Reagent |
| item | 药水蒸馏厂 | scaling/formula/reference values | 3 | Your Potions have +1 Ammo Ammo Your Potions' Cooldowns are reduced by 10% When you visit a Merchant, transform the Small item to the left into a Potion |
| item | 萤火灯笼 | status/stat modifiers | 1 | Burn 2 Burn When you stop being Enraged, use this Multicast: 3 |
| item | 葡萄园 | scaling/formula/reference values | 1 | Heal equal to 5% of your Max Health When you Heal, Slow an item for 1 Slow second(s) Multicast: 2 |
| item | 葡萄弹 | status/stat modifiers | 1 | Deal 30 Damage Damage When you use another Ammo item, Reload 1 Ammo ammo |
| item | 蕨叶蜘蛛 | status/stat modifiers | 2 | Poison 4 Poison When you win a fight with this, this gains +2 Multicast. <br>If it already has 2 of this bonus, reset it instead |
| item | 藏刃匕首 | economy/value/shop | 1 | Deal 10 Damage Damage Haste an item 1 Haste second(s) At the start of each fight with this, gain 1 Gold |
| item | 虚空射线 | status/stat modifiers | 1 | Burn 4 Burn When you Shield, this gains 1 Burn Multicast: 2 |
| item | 虚空干扰器 | scaling/formula/reference values | 1 | Destroy adjacent items When you destroy an item, Shield equal to 20% of your Max Health |
| item | 虫翅 | scaling/formula/reference values | 1 | When you sell this, reduce your leftmost item's Cooldown by 1% |
| item | 虹吸茶壶 | scaling/formula/reference values | 1 | Burn 8 Burn Heated: This item's cooldown is reduced by 50% |
| item | 蛇怪之牙 | scaling/formula/reference values | 1 | Deal 10 Damage Damage While your enemy is Poisoned, this has +25 Crit% Crit Chance Lifesteal |
| item | 蜂巢 | scaling/formula/reference values | 1 | When an enemy uses a Weapon, Charge your Drones 2 Charge second(s) When you buy this and at the start of each day, get a Busy Bee When you buy a Property, your Small Drones permanently gain 20 Damage |
| item | 蝙蝠 | status/stat modifiers | 1 | This starts Flying Deal 5 Damage Damage Slow 1 item(s) for 1 Slow second(s) |
| item | 蝶剑 | status/stat modifiers | 1 | Deal 10 Damage Damage Multicast: 2 |
| item | 螺旋帽 | status/stat modifiers | 1 | Deal 10 Damage Damage When you use a Core, an item starts Flying When you use a Flying item, Haste an item for 1 Haste second(s) |
| item | 螺旋桨 | scaling/formula/reference values | 2 | An item starts Flying Your Flying items' Cooldowns are reduced by 10% |
| item | 血瓶 | economy/value/shop | 1 | When you sell this, gain 1 XP |
| item | 行刑者的斩肉刀 | scaling/formula/reference values | 1 | Deal 100 Damage Damage Your items have +Crit Chance equal to the Rage you've gained this fight While your enemy is below half Health, this deals double Damage |
| item | 袖珍飞刀 | scaling/formula/reference values | 1 | Deal 5 Damage Damage Your Leftmost Weapon gains 10 Crit% Crit Chance |
| item | 被绑架的牛 | card state/create/transform/destroy | 2 | This starts Flying If this is Flying, another item starts Flying When this is Destroyed, Charge your items 3 Charge seconds and transform this into 2 Jerky |
| item | 要塞 | status/stat modifiers | 2 | Shield 100 Shield All item Cooldowns are increased by 1 second Your items with a Cooldown of 8 seconds or greater have +1 Multicast |
| item | 观光缆车 | scaling/formula/reference values | 1 | Shield 20 Shield When you sell this, your items permanently gain +1 value |
| item | 角磨无人机 | status/stat modifiers | 1 | A Tool or Drone starts Flying Deal 10 Damage Damage |
| item | 警报喇叭 | scaling/formula/reference values | 1 | Slow 1 item(s) for 1 Slow second(s) Haste 1 item(s) for 1 Haste second(s) For each adjacent Vehicle or Property, this has +1 Multicast The first time an enemy uses an item each fight, use this |
| item | 豪华桑拿炉 | scaling/formula/reference values | 1 | Burn equal to this item's value When you sell a Property, this item permanently gains 3 value |
| item | 负能阻断目镜 | scaling/formula/reference values | 1 | Shield 20 Shield This has +1 Multicast for each item you have with value over 10 |
| item | 账本 | scaling/formula/reference values | 2 | When you sell a Truffle, adjacent items permanently gain 1 value When you buy this and at the start of each day, get a Truffle |
| item | 货运 | economy/value/shop | 1 | When you sell this, get 3 Small items from another hero |
| item | 贾巴利匕首 | scaling/formula/reference values | 1 | Deal Damage equal to 1 times this item's value When you sell an item, this permanently gains 1 value |
| item | 贾巴利反曲弓 | status/stat modifiers | 2 | Deal 75 Damage Damage This has +1 Multicast if you have more Health than an enemy Multicast: 2 |
| item | 超级糖浆 | scaling/formula/reference values | 2 | Adjacent items permanently gain 1 Crit% Crit Chance This permanently loses 1 Ammo Max Ammo At the end of each fight, if this has no Ammo, permanently destroy it |
| item | 超能绿汁机 | economy/value/shop | 1 | Adjacent items gain +3 value When an adjacent item gains value during combat, your items gain 10 Damage and 10 Heal |
| item | 路径标记 | positional/slot/size targeting | 1 | All items except your leftmost item have their Cooldown increased by 1 second(s) |
| item | 辣酱 | scaling/formula/reference values | 1 | Burn 2 Burn For each adjacent Food or Tool, this has +1 Multicast |
| item | 远古标本 | scaling/formula/reference values | 1 | Heal 80 Heal Poison 8 Poison For each adjacent Aquatic, Friend or Relic item, this item's cooldown is reduced by 1 second |
| item | 迷幻蝠鲼 | scaling/formula/reference values | 1 | Slow an item for 1 Slow second(s) For each adjacent Friend or Ray, this has +1 Multicast |
| item | 通缉海报 | scaling/formula/reference values | 2 | When you win a fight against a Hero, gain 1 XP. If you won the fight with this, gain 1 additional XP Your items have +10 Crit% Crit Chance |
| item | 通讯卫星 | card state/create/transform/destroy | 1 | Haste the Friend to the right for 1 Haste second(s) At the start of each day, get a Small Friend from any Hero |
| item | 遥控装置 | positional/slot/size targeting | 1 | Use all of your Medium size Cores |
| item | 避雷针 | status/stat modifiers | 1 | When you Freeze or Slow, deal 25 Damage Damage When an enemy Freezes or Slows your items, this is targeted instead |
| item | 酸液槽 | scaling/formula/reference values | 1 | Poison 6 Poison for each type this has Burn 6 Burn for each type this has When you sell an item, this gains that item's types |
| item | 醒酒器 | status/stat modifiers | 1 | Charge a Food 2 Charge second(s) Chilled: This item's cooldown is reduced by 1 second |
| item | 采掘工具 | card state/create/transform/destroy | 1 | Charge an adjacent Relic 1 Charge second(s) When you buy this, get a Catalyst |
| item | 重力之石 | status/stat modifiers | 1 | When you use a Potion or a Relic, another item starts Flying When you use a Flying item, Regen 6 Regen |
| item | 野根护符 | status/stat modifiers | 1 | Shield 10 Shield Slow 1 item(s) for 2 Slow second(s) When you Enrage, this Slows an additional item |
| item | 野熊 | scaling/formula/reference values | 1 | Deal Damage equal to 10% of your Max Health When you Enrage, gain 15% Max Health |
| item | 野猪面具 | scaling/formula/reference values | 1 | The first time any item is used each fight, gain 30 Rage Rage When you Enrage, deal damage and gain Shield equal to 10% of your Max Health |
| item | 金块 | economy/value/shop | 1 | Sells for Gold |
| item | 金属废料 | scaling/formula/reference values | 1 | When you sell this, reduce your leftmost item's Cooldown by 3% |
| item | 金币巧克力 | scaling/formula/reference values | 2 | When you sell a Food, this permanently gains +1 value When you sell this, your leftmost item permanently gains Crit Chance equal to half this item's value |
| item | 金条 | economy/value/shop | 1 | Sells for Gold |
| item | 钓鱼竿 | card state/create/transform/destroy | 1 | Haste the Aquatic item to the right for 2 Haste second(s) At the start of each day, get a Small Aquatic item |
| item | 钟形帽 | scaling/formula/reference values | 1 | Your rerolls cost 1 less Gold for each Apparel you have |
| item | 钢棘 | status/stat modifiers | 1 | When your enemy uses an item, gain 1 Rage Rage |
| item | 钢琴 | positional/slot/size targeting | 1 | When you use a Friend, Haste it for 1 Haste second(s) Adjacent items are Friends |
| item | 钥匙串 | scaling/formula/reference values | 1 | Use another Property |
| item | 鉴定镜 | economy/value/shop | 1 | Your Small items have +1 value |
| item | 铅块 | card state/create/transform/destroy | 1 | When this is transformed outside of combat, gain a Chunk of Gold |
| item | 铲子 | card state/create/transform/destroy | 1 | Deal 25 Damage Damage At the start of each day, get a Small item from any hero |
| item | 银河翻译器 | economy/value/shop | 1 | Merchants sell items for 1 less Gold and buy items for 1 more Gold |
| item | 链枷 | status/stat modifiers | 1 | Deal 20 Damage Damage Multicast: 3 |
| item | 锁匣 | scaling/formula/reference values | 1 | When you win a fight, this permanently gains 3 value Your items have + Damage equal to this item's value |
| item | 锅铲 | scaling/formula/reference values | 1 | Deal 10 Damage Damage When you use an adjacent Food, it gains 10 Crit% Crit Chance |
| item | 镜子 | card state/create/transform/destroy | 1 | Transform into a copy of the Medium, non-Legendary item to the left |
| item | 闪光弹 | card state/create/transform/destroy | 1 | Slow all enemy items for 1 Slow second(s) Destroy this |
| item | 闪电蝴蝶 | status/stat modifiers | 1 | Deal 5 Damage Damage Your Flying Weapons gain 5 Damage At the start of each fight, this starts Flying |
| item | 阿肯的戒指 | economy/value/shop | 1 | When you sell this, recover 5 Prestige |
| item | 陈年佳酿 | status/stat modifiers | 1 | Shield 30 Shield Slow 2 items for 2 Slow second(s) Chilled: This has +1 Multicast |
| item | 隐秘之湖 | scaling/formula/reference values | 2 | You have +20% Max Health While you are below 50% Max Health, adjacent items have their Cooldown reduced by half |
| item | 雪花玻璃球 | scaling/formula/reference values | 1 | Freeze an item for 1 Freeze second(s) This has +1 Multicast for each adjacent Property |
| item | 雪鞋 | scaling/formula/reference values | 1 | When you use an adjacent item, gain 3 Rage Rage Adjacent items are affected by Freeze for half as long |
| item | 雪魂精灵 | status/stat modifiers | 1 | Heal 20 Heal Freeze 1 item(s) for 1 Freeze second(s) When you Enrage, this Freezes an additional item |
| item | 零件选择机器人 | card state/create/transform/destroy | 1 | Destroy your leftmost item When this destroys an item, reduce the cooldowns of your other items by 1 Charge second |
| item | 零钱 | economy/value/shop | 1 | Sells for Gold |
| item | 雷达模块 | scaling/formula/reference values | 1 | When an enemy uses an item, items adjacent to this gain 4 Crit% Crit Chance |
| item | 雷达穹顶 | status/stat modifiers | 1 | 1 item starts Flying |
| item | 霰弹枪 | status/stat modifiers | 1 | Deal 30 Damage Damage When you Reload this, it gains +1 Multicast |
| item | 露台 | scaling/formula/reference values | 1 | The Property to the left has double value in combat and its Cooldown is reduced by 10% |
| item | 青苔 | card state/create/transform/destroy | 1 | Adjacent items gain 1 Regen When this is transformed, Enchant it with Mossy if able |
| item | 章鱼 | status/stat modifiers | 1 | Deal 8 Damage Damage Multicast: 8 |
| item | 顶层豪华公寓 | scaling/formula/reference values | 1 | Your other Properties gain Value equal to half this item's Value When you use a Property, Charge another Property Charge second |
| item | 颠茄 | card state/create/transform/destroy | 1 | Poison 6 Poison When you Heal Regen, this gains 2 Poison When this is transformed, Enchant it with Toxic if able |
| item | 风笛 | scaling/formula/reference values | 2 | Heal 30 Heal Gain 10 Rage Rage When you Enrage, reduce this item's cooldown by half |
| item | 风筝 | positional/slot/size targeting | 1 | 2 small items start Flying When a small item starts Flying, Charge it 1 Charge second |
| item | 风车磨坊 | scaling/formula/reference values | 2 | The Sandstorm Begins! Charge your other items 2 Charge seconds When you use another item, Charge this 2 Charge seconds When the Sandstorm starts, double your Max Health |
| item | 风速仪 | positional/slot/size targeting | 1 | An adjacent item starts Flying When one of your items starts or stops Flying, Haste it for 2 Haste seconds |
| item | 飞猪 | positional/slot/size targeting | 1 | This and an adjacent item start or stop Flying When your items start Flying, Haste an item 1 Haste second(s) When your items stop Flying, Heal 25 Heal |
| item | 飞蛾粉末 | card state/create/transform/destroy | 1 | Slow an item for 1 Slow second(s) When this is transformed, Enchant it with Heavy if able |
| item | 飞行单车 | scaling/formula/reference values | 2 | Your leftmost item non-Flying starts Flying Your items have +5 Shield. If they are Flying, double this |
| item | 飞行员之翼 | scaling/formula/reference values | 1 | Haste your Flying Drones and Vehicles for 2 Haste second(s) Your Flying Drones and Vehicles have +10 Crit% Crit Chance |
| item | 飞行拖船 | positional/slot/size targeting | 1 | Slow 1 item(s) for 1 Slow second(s) If this is Flying, adjacent items start Flying |
| item | 飞行药水 | status/stat modifiers | 1 | Haste your other Flying items for 1 Haste second(s) 2 items start Flying |
| item | 飞镖 | scaling/formula/reference values | 1 | This starts Flying Deal 4 Damage Damage Every 3rd hit, this deals +50% Damage |
| item | 飞鱼 | positional/slot/size targeting | 1 | Deal 10 Damage Damage This and an adjacent item start Flying When you use a Flying item, Haste this for 1 Haste second(s) |
| item | 飞鼠翼装 | positional/slot/size targeting | 2 | This stops Flying When you use an adjacent Flying item, this starts Flying When this starts Flying, Haste adjacent items for 1 Haste second(s) |
| item | 食谱书 | card state/create/transform/destroy | 1 | Charge a Food 2 Charge seconds At the start of each day, upgrade a Food of a lower tier |
| item | 饭团机 | scaling/formula/reference values | 1 | Burn 8 Burn This has +1 Multicast for each item you have with value over 10 |
| item | 饼干 | scaling/formula/reference values | 2 | Permanently gain +4 Heal Max Health This permanently loses 1 Ammo Max Ammo At the end of each fight, if this has no Ammo, permanently destroy it |
| item | 饼干造型模具 | card state/create/transform/destroy | 1 | Deal 10 Damage Damage At the start of each day, get a Cookie |
| item | 马克显微镜 | scaling/formula/reference values | 1 | Slow an item for 1 Slow second(s) If you have another Relic, Quest, Friend, or Enchanted item this has +1 Multicast for each |
| item | 马龙鱼 | scaling/formula/reference values | 2 | An item starts Flying Deal 15 Damage Damage When you use a Flying item, this gains 20 Crit% Crit Chance |
| item | 驼鹿角杖 | scaling/formula/reference values | 1 | Deal 200 Damage Damage The first time you fall below half Health each fight, you take no Damage for 1 second(s) and gain 25 Regen Your items have + Damage equal to your Regen Multicast: 2 |
| item | 高级小圆猪 | card state/create/transform/destroy | 2 | Adjacent items gain Value +3 When you buy this and at the start of each day, get a Premium Piggle |
| item | 魔术师礼帽 | card state/create/transform/destroy | 1 | When you sell this, upgrade your leftmost item |
| item | 魔法石 | scaling/formula/reference values | 1 | Regen 3 Regen This has +1 Regen for each Reagent you have transformed this run When you buy this, get a Catalyst |
| item | 魔法飞毯 | status/stat modifiers | 1 | Deal 40 Damage Damage When you Crit, reduce this item's Cooldown by 1 second(s) and this starts Flying |
| item | 鱼叉 | card state/create/transform/destroy | 1 | Destroy a Small item |
| item | 鱼子酱 | scaling/formula/reference values | 2 | Your items have +Crit Chance equal to double this item's value At the start of each day, this permanently gains +1 value |
| item | 鱼饵 | scaling/formula/reference values | 2 | Your Aquatic items gain +3 Crit% Crit Chance When you buy this, get a Piranha |
| item | 鲨鱼导弹 | scaling/formula/reference values | 1 | When your Vehicles or Drones start Flying, this starts Flying When this stops Flying, deal Damage equal to 20% of your enemy's Max Health, then destroy this and an enemy item |
| item | 鸟笼 | positional/slot/size targeting | 1 | Adjacent Small items stop Flying When your items stop Flying, Shield 100 Shield |
| item | 鸡农炮 | scaling/formula/reference values | 1 | Deal Damage equal to the Shield of adjacent Small and Medium items Adjacent items start Flying |
| item | 鸦巢 | scaling/formula/reference values | 1 | Your Weapons have +40 Crit% Crit Chance If you have only one Weapon, it has Lifesteal and is affected by Slow for half as long |
| item | 鹦鹉皮特 | scaling/formula/reference values | 2 | This starts Flying Burn 2 Burn For each adjacent Friend or Property, this has +1 Multicast |
| item | 鹰之符印 | scaling/formula/reference values | 1 | When you Crit, gain 15 Rage Rage When you Enrage, adjacent items gain 30 Crit% Crit Chance |
| item | 麻醉镖 | status/stat modifiers | 1 | Slow 1 item(s) for 2 Slow second(s) This has +1 Multicast if your enemy has a Friend |
| item | 黄油 | scaling/formula/reference values | 1 | Haste an item for 1 Haste second(s) For each adjacent Tool or Food, this gains +1 Multicast |
| item | 黏液链枷 | scaling/formula/reference values | 1 | Deal 1 Damage Damage Poison equal to this item's Damage Multicast: 3 |
| item | 黑曜石碎片 | card state/create/transform/destroy | 2 | Deal 5 Damage Damage When this is transformed, Enchant it with Obsidian if able Lifesteal |
| item | 龙涎香 | scaling/formula/reference values | 1 | Heal equal to 1 times this item's value When you buy another Aquatic item, this permanently gains 1 Value |
| skill | 011111001111末日狂欢 | scaling/formula/reference values | 1 | Your leftmost item is a Friend and has its cooldown reduced by 3% |
| skill | Cherished Keepsake | positional/slot/size targeting | 1 | Your leftmost item is a Relic |
| skill | First Strike | scaling/formula/reference values | 1 | Your items have +75 Crit% Crit Chance When you use an item, all your items lose 10% Crit Chance |
| skill | 万物互联 | scaling/formula/reference values | 1 | Your items have their cooldown reduced by 2% for each of the following types you have: Tech, Friend, Apparel, Tool, Weapon |
| skill | 上油机械 | scaling/formula/reference values | 1 | When you use a Core, reduce an item's Cooldown by 5% |
| skill | 上膛工具 | positional/slot/size targeting | 1 | When you use a Tool, Reload an adjacent item |
| skill | 临修工匠 | positional/slot/size targeting | 1 | When you use an Ammo item, Reload the item to the left of it 1 Ammo Ammo |
| skill | 乔迁礼物 | scaling/formula/reference values | 1 | When you sell a Property, get 1 Chocolate Bar and 1 Spare Change |
| skill | 优质房产 | scaling/formula/reference values | 1 | When you use a Property, adjacent items gain 5 Crit% Crit Chance |
| skill | 伙伴卡 | scaling/formula/reference values | 1 | Your Friends' Cooldowns are reduced by 5% |
| skill | 伙伴系统 | scaling/formula/reference values | 1 | If you have exactly one Friend, its Cooldown and Your Core's Cooldown are reduced by 5% |
| skill | 侧翼暴击 | scaling/formula/reference values | 1 | The first time you use a Large item each fight, adjacent items gain 20 Crit% Crit Chance |
| skill | 修复技师 | scaling/formula/reference values | 1 | The first 1 times one of your items is destroyed each fight, repair it |
| skill | 倦怠 | status/stat modifiers | 1 | All item Cooldowns are increased by 1 second(s) |
| skill | 免费乘车 | scaling/formula/reference values | 2 | Your rightmost item is a Vehicle Your Vehicles' Cooldowns are reduced by 5% |
| skill | 全副武装 | scaling/formula/reference values | 1 | Your item's Cooldowns are reduced by 2% if you have a Vehicle, reduced by 2% if you have a Weapon, and reduced by 2% if you have a Tool |
| skill | 关键投资 | scaling/formula/reference values | 1 | Your Properties and Toys have +10 Crit% Crit Chance |
| skill | 冻结射击 | scaling/formula/reference values | 1 | Your Weapons' Cooldowns are reduced by 5% while your enemy has a Frozen item |
| skill | 凌空的刺激 | scaling/formula/reference values | 1 | Your Flying items' Cooldowns are reduced by 5% |
| skill | 刀技 | scaling/formula/reference values | 1 | When you use a Weapon, reduce its Cooldown by 4% |
| skill | 初始怒火 | positional/slot/size targeting | 1 | While you are Enraged, your leftmost item has its cooldown reduced by 1 second(s) |
| skill | 到碗里来 | scaling/formula/reference values | 1 | Your leftmost item is a Food and has its cooldown reduced by 3% |
| skill | 化学精准 | status/stat modifiers | 1 | Your Potions' Cooldowns are reduced by 1 second |
| skill | 卡诺克之怒 | positional/slot/size targeting | 3 | When you use a Small item, gain 4 Rage When you use a Medium item, gain 8 Rage When you use a Large item, gain 12 Rage |
| skill | 反侵入协议 | scaling/formula/reference values | 1 | The first time you fall below half Health in a fight, use your Friends |
| skill | 只是看看 | status/stat modifiers | 1 | At the start of each fight, the slowest enemy item has its cooldown increased by 1 second(s) |
| skill | 右眼 | scaling/formula/reference values | 1 | Your rightmost item has +8 Crit% Crit Chance |
| skill | 吞时者 | status/stat modifiers | 1 | At the start of each fight, the fastest enemy item has its cooldown increased by 1 second(s) |
| skill | 和平主义者 | scaling/formula/reference values | 1 | If you have no Weapons, your items' Cooldowns are reduced by 5% |
| skill | 唯一药水 | status/stat modifiers | 1 | If you have only one Potion, it has +1 Ammo Max Ammo and its Cooldown halved |
| skill | 商人 | economy/value/shop | 1 | Your items have +1 value |
| skill | 垃圾桶寻宝 | card state/create/transform/destroy | 1 | At the start of each day, get a Potion from any Hero |
| skill | 城堡准则 | scaling/formula/reference values | 1 | The first time any item is used each fight, for each Property you have, gain 15 Rage Rage |
| skill | 备用收藏 | scaling/formula/reference values | 1 | The first time you fall below half Health each fight, use your Relics |
| skill | 复仇 | scaling/formula/reference values | 1 | Your leftmost and rightmost items' Cooldowns are reduced by 5% |
| skill | 大步流星 | scaling/formula/reference values | 1 | If you have 5 or fewer items, your items' Cooldowns are reduced by 5% |
| skill | 套利 | economy/value/shop | 1 | Your rerolls cost 1 less Gold |
| skill | 好战 | scaling/formula/reference values | 1 | When you use a Weapon, it gains 3 Crit% Crit Chance |
| skill | 宁缺毋滥 | scaling/formula/reference values | 1 | If you have exactly one Weapon, it has Lifesteal and 5 Crit% Crit Chance |
| skill | 宁静之眼 | scaling/formula/reference values | 1 | Your Non-Weapon items have +5 Crit% Crit Chance |
| skill | 守护神之怒 | scaling/formula/reference values | 1 | While you are Shielded, your Weapons' Cooldowns are reduced by 5% |
| skill | 实业家 | scaling/formula/reference values | 1 | The Cooldown of your Properties are reduced by 5% |
| skill | 实验流大厨 | card state/create/transform/destroy | 1 | At the start of each fight, enchant one of your non-Enchanted Food and one of your non-Enchanted Tools |
| skill | 小小舞者 | scaling/formula/reference values | 1 | If you have at least 7 items, your items' Cooldowns are reduced by 5% |
| skill | 工具斗法 | status/stat modifiers | 1 | The first time your enemy uses an item each fight, 1 of your Tools starts Flying |
| skill | 工具重铸 | positional/slot/size targeting | 1 | Your leftmost Tool has +1 Multicast |
| skill | 左眼 | scaling/formula/reference values | 1 | Your leftmost item has +8 Crit% Crit Chance |
| skill | 巧克力迷 | economy/value/shop | 1 | When you sell a Medium or Large item, get 1 Chocolate Bar(s) |
| skill | 幻觉 | card state/create/transform/destroy | 1 | When you Enrage, Enchant 1 non-enchanted item(s) |
| skill | 库存充足 | status/stat modifiers | 1 | Your Potions have +1 Ammo Ammo |
| skill | 开张营业 | scaling/formula/reference values | 1 | You have +2 income for each Property you have (including Stash) |
| skill | 弹药储存箱 | positional/slot/size targeting | 1 | Your leftmost Ammo item has +1 Ammo Max Ammo |
| skill | 快餐 | scaling/formula/reference values | 1 | Your Foods' Cooldowns are reduced by 5% |
| skill | 怒火爆发 | scaling/formula/reference values | 1 | The first time you fall below half health each fight, gain 50 Rage Rage |
| skill | 急速生长 | scaling/formula/reference values | 1 | You have +10% Max Health |
| skill | 怪物追踪者 | card state/create/transform/destroy | 2 | When you defeat a Gold-tier or higher Monster, get a Loot item Your Loot items have +1 value |
| skill | 扒手 | economy/value/shop | 1 | At the start of each fight, gain 1 Gold |
| skill | 打入恐龙群 | scaling/formula/reference values | 1 | Your leftmost item is a Dinosaur and has its cooldown reduced by 3% |
| skill | 抛光加持 | scaling/formula/reference values | 1 | Your Drones' and Tools' Cooldowns are reduced by 5% |
| skill | 拾荒者 | card state/create/transform/destroy | 1 | When you Level Up, get a small item from another Hero |
| skill | 持久怒火 | status/stat modifiers | 1 | You are Enraged for 1 second longer |
| skill | 收线 | scaling/formula/reference values | 1 | The first time an enemy falls below half Health each fight, your items' Cooldowns are halved |
| skill | 教团成员 | status/stat modifiers | 2 | You have joined the Cult Your Legendary items have their cooldowns reduced by 1 second |
| skill | 教学时刻 | scaling/formula/reference values | 1 | You have +25 Max Health for each Skill you have |
| skill | 斗士 | scaling/formula/reference values | 1 | You have +50 Max Health for each Weapon you have |
| skill | 时间旅行者 | scaling/formula/reference values | 1 | Your Dinosaur and Relic items' Cooldowns are reduced by 5% |
| skill | 暴食狂潮 | status/stat modifiers | 1 | When you use a Food, gain 15 Rage Rage When you Enrage, Haste your Food 1 Haste seconds |
| skill | 有条不紊 | scaling/formula/reference values | 1 | Your leftmost item is a Tech and has its cooldown reduced by 3% |
| skill | 机器学习 | card state/create/transform/destroy | 1 | When you buy or upgrade this, upgrade your Cores |
| skill | 松露迷 | scaling/formula/reference values | 1 | When you sell a Property, get 1 Truffle(s) |
| skill | 桶滚 | positional/slot/size targeting | 1 | When you use a Flying item, adjacent items start Flying |
| skill | 毒性燃料 | scaling/formula/reference values | 2 | While you are Poisoned, your items' Cooldowns are reduced by 3% While your enemy is Poisoned, their items' Cooldowns are increased by 3% |
| skill | 海上航行 | positional/slot/size targeting | 1 | Your small items are Aquatic |
| skill | 深海伙伴 | conditions/triggers | 1 | Your Aquatic items are Friends |
| skill | 深渊冲刺 | status/stat modifiers | 1 | If you have exactly one Weapon, it has +5 Ammo Max Ammo ...if it is also Aquatic, it has +25 Damage |
| skill | 滑溜家伙 | scaling/formula/reference values | 1 | Your Slowed items have their Cooldown reduced by 5% |
| skill | 滚沸 | scaling/formula/reference values | 1 | Your Heated items have their cooldowns reduced by 5% |
| skill | 潜水大师 | scaling/formula/reference values | 1 | Your leftmost item is Aquatic and has its cooldown reduced by 3% |
| skill | 火爆游戏 | card state/create/transform/destroy | 1 | At the start of each fight, enchant your rightmost non-Enchanted Toy with Fiery |
| skill | 灵感怒火 | positional/slot/size targeting | 3 | When you use a Small item, gain 3 Rage When you use a Medium item, gain 6 Rage When you use a Large item, gain 9 Rage |
| skill | 灵感料理 | scaling/formula/reference values | 1 | Your Food have +10 Crit% Crit Chance |
| skill | 炫技机械师 | scaling/formula/reference values | 1 | When you use a Tool, items adjacent to it gain 3 Crit% Crit Chance |
| skill | 炫技装弹 | scaling/formula/reference values | 1 | The first 3 times you Crit each fight, Reload another item |
| skill | 炫技飞行员 | scaling/formula/reference values | 1 | When you use a Vehicle, your items gain 3 Crit% Crit Chance |
| skill | 炮手 | status/stat modifiers | 1 | Your items have +1 Ammo Max Ammo |
| skill | 热空气 | status/stat modifiers | 1 | The first time you Burn each fight, 1 of your items starts Flying |
| skill | 特殊展品 | scaling/formula/reference values | 1 | Your leftmost item is a Relic and has its cooldown reduced by 3% |
| skill | 狂乱储备 | status/stat modifiers | 1 | When you Enrage, Reload 1 item(s) |
| skill | 狂战士 | scaling/formula/reference values | 1 | While your enemy has more Health than you, your Weapons' Cooldowns are reduced by 5% |
| skill | 生命力打赏 | scaling/formula/reference values | 1 | When you gain Gold, permanently gain Max Health equal to 1 times the amount of Gold gained |
| skill | 生命循环 | positional/slot/size targeting | 1 | Your leftmost Weapon has lifesteal |
| skill | 目标锁定 | scaling/formula/reference values | 1 | Your Flying items have +5 Crit% Crit Chance |
| skill | 盲目狂怒 | positional/slot/size targeting | 1 | While you are Enraged, your Large items have their cooldowns reduced by 1 second |
| skill | 神射手 | scaling/formula/reference values | 1 | Your leftmost and rightmost Weapons have +10 Crit% Crit Chance If you only have one Weapon, it has double Crit Damage |
| skill | 紧急起飞 | status/stat modifiers | 1 | The first time you use an item each fight, 1 item(s) start Flying Your Flying items have +20 Damage |
| skill | 纯粹想象 | scaling/formula/reference values | 1 | Your leftmost item is a Toy and has its cooldown reduced by 3% |
| skill | 纳米机器人建造 | scaling/formula/reference values | 1 | Your Large items' Cooldowns are reduced by 2% for each Small item you have |
| skill | 终极怒火 | positional/slot/size targeting | 1 | While you are Enraged, your rightmost item has its cooldown reduced by 1 second(s) |
| skill | 绯红冲锋 | status/stat modifiers | 1 | Your Lifesteal Weapons' Cooldowns are reduced by 1 second |
| skill | 缩短暴怒 | status/stat modifiers | 1 | You are Enraged for 1 second shorter |
| skill | 翻新工程 | scaling/formula/reference values | 1 | When you buy this or level up, upgrade a Property |
| skill | 考古学家 | scaling/formula/reference values | 1 | The Cooldown of your Relics and Tools is reduced by 5% |
| skill | 聚能专注 | scaling/formula/reference values | 1 | If you have only one Medium item, its Cooldown is reduced by 25% |
| skill | 致命眼光 | scaling/formula/reference values | 1 | Your Weapons have +5 Crit% Crit Chance |
| skill | 藤壶覆盖 | scaling/formula/reference values | 1 | The Cooldown of your Aquatic items is reduced by 5% |
| skill | 虚荣 | status/stat modifiers | 1 | Your Weapons have Lifesteal |
| skill | 行商大师 | scaling/formula/reference values | 1 | Your items have double value during combat |
| skill | 补给箱 | card state/create/transform/destroy | 1 | At the start of each day, get a Loot item |
| skill | 诀别一击 | scaling/formula/reference values | 1 | When you use an item with Ammo, it gains 10 Crit% Crit Chance |
| skill | 起步流程 | status/stat modifiers | 1 | At the start of each fight, a Vehicle starts Flying |
| skill | 趁手工具 | scaling/formula/reference values | 1 | Your non-Tool items have +5 Crit% Crit Chance for each Tool you have |
| skill | 超频 | scaling/formula/reference values | 1 | Your Cores' Cooldown is reduced by 10% |
| skill | 边境生活 | card state/create/transform/destroy | 1 | At the start of each day, get a Rage item |
| skill | 迎头痛击 | status/stat modifiers | 1 | Enemy Cooldowns are increased by 1 second(s) |
| skill | 这就是无人机 | scaling/formula/reference values | 1 | Your leftmost item is a Drone and has its cooldown reduced by 3% |
| skill | 远古科技 | other | 1 | Your Relics are Tech |
| skill | 递进高潮 | scaling/formula/reference values | 1 | When you use an item, your items gain 1 Crit% Crit Chance |
| skill | 遁入虚空 | card state/create/transform/destroy | 1 | The first time you use an item, destroy an item on each Player's board |
| skill | 酿造大师 | status/stat modifiers | 1 | At the start of each fight, a Potion gains +1 Multicast |
| skill | 钟表小熊 | scaling/formula/reference values | 1 | Your Toys' and Apparel Cooldowns are reduced by 5% |
| skill | 钢铁磨砺 | scaling/formula/reference values | 1 | When you use a Weapon, adjacent items gain 3 Crit% Crit Chance |
| skill | 钻石心脏 | scaling/formula/reference values | 1 | You have +300 Max Health for each Diamond-tier item you have |
| skill | 钻石獠牙 | scaling/formula/reference values | 1 | Your Small Diamond-tier items' Cooldowns are reduced by 20% |
| skill | 锐化打击 | scaling/formula/reference values | 1 | When you use an item, it gains 5 Crit% Crit Chance |
| skill | 长期投资 | scaling/formula/reference values | 1 | Your items with value over 10 have their cooldowns reduced by 5% |
| skill | 闪速冻结 | status/stat modifiers | 1 | Your Chilled items' Cooldowns are reduced by 1 second |
| skill | 顺势而动 | card state/create/transform/destroy | 1 | When an item is destroyed, 1 of your item(s) start Flying |
| skill | 领头船 | scaling/formula/reference values | 1 | If you have a Vehicle, your non-Vehicle items' Cooldowns are reduced by 5% |
| skill | 餐桌布置 | scaling/formula/reference values | 1 | Your leftmost Weapon has +25 Damage The Cooldown of your rightmost Weapon is reduced by 5% |
| skill | 饕餮 | scaling/formula/reference values | 1 | The first time you fall below half Health each fight, destroy an item |
| skill | 高伤打击 | scaling/formula/reference values | 1 | Your Large items have +25 Crit% Crit Chance |
| skill | 高分子复合材料 | card state/create/transform/destroy | 1 | When you Level Up or upgrade this, upgrade a lower tier item |
| skill | 鬼魅飘飞 | positional/slot/size targeting | 1 | The first time you use an item each fight, 1 Small item(s) start Flying |
| skill | 黄金点缀 | scaling/formula/reference values | 1 | You Food have +Crit Chance equal to half your Gold |