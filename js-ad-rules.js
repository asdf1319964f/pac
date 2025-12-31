// ==UserScript==
// @name         M3U8 广告净化器 (V5.0 原生注入版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  利用 Script Injection 技术突破沙盒和 Iframe 限制，原生级拦截广告
// @author       TeaTea & You
// @match        *://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    const RULES_URL = "https://raw.githubusercontent.com/asdf1319964f/pac/refs/heads/master/adclear.json";
    // ===========================================

    // 1. 在油猴沙盒层：负责获取和缓存规则
    // 因为网页层(Injected)无法跨域请求 GitHub，必须由油猴层代劳
    async function syncRules() {
        const cachedRules = GM_getValue('injected_rules', []);

        // 每次页面加载都尝试后台更新规则
        GM_xmlhttpRequest({
            method: "GET",
            url: RULES_URL + "?t=" + Date.now(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const rules = JSON.parse(response.responseText);
                        GM_setValue('injected_rules', rules); // 更新缓存
                    } catch (e) {}
                }
            }
        });

        return cachedRules;
    }

    // 2. 注入核心：这是真正运行在网页上下文的代码
    // 它可以无视 Tampermonkey 的限制，直接修改原生对象
    function injectedCore(rulesData) {
        const LOG_PREFIX = `[M3U8净化]`;
        let COMPILED_REGEX = [];

        // --- 内部工具：编译正则 ---
        function compileRegex(rules) {
            let patterns = [];
            try {
                // 简单粗暴：不分 Hosts，只要有规则就全部加载
                // 这样能保证在 iframe 里（域名可能变了）也能生效
                rules.forEach(group => {
                    patterns = patterns.concat(group.regex);
                });
                patterns = [...new Set(patterns)]; // 去重
                return patterns.map(str => {
                    try { return new RegExp(str, 'gm'); } catch(e){ return null; }
                }).filter(r => r);
            } catch(e) { return []; }
        }

        COMPILED_REGEX = compileRegex(rulesData);
        if (COMPILED_REGEX.length === 0) return;

        console.log(LOG_PREFIX, "💉 原生拦截核已植入", window.location.href);

        // --- 内部工具：净化逻辑 ---
        function purify(content, url) {
            if (!content || typeof content !== 'string' || !content.includes('#EXTINF')) return content;

            let result = content;
            let dropped = 0;

            // 暴力全替换
            for (let regex of COMPILED_REGEX) {
                if (regex.source.includes('#EXT')) {
                    const matches = result.match(regex);
                    if (matches) {
                        dropped += matches.length;
                        result = result.replace(regex, '');
                    }
                }
            }

            // 切片粉碎
            const lines = result.split('\n');
            const final = [];
            let buffer = [];

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#EXTINF')) {
                    if (buffer.length) final.push(...checkBuf(buffer));
                    buffer = [line];
                } else if (buffer.length) {
                    buffer.push(line);
                    if (!line.startsWith('#') && line.length > 0) {
                        final.push(...checkBuf(buffer));
                        buffer = [];
                    }
                } else {
                    final.push(line);
                }
            }
            if (buffer.length) final.push(...checkBuf(buffer));

            result = final.join('\n');

            if (dropped > 0 || result.length < content.length) {
                console.log(LOG_PREFIX, `⚔️ 拦截成功! 所在窗口: ${window.self === window.top ? '主页' : 'Iframe'}`);
            }
            return result;
        }

        function checkBuf(buf) {
            const txt = buf.join('\n');
            for (let r of COMPILED_REGEX) {
                if (!r.source.includes('#EXT') && r.test(txt)) return [];
            }
            return buf;
        }

        // --- 核心：劫持 XHR (原生级) ---
        // 我们不修改 prototype，直接代理全局构造函数
        // 这样网站的防篡改机制检查 prototype 时会发现它是完好的
        const RealXHR = window.XMLHttpRequest;

        window.XMLHttpRequest = function() {
            const xhr = new RealXHR();
            const open = xhr.open;

            xhr.open = function(method, url) {
                this._url = url || '';
                return open.apply(this, arguments);
            };

            // 监听状态变化，直接覆盖 responseText
            // 这是最底层的方法，比 getter 劫持更暴力
            xhr.addEventListener('readystatechange', function() {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    const url = this._url || this.responseURL;
                    if (url && url.includes('.m3u8')) {
                        // 尝试获取原生响应
                        // 注意：这里需要 try-catch，因为某些 xhr 配置可能不允许读取文本
                        try {
                            const originalText = xhr.responseText; // 触发一次原生读取
                            if (originalText) {
                                const cleanText = purify(originalText, url);
                                // 强制覆写
                                Object.defineProperty(xhr, 'responseText', { value: cleanText, writable: true });
                                Object.defineProperty(xhr, 'response', { value: cleanText, writable: true });
                            }
                        } catch(e) {}
                    }
                }
            });

            return xhr;
        };
        // 保持原型链完整，欺骗反调试脚本
        window.XMLHttpRequest.prototype = RealXHR.prototype;
        Object.keys(RealXHR).forEach(k => window.XMLHttpRequest[k] = RealXHR[k]);


        // --- 核心：劫持 Fetch (原生级) ---
        const RealFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await RealFetch(...args);
            const url = response.url;
            if (url && url.includes('.m3u8')) {
                try {
                    const clone = response.clone();
                    let text = await clone.text();
                    text = purify(text, url);
                    return new Response(text, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } catch(e) { return response; }
            }
            return response;
        };
    }

    // 3. 执行逻辑
    async function main() {
        // 1. 先准备规则
        const rules = await syncRules();

        // 2. 将规则数据序列化
        const rulesStr = JSON.stringify(rules);

        // 3. 构造注入脚本
        // 我们把 injectedCore 函数转成字符串，塞到页面里去执行
        const script = document.createElement('script');
        script.textContent = `(${injectedCore.toString()})(${rulesStr});`;

        // 4. 插入页面 (立即执行)
        (document.head || document.documentElement).appendChild(script);
        script.remove(); // 执行完拔屌无情，移除标签防止被检测
    }

    main();

})();
