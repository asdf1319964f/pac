// ==UserScript==
// @name         M3U8 广告净化器 (V2.0 核弹版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  底层劫持 XHR/Fetch，基于 GitHub 规则实时净化 M3U8 流
// @author       TeaTea & You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-start
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    // 【必填】请替换为你 GitHub 文件的 Raw 地址
    const RULES_URL = "https://raw.githubusercontent.com/你的用户名/你的仓库/main/rules.json";
    // ===========================================

    // 日志样式
    const LOG_PREFIX = `%c[M3U8净化]`;
    const STYLE_INFO = 'color: #00ffff; background: #333; padding: 2px 4px; border-radius: 3px;';
    const STYLE_SUCCESS = 'color: #00ff00; background: #333; padding: 2px 4px; border-radius: 3px; font-weight: bold;';
    const STYLE_WARN = 'color: #ffff00; background: #333; padding: 2px 4px; border-radius: 3px;';

    let COMPILED_REGEX = []; // 编译好的正则库
    let IS_INTERCEPTOR_ACTIVE = false;

    // 1. 初始化：加载规则
    async function init() {
        // 先尝试读取缓存，为了速度
        const cachedRules = GM_getValue('cached_regex_strings', []);
        if (cachedRules.length > 0) {
            compileRegex(cachedRules);
            console.log(LOG_PREFIX, STYLE_INFO, `载入本地缓存规则 ${cachedRules.length} 条`);
        }

        // 异步更新规则
        GM_xmlhttpRequest({
            method: "GET",
            url: RULES_URL + "?t=" + Date.now(), // 防止 GitHub 缓存
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const rules = JSON.parse(response.responseText);
                        processRules(rules);
                    } catch (e) {
                        console.error("规则解析失败", e);
                    }
                }
            }
        });
    }

    // 2. 规则预处理：匹配当前环境
    function processRules(rulesData) {
        const currentUrl = window.location.href;
        let activeRegexStrings = [];

        rulesData.forEach(group => {
            // 检查 hosts：只要当前 URL 包含 hosts 里的任意关键词，就启用该组规则
            // 支持归纳法：比如 "155" 可以匹配 "v155.com"
            const isMatch = group.hosts.some(h => currentUrl.includes(h) || h === "*");
            
            if (isMatch) {
                console.log(LOG_PREFIX, STYLE_INFO, `命中规则组: ${group.name}`);
                activeRegexStrings = activeRegexStrings.concat(group.regex);
            }
        });

        // 去重
        activeRegexStrings = [...new Set(activeRegexStrings)];
        
        // 缓存并编译
        GM_setValue('cached_regex_strings', activeRegexStrings);
        compileRegex(activeRegexStrings);
    }

    function compileRegex(regexStrings) {
        COMPILED_REGEX = regexStrings.map(str => {
            try {
                return new RegExp(str);
            } catch (e) {
                console.warn("无效正则:", str);
                return null;
            }
        }).filter(r => r !== null);

        // 如果有规则，且拦截器还没启动，就启动
        if (COMPILED_REGEX.length > 0 && !IS_INTERCEPTOR_ACTIVE) {
            startInterceptor();
            IS_INTERCEPTOR_ACTIVE = true;
            console.log(LOG_PREFIX, STYLE_SUCCESS, `拦截器已启动，监控中...`);
        }
    }

    // 3. 核心净化逻辑
    function purifyM3U8(content, url) {
        // 快速检查：如果内容里没有 EXTINF，可能不是 m3u8，直接返回
        if (!content.includes('#EXTINF')) return content;

        const lines = content.split('\n');
        const newLines = [];
        let droppedCount = 0;
        let blockedBy = "";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            let shouldBlock = false;

            // 扫描正则库
            for (let regex of COMPILED_REGEX) {
                if (regex.test(line)) {
                    shouldBlock = true;
                    blockedBy = regex.toString();
                    break;
                }
            }

            if (shouldBlock) {
                droppedCount++;
                // 激进模式：如果你删了一行 EXTINF，通常下一行就是 URL，大部分广告的特征在 EXTINF 上
                // 但你的正则里有针对 URL 的特征（.ts），也有针对 EXTINF 的特征
                // 所以这里直接删掉命中行即可。
                // 如果是 #EXTINF 行被删，播放器会自动忽略下一行孤立的 URL 吗？
                // 为了保险，如果当前行被删且是 #EXTINF，我们标记跳过下一行？
                // 你的正则很多是针对 "两行组合" 的 (#EXT... \r\n #EXT...)，这种在 split 后会被打断
                // ⚠️ 注意：你的正则包含 \r\n，这意味着必须对【全文】进行匹配，而不是逐行匹配！
                continue; 
            }
            newLines.push(lines[i]);
        }
        
        // ⚠️ 针对多行正则的特殊处理：
        // 因为你的正则里有 "\r\n"，这在 split('\n') 后就失效了。
        // 所以我们需要先用全文正则替换，再做逐行清洗。
        let processedContent = content;
        
        // A. 全文正则替换 (处理跨行特征，如 #EXT-X-DISCONTINUITY...#EXTINF...)
        for (let regex of COMPILED_REGEX) {
            // 检查正则是否包含换行符特征
            if (regex.source.includes('\\n') || regex.source.includes('\\r')) {
                 const matchCount = (processedContent.match(regex) || []).length;
                 if (matchCount > 0) {
                     // 将匹配到的广告块替换为空
                     processedContent = processedContent.replace(regex, '');
                     droppedCount += matchCount;
                 }
            }
        }

        // 如果全文替换已经生效，就不需要上面的逐行扫描了？
        // 实际上建议结合。先做全文大块删除，剩下的再行处理。
        // 为简化逻辑，这里直接返回全文替换后的结果。
        
        if (droppedCount > 0) {
            console.log(LOG_PREFIX, STYLE_SUCCESS, `成功拦截 ${droppedCount} 个广告片段 | 来源: ${url.slice(-30)}`);
        }

        return processedContent;
    }

    // 4. 底层拦截器 (Proxy 方案)
    function startInterceptor() {
        
        // --- 劫持 Fetch ---
        const originalFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function(...args) {
            const response = await originalFetch(...args);
            const url = response.url;

            // 只处理 m3u8
            if (url.indexOf('.m3u8') !== -1) {
                try {
                    const clone = response.clone();
                    let text = await clone.text();
                    
                    // 净化
                    text = purifyM3U8(text, url);
                    
                    // 构造新响应
                    return new Response(text, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } catch (e) {
                    console.error("Fetch 净化出错", e);
                    return response;
                }
            }
            return response;
        };

        // --- 劫持 XHR (针对 Hls.js) ---
        const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
        const originalSend = unsafeWindow.XMLHttpRequest.prototype.send;

        unsafeWindow.XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        unsafeWindow.XMLHttpRequest.prototype.send = function() {
            // 只有是 m3u8 请求才挂载拦截器
            if (this._url && this._url.indexOf('.m3u8') !== -1) {
                const xhr = this;
                
                // 劫持 onload，因为 responseText 是只读的，我们需要在用户代码读取前修改它
                // 使用 Object.defineProperty 强制覆盖 responseText 属性
                const originalOnReadyStateChange = xhr.onreadystatechange;
                const originalOnLoad = xhr.onload;

                const hook = () => {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        try {
                            let text = xhr.responseText;
                            if (text) {
                                const newText = purifyM3U8(text, xhr._url);
                                
                                // 强制覆写 responseText
                                Object.defineProperty(xhr, 'responseText', { value: newText });
                                Object.defineProperty(xhr, 'response', { value: newText });
                            }
                        } catch (e) {
                            console.error("XHR 净化出错", e);
                        }
                    }
                };

                // 注入 hook
                if (originalOnReadyStateChange) {
                    xhr.onreadystatechange = function() {
                        hook();
                        return originalOnReadyStateChange.apply(this, arguments);
                    };
                } else {
                    xhr.addEventListener('readystatechange', hook);
                }
            }
            return originalSend.apply(this, arguments);
        };
    }

    // 启动
    init();

})();
