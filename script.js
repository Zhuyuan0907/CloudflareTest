// Cloudflare 測試端點
const testEndpoints = [
    {
        name: 'Cloudflare 主站',
        url: 'cloudflare.com',
        plan: 'enterprise',
        description: '全球 CDN 負載均衡'
    },
    {
        name: '1.1.1.1 DNS',
        url: 'one.one.one.one',
        plan: 'free',
        description: 'DNS 解析服務'
    },
    {
        name: 'Workers',
        url: 'workers.cloudflare.com',
        plan: 'pro',
        description: 'Serverless 計算平台'
    },
    {
        name: 'Pages',
        url: 'pages.cloudflare.com',
        plan: 'pro',
        description: '靜態網站託管'
    },
    {
        name: 'Speed Test',
        url: 'speed.cloudflare.com',
        plan: 'free',
        description: '網路速度測試'
    },
    {
        name: 'Analytics',
        url: 'analytics.cloudflare.com',
        plan: 'business',
        description: '網站分析服務'
    },
    {
        name: 'Stream',
        url: 'stream.cloudflare.com',
        plan: 'enterprise',
        description: '視頻流媒體服務'
    },
    {
        name: 'Teams',
        url: 'teams.cloudflare.com',
        plan: 'business',
        description: '企業安全服務'
    },
    {
        name: 'R2 Storage',
        url: 'r2.cloudflarestorage.com',
        plan: 'enterprise',
        description: '對象存儲服務'
    },
    {
        name: 'Images',
        url: 'images.cloudflare.com',
        plan: 'pro',
        description: '圖像優化服務'
    },
    {
        name: 'Waiting Room',
        url: 'waitingroom.cloudflare.com',
        plan: 'business',
        description: '流量控制服務'
    },
    {
        name: 'Zero Trust',
        url: 'zerotrust.cloudflare.com',
        plan: 'enterprise',
        description: '零信任安全架構'
    }
];

// 全局變量
let isContinuousTesting = false;
let testInterval = null;
let testData = {};

// 獲取用戶信息
async function getUserInfo() {
    try {
        const response = await fetch('https://1.1.1.1/cdn-cgi/trace');
        const text = await response.text();
        
        const data = {};
        text.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                data[key] = value;
            }
        });
        
        // 更新 UI
        document.getElementById('userIP').textContent = data.ip || '未知';
        document.getElementById('userISP').textContent = data.isp || '未知';
        document.getElementById('userLocation').textContent = 
            `${data.loc || '未知'} (${data.colo || '未知'})`;
        document.getElementById('userColo').textContent = data.colo || '未知';
        document.getElementById('warpStatus').textContent = 
            data.warp === 'on' ? '已啟用' : '未啟用';
        document.getElementById('httpVersion').textContent = data.h || '未知';
        
        return data;
    } catch (error) {
        console.error('獲取用戶信息失敗:', error);
        return null;
    }
}

// 測試單個端點
async function testEndpoint(endpoint) {
    const testUrl = `https://${endpoint.url}/cdn-cgi/trace`;
    
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
            const data = {};
            text.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    data[key] = value;
                }
            });
            
            return { 
                latency, 
                colo: data.colo || '未知',
                ip: data.ip || '未知',
                h: data.h || '未知',
                status: 'success'
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        return { 
            latency: null, 
            colo: '未知', 
            status: 'error', 
            error: error.message 
        };
    }
}

// 創建測試項目卡片
function createTestItem(endpoint, index) {
    const testItem = document.createElement('div');
    testItem.className = 'test-item';
    testItem.dataset.endpoint = endpoint.url;
    
    testItem.innerHTML = `
        <div class="test-header">
            <span class="test-name">${endpoint.name}</span>
            <span class="test-plan ${endpoint.plan}">${endpoint.plan.toUpperCase()}</span>
        </div>
        <div class="test-url">https://${endpoint.url}</div>
        <div class="test-stats">
            <div class="stat-item">
                <span class="stat-label">節點</span>
                <span class="stat-value" data-field="colo">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">HTTP</span>
                <span class="stat-value" data-field="http">-</span>
            </div>
        </div>
        <div class="latency-display latency-testing">測試中...</div>
        <div class="node-info">${endpoint.description}</div>
    `;
    
    // 添加點擊事件
    testItem.addEventListener('click', () => {
        window.open(`https://${endpoint.url}/cdn-cgi/trace`, '_blank');
    });
    
    return testItem;
}

// 更新測試項目
function updateTestItem(testItem, result) {
    const latencyDisplay = testItem.querySelector('.latency-display');
    const coloElement = testItem.querySelector('[data-field="colo"]');
    const httpElement = testItem.querySelector('[data-field="http"]');
    
    if (result.status === 'success') {
        const latency = result.latency;
        let latencyClass = 'latency-good';
        
        if (latency > 300) {
            latencyClass = 'latency-bad';
        } else if (latency > 100) {
            latencyClass = 'latency-medium';
        }
        
        latencyDisplay.textContent = `${latency} ms`;
        latencyDisplay.className = `latency-display ${latencyClass}`;
        
        coloElement.textContent = result.colo;
        httpElement.textContent = result.h;
        
        // 保存數據
        if (!testData[testItem.dataset.endpoint]) {
            testData[testItem.dataset.endpoint] = [];
        }
        testData[testItem.dataset.endpoint].push({
            timestamp: Date.now(),
            latency: latency,
            colo: result.colo
        });
        
        // 只保留最近 10 次記錄
        if (testData[testItem.dataset.endpoint].length > 10) {
            testData[testItem.dataset.endpoint] = testData[testItem.dataset.endpoint].slice(-10);
        }
        
    } else {
        latencyDisplay.textContent = '失敗';
        latencyDisplay.className = 'latency-display latency-bad';
        coloElement.textContent = '未知';
        httpElement.textContent = '未知';
    }
}

// 初始化測試網格
function initTestGrid() {
    const testGrid = document.getElementById('testGrid');
    testGrid.innerHTML = '';
    
    testEndpoints.forEach((endpoint, index) => {
        const testItem = createTestItem(endpoint, index);
        testGrid.appendChild(testItem);
    });
}

// 執行單次測試
async function runSingleTest() {
    const testItems = document.querySelectorAll('.test-item');
    
    // 重置所有測試項目狀態
    testItems.forEach(item => {
        const latencyDisplay = item.querySelector('.latency-display');
        latencyDisplay.textContent = '測試中...';
        latencyDisplay.className = 'latency-display latency-testing';
    });
    
    // 並行測試所有端點
    const testPromises = Array.from(testItems).map(async (item, index) => {
        const endpoint = testEndpoints[index];
        const result = await testEndpoint(endpoint);
        updateTestItem(item, result);
        return result;
    });
    
    await Promise.all(testPromises);
}

// 切換連續測試
function toggleContinuousTesting() {
    const toggleBtn = document.getElementById('toggleContinuous');
    
    if (isContinuousTesting) {
        // 停止連續測試
        clearInterval(testInterval);
        isContinuousTesting = false;
        toggleBtn.textContent = '開始連續測試';
        toggleBtn.classList.remove('active');
    } else {
        // 開始連續測試
        isContinuousTesting = true;
        toggleBtn.textContent = '停止連續測試';
        toggleBtn.classList.add('active');
        
        // 立即執行一次測試
        runSingleTest();
        
        // 每 5 秒執行一次測試
        testInterval = setInterval(runSingleTest, 5000);
    }
}

// 刷新所有測試
async function refreshAllTests() {
    const refreshBtn = document.getElementById('refreshAll');
    refreshBtn.disabled = true;
    refreshBtn.textContent = '測試中...';
    
    try {
        await getUserInfo();
        await runSingleTest();
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '重新測試';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化測試網格
    initTestGrid();
    
    // 綁定事件
    document.getElementById('toggleContinuous').addEventListener('click', toggleContinuousTesting);
    document.getElementById('refreshAll').addEventListener('click', refreshAllTests);
    
    // 執行初始測試
    getUserInfo();
    runSingleTest();
});