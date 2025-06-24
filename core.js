// core.js - (自包含、功能齐全的最终版)
// 版本: 1.0.0
// 描述: 集成了高级嗅探、M3U8净化、强大的悬浮播放器UI等所有核心功能。

(function() {
    'use strict';
    
    // 防止因 onUpdated 多次触发等原因重复注入和执行
    if (window.M3U8_PURIFIER_CORE_LOADED) {
        return;
    }
    window.M3U8_PURIFIER_CORE_LOADED = true;

    console.log('%c[M3U8 Purifier Core] v1.0.0 Executed!', 'color: hotpink; font-size: 16px; font-weight: bold;');

    // =================================================================================
    // 模块 1: 全局状态与常量
    // =================================================================================
    const SCRIPT_NAME = 'M3U8 净化平台';
    let isPlayerActive = false;
    let playerHooked = false;
    let dataScraped = false;

    const ICONS = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        pip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,
        analyze: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
        external_player: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm-2 14H5V5h14v12zM12 9l-4 4h8z" transform="rotate(90 12 12)"/></svg>`
    };
    
    // 模拟设置，未来可以从 GM_getValue 或其他地方加载
    const settings = {
        m3u8_keywords: ['toutiao', 'qiyi', '/ad', '-ad-', '_ad_'],
        m3u8_smart_slice: true,
        m3u8_auto_play: true,
        m3u8_playback_rate: 1.0,
        m3u8_gestures: true,
        m3u8_long_press_speed: 2.5,
        m3u8_floating_pos: { left: '100px', top: '100px', width: '60vw', height: 'auto' }
    };
    
    // =================================================================================
    // 模块 2: 核心 M3U8 处理逻辑 (来自 content.js)
    // =================================================================================
    const M3u8Analyzer = {
        analyze(m3u8Content, keywords = []) {
            const lines = m3u8Content.split('\n');
            let result = { totalDuration: 0, segmentCount: 0, adCount: 0, encryption: '无', segments: [] }, currentDuration = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXTINF:')) { currentDuration = parseFloat(line.split(':')[1]); }
                else if (line && !line.startsWith('#')) {
                    result.segmentCount++; result.totalDuration += currentDuration; let isAd = false, reason = '';
                    for (const keyword of keywords) {
                        if (line.includes(keyword)) { isAd = true; reason = `关键词: ${keyword}`; result.adCount++; break; }
                    }
                    result.segments.push({ duration: currentDuration, url: line, isAd, reason }); currentDuration = 0;
                } else if (line.startsWith('#EXT-X-KEY')) { const method = line.match(/METHOD=([^,]+)/); result.encryption = method ? method[1] : '未知'; }
            }
            return result;
        }
    };
    
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
    // 模块 3: 播放器管理器 (来自 content.js)
    // =================================================================================
    const PlayerManager = {
        currentPlayerContainer: null, currentMediaItem: null,
        
        injectPlayer(mediaItem) {
            if (isPlayerActive) this.destroyPlayer();
            isPlayerActive = true;
            this.currentMediaItem = mediaItem;
            
            document.querySelectorAll('video, audio').forEach(p => { if (p.id !== 'purifier-player') p.pause(); });
            
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `position: fixed; inset: 0px; z-index: 2147483646; pointer-events: none;`;
            
            const container = document.createElement('div');
            container.style.cssText = `position: fixed; background: #1c1c1e; border-radius: 12px; box-shadow: rgba(0, 0, 0, 0.5) 0px 12px 40px; display: flex; flex-direction: column; z-index: 2147483647; pointer-events: all; border: 1px solid rgba(255, 255, 255, 0.1);`;
            Object.assign(container.style, {
                left: settings.m3u8_floating_pos.left,
                top: settings.m3u8_floating_pos.top,
                width: settings.m3u8_floating_pos.width,
                height: settings.m3u8_floating_pos.height,
                minWidth: '320px',
                minHeight: '180px'
            });

            const header = document.createElement('div');
            header.style.cssText = `background: #333; padding: 8px 15px; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; border-top-left-radius: 11px; border-top-right-radius: 11px;`;
            header.innerHTML = `<span style="color: white; font-weight: bold;">${SCRIPT_NAME}</span><div><button id="purifier-pip-btn" title="画中画">${ICONS.pip}</button><button id="purifier-close-btn" title="关闭">${ICONS.close}</button></div>`;
            header.querySelectorAll('button').forEach(b => b.style.cssText = 'background:none; border:none; cursor:pointer; opacity:0.7; transition:opacity 0.2s; padding:4px;');

            const video = document.createElement('video');
            video.id = 'purifier-player';
            video.style.cssText = `width: 100%; height: 100%; background-color: black; display: block; flex-grow: 1; border-bottom-left-radius: 11px; border-bottom-right-radius: 11px;`;
            
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
                isDragging = true;
                const coords = e.touches ? e.touches[0] : e;
                offsetX = coords.clientX - element.offsetLeft;
                offsetY = coords.clientY - element.offsetTop;
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('touchend', onDragEnd);
            };
            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const coords = e.touches ? e.touches[0] : e;
                element.style.left = `${coords.clientX - offsetX}px`;
                element.style.top = `${coords.clientY - offsetY}px`;
            };
            const onDragEnd = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('touchend', onDragEnd);
                // Save position
                settings.m3u8_floating_pos.left = element.style.left;
                settings.m3u8_floating_pos.top = element.style.top;
            };
            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
        }
    };

    // =================================================================================
    // 模块 4: 主处理函数 (连接嗅探器和播放器)
    // =================================================================================
    async function handleMedia(mediaItem) {
        if (window.self !== window.top) return;
        if (!settings.m3u8_auto_play) {
            console.log('[Core] Autoplay is disabled. Media found:', mediaItem.url);
            return;
        }

        if (mediaItem.url.toLowerCase().includes('.m3u8') && mediaItem.responseText) {
            mediaItem.processedContent = processM3U8(mediaItem.responseText, mediaItem.url);
        }
        
        PlayerManager.injectPlayer(mediaItem);
    }

    // =================================================================================
    // 模块 5: 高级嗅探器 Interceptor
    // =================================================================================
    const Interceptor = {
        dispatchMediaFoundEvent(payload) {
            if ( (dataScraped && !payload.source.includes('Reddit')) || playerHooked ) {
                return;
            }
            if(payload.source.includes('Reddit')) dataScraped = true;
            if(payload.source.includes('PlayerHook')) playerHooked = true;
            
            handleMedia(payload);
        },
        
        scrapeRedditData() {
            if (window.location.hostname.includes('reddit.com')) {
                try {
                    const dataScript = document.querySelector('script#data');
                    if (!dataScript || !dataScript.textContent) return;
                    const jsonString = dataScript.textContent.substring(dataScript.textContent.indexOf('{'));
                    const jsonData = JSON.parse(jsonString);
                    if (!jsonData || !jsonData.posts || !jsonData.posts.models) return;
                    for (const key in jsonData.posts.models) {
                        const post = jsonData.posts.models[key];
                        if (post && post.media && post.media.is_video && post.media.hls_url) {
                            this.dispatchMediaFoundEvent({ url: post.media.hls_url, source: 'Reddit Pre-load' });
                            return;
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
                for (const key of potentialKeys) {
                    if (typeof config[key] === 'string' && (config[key].includes('.m3u8') || config[key].includes('.m3u'))) return config[key];
                }
                if (config.video && typeof config.video.url === 'string' && (config.video.url.includes('.m3u8') || config.video.url.includes('.m3u'))) return config.video.url;
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
    // 模块 6: 启动入口
    // =================================================================================
    // 在注入时立即启动所有嗅探器
    Interceptor.activate();

})();