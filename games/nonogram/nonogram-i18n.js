/* 游戏街机厅 · nonogram 游戏内文案（zh/en 对称）
   由 i18n-dict.js 拆分生成 —— 游戏页按需加载，减小站点字典体积 */
(function () {
  var d = Arcade.i18n.dicts;
  function z(k, zh, en) { d.zh[k] = zh; d.en[k] = en; }

  z('gs.nonogram.tut1t', '目标', 'Goal');
  z('gs.nonogram.tut1', '根据行列提示的数字，在网格中涂出隐藏图案；五档棋盘 5×5 / 8×8 / 10×10 / 12×12 / 15×15，全部保证唯一解。',
    'Use the row/column numbers to reveal the hidden picture — five board sizes: 5×5 / 8×8 / 10×10 / 12×12 / 15×15, all with a unique solution.');
  z('gs.nonogram.tut2t', '提示', 'Clues');
  z('gs.nonogram.tut2', '每行/列上的数字表示连续亮格的段长（如「2 1」=先 2 格亮、再 1 格亮）。行/列线索变绿表示该线已与答案完全一致。',
    'Each number is the length of a consecutive run of filled cells (e.g. "2 1" = 2 cells, then 1). A clue turns green when that line matches the answer exactly.');
  z('gs.nonogram.tut3t', '操作', 'Controls');
  z('gs.nonogram.tut3', '左键涂色，右键或「叉标」模式标记空格；方向键移动、空格涂色、X 叉标。提示每局 3 次，检查错误格会加罚时。',
    'Click to fill, right-click or Mark mode to cross out. Arrows move, Space fills, X marks. You have 3 hints per game; failed checks add a time penalty.');
  z('gs.nonogram.tut4t', '每日 / 计分', 'Daily / Scoring');
  z('gs.nonogram.tut4', '每日挑战用当天日期作 seed 固定一题，完成会记录连续天数。分数 = 用时 + 棋盘系数 + 失误×15 + 提示×25；用时越短越好。',
    'The daily challenge picks a fixed puzzle from the date seed and records your streak. Score = time + board factor + 15 per failed check + 25 per hint; faster is better.');

  z('gs.nonogram.picHeart', '爱心', 'Heart');
  z('gs.nonogram.picSmile', '笑脸', 'Smiley');
  z('gs.nonogram.picStar', '星星', 'Star');
  z('gs.nonogram.picArrow', '箭头', 'Arrow');
  z('gs.nonogram.picCross', '十字', 'Cross');
  z('gs.nonogram.picHouse', '房屋', 'House');
  z('gs.nonogram.picFlower', '花朵', 'Flower');
  z('gs.nonogram.picDiamond', '钻石', 'Diamond');
  z('gs.nonogram.picWave', '波纹', 'Ripple');
  z('gs.nonogram.picBigHeart', '大爱心', 'Big heart');
  z('gs.nonogram.picTree', '松树', 'Pine tree');
  z('gs.nonogram.picShip', '飞船', 'Spaceship');
  z('gs.nonogram.picRandom', '随机图案', 'Random pattern');

  z('gs.nonogram.picCrown', '王冠', 'Crown');
  z('gs.nonogram.picKey', '钥匙', 'Key');
  z('gs.nonogram.picBell', '铃铛', 'Bell');
  z('gs.nonogram.picMail', '信封', 'Envelope');
  z('gs.nonogram.picFish', '游鱼', 'Fish');
  z('gs.nonogram.picCat', '猫咪', 'Cat');
  z('gs.nonogram.picRocket', '火箭', 'Rocket');
  z('gs.nonogram.picAnchor', '船锚', 'Anchor');
  z('gs.nonogram.picRobot', '机器人', 'Robot');
  z('gs.nonogram.picLighthouse', '灯塔', 'Lighthouse');
  z('gs.nonogram.picOwl', '猫头鹰', 'Owl');
  z('gs.nonogram.picWhale', '鲸鱼', 'Whale');
  z('gs.nonogram.picCastle', '城堡', 'Castle');
  z('gs.nonogram.picCompass', '罗盘', 'Compass');
  z('gs.nonogram.picCactus', '仙人掌', 'Cactus');
  z('gs.nonogram.picButterfly', '蝴蝶', 'Butterfly');
  z('gs.nonogram.picMushroom', '蘑菇', 'Mushroom');
  z('gs.nonogram.picPiano', '钢琴', 'Piano');
  z('gs.nonogram.picSkull', '骷髅', 'Skull');
  z('gs.nonogram.picUmbrella', '雨伞', 'Umbrella');
  z('gs.nonogram.picTrophy', '奖杯', 'Trophy');

  z('gs.nonogram.lv5', '5×5 入门', '5×5 Intro');
  z('gs.nonogram.lv8', '8×8 进阶', '8×8 Advanced');
  z('gs.nonogram.lv10', '10×10 大师', '10×10 Master');
  z('gs.nonogram.lv12', '12×12 专家', '12×12 Expert');
  z('gs.nonogram.lv15', '15×15 极限', '15×15 Extreme');

  z('gs.nonogram.time', '用时 {t}', 'Time {t}');
  z('gs.nonogram.win', '「{p}」完成！用时 {s} 秒', '"{p}" solved! Time: {s}s');
  z('gs.nonogram.hudTime', '用时', 'TIME');
  z('gs.nonogram.hudPic', '图案', 'PICTURE');
  z('gs.nonogram.hudHint', '提示', 'HINTS');
  z('gs.nonogram.hudMiss', '失误', 'MISSES');
  z('gs.nonogram.hintLine', '左键涂色 / 右键叉标 · 方向键 + 空格也可操作',
    'Click fill / right-click mark · arrows + Space also work');
  z('gs.nonogram.markBtn', '× 叉标', '× Mark');
  z('gs.nonogram.markOn', '× 叉标中', '× Mark mode');
  z('gs.nonogram.hintBtn', '提示', 'Hint');
  z('gs.nonogram.checkBtn', '检查', 'Check');
  z('gs.nonogram.restartBtn', '重开', 'Restart');
  z('gs.nonogram.checkOk', '目前没有错误格', 'No wrong cells so far');
  z('gs.nonogram.checkBad', '发现 {n} 个错误格（+10 秒）', '{n} wrong cell(s) found (+10s)');
  z('gs.nonogram.hintNone', '提示已用完 —— 靠线索推理吧', 'No hints left — reason from the clues');
  z('gs.nonogram.hintComplete', '棋盘已与答案一致，无需提示', 'The board already matches the answer');
  z('gs.nonogram.hintUsed', '提示：第 {r} 行第 {c} 列 → {v}（+12 秒）', 'Hint: row {r}, column {c} → {v} (+12s)');
  z('gs.nonogram.hintFill', '涂色', 'fill');
  z('gs.nonogram.hintCross', '叉标', 'cross');
  z('gs.nonogram.cellLabel', '第 {r} 行第 {c} 列', 'Row {r}, column {c}');

  z('gs.nonogram.dailyBtn', '每日挑战', 'Daily');
  z('gs.nonogram.dailyInfo', '今日未解 · 连续 {n} 天', 'Today unsolved · streak {n}');
  z('gs.nonogram.dailyInfoSolved', '今日已解 {t} · 连续 {n} 天', 'Solved today {t} · streak {n}');
  z('gs.nonogram.dailyStart', '每日挑战：同一日期固定同一题', 'Daily challenge: same date, same puzzle');
  z('gs.nonogram.dailyAlready', '今天已完成，可再练一次', 'Already solved today — practice again');
  z('gs.nonogram.dailySolvedToast', '每日挑战完成，连续天数已更新', 'Daily challenge complete — streak updated');
  z('gs.nonogram.dailyWinTitle', '每日挑战完成', 'DAILY CHALLENGE COMPLETE');

  z('gs.nonogram.winTitle', '数织完成', 'NONOGRAM SOLVED');
  z('gs.nonogram.resTime', '用时', 'Time');
  z('gs.nonogram.resMiss', '失误', 'Mistakes');
  z('gs.nonogram.resHint', '提示', 'Hints');
  z('gs.nonogram.resScore', '分数', 'Score');
  z('gs.nonogram.bestFmt', '本档最佳 {n}', 'Tier best {n}');
  z('gs.nonogram.newBest', '新纪录！', 'NEW BEST!');
  z('gs.nonogram.nextLevel', '下一档 →', 'Next tier →');
  z('gs.nonogram.nextPuzzle', '下一题', 'Next puzzle');
  z('gs.nonogram.changeDiff', '换难度', 'Change tier');
  z('gs.nonogram.playAgain', '再来一局', 'Play again');
  z('gs.nonogram.helpText', '按每行每列的数字线索涂格，慢慢显出藏着的图案。',
    'Use row and column hints to paint a hidden picture.');

  /* ---- 棋盘缩放 ---- */
  z('gs.nonogram.zoomIn', '放大棋盘', 'Zoom in');
  z('gs.nonogram.zoomOut', '缩小棋盘', 'Zoom out');
  z('gs.nonogram.zoomReset', '复位', 'Reset');
  z('gs.nonogram.zoomLbl', '棋盘缩放', 'Board zoom');
  z('gs.nonogram.zoomTip', '双指捏合或点按 ± 缩放，点按倍率跳到达标倍率，双击复位；拖动可平移',
    'Pinch or tap ± to zoom, tap the value to jump to the 44px-fit zoom, double-tap to reset; drag to pan');
  z('gs.nonogram.zoom1x', '1×', '1×');
})();
