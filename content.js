// Hàm lấy dữ liệu từ IndexedDB
async function getDataFromIndexedDB(storeName) {
    return new Promise(async (resolve, reject) => {
        try {
            const databases = await indexedDB.databases();
            const dbInfo = databases.find(db => db.name.startsWith("zdb_"));          
            if (!dbInfo) {
                reject("Không tìm thấy database nào có tên bắt đầu với 'zdb_'");
                return;
            }
            const dbName = dbInfo.name;
            const dbRequest = indexedDB.open(dbName);
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(storeName, "readonly");
                const objectStore = transaction.objectStore(storeName);
                
                // Lấy tất cả dữ liệu trong object store
                const request = objectStore.getAll();
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            };
            dbRequest.onerror = (event) => {
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

// Hàm điều chỉnh giao diện
function adjustLayout(active) {
    const zaloContainer = document.querySelector('div#container.flx.WEB');
    if (!zaloContainer) return;
    const extensionContainer = document.getElementById('extension-container') || createExtensionContainer();
    if (active) {
        if (!document.contains(extensionContainer)) {
            document.body.appendChild(extensionContainer);
            loadExtensionContent(extensionContainer);
        }
        extensionContainer.classList.add('show');
        zaloContainer.style.width = '54%';
    } else {
        extensionContainer.classList.remove('show');
        setTimeout(() => extensionContainer.remove(), 300);
        zaloContainer.style.width = '100%';
    }
}

// Tạo container cho extension
function createExtensionContainer() {
    const container = document.createElement('div');
    container.id = 'extension-container';
    Object.assign(container.style, {
        width: '45%',
        height: '100%',
        position: 'fixed',
        top: '0',
        right: '0',
        zIndex: '9999',
        backgroundColor: 'white',
        boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
        overflow: 'auto',
        transition: 'transform 0.3s ease-out'
    });
    return container;
}

// Hàm hiển thị dữ liệu trong bảng
function displayCombinedData(data, type) {
    const tableBody = document.querySelector('#listAll tbody');
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Không tìm thấy dữ liệu</td></tr>';
        return;
    }

    let htmlContent = '';
    data.forEach((item, index) => {
        const isFriend = type === 'friend' || item.type === 'friend';
        htmlContent += `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <span class="type-badge ${isFriend ? 'type-friend' : 'type-group'}">
                        ${isFriend ? 'Bạn bè' : 'Nhóm'}
                    </span>
                </td>
                <td>${item.userId || 'N/A'}</td>
                <td>${item.displayName || 'N/A'}</td>
                <td>${isFriend ? '-' : (item.isAdmin ? 'Admin' : 'Thành viên')}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = htmlContent;
}

// Hàm cập nhật hiển thị dựa trên lựa chọn
function updateDisplay(friends, groups, selectedValue) {
    switch(selectedValue) {
        case 'Friend$Group':
            const combinedData = [
                ...friends.map(friend => ({ ...friend, type: 'friend' })),
                ...groups.map(group => ({ ...group, type: 'group' }))
            ];
            displayCombinedData(combinedData, 'mixed');
            break;
            
        case 'Friend':
            displayCombinedData(friends, 'friend');
            break;
            
        case 'AllGroup':
            displayCombinedData(groups, 'group');
            break;
            
        case 'IsGroupAdmin':
            const adminGroups = groups.filter(group => group.isAdmin);
            displayCombinedData(adminGroups, 'group');
            break;
            
        case 'IsNotGroupAdmin':
            const nonAdminGroups = groups.filter(group => !group.isAdmin);
            displayCombinedData(nonAdminGroups, 'group');
            break;
    }
}

// Thêm tính năng tìm kiếm
function addSearchFeature() {
    const searchInput = document.createElement('input');
    Object.assign(searchInput, {
        type: 'text',
        placeholder: 'Tìm kiếm...',
        className: 'search-input'
    });
    Object.assign(searchInput.style, {
        margin: '0 0 20px 20px',
        padding: '8px',
        width: '200px',
        borderRadius: '4px',
        border: '1px solid #ddd'
    });
    
    const selectElement = document.getElementById('dataSelect');
    selectElement.parentNode.insertBefore(searchInput, selectElement.nextSibling);
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#listAll tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Khởi tạo listener cho select
function initializeSelectListener(friends, groups) {
    const dataSelect = document.getElementById('dataSelect');
    if (!dataSelect) return;

    dataSelect.addEventListener('change', (e) => {
        updateDisplay(friends, groups, e.target.value);
    });
    
    // Hiển thị mặc định khi tải trang
    updateDisplay(friends, groups, dataSelect.value);
}

// Load nội dung extension
async function loadExtensionContent(container) {
    try {
        const htmlContent = await fetch(chrome.runtime.getURL('extension-ui.html')).then(r => r.text());
        container.innerHTML = htmlContent;
        setTimeout(() => container.classList.add('show'), 50);

        const [friends, groups] = await Promise.all([
            getDataFromIndexedDB('friend'),
            getDataFromIndexedDB('group')
        ]);

        // Khởi tạo listener cho select và hiển thị dữ liệu mặc định
        initializeSelectListener(friends, groups);
        // Thêm tính năng tìm kiếm
        addSearchFeature();
    } catch (error) {
        displayError(container, error);
    }
}

// Hiển thị lỗi
function displayError(container, error) {
    container.innerHTML = `
        <div style="padding: 20px; color: red;">
            <h2>Đã xảy ra lỗi</h2>
            <p>${error}</p>
        </div>
    `;
}

// Event listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleExtension") {
        adjustLayout(request.state);
    }
});

// Khởi tạo
chrome.storage.local.get(['extensionActive'], (result) => {
    if (result.extensionActive) adjustLayout(true);
});