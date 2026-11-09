# -*- coding: utf-8 -*-
"""给 53 个游戏内页注入家族统一顶栏/页脚（幂等，可重复跑）。

   只注入：netcn-shell.css + family-bridge.css + shell/shell.js + family-bridge.js
   不注入 netcn-ui.css —— 它用 !important 把 body 洗成白底，会毁掉游戏画布。
   family-bridge.css 自带顶栏所需的 --ui-* 变量，视觉与首页一致。
"""
import glob
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = '20261107c6'

HEAD_LINKS = '''<link rel="stylesheet" href="../../shell/netcn-shell.css?v={v}">
<link rel="stylesheet" href="../../assets/css/family-bridge.css?v=1">
<script src="../../shell/shell.js?v={v}"></script>'''.format(v=VER)

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

FOOT = '''<footer class="nc-foot" data-nc-tone="dark">
  <nav class="nc-foot-nav" aria-label="netcn 站点">
    <a href="https://netcn.org/" data-nc-to="nav">导航</a>
    <a href="https://ask.netcn.org/" data-nc-to="ask">科学问答</a>
    <a href="https://quiz.netcn.org/" data-nc-to="quiz">头脑体操</a>
    <a href="https://game.netcn.org/" data-nc-to="game">玩游戏</a><a href="https://sky.netcn.org/" data-nc-to="sky">火烧云</a>
  </nav>
  <span class="nc-foot-note">© 2011-2026 游戏街机厅 game.netcn.org</span>
  <span class="nc-foot-site">53 款游戏 · 打开即玩 · 纪录仅存本地</span>
</footer>'''

BRIDGE_JS = '<script src="../../assets/js/family-bridge.js?v=1"></script>'


def process(path):
    s = io.open(path, encoding='utf-8').read()
    changed = False

    # 1) head：家族资源必须在游戏自己的 CSS 之后加载
    if 'family-bridge.css' not in s:
        anchor = '<link rel="stylesheet" href="../../assets/css/shell.css">'
        if anchor not in s:
            return 'NO_ANCHOR'
        s = s.replace(anchor, anchor + '\n' + HEAD_LINKS, 1)
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
    # 结构守卫
    bad = []
    for f in files:
        s = io.open(f, encoding='utf-8').read()
        if s.count('<nav class="nc-shell"') != 1 or s.count('<footer class="nc-foot"') != 1:
            bad.append(os.path.basename(os.path.dirname(f)))
        if 'family-bridge.css' not in s or 'family-bridge.js' not in s:
            bad.append(os.path.basename(os.path.dirname(f)) + ':bridge')
    if bad:
        print('STRUCTURE BAD:', bad[:10])
        return 1
    print('structure: all 53 pages have exactly one family nav/foot')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
