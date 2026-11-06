/* ============================================================
   中英双语字典 —— Arcade.i18n.dicts
   结构：{ zh: { key: 中文 }, en: { key: English } }
   分区：shell / lobby / stats / settings / tutorial / common /
        g_<id>.*（游戏入口 title/desc）/ game_<id>.*（游戏内文案）
   新增文案：在 zh 与 en 各加一条同 key；t(key) 缺省回退 zh。
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.i18n.dicts = {
  zh: {
    /* ---------- common ---------- */
                'common.help': '玩法',
                'common.close': '关闭',
                'common.srcTitle': '资料来源',
    
    /* ---------- shell（游戏页顶栏） ---------- */
    'shell.lobby': '◀ 大厅',
    'shell.help': '玩法',
    'shell.story': '史话',
    'shell.best': '最高分',
    'shell.artifactGot': '已收入密件册！',
    'shell.restart': '↻ 重开',
    'shell.paused': '⏸ 已暂停 · 按 P 继续',
    'shell.noTutorial': '该游戏暂未配置教程',
    'shell.newRecord': '新纪录！',
    'shell.canvasLabel': '{n} 游戏画面',
    'shell.fullscreen': '全屏',
    'shell.exitFullscreen': '退出全屏',

    /* ---------- settings（设置面板） ---------- */
    'settings.sound': '音效',
    'settings.music': '背景音乐',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.search': '搜索游戏',
    'settings.haptic': '触感反馈',
    'search.title': '全站搜索',
    'search.ph': '搜索游戏 / 章节 / 人物 / 密件…',
    'search.hint': '输入关键词，全站实时检索（Enter 直达首个结果，Esc 关闭）',
    'search.games': '游戏',
    'search.chapters': '章节',
    'search.people': '人物',
    'search.artifacts': '密件',
    'search.empty': '没有找到匹配内容',
    'theme.neon': '街机霓虹',
    'theme.daylight': '晨光档案',
    /* ---------- extras（全局组件 fallback） ---------- */
    'extras.tutDefaultTitle': '玩法说明',
    'extras.tutStart': '开始游戏',

    /* ---------- app（站点级） ---------- */
    'app.title': '游戏街机厅',
    'app.titleSuffix': ' · 游戏街机厅',
    'nav.label': '主导航',
    'nav.skip': '跳到主内容',
    'nav.home': '首页', 'nav.chronicle': '编年史', 'nav.atlas': '知识图谱',
    'nav.glossary': '术语表', 'nav.games': '游戏', 'nav.profile': '我的档案', 'nav.stories': '编年史', 'nav.quiz': '测验场', 'nav.workshop': '破译工坊', 'nav.protocols': '协议实验室',
    'workshop.encTab': '🧪 加密', 'workshop.decTab': '🔓 自动破解',
    'workshop.encGo': '🔐 生成密文', 'workshop.decGo': '🔓 一键破解',
    'workshop.decNote': '自动识别：凯撒 / 摩斯 / 培根 / 二进制 / 异或 / Base64 / 栅栏 / 维吉尼亚（常用密钥）',
    'workshop.eggTitle': '🎯 彩蛋收集（全站寻宝）',
    'workshop.eggNote': '全站藏有 20 条密文彩蛋——破解后在下方输入答案单词，收集进度点亮。全部集齐解锁隐藏成就！',
    'quiz.entrySub': '252 题测出你的段位',
    'quiz.lvl1': '入门', 'quiz.lvl2': '进阶', 'quiz.lvl3': '专家', 'quiz.lvl4': '大师',
    'quiz.right': '✅ 答对了！',
    'quiz.wrong': '❌ 答错了',
    'quiz.resultTitle': '🎖 本轮成绩',
    'quiz.resultRank': '你的密码学段位',
    'quiz.resultSub': '段位已存入本地档案，可在「我的档案」查看',
    'quiz.resultAgain': '↻ 再测一轮', 'quiz.reviewWrong': '回顾本轮错题（{n}）',
    'quiz.bestLabel': '历史最佳：{s} / {t}',
    'quiz.wrongBtn': '🔁 错题重练（{n} 题）',
    'quiz.practiceDone': '错题重练完成！',
    'quiz.practiceSub': '连对 3 次的错题会自动移出错题本',
    'duel.p1': '玩家 1', 'duel.p2': '玩家 2',
    'duel.p1keys': '1 2 3 4', 'duel.p2keys': '7 8 9 0',
    'duel.q': '第 {n} 题',
    'duel.win': '🏆 胜利', 'duel.draw': '🤝 平局', 'duel.score': '得分 {s}', 'duel.wait': '等待作答…',
    'duel.winMsg': '赢得对决！', 'duel.drawMsg': '势均力敌，再战一局？',
    'duel.again': '↻ 再战一局',
    'morseL.title': '👂 摩斯听音训练',
    'morseL.sub': '浏览器实时合成点划电码音 · 听音辨字母 · 三档速度 · 10 题一轮',
    'morseL.pickSpeed': '选择速度',
    'morseL.speedSlow': '🐢 慢速', 'morseL.speedNormal': '🐇 正常', 'morseL.speedFast': '⚡ 快速', 'morseL.speedFw': '🌀 Farnsworth',
    'morseL.fwHint': 'Farnsworth 训练：三字母一组 · 字符快、间隔大——练的是节奏不是单点',
    'morseL.start': '🎧 开始训练',
    'morseL.q': '第 {n} 题',
    'morseL.replay': '重听', 'morseL.submit': '提交',
    'morseL.right': '✅ 听对了！',
    'morseL.wrong': '❌ 是 {c}',
    'morseL.result': '本轮成绩',
    'morseL.best': '历史最佳：{s} / {t}',
    'morseL.again': '↻ 再来一轮',
    'stats.vizChq': '🧠 章节精通',
    'stats.vizGloss': '📖 术语浏览',
    'stats.vizMap': '🗺️ 地图事件',
    'stats.vizSub': '这些是你在知识区的足迹：读过的章节、做过的测验、看过的地图',
    'stats.heatTitle': '📅 近 12 个月完成局数',
    'stats.wrongTitle': '🔁 错题重练',
    'stats.wrongSub': '连对 3 次的错题会自动移出错题本',
    'settings.storageWarn': '本机存储空间不足，新纪录可能无法保存',
    'stats.wrongCount': '{n} 题',
    'save.toastExport': '存档已下载', 'save.toastCopied': '备份码已复制到剪贴板',
    'save.copyManual': '已生成备份码，请手动复制',
    'save.toastImported': '已恢复 {n} 条记录',
    'save.toastFail': '导入失败：格式无法识别',
    'save.toastWiped': '已清空 {n} 条记录',
    'save.confirmWipe': '确定清空全部存档吗？此操作不可撤销！',
    'share.letterTitle': '🔐 密信（游戏街机厅）',
    'share.letterAlgo': '算法：{a}',
    'share.letterKey': '密钥：{k}',
    'share.letterCipher': '密文：{c}',
    'share.letterFooter': '—— 来 game.netcn.org 玩更多小游戏！',
    'share.linkBtn': '🔗 复制链接',
    'share.linkDone': '分享链接已复制——打开即自动载入密文',
    'share.linkTooLong': '密文过长，请改用文本分享',
    'share.linkBad': '链接参数无效',
    'share.letterBtn': '📨 分享密信',
    'share.letterDone': '密信已复制，发给好友破解吧！',
    'share.letterNoOut': '先生成密文再分享',
    'share.recordTitle': '📊 我的游戏战绩（ARCADE HALL）',
    'share.recordPlayed': '已玩 {p}/{t} 款游戏',
    'share.recordRank': '军衔：{r}',
    'share.recordQuiz': '测验段位：{r}',
    'share.recordDaily': '累计完成每日题 {n} 道',
    'share.recordStreak': '连破 {n} 天',
    'share.recordEggs': '彩蛋收集 {n} 枚',
    'share.recordFooter': '—— game.netcn.org · 游戏街机厅',
    'share.recordBtn': '📤 分享我的战绩',
    'share.recordDone': '战绩已复制，分享给朋友吧！',
    'share.recordSub': '一键生成战绩摘要并复制到剪贴板，发到群里炫一下',
    'artifacts.nature.real': '真实史料',
    'artifacts.nature.dramatized': '史料化演绎',
    'artifacts.nature.reconstructed': '依史料重构',
    'home.continue': '🕹️ 继续破译',
    'home.continueGo': '去游戏厅 →',
    'home.progChapters': '章已读',
    'home.progLetters': '密钥字母',
    'home.progArtifacts': '密件',
    'home.progGames': '已玩',
    'home.enter': '进入本章',
    'home.people': '人物',
    'home.artifacts': '密件',
    'home.games': '游戏',
    'home.daily': '今日破译',
    'home.go': '前往',
    'home.footNote': '纪录仅存本地 · 不上传任何数据 · 史料整理自公开信息仅供学习',
    'home.footBrand': '© 2026 游戏街机厅 · GAME.NETCN.ORG',
    'people.countF': '共 {n} 位破译者 · 点击查看档案',
    'people.gamesOf': '关联游戏 · 点击进入',
    'people.artifactsOf': '相关密件',
    'artifacts.countF': '已收集 {u}/{t} 件',
    'artifacts.pageDesc': '游戏街机厅 · 密件册：通关游戏解锁 41 件历史密件——罗塞塔碑、齐默尔曼电报、VENONA 片段……收藏密码学三千年的证据。',
    'app.descIndex': '游戏街机厅：53 款经典小游戏——街机、逻辑、空间、动作、棋类、牌骰、球类，打开即玩，本地记录你的最高分！',
    'app.descStats': '游戏街机厅 · 我的档案：个人生涯统计与成就墙，全部数据仅保存在本地浏览器。',

    /* ---------- 404 ---------- */

    /* ---------- lobby（大厅） ---------- */
    'lobby.coinLine': 'INSERT COIN · 打开即玩 · 本地记录最高分',
    'lobby.startStory': '📜 从布莱切利园开始',
    'lobby.footBrand': '© 2026 游戏街机厅 · GAME.NETCN.ORG',
    'lobby.footLine': '纪录仅存本地 · 不上传任何数据 · 史料整理自公开信息仅供学习',
            'lobby.footprint': '破译足迹 · 12 时代（玩过 / 读过点亮）',
        'lobby.searchPlaceholder': '搜索游戏 / 分类…',
        'lobby.all': '全部',
    'lobby.favs': '收藏',
    'lobby.lvl': '难度', 'lobby.easy': '上手', 'lobby.mid': '进阶', 'lobby.hard': '硬核',
    'lobby.diffEasy': '上手', 'lobby.diffMid': '进阶', 'lobby.diffHard': '硬核',
    'lobby.time': '时长', 'lobby.t1': '≤1分钟', 'lobby.t5': '5分钟', 'lobby.t10': '10分钟+',
    'lobby.timeShort': '≤1分钟', 'lobby.timeMid': '5分钟', 'lobby.timeLong': '10分钟+',
    'lobby.daily': '📅 今日破译',
    'lobby.dailyStart': '今天从第 1 题开始',
    'lobby.streak': '连破',
    'lobby.days': '天',
    'lobby.pending': '今日待破译',
    'lobby.todayDone': '今日完成',
    'lobby.unitStreak': '连胜',
    'lobby.unitSteps': '步',
    'lobby.unitTimes': '次',
    'lobby.unitBlocks': '块',
    'lobby.unitPts': '分',
    'lobby.unitSolved': '题',
    'lobby.unitChips': '筹码',
    'lobby.unitKills': '击破',
    'lobby.unitWins': '胜',
    'lobby.recent': '最近游玩',
        'lobby.games': '款',
    'lobby.challenged': '已挑战',
    'lobby.playedBadge': '✅ 已玩',
    'lobby.playedTitle': '已玩过',
    'lobby.favOff': '收藏',
    'lobby.favOn': '取消收藏',
    'lobby.emptyFavs': '还没有收藏的游戏，点卡片右上角 ★ 收藏吧',
    'lobby.emptySearch': '没有匹配的游戏，换个字试试？',
    'lobby.statsLine': '破译 {n} 款 · INSERT COIN',
    'lobby.achv': '🎖 成就',
                                                'lobby.mobileOk': '📱 触屏友好',
    'lobby.mobilePad': '🖥 建议桌面',
        'lobby.dailySolvedT': '✅ 已破译 · {t}s',
        'lobby.rankMax': '{x} XP · 已封顶',
    'lobby.rankNext': '{x}/{n} XP',
    'rank.trainee.n': '见习密码员',
    'rank.junior.n': '初级密码员',
    'rank.cryptanalyst.n': '密码员',
    'rank.senior.n': '高级密码员',
    'rank.expert.n': '破译专家',
    'rank.chief.n': '首席破译官',
    'rank.ace.n': '王牌密码员',
    'rank.master.n': '密码大师',
    'rank.promo': '军衔晋升：{n}！',
    'lobby.telegraph': '📡 截获电报：「幽灵仍在加密线上。」—— 来自密码侦探的最后一封电报',
    'cat.经典街机': '经典街机',
    'cat.动作反应': '动作反应',
    'cat.逻辑谜题': '逻辑谜题',
    'cat.空间解谜': '空间解谜',
    'cat.球类竞技': '球类竞技',
    'cat.棋类对弈': '棋类对弈',
    'cat.牌骰策略': '牌骰策略',
    'cat.密码破译': '密码破译',

    /* ---------- stats（我的档案） ---------- */
    'stats.gamesUnit': '款',
    'stats.barNote': '全部纪录仅存本地 · 不上传任何数据',
    'stats.swHit': '🧠 本地缓存命中率 {p}% · 离线兜底 {o} 次（仅存本机，不上传）',
    'stats.swNone': '🧠 统计中：本机尚未产生缓存记录',
    'savegame.resumed': '已恢复上次进度（仅存本机）',
    'stats.pctNote': '已挑战 {p}% · 全部纪录仅存本地 · 不上传任何数据',
    'stats.dailyTotal': '累计完成每日题',
    'stats.achv': '🎖 成就墙',
    'stats.achvCount': '🎖 成就 {u} / {t}',
    'stats.rankNext': '再 {x} XP 晋升 {n}',
    'stats.rankMax': '最高军衔已达成，向你致敬，密码大师。',
    'stats.rankHint': '完成破译挑战即可累积军衔经验',
    'achv.first.n': '初来乍到', 'achv.first.d': '挑战第一款游戏',
    'achv.ten.n': '破译者', 'achv.ten.d': '挑战 10 款游戏',
    'achv.thirty.n': '破解大师', 'achv.thirty.d': '挑战 30 款游戏',
    'achv.fifty.n': '全图鉴猎手', 'achv.fifty.d': '挑战 50 款游戏',
    'achv.allcats.n': '八域通晓', 'achv.allcats.d': '8 大分类各至少挑战 1 款',
    'achv.streak7.n': '七日连破', 'achv.streak7.d': '每日破译连破 7 天',
    'achv.daily5.n': '每日全勤', 'achv.daily5.d': '单日完成全部每日题',
    'achv.flagship4.n': '旗舰猎手', 'achv.flagship4.d': '挑战 4 款全网独家旗舰',
    'achv.speed.n': '速破专家', 'achv.speed.d': '任一计时游戏最佳 ≤ 60 秒',
    'achv.perfect.n': '完美主义者', 'achv.perfect.d': '挑战全部可记分游戏',
    'achv.cbegin.n': '破译者之始', 'achv.cbegin.d': '读完编年史第 0 章「破译的黎明」',
    'achv.chist5.n': '历史爱好者', 'achv.chist5.d': '读完编年史任意 5 章',
    'achv.call.n': '编年史读者', 'achv.call.d': '读完编年史全部 12 章',
    'achv.cletter3.n': '密信猎人', 'achv.cletter3.d': '集齐 3 枚密钥字母',
    'achv.cfinal.n': '最终破译者', 'achv.cfinal.d': '破解最终密语',
    'achv.cart5.n': '密件收藏家', 'achv.cart5.d': '解锁 5 件历史密件',
    'achv.cgame5.n': '破译史学家', 'achv.cgame5.d': '通关 5 个编年史关联游戏',
    'achv.ehunter.n': '密码猎人', 'achv.ehunter.d': '集齐全站 20 枚隐藏密文彩蛋',
    'achv.qmaster.n': '测验大师', 'achv.qmaster.d': '密码学测验一轮答对全部题',
    'achv.qlegend.n': '传说破译者', 'achv.qlegend.d': '测验段位达到「传说破译者」',
    'achv.chq5.n': '章节学霸', 'achv.chq5.d': '点亮任意 5 章「本章精通」',
    'achv.chqall.n': '编年史全通', 'achv.chqall.d': '点亮全部章节精通',
    'achv.morse5.n': '摩斯听风者', 'achv.morse5.d': '摩斯听音训练满分一轮',
    'achv.duel5.n': '决斗冠军', 'achv.duel5.d': '双人竞速累计获胜 5 场',
    'achv.gloss30.n': '术语达人', 'achv.gloss30.d': '阅读术语表 30 个词条',
    'achv.timeline60.n': '时间旅人', 'achv.timeline60.d': '浏览过密码史时间线',
    'achv.discov.n': '探索者', 'achv.discov.d': '走进破译发现馆',
    'achv.relweb.n': '人脉侦探', 'achv.relweb.d': '走过密码史关系网',
    'achv.zhstory.n': '华夏访客', 'achv.zhstory.d': '走过中华密码史专题',
    'stats.collCats': '🗺️ 分类覆盖',
    'stats.collGames': '🎮 已挑战',
    'stats.collFlags': '⚙️ 独家旗舰',
    'stats.chRead': '📖 已读章节',
    'stats.chLetters': '🔑 密钥字母',
    'stats.chArts': '📎 收藏密件',
        'stats.achvNew': '🎖 解锁成就：{n}',

    /* ---------- 游戏入口（title/desc） ---------- */
    'g.snake.t': '贪吃蛇', 'g.snake.d': '吃掉食物越变越长，小心别撞墙也别咬到自己！',
    'g.g2048.t': '2048', 'g.g2048.d': '滑动合并相同数字，冲击 2048 神话！',
    'g.blocks.t': '俄罗斯方块', 'g.blocks.d': '经典消除鼻祖，堆叠消除挑战极限手速。',
    'g.minesweeper.t': '扫雷', 'g.minesweeper.d': '推理与运气的博弈，找出所有隐藏的地雷。',
    'g.shikaku.t': '方形分割', 'g.shikaku.d': '把网格切成矩形，每块面积等于数字。',
    'g.fillomino.t': '拼图填数', 'g.fillomino.d': '同数连通成块，块面积恰好等于数字。',
    'g.circuit.t': '电路连接', 'g.circuit.d': '旋转线路，把电流从电源送到灯泡。',
    'g.match3.t': '消消乐', 'g.match3.d': '三颗相连即消除，连锁反应分数翻倍！',
    'g.game24.t': '24点', 'g.game24.d': '加减乘除凑出 24，烧脑的速算挑战。',
    'g.brickbash.t': '打砖块', 'g.brickbash.d': '弹球击碎所有砖块，守住你的三条命！',
    'g.pixelbird.t': '像素飞鸟', 'g.pixelbird.d': '点一下飞一下，穿越管道考验节奏感。',
    'g.catch.t': '接物大作战', 'g.catch.d': '移动篮子接住天上掉的好货，躲开炸弹！',
    'g.chess.t': '国际象棋', 'g.chess.d': '完整走法规则，三档 AI 挑战你的棋力。',
    'g.checkers.t': '跳棋', 'g.checkers.d': '斜走跳吃升王，吃掉 AI 全部棋子。',
    'g.diceluck.t': '快艇骰子', 'g.diceluck.d': '五颗骰子 13 个计分类别，策略填分。',
    'g.poker.t': '扑克对决', 'g.poker.d': '跟注加注弃牌，牌型对决赢筹码。',
    'g.siege.t': '攻城棋', 'g.siege.d': '指挥兵王攻入敌营，高地兵攻击加倍。',
    'g.gomoku.t': '五子棋', 'g.gomoku.d': '黑白对弈五子连珠，双人同屏一决高下。',
    'g.reversi.t': '黑白棋', 'g.reversi.d': '翻转棋盘攻城略地，可与电脑 AI 切磋。',
    'g.llk.t': '连连看', 'g.llk.d': '国民品类 × 密码符号：两段三折线连通配对消除，三关递进 + 每日一题。',
    'g.klondike.t': '纸牌接龙', 'g.klondike.d': 'Windows 记忆杀：7 列红黑交替，A→K 四套还原。三难度（翻牌/撤销）+ 每日固定洗牌。',
    'g.tank.t': '铁壁防线', 'g.tank.d': '敌军坦克进攻密码局，驾驶守卫坦克清剿多波次敌军，道具系统 + 三难度。',
    'g.sheep.t': '绵羊三消', 'g.sheep.d': '多层叠牌 + 7 格卡槽三消 + 三道具，第一关教学 / 第二关地狱。',
    'g.sectorsiege.t': '拉线占领', 'g.sectorsiege.d': '即时战略：随机网格产兵，拖线派兵占领——吞并中立滚雪球，统一密码战线。',
    'g.sudoku.t': '数独', 'g.sudoku.d': '九宫格逻辑推理，把每行每列每宫填满 1-9。',
    'g.nonogram.t': '数织', 'g.nonogram.d': '根据行列数字提示，涂出隐藏的图案。',
    'g.sokoban.t': '推箱子', 'g.sokoban.d': '把每个箱子精准推到目标点，别进死角。',
    'g.maze.t': '迷宫', 'g.maze.d': '在随机迷宫里找到通往终点的路。',
    'g.fourline.t': '四子棋', 'g.fourline.d': '抢先连成四子，挑战会攻会守的 AI。',
    'g.blackjack.t': '21点', 'g.blackjack.d': '与庄家比点数，攒满筹码即胜的纸牌对决。',
    'g.pipe.t': '管道连接', 'g.pipe.d': '旋转管道接通左右两端，步数越少越好。',
    'g.platformer.t': '平台跳跃', 'g.platformer.d': '穿越平台收集金币，躲开尖刺冲向终点。',
    'g.spaceshooter.t': '太空射击', 'g.spaceshooter.d': '驾驶战机击落外星舰队，守住底线。',
    'g.rhythm.t': '节拍脉冲', 'g.rhythm.d': '音符落点精准点击，连击越高分越高。',
    'g.billiards.t': '台球', 'g.billiards.d': '拖拽白球像弹弓一样击打，清空台面。',
    'g.frogcross.t': '青蛙过河', 'g.frogcross.d': '穿越车流与河流，抵达对岸安全区。',
    'g.mazedot.t': '迷宫吃豆', 'g.mazedot.d': '迷宫追逐玩法致敬经典街机，非官方，与 PAC-MAN™ 无关。',
    'g.asteroidf.t': '小行星', 'g.asteroidf.d': '击碎小行星群，飞船别被撞毁。',
    'g.pixeldino.t': '恐龙快跑', 'g.pixeldino.d': '无限奔跑跳跃，躲开障碍越远越好。',
    'g.towerdefense.t': '塔防', 'g.towerdefense.d': '建造电塔狙击冰塔，守住 20 波进攻。',
    'g.deckbuilder.t': '卡牌构筑', 'g.deckbuilder.d': '能量抽牌出牌，击败三大 Boss。',
    'g.tactics.t': '战棋对决', 'g.tactics.d': '回合制战棋：兵种克制 + 移动/攻击范围，三关递进挑战 AI 军团。',
    'g.roperescue.t': '切绳救星', 'g.roperescue.d': '切割绳子让糖果摆进小嘴，三关挑战。',
    'g.bridge.t': '桥梁搭建', 'g.bridge.d': '搭木板架桥，让小球滚到对岸终点。',
    'g.fruitmerge.t': '西瓜合成', 'g.fruitmerge.d': '投下水果两两合成，冲击终极西瓜。',
    'g.slitherlink.t': '数回', 'g.slitherlink.d': '经典逻辑谜题：连线成环，数字=周围线数，程序化生成唯一解。',
    'g.hashi.t': '岛屿连线', 'g.hashi.d': '经典逻辑谜题：架桥连通所有岛屿，每岛桥数=岛数字，唯一解生成。',
    'g.railshooter.t': '轨道射击', 'g.railshooter.d': '90 秒限时射击，命中移动目标拿高分。',
    'g.dungeon.t': '地牢探险', 'g.dungeon.d': 'roguelike 回合制地牢：随机 5 层迷宫、迷雾探索、打怪拾宝、挑战 Boss。',
    'g.bowling.t': '保龄球', 'g.bowling.d': '10 帧标准计分（Strike/Spare/追加投），角度/力度/旋转物理投球。',
    'g.ballpop.t': '弹珠消消', 'g.ballpop.d': '彩球链沿蛇形路径前进，发射同色球三连消除，连锁消消 + 倒退/爆炸球。',
    'g.curling.t': '冰壶', 'g.curling.d': '物理瞄准策略对抗 AI：摩擦滑行/撞击/刷冰，8 局中心圈得分。',
    'g.bullethell.t': '弹幕射击', 'g.bullethell.d': '2px 判定点贴弹擦分：环形/螺旋/扇形弹幕 + 多阶段 Boss，三难度递进。',

    /* ---------- tank 游戏内 ---------- */
    'gt.pickT': '守卫密码局', 'gt.pickD': '敌军坦克来窃取密码机——守住基地，清剿全部波次。选择难度：',
    'gt.easy': '简单', 'gt.normal': '普通', 'gt.hard': '困难',
    'gt.dEasy': '4 波 · 每波 3 敌 · 单血敌', 'gt.dNormal': '6 波 · 每波 4 敌 · 单血敌', 'gt.dHard': '8 波 · 每波 5 敌 · 双血敌',
    'gt.pause': '已暂停 · 按 P 继续', 'gt.fire': '开火',
    'gt.wave': '波次', 'gt.enemyLeft': '敌余', 'gt.lives': '生命', 'gt.score': '分',
    'gt.waveFmt': '{w} 波 · 每波 {e} 敌',
    'gt.itemStar': '火力升级：穿墙弹！', 'gt.itemShield': '护盾 3 秒！', 'gt.itemFreeze': '敌军冻结 3 秒！', 'gt.itemRepair': '基地加固！',
    'gt.reborn': '坦克被击毁！重生（剩余 {n} 命）', 'gt.waveIncoming': '第 {n} 波敌军来袭！',
    'gt.winT': '基地守住了！', 'gt.winD': '清剿全部 {w} 波敌军（击杀 {k}），得分 <b>{s}</b><br>密码机安然无恙，敌军一无所获。',
    'gt.loseBase': '基地失守！', 'gt.loseAll': '守军尽没',
    'gt.loseBaseD': '敌军炸毁了密码局——机密失守。得分 {s}', 'gt.loseAllD': '坦克全部战毁，密码局失去最后防线。得分 {s}',
    'gt.again': '再守一次',
    'gt.tut1': '敌军坦克进攻密码局情报部——守住基地，清剿全部波次。基地被炸或 3 条命用完即败。',
    'gt.tut2': '方向键/WASD 移动，空格开火，P 暂停；触屏用方向键 + 开火按钮。',
    'gt.tut3': '波次间隙可能掉落：火力(穿墙)、护盾、冻结敌军、加固基地。',
    'gt.tut4': '得分 = 击杀 50 + 砖块 10 + 钢墙 5 + 波次奖励 100，越高越好。',
    'gt.tut1t': '任务', 'gt.tut2t': '操作', 'gt.tut3t': '道具', 'gt.tut4t': '计分',
  },

  en: {
    /* ---------- common ---------- */
                'common.help': 'Help',
                'common.close': 'Close',
                'common.srcTitle': 'Sources',
    
    /* ---------- shell ---------- */
    'shell.lobby': '◀ Lobby',
    'shell.help': 'Help',
    'shell.story': 'Story',
    'shell.best': 'BEST',
    'shell.artifactGot': 'added to the artifact archive!',
    'shell.restart': '↻ Restart',
    'shell.paused': '⏸ Paused · Press P to resume',
    'shell.noTutorial': 'No tutorial for this game yet',
    'shell.newRecord': 'New record!',
    'shell.canvasLabel': '{n} game view',
    'shell.fullscreen': 'Fullscreen',
    'shell.exitFullscreen': 'Exit fullscreen',

    /* ---------- settings ---------- */
    'settings.sound': 'Sound',
    'settings.music': 'Music',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.search': 'Search games',
    'settings.haptic': 'Haptics',
    'search.title': 'Site-wide search',
    'search.ph': 'Search games / chapters / people / artifacts…',
    'search.hint': 'Live search across the whole site (Enter jumps to first result, Esc closes)',
    'search.games': 'Games',
    'search.chapters': 'Chapters',
    'search.people': 'People',
    'search.artifacts': 'Artifacts',
    'search.empty': 'No matches found',
    'theme.neon': 'Arcade Neon',
    'theme.daylight': 'Morning Light',

    /* ---------- extras ---------- */
    'extras.tutDefaultTitle': 'How to Play',
    'extras.tutStart': 'Start Game',

    /* ---------- app ---------- */
    'app.title': 'ARCADE HALL',
    'app.titleSuffix': ' · ARCADE HALL',
    'nav.label': 'Main navigation',
    'nav.skip': 'Skip to content',
    'nav.home': 'Home', 'nav.chronicle': 'Chronicle', 'nav.atlas': 'Knowledge Atlas',
    'nav.glossary': 'Glossary', 'nav.games': 'Games', 'nav.profile': 'Profile', 'nav.stories': 'Chronicle', 'nav.quiz': 'Quiz Arena', 'nav.workshop': 'Crypto Workshop', 'nav.protocols': 'Protocol Lab',
    'workshop.encTab': '🧪 Encrypt', 'workshop.decTab': '🔓 Auto-Crack',
    'workshop.encGo': '🔐 Encrypt', 'workshop.decGo': '🔓 Crack',
    'workshop.decNote': 'Auto-detect: Caesar / Morse / Bacon / Binary / XOR / Base64 / Rail Fence / Vigenère (common keys)',
    'workshop.eggTitle': '🎯 Egg Hunt (site-wide treasure)',
    'workshop.eggNote': '20 cipher eggs are hidden across the site — crack them and type the answer word below. Collect all to unlock a hidden achievement!',
    'quiz.entrySub': '252 questions · find your rank',
    'quiz.lvl1': 'Novice', 'quiz.lvl2': 'Advanced', 'quiz.lvl3': 'Expert', 'quiz.lvl4': 'Master',
    'quiz.right': '✅ Correct!',
    'quiz.wrong': '❌ Wrong',
    'quiz.resultTitle': '🎖 Round Results',
    'quiz.resultRank': 'Your cipher rank',
    'quiz.resultSub': 'Rank saved locally — view it in your Profile',
    'quiz.resultAgain': '↻ Test Again',
    'quiz.reviewWrong': 'Review this round\'s misses ({n})',
    'quiz.bestLabel': 'Best so far: {s} / {t}',
    'quiz.wrongBtn': '🔁 Practice mistakes ({n})',
    'quiz.practiceDone': 'Practice round complete!',
    'quiz.practiceSub': 'Answer a mistake correctly 3 times and it leaves the book',
    'duel.p1': 'Player 1', 'duel.p2': 'Player 2',
    'duel.p1keys': '1 2 3 4', 'duel.p2keys': '7 8 9 0',
    'duel.q': 'Q{n}',
    'duel.win': '🏆 Victory', 'duel.draw': '🤝 Draw', 'duel.score': 'Score {s}', 'duel.wait': 'waiting…',
    'duel.winMsg': 'wins the duel!', 'duel.drawMsg': 'Evenly matched — rematch?',
    'duel.again': '↻ Rematch',
    'morseL.title': '👂 Morse Ear Training',
    'morseL.sub': 'Real-time synthesized dots & dashes · identify letters by ear · 3 speeds · 10 per round',
    'morseL.pickSpeed': 'Pick a speed',
    'morseL.speedSlow': '🐢 Slow', 'morseL.speedNormal': '🐇 Normal', 'morseL.speedFast': '⚡ Fast', 'morseL.speedFw': '🌀 Farnsworth',
    'morseL.fwHint': 'Farnsworth training: 3-letter groups, fast characters with wide gaps — train the rhythm, not single dots',
    'morseL.start': '🎧 Start Training',
    'morseL.q': 'Q{n}',
    'morseL.replay': 'Replay', 'morseL.submit': 'Submit',
    'morseL.right': '✅ Correct!',
    'morseL.wrong': '❌ It was {c}',
    'morseL.result': 'Round Results',
    'morseL.best': 'Best: {s} / {t}',
    'morseL.again': '↻ Train Again',
    'stats.vizChq': '🧠 Chapters mastered',
    'stats.vizGloss': '📖 Terms browsed',
    'stats.vizMap': '🗺️ Map events',
    'stats.vizSub': 'Your trail through the knowledge zones: chapters read, quizzes done, maps explored',
    'stats.heatTitle': '📅 Rounds completed in the last 12 months',
    'stats.wrongTitle': '🔁 Mistake Drill',
    'stats.wrongSub': 'Answer a mistake correctly 3 times and it leaves the book',
    'settings.storageWarn': 'Local storage is unavailable or full — new records may not be saved',
    'stats.wrongCount': '{n} questions',
    'save.toastExport': 'Save downloaded', 'save.toastCopied': 'Backup code copied to clipboard',
    'save.copyManual': 'Backup code generated — copy it manually',
    'save.toastImported': 'Restored {n} records',
    'save.toastFail': 'Import failed: unrecognized format',
    'save.toastWiped': 'Wiped {n} records',
    'save.confirmWipe': 'Wipe ALL save data? This cannot be undone!',
    'share.letterTitle': '🔐 Cipher Letter (ARCADE HALL)',
    'share.letterAlgo': 'Cipher: {a}',
    'share.letterKey': 'Key: {k}',
    'share.letterCipher': 'Ciphertext: {c}',
    'share.letterFooter': '— play more at game.netcn.org!',
    'share.linkBtn': '🔗 Copy link',
    'share.linkDone': 'Share link copied — it loads the ciphertext on open',
    'share.linkTooLong': 'Ciphertext too long for a link — use text sharing instead',
    'share.linkBad': 'Invalid link parameter',
    'share.letterBtn': '📨 Share Cipher Letter',
    'share.letterDone': 'Cipher letter copied — send it to a friend!',
    'share.letterNoOut': 'Generate ciphertext first',
    'share.recordTitle': '📊 My Arcade Record (ARCADE HALL)',
    'share.recordPlayed': 'Played {p}/{t} games',
    'share.recordRank': 'Rank: {r}',
    'share.recordQuiz': 'Quiz rank: {r}',
    'share.recordDaily': '{n} daily challenges done',
    'share.recordStreak': '{n}-day streak',
    'share.recordEggs': '{n} eggs found',
    'share.recordFooter': '— game.netcn.org · Arcade Hall',
    'share.recordBtn': '📤 Share My Record',
    'share.recordDone': 'Record copied — share it!',
    'share.recordSub': 'One click builds your record summary and copies it to the clipboard',
    'artifacts.nature.real': 'Genuine Historical Document',
    'artifacts.nature.dramatized': 'Dramatised Retelling',
    'artifacts.nature.reconstructed': 'Reconstructed from Sources',
    'home.continue': '🕹️ Keep cracking',
    'home.continueGo': 'Go to the arcade →',
    'home.progChapters': 'chapters',
    'home.progLetters': 'key letters',
    'home.progArtifacts': 'artifacts',
    'home.progGames': 'played',
    'home.enter': 'Enter',
    'home.people': 'People',
    'home.artifacts': 'Artifact',
    'home.games': 'Games',
    'home.daily': 'Daily Decode',
    'home.go': 'Go',
    'home.footNote': 'Records stay local in your browser · nothing is uploaded · history compiled from public sources for learning only',
    'home.footBrand': '© 2026 ARCADE HALL · GAME.NETCN.ORG',
    'people.countF': '{n} codebreakers · click for their file',
    'people.gamesOf': 'Related games · click to play',
    'people.artifactsOf': 'Related artifacts',
    'artifacts.countF': '{u}/{t} collected',
    'artifacts.pageDesc': 'ARCADE HALL · Artifacts Vault: unlock 41 historical cipher artifacts by beating games — Rosetta Stone, Zimmermann Telegram, VENONA fragments… collect 3,000 years of cryptographic evidence.',
    'app.descIndex': 'ARCADE HALL: 53 classic mini games — arcade, logic, spatial, action, board, card & dice, ball sports. Play instantly; best scores stay in your browser.',
    'app.descStats': 'ARCADE HALL · My Profile: career stats and achievements, all stored locally in your browser.',

    /* ---------- 404 ---------- */

    /* ---------- lobby ---------- */
    'lobby.coinLine': 'INSERT COIN · Play instantly · Best scores saved locally',
    'lobby.startStory': '📜 Start at Bletchley Park',
    'lobby.footBrand': '© 2026 ARCADE HALL · GAME.NETCN.ORG',
    'lobby.footLine': 'Records stay local · nothing is uploaded · history compiled from public sources for learning only',
            'lobby.footprint': 'Your footprint · 12 eras (lit by playing / reading)',
        'lobby.searchPlaceholder': 'Search games / category…',
        'lobby.all': 'All',
    'lobby.favs': 'Favorites',
    'lobby.lvl': 'Level', 'lobby.easy': 'Easy', 'lobby.mid': 'Medium', 'lobby.hard': 'Hard',
    'lobby.diffEasy': 'Easy', 'lobby.diffMid': 'Medium', 'lobby.diffHard': 'Hard',
    'lobby.time': 'Time', 'lobby.t1': '≤1 min', 'lobby.t5': '~5 min', 'lobby.t10': '10 min+',
    'lobby.timeShort': '≤1 min', 'lobby.timeMid': '~5 min', 'lobby.timeLong': '10 min+',
    'lobby.daily': '📅 Daily Decode',
    'lobby.dailyStart': 'Starting from puzzle 1 today',
    'lobby.streak': 'streak',
    'lobby.days': 'days',
    'lobby.pending': 'pending today',
    'lobby.todayDone': 'Done today',
    'lobby.unitStreak': 'streak',
    'lobby.unitSteps': 'steps',
    'lobby.unitTimes': 'tries',
    'lobby.unitBlocks': 'blocks',
    'lobby.unitPts': 'pts',
    'lobby.unitSolved': 'solved',
    'lobby.unitChips': 'chips',
    'lobby.unitKills': 'KO',
    'lobby.unitWins': 'wins',
    'lobby.recent': 'Recently played',
        'lobby.games': 'games',
    'lobby.challenged': 'Played',
    'lobby.playedBadge': '✅ Played',
    'lobby.playedTitle': 'Already played',
    'lobby.favOff': 'Favorite',
    'lobby.favOn': 'Unfavorite',
    'lobby.emptyFavs': 'No favorites yet — tap the ★ on a card to save it',
    'lobby.emptySearch': 'No games match. Try another keyword?',
    'lobby.statsLine': 'DECODE {n} games · INSERT COIN',
    'lobby.achv': '🎖 Achievements',
                                                'lobby.mobileOk': '📱 Touch friendly',
    'lobby.mobilePad': '🖥 Desktop advised',
        'lobby.dailySolvedT': '✅ Solved · {t}s',
        'lobby.rankMax': '{x} XP · Max rank',
    'lobby.rankNext': '{x}/{n} XP',
    'rank.trainee.n': 'Cadet Cryptanalyst',
    'rank.junior.n': 'Junior Cryptanalyst',
    'rank.cryptanalyst.n': 'Cryptanalyst',
    'rank.senior.n': 'Senior Cryptanalyst',
    'rank.expert.n': 'Decryption Expert',
    'rank.chief.n': 'Chief Decryptor',
    'rank.ace.n': 'Ace Codebreaker',
    'rank.master.n': 'Cipher Master',
    'rank.promo': 'Promoted: {n}!',
    'lobby.telegraph': '📡 Intercepted: "The ghost is still on the wire." — the detective\'s final telegram',
    'cat.经典街机': 'Arcade',
    'cat.动作反应': 'Action',
    'cat.逻辑谜题': 'Logic',
    'cat.空间解谜': 'Space',
    'cat.球类竞技': 'Sports',
    'cat.棋类对弈': 'Board',
    'cat.牌骰策略': 'Cards & Dice',
    'cat.密码破译': 'Ciphers',

    /* ---------- stats ---------- */
    'stats.gamesUnit': 'games',
    'stats.barNote': 'All records stay local · nothing is uploaded',
    'stats.swHit': 'Local cache hit rate {p}% · {o} offline fallback(s) — stored on this device only',
    'stats.swNone': 'Awaiting stats: no SW cache record on this device yet',
    'savegame.resumed': 'Resumed last progress (stored on this device only)',
    'stats.pctNote': 'Played {p}% · all records stay local · nothing is uploaded',
    'stats.dailyTotal': 'Total dailies solved',
    'stats.achv': '🎖 Achievements',
    'stats.achvCount': '🎖 {u} / {t} unlocked',
    'stats.rankNext': '{x} XP to next rank: {n}',
    'stats.rankMax': 'Highest rank reached — salute, Code Master.',
    'stats.rankHint': 'Complete decoding challenges to earn rank XP',
    'achv.first.n': 'First Steps', 'achv.first.d': 'Play your first game',
    'achv.ten.n': 'Decoder', 'achv.ten.d': 'Play 10 games',
    'achv.thirty.n': 'Code Breaker', 'achv.thirty.d': 'Play 30 games',
    'achv.fifty.n': 'Collector Supreme', 'achv.fifty.d': 'Play 50 games',
    'achv.allcats.n': 'All Eight Realms', 'achv.allcats.d': 'Play at least 1 game in each of the 8 categories',
    'achv.streak7.n': 'Seven-Day Streak', 'achv.streak7.d': '7 consecutive days of daily decodes',
    'achv.daily5.n': 'Daily Grind', 'achv.daily5.d': 'Finish all dailies in a single day',
    'achv.flagship4.n': 'Flagship Hunter', 'achv.flagship4.d': 'Play 4 exclusive flagship games',
    'achv.speed.n': 'Speed Demon', 'achv.speed.d': 'Any timed game best ≤ 60 seconds',
    'achv.perfect.n': 'Perfectionist', 'achv.perfect.d': 'Play every scoreable game',
    'achv.cbegin.n': 'First Decoder', 'achv.cbegin.d': 'Read chapter 0, "The Dawn of Decoding"',
    'achv.chist5.n': 'History Buff', 'achv.chist5.d': 'Read any 5 chronicle chapters',
    'achv.call.n': 'Chronicle Reader', 'achv.call.d': 'Read all 12 chronicle chapters',
    'achv.cletter3.n': 'Letter Hunter', 'achv.cletter3.d': 'Collect 3 key letters',
    'achv.cfinal.n': 'Final Decoder', 'achv.cfinal.d': 'Crack the final cipher',
    'achv.cart5.n': 'Artifact Collector', 'achv.cart5.d': 'Unlock 5 historical artifacts',
    'achv.cgame5.n': 'History in Games', 'achv.cgame5.d': 'Beat 5 chronicle-linked games',
    'achv.ehunter.n': 'Cipher Hunter', 'achv.ehunter.d': 'Collect all 20 hidden cipher eggs',
    'achv.qmaster.n': 'Quiz Master', 'achv.qmaster.d': 'Score every question in one quiz round',
    'achv.qlegend.n': 'Legendary Decoder', 'achv.qlegend.d': 'Reach the Legend rank in the quiz',
    'achv.chq5.n': 'Chapter Scholar', 'achv.chq5.d': 'Light up chapter mastery for 5 chapters',
    'achv.chqall.n': 'Chronicle Complete', 'achv.chqall.d': 'Light up every chapter’s mastery',
    'achv.morse5.n': 'Morse Listener', 'achv.morse5.d': 'Score full marks in a Morse listening round',
    'achv.duel5.n': 'Duel Champion', 'achv.duel5.d': 'Win 5 two-player duels',
    'achv.gloss30.n': 'Glossary Reader', 'achv.gloss30.d': 'Read 30 glossary entries',
    'achv.timeline60.n': 'Time Traveler', 'achv.timeline60.d': 'Browse the crypto history timeline',
    'achv.discov.n': 'Explorer', 'achv.discov.d': 'Visit the Discover hub',
    'achv.relweb.n': 'Network Detective', 'achv.relweb.d': 'Browse the people relationship web',
    'achv.zhstory.n': 'China Visitor', 'achv.zhstory.d': 'Visit the Chinese Crypto feature',
    'stats.collCats': '🗺️ Categories',
    'stats.collGames': '🎮 Played',
    'stats.collFlags': '⚙️ Flagships',
    'stats.chRead': '📖 Chapters read',
    'stats.chLetters': '🔑 Key letters',
    'stats.chArts': '📎 Artifacts',
        'stats.achvNew': '🎖 Achievement unlocked: {n}',

    /* ---------- game entries (title/desc) ---------- */
    'g.snake.t': 'Snake', 'g.snake.d': 'Eat food and grow — avoid walls and yourself!',
    'g.g2048.t': '2048', 'g.g2048.d': 'Slide and merge tiles, chase the 2048 myth!',
    'g.blocks.t': 'Block Stack', 'g.blocks.d': 'The classic block-stacking legend.',
    'g.minesweeper.t': 'Minesweeper', 'g.minesweeper.d': 'Deduction and luck — find every hidden mine.',
    'g.shikaku.t': 'Shikaku', 'g.shikaku.d': 'Slice the grid into rectangles matching the numbers.',
    'g.fillomino.t': 'Fillomino', 'g.fillomino.d': 'Connect equal numbers into blocks of that size.',
    'g.circuit.t': 'Circuit', 'g.circuit.d': 'Rotate wires to power the bulb.',
    'g.match3.t': 'Match-3', 'g.match3.d': 'Three in a row pops — chain reactions double your score!',
    'g.game24.t': '24 Game', 'g.game24.d': 'Use + − × ÷ to make 24.',
    'g.brickbash.t': 'Brick Bash', 'g.brickbash.d': 'Smash every brick with three lives.',
    'g.pixelbird.t': 'Pixel Bird', 'g.pixelbird.d': 'Tap to fly through the pipes.',
    'g.catch.t': 'Catch & Collect', 'g.catch.d': 'Move the basket, catch goodies, dodge bombs!',
    'g.chess.t': 'Chess', 'g.chess.d': 'Full rules, three AI levels.',
    'g.checkers.t': 'Checkers', 'g.checkers.d': 'Jump, capture and king up — beat the AI.',
    'g.diceluck.t': 'Dice Roll', 'g.diceluck.d': 'Five dice, thirteen scoring categories, pick your strategy.',
    'g.poker.t': 'Poker', 'g.poker.d': 'Bet, raise or fold — win the pot with the best hand.',
    'g.siege.t': 'Siege', 'g.siege.d': 'March your king into the enemy fortress — high ground doubles attack.',
    'g.gomoku.t': 'Gomoku', 'g.gomoku.d': 'Five in a row wins, head to head or vs AI.',
    'g.reversi.t': 'Reversi', 'g.reversi.d': 'Flip the board, outflank the AI.',
    'g.llk.t': 'Link Link', 'g.llk.d': 'The classic pairing game with cipher symbols — connect pairs within two bends.',
    'g.klondike.t': 'Klondike', 'g.klondike.d': 'The most famous solitaire: red-black alternation, A→K four foundations, daily deal.',
    'g.tank.t': 'Iron Defense', 'g.tank.d': 'Defend the cipher bureau: clear waves of enemy tanks, four power-ups.',
    'g.sheep.t': 'Sheep Match', 'g.sheep.d': 'Layered tiles + 7-slot triple match with three power-ups: casual first level, hellish second.',
    'g.sectorsiege.t': 'Sector Siege', 'g.sectorsiege.d': 'Real-time strategy: grids produce troops, drag to attack — snowball through neutral stations.',
    'g.sudoku.t': 'Sudoku', 'g.sudoku.d': 'Fill rows, columns and boxes with 1–9 using pure logic.',
    'g.nonogram.t': 'Nonogram', 'g.nonogram.d': 'Use row and column hints to paint a hidden picture.',
    'g.sokoban.t': 'Sokoban', 'g.sokoban.d': 'Push every box onto a target without getting stuck.',
    'g.maze.t': 'Maze', 'g.maze.d': 'Find the exit through a random maze.',
    'g.fourline.t': 'Four in a Row', 'g.fourline.d': 'Be first to line up four against a crafty AI.',
    'g.blackjack.t': 'Blackjack', 'g.blackjack.d': 'Beat the dealer to 21 and stack up the chips.',
    'g.pipe.t': 'Pipe Puzzle', 'g.pipe.d': 'Rotate pipes to connect left and right in as few moves as possible.',
    'g.platformer.t': 'Platformer', 'g.platformer.d': 'Jump across platforms, grab coins, dodge spikes.',
    'g.spaceshooter.t': 'Space Shooter', 'g.spaceshooter.d': 'Pilot a fighter, blast alien fleets, hold the line.',
    'g.rhythm.t': 'Pulse Tap', 'g.rhythm.d': 'Tap notes as they land — longer combos, higher scores.',
    'g.billiards.t': 'Billiards', 'g.billiards.d': 'Drag the cue ball like a slingshot and clear the table.',
    'g.frogcross.t': 'Frog Crossing', 'g.frogcross.d': 'Cross traffic and rivers to reach home.',
    'g.mazedot.t': 'Maze Dot', 'g.mazedot.d': 'A maze-chase homage to classic arcades — unofficial, not affiliated with PAC-MAN™.',
    'g.asteroidf.t': 'Asteroid Field', 'g.asteroidf.d': 'Shoot the asteroid field without getting hit.',
    'g.pixeldino.t': 'Pixel Dino', 'g.pixeldino.d': 'Endless running — jump obstacles, go as far as you can.',
    'g.towerdefense.t': 'Tower Defense', 'g.towerdefense.d': 'Build tesla and ice towers, survive 20 waves.',
    'g.deckbuilder.t': 'Deck Builder', 'g.deckbuilder.d': 'Spend energy, draw and play cards, beat three bosses.',
    'g.tactics.t': 'Tactics', 'g.tactics.d': 'Turn-based tactics: unit counters + movement/attack ranges, three maps.',
    'g.roperescue.t': 'Rope Rescue', 'g.roperescue.d': 'Cut ropes to drop the candy into the little mouth.',
    'g.bridge.t': 'Bridge Builder', 'g.bridge.d': 'Lay planks so the ball rolls to the finish.',
    'g.fruitmerge.t': 'Watermelon Merge', 'g.fruitmerge.d': 'Drop fruits and merge pairs — chase the ultimate watermelon.',
    'g.slitherlink.t': 'Slitherlink', 'g.slitherlink.d': 'Loop-the-loop: the digit is the number of adjacent edges; uniquely solvable.',
    'g.hashi.t': 'Hashi', 'g.hashi.d': 'Bridge all islands so each island gets exactly its digit; uniquely solvable.',
    'g.railshooter.t': 'Rail Shooter', 'g.railshooter.d': '90-second shooting gallery — hit moving targets for high scores.',
    'g.dungeon.t': 'Dungeon', 'g.dungeon.d': 'Roguelike turn-based dungeon: five random floors, fog of war, loot and a boss.',
    'g.bowling.t': 'Bowling', 'g.bowling.d': 'Standard 10-frame scoring (strike/spare/bonus rolls) with angle, power and spin.',
    'g.ballpop.t': 'Ball Pop', 'g.ballpop.d': 'Shoot colored balls into the chain — three in a row pops, chain reactions.',
    'g.curling.t': 'Curling', 'g.curling.d': 'Physics aiming vs AI: slide, collide, sweep — score in the house over 8 ends.',
    'g.bullethell.t': 'Bullet Hell', 'g.bullethell.d': 'A tiny hitbox, graze bullets for points: rings, spirals, fans and a multi-phase boss.',

    /* ---------- tank in-game ---------- */
    'gt.pickT': 'DEFEND THE CIPHER BUREAU', 'gt.pickD': 'Enemy tanks are coming for the cipher machine — guard the base and clear every wave. Choose difficulty:',
    'gt.easy': 'Easy', 'gt.normal': 'Normal', 'gt.hard': 'Hard',
    'gt.dEasy': '4 waves · 3 per wave · 1 HP', 'gt.dNormal': '6 waves · 4 per wave · 1 HP', 'gt.dHard': '8 waves · 5 per wave · 2 HP',
    'gt.pause': 'Paused · press P to resume', 'gt.fire': 'FIRE',
    'gt.wave': 'Wave', 'gt.enemyLeft': 'Enemies', 'gt.lives': 'Lives', 'gt.score': 'pts',
    'gt.waveFmt': '{w} waves · {e} per wave',
    'gt.itemStar': 'Power up: piercing shells!', 'gt.itemShield': 'Shield 3s!', 'gt.itemFreeze': 'Enemies frozen 3s!', 'gt.itemRepair': 'Base reinforced!',
    'gt.reborn': 'Tank destroyed! Respawn ({n} lives left)', 'gt.waveIncoming': 'Wave {n} incoming!',
    'gt.winT': 'BASE SECURED!', 'gt.winD': 'All {w} waves cleared ({k} kills), score <b>{s}</b><br>The cipher machine is safe.',
    'gt.loseBase': 'BASE LOST!', 'gt.loseAll': 'GARRISON WIPED',
    'gt.loseBaseD': 'The enemy destroyed the cipher bureau. Score {s}', 'gt.loseAllD': 'All tanks lost — the bureau has no line of defense left. Score {s}',
    'gt.again': 'DEFEND AGAIN',
    'gt.tut1': 'Enemy tanks attack the cipher bureau — hold the base and clear every wave. Lose if the base falls or you run out of 3 lives.',
    'gt.tut2': 'Arrow keys/WASD to move, Space to fire, P to pause; on touch use the D-pad and fire button.',
    'gt.tut3': 'Between waves: drops include power (pierce shells), shield, freeze enemies and base reinforcement.',
    'gt.tut4': 'Score = 50/kill + 10/brick + 5/steel + 100/wave bonus. Higher is better.',
    'gt.tut1t': 'Mission', 'gt.tut2t': 'Controls', 'gt.tut3t': 'Items', 'gt.tut4t': 'Scoring',
  }
};

/* ============================================================
   人物冷知识 + 章节反链文案（P1 内容深度）
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.champollion.fact'] = '冷知识：商博良 11 岁立志破译象形文字，19 岁已掌握十几种语言；他破译的关键是「王名圈」里的王名——被圈起来的符号很可能是国王的名字。';
  d.en['stp.champollion.fact'] = 'Fun fact: Champollion vowed at 11 to decipher hieroglyphs and knew a dozen languages by 19; his breakthrough was the cartouche — the ringed signs spelling royal names.';
  d.zh['stp.caesar.fact'] = '冷知识：凯撒密码的偏移量其实不确定——史载他用后移 3 位；「凯撒密码」之名是后世起的。';
  d.en['stp.caesar.fact'] = 'Fun fact: Caesar\'s shift was not fixed — he usually wrote three places on; the name "Caesar cipher" was coined later.';
  d.zh['stp.kindi.fact'] = '冷知识：肯迪写了 200 多部著作，涵盖哲学、光学、音乐、数学，是「阿拉伯人之哲」；他的频率分析法领先欧洲约 600 年。';
  d.en['stp.kindi.fact'] = 'Fun fact: Al-Kindi wrote over 200 works across philosophy, optics, music and mathematics; his frequency analysis predated Europe by some 600 years.';
  d.zh['stp.bacon.fact'] = '冷知识：培根的双字体密码用「普通体 vs 加粗体」两种字形藏信——5 位 A/B 串就是二进制的先声，比莱布尼茨的二进制早了几十年。';
  d.en['stp.bacon.fact'] = 'Fun fact: Bacon\'s biliteral hid messages in two typefaces — five A/B symbols, a precursor of binary decades before Leibniz.';
      d.zh['stp.payne.fact'] = '冷知识：佩恩万本职是地质学与古生物学家，一战应征入伍才转入密码处；他用两条开头相同的电报破解了 ADFGVX。';
  d.en['stp.payne.fact'] = 'Fun fact: Painvin was a geologist and paleontologist, drafted into the cipher section; two telegrams with identical openings let him break ADFGVX.';
  d.zh['stp.turing.fact'] = '冷知识：图灵在布莱切利园是出了名的长跑健将——他会跑 30 英里往返开会；战后他设计的「图灵测试」至今仍是 AI 的试金石。';
  d.en['stp.turing.fact'] = 'Fun fact: Turing was a famous long-distance runner at Bletchley — he would run 30 miles to meetings; his Turing test still defines AI.';
  d.zh['stp.welchman.fact'] = '冷知识：韦尔奇曼的「对角线板」把 Bombe 的搜索时间从数小时压到十几分钟——他自己说这是「一眼看出的主意」。';
  d.en['stp.welchman.fact'] = 'Fun fact: Welchman\'s diagonal board cut Bombe search from hours to minutes — he claimed it was "an idea seen at a glance".';
  d.zh['stp.rochefort.fact'] = '冷知识：罗奇福特会说日语，年轻时在日本待过；他设计的「AF 淡水陷阱」让日军自己供出了中途岛——破译史上最优雅的钓鱼。';
  d.en['stp.rochefort.fact'] = 'Fun fact: Rochefort learned Japanese in his youth; his "AF fresh water" trap made the Japanese confess Midway — the most elegant fishing expedition in codebreaking history.';
  d.zh['stp.friedman.fact'] = '冷知识：弗里德曼最初学的是遗传学，把统计思维带进密码分析；他一生破译过 8,000 多份密电，还参与起草了美国密码政策基石。';
  d.en['stp.friedman.fact'] = 'Fun fact: Friedman trained in genetics and brought statistics to cryptanalysis; he broke over 8,000 messages and helped draft US signals policy.';
  d.zh['stp.flowers.fact'] = '冷知识：弗劳尔斯坚持用电子管是因为电话交换机的经验——别人担心不可靠，他知道可以；Colossus 战后被拆毁，秘密守到 1970 年代。';
  d.en['stp.flowers.fact'] = 'Fun fact: Flowers trusted valves from telephone exchanges; Colossus was dismantled after the war and the secret held until the 1970s.';
  d.zh['stp.shannon.fact'] = '冷知识：香农的硕士论文就用继电器搭出逻辑电路——那篇论文被称作「数字电路设计的第一课」；他还设计过会走迷宫的机械老鼠。';
  d.en['stp.shannon.fact'] = 'Fun fact: Shannon\'s master\'s thesis built logic circuits from relays — called the first lesson in digital design; he also built a maze-solving mouse.';
  d.zh['stp.rosenberg.fact'] = '冷知识：罗森伯格案至今争议未息——支持者认为量刑过重，反对者坚称罪证确凿；VENONA 破译材料直到 1995 年才解密公开。';
  d.en['stp.rosenberg.fact'] = 'Fun fact: The Rosenberg case still divides opinion; the VENONA decrypts cited at trial were only declassified in 1995.';
  d.zh['people.chaptersOf'] = '出没章节';
  d.en['people.chaptersOf'] = 'Chapters';
})();


/* ============================================================
   摘要字典（全站共享，S3 下沉自 i18n-story.js）
   时代 / 章节标题与一句话 / 人物全字段 / 密件全字段
   首页、游戏厅、游戏页均加载本文件；正文（章节/传记长文）仍在 i18n-story.js
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
      d.zh['era0'] = '公元前 196 · 埃及'; d.en['era0'] = '196 BC · Egypt';
      d.zh['era1'] = '公元前 1 世纪 · 罗马'; d.en['era1'] = '1st c. BC · Rome';
      d.zh['era2'] = '9 世纪 · 巴格达'; d.en['era2'] = '9th c. · Baghdad';
      d.zh['era3'] = '17 世纪 · 英国'; d.en['era3'] = '17th c. · England';
      d.zh['era4'] = '1914-1918 · 欧洲'; d.en['era4'] = '1914-1918 · Europe';
      d.zh['era5'] = '1939-1945 · 英国'; d.en['era5'] = '1939-1945 · England';
      d.zh['era6'] = '1942 · 太平洋'; d.en['era6'] = '1942 · Pacific';
      d.zh['era7'] = '1941 · 美日'; d.en['era7'] = '1941 · US-Japan';
      d.zh['era8'] = '1943-1945 · 英国'; d.en['era8'] = '1943-1945 · England';
      d.zh['era9'] = '1943-1980 · 美苏'; d.en['era9'] = '1943-1980 · US-USSR';
      d.zh['era10'] = '现代 · 全球'; d.en['era10'] = 'Modern · Global';
      /* 章节元数据（正文 bodyKey / 密信 / 游戏关联文案由内容批产出，此处放占位标题与一句话） */
      var zhTitles = ['破译的黎明', '凯撒的密令', '阿拉伯的破译者', '培根的隐形墨水', '一战的电波战', '布莱切利园的机器', '中途岛之雾', '紫密与珍珠港', '洛伦兹与第一台计算机', 'VENONA 与冷战间谍', '数学家的反击'];
      var enTitles = ['The Dawn of Decoding', 'Caesar\'s Secret Orders', 'The Arab Codebreaker', 'Bacon\'s Invisible Ink', 'The Radio War of WWI', 'The Machines of Bletchley Park', 'Fog at Midway', 'Purple and Pearl Harbor', 'Lorenz and the First Computer', 'VENONA and the Cold War Spies', 'The Mathematicians Strike Back'];
      var zhOne = ['罗塞塔石碑与「破译」一词的诞生', '高卢战争中的移位密码', '肯迪与频率分析的诞生', '双字体隐写与维吉尼亚', '齐默尔曼电报与电波战', '图灵与 Bombe 如何预知战役', '一个淡水谎言换来太平洋转折点', '假想机逆向紫密', 'Colossus：破译催生计算机', '密钥复用灾难与冷战谍战', '从香农到 HTTPS：密码即数学'];
      var enOne = ['The Rosetta Stone and the birth of "decoding"', 'Shift ciphers in the Gallic Wars', 'Al-Kindi and the birth of frequency analysis', 'Two-font steganography and Vigenère', 'The Zimmermann Telegram and the radio war', 'Turing, the Bombe and Ultra', 'A lie about fresh water turns the Pacific war', 'Reverse-engineering Purple without the machine', 'Colossus: decoding gives birth to the computer', 'Key reuse disaster and Cold War espionage', 'From Shannon to HTTPS: cipher is mathematics'];
      for (var i = 0; i < 11; i++) {
        d.zh['st.c' + i + '.t'] = zhTitles[i];
        d.en['st.c' + i + '.t'] = enTitles[i];
        d.zh['st.c' + i + '.t.one'] = zhOne[i];
        d.en['st.c' + i + '.t.one'] = enOne[i];
      }
      /* 人物（占位；生平/金句由内容批产出） */
      /* 人物（占位；生平/金句由内容批产出）——直接写入，不再经由间接映射 */
      var PLACEHOLDER_PEOPLE = ['champollion', 'caesar', 'kindi', 'bacon', 'vigenere', 'payne', 'turing', 'welchman', 'friedman', 'flowers', 'shannon', 'rosenberg'];
      d.zh['stp.champollion.name'] = '商博良'; d.en['stp.champollion.name'] = 'Champollion';
      d.zh['stp.champollion.icon'] = '🧱'; d.en['stp.champollion.icon'] = '🧱';
      d.zh['stp.caesar.name'] = '凯撒'; d.en['stp.caesar.name'] = 'Caesar';
      d.zh['stp.caesar.icon'] = '🏛️'; d.en['stp.caesar.icon'] = '🏛️';
      d.zh['stp.kindi.name'] = '肯迪'; d.en['stp.kindi.name'] = 'Al-Kindi';
      d.zh['stp.kindi.icon'] = '🌙'; d.en['stp.kindi.icon'] = '🌙';
      d.zh['stp.bacon.name'] = '培根'; d.en['stp.bacon.name'] = 'Bacon';
      d.zh['stp.bacon.icon'] = '🖋️'; d.en['stp.bacon.icon'] = '🖋️';
      d.zh['stp.vigenere.name'] = '维吉尼亚'; d.en['stp.vigenere.name'] = 'Vigenère';
      d.zh['stp.vigenere.icon'] = '🔑'; d.en['stp.vigenere.icon'] = '🔑';
      d.zh['stp.payne.name'] = '乔治·佩恩万'; d.en['stp.payne.name'] = 'Georges Painvin';
      d.zh['stp.payne.icon'] = '🪖'; d.en['stp.payne.icon'] = '🪖';
      d.zh['stp.turing.name'] = '图灵'; d.en['stp.turing.name'] = 'Turing';
      d.zh['stp.turing.icon'] = '⚙️'; d.en['stp.turing.icon'] = '⚙️';
      d.zh['stp.welchman.name'] = '韦尔奇曼'; d.en['stp.welchman.name'] = 'Welchman';
      d.zh['stp.welchman.icon'] = '🧩'; d.en['stp.welchman.icon'] = '🧩';
      d.zh['stp.friedman.name'] = '弗里德曼'; d.en['stp.friedman.name'] = 'Friedman';
      d.zh['stp.friedman.icon'] = '🈁'; d.en['stp.friedman.icon'] = '🈁';
      d.zh['stp.flowers.name'] = '弗劳尔斯'; d.en['stp.flowers.name'] = 'Flowers';
      d.zh['stp.flowers.icon'] = '💡'; d.en['stp.flowers.icon'] = '💡';
      d.zh['stp.shannon.name'] = '香农'; d.en['stp.shannon.name'] = 'Shannon';
      d.zh['stp.shannon.icon'] = '📐'; d.en['stp.shannon.icon'] = '📐';
      d.zh['stp.rosenberg.name'] = '罗森伯格夫妇'; d.en['stp.rosenberg.name'] = 'The Rosenbergs';
      d.zh['stp.rosenberg.icon'] = '🕊️'; d.en['stp.rosenberg.icon'] = '🕊️';
      for (var pi = 0; pi < PLACEHOLDER_PEOPLE.length; pi++) {
        var pp = PLACEHOLDER_PEOPLE[pi];
        d.zh['stp.' + pp + '.role'] = '（档案完善中）';
        d.en['stp.' + pp + '.role'] = '(profile coming soon)';
        d.zh['stp.' + pp + '.era'] = '—';
        d.en['stp.' + pp + '.era'] = '—';
        d.zh['stp.' + pp + '.bio'] = '—';
        d.en['stp.' + pp + '.bio'] = '—';
        d.zh['stp.' + pp + '.quote'] = '—';
        d.en['stp.' + pp + '.quote'] = '—';
      }
/* 密件（占位；描述/原文由内容批产出） */
      var zhA = { rosetta: ['罗塞塔石碑', '📜'], 'caesar-report': ['凯撒战报', '⚔️'], kindi: ['肯迪手稿页', '🌙'], 'bacon-book': ['培根书页', '📖'], zimmermann: ['齐默尔曼电报', '📡'], ultra: ['Ultra 战报', '🕵️'], af: ['AF 电文', '🌊'], eastwind: ['东风雨电报', '⛈️'], colossus: ['Colossus 照片卡', '💾'], venona: ['VENONA 片段', '🕸️'], shannon: ['香农论文页', '📐'] };
      var enA = { rosetta: ['The Rosetta Stone', '📜'], 'caesar-report': ['Caesar\'s Dispatch', '⚔️'], kindi: ['Al-Kindi\'s Manuscript', '🌙'], 'bacon-book': ['Bacon\'s Page', '📖'], zimmermann: ['The Zimmermann Telegram', '📡'], ultra: ['Ultra Briefing', '🕵️'], af: ['The AF Telegram', '🌊'], eastwind: ['The East Wind Broadcast', '⛈️'], colossus: ['Colossus Photo Card', '💾'], venona: ['VENONA Fragment', '🕸️'], shannon: ['Shannon\'s Paper', '📐'] };
      var zhAE = ['公元前 196', '公元前 1 世纪', '9 世纪', '17 世纪', '1917', '1940-45', '1942', '1941', '1943-45', '1943-80', '1948'];
      var enAE = ['196 BC', '1st c. BC', '9th c.', '17th c.', '1917', '1940-45', '1942', '1941', '1943-45', '1943-80', '1948'];
      var ai = 0;
      for (var aid in zhA) {
        d.zh['sta.' + aid + '.name'] = zhA[aid][0];
        d.en['sta.' + aid + '.name'] = enA[aid][0];
        d.zh['sta.' + aid + '.era'] = zhAE[ai];
        d.en['sta.' + aid + '.era'] = enAE[ai];
        d.zh['sta.' + aid + '.desc'] = '（描述完善中）';
        d.en['sta.' + aid + '.desc'] = '(description coming soon)';
        d.zh['sta.' + aid + '.text'] = '—';
        d.en['sta.' + aid + '.text'] = '—';
        ai++;
      }
      d.zh['stp.champollion.role'] = '法国语言学家 · 破译古埃及象形文字';
      d.en['stp.champollion.role'] = 'French linguist · deciphered Egyptian hieroglyphs';
      d.zh['stp.champollion.era'] = '1790–1832 · 法国';
      d.en['stp.champollion.era'] = '1790–1832 · France';
      d.zh['stp.caesar.role'] = '罗马统帅 · 政治家与军事家';
      d.en['stp.caesar.role'] = 'Roman commander · statesman and general';
      d.zh['stp.caesar.era'] = '公元前 100–前 44 · 罗马';
      d.en['stp.caesar.era'] = '100–44 BC · Rome';
      d.zh['stp.kindi.role'] = '阿拉伯哲学家 · 数学家 · 密码分析之父';
      d.en['stp.kindi.role'] = 'Arab philosopher · mathematician · father of cryptanalysis';
      d.zh['stp.kindi.era'] = '约 801–873 · 巴格达';
      d.en['stp.kindi.era'] = 'c. 801–873 · Baghdad';
      d.zh['sta.rosetta.desc'] = '罗塞塔石碑，1799 年出土于埃及，同文三写：象形文、世俗体、希腊文，是破译古埃及文字的钥匙。';
      d.en['sta.rosetta.desc'] = 'The Rosetta Stone, found at Rosetta, Egypt in 1799 — one decree carved in hieroglyphs, demotic and Greek; the key to ancient Egypt.';
      d.zh['sta.caesar-report.desc'] = '凯撒战报——高卢战争期间以移位密码写就的军令，机密内容字母移位成文，防止信使被截泄密。';
      d.en['sta.caesar-report.desc'] = 'Caesar\'s Dispatch — a Gallic War order written in a shifted alphabet, so that a captured courier could not betray the plan.';
      d.zh['sta.kindi.desc'] = '肯迪《解译加密信息手稿》残页，约 850 年写于巴格达智慧宫，首倡频率分析，是密码分析学的起点。';
      d.en['sta.kindi.desc'] = 'A page of Al-Kindi\'s Manuscript on Deciphering Cryptographic Messages (c. 850, Baghdad) — the first frequency analysis, the birth of cryptanalysis.';
      d.zh['stp.bacon.role'] = '英格兰大法官 · 哲学与科学方法之父';
      d.en['stp.bacon.role'] = 'Lord Chancellor · father of the scientific method';
      d.zh['stp.bacon.era'] = '1561–1626 · 英国';
      d.en['stp.bacon.era'] = '1561–1626 · England';
                  d.zh['stp.vigenere.era'] = '1523–1596 · 法国';
      d.en['stp.vigenere.era'] = '1523–1596 · France';
      d.zh['stp.payne.role'] = '法军上尉 · 破解 ADFGVX 的密码分析师';
      d.en['stp.payne.role'] = 'French Army captain · the codebreaker who broke ADFGVX';
      d.zh['stp.payne.era'] = '1886–1980 · 法国';
      d.en['stp.payne.era'] = '1886–1980 · France';
      d.zh['stp.turing.role'] = '数学家 · Bombe 设计者 · 计算机科学之父';
      d.en['stp.turing.role'] = 'Mathematician · Bombe designer · father of computer science';
      d.zh['stp.turing.era'] = '1912–1954 · 英国';
      d.en['stp.turing.era'] = '1912–1954 · England';
      d.zh['stp.welchman.role'] = '数学家 · 对角线板的发明者';
      d.en['stp.welchman.role'] = 'Mathematician · inventor of the diagonal board';
      d.zh['stp.welchman.era'] = '1906–1985 · 英国';
      d.en['stp.welchman.era'] = '1906–1985 · England';
      d.zh['sta.bacon-book.desc'] = '培根《学术的进展》第 6 卷的一页：表面是一段谈论科学方法的散文，实际上每个字母的字形里都藏着第二封信——两种字体，两个故事。';
      d.en['sta.bacon-book.desc'] = 'A page from Book VI of Bacon\'s De Augmentis Scientiarum: outwardly an essay on scientific method, secretly a second letter hidden in the very shape of the letters — two fonts, two stories.';
      d.zh['sta.zimmermann.desc'] = '齐默尔曼电报：1917 年 1 月德国外长密令墨西哥进攻美国的电文。伦敦海军部 40 号房破译它之后，美国加入了第一次世界大战。';
      d.en['sta.zimmermann.desc'] = 'The Zimmermann Telegram: January 1917, the German Foreign Secretary secretly urging Mexico to attack America. After Room 40 in London decrypted it, the United States entered the First World War.';
      d.zh['sta.ultra.desc'] = '布莱切利园 Ultra 战报：标记「TOP SECRET ULTRA」的情报摘要，全部源于对德军 Enigma 密电的实时破译。';
      d.en['sta.ultra.desc'] = 'An Ultra briefing from Bletchley Park: an intelligence summary marked TOP SECRET ULTRA, born from the live decryption of German Enigma traffic.';
      d.zh['stp.rosenberg.role'] = '朱利叶斯与埃塞尔·罗森伯格，冷战间谍案核心夫妇';
      d.en['stp.rosenberg.role'] = 'Julius and Ethel Rosenberg — the couple at the heart of the Cold War spy trial';
      d.zh['stp.rosenberg.era'] = '案件 1950-1953 · 美国';
      d.en['stp.rosenberg.era'] = 'Case 1950-1953 · United States';
      d.zh['stp.shannon.role'] = '克劳德·香农，信息论之父';
      d.en['stp.shannon.role'] = 'Claude Shannon — father of information theory';
      d.zh['stp.shannon.era'] = '1916-2001 · 美国';
      d.en['stp.shannon.era'] = '1916-2001 · United States';
      d.zh['sta.venona.desc'] = '1943 年起，美国陆军信号情报机构截获苏联驻美机构的外交电报，代号 VENONA。破译员利用一次性密码本被违规复用的致命失误，持续解密近四十年，撕开了剑桥五杰与罗森伯格夫妇等冷战间谍网。以下为破译电文的史料化节选（代号为原档所载）。';
      d.en['sta.venona.desc'] = 'From 1943 the U.S. Army\'s Signal Intelligence Service intercepted Soviet diplomatic cables under the code name VENONA. Exploiting the fatal reuse of one-time pads, codebreakers decrypted the traffic for nearly forty years, exposing the Cambridge Five, the Rosenbergs and more. Below is a historical excerpt from the decrypts (code names as in the original files).';
      d.zh['sta.shannon.desc'] = '1948 年，香农在《贝尔系统技术杂志》发表《通信的数学理论》，奠定信息论与密码学数学化的基石。以下为该论文开篇的节选。';
      d.en['sta.shannon.desc'] = 'In 1948 Shannon published "A Mathematical Theory of Communication" in the Bell System Technical Journal, laying the mathematical foundation of information theory and modern cryptography. Below is the paper\'s opening, excerpted.';
      d.zh['stp.rochefort.name'] = '罗奇福特';
      d.en['stp.rochefort.name'] = 'Rochefort';
      d.zh['stp.rochefort.icon'] = '⚓';
      d.en['stp.rochefort.icon'] = '⚓';
      d.zh['stp.rochefort.role'] = '美国海军密码破译专家 · 珍珠港 HYPO 站站长';
      d.en['stp.rochefort.role'] = 'US Navy cryptanalyst · Chief, Station HYPO, Pearl Harbor';
      d.zh['stp.rochefort.era'] = '1900-1976 · 美国';
      d.en['stp.rochefort.era'] = '1900-1976 · USA';
      d.zh['stp.friedman.role'] = '美国陆军信号情报处（SIS）密码学家 · 破解 Purple 的团队领袖';
      d.en['stp.friedman.role'] = 'US Army SIS cryptanalyst · Leader of the Purple break';
      d.zh['stp.friedman.era'] = '1891-1969 · 美国';
      d.en['stp.friedman.era'] = '1891-1969 · USA';
      d.zh['stp.flowers.role'] = '英国邮局研究站（Dollis Hill）工程师 · Colossus 设计师';
      d.en['stp.flowers.role'] = 'GPO research engineer (Dollis Hill) · Designer of Colossus';
      d.zh['stp.flowers.era'] = '1905-1998 · 英国';
      d.en['stp.flowers.era'] = '1905-1998 · UK';
      d.zh['sta.af.desc'] = '1942 年 5 月，为确认代号「AF」的真实身份，中途岛按罗奇福特的计划发出一封假电报，谎称岛上淡水蒸馏设备故障。两天后，日军密电中出现「AF 淡水短缺」字样——AF 即中途岛，就此实锤。这是密码破译史上最优雅的一次「钓鱼」。';
      d.en['sta.af.desc'] = 'In May 1942, to confirm what the codename "AF" really was, Midway sent a fake telegram claiming its fresh-water distillation plant had broken down, per Rochefort\'s plan. Two days later a Japanese cipher message mentioned "AF is short of fresh water" — proof that AF was Midway. It remains one of the most elegant fishing expeditions in the history of codebreaking.';
      d.zh['sta.eastwind.desc'] = '日本外务省预定的开战暗号广播：若与美国开战，将播出「东风，有雨」（Higashi no kaze ame）。1941 年 12 月初，美军已破译紫密、截获外务省致华盛顿使馆的十四段电报——开战信号其实早已握在破译员手中，却在官僚链条里被延误与误判。';
      d.en['sta.eastwind.desc'] = 'The planned Japanese "war signal" broadcast: should war with the United States begin, the weather code "East wind, rain" (Higashi no kaze ame) would be announced. In early December 1941 the US had already broken Purple and intercepted the Foreign Ministry\'s fourteen-part message to its Washington embassy — the signal was already in the codebreakers\' hands, yet it was delayed and misjudged along the chain of command.';
      d.zh['sta.colossus.desc'] = 'Colossus 是世界第一台可编程电子计算机，由汤米·弗劳尔斯设计，1943 年底完成，服役于布莱切利园的「纽曼里」。它用一千五百余只电子管，以每秒五千字符的速度对 Tunny 密文做差分统计，在诺曼底登陆前把德军最高层的命令送上英军破译员的桌子。战后机器被拆毁，秘密守到 1970 年代才解密。';
      d.en['sta.colossus.desc'] = 'Colossus — the world\'s first programmable electronic computer — was designed by Tommy Flowers and completed in late 1943, serving in the Newmanry at Bletchley Park. With more than 1,500 thermionic valves it ran delta statistics on Tunny traffic at 5,000 characters per second, putting the Wehrmacht\'s highest-level orders on the codebreakers\' desks before D-Day. After the war the machines were dismantled; the secret held until the 1970s.';
})();

/* ============================================================
   传奇密件扩充（D3）：5 件未解之谜/著名争议
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['sta.voynich.name'] = '伏尼契手稿';
  d.en['sta.voynich.name'] = 'Voynich Manuscript';
  d.zh['sta.voynich.era'] = '约 15 世纪初 · 中欧';
  d.en['sta.voynich.era'] = 'c. early 15th c. · Central Europe';
  d.zh['sta.voynich.desc'] = '一部约 240 页的中世纪手稿，以无人能识的未知文字写就，满布奇异的天文、植物与沐浴插图，碳定年约属十五世纪初，五百余年无人能解，堪称密码史上最著名的未解之书。';
  d.en['sta.voynich.desc'] = 'A ~240-page medieval manuscript written in an unknown, undeciphered script, filled with strange astronomical, botanical and bathing illustrations; carbon-dated to the early 15th century, it has defied every attempt at decryption for over 500 years.';
  d.zh['sta.beale.name'] = '比尔密码';
  d.en['sta.beale.name'] = 'The Beale Papers';
  d.zh['sta.beale.era'] = '19 世纪 20 年代 · 美国弗吉尼亚';
  d.en['sta.beale.era'] = '1820s · Virginia, USA';
  d.zh['sta.beale.desc'] = '1820 年代弗吉尼亚的藏宝传奇：三份密文声称记录一批巨额金银珠宝的埋藏位置，百余年过去仅第二份被破译，其余两份与宝藏下落至今成谜，真实性亦备受争议。';
  d.en['sta.beale.desc'] = 'A Virginia treasure legend: three cipher texts supposedly reveal the hiding place of a vast hoard of gold and silver. After over a century only the second cipher has been solved; the other two, and the treasure, remain lost — and the story\'s authenticity is fiercely disputed.';
  d.zh['sta.kryptos.name'] = '克里普托斯';
  d.en['sta.kryptos.name'] = 'Kryptos';
  d.zh['sta.kryptos.era'] = '1990 年 · 美国弗吉尼亚（CIA 总部）';
  d.en['sta.kryptos.era'] = '1990 · Virginia, USA (CIA HQ)';
  d.zh['sta.kryptos.desc'] = '矗立于 CIA 总部广场的铜制雕塑，镌刻 865 个字符的加密铭文，四段密文中三段已被破解，第四段至今无人解出，答案只存在于创作者脑中。';
  d.en['sta.kryptos.desc'] = 'A copper sculpture in the plaza of CIA headquarters, bearing 865 characters of encrypted text in four sections. Three have been cracked; the fourth — K4 — remains unsolved, its answer known only to the artist.';
  d.zh['sta.maryqueen.name'] = '苏格兰玛丽女王密信';
  d.en['sta.maryqueen.name'] = 'Mary Queen of Scots\' Cipher Letters';
  d.zh['sta.maryqueen.era'] = '1586 年 · 英格兰';
  d.en['sta.maryqueen.era'] = '1586 · England';
  d.zh['sta.maryqueen.desc'] = '苏格兰女王玛丽在囚禁中与同谋以替换密码通信，密谋刺杀伊丽莎白一世；英国间谍头目沃尔辛厄姆截获并破译全部密信，成为将她送上断头台的关键证据。';
  d.en['sta.maryqueen.desc'] = 'Imprisoned Mary, Queen of Scots, plotted to assassinate Elizabeth I in substitution-cipher letters smuggled to her co-conspirators; spymaster Sir Francis Walsingham intercepted and deciphered them, sealing her fate at the block.';
  d.zh['sta.baconcase.name'] = '培根-莎士比亚密信案';
  d.en['sta.baconcase.name'] = 'The Bacon-Shakespeare Cipher Controversy';
  d.zh['sta.baconcase.era'] = '19 世纪以来 · 英国';
  d.en['sta.baconcase.era'] = 'Since the 19th c. · England';
  d.zh['sta.baconcase.desc'] = '百余年来的争议谜案：有人坚称莎士比亚剧作中暗藏弗朗西斯·培根的签名密码，以「Honorificabilitudinitatibus」一词可重组出培根之名，学界普遍视其为伪密码学。';
  d.en['sta.baconcase.desc'] = 'A century-old controversy: believers insist hidden ciphers in Shakespeare\'s plays reveal Francis Bacon as the true author — pointing to words like "Honorificabilitudinitatibus" rearranged to spell Bacon\'s name — while scholars dismiss it all as pseudocryptography.';
})();

/* 人物图标补全（D2 补充） */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.vernam.icon'] = '🎞️';
  d.en['stp.vernam.icon'] = '🎞️';
  d.zh['stp.kasiski.icon'] = '🔍';
  d.en['stp.kasiski.icon'] = '🔍';
  d.zh['stp.rejewski.icon'] = '🧮';
  d.en['stp.rejewski.icon'] = '🧮';
  d.zh['stp.diffie.icon'] = '🔑';
  d.en['stp.diffie.icon'] = '🔑';
  d.zh['stp.shamir.icon'] = '🔏';
  d.en['stp.shamir.icon'] = '🔏';
  d.zh['stp.adleman.icon'] = '🧬';
  d.en['stp.adleman.icon'] = '🧬';
  d.zh['stp.driscoll.icon'] = '⚓';
  d.en['stp.driscoll.icon'] = '⚓';
  d.zh['stp.trithemius.icon'] = '📖';
  d.en['stp.trithemius.icon'] = '📖';
})();

/* ============================================================
   人物扩充（D2）：8 位密码史人物
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.vernam.name'] = '吉尔伯特·弗纳姆';
  d.en['stp.vernam.name'] = 'Gilbert Vernam';
      d.zh['stp.vernam.role'] = '一次性密码本（OTP）的发明者';
  d.en['stp.vernam.role'] = 'Inventor of the one-time pad (OTP)';
  d.zh['stp.vernam.era'] = '1890–1960 · 美国';
  d.en['stp.vernam.era'] = '1890–1960 · USA';
  d.zh['stp.vernam.fact'] = '弗纳姆的专利 1919 年才获批，但真正让一次性密码本扬名的是冷战间谍案：苏联克格勃因重复复制密钥本，「维诺娜计划」得以破译部分密文——密钥只要复用一次，完美保密便不复存在。';
  d.en['stp.vernam.fact'] = 'Vernam\'s patent was granted in 1919, but the OTP became famous during the Cold War: Soviet spies reused duplicated key books, which is exactly what let the U.S. VENONA project crack part of their traffic.';
  d.zh['stp.kasiski.name'] = '弗里德里希·卡西斯基';
  d.en['stp.kasiski.name'] = 'Friedrich Kasiski';
      d.zh['stp.kasiski.role'] = '维吉尼亚密码的系统破译者';
  d.en['stp.kasiski.role'] = 'Systematic breaker of the Vigenère cipher';
  d.zh['stp.kasiski.era'] = '1805–1881 · 普鲁士';
  d.en['stp.kasiski.era'] = '1805–1881 · Prussia';
  d.zh['stp.kasiski.fact'] = '卡西斯基检验法背后藏着一桩著名「错案」：英国人查尔斯·巴贝奇早在 1854 年就破译了维吉尼亚密码，却因保密要求从未公开，功劳最终记在了晚九年发表的卡西斯基头上。';
  d.en['stp.kasiski.fact'] = 'Behind the Kasiski examination lies one of cryptology\'s great ironies: Charles Babbage broke the Vigenère in 1854 but was sworn to secrecy, so the credit went to Kasiski, who published nine years later.';
  d.zh['stp.rejewski.name'] = '马里安·雷耶夫斯基';
  d.en['stp.rejewski.name'] = 'Marian Rejewski';
      d.zh['stp.rejewski.role'] = 'Enigma 的首位破译者';
  d.en['stp.rejewski.role'] = 'First breaker of the Enigma machine';
  d.zh['stp.rejewski.era'] = '1905–1980 · 波兰';
  d.en['stp.rejewski.era'] = '1905–1980 · Poland';
  d.zh['stp.rejewski.fact'] = '战后雷耶夫斯基在波兰从事会计工作，身份长期保密；直到 1970 年代军方史学家公布档案，世界才得知 Enigma 的首位破译者并非图灵，而是这位隐居多年的数学家。';
  d.en['stp.rejewski.fact'] = 'After the war Rejewski worked as a bookkeeper, his role secret for decades; only in the 1970s did the archives reveal he, not Turing, first broke Enigma.';
  d.zh['stp.diffie.name'] = '惠特菲尔德·迪菲';
  d.en['stp.diffie.name'] = 'Whitfield Diffie';
      d.zh['stp.diffie.role'] = '公钥密码学之父';
  d.en['stp.diffie.role'] = 'Father of public-key cryptography';
  d.zh['stp.diffie.era'] = '1944– · 美国';
  d.en['stp.diffie.era'] = '1944– · USA';
  d.zh['stp.diffie.fact'] = 'Diffie-Hellman 的专利 1977 年获批、20 年后到期；专利到期后学界才发现，英国 GCHQ 的詹姆斯·埃利斯早在 1969 年就秘密发明了同样思想，却因保密从未发表。';
  d.en['stp.diffie.fact'] = 'Only after the Diffie-Hellman patent expired did the world learn that GCHQ\'s James Ellis had secretly invented the same idea in 1969 but never published it.';
  d.zh['stp.shamir.name'] = '阿迪·萨莫尔';
  d.en['stp.shamir.name'] = 'Adi Shamir';
      d.zh['stp.shamir.role'] = 'RSA 算法共同发明人';
  d.en['stp.shamir.role'] = 'Co-inventor of RSA';
  d.zh['stp.shamir.era'] = '1952– · 以色列';
  d.en['stp.shamir.era'] = '1952– · Israel';
  d.zh['stp.shamir.fact'] = 'RSA 三个字母并非算法含义，而是三位发明人姓氏首字母 R、S、A（Rivest、Shamir、Adleman），却成了密码学史上最著名的命名轶事。';
  d.en['stp.shamir.fact'] = 'RSA is not an acronym for anything technical — the letters are simply the initials of Rivest, Shamir and Adleman: R, S, A.';
  d.zh['stp.adleman.name'] = '伦纳德·阿德曼';
  d.en['stp.adleman.name'] = 'Leonard Adleman';
      d.zh['stp.adleman.role'] = 'RSA 三巨头之一 · DNA 计算之父';
  d.en['stp.adleman.role'] = 'One of the RSA trio · Father of DNA computing';
  d.zh['stp.adleman.era'] = '1945– · 美国';
  d.en['stp.adleman.era'] = '1945– · USA';
  d.zh['stp.adleman.fact'] = '阿德曼的 DNA 计算首个实验解决的是「哈密顿路径问题」：他用一试管 DNA 分子，通过生化反应「算」出了 7 个节点的小规模问题——计算不是在芯片上，而是在试管里完成的。';
  d.en['stp.adleman.fact'] = 'Adleman\'s first DNA-computing experiment solved a Hamiltonian path problem in a test tube of DNA — the computation happened in a test tube, not on a chip.';
  d.zh['stp.driscoll.name'] = '艾格尼丝·德里斯科尔';
  d.en['stp.driscoll.name'] = 'Agnes Driscoll';
      d.zh['stp.driscoll.role'] = '美国第一位海军密码学家';
  d.en['stp.driscoll.role'] = 'America\'s first naval cryptologist';
  d.zh['stp.driscoll.era'] = '1889–1971 · 美国';
  d.en['stp.driscoll.era'] = '1889–1971 · USA';
  d.zh['stp.driscoll.fact'] = '德里斯科尔 1949 年被调离核心岗位，功劳与档案长期被封存；直到近年历史学者整理解密档案，这位「海军密码学第一夫人」的贡献才逐渐被公众知晓。';
  d.en['stp.driscoll.fact'] = 'Driscoll was pushed off the Navy\'s core codebreaking staff in 1949, and her achievements stayed buried in classified files for decades until historians restored her standing.';
  d.zh['stp.trithemius.name'] = '约翰内斯·特里特米乌斯';
  d.en['stp.trithemius.name'] = 'Johannes Trithemius';
      d.zh['stp.trithemius.role'] = '西方密码学奠基人之一';
  d.en['stp.trithemius.role'] = 'One of the founding fathers of Western cryptography';
  d.zh['stp.trithemius.era'] = '1462–1516 · 神圣罗马帝国';
  d.en['stp.trithemius.era'] = '1462–1516 · Holy Roman Empire';
  d.zh['stp.trithemius.fact'] = '特里特米乌斯还写过一部更神秘的手稿《隐写术》(Steganographia)：表面讲「用天使传信」的魔法，实际暗藏真实的加密方法；因为太过离奇，这本书在他死后两百年里一直被当作巫术著作。';
  d.en['stp.trithemius.fact'] = 'Trithemius also wrote the far stranger manuscript Steganographia, which masqueraded as angelic magic while secretly hiding real encryption methods — dismissed as sorcery for two centuries.';
})();

/* ============================================================
   神秘密件扩充（K3）：9 件未解之谜
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['sta.dorabella.name'] = '多拉贝拉密信';
  d.en['sta.dorabella.name'] = 'Dorabella Cipher';
  d.zh['sta.dorabella.era'] = '1897 年 · 英国伍斯特郡';
  d.en['sta.dorabella.era'] = '1897 · Worcestershire, England';
  d.zh['sta.dorabella.desc'] = '1897 年英国作曲家爱德华·埃尔加写给友人多拉·彭尼的密信，信上不是音符而是 87 个弯曲怪异的自创符号，被后世称为「多拉贝拉密码」；埃尔加本人热衷密码游戏，却始终未留密钥，百余年来破译尝试无数，至今无人能解。';
  d.en['sta.dorabella.desc'] = 'In 1897 the English composer Edward Elgar sent his friend Dora Penny a note written not in music but in 87 strange, curling symbols of his own devising — the "Dorabella Cipher." Elgar loved cipher games yet left no key, and after more than a century of attempts it remains unsolved.';
  d.zh['sta.shugborough.name'] = '舒格伯勒碑文';
  d.en['sta.shugborough.name'] = 'Shugborough Inscription';
  d.zh['sta.shugborough.era'] = '约 1748–1763 年 · 英国斯塔福德郡';
  d.en['sta.shugborough.era'] = 'c. 1748–1763 · Staffordshire, England';
  d.zh['sta.shugborough.desc'] = '英国斯塔福德郡舒格伯勒庄园，一座牧神雕像基座上刻着「OUOSVAVV」八个字母与 D.M. 字样，两百多年无人解出其意；因庄园与圣殿骑士、圣杯传说牵连，这块碑文被《达芬奇密码》式传说笼罩，成为英国最著名的石刻之谜。';
  d.en['sta.shugborough.desc'] = 'On the base of a marble shepherd statue in Staffordshire\'s Shugborough Hall stand eight letters — OUOSVAVV — plus the initials D.M. Unsolved for over two centuries and tied to Templar and Holy Grail legends, they form England\'s most famous stone inscription puzzle.';
  d.zh['sta.zodiac.name'] = '黄道十二宫杀手密码';
  d.en['sta.zodiac.name'] = 'Zodiac Killer Cipher';
  d.zh['sta.zodiac.era'] = '1968–1974 年 · 美国加州旧金山湾区';
  d.en['sta.zodiac.era'] = '1968–1974 · San Francisco Bay Area, USA';
  d.zh['sta.zodiac.desc'] = '1960-70 年代活跃于美国加州的连环杀手，自称「黄道十二宫」，向报社寄出多封加密信件自夸罪行；其中 408 密文被高中生夫妇破译，而更复杂的 340 密文直到 2020 年才由民间团队解开，其身份至今成谜。';
  d.en['sta.zodiac.desc'] = 'A serial killer who terrorized the San Francisco Bay Area in the late 1960s and early 1970s, taunting newspapers with encrypted letters under the self-chosen name "Zodiac." The 408-character cipher was solved by a high-school couple; the harder 340 cipher fell only in 2020, to amateur codebreakers. His identity is still unknown.';
  d.zh['sta.tamamshud.name'] = '萨默顿人案';
  d.en['sta.tamamshud.name'] = 'Tamam Shud / Somerton Man';
  d.zh['sta.tamamshud.era'] = '1948 年 · 澳大利亚阿德莱德';
  d.en['sta.tamamshud.era'] = '1948 · Adelaide, Australia';
  d.zh['sta.tamamshud.desc'] = '1948 年澳大利亚萨默顿海滩发现一具无名男尸，衣袋里藏着撕自《鲁拜集》的纸条，上书波斯语「Tamam Shud」（已结束），书中夹页更留有密码；半个多世纪过去，死者身份、死因与密码含义至今成谜，为澳洲最著名的悬案。';
  d.en['sta.tamamshud.desc'] = 'In 1948 a well-dressed man was found dead on Somerton Beach, Adelaide; in his pocket was a scrap torn from a Rubaiyat of Omar Khayyam reading "Tamam Shud" (Persian for "it is ended"), and a copy of the book found later bore a cipher. More than seventy years on, his identity, cause of death and the cipher\'s meaning remain unknown — Australia\'s most celebrated cold case.';
  d.zh['sta.phaistos.name'] = '费斯托斯圆盘';
  d.en['sta.phaistos.name'] = 'Phaistos Disc';
  d.zh['sta.phaistos.era'] = '约公元前 1700 年 · 克里特岛费斯托斯';
  d.en['sta.phaistos.era'] = 'c. 1700 BC · Phaistos, Crete';
  d.zh['sta.phaistos.desc'] = '1908 年在克里特岛费斯托斯王宫出土的黏土圆盘，两面以螺旋排列 45 种印刷式符号，约属公元前 1700 年，为世界上最早「活字印刷」的实物证据之一；其语言、用途与内容至今没有公认解读，是考古学与密码学交织的著名未解之谜。';
  d.en['sta.phaistos.desc'] = 'Unearthed in 1908 at the Minoan palace of Phaistos, Crete, this fired-clay disc bears 45 distinct stamped symbols arranged in spirals on both faces — possibly the world\'s earliest "movable type" — dated to around 1700 BC. No agreed reading of its language, purpose or message has ever been reached.';
  d.zh['sta.lineara.name'] = '线形文字 A';
  d.en['sta.lineara.name'] = 'Linear A';
  d.zh['sta.lineara.era'] = '约公元前 1800–1450 年 · 克里特岛与爱琴海';
  d.en['sta.lineara.era'] = 'c. 1800–1450 BC · Crete & the Aegean';
  d.zh['sta.lineara.desc'] = '米诺斯文明使用的书写系统，刻于泥板、印章与祭器上，约 1400 件遗存；其后续文字线形文字 B 已于 1952 年被破译，证明是希腊语，而线形文字 A 所记录的语言至今无法确定，被称为爱琴海考古最大的未解之谜之一。';
  d.en['sta.lineara.desc'] = 'The script of Minoan civilization, preserved on clay tablets, seals and votive objects in some 1,400 inscriptions. Its successor, Linear B, was deciphered in 1952 and proved to be Greek; Linear A\'s underlying language remains unidentified — one of the great open questions of Aegean archaeology.';
  d.zh['sta.rongorongo.name'] = '朗格朗格';
  d.en['sta.rongorongo.name'] = 'Rongorongo';
  d.zh['sta.rongorongo.era'] = '约 18–19 世纪 · 复活节岛（拉帕努伊）';
  d.en['sta.rongorongo.era'] = 'c. 18th–19th c. · Easter Island (Rapa Nui)';
  d.zh['sta.rongorongo.desc'] = '复活节岛上的刻字木板，以「诵唱」之意得名，岛民称其为会说话的木头；现存约 25 件残片，符号呈人鸟兽等象形与几何形，可能是波利尼西亚唯一的本土文字，1860 年代岛民识读传统中断后至今无人能解。';
  d.en['sta.rongorongo.desc'] = 'Rongorongo — "the chants" — are inscribed wooden tablets from Easter Island, which the islanders called "talking wood." About 25 fragments survive, their glyphs pictographic and geometric forms of humans, birds and other motifs. Possibly the only indigenous script of Polynesia, it lost its last readers in the 1860s and remains undeciphered.';
  d.zh['sta.chaocipher.name'] = '混沌密码';
  d.en['sta.chaocipher.name'] = 'Chaocipher';
  d.zh['sta.chaocipher.era'] = '1918 年发明 · 美国波士顿';
  d.en['sta.chaocipher.era'] = 'Invented 1918 · Boston, USA';
  d.zh['sta.chaocipher.desc'] = '美国发明家约翰·F·伯恩 1918 年发明的便携密码机，他宣称该密码「不可破译」，1920 年代向军方与国务院推销却被拒；2010 年伯恩家族解密算法后，其原理公开——至今未发现可行的普通破解法，被视为天才的密码孤本。';
  d.en['sta.chaocipher.desc'] = 'A portable cipher machine invented in 1918 by American John F. Byrne — James Joyce\'s close friend — who insisted it was unbreakable. Rejected by the military and State Department in the 1920s, its algorithm stayed secret until Byrne\'s family released it in 2010; no practical shortcut attack is known even now.';
  d.zh['sta.z340.name'] = '黄道杀手 340 密文';
  d.en['sta.z340.name'] = 'Zodiac 340 Cipher';
  d.zh['sta.z340.era'] = '1969 年 11 月 · 美国旧金山';
  d.en['sta.z340.era'] = 'November 1969 · San Francisco, USA';
  d.zh['sta.z340.desc'] = '1969 年 11 月 8 日黄道杀手寄给《旧金山纪事报》的 340 字符密文，51 年间令 FBI 与全球爱好者束手无策；2020 年 12 月，三人民间团队以交叉比对法破译，读出「我希望你们在抓捕我时玩得开心」等语句，成为近年最轰动的民间密码破解。';
  d.en['sta.z340.desc'] = 'The 340-character cipher mailed to the San Francisco Chronicle on November 8, 1969, defied the FBI and hobbyists alike for 51 years. In December 2020 a three-person amateur team cracked it by cross-matching repeated patterns, reading "I hope you are having lots of fun in trying to catch me" — the decade\'s most sensational amateur codebreak.';
})();

/* ============================================================
   人物扩充（K2）：9 位密码史人物
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.babbage.name'] = '查尔斯·巴贝奇';
  d.en['stp.babbage.name'] = 'Charles Babbage';
  d.zh['stp.babbage.icon'] = '⚙️';
  d.en['stp.babbage.icon'] = '⚙️';
  d.zh['stp.babbage.role'] = '差分机与分析机的设计者 · 维吉尼亚密码的「失名英雄」';
  d.en['stp.babbage.role'] = 'Designer of the Analytical Engine · the unsung breaker of the Vigenère';
  d.zh['stp.babbage.era'] = '1791–1871 · 英国';
  d.en['stp.babbage.era'] = '1791–1871 · England';
  d.zh['stp.babbage.fact'] = '冷知识：让巴贝奇出手的是一桩「发明权之争」——牙医思韦茨 1854 年宣称发明了新密码，巴贝奇一眼认出那是维吉尼亚密码并当场破解；这场笔战的手稿，成了他破译功绩的唯一证据。';
  d.en['stp.babbage.fact'] = 'Fun fact: Babbage tackled the Vigenère because of a priority dispute — in 1854 a dentist named J.H.B. Thwaites claimed to have invented a "new cipher." Babbage recognised it as the Vigenère and cracked it on the spot; the manuscripts of that exchange are the only record of his feat.';
  d.zh['stp.kerckhoffs.name'] = '奥古斯特·克尔克霍夫斯';
  d.en['stp.kerckhoffs.name'] = 'Auguste Kerckhoffs';
  d.zh['stp.kerckhoffs.icon'] = '📏';
  d.en['stp.kerckhoffs.icon'] = '📏';
  d.zh['stp.kerckhoffs.role'] = 'Kerckhoffs 原则的提出者 · 现代密码设计的第一准则';
  d.en['stp.kerckhoffs.role'] = 'Author of Kerckhoffs\' principle · the first rule of modern cipher design';
  d.zh['stp.kerckhoffs.era'] = '1835–1903 · 荷兰';
  d.en['stp.kerckhoffs.era'] = '1835–1903 · Netherlands';
  d.zh['stp.kerckhoffs.fact'] = '冷知识：克尔克霍夫斯的本职是语言学家，晚年积极推广人造语言「沃拉普克语」，还担任其官方学院的主持人；密码学只是他的副业，却留下了比主业更不朽的遗产。';
  d.en['stp.kerckhoffs.fact'] = 'Fun fact: Kerckhoffs\' day job was linguistics — he was a leading champion of Volapük, a constructed international language, and directed its academy. Cryptography was a side project, yet it is the side project that made his name immortal.';
  d.zh['stp.bellaso.name'] = '焦万·巴蒂斯塔·贝拉索';
  d.en['stp.bellaso.name'] = 'Giovan Battista Bellaso';
  d.zh['stp.bellaso.icon'] = '🔑';
  d.en['stp.bellaso.icon'] = '🔑';
  d.zh['stp.bellaso.role'] = '多表替换密码的真正发明者 · 维吉尼亚密码的原作者';
  d.en['stp.bellaso.role'] = 'True inventor of polyalphabetic substitution · the man behind the "Vigenère cipher"';
  d.zh['stp.bellaso.era'] = '约 1505–? · 意大利';
  d.en['stp.bellaso.era'] = 'c. 1505–? · Italy';
  d.zh['stp.bellaso.fact'] = '冷知识：贝拉索 1553 年的小册子还首创「互反字母表」——明文表与密文表互为倒序，加密与解密变成同一操作；这一便捷设计被后世众多密码沿用，而贝拉索本人的生卒年月却几乎失考。';
  d.en['stp.bellaso.fact'] = 'Fun fact: Bellaso\'s 1553 booklet also introduced reciprocal alphabets — plaintext and ciphertext alphabets reversed against each other so enciphering and deciphering become the same operation. Yet almost nothing else about his life is known, not even his year of death.';
  d.zh['stp.scherbius.name'] = '阿图尔·谢尔比乌斯';
  d.en['stp.scherbius.name'] = 'Arthur Scherbius';
  d.zh['stp.scherbius.icon'] = '🗝️';
  d.en['stp.scherbius.icon'] = '🗝️';
  d.zh['stp.scherbius.role'] = 'Enigma 转子密码机的发明者';
  d.en['stp.scherbius.role'] = 'Inventor of the Enigma rotor cipher machine';
  d.zh['stp.scherbius.era'] = '1878–1929 · 德国';
  d.en['stp.scherbius.era'] = '1878–1929 · Germany';
  d.zh['stp.scherbius.fact'] = '冷知识：谢尔比乌斯的 Enigma 起初是卖给银行的商业产品，广告称其「保密性无可匹敌」；德军列装后，波兰密码局很快盯上了它——而发明人本人 1929 年就死于一场马车事故，年仅 50 岁。';
  d.en['stp.scherbius.fact'] = 'Fun fact: Enigma was first marketed to banks as a commercial product with ads boasting "unrivalled secrecy." The German military adopted it in 1926; Polish cryptanalysts were studying it within years — while Scherbius himself died in a carriage accident in 1929 at fifty.';
  d.zh['stp.merkle.name'] = '拉尔夫·默克尔';
  d.en['stp.merkle.name'] = 'Ralph Merkle';
  d.zh['stp.merkle.icon'] = '🌳';
  d.en['stp.merkle.icon'] = '🌳';
  d.zh['stp.merkle.role'] = '公钥密码的先驱 · Merkle 树发明人';
  d.en['stp.merkle.role'] = 'Pioneer of public-key cryptography · inventor of the Merkle tree';
  d.zh['stp.merkle.era'] = '1952– · 美国';
  d.en['stp.merkle.era'] = '1952– · USA';
  d.zh['stp.merkle.fact'] = '冷知识：默克尔的「谜题」论文 1975 年曾被《美国计算机学会通讯》以「想法太过超前」退稿，直到 1978 年才发表——此时迪菲-赫尔曼的论文早已问世，公钥密码的功劳簿上，他只能与别人并列署名。';
  d.en['stp.merkle.fact'] = 'Fun fact: Merkle\'s puzzles paper was rejected by the Communications of the ACM in 1975 as "too far out" and only appeared in 1978 — by then Diffie–Hellman had already been published, so his place in history became a shared one.';
  d.zh['stp.cocks.name'] = '克利福德·科克斯';
  d.en['stp.cocks.name'] = 'Clifford Cocks';
  d.zh['stp.cocks.icon'] = '🇬🇧';
  d.en['stp.cocks.icon'] = '🇬🇧';
  d.zh['stp.cocks.role'] = '秘密发明 RSA 等价算法的 GCHQ 数学家';
  d.en['stp.cocks.role'] = 'The GCHQ mathematician who secretly invented RSA';
  d.zh['stp.cocks.era'] = '1950– · 英国';
  d.en['stp.cocks.era'] = '1950– · UK';
  d.zh['stp.cocks.fact'] = '冷知识：科克斯的方案与 RSA 殊途同归——都建立在欧拉定理与因式分解的困难之上；但他的论文从未发表，直到 1997 年 GCHQ 解密，密码学界才发现「RSA 的原型」早已秘密存在了 24 年。';
  d.en['stp.cocks.fact'] = 'Fun fact: Cocks\'s scheme and RSA converged on the same mathematics — Euler\'s theorem and the difficulty of factoring. But his paper was never published; when GCHQ declassified it in 1997, the community discovered that a prototype of RSA had existed, in secret, for 24 years.';
  d.zh['stp.ellis.name'] = '詹姆斯·埃利斯';
  d.en['stp.ellis.name'] = 'James Ellis';
  d.zh['stp.ellis.icon'] = '💡';
  d.en['stp.ellis.icon'] = '💡';
  d.zh['stp.ellis.role'] = '「非秘密加密」的提出者 · 公钥思想的隐秘先驱';
  d.en['stp.ellis.role'] = 'Proposer of "non-secret encryption" · the hidden pioneer of public-key cryptography';
  d.zh['stp.ellis.era'] = '1924–1997 · 英国';
  d.en['stp.ellis.era'] = '1924–1997 · UK';
  d.zh['stp.ellis.fact'] = '冷知识：埃利斯 1987 年写下的内部回顾《非秘密加密的历史》如今是公钥密码隐秘史的第一手档案——解密后，学界称他为「公钥密码学被遗忘的祖父」；他 1997 年去世，几乎没等到这份迟到 28 年的承认。';
  d.en['stp.ellis.fact'] = 'Fun fact: Ellis\'s 1987 internal memoir, "The History of Non-Secret Encryption," is now the primary document of public-key cryptography\'s secret chapter — after declassification he was called "the forgotten grandfather of public-key cryptography." He died in 1997, just before the belated recognition arrived.';
  d.zh['stp.feistel.name'] = '霍斯特·费斯泰尔';
  d.en['stp.feistel.name'] = 'Horst Feistel';
  d.zh['stp.feistel.icon'] = '🧱';
  d.en['stp.feistel.icon'] = '🧱';
  d.zh['stp.feistel.role'] = 'Feistel 网络发明人 · DES 的核心设计者';
  d.en['stp.feistel.role'] = 'Inventor of the Feistel network · core designer of DES';
  d.zh['stp.feistel.era'] = '1915–1990 · 德裔美国人';
  d.en['stp.feistel.era'] = '1915–1990 · German-American';
  d.zh['stp.feistel.fact'] = '冷知识：IBM 团队最初的 Lucifer 使用 128 位密钥，而最终标准化的 DES 只有 56 位——外界长期怀疑是 NSA 在幕后要求削弱；这场「密钥之争」让 DES 带着后门疑云统治世界数十年，也开启了密码学界对政府标准的永恒争论。';
  d.en['stp.feistel.fact'] = 'Fun fact: IBM\'s original Lucifer used 128-bit keys, but the standardized DES kept only 56 — a cut widely suspected to have been demanded by the NSA. That suspicion shadowed DES for decades and opened the everlasting debate over government-designed standards.';
  d.zh['stp.rivest.name'] = '罗纳德·李维斯特';
  d.en['stp.rivest.name'] = 'Ronald Rivest';
  d.zh['stp.rivest.icon'] = '🔐';
  d.en['stp.rivest.icon'] = '🔐';
  d.zh['stp.rivest.role'] = 'RSA 算法共同发明人 · MD5 哈希设计者';
  d.en['stp.rivest.role'] = 'Co-inventor of RSA · designer of the MD5 hash';
  d.zh['stp.rivest.era'] = '1947– · 美国';
  d.en['stp.rivest.era'] = '1947– · USA';
  d.zh['stp.rivest.fact'] = '冷知识：传说 RSA 的灵感降临在 1977 年 4 月的一个夜晚——李维斯特在阿德曼家吃过逾越节晚餐后通宵工作，第二天清晨就把完整方案交给了两位合作者；「RSA」三个字母自此诞生，即三位发明人姓氏首字母 R、S、A。';
  d.en['stp.rivest.fact'] = 'Fun fact: The legend goes that the RSA breakthrough came one night in April 1977 — after a Passover dinner at Adleman\'s home, Rivest worked through the night and handed his partners the complete scheme the next morning. The three letters are simply the initials R, S, A of the three inventors.';
})();

/* ============================================================
   密件扩充（G6）：二战密码实物
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['sta.enigma-codebook.name'] = 'Enigma 密钥本';
  d.en['sta.enigma-codebook.name'] = 'The Enigma Codebook';
  d.zh['sta.enigma-codebook.era'] = '1939 年 · 欧洲';
  d.en['sta.enigma-codebook.era'] = '1939 · Europe';
  d.zh['sta.enigma-codebook.desc'] = '1939 年夏，法国情报机构获得德军 Enigma 密码机的密钥资料与操作说明，经波兰转交英国。这批文件让布莱切利园得以系统研究德军加密体制，成为盟军破译 Enigma、赢得大西洋战役的关键起点。';
  d.en['sta.enigma-codebook.desc'] = 'In the summer of 1939, French intelligence obtained German Enigma key materials and operating manuals, which were passed on to Britain via Poland. These documents let Bletchley Park study the German cipher system systematically, making them the crucial starting point for breaking Enigma and winning the Battle of the Atlantic.';
  d.zh['sta.cillies.name'] = 'Enigma「Cillies」操作员惰性密钥';
  d.en['sta.cillies.name'] = 'The Enigma "Cillies"';
  d.zh['sta.cillies.era'] = '1940 年代 · 英国布莱切利园';
  d.en['sta.cillies.era'] = '1940s · Bletchley Park, UK';
  d.zh['sta.cillies.desc'] = '德军 Enigma 操作员为图省事，常选择容易的转子设置与密钥，如 AAA、ABC 或女友名字。布莱切利园破译员戏称这些偷懒密码为「cillies」，并以此作为推测当日密钥的捷径，大幅加快破译速度。';
  d.en['sta.cillies.desc'] = 'German Enigma operators, seeking convenience, often chose easy rotor settings and keys such as AAA, ABC, or girlfriends\' names. Bletchley Park cryptanalysts jokingly called these lazy keys "cillies" and used them as shortcuts to deduce the day\'s key, greatly speeding up decryption.';
  d.zh['sta.zodiac13.name'] = '黄道十二宫杀手「我的名字是」13 字符密文';
  d.en['sta.zodiac13.name'] = 'The Zodiac "My Name Is" 13-Character Cipher';
  d.zh['sta.zodiac13.era'] = '1969 年 · 美国旧金山湾区';
  d.en['sta.zodiac13.era'] = '1969 · San Francisco Bay Area, US';
  d.zh['sta.zodiac13.desc'] = '1969 年 11 月，自称「黄道十二宫」的连环杀手向《旧金山纪事报》寄出密文，宣称其中 13 个字符暗藏他的真实姓名。五十年间无数人尝试破解，至今未获公认答案，成为悬案中最著名的未解密码之一。';
  d.en['sta.zodiac13.desc'] = 'In November 1969, the self-styled "Zodiac" serial killer mailed a cipher to the San Francisco Chronicle, claiming 13 of its characters concealed his real name. Fifty years of attempts have produced no generally accepted solution, making it one of the most famous unsolved ciphers in history.';
  d.zh['sta.enigma-m4.name'] = 'Enigma M4 海军四转子密码机';
  d.en['sta.enigma-m4.name'] = 'The Enigma M4 (Naval)';
  d.zh['sta.enigma-m4.era'] = '1942 年 · 大西洋';
  d.en['sta.enigma-m4.era'] = '1942 · Atlantic Ocean';
  d.zh['sta.enigma-m4.desc'] = '1942 年初，德国海军为 U 型潜艇装备四转子 Enigma M4，在标准三转子之外增设希腊字母转子，使密钥空间暴增。大西洋狼群战术因此一度畅行无阻，盟军直到年底才借助缴获的密钥资料攻破 M4，扭转护航战局。';
  d.en['sta.enigma-m4.desc'] = 'In early 1942, the German Navy equipped U-boats with the four-rotor Enigma M4, adding a Greek-letter rotor to the standard three and vastly expanding the key space. The wolf-pack tactic flourished until the Allies finally broke the M4 late that year, turning the tide of convoy warfare.';
})();

/* ============================================================
   人物扩充（G5）：5 位密码史人物
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.knox.name'] = '迪利·诺克斯';
  d.en['stp.knox.name'] = 'Alfred Dillwyn "Dilly" Knox';
  d.zh['stp.knox.icon'] = '🎓';
  d.en['stp.knox.icon'] = '🎓';
  d.zh['stp.knox.role'] = '布莱切利园最早的破译者 · 「迪利的姑娘们」的导师';
  d.en['stp.knox.role'] = 'Bletchley Park\'s original codebreaker · mentor of "Dilly\'s girls"';
  d.zh['stp.knox.era'] = '1884–1943 · 英国';
  d.en['stp.knox.era'] = '1884–1943 · England';
  d.zh['stp.knox.fact'] = '冷知识：破译 Abwehr Enigma 的关键线索，是德方密文几乎都以「ATTENTION」开头——玛维斯·利弗发现这个固定格式后，等于把一段明文直接送进了迪利团队的破译流程。';
  d.en['stp.knox.fact'] = 'Fun fact: the Abwehr Enigma fell partly because German messages so often began "ATTENTION" — Mavis Lever spotted the giveaway, handing Dilly\'s team a chunk of free plaintext.';
  d.zh['stp.alexander.name'] = '休·亚历山大';
  d.en['stp.alexander.name'] = 'Conel Hugh O\'Donel Alexander';
  d.zh['stp.alexander.icon'] = '♟️';
  d.en['stp.alexander.icon'] = '♟️';
  d.zh['stp.alexander.role'] = '国际象棋大师 · Hut 8 破译 Enigma 的核心数学家';
  d.en['stp.alexander.role'] = 'British chess champion · the mathematician who led Hut 8';
  d.zh['stp.alexander.era'] = '1909–1974 · 英国（爱尔兰出生）';
  d.en['stp.alexander.era'] = '1909–1974 · UK (born in Ireland)';
  d.zh['stp.alexander.fact'] = '冷知识：亚历山大战后仍是英格兰棋坛的顶梁柱——他曾多次代表英国出战国际象棋奥林匹克赛，还著有研究棋王阿廖欣的名作，是少有的以密码学家与棋手双重身份名留青史的人物。';
  d.en['stp.alexander.fact'] = 'Fun fact: Alexander stayed a force in chess for life — he represented England at the Chess Olympiads and wrote a celebrated study of Alekhine, carving his name into both cryptology and chess history.';
  d.zh['stp.efriedman.name'] = '伊丽莎白·弗里德曼';
  d.en['stp.efriedman.name'] = 'Elizebeth Friedman';
  d.zh['stp.efriedman.icon'] = '🌹';
  d.en['stp.efriedman.icon'] = '🌹';
  d.zh['stp.efriedman.role'] = '「美国密码学第一夫人」· 走私犯与纳粹间谍的克星';
  d.en['stp.efriedman.role'] = '"First lady of American cryptology" · breaker of smugglers and Nazi spies';
  d.zh['stp.efriedman.era'] = '1892–1980 · 美国';
  d.en['stp.efriedman.era'] = '1892–1980 · USA';
  d.zh['stp.efriedman.fact'] = '冷知识：她的名字 Elizebeth 刻意少用一个字母（拼作 -ze- 而非 -za-），只为与常见的 Elizabeth 区分——可直到今天，她的墓碑与纪念文字仍时常被人拼错。';
  d.en['stp.efriedman.fact'] = 'Fun fact: her name "Elizebeth" was deliberately spelled with an unusual -ze- to set it apart from the common Elizabeth — yet even her tombstone and modern tributes still get it wrong.';
  d.zh['stp.vigenere.name'] = '布莱斯·德·维吉尼亚';
  d.en['stp.vigenere.name'] = 'Blaise de Vigenère';
  d.zh['stp.vigenere.icon'] = '✒️';
  d.en['stp.vigenere.icon'] = '✒️';
  d.zh['stp.vigenere.role'] = '多表替换密码的集大成者 · 后世以其命名此体系';
  d.en['stp.vigenere.role'] = 'Master of polyalphabetic ciphers · the name behind the "Vigenère cipher"';
  d.zh['stp.vigenere.fact'] = '冷知识：维吉尼亚晚年痴迷炼金术与神秘学，《密码论》出版时他已年过六旬——密码学只是这位外交官多彩人生的晚年一章，却成了他身后最响亮的名字。';
  d.en['stp.vigenere.fact'] = 'Fun fact: Vigenère wrote his famous treatise in his sixties, after a long life as diplomat and alchemist — cryptography was a late hobby, yet it made his name immortal.';
  d.zh['stp.hellman.name'] = '马丁·赫尔曼';
  d.en['stp.hellman.name'] = 'Martin Hellman';
  d.zh['stp.hellman.icon'] = '🤝';
  d.en['stp.hellman.icon'] = '🤝';
  d.zh['stp.hellman.role'] = '公钥密码学奠基人 · Diffie-Hellman 密钥交换提出者';
  d.en['stp.hellman.role'] = 'Founder of public-key cryptography · co-inventor of the Diffie–Hellman key exchange';
  d.zh['stp.hellman.era'] = '1945– · 美国';
  d.en['stp.hellman.era'] = '1945– · USA';
  d.zh['stp.hellman.fact'] = '冷知识：1975 年，美国国家安全局曾施压要求撤回迪菲-赫尔曼的论文，就此拉开「密码战争」的序幕——可论文最终还是照常发表，公钥密码也随之传遍世界。';
  d.en['stp.hellman.fact'] = 'Fun fact: in 1975 the NSA pressed to have Diffie and Hellman\'s work suppressed — the opening shot of the "Crypto Wars." The paper was published anyway, and public-key cryptography swept the world.';
  d.zh['stp.jefferson.name'] = '托马斯·杰斐逊';
  d.en['stp.jefferson.name'] = 'Thomas Jefferson';
  d.zh['stp.jefferson.icon'] = '🏛️';
  d.en['stp.jefferson.icon'] = '🏛️';
  d.zh['stp.jefferson.role'] = '美国第三任总统 · 「杰斐逊转轮」发明者';
  d.en['stp.jefferson.role'] = '3rd US President · inventor of the Jefferson wheel cipher';
  d.zh['stp.jefferson.era'] = '1743–1826 · 美国';
  d.en['stp.jefferson.era'] = '1743–1826 · USA';
  d.zh['stp.jefferson.fact'] = '冷知识：杰斐逊的转轮在手稿里躺了一百多年，美国陆军 1922 年列装的 M-94 是工程师们的「独立再发明」——发明人本人对此一无所知，直到 1920 年代学者翻出他的手稿，历史才补上了这一课。';
  d.en['stp.jefferson.fact'] = 'Fun fact: Jefferson\'s wheel lay in his papers for over a century while the US Army\'s M-94, adopted in 1922, was an independent re-invention by engineers who had never heard of him; only when scholars found his manuscripts in the 1920s did history connect the dots.';
  d.zh['stp.wheatstone.name'] = '查尔斯·惠斯通';
  d.en['stp.wheatstone.name'] = 'Charles Wheatstone';
  d.zh['stp.wheatstone.icon'] = '🌉';
  d.en['stp.wheatstone.icon'] = '🌉';
  d.zh['stp.wheatstone.role'] = '物理学家与发明家 · Playfair 密码的创造者';
  d.en['stp.wheatstone.role'] = 'Physicist and inventor · creator of the Playfair cipher';
  d.zh['stp.wheatstone.era'] = '1802–1875 · 英国';
  d.en['stp.wheatstone.era'] = '1802–1875 · England';
  d.zh['stp.wheatstone.fact'] = '冷知识：他名下最出名的两样东西其实都不「属于」他——Playfair 密码以推广者普莱费尔命名，惠斯通电桥的真正发明者是克里斯蒂；倒是那台用偏振光传送密文的「惠斯通密码机」，才是他亲手造的原汁原味发明。';
  d.en['stp.wheatstone.fact'] = 'Fun fact: the two most famous things in his name weren\'t really his — the Playfair cipher honours its promoter Lord Playfair, and the Wheatstone bridge was invented by Samuel Hunter Christie. His genuinely own invention was the Wheatstone cryptograph, a machine that sent secret messages by polarised light.';
  d.zh['stp.mauborgne.name'] = '约瑟夫·毛博涅';
  d.en['stp.mauborgne.name'] = 'Joseph Mauborgne';
  d.zh['stp.mauborgne.icon'] = '🎲';
  d.en['stp.mauborgne.icon'] = '🎲';
  d.zh['stp.mauborgne.role'] = '美国陆军通信兵 · 一次性密码本（OTP）的共同发明者';
  d.en['stp.mauborgne.role'] = 'US Army Signal Corps officer · co-inventor of the one-time pad';
  d.zh['stp.mauborgne.era'] = '1881–1971 · 美国';
  d.en['stp.mauborgne.era'] = '1881–1971 · USA';
  d.zh['stp.mauborgne.fact'] = '冷知识：弗纳姆的原始系统靠重复密钥带工作，毛博涅坚持用随机密钥「用一次就扔」——而香农直到 1949 年才用信息论证明他们做对了；更妙的是，美国国务院 1919 年也独立发明过同款密码，历史上一共「撞车」了至少三次。';
  d.en['stp.mauborgne.fact'] = 'Fun fact: Vernam\'s original system reused its key tape; Mauborgne insisted on random, single-use keys — and Shannon only proved them right with information theory in 1949. The US State Department had even independently invented the same cipher in 1919: history staged the OTP at least three times.';
  d.zh['stp.yardley.name'] = '赫伯特·亚德利';
  d.en['stp.yardley.name'] = 'Herbert Yardley';
  d.zh['stp.yardley.icon'] = '🕶️';
  d.en['stp.yardley.icon'] = '🕶️';
  d.zh['stp.yardley.role'] = '「美国黑室」掌门人 · 第一位自曝国密的畅销书作家';
  d.en['stp.yardley.role'] = 'Chief of the American Black Chamber · the man who told the world';
  d.zh['stp.yardley.era'] = '1889–1958 · 美国';
  d.en['stp.yardley.era'] = '1889–1958 · USA';
  d.zh['stp.yardley.fact'] = '冷知识：他的回忆录是全球第一本自曝国家破译内幕的畅销书——日本恼羞成怒全面更换密码，间接让美国在珍珠港前监听日本变得更加困难；「黑室」一词也因此成了秘密破译机构的代名词。';
  d.en['stp.yardley.fact'] = 'Fun fact: his memoir was the first tell-all about a nation\'s codebreaking ever published — an outraged Japan overhauled its codes, making US monitoring harder in the run-up to Pearl Harbor, while the phrase "Black Chamber" entered the language as shorthand for a secret codebreaking bureau.';
  d.zh['stp.pzimmermann.name'] = '菲尔·齐默尔曼';
  d.en['stp.pzimmermann.name'] = 'Phil Zimmermann';
  d.zh['stp.pzimmermann.icon'] = '📧';
  d.en['stp.pzimmermann.icon'] = '📧';
  d.zh['stp.pzimmermann.role'] = 'PGP 发明人 · 把强加密带给普通人的活动家';
  d.en['stp.pzimmermann.role'] = 'Creator of PGP · the man who gave strong crypto to everyone';
  d.zh['stp.pzimmermann.era'] = '1954– · 美国';
  d.en['stp.pzimmermann.era'] = '1954– · USA';
  d.zh['stp.pzimmermann.fact'] = '冷知识：为了论证「代码也是言论」，他把 PGP 的完整源码印成一本 600 页的书公开出版——因为书可以自由出口，而「军火」不行；联邦调查结束后，他获颁的「自由技术先驱奖」成了加密界津津乐道的注脚。';
  d.en['stp.pzimmermann.fact'] = 'Fun fact: to argue that code is speech, he published the entire PGP source code as a printed book — books travel freely across borders, munitions do not. After the federal probe collapsed, his Pioneer of Freedom award became a favourite footnote of the crypto community.';
  d.zh['stp.schneier.name'] = '布鲁斯·施奈尔';
  d.en['stp.schneier.name'] = 'Bruce Schneier';
  d.zh['stp.schneier.icon'] = '🧠';
  d.en['stp.schneier.icon'] = '🧠';
  d.zh['stp.schneier.role'] = '现代安全思想家 · Blowfish / Twofish 设计者';
  d.en['stp.schneier.role'] = 'Modern security thinker · designer of Blowfish and Twofish';
  d.zh['stp.schneier.era'] = '1963– · 美国';
  d.en['stp.schneier.era'] = '1963– · USA';
  d.zh['stp.schneier.fact'] = '冷知识：《应用密码学》序言里有句名言——「世上有两种密码：一种挡得住你妹妹翻你的文件，一种挡得住大政府」；他运营二十余年的博客「Schneier on Security」是世界上读者最多的安全专栏。';
  d.en['stp.schneier.fact'] = 'Fun fact: the preface of Applied Cryptography carries his famous warning that "the right way to learn cryptography is to first learn to forget it"; and his blog, Schneier on Security, running for over two decades, is the most-read security column on the planet.';
  d.zh['stp.daemen.name'] = '约安·达门';
  d.en['stp.daemen.name'] = 'Joan Daemen';
  d.zh['stp.daemen.icon'] = '🧮';
  d.en['stp.daemen.icon'] = '🧮';
  d.zh['stp.daemen.role'] = '比利时密码学家 · AES（Rijndael）共同设计者';
  d.en['stp.daemen.role'] = 'Belgian cryptographer · co-designer of AES (Rijndael)';
  d.zh['stp.daemen.era'] = '1965– · 比利时';
  d.en['stp.daemen.era'] = '1965– · Belgium';
  d.zh['stp.daemen.fact'] = '冷知识：「Rijndael」是两位设计者姓氏的拼接——Ri-jn-dael；而达门是唯一一位同时参与设计 AES 与 SHA-3 两大美国国家标准算法的密码学家，堪称「一人双标准」。';
  d.en['stp.daemen.fact'] = 'Fun fact: "Rijndael" is a blend of Rijmen and Daemen — Ri-jn-dael. Daemen is the only cryptographer to have co-designed both AES and SHA-3, two US federal standards: one man, two standards.';
  d.zh['stp.bazeries.name'] = '艾蒂安·巴泽里';
  d.en['stp.bazeries.name'] = 'Étienne Bazeries';
  d.zh['stp.bazeries.icon'] = '🔍';
  d.en['stp.bazeries.icon'] = '🔍';
  d.zh['stp.bazeries.role'] = '法国军事情报破译专家 · 路易十四「大密码」的破解者';
  d.en['stp.bazeries.role'] = 'French military cryptanalyst · breaker of Louis XIV\'s Great Cipher';
  d.zh['stp.bazeries.era'] = '1846–1931 · 法国';
  d.en['stp.bazeries.era'] = '1846–1931 · France';
  d.zh['stp.bazeries.fact'] = '冷知识：他自称从「铁面人」的密信里读出了真相——那位神秘囚徒是将军维维安·德·比隆德，这个说法至今仍在历史学界争论；而他发明的巴泽里转筒，正是杰斐逊转轮、M-94 这条轮式密码家族谱系上的法国分支。';
  d.en['stp.bazeries.fact'] = 'Fun fact: he claimed the secret letters revealed the Man in the Iron Mask as General Vivien de Bulonde — a theory historians still debate — and his Bazeries cylinder is the French branch of the same wheel-cipher family that runs from Jefferson to the M-94.';
  d.zh['sta.culper-ring.name'] = '库尔珀间谍圈密信';
  d.en['sta.culper-ring.name'] = 'Culper Ring Cipher Letters';
  d.zh['sta.culper-ring.era'] = '1778–1780 · 美国纽约长岛';
  d.en['sta.culper-ring.era'] = '1778–1780 · Long Island, New York, USA';
  d.zh['sta.culper-ring.desc'] = '美国独立战争中华盛顿亲自组建的间谍圈，用数字代号与隐形墨水传递英军情报；代号密信与密码本至今藏于美国国家档案馆。';
  d.en['sta.culper-ring.desc'] = 'A spy ring personally formed by George Washington during the American Revolution, trading British intelligence in numeric codes and invisible ink; the coded letters and codebook survive in the U.S. National Archives.';
  d.zh['sta.bazeries-cylinder.name'] = '巴泽里密码圆筒';
  d.en['sta.bazeries-cylinder.name'] = 'Bazeries Cylinder';
  d.zh['sta.bazeries-cylinder.era'] = '1891 · 法国';
  d.en['sta.bazeries-cylinder.era'] = '1891 · France';
  d.zh['sta.bazeries-cylinder.desc'] = '法国密码学家巴泽里重造的轮式密码：二十枚乱序字母圆盘穿于同一轴，对齐转动即可加解密；1901 年被法国陆军列装，服役至一战。';
  d.en['sta.bazeries-cylinder.desc'] = 'French cryptanalyst Étienne Bazeries reinvented the wheel cipher — twenty scrambled-letter disks on one rod, aligned and rotated to encipher; adopted by the French Army in 1901 and still in service during WWI.';
  d.zh['sta.commercial-enigma.name'] = '商业恩尼格玛（D 型）';
  d.en['sta.commercial-enigma.name'] = 'Commercial Enigma (Model D)';
  d.zh['sta.commercial-enigma.era'] = '1923–1927 · 德国柏林';
  d.en['sta.commercial-enigma.era'] = '1923–1927 · Berlin, Germany';
  d.zh['sta.commercial-enigma.desc'] = '谢尔比乌斯推向市场的民用转子密码机，曾在伯尔尼万国邮政大会公开演示；它没有插线板、密钥空间有限，却是德军军用恩尼格玛的直系前身。';
  d.en['sta.commercial-enigma.desc'] = 'Scherbius\'s civilian rotor machine, publicly demonstrated at the Bern Postal Congress; without a plugboard its key space was limited, yet it was the direct ancestor of the military Enigma.';
  d.zh['sta.navajo-code.name'] = '纳瓦霍密码';
  d.en['sta.navajo-code.name'] = 'Navajo Code Talkers';
  d.zh['sta.navajo-code.era'] = '1942–1945 · 太平洋战场';
  d.en['sta.navajo-code.era'] = '1942–1945 · Pacific Theater';
  d.zh['sta.navajo-code.desc'] = '美国海军陆战队以纳瓦霍语编制两套密码，训练纳瓦霍人担任无线电通讯员；日军始终无法破解，硫磺岛六名译电员 48 小时无差错收发 800 余条电文。';
  d.en['sta.navajo-code.desc'] = 'The U.S. Marine Corps built two codebooks on the Navajo language and trained Navajo speakers as radio operators; the Japanese never broke it — at Iwo Jima six code talkers relayed over 800 error-free messages in 48 hours.';
  d.zh['sta.monastic-cipher.name'] = '中世纪修道院密写字母';
  d.en['sta.monastic-cipher.name'] = 'Medieval Monastic Cipher Alphabets';
  d.zh['sta.monastic-cipher.era'] = '8–16 世纪 · 西欧修道院';
  d.en['sta.monastic-cipher.era'] = '8th–16th century · Western European monasteries';
  d.zh['sta.monastic-cipher.desc'] = '中世纪抄经修士以符文式替代字母在羊皮纸上藏写署名与批注；16 世纪初修道院院长特里特米乌斯更创制多套「天使字母表」，开西方密码学著作之先河。';
  d.en['sta.monastic-cipher.desc'] = 'Medieval scribes hid signatures and glosses on parchment in rune-like substitution alphabets; in the early 1500s Abbot Trithemius went further, inventing “angelic alphabets” that launched Western cryptographic literature.';
  d.zh['sta.civilwar-disk.name'] = '美国内战密码盘';
  d.en['sta.civilwar-disk.name'] = 'Civil War Cipher Disk';
  d.zh['sta.civilwar-disk.era'] = '1861–1865 · 美国';
  d.en['sta.civilwar-disk.era'] = '1861–1865 · United States';
  d.zh['sta.civilwar-disk.desc'] = '南北战争联邦军信号兵团使用的双盘式密码盘：两枚同心铜盘错位旋转即完成字母替换；南军多次破译其电文，迫使联邦不断更换密钥与用法。';
  d.en['sta.civilwar-disk.desc'] = 'The twin-disk device of the Union Signal Corps: two concentric brass rings rotated against each other to substitute letters; Confederate codebreakers repeatedly read its traffic, forcing constant changes in Union practice.';
  d.zh['sta.adfgvx-break.name'] = 'ADFGVX 破译（佩恩万）';
  d.en['sta.adfgvx-break.name'] = 'Breaking ADFGVX (Painvin)';
  d.zh['sta.adfgvx-break.era'] = '1918 年 6 月 · 法国西线';
  d.en['sta.adfgvx-break.era'] = 'June 1918 · Western Front, France';
  d.zh['sta.adfgvx-break.desc'] = '1918 年 6 月 3 日，法国密码专家佩恩万破译德军 ADFGVX 密电，读出「速运弹药，昼间亦无妨」等句，据此判明德军进攻方向，联军得以挫败六月攻势。';
  d.en['sta.adfgvx-break.desc'] = 'On June 3, 1918, French cryptanalyst Georges Painvin broke a German ADFGVX message reading “Rush munitions. Even by day if not seen,” pinpointing the coming offensive so the Allies could blunt it.';
})();

/* ============================================================
   第四期 A1-A3：量子时代（第 12 章 · c11）
   era11 + 章节标题/一句话 + 人物 5 位全字段 + 密件 3 件
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['era11'] = '当代 · 量子前沿'; d.en['era11'] = 'Today · Quantum Frontier';
  d.zh['st.c11.t'] = '量子转折点';
  d.en['st.c11.t'] = 'The Quantum Turn';
  d.zh['st.c11.t.one'] = '从 Shor 威胁到后量子迁移：密码学驶入量子时代';
  d.en['st.c11.t.one'] = 'From the Shor threat to post-quantum migration: cryptography enters the quantum age';

  /* ---- 人物 ---- */
  d.zh['stp.wiesner.name'] = '斯蒂芬·威斯纳'; d.en['stp.wiesner.name'] = 'Stephen Wiesner';
  d.zh['stp.wiesner.icon'] = '💵'; d.en['stp.wiesner.icon'] = '💵';
  d.zh['stp.wiesner.role'] = '《共轭编码》作者 · 量子货币与量子密码学的构想者';
  d.en['stp.wiesner.role'] = 'Author of "Conjugate Coding" · visionary of quantum money and quantum cryptography';
  d.zh['stp.wiesner.era'] = '1942–2021 · 美国 / 以色列'; d.en['stp.wiesner.era'] = '1942–2021 · USA / Israel';
  d.zh['stp.wiesner.fact'] = '威斯纳约 1970 年写成的《共轭编码》手稿接连被期刊拒稿，此后沉睡十余年；直到贝内特与布拉萨德把它从故纸堆里翻出来，才催生出 BB84。这篇「史上被拒稿最久的奠基论文」最终于 1983 年发表在一份计算机理论通讯上。';
  d.en['stp.wiesner.fact'] = 'Wiesner\'s "Conjugate Coding", written around 1970, was rejected by journal after journal and slept for over a decade — until Bennett and Brassard dug it out and BB84 was born. One of the foundational papers of quantum information finally appeared in 1983 in a modest computer-theory newsletter.';
  d.zh['stp.bennett.name'] = '查尔斯·贝内特'; d.en['stp.bennett.name'] = 'Charles Bennett';
  d.zh['stp.bennett.icon'] = '🔬'; d.en['stp.bennett.icon'] = '🔬';
  d.zh['stp.bennett.role'] = 'IBM 量子信息先驱 · BB84 协议共同发明人';
  d.en['stp.bennett.role'] = 'IBM quantum-information pioneer · co-inventor of BB84';
  d.zh['stp.bennett.era'] = '1943– · 美国'; d.en['stp.bennett.era'] = '1943– · USA';
  d.zh['stp.bennett.fact'] = '据两人回忆，BB84 的火种点燃于 1979 年墨西哥城的一场学术会议——贝内特与布拉萨德边游泳边聊起威斯纳的量子钞票，把一个被拒稿的想法聊成了整个量子密码学。后来他还证明了量子远程传态的可行性。';
  d.en['stp.bennett.fact'] = 'By their own telling, the spark of BB84 came at a 1979 conference in Mexico City, where Bennett and Brassard talked about Wiesner\'s quantum money while swimming — turning a rejected manuscript into a whole field. Bennett later proved quantum teleportation possible.';
  d.zh['stp.brassard.name'] = '吉尔·布拉萨德'; d.en['stp.brassard.name'] = 'Gilles Brassard';
  d.zh['stp.brassard.icon'] = '🃏'; d.en['stp.brassard.icon'] = '🃏';
  d.zh['stp.brassard.role'] = '蒙特利尔大学量子密码学家 · BB84 协议共同发明人';
  d.en['stp.brassard.role'] = 'Université de Montréal cryptologist · co-inventor of BB84';
  d.zh['stp.brassard.era'] = '1955– · 加拿大'; d.en['stp.brassard.era'] = '1955– · Canada';
  d.zh['stp.brassard.fact'] = 'BB84 的名字来自会议年份与人名缩写（Bennett & Brassard, 1984），而那篇开创性论文当年只是在印度班加罗尔一个小型分会场上宣读的一页摘要——如今它被公认为量子密码学的出生证明。';
  d.en['stp.brassard.fact'] = 'BB84 is simply "Bennett & Brassard, 1984" — and the founding paper was a one-page abstract read at a small session of an IEEE conference in Bangalore, India. Today it is recognized as the birth certificate of quantum cryptography.';
  d.zh['stp.shor.name'] = '彼得·秀尔'; d.en['stp.shor.name'] = 'Peter Shor';
  d.zh['stp.shor.icon'] = '⚡'; d.en['stp.shor.icon'] = '⚡';
  d.zh['stp.shor.role'] = 'Shor 算法发明人 · 敲响公钥密码警钟的数学家';
  d.en['stp.shor.role'] = "Inventor of Shor's algorithm · the mathematician who rang the alarm for public-key crypto";
  d.zh['stp.shor.era'] = '1959– · 美国'; d.en['stp.shor.era'] = '1959– · USA';
  d.zh['stp.shor.fact'] = '1994 年秀尔在贝尔实验室的一次研讨会上公布算法后，消息几天内就传遍各大实验室与安全机构——RSA 的根基「大数分解」在量子计算机面前竟有多项式时间解法。那是密码学界第一次集体意识到：量子力学也可能是密码的掘墓人。';
  d.en['stp.shor.fact'] = 'When Shor presented his algorithm at a Bell Labs seminar in 1994, word reached labs and security agencies within days: factoring — RSA\'s very foundation — had a polynomial-time quantum solution. Cryptography collectively realized quantum mechanics could be the gravedigger as well as the guardian.';
  d.zh['stp.grover.name'] = '洛夫·格罗弗'; d.en['stp.grover.name'] = 'Lov Grover';
  d.zh['stp.grover.icon'] = '🔎'; d.en['stp.grover.icon'] = '🔎';
  d.zh['stp.grover.role'] = 'Grover 搜索算法发明人 · 对称密钥长度的「减半者」';
  d.en['stp.grover.role'] = "Inventor of Grover's search algorithm · the halver of symmetric key strength";
  d.zh['stp.grover.era'] = '1961– · 美国'; d.en['stp.grover.era'] = '1961– · USA';
  d.zh['stp.grover.fact'] = '格罗弗算法只能把暴力搜索从 N 步降到约 √N 步——听起来吓人，对策却简单：密钥加倍即可。AES-256 因此在量子时代依然稳坐钓鱼台；真正被 Shor 算法「处决」的，只有依赖数论结构的公钥家族。';
  d.en['stp.grover.fact'] = "Grover's algorithm only speeds brute force from N steps to about √N — scary, but the fix is easy: double the key. AES-256 remains comfortable in the quantum era; what Shor truly condemns is the number-theoretic public-key family.";

  /* ---- 密件 ---- */
  d.zh['sta.qmoney.name'] = '量子钞票备忘'; d.en['sta.qmoney.name'] = 'Quantum Money Memo';
  d.zh['sta.qmoney.icon'] = '💵'; d.en['sta.qmoney.icon'] = '💵';
  d.zh['sta.qmoney.era'] = '约 1970 · 美国'; d.en['sta.qmoney.era'] = 'c. 1970 · USA';
  d.zh['sta.qmoney.desc'] = '斯蒂芬·威斯纳《共轭编码》手稿的核心构想：用无法被克隆的量子态印制钞票，伪币制造者一旦测量就会破坏原态而暴露。稿件尘封十余年，却孕育了 BB84 与整个量子密码学。以下为构想要点的史料化节选。';
  d.en['sta.qmoney.desc'] = 'The core idea of Stephen Wiesner\'s "Conjugate Coding" memo: print banknotes with quantum states that cannot be cloned — any counterfeiter who measures them disturbs the original state and gives himself away. The memo slept for a decade yet seeded BB84 and all of quantum cryptography. Below, a dramatized excerpt of its key idea.';
  d.zh['sta.bb84paper.name'] = 'BB84 会议摘要'; d.en['sta.bb84paper.name'] = 'The BB84 Abstract';
  d.zh['sta.bb84paper.icon'] = '📄'; d.en['sta.bb84paper.icon'] = '📄';
  d.zh['sta.bb84paper.era'] = '1984 · 印度班加罗尔'; d.en['sta.bb84paper.era'] = '1984 · Bangalore, India';
  d.zh['sta.bb84paper.desc'] = '贝内特与布拉萨德在 IEEE 国际会议系统科学分会发表的页摘要：首次给出实用的量子密钥分发协议——以光子偏振为骰子、以测不准原理为锁，窃听必然留下扰动指纹。量子密码学就此诞生。';
  d.en['sta.bb84paper.desc'] = 'Bennett and Brassard\'s one-page abstract at an IEEE conference session in Bangalore: the first practical quantum key distribution protocol — photons as dice, the uncertainty principle as the lock, eavesdropping betrayed by its own disturbance. Quantum cryptography was born here.';
  d.zh['sta.pqc2024.name'] = 'FIPS 203 标准公告'; d.en['sta.pqc2024.name'] = 'FIPS 203 Announcement';
  d.zh['sta.pqc2024.icon'] = '🛡️'; d.en['sta.pqc2024.icon'] = '🛡️';
  d.zh['sta.pqc2024.era'] = '2024 · 美国马里兰州（NIST）'; d.en['sta.pqc2024.era'] = '2024 · Maryland, USA (NIST)';
  d.zh['sta.pqc2024.desc'] = '2024 年 8 月 13 日，美国国家标准与技术研究院正式发布首批后量子密码标准：FIPS 203（ML-KEM，基于 Kyber）、204（ML-DSA）与 205（SLH-DSA）。面对「先截获、后解密」的量子倒计时，全球互联网开始了一场静悄悄的换锁迁移。本卡片为公告的史料化演绎。';
  d.en['sta.pqc2024.desc'] = 'On August 13, 2024, NIST published the first post-quantum cryptography standards: FIPS 203 (ML-KEM, based on Kyber), 204 (ML-DSA) and 205 (SLH-DSA). Facing the "harvest now, decrypt later" countdown, the world\'s networks began a quiet migration to new locks. This card dramatizes the announcement.';
})();

/* ============================================================
   第四期 B5：东方密码密件 ×2（字验 / 反切码）
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['sta.ziyan.name'] = '字验军符册'; d.en['sta.ziyan.name'] = 'Ziyan Field Manual';
  d.zh['sta.ziyan.icon'] = '📜'; d.en['sta.ziyan.icon'] = '📜';
  d.zh['sta.ziyan.era'] = '1044 · 北宋'; d.en['sta.ziyan.era'] = '1044 · Northern Song';
  d.zh['sta.ziyan.desc'] = '《武经总要》前集所载「字验」：选一首四十字的五言诗为底本，以主将临时分发的钥字定诗中一字，其位次对应「请弓」「请粮」「被贼围」等四十项军情之一。钥字逐日更换，码本随之而换——千年前的「日密钥」实践。以下为依原制重构的一页。';
  d.en['sta.ziyan.desc'] = 'The "ziyan" method in the Wujing Zongyao (1044): choose a forty-character poem as the base; a key character issued daily by the general selects one position, which maps to one of forty pre-agreed tactical reports such as "request arrows" or "besieged". Change the key character and the whole encoding changes — a thousand-year-old daily-key practice. Below, one page reconstructed from the original system.';
  d.zh['sta.fanqie.name'] = '反切码注本'; d.en['sta.fanqie.name'] = 'Fanqie Code Notebook';
  d.zh['sta.fanqie.icon'] = '🗡️'; d.en['sta.fanqie.icon'] = '🗡️';
  d.zh['sta.fanqie.era'] = '1560 年代 · 明'; d.en['sta.fanqie.era'] = '1560s · Ming Dynasty';
  d.zh['sta.fanqie.desc'] = '戚继光《纪效新书》所载反切码：取两首诗词，「重唱诗」取二十声母、「合声诗」取四十字韵母，声韵两两交叉得八百音码，再配以金鼓旗号传递——将本土音韵学化作军中密码。以下为依原法重构的编码页。';
  d.en['sta.fanqie.desc'] = 'The fanqie code in Qi Jiguang\'s Jixiao Xinshu: take two poems — twenty initials from one, forty finals from the other — cross twenty initials with forty finals to form eight hundred sound-codes, then signal them by gongs, drums and flags, turning phonology into an army cipher. Below, one page reconstructed from the original method.';
  d.zh['sta.half-radio.name'] = '半部电台——红军第一部电台'; d.en['sta.half-radio.name'] = 'The Half Radio — the Red Army’s First Set';
  d.zh['sta.half-radio.icon'] = '📻'; d.en['sta.half-radio.icon'] = '📻';
  d.zh['sta.half-radio.era'] = '1930 · 龙冈战斗'; d.en['sta.half-radio.era'] = '1930 · Longgang';
  d.zh['sta.half-radio.desc'] = '1930 年 12 月龙冈一仗，红军缴获国民党军第 18 师电台一部：发报机已损，唯收报机完好——“半部电台起家”。1931 年 1 月红军第一支无线电队成立，王诤任队长；同年开办无线电训练班，并由此开辟了收报、侦听与密码破译之路。'; d.en['sta.half-radio.desc'] = 'At Longgang in December 1930 the Red Army captured one radio from the KMT 18th Division — the transmitter broken, the receiver intact: “a half radio to start with”. In January 1931 the first radio corps was formed under Wang Zheng, followed by a training school that opened the road to interception, radio intelligence and cryptanalysis.';
  d.zh['sta.redarmy-cipher.name'] = '红军无线电密码'; d.en['sta.redarmy-cipher.name'] = 'Red Army Radio Ciphers';
  d.zh['sta.redarmy-cipher.icon'] = '⚡'; d.en['sta.redarmy-cipher.icon'] = '⚡';
  d.zh['sta.redarmy-cipher.era'] = '1931 · 中央苏区'; d.en['sta.redarmy-cipher.era'] = '1931 · Central Soviet Area';
  d.zh['sta.redarmy-cipher.desc'] = '拥有“看不见的电台”后，红军很快走上侦听破译之路：编印口令本、把握敌台呼号与频率规律、以加密电报的报文构筑“密中之密”。长征途中，军委二局的破译成果被誉为“令我们行军时多了一双眼睛”。以下为依史重构的敌台记录页。'; d.en['sta.redarmy-cipher.desc'] = 'Once the “invisible radios” were in hand, the Red Army moved quickly into interception and decryption: code-books, call-sign patterns, frequency discipline — the cipher within the cipher. On the Long March, decrypted traffic from the General Staff bureau warned the column like a second pair of eyes. Below, one reconstructed page of intercepted traffic.';
  d.zh['sta.half-radio.name'] = '半部电台——红军第一部电台'; d.en['sta.half-radio.name'] = 'The Half Radio — the Red Army’s First Set';
  d.zh['sta.half-radio.icon'] = '📻'; d.en['sta.half-radio.icon'] = '📻';
  d.zh['sta.half-radio.era'] = '1930 · 龙冈战斗'; d.en['sta.half-radio.era'] = '1930 · Longgang';
  d.zh['sta.half-radio.desc'] = '1930 年 12 月龙冈一仗，红军缴获国民党军第 18 师电台一部：发报机已损，唯收报机完好——“半部电台起家”。1931 年 1 月红军第一支无线电队成立，王诤任队长；同年开办无线电训练班，并由此开辟了收报、侦听与密码破译之路。'; d.en['sta.half-radio.desc'] = 'At Longgang in December 1930 the Red Army captured one radio from the KMT 18th Division — the transmitter broken, the receiver intact: “a half radio to start with”. In January 1931 the first radio corps was formed under Wang Zheng, followed by a training school that opened the road to interception, radio intelligence and cryptanalysis.';
  d.zh['sta.redarmy-cipher.name'] = '红军无线电密码'; d.en['sta.redarmy-cipher.name'] = 'Red Army Radio Ciphers';
  d.zh['sta.redarmy-cipher.icon'] = '⚡'; d.en['sta.redarmy-cipher.icon'] = '⚡';
  d.zh['sta.redarmy-cipher.era'] = '1931 · 中央苏区'; d.en['sta.redarmy-cipher.era'] = '1931 · Central Soviet Area';
  d.zh['sta.redarmy-cipher.desc'] = '拥有“看不见的电台”后，红军很快走上侦听破译之路：编印口令本、把握敌台呼号与频率规律、以加密电报的报文构筑“密中之密”。长征途中，军委二局的破译成果被誉为“令我们行军时多了一双眼睛”。以下为依史重构的敌台记录页。'; d.en['sta.redarmy-cipher.desc'] = 'Once the “invisible radios” were in hand, the Red Army moved quickly into interception and decryption: code-books, call-sign patterns, frequency discipline — the cipher within the cipher. On the Long March, decrypted traffic from the General Staff bureau warned the column like a second pair of eyes. Below, one reconstructed page of intercepted traffic.';
})();

/* ============================================================
   全站复查（2026-08-23）新增键
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
})();

/* 第四期 D1：核心/彩蛋分层标题 */
(function () {
  var d = Arcade.i18n.dicts;
})();

/* ============================================================
   第五期：哈希碰撞史人物 · 王小云
   ============================================================ */
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.wangxy.name'] = '王小云'; d.en['stp.wangxy.name'] = 'Xiaoyun Wang';
  d.zh['stp.wangxy.icon'] = '💥'; d.en['stp.wangxy.icon'] = '💥';
  d.zh['stp.wangxy.role'] = '密码学家 · 破解 MD5 与 SHA-1 的碰撞攻击领军者';
  d.en['stp.wangxy.role'] = 'Cryptographer · led the collision attacks that felled MD5 and SHA-1';
  d.zh['stp.wangxy.era'] = '1966– · 中国';
  d.en['stp.wangxy.era'] = '1966– · China';
  d.zh['stp.wangxy.fact'] = '2004 年美密会（Crypto 2004）上，王小云团队宣布攻破 MD5 时全场起立鼓掌；与会者当场改写论文结论。此后她的团队又拿下 SHA-1 的理论碰撞，直接催生了 SHA-3 竞赛加速与全球哈希算法迁移。';
  d.en['stp.wangxy.fact'] = 'At Crypto 2004 the audience gave Xiaoyun Wang\'s team a standing ovation as MD5 fell — attendees rewrote their own papers on the spot. Her team later broke SHA-1\'s theoretical collision, accelerating the SHA-3 competition and the global hash migration.';
  d.zh['stp.gardner.name'] = '梅雷迪思·加德纳'; d.en['stp.gardner.name'] = 'Meredith Gardner';
  d.zh['stp.gardner.icon'] = '🕵️'; d.en['stp.gardner.icon'] = '🕵️';
  d.zh['stp.gardner.role'] = '语言学家 · VENONA 破译核心'; d.en['stp.gardner.role'] = 'Linguist · core cryptanalyst of VENONA';
  d.zh['stp.gardner.era'] = '1912–2002 · 美国'; d.en['stp.gardner.era'] = '1912–2002 · United States';
  d.zh['stp.gardner.fact'] = '他不懂密码学却懂古法语与德语文学——1946 年仅凭苏联贸易电报里的重复数字残迹重建了苏联间谍体制的骨架，让罗森堡案浮出水面。同事说他「用读诗的方法读密文」。';
  d.en['stp.gardner.fact'] = 'A scholar of Old French and German literature who knew no cryptology, he rebuilt the skeleton of Soviet espionage in 1946 from repeated number-groups in trade traffic — the Rosenberg case surfaced from his reading. Colleagues said he "read ciphertext like poetry."';
  d.zh['stp.clarke.name'] = '琼·克拉克'; d.en['stp.clarke.name'] = 'Joan Clarke';
  d.zh['stp.clarke.icon'] = '🧩'; d.en['stp.clarke.icon'] = '🧩';
  d.zh['stp.clarke.role'] = '密码破译员 · Enigma 海军方案核心分析员'; d.en['stp.clarke.role'] = 'Codebreaker · key analyst for naval Enigma';
  d.zh['stp.clarke.era'] = '1917–1996 · 英国'; d.en['stp.clarke.era'] = '1917–1996 · United Kingdom';
  d.zh['stp.clarke.fact'] = '因女性身份长期只拿「语言学级」薪水、无法挂主管头衔——但图灵亲口说她是他最信任的同行。凯拉·奈特莉在《模仿游戏》中饰演了她。';
  d.en['stp.clarke.fact'] = 'Barred by her gender from a full "linguist-grade" career grade and official titles, she was nonetheless — by Turing\'s own account — the colleague he trusted most. Keira Knightley played her in The Imitation Game.';
  d.zh['stp.alberti.name'] = '莱昂·巴蒂斯塔·阿尔贝蒂'; d.en['stp.alberti.name'] = 'Leon Battista Alberti';
  d.zh['stp.alberti.icon'] = '💿'; d.en['stp.alberti.icon'] = '💿';
  d.zh['stp.alberti.role'] = '文艺复兴通才 · 密码盘发明者'; d.en['stp.alberti.role'] = 'Renaissance polymath · inventor of the cipher disk';
  d.zh['stp.alberti.era'] = '1404–1472 · 意大利'; d.en['stp.alberti.era'] = '1404–1472 · Italy';
  d.zh['stp.alberti.fact'] = '1467 年他的《论密码》首次系统提出多表替换——两个同轴圆盘一转，单表频率分析瞬间失效。「西方密码学之父」的头衔由此而来。';
  d.en['stp.alberti.fact'] = 'His 1467 treatise introduced polyalphabetic substitution: two coaxial disks, one twist, and single-alphabet frequency analysis collapsed. Hence his title as a father of Western cryptography.';
  d.zh['stp.cardano.name'] = '吉罗拉莫·卡尔达诺'; d.en['stp.cardano.name'] = 'Girolamo Cardano';
  d.zh['stp.cardano.icon'] = '🕳️'; d.en['stp.cardano.icon'] = '🕳️';
  d.zh['stp.cardano.role'] = '数学家 · 卡当格栅发明者'; d.en['stp.cardano.role'] = 'Mathematician · inventor of the Cardan grille';
  d.zh['stp.cardano.era'] = '1501–1576 · 意大利'; d.en['stp.cardano.era'] = '1501–1576 · Italy';
  d.zh['stp.cardano.fact'] = '他写的掩码格栅只需一张挖孔卡片——无孔处填上无害闲话，有孔处拼出密信。四百年后二战双方仍在用它传递情书与军令。';
  d.en['stp.cardano.fact'] = 'His grille is just a card with holes cut out: fill innocuous chatter through them and a hidden letter appears. Both World Wars still used grilles for love letters and military orders alike.';
  d.zh['stp.rijmen.name'] = '文森特·赖伊曼'; d.en['stp.rijmen.name'] = 'Vincent Rijmen';
  d.zh['stp.rijmen.icon'] = '🧊'; d.en['stp.rijmen.icon'] = '🧊';
  d.zh['stp.rijmen.role'] = '密码学家 · AES 联合设计者'; d.en['stp.rijmen.role'] = 'Cryptographer · co-designer of AES';
  d.zh['stp.rijmen.era'] = '1975– · 比利时'; d.en['stp.rijmen.era'] = '1975– · Belgium';
  d.zh['stp.rijmen.fact'] = '他与合作者 Daemen 的 Rijndael 从 15 个候选中胜出成为 AES（FIPS 197，2001）——设计文档公开、免专利费，如今保护着从手机到卫星的一切。';
  d.en['stp.rijmen.fact'] = 'Rijndael, designed with his mentor Daemen, beat 15 candidates to become AES (FIPS 197, 2001) — publicly documented and royalty-free, it now protects everything from phones to satellites.';
  d.zh['stp.elgamal.name'] = '塔赫尔·埃尔加马尔'; d.en['stp.elgamal.name'] = 'Taher ElGamal';
  d.zh['stp.elgamal.icon'] = '🔐'; d.en['stp.elgamal.icon'] = '🔐';
  d.zh['stp.elgamal.role'] = '密码学家 · ElGamal 加密与 DSA 之父'; d.en['stp.elgamal.role'] = 'Cryptographer · father of ElGamal encryption and DSA';
  d.zh['stp.elgamal.era'] = '1955–2022 · 埃及/美国'; d.en['stp.elgamal.era'] = '1955–2022 · Egypt/USA';
  d.zh['stp.elgamal.fact'] = '1985 年一篇论文同时奠定 ElGamal 公钥加密与美国联邦签名标准 DSA 的地基；他还领导设计了 SSL 3.0 的早期形态——今天 HTTPS 的祖先。';
  d.en['stp.elgamal.fact'] = 'One 1985 paper underpins both ElGamal public-key encryption and the US signature standard DSA; he also led early SSL 3.0 work — a direct ancestor of today\'s HTTPS.';
  d.zh['stp.miller.name'] = '维克托·米勒'; d.en['stp.miller.name'] = 'Victor Miller';
  d.zh['stp.miller.icon'] = '📈'; d.en['stp.miller.icon'] = '📈';
  d.zh['stp.miller.role'] = '数学家 · 椭圆曲线密码学联合创始人'; d.en['stp.miller.role'] = 'Mathematician · co-founder of elliptic-curve cryptography';
  d.zh['stp.miller.era'] = '1947– · 美国'; d.en['stp.miller.era'] = '1947– · United States';
  d.zh['stp.miller.fact'] = '1985 年他与 Koblitz 各自独立提出把椭圆曲线引入公钥密码——同样安全强度下密钥更短、速度更快，今天 TLS 握手默认都在用它。';
  d.en['stp.miller.fact'] = 'Independently of Koblitz in 1985, he brought elliptic curves into public-key crypto: shorter keys at equal strength and faster math — now the default inside every TLS handshake.';
  d.zh['stp.back.name'] = '亚当·贝克'; d.en['stp.back.name'] = 'Adam Back';
  d.zh['stp.back.icon'] = '⛓️'; d.en['stp.back.icon'] = '⛓️';
  d.zh['stp.back.role'] = '密码朋克 · Hashcash 发明者'; d.en['stp.back.role'] = 'Cypherpunk · inventor of Hashcash';
  d.zh['stp.back.era'] = '1970– · 英国/马耳他'; d.en['stp.back.era'] = '1970– · UK/Malta';
  d.zh['stp.back.fact'] = '1997 年的反垃圾邮件方案 Hashcash 要求发件人付出少量算力——十年后中本聪把它变成比特币的工作量证明核心，并在创世论文里引用了他。';
  d.en['stp.back.fact'] = 'His 1997 anti-spam scheme Hashcash made senders burn a little CPU — a decade later Satoshi turned it into Bitcoin\'s proof-of-work core and cited him in the whitepaper.';
  d.zh['stp.koblitz.name'] = '尼尔·科比茨'; d.en['stp.koblitz.name'] = 'Neal Koblitz';
  d.zh['stp.koblitz.icon'] = '📈'; d.en['stp.koblitz.icon'] = '📈';
  d.zh['stp.koblitz.role'] = '数学家 · 椭圆曲线密码学联合创始人';
  d.en['stp.koblitz.role'] = 'Mathematician · co-founder of elliptic-curve cryptography';
  d.zh['stp.koblitz.era'] = '1948– · 美国';
  d.en['stp.koblitz.era'] = '1948– · United States';
  d.zh['stp.koblitz.fact'] = '1985 年与 Victor Miller 各自独立提出 ECC。他还是「密码学战争」中公开辩论的积极参与者，长期在越南与非洲支教数学。';
  d.en['stp.koblitz.fact'] = 'In 1985 he independently proposed ECC alongside Victor Miller. An outspoken participant in the Crypto Wars debates, he has also spent decades teaching mathematics in Vietnam and Africa.';
  d.zh['stp.goldwasser.name'] = '莎菲耶·戈德瓦瑟'; d.en['stp.goldwasser.name'] = 'Shafi Goldwasser';
  d.zh['stp.goldwasser.icon'] = '🏆'; d.en['stp.goldwasser.icon'] = '🏆';
  d.zh['stp.goldwasser.role'] = '密码学家 · 零知识证明与量子计算安全奠基人'; d.en['stp.goldwasser.role'] = 'Cryptographer · co-founder of zero-knowledge proofs';
  d.zh['stp.goldwasser.era'] = '1958– · 以色列/美国'; d.en['stp.goldwasser.era'] = '1958– · 以色列/美国';
  d.zh['stp.goldwasser.fact'] = '2012 年与 Micali 因「概率加密」与「可在不泄露信息情况下证明任何计算性定理」获图灵奖——他们 1984 年的双投注加密论文也是现代公钥密码安全框架的基础。';
  d.en['stp.goldwasser.fact'] = 'In 2012 she shared the Turing Award for turning probable encryption and the ability to prove any computational theorem without leaking information — the 1984 paper that founded semantic security.';
  d.zh['stp.micali.name'] = '西尔维奥·米卡利'; d.en['stp.micali.name'] = 'Silvio Micali';
  d.zh['stp.micali.icon'] = '🏆'; d.en['stp.micali.icon'] = '🏆';
  d.zh['stp.micali.role'] = '密码学家 · 概率加密/零知识双图灵奖者'; d.en['stp.micali.role'] = 'Cryptographer · probabilities and zero-knowledge, Turing Award';
  d.zh['stp.micali.era'] = '1955– · 以色列'; d.en['stp.micali.era'] = '1955– · 以色列';
  d.zh['stp.micali.fact'] = '2012 图灵奖得主；1982 年与 Rabin 提出的公钥随机化协议以及 1990 年用于售门票的回绕协议。由他来构建可公开验证的诚实下注协议，正合其巧思。';
  d.en['stp.micali.fact'] = 'Turing Award 2012; his 1990 coin-tossing-stark protocols and modern transparency platform draw on the same elegant protocol design.';
  d.zh['stp.rackoff.name'] = '查尔斯·拉科夫'; d.en['stp.rackoff.name'] = 'Charles Rackoff';
  d.zh['stp.rackoff.icon'] = '🧩'; d.en['stp.rackoff.icon'] = '🧩';
  d.zh['stp.rackoff.role'] = '密码学家 · 零知识证明三合伙之一'; d.en['stp.rackoff.role'] = 'Co-author of zero-knowledge proofs';
  d.zh['stp.rackoff.era'] = '1948– · 加拿大'; d.en['stp.rackoff.era'] = '1948– · 加拿大';
  d.zh['stp.rackoff.fact'] = '1985 年与 Goldwasser、Micali 合写的《可证明安全性的密码学协议》论文构成了 ZKP 的完备、可靠性、零知识三大定义——他的合同游戏化演示题是证明中经典的引理论述。';
  d.en['stp.rackoff.fact'] = 'The 1985 paper with Goldwasser and Micali established the completeness-soundness-zero-knowledge trinity; his contract-signing protocol remains a classic.';
  d.zh['stp.gentry.name'] = '克雷格·金特里'; d.en['stp.gentry.name'] = 'Craig Gentry';
  d.zh['stp.gentry.icon'] = '🧮'; d.en['stp.gentry.icon'] = '🧮';
  d.zh['stp.gentry.role'] = '密码学家 · 全同态加密第一人'; d.en['stp.gentry.role'] = 'First practical fully homomorphic encryption';
  d.zh['stp.gentry.era'] = '1976– · 美国'; d.en['stp.gentry.era'] = '1976– · 美国';
  d.zh['stp.gentry.fact'] = '2009 年在斯坦福博士论文中首次提供了在任何计算上不需要解密的加密方案——当年被《泰晤士报》称为「密码学圣杯」。9 年后 Google 同态云面世。';
  d.en['stp.gentry.fact'] = 'His 2009 PhD dissertation gave the first encryption that allows arbitrary computation without decryption, hailed as the cryptographic holy grail.';
  d.zh['stp.chaum.name'] = '大卫·肖姆'; d.en['stp.chaum.name'] = 'David Chaum';
  d.zh['stp.chaum.icon'] = '🪙'; d.en['stp.chaum.icon'] = '🪙';
  d.zh['stp.chaum.role'] = '密码学家 · 电子现金与匿名协议之父'; d.en['stp.chaum.role'] = 'Father of e-cash and anonymity protocols';
  d.zh['stp.chaum.era'] = '1955– · 美国/比利时'; d.en['stp.chaum.era'] = '1955– · 美国/比利时';
  d.zh['stp.chaum.fact'] = '1981 年发表《不可追踪的邮件》开创邮件匿名学；1983 年设计盲签名，直接促成数字货币与匿名投票——他 1995 年的 DigiCash 是第一个尝试。';
  d.en['stp.chaum.fact'] = 'The 1981 untraceable mail paper founded anonymity research; 1983 blind signatures seeded e-cash and anonymous voting — DigiCash was his 1995 attempt.';
  d.zh['stp.bernstein.name'] = '丹尼尔·伯恩斯坦'; d.en['stp.bernstein.name'] = 'Daniel J. Bernstein';
  d.zh['stp.bernstein.icon'] = '🦉'; d.en['stp.bernstein.icon'] = '🦉';
  d.zh['stp.bernstein.role'] = '密码学家 · 曲线 25519 与 ChaCha20 之父'; d.en['stp.bernstein.role'] = 'Creator of Curve25519, ChaCha20 and Poly1305';
  d.zh['stp.bernstein.era'] = '1971– · 美国'; d.en['stp.bernstein.era'] = '1971– · 美国';
  d.zh['stp.bernstein.fact'] = '在他 2005 年设计 Curve25519 之前，椭圆曲线是「专利疑云缠绕的学科」——他选择开源曲线并将其与快速常数时间实现绑定。他是现代安全实现的两位守护者之一。';
  d.en['stp.bernstein.fact'] = 'His 2005 Curve25519, ChaCha20 and Poly1305 became TLS 1.3 default — and his djb2 hash roams this very site.';
  d.zh['stp.matsui.name'] = '三宅满'; d.en['stp.matsui.name'] = 'Mitsuru Matsui';
  d.zh['stp.matsui.icon'] = '🎯'; d.en['stp.matsui.icon'] = '🎯';
  d.zh['stp.matsui.role'] = '密码学家 · 线性分析发明者'; d.en['stp.matsui.role'] = 'Founder of linear cryptanalysis';
  d.zh['stp.matsui.era'] = '1961– · 日本'; d.en['stp.matsui.era'] = '1961– · 日本';
  d.zh['stp.matsui.fact'] = '1993 年他发表线性密码分析，用 2^43 已知明文攻破 DES 16 轮；他的名字与 Biham 的差分分析并列，成为现代分组密码评估的双引擎。';
  d.en['stp.matsui.fact'] = 'His 1993 linear cryptanalysis broke 16-round DES with 2^43 known plaintexts; with Biham\'s differential analysis it made modern block-cipher evaluation possible.';
  d.zh['stp.biham.name'] = '伊莱·比哈姆'; d.en['stp.biham.name'] = 'Eli Biham';
  d.zh['stp.biham.icon'] = '🔬'; d.en['stp.biham.icon'] = '🔬';
  d.zh['stp.biham.role'] = '密码学家 · 差分分析发明者'; d.en['stp.biham.role'] = 'Founder of differential cryptanalysis';
  d.zh['stp.biham.era'] = '1960– · 以色列'; d.en['stp.biham.era'] = '1960– · 以色列';
  d.zh['stp.biham.fact'] = '1990 年与 Shamir 合作发表差分攻击，快 到 IBM 不得不承认 DES 的替换置换盒对差分具有独特防御——这是算法学会给自己设计免疫系统的第一例。';
  d.en['stp.biham.fact'] = 'His 1990 attack with Shamir on DES, differential analysis, proved that IBM designed the S-boxes to resist it — the first known design immune to the new attack.';
})();

(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.zygalski.name'] = '亨里克·齐加尔斯基'; d.en['stp.zygalski.name'] = 'Henryk Zygalski';
  d.zh['stp.zygalski.icon'] = '🕳️'; d.en['stp.zygalski.icon'] = '🕳️';
  d.zh['stp.zygalski.role'] = '波兰密码学家 · Enigma 破译三杰之一'; d.en['stp.zygalski.role'] = 'Polish mathematician · one of the Enigma trio';
  d.zh['stp.zygalski.era'] = '1908–1978 · 波兰/英国'; d.en['stp.zygalski.era'] = 'Poland/UK';
  d.zh['stp.zygalski.fact'] = '1938 年发明「齐加尔斯基打孔片」，把 Enigma 轮序筛选从手工变成机械比对；战前与雷耶夫斯基、鲁日茨基重构出德军 Enigma。战后因《官方机密法》隐姓埋名在英国教书，身份到 1970 年代才被承认。';
  d.en['stp.zygalski.fact'] = 'His 1938 perforated Zygalski sheets mechanised the rotor-elimination sieve; with Rejewski and Różycki he rebuilt German Enigma before the war. Post-war secrecy kept him teaching anonymously in Britain until the 1970s.';
  d.zh['stp.zygalski.bio'] = '数学家出身，业余痴迷棋类；生前从未公开讲述破译经历——直到 1978 年去世，作品才被历史学家重新发现。';
  d.en['stp.zygalski.bio'] = 'A mathematician by training and a chess enthusiast, he never spoke publicly about his codebreaking until his death in 1978.';
  d.zh['stp.zygalski.quote'] = '—'; d.en['stp.zygalski.quote'] = '—';
  d.zh['stp.rozycki.name'] = '耶日·鲁日茨基'; d.en['stp.rozycki.name'] = 'Jerzy Różycki';
  d.zh['stp.rozycki.icon'] = '🧭'; d.en['stp.rozycki.icon'] = '🧭';
  d.zh['stp.rozycki.role'] = '波兰密码学家 ·「钟法」发明者'; d.en['stp.rozycki.role'] = 'Polish mathematician · inventor of the clock method';
  d.zh['stp.rozycki.era'] = '1909–1942 · 波兰'; d.en['stp.rozycki.era'] = 'Poland';
  d.zh['stp.rozycki.fact'] = '1930 年代中期发明的「钟法（clock method）」能从电文首字母推算 Enigma 每日转子设置；1942 年 1 月在地中海客轮「拉姆 II 号」海难中遇难——三杰中唯一没能看到胜利的人。';
  d.en['stp.rozycki.fact'] = 'His mid-1930s clock method inferred Enigma\'s daily rotor settings from message prefixes; in January 1942 he drowned when the passenger ship Lamoricière sank — the only member of the trio not to see victory.';
  d.zh['stp.rozycki.bio'] = '波兰三杰中最年轻的一位；他的「钟法」在雷耶夫斯基的数学重构之外补上了工程化的一环。';
  d.en['stp.rozycki.bio'] = 'The youngest of the Polish trio, he added the engineering piece alongside Rejewski\'s mathematics.';
  d.zh['stp.rozycki.quote'] = '—'; d.en['stp.rozycki.quote'] = '—';
  d.zh['stp.tiltman.name'] = '约翰·蒂尔特曼'; d.en['stp.tiltman.name'] = 'John Tiltman';
  d.zh['stp.tiltman.icon'] = '🗣️'; d.en['stp.tiltman.icon'] = '🗣️';
  d.zh['stp.tiltman.role'] = '英国密码学家 · VENONA 破译主帅'; d.en['stp.tiltman.role'] = 'British codebreaker · lead on VENONA';
  d.zh['stp.tiltman.era'] = '1894–1982 · 英国'; d.en['stp.tiltman.era'] = 'United Kingdom';
  d.zh['stp.tiltman.fact'] = '二战破译率最高的密码学家之一，精通日文、中文与俄文；1940 年代中期转入 VENONA，破解出 KGB 一次性密码本被复用的最早证据，并用「金发女郎」线索撬开苏联间谍网。';
  d.en['stp.tiltman.fact'] = 'One of the war\'s most prolific codebreakers, fluent in Japanese, Chinese and Russian; from the mid-1940s he led VENONA\'s break-ins, exposing KGB pad reuse and the "Blonde" opening into Soviet networks.';
  d.zh['stp.tiltman.bio'] = '被同事形容为「用直觉解题」的语言天才；他向新人们讲授破译时最常说的一句话是「先别急着分析，先把它读完」。';
  d.en['stp.tiltman.bio'] = 'Described as a linguistic genius who solved problems "by feel"; his advice to newcomers was famously "read it first, analyse later".';
  d.zh['stp.tiltman.quote'] = '—'; d.en['stp.tiltman.quote'] = '—';
  d.zh['stp.ekert.name'] = '阿图尔·埃克特'; d.en['stp.ekert.name'] = 'Artur Ekert';
  d.zh['stp.ekert.icon'] = '🔗'; d.en['stp.ekert.icon'] = '🔗';
  d.zh['stp.ekert.role'] = '量子密码学家 · E91 协议提出者'; d.en['stp.ekert.role'] = 'Quantum cryptographer · author of E91';
  d.zh['stp.ekert.era'] = '1961– · 英国'; d.en['stp.ekert.era'] = 'United Kingdom';
  d.zh['stp.ekert.fact'] = '1991 年提出 E91：用贝尔不等式与量子纠缠检测窃听——只要纠缠关联被测量破坏，Eve 就留下指纹。它与 BB84 共同构成量子密钥分发的两条路线。';
  d.en['stp.ekert.fact'] = 'In 1991 he proposed E91: detect eavesdropping through Bell inequalities and quantum entanglement — any measurement disturbs the correlations and Eve leaves fingerprints. With BB84 it defines QKD\'s two routes.';
  d.zh['stp.ekert.bio'] = '受信息论与张量纠缠双线训练；他坚持「安全来源是量子关联而非单个光子」这一视角塑造了整个纠缠 QKD 学派。';
  d.en['stp.ekert.bio'] = 'Trained across physics and information theory, he championed the view that entanglement, not single photons, is the true source of quantum security.';
  d.zh['stp.ekert.quote'] = '—'; d.en['stp.ekert.quote'] = '—';
  d.zh['stp.regev.name'] = '奥德·雷格夫'; d.en['stp.regev.name'] = 'Oded Regev';
  d.zh['stp.regev.icon'] = '🧮'; d.en['stp.regev.icon'] = '🧮';
  d.zh['stp.regev.role'] = '计算机科学家 · LWE 问题奠基者'; d.en['stp.regev.role'] = 'Computer scientist · author of LWE';
  d.zh['stp.regev.era'] = '1979– · 以色列'; d.en['stp.regev.era'] = 'Israel';
  d.zh['stp.regev.fact'] = '2005 年定义「带误差学习」（Learning With Errors）并证明最坏情况格难题可归约到它——Kyber/ML-KEM 等后量子标准建立在 LWE 框架上，是现代格密码的支点。';
  d.en['stp.regev.fact'] = 'In 2005 he defined Learning With Errors and proved worst-case lattice problems reduce to it — Kyber/ML-KEM and the post-quantum era rest on the LWE frame.';
  d.zh['stp.regev.bio'] = 'LWE 之前格密码只是「看似难」；他给出的归约把「平均情况」与「最坏情况」连成一条安全链。';
  d.en['stp.regev.bio'] = 'Before LWE, lattice crypto merely "seemed hard"; his reduction chained average-case security to worst-case hardness.';
  d.zh['stp.regev.quote'] = '—'; d.en['stp.regev.quote'] = '—';
  d.zh['stp.kocher.name'] = '保罗·科赫尔'; d.en['stp.kocher.name'] = 'Paul Kocher';
  d.zh['stp.kocher.icon'] = '⌛'; d.en['stp.kocher.icon'] = '⌛';
  d.zh['stp.kocher.role'] = '密码学家 · 侧信道攻击奠基人'; d.en['stp.kocher.role'] = 'Cryptographer · founder of side-channel analysis';
  d.zh['stp.kocher.era'] = '1965– · 美国'; d.en['stp.kocher.era'] = 'United States';
  d.zh['stp.kocher.fact'] = '1996 年发表首篇时序攻击论文：仅凭 RSA 解密耗时的差异恢复密钥比特；同年与 Jaffe、Jun 提出差分功耗分析（DPA），并指出无校验的 CRT-RSA 会中故障注入——「恒定时间」从此成为芯片安全铁律。';
  d.en['stp.kocher.fact'] = 'His 1996 timing-attack paper recovered RSA key bits from decryption time alone; the same year brought DPA with Jaffe and Jun plus the CRT fault-injection flaw — "constant time" became silicon law.';
  d.zh['stp.kocher.bio'] = '日后他还参与早期 SSL 3.0 的设计；他把密码学从「数学证明」拖回「工程实现」的战场。';
  d.en['stp.kocher.bio'] = 'Later involved in early SSL 3.0; he dragged cryptography back from pure proofs to the battlefield of implementations.';
  d.zh['stp.kocher.quote'] = '—'; d.en['stp.kocher.quote'] = '—';
  d.zh['stp.yao.name'] = '姚期智'; d.en['stp.yao.name'] = 'Andrew Chi-Chih Yao';
  d.zh['stp.yao.icon'] = '🤝'; d.en['stp.yao.icon'] = '🤝';
  d.zh['stp.yao.role'] = '计算机科学家 · 安全多方计算开创者'; d.en['stp.yao.role'] = 'Computer scientist · founder of secure computation';
  d.zh['stp.yao.era'] = '1946– · 美籍华裔'; d.en['stp.yao.era'] = 'USA/China';
  d.zh['stp.yao.fact'] = '1979 年建立通信复杂度理论；1982 年发表的「百万富翁问题」首次让两方在不泄露各自输入的情况下比较大小——安全多方计算（MPC）由此诞生。2000 年凭计算复杂性获图灵奖，2004 年回国执教清华。';
  d.en['stp.yao.fact'] = 'His 1979 communication-complexity theory and the 1982 Millionaires\' Problem let two parties compare secrets without revealing them — MPC was born. The 2000 Turing Award (complexity theory) brought him back to Tsinghua in 2004.';
  d.zh['stp.yao.bio'] = '物理出身转行理论计算机；被问及「密码学是什么」时他常说：让不信任的人一起做事的那门学科。';
  d.en['stp.yao.bio'] = 'Trained as a physicist, he calls cryptography the discipline of making untrusted parties cooperate.';
  d.zh['stp.yao.quote'] = '—'; d.en['stp.yao.quote'] = '—';
  d.zh['stp.rabin.name'] = '迈克尔·拉宾'; d.en['stp.rabin.name'] = 'Michael O. Rabin';
  d.zh['stp.rabin.icon'] = '🔑'; d.en['stp.rabin.icon'] = '🔑';
  d.zh['stp.rabin.role'] = '计算机科学家 · 公钥与概率算法先驱'; d.en['stp.rabin.role'] = 'Computer scientist · pioneer of public key & probability';
  d.zh['stp.rabin.era'] = '1931– · 以色列'; d.en['stp.rabin.era'] = 'Israel';
  d.zh['stp.rabin.fact'] = '1976 年以非确定性机获图灵奖；1977 年提出基于二次剩余的 Rabin 密码系统（破解它等价于大数分解）；1979 年概率素性测试；1981 年不经意传输（OT）——安全计算最基础的原语之一。';
  d.en['stp.rabin.fact'] = 'Turing Award 1976 for nondeterministic machines; the 1977 Rabin encryption (breaking it ≡ factoring); 1979 probabilistic primality; and 1981 oblivious transfer — a foundational primitive of secure computing.';
  d.zh['stp.rabin.bio'] = '习惯在散步时思考，自称成果大半来自漫无边际的散步；他的素性测试直接服务了后来 RSA 的密钥生成。';
  d.en['stp.rabin.bio'] = 'A famously peripatetic thinker, he attributes much of his work to long walks; his primality test became the engine of RSA key generation.';
  d.zh['stp.rabin.quote'] = '—'; d.en['stp.rabin.quote'] = '—';
})();
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['stp.williamson.name'] = '马尔科姆·威廉森'; d.en['stp.williamson.name'] = 'Malcolm Williamson';
  d.zh['stp.williamson.icon'] = '🔢'; d.en['stp.williamson.icon'] = '🔢';
  d.zh['stp.williamson.role'] = '英国密码学家 · GCHQ 密钥交换先驱'; d.en['stp.williamson.role'] = 'British cryptologist · GCHQ key-exchange pioneer';
  d.zh['stp.williamson.era'] = '1950–2013 · 英国'; d.en['stp.williamson.era'] = 'United Kingdom';
  d.zh['stp.williamson.fact'] = '1974 年在 GCHQ 独立构想出类 Diffie-Hellman 的公钥交换思想，因保密三十余年不为世知；1997 年 GCHQ 解密历史后，他与 Ellis、Cocks 的「三分盘」故事才公开——与公开学术界发现相映成趣。';
  d.en['stp.williamson.fact'] = 'In 1974 he independently conceived a public-key exchange much like Diffie-Hellman while at GCHQ, classified for decades; only in 1997 did the ministry declassify the history. The Ellis-Cocks-Williamson trio mirrors the public discovery.';
  d.zh['stp.williamson.bio'] = 'undefined';
  d.en['stp.williamson.bio'] = 'undefined';
  d.zh['stp.williamson.quote'] = '—'; d.en['stp.williamson.quote'] = '—';
  d.zh['stp.playfair.name'] = '莱昂·普莱费尔勋爵'; d.en['stp.playfair.name'] = 'Lyon Playfair';
  d.zh['stp.playfair.icon'] = '🃏'; d.en['stp.playfair.icon'] = '🃏';
  d.zh['stp.playfair.role'] = '科学家 · Playfair 密码得名者'; d.en['stp.playfair.role'] = 'Scientist · namesake of the Playfair cipher';
  d.zh['stp.playfair.era'] = '1818–1898 · 英国'; d.en['stp.playfair.era'] = 'United Kingdom';
  d.zh['stp.playfair.fact'] = '数学家惠斯通发明双字母密码后，普莱费尔于 1854 年将它递交给战争部并大力推广，以至于后世以他的名字命名——历史上的「以推广者命名」典型：发明归一人，冠名归另一人。';
  d.en['stp.playfair.fact'] = 'After Wheatstone invented the digraph cipher, Playfair handed it to the War Office in 1854 and championed it — so history named it after him. A classic case of inventor versus popularizer.';
  d.zh['stp.playfair.bio'] = 'undefined';
  d.en['stp.playfair.bio'] = 'undefined';
  d.zh['stp.playfair.quote'] = '—'; d.en['stp.playfair.quote'] = '—';
  d.zh['stp.rowlett.name'] = '弗兰克·罗利特'; d.en['stp.rowlett.name'] = 'Frank Rowlett';
  d.zh['stp.rowlett.icon'] = '📻'; d.en['stp.rowlett.icon'] = '📻';
  d.zh['stp.rowlett.role'] = '美国密码学家 · 紫密破译主力'; d.en['stp.rowlett.role'] = 'US cryptologist · core Purple breaker';
  d.zh['stp.rowlett.era'] = '1908–1998 · 美国'; d.en['stp.rowlett.era'] = 'United States';
  d.zh['stp.rowlett.fact'] = '弗里德曼的亲传与同僚，1940 年带队攻破日本「紫密」，之后主持美军密码机构建设；他的整个职业生涯几乎与美国陆军密码学共进退。';
  d.en['stp.rowlett.fact'] = 'Trained by and working beside Friedman, he led the 1940 break of the Japanese Purple machine, then built the Armys cryptologic institutions — his career tracks the whole rise of US army cryptology.';
  d.zh['stp.rowlett.bio'] = 'undefined';
  d.en['stp.rowlett.bio'] = 'undefined';
  d.zh['stp.rowlett.quote'] = '—'; d.en['stp.rowlett.quote'] = '—';
  d.zh['stp.safford.name'] = '劳伦斯·萨福德'; d.en['stp.safford.name'] = 'Laurance Safford';
  d.zh['stp.safford.icon'] = '🌊'; d.en['stp.safford.icon'] = '🌊';
  d.zh['stp.safford.role'] = '美国海军密码局长 · OP-20-G 主官'; d.en['stp.safford.role'] = 'Chief of US Navy cryptology · OP-20-G';
  d.zh['stp.safford.era'] = '1893–1973 · 美国'; d.en['stp.safford.era'] = 'United States';
  d.zh['stp.safford.fact'] = '太平洋战争前夜美国海军密码破译的实权人物：指挥 OP-20-G 对日本海军密码的攻势，1942 年 AF 淡水謎局的判断链条上，他所在的机构正是关键一环。';
  d.en['stp.safford.fact'] = 'The operational chief of Navy cryptology before and during the Pacific war: under him OP-20-G pressed the Japanese naval codes, a key link in the 1942 AF fresh-water judgment.';
  d.zh['stp.safford.bio'] = 'undefined';
  d.en['stp.safford.bio'] = 'undefined';
  d.zh['stp.safford.quote'] = '—'; d.en['stp.safford.quote'] = '—';
  d.zh['stp.newman.name'] = '马克斯·纽曼'; d.en['stp.newman.name'] = 'Max Newman';
  d.zh['stp.newman.icon'] = '💻'; d.en['stp.newman.icon'] = '💻';
  d.zh['stp.newman.role'] = '英国数学家 · Colossus 项目主持者'; d.en['stp.newman.role'] = 'British mathematician · led Colossus';
  d.zh['stp.newman.era'] = '1897–1984 · 英国'; d.en['stp.newman.era'] = 'United Kingdom';
  d.zh['stp.newman.fact'] = '1942 年主持「新曼行动」：把图灵式机器思想用于破译洛伦兹（Tunny），催生了世界第一台可编程电子计算机 Colossus；战后他组建曼彻斯特计算实验室，计算机科学正式登台。';
  d.en['stp.newman.fact'] = 'In 1942 he led the Newmanry: turning machine ideas onto Tunny and bringing about Colossus, the first programmable electronic computer. After the war his Manchester computing laboratory launched computer science.';
  d.zh['stp.newman.bio'] = 'undefined';
  d.en['stp.newman.bio'] = 'undefined';
  d.zh['stp.newman.quote'] = '—'; d.en['stp.newman.quote'] = '—';
  d.zh['stp.tutte.name'] = '威廉·图特'; d.en['stp.tutte.name'] = 'Bill Tutte';
  d.zh['stp.tutte.icon'] = '🧩'; d.en['stp.tutte.icon'] = '🧩';
  d.zh['stp.tutte.role'] = '英国密码学家 · 洛伦兹结构破解者'; d.en['stp.tutte.role'] = 'British cryptologist · cracked Lorenz structure';
  d.zh['stp.tutte.era'] = '1917–2002 · 英国'; d.en['stp.tutte.era'] = 'United Kingdom';
  d.zh['stp.tutte.fact'] = '1942 年凭借两个深度电文对，用纯逻辑推算出德军 Tunny 十二轮结构与轮齿周期——没有截获整机，却造出了整机的逻辑模型；战后成为组合数学领域的世界级学者。';
  d.en['stp.tutte.fact'] = 'In 1942, from only two depth messages, he deduced by pure logic the twelve-wheel structure and cycle lengths of Tunny — reconstructing a machine he had never seen. Postwar he became a world-class combinatorialist.';
  d.zh['stp.tutte.bio'] = 'undefined';
  d.en['stp.tutte.bio'] = 'undefined';
  d.zh['stp.tutte.quote'] = '—'; d.en['stp.tutte.quote'] = '—';
  d.zh['stp.roberts.name'] = '杰里·罗伯茨'; d.en['stp.roberts.name'] = 'Jerry Roberts';
  d.zh['stp.roberts.icon'] = '🗂️'; d.en['stp.roberts.icon'] = '🗂️';
  d.zh['stp.roberts.role'] = '英国密码学家 · Testery 首席之一'; d.en['stp.roberts.role'] = 'British codebreaker · one of the Testery chiefs';
  d.zh['stp.roberts.era'] = '1920–2014 · 英国'; d.en['stp.roberts.era'] = 'United Kingdom';
  d.zh['stp.roberts.fact'] = '布莱切利园 Tunny 破译组（Testery）的四名首席密码学家之一，主持手工破译工艺流程；战后恪守保密数十年，晚年才在镜头前讲述这段历史——直到离世仍是官方史中最晚发声的人之一。';
  d.en['stp.roberts.fact'] = 'One of the four chief codebreakers at Testery, he ran the manual Tunny workflow. Bound by secrecy for decades, he only spoke publicly in old age — among the last voices of the Bletchley story.';
  d.zh['stp.roberts.bio'] = 'undefined';
  d.en['stp.roberts.bio'] = 'undefined';
  d.zh['stp.roberts.quote'] = '—'; d.en['stp.roberts.quote'] = '—';
  d.zh['stp.davies.name'] = '唐纳德·戴维斯'; d.en['stp.davies.name'] = 'Donald Davies';
  d.zh['stp.davies.icon'] = '🧬'; d.en['stp.davies.icon'] = '🧬';
  d.zh['stp.davies.role'] = '英国计算机科学家 · 分组密码先驱'; d.en['stp.davies.role'] = 'British computer scientist · block-cipher pioneer';
  d.zh['stp.davies.era'] = '1924–2000 · 英国'; d.en['stp.davies.era'] = 'United Kingdom';
  d.zh['stp.davies.fact'] = '国家物理实验室的计算机科学家：分组密码设计与安全评估的早期倡导者（他的工作与 DES 的起源相互交织），同时以「分组交换」网络技术共同创立者的身份留名计算机史。';
  d.en['stp.davies.fact'] = 'At the National Physical Laboratory he championed early block-cipher design and security assessment — his work intersects the DES origin story — and he co-founded packet switching, a name in computer-network history alike.';
  d.zh['stp.davies.bio'] = 'undefined';
  d.en['stp.davies.bio'] = 'undefined';
  d.zh['stp.davies.quote'] = '—'; d.en['stp.davies.quote'] = '—';
  d.zh['stp.vonneumann.name'] = '约翰·冯·诺依曼'; d.en['stp.vonneumann.name'] = 'John von Neumann';
  d.zh['stp.vonneumann.icon'] = '🧠'; d.en['stp.vonneumann.icon'] = '🧠';
  d.zh['stp.vonneumann.role'] = '数学家 · 现代计算机架构之父'; d.en['stp.vonneumann.role'] = 'Mathematician · father of the stored-program architecture';
  d.zh['stp.vonneumann.era'] = '1903–1957 · 匈牙利/美国'; d.en['stp.vonneumann.era'] = 'Hungary/USA';
  d.zh['stp.vonneumann.fact'] = '「冯·诺依曼架构」（程序与数据同存于存储器）奠定了计算机的形态，而 ALL 密码破译机械都长在这台机器上；他在曼哈顿计划期间的博约与保密实践，也是密码工程史的注脚。';
  d.en['stp.vonneumann.fact'] = 'The von Neumann architecture — program and data in one memory — defines every computer, and every modern cryptanalytic machine stands on it. His wartime security practices at Los Alamos are a footnote in cipher history.';
  d.zh['stp.vonneumann.bio'] = 'undefined';
  d.en['stp.vonneumann.bio'] = 'undefined';
  d.zh['stp.vonneumann.quote'] = '—'; d.en['stp.vonneumann.quote'] = '—';
  d.zh['stp.gauss.name'] = '卡尔·弗里德里希·高斯'; d.en['stp.gauss.name'] = 'Carl Friedrich Gauss';
  d.zh['stp.gauss.icon'] = '∑'; d.en['stp.gauss.icon'] = '∑';
  d.zh['stp.gauss.role'] = '数学家 · 数论之王'; d.en['stp.gauss.role'] = 'Mathematician · prince of number theory';
  d.zh['stp.gauss.era'] = '1777–1855 · 德国'; d.en['stp.gauss.era'] = 'Germany';
  d.zh['stp.gauss.fact'] = '同余理论、二次剩余、二次互反律——RSA 的模运算与离散对数的地基几乎全在他笔下奠基；十九世纪「为数学而数学」的纯粹性，意外成为二十世纪密码学的承重墙。';
  d.en['stp.gauss.fact'] = 'Congruences, quadratic residues, reciprocity: the floors RSA and discrete logarithms stand on were laid by him. His pure mathematics of the 1800s became the load-bearing wall of twentieth-century cryptography.';
  d.zh['stp.gauss.bio'] = 'undefined';
  d.en['stp.gauss.bio'] = 'undefined';
  d.zh['stp.gauss.quote'] = '—'; d.en['stp.gauss.quote'] = '—';
  d.zh['stp.galois.name'] = '埃瓦里斯特·伽罗瓦'; d.en['stp.galois.name'] = 'Évariste Galois';
  d.zh['stp.galois.icon'] = '🪞'; d.en['stp.galois.icon'] = '🪞';
  d.zh['stp.galois.role'] = '数学家 · 群论创立者'; d.en['stp.galois.role'] = 'Mathematician · founder of group theory';
  d.zh['stp.galois.era'] = '1811–1832 · 法国'; d.en['stp.galois.era'] = 'France';
  d.zh['stp.galois.fact'] = '二十岁创立群论，二十岁死于决斗——他的抽象代数在两百年后被 AES 的 S 盒、有限域 GF(2^8) 与椭圆曲线密码全面调用；密码学与代数的联姻，始于一场决斗夜的手稿。';
  d.en['stp.galois.fact'] = 'He founded group theory at twenty and died in a duel at twenty. Two centuries later his abstractions power AES S-boxes, GF(2^8) and elliptic-curve crypto — cryptography itself to algebra began in his night-before-duel manuscripts.';
  d.zh['stp.galois.bio'] = 'undefined';
  d.en['stp.galois.bio'] = 'undefined';
  d.zh['stp.galois.quote'] = '—'; d.en['stp.galois.quote'] = '—';
  d.zh['stp.heninger.name'] = '娜迪娅·赫宁格'; d.en['stp.heninger.name'] = 'Nadia Heninger';
  d.zh['stp.heninger.icon'] = '🛰️'; d.en['stp.heninger.icon'] = '🛰️';
  d.zh['stp.heninger.role'] = '现代密码工程师 · 实证安全研究者'; d.en['stp.heninger.role'] = 'Modern security researcher · empirical cryptography';
  d.zh['stp.heninger.era'] = '1980s– · 美国'; d.en['stp.heninger.era'] = 'United States';
  d.zh['stp.heninger.fact'] = '发起「Mining Your Ps and Qs」系列研究：对互联网上数百万公钥做批量实证，发现大量误用导致的弱密钥（共享素数、熵不足）——把「理论正确、实现翻车」变成可统计的工程学。';
  d.en['stp.heninger.fact'] = 'Her "Mining Your Ps and Qs" work empirically scanned millions of internet keys, exposing widespread weak keys from bad randomness and shared primes — turning implementation failure into measurable engineering evidence.';
  d.zh['stp.heninger.bio'] = 'undefined';
  d.en['stp.heninger.bio'] = 'undefined';
  d.zh['stp.heninger.quote'] = '—'; d.en['stp.heninger.quote'] = '—';
  d.zh['stp.morse.name'] = '塞缪尔·摩斯'; d.en['stp.morse.name'] = 'Samuel Morse';
  d.zh['stp.zengxisheng.name'] = '曾希圣'; d.en['stp.zengxisheng.name'] = 'Zeng Xisheng';
  d.zh['stp.zengxisheng.icon'] = '🔴'; d.en['stp.zengxisheng.icon'] = '🔴';
  d.zh['stp.zengxisheng.role'] = '红军无线电密码破译奠基人'; d.en['stp.zengxisheng.role'] = 'Founder of Red Army radio codebreaking';
  d.zh['stp.zengxisheng.era'] = '1904–1968 · 中国'; d.en['stp.zengxisheng.era'] = '1904–1968 · China';
  d.zh['stp.zengxisheng.fact'] = '冷知识：1930 年龙冈战斗缴获的半部电台成为红军无线电密码事业的开端——发报机损坏、收报机还能用，从不完整的设备“起家”。'; d.en['stp.zengxisheng.fact'] = 'Fun fact: the half radio captured at Longgang in 1930 — transmitter broken, receiver working — was the genesis of Red Army signals intelligence.';
  d.zh['stp.zengxisheng.bio'] = '曾希圣，1904 年生于湖南兴宁（今资兴）。1931 年起进入中央苏区红军无线电队伍，主持消息侦察与密码破译：从国军电报的蛛丝马迹中还原作战序列，长征途中持续保障。他领导的中革军委二局被誉为“红军的情报心脏”。'; d.en['stp.zengxisheng.bio'] = 'Born 1904 in Hunan, Zeng Xisheng joined the Red Army radio corps in 1931 and led signals intelligence and codebreaking: reconstructing enemy order-of-battle from telegraphic traces, sustaining the Long March. His Second Bureau was the “information heart of the Red Army”.';
  d.zh['stp.zengxisheng.quote'] = '「半部电台起家，一部电台测向。」（红军无线电突击队口号）'; d.en['stp.zengxisheng.quote'] = '“A half radio to start, one radio to find the bearing.” (Red Army radio corps slogan)';
  d.zh['stp.morse.icon'] = '📡'; d.en['stp.morse.icon'] = '📡';
  d.zh['stp.morse.role'] = '发明家 · 摩斯电码之父'; d.en['stp.morse.role'] = 'Inventor · father of the Morse code';
  d.zh['stp.morse.era'] = '1791–1872 · 美国'; d.en['stp.morse.era'] = 'United States';
  d.zh['stp.morse.fact'] = '1830 年代发明电报并设计出点划编码，1844 年「What hath God wrought」开启第一封远距电子报文——人类第一次把信息与传输物分离，「编码」从此进入大众史。';
  d.en['stp.morse.fact'] = 'He built the electric telegraph in the 1830s and its dot-dash code; the 1844 "What hath God wrought" opened the first long-distance electronic message — separating information from its carrier for the first time in mass history.';
  d.zh['stp.morse.bio'] = 'undefined';
  d.en['stp.morse.bio'] = 'undefined';
  d.zh['stp.morse.quote'] = '—'; d.en['stp.morse.quote'] = '—';
  d.zh['stp.miller.name'] = '弗兰克·米勒'; d.en['stp.miller.name'] = 'Frank Miller';
  d.zh['stp.miller.icon'] = '📜'; d.en['stp.miller.icon'] = '📜';
  d.zh['stp.miller.role'] = '银行家 · 一次性密钥本先驱'; d.en['stp.miller.role'] = 'Banker · one-time-key pioneer';
  d.zh['stp.miller.era'] = '1842–1911 · 美国'; d.en['stp.miller.era'] = 'United States';
  d.zh['stp.miller.fact'] = '1882 年在一份银行家研讨文集中描述了「一次性密钥集」：密钥与密文等长、只用一次——比 Vernam 早三十七年、比香农的证明早六十余年，是 OTP 思想最早的公开记载之一。';
  d.en['stp.miller.fact'] = 'In 1882 he described one-time key sets in a bankers lecture pamphlet: keys as long as the message, used once — thirty-seven years before Vernam and sixty-plus before a proof by Shannon. One of the earliest public OTP records.';
  d.zh['stp.miller.bio'] = 'undefined';
  d.en['stp.miller.bio'] = 'undefined';
  d.zh['stp.miller.quote'] = '—'; d.en['stp.miller.quote'] = '—';
})();
(function () {
  var d = Arcade.i18n.dicts;
  d.zh['sta.rockex-msg.name'] = 'Rockex 密电'; d.en['sta.rockex-msg.name'] = 'A Rockex Dispatch';
  d.zh['sta.rockex-msg.era'] = '1946–1960s · 英国/英联邦'; d.en['sta.rockex-msg.era'] = '1946–1960s · UK & Commonwealth';
  d.zh['sta.rockex-msg.desc'] = '英国战后外交电报专用机 Rockex 输出的加密电文一份：滚轮密码机的商用前夜，外交密电从此告别手工密码。';
  d.en['sta.rockex-msg.desc'] = 'A sample dispatch generated by Rockex, the postwar British diplomatic machine: the commercial twilight of cipher machines replaced hand ciphers for serious traffic.';
  d.zh['sta.rockex-msg.text'] = '原文节选为五分钟电文样例，密文以 5 字母组印制——收报方持同一转轮设定即可还原。';
  d.en['sta.rockex-msg.text'] = 'The excerpt is a five-minute sample dispatch printed in five-letter groups; a receiver with the same rotor settings reproduces the plaintext.';
  d.zh['sta.turing1936.name'] = '图灵 1936 年论文页'; d.en['sta.turing1936.name'] = 'Turing 1936 Paper Page';
  d.zh['sta.turing1936.era'] = '1936 · 英国'; d.en['sta.turing1936.era'] = '1936 · United Kingdom';
  d.zh['sta.turing1936.desc'] = '《论可计算数及其在判定问题中的应用》首页：抽象机、停机问题——「能算什么」第一次被严格界定，现代计算机与一切密码破译机的思想起点。';
  d.en['sta.turing1936.desc'] = 'The first page of On Computable Numbers: the abstract machine, the halting problem — the first rigorous line between what can and cannot be computed, the intellectual origin of every modern machine, including the codebreakers.';
  d.zh['sta.turing1936.text'] = '该页把「机械执行规则」形式化为无限纸带与读写头；十年后人类的密码机与其在布莱切利园相遇。';
  d.en['sta.turing1936.text'] = 'The page formalizes mechanical rule-following as a tape and a head; a decade later mans cipher machines would meet it at Bletchley.';
  d.zh['sta.letsencrypt.name'] = 'Let’s Encrypt 首张证书'; d.en['sta.letsencrypt.name'] = 'First Let’s Encrypt Certificate';
  d.zh['sta.letsencrypt.era'] = '2015 · 互联网'; d.en['sta.letsencrypt.era'] = '2015 · Internet';
  d.zh['sta.letsencrypt.desc'] = '2015 年 9 月签发的首张免费 DV 证书：自动化 ACME 协议让 HTTPS 从「要钱要手续」变成「一键可得」——全球加密流量占比随即过半。';
  d.en['sta.letsencrypt.desc'] = 'The first free domain-validated certificate issued in September 2015: ACME automation turned HTTPS from paperwork into a default, and the encrypted share of global traffic crossed half.';
  d.zh['sta.letsencrypt.text'] = '证书链包含中间 CA ISRG Root X1；公钥只用于证明「域名控制」，是「证书=身份锚点」的最简现代注脚。';
  d.en['sta.letsencrypt.text'] = 'The chain includes intermediate CA ISRG Root X1; the key proves only domain control — the simplest modern footnote that a certificate is an identity anchor.';
  d.zh['sta.spectre-paper.name'] = 'Spectre/Meltdown 论文页'; d.en['sta.spectre-paper.name'] = 'Spectre/Meltdown Paper Page';
  d.zh['sta.spectre-paper.era'] = '2018 · 美国'; d.en['sta.spectre-paper.era'] = '2018 · United States';
  d.zh['sta.spectre-paper.desc'] = '首篇公开论文的摘要页：CPU 推测执行留下的缓存痕迹可被侧信道读出——「代码零漏洞也可能泄露」成为芯片时代的警报。';
  d.en['sta.spectre-paper.desc'] = 'The abstract page of the first public paper: cache traces of speculative execution are readable via side channels — the alarm that flawless code can still leak in the chip era.';
  d.zh['sta.spectre-paper.text'] = '三篇论文（Spectre 变体 + Meltdown）同月公开，直接催生处理器微码补丁与「恒定时间+栅栏指令」的工程规范。';
  d.en['sta.spectre-paper.text'] = 'Spectre variants and Meltdown landed within a month, forcing microcode patches and constant-time plus fencing conventions in engineering.';
  d.zh['sta.cryptolaw.name'] = '《密码法》公布稿'; d.en['sta.cryptolaw.name'] = 'Cryptography Law Text';
  d.zh['sta.cryptolaw.era'] = '2019 公布 · 2020 施行 · 中国'; d.en['sta.cryptolaw.era'] = 'Published 2019 · effective 2020 · China';
  d.zh['sta.cryptolaw.desc'] = '《中华人民共和国密码法》公布稿首版：三类分级 + 商用密码市场准入——把算法合规写进国家法律，国密体系有了「法治底座」。';
  d.en['sta.cryptolaw.desc'] = 'The promulgated text of the Cryptography Law of the PRC: three tiers plus commercial market access — algorithm compliance as national law, the rule-of-law base under the SM ecosystem.';
  d.zh['sta.cryptolaw.text'] = '配套《商用密码管理条例》2023 年修订：检测认证、安全评估、进出口清单——从法条到可执行的市场规则。';
  d.en['sta.cryptolaw.text'] = 'The 2023 implementing regulation adds certification, assessment and import/export lists — from statute to executable market rules.';
})();