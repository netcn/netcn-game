/* 铁壁防线（tank）游戏内文案（zh/en 对称）
   A5：画布「密/HQ」由三元判断迁入字典键 gs.tank.hq
   旗舰版新增：双人模式、四类敌兵/BOSS、三选一升级、操作教程。 */
(function () {
  var d = Arcade.i18n.dicts;
  function zh(k, v) { d.zh[k] = v; }
  function en(k, v) { d.en[k] = v; }

  /* 共享字典 gt.pickT / gt.pickD 带 emoji 图标，本目录内覆盖为纯文字（避免 emoji 当美术图标） */
  zh('gt.pickT', '守卫密码局'); en('gt.pickT', 'DEFEND THE CIPHER BUREAU');
  zh('gt.pickD', '敌军坦克来窃取密码机——守住基地，清剿全部波次。选择难度：');
  en('gt.pickD', 'Enemy tanks are coming for the cipher machine — hold the base and clear every wave. Choose a difficulty:');
  /* 结算标题/正文同样去掉 emoji，并去掉与统计栏重复的分数字样 */
  zh('gt.winT', '基地守住了！'); en('gt.winT', 'BASE SECURED!');
  zh('gt.winD', '清剿全部 {w} 波敌军（击杀 {k}）。<br>密码机安然无恙，敌军一无所获。');
  en('gt.winD', 'All {w} waves cleared ({k} kills).<br>The cipher machine is safe — the enemy got nothing.');
  zh('gt.loseBase', '基地失守！'); en('gt.loseBase', 'BASE LOST!');
  zh('gt.loseAll', '守军尽没'); en('gt.loseAll', 'GARRISON WIPED');
  zh('gt.loseBaseD', '敌军炸毁了密码局——机密失守。');
  en('gt.loseBaseD', 'The enemy destroyed the cipher bureau.');
  zh('gt.loseAllD', '坦克全部战毁，密码局失去最后防线。');
  en('gt.loseAllD', 'All tanks lost — the bureau lost its last line of defense.');
  zh('gt.score', '得分'); en('gt.score', 'SCORE');

  zh('gs.tank.hq', '密'); en('gs.tank.hq', 'HQ');
  zh('gs.tank.waveSub', '敌军来袭 · 守住基地');
  en('gs.tank.waveSub', 'INCOMING · DEFEND THE BASE');
  zh('gs.tank.waveBossSub', '最终防线 · BOSS 波次');
  en('gs.tank.waveBossSub', 'LAST LINE · BOSS WAVE');
  zh('gs.tank.waveClear', '波次肃清'); en('gs.tank.waveClear', 'WAVE CLEARED');
  zh('gs.tank.waveNext', '下一波 {n} 即将到来');
  en('gs.tank.waveNext', 'Wave {n} incoming');
  zh('gs.tank.best', '最高分'); en('gs.tank.best', 'Best');
  zh('gs.tank.restart', '重新开始'); en('gs.tank.restart', 'Restart');
  zh('gs.tank.changeDiff', '换难度'); en('gs.tank.changeDiff', 'Change difficulty');
  zh('gs.tank.pauseTitle', '已暂停'); en('gs.tank.pauseTitle', 'Paused');
  zh('gs.tank.pauseHint', '按 P 或下方按钮继续');
  en('gs.tank.pauseHint', 'Press P or the button below to resume');
  zh('gs.tank.resume', '继续'); en('gs.tank.resume', 'Resume');
  zh('gs.tank.pauseBtn', '暂停'); en('gs.tank.pauseBtn', 'Pause');

  /* 双人模式 */
  zh('gs.tank.modeOneP', '单人守卫'); en('gs.tank.modeOneP', 'SOLO');
  zh('gs.tank.modeOnePSub', '方向键 / WASD · 空格开火');
  en('gs.tank.modeOnePSub', 'Arrows / WASD · Space');
  zh('gs.tank.modeTwoP', '双人合作'); en('gs.tank.modeTwoP', 'CO-OP');
  zh('gs.tank.modeTwoPSub', 'P1 方向键 + 空格 · P2 WASD + F');
  en('gs.tank.modeTwoPSub', 'P1 arrows + Space · P2 WASD + F');
  zh('gs.tank.tut2x', '单人：方向键或 WASD 移动、空格开火；双人：P1 方向键 + 空格，P2 用 WASD + F。按 P 或暂停按钮暂停。');
  en('gs.tank.tut2x', 'Solo: arrows or WASD to move, Space to fire. Co-op: P1 arrows + Space, P2 WASD + F. Press P or the pause button to pause.');

  /* 敌情 / BOSS */
  zh('gs.tank.tut3t', '敌情'); en('gs.tank.tut3t', 'Threats');
  zh('gs.tank.tut3x', '普通、快速、装甲、狙击四类敌兵按权重混编：粉色普通、黄色快速、橙色装甲、紫色狙击。每 3 波与最终波出现 BOSS，三连发弹幕与顶部血条。');
  en('gs.tank.tut3x', 'Four enemy types are mixed by weight: pink normal, yellow fast, orange armor, purple sniper. Every 3rd and final wave adds a BOSS with triple-shot barrages and a top health bar.');
  zh('gs.tank.bossIncoming', 'BOSS 来袭'); en('gs.tank.bossIncoming', 'BOSS INCOMING');
  zh('gs.tank.bossKilled', 'BOSS 击破'); en('gs.tank.bossKilled', 'BOSS DOWN');
  zh('gs.tank.bossKilledToast', 'BOSS 击破！+{s} 分');
  en('gs.tank.bossKilledToast', 'BOSS destroyed! +{s} pts');
  zh('gs.tank.bossBonus', 'BOSS 奖励'); en('gs.tank.bossBonus', 'BOSS REWARD');
  zh('gs.tank.bossBar', 'BOSS'); en('gs.tank.bossBar', 'BOSS');

  /* 升级 */
  zh('gs.tank.tut4t', '升级'); en('gs.tank.tut4t', 'Upgrades');
  zh('gs.tank.tut4x', '每波结束与 BOSS 击破后三选一强化：穿透弹、射速、护盾、基地修复、移速、双发。升级整局累计，键盘 1/2/3 或触控选择。');
  en('gs.tank.tut4x', 'After each wave and every BOSS kill, pick 1 of 3 upgrades: piercing shells, fire rate, shield, base repair, speed, twin barrels. Upgrades stack for the whole run; choose with keys 1/2/3 or touch.');
  zh('gs.tank.upgradeTitle', '战术升级'); en('gs.tank.upgradeTitle', 'TACTICAL UPGRADE');
  zh('gs.tank.upgradeSub', '选择一项强化 · 键盘 1/2/3 或点击');
  en('gs.tank.upgradeSub', 'Pick one upgrade · keys 1/2/3 or tap');
  zh('gs.tank.upgradeBossSub', '击败 BOSS 的额外奖励 · 选择一项强化');
  en('gs.tank.upgradeBossSub', 'Extra reward for defeating the BOSS · pick one upgrade');
  zh('gs.tank.upChosen', '已获得：{n}'); en('gs.tank.upChosen', 'Upgrade acquired: {n}');

  zh('gs.tank.up.pierce', '穿透弹'); en('gs.tank.up.pierce', 'Piercing shells');
  zh('gs.tank.up.pierce.desc', '炮弹击穿砖墙继续飞行；再次强化提升对非装甲敌人的伤害。');
  en('gs.tank.up.pierce.desc', 'Shells break through brick walls and keep flying; further picks boost damage against non-armored foes.');
  zh('gs.tank.up.rate', '高射速'); en('gs.tank.up.rate', 'Fire rate');
  zh('gs.tank.up.rate.desc', '缩短开火间隔，持续压制敌军。');
  en('gs.tank.up.rate.desc', 'Shorter firing interval for constant suppression.');
  zh('gs.tank.up.shield', '能量护盾'); en('gs.tank.up.shield', 'Energy shield');
  zh('gs.tank.up.shield.desc', '所有存活守卫获得 8 秒护盾，抵挡一次致命命中。');
  en('gs.tank.up.shield.desc', 'All surviving guards gain an 8-second shield that absorbs one lethal hit.');
  zh('gs.tank.up.repair', '基地修复'); en('gs.tank.up.repair', 'Base repair');
  zh('gs.tank.up.repair.desc', '重建基地前沿围墙，并补充 1 点共享生命。');
  en('gs.tank.up.repair.desc', 'Rebuild the base front walls and add 1 shared life.');
  zh('gs.tank.up.speed', '涡轮引擎'); en('gs.tank.up.speed', 'Turbo engine');
  zh('gs.tank.up.speed.desc', '守卫移动速度提升 15%，更灵活地走位。');
  en('gs.tank.up.speed.desc', 'Guards move 15% faster for sharper positioning.');
  zh('gs.tank.up.twin', '双联炮管'); en('gs.tank.up.twin', 'Twin barrels');
  zh('gs.tank.up.twin.desc', '每次开火并排射出两发炮弹，火力翻倍。');
  en('gs.tank.up.twin.desc', 'Fire two parallel shells per shot — double the firepower.');

  zh('gs.tank.helpText', '坦克大战的加密通信模式模拟了真实战场：恩尼格玛的每日密钥、JN-25 的加表复用、紫密的双路步进——每种密码体系的破与防都在战场上演。<a class="gh-link" href="../../story.html?id=ww1">见编年史「一战的电波战」→</a>');
  en('gs.tank.helpText', 'Tank battle\'s encrypted communication mode simulates real warfare: Enigma\'s daily keys, JN-25\'s additive reuse, Purple\'s dual-path stepping — every cipher system\'s cat-and-mouse plays out on the battlefield. <a class="gh-link" href="../../story.html?id=ww1">See the Chronicle chapter "The Radio War" &rarr;</a>');
})();
