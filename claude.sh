#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#   Termux 一键安装 Claude Code + ZSH 开箱即用脚本
#   作者: 自动生成  |  适用: Android Termux 最新版
#   用法: bash install_claudecode.sh
# ============================================================

set -e

# ── 颜色定义 ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── 日志函数 ──────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
title()   { echo -e "\n${BOLD}${CYAN}==== $* ====${NC}\n"; }

# ── Banner ────────────────────────────────────────────────
clear
echo -e "${BOLD}${GREEN}"
cat << 'EOF'
  ______ _                 _        _____          _
 / _____) |               | |      / ____)        | |
| /     | | __ _ _   _  __| | ___ | /     ___   __| | ___
| |     | |/ _` | | | |/ _` |/ _ \| |    / _ \ / _` |/ _ \
| \_____| | (_| | |_| | (_| |  __/| \___| (_) | (_| |  __/
 \______)_|\__,_|\__,_|\__,_|\___| \____ \___/ \__,_|\___|

        Termux 一键安装脚本  |  开箱即用版
EOF
echo -e "${NC}"
echo -e "  ${YELLOW}包含: 换源 · ZSH · Oh My Zsh · Node.js · Claude Code${NC}"
echo ""

# ── 检查 Termux 环境 ──────────────────────────────────────
if [ ! -d "/data/data/com.termux" ]; then
    error "请在 Termux 中运行本脚本！"
fi

# ── 提示用户确认 ──────────────────────────────────────────
echo -e "${YELLOW}本脚本将执行以下操作:${NC}"
echo "  1. 切换 Termux 软件源到国内镜像 (清华 TUNA)"
echo "  2. 更新系统并安装基础工具"
echo "  3. 安装 ZSH + Oh My Zsh + 常用插件"
echo "  4. 安装 Node.js (LTS) + 配置 npm 国内镜像"
echo "  5. 安装 Claude Code (全局)"
echo "  6. 配置好 .zshrc 环境变量"
echo ""
read -r -p "$(echo -e ${BOLD})是否继续？[Y/n] $(echo -e ${NC})" CONFIRM
CONFIRM=${CONFIRM:-Y}
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "已取消。"
    exit 0
fi

# ════════════════════════════════════════════════════════════
# STEP 1: 换源到清华 TUNA
# ════════════════════════════════════════════════════════════
title "STEP 1/6  切换国内镜像源 (清华 TUNA)"

info "备份原始源配置..."
if [ -f "$PREFIX/etc/apt/sources.list" ]; then
    cp "$PREFIX/etc/apt/sources.list" "$PREFIX/etc/apt/sources.list.bak" 2>/dev/null || true
fi

info "写入清华 TUNA 镜像..."
cat > "$PREFIX/etc/apt/sources.list" << 'SOURCES'
# 清华大学 TUNA 镜像 - Termux
deb https://mirrors.tuna.tsinghua.edu.cn/termux/apt/termux-main stable main
SOURCES

# 也替换 termux-tools 源（如果存在）
if [ -d "$PREFIX/etc/apt/sources.list.d" ]; then
    for f in "$PREFIX/etc/apt/sources.list.d"/*.list; do
        [ -f "$f" ] && sed -i 's|https://packages.termux.dev|https://mirrors.tuna.tsinghua.edu.cn/termux|g' "$f" 2>/dev/null || true
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
# STEP 3: 安装 ZSH + Oh My Zsh
# ════════════════════════════════════════════════════════════
title "STEP 3/6  安装 ZSH + Oh My Zsh"

# 安装 ZSH
if ! command -v zsh &>/dev/null; then
    info "安装 ZSH..."
    apt-get install -y zsh 2>&1 | grep "Setting up" | head -5 || true
else
    info "ZSH 已安装，跳过"
fi

# 安装 Oh My Zsh（离线/在线兼容）
OMZ_DIR="$HOME/.oh-my-zsh"
if [ ! -d "$OMZ_DIR" ]; then
    info "安装 Oh My Zsh (使用国内 gitee 镜像)..."
    # 优先用 gitee 国内镜像
    git clone --depth=1 https://gitee.com/mirrors/oh-my-zsh.git "$OMZ_DIR" 2>&1 | tail -3 \
    || git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git "$OMZ_DIR" 2>&1 | tail -3 \
    || error "Oh My Zsh 安装失败，请检查网络"
else
    info "Oh My Zsh 已安装，跳过"
fi

# 安装 zsh-autosuggestions 插件
ZSH_CUSTOM="${ZSH_CUSTOM:-$OMZ_DIR/custom}"
AUTOSUGGEST_DIR="$ZSH_CUSTOM/plugins/zsh-autosuggestions"
if [ ! -d "$AUTOSUGGEST_DIR" ]; then
    info "安装 zsh-autosuggestions..."
    git clone --depth=1 https://gitee.com/zsh-users/zsh-autosuggestions.git "$AUTOSUGGEST_DIR" 2>&1 | tail -2 \
    || git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions.git "$AUTOSUGGEST_DIR" 2>&1 | tail -2 || warn "autosuggestions 安装失败，跳过"
fi

# 安装 zsh-syntax-highlighting 插件
SYNTAX_DIR="$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
if [ ! -d "$SYNTAX_DIR" ]; then
    info "安装 zsh-syntax-highlighting..."
    git clone --depth=1 https://gitee.com/zsh-users/zsh-syntax-highlighting.git "$SYNTAX_DIR" 2>&1 | tail -2 \
    || git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting.git "$SYNTAX_DIR" 2>&1 | tail -2 || warn "syntax-highlighting 安装失败，跳过"
fi

success "ZSH + Oh My Zsh 安装完成"

# ════════════════════════════════════════════════════════════
# STEP 4: 安装 Node.js
# ════════════════════════════════════════════════════════════
title "STEP 4/6  安装 Node.js (LTS)"

if command -v node &>/dev/null; then
    NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ] 2>/dev/null; then
        success "Node.js $(node --version) 已满足要求，跳过安装"
    else
        warn "Node.js 版本过低 ($(node --version))，重新安装..."
        apt-get install -y nodejs 2>&1 | grep "Setting up" | head -5 || true
    fi
else
    info "安装 Node.js..."
    apt-get install -y nodejs 2>&1 | grep "Setting up" | head -5 || true
fi

# 验证版本
NODE_VER_CHECK=$(node --version 2>/dev/null || echo "未安装")
info "Node.js 版本: $NODE_VER_CHECK"

# 配置 npm 使用国内淘宝镜像
info "配置 npm 淘宝镜像..."
npm config set registry https://registry.npmmirror.com

# 配置 npm 全局路径到 home（避免权限问题）
NPM_GLOBAL="$HOME/.npm-global"
mkdir -p "$NPM_GLOBAL"
npm config set prefix "$NPM_GLOBAL"

success "Node.js 配置完成"

# ════════════════════════════════════════════════════════════
# STEP 5: 安装 Claude Code
# ════════════════════════════════════════════════════════════
title "STEP 5/6  安装 Claude Code"

export PATH="$NPM_GLOBAL/bin:$PATH"

if command -v claude &>/dev/null; then
    info "检测到已安装 Claude Code，更新到最新版..."
    npm install -g @anthropic-ai/claude-code 2>&1 | tail -5 || warn "更新失败，保留当前版本"
else
    info "安装 Claude Code (可能需要几分钟)..."
    npm install -g @anthropic-ai/claude-code 2>&1 | tail -5 \
    || error "Claude Code 安装失败！\n请检查网络，或尝试设置代理后重新运行。"
fi

CLAUDE_VER=$(claude --version 2>/dev/null || echo "未知")
success "Claude Code 安装完成: $CLAUDE_VER"

# ════════════════════════════════════════════════════════════
# STEP 6: 配置 .zshrc
# ════════════════════════════════════════════════════════════
title "STEP 6/6  配置 ZSH 环境"

ZSHRC="$HOME/.zshrc"

# 备份旧 .zshrc
if [ -f "$ZSHRC" ]; then
    cp "$ZSHRC" "${ZSHRC}.bak_$(date +%Y%m%d_%H%M%S)"
    info "已备份旧 .zshrc"
fi

info "写入 .zshrc 配置..."
cat > "$ZSHRC" << 'ZSHRC_CONTENT'
# ── Oh My Zsh 配置 ───────────────────────────────────────
export ZSH="$HOME/.oh-my-zsh"

# 主题：agnoster 好看，如需换其他主题改这里
ZSH_THEME="agnoster"

# 插件列表
plugins=(
    git
    zsh-autosuggestions
    zsh-syntax-highlighting
    colored-man-pages
    command-not-found
)

source $ZSH/oh-my-zsh.sh

# ── PATH 配置 ────────────────────────────────────────────
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$PREFIX/bin:$PATH"

# ── npm 淘宝镜像 ─────────────────────────────────────────
export NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"

# ── Claude Code API Key ──────────────────────────────────
# 填入你的 API Key（可选，OAuth登录则不需要）
# export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"

# ── 代理设置（如需要，取消注释并修改端口）────────────────
# export http_proxy="http://127.0.0.1:7890"
# export https_proxy="http://127.0.0.1:7890"
# export ALL_PROXY="socks5://127.0.0.1:7891"

# ── 常用别名 ─────────────────────────────────────────────
alias ll='ls -alF'
alias la='ls -A'
alias cls='clear'
alias zrc='nano ~/.zshrc && source ~/.zshrc'
alias srczrc='source ~/.zshrc'

# Claude Code 快捷命令
alias cc='claude'
alias ccc='claude --continue'
alias ccnew='claude --new-session'

# ── 语言设置 ─────────────────────────────────────────────
export LANG="zh_CN.UTF-8"
export LC_ALL="zh_CN.UTF-8"

# ── 欢迎信息 ─────────────────────────────────────────────
echo ""
echo "🤖  Claude Code 已就绪！输入 claude 开始使用"
echo "💡  快捷命令: cc / ccc(继续) / ccnew(新会话)"
echo ""
ZSHRC_CONTENT

# ── 设置 ZSH 为默认 Shell ─────────────────────────────────
info "设置 ZSH 为默认 Shell..."
if command -v chsh &>/dev/null; then
    chsh -s zsh 2>/dev/null && success "默认 Shell 已设为 ZSH" || warn "无法自动设置，请手动运行: chsh -s zsh"
else
    # Termux 方式
    TERMUX_PROPS="$HOME/../.termux/termux.properties"
    mkdir -p "$(dirname "$TERMUX_PROPS")" 2>/dev/null || true
    if ! grep -q "default-working-directory" "$TERMUX_PROPS" 2>/dev/null; then
        echo "default-working-directory=~" >> "$TERMUX_PROPS" 2>/dev/null || true
    fi
    # 写入 Termux shell 配置
    SHELL_CONF="$HOME/../.termux/shell"
    echo "zsh" > "$SHELL_CONF" 2>/dev/null && success "默认 Shell 已设为 ZSH" || warn "请手动在 Termux 设置中设置默认 Shell"
fi

success ".zshrc 配置完成"

# ════════════════════════════════════════════════════════════
# 完成！输出使用说明
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅  安装完成！${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}下一步操作:${NC}"
echo ""
echo -e "  ${CYAN}1. 重启 Termux${NC} (或执行 source ~/.zshrc)"
echo ""
echo -e "  ${CYAN}2. 登录 Claude Code:${NC}"
echo -e "     ${YELLOW}claude${NC}"
echo -e "     → 首次运行会打开浏览器进行 OAuth 授权"
echo -e "     → 需要 Claude Pro / Max / API 账号"
echo ""
echo -e "  ${CYAN}3. 或者用 API Key 登录:${NC}"
echo -e "     编辑 ~/.zshrc，取消注释并填写:"
echo -e "     ${YELLOW}export ANTHROPIC_API_KEY=\"sk-ant-xxxxxx\"${NC}"
echo ""
echo -e "  ${CYAN}4. 如在国内无法访问 Anthropic，设置代理:${NC}"
echo -e "     编辑 ~/.zshrc，取消注释代理配置行"
echo ""
echo -e "  ${CYAN}5. 快捷命令:${NC}"
echo -e "     ${YELLOW}cc${NC}      → 启动 Claude Code"
echo -e "     ${YELLOW}ccc${NC}     → 继续上次会话"
echo -e "     ${YELLOW}zrc${NC}     → 编辑 zshrc"
echo ""
echo -e "  ${CYAN}6. 诊断工具:${NC}"
echo -e "     ${YELLOW}claude doctor${NC}  → 检查环境是否正常"
echo ""
echo -e "${BOLD}${YELLOW}⚠️  请重启 Termux 让配置生效${NC}"
echo ""
