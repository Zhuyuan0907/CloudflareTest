// Cloudflare 測試端點
const testEndpoints = [
    { name: 'Cloudflare 主站', url: 'cloudflare.com', plan: 'enterprise' },
    { name: '1.1.1.1 DNS', url: 'one.one.one.one', plan: 'free' },
    { name: 'Workers', url: 'workers.cloudflare.com', plan: 'pro' },
    { name: 'Pages', url: 'pages.cloudflare.com', plan: 'pro' },
    { name: 'Speed Test', url: 'speed.cloudflare.com', plan: 'free' },
    { name: 'Analytics', url: 'analytics.cloudflare.com', plan: 'business' },
    { name: 'Stream', url: 'stream.cloudflare.com', plan: 'enterprise' },
    { name: 'Teams', url: 'teams.cloudflare.com', plan: 'business' },
    { name: 'Images', url: 'images.cloudflare.com', plan: 'pro' },
    { name: 'Zero Trust', url: 'zerotrust.cloudflare.com', plan: 'enterprise' }
];

// 全局變量
let isContinuousTesting = false;
let testInterval = null;

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
        document.getElementById('userIP').textContent = data.ip || '-';
        document.getElementById('userColo').textContent = data.colo || '-';
        document.getElementById('warpStatus').textContent = 
            data.warp === 'on' ? '啟用' : '關閉';
        
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
                colo: data.colo || '-',
                status: 'success'
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        return { 
            latency: null, 
            colo: '-', 
            status: 'error'
        };
    }
}

// 創建測試行
function createTestRow(endpoint, index) {
    const row = document.createElement('div');
    row.className = 'test-row';
    row.dataset.endpoint = endpoint.url;
    
    row.innerHTML = `
        <div class="col-service">${endpoint.name}</div>
        <div class="col-url">${endpoint.url}</div>
        <div class="col-plan plan-${endpoint.plan}">${endpoint.plan}</div>
        <div class="col-latency">
            <div class="latency-bar testing"></div>
            <div class="latency-text latency-testing">測試中</div>
        </div>
        <div class="col-node">-</div>
        <div class="col-status status-testing">檢測中</div>
    `;
    
    // 添加點擊事件
    row.addEventListener('click', () => {
        window.open(`https://${endpoint.url}/cdn-cgi/trace`, '_blank');
    });
    
    return row;
}

// 更新測試行
function updateTestRow(row, result) {
    const latencyBar = row.querySelector('.latency-bar');
    const latencyText = row.querySelector('.latency-text');
    const nodeElement = row.querySelector('.col-node');
    const statusElement = row.querySelector('.col-status');
    
    // 停止測試動畫
    latencyBar.classList.remove('testing');
    
    if (result.status === 'success') {
        const latency = result.latency;
        let latencyClass = 'latency-good';
        let barWidth = Math.min(latency / 5, 100); // 最大100%，500ms為滿格
        
        if (latency > 300) {
            latencyClass = 'latency-bad';
        } else if (latency > 100) {
            latencyClass = 'latency-medium';
        }
        
        // 更新進度條
        setTimeout(() => {
            latencyBar.style.width = `${barWidth}%`;
        }, 100);
        
        latencyText.textContent = `${latency}ms`;
        latencyText.className = `latency-text ${latencyClass}`;
        
        nodeElement.textContent = result.colo;
        statusElement.textContent = '正常';
        statusElement.className = 'col-status status-success';
        
    } else {
        latencyText.textContent = '失敗';
        latencyText.className = 'latency-text latency-bad';
        
        nodeElement.textContent = '-';
        statusElement.textContent = '錯誤';
        statusElement.className = 'col-status status-error';
        
        latencyBar.style.width = '0%';
    }
}

// 初始化測試表格
function initTestTable() {
    const testTable = document.getElementById('testTable');
    testTable.innerHTML = '';
    
    testEndpoints.forEach((endpoint, index) => {
        const row = createTestRow(endpoint, index);
        testTable.appendChild(row);
    });
}

// 執行單次測試
async function runSingleTest() {
    const rows = document.querySelectorAll('.test-row');
    
    // 重置所有行的測試狀態
    rows.forEach(row => {
        const latencyBar = row.querySelector('.latency-bar');
        const latencyText = row.querySelector('.latency-text');
        const statusElement = row.querySelector('.col-status');
        
        latencyBar.className = 'latency-bar testing';
        latencyBar.style.width = '0%';
        latencyText.textContent = '測試中';
        latencyText.className = 'latency-text latency-testing';
        statusElement.textContent = '檢測中';
        statusElement.className = 'col-status status-testing';
    });
    
    // 並行測試所有端點
    const testPromises = Array.from(rows).map(async (row, index) => {
        const endpoint = testEndpoints[index];
        const result = await testEndpoint(endpoint);
        updateTestRow(row, result);
        return result;
    });
    
    await Promise.all(testPromises);
}

// 切換連續測試
function toggleContinuousTesting() {
    const toggleBtn = document.getElementById('toggleContinuous');
    
    if (isContinuousTesting) {
        clearInterval(testInterval);
        isContinuousTesting = false;
        toggleBtn.textContent = '連續測試';
        toggleBtn.classList.remove('active');
    } else {
        isContinuousTesting = true;
        toggleBtn.textContent = '停止測試';
        toggleBtn.classList.add('active');
        
        runSingleTest();
        testInterval = setInterval(runSingleTest, 3000);
    }
}

// 刷新測試
async function refreshTests() {
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
    initTestTable();
    
    document.getElementById('toggleContinuous').addEventListener('click', toggleContinuousTesting);
    document.getElementById('refreshAll').addEventListener('click', refreshTests);
    
    getUserInfo();
    runSingleTest();
});