/* 游戏厅 · spaceshooter 游戏内文案（zh/en 对称）
   由 i18n-dict.js 拆分生成 —— 游戏页按需加载，减小站点字典体积 */
(function () {
  var d = Arcade.i18n.dicts;

  /* ---------------- 教程 ---------------- */
  d.zh['gs.spaceshooter.tutTitle'] = '太空射击 · 玩法';
  d.en['gs.spaceshooter.tutTitle'] = 'Space Shooter · How to Play';
  d.zh['gs.spaceshooter.tut1t'] = '目标';
  d.en['gs.spaceshooter.tut1t'] = 'Objective';
  d.zh['gs.spaceshooter.tut1'] = '战役模式穿过 10 波敌军并击败 Boss 即可通关；无尽模式则会不断刷新波次与词缀，直到生命归零。';
  d.en['gs.spaceshooter.tut1'] = 'Campaign mode: survive 10 waves and beat the Boss to win. Endless mode keeps stacking waves and affixes until your lives run out.';
  d.zh['gs.spaceshooter.tut2t'] = '操作';
  d.en['gs.spaceshooter.tut2t'] = 'Controls';
  d.zh['gs.spaceshooter.tut2'] = '方向键 / WASD 移动，自动开火；P 或 Esc 暂停；空格 / B 释放炸弹，L 切换僚机编队。触屏拖拽移动，下方按钮同样可用。';
  d.en['gs.spaceshooter.tut2'] = 'Arrows / WASD move with auto-fire; P or Esc pauses; Space / B fires a bomb; L switches wing formation. On touch, drag the playfield and use the on-screen buttons.';
  d.zh['gs.spaceshooter.tut3t'] = '护盾';
  d.en['gs.spaceshooter.tut3t'] = 'Shields';
  d.zh['gs.spaceshooter.tut3'] = '护盾优先抵挡伤害。盾被打空后会进入 6~8 秒冷却，HUD 显示倒计时，之后逐段充能，不会瞬间回满。';
  d.en['gs.spaceshooter.tut3'] = 'Shields absorb hits first. When depleted they enter a 6-8 second cooldown shown on the HUD, then recharge one segment at a time; they never refill instantly.';
  d.zh['gs.spaceshooter.tut4t'] = '僚机与词缀';
  d.en['gs.spaceshooter.tut4t'] = 'Wings & Affixes';
  d.zh['gs.spaceshooter.tut4'] = '击落精英或 Boss 阶段转换会掉落僚机，最多两架。无尽模式每 5 波叠加 1 条词缀，真实改变敌速、弹幕、计分与恢复。';
  d.en['gs.spaceshooter.tut4'] = 'Elites and Boss phase shifts drop wingmen (max two). Endless mode adds one affix every 5 waves, actually changing enemy speed, density, scoring and recovery.';

  /* ---------------- HUD ---------------- */
  d.zh['gs.spaceshooter.hudLives'] = '生命';
  d.en['gs.spaceshooter.hudLives'] = 'LIVES';
  d.zh['gs.spaceshooter.hudShield'] = '护盾';
  d.en['gs.spaceshooter.hudShield'] = 'SHIELD';
  d.zh['gs.spaceshooter.hudScore'] = '分数';
  d.en['gs.spaceshooter.hudScore'] = 'SCORE';
  d.zh['gs.spaceshooter.hudWave'] = '波次';
  d.en['gs.spaceshooter.hudWave'] = 'WAVE';
  d.zh['gs.spaceshooter.hudShip'] = '机体';
  d.en['gs.spaceshooter.hudShip'] = 'SHIP';
  d.zh['gs.spaceshooter.hudWeapon'] = '武器';
  d.en['gs.spaceshooter.hudWeapon'] = 'WEAPON';
  d.zh['gs.spaceshooter.hudWing'] = '僚机';
  d.en['gs.spaceshooter.hudWing'] = 'WINGS';
  d.zh['gs.spaceshooter.hudBomb'] = '炸弹';
  d.en['gs.spaceshooter.hudBomb'] = 'BOMBS';
  d.zh['gs.spaceshooter.hudAffix'] = '词缀';
  d.en['gs.spaceshooter.hudAffix'] = 'AFFIXES';
  d.zh['gs.spaceshooter.boss'] = 'BOSS';
  d.en['gs.spaceshooter.boss'] = 'BOSS';

  d.zh['gs.spaceshooter.controlsText'] = '方向键 / WASD 移动 · 自动开火 · 空格/B 炸弹 · L 僚机 · P 暂停 · 触屏拖拽';
  d.en['gs.spaceshooter.controlsText'] = 'Arrows / WASD move \u00b7 auto-fire \u00b7 Space/B bomb \u00b7 L wings \u00b7 P pause \u00b7 drag on touch';
  d.zh['gs.spaceshooter.readyTitle'] = '太空射击';
  d.en['gs.spaceshooter.readyTitle'] = 'SPACE SHOOTER';
  d.zh['gs.spaceshooter.readyText'] = '选择机体、武器与模式。三架机体手感不同，三类武器可升到 3 级，僚机与 BOSS 库等待解锁。';
  d.en['gs.spaceshooter.readyText'] = 'Pick a hull, weapon and mode. Three ships fly differently, three weapons upgrade to level 3, and wingmen plus a Boss library await.';
  d.zh['gs.spaceshooter.startBtn'] = '开始任务';
  d.en['gs.spaceshooter.startBtn'] = 'Start mission';
  d.zh['gs.spaceshooter.pauseBtn'] = '暂停';
  d.en['gs.spaceshooter.pauseBtn'] = 'Pause';
  d.zh['gs.spaceshooter.resumeBtn'] = '继续';
  d.en['gs.spaceshooter.resumeBtn'] = 'Resume';
  d.zh['gs.spaceshooter.pauseTitle'] = '已暂停';
  d.en['gs.spaceshooter.pauseTitle'] = 'PAUSED';
  d.zh['gs.spaceshooter.pauseText'] = '按 P / Esc 或点击继续返回战场。';
  d.en['gs.spaceshooter.pauseText'] = 'Press P / Esc or tap resume to return to battle.';
  d.zh['gs.spaceshooter.restart'] = '重新开始';
  d.en['gs.spaceshooter.restart'] = 'Restart';

  /* ---------------- 开局选择 ---------------- */
  d.zh['gs.spaceshooter.shipLabel'] = '机体';
  d.en['gs.spaceshooter.shipLabel'] = 'HULL';
  d.zh['gs.spaceshooter.weaponLabel'] = '武器';
  d.en['gs.spaceshooter.weaponLabel'] = 'WEAPON';
  d.zh['gs.spaceshooter.modeLabel'] = '模式';
  d.en['gs.spaceshooter.modeLabel'] = 'MODE';

  d.zh['gs.spaceshooter.shipAssault'] = '突击机';
  d.en['gs.spaceshooter.shipAssault'] = 'Assault';
  d.zh['gs.spaceshooter.shipAssaultDesc'] = 'HP 3 · 高速 · 小判定';
  d.en['gs.spaceshooter.shipAssaultDesc'] = 'HP 3 \u00b7 fast \u00b7 small hitbox';
  d.zh['gs.spaceshooter.shipGuard'] = '护卫机';
  d.en['gs.spaceshooter.shipGuard'] = 'Guard';
  d.zh['gs.spaceshooter.shipGuardDesc'] = 'HP 5 · 3 盾 · 大判定';
  d.en['gs.spaceshooter.shipGuardDesc'] = 'HP 5 \u00b7 3 shields \u00b7 large hitbox';
  d.zh['gs.spaceshooter.shipBomber'] = '轰炸机';
  d.en['gs.spaceshooter.shipBomber'] = 'Bomber';
  d.zh['gs.spaceshooter.shipBomberDesc'] = 'HP 4 · 重炮 · 判定大';
  d.en['gs.spaceshooter.shipBomberDesc'] = 'HP 4 \u00b7 heavy guns \u00b7 large hitbox';

  d.zh['gs.spaceshooter.weaponSpread'] = '散射';
  d.en['gs.spaceshooter.weaponSpread'] = 'Spread';
  d.zh['gs.spaceshooter.weaponSpreadDesc'] = '扇形弹幕';
  d.en['gs.spaceshooter.weaponSpreadDesc'] = 'fan barrage';
  d.zh['gs.spaceshooter.weaponLaser'] = '激光';
  d.en['gs.spaceshooter.weaponLaser'] = 'Laser';
  d.zh['gs.spaceshooter.weaponLaserDesc'] = '高速贯穿';
  d.en['gs.spaceshooter.weaponLaserDesc'] = 'fast piercing';
  d.zh['gs.spaceshooter.weaponMissile'] = '导弹';
  d.en['gs.spaceshooter.weaponMissile'] = 'Missile';
  d.zh['gs.spaceshooter.weaponMissileDesc'] = '追踪爆破';
  d.en['gs.spaceshooter.weaponMissileDesc'] = 'homing blast';

  d.zh['gs.spaceshooter.modeCampaign'] = '战役';
  d.en['gs.spaceshooter.modeCampaign'] = 'Campaign';
  d.zh['gs.spaceshooter.modeCampaignDesc'] = '10 波 + BOSS';
  d.en['gs.spaceshooter.modeCampaignDesc'] = '10 waves + Boss';
  d.zh['gs.spaceshooter.modeEndless'] = '无尽';
  d.en['gs.spaceshooter.modeEndless'] = 'Endless';
  d.zh['gs.spaceshooter.modeEndlessDesc'] = '无限波次 · 词缀';
  d.en['gs.spaceshooter.modeEndlessDesc'] = 'endless \u00b7 affixes';

  /* ---------------- 波次 / Boss ---------------- */
  d.zh['gs.spaceshooter.waveBanner'] = '第 {n} 波';
  d.en['gs.spaceshooter.waveBanner'] = 'WAVE {n}';
  d.zh['gs.spaceshooter.waveMsg'] = '第 {n} 波敌军来袭';
  d.en['gs.spaceshooter.waveMsg'] = 'Wave {n} incoming';
  d.zh['gs.spaceshooter.waveClear'] = '第 {n} 波清除！';
  d.en['gs.spaceshooter.waveClear'] = 'Wave {n} clear!';
  d.zh['gs.spaceshooter.waveClearMsg'] = '准备迎击下一波';
  d.en['gs.spaceshooter.waveClearMsg'] = 'Get ready for the next wave';
  d.zh['gs.spaceshooter.bossIncoming'] = 'BOSS 即将出现';
  d.en['gs.spaceshooter.bossIncoming'] = 'BOSS incoming';
  d.zh['gs.spaceshooter.bossWarn'] = 'BOSS 来袭：{n}';
  d.en['gs.spaceshooter.bossWarn'] = 'BOSS INCOMING: {n}';
  d.zh['gs.spaceshooter.bossPhase'] = 'BOSS 第 {n} 阶段';
  d.en['gs.spaceshooter.bossPhase'] = 'BOSS PHASE {n}';
  d.zh['gs.spaceshooter.bossDefeated'] = 'BOSS 已击破！';
  d.en['gs.spaceshooter.bossDefeated'] = 'BOSS DESTROYED!';
  d.zh['gs.spaceshooter.endlessEnter'] = '无尽模式启动';
  d.en['gs.spaceshooter.endlessEnter'] = 'ENDLESS MODE ONLINE';
  d.zh['gs.spaceshooter.laserWarn'] = '激光锁定！';
  d.en['gs.spaceshooter.laserWarn'] = 'LASER LOCK!';

  d.zh['gs.spaceshooter.bossCrimson'] = '绯红核心';
  d.en['gs.spaceshooter.bossCrimson'] = 'Crimson Core';
  d.zh['gs.spaceshooter.bossPrism'] = '棱镜母舰';
  d.en['gs.spaceshooter.bossPrism'] = 'Prism Carrier';
  d.zh['gs.spaceshooter.bossVoid'] = '虚空吞噬者';
  d.en['gs.spaceshooter.bossVoid'] = 'Void Devourer';

  /* ---------------- 护盾 / 受击 ---------------- */
  d.zh['gs.spaceshooter.shielded'] = '护盾抵挡了一击';
  d.en['gs.spaceshooter.shielded'] = 'Shield absorbed a hit';
  d.zh['gs.spaceshooter.hit'] = '机体受损！';
  d.en['gs.spaceshooter.hit'] = 'Hull damaged!';
  d.zh['gs.spaceshooter.shieldRecharged'] = '护盾充能 +1';
  d.en['gs.spaceshooter.shieldRecharged'] = 'Shield recharged +1';
  d.zh['gs.spaceshooter.shieldRechargeStart'] = '护盾冷却结束，开始充能';
  d.en['gs.spaceshooter.shieldRechargeStart'] = 'Shield cooldown over, recharging';
  d.zh['gs.spaceshooter.shieldBrokenMsg'] = '护盾破裂！冷却 {s} 秒';
  d.en['gs.spaceshooter.shieldBrokenMsg'] = 'Shield broken! {s}s cooldown';
  d.zh['gs.spaceshooter.shieldCooldownFmt'] = '冷却 {s}s';
  d.en['gs.spaceshooter.shieldCooldownFmt'] = 'CD {s}s';
  d.zh['gs.spaceshooter.shieldChargingFmt'] = '{a}/{b} 充能';
  d.en['gs.spaceshooter.shieldChargingFmt'] = '{a}/{b} charging';
  d.zh['gs.spaceshooter.shieldPickupLocked'] = '护盾冷却中，无法恢复';
  d.en['gs.spaceshooter.shieldPickupLocked'] = 'Shield is cooling down';

  /* ---------------- 道具 ---------------- */
  d.zh['gs.spaceshooter.weaponUp'] = '武器升级 Lv{n}';
  d.en['gs.spaceshooter.weaponUp'] = 'Weapon upgraded to Lv{n}';
  d.zh['gs.spaceshooter.weaponMax'] = '武器已满级 · 炸弹 +1';
  d.en['gs.spaceshooter.weaponMax'] = 'Weapon maxed \u00b7 bomb +1';
  d.zh['gs.spaceshooter.shieldUp'] = '护盾 +1';
  d.en['gs.spaceshooter.shieldUp'] = 'Shield +1';
  d.zh['gs.spaceshooter.shieldMaxMsg'] = '护盾已满';
  d.en['gs.spaceshooter.shieldMaxMsg'] = 'Shield is full';
  d.zh['gs.spaceshooter.healed'] = '生命 +1';
  d.en['gs.spaceshooter.healed'] = 'Life +1';
  d.zh['gs.spaceshooter.healMaxMsg'] = '生命已满';
  d.en['gs.spaceshooter.healMaxMsg'] = 'Lives are full';
  d.zh['gs.spaceshooter.bombUp'] = '炸弹 +1';
  d.en['gs.spaceshooter.bombUp'] = 'Bomb +1';
  d.zh['gs.spaceshooter.bombMaxMsg'] = '炸弹已满';
  d.en['gs.spaceshooter.bombMaxMsg'] = 'Bombs are full';
  d.zh['gs.spaceshooter.wingGot'] = '僚机加入编队！';
  d.en['gs.spaceshooter.wingGot'] = 'Wingman joined the formation!';
  d.zh['gs.spaceshooter.wingLost'] = '僚机被击落';
  d.en['gs.spaceshooter.wingLost'] = 'Wingman lost';
  d.zh['gs.spaceshooter.wingFull'] = '僚机已满编 · 炸弹 +1';
  d.en['gs.spaceshooter.wingFull'] = 'Wings full \u00b7 bomb +1';
  d.zh['gs.spaceshooter.wingModeFocus'] = '僚机编队：集中';
  d.en['gs.spaceshooter.wingModeFocus'] = 'Wings: focused';
  d.zh['gs.spaceshooter.wingModeSpread'] = '僚机编队：分散';
  d.en['gs.spaceshooter.wingModeSpread'] = 'Wings: spread';
  d.zh['gs.spaceshooter.wingDropMsg'] = '僚机补给已投放';
  d.en['gs.spaceshooter.wingDropMsg'] = 'Wingman supply dropped';
  d.zh['gs.spaceshooter.wingBtn'] = '僚机';
  d.en['gs.spaceshooter.wingBtn'] = 'Wings';
  d.zh['gs.spaceshooter.bombBtn'] = '炸弹';
  d.en['gs.spaceshooter.bombBtn'] = 'Bomb';
  d.zh['gs.spaceshooter.bombUsed'] = '清屏炸弹！';
  d.en['gs.spaceshooter.bombUsed'] = 'Screen-clearing bomb!';
  d.zh['gs.spaceshooter.bombEmptyMsg'] = '没有炸弹了';
  d.en['gs.spaceshooter.bombEmptyMsg'] = 'No bombs left';

  /* ---------------- 无尽词缀 ---------------- */
  d.zh['gs.spaceshooter.affixBanner'] = '词缀：{n}';
  d.en['gs.spaceshooter.affixBanner'] = 'AFFIX: {n}';
  d.zh['gs.spaceshooter.affixAffixLabel'] = '词缀';
  d.en['gs.spaceshooter.affixAffixLabel'] = 'AFFIX';
  d.zh['gs.spaceshooter.affixSwift'] = '敌速 +30%';
  d.en['gs.spaceshooter.affixSwift'] = 'Enemy speed +30%';
  d.zh['gs.spaceshooter.affixDense'] = '弹幕密度 +1';
  d.en['gs.spaceshooter.affixDense'] = 'Barrage density +1';
  d.zh['gs.spaceshooter.affixScore'] = '得分 ×2';
  d.en['gs.spaceshooter.affixScore'] = 'Score x2';
  d.zh['gs.spaceshooter.affixRegen'] = '护盾恢复 -50%';
  d.en['gs.spaceshooter.affixRegen'] = 'Shield recovery -50%';
  d.zh['gs.spaceshooter.affixWing'] = '僚机火力 +50%';
  d.en['gs.spaceshooter.affixWing'] = 'Wing fire +50%';

  /* ---------------- 结算 ---------------- */
  d.zh['gs.spaceshooter.scoreFmt'] = '最终得分 {n}';
  d.en['gs.spaceshooter.scoreFmt'] = 'Final score {n}';
  d.zh['gs.spaceshooter.killsFmt'] = '击落 {n} 架';
  d.en['gs.spaceshooter.killsFmt'] = '{n} ships destroyed';
  d.zh['gs.spaceshooter.timeFmt'] = '用时 {t}';
  d.en['gs.spaceshooter.timeFmt'] = 'Time {t}';
  d.zh['gs.spaceshooter.reachedFmt'] = '抵达第 {n} 波';
  d.en['gs.spaceshooter.reachedFmt'] = 'Reached wave {n}';
  d.zh['gs.spaceshooter.bestFmt'] = '最高分 {n}';
  d.en['gs.spaceshooter.bestFmt'] = 'Best {n}';
  d.zh['gs.spaceshooter.newRecordFmt'] = '新纪录！';
  d.en['gs.spaceshooter.newRecordFmt'] = 'NEW RECORD!';

  d.zh['gs.spaceshooter.winTitle'] = '任务完成';
  d.en['gs.spaceshooter.winTitle'] = 'MISSION COMPLETE';
  d.zh['gs.spaceshooter.loseTitle'] = '防线失守';
  d.en['gs.spaceshooter.loseTitle'] = 'LINE BREACHED';
  d.zh['gs.spaceshooter.endlessOverTitle'] = '无尽征程结束';
  d.en['gs.spaceshooter.endlessOverTitle'] = 'ENDLESS RUN OVER';
  d.zh['gs.spaceshooter.again'] = '再来一局';
  d.en['gs.spaceshooter.again'] = 'Play again';
  d.zh['gs.spaceshooter.backBtn'] = '返回机库';
  d.en['gs.spaceshooter.backBtn'] = 'Back to hangar';

  /* ---------------- 帮助 / 兼容旧键 ---------------- */
  d.zh['gs.spaceshooter.killsFmtOld'] = '击杀 {n}';
  d.en['gs.spaceshooter.killsFmtOld'] = 'Kills {n}';
  d.zh['gs.spaceshooter.statusFmt'] = '生命 {a} · 第 {b} 波';
  d.en['gs.spaceshooter.statusFmt'] = 'Lives {a} \u00b7 Wave {b}';
  d.zh['gs.spaceshooter.hint'] = '方向键 / WASD 移动，自动开火；触屏拖拽移动。';
  d.en['gs.spaceshooter.hint'] = 'Arrows / WASD move with auto-fire; drag on touch.';
  d.zh['gs.spaceshooter.paused'] = '已暂停';
  d.en['gs.spaceshooter.paused'] = 'Paused';
  d.zh['gs.spaceshooter.loseFmt'] = '任务失败：得分 {n}';
  d.en['gs.spaceshooter.loseFmt'] = 'Mission failed: score {n}';
  d.zh['gs.spaceshooter.spreadOn'] = '散射火力已就绪！';
  d.en['gs.spaceshooter.spreadOn'] = 'Spread fire ready!';
  d.zh['gs.spaceshooter.help'] = '机体 / 武器 / 模式可在开局选择；武器拾取可升到 Lv3。护盾破裂后有 6~8 秒冷却并分段充能；精英与 Boss 掉落僚机。无尽模式每 5 波叠加词缀。';
  d.en['gs.spaceshooter.help'] = 'Pick hull, weapon and mode before launch; weapon pickups upgrade to Lv3. Broken shields need a 6-8s cooldown then recharge in segments; elites and Bosses drop wingmen. Endless mode stacks an affix every 5 waves.';
  d.zh['gs.spaceshooter.helpText'] = '弹幕游戏的本质是实时路径规划：在不可预测的威胁场里寻找安全走廊。它和自动驾驶的避障决策共享同一套算法直觉。';
  d.en['gs.spaceshooter.helpText'] = 'Bullet-hell games are real-time path planning: finding safe corridors in an unpredictable threat field. It shares algorithmic intuition with autonomous obstacle avoidance.';
})();
