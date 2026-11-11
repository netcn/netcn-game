/* 游戏厅 · rhythm 游戏内文案（zh/en 对称）
   由 i18n-dict.js 拆分生成 —— 游戏页按需加载，减小站点字典体积 */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['gs.rhythm.tutTitle'] = '节拍脉冲 · 玩法';
  d.en['gs.rhythm.tutTitle'] = 'Pulse Tap · How to Play';
  d.zh['gs.rhythm.tut1t'] = '目标';
  d.en['gs.rhythm.tut1t'] = 'Objective';
  d.zh['gs.rhythm.tut1'] = '音符下落到判定线时精准击打，连击不断分数越高，准确率决定 S / A / B / C / D 评级。';
  d.en['gs.rhythm.tut1'] = 'Hit notes exactly on the judgment line; longer combos score higher, and accuracy decides your S / A / B / C / D grade.';
  d.zh['gs.rhythm.tut2t'] = '操作';
  d.en['gs.rhythm.tut2t'] = 'Controls';
  d.zh['gs.rhythm.tut2'] = 'D / F / J / K 或 ← ↓ ↑ → 对应四条轨道；长按音符要按住到尾段，菱形滑动音符要朝箭头方向滑；触屏可直接点按四轨热区。空格 / P 暂停。';
  d.en['gs.rhythm.tut2'] = 'D / F / J / K or ← ↓ ↑ → map to the four lanes; hold notes must be held to the tail, diamond notes need a swipe matching the arrow; touch the four lane pads on mobile. Space / P pauses.';
  d.zh['gs.rhythm.tut3t'] = '计分';
  d.en['gs.rhythm.tut3t'] = 'Scoring';
  d.zh['gs.rhythm.tut3'] = '判定为 完美 / 很棒 / 不错 / 漏击，连击与长按持续加分；结算显示分项、准确率与评级，并写入最高分。可在选曲页做 ±300ms 音频偏移校准。';
  d.en['gs.rhythm.tut3'] = 'Grades are PERFECT / GREAT / GOOD / MISS; combos and sustained holds add points. Results show the breakdown, accuracy and grade, and save your best. Audio offset can be calibrated ±300ms on the song menu.';

  d.zh['gs.rhythm.hudScore'] = '分数';
  d.en['gs.rhythm.hudScore'] = 'Score';
  d.zh['gs.rhythm.hudCombo'] = '连击';
  d.en['gs.rhythm.hudCombo'] = 'Combo';
  d.zh['gs.rhythm.hudAcc'] = '准确率';
  d.en['gs.rhythm.hudAcc'] = 'Accuracy';
  d.zh['gs.rhythm.hudProg'] = '进度';
  d.en['gs.rhythm.hudProg'] = 'Progress';

  d.zh['gs.rhythm.menuTitle'] = '节拍脉冲';
  d.en['gs.rhythm.menuTitle'] = 'PULSE TAP';
  d.zh['gs.rhythm.menuSub'] = '三首曲目 × 三档难度 · 4 条轨道 · 长按与滑动判定';
  d.en['gs.rhythm.menuSub'] = '3 songs × 3 difficulties · 4 lanes · holds and flicks';

  d.zh['gs.rhythm.songNeon'] = '霓虹心跳';
  d.en['gs.rhythm.songNeon'] = 'NEON HEART';
  d.zh['gs.rhythm.songNeonSub'] = '104 BPM · 合成器';
  d.en['gs.rhythm.songNeonSub'] = '104 BPM · synthwave';
  d.zh['gs.rhythm.songDrive'] = '夜行驱动';
  d.en['gs.rhythm.songDrive'] = 'NIGHT DRIVE';
  d.zh['gs.rhythm.songDriveSub'] = '132 BPM · 放克';
  d.en['gs.rhythm.songDriveSub'] = '132 BPM · funk';
  d.zh['gs.rhythm.songOverclock'] = '超频冲击';
  d.en['gs.rhythm.songOverclock'] = 'OVERCLOCK';
  d.zh['gs.rhythm.songOverclockSub'] = '160 BPM · 高速';
  d.en['gs.rhythm.songOverclockSub'] = '160 BPM · hyper';

  d.zh['gs.rhythm.dEasy'] = '简单';
  d.en['gs.rhythm.dEasy'] = 'EASY';
  d.zh['gs.rhythm.dNormal'] = '普通';
  d.en['gs.rhythm.dNormal'] = 'NORMAL';
  d.zh['gs.rhythm.dHard'] = '困难';
  d.en['gs.rhythm.dHard'] = 'HARD';
  d.zh['gs.rhythm.noteCount'] = '{n} 音符';
  d.en['gs.rhythm.noteCount'] = '{n} notes';
  d.zh['gs.rhythm.diffMeta'] = '{b} BPM · {s} 秒';
  d.en['gs.rhythm.diffMeta'] = '{b} BPM · {s}s';

  d.zh['gs.rhythm.calibLabel'] = '音频偏移校准';
  d.en['gs.rhythm.calibLabel'] = 'Audio offset';
  d.zh['gs.rhythm.calibTest'] = '试听校准节拍';
  d.en['gs.rhythm.calibTest'] = 'Test beat';

  d.zh['gs.rhythm.bestLocal'] = '本机最佳 {n}';
  d.en['gs.rhythm.bestLocal'] = 'Local best {n}';
  d.zh['gs.rhythm.bestGlobal'] = '全局最佳 {n}';
  d.en['gs.rhythm.bestGlobal'] = 'Global best {n}';

  d.zh['gs.rhythm.startBtn'] = '开始演奏';
  d.en['gs.rhythm.startBtn'] = 'Start Set';
  d.zh['gs.rhythm.replay'] = '再来一次';
  d.en['gs.rhythm.replay'] = 'Play Again';
  d.zh['gs.rhythm.quit'] = '返回选曲';
  d.en['gs.rhythm.quit'] = 'Back to Menu';
  d.zh['gs.rhythm.resume'] = '继续';
  d.en['gs.rhythm.resume'] = 'Resume';
  d.zh['gs.rhythm.restart'] = '重新开始';
  d.en['gs.rhythm.restart'] = 'Restart';
  d.zh['gs.rhythm.pause'] = '暂停';
  d.en['gs.rhythm.pause'] = 'Pause';

  d.zh['gs.rhythm.playingMsg'] = '{s} · {b} BPM · {d}';
  d.en['gs.rhythm.playingMsg'] = '{s} · {b} BPM · {d}';
  d.zh['gs.rhythm.help'] = 'D/F/J/K 或 ←↓↑→ 击打 · 长按保持\n滑键跟随箭头 · P / 空格暂停';
  d.en['gs.rhythm.help'] = 'D/F/J/K or ←↓↑→ · hold · swipe\nP / Space pause';
  d.zh['gs.rhythm.helpText'] = '节拍脉冲训练的是时序精确性，节奏感是精确度的直觉训练。';
  d.en['gs.rhythm.helpText'] = 'Rhythm games train temporal precision — differential power analysis in side-channel attacks needs nanosecond-level timing measurements. Rhythm is intuition training for precision.';

  d.zh['gs.rhythm.jPerfect'] = '完美';
  d.en['gs.rhythm.jPerfect'] = 'PERFECT';
  d.zh['gs.rhythm.jGreat'] = '很棒';
  d.en['gs.rhythm.jGreat'] = 'GREAT';
  d.zh['gs.rhythm.jGood'] = '不错';
  d.en['gs.rhythm.jGood'] = 'GOOD';
  d.zh['gs.rhythm.jMiss'] = '漏击';
  d.en['gs.rhythm.jMiss'] = 'MISS';
  d.zh['gs.rhythm.comboTag'] = '{n} 连击';
  d.en['gs.rhythm.comboTag'] = '{n} COMBO';
  d.zh['gs.rhythm.holdStart'] = '长按开始';
  d.en['gs.rhythm.holdStart'] = 'HOLD';
  d.zh['gs.rhythm.holdDone'] = '长按完成';
  d.en['gs.rhythm.holdDone'] = 'HOLD OK';
  d.zh['gs.rhythm.holdBreak'] = '长按中断';
  d.en['gs.rhythm.holdBreak'] = 'HOLD BREAK';
  d.zh['gs.rhythm.done'] = '完成 · 最大连击 {n}';
  d.en['gs.rhythm.done'] = 'Done · max combo {n}';

  d.zh['gs.rhythm.paused'] = '已暂停 · 按 P 继续';
  d.en['gs.rhythm.paused'] = 'Paused · press P to resume';
  d.zh['gs.rhythm.pausedSub'] = '进度已写入本地，继续后从当前节拍接上';
  d.en['gs.rhythm.pausedSub'] = 'Progress saved locally; resume picks up at the current beat';
  d.zh['gs.rhythm.resumed'] = '已恢复上次进度';
  d.en['gs.rhythm.resumed'] = 'Progress restored';
  d.zh['gs.rhythm.resumedSub'] = '按「继续」或 P 从断点接着演奏';
  d.en['gs.rhythm.resumedSub'] = 'Press Resume or P to continue from the save point';

  d.zh['gs.rhythm.resultTitle'] = '{s} · {d} 结算';
  d.en['gs.rhythm.resultTitle'] = '{s} · {d} RESULT';
  d.zh['gs.rhythm.resPerfect'] = '完美';
  d.en['gs.rhythm.resPerfect'] = 'Perfect';
  d.zh['gs.rhythm.resGreat'] = '很棒';
  d.en['gs.rhythm.resGreat'] = 'Great';
  d.zh['gs.rhythm.resGood'] = '不错';
  d.en['gs.rhythm.resGood'] = 'Good';
  d.zh['gs.rhythm.resMiss'] = '漏击';
  d.en['gs.rhythm.resMiss'] = 'Miss';
  d.zh['gs.rhythm.resCombo'] = '最大连击';
  d.en['gs.rhythm.resCombo'] = 'Max combo';
  d.zh['gs.rhythm.resAcc'] = '准确率';
  d.en['gs.rhythm.resAcc'] = 'Accuracy';
  d.zh['gs.rhythm.resScore'] = '得分';
  d.en['gs.rhythm.resScore'] = 'Score';
  d.zh['gs.rhythm.resBest'] = '本机最佳';
  d.en['gs.rhythm.resBest'] = 'Local best';
  d.zh['gs.rhythm.resBestGlobal'] = '全局最佳';
  d.en['gs.rhythm.resBestGlobal'] = 'Global best';
  d.zh['gs.rhythm.newRecord'] = '新纪录！';
  d.en['gs.rhythm.newRecord'] = 'NEW RECORD!';
  d.zh['gs.rhythm.noFail'] = '无失败判定 · 歌曲结束即结算';
  d.en['gs.rhythm.noFail'] = 'No fail state · results at song end';
})();
