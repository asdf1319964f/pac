#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#   Termux 一键安装 Claude Code + ZSH 开箱即用脚本 v2
#   修复: Oh My Zsh 中断问题 / Node v24 hang / glibc兼容
#   用法: bash install_claudecode.sh
# ============================================================
#
#   ⚠️  已知 Termux 限制（已全部处理）：
#   1. Oh My Zsh 安装会切换 shell 中断脚本 → RUNZSH=no 绕过
#   2. Termux pkg nodejs-lts = Node v24，Claude Code 会 hang → 锁 nodejs v22
#   3. Claude Code v2.1.113+ 改用 glibc 二进制，Android 不支持 → 锁 v2.1.112
#   4. Termux 没有 /tmp → 设置 CLAUDE_CODE_TMPDIR
#   5. claude 命令实际走 cli.js → alias 指向 node cli.js
# ============================================================

# ── 不要 set -e，避免某步非致命错误中断全流程 ─────────────

# ── 颜色定义 ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
title()   { echo -e "\n${BOLD}${CYAN}==== $* ====${NC}\n"; }

# ── 关键版本锁定 ──────────────────────────────────────────
# Node v22：v23/v24 在 Termux aarch64 上会 hang，v22 稳定
# Claude Code v2.1.112：最后一个纯 JS 版本，v2.1.113+ 用 glibc 二进制 Android 不兼容
CLAUDE_VERSION="2.1.112"
NODE_PKG="nodejs"   # Termux 的 nodejs 包 = v22，nodejs-lts = v24（有bug）

# ── Banner ────────────────────────────────────────────────
clear
echo -e "${BOLD}${GREEN}"
cat << 'EOF'
   _____ _                 _        _____          _
  / ____| |               | |      / ____)        | |
 | /    | | __ _ _   _  __| | ___ | /     ___   __| | ___
 | |    | |/ _` | | | |/ _` |/ _ \| |    / _ \ / _` |/ _ \
 | \____| | (_| | |_| | (_| |  __/| \___| (_) | (_| |  __/
  \_____)_|\__,_|\__,_|\__,_|\___| \____ \___/ \__,_|\___|

         Termux 一键安装脚本 v2  |  开箱即用版
EOF
echo -e "${NC}"
echo -e "  ${YELLOW}包含: 换源 · ZSH · Oh My Zsh · Node.js v22 · Claude Code v${CLAUDE_VERSION}${NC}"
echo ""

# ── 检查 Termux 环境 ──────────────────────────────────────
if [ ! -d "/data/data/com.termux" ]; then
    error "请在 Termux 中运行本脚本！"
fi

# ── 检查架构（Claude Code 只支持 aarch64）─────────────────
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    warn "当前架构: $ARCH，Claude Code 仅支持 aarch64(64位ARM)"
    warn "如果你的手机是64位CPU但跑了32位系统，Claude Code 无法运行"
    read -r -p "是否继续？[y/N] " ARCH_CONFIRM
    [[ "$ARCH_CONFIRM" =~ ^[Yy]$ ]] || exit 0
fi

# ── 提示用户确认 ──────────────────────────────────────────
echo -e "${YELLOW}本脚本将执行以下操作:${NC}"
echo "  1. 切换 Termux 软件源到国内镜像 (清华 TUNA)"
echo "  2. 更新系统并安装基础工具"
echo "  3. 安装 ZSH + Oh My Zsh + 常用插件（不中断脚本）"
echo "  4. 安装 Node.js v22（跳过有bug的v24）"
echo "  5. 安装 Claude Code v${CLAUDE_VERSION}（最后兼容Android的版本）"
echo "  6. 配置好 .zshrc / 修复 /tmp / 设置 alias"
echo ""
read -r -p "$(echo -e ${BOLD})是否继续？[Y/n] $(echo -e ${NC})" CONFIRM
CONFIRM=${CONFIRM:-Y}
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "已取消。"; exit 0
fi

# ════════════════════════════════════════════════════════════
# STEP 1: 换源到清华 TUNA
# ════════════════════════════════════════════════════════════
title "STEP 1/6  切换国内镜像源 (清华 TUNA)"

info "备份原始源配置..."
[ -f "$PREFIX/etc/apt/sources.list" ] && \
    cp "$PREFIX/etc/apt/sources.list" "$PREFIX/etc/apt/sources.list.bak" 2>/dev/null || true

info "写入清华 TUNA 镜像..."
cat > "$PREFIX/etc/apt/sources.list" << 'SOURCES'
# 清华大学 TUNA 镜像 - Termux
deb https://mirrors.tuna.tsinghua.edu.cn/termux/apt/termux-main stable main
SOURCES

if [ -d "$PREFIX/etc/apt/sources.list.d" ]; then
    for f in "$PREFIX/etc/apt/sources.list.d"/*.list; do
        [ -f "$f" ] && sed -i \
            's|https://packages.termux.dev|https://mirrors.tuna.tsinghua.edu.cn/termux|g' \
            "$f" 2>/dev/null || true
    done
fi

info "更新软件包列表..."
apt-get update -y 2>&1 | tail -3
success "镜像源切换完成"

# ════════════════════════════════════════════════════════════
# STEP 2: 安装基础依赖
# ════════════════════════════════════════════════════════════
title "STEP 2/6  安装基础工具"

PACKAGES="git curl wget tar gzip unzip openssh vim nano python3"
info "安装: $PACKAGES"
apt-get install -y $PACKAGES 2>&1 | grep -E "^(Setting up|E:)" | head -20 || true
success "基础工具安装完成"

# ════════════════════════════════════════════════════════════
# STEP 3: 安装 ZSH + Oh My Zsh（修复中断问题）
# ════════════════════════════════════════════════════════════
title "STEP 3/6  安装 ZSH + Oh My Zsh"

# 安装 ZSH
if ! command -v zsh &>/dev/null; then
    info "安装 ZSH..."
    apt-get install -y zsh 2>&1 | grep "Setting up" | head -5 || true
else
    info "ZSH 已安装，跳过"
fi

# ── 关键修复：RUNZSH=no CHSH=no 防止 Oh My Zsh 切换shell中断脚本 ──
OMZ_DIR="$HOME/.oh-my-zsh"
if [ ! -d "$OMZ_DIR" ]; then
    info "安装 Oh My Zsh (国内 gitee 镜像，不中断脚本)..."
    # RUNZSH=no：装完不自动切换到zsh
    # CHSH=no：不修改默认shell（我们后面自己设）
    export RUNZSH=no
    export CHSH=no
    # 用 gitee 镜像，失败才 fallback github
    git clone --depth=1 https://gitee.com/mirrors/oh-my-zsh.git "$OMZ_DIR" 2>&1 | tail -2 \
    || git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git "$OMZ_DIR" 2>&1 | tail -2 \
    || { warn "Oh My Zsh 安装失败，跳过（不影响 Claude Code）"; }
else
    info "Oh My Zsh 已安装，跳过"
fi

# 安装插件（只 clone，不执行任何 shell 切换）
ZSH_CUSTOM="${OMZ_DIR}/custom"
install_plugin() {
    local name="$1" gitee="$2" github="$3"
    local dir="$ZSH_CUSTOM/plugins/$name"
    if [ ! -d "$dir" ]; then
        info "安装插件: $name..."
        git clone --depth=1 "$gitee" "$dir" 2>&1 | tail -1 \
        || git clone --depth=1 "$github" "$dir" 2>&1 | tail -1 \
        || warn "$name 安装失败，跳过"
    else
        info "插件 $name 已存在，跳过"
    fi
}

install_plugin "zsh-autosuggestions" \
    "https://gitee.com/zsh-users/zsh-autosuggestions.git" \
    "https://github.com/zsh-users/zsh-autosuggestions.git"

install_plugin "zsh-syntax-highlighting" \
    "https://gitee.com/zsh-users/zsh-syntax-highlighting.git" \
    "https://github.com/zsh-users/zsh-syntax-highlighting.git"

success "ZSH + Oh My Zsh 安装完成"

# ════════════════════════════════════════════════════════════
# STEP 4: 安装 Node.js v22（跳过有bug的 v24）
# ════════════════════════════════════════════════════════════
title "STEP 4/6  安装 Node.js v22"

# 检查现有版本
if command -v node &>/dev/null; then
    CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$CURRENT_NODE" = "22" ]; then
        success "Node.js v22 已安装，跳过"
    elif [ "$CURRENT_NODE" = "24" ]; then
        warn "检测到 Node.js v24（已知在 Termux 上有 bug），降级到 v22..."
        apt-get remove -y nodejs 2>/dev/null || true
        apt-get install -y nodejs 2>&1 | grep "Setting up" | head -5 || true
    else
        warn "Node.js v$CURRENT_NODE，尝试安装 v22..."
        apt-get install -y nodejs 2>&1 | grep "Setting up" | head -5 || true
    fi
else
    info "安装 Node.js (v22)..."
    # 注意：Termux 的 'nodejs' 包 = v22，'nodejs-lts' = v24（有bug）
    apt-get install -y nodejs 2>&1 | grep "Setting up" | head -5 || true
fi

NODE_VER_ACTUAL=$(node --version 2>/dev/null || echo "未安装")
info "Node.js 版本: $NODE_VER_ACTUAL"

# 配置 npm 淘宝镜像 + 全局路径
info "配置 npm 淘宝镜像..."
npm config set registry https://registry.npmmirror.com

NPM_GLOBAL="$HOME/.npm-global"
mkdir -p "$NPM_GLOBAL"
npm config set prefix "$NPM_GLOBAL"
export PATH="$NPM_GLOBAL/bin:$PATH"

success "Node.js 配置完成"

# ════════════════════════════════════════════════════════════
# STEP 5: 安装 Claude Code v2.1.112（最后兼容 Android 的版本）
# ════════════════════════════════════════════════════════════
title "STEP 5/6  安装 Claude Code v${CLAUDE_VERSION}"

echo ""
warn "⚠️  重要说明:"
echo "   Claude Code v2.1.113+ 改用 glibc 原生二进制，Android 内核不支持"
echo "   锁定 v${CLAUDE_VERSION}（最后一个纯 JS 版本，Termux 完全兼容）"
echo "   使用 node cli.js 方式运行（功能完全相同）"
echo ""

# 安装指定版本
info "安装 @anthropic-ai/claude-code@${CLAUDE_VERSION}..."
npm install -g "@anthropic-ai/claude-code@${CLAUDE_VERSION}" 2>&1 | tail -5
if [ $? -ne 0 ]; then
    warn "npm 安装失败，尝试增加内存限制..."
    node --max-old-space-size=512 "$(which npm)" install -g \
        "@anthropic-ai/claude-code@${CLAUDE_VERSION}" 2>&1 | tail -5 \
    || error "Claude Code 安装失败！请检查网络连接后重试。"
fi

# 定位 cli.js 路径（两种可能的全局位置）
CLI_PATH=""
for try_path in \
    "$NPM_GLOBAL/lib/node_modules/@anthropic-ai/claude-code/cli.js" \
    "$PREFIX/lib/node_modules/@anthropic-ai/claude-code/cli.js"; do
    if [ -f "$try_path" ]; then
        CLI_PATH="$try_path"
        break
    fi
done

if [ -z "$CLI_PATH" ]; then
    # 动态查找
    CLI_PATH=$(find "$HOME" "$PREFIX" -name "cli.js" \
        -path "*/@anthropic-ai/claude-code/cli.js" 2>/dev/null | head -1)
fi

if [ -z "$CLI_PATH" ]; then
    error "找不到 cli.js，安装可能未完成。请检查 npm 全局路径。"
fi

info "找到 cli.js: $CLI_PATH"

# 创建可执行的 wrapper 脚本（彻底绕过 glibc 二进制）
WRAPPER="$NPM_GLOBAL/bin/claude"
mkdir -p "$NPM_GLOBAL/bin"
cat > "$WRAPPER" << WRAPPER_SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
# Claude Code wrapper for Termux (bypasses glibc native binary)
export CLAUDE_CODE_TMPDIR="\${CLAUDE_CODE_TMPDIR:-\$TMPDIR}"
export NODE_OPTIONS="\${NODE_OPTIONS:---max-old-space-size=512}"
exec node "${CLI_PATH}" "\$@"
WRAPPER_SCRIPT
chmod +x "$WRAPPER"

# 验证
CLAUDE_VER=$(node "$CLI_PATH" --version 2>/dev/null || echo "未知")
success "Claude Code 安装完成: v${CLAUDE_VER}"

# ════════════════════════════════════════════════════════════
# STEP 6: 配置 .zshrc
# ════════════════════════════════════════════════════════════
title "STEP 6/6  配置 ZSH 环境"

ZSHRC="$HOME/.zshrc"

# 备份旧配置
if [ -f "$ZSHRC" ]; then
    cp "$ZSHRC" "${ZSHRC}.bak_$(date +%Y%m%d_%H%M%S)"
    info "已备份旧 .zshrc"
fi

info "写入 .zshrc 配置..."
cat > "$ZSHRC" << ZSHRC_CONTENT
# ── Oh My Zsh 配置 ───────────────────────────────────────
export ZSH="\$HOME/.oh-my-zsh"

# 主题（robbyrussell 最稳定，agnoster 更好看但需要字体）
ZSH_THEME="robbyrussell"

# 插件
plugins=(
    git
    zsh-autosuggestions
    zsh-syntax-highlighting
    colored-man-pages
)

# 加载 Oh My Zsh（如果存在）
[ -f "\$ZSH/oh-my-zsh.sh" ] && source "\$ZSH/oh-my-zsh.sh"

# ── PATH ─────────────────────────────────────────────────
export PATH="\$HOME/.npm-global/bin:\$PATH"
export PATH="\$PREFIX/bin:\$PATH"

# ── npm 淘宝镜像 ─────────────────────────────────────────
export NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"

# ── Node.js 内存限制（防止手机内存不足崩溃）─────────────
export NODE_OPTIONS="--max-old-space-size=512"

# ── Termux 没有 /tmp，Claude Code 需要这个 ───────────────
export CLAUDE_CODE_TMPDIR="\$TMPDIR"

# ── Claude Code API Key（可选，OAuth登录则不需要）────────
# export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"

# ── 代理设置（国内用户取消注释，端口改成你的）────────────
# export http_proxy="http://127.0.0.1:7890"
# export https_proxy="http://127.0.0.1:7890"
# export ALL_PROXY="socks5://127.0.0.1:7891"

# ── 常用别名 ─────────────────────────────────────────────
alias ll='ls -alF'
alias la='ls -A'
alias cls='clear'
alias zrc='nano ~/.zshrc && source ~/.zshrc'
alias srczrc='source ~/.zshrc'

# ── Claude Code 快捷命令 ─────────────────────────────────
alias cc='claude'
alias ccc='claude --continue'
alias ccnew='claude --new-session'

# ── 欢迎信息 ─────────────────────────────────────────────
echo ""
echo "🤖  Claude Code v${CLAUDE_VERSION} 已就绪！输入 claude 开始使用"
echo "💡  快捷: cc=启动  ccc=继续  ccnew=新会话  zrc=编辑配置"
echo ""
ZSHRC_CONTENT

# ── 设置 ZSH 为默认 Shell（Termux 方式）─────────────────
info "设置 ZSH 为默认 Shell..."
TERMUX_DIR="$HOME/../.termux"
mkdir -p "$TERMUX_DIR" 2>/dev/null || true
echo "zsh" > "$TERMUX_DIR/shell" 2>/dev/null \
    && success "默认 Shell 已设为 ZSH" \
    || warn "无法自动设置默认 Shell，重启 Termux 后手动运行: chsh -s zsh"

success ".zshrc 配置完成"

# ════════════════════════════════════════════════════════════
# 完成！
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅  全部安装完成！                         ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}重要信息:${NC}"
echo -e "  Claude Code 版本: ${YELLOW}v${CLAUDE_VERSION}${NC}（Android 兼容版）"
echo -e "  cli.js 路径: ${CYAN}${CLI_PATH}${NC}"
echo -e "  Node.js 版本: ${CYAN}${NODE_VER_ACTUAL}${NC}"
echo ""
echo -e "${BOLD}下一步:${NC}"
echo ""
echo -e "  ${CYAN}1.${NC} ${BOLD}重启 Termux${NC}（完全退出再打开，让 ZSH 生效）"
echo ""
echo -e "  ${CYAN}2.${NC} 输入 ${YELLOW}claude${NC} 启动，首次会弹出浏览器登录"
echo -e "     需要 Claude Pro/Max 订阅 或 Anthropic API Key"
echo ""
echo -e "  ${CYAN}3.${NC} 如需 API Key 方式，编辑配置："
echo -e "     ${YELLOW}nano ~/.zshrc${NC}  → 找到 ANTHROPIC_API_KEY 那行取消注释"
echo ""
echo -e "  ${CYAN}4.${NC} 国内用户开启代理：编辑 ~/.zshrc 取消注释代理那几行"
echo ""
echo -e "${BOLD}${YELLOW}⚠️  请重启 Termux 让配置生效！${NC}"
echo ""
