// core.js (最终配套版 - v9.0.0)
// 描述: 最终架构的核心逻辑，通过监听自定义DOM事件与插件UI交互。

(function() {
    'use strict';
    
    console.log('%c[M3U8 Purifier Core] v9.0.0 Executed! (DNR Edition)', 'color: #32CD32; font-size: 16px; font-weight: bold;');

    const SCRIPT_NAME = 'M3U8 净化平台';
    let isPlayerActive = false;
    let mediaFoundAndHandled = false;
    let localSettings = {};

    const ICONS = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        pip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`
    };

    function loadHlsJs() {
        return new Promise((resolve) => {
            if (typeof Hls !== 'undefined') return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
            script.onload = () => { console.log('[Core] Hls.js loaded.'); resolve(); };
            script.onerror = () => { console.error('[Core] Hls.js 加载失败!'); resolve(); };
            document.head.appendChild(script);
        });
    }

    function injectStyles() {
        if (document.getElementById('m3u8-purifier-styles')) return;
        const css = `
            #m3u8-player-backdrop { position: fixed; inset: 0px; z-index: 2147483647 !important; pointer-events: none; }
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
    
    function processM3U8(text, m3u8Url) {
        let lines = text.split('\n');
        try {
            const urlObj = new URL(m3u8Url, self.location.href);
            const origin = urlObj.origin;
            const basePath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            const keywords = localSettings.keywords || [];
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
        } catch (e) { return text; }
    }

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
            Object.assign(container.style, localSettings.floatingPos || { left: '100px', top: '100px', width: '60vw', height: 'auto' });
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
    
    const SettingsPanel = {
        isOpen: false, panelElement: null,
        toggle() { this.isOpen ? this.close() : this.open(); },
        async open() {
            if (this.isOpen) return;
            this.isOpen = true;
            
            localSettings = await new Promise(resolve => {
                document.dispatchEvent(new CustomEvent('__M3U8_PURIFIER_REQUEST__', { detail: { type: 'GET_SETTINGS' } }));
                const listener = (event) => {
                    if (event.detail.type === 'SETTINGS_DATA') {
                        document.removeEventListener('__M3U8_PURIFIER_RESPONSE__', listener);
                        resolve(event.detail.payload || {});
                    }
                };
                document.addEventListener('__M3U8_PURIFIER_RESPONSE__', listener);
            });

            this.panelElement = document.createElement('div');
            this.panelElement.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(8px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: sans-serif;`;
            this.panelElement.innerHTML = `
                <div style="background: #2c2c2e; color: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 600px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    <h2 style="text-align:center; margin-top:0;">${SCRIPT_NAME} 设置</h2>
                    <div style="margin-bottom: 15px;">
                        <label for="purifier-keywords">广告关键词 (一行一个):</label>
                        <textarea id="purifier-keywords" style="width: 100%; height: 100px; background: #3a3a3c; color: white; border: 1px solid #555; border-radius: 6px; margin-top: 5px; padding: 8px; box-sizing: border-box;">${(localSettings.keywords || ['/ad', '-ad-']).join('\n')}</textarea>
                    </div>
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <label for="purifier-autoplay">捕获后自动播放</label>
                        <input type="checkbox" id="purifier-autoplay" ${localSettings.autoPlay !== false ? 'checked' : ''}>
                    </div>
                    <div style="text-align: right; border-top: 1px solid #444; padding-top: 20px;">
                        <button id="purifier-close-settings" style="margin-right: 10px; padding: 8px 16px;">关闭</button>
                        <button id="purifier-save-settings" style="padding: 8px 16px; background-color: #007aff; border: none; color: white; border-radius: 6px;">保存</button>
                    </div>
                </div>`;
            document.body.appendChild(this.panelElement);
            this.panelElement.querySelector('#purifier-close-settings').addEventListener('click', () => this.close());
            this.panelElement.querySelector('#purifier-save-settings').addEventListener('click', () => {
                const settingsToSave = {
                    keywords: this.panelElement.querySelector('#purifier-keywords').value.split('\n').map(k => k.trim()).filter(Boolean),
                    autoPlay: this.panelElement.querySelector('#purifier-autoplay').checked
                };
                document.dispatchEvent(new CustomEvent('__M3U8_PURIFIER_REQUEST__', { detail: { type: 'SAVE_SETTINGS', payload: settingsToSave } }));
                localSettings = {...localSettings, ...settingsToSave};
                alert('设置已保存！');
                this.close();
            });
        },
        close() {
            if (!this.isOpen || !this.panelElement) return;
            this.panelElement.remove();
            this.panelElement = null;
            this.isOpen = false;
        }
    };
    
    async function handleMedia(mediaItem) {
        if (window.self !== window.top || mediaFoundAndHandled) return;
        mediaFoundAndHandled = true;
        if (localSettings.autoPlay === false) { mediaFoundAndHandled = false; return; }
        await loadHlsJs();
        if (mediaItem.url.toLowerCase().includes('.m3u8') && !mediaItem.processedContent) {
            try {
                const response = await fetch(mediaItem.url);
                if(response.ok) mediaItem.responseText = await response.text();
            } catch(e) {}
            if(mediaItem.responseText) mediaItem.processedContent = processM3U8(mediaItem.responseText, mediaItem.url);
        }
        PlayerManager.injectPlayer(mediaItem);
    }

    const Interceptor = {
        activate() { /* 在这个最终版本中，我们依赖 background.js 的 WebRequest，core.js 无需主动嗅探 */ }
    };

    async function initialize() {
        // injector.js 与 background.js 之间的通信，用于读写设置
        document.addEventListener('__M3U8_PURIFIER_REQUEST__', (event) => {
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage(event.detail, (response) => {
                    document.dispatchEvent(new CustomEvent('__M3U8_PURIFIER_RESPONSE__', {
                        detail: { type: 'SETTINGS_DATA', payload: response }
                    }));
                });
            }
        });
        
        localSettings = await new Promise(resolve => {
            document.dispatchEvent(new CustomEvent('__M3U8_PURIFIER_REQUEST__', { detail: { type: 'GET_SETTINGS' } }));
            const listener = (event) => {
                if(event.detail.type === 'SETTINGS_DATA') {
                    document.removeEventListener('__M3U8_PURIFIER_RESPONSE__', listener);
                    resolve(event.detail.payload || {});
                }
            };
            document.addEventListener('__M3U8_PURIFIER_RESPONSE__', listener);
        });

        injectStyles();
        Interceptor.activate();
        
        document.addEventListener('__M3U8_PURIFIER_CMD__', (event) => {
            if (event.detail?.type === 'TOGGLE_SETTINGS_PANEL' && window.self === window.top) {
                SettingsPanel.toggle();
            }
        });

        // 监听来自 background.js WebRequest 的嗅探结果
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'BACKGROUND_MEDIA_FOUND') {
                handleMedia(message.payload);
            }
        });
    }
    
    initialize();
})();
