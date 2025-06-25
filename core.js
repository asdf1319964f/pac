// core.js (最小化测试版 v5.0.0)
// 目标：验证注入和执行流程是否畅通

(function() {
    'use strict';
    
    // 这是一个独一无二的标志位，确保只执行一次
    if (window.M3U8_PURIFIER_TEST_V5) {
        return;
    }
    window.M3U8_PURIFIER_TEST_V5 = true;

    // --- 这是一个一定会执行的日志 ---
    console.log(
        '%c[Core Test v5] ✅ Injection & Execution SUCCESS!', 
        'color: #00ff00; font-size: 18px; font-weight: bold; border: 1px solid lime; padding: 5px;'
    );
    
    // --- 添加一个简单的嗅探器，看它是否能工作 ---
    try {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const request = new Request(args[0], args[1]);
            
            // 每次 fetch 都打印日志
            console.log('[Core Test] Fetching:', request.url);
            
            if (request.url.includes('.m3u8')) {
                console.log(
                    '%c[Core Test] ✅ M3U8 FETCH DETECTED!',
                    'color: orange; font-size: 16px; font-weight: bold;'
                );
                alert('成功捕获到 M3U8 请求！URL: ' + request.url);
            }
            return originalFetch(...args);
        };
        console.log('[Core Test] Fetch hook is active.');

    } catch(e) {
        console.error('[Core Test] Failed to activate hooks:', e);
    }

})();
