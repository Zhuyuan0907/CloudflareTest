// 節點列表
const cfNodes = [
    { 
        code: 'cloudflare.com', 
        name: 'Cloudflare 主站', 
        location: 'Global',
        flag: '🌍',
        description: '全球 CDN 負載均衡'
    },
    { 
        code: 'one.one.one.one', 
        name: '1.1.1.1 DNS', 
        location: 'Global',
        flag: '🌐',
        description: 'Cloudflare DNS 服務'
    },
    { 
        code: 'speed.cloudflare.com', 
        name: 'Speed Test', 
        location: 'Global',
        flag: '⚡',
        description: 'Cloudflare 速度測試'
    },
    { 
        code: 'www.cloudflare.com', 
        name: 'Cloudflare WWW', 
        location: 'Global',
        flag: '💻',
        description: 'Cloudflare 官方網站'
    },
    { 
        code: 'dash.cloudflare.com', 
        name: 'Dashboard', 
        location: 'Global',
        flag: '📊',
        description: 'Cloudflare 控制台'
    },
    { 
        code: 'api.cloudflare.com', 
        name: 'API 端點', 
        location: 'Global',
        flag: '🔌',
        description: 'Cloudflare API 服務'
    }
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

// 檢測 WARP 狀態
async function checkWarpStatus() {
    try {
        const response = await fetch('https://1.1.1.1/cdn-cgi/trace');
        const text = await response.text();
        
        // 提取 WARP 狀態
        const warpMatch = text.match(/warp=([\w]+)/);
        const warpStatus = warpMatch ? warpMatch[1] : 'off';
        
        const warpStatusElement = document.querySelector('.warp-status-text');
        const warpIcon = document.querySelector('.warp-icon');
        
        if (warpStatus === 'on') {
            warpStatusElement.textContent = 'WARP 已啟用';
            warpStatusElement.className = 'warp-status-text warp-enabled';
            warpIcon.textContent = '🛡️';
        } else {
            warpStatusElement.textContent = 'WARP 未啟用';
            warpStatusElement.className = 'warp-status-text warp-disabled';
            warpIcon.textContent = '🔓';
        }
        
        return warpStatus;
    } catch (error) {
        console.error('檢測 WARP 狀態失敗:', error);
        const warpStatusElement = document.querySelector('.warp-status-text');
        warpStatusElement.textContent = '檢測失敗';
        warpStatusElement.className = 'warp-status-text';
        return 'unknown';
    }
}

// 測試單個節點延遲
async function testNodeLatency(hostname) {
    const testUrl = `https://${hostname}/cdn-cgi/trace`;
    
    try {
        const startTime = performance.now();
        const response = await fetch(testUrl, {
            cache: 'no-cache',
            mode: 'cors'
        });
        const endTime = performance.now();
        
        if (response.ok) {
            const latency = Math.round(endTime - startTime);
            const text = await response.text();
            
            // 提取節點信息
            const coloMatch = text.match(/colo=([\w]+)/);
            const colo = coloMatch ? coloMatch[1] : '未知';
            
            return { latency, colo, status: 'success', response: text };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`測試 ${hostname} 失敗:`, error);
        return { latency: null, colo: '未知', status: 'error', error: error.message };
    }
}

// 創建節點卡片
function createNodeCard(node, index) {
    const card = document.createElement('div');
    card.className = 'node-card';
    card.style.animationDelay = `${index * 0.1}s`;
    
    card.innerHTML = `
        <div class="node-card-header">
            <div class="node-flag">${node.flag}</div>
            <div class="node-details">
                <div class="node-name">${node.name}</div>
                <div class="node-location">${node.description}</div>
            </div>
        </div>
        <div class="node-stats">
            <div class="node-latency status-testing">測試中...</div>
            <div class="node-status status-testing">等待中</div>
        </div>
    `;
    
    // 添加點擊事件
    card.addEventListener('click', () => {
        window.open(`https://${node.code}/cdn-cgi/trace`, '_blank');
    });
    
    return card;
}

// 更新節點卡片狀態
function updateNodeCard(card, result) {
    const latencyElement = card.querySelector('.node-latency');
    const statusElement = card.querySelector('.node-status');
    
    if (result.status === 'success') {
        const latency = result.latency;
        let latencyClass = 'latency-good';
        
        if (latency > 300) {
            latencyClass = 'latency-bad';
        } else if (latency > 100) {
            latencyClass = 'latency-medium';
        }
        
        latencyElement.textContent = `${latency} ms`;
        latencyElement.className = `node-latency ${latencyClass}`;
        
        statusElement.textContent = `節點: ${result.colo}`;
        statusElement.className = 'node-status status-success';
    } else {
        latencyElement.textContent = '超時';
        latencyElement.className = 'node-latency latency-bad';
        
        statusElement.textContent = '連接失敗';
        statusElement.className = 'node-status status-error';
    }
}

// 測試所有節點
async function testAllNodes() {
    const cardsGrid = document.getElementById('cardsGrid');
    
    // 清除加載卡片
    cardsGrid.innerHTML = '';
    
    // 創建節點卡片
    const cards = cfNodes.map((node, index) => {
        const card = createNodeCard(node, index);
        cardsGrid.appendChild(card);
        return { card, node };
    });
    
    // 並行測試所有節點
    const testPromises = cards.map(async ({ card, node }) => {
        const result = await testNodeLatency(node.code);
        updateNodeCard(card, result);
        return { node, result };
    });
    
    // 等待所有測試完成
    const results = await Promise.all(testPromises);
    
    // 按延遲排序卡片
    const sortedResults = results
        .filter(r => r.result.status === 'success')
        .sort((a, b) => a.result.latency - b.result.latency);
    
    // 重新排列卡片
    sortedResults.forEach(({ node }, index) => {
        const card = cards.find(c => c.node.code === node.code)?.card;
        if (card) {
            cardsGrid.appendChild(card);
            card.style.animationDelay = `${index * 0.05}s`;
        }
    });
}

// 開始測試
async function startTest() {
    const refreshBtn = document.querySelector('.refresh-btn');
    
    // 顯示加載狀態
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    try {
        // 檢測 WARP 狀態
        await checkWarpStatus();
        
        // 測試所有節點
        await testAllNodes();
        
    } catch (error) {
        console.error('測試失敗:', error);
        const cardsGrid = document.getElementById('cardsGrid');
        cardsGrid.innerHTML = '<div class="loading-card"><p>測試失敗，請稍後重試</p></div>';
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