// Hàm lấy dữ liệu từ IndexedDB
async function getDataFromIndexedDB(storeName) {
    try {
        const databases = await indexedDB.databases();
        const dbInfo = databases.find(db => db.name.startsWith("zdb_"));
        if (!dbInfo) throw "Database không tồn tại";
        
        const dbName = dbInfo.name;
        const currentUserId = dbName.split('zdb_')[1];
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = (e) => {
                const db = e.target.result;
                const store = db.transaction(storeName, "readonly").objectStore(storeName);
                
                store.getAll().onsuccess = (event) => {
                    let data = event.target.result;
                    if (storeName === 'group') {
                        data = data.map(group => ({...group, isAdmin: group.creatorId === currentUserId}));
                    }
                    resolve(data);
                };
            };
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (error) {
        throw error;
    }
}

// UI Components
const createContainer = () => {
    const container = document.createElement('div');
    container.id = 'extension-container';
    Object.assign(container.style, {
        width: '45%', height: '100%', position: 'fixed',
        top: '0', right: '0', zIndex: '9999',
        backgroundColor: 'white',
        boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
        overflow: 'auto',
        transition: 'transform 0.3s ease-out'
    });
    return container;
};

// Table Management
const TableManager = {
    initStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #listAll { width: 100%; border-collapse: collapse; margin-top: 20px; }
            #listAll th, #listAll td { padding: 8px; text-align: left; border: 1px solid #ddd; }
            #listAll th { background-color: #f4f4f4; }
            .checkbox-column { width: 40px; text-align: center !important; }
            .header-checkbox, .row-checkbox { width: 18px; height: 18px; cursor: pointer; margin: 0; }
            #listAll tr.selected { background-color: #f0f7ff; }
            .checkbox-actions { margin: 10px 0; display: none; }
            .checkbox-actions.show { display: block; }
            .checkbox-actions button { margin-right: 10px; padding: 5px 10px; border: none; 
                border-radius: 4px; background-color: #007bff; color: white; cursor: pointer; }
            .search-input { margin: 0 0 20px 20px; padding: 8px; width: 200px; 
                border-radius: 4px; border: 1px solid #ddd; }
            #dataSelect { margin: 20px; padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
        `;
        document.head.appendChild(style);
    },

    displayData(data, type) {
        const tableBody = document.querySelector('#listAll tbody');
        if (!tableBody) return;

        // Add checkbox column if not exists
        if (!document.querySelector('#listAll thead th.checkbox-column')) {
            const headerRow = document.querySelector('#listAll thead tr');
            const checkboxHeader = document.createElement('th');
            checkboxHeader.className = 'checkbox-column';
            checkboxHeader.innerHTML = '<input type="checkbox" class="header-checkbox">';
            headerRow.insertBefore(checkboxHeader, headerRow.firstChild);
        }

        tableBody.innerHTML = data?.length ? data.map(item => `
            <tr>
                <td class="checkbox-column"><input type="checkbox" class="row-checkbox"></td>
                <td>${item.userId || 'N/A'}</td>
                <td>${item.displayName || 'N/A'}</td>
                <td>${type === 'friend' || item.type === 'friend' ? '-' : 
                    (item.isAdmin ? 'Admin' : 'Thành viên')}</td>
            </tr>
        `).join('') : '<tr><td colspan="4">Không có dữ liệu</td></tr>';

        this.initCheckboxes();
    },

    initCheckboxes() {
        const headerCheckbox = document.querySelector('.header-checkbox');
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');
        
        headerCheckbox?.addEventListener('change', e => {
            rowCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
                this.updateRowSelection(cb);
            });
            this.updateSelectionCount();
        });

        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateRowSelection(cb);
                this.updateHeaderCheckbox();
                this.updateSelectionCount();
            });
        });

        document.getElementById('export-selected')?.addEventListener('click', this.exportData);
        document.getElementById('copy-selected')?.addEventListener('click', this.copyIds);
    },

    updateRowSelection(checkbox) {
        checkbox.closest('tr').classList.toggle('selected', checkbox.checked);
    },

    updateHeaderCheckbox() {
        const headerCheckbox = document.querySelector('.header-checkbox');
        const rowCheckboxes = Array.from(document.querySelectorAll('.row-checkbox'));
        headerCheckbox.checked = rowCheckboxes.every(cb => cb.checked);
        headerCheckbox.indeterminate = rowCheckboxes.some(cb => cb.checked) && !headerCheckbox.checked;
    },

    updateSelectionCount() {
        const count = document.querySelectorAll('.row-checkbox:checked').length;
        document.getElementById('selected-count').textContent = count ? `Đã chọn ${count} mục` : '';
        document.querySelector('.checkbox-actions').classList.toggle('show', count > 0);
    },

    exportData() {
        const data = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => {
            const row = cb.closest('tr');
            return {
                userId: row.cells[1].textContent.trim(),
                displayName: row.cells[2].textContent.trim(),
                status: row.cells[3].textContent.trim()
            };
        });
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected-data.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    copyIds() {
        const ids = Array.from(document.querySelectorAll('.row-checkbox:checked'))
            .map(cb => cb.closest('tr').cells[1].textContent.trim());
        navigator.clipboard.writeText(ids.join('\n'))
            .then(() => alert('Đã sao chép ID!'))
            .catch(err => console.error('Lỗi:', err));
    }
};

// Main Functions
async function loadExtension(container) {
    try {
        const html = await fetch(chrome.runtime.getURL('extension-ui.html')).then(r => r.text());
        container.innerHTML = html;
        setTimeout(() => container.classList.add('show'), 50);

        const [friends, groups] = await Promise.all([
            getDataFromIndexedDB('friend'),
            getDataFromIndexedDB('group')
        ]);

        initUI(friends, groups);
    } catch (error) {
        container.innerHTML = `<div style="padding: 20px; color: red;">
            <h2>Lỗi</h2><p>${error}</p></div>`;
    }
}

function initUI(friends, groups) {
    const dataSelect = document.getElementById('dataSelect');
    if (!dataSelect) return;

    TableManager.initStyles();
    
    // Add search
    const searchInput = document.createElement('input');
    Object.assign(searchInput, {
        type: 'text',
        placeholder: 'Tìm kiếm...',
        className: 'search-input'
    });
    dataSelect.parentNode.insertBefore(searchInput, dataSelect.nextSibling);
    
    searchInput.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#listAll tbody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    });

    // Handle data display
    const updateDisplay = (type) => {
        let displayData;
        switch(type) {
            case 'Friend$Group':
                displayData = [...friends.map(f => ({...f, type: 'friend'})), 
                             ...groups.map(g => ({...g, type: 'group'}))];
                break;
            case 'Friend':
                displayData = friends;
                break;
            case 'AllGroup':
                displayData = groups;
                break;
            case 'IsGroupAdmin':
                displayData = groups.filter(g => g.isAdmin);
                break;
            case 'IsNotGroupAdmin':
                displayData = groups.filter(g => !g.isAdmin);
                break;
        }
        TableManager.displayData(displayData, type);
    };

    dataSelect.addEventListener('change', e => updateDisplay(e.target.value));
    updateDisplay(dataSelect.value);
}

function adjustLayout(active) {
    const zaloContainer = document.querySelector('div#container.flx.WEB');
    if (!zaloContainer) return;
    
    const extensionContainer = document.getElementById('extension-container') || createContainer();
    
    if (active) {
        if (!document.contains(extensionContainer)) {
            document.body.appendChild(extensionContainer);
            loadExtension(extensionContainer);
        }
        extensionContainer.classList.add('show');
        zaloContainer.style.width = '54%';
    } else {
        extensionContainer.classList.remove('show');
        setTimeout(() => extensionContainer.remove(), 300);
        zaloContainer.style.width = '100%';
    }
}

// Event Listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleExtension") {
        adjustLayout(request.state);
    }
});

chrome.storage.local.get(['extensionActive'], (result) => {
    if (result.extensionActive) adjustLayout(true);
});