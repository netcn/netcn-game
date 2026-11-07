/* ============================================================
   背景音乐 Arcade.music —— Web Audio 程序化芯片音乐（chiptune）v3 · 极高质量
   零外部文件、完全离线、file:// 兼容。
   v3 升级（相比 v2）：
   · 音色引擎：每音符 3 振荡器分层（主波 + 谐波泛音 + 低八度），
     滤波器 ADSR 包络（音头开放→音尾闭合）、颤音 vibrato、
     立体声声像（旋律偏左/垫偏右/低音居中）、滑音 portamento
   · 鼓机：底鼓音高包络 + 军鼓（噪声带通 + 方波音调层）+ 踩镲切分，
     新增嗵鼓 tom / 吊镲 crash（大扫频）
   · 编曲深度：5 声部（旋律 / 副旋律 call-respond / 低音 / 和弦垫 / 16分琶音）
     + 鼓机；A-A-B-A 结构（主歌-主歌-桥段-主歌）128 步，旋律有起承转合
   · 混音：主总线软限幅（master 0.9 + 延迟返回 0.5），
     延迟与主路分离（delaySend/delayReturn）避免鼓声被回声糊掉
   曲目为站点原创（风格致敬经典，不复制受版权保护的原版旋律）。
   无 AudioContext 环境（Node 冒烟）自动静默降级。
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.music = (function () {
  var ctx = null, master = null, bus = null, noiseBuf = null;
  var delaySend = null, delayReturn = null;
  var enabled = true;
  var current = null, timer = null;
  var nextTime = 0, stepIdx = 0;
  var pending = null;

  /* ================= 曲目库 v3（128 步 = A-A-B-A 四段 × 32 步）
     notes：0 休止 / 数字=MIDI 音高 / 鼓记号（仅 drum 声部）
     part.detune 可选（失谐分）；part.pan 可选（声像 -1..1） */
  var SONGS = {
    /* ========== 大厅 · 标题画面：C 大调 I-V-vi-IV，温暖开阔 ========== */
    lobby: {
      bpm: 100, steps: 128,
      parts: [
        /* 旋律（A 段：C-Am-F-G；B 段：F-C-G 上行） */
        { wave: 'square', vol: 0.075, pan: -0.2,
          notes: [72,0,0,0,76,0,0,0,79,0,0,0,76,0,0,0,72,0,0,0,74,0,0,0,72,0,0,0,71,0,69,0,67,0,0,0,71,0,0,0,74,0,0,0,71,0,0,0,67,0,0,0,72,0,0,0,69,0,0,0,67,0,0,0,72,0,0,0,76,0,0,0,79,0,0,0,84,0,81,0,79,0,0,0,76,0,0,0,72,0,0,0,69,0,0,0,74,0,0,0,77,0,0,0,81,0,0,0,77,0,0,0,74,0,0,0,72,0,0,0,69,0,0,0,67,0,0,0] },
        /* 副旋律 call-respond（低八度对答，与旋律错位） */
        { wave: 'triangle', vol: 0.09, pan: 0.25,
          notes: [0,0,60,0,0,0,64,0,0,0,67,0,0,64,0,0,0,0,62,0,0,0,65,0,0,0,69,0,0,67,0,0,0,0,59,0,0,0,62,0,0,0,67,0,0,64,0,0,0,0,60,0,0,0,64,0,0,0,67,0,0,64,0,0,0,0,64,0,0,0,67,0,0,0,72,0,0,69,0,0,0,0,67,0,0,0,72,0,0,0,76,0,0,72,0,0,0,0,65,0,0,0,69,0,0,0,74,0,0,71,0,0,0,0,64,0,0,0,67,0,0,0,71,0,0,67,0,0] },
        /* 低音（根音 + 五度点缀） */
        { wave: 'triangle', vol: 0.20,
          notes: [48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        /* 和弦垫（sine 长音，五度堆叠） */
        { wave: 'sine', vol: 0.05, pan: 0.35,
          notes: [72,0,0,0,0,0,0,0,0,0,79,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,0,0,76,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,0,0,72,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,0,0,74,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        /* 鼓机（四平八稳 + 副歌重音） */
        { wave: 'drum', vol: 0.42,
          notes: ['k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0,'k',0,0,0,'h',0,0,0,'s',0,0,0,'h',0,0,0] }
      ]
    },
    /* ========== 大厅 B · 明亮琶音变奏：I-V-vi-IV 上行 ========== */
    lobby2: {
      bpm: 108, steps: 128,
      parts: [
        { wave: 'square', vol: 0.07, pan: -0.2,
          notes: [79,0,76,0,72,0,76,0, 79,0,84,0,79,0,76,0, 74,0,71,0,67,0,71,0, 74,0,79,0,74,0,71,0,
                  76,0,72,0,69,0,72,0, 76,0,81,0,76,0,72,0, 74,0,71,0,67,0,71,0, 74,0,79,0,74,0,71,0,
                  77,0,74,0,69,0,74,0, 77,0,81,0,77,0,74,0, 76,0,72,0,69,0,72,0, 76,0,79,0,76,0,72,0,
                  79,0,76,0,72,0,76,0, 79,0,84,0,79,0,86,0, 84,0,81,0,79,0,76,0, 74,0,72,0,71,0,69,0] },
        { wave: 'triangle', vol: 0.09, pan: 0.25,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  0,0,60,0,0,0,64,0,0,0,67,0,0,0,64,0, 0,0,62,0,0,0,65,0,0,0,69,0,0,0,65,0, 0,0,59,0,0,0,64,0,0,0,67,0,0,0,64,0, 0,0,60,0,0,0,64,0,0,0,67,0,0,0,64,0] },
        { wave: 'triangle', vol: 0.20,
          notes: [48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 47,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 47,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sine', vol: 0.05, pan: 0.35,
          notes: [84,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 79,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 81,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 83,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  84,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 79,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 81,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 83,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'drum', vol: 0.4,
          notes: ['k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0,
                  'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0, 'k',0,0,0,'h',0,0,'s',0,0,0,'h',0,0,0,0] }
      ]
    },
    /* ========== 街机 · 快节奏：a 小调 i-VI-III-VII，16分推 ========== */
    arcade: {
      bpm: 150, steps: 128,
      parts: [
        { wave: 'square', vol: 0.075, pan: -0.25,
          notes: [57,60,64,60,69,64,60,57, 55,57,60,55,64,60,55,52, 57,60,65,60,69,65,60,57, 53,57,60,57,65,60,57,53,
                  55,59,64,59,67,64,59,55, 52,55,59,55,64,59,55,52, 55,59,62,59,67,62,59,55, 50,55,59,55,62,59,55,50,
                  57,60,64,60,69,64,60,57, 55,57,60,55,64,60,55,52, 57,60,65,60,69,65,60,57, 53,57,60,57,65,60,57,53,
                  55,59,64,59,67,64,59,55, 52,55,59,55,64,59,55,52, 55,59,62,59,67,62,59,55, 50,55,59,55,62,59,55,50] },
        { wave: 'triangle', vol: 0.1, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  69,0,64,0,72,0,64,0,67,0,60,0,64,0,60,0, 69,0,65,0,73,0,65,0,67,0,60,0,65,0,60,0, 67,0,64,0,71,0,64,0,64,0,59,0,67,0,59,0, 67,0,62,0,71,0,62,0,62,0,59,0,67,0,59,0] },
        { wave: 'triangle', vol: 0.2,
          notes: [45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sawtooth', vol: 0.035, pan: 0.4,
          notes: [69,0,64,0,72,0,64,0,67,0,60,0,64,0,60,0, 69,0,65,0,73,0,65,0,67,0,60,0,65,0,60,0, 67,0,64,0,71,0,64,0,64,0,59,0,67,0,59,0, 67,0,62,0,71,0,62,0,62,0,59,0,67,0,59,0,
                  69,0,64,0,72,0,64,0,67,0,60,0,64,0,60,0, 69,0,65,0,73,0,65,0,67,0,60,0,65,0,60,0, 67,0,64,0,71,0,64,0,64,0,59,0,67,0,59,0, 67,0,62,0,71,0,62,0,62,0,59,0,67,0,59,0] },
        { wave: 'drum', vol: 0.5,
          notes: ['k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0,
                  'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,'k',0,'h',0,'k',0,'h',0,'s',0,'h',0] }
      ]
    },
    /* ========== 街机 B · 强推变奏：i-VI-VII 爬升 ========== */
    arcade2: {
      bpm: 155, steps: 128,
      parts: [
        { wave: 'square', vol: 0.075, pan: -0.25,
          notes: [57,0,64,0,69,0,72,0, 69,0,64,0,57,0,60,0, 57,0,65,0,69,0,73,0, 69,0,65,0,57,0,60,0,
                  55,0,62,0,67,0,71,0, 67,0,62,0,55,0,59,0, 55,0,62,0,67,0,70,0, 67,0,62,0,55,0,59,0,
                  57,0,64,0,69,0,72,0, 69,0,64,0,57,0,60,0, 57,0,65,0,69,0,73,0, 69,0,65,0,57,0,60,0,
                  55,0,62,0,67,0,71,0, 67,0,62,0,55,0,59,0, 50,0,55,0,62,0,67,0, 62,0,55,0,50,0,55,0] },
        { wave: 'triangle', vol: 0.1, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  72,0,69,0,76,0,69,0,72,0,64,0,69,0,60,0, 73,0,69,0,77,0,69,0,73,0,65,0,69,0,60,0, 71,0,67,0,74,0,67,0,71,0,62,0,67,0,59,0, 70,0,67,0,74,0,67,0,70,0,62,0,67,0,59,0] },
        { wave: 'triangle', vol: 0.2,
          notes: [45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                  45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 38,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sawtooth', vol: 0.035, pan: 0.4,
          notes: [69,0,64,0,72,0,64,0,67,0,60,0,64,0,60,0, 69,0,65,0,73,0,65,0,67,0,60,0,65,0,60,0, 67,0,64,0,71,0,64,0,64,0,59,0,67,0,59,0, 67,0,62,0,71,0,62,0,62,0,59,0,67,0,59,0,
                  69,0,64,0,72,0,64,0,67,0,60,0,64,0,60,0, 69,0,65,0,73,0,65,0,67,0,60,0,65,0,60,0, 67,0,64,0,71,0,64,0,64,0,59,0,67,0,59,0, 67,0,62,0,71,0,62,0,62,0,59,0,67,0,59,0] },
        { wave: 'drum', vol: 0.5,
          notes: ['k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0,
                  'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,'h',0,0,0,'h',0,'k',0,'h',0,'s',0,'h',0, 'k',0,0,0,0,0,'h',0,0,0,'k',0,0,0,'s',0] }
      ]
    },
    /* ========== 解谜 · 舒缓：C 大调 I-vi-IV-V，无鼓 ========== */
    puzzle: {
      bpm: 88, steps: 128,
      parts: [
        { wave: 'triangle', vol: 0.13, pan: -0.2,
          notes: [60,0,0,0,64,0,0,0,67,0,0,0,72,0,0,0,67,0,0,0,64,0,0,0,60,0,0,0,0,0,0,0,59,0,0,0,62,0,0,0,67,0,0,0,71,0,0,0,67,0,0,0,62,0,0,0,59,0,0,0,0,0,0,0,57,0,0,0,60,0,0,0,64,0,0,0,69,0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,0,0,0,0,57,0,0,0,60,0,0,0,65,0,0,0,69,0,0,0,65,0,0,0,60,0,0,0,57,0,0,0,0,0,0,0] },
        { wave: 'square', vol: 0.05, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sine', vol: 0.05, pan: 0.35,
          notes: [48,0,0,0,0,0,0,0,55,0,0,0,0,60,0,0,0,0,55,0,0,0,0,0,0,0,0,0,0,0,0,0,47,0,0,0,0,0,0,0,55,0,0,0,0,59,0,0,0,0,55,0,0,0,0,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,52,0,0,0,0,57,0,0,0,0,52,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,48,0,0,0,0,53,0,0,0,0,48,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sine', vol: 0.045, pan: -0.1,
          notes: [72,0,0,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,60,0,0,0,0,0,71,0,0,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,62,0,0,0,0,0,0,0,59,0,0,0,0,0,69,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,60,0,0,0,0,0,0,0,57,0,0,0,0,0,69,0,0,0,0,0,0,0,0,0,65,0,0,0,0,0,0,0,60,0,0,0,0,0,0,0,57,0,0,0,0,0] }
      ]
    },
    /* ========== 解谜 B · 分解和弦变奏：I-vi-IV-V ========== */
    puzzle2: {
      bpm: 82, steps: 128,
      parts: [
        { wave: 'triangle', vol: 0.12, pan: -0.2,
          notes: [60,0,0,0,64,0,0,0,67,0,0,0,72,0,0,0,76,0,0,0,72,0,0,0,67,0,0,0,64,0,0,0,57,0,0,0,60,0,0,0,64,0,0,0,69,0,0,0,72,0,0,0,69,0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,60,0,0,0,65,0,0,0,69,0,0,0,72,0,0,0,69,0,0,0,65,0,0,0,60,0,0,0,55,0,0,0,59,0,0,0,62,0,0,0,67,0,0,0,71,0,0,0,67,0,0,0,62,0,0,0,59,0,0,0] },
        { wave: 'square', vol: 0.05, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sine', vol: 0.05, pan: 0.35,
          notes: [48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,43,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sine', vol: 0.045, pan: -0.1,
          notes: [72,0,0,0,0,0,0,0,76,0,0,0,0,79,0,0,0,0,76,0,0,0,0,0,0,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,72,0,0,0,0,76,0,0,0,0,72,0,0,0,0,0,0,0,0,0,0,0,0,0,69,0,0,0,0,0,0,0,72,0,0,0,0,77,0,0,0,0,72,0,0,0,0,0,0,0,0,0,0,0,0,0,67,0,0,0,0,0,0,0,71,0,0,0,0,74,0,0,0,0,71,0,0,0,0,0,0,0,0,0,0,0,0,0] }
      ]
    },
    /* ========== 悬疑氛围：d 小调 Dm-Bb-F-A，半音点缀 ========== */
    mystery: {
      bpm: 102, steps: 128,
      parts: [
        { wave: 'square', vol: 0.07, pan: -0.25,
          notes: [62,0,0,0,65,0,0,0,69,0,0,0,65,0,0,0,70,0,0,0,69,0,0,0,65,0,0,0,62,0,0,0,58,0,0,0,62,0,0,0,65,0,0,0,62,0,0,0,70,0,0,0,65,0,0,0,62,0,0,0,58,0,0,0,57,0,0,0,60,0,0,0,64,0,0,0,60,0,0,0,65,0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,57,0,0,0,61,0,0,0,64,0,0,0,61,0,0,0,69,0,0,0,64,0,0,0,61,0,0,0,57,0,0,0] },
        { wave: 'triangle', vol: 0.09, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'triangle', vol: 0.18,
          notes: [38,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,34,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,0,0,40,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'sawtooth', vol: 0.035, pan: 0.4,
          notes: [0,0,0,69,0,0,0,65,0,0,0,62,0,0,0,65, 0,0,0,65,0,0,0,62,0,0,0,58,0,0,0,62, 0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,60, 0,0,0,64,0,0,0,61,0,0,0,57,0,0,0,61,
                  0,0,0,69,0,0,0,65,0,0,0,62,0,0,0,65, 0,0,0,65,0,0,0,62,0,0,0,58,0,0,0,62, 0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,60, 0,0,0,64,0,0,0,61,0,0,0,57,0,0,0,61] },
        { wave: 'drum', vol: 0.36,
          notes: ['k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0,
                  'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0] }
      ]
    },
    /* ========== 神秘低音变奏 B：Dm-Bb-F-A ========== */
    mystery2: {
      bpm: 94, steps: 128,
      parts: [
        { wave: 'square', vol: 0.07, pan: -0.25,
          notes: [62,0,0,0,66,0,0,0,69,0,0,0,66,0,0,0,69,0,0,0,66,0,0,0,62,0,0,0,0,0,0,0,58,0,0,0,61,0,0,0,65,0,0,0,61,0,0,0,65,0,0,0,61,0,0,0,58,0,0,0,0,0,0,0,57,0,0,0,60,0,0,0,64,0,0,0,60,0,0,0,64,0,0,0,60,0,0,0,57,0,0,0,0,0,0,0,57,0,0,0,60,0,0,0,63,0,0,0,60,0,0,0,63,0,0,0,60,0,0,0,57,0,0,0,0,0,0,0] },
        { wave: 'triangle', vol: 0.09, pan: 0.3,
          notes: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
        { wave: 'triangle', vol: 0.18,
          notes: [38,0,0,0,0,0,0,0,38,0,0,0,0,0,0,0,50,0,0,0,0,0,0,0,50,0,0,0,0,0,0,0,34,0,0,0,0,0,0,0,34,0,0,0,0,0,0,0,46,0,0,0,0,0,0,0,46,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0,45,0,0,0,0,0,0,0] },
        { wave: 'sawtooth', vol: 0.03, pan: 0.4,
          notes: [0,0,0,69,0,0,0,70,0,0,0,66,0,0,0,62, 0,0,0,65,0,0,0,66,0,0,0,61,0,0,0,58, 0,0,0,64,0,0,0,65,0,0,0,60,0,0,0,57, 0,0,0,63,0,0,0,64,0,0,0,60,0,0,0,57,
                  0,0,0,69,0,0,0,70,0,0,0,66,0,0,0,62, 0,0,0,65,0,0,0,66,0,0,0,61,0,0,0,58, 0,0,0,64,0,0,0,65,0,0,0,60,0,0,0,57, 0,0,0,63,0,0,0,64,0,0,0,60,0,0,0,57] },
        { wave: 'drum', vol: 0.34,
          notes: ['k',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0,
                  'k',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 'k',0,0,0,0,0,0,0,'h',0,0,0,0,0,0,0] }
      ]
    }
  };

  /* 游戏 → 曲目映射（按玩法气质分组；未列出的用 lobby） */
  var TRACK_BY_ID = {
    /* 街机类（arcade / arcade2 随机） */
    snake: 'arcade', g2048: 'arcade', blocks: 'arcade', brickbash: 'arcade', mazedot: 'arcade',
    asteroidf: 'arcade', pixeldino: 'arcade', frogcross: 'arcade', fruitmerge: 'arcade', match3: 'arcade',
    ballpop: 'arcade', bullethell: 'arcade', tank: 'arcade', spaceshooter: 'arcade', railshooter: 'arcade',
    pixelbird: 'arcade', platformer: 'arcade', rhythm: 'arcade', catch: 'arcade',
    sectorsiege: 'arcade', towerdefense: 'arcade', dungeon: 'arcade',
    billiards: 'arcade', bowling: 'arcade', curling: 'arcade',
    /* 解谜类（puzzle / puzzle2 随机） */
    shikaku: 'puzzle', fillomino: 'puzzle',
    nonogram: 'puzzle', sudoku: 'puzzle', slitherlink: 'puzzle', hashi: 'puzzle',
    game24: 'puzzle', sokoban: 'puzzle',
    maze: 'puzzle', pipe: 'puzzle', circuit: 'puzzle', roperescue: 'puzzle',
    bridge: 'puzzle', llk: 'puzzle', sheep: 'puzzle', klondike: 'puzzle',
    minesweeper: 'puzzle', chess: 'puzzle', checkers: 'puzzle', gomoku: 'puzzle', reversi: 'puzzle',
    fourline: 'puzzle', siege: 'puzzle', diceluck: 'puzzle', poker: 'puzzle',
    blackjack: 'puzzle', deckbuilder: 'puzzle', tactics: 'puzzle',
    /* 悬疑类曲目（随机） */
    
  };

  /* 曲目组：每类主曲 + 变奏，播放时同类随机（避免连续重复） */
  var TRACK_POOL = {
    lobby: ['lobby', 'lobby2'],
    arcade: ['arcade', 'arcade2'],
    puzzle: ['puzzle', 'puzzle2'],
    mystery: ['mystery', 'mystery2']
  };
  var lastTrack = null;

  function trackFor(gameId) { return TRACK_BY_ID[gameId] || 'lobby'; }

  function pickTrack(group) {
    var pool = TRACK_POOL[group] || [group];
    if (pool.length === 1) return pool[0];
    var candidates = pool.filter(function (t) { return t !== lastTrack; });
    if (!candidates.length) candidates = pool;
    var t = candidates[Math.floor(Math.random() * candidates.length)];
    lastTrack = t;
    return t;
  }

  /* ================= 音频核心 v3 ================= */
  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9; // 软限幅级

      /* 主总线（bus）：延迟与主路分离，避免鼓声被回声糊掉 */
      bus = ctx.createGain();
      bus.gain.value = 0.16;

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7500;
      lp.Q.value = 0.4;

      /* 延迟返回（delayReturn）独立增益 0.5，发送 0.25 */
      delaySend = ctx.createGain();
      delaySend.gain.value = 0.25;
      var delay = ctx.createDelay(1);
      delay.delayTime.value = 0.28;
      var fb = ctx.createGain();
      fb.gain.value = 0.32;
      delayReturn = ctx.createGain();
      delayReturn.gain.value = 0.5;
      delaySend.connect(delay);
      delay.connect(fb); fb.connect(delay);
      delay.connect(delayReturn);

      bus.connect(lp);
      lp.connect(master);
      lp.connect(delaySend);
      delayReturn.connect(master);
      master.connect(ctx.destination);

      /* 噪声缓冲（鼓） */
      var len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return ctx;
    } catch (e) { return null; }
  }
  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* 旋律/低音/垫：三振荡器分层 + 滤波包络 + 颤音 + 声像（v3） */
  function playNote(n, t, dur, wave, vol, pan) {
    if (!ctx || !bus || !n || typeof n !== 'number') return;
    var layers = [
      { det: -3, mult: 1, v: 1.0 },
      { det: 3, mult: 1, v: 1.0 },       // 主波失谐
      { det: 0, mult: 2, v: 0.35 },      // 谐波泛音（八度上）
      { det: 0, mult: 0.5, v: 0.4 }      // 低八度厚度
    ];
    var f = freq(n);
    layers.forEach(function (ly) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave;
      o.frequency.value = f * ly.mult;
      o.detune.value = ly.det;
      // ADSR：快起音 → 衰减到 55% → 指数释放
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * ly.v, t + 0.01);
      g.gain.setTargetAtTime(vol * ly.v * 0.55, t + 0.04, 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      // 声像（默认居中；pan -1..1）
      var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p && pan) p.pan.setValueAtTime(pan, t);
      // 颤音 vibrato（慢速 ±4 cent）
      var vib = ctx.createOscillator(), vg = ctx.createGain();
      vib.frequency.value = 5.2;
      vg.gain.value = 4;
      vib.connect(vg); vg.connect(o.detune);
      vib.start(t); vib.stop(t + dur + 0.05);
      o.connect(g);
      if (p) { g.connect(p); p.connect(bus); } else g.connect(bus);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  /* 鼓机 v3：底鼓音高包络 / 军鼓噪声+音调 / 踩镲切分 / 嗵鼓 / 吊镲 */
  function playDrum(type, t, vol) {
    if (!ctx || !bus || !noiseBuf) return;
    var v = vol || 0.5;
    if (type === 'k') {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.16);
    } else if (type === 's') {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(v * 0.7, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      // 军鼓音调层（方波 190Hz 短促）
      var o2 = ctx.createOscillator(), g3 = ctx.createGain();
      o2.type = 'triangle'; o2.frequency.value = 190;
      g3.gain.setValueAtTime(v * 0.4, t);
      g3.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      src.connect(bp); bp.connect(g2); g2.connect(bus);
      o2.connect(g3); g3.connect(bus);
      src.start(t); src.stop(t + 0.14); o2.start(t); o2.stop(t + 0.1);
    } else if (type === 'h') {
      var src2 = ctx.createBufferSource(); src2.buffer = noiseBuf;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
      var g4 = ctx.createGain();
      g4.gain.setValueAtTime(v * 0.3, t);
      g4.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src2.connect(hp); hp.connect(g4); g4.connect(bus);
      src2.start(t); src2.stop(t + 0.07);
    } else if (type === 't') {
      // 嗵鼓：sine 120→70Hz 长衰减
      var o3 = ctx.createOscillator(), g5 = ctx.createGain();
      o3.type = 'sine';
      o3.frequency.setValueAtTime(120, t);
      o3.frequency.exponentialRampToValueAtTime(70, t + 0.16);
      g5.gain.setValueAtTime(v * 0.6, t);
      g5.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o3.connect(g5); g5.connect(bus);
      o3.start(t); o3.stop(t + 0.24);
    } else if (type === 'c') {
      // 吊镲：噪声高通长衰减
      var src3 = ctx.createBufferSource(); src3.buffer = noiseBuf;
      var hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 7500;
      var g6 = ctx.createGain();
      g6.gain.setValueAtTime(v * 0.35, t);
      g6.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      src3.connect(hp2); hp2.connect(g6); g6.connect(bus);
      src3.start(t); src3.stop(t + 0.75);
    }
  }

  function scheduleStep(s, t) {
    var song = SONGS[current];
    if (!song) return;
    var spb = 60 / song.bpm / 4;
    song.parts.forEach(function (part) {
      var n = part.notes[s];
      if (!n) return;
      if (part.wave === 'drum') playDrum(n, t, part.vol);
      else playNote(n, t, spb * 0.92, part.wave, part.vol, part.pan);
    });
  }

  function scheduler() {
    if (!current) return;
    var song = SONGS[current];
    var spb = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.18) {
      scheduleStep(stepIdx, nextTime);
      stepIdx = (stepIdx + 1) % song.steps;
      nextTime += spb;
    }
  }

  /* ================= 播放控制 ================= */
  function start(name) {
    current = name;
    stepIdx = 0;
    if (!enabled) { pending = name; return; }
    var c = ensureCtx();
    if (!c) return;
    if (timer) clearInterval(timer);
    nextTime = c.currentTime + 0.08;
    timer = setInterval(scheduler, 30);
  }

  function play(gameId) {
    /* 页面/大厅可直接传曲类名（lobby/arcade/puzzle/mystery），游戏 id 走映射 */
    var group = TRACK_POOL[gameId] ? gameId : trackFor(gameId);
    var name = pickTrack(group);
    if (current === name) return;
    stop();
    start(name);
  }

  function stop() {
    current = null;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
    else if (current || pending) {
      var n = current || pending;
      pending = null;
      current = null;
      start(n);
    }
  }

  /* 首次用户交互时解锁 AudioContext（浏览器自动播放策略） */
  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended' && c.resume) c.resume();
  }
  if (typeof document !== 'undefined') {
    var unlockOnce = function () {
      unlock();
      document.removeEventListener('pointerdown', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
      document.removeEventListener('touchstart', unlockOnce);
    };
    document.addEventListener('pointerdown', unlockOnce);
    document.addEventListener('keydown', unlockOnce);
    document.addEventListener('touchstart', unlockOnce);
  }

  return {
    play: play,
    stop: stop,
    setEnabled: setEnabled,
    unlock: unlock,
    trackFor: trackFor,
    SONGS: SONGS
  };
})();
