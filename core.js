// core.js - (自包含、功能齐全的最终版)
// 版本: 1.2.0
// 描述: 集成了高级嗅探、M3U8净化、强大的悬浮播放器UI、hls.js加载、CSS样式等所有核心功能。

(function() {
    'use strict';
    
    if (window.M3U8_PURIFIER_CORE_LOADED) {
        return;
    }
    window.M3U8_PURIFIER_CORE_LOADED = true;

    console.log('%c[M3U8 Purifier Core] v1.2.0 Executed!', 'color: hotpink; font-size: 16px; font-weight: bold;');

    // =================================================================================
    // 模块 1: 全局状态、常量与设置
    // =================================================================================
    const SCRIPT_NAME = 'M3U8 净化平台';
    let isPlayerActive = false;
    let playerHooked = false;
    let dataScraped = false;

    const settings = {
        m3u8_keywords: ['toutiao', 'qiyi', '/ad', '-ad-', '_ad_'],
        m3u8_smart_slice: true,
        m3u8_auto_play: true,
        m3u8_playback_rate: 1.0,
        m3u8_gestures: true,
        m3u8_long_press_speed: 2.5,
        m3u8_floating_pos: { left: '100px', top: '100px', width: '60vw', height: 'auto' }
    };
    
    const ICONS = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        pip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,
        analyze: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
        external_player: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm-2 14H5V5h14v12zM12 9l-4 4h8z" transform="rotate(90 12 12)"/></svg>`
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
            script.onerror = () => { console.error('[Core] Hls.js 加载失败!'); resolve(); }; // 即使失败也resolve，避免阻塞
            document.head.appendChild(script);
        });
    }

    function injectStyles() {
        if (document.getElementById('m3u8-purifier-styles')) return;
        const css = `
            #m3u8-player-backdrop { position: fixed; inset: 0px; z-index: 2147483646 !important; pointer-events: none; }
            #m3u8-player-container { position: fixed !important; background: #1c1c1e; border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); overflow: visible; display: flex; flex-direction: column; z-index: 2147483647 !important; pointer-events: all; border: 1px solid rgba(255, 255, 255, 0.1); }
            .m3u8-player-header { background: #333; padding: 8px 15px; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; border-top-left-radius: 11px; border-top-right-radius: 11px; }
            .m3u8-player-title { color: #fff; font-weight: bold; }
            .m3u8-player-controls button { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; padding: 5px; margin-left: 10px; }
            .m3u8-player-controls button:hover { opacity: 1; }
            #purifier-player { width: 100% !important; height: 100% !important; background-color: #000 !important; display: block; flex-grow: 1; border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; }
            .m3u8-resize-handle { position: absolute; background: transparent; z-index: 10; }
            .m3u8-resize-handle.handle-n { cursor: ns-resize; height: 10px; left: 10px; right: 10px; top: -5px; }
            .m3u8-resize-handle.handle-s { cursor: ns-resize; height: 10px; left: 10px; right: 10px; bottom: -5px; }
            .m3u8-resize-handle.handle-e { cursor: ew-resize; width: 10px; top: 10px; bottom: 10px; right: -5px; }
            .m3u8-resize-handle.handle-w { cursor: ew-resize; width: 10px; top: 10px; bottom: 10px; left: -5px; }
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
        if (settings.m3u8_smart_slice) {
            const dIndex = lines.findIndex(l => l.includes('#EXT-X-DISCONTINUITY'));
            if (dIndex > 0) {
                const hIndex = lines.findIndex(l => l.includes('#EXTINF'));
                if (hIndex > -1) lines = [...lines.slice(0, hIndex), ...lines.slice(dIndex)];
            }
        }
        try {
            const urlObj = new URL(m3u8Url, self.location.href);
            const origin = urlObj.origin;
            const basePath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            const query = urlObj.search;
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
                    if (!resolvedLine.startsWith('http')) resolvedLine = (resolvedLine.startsWith('/') ? origin + resolvedLine : basePath + resolvedLine) + query;
                    finalLines.push(resolvedLine);
                } else if (line.startsWith('#EXT-X-KEY')) {
                    const uriMatch = line.match(/URI="([^"]+)"/);
                    if (uriMatch && uriMatch[1] && !uriMatch[1].startsWith('http')) {
                        const absUri = uriMatch[1].startsWith('/') ? origin + uriMatch[1] : basePath + uriMatch[1];
                        finalLines.push(line.replace(uriMatch[1], absUri));
                    } else {
                        finalLines.push(line);
                    }
                } else {
                    finalLines.push(line);
                }
            }
            let result = finalLines.join('\n');
            if (!result.trim().startsWith('#EXTM3U')) result = '#EXTM3U\n' + result;
            return result;
        } catch (e) {
            console.error("[Core] M3U8 processing failed:", e);
            return text;
        }
    }

    // =================================================================================
    // 模块 4: 播放器管理器
    // =================================================================================
    const PlayerManager = {
        currentPlayerContainer: null,
        currentMediaItem: null,
        
        injectPlayer(mediaItem) {
            if (isPlayerActive) this.destroyPlayer();
            isPlayerActive = true;
            this.currentMediaItem = mediaItem;
            
            document.querySelectorAll('video, audio').forEach(p => { if (p.id !== 'purifier-player') { p.pause(); p.src = ''; p.load(); } });
            
            const backdrop = document.createElement('div');
            backdrop.id = 'm3u8-player-backdrop';
            
            const container = document.createElement('div');
            container.id = 'm3u8-player-container';
            Object.assign(container.style, {
                left: settings.m3u8_floating_pos.left,
                top: settings.m3u8_floating_pos.top,
                width: settings.m3u8_floating_pos.width,
                height: settings.m3u8_floating_pos.height,
            });

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
            header.querySelector('#purifier-pip-btn').addEventListener('click', () => video.requestPictureInPicture().catch(e => alert('画中画失败!')));
            this.makeDraggable(container, header);
        },

        setupPlayer(video, mediaItem) {
            video.controls = true;
            video.autoplay = true;
            video.playbackRate = settings.m3u8_playback_rate;

            let urlToPlay = mediaItem.url;
            if (mediaItem.processedContent) {
                try {
                    urlToPlay = `data:application/vnd.apple.mpegurl;base64,${btoa(unescape(encodeURIComponent(mediaItem.processedContent)))}`;
                } catch (e) { console.error('[Core] Data URL creation failed', e); }
            }

            if (typeof Hls !== 'undefined' && Hls.isSupported() && (urlToPlay.includes('.m3u8') || urlToPlay.startsWith('data:application'))) {
                const hls = new Hls({ debug: false });
                hls.loadSource(urlToPlay);
                hls.attachMedia(video);
                video.hls = hls;
            } else {
                video.src = urlToPlay;
            }
            
            video.play().catch(e => console.warn('[Core] Autoplay was prevented.', e));
        },
        
        destroyPlayer() {
            if (this.currentPlayerContainer) {
                const video = this.currentPlayerContainer.querySelector('video');
                if (video && video.hls) video.hls.destroy();
                this.currentPlayerContainer.remove();
                this.currentPlayerContainer = null;
            }
            isPlayerActive = false;
        },

        makeDraggable(element, handle) {
            let isDragging = false, offsetX, offsetY;
            const onDragStart = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
                isDragging = true;
                const coords = e.touches ? e.touches[0] : e;
                offsetX = coords.clientX - element.offsetLeft;
                offsetY = coords.clientY - element.offsetTop;
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd, { once: true });
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('touchend', onDragEnd, { once: true });
            };
            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const coords = e.touches ? e.touches[0] : e;
                element.style.left = `${coords.clientX - offsetX}px`;
                element.style.top = `${coords.clientY - offsetY}px`;
            };
            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                settings.m3u8_floating_pos.left = element.style.left;
                settings.m3u8_floating_pos.top = element.style.top;
            };
            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
        }
    };

    // =================================================================================
    // 模块 5: 主处理函数 (连接嗅探器和播放器)
    // =================================================================================
    async function handleMedia(mediaItem) {
        if (window.self !== window.top) return;
        if (!settings.m3u8_auto_play) return;
        
        await loadHlsJs();

        if (mediaItem.url.toLowerCase().includes('.m3u8') && mediaItem.responseText) {
            mediaItem.processedContent = processM3U8(mediaItem.responseText, mediaItem.url);
        }
        
        PlayerManager.injectPlayer(mediaItem);
    }

    // =================================================================================
    // 模块 6: 高级嗅探器 Interceptor
    // =================================================================================
    const Interceptor = {
        dispatchMediaFoundEvent(payload) {
            if ((dataScraped && !payload.source.includes('Reddit')) || playerHooked) return;
            if (payload.source.includes('Reddit')) dataScraped = true;
            if (payload.source.includes('PlayerHook')) playerHooked = true;
            handleMedia(payload);
        },
        
        scrapeRedditData() {
            if (window.location.hostname.includes('reddit.com')) {
                try {
                    const dataScript = document.querySelector('script#data');
                    if (!dataScript || !dataScript.textContent) return;
                    const jsonString = dataScript.textContent.substring(dataScript.textContent.indexOf('{'));
                    const jsonData = JSON.parse(jsonString);
                    if (jsonData?.posts?.models) {
                        for (const key in jsonData.posts.models) {
                            const post = jsonData.posts.models[key];
                            if (post?.media?.is_video && post.media.hls_url) {
                                this.dispatchMediaFoundEvent({ url: post.media.hls_url, source: 'Reddit Pre-load' });
                                return;
                            }
                        }
                    }
                } catch (e) {}
            }
        },

        hookPlayers() {
            const playerNames = ['aliplayer', 'DPlayer', 'TCPlayer', 'xgplayer', 'Chimee', 'videojs', 'player'];
            const extractSource = (config) => {
                if (!config) return null;
                const potentialKeys = ['source', 'url', 'src'];
                for (const key of potentialKeys) if (typeof config[key] === 'string' && config[key].includes('.m3u8')) return config[key];
                if (config.video?.url?.includes('.m3u8')) return config.video.url;
                return null;
            };
            playerNames.forEach(name => {
                let originalPlayer = null;
                Object.defineProperty(window, name, {
                    configurable: true,
                    set: (p) => { originalPlayer = p; },
                    get: () => (...args) => {
                        const m3u8Url = extractSource(args[0]);
                        if (m3u8Url && !playerHooked) {
                            this.dispatchMediaFoundEvent({ url: m3u8Url, source: `PlayerHook (${name})` });
                            return new Proxy({}, { get: () => () => {} });
                        }
                        if (typeof originalPlayer === 'function') {
                            try { return new originalPlayer(...args); } catch (e) { return originalPlayer(...args); }
                        }
                        return originalPlayer;
                    }
                });
            });
        },

        hookNetworkAndAPIs() {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const request = new Request(args[0], args[1]);
                if (!playerHooked && !dataScraped && request.url.includes('.m3u8')) {
                    try {
                        const response = await originalFetch(request);
                        if (response.ok) {
                            const cloned = response.clone();
                            cloned.text().then(body => this.dispatchMediaFoundEvent({ url: cloned.url, source: 'Fetch M3U8', responseText: body }));
                        }
                        return response;
                    } catch(e) {}
                }
                return originalFetch(...args);
            };

            const originalCreateObjectURL = URL.createObjectURL;
            window.URL.createObjectURL = (obj) => {
                const url = originalCreateObjectURL(obj);
                if (!playerHooked && !dataScraped && (obj instanceof Blob) && (obj.type.startsWith('video/') || obj.type.startsWith('audio/') || obj.type.includes('mpegurl'))) {
                    this.dispatchMediaFoundEvent({ url, source: `Blob (${obj.type})`});
                }
                return url;
            };
        },

        activate() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.scrapeRedditData());
            } else { this.scrapeRedditData(); }
            
            this.hookPlayers();
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
