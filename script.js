// 節點列表
const cfNodes = [
    { code: 'LAX', name: '洛杉磯', location: '美國', flag: '🇺🇸' },
    { code: 'SJC', name: '聖荷西', location: '美國', flag: '🇺🇸' },
    { code: 'SEA', name: '西雅圖', location: '美國', flag: '🇺🇸' },
    { code: 'HKG', name: '香港', location: '中國', flag: '🇭🇰' },
    { code: 'TPE', name: '台北', location: '台灣', flag: '🇹🇼' },
    { code: 'NRT', name: '東京', location: '日本', flag: '🇯🇵' },
    { code: 'ICN', name: '首爾', location: '韓國', flag: '🇰🇷' },
    { code: 'SIN', name: '新加坡', location: '新加坡', flag: '🇸🇬' },
    { code: 'SYD', name: '雪梨', location: '澳洲', flag: '🇦🇺' },
    { code: 'LHR', name: '倫敦', location: '英國', flag: '🇬🇧' },
    { code: 'FRA', name: '法蘭克福', location: '德國', flag: '🇩🇪' },
    { code: 'CDG', name: '巴黎', location: '法國', flag: '🇫🇷' }
];

// 初始化主題
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// 切換主題
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// 獲取用戶信息
async function getUserInfo() {
    try {
        const response = await fetch('https://1.1.1.1/cdn-cgi/trace');
        const text = await response.text();
        const lines = text.split('\n');
        const data = {};
        
        lines.forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                data[key] = value;
            }
        });
        
        return {
            ip: data.ip || '未知',
            loc: data.loc || '未知',
            colo: data.colo || '未知'
        };
    } catch (error) {
        console.error('獲取用戶信息失敗:', error);
        return {
            ip: '獲取失敗',
            loc: '獲取失敗',
            colo: '獲取失敗'
        };
    }
}

// 測試單個節點延遲
async function testNodeLatency(nodeCode) {
    const testUrl = `https://${nodeCode.toLowerCase()}.cloudflare.com/cdn-cgi/trace`;
    const attempts = 3;
    let totalTime = 0;
    let successCount = 0;
    
    for (let i = 0; i < attempts; i++) {
        try {
            const startTime = performance.now();
            const response = await fetch(testUrl, {
                mode: 'no-cors',
                cache: 'no-cache'
            });
            const endTime = performance.now();
            totalTime += endTime - startTime;
            successCount++;
        } catch (error) {
            console.error(`測試 ${nodeCode} 失敗:`, error);
        }
    }
    
    if (successCount === 0) {
        return null;
    }
    
    return Math.round(totalTime / successCount);
}

// 測試所有節點
async function testAllNodes() {
    const nodeTestsDiv = document.getElementById('nodeTests');
    nodeTestsDiv.innerHTML = '<p class="empty-state">正在測試節點...</p>';
    
    const results = [];
    
    for (const node of cfNodes) {
        const latency = await testNodeLatency(node.code);
        if (latency !== null) {
            results.push({ ...node, latency });
        }
    }
    
    // 按延遲排序
    results.sort((a, b) => a.latency - b.latency);
    
    // 顯示結果
    nodeTestsDiv.innerHTML = '';
    results.forEach((result, index) => {
        const latencyClass = result.latency < 100 ? 'latency-good' : 
                           result.latency < 200 ? 'latency-medium' : 'latency-bad';
        
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'node-test-item';
        nodeDiv.style.animationDelay = `${index * 0.05}s`;
        nodeDiv.innerHTML = `
            <div class="node-info">
                <span class="node-flag">${result.flag}</span>
                <div class="node-details">
                    <span class="node-name">${result.code} - ${result.name}</span>
                    <span class="node-location">${result.location}</span>
                </div>
            </div>
            <span class="node-latency ${latencyClass}">${result.latency} ms</span>
        `;
        nodeTestsDiv.appendChild(nodeDiv);
    });
}

// 找到最近的節點名稱
function findNodeName(code) {
    const node = cfNodes.find(n => n.code === code);
    return node ? `${node.name} (${node.code})` : code;
}

// 開始測試
async function startTest() {
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const refreshBtn = document.querySelector('.refresh-btn');
    
    // 顯示加載狀態
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    try {
        // 獲取用戶信息
        const userInfo = await getUserInfo();
        
        // 顯示基本信息
        document.getElementById('userIP').textContent = userInfo.ip;
        document.getElementById('cfNode').textContent = userInfo.colo;
        document.getElementById('nodeLocation').textContent = findNodeName(userInfo.colo);
        
        // 測試當前節點延遲
        const currentNodeLatency = await testNodeLatency(userInfo.colo);
        document.getElementById('latency').textContent = 
            currentNodeLatency ? `${currentNodeLatency} ms` : '測試失敗';
        
        // 顯示結果
        loadingDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
        
        // 測試所有節點
        await testAllNodes();
        
    } catch (error) {
        console.error('測試失敗:', error);
        loadingDiv.innerHTML = '<p>測試失敗，請稍後重試</p>';
    } finally {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// 頁面加載完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // 綁定主題切換按鈕
    const themeToggle = document.querySelector('.theme-toggle');
    themeToggle.addEventListener('click', toggleTheme);
    
    // 自動開始測試
    startTest();
});