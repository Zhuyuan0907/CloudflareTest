// Cloudflare 測試端點 - 按方案分組
const testEndpointsByPlan = {
    free: [
        { name: 'Thisisch', url: 'thisisch.net/cdn-cgi/trace' }
    ],
    pro: [
        { name: 'CDNJS', url: 'cdnjs.com/cdn-cgi/trace' },
        { name: 'JSDelivr', url: 'jsdelivr.com/cdn-cgi/trace' },
        { name: 'Node.js', url: 'nodejs.org/cdn-cgi/trace' }
    ],
    business: [
        { name: 'NAF Store', url: 'nafstore.net/cdn-cgi/trace' },
        { name: 'Trevor Project', url: 'thetrevorproject.org/cdn-cgi/trace' },
        { name: 'Vote America', url: 'voteamerica.com/cdn-cgi/trace' },
        { name: 'Waver Host', url: 'waverhost.com/cdn-cgi/trace' }
    ],
    enterprise: [
        { name: 'Discord', url: 'discordapp.com/cdn-cgi/trace' },
        { name: 'Polestar', url: 'polestar.com/cdn-cgi/trace' },
        { name: 'Cloudflare', url: 'www.cloudflare.com/cdn-cgi/trace' },
        { name: 'NCR', url: 'www.ncr.com/cdn-cgi/trace' }
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

// 獲取ASN和ISP信息
async function getASNInfo(ip) {
    try {
        // 使用免費的IP查詢API
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (response.ok) {
            const data = await response.json();
            return {
                asn: `${data.asn || 'Unknown'}`,
                org: data.org || data.isp || 'Unknown',
                country: data.country_code || 'Unknown'
            };
        }
    } catch (error) {
        console.log('ASN查詢失敗:', error);
    }
    return { asn: 'Unknown', org: 'Unknown', country: 'Unknown' };
}

// IPv6連通性測試
async function testIPv6Connectivity() {
    const tests = {
        available: false,
        connection: false,
        dns: false
    };
    
    try {
        // 測試IPv6連接到Cloudflare
        const ipv6Response = await fetch('https://[2606:4700:4700::1111]/cdn-cgi/trace', {
            cache: 'no-cache'
        });
        if (ipv6Response.ok) {
            tests.available = true;
            tests.connection = true;
        }
    } catch (error) {
        console.log('IPv6連接測試失敗:', error);
    }
    
    try {
        // 測試IPv6 DNS解析
        const dnsResponse = await fetch('https://cloudflare-dns.com/dns-query?name=ipv6.google.com&type=AAAA', {
            headers: { 'Accept': 'application/dns-json' }
        });
        if (dnsResponse.ok) {
            const dnsData = await dnsResponse.json();
            if (dnsData.Answer && dnsData.Answer.length > 0) {
                tests.dns = true;
            }
        }
    } catch (error) {
        console.log('IPv6 DNS測試失敗:', error);
    }
    
    // 計算分數
    let score = 0;
    if (tests.available) score += 40;
    if (tests.connection) score += 40;
    if (tests.dns) score += 20;
    
    return { tests, score };
}

// 更新IPv6測試結果
function updateIPv6TestResults(testResults) {
    const { tests, score } = testResults;
    
    // 更新分數
    document.getElementById('ipv6Score').textContent = score;
    
    // 更新各項測試結果
    const availableElement = document.getElementById('ipv6Available');
    availableElement.textContent = tests.available ? '支援' : '不支援';
    availableElement.className = `test-result ${tests.available ? 'test-pass' : 'test-fail'}`;
    
    const connectionElement = document.getElementById('ipv6Connection');
    connectionElement.textContent = tests.connection ? '正常' : '失敗';
    connectionElement.className = `test-result ${tests.connection ? 'test-pass' : 'test-fail'}`;
    
    const dnsElement = document.getElementById('ipv6DNS');
    dnsElement.textContent = tests.dns ? '正常' : '失敗';
    dnsElement.className = `test-result ${tests.dns ? 'test-pass' : 'test-fail'}`;
    
    // 更新分數圓圈顏色
    const scoreCircle = document.querySelector('.score-circle');
    if (score >= 80) {
        scoreCircle.style.background = 'linear-gradient(135deg, #059669, #10b981)';
    } else if (score >= 60) {
        scoreCircle.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
    } else {
        scoreCircle.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
    }
}

// 獲取用戶信息
async function getUserInfo() {
    try {
        // 同時測試IPv4和IPv6
        const [ipv4Data, ipv6Data] = await Promise.allSettled([
            fetch('https://1.1.1.1/cdn-cgi/trace').then(r => r.text()),
            fetch('https://[2606:4700:4700::1111]/cdn-cgi/trace').then(r => r.text()).catch(() => null)
        ]);
        
        let mainData = {};
        let ipv4 = '-', ipv6 = '-';
        
        // 處理IPv4數據
        if (ipv4Data.status === 'fulfilled') {
            ipv4Data.value.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    mainData[key] = value;
                    if (key === 'ip') ipv4 = value;
                }
            });
        }
        
        // 處理IPv6數據
        if (ipv6Data.status === 'fulfilled' && ipv6Data.value) {
            ipv6Data.value.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key === 'ip' && value) {
                    ipv6 = value;
                }
            });
        }
        
        // 更新基本IP信息
        document.getElementById('userIPv4').textContent = ipv4;
        document.getElementById('userIPv6').textContent = ipv6;
        document.getElementById('userColo').textContent = mainData.colo || '-';
        document.getElementById('warpStatus').textContent = 
            mainData.warp === 'on' ? '啟用' : '關閉';
        
        // 異步獲取ASN信息
        if (ipv4 !== '-') {
            getASNInfo(ipv4).then(asnInfo => {
                const ipv4ASN = document.getElementById('ipv4ASN');
                ipv4ASN.textContent = `${asnInfo.asn} - ${asnInfo.org}`;
            });
        }
        
        if (ipv6 !== '-') {
            getASNInfo(ipv6).then(asnInfo => {
                const ipv6ASN = document.getElementById('ipv6ASN');
                ipv6ASN.textContent = `${asnInfo.asn} - ${asnInfo.org}`;
            });
        }
        
        // 執行IPv6連通性測試
        testIPv6Connectivity().then(updateIPv6TestResults);
        
        return mainData;
    } catch (error) {
        console.error('獲取用戶信息失敗:', error);
        return null;
    }
}

// 測試單個端點
async function testEndpoint(endpoint) {
    const testUrl = `https://${endpoint.url}`;
    
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
        <div class="col-latency latency-testing">測試中</div>
        <div class="col-node">-</div>
    `;
    
    // 添加點擊事件
    row.addEventListener('click', () => {
        window.open(`https://${endpoint.url}`, '_blank');
    });
    
    return row;
}

// 數值動畫函數
function animateNumber(element, startValue, endValue, duration = 800) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用緩動函數
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
        
        element.textContent = `${currentValue}ms`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// 更新測試行
function updateTestRow(row, result) {
    const latencyElement = row.querySelector('.col-latency');
    const nodeElement = row.querySelector('.col-node');
    
    if (result.status === 'success') {
        const latency = result.latency;
        let latencyClass = 'latency-good';
        
        if (latency > 300) {
            latencyClass = 'latency-bad';
        } else if (latency > 100) {
            latencyClass = 'latency-medium';
        }
        
        // 平滑數值動畫
        const currentValue = parseInt(latencyElement.textContent) || 0;
        latencyElement.className = `col-latency ${latencyClass}`;
        animateNumber(latencyElement, currentValue, latency);
        
        nodeElement.textContent = result.colo;
        
    } else {
        latencyElement.textContent = '失敗';
        latencyElement.className = 'col-latency latency-bad';
        
        nodeElement.textContent = '-';
    }
}

// 初始化測試表格
function initTestTable() {
    const testGrid = document.getElementById('testGrid');
    testGrid.innerHTML = '';
    
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
        planHeader.className = 'plan-header';
        planHeader.innerHTML = `
            ${planNames[plan]}
            <span class="plan-badge ${plan}">${plan}</span>
        `;
        
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
        testGrid.appendChild(planGroup);
    });
}

// 執行單次測試
async function runSingleTest() {
    const rows = document.querySelectorAll('.test-row');
    
    // 重置延遲指示器
    rows.forEach(row => {
        const latencyElement = row.querySelector('.col-latency');
        latencyElement.textContent = '測試中';
        latencyElement.className = 'col-latency latency-testing';
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
    
    // 第一次測試顯示"測試中"
    const rows = document.querySelectorAll('.test-row');
    rows.forEach(row => {
        const latencyElement = row.querySelector('.col-latency');
        latencyElement.textContent = '測試中';
        latencyElement.className = 'col-latency latency-testing';
    });
    
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