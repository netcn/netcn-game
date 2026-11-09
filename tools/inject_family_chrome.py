# -*- coding: utf-8 -*-
"""给 53 个游戏内页注入家族统一 UI（幂等，可重复跑）。

   加载顺序（游戏自己的 CSS 之后）：
     netcn-shell.css      顶栏/页脚皮肤
     family-bridge.css    家族 --ui-* tokens（顶栏用）
     netcn-ui.css         全站统一纸感设计系统（body / 顶栏 / 页脚 / 按钮）
     family-ui.css        53 页共用的一套游戏 UI（工具条 / 舞台 / 浮层 / 主题联动）
   再配 shell/shell.js + family-bridge.js 完成明暗、中英、搜索的联动。
   游戏画布本身仍由各游戏绘制，只把外框换成家族规格。
"""
import glob
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = '20261107c6'

HEAD_LINKS = '''<link rel="stylesheet" href="../../shell/netcn-shell.css?v={v}">
<link rel="stylesheet" href="../../assets/css/family-bridge.css?v=2">
<link rel="stylesheet" href="../../shell/netcn-ui.css?v={v}">
<link rel="stylesheet" href="../../assets/css/family-ui.css?v=2">
<script src="../../shell/shell.js?v={v}"></script>'''.format(v=VER)

UI_LINKS = {
    'netcn-ui.css': '<link rel="stylesheet" href="../../shell/netcn-ui.css?v={v}">'.format(v=VER),
    'family-ui.css': '<link rel="stylesheet" href="../../assets/css/family-ui.css?v=2">',
}

NAV = '''<nav class="nc-shell" aria-label="netcn 站点导航">
  <a class="nc-brand" href="../../index.html" aria-label="返回首页"><span class="nc-mk" aria-hidden="true"></span><span class="nc-brand-txt">游戏厅</span></a>
  <nav class="nc-sw" aria-label="netcn 站点">
    <a href="https://netcn.org/" data-nc-to="nav">导航</a>
    <a href="https://ask.netcn.org/" data-nc-to="ask">科学问答</a>
    <a href="https://quiz.netcn.org/" data-nc-to="quiz">头脑体操</a>
    <a href="https://game.netcn.org/" data-nc-to="game">玩游戏</a><a href="https://sky.netcn.org/" data-nc-to="sky">火烧云</a>
  </nav>
  <div class="nc-search has-icon">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input id="q" type="search" autocomplete="off" placeholder="搜游戏（回车回大厅）" aria-label="搜索游戏">
  </div>
  <div class="nc-tools">
    <button class="nc-tool" id="ncTheme" type="button" aria-label="切换明暗">☾</button>
    <button class="nc-tool" id="ncLang" type="button" aria-label="切换语言">EN</button>
  </div>
</nav>'''

FOOT = '''<footer class="nc-foot">
  <nav class="nc-foot-nav" aria-label="netcn 站点">
    <a href="https://netcn.org/" data-nc-to="nav">导航</a>
    <a href="https://ask.netcn.org/" data-nc-to="ask">科学问答</a>
    <a href="https://quiz.netcn.org/" data-nc-to="quiz">头脑体操</a>
    <a href="https://game.netcn.org/" data-nc-to="game">玩游戏</a><a href="https://sky.netcn.org/" data-nc-to="sky">火烧云</a>
  </nav>
  <span class="nc-foot-note">© 2011-2026 游戏街机厅 game.netcn.org</span>
  <span class="nc-foot-site">53 款游戏 · 打开即玩 · 纪录仅存本地</span>
</footer>'''

BRIDGE_JS = '<script src="../../assets/js/family-bridge.js?v=2"></script>'


def process(path):
    s = io.open(path, encoding='utf-8').read()
    changed = False

    # 0) 旧版本号统一升级（新增统一 UI 后必须绕过 SW/browser 缓存）
    s2 = (s.replace('family-bridge.css?v=1', 'family-bridge.css?v=2')
           .replace('family-bridge.js?v=1', 'family-bridge.js?v=2'))
    if s2 != s:
        s, changed = s2, True

    # 1) head：首次注入完整家族资源
    if 'netcn-shell.css' not in s:
        anchor = '<link rel="stylesheet" href="../../assets/css/shell.css">'
        if anchor not in s:
            return 'NO_ANCHOR'
        s = s.replace(anchor, anchor + '\n' + HEAD_LINKS, 1)
        changed = True

    # 1b) 幂等补齐两张统一 UI 样式（旧页面升级用）
    missing = [UI_LINKS[k] for k in ('netcn-ui.css', 'family-ui.css') if k not in s]
    if missing:
        m = re.search(r'[ \t]*<link rel="stylesheet" href="\.\./\.\./assets/css/family-bridge\.css[^>]*>\n?', s)
        if m:
            s = s[:m.end()] + '\n'.join(missing) + '\n' + s[m.end():]
        else:
            anchor = '<link rel="stylesheet" href="../../assets/css/shell.css">'
            if anchor not in s:
                return 'NO_ANCHOR_2'
            s = s.replace(anchor, anchor + '\n' + '\n'.join(missing), 1)
        changed = True

    # 2) body 开头：家族顶栏
    if '<nav class="nc-shell"' not in s:
        m = re.search(r'<body\b[^>]*>', s)
        if not m:
            return 'NO_BODY'
        s = s[:m.end()] + '\n' + NAV + s[m.end():]
        changed = True

    # 3) body 结尾：家族页脚 + 联动脚本
    if '<footer class="nc-foot"' not in s:
        s = s.replace('</body>', FOOT + '\n' + BRIDGE_JS + '\n</body>', 1)
        changed = True
    elif 'family-bridge.js' not in s:
        s = s.replace('</body>', BRIDGE_JS + '\n</body>', 1)
        changed = True

    # 4) 页脚暗色标记：移除后与其余四站深浅完全一致
    if 'data-nc-tone="dark"' in s:
        s = s.replace('<footer class="nc-foot" data-nc-tone="dark">', '<footer class="nc-foot">')
        s = s.replace(' data-nc-tone="dark"', '')
        changed = True

    if changed:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
        return 'OK'
    return 'SKIP'


def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'games', '*', 'index.html')))
    stats = {}
    for f in files:
        r = process(f)
        stats[r] = stats.get(r, 0) + 1
    print('pages:', len(files), stats)
    bad = []
    for f in files:
        s = io.open(f, encoding='utf-8').read()
        name = os.path.basename(os.path.dirname(f))
        if s.count('<nav class="nc-shell"') != 1 or s.count('<footer class="nc-foot"') != 1:
            bad.append(name + ':chrome')
        for k in ('family-bridge.css', 'family-ui.css', 'netcn-ui.css',
                  'family-bridge.js', 'netcn-shell.css'):
            if k not in s:
                bad.append(name + ':' + k)
        if 'data-nc-tone' in s or 'family-bridge.css?v=1' in s or 'family-bridge.js?v=1' in s:
            bad.append(name + ':stale')
    if bad:
        print('STRUCTURE BAD:', bad[:20])
        return 1
    print('structure: all %d pages use the single shared family UI' % len(files))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
