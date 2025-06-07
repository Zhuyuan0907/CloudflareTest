// Cloudflare 測試端點 - 按方案分組
const testEndpointsByPlan = {
    free: [
        { name: '1.1.1.1 DNS', url: 'one.one.one.one' },
        { name: '1.1.1.1 for Families', url: 'family.cloudflare.com' },
        { name: 'Speed Test', url: 'speed.cloudflare.com' },
        { name: 'Trace', url: 'cloudflare.com/cdn-cgi/trace' }
    ],
    pro: [
        { name: 'Workers', url: 'workers.cloudflare.com' },
        { name: 'Pages', url: 'pages.cloudflare.com' },
        { name: 'Images', url: 'cloudflareimages.com' },
        { name: 'Developers', url: 'developers.cloudflare.com' }
    ],
    business: [
        { name: 'Dashboard', url: 'dash.cloudflare.com' },
        { name: 'Analytics', url: 'web-analytics.cloudflare.com' },
        { name: 'Teams', url: 'dash.teams.cloudflare.com' },
        { name: 'Gateway', url: 'gateway.cloudflare.com' }
    ],
    enterprise: [
        { name: 'Cloudflare 主站', url: 'cloudflare.com' },
        { name: 'Stream', url: 'stream.cloudflare.com' },
        { name: 'R2', url: 'r2.dev' },
        { name: 'Zero Trust', url: 'cloudflare.com/zero-trust' }
    ]
};

// 全局變量
let initialTestCount = 0;
let initialTestInterval = null;

// 檢測IP版本
function getIPVersion(ip) {
    if (ip.includes(':')) return 'IPv6';
    if (ip.includes('.')) return 'IPv4';
    return 'Unknown';
}

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
        
        // 檢測IP版本並更新UI
        const ipVersion = getIPVersion(data.ip || '');
        if (ipVersion === 'IPv4') {
            document.getElementById('userIPv4').textContent = data.ip || '-';
            document.getElementById('userIPv6').textContent = '未檢測到';
        } else if (ipVersion === 'IPv6') {
            document.getElementById('userIPv4').textContent = '未檢測到';
            document.getElementById('userIPv6').textContent = data.ip || '-';
        }
        
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
    // 處理特殊的trace URL
    const testUrl = endpoint.url.includes('/cdn-cgi/trace') 
        ? `https://${endpoint.url}`
        : `https://${endpoint.url}/cdn-cgi/trace`;
    
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
function createTestRow(endpoint) {
    const row = document.createElement('div');
    row.className = 'test-row';
    row.dataset.endpoint = endpoint.url;
    
    row.innerHTML = `
        <div class="col-service">${endpoint.name}</div>
        <div class="col-url">${endpoint.url}</div>
        <div class="col-latency">
            <div class="latency-bar testing"></div>
            <div class="latency-text latency-testing">測試中</div>
        </div>
        <div class="col-node">-</div>
        <div class="col-status status-testing">檢測中</div>
    `;
    
    // 添加點擊事件
    row.addEventListener('click', () => {
        const traceUrl = endpoint.url.includes('/cdn-cgi/trace') 
            ? `https://${endpoint.url}`
            : `https://${endpoint.url}/cdn-cgi/trace`;
        window.open(traceUrl, '_blank');
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
    
    // 按方案創建分組
    const planNames = {
        free: 'Free Plan',
        pro: 'Pro Plan',
        business: 'Business Plan',
        enterprise: 'Enterprise Plan'
    };
    
    Object.entries(testEndpointsByPlan).forEach(([plan, endpoints]) => {
        // 創建方案分組
        const planGroup = document.createElement('div');
        planGroup.className = 'plan-group';
        
        // 創建方案標題
        const planHeader = document.createElement('div');
        planHeader.className = `plan-header ${plan}`;
        planHeader.textContent = planNames[plan];
        
        // 創建行容器
        const planRows = document.createElement('div');
        planRows.className = 'plan-rows';
        
        // 為每個端點創建行
        endpoints.forEach(endpoint => {
            const row = createTestRow(endpoint);
            row.dataset.plan = plan;
            planRows.appendChild(row);
        });
        
        planGroup.appendChild(planHeader);
        planGroup.appendChild(planRows);
        testTable.appendChild(planGroup);
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
    const testPromises = Array.from(rows).map(async (row) => {
        const plan = row.dataset.plan;
        const endpointUrl = row.dataset.endpoint;
        
        // 找到對應的端點
        let endpoint = null;
        Object.values(testEndpointsByPlan).forEach(endpoints => {
            const found = endpoints.find(e => e.url === endpointUrl);
            if (found) endpoint = found;
        });
        
        if (endpoint) {
            const result = await testEndpoint(endpoint);
            updateTestRow(row, result);
            return result;
        }
    });
    
    await Promise.all(testPromises);
}

// 刷新測試
async function refreshTests() {
    const refreshBtn = document.getElementById('refreshAll');
    refreshBtn.disabled = true;
    
    try {
        await getUserInfo();
        await runSingleTest();
    } finally {
        refreshBtn.disabled = false;
    }
}

// 開始初始連續測試
function startInitialTests() {
    initialTestCount = 0;
    
    // 立即執行第一次測試
    runSingleTest();
    initialTestCount++;
    
    // 每秒執行一次，共執行4次（總共5次）
    initialTestInterval = setInterval(() => {
        runSingleTest();
        initialTestCount++;
        
        if (initialTestCount >= 4) {
            clearInterval(initialTestInterval);
            initialTestInterval = null;
        }
    }, 1000);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTestTable();
    
    document.getElementById('refreshAll').addEventListener('click', refreshTests);
    
    getUserInfo();
    startInitialTests();
});