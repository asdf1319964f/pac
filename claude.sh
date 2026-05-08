#!/bin/bash
# ==============================================
# Termux 一键安装 Claude Code (国内线路)
# 严格版本: Node.js v24.14.1, npm 11.13.0, Claude Code 2.1.112
# 自动卸载高版本，完全按指定版本安装
# ==============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TARGET_NODE_VERSION="24.14.1"
TARGET_NPM_VERSION="11.13.0"
TARGET_CLAUDE_VERSION="2.1.112"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Termux Claude Code 严格版本安装${NC}"
echo -e "${GREEN}  国内镜像加速版${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "目标版本:"
echo -e "  Node.js:    ${BLUE}v${TARGET_NODE_VERSION}${NC}"
echo -e "  npm:        ${BLUE}${TARGET_NPM_VERSION}${NC}"
echo -e "  Claude Code: ${BLUE}${TARGET_CLAUDE_VERSION}${NC}"
echo ""

# 检查是否为 Termux 环境
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}错误: 此脚本仅适用于 Termux 环境${NC}"
    exit 1
fi

# ==============================================
# 卸载函数
# ==============================================
uninstall_node_npm() {
    echo -e "${YELLOW}[卸载] 检测并完全卸载 Node.js/npm...${NC}"

    # 1. 卸载通过 pkg 安装的 nodejs
    if pkg list-installed 2>/dev/null | grep -q "nodejs"; then
        echo "  卸载 pkg 安装的 nodejs..."
        pkg uninstall -y nodejs nodejs-lts 2>/dev/null || true
    fi

    # 2. 完全清除 nvm 管理的所有版本
    export NVM_DIR="$HOME/.nvm"
    if [ -f "$NVM_DIR/nvm.sh" ]; then
        echo "  卸载 nvm 管理的所有 Node.js 版本..."
        \. "$NVM_DIR/nvm.sh" 2>/dev/null || true

        # 卸载所有已安装版本
        for version in $(nvm ls --no-colors 2>/dev/null | grep -oP 'v?\d+\.\d+\.\d+' | sort -u); do
            echo "    卸载 Node.js ${version}..."
            nvm uninstall "${version#v}" 2>/dev/null || true
        done
    fi

    # 3. 完全删除 nvm 目录
    if [ -d "$HOME/.nvm" ]; then
        echo "  删除 nvm 目录..."
        rm -rf "$HOME/.nvm"
    fi

    # 4. 删除 pkg 安装的 nodejs 残留目录
    if [ -d "$PREFIX/lib/node_modules" ]; then
        echo "  清理全局 node_modules..."
        rm -rf "$PREFIX/lib/node_modules" 2>/dev/null || true
    fi

    # 5. 清理 npm 缓存和配置
    echo "  清理 npm 缓存和配置..."
    rm -rf "$HOME/.npm" 2>/dev/null || true
    rm -f "$HOME/.npmrc" 2>/dev/null || true

    # 6. 清理 node 相关可执行文件
    rm -f "$PREFIX/bin/node" 2>/dev/null || true
    rm -f "$PREFIX/bin/npm" 2>/dev/null || true
    rm -f "$PREFIX/bin/npx" 2>/dev/null || true
    rm -f "$PREFIX/bin/corepack" 2>/dev/null || true

    # 7. 清理 nvm 环境变量（从 .bashrc 中移除）
    if [ -f "$HOME/.bashrc" ]; then
        echo "  清理 .bashrc 中的 nvm 配置..."
        sed -i '/NVM_DIR/d' "$HOME/.bashrc" 2>/dev/null || true
        sed -i '/nvm\.sh/d' "$HOME/.bashrc" 2>/dev/null || true
        sed -i '/bash_completion/d' "$HOME/.bashrc" 2>/dev/null || true
        sed -i '/NVM_NODEJS_ORG_MIRROR/d' "$HOME/.bashrc" 2>/dev/null || true
    fi

    if [ -f "$HOME/.zshrc" ]; then
        sed -i '/NVM_DIR/d' "$HOME/.zshrc" 2>/dev/null || true
        sed -i '/nvm\.sh/d' "$HOME/.zshrc" 2>/dev/null || true
        sed -i '/bash_completion/d' "$HOME/.zshrc" 2>/dev/null || true
    fi

    if [ -f "$HOME/.profile" ]; then
        sed -i '/NVM_DIR/d' "$HOME/.profile" 2>/dev/null || true
        sed -i '/nvm\.sh/d' "$HOME/.profile" 2>/dev/null || true
    fi

    echo -e "${GREEN}  Node.js/npm 卸载完成${NC}"
}

uninstall_claude_code() {
    echo -e "${YELLOW}[卸载] 检测并完全卸载 Claude Code...${NC}"

    # 1. 卸载 npm 全局安装的 Claude Code
    if command -v npm &>/dev/null; then
        echo "  卸载 npm 全局 Claude Code 包..."
        npm uninstall -g @anthropic-ai/claude-code 2>/dev/null || true
        npm uninstall -g claude-code 2>/dev/null || true
    fi

    # 2. 删除可能的可执行文件
    rm -f "$PREFIX/bin/claude" 2>/dev/null || true
    rm -f "$HOME/.local/bin/claude" 2>/dev/null || true
    rm -f "/usr/local/bin/claude" 2>/dev/null || true

    # 3. 清理 Claude Code 缓存和配置
    echo "  清理 Claude Code 缓存和配置..."
    rm -rf "$HOME/.claude" 2>/dev/null || true
    rm -rf "$HOME/.config/claude" 2>/dev/null || true
    rm -rf "$HOME/.cache/claude" 2>/dev/null || true

    echo -e "${GREEN}  Claude Code 卸载完成${NC}"
}

compare_versions() {
    # 如果版本不同返回 1，相同返回 0
    if [ "$1" = "$2" ]; then
        return 0
    else
        return 1
    fi
}

# ==============================================
# 开始安装流程
# ==============================================

# 更新软件源 (使用清华源)
echo -e "${YELLOW}[1/7] 配置国内镜像源...${NC}"
echo -e "${BLUE}即将打开源选择界面，请手动选择清华源 (Tsinghua) 或中科大源 (USTC)${NC}"
echo -e "${BLUE}按回车键继续...${NC}"
read -r
termux-change-repo

# 更新包管理器
echo -e "${YELLOW}[2/7] 更新包管理器...${NC}"
pkg update -y && pkg upgrade -y

# 安装必要依赖
echo -e "${YELLOW}[3/7] 安装依赖包...${NC}"
pkg install -y curl wget git gnupg openssl binutils build-essential python3 clang make

# 检测并卸载现有版本
echo -e "${YELLOW}[4/7] 检测现有版本...${NC}"

# 获取当前版本信息
CURRENT_NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' || echo "none")
CURRENT_NPM_VERSION=$(npm -v 2>/dev/null || echo "none")
CURRENT_CLAUDE_VERSION=$(claude -V 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "none")

echo "  当前 Node.js 版本: ${CURRENT_NODE_VERSION}"
echo "  当前 npm 版本: ${CURRENT_NPM_VERSION}"
echo "  当前 Claude Code 版本: ${CURRENT_CLAUDE_VERSION}"

NEED_REINSTALL=false

# 检查版本是否完全匹配
if [ "$CURRENT_NODE_VERSION" = "$TARGET_NODE_VERSION" ] && \
   [ "$CURRENT_NPM_VERSION" = "$TARGET_NPM_VERSION" ] && \
   [ "$CURRENT_CLAUDE_VERSION" = "$TARGET_CLAUDE_VERSION" ]; then
    echo -e "${GREEN}所有版本均已匹配，无需重新安装${NC}"
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  当前环境完全符合要求！${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo -e "  Node.js:    v${CURRENT_NODE_VERSION}"
    echo -e "  npm:        ${CURRENT_NPM_VERSION}"
    echo -e "  Claude Code: ${CURRENT_CLAUDE_VERSION}"
    exit 0
fi

# 检查是否需要卸载 Node.js
if [ "$CURRENT_NODE_VERSION" != "$TARGET_NODE_VERSION" ]; then
    echo -e "${RED}Node.js 版本不匹配，需要重新安装${NC}"
    NEED_REINSTALL=true
fi

# 检查是否需要卸载 Claude Code (依赖 Node.js，一并重装)
if [ "$CURRENT_CLAUDE_VERSION" != "$TARGET_CLAUDE_VERSION" ]; then
    echo -e "${RED}Claude Code 版本不匹配，需要重新安装${NC}"
    NEED_REINSTALL=true
fi

if [ "$NEED_REINSTALL" = true ]; then
    echo ""
    echo -e "${YELLOW}开始完全卸载...${NC}"
    uninstall_claude_code
    uninstall_node_npm
    echo ""

    # 重新加载环境（清除当前会话中的 nvm 引用）
    hash -r 2>/dev/null || true
    unset -f node npm npx nvm 2>/dev/null || true
fi

# 安装 Node.js 指定版本
echo -e "${YELLOW}[5/7] 安装 Node.js v${TARGET_NODE_VERSION}...${NC}"

# 安装 nvm
echo "  安装 nvm..."
export NVM_DIR="$HOME/.nvm"
curl -o- https://npmmirror.com/mirrors/nvm/install.sh | bash

# 加载 nvm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# 设置 Node.js 镜像源
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node

echo "  安装 Node.js v${TARGET_NODE_VERSION} (可能需要几分钟)..."
nvm install "${TARGET_NODE_VERSION}"
nvm use "${TARGET_NODE_VERSION}"
nvm alias default "${TARGET_NODE_VERSION}"

# 验证 Node.js 版本
INSTALLED_NODE_VERSION=$(node -v | sed 's/v//')
if [ "$INSTALLED_NODE_VERSION" != "$TARGET_NODE_VERSION" ]; then
    echo -e "${RED}错误: Node.js 版本安装失败！${NC}"
    echo "  期望: v${TARGET_NODE_VERSION}"
    echo "  实际: v${INSTALLED_NODE_VERSION}"
    exit 1
fi
echo -e "${GREEN}Node.js v${INSTALLED_NODE_VERSION} 安装成功${NC}"

# 配置 npm 国内镜像源
echo -e "${YELLOW}[6/7] 配置 npm 并安装指定版本...${NC}"
npm config set registry https://registry.npmmirror.com
npm config set disturl https://npmmirror.com/mirrors/node
npm config set sass_binary_site https://npmmirror.com/mirrors/node-sass
npm config set electron_mirror https://npmmirror.com/mirrors/electron
npm config set puppeteer_download_host https://npmmirror.com/mirrors

# 写入 .npmrc 持久化配置
cat > "$HOME/.npmrc" << EOF
registry=https://registry.npmmirror.com
disturl=https://npmmirror.com/mirrors/node
sass_binary_site=https://npmmirror.com/mirrors/node-sass
electron_mirror=https://npmmirror.com/mirrors/electron
puppeteer_download_host=https://npmmirror.com/mirrors
EOF

# 安装指定版本的 npm
echo "  安装 npm ${TARGET_NPM_VERSION}..."
npm install -g "npm@${TARGET_NPM_VERSION}" --registry=https://registry.npmmirror.com

# 验证 npm 版本
INSTALLED_NPM_VERSION=$(npm -v)
if [ "$INSTALLED_NPM_VERSION" != "$TARGET_NPM_VERSION" ]; then
    echo -e "${RED}错误: npm 版本安装失败！${NC}"
    echo "  期望: ${TARGET_NPM_VERSION}"
    echo "  实际: ${INSTALLED_NPM_VERSION}"
    exit 1
fi
echo -e "${GREEN}npm ${INSTALLED_NPM_VERSION} 安装成功${NC}"

# 安装 Claude Code 指定版本
echo -e "${YELLOW}[7/7] 安装 Claude Code v${TARGET_CLAUDE_VERSION}...${NC}"
npm install -g "@anthropic-ai/claude-code@${TARGET_CLAUDE_VERSION}" --registry=https://registry.npmmirror.com

# 验证 Claude Code 版本
INSTALLED_CLAUDE_VERSION=$(claude -V 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "none")
if [ "$INSTALLED_CLAUDE_VERSION" != "$TARGET_CLAUDE_VERSION" ]; then
    echo -e "${RED}错误: Claude Code 版本安装失败！${NC}"
    echo "  期望: ${TARGET_CLAUDE_VERSION}"
    echo "  实际: ${INSTALLED_CLAUDE_VERSION}"
    exit 1
fi
echo -e "${GREEN}Claude Code v${INSTALLED_CLAUDE_VERSION} 安装成功${NC}"

# 配置环境变量
echo -e "${YELLOW}配置环境变量...${NC}"

# 清理旧的 nvm 配置后写入新的
sed -i '/NVM_DIR/d' "$HOME/.bashrc" 2>/dev/null || true
sed -i '/nvm\.sh/d' "$HOME/.bashrc" 2>/dev/null || true
sed -i '/bash_completion/d' "$HOME/.bashrc" 2>/dev/null || true
sed -i '/NVM_NODEJS_ORG_MIRROR/d' "$HOME/.bashrc" 2>/dev/null || true

cat >> "$HOME/.bashrc" << 'EOF'

# NVM 配置
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Node.js 镜像源
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
EOF

# 最终验证
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  安装完成！所有版本严格匹配！${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "安装结果:"
echo -e "  Node.js:    ${GREEN}v$(node -v | sed 's/v//')${NC}  $( [ "$(node -v | sed 's/v//')" = "$TARGET_NODE_VERSION" ] && echo '✅' || echo '❌')"
echo -e "  npm:        ${GREEN}$(npm -v)${NC}  $( [ "$(npm -v)" = "$TARGET_NPM_VERSION" ] && echo '✅' || echo '❌')"
echo -e "  Claude Code: ${GREEN}$(claude -V | grep -oP '\d+\.\d+\.\d+')${NC}  $( [ "$(claude -V 2>/dev/null | grep -oP '\d+\.\d+\.\d+')" = "$TARGET_CLAUDE_VERSION" ] && echo '✅' || echo '❌')"
echo ""
echo -e "请执行以下命令使环境变量生效:"
echo -e "  ${YELLOW}source ~/.bashrc${NC}"
echo -e "或者重新打开 Termux"
echo ""
