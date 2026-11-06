/* ============================================================
   hall-scene.js —— 霓虹街区 3D 场景构建
   —— 53 台街机柜分列街道两侧（27 / 26，逐排居中），建筑立面 / 霓虹招牌 / 拱门 /
      湿地反射 / 悬浮粒子 / 远景天际线
   —— 机柜主体用 InstancedMesh 合并绘制，屏幕与灯箱保留独立网格
      （逐台材质便于高亮 / 筛选淡出 / 拾取）
   ============================================================ */
window.HallScene = (function () {
  'use strict';

  var T = window.HallTextures;

  var GAP = 1.58;              /* 机柜沿街间距 */
  var CAB_W = 1.20;
  var CAB_H = 2.30;
  var CAB_D = 1.00;
  var ROW_X = 4.35;            /* 机柜中心线 */
  var FRONT_Z = CAB_D / 2;     /* 本地正面 */

  function build(opts) {
    var games = opts.games || [];
    var cats = opts.cats || [];
    var colorOf = opts.colorOf;
    var quality = opts.quality || {};
    var bestOf = opts.bestOf || function () { return null; };
    var pmrem = null;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04050b);
    scene.fog = new THREE.FogExp2(0x06070f, quality.fog === undefined ? 0.0135 : quality.fog);

    /* ---------- 天空穹顶 + 环境反射 ---------- */
    var skyTex = T.sky();
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(280, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.rotation.y = Math.PI * 0.15;
    scene.add(dome);

    /* 低配 / 移动端跳过 PMREM（首帧最贵的一步），仅保留天空穹顶 */
    if (!quality.low) {
      try {
        var envSrc = skyTex.clone();
        envSrc.mapping = THREE.EquirectangularReflectionMapping;
        envSrc.needsUpdate = true;
        pmrem = new THREE.PMREMGenerator(opts.renderer);
        scene.environment = pmrem.fromEquirectangular(envSrc).texture;
        envSrc.dispose();
      } catch (e) { /* 环境反射失败不影响主场景 */ }
    }

    /* ---------- 灯光 ---------- */
    scene.add(new THREE.AmbientLight(0x33405e, 0.9));
    scene.add(new THREE.HemisphereLight(0x5a74ff, 0x0a0a12, 0.85));
    var keyA = new THREE.PointLight(0x00f0ff, 55, 70, 1.6); keyA.position.set(0, 7.5, 18); scene.add(keyA);
    var keyB = new THREE.PointLight(0xff3ea5, 45, 66, 1.6); keyB.position.set(0, 6.0, -12); scene.add(keyB);
    var keyC = new THREE.PointLight(0xffb020, 22, 46, 1.7); keyC.position.set(0, 5.0, 4); scene.add(keyC);

    /* ---------- 地面 ---------- */
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 460),
      new THREE.MeshStandardMaterial({
        color: 0x090a11, roughness: 0.30, metalness: 0.88,
        envMapIntensity: quality.reflection === false ? 0.25 : 0.95
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    var gridTex = T.grid();
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(9, 34);
    var gridPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 68),
      new THREE.MeshBasicMaterial({
        map: gridTex, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending,
        depthWrite: false, color: 0x35d8ff, fog: true
      })
    );
    gridPlane.rotation.x = -Math.PI / 2;
    gridPlane.position.set(0, 0.012, 0);
    scene.add(gridPlane);

    /* 街口地平线霓虹雾（远景纵深） */
    var hazePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 90),
      new THREE.MeshBasicMaterial({
        map: T.barGlow(), color: 0x8a2c74, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    hazePlane.position.set(0, 18, -118);
    scene.add(hazePlane);

    /* ---------- 机柜 ---------- */
    /* 两排按各自实际台数居中：53 台 → 左 27 / 右 26，右排少一台但保持半格错位 */
    var LEFT_COUNT = Math.ceil(games.length / 2);
    var RIGHT_COUNT = games.length - LEFT_COUNT;
    var per = {
      body: new THREE.InstancedMesh(
        new THREE.BoxGeometry(CAB_W, CAB_H, CAB_D),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.55, envMapIntensity: 0.35 }),
        games.length
      ),
      base: new THREE.InstancedMesh(
        new THREE.BoxGeometry(CAB_W + 0.10, 0.16, CAB_D + 0.10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.7 }),
        games.length
      ),
      panel: new THREE.InstancedMesh(
        new THREE.BoxGeometry(1.06, 0.10, 0.48),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.5 }),
        games.length
      ),
      trim: new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.042, 2.14, 0.042),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        games.length * 2
      ),
      knob: new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        games.length * 2
      ),
      stick: new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.032, 0.042, 0.17, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.8 }),
        games.length
      ),
      glow: new THREE.InstancedMesh(
        new THREE.PlaneGeometry(2.8, 2.8),
        new THREE.MeshBasicMaterial({
          map: T.glow(), transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending,
          depthWrite: false, color: 0xffffff, fog: true
        }),
        games.length
      ),
      streak: new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.5, 4.2),
        new THREE.MeshBasicMaterial({
          map: T.streak(), transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending,
          depthWrite: false, color: 0xffffff, fog: true
        }),
        games.length
      ),
      shade: new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.9, 2.9),
        new THREE.MeshBasicMaterial({
          map: T.shadow(), transparent: true, opacity: 0.62, depthWrite: false,
          color: 0x000000, fog: true
        }),
        games.length
      )
    };

    Object.keys(per).forEach(function (k) {
      per[k].frustumCulled = false;
      scene.add(per[k]);
    });

    /* 独立网格：屏幕与灯箱 */
    var screenGeo = new THREE.PlaneGeometry(1.04, 0.70);
    var marqueeGeo = new THREE.PlaneGeometry(1.16, 0.30);
    var screenGroup = new THREE.Group();
    var marqueeGroup = new THREE.Group();
    scene.add(screenGroup, marqueeGroup);

    var cabinets = [];
    var dummy = new THREE.Object3D();
    var root = new THREE.Object3D();
    var tmpM = new THREE.Matrix4();
    var bodyC = new THREE.Color();
    var tmpC = new THREE.Color();
    var trimI = 0, knobI = 0;

    function part(px, py, pz, rx, ry, rz, sx, sy, sz) {
      dummy.position.set(px, py, pz);
      dummy.rotation.set(rx || 0, ry || 0, rz || 0);
      dummy.scale.set(sx || 1, sy || 1, sz || 1);
      dummy.updateMatrix();
      return tmpM.multiplyMatrices(root.matrixWorld, dummy.matrix);
    }

    games.forEach(function (g, i) {
      var side = i % 2;                 /* 0 左排 / 1 右排 */
      var slot = Math.floor(i / 2);
      var rowCount = side ? RIGHT_COUNT : LEFT_COUNT;
      var z = (slot - (rowCount - 1) / 2) * GAP;
      var x = side ? ROW_X : -ROW_X;
      var rot = side ? -Math.PI / 2 : Math.PI / 2;

      root.position.set(x, 0, z);
      root.rotation.set(0, rot, 0);
      root.updateMatrixWorld(true);

      var c = new THREE.Color(colorOf(g));
      var best = bestOf(g);

      per.body.setMatrixAt(i, part(0, 1.17, 0));
      per.body.setColorAt(i, bodyC.copy(c).multiplyScalar(0.32));

      per.base.setMatrixAt(i, part(0, 0.08, 0));
      per.base.setColorAt(i, tmpC.setRGB(0.10, 0.11, 0.15));

      per.panel.setMatrixAt(i, part(0, 0.99, 0.60, -0.30, 0, 0));
      per.panel.setColorAt(i, tmpC.copy(c).multiplyScalar(0.16));

      per.trim.setMatrixAt(trimI++, part(-0.598, 1.24, FRONT_Z + 0.014));
      per.trim.setColorAt(trimI - 1, tmpC.copy(c));
      per.trim.setMatrixAt(trimI++, part(0.598, 1.24, FRONT_Z + 0.014));
      per.trim.setColorAt(trimI - 1, tmpC.copy(c));

      per.knob.setMatrixAt(knobI++, part(-0.24, 1.05, 0.70));
      per.knob.setColorAt(knobI - 1, tmpC.setRGB(2.4, 0.5, 1.4));
      per.knob.setMatrixAt(knobI++, part(-0.05, 1.05, 0.72));
      per.knob.setColorAt(knobI - 1, tmpC.setRGB(0.5, 2.2, 2.4));

      per.stick.setMatrixAt(i, part(0.29, 1.03, 0.70, 0.16, 0, 0));
      per.stick.setColorAt(i, tmpC.setRGB(0.16, 0.17, 0.22));

      /* 柜前柔光（贴在柜面外侧，朝过道） */
      per.glow.setMatrixAt(i, part(0, 1.34, 0.58));
      per.glow.setColorAt(i, tmpC.copy(c));

      /* 地面光带：从柜体向过道延伸 */
      per.streak.setMatrixAt(i, part(0, 0.015, 2.35, -Math.PI / 2, 0, 0));
      per.streak.setColorAt(i, tmpC.copy(c).multiplyScalar(0.75));

      per.shade.setMatrixAt(i, part(0, 0.018, 1.15, -Math.PI / 2, 0, 0));
      var scrMat = new THREE.MeshBasicMaterial({
        map: T.screen(g, c.getHex(), best, quality.low),
        transparent: true, toneMapped: false
      });
      var screen = new THREE.Mesh(screenGeo, scrMat);
      screen.position.set(x + (side ? -0.515 : 0.515), 1.62, z);
      screen.rotation.y = rot;
      screenGroup.add(screen);

      var marMat = new THREE.MeshBasicMaterial({
        map: T.marquee(g, c.getHex(), quality.low),
        transparent: true, toneMapped: false
      });
      var marquee = new THREE.Mesh(marqueeGeo, marMat);
      marquee.position.set(x + (side ? -0.515 : 0.515), 2.10, z);
      marquee.rotation.y = rot;
      marqueeGroup.add(marquee);

      cabinets.push({
        index: i, game: g, color: c, side: side, slot: slot, z: z,
        sx: x + (side ? -0.515 : 0.515), sy: 1.62,
        screen: screen, marquee: marquee,
        w: 1, wTarget: 1, hover: 0, hoverTarget: 0, sel: 0, selTarget: 0,
        phase: Math.random() * Math.PI * 2,
        flick: 0.4 + Math.random() * 0.6
      });
    });

    Object.keys(per).forEach(function (k) {
      if (per[k].instanceMatrix) per[k].instanceMatrix.needsUpdate = true;
      if (per[k].instanceColor) per[k].instanceColor.needsUpdate = true;
    });

    /* ---------- 建筑立面（街道两侧的连续楼墙，全部退到机柜外侧） ---------- */
    var winTex = T.windows();
    var facadeMat = new THREE.MeshStandardMaterial({
      color: 0x0b0c14, roughness: 0.86, metalness: 0.18,
      emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: quality.low ? 0.75 : 1.0,
      envMapIntensity: 0.2
    });
    var nearCount = quality.low ? 14 : 26;    /* 近排楼墙 */
    var farCount = quality.low ? 8 : 18;      /* 远排楼墙，制造纵深 */
    var facadeCount = nearCount + farCount;
    var facades = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facadeMat, facadeCount);
    facades.frustumCulled = false;
    scene.add(facades);
    var seed = 1;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

    for (var b = 0; b < facadeCount; b++) {
      var sd = b % 2 ? 1 : -1;
      var far = b >= nearCount;
      var bw, bh, bd, bx, bz2;
      if (!far) {
        /* 近排：沿街均匀铺开，避免出现挡在镜头前的孤立高楼 */
        var idxNear = Math.floor(b / 2);
        bz2 = -40 + idxNear * (58 / Math.max(1, nearCount / 2 - 1)) + (rnd() - 0.5) * 3;
        bx = sd * (12.2 + rnd() * 2.6);
        bw = 3.8 + rnd() * 3.0;
        bh = 9 + rnd() * 13;
        bd = 3.4 + rnd() * 2.6;
      } else {
        var idxFar = Math.floor((b - nearCount) / 2);
        bz2 = -48 + idxFar * (72 / Math.max(1, farCount / 2 - 1)) + (rnd() - 0.5) * 6;
        bx = sd * (18.5 + rnd() * 6);
        bw = 6 + rnd() * 6;
        bh = 16 + rnd() * 20;
        bd = 5 + rnd() * 4;
      }
      dummy.position.set(bx, bh / 2, bz2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(bw, bh, bd);
      dummy.updateMatrix();
      facades.setMatrixAt(b, dummy.matrix);
      facades.setColorAt(b, tmpC.setRGB(0.05 + rnd() * 0.05, 0.055 + rnd() * 0.05, 0.08 + rnd() * 0.06));
    }
    facades.instanceMatrix.needsUpdate = true;
    if (facades.instanceColor) facades.instanceColor.needsUpdate = true;

    /* ---------- 远景天际线 ---------- */
    var skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
      color: 0x090a14, roughness: 0.9, metalness: 0.1,
      emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.55, envMapIntensity: 0.1
    }), quality.low ? 14 : 30);
    skyline.frustumCulled = false;
    scene.add(skyline);
    for (var s = 0; s < skyline.count; s++) {
      var sw = 5 + rnd() * 10, sh = 16 + rnd() * 42;
      dummy.position.set(-70 + rnd() * 140, sh / 2 - 2, -62 - rnd() * 52);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sw, sh, 6 + rnd() * 8);
      dummy.updateMatrix();
      skyline.setMatrixAt(s, dummy.matrix);
      skyline.setColorAt(s, tmpC.setRGB(0.03, 0.035, 0.06));
    }
    skyline.instanceMatrix.needsUpdate = true;
    if (skyline.instanceColor) skyline.instanceColor.needsUpdate = true;

    /* ---------- 分类霓虹竖招牌 ---------- */
    var signGroup = new THREE.Group();
    scene.add(signGroup);
    var signs = [];
    var signMats = [];
    var catZ = {};
    cabinets.forEach(function (cb) {
      var cn = cb.game.category;
      if (!catZ[cn]) catZ[cn] = { min: cb.z, max: cb.z };
      catZ[cn].min = Math.min(catZ[cn].min, cb.z);
      catZ[cn].max = Math.max(catZ[cn].max, cb.z);
    });
    cats.forEach(function (cn, ci) {
      var r = catZ[cn];
      if (!r) return;
      var zc = Math.max(-30, Math.min(6, (r.min + r.max) / 2));
      var col = colorOf({ category: cn });
      var text = cn;
      var tex = T.signVertical(text, col);
      var h = Math.min(4.2, Math.max(3.2, text.length * 0.92 + 0.6));
      [-1, 1].forEach(function (sd) {
        var mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, toneMapped: false, fog: true
        });
        var m = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.27, h), mat);
        m.position.set(sd * 8.6, 5.0 + (ci % 2) * 0.5, zc);
        m.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
        signGroup.add(m);
        signMats.push(mat);

        var gm = new THREE.MeshBasicMaterial({
          map: T.barGlow(), color: col, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: true
        });
        var gp = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.6, h), gm);
        gp.position.set(sd * 8.63, m.position.y, zc);
        gp.rotation.y = m.rotation.y;
        signGroup.add(gp);
      });
    });

    /* 氛围英文小牌 */
    var tags = [
      ['OPEN 24H', 0xff3ea5, -1, 3.2, 12], ['HIGH SCORE', 0x9dff3e, 1, 6.4, -6],
      ['TOKEN', 0x00f0ff, -1, 4.0, -18], ['PLAY', 0xb36cff, 1, 3.6, 20],
      ['NEON', 0xffb020, -1, 5.0, 1], ['53 GAMES', 0x26e0d0, 1, 5.4, -25.6]
    ];
    tags.forEach(function (t) {
      var mat = new THREE.MeshBasicMaterial({
        map: T.signTag(t[0], t[1]), transparent: true, toneMapped: false, opacity: 0.9, fog: true
      });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.575), mat);
      m.position.set(t[2] * 7.1, t[3], t[4]);
      m.rotation.y = t[2] > 0 ? -Math.PI / 2 : Math.PI / 2;
      signGroup.add(m);
    });

    /* ---------- 南北拱门 ---------- */
    function arch(zPos, col, title, sub) {
      var g = new THREE.Group();
      var metal = new THREE.MeshStandardMaterial({ color: 0x10111a, roughness: 0.42, metalness: 0.75 });
      [-6.2, 6.2].forEach(function (px) {
        var p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.2, 0.9), metal);
        p.position.set(px, 4.6, zPos); g.add(p);
        var t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 8.8, 0.12),
          new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
        t.position.set(px + (px < 0 ? 0.48 : -0.48), 4.6, zPos + 0.48); g.add(t);
      });
      var beam = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.55, 0.9), metal);
      beam.position.set(0, 9.2, zPos); g.add(beam);
      var line = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.07, 0.1),
        new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
      line.position.set(0, 8.9, zPos + 0.48); g.add(line);
      var line2 = line.clone(); line2.position.z = zPos - 0.48; g.add(line2);

      var sg = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.15), new THREE.MeshBasicMaterial({
        map: T.signWide(title, sub, col), transparent: true, toneMapped: false
      }));
      sg.position.set(0, 10.7, zPos);
      sg.rotation.y = zPos > 0 ? Math.PI : 0;
      g.add(sg);
      if (zPos > 0) {
        var sg2 = new THREE.Mesh(sg.geometry, sg.material);
        sg2.position.set(0, 10.7, zPos + 0.04);
        sg2.rotation.y = 0;
        g.add(sg2);
      }
      var halo = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.6), new THREE.MeshBasicMaterial({
        map: T.barGlow(), color: col, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.position.set(0, 10.6, zPos + (zPos > 0 ? 0.05 : -0.05));
      halo.rotation.y = sg.rotation.y;
      g.add(halo);
      scene.add(g);
      return g;
    }
    /* 53 台让街道比原 66 台缩短约 18%，拱门同步内收，保持「机柜—拱门」的收束比例 */
    arch(28.4, 0x00f0ff, '游戏街机厅', 'ARCADE HALL');
    arch(-28.4, 0xff3ea5, '53 款游戏', 'NEON STREET');

    /* ---------- 街灯 / 光锥 / 粒子 ---------- */
    var lampN = quality.low ? 10 : 22;
    var lamps = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      lampN
    );
    lamps.frustumCulled = false;
    scene.add(lamps);
    var lampCols = [0x00f0ff, 0xff3ea5, 0xffb020, 0xb36cff];
    for (var l = 0; l < lampN; l++) {
      var ls = l % 2 ? 1 : -1;
      dummy.position.set(ls * 6.95, 4.9 + (l % 3) * 0.25, -32 + (Math.floor(l / 2)) * (64 / (lampN / 2)));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lamps.setMatrixAt(l, dummy.matrix);
      lamps.setColorAt(l, tmpC.setHex(lampCols[l % 4]).multiplyScalar(2.2));
    }
    lamps.instanceMatrix.needsUpdate = true;
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;

    var coneGroup = new THREE.Group();
    scene.add(coneGroup);
    var coneMat = new THREE.MeshBasicMaterial({
      map: T.cone(), color: 0x4fc8ff, transparent: true, opacity: 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true
    });
    for (var cI = 0; cI < (quality.low ? 3 : 6); cI++) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1.9, 8, 14, 1, true), coneMat);
      cone.position.set((cI % 2 ? 1 : -1) * 6.6, 6.4, -26 + cI * 10.5);
      coneGroup.add(cone);
    }

    /* 悬浮尘埃 */
    var dustN = quality.low ? 120 : (quality.mid ? 320 : 620);
    var dustGeo = new THREE.BufferGeometry();
    var dustPos = new Float32Array(dustN * 3);
    var dustBase = new Float32Array(dustN * 3);
    var dustPh = new Float32Array(dustN);
    for (var d = 0; d < dustN; d++) {
      var dx = -9.5 + Math.random() * 19;
      var dy = 0.4 + Math.random() * 9;
      var dz = -34 + Math.random() * 42;   /* 仅分布在镜头前方，避免贴脸变成大光斑 */
      dustPos[d * 3] = dustBase[d * 3] = dx;
      dustPos[d * 3 + 1] = dustBase[d * 3 + 1] = dy;
      dustPos[d * 3 + 2] = dustBase[d * 3 + 2] = dz;
      dustPh[d] = Math.random() * 6.28;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.05, map: T.dot(), transparent: true, opacity: 0.4, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x9fe4ff, sizeAttenuation: true
    }));
    dust.frustumCulled = false;
    scene.add(dust);

    /* 星空 */
    var starN = quality.low ? 240 : 700;
    var starGeo = new THREE.BufferGeometry();
    var starPos = new Float32Array(starN * 3);
    for (var st = 0; st < starN; st++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = 60 + Math.random() * 150;
      starPos[st * 3] = Math.cos(ang) * rad;
      starPos[st * 3 + 1] = 14 + Math.random() * 90;
      starPos[st * 3 + 2] = Math.sin(ang) * rad;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 0.5, map: T.dot(), transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xbfe3ff, sizeAttenuation: true, fog: false
    }));
    scene.add(stars);

    /* ---------- 选中聚光 ---------- */
    var beam = new THREE.Mesh(new THREE.ConeGeometry(1.75, 5.2, 18, 1, true), new THREE.MeshBasicMaterial({
      map: T.cone(), color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true
    }));
    beam.position.y = 4.9;
    scene.add(beam);

    var ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.75, 40), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: true
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    /* ---------- 状态 ---------- */
    var hovered = -1, selected = -1;

    function ease(cur, target, lambda, dt) {
      return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
    }

    function focusPose(cab) {
      return {
        anchor: new THREE.Vector3(cab.sx, cab.sy, cab.z),
        normal: new THREE.Vector3(cab.side ? -1 : 1, 0, 0)
      };
    }

    function setFilter(matchFn) {
      cabinets.forEach(function (cb) {
        cb.wTarget = matchFn(cb.game) ? 1 : 0.07;
      });
    }

    function setHover(i) { hovered = i; }
    function setSelected(i) { selected = i; }

    function update(dt, time) {
      /* --- 机柜动画 --- */
      for (var i = 0; i < cabinets.length; i++) {
        var cb = cabinets[i];
        var hov = cb.index === hovered ? 1 : 0;
        var sel = cb.index === selected ? 1 : 0;
        cb.w = ease(cb.w, cb.wTarget, 8, dt);
        cb.hover = ease(cb.hover, hov, 9, dt);
        cb.sel = ease(cb.sel, sel, 7, dt);

        var vis = cb.w;
        var hot = 1 + 1.4 * cb.hover + 2.6 * cb.sel;
        var fade = 0.08 + 0.92 * vis;

        per.body.setColorAt(i, bodyC.copy(cb.color).multiplyScalar(0.30 * fade * hot));
        per.trim.setColorAt(i * 2, tmpC.copy(cb.color).multiplyScalar((0.85 + 3.2 * cb.sel + 1.4 * cb.hover) * fade));
        per.trim.setColorAt(i * 2 + 1, tmpC.copy(cb.color).multiplyScalar((0.85 + 3.2 * cb.sel + 1.4 * cb.hover) * fade));
        per.glow.setColorAt(i, tmpC.copy(cb.color).multiplyScalar((0.55 + 1.5 * cb.sel + 0.5 * cb.hover) * vis));
        per.streak.setColorAt(i, tmpC.copy(cb.color).multiplyScalar((0.55 + 1.1 * cb.sel + 0.3 * cb.hover) * vis));

        cb.screen.material.opacity = fade * (0.93 + 0.07 * Math.sin(time * 7 + cb.phase));
        cb.screen.material.color.setScalar(1 + 0.12 * cb.hover + 0.38 * cb.sel);
        cb.marquee.material.opacity = fade;
        cb.marquee.material.color.setScalar(1 + 0.10 * cb.hover + 0.30 * cb.sel);
        var sc = 1 + 0.035 * cb.sel;
        cb.screen.scale.setScalar(sc);
        cb.marquee.scale.setScalar(sc);
      }
      per.body.instanceColor.needsUpdate = true;
      per.trim.instanceColor.needsUpdate = true;
      per.glow.instanceColor.needsUpdate = true;
      per.streak.instanceColor.needsUpdate = true;

      /* --- 聚光跟随选中 --- */
      var sc2 = selected >= 0 ? cabinets[selected] : null;
      if (sc2) {
        var s = sc2.sel;
        beam.visible = ring.visible = s > 0.02;
        beam.position.x = sc2.sx;
        beam.position.z = sc2.z;
        beam.material.color.copy(sc2.color);
        beam.material.opacity = 0.16 * s;
        ring.position.x = sc2.sx;
        ring.position.z = sc2.z;
        ring.material.color.copy(sc2.color);
        ring.material.opacity = 0.55 * s;
        var rs = 1 + 0.05 * Math.sin(time * 4);
        ring.scale.setScalar(rs);
      } else {
        beam.visible = ring.visible = false;
      }

      /* --- 招牌轻微闪烁 --- */
      for (var k = 0; k < signMats.length; k += 2) {
        var f = 1;
        if ((k / 2) % 3 === 0) f = 0.82 + 0.18 * Math.abs(Math.sin(time * 2.4 + k));
        signMats[k].opacity = f;
      }

      /* --- 尘埃漂浮 --- */
      if (dustN) {
        var arr = dustGeo.attributes.position.array;
        for (var p = 0; p < dustN; p++) {
          var ph = dustPh[p];
          arr[p * 3] = dustBase[p * 3] + Math.sin(time * 0.35 + ph) * 0.55;
          arr[p * 3 + 1] = 0.4 + ((dustBase[p * 3 + 1] - 0.4 + time * 0.10) % 9.6);
          arr[p * 3 + 2] = dustBase[p * 3 + 2] + Math.cos(time * 0.28 + ph) * 0.4;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
    }

    function dispose() {
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          var m = o.material;
          if (Array.isArray(m)) m.forEach(function (mm) { mm.dispose && mm.dispose(); });
          else m.dispose && m.dispose();
        }
      });
      if (pmrem) pmrem.dispose();
    }

    return {
      scene: scene, cabinets: cabinets, bodyMesh: per.body, signMats: signMats,
      focusPose: focusPose, setFilter: setFilter, setHover: setHover, setSelected: setSelected,
      update: update, dispose: dispose, setRenderQuality: function (low) {
        per.shade.visible = !low;
        coneGroup.visible = !low;
        stars.visible = !low || starN > 0;
      }
    };
  }

  return { build: build, GAP: GAP, ROW_X: ROW_X };
})();
