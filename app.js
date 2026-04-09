// Asset colors
const ASSET_COLORS = [
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#10b981'  // green
];

// State
let assets = [];
let chart = null;

// Default settings
const DEFAULT_SETTINGS = {
    cagrFloor: 10,
    retirementYear: 2035,
    endYear: 2060,
    annualWithdrawal: 50000,
    inflationRate: 3,
    targetLegacy: 500000,
    withdrawalStrategy: 'equal'
};

// Local Storage Keys
const STORAGE_KEY_ASSETS = 'cagr_calculator_assets';
const STORAGE_KEY_SETTINGS = 'cagr_calculator_settings';
const STORAGE_KEY_VERSION = 'cagr_calculator_version';
const CURRENT_VERSION = 2; // Bump to invalidate old default-asset data

// Escape HTML to prevent XSS when inserting user input into innerHTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Save data to local storage
function saveData() {
    try {
        const assetData = assets.map(a => ({
            name: a.name,
            units: a.units,
            price: a.price,
            cagr: a.cagr,
            reduction: a.reduction,
            contribution: a.contribution || 0,
            taxRate: a.taxRate || 0,
            protected: a.protected || false
        }));
        localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assetData));

        const settings = {
            cagrFloor: document.getElementById('cagrFloor').value,
            retirementYear: document.getElementById('retirementYear').value,
            endYear: document.getElementById('endYear').value,
            annualWithdrawal: document.getElementById('annualWithdrawal').value,
            inflationRate: document.getElementById('inflationRate').value,
            targetLegacy: document.getElementById('targetLegacy').value,
            withdrawalStrategy: document.getElementById('withdrawalStrategy').value
        };
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));

        showSaveNotification('Data saved!');
    } catch (e) {
        console.error('Failed to save data:', e);
        showSaveNotification('Failed to save!', true);
    }
}

// Load data from local storage
function loadData() {
    try {
        // Wipe stale data from previous versions (which had hardcoded defaults)
        const storedVersion = parseInt(localStorage.getItem(STORAGE_KEY_VERSION)) || 0;
        if (storedVersion < CURRENT_VERSION) {
            localStorage.removeItem(STORAGE_KEY_ASSETS);
            localStorage.removeItem(STORAGE_KEY_SETTINGS);
            localStorage.setItem(STORAGE_KEY_VERSION, CURRENT_VERSION);
        }

        const savedAssets = localStorage.getItem(STORAGE_KEY_ASSETS);
        assets = [];
        if (savedAssets) {
            const assetData = JSON.parse(savedAssets);
            assetData.forEach(a => addAsset(a));
        }

        const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = settings[key] ?? DEFAULT_SETTINGS[key];
            });
        }

        return true;
    } catch (e) {
        console.error('Failed to load data:', e);
        return false;
    }
}

// Clear saved data
function clearData() {
    if (confirm('Are you sure you want to reset? This will clear all saved data and remove all assets.')) {
        assets = [];

        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = DEFAULT_SETTINGS[key];
        });

        // Save the empty state so it persists through reload
        saveData();
        renderAssets();
        clearResults();
        showSaveNotification('All data cleared!');
    }
}

// Show save notification
function showSaveNotification(message, isError = false) {
    const notification = document.getElementById('saveNotification');
    notification.textContent = message;
    notification.style.background = isError ? 'var(--accent-red)' : 'var(--accent-green)';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

// Clear results to blank state
function clearResults() {
    ['summaryStart', 'summaryPeak', 'summaryFinal', 'summaryProtectedFinal',
     'summaryWithdrawn', 'summaryTaxPaid', 'summaryNetWithdrawn',
     'summaryLegacy', 'summaryLegacyTarget', 'summaryContributions'].forEach(id => {
        document.getElementById(id).textContent = '-';
    });
    document.getElementById('tableBody').innerHTML = `
        <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
            Add assets and click Calculate to see projections
        </td></tr>`;
    const mobileList = document.getElementById('mobileYearList');
    if (mobileList) {
        mobileList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Add assets and click Calculate to see projections</p>';
    }
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

// Mobile tab switching
function initMobileTabs() {
    const tabs = document.querySelectorAll('.mobile-tab');
    const inputPanel = document.getElementById('inputPanel');
    const resultsSection = document.getElementById('resultsSection');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            if (target === 'input') {
                inputPanel.classList.remove('tab-hidden');
                resultsSection.classList.add('tab-hidden');
            } else {
                inputPanel.classList.add('tab-hidden');
                resultsSection.classList.remove('tab-hidden');
            }
        });
    });
}

// Switch to results tab on mobile after calculation
function switchToResultsTab() {
    if (window.innerWidth <= 768) {
        const tabs = document.querySelectorAll('.mobile-tab');
        tabs.forEach(t => t.classList.remove('active'));
        tabs[1].classList.add('active');
        document.getElementById('inputPanel').classList.add('tab-hidden');
        document.getElementById('resultsSection').classList.remove('tab-hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderAssets();
    initMobileTabs();

    // Set initial tab state on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('resultsSection').classList.add('tab-hidden');
    }

    document.getElementById('addAssetBtn').addEventListener('click', () => {
        if (assets.length < 5) {
            addAsset({ name: 'NEW', units: 0, price: 0, cagr: 10, reduction: 1, contribution: 0 });
            renderAssets();
        }
    });

    document.getElementById('calculateBtn').addEventListener('click', () => {
        calculate();
        switchToResultsTab();
    });
    document.getElementById('calcMaxWithdrawal').addEventListener('click', () => {
        calculateMaxWithdrawal();
        switchToResultsTab();
    });
    document.getElementById('saveDataBtn').addEventListener('click', () => saveData());
    document.getElementById('clearDataBtn').addEventListener('click', () => clearData());

    // Only auto-calculate if there are saved assets
    if (assets.length > 0) {
        calculate();
    }
});

function addAsset(data = {}) {
    if (assets.length >= 5) return;

    assets.push({
        id: Date.now() + Math.random(),
        name: data.name || 'Asset',
        units: data.units || 0,
        price: data.price || 0,
        cagr: data.cagr || 10,
        reduction: data.reduction || 1,
        contribution: data.contribution || 0,
        taxRate: data.taxRate || 0,
        protected: data.protected || false,
        editing: false
    });
}

function deleteAsset(id) {
    assets = assets.filter(a => a.id !== id);
    renderAssets();
    calculate();
}

function toggleEdit(id) {
    assets = assets.map(a => ({
        ...a,
        editing: a.id === id ? !a.editing : a.editing
    }));
    renderAssets();
}

function updateAsset(id, field, value) {
    assets = assets.map(a => {
        if (a.id === id) {
            let newValue = value;
            if (field === 'protected') {
                newValue = Boolean(value);
            } else if (field !== 'name') {
                newValue = parseFloat(value) || 0;
            }
            return { ...a, [field]: newValue };
        }
        return a;
    });
}

function formatCurrency(value, decimals = 0) {
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    return '$' + value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function renderAssets() {
    const container = document.getElementById('assetsList');
    const addBtn = document.getElementById('addAssetBtn');

    if (assets.length === 0) {
        container.innerHTML = `
            <div class="no-assets">
                <p>No assets added yet</p>
                <p style="font-size: 0.85rem; margin-top: 8px;">Click "Add Asset" to begin</p>
            </div>
        `;
        addBtn.classList.remove('hidden');
        return;
    }

    addBtn.classList.toggle('hidden', assets.length >= 5);

    container.innerHTML = assets.map((asset, index) => {
        const value = asset.units * asset.price;
        const color = ASSET_COLORS[index % ASSET_COLORS.length];
        const safeName = escapeHtml(asset.name);

        if (asset.editing) {
            return `
                <div class="asset-card editing ${asset.protected ? 'protected-asset' : ''}">
                    <div class="asset-header">
                        <div class="asset-name">
                            <span class="asset-color" style="background: ${color}"></span>
                            <input type="text" value="${safeName}"
                                onchange="updateAsset(${asset.id}, 'name', this.value)"
                                placeholder="Asset name">
                        </div>
                        <div class="asset-actions">
                            <button class="btn btn-secondary btn-small edit-toggle" onclick="toggleEdit(${asset.id})">Done</button>
                            <button class="btn btn-danger btn-small" onclick="deleteAsset(${asset.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="asset-value">${formatCurrency(value, 2)}</div>
                    <div class="asset-details">
                        <div class="asset-detail">
                            <label>Units Held</label>
                            <input type="number" value="${asset.units}" step="0.0001"
                                onchange="updateAsset(${asset.id}, 'units', this.value)">
                        </div>
                        <div class="asset-detail">
                            <label>Price ($)</label>
                            <input type="number" value="${asset.price}" step="0.01"
                                onchange="updateAsset(${asset.id}, 'price', this.value)">
                        </div>
                        <div class="asset-detail">
                            <label>CAGR (%)</label>
                            <input type="number" value="${asset.cagr}" step="0.1"
                                onchange="updateAsset(${asset.id}, 'cagr', this.value)">
                        </div>
                        <div class="asset-detail">
                            <label>Reduction/Year (%)</label>
                            <input type="number" value="${asset.reduction}" step="0.1"
                                onchange="updateAsset(${asset.id}, 'reduction', this.value)">
                        </div>
                        <div class="asset-detail full-width">
                            <label>Annual Contribution ($/yr until retirement)</label>
                            <input type="number" value="${asset.contribution}" step="100"
                                onchange="updateAsset(${asset.id}, 'contribution', this.value)">
                        </div>
                        <div class="asset-detail full-width">
                            <label>Tax Rate on Withdrawal (%)</label>
                            <input type="number" value="${asset.taxRate}" step="1" min="0" max="100"
                                onchange="updateAsset(${asset.id}, 'taxRate', this.value)">
                        </div>
                        <div class="asset-detail full-width checkbox-row">
                            <label class="checkbox-label">
                                <input type="checkbox" ${asset.protected ? 'checked' : ''}
                                    onchange="updateAsset(${asset.id}, 'protected', this.checked)">
                                Protect from Withdrawal
                            </label>
                            <span class="protect-hint">Asset grows separately, never withdrawn</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="asset-card ${asset.protected ? 'protected-asset' : ''}">
                <div class="asset-header">
                    <div class="asset-name">
                        <span class="asset-color" style="background: ${color}"></span>
                        ${safeName}
                        ${asset.protected ? '<span class="protected-badge">Protected</span>' : ''}
                    </div>
                    <div class="asset-actions">
                        <button class="btn btn-secondary btn-small edit-toggle" onclick="toggleEdit(${asset.id})">Edit</button>
                    </div>
                </div>
                <div class="asset-value">${formatCurrency(value, 2)}</div>
                <div class="asset-details">
                    <div class="asset-detail">
                        <label>Units</label>
                        <span>${asset.units.toLocaleString('en-US', {maximumFractionDigits: 4})}</span>
                    </div>
                    <div class="asset-detail">
                        <label>Price</label>
                        <span>${formatCurrency(asset.price, 2)}</span>
                    </div>
                    <div class="asset-detail">
                        <label>CAGR</label>
                        <span>${asset.cagr}%</span>
                    </div>
                    <div class="asset-detail">
                        <label>Reduction</label>
                        <span>${asset.reduction}%/yr</span>
                    </div>
                    ${asset.contribution > 0 ? `
                    <div class="asset-detail full-width">
                        <label>Annual Contribution</label>
                        <span>${formatCurrency(asset.contribution)}/yr</span>
                    </div>
                    ` : ''}
                    ${asset.taxRate > 0 ? `
                    <div class="asset-detail">
                        <label>Tax Rate</label>
                        <span style="color: var(--accent-red);">${asset.taxRate}%</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function calculateMaxWithdrawal() {
    const targetLegacyToday = parseFloat(document.getElementById('targetLegacy').value) || 0;
    const inflationRate = parseFloat(document.getElementById('inflationRate').value) / 100 || 0.03;
    const endYear = parseInt(document.getElementById('endYear').value) || 2060;
    const currentYear = new Date().getFullYear();
    const yearsToEnd = endYear - currentYear;
    const targetLegacy = targetLegacyToday * Math.pow(1 + inflationRate, yearsToEnd);

    if (assets.length === 0) {
        alert('Please add at least one asset first.');
        return;
    }

    // Binary search for max withdrawal
    let low = 0;
    let high = 1000000;
    let bestWithdrawal = 0;
    let iterations = 0;
    const maxIterations = 50;

    while (high - low > 100 && iterations < maxIterations) {
        const mid = Math.floor((low + high) / 2);
        document.getElementById('annualWithdrawal').value = mid;
        const finalValue = calculate(true);

        if (finalValue >= targetLegacy) {
            bestWithdrawal = mid;
            low = mid;
        } else {
            high = mid;
        }
        iterations++;
    }

    document.getElementById('annualWithdrawal').value = bestWithdrawal;
    calculate();

    const legacyTodayFormatted = formatCurrency(targetLegacyToday);
    const legacyNominalFormatted = formatCurrency(targetLegacy);
    const withdrawalFormatted = formatCurrency(bestWithdrawal);
    alert(`Maximum sustainable withdrawal: ${withdrawalFormatted}/year (in today's dollars)\n\nThis will leave approximately ${legacyNominalFormatted} at end date\n(equivalent to ${legacyTodayFormatted} in today's purchasing power).`);
}

function calculate(silent = false) {
    if (assets.length === 0) return 0;

    const cagrFloor = parseFloat(document.getElementById('cagrFloor').value) || 0;
    const retirementYear = parseInt(document.getElementById('retirementYear').value) || 2035;
    const endYear = parseInt(document.getElementById('endYear').value) || 2060;
    const baseWithdrawal = parseFloat(document.getElementById('annualWithdrawal').value) || 0;
    const inflationRate = parseFloat(document.getElementById('inflationRate').value) / 100 || 0.03;
    const withdrawalStrategy = document.getElementById('withdrawalStrategy').value || 'equal';

    const currentYear = new Date().getFullYear();
    const years = [];

    // Initialize asset tracking
    let assetValues = assets.map(a => ({
        name: a.name,
        value: a.units * a.price,
        unitPrice: a.price,
        units: a.units,
        currentCagr: a.cagr,
        reduction: a.reduction,
        contribution: a.contribution || 0,
        taxRate: a.taxRate || 0,
        protected: a.protected || false
    }));

    let totalWithdrawn = 0;
    let totalTaxPaid = 0;
    let peakValue = 0;
    let cumulativeInflation = 1;

    for (let year = currentYear; year <= endYear; year++) {
        // Add contributions before retirement (at start of year)
        if (year < retirementYear) {
            assetValues = assetValues.map(a => ({
                ...a,
                value: a.value + a.contribution
            }));
        }

        // Calculate inflation-adjusted withdrawal
        let withdrawal = 0;
        if (year >= retirementYear) {
            withdrawal = baseWithdrawal * cumulativeInflation;
        }

        // Calculate total value before withdrawal
        let totalBefore = assetValues.reduce((sum, a) => sum + a.value, 0);

        // Calculate protected assets total
        let protectedTotal = assetValues.filter(a => a.protected).reduce((sum, a) => sum + a.value, 0);

        if (totalBefore > peakValue) peakValue = totalBefore;

        // Calculate withdrawal per asset (only from unprotected assets with value > 0)
        const activeAssets = assetValues.filter(a => a.value > 0 && !a.protected);

        let withdrawalAllocations = [];

        if (withdrawal > 0 && activeAssets.length > 0) {
            if (withdrawalStrategy === 'equal') {
                const perAsset = withdrawal / activeAssets.length;
                withdrawalAllocations = assetValues.map(a => ({
                    name: a.name,
                    gross: (a.value > 0 && !a.protected) ? Math.min(perAsset, a.value) : 0,
                    taxRate: a.taxRate
                }));
            } else if (withdrawalStrategy === 'proportional') {
                const totalActive = activeAssets.reduce((sum, a) => sum + a.value, 0);
                withdrawalAllocations = assetValues.map(a => ({
                    name: a.name,
                    gross: (a.value > 0 && !a.protected) ? Math.min((a.value / totalActive) * withdrawal, a.value) : 0,
                    taxRate: a.taxRate
                }));
            } else if (withdrawalStrategy === 'protect') {
                const sorted = [...assetValues].filter(a => a.value > 0 && !a.protected).sort((a, b) => a.value - b.value);
                let remaining = withdrawal;
                const allocMap = {};

                for (const asset of sorted) {
                    if (remaining <= 0) break;
                    const take = Math.min(remaining, asset.value);
                    allocMap[asset.name] = take;
                    remaining -= take;
                }

                withdrawalAllocations = assetValues.map(a => ({
                    name: a.name,
                    gross: allocMap[a.name] || 0,
                    taxRate: a.taxRate
                }));
            }
        } else {
            withdrawalAllocations = assetValues.map(a => ({
                name: a.name,
                gross: 0,
                taxRate: a.taxRate
            }));
        }

        // Calculate tax and net for each allocation
        withdrawalAllocations = withdrawalAllocations.map(w => ({
            ...w,
            tax: w.gross * (w.taxRate / 100),
            net: w.gross * (1 - w.taxRate / 100)
        }));

        const totalGrossWithdrawal = withdrawalAllocations.reduce((sum, w) => sum + w.gross, 0);
        const totalTaxThisYear = withdrawalAllocations.reduce((sum, w) => sum + w.tax, 0);
        const totalNetWithdrawal = withdrawalAllocations.reduce((sum, w) => sum + w.net, 0);

        const yearData = {
            year,
            assetDetails: assetValues.map((a) => {
                const alloc = withdrawalAllocations.find(w => w.name === a.name) || { gross: 0, tax: 0, net: 0 };
                return {
                    name: a.name,
                    value: a.value,
                    unitPrice: a.unitPrice,
                    cagr: a.currentCagr,
                    withdrawalGross: alloc.gross,
                    withdrawalTax: alloc.tax,
                    withdrawalNet: alloc.net,
                    taxRate: a.taxRate,
                    protected: a.protected
                };
            }),
            totalNominal: totalBefore,
            protectedTotal: protectedTotal,
            totalReal: totalBefore / cumulativeInflation,
            withdrawalGross: totalGrossWithdrawal,
            withdrawalTax: totalTaxThisYear,
            withdrawalNet: totalNetWithdrawal,
            cumulativeInflation
        };
        years.push(yearData);

        // Apply withdrawal
        assetValues = assetValues.map(a => {
            const alloc = withdrawalAllocations.find(w => w.name === a.name) || { gross: 0 };
            return {
                ...a,
                value: Math.max(0, a.value - alloc.gross)
            };
        });

        totalWithdrawn += totalGrossWithdrawal;
        totalTaxPaid += totalTaxThisYear;

        // Apply growth for next year
        assetValues = assetValues.map((a) => {
            const growth = 1 + (a.currentCagr / 100);
            const newCagr = Math.max(cagrFloor, a.currentCagr - a.reduction);
            return {
                ...a,
                value: a.value * growth,
                unitPrice: a.unitPrice * growth,
                currentCagr: newCagr
            };
        });

        cumulativeInflation *= (1 + inflationRate);
    }

    const startValue = years[0]?.totalNominal || 0;
    const finalValue = years[years.length - 1]?.totalNominal || 0;
    const protectedFinalValue = years[years.length - 1]?.protectedTotal || 0;

    if (silent) {
        return finalValue;
    }

    const totalContributions = assets.reduce((sum, a) => sum + (a.contribution || 0), 0);
    const yearsOfContributions = Math.max(0, retirementYear - currentYear);
    const totalContributionAmount = totalContributions * yearsOfContributions;

    const targetLegacyToday = parseFloat(document.getElementById('targetLegacy').value) || 0;
    const yearsToEnd = endYear - currentYear;
    const targetLegacyNominal = targetLegacyToday * Math.pow(1 + inflationRate, yearsToEnd);
    const legacyMet = finalValue >= targetLegacyNominal;

    document.getElementById('summaryStart').textContent = formatCurrency(startValue);
    document.getElementById('summaryPeak').textContent = formatCurrency(peakValue);
    document.getElementById('summaryFinal').textContent = formatCurrency(finalValue);
    document.getElementById('summaryFinal').className = `value ${finalValue > 0 ? (legacyMet ? 'green' : 'yellow') : 'red'}`;
    document.getElementById('summaryProtectedFinal').textContent = formatCurrency(protectedFinalValue);
    document.getElementById('summaryWithdrawn').textContent = formatCurrency(totalWithdrawn);
    document.getElementById('summaryTaxPaid').textContent = formatCurrency(totalTaxPaid);
    document.getElementById('summaryNetWithdrawn').textContent = formatCurrency(totalWithdrawn - totalTaxPaid);
    document.getElementById('summaryLegacy').textContent = legacyMet ? 'Met' : 'Not Met';
    document.getElementById('summaryLegacy').className = `value ${legacyMet ? 'green' : 'red'}`;
    document.getElementById('summaryLegacyTarget').textContent = formatCurrency(targetLegacyNominal);
    document.getElementById('summaryContributions').textContent = formatCurrency(totalContributionAmount);

    updateChart(years, assets);
    updateTable(years);

    // Auto-save portfolio on every calculation
    saveData();

    return finalValue;
}

function updateChart(years, assetsList) {
    const ctx = document.getElementById('growthChart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    const datasets = [
        {
            label: 'Total Portfolio',
            data: years.map(y => y.totalNominal),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3
        },
        {
            label: 'Protected Total',
            data: years.map(y => y.protectedTotal),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false,
            tension: 0.3
        },
        ...assetsList.map((asset, index) => ({
            label: asset.name,
            data: years.map(y => {
                const detail = y.assetDetails.find(d => d.name === asset.name);
                return detail ? detail.value : 0;
            }),
            borderColor: ASSET_COLORS[index % ASSET_COLORS.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3
        }))
    ];

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y.year),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: window.innerWidth <= 768 ? 'bottom' : 'top',
                    labels: {
                        color: '#94a3b8',
                        usePointStyle: true,
                        padding: window.innerWidth <= 768 ? 10 : 20,
                        font: {
                            size: window.innerWidth <= 768 ? 10 : 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#1a2235',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#2a3548',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(42, 53, 72, 0.5)'
                    },
                    ticks: {
                        color: '#64748b',
                        maxTicksLimit: window.innerWidth <= 768 ? 8 : 20,
                        maxRotation: window.innerWidth <= 768 ? 45 : 0
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(42, 53, 72, 0.5)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateTable(years) {
    // Desktop table
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = years.map(y => {
        const assetDetails = y.assetDetails.map(a => {
            const safeName = escapeHtml(a.name);
            const protectedBadge = a.protected ? ' <span style="color: var(--accent-purple);">Protected</span>' : '';
            let detail = `<strong>${safeName}</strong>${protectedBadge}: ${formatCurrency(a.value)} (${formatCurrency(a.unitPrice, 2)}/unit) @ ${a.cagr.toFixed(1)}%`;
            if (a.withdrawalGross > 0) {
                detail += `<br><span style="color: var(--accent-yellow);">  Withdraw: ${formatCurrency(a.withdrawalGross)}`;
                if (a.taxRate > 0) {
                    detail += ` - Tax ${a.taxRate}%: ${formatCurrency(a.withdrawalTax)} = Net: ${formatCurrency(a.withdrawalNet)}`;
                }
                detail += `</span>`;
            }
            return detail;
        }).join('<br>');

        return `
            <tr>
                <td>${y.year}</td>
                <td class="${y.totalNominal > 0 ? 'positive' : 'negative'}">${formatCurrency(y.totalNominal)}</td>
                <td style="color: var(--accent-purple);">${formatCurrency(y.protectedTotal)}</td>
                <td>${formatCurrency(y.totalReal)}</td>
                <td class="${y.withdrawalGross > 0 ? 'negative' : ''}">${y.withdrawalGross > 0 ? '-' + formatCurrency(y.withdrawalGross) : '-'}</td>
                <td class="${y.withdrawalTax > 0 ? 'negative' : ''}">${y.withdrawalTax > 0 ? '-' + formatCurrency(y.withdrawalTax) : '-'}</td>
                <td class="${y.withdrawalNet > 0 ? 'positive' : ''}">${y.withdrawalNet > 0 ? formatCurrency(y.withdrawalNet) : '-'}</td>
                <td style="font-size: 0.75rem; text-align: left; font-family: 'DM Sans', sans-serif;">${assetDetails}</td>
            </tr>
        `;
    }).join('');

    // Mobile year cards
    const mobileList = document.getElementById('mobileYearList');
    if (!mobileList) return;

    mobileList.innerHTML = years.map(y => {
        const assetLines = y.assetDetails.map(a => {
            const safeName = escapeHtml(a.name);
            let line = `<strong>${safeName}</strong>: ${formatCurrency(a.value)}`;
            if (a.withdrawalGross > 0) {
                line += ` <span class="negative">-${formatCurrency(a.withdrawalGross)}</span>`;
            }
            return line;
        }).join('<br>');

        return `
            <div class="year-card">
                <div class="year-card-header">
                    <span class="year-label">${y.year}</span>
                    <span class="year-total ${y.totalNominal > 0 ? 'positive' : 'negative'}">${formatCurrency(y.totalNominal)}</span>
                </div>
                <div class="year-card-grid">
                    <div class="year-card-item">
                        <span class="yc-label">Real Value</span>
                        <span class="yc-value">${formatCurrency(y.totalReal)}</span>
                    </div>
                    <div class="year-card-item">
                        <span class="yc-label">Protected</span>
                        <span class="yc-value" style="color: var(--accent-purple);">${formatCurrency(y.protectedTotal)}</span>
                    </div>
                    ${y.withdrawalGross > 0 ? `
                    <div class="year-card-item">
                        <span class="yc-label">Withdrawal</span>
                        <span class="yc-value negative">-${formatCurrency(y.withdrawalGross)}</span>
                    </div>
                    <div class="year-card-item">
                        <span class="yc-label">Net After Tax</span>
                        <span class="yc-value positive">${formatCurrency(y.withdrawalNet)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="year-card-assets">${assetLines}</div>
            </div>
        `;
    }).join('');
}
