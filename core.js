// core.js (终极整合版 - 多层嗅探协同作战)
// 版本: 2.0.0
// 描述: 集成定点抓取、轮询挂钩、原型链挂钩、网络嗅探等多种技术，形成全方位、高鲁棒性的媒体嗅探核心。

(function() {
    'use strict';
    
    // 使用带版本的标志位，确保每次更新都能重新注入
    if (window.M3U8_PURIFIER_CORE_LOADED_V2_0_0) {
        return;
    }
    window.M3U8_PURIFIER_CORE_LOADED_V2_0_0 = true;

    console.log('%c[M3U8 Purifier Core] v2.0.0 Executed! (Ultimate Edition)', 'color: gold; font-size: 16px; font-weight: bold;');

    // =================================================================================
    // 模块 1: 全局状态、常量与设置
    // =================================================================================
    const SCRIPT_NAME = 'M3U8 净化平台';
    let isPlayerActive = false;
    let mediaFoundAndHandled = false; // 全局锁，确保只处理一次

    const settings = {
        m3u8_keywords: ['toutiao', 'qiyi', '/ad', '-ad-', '_ad_'],
        m3u8_smart_slice: true,
        m3u8_auto_play: true,
        m3u8_playback_rate: 1.0,
        m3u8_floating_pos: { left: '100px', top: '100px', width: '60vw', height: 'auto' }
    };
    
    const ICONS = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        pip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`
    };

    // =================================================================================
    // 模块 2: 动态加载与注入
    // =================================================================================
    function loadHlsJs() {
        return new Promise((resolve) => {
            if (typeof Hls !== 'undefined') return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
            script.onload = resolve;
            script.onerror = () => { console.error('[Core] Hls.js 加载失败!'); resolve(); };
            document.head.appendChild(script);
        });
    }

    function injectStyles() {
        if (document.getElementById('m3u8-purifier-styles')) return;
        const css = `
            #m3u8-player-backdrop { position: fixed; inset: 0px; z-index: 2147483646 !important; pointer-events: none; }
            #m3u8-player-container { position: fixed !important; background: #1c1c1e; border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); overflow: visible; display: flex; flex-direction: column; z-index: 2147483647 !important; pointer-events: all; border: 1px solid rgba(255, 255, 255, 0.1); }
            .m3u8-player-header { background: #333; padding: 8px 15px; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; border-top-left-radius: 11px; border-top-right-radius: 11px; }
            .m3u8-player-title { color: #fff; font-weight: bold; font-family: sans-serif; }
            .m3u8-player-controls button { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; padding: 5px; margin-left: 10px; }
            #purifier-player { width: 100% !important; height: 100% !important; background-color: #000 !important; display: block; flex-grow: 1; border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; }
        `;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'm3u8-purifier-styles';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    // =================================================================================
    // 模块 3: M3U8 处理逻辑
    // =================================================================================
    function processM3U8(text, m3u8Url) {
        let lines = text.split('\n');
        try {
            const urlObj = new URL(m3u8Url, self.location.href);
            const origin = urlObj.origin;
            const basePath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            const keywords = settings.m3u8_keywords || [];
            const finalLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                if (!line.startsWith('#') && /\.(ts|m3u8)/i.test(line)) {
                    if (keywords.some(k => line.includes(k))) {
                        if (finalLines.length > 0 && finalLines[finalLines.length - 1].startsWith('#EXTINF')) finalLines.pop();
                        continue;
                    }
                    let resolvedLine = line;
                    if (!resolvedLine.startsWith('http')) resolvedLine = (resolvedLine.startsWith('/') ? origin + resolvedLine : basePath + resolvedLine);
                    finalLines.push(resolvedLine);
                } else {
                    finalLines.push(line);
                }
            }
            return finalLines.join('\n');
        } catch (e) {
            return text;
        }
    }

    // =================================================================================
    // 模块 4: 播放器管理器
    // =================================================================================
    const PlayerManager = {
        currentPlayerContainer: null,
        injectPlayer(mediaItem) {
            if (isPlayerActive) this.destroyPlayer();
            isPlayerActive = true;
            document.querySelectorAll('video, audio').forEach(p => { if (p.id !== 'purifier-player') { p.pause(); } });
            
            const backdrop = document.createElement('div');
            backdrop.id = 'm3u8-player-backdrop';
            const container = document.createElement('div');
            container.id = 'm3u8-player-container';
            Object.assign(container.style, settings.m3u8_floating_pos);
            const header = document.createElement('div');
            header.className = 'm3u8-player-header';
            header.innerHTML = `<span class="m3u8-player-title">${SCRIPT_NAME}</span><div class="m3u8-player-controls"><button id="purifier-pip-btn" title="画中画">${ICONS.pip}</button><button id="purifier-close-btn" title="关闭">${ICONS.close}</button></div>`;
            const video = document.createElement('video');
            video.id = 'purifier-player';
            container.append(header, video);
            backdrop.appendChild(container);
            document.body.appendChild(backdrop);
            this.setupPlayer(video, mediaItem);
            this.currentPlayerContainer = backdrop;
            header.querySelector('#purifier-close-btn').addEventListener('click', () => this.destroyPlayer());
            header.querySelector('#purifier-pip-btn').addEventListener('click', () => video.requestPictureInPicture().catch(() => {}));
            this.makeDraggable(container, header);
        },
        setupPlayer(video, mediaItem) {
            video.controls = true;
            video.autoplay = true;
            let urlToPlay = mediaItem.url;
            if (mediaItem.processedContent) {
                try { urlToPlay = `data:application/vnd.apple.mpegurl;base64,${btoa(unescape(encodeURIComponent(mediaItem.processedContent)))}`; } catch (e) {}
            }
            if (typeof Hls !== 'undefined' && Hls.isSupported() && (urlToPlay.includes('.m3u8') || urlToPlay.startsWith('data:application'))) {
                const hls = new Hls({ debug: false });
                hls.loadSource(urlToPlay);
                hls.attachMedia(video);
                video.hls = hls;
            } else {
                video.src = urlToPlay;
            }
            video.play().catch(() => {});
        },
        destroyPlayer() {
            if (this.currentPlayerContainer) {
                const video = this.currentPlayerContainer.querySelector('video');
                if (video && video.hls) video.hls.destroy();
                this.currentPlayerContainer.remove();
            }
            isPlayerActive = false;
            mediaFoundAndHandled = false;
        },
        makeDraggable(element, handle) {
            let isDragging = false, offsetX, offsetY;
            const onDragStart = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
                isDragging = true;
                const coords = e.touches ? e.touches[0] : e;
                offsetX = coords.clientX - element.offsetLeft;
                offsetY = coords.clientY - element.offsetTop;
                document.addEventListener('mousemove', onDragMove, { passive: true });
                document.addEventListener('mouseup', onDragEnd, { once: true });
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('touchend', onDragEnd, { once: true });
            };
            const onDragMove = (e) => {
                if (!isDragging) return; e.preventDefault();
                const coords = e.touches ? e.touches[0] : e;
                element.style.left = `${coords.clientX - offsetX}px`;
                element.style.top = `${coords.clientY - offsetY}px`;
            };
            const onDragEnd = () => { isDragging = false; };
            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
        }
    };

    // =================================================================================
    // 模块 5: 主处理函数 (全局锁)
    // =================================================================================
    async function handleMedia(mediaItem) {
        if (window.self !== window.top || mediaFoundAndHandled) return;
        mediaFoundAndHandled = true;
        
        console.log(`%c[Core] Media captured by "${mediaItem.source}". Locking further captures.`, 'color: violet; font-weight: bold;');
        
        await loadHlsJs();
        if (mediaItem.url.toLowerCase().includes('.m3u8') && mediaItem.responseText) {
            mediaItem.processedContent = processM3U8(mediaItem.responseText, mediaItem.url);
        }
        PlayerManager.injectPlayer(mediaItem);
    }

    // =================================================================================
    // 模块 6: 终极嗅探器 Interceptor
    // =================================================================================
    const Interceptor = {
        
        // 策略1: 定点数据抓取 (最高优先级)
        scrapeKnownSites() {
            if (window.location.hostname.includes('reddit.com')) {
                try {
                    const dataScript = document.querySelector('script#data');
                    if (!dataScript?.textContent) return;
                    const jsonString = dataScript.textContent.substring(dataScript.textContent.indexOf('{'));
                    const jsonData = JSON.parse(jsonString);
                    if (jsonData?.posts?.models) {
                        for (const key in jsonData.posts.models) {
                            const post = jsonData.posts.models[key];
                            if (post?.media?.is_video && post.media.hls_url) {
                                handleMedia({ url: post.media.hls_url, source: 'Reddit Pre-load' });
                                return;
                            }
                        }
                    }
                } catch (e) {}
            }
        },

        // 策略2: 轮询挂钩 (应对反调试)
        startPlayerPolling() {
            let attempts = 0;
            const maxAttempts = 20; // 最多轮询10秒
            const interval = setInterval(() => {
                if (mediaFoundAndHandled || attempts++ > maxAttempts) {
                    clearInterval(interval);
                    return;
                }
                // 轮询 DPlayer
                if (typeof window.DPlayer === 'function') {
                    clearInterval(interval);
                    const OriginalDPlayer = window.DPlayer;
                    window.DPlayer = function(...args) {
                        const config = args[0] || {};
                        const url = config.video?.url;
                        if (url && url.includes('.m3u8')) {
                            handleMedia({ url, source: `DPlayer Polling` });
                            return {};
                        }
                        return new OriginalDPlayer(...args);
};
                }
            }, 500);
        },

        // 策略3: 网络和API嗅探 (最后保障)
        hookNetworkAndAPIs() {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const request = new Request(args[0], args[1]);
                if (!mediaFoundAndHandled && request.url.includes('.m3u8')) {
                    try {
                        const response = await originalFetch(request);
                        if (response.ok) {
                            const cloned = response.clone();
                            cloned.text().then(body => handleMedia({ url: cloned.url, source: 'Fetch M3U8', responseText: body }));
                        }
                        return response;
                    } catch(e) {}
                }
                return originalFetch(...args);
            };

            const originalCreateObjectURL = URL.createObjectURL;
            window.URL.createObjectURL = (obj) => {
                const url = originalCreateObjectURL(obj);
                if (!mediaFoundAndHandled && (obj instanceof Blob) && (obj.type.startsWith('video/') || obj.type.includes('mpegurl'))) {
                    handleMedia({ url, source: `Blob (${obj.type})`});
                }
                return url;
            };
        },

        activate() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.scrapeKnownSites());
            } else { this.scrapeKnownSites(); }
            
            this.startPlayerPolling();
            this.hookNetworkAndAPIs();
        }
    };

    // =================================================================================
    // 模块 7: 启动入口
    // =================================================================================
    function initialize() {
        injectStyles();
        Interceptor.activate();
    }
    
    initialize();

})();
