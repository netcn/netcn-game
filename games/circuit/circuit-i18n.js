/* 游戏街机厅 · circuit 游戏内文案（zh/en 对称） */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['gs.circuit.tutTitle'] = '电路连接 · 玩法';
  d.en['gs.circuit.tutTitle'] = 'Circuit · How to Play';
  d.zh['gs.circuit.tut1t'] = '目标';
  d.en['gs.circuit.tut1t'] = 'Objective';
  d.zh['gs.circuit.tut1'] = '旋转铜色导线，把左侧电源的电流送到右侧全部灯泡。带锁标记的电源与灯泡固定不可移动。';
  d.en['gs.circuit.tut1'] = 'Rotate the copper traces to send power from the source to every bulb. Locked source and bulb cells cannot move.';
  d.zh['gs.circuit.tut2t'] = '操作';
  d.en['gs.circuit.tut2t'] = 'Controls';
  d.zh['gs.circuit.tut2'] = '点按管道旋转；从一格拖到另一格可交换两段管道；方向键移动光标、空格旋转；P 键暂停。触屏同样有效。';
  d.en['gs.circuit.tut2'] = 'Tap a pipe to rotate; drag one cell onto another to swap two pieces; arrow keys move the cursor, Space rotates, P pauses. Touch works too.';
  d.zh['gs.circuit.tut3t'] = '限步与特殊管道';
  d.en['gs.circuit.tut3t'] = 'Budget & Special Pipes';
  d.zh['gs.circuit.tut3'] = '每关有固定步数预算：旋转或交换各计一步，耗尽即失败。带箭头的单向管只能顺着箭头导通；十字交叉管让横竖两条线互不连通。通关步数越少，大厅纪录越好。';
  d.en['gs.circuit.tut3'] = 'Each level has a fixed move budget: a rotation or a swap costs one move, and running out means failure. Arrow-marked one-way pipes conduct only in the arrow direction; cross pipes let horizontal and vertical lines pass without connecting. Fewer moves is a better hall record.';

  d.zh['gs.circuit.canvasAria'] = '电路棋盘：点按旋转、拖动交换、方向键移动光标';
  d.en['gs.circuit.canvasAria'] = 'Circuit board: tap to rotate, drag to swap, arrow keys move the cursor';

  d.zh['gs.circuit.chNovice'] = '新手';
  d.en['gs.circuit.chNovice'] = 'Novice';
  d.zh['gs.circuit.chAdvanced'] = '进阶';
  d.en['gs.circuit.chAdvanced'] = 'Advanced';
  d.zh['gs.circuit.chTab'] = '{name} {done}/{total}';
  d.en['gs.circuit.chTab'] = '{name} {done}/{total}';
  d.zh['gs.circuit.levelN'] = '第 {n} 关';
  d.en['gs.circuit.levelN'] = 'Level {n}';
  d.zh['gs.circuit.levelLbl'] = '{name} · 第 {n}/{m} 关';
  d.en['gs.circuit.levelLbl'] = '{name} · Level {n}/{m}';
  d.zh['gs.circuit.dailyLevel'] = '每日题';
  d.en['gs.circuit.dailyLevel'] = 'Daily Puzzle';
  d.zh['gs.circuit.goalLbl'] = '目标：点亮全部 {n} 盏灯';
  d.en['gs.circuit.goalLbl'] = 'Goal: light all {n} bulbs';
  d.zh['gs.circuit.dailyGoal'] = '目标：接通今日全部 {n} 盏灯';
  d.en['gs.circuit.dailyGoal'] = 'Goal: connect all {n} bulbs today';

  d.zh['gs.circuit.movesBudget'] = '步数 {n}/{m}';
  d.en['gs.circuit.movesBudget'] = 'Moves {n}/{m}';
  d.zh['gs.circuit.timeLbl'] = '用时 {t}';
  d.en['gs.circuit.timeLbl'] = 'Time {t}';
  d.zh['gs.circuit.poweredLbl'] = '通电灯 {n}/{m}';
  d.en['gs.circuit.poweredLbl'] = 'Bulbs {n}/{m}';
  d.zh['gs.circuit.minHint'] = '参考最少 {n} 步';
  d.en['gs.circuit.minHint'] = 'Reference min {n} moves';
  d.zh['gs.circuit.featureHint'] = '单向管 {w} · 交叉管 {c}';
  d.en['gs.circuit.featureHint'] = 'One-way {w} · Cross {c}';

  d.zh['gs.circuit.startMsg'] = '点按旋转 · 拖动交换 · 点亮全部灯泡';
  d.en['gs.circuit.startMsg'] = 'Tap to rotate · drag to swap · light every bulb';
  d.zh['gs.circuit.dailyStartMsg'] = '今日固定棋盘：由日期种子生成，人人同题';
  d.en['gs.circuit.dailyStartMsg'] = 'Today’s fixed board — generated from the date seed';
  d.zh['gs.circuit.selectHint'] = '选择章节与关卡，或挑战每日题';
  d.en['gs.circuit.selectHint'] = 'Pick a chapter and level, or try the daily puzzle';

  d.zh['gs.circuit.locked'] = '电源与灯泡已锁定，不可移动';
  d.en['gs.circuit.locked'] = 'Source and bulbs are locked and cannot move';
  d.zh['gs.circuit.crossNoRotate'] = '交叉管无需旋转，横竖线互不连通';
  d.en['gs.circuit.crossNoRotate'] = 'Cross pipe needs no rotation; its axes stay separate';
  d.zh['gs.circuit.crossLocked'] = '交叉管固定在原位，不能交换';
  d.en['gs.circuit.crossLocked'] = 'Cross pipes stay in place and cannot be swapped';
  d.zh['gs.circuit.emptyCell'] = '空格无法参与交换';
  d.en['gs.circuit.emptyCell'] = 'Empty cells cannot be swapped';

  d.zh['gs.circuit.flowing'] = '电流已到 {n}/{m} 盏灯';
  d.en['gs.circuit.flowing'] = 'Power reached {n}/{m} bulbs';
  d.zh['gs.circuit.breakFlow'] = '断流：灯泡熄灭了';
  d.en['gs.circuit.breakFlow'] = 'Flow broken: a bulb went dark';
  d.zh['gs.circuit.charging'] = '电流推进中… {n}/{m}';
  d.en['gs.circuit.charging'] = 'Current advancing… {n}/{m}';
  d.zh['gs.circuit.aligned'] = '线路已对齐，继续寻找通路';
  d.en['gs.circuit.aligned'] = 'Traces aligned — keep searching for the path';
  d.zh['gs.circuit.swapDone'] = '已交换两段管道';
  d.en['gs.circuit.swapDone'] = 'Swapped two pipe pieces';

  d.zh['gs.circuit.winMsg'] = '全板通电！';
  d.en['gs.circuit.winMsg'] = 'Whole board powered!';
  d.zh['gs.circuit.dailyWinMsg'] = '每日题完成！';
  d.en['gs.circuit.dailyWinMsg'] = 'Daily puzzle complete!';
  d.zh['gs.circuit.failMsg'] = '步数用尽，电路未接通';
  d.en['gs.circuit.failMsg'] = 'Out of moves — the circuit is not connected';

  d.zh['gs.circuit.winTitle'] = '电路接通！';
  d.en['gs.circuit.winTitle'] = 'Circuit Connected!';
  d.zh['gs.circuit.chapterTitle'] = '{name}章节全部完成！';
  d.en['gs.circuit.chapterTitle'] = '{name} chapter complete!';
  d.zh['gs.circuit.allTitle'] = '全部章节完成！';
  d.en['gs.circuit.allTitle'] = 'All Chapters Cleared!';
  d.zh['gs.circuit.failTitle'] = '步数耗尽';
  d.en['gs.circuit.failTitle'] = 'Out of Moves';
  d.zh['gs.circuit.dailyTitle'] = '每日题完成！';
  d.en['gs.circuit.dailyTitle'] = 'Daily Puzzle Complete!';
  d.zh['gs.circuit.dailyRepeatTitle'] = '今日题已完成（练习）';
  d.en['gs.circuit.dailyRepeatTitle'] = 'Today’s Daily Already Solved (Practice)';

  d.zh['gs.circuit.winStats'] = '点亮 {lit}/{total} · 步数 {moves}/{budget} · 用时 {time}';
  d.en['gs.circuit.winStats'] = 'Bulbs {lit}/{total} · Moves {moves}/{budget} · Time {time}';
  d.zh['gs.circuit.failStats'] = '已用 {n}/{m} 步 · 点亮 {lit}/{total}';
  d.en['gs.circuit.failStats'] = 'Moves used {n}/{m} · Bulbs {lit}/{total}';
  d.zh['gs.circuit.failHint'] = '立即重开本关，或从下方选择其他关卡';
  d.en['gs.circuit.failHint'] = 'Restart this level now, or pick another level below';
  d.zh['gs.circuit.levelScore'] = '本关步数 {n}/{m}（步数越少越好）';
  d.en['gs.circuit.levelScore'] = 'Level moves {n}/{m} (fewer is better)';
  d.zh['gs.circuit.chapterScore'] = '本章总步数 {n}（最少步数口径）';
  d.en['gs.circuit.chapterScore'] = 'Chapter total {n} moves (min-move score)';
  d.zh['gs.circuit.newRecord'] = '刷新大厅纪录！';
  d.en['gs.circuit.newRecord'] = 'New hall record!';
  d.zh['gs.circuit.bestLbl'] = '大厅纪录 {n}';
  d.en['gs.circuit.bestLbl'] = 'Hall record {n}';

  d.zh['gs.circuit.dailyStats'] = '用时 {time} · 步数 {moves}/{budget} · 点亮 {lit}/{total}';
  d.en['gs.circuit.dailyStats'] = 'Time {time} · Moves {moves}/{budget} · Bulbs {lit}/{total}';
  d.zh['gs.circuit.dailyRound'] = '连续 {s} 天 · 今日 {t}';
  d.en['gs.circuit.dailyRound'] = 'Streak {s} days · Today {t}';
  d.zh['gs.circuit.dailyFresh'] = '已记录今日成绩';
  d.en['gs.circuit.dailyFresh'] = 'Today’s result recorded';
  d.zh['gs.circuit.dailyDone'] = '今日已解 {t} · 连续 {s} 天 · {date}';
  d.en['gs.circuit.dailyDone'] = 'Solved today {t} · Streak {s} days · {date}';
  d.zh['gs.circuit.dailyTodo'] = '今日未解 · 连续 {s} 天 · {date}';
  d.en['gs.circuit.dailyTodo'] = 'Not solved today · Streak {s} days · {date}';
  d.zh['gs.circuit.dailyBtn'] = '每日题';
  d.en['gs.circuit.dailyBtn'] = 'Daily Puzzle';
  d.zh['gs.circuit.dailyBtnDone'] = '每日题 · 今日已解';
  d.en['gs.circuit.dailyBtnDone'] = 'Daily · Solved Today';
  d.zh['gs.circuit.dailyNoBest'] = '每日成绩独立记录，不重复计入大厅纪录';
  d.en['gs.circuit.dailyNoBest'] = 'Daily results are tracked separately and not counted twice in the hall record';
  d.zh['gs.circuit.dailyAgain'] = '再玩一次';
  d.en['gs.circuit.dailyAgain'] = 'Play Again';
  d.zh['gs.circuit.dailyBack'] = '返回章节';
  d.en['gs.circuit.dailyBack'] = 'Back to Chapters';

  d.zh['gs.circuit.next'] = '下一关';
  d.en['gs.circuit.next'] = 'Next Level';
  d.zh['gs.circuit.nextChapter'] = '下一章';
  d.en['gs.circuit.nextChapter'] = 'Next Chapter';
  d.zh['gs.circuit.replayChapter'] = '重玩本章';
  d.en['gs.circuit.replayChapter'] = 'Replay Chapter';
  d.zh['gs.circuit.replay'] = '重开本关';
  d.en['gs.circuit.replay'] = 'Restart Level';
  d.zh['gs.circuit.restart'] = '重开本关';
  d.en['gs.circuit.restart'] = 'Restart';
  d.zh['gs.circuit.backToLevels'] = '返回选关';
  d.en['gs.circuit.backToLevels'] = 'Back to Level Select';

  d.zh['gs.circuit.paused'] = '已暂停 · 按 P 继续';
  d.en['gs.circuit.paused'] = 'Paused · press P to resume';
  d.zh['gs.circuit.pause'] = '暂停';
  d.en['gs.circuit.pause'] = 'Pause';
  d.zh['gs.circuit.resume'] = '继续';
  d.en['gs.circuit.resume'] = 'Resume';

  d.zh['gs.circuit.helpText'] = '电路连接是布尔逻辑的物理化身：AND、OR、XOR 在导线中流淌。单向管像二极管，只允许电流朝一个方向通过；交叉管则让两条信号线同格穿过却互不干扰。现代密码的每一次加密，本质上都是一次布尔电路运算。';
  d.en['gs.circuit.helpText'] = 'Circuit connection is Boolean logic made physical: AND, OR and XOR flow through wires. One-way pipes act like diodes, letting current pass in only one direction; cross pipes let two signals share a cell without connecting. Every modern encryption is, at heart, a Boolean circuit operation.';
})();
