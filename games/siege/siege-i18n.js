/* 游戏厅 · siege 游戏内文案（zh/en 对称）
   由 i18n-dict.js 拆分生成 —— 游戏页按需加载，减小站点字典体积 */
(function () {
  var d = Arcade.i18n.dicts;

  d.zh['gs.siege.tutTitle'] = '攻城棋 · 玩法';
  d.en['gs.siege.tutTitle'] = 'Siege · How to Play';

  d.zh['gs.siege.tut1t'] = '目标';
  d.en['gs.siege.tut1t'] = 'Objective';
  d.zh['gs.siege.tut1'] = '你执蓝方（下方），红方在上方。吃掉敌方全部国王即获胜；自己的国王全部阵亡则失败。';
  d.en['gs.siege.tut1'] = 'You are Blue (bottom); Red holds the top. Capture every enemy king to win; lose all your kings and you are defeated.';

  d.zh['gs.siege.tut2t'] = '行动点';
  d.en['gs.siege.tut2t'] = 'Action Point';
  d.zh['gs.siege.tut2'] = '每回合只有 1 个行动点：选一枚己方棋子，移动或攻击一次，然后轮到对手。点棋子看白圈（移动）与红圈（攻击），再点目标格落子。';
  d.en['gs.siege.tut2'] = 'Each turn grants 1 action point: pick one of your pieces, move or attack once, then pass to the opponent. Tap a piece to see white rings (move) and red rings (attack), then tap a target cell.';

  d.zh['gs.siege.tut3t'] = '移动与攻击范围';
  d.en['gs.siege.tut3t'] = 'Move & Attack Range';
  d.zh['gs.siege.tut3'] = '士兵可向前、左、右各走 1 格，斜前方 1 格攻击；站在高地（深色格）时，斜前方 2 格也能攻击（中间格必须空着）。国王可向 8 个方向移动或攻击 1 格。士兵走到对方底线会加冕为国王。';
  d.en['gs.siege.tut3'] = 'Soldiers step 1 cell forward, left or right, and attack 1 cell diagonally forward. On high ground (dark cells), soldiers also attack 2 cells diagonally forward if the middle cell is empty. Kings move or attack 1 cell in all 8 directions. A soldier reaching the enemy back row is crowned king.';

  d.zh['gs.siege.tut4t'] = '据点与计分';
  d.en['gs.siege.tut4t'] = 'Flags & Scoring';
  d.zh['gs.siege.tut4'] = '棋盘中央有 4 个据点，棋子踏上即占领（+3 分），对手也可以踩上去反夺。吃兵 +1 分、吃王 +10 分，成绩为蓝方总分。';
  d.en['gs.siege.tut4'] = 'Four flags sit in the centre; stepping on one claims it (+3 points), and the opponent can retake it. Capturing a soldier scores +1, a king +10. Your score is Blue\'s total.';

  d.zh['gs.siege.tut5t'] = 'AI 差异';
  d.en['gs.siege.tut5t'] = 'AI Levels';
  d.zh['gs.siege.tut5'] = '简单：随机走子，偶尔贪吃；普通：两层预判，会躲开你最狠的反击；困难：四层 αβ 剪枝限时搜索，抢先占高地与据点。可用 P / Esc 暂停。';
  d.en['gs.siege.tut5'] = 'Easy: random moves with occasional greedy captures. Normal: two-ply lookahead that avoids your strongest counterattack. Hard: four-ply alpha-beta search under a time limit, seizing high ground and flags. Press P / Esc to pause.';

  d.zh['gs.siege.pauseBtn'] = '暂停';
  d.en['gs.siege.pauseBtn'] = 'Pause';
  d.zh['gs.siege.restartBtn'] = '重开';
  d.en['gs.siege.restartBtn'] = 'Restart';
  d.zh['gs.siege.changeDiff'] = '换难度';
  d.en['gs.siege.changeDiff'] = 'Difficulty';
  d.zh['gs.siege.help'] = '每回合 1 个行动点。深色高地：士兵斜前方攻击 +1 格。踩上中央据点 +3 分，可被反夺。';
  d.en['gs.siege.help'] = '1 action point per turn. Dark high ground extends soldier attacks by +1 diagonal. Claim central flags for +3; they can be retaken.';

  d.zh['gs.siege.menuTitle'] = '攻城棋';
  d.en['gs.siege.menuTitle'] = 'SIEGE';
  d.zh['gs.siege.menuSub'] = '每局随机地形 · 选择 AI 难度后开战';
  d.en['gs.siege.menuSub'] = 'Random terrain every match · pick an AI level to begin';
  d.zh['gs.siege.startBtn'] = '开始攻城';
  d.en['gs.siege.startBtn'] = 'Start Siege';

  d.zh['gs.siege.diffEasy'] = '简单';
  d.en['gs.siege.diffEasy'] = 'Easy';
  d.zh['gs.siege.diffEasyDesc'] = '随机走子，偶尔贪吃';
  d.en['gs.siege.diffEasyDesc'] = 'Random moves, occasional greedy captures';
  d.zh['gs.siege.diffNormal'] = '普通';
  d.en['gs.siege.diffNormal'] = 'Normal';
  d.zh['gs.siege.diffNormalDesc'] = '两层预判，警惕你的反击';
  d.en['gs.siege.diffNormalDesc'] = 'Two-ply lookahead, guards against counters';
  d.zh['gs.siege.diffHard'] = '困难';
  d.en['gs.siege.diffHard'] = 'Hard';
  d.zh['gs.siege.diffHardDesc'] = '四层 αβ 搜索，抢占高地与据点';
  d.en['gs.siege.diffHardDesc'] = 'Four-ply alpha-beta, fights for hills and flags';

  d.zh['gs.siege.pausedTitle'] = '已暂停';
  d.en['gs.siege.pausedTitle'] = 'PAUSED';
  d.zh['gs.siege.resumeBtn'] = '继续';
  d.en['gs.siege.resumeBtn'] = 'Resume';

  d.zh['gs.siege.msgStart'] = '你是蓝方，攻向红方王城！';
  d.en['gs.siege.msgStart'] = 'You are Blue — march on the Red fortress!';
  d.zh['gs.siege.msgSkip'] = '红方无子可动，跳过一回合';
  d.en['gs.siege.msgSkip'] = 'Red has no legal move and skips a turn';
  d.zh['gs.siege.youCaptured'] = '你吃掉了敌方{n}！';
  d.en['gs.siege.youCaptured'] = 'You captured an enemy {n}!';
  d.zh['gs.siege.enemyCaptured'] = '敌方吃掉了你的{n}';
  d.en['gs.siege.enemyCaptured'] = 'The enemy captured your {n}';
  d.zh['gs.siege.unitKing'] = '国王';
  d.en['gs.siege.unitKing'] = 'king';
  d.zh['gs.siege.unitSoldier'] = '士兵';
  d.en['gs.siege.unitSoldier'] = 'soldier';
  d.zh['gs.siege.flagClaimed'] = '占领据点 +3 分！';
  d.en['gs.siege.flagClaimed'] = 'Flag claimed (+3)!';
  d.zh['gs.siege.promoted'] = '士兵加冕为国王！';
  d.en['gs.siege.promoted'] = 'Soldier crowned king!';

  d.zh['gs.siege.mapPlain'] = '平原';
  d.en['gs.siege.mapPlain'] = 'Plains';
  d.zh['gs.siege.mapRiver'] = '河流';
  d.en['gs.siege.mapRiver'] = 'River';
  d.zh['gs.siege.mapFortress'] = '要塞';
  d.en['gs.siege.mapFortress'] = 'Fortress';

  d.zh['gs.siege.hudHint'] = '选择难度开始';
  d.en['gs.siege.hudHint'] = 'Choose a level to start';
  d.zh['gs.siege.thinking'] = 'AI 思考中…';
  d.en['gs.siege.thinking'] = 'AI thinking…';
  d.zh['gs.siege.turnBlue'] = '你的回合（蓝）';
  d.en['gs.siege.turnBlue'] = 'Your turn (Blue)';
  d.zh['gs.siege.turnRed'] = '红方回合';
  d.en['gs.siege.turnRed'] = 'Red\'s turn';
  d.zh['gs.siege.hudRound'] = '回合';
  d.en['gs.siege.hudRound'] = 'Round';
  d.zh['gs.siege.hudScore'] = '得分';
  d.en['gs.siege.hudScore'] = 'Score';
  d.zh['gs.siege.hudFlags'] = '据点';
  d.en['gs.siege.hudFlags'] = 'Flags';
  d.zh['gs.siege.hudDiff'] = '难度';
  d.en['gs.siege.hudDiff'] = 'Level';
  d.zh['gs.siege.hudMap'] = '地形';
  d.en['gs.siege.hudMap'] = 'Map';

  d.zh['gs.siege.resultWin'] = '攻下王城！';
  d.en['gs.siege.resultWin'] = 'FORTRESS TAKEN!';
  d.zh['gs.siege.resultLose'] = '国王阵亡…';
  d.en['gs.siege.resultLose'] = 'YOUR KING HAS FALLEN';
  d.zh['gs.siege.resRounds'] = '回合数';
  d.en['gs.siege.resRounds'] = 'Rounds';
  d.zh['gs.siege.resFlags'] = '占领据点';
  d.en['gs.siege.resFlags'] = 'Flags held';
  d.zh['gs.siege.resScore'] = '你的得分';
  d.en['gs.siege.resScore'] = 'Your score';
  d.zh['gs.siege.resEnemyScore'] = '敌方得分';
  d.en['gs.siege.resEnemyScore'] = 'Enemy score';
  d.zh['gs.siege.playAgain'] = '再来一局';
  d.en['gs.siege.playAgain'] = 'Play Again';

  d.zh['gs.siege.helpText'] = '攻城棋训练的是战术规划与资源分配。';
  d.en['gs.siege.helpText'] = 'Siege games train tactical planning and resource allocation.';

  /* ---- 旗舰扩展：弓手 / 法术 / 战役 ---- */
  d.zh['gs.siege.tut6t'] = '弓手与法术';
  d.en['gs.siege.tut6t'] = 'Archers & Spells';
  d.zh['gs.siege.tut6'] = '弓手可隔 2 格直线射击（高地 3 格，路径必须为空），但近身无法攻击。每局你各有 1 次落雷（消灭非王单位）、护盾（抵挡一次攻击）、援军（在底线召唤士兵）；施放法术会消耗本回合行动点，快捷键 1 / 2 / 3。';
  d.en['gs.siege.tut6'] = 'Archers shoot 2 cells straight ahead (3 from high ground, with a clear path) but cannot attack adjacent. Each match grants one Bolt (destroy a non-king unit), one Shield (block one attack) and one Rally (summon a soldier on your back rows); casting spends your action point. Hotkeys 1 / 2 / 3.';

  d.zh['gs.siege.unitArcher'] = '弓手';
  d.en['gs.siege.unitArcher'] = 'archer';
  d.zh['gs.siege.shieldBlocked'] = '护盾挡住了这一击！';
  d.en['gs.siege.shieldBlocked'] = 'The shield blocked that hit!';
  d.zh['gs.siege.msgSkipBlue'] = '你无子可动，跳过一回合';
  d.en['gs.siege.msgSkipBlue'] = 'You have no legal move — turn skipped';
  d.zh['gs.siege.msgMission'] = '战役第 {n} 关 · 出发！';
  d.en['gs.siege.msgMission'] = 'Campaign mission {n} — advance!';
  d.zh['gs.siege.msgTimeout'] = '回合耗尽，战役失败';
  d.en['gs.siege.msgTimeout'] = 'Out of turns — mission failed';

  d.zh['gs.siege.spellBolt'] = '落雷';
  d.en['gs.siege.spellBolt'] = 'Bolt';
  d.zh['gs.siege.spellShield'] = '护盾';
  d.en['gs.siege.spellShield'] = 'Shield';
  d.zh['gs.siege.spellRally'] = '援军';
  d.en['gs.siege.spellRally'] = 'Rally';
  d.zh['gs.siege.aimBolt'] = '落雷：点选一个敌方非王单位';
  d.en['gs.siege.aimBolt'] = 'Bolt: tap an enemy non-king unit';
  d.zh['gs.siege.aimShield'] = '护盾：点选一个己方单位（含国王）';
  d.en['gs.siege.aimShield'] = 'Shield: tap one of your units (king included)';
  d.zh['gs.siege.aimRally'] = '援军：点选底线或倒数第二行的空格';
  d.en['gs.siege.aimRally'] = 'Rally: tap an empty cell on your back two rows';
  d.zh['gs.siege.aimBoltBad'] = '落雷只能击中敌方士兵或弓手';
  d.en['gs.siege.aimBoltBad'] = 'Bolt only hits enemy soldiers or archers';
  d.zh['gs.siege.aimShieldBad'] = '请选择一个尚未护盾的己方单位';
  d.en['gs.siege.aimShieldBad'] = 'Pick one of your units without a shield';
  d.zh['gs.siege.aimRallyBad'] = '只能召唤在己方底线两行的空格';
  d.en['gs.siege.aimRallyBad'] = 'Rally only works on empty cells in your back two rows';
  d.zh['gs.siege.noSpell'] = '这个法术已经用完了';
  d.en['gs.siege.noSpell'] = 'That spell is used up';
  d.zh['gs.siege.castBolt'] = '落雷命中！';
  d.en['gs.siege.castBolt'] = 'Bolt strikes!';
  d.zh['gs.siege.castShield'] = '护盾已就位';
  d.en['gs.siege.castShield'] = 'Shield raised';
  d.zh['gs.siege.castRally'] = '援军抵达！';
  d.en['gs.siege.castRally'] = 'Reinforcements arrive!';

  d.zh['gs.siege.campaignBtn'] = '战役';
  d.en['gs.siege.campaignBtn'] = 'Campaign';
  d.zh['gs.siege.campaignTitle'] = '战役关卡';
  d.en['gs.siege.campaignTitle'] = 'Campaign';
  d.zh['gs.siege.campaignSub'] = '已通关 {n} / {t} 关 · 完成当前关卡解锁下一关';
  d.en['gs.siege.campaignSub'] = '{n} / {t} cleared · finish a mission to unlock the next';
  d.zh['gs.siege.closeBtn'] = '关闭';
  d.en['gs.siege.closeBtn'] = 'Close';
  d.zh['gs.siege.missionLocked'] = '先通关上一关才能解锁';
  d.en['gs.siege.missionLocked'] = 'Clear the previous mission first';
  d.zh['gs.siege.m1'] = '边境哨所';
  d.en['gs.siege.m1'] = 'Border Outpost';
  d.zh['gs.siege.m2'] = '渡河遭遇';
  d.en['gs.siege.m2'] = 'River Crossing';
  d.zh['gs.siege.m3'] = '要塞缺口';
  d.en['gs.siege.m3'] = 'Fortress Breach';
  d.zh['gs.siege.m4'] = '弓手岭';
  d.en['gs.siege.m4'] = 'Archers\' Ridge';
  d.zh['gs.siege.m5'] = '双渡口';
  d.en['gs.siege.m5'] = 'Twin Fords';
  d.zh['gs.siege.m6'] = '铁壁';
  d.en['gs.siege.m6'] = 'Iron Wall';
  d.zh['gs.siege.m7'] = '精锐对决';
  d.en['gs.siege.m7'] = 'Elite Duel';
  d.zh['gs.siege.m8'] = '王城决战';
  d.en['gs.siege.m8'] = 'Final Siege';
  d.zh['gs.siege.resMission'] = '关卡';
  d.en['gs.siege.resMission'] = 'Mission';
  d.zh['gs.siege.nextMission'] = '下一关';
  d.en['gs.siege.nextMission'] = 'Next Mission';
  d.zh['gs.siege.retryMission'] = '重打本关';
  d.en['gs.siege.retryMission'] = 'Retry Mission';
  d.zh['gs.siege.resultDraw'] = '双方僵持 · 和局';
  d.en['gs.siege.resultDraw'] = 'STALEMATE — DRAW';
  d.zh['gs.siege.hudMission'] = '关卡';
  d.en['gs.siege.hudMission'] = 'Mission';

  d.zh['gs.siege.campaignAllDoneSub'] = '8 / 8 关全部通关 · 可重打任意关卡';
  d.en['gs.siege.campaignAllDoneSub'] = '8 / 8 missions cleared · replay any mission';
  d.zh['gs.siege.resTimeout'] = '回合耗尽';
  d.en['gs.siege.resTimeout'] = 'Turn limit reached';
  d.zh['gs.siege.resultTimeout'] = '回合耗尽 · 未能破城';
  d.en['gs.siege.resultTimeout'] = 'OUT OF TIME';
  d.zh['gs.siege.resCampaignDone'] = '战役全部通关！';
  d.en['gs.siege.resCampaignDone'] = 'All missions cleared!';
})();
