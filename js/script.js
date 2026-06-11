// --- INITIAL STATE & LOCALSTORAGE ---
const DEFAULT_STATE = {
    balances: {
        main: 136000,
        main_baseline: 136000, 
        modal_jualan: 36000,   
        cash: 75000,           
        ewallet: 25000,         
        profit: 0,
        piutang: 125000,
        fashion: 0,
        skincare: 0
    },
    transactions: [],
    recapHistory: [],
    categoryDebts: [],
    weeklyTarget: 50000 // Target default 50k
};

let state = JSON.parse(localStorage.getItem('solpay_state')) || JSON.parse(JSON.stringify(DEFAULT_STATE));
let lastDeletedTransaction = null;

function saveState() {
    localStorage.setItem('solpay_state', JSON.stringify(state));
    renderAll();
}

let chartGrowthInstance = null;
let chartSpendingInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFAB();
    initForms();
    initLiveCalc();
    initCustomSelects();
    initQuickRecapActions();
    initConfirmationEvents(); 
    renderAll();
    if (window.lucide) lucide.createIcons();
});

// --- CUSTOM INTERACTIVE CHIPS SELECTION LOGIC ---
function initCustomSelects() {
    const groups = ['track-type-group', 'track-category-group', 'track-source-group', 'biz-status-group', 'biz-source-group', 'confirm-receive-group'];
    groups.forEach(groupId => {
        const groupEl = document.getElementById(groupId);
        if (!groupEl) return;
        
        groupEl.addEventListener('click', (e) => {
            const button = e.target.closest('.select-btn');
            if (!button) return;
            
            groupEl.querySelectorAll('.select-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            if (groupId === 'track-type-group') {
                const val = button.getAttribute('data-value');
                const catGroup = document.getElementById('group-category');
                
                if (catGroup) {
                    if (val === 'pengeluaran' || val === 'transfer_pos') {
    catGroup.style.display = 'flex';
} else {
    catGroup.style.display = 'none';
}
                }
            }
        });
    });
}

function getCustomSelectValue(groupId) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return null;
    const activeBtn = groupEl.querySelector('.select-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-value') : null;
}

function setCustomSelectValue(groupId, value) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return;
    groupEl.querySelectorAll('.select-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === value) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// --- NAVIGATION SYSTEM ---
function initNavigation() {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            switchView(item.getAttribute('data-view'));
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) activeView.classList.add('active');
    if (viewId === 'home' || viewId === 'analytics') renderCharts();
}

// --- FAB UTILITIES ---
function initFAB() {
    const fabWrapper = document.getElementById('fabWrapper');
    if (!fabWrapper) return;
    document.getElementById('fabTrigger').addEventListener('click', (e) => {
        e.stopPropagation();
        fabWrapper.classList.toggle('open');
    });
    document.addEventListener('click', () => fabWrapper.classList.remove('open'));
}

function openManualTracker(type) {
    switchView('profile');
    setCustomSelectValue('track-type-group', type);
    const catGroup = document.getElementById('group-category');
    if (catGroup) {
    catGroup.style.display =
        (type === 'pengeluaran' || type === 'transfer_pos')
            ? 'flex'
            : 'none';
}
    showToast(`✨ Input manual ${type} dibuka`);
}

function showToast(message, allowUndo = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    let undoButtonHtml = allowUndo ? `<button onclick="undoDeleteTransaction()" style="background:none; border:none; color:#14F195; font-weight:700; margin-left:10px; cursor:pointer;">UNDO</button>` : '';
    
    toast.innerHTML = `<span>${message}</span>${undoButtonHtml}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// TRANSACTIONS MODAL OVERLAY
const modalOverlay = document.getElementById('modalOverlay');
function openActionModal(type) {
    const form = document.getElementById('form-business-action');
    if (form) form.reset();
    if (modalOverlay) modalOverlay.classList.add('open');
    document.getElementById('biz-type').value = type;
    
    const titleEl = document.getElementById('modal-title');
    if (titleEl) {
        if (type === 'kuota') titleEl.innerText = '⚡ Transaksi Pulsa / Kuota';
        if (type === 'ewallet') titleEl.innerText = '💸 Top Up E-Wallet';
        if (type === 'tarik') titleEl.innerText = '🏧 Tarik Tunai Dana';
    }
    updateLiveCalc();
}

function closeModal() { if (modalOverlay) modalOverlay.classList.remove('open'); }
const closeBtn = document.getElementById('btn-close-modal');
if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
}

function initLiveCalc() {
    const bizNominal = document.getElementById('biz-nominal');
    if (bizNominal) bizNominal.addEventListener('input', updateLiveCalc);
}

function updateLiveCalc() {
    const type = document.getElementById('biz-type').value;
    const nominal = parseFloat(document.getElementById('biz-nominal').value) || 0;
    
    let profit = 0;
    if (type === 'kuota') profit = 3000; 
    else if (type === 'ewallet') profit = 5000; 
    else if (type === 'tarik') profit = nominal < 100000 ? 3000 : 5000; 
    
    const baseEl = document.getElementById('calc-base');
    const profitEl = document.getElementById('calc-base-profit'); 
    const totalEl = document.getElementById('calc-total');
    
    if (baseEl) baseEl.innerText = formatIDR(nominal);
    if (profitEl) profitEl.innerText = `+${formatIDR(profit)}`;
    if (totalEl) totalEl.innerText = formatIDR(nominal + profit);
}

function initQuickRecapActions() {
    const btnCelengan = document.getElementById('btn-quick-celengan');
    if (btnCelengan) {
        btnCelengan.addEventListener('click', () => {
            switchView('profile');
            setCustomSelectValue('track-type-group', 'pemasukan');
            document.getElementById('track-notes').value = "Celengan Harian Target Solana";
            document.getElementById('track-nominal').focus();
            showToast("🎯 Silakan ketik nominal saldo celengan harian lu!");
        });
    }
}

// CORE SYSTEM FORM HANDLING
function initForms() {
    const formBiz = document.getElementById('form-business-action');
    if (formBiz) {
        formBiz.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = document.getElementById('biz-type').value;
            const customer = document.getElementById('biz-customer').value || 'Pelanggan';
            const nominal = parseFloat(document.getElementById('biz-nominal').value);
            const status = getCustomSelectValue('biz-status-group') || 'Lunas';
            const receiveTarget = getCustomSelectValue('biz-source-group') || 'cash';
            const notes = document.getElementById('biz-notes').value;
            
            if (isNaN(nominal) || nominal <= 0) {
                showToast("❌ Nominal tidak valid!");
                return;
            }

            let profit = 0;
            if (type === 'kuota') profit = 3000; 
            else if (type === 'ewallet') profit = 5000; 
            else if (type === 'tarik') profit = nominal < 100000 ? 3000 : 5000; 
            
            const totalPayment = nominal + profit;
            
            if (state.balances.modal_jualan < nominal) {
                showToast(`❌ Stok Modal Jualan tidak cukup!`);
                return;
            }
            
            state.balances.modal_jualan -= nominal;
            
            if (status === 'Lunas') {
                state.balances.modal_jualan += nominal; 
                
                if (receiveTarget === 'cash') state.balances.cash += profit;
                else state.balances.ewallet += profit;
                
                state.balances.profit += profit;
                showToast(`✅ Transaksi Sukses! Modal Pokok kembali dikunci, Profit masuk kas ${receiveTarget.toUpperCase()}`);
            } else {
                state.balances.piutang += totalPayment;
                showToast(`⚠ Hutang dicatat atas nama ${customer}`);
            }
            
            state.transactions.unshift({
                id: 'TX-' + Date.now(),
                customer: customer,
                type: type, 
                nominal: nominal,
                profit: profit,
                totalPayment: totalPayment,
                status: status, 
                source: receiveTarget,
                notes: notes,
                date: new Date().toLocaleString('id-ID')
            });
            
            saveState();
            closeModal();
        });
    }

    const formTracker = document.getElementById('form-tracker');
    if (formTracker) {
        formTracker.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = getCustomSelectValue('track-type-group') || 'pemasukan';
            const nominal = parseFloat(document.getElementById('track-nominal').value);
            const category = getCustomSelectValue('track-category-group');
            const source = getCustomSelectValue('track-source-group') || 'cash';
            const notes = document.getElementById('track-notes').value || '';
            
            if (isNaN(nominal) || nominal <= 0) {
                showToast("❌ Masukkan nominal angka yang valid!");
                return;
            }

            if (
    type === 'transfer' ||
    notes.toLowerCase().includes('pindah') ||
    notes.toLowerCase().includes('transfer')
) {
                if (source === 'cash') {
                    if (state.balances.cash < nominal) { showToast("❌ Saldo Tunai lu gak cukup buat dipindahin!"); return; }
                    state.balances.cash -= nominal;
                    state.balances.ewallet += nominal;
                    showToast(`🔄 Sukses memindahkan ${formatIDR(nominal)} dari Tunai ke E-Wallet!`);
                } else {
                    if (state.balances.ewallet < nominal) { showToast("❌ Saldo E-Wallet lu gak cukup buat dipindahin!"); return; }
                    state.balances.ewallet -= nominal;
                    state.balances.cash += nominal;
                    showToast(`🔄 Sukses memindahkan ${formatIDR(nominal)} dari E-Wallet ke Tunai!`);
                }
            } 
            else if (type === 'transfer_pos') {
    const fromCategory = category;
    const toCategory =
        category === 'fashion'
            ? 'skincare'
            : 'fashion';

    if (state.balances[fromCategory] < nominal) {
        showToast(`❌ Saldo ${fromCategory} tidak cukup!`);
        return;
    }

    state.balances[fromCategory] -= nominal;
    state.balances[toCategory] += nominal;

    showToast(
        `🔄 Transfer ${formatIDR(nominal)} dari ${fromCategory.toUpperCase()} ke ${toCategory.toUpperCase()} berhasil!`
    );
}

            
            else if (type === 'isi_modal') {
                if (source === 'cash' && state.balances.cash < nominal) { showToast(`❌ Saldo Cash tidak cukup!`); return; }
                if (source === 'ewallet' && state.balances.ewallet < nominal) { showToast(`❌ Saldo E-Wallet tidak cukup!`); return; }
                
                if (source === 'cash') state.balances.cash -= nominal;
                else state.balances.ewallet -= nominal;
                
                state.balances.modal_jualan += nominal;
                showToast(`⚡ Sukses isi ulang Modal Dagang +${formatIDR(nominal)}`);
            } 
            else if (type === 'pemasukan') {
                if (source === 'cash') state.balances.cash += nominal;
                else state.balances.ewallet += nominal;
                showToast(`💸 Pemasukan kas berhasil disimpan.`);
            } 
            else { 
                if (category === 'skincare' || category === 'fashion') {
                    handleCategorySpending(category, nominal);
                } else {
                    if (source === 'cash') {
                        if (state.balances.cash < nominal) { showToast(`❌ Kas Cash tidak cukup!`); return; }
                        state.balances.cash -= nominal;
                    } else {
                        if (state.balances.ewallet < nominal) { showToast(`❌ Kas E-Wallet tidak cukup!`); return; }
                        state.balances.ewallet -= nominal;
                    }
                }
                showToast(`🔴 Pengeluaran dicatat.`);
            }
            
            state.transactions.unshift({
                id: 'MNT-' + Date.now(),
                customer: 'Self (Tracker)',
                type: type === 'isi_modal' ? 'Isi Modal' : type, 
                nominal: nominal,
                profit: 0,
                totalPayment: nominal,
                status: 'Lunas',
                source: (category === 'skincare' || category === 'fashion') ? 'Pos Kategori' : source,
                notes: notes || `Kategori: ${category || 'Umum'}`,
                date: new Date().toLocaleString('id-ID')
            });
            
            formTracker.reset();
            saveState();
        });
    }

    const btnRecap = document.getElementById('btn-generate-recap');
    if (btnRecap) {
        btnRecap.addEventListener('click', () => {
            const remainingPersonalCheck = state.balances.cash + state.balances.ewallet;
            const profit = state.balances.profit;
            
            if (remainingPersonalCheck <= 0) {
                showToast(`⚠ Kas kosong, tidak ada saldo harian berjalan untuk di-recap.`);
                return;
            }

            let totalToSplit = remainingPersonalCheck;

            state.balances.cash = 0;
            state.balances.ewallet = 0;
            state.balances.profit = 0;

            let halfShare = totalToSplit / 2;
            state.balances.fashion += halfShare;
            state.balances.skincare += halfShare;

            if (state.categoryDebts && state.categoryDebts.length > 0) {
                state.categoryDebts.forEach(debt => {
                    if (state.balances[debt.from] >= debt.amount) {
                        state.balances[debt.from] -= debt.amount;
                        state.balances[debt.to] += debt.amount;
                    }
                });
                state.categoryDebts = []; 
                showToast("🔄 Utang antar kategori otomatis diselesaikan dari rekap!");
            }
            
            state.recapHistory.unshift({
                id: 'RCP-' + Date.now(),
                date: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
                checkMoney: remainingPersonalCheck, 
                profit, 
                allocatedEach: halfShare
            });
            
            state.balances.main_baseline = state.balances.modal_jualan + state.balances.fashion + state.balances.skincare;
            
            saveState();
            showToast(`✨ Rekap mingguan bersih! Terbagi rata ke Skincare & Fashion.`);
        });
    }

    const btnClear = document.getElementById('btn-clear-storage');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            localStorage.clear();
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            localStorage.setItem('solpay_state', JSON.stringify(state));
            showToast('🗑 Menghapus memori... Mengatur ulang aplikasi!');
            setTimeout(() => { window.location.reload(true); }, 800);
        });
    }

    document.body.addEventListener('click', (e) => {
        if (e.target.innerText?.includes('Giga Reset Total') || e.target.id === 'btn-reset-system') {
            const EMPTY_STATE = {
                balances: { main: 0, main_baseline: 0, modal_jualan: 0, cash: 0, ewallet: 0, profit: 0, piutang: 0, fashion: 0, skincare: 0 },
                transactions: [], recapHistory: [], categoryDebts: [], weeklyTarget: 50000
            };
            state = EMPTY_STATE;
            saveState();
            showToast('🧼 GIGA RESET BERHASIL! Seluruh Saldo & History Jadi Nol Mutlak!');
        }
    });
}

function handleCategorySpending(category, nominal) {
    if (!state.categoryDebts) state.categoryDebts = [];
    const currentPool = state.balances[category];
    const complementaryCategory = category === 'skincare' ? 'fashion' : 'skincare';
    
    if (currentPool >= nominal) {
        state.balances[category] -= nominal;
    } else {
        const structuralDeficit = nominal - currentPool;
        state.balances[category] = 0;
        state.balances[complementaryCategory] -= structuralDeficit;
        
        state.categoryDebts.push({
            id: 'CDB-' + Date.now(), 
            from: category, 
            to: complementaryCategory, 
            amount: structuralDeficit, 
            date: new Date().toLocaleDateString('id-ID')
        });
        showToast(`⚠ Saldo ${category} kurang! Meminjam ${formatIDR(structuralDeficit)} dari pos ${complementaryCategory}`);
    }
}

function deleteTransaction(txId) {
    const index = state.transactions.findIndex(t => t.id === txId);
    if (index !== -1) {
        lastDeletedTransaction = { index: index, data: JSON.parse(JSON.stringify(state.transactions[index])) };
        const tx = state.transactions[index];
        
        if (tx.type === 'kuota' || tx.type === 'ewallet' || tx.type === 'tarik') {
            if (tx.status === 'Lunas') {
                if (tx.source === 'cash') state.balances.cash -= tx.profit;
                else state.balances.ewallet -= tx.profit;
                state.balances.profit -= tx.profit;
            } else {
                state.balances.modal_jualan += tx.nominal;
                state.balances.piutang -= tx.totalPayment;
            }
        }
        state.transactions.splice(index, 1);
        saveState();
        showToast("🗑 Transaksi dihapus!", true);
    }
}

function undoDeleteTransaction() {
    if (lastDeletedTransaction) {
        const tx = lastDeletedTransaction.data;
        if (tx.type === 'kuota' || tx.type === 'ewallet' || tx.type === 'tarik') {
            if (tx.status === 'Lunas') {
                if (tx.source === 'cash') state.balances.cash += tx.profit;
                else state.balances.ewallet += tx.profit;
                state.balances.profit += tx.profit;
            } else {
                state.balances.modal_jualan -= tx.nominal;
                state.balances.piutang += tx.totalPayment;
            }
        }
        state.transactions.splice(lastDeletedTransaction.index, 0, tx);
        lastDeletedTransaction = null;
        saveState();
        showToast("♻ Transaksi dikembalikan!");
    }
}

let activeDebtId = null;
function triggerMarkAsPaid(id) {
    activeDebtId = id;
    const confirmOverlay = document.getElementById('confirmOverlay');
    if (confirmOverlay) confirmOverlay.classList.add('open');
}

function initConfirmationEvents() {
    const btnCancel = document.getElementById('btn-confirm-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            document.getElementById('confirmOverlay').classList.remove('open');
            activeDebtId = null;
        });
    }

    const btnYes = document.getElementById('btn-confirm-yes');
    if (btnYes) {
        btnYes.addEventListener('click', () => {
            if (activeDebtId) {
                const index = state.transactions.findIndex(t => t.id === activeDebtId);
                if (index !== -1) {
                    const tx = state.transactions[index];
                    const targetWallet = getCustomSelectValue('confirm-receive-group') || 'cash';
                    
                    tx.status = 'Lunas';
                    state.balances.modal_jualan += tx.nominal;
                    
                    if (targetWallet === 'cash') state.balances.cash += tx.profit;
                    else state.balances.ewallet += tx.profit;
                    
                    state.balances.profit += tx.profit;
                    tx.source = targetWallet;
                    
                    document.getElementById('confirmOverlay').classList.remove('open');
                    showToast(`✅ Pembayaran Hutang dari ${tx.customer} Lunas! Modal diamankan, untung masuk ${targetWallet.toUpperCase()}`);
                    saveState();
                }
            }
        });
    }
}

// ENGINE DYNAMIC RENDERING (🔥 FIXED & REFACTORED)
function renderAll() {
    state.balances.main = state.balances.cash + state.balances.ewallet + state.balances.modal_jualan + state.balances.fashion + state.balances.skincare;
    
    if(document.getElementById('txt-main-balance')) document.getElementById('txt-main-balance').innerText = formatIDR(state.balances.main);
    if(document.getElementById('txt-modal-jualan')) document.getElementById('txt-modal-jualan').innerText = formatIDR(state.balances.modal_jualan);
    if(document.getElementById('txt-cash-balance')) document.getElementById('txt-cash-balance').innerText = formatIDR(state.balances.cash);
    if(document.getElementById('txt-ewallet-balance')) document.getElementById('txt-ewallet-balance').innerText = formatIDR(state.balances.ewallet);
    if(document.getElementById('txt-business-profit')) document.getElementById('txt-business-profit').innerText = formatIDR(state.balances.profit);
    
    const realPiutang = state.transactions.filter(t => t.status === 'Hutang').reduce((acc, c) => acc + c.totalPayment, 0);
    state.balances.piutang = realPiutang;
    if(document.getElementById('txt-total-piutang')) document.getElementById('txt-total-piutang').innerText = formatIDR(state.balances.piutang);
    
    if(document.getElementById('txt-fashion-balance')) document.getElementById('txt-fashion-balance').innerText = formatIDR(state.balances.fashion);
    if(document.getElementById('txt-skincare-balance')) document.getElementById('txt-skincare-balance').innerText = formatIDR(state.balances.skincare);
    
    const currentProgressMoney =
    state.balances.cash +
    state.balances.ewallet +
    state.balances.modal_jualan +
    state.balances.profit;
    if(document.getElementById('recap-cek-val')) document.getElementById('recap-cek-val').innerText = formatIDR(currentProgressMoney);
    if(document.getElementById('recap-profit-val')) document.getElementById('recap-profit-val').innerText = formatIDR(state.balances.profit);
    
    // 🔥 1. PROGRESS BAR & TARGET TEXT FIX (Menembak ID yang tepat & Anti Error)
    const targetText = document.getElementById('saving-percent-text');
    const progressBar = document.getElementById('saving-progress-bar');
    if (targetText && progressBar && state.weeklyTarget > 0) {
        const percentage = Math.min(Math.round((currentProgressMoney / state.weeklyTarget) * 100), 100);
        targetText.innerText = `${percentage}% Tercapai`;
        progressBar.style.width = `${percentage}%`;
    }

    // 🔥 2. STATUS HUTANG KATEGORI INTERN FIX
    const internalDebtStatus = document.getElementById('internal-debt-status');
    if (internalDebtStatus) {
        if (state.categoryDebts && state.categoryDebts.length > 0) {
            let debtSummary = state.categoryDebts.map(d => `Pos <b>${d.from.toUpperCase()}</b> pinjam ke <b>${d.to.toUpperCase()}</b> sebesar ${formatIDR(d.amount)}`).join('<br>');
            internalDebtStatus.innerHTML = `<span style="color:#EAB308;">⚠️ ${debtSummary}</span>`;
        } else {
            internalDebtStatus.innerHTML = `Sistem seimbang. Tidak ada hutang kategori.`;
        }
    }
    
    renderDebtList();
    renderRecapHistoryList();
    renderGlobalHistoryList();
    renderCharts();
}

function renderDebtList() {
    const list = document.getElementById('piutang-list');
    if (!list) return;
    list.innerHTML = "";
    
    const activeDebts = state.transactions.filter(t => t.status === 'Hutang');
    if (activeDebts.length === 0) {
        list.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:24px;">Tidak ada piutang aktif.</p>`;
        return;
    }
    activeDebts.forEach(t => {
        list.innerHTML += `
            <div class="transaction-card">
                <div class="tx-details">
                    <h4>${t.customer}</h4>
                    <p>${t.type.toUpperCase()} • ${t.date}</p>
                </div>
                <div class="tx-action-side">
                    <span class="tx-amount text-danger">${formatIDR(t.totalPayment)}</span>
                    <button class="btn-sm-action" onclick="triggerMarkAsPaid('${t.id}')">Tandai Lunas</button>
                </div>
            </div>`;
    });
}

// Gunakan window. global scope agar fungsi inline onclick HTML dapat memanggilnya
window.triggerMarkAsPaid = triggerMarkAsPaid;
window.deleteTransaction = deleteTransaction;
window.undoDeleteTransaction = undoDeleteTransaction;
window.openActionModal = openActionModal;
window.openManualTracker = openManualTracker;

function renderRecapHistoryList() {
    const rcpList = document.getElementById('recap-history-list');
    if (!rcpList) return;
    rcpList.innerHTML = "";
    if (state.recapHistory.length === 0) {
        rcpList.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">Belum ada riwayat rekap.</p>`;
    } else {
        state.recapHistory.forEach(r => {
            rcpList.innerHTML += `
                <div class="transaction-card">
                    <div class="tx-details"><h4>${r.date}</h4><p>Sisa Kas Bersih Terbagi</p></div>
                    <div class="tx-action-side"><span class="tx-amount text-success">+${formatIDR(r.allocatedEach)}</span></div>
                </div>`;
        });
    }
}

function renderGlobalHistoryList() {
    const list = document.getElementById('global-history-list');
    if (!list) return;
    list.innerHTML = "";
    
    if (state.transactions.length === 0) {
        list.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:24px;">Belum ada aktivitas transaksi.</p>`;
        return;
    }
    state.transactions.forEach(t => {
        const isLunas = t.status === 'Lunas';
        list.innerHTML += `
            <div class="history-item-card" style="margin-bottom:10px;">
                <div class="tx-details">
                    <h4>${t.customer} (${t.type.toUpperCase()})</h4>
                    <p>${t.date} • <span style="font-size:10px; color:var(--text-muted);">${t.notes || ''}</span></p>
                    <span class="tag-info" style="background:${isLunas?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}; color:${isLunas?'#14F195':'#EF4444'}">${t.status}</span>
                </div>
                <div class="tx-action-side">
                    <span class="tx-amount ${isLunas ? 'text-success' : 'text-danger'}" style="margin-bottom:6px;">${formatIDR(t.totalPayment)}</span>
                    <button onclick="deleteTransaction('${t.id}')" style="background:none; border:none; color:var(--color-danger); font-size:11px; cursor:pointer; text-decoration:underline;">Hapus</button>
                </div>
            </div>`;
    });
}

function renderCharts() {
    const ctxGrowth = document.getElementById('chartGrowth');
    const ctxSpending = document.getElementById('chartSpending');
    if (!ctxGrowth || !ctxSpending || !window.Chart) return;

    if (chartGrowthInstance) chartGrowthInstance.destroy();
    if (chartSpendingInstance) chartSpendingInstance.destroy();

    chartGrowthInstance = new Chart(ctxGrowth, {
        type: 'line',
        data: {
            labels: ['Base', 'W-1', 'Current'],
            datasets: [{
                label: 'Trend Saldo', data: [state.balances.main_baseline, state.balances.main * 0.95, state.balances.main], borderColor: '#14F195', tension: 0.4, borderWidth: 2, fill: false
            }]
        },
        options: { responsive: true }
    });

    chartSpendingInstance = new Chart(ctxSpending, {
        type: 'bar',
        data: {
            labels: ['Stok', 'Cash', 'E-Wallet', 'Fashion', 'Skincare'],
            datasets: [{
                data: [state.balances.modal_jualan, state.balances.cash, state.balances.ewallet, state.balances.fashion, state.balances.skincare],
                backgroundColor: ['#14F195', '#9945FF', '#00D1FF', '#3B82F6', '#EC4899']
            }]
        },
        options: { responsive: true }
    });
}

function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}
