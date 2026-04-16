const SHOP_AUTH_STORAGE_KEY = 'cosy-cat-shop-admin-auth-v1';
const SHOP_PRODUCTS_STORAGE_KEY = 'cosy-cat-shop-products-v1';
const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboardPage();
});

async function initializeDashboardPage() {
    const session = readSession();
    if (!session?.username || session.role !== 'admin') {
        window.location.href = './login.html';
        return;
    }

    applyProfileMenuState(session);
    activateRequestedTab();

    const ui = getDashboardElements();
    if (!ui) {
        return;
    }

    const defaults = await fetchJson('./data/products.json');

    const defaultProducts = Array.isArray(defaults) ? defaults.map(normalizeProduct) : [];
    const storedProducts = shouldUsePreviewProducts() ? readStoredProducts() : null;
    const state = {
        products: storedProducts ?? [...defaultProducts]
    };

    let pendingImagePath = '';
    let selectedSizes = [];

    const showAlert = (message, type) => {
        ui.alertEl.textContent = message;
        ui.alertEl.className = `alert mt-4 alert-${type}`;
    };

    const refreshData = () => {
        renderProductPreview(state.products, ui.productPreviewGrid);
        ui.productCountEl.textContent = String(state.products.length);
        const summary = getCategorySummary(state.products);
        ui.categoryCountEl.textContent = String(summary.length);
        ui.categorySummaryEl.innerHTML = summary.length
            ? summary.map((item) => `<li>${escapeHtml(item.name)} (${item.count})</li>`).join('')
            : '<li>No categories yet.</li>';
    };

    const saveProducts = () => {
        persistProducts(state.products);
        refreshData();
    };

    const clearProductForm = () => {
        ui.productForm.reset();
        ui.productOriginalId.value = '';
        ui.productImageFile.value = '';
        selectedSizes = [];
        renderSizes();
        pendingImagePath = '';
    };

    const syncSizeField = () => {
        ui.productSizes.value = selectedSizes.join(', ');
    };

    const renderSizes = () => {
        syncSizeField();
        if (!ui.productSizesList) {
            return;
        }

        ui.productSizesList.innerHTML = selectedSizes.map((size, index) => `
            <button type="button" class="shop-chip" data-action="remove-size" data-index="${index}" aria-label="Remove variant ${escapeHtml(size)}">
                ${escapeHtml(size)} <span aria-hidden="true">&times;</span>
            </button>
        `).join('');
    };

    const addSize = () => {
        const value = ui.productSizeInput.value.trim();
        if (!value) {
            return;
        }

        if (selectedSizes.includes(value)) {
            showAlert('Variant already added.', 'warning');
            ui.productSizeInput.value = '';
            return;
        }

        selectedSizes.push(value);
        ui.productSizeInput.value = '';
        renderSizes();
    };

    ui.addProductSizeBtn.addEventListener('click', addSize);
    ui.productSizeInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        addSize();
    });

    ui.productSizesList.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('[data-action="remove-size"]');
        if (!(button instanceof HTMLElement)) {
            return;
        }

        const index = Number.parseInt(button.dataset.index || '-1', 10);
        if (index < 0 || index >= selectedSizes.length) {
            return;
        }

        selectedSizes.splice(index, 1);
        renderSizes();
    });

    ui.productImageFile.addEventListener('change', async () => {
        const file = ui.productImageFile.files?.[0];
        if (!file) {
            pendingImagePath = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            showAlert('Please select a valid image file.', 'warning');
            ui.productImageFile.value = '';
            pendingImagePath = '';
            return;
        }

        pendingImagePath = `./images/${sanitizeFileName(file.name)}`;
        showAlert(`Image path set to ${pendingImagePath}. Place this file in shop/images before publishing.`, 'info');
    });

    ui.productForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const previousId = ui.productOriginalId.value.trim();
        const existingProduct = previousId ? state.products.find((item) => item.id === previousId) : null;
        const productId = previousId || generateProductId();
        const imageValue = pendingImagePath || existingProduct?.image || './images/placeholder-product.svg';
        const draft = {
            id: productId,
            name: ui.productName.value.trim(),
            category: ui.productCategory.value.trim(),
            description: ui.productDescription.value.trim(),
            price: Number.parseInt(ui.productPrice.value, 10),
            image: imageValue,
            imageAlt: ui.productImageAlt.value.trim(),
            sizes: [...selectedSizes],
            colors: splitCommaList(ui.productColors.value)
        };

        if (!draft.name || !draft.category || !draft.description || !Number.isFinite(draft.price)) {
            showAlert('Product name, category, description, and price are required.', 'warning');
            return;
        }

        if (!draft.image.startsWith('./images/')) {
            showAlert('Image must be a path under ./images/.', 'warning');
            return;
        }

        const normalized = normalizeProduct(draft);
        const existingIndex = state.products.findIndex((item) => item.id === (previousId || normalized.id));
        const duplicate = state.products.some((item, index) => item.id === normalized.id && index !== existingIndex);

        if (duplicate) {
            showAlert('Product id already exists.', 'warning');
            return;
        }

        if (existingIndex >= 0) {
            state.products[existingIndex] = normalized;
            showAlert('Product updated.', 'success');
        } else {
            state.products.push(normalized);
            showAlert('Product added.', 'success');
        }

        saveProducts();
        clearProductForm();
        pendingImagePath = '';
    });

    ui.productPreviewGrid.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const actionButton = target.closest('[data-action][data-id]');
        if (actionButton instanceof HTMLElement) {
            const action = actionButton.dataset.action;
            const id = actionButton.dataset.id;
            if (!action || !id) return;

            const product = state.products.find((item) => item.id === id);
            if (!product) return;

            if (action === 'edit-product') {
                ui.productOriginalId.value = product.id;
                ui.productName.value = product.name;
                ui.productCategory.value = product.category || 'General';
                ui.productDescription.value = product.description;
                ui.productPrice.value = String(product.price);
                ui.productImageAlt.value = product.imageAlt || '';
                selectedSizes = Array.isArray(product.sizes) ? [...product.sizes] : splitCommaList(product.sizes);
                renderSizes();
                ui.productColors.value = (product.colors || []).join(', ');
                ui.productImageFile.value = '';
                pendingImagePath = '';
                showAlert(`Editing product ${product.name}.`, 'info');
                const tabPane = document.getElementById('product-management-tab-pane');
                if (tabPane) {
                    tabPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else if (action === 'delete-product') {
                const confirmed = window.confirm(`Delete ${product.name}? This action cannot be undone.`);
                if (!confirmed) {
                    return;
                }

                state.products = state.products.filter((item) => item.id !== id);

                if (ui.productOriginalId.value.trim() === id) {
                    clearProductForm();
                }

                saveProducts();
                showAlert('Product deleted.', 'info');
            }

            return;
        }

        const interactiveSelector = 'button, a, select, option, input, textarea, label';
        if (target.closest(interactiveSelector)) {
            return;
        }

        const card = target.closest('.js-product-card');
        if (!(card instanceof HTMLElement)) {
            return;
        }

        const url = card.dataset.productUrl;
        if (url) {
            window.location.href = url;
        }
    });

    ui.productPreviewGrid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('js-product-card')) {
            return;
        }

        event.preventDefault();
        const url = target.dataset.productUrl;
        if (url) {
            window.location.href = url;
        }
    });

    ui.resetProductsBtn.addEventListener('click', () => {
        state.products = [...defaultProducts];
        clearStoredProducts();
        refreshData();
        clearProductForm();
        showAlert('Products reset to defaults.', 'info');
    });

    ui.exportProductsBtn.addEventListener('click', () => {
        const prettyJson = JSON.stringify(state.products, null, 2);
        downloadTextFile('products.json', prettyJson, 'application/json');
        showAlert('Exported products.json. Replace shop/data/products.json with the downloaded file and commit.', 'success');
    });

    ui.clearProductFormBtn.addEventListener('click', clearProductForm);

    document.querySelectorAll('.js-shop-logout-btn').forEach((button) => {
        button.addEventListener('click', () => {
            localStorage.removeItem(SHOP_AUTH_STORAGE_KEY);
            window.location.href = './index.html';
        });
    });

    refreshData();
    renderSizes();
}

function activateRequestedTab() {
    const hash = window.location.hash;
    if (hash !== '#product-management-tab') {
        return;
    }

    const trigger = document.getElementById('product-management-tab');
    if (!trigger) {
        return;
    }

    const tab = new bootstrap.Tab(trigger);
    tab.show();
}

function shouldUsePreviewProducts() {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === '1';
}

function getDashboardElements() {
    const elements = {
        alertEl: document.getElementById('dashboardAlert'),
        productCountEl: document.getElementById('shopStatProducts'),
        productForm: document.getElementById('productCmsForm'),
        productOriginalId: document.getElementById('productOriginalId'),
        productName: document.getElementById('cmsProductName'),
        productDescription: document.getElementById('cmsProductDescription'),
        productCategory: document.getElementById('cmsProductCategory'),
        productPrice: document.getElementById('cmsProductPrice'),
        productImageFile: document.getElementById('cmsProductImageFile'),
        productImageAlt: document.getElementById('cmsProductImageAlt'),
        productSizeInput: document.getElementById('cmsProductSizeInput'),
        addProductSizeBtn: document.getElementById('addProductSizeBtn'),
        productSizes: document.getElementById('cmsProductSizes'),
        productSizesList: document.getElementById('cmsProductSizesList'),
        productColors: document.getElementById('cmsProductColors'),
        productPreviewGrid: document.getElementById('productCmsPreviewGrid'),
        categoryCountEl: document.getElementById('shopStatCategories'),
        categorySummaryEl: document.getElementById('shopCategorySummary'),
        clearProductFormBtn: document.getElementById('clearProductFormBtn'),
        exportProductsBtn: document.getElementById('exportProductsBtn'),
        resetProductsBtn: document.getElementById('resetProductsBtn')
    };

    return Object.values(elements).every(Boolean) ? elements : null;
}

function renderProductPreview(products, el) {
    if (!products.length) {
        el.innerHTML = '<div class="col-12"><p class="text-muted mb-0">No products to preview yet.</p></div>';
        return;
    }

    el.innerHTML = products.map((product) => {
        const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Standard'];
        const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : ['Default'];
        const defaultSize = product.defaultSize || sizes[0];
        const defaultColor = product.defaultColor || colors[0];
        const price = Number.isFinite(product.price) ? product.price : 0;
        const productId = product.id || slugify(product.name || 'cat-item');
        const productUrl = `./product.html?id=${encodeURIComponent(productId)}`;
        const category = String(product.category || 'General').trim();
        const imageClass = /phone\s*case/i.test(category) ? 'shop-card-img shop-card-img--fit' : 'shop-card-img';
        const sizeOptions = sizes.map((size) => `<option value="${escapeHtml(size)}"${size === defaultSize ? ' selected' : ''}>${escapeHtml(size)}</option>`).join('');
        const colorOptions = colors.map((color) => `<option value="${escapeHtml(color)}"${color === defaultColor ? ' selected' : ''}>${escapeHtml(color)}</option>`).join('');

        return `
            <div class="col-md-6 col-lg-3">
                <article class="shop-card h-100 js-product-card" data-product-url="${productUrl}" tabindex="0" role="link" aria-label="View details for ${escapeHtml(product.name || 'Cat-themed Product')}">
                    <img src="${escapeHtml(product.image || 'https://placekitten.com/740/500')}" class="${imageClass}" alt="${escapeHtml(product.imageAlt || product.name || 'Cat-themed Product')}">
                    <div class="shop-card-body">
                        <p class="shop-category-chip mb-2">${escapeHtml(category)}</p>
                        <h3 class="h5">${escapeHtml(product.name || 'Cat-themed Product')}</h3>
                        <div class="shop-variant-grid mb-3">
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Variant</span>
                                <select class="form-select form-select-sm" disabled>
                                    ${sizeOptions}
                                </select>
                            </label>
                            <label class="shop-variant-field">
                                <span class="shop-variant-label">Style</span>
                                <select class="form-select form-select-sm" disabled>
                                    ${colorOptions}
                                </select>
                            </label>
                        </div>
                        <div class="shop-card-meta">
                            <span class="shop-price">${CURRENCY_FORMAT.format(price)}</span>
                            <div class="shop-card-actions">
                                <button class="btn btn-sm btn-outline-secondary" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}">Edit</button>
                                <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}">Delete</button>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }).join('');
}

function applyProfileMenuState(session) {
    const isLoggedIn = !!session?.username;
    const isAdmin = isLoggedIn && session.role === 'admin';

    document.querySelectorAll('.js-shop-login-item').forEach((item) => {
        item.classList.toggle('d-none', isLoggedIn);
    });
    document.querySelectorAll('.js-shop-profile-item').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
    document.querySelectorAll('.js-shop-dashboard-item').forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    document.querySelectorAll('.js-shop-product-management-item').forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    document.querySelectorAll('.js-shop-auth-divider').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
    document.querySelectorAll('.js-shop-logout-btn').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
}

async function fetchJson(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load ${path}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

function splitCommaList(value) {
    if (!value) {
        return [];
    }

    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeProduct(product) {
    const normalizedSizes = Array.isArray(product.sizes) ? product.sizes : splitCommaList(product.sizes);
    const normalizedColors = Array.isArray(product.colors) ? product.colors : splitCommaList(product.colors);
    const normalizedCategory = String(product.category || 'General').trim() || 'General';
    const normalizedImage = normalizeImagePath(product.image);

    return {
        id: String(product.id || generateProductId()).trim(),
        name: String(product.name || 'Cat-themed Product').trim(),
        category: normalizedCategory,
        description: String(product.description || '').trim(),
        price: Number.isFinite(product.price) ? product.price : Number.parseInt(String(product.price || '0'), 10) || 0,
        image: normalizedImage,
        imageAlt: String(product.imageAlt || '').trim(),
        sizes: normalizedSizes.length ? normalizedSizes : ['Standard'],
        defaultSize: String(product.defaultSize || normalizedSizes[0] || 'Standard').trim(),
        colors: normalizedColors.length ? normalizedColors : ['Default'],
        defaultColor: String(product.defaultColor || normalizedColors[0] || 'Default').trim()
    };
}

function getCategorySummary(products) {
    const counter = new Map();

    products.forEach((product) => {
        const category = String(product.category || 'General').trim() || 'General';
        counter.set(category, (counter.get(category) || 0) + 1);
    });

    return [...counter.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function generateProductId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sanitizeFileName(fileName) {
    return String(fileName)
        .trim()
    .replace(/\s+/g, ' ')
        .replace(/[^a-zA-Z0-9._-]/g, '');
}

function normalizeImagePath(pathValue) {
    const imagePath = String(pathValue || '').trim();
    if (imagePath.startsWith('./images/')) {
        return imagePath;
    }

    return './images/placeholder-product.svg';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function readSession() {
    try {
        const raw = localStorage.getItem(SHOP_AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Failed to parse session.', error);
        return null;
    }
}

function readStoredProducts() {
    try {
        const raw = localStorage.getItem(SHOP_PRODUCTS_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return null;
        }

        return parsed.map(normalizeProduct);
    } catch (error) {
        console.error('Failed to read stored products.', error);
        return null;
    }
}

function persistProducts(products) {
    try {
        localStorage.setItem(SHOP_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
        console.error('Failed to store products.', error);
    }
}

function clearStoredProducts() {
    try {
        localStorage.removeItem(SHOP_PRODUCTS_STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear stored products.', error);
    }
}

function downloadTextFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
