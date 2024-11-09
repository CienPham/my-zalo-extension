// Hàm lấy dữ liệu từ IndexedDB của Zalo Web
function getFriendsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const dbName = "zdb_136943695786069414"; // Đảm bảo đây là tên đúng của database
        const dbRequest = indexedDB.open(dbName);

        dbRequest.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction("friend", "readonly");
            const objectStore = transaction.objectStore("friend");
            const getAllRequest = objectStore.getAll();
            getAllRequest.onsuccess = function(event) {
                const friends = event.target.result;
                resolve(friends);
            };
        };
    });
}
function getGroupsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const dbName = "zdb_136943695786069414";
        const dbRequest = indexedDB.open(dbName);
        dbRequest.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction("group", "readonly");
            const objectStore = transaction.objectStore("group");
            const getAllRequest = objectStore.getAll();
            getAllRequest.onsuccess = function(event) {
                const groups = event.target.result;
                resolve(groups);
            };
        };
    });
}

// Hàm điều chỉnh giao diện
function adjustLayout(active) {
    const zaloContainer = document.querySelector('div#container.flx.WEB');
    if (zaloContainer) {
        if (active) {
            let extensionContainer = document.getElementById('extension-container');
            if (!extensionContainer) {
                extensionContainer = document.createElement('div');
                extensionContainer.id = 'extension-container';
                extensionContainer.style.width = '45%';
                extensionContainer.style.height = '100%';
                extensionContainer.style.position = 'fixed';
                extensionContainer.style.top = '0';
                extensionContainer.style.right = '0';
                extensionContainer.style.zIndex = '9999';
                extensionContainer.style.backgroundColor = 'white';
                extensionContainer.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)';
                extensionContainer.style.overflow = 'auto';
                document.body.appendChild(extensionContainer);

                // Tải nội dung từ file HTML
                fetch(chrome.runtime.getURL('extension-ui.html'))
                    .then(response => response.text())
                    .then(data => {
                        extensionContainer.innerHTML = data;
                        // Thêm lớp 'show' sau một khoảng thời gian ngắn để kích hoạt animation
                        setTimeout(() => extensionContainer.classList.add('show'), 50);

                        // Sau khi tải xong nội dung, lấy cả bạn bè và nhóm
                        return Promise.all([getFriendsFromIndexedDB(), getGroupsFromIndexedDB()]);
                    })
                    .then(([friends, groups]) => {
                        displayFriends(friends);  // Hiển thị danh sách bạn bè
                        displayGroups(groups);    // Hiển thị danh sách nhóm
                    })
                    .catch(error => {
                        console.error("Lỗi:", error);
                        displayError(error);
                    });
            } else {
                extensionContainer.classList.add('show');
            }

            // Thay đổi chiều rộng của container Zalo với animation
            zaloContainer.style.width = '54%';
            zaloContainer.style.transition = 'width 0.3s ease-out';
        } else {
            let extensionContainer = document.getElementById('extension-container');
            if (extensionContainer) {
                extensionContainer.classList.remove('show');
                // Xóa container sau khi animation kết thúc
                setTimeout(() => extensionContainer.remove(), 300);
            }

            // Khôi phục chiều rộng của container Zalo với animation
            zaloContainer.style.width = '100%';
            zaloContainer.style.transition = 'width 0.3s ease-out';
        }
    }
}

// Hàm hiển thị danh sách bạn bè
function displayFriends(friends) {
    const tableBody = document.querySelector('#friendsTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';

        if (friends && friends.length > 0) {
            friends.forEach((friend, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${friend.userId || 'N/A'}</td>
                    <td>${friend.displayName || 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="3">Không tìm thấy dữ liệu bạn bè</td></tr>';
        }
    }
}

function displayGroups(groups) {
    const tableBody = document.querySelector('#groupsTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
        if (groups && groups.length > 0) {
            groups.forEach((group, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${group.userId || 'N/A'}</td>
                    <td>${group.displayName || 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="3">Không tìm thấy dữ liệu nhóm</td></tr>';
        }
    }
}



// Hàm hiển thị lỗi
function displayError(error) {
    const extensionContainer = document.getElementById('extension-container');
    if (extensionContainer) {
        extensionContainer.innerHTML = `
            <div style="padding: 20px; color: red;">
                <h2>Đã xảy ra lỗi</h2>
                <p>${error}</p>
            </div>
        `;
    }
}

// Lắng nghe sự kiện từ background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleExtension") {
        adjustLayout(request.state);
    }
});

// Kiểm tra trạng thái extension khi trang được tải
chrome.storage.local.get(['extensionActive'], (result) => {
    if (result.extensionActive) {
        adjustLayout(true);
    }
});